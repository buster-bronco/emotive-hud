import { EmotiveHUDData, EmotiveHudModule, PortraitUpdateData } from "../types";
import { getIsMinimized, setIsMinimized, getHUDState, HUDState } from "../settings";
import CONSTANTS from "../constants";

export default class EmotiveHUD extends Application {
  private sidebarObserver: MutationObserver | null = null;

  constructor(options = {}) {
    super(options);
    this.initializeSidebarObserver();
    
    // Listen for minimized state changes from settings
    Hooks.on(`${CONSTANTS.MODULE_ID}.minimizedStateChanged`, () => this.render());
  }

  private get module(): EmotiveHudModule {
    return (game as Game).modules.get(CONSTANTS.MODULE_ID) as EmotiveHudModule;
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
    
    return {
      isMinimized,
      isVertical: false,
      portraits: actors.map(actor => {
        const imgSrc = this.getActorPortrait(actor);
        if (!imgSrc) {
          console.warn(`${CONSTANTS.DEBUG_PREFIX} No valid portrait found for actor ${actor.id}`);
          return {
            actorId: actor.id ?? "",
            imgSrc: actor.img ?? "",  // Fallback to actor image
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
  
  // TODO:  This function needs to renormalize because Foundry UUIDs for actors are prefixed with `Actor.` 
  //        We need to look if this current implementation is ideal or if it's better to just renormalize early in the HUDState itself 
  private getActorsToShow(): Actor[] {
    const gameInstance = game as Game;
    const hudState: HUDState = getHUDState();
    console.log(CONSTANTS.DEBUG_PREFIX, "HUDState actors:", hudState.actors);
  
    // Create a Map of the HUD actors, using their UUID as the key and their position as the value
    const hudActorMap = new Map(hudState.actors.map(actor => [actor.uuid, actor.position]));
    console.log(CONSTANTS.DEBUG_PREFIX, "HUD actor map:", hudActorMap);
  
    // Normalize the UUIDs by removing the 'Actor.' prefix before fetching actors from gameInstance
    const actors : Actor[]  = Array.from(hudActorMap.keys())
      .map(uuid => uuid.replace('Actor.', ''))  // Normalize UUIDs to match gameInstance format
      .map(normalizedUUID => gameInstance.actors?.get(normalizedUUID))  // Use normalized UUIDs to fetch actors
      .filter(actor => actor) as Actor[];
  
    console.log(CONSTANTS.DEBUG_PREFIX, "Actors to show:", actors);
  
    return actors;
  }
  

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    
    console.log(CONSTANTS.DEBUG_PREFIX, "Activating HUD listeners");
    
    html.find('.open-selector').on('click', this._onOpenSelector.bind(this));
    html.find('.toggle-visibility').on('click', this._onToggleVisibility.bind(this));
    
    const portraits = html.find('.portrait');
    console.log(CONSTANTS.DEBUG_PREFIX, `Found ${portraits.length} portraits`);
    
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

    const gameInstance = game as Game;
    const actor = gameInstance.actors?.get(actorId);
    if (!actor?.isOwner) {
      console.log(CONSTANTS.DEBUG_PREFIX, "User doesn't own actor", {actorId, actor});
      return;
    }
    console.log(CONSTANTS.DEBUG_PREFIX, "Actor found and owned", {actorId, actor});

    console.log(CONSTANTS.DEBUG_PREFIX, "Opening Portrait Menu");
    this.module.emotivePortraitPicker.showForActor(actorId, portraitElement);
  }

  private _onOpenSelector(event: JQuery.ClickEvent): void {
    event.preventDefault();
    this.module.emotiveActorSelector.render(true);
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
