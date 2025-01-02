import { CONSTANTS } from "../constants";
import { getActorConfigs, getActorLimit, getHUDState, setHUDState, updateActorConfig, type ActorConfig } from "../settings";
import { emitHUDRefresh } from "../sockets";
import { getGame, getModule } from "../utils";

export default class EmotiveActorSelector extends Application {
  private selectedActors: ActorConfig[] = [];
  protected override _dragDrop: DragDrop[] = [];
  
  constructor(options = {}) {
    super(options);

    // load up settings data
    this._loadFromSettings();

    this._dragDrop = [
      new DragDrop({
        dragSelector: ".actor-item",
        dropSelector: ".drag-area",
        permissions: {
          dragstart: (selector: string | undefined) => this._canDragStart(selector),
          drop: (selector: string | undefined) => this._canDragDrop(selector)
        },
        callbacks: {
          dragstart: this._onDragStart.bind(this),
          drop: this._onDragDrop.bind(this)
        }
      })
    ];
  }

  private async _loadFromSettings(): Promise<void> {
    const hudState = getHUDState();
    const configs = getActorConfigs();
    
    // Load actors in their correct order from HUD state
    this.selectedActors = hudState.actors
      .sort((a, b) => a.position - b.position)
      .map(({uuid}) => {
        const config = configs[uuid];
        return {
          uuid,
          portraitFolder: config?.portraitFolder || ""
        };
      });
  }

  protected override _canDragStart(selector: string | undefined): boolean {
    if (!selector) return false;
    return true;
  }
  
  protected override _canDragDrop(selector: string | undefined): boolean {
    if (!selector) return false;
    return true;
  }

  protected override _onDragStart(event: DragEvent): void {
    if (!event.dataTransfer) return;
    
    const target = event.currentTarget as HTMLElement;
    if (!target?.dataset?.actorId) return;

    const actorId = target.dataset.actorId;
    
    console.log(CONSTANTS.DEBUG_PREFIX, "Actor selected for drag:", actorId);
    
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: "Actor",
      id: actorId
    }));
  }

  protected _onDragDrop(event: DragEvent): void {
    if (!event.dataTransfer) return;
    
    try {
      const data = JSON.parse(event.dataTransfer.getData("text/plain"));
      const actorLimit = getActorLimit();
      
      if (data.type === "Actor" && data.uuid) {
        // Check if we've hit the actor limit
        if (this.selectedActors.length >= actorLimit) {
          ui.notifications?.warn(`Cannot add more actors. Maximum limit of ${actorLimit} reached.`);
          return;
        }
        
        // Check if actor is already in the list
        if (!this.selectedActors.some(actor => actor.uuid === data.uuid)) {
          console.log(CONSTANTS.DEBUG_PREFIX, "Processing Actor drop with ID:", data.uuid);
  
          // Retrieve the existing config for the actor
          const configs = getActorConfigs();
          const actorConfig = configs[data.uuid];
  
          // Use the portraitFolder from config if it exists, or an empty string
          const portraitFolder = actorConfig?.portraitFolder || "";
  
          // Add actor to selectedActors with its existing portrait folder
          this.selectedActors.push({
            uuid: data.uuid,
            portraitFolder: portraitFolder
          });
  
          // Update settings and re-render
          this.render(false);
        }
      }
    } catch (err) {
      console.error(CONSTANTS.DEBUG_PREFIX, "Error processing drop:", err);
    }
  }

  private async _onSelectPortraitFolder(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const uuid = $(event.currentTarget).data('uuid');
    const actor = this.selectedActors.find(a => a.uuid === uuid);
    if (!actor) return;
  
    const fp = new FilePicker({
      type: "folder",
      callback: async (path: string) => {
        try {
          actor.portraitFolder = path;
          this.render(true);
        } catch (error) {
          console.error(CONSTANTS.DEBUG_PREFIX, 'Error setting portrait folder:', error);
          ui.notifications?.error("Failed to set portrait folder");
        }
      },
    });
    fp.browse( actor.portraitFolder || "");
  }

  private async _onClickActorPortrait(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const uuid = $(event.currentTarget).data('uuid');
    const actor = await fromUuid(uuid) as Actor;
    if (!actor) return;

    actor.sheet?.render(true);
  }

  private async _onRemoveActor(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const uuid = $(event.currentTarget).data('uuid');
    this.selectedActors = this.selectedActors.filter(actor => actor.uuid !== uuid);
    this.render(false);
  }

  override get title(): string {
    return getGame().i18n.localize("EMOTIVEHUD.emotive-actor-selector");
  }

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "expressive-actor-select",
      template: `modules/${CONSTANTS.MODULE_ID}/templates/emotive-actor-select.hbs`,
      width: 720,
      height: 720,
    }) as ApplicationOptions;
  }

  override async getData() {
    const enrichedActors = await Promise.all(
      this.selectedActors.map(async (actorRef) => {
        const actor = await fromUuid(actorRef.uuid) as Actor;
        return {
          ...actorRef,
          name: actor?.name,
          img: actor?.img,
          portraitFolder: actorRef.portraitFolder || ""
        };
      })
    );

    console.log(CONSTANTS.DEBUG_PREFIX, "selectedActors:", enrichedActors);

    return {
      selectedActors: enrichedActors,
    };
  }

  override activateListeners(html: JQuery<HTMLElement>): void {
    super.activateListeners(html);
    
    html.find(".refresh-button")
      .on("click", this._onClickApplyButton.bind(this));
        
    html.find(".remove-actor")
      .on("click", this._onRemoveActor.bind(this));

    html.find(".select-portrait-folder")
      .on("click", this._onSelectPortraitFolder.bind(this));
      
    html.find(".actor-portrait.clickable")
      .on("click", this._onClickActorPortrait.bind(this));

    this._dragDrop.forEach(dd => dd.bind(html[0]));
  }

  private async _onClickApplyButton(event: Event): Promise<void> {
    event.preventDefault();
    
    try {
      // Update all actor configs in parallel
      const configUpdatePromises = this.selectedActors
        .map(actor => updateActorConfig(actor.uuid, actor.portraitFolder));
      
      // Wait for all updates to complete
      await Promise.all(configUpdatePromises);

      // Update HUD state with current actors and their positions
      const hudState = {
        actors: this.selectedActors.map((actor, index) => ({
          uuid: actor.uuid,
          position: index
        }))
      };
      
      // Save the new state
      await setHUDState(hudState);
      
      // Render the HUD with new changes
      getModule().emotiveHUD.render();
      
      // Emit refresh to other clients only after all updates are complete
      emitHUDRefresh();
      
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error saving changes:', error);
      ui.notifications?.error("Failed to save changes");
    }
  }
}
