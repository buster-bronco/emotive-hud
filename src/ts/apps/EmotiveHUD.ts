import { EmotiveHUDData, PortraitUpdateData } from "../types";
import { getIsMinimized, setIsMinimized, getHUDState, HUDState, getActorLimit, getGridColumns } from "../settings";
import CONSTANTS from "../constants";
import { getGame, getModule, isCurrentUserGM } from "../utils";

export default class EmotiveHUD extends Application {
  private sidebarObserver: MutationObserver | null = null;

  constructor(options = {}) {
    super(options);
    //this.initializeSidebarObserver();
    
    // Listen for settings changes
    Hooks.on(`${CONSTANTS.MODULE_ID}.minimizedStateChanged`, () => this.render());
    Hooks.on(`${CONSTANTS.MODULE_ID}.gridColumnsChanged`, () => {
      this.render();
    });
  }

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "emotive-hud",
      template: `modules/${CONSTANTS.MODULE_ID}/templates/emotive-hud.hbs`,
      popOut: false,
    }) as ApplicationOptions;
  }

  private initializeSidebarObserver(): void {
    // Create observer to watch sidebar for collapse/expand
    this.sidebarObserver = new MutationObserver(() => {
      this.setPosition();
    });
  }

  override async close(options?: Application.CloseOptions): Promise<void> {
    // Clean up observer when app closes
    if (this.sidebarObserver) {
      this.sidebarObserver.disconnect();
      this.sidebarObserver = null;
    }
    return super.close(options);
  }

  override async render(_force?: boolean, _options?: Application.RenderOptions): Promise<this> {
    // Find the chat log header
    const chatLog = document.getElementById('chat');
    if (!chatLog) {
      console.error(`${CONSTANTS.DEBUG_PREFIX} Could not find chat log element`);
      return this;
    }

    // Render the template
    const templateData = this.getData();
    const content = await renderTemplate(this.template!, templateData);

    // Create or get the container for our HUD
    let hudContainer = chatLog.querySelector('#emotive-hud-container');
    if (!hudContainer) {
      hudContainer = document.createElement('div');
      hudContainer.id = 'emotive-hud-container';
      
      // Insert at the top of the chat log
      chatLog.insertBefore(hudContainer, chatLog.firstChild);
    }

    // Update the content
    hudContainer.innerHTML = content;

    // Activate listeners
    if (hudContainer instanceof HTMLElement) {
      this.activateListeners($(hudContainer));
    }

    return this;
  }

  override getData(): EmotiveHUDData {
    const actors = this.getActorsToShow();
    const isMinimized = getIsMinimized();
    const columns = getGridColumns();
    
    return {
      isGM: isCurrentUserGM(),
      isMinimized,
      columns,
      portraits: actors.map(actor => {
        const imgSrc = this.getActorPortrait(actor);
        if (!imgSrc) {
          console.warn(`${CONSTANTS.DEBUG_PREFIX} No valid portrait found for actor ${actor.id}`);
          return {
            actorId: actor.id ?? "",
            imgSrc: actor.img ?? "",
            name: actor.name ?? "",
          };
        }
        return {
          actorId: actor.id ?? "",
          imgSrc,
          name: actor.name ?? "",
        };
      })
    };
  }
  
  // This function needs to renormalize because Foundry UUIDs for actors are prefixed with `Actor.` 
  private getActorsToShow(): Actor[] {
    const gameInstance = getGame();
    const hudState: HUDState = getHUDState();
    const actorLimit = getActorLimit();
    
    // Create a Map of the HUD actors, using their UUID as the key and their position as the value
    const hudActorMap = new Map(
      hudState.actors
        .slice(0, actorLimit) // Limit the number of actors based on settings
        .map(actor => [actor.uuid, actor.position])
    );
    
    // Normalize the UUIDs and fetch actors
    const actors = Array.from(hudActorMap.keys())
      .map(uuid => uuid.replace('Actor.', ''))
      .map(normalizedUUID => gameInstance.actors?.get(normalizedUUID))
      .filter(actor => actor) as Actor[];
  
    return actors;
  }
  

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    
    html.find('.open-selector').on('click', this._onOpenSelector.bind(this));
    html.find('.toggle-visibility').on('click', this._onToggleVisibility.bind(this));
    
    const portraits = html.find('.portrait');
    
    portraits.on('dblclick', this._onPortraitDoubleClick.bind(this));
  }

  private async _onPortraitDoubleClick(event: JQuery.DoubleClickEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const portraitElement = event.currentTarget as HTMLElement;
    const actorId = portraitElement.dataset.actorId;
    
    if (!actorId) {
      console.log(CONSTANTS.DEBUG_PREFIX, "No actor ID found");
      return;
    }

    const gameInstance = getGame();
    const actor = gameInstance.actors?.get(actorId);
    if (!actor?.isOwner) {
      console.log(CONSTANTS.DEBUG_PREFIX, "User doesn't own actor", {actorId, actor});
      return;
    }
    console.log(CONSTANTS.DEBUG_PREFIX, "Actor found and owned", {actorId, actor});

    console.log(CONSTANTS.DEBUG_PREFIX, "Opening Portrait Menu");
    getModule().emotivePortraitPicker.showForActor(actorId, portraitElement);
  }

  private _onOpenSelector(event: JQuery.ClickEvent): void {
    event.preventDefault();
    getModule().emotiveActorSelector.render(true);
  }

  private async _onToggleVisibility(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const currentState = getIsMinimized();
    await setIsMinimized(!currentState);
    this.render();  // Force a re-render after setting the new state
  }

  private getActorPortrait(actor: Actor): string {
    // Get portrait from flags, fall back to default actor image
    return actor.getFlag(CONSTANTS.MODULE_ID, 'currentPortrait') as string || actor.img || "";
  }

  public handlePortraitUpdate(_updateData: PortraitUpdateData): void {
    this.render();
  }
}
