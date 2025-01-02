import { CONSTANTS } from "../constants";
import { getActorConfigs, setActorConfig, getHUDState, setHUDState, type ActorConfig } from "../settings";
import { cacheActorPortraits } from "../settings";

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

      console.log(CONSTANTS.MODULE_ID, " hudState: ", hudState)
      console.log(CONSTANTS.MODULE_ID, " configs: ", configs)
  }

  private async _updateSettings(): Promise<void> {
    // Update actor configs
    for (const actor of this.selectedActors) {
      await setActorConfig(actor.uuid, {
        uuid: actor.uuid,
        portraitFolder: actor.portraitFolder
      });
    }

    // Update HUD state with current actors and their positions
    const hudState = {
      actors: this.selectedActors.map((actor, index) => ({
        uuid: actor.uuid,
        position: index
      }))
    };
    await setHUDState(hudState);
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
      
      if (data.type === "Actor" && data.uuid) {
        // Check if actor is already in the list
        if (!this.selectedActors.some(actor => actor.uuid === data.uuid)) {
          console.log(CONSTANTS.DEBUG_PREFIX, "Processing Actor drop with ID:", data.uuid);
          this.selectedActors.push({
            uuid: data.uuid,
            portraitFolder: ""
          });
          this._updateSettings();
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
          // Update local state immediately
          actor.portraitFolder = path;
          this.render(false);  // First render to show folder path immediately

          // Then cache portraits in the background
          await cacheActorPortraits(uuid, path);
          
          // Render again in case caching changed anything
          this.render(false);
        } catch (error) {
          console.error(CONSTANTS.DEBUG_PREFIX, 'Error setting portrait folder:', error);
          ui.notifications?.error("Failed to set portrait folder");
        }
      },
      current: actor.portraitFolder || undefined
    });
    fp.browse("");
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
    await this._updateSettings();
    this.render(false);
  }

  override get title(): string {
    return (game as Game).i18n.localize("EMOTIVEHUD.emotive-actor-selector");
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
      .on("click", this._onClickRefreshButton.bind(this));
        
    html.find(".remove-actor")
      .on("click", this._onRemoveActor.bind(this));

    html.find(".select-portrait-folder")
      .on("click", this._onSelectPortraitFolder.bind(this));
      
    html.find(".actor-portrait.clickable")
      .on("click", this._onClickActorPortrait.bind(this));

    this._dragDrop.forEach(dd => dd.bind(html[0]));
  }

  private _onClickRefreshButton(event: Event): void {
    event.preventDefault();
    this.render(false);
  }
}
