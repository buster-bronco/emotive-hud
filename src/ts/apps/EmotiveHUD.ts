import { EmotiveHUDData, PortraitUpdateData } from "../types";
import { getIsMinimized, setIsMinimized, getHUDState, HUDState, getActorLimit, getGridColumns } from "../settings";
import CONSTANTS from "../constants";
import { getGame, getModule, isCurrentUserGM } from "../utils";

export default class EmotiveHUD extends Application {
  private sidebarObserver: MutationObserver | null = null;

  constructor(options = {}) {
    super(options);
    this.initializeSidebarObserver();
    
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

  override render(force?: boolean, options?: Application.RenderOptions): this {
    super.render(force, options);
    
    // Start observing sidebar after render
    const sidebar = document.getElementById('sidebar');
    if (sidebar && this.sidebarObserver) {
      this.sidebarObserver.observe(sidebar, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
    
    return this;
  }

  override setPosition(): void {
    if (!this.element) return;

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Calculate position based on sidebar state
    const isSidebarCollapsed = sidebar.classList.contains('collapsed');
    const offset = isSidebarCollapsed ? 42 : 330; // 32/320 + 10px margin
    
    this.element.css({
      right: `${offset}px`,
      bottom: '10px'
    });
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
    console.log(CONSTANTS.DEBUG_PREFIX, "Portrait double-clicked");

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
    console.log(`${CONSTANTS.DEBUG_PREFIX} Toggling visibility from`, currentState);
    await setIsMinimized(!currentState);
    this.render();  // Force a re-render after setting the new state
  }

  private getActorPortrait(actor: Actor): string {
    // Get portrait from flags, fall back to default actor image
    return actor.getFlag(CONSTANTS.MODULE_ID, 'currentPortrait') as string || actor.img || "";
  }

  public handlePortraitUpdate(data: PortraitUpdateData): void {
    // TODO: Add animation for the updated portrait
    this.render();
  }
}
