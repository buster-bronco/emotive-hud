import { EmotiveHUDData, PortraitUpdateData } from "../types";
import { getIsMinimized, setIsMinimized, getHUDState, getActorLimit, getGridColumns, getHudLayout, getPortraitRatio } from "../settings";
import { HUDState } from '../types';
import CONSTANTS from "../constants";
import { getGame, getModule, isCurrentUserGM } from "../utils";

const _portraitUpdateFlashTime : number = 500;

export default class EmotiveHUD extends Application {
  private sidebarObserver: MutationObserver | null = null;  

  constructor(options = {}) {
    super(options);
    
    // Listen for settings changes
    Hooks.on(`${CONSTANTS.MODULE_ID}.minimizedStateChanged`, () => this.render());
    Hooks.on(`${CONSTANTS.MODULE_ID}.gridColumnsChanged`, () => this.debouncedRender(true));
    Hooks.on(`${CONSTANTS.MODULE_ID}.layoutChanged`, () => this.debouncedRender(true));
    
  }

  private debouncedRender(force?: boolean): void {
    foundry.utils.debounce(() => {
      this.render(force);
    }, 100)();
  }

  get isFloating(): boolean {
    return getHudLayout() === 'floating';
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

    const sidebar = document.getElementById('sidebar');
    if (sidebar && this.sidebarObserver) {
      this.sidebarObserver.observe(sidebar, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }


  override setPosition(): void {
    if (!this.isFloating || !this.element) return;

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Calculate position based on sidebar state
    const isSidebarCollapsed = sidebar.classList.contains('collapsed');
    const offset = isSidebarCollapsed ? 10 : 330;
    
    this.element.css({
      right: `${offset}px`,
      bottom: '10px'
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

  private cleanup(): void {
    // Clean up any existing elements
    const existingEmbedded = document.querySelector('#emotive-hud-container');
    if (existingEmbedded) {
      existingEmbedded.remove();
    }

    const existingFloating = document.getElementById(this.id);
    if (existingFloating) {
      existingFloating.remove();
    }

    // Clean up sidebar observer if it exists
    if (this.sidebarObserver) {
      this.sidebarObserver.disconnect();
      this.sidebarObserver = null;
    }
  }

  override async render(force?: boolean, options?: Application.RenderOptions): Promise<this> {
    this.cleanup();

    if (this.isFloating) {
      return this.renderFloating(force, options);
    } else {
      return this.renderEmbedded(force, options);
    }
  }

  private async renderFloating(_force?: boolean, _options?: Application.RenderOptions): Promise<this> {
    const templateData = this.getData();
    console.log("YUGI", templateData)
    const content = await renderTemplate(this.template!, templateData);
    
    // Create or get the floating container
    let element = document.getElementById(this.id);
    if (!element) {
      element = document.createElement('div');
      element.id = this.id;
      document.body.appendChild(element);
    }
    
    // Set classes after ensuring element exists
    element.className = 'emotive-hud floating';
    element.innerHTML = content;
    
    // Start observing sidebar if needed
    if (!this.sidebarObserver) {
      this.initializeSidebarObserver();
    }
    
    this.setPosition();
    
    if (element instanceof HTMLElement) {
      this.activateListeners($(element));
    }

    return this;
  }

  private async renderEmbedded(_force?: boolean, _options?: Application.RenderOptions): Promise<this> {
    // Find the chat log
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
      chatLog.insertBefore(hudContainer, chatLog.firstChild);
    }

    hudContainer.innerHTML = content;

    if (hudContainer instanceof HTMLElement) {
      this.activateListeners($(hudContainer));
    }

    return this;
  }

  override getData(): EmotiveHUDData {
    const actors = this.getActorsToShow();
    const isMinimized = getIsMinimized();
    const columns = getGridColumns();
    const emotivePortraitRatio = getPortraitRatio();
    
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
            emotivePortraitRatio,

          };
        }
        return {
          actorId: actor.id ?? "",
          imgSrc,
          name: actor.name ?? "",
          emotivePortraitRatio,
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
    
    portraits.on('contextmenu', this._onPortraitRightClick.bind(this));
    portraits.on('dblclick', this._onPortraitDoubleClick.bind(this));
  }

  private async _onPortraitRightClick(event: JQuery.ContextMenuEvent): Promise<void> {
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

    console.log(CONSTANTS.DEBUG_PREFIX, "Opening Sheet");
    actor.sheet?.render(true);
  }

  private _onOpenSelector(event: JQuery.ClickEvent): void {
    if (!getGame().user?.isGM) throw "Only GM Can Open Selector";

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

  public handlePortraitUpdate(updateData: PortraitUpdateData): void {
    this.render();
    // Add flash effect after render
    setTimeout(() => {
      const portrait = document.querySelector(`.portrait[data-actor-id="${updateData.actorId}"]`);
      if (portrait) {
        portrait.classList.add('flash');
        setTimeout(() => portrait.classList.remove('flash'), _portraitUpdateFlashTime);
      }
    }, 0);
  }
}
