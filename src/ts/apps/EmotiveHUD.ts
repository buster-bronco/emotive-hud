import { EmotiveHUDData, PortraitUpdateData } from "../types";
import { getIsMinimized, setIsMinimized, getHUDState, getActorLimit, getGridColumns, getHudLayout, getPortraitRatio, getFloatingPortraitWidth } from "../settings";
import { HUDState } from '../types';
import CONSTANTS from "../constants";
import { getGame, getModule, isCurrentUserGM } from "../utils";

// Streamlined positioning constants
const POSITIONING = {
  MARGIN_BASE: 16,
  MARGIN_COLLAPSED: 64,
  TOP_OFFSET: 16,
  SIDEBAR_COLLAPSED_THRESHOLD: 100,
  PORTRAIT_FLASH_DURATION: 500,
} as const;

export default class EmotiveHUD extends Application {
  private sidebarObserver: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private hudElement: JQuery | null = null;
  private lastSidebarWidth: number = 0;
  private isUpdatingPosition: boolean = false;

  constructor(options = {}) {
    super(options);
    
    Hooks.on(`${CONSTANTS.MODULE_ID}.minimizedStateChanged`, () => this.render());
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

  private initializeObservers(): void {
    this.cleanupObservers();

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Cache initial width
    this.lastSidebarWidth = sidebar.getBoundingClientRect().width;

    // Mutation observer for class changes (collapsed/expanded)
    this.sidebarObserver = new MutationObserver(() => {
      if (!this.isUpdatingPosition) {
        this.checkAndUpdatePosition();
      }
    });

    this.sidebarObserver.observe(sidebar, {
      attributes: true,
      attributeFilter: ['class'],
      childList: false,
      subtree: false
    });

    // Resize observer for actual width changes
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.isUpdatingPosition) {
          this.checkAndUpdatePosition();
        }
      });
      this.resizeObserver.observe(sidebar);
    }
  }

  private cleanupObservers(): void {
    if (this.sidebarObserver) {
      this.sidebarObserver.disconnect();
      this.sidebarObserver = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  private checkAndUpdatePosition(): void {
    if (!this.isFloating || !this.hudElement) return;

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const currentWidth = sidebar.getBoundingClientRect().width;
    
    // Only update if width actually changed
    if (Math.abs(currentWidth - this.lastSidebarWidth) > 1) {
      this.lastSidebarWidth = currentWidth;
      this.updateHUDPositionImmediate();
    }
  }

  private calculatePosition(): number {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return POSITIONING.MARGIN_BASE;

    const sidebarRect = sidebar.getBoundingClientRect();
    const isCollapsed = sidebarRect.width < POSITIONING.SIDEBAR_COLLAPSED_THRESHOLD;
    
    // Calculate position based on sidebar state
    if (isCollapsed) {
      return POSITIONING.MARGIN_COLLAPSED;
    } else {
      // When expanded, position relative to sidebar's left edge
      return window.innerWidth - sidebarRect.left + POSITIONING.MARGIN_BASE;
    }
  }

  private updateHUDPositionImmediate(): void {
    if (!this.isFloating || !this.hudElement || this.isUpdatingPosition) return;
    
    this.isUpdatingPosition = true;
    
    const rightOffset = this.calculatePosition();
    
    // Apply position immediately
    this.hudElement.css({
      'right': `${rightOffset}px`,
      'top': `${POSITIONING.TOP_OFFSET}px`,
      'transition': 'none'
    });
    
    // Re-enable smooth transitions after immediate positioning
    setTimeout(() => {
      if (this.hudElement) {
        this.hudElement.css('transition', 'right 0.2s ease-out');
      }
      this.isUpdatingPosition = false;
    }, 50);
  }

  override setPosition(): void {
    if (!this.isFloating) return;
    this.updateHUDPositionImmediate();
  }

  override async close(options?: Application.CloseOptions): Promise<void> {
    this.cleanupObservers();
    this.hudElement = null;
    return super.close(options);
  }

  private cleanup(): void {
    const existingEmbedded = document.querySelector('#emotive-hud-container');
    if (existingEmbedded) {
      existingEmbedded.remove();
    }

    const existingFloating = document.getElementById(this.id);
    if (existingFloating) {
      existingFloating.remove();
    }

    this.cleanupObservers();
    this.hudElement = null;
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
    const content = await renderTemplate(this.template!, templateData);
    
    let element = document.getElementById(this.id);
    if (!element) {
      element = document.createElement('div');
      element.id = this.id;
      document.body.appendChild(element);
    }
    
    element.className = 'emotive-hud floating';
    element.innerHTML = content;
    
    this.hudElement = $(element);
    
    // Set initial position and initialize observers
    this.setPosition();
    this.initializeObservers();
    
    if (element instanceof HTMLElement) {
      this.activateListeners($(element));
    }

    return this;
  }

  private async renderEmbedded(_force?: boolean, _options?: Application.RenderOptions): Promise<this> {
    // V13 compatible chat targeting
    const chatColumn = document.querySelector('#ui-right-column-1 #chat') || document.getElementById('chat');
    if (!chatColumn) {
      console.error(`${CONSTANTS.DEBUG_PREFIX} Could not find chat element in v13 structure`);
      return this;
    }

    const templateData = this.getData();
    const content = await renderTemplate(this.template!, templateData);

    let hudContainer = chatColumn.querySelector('#emotive-hud-container');
    if (!hudContainer) {
      hudContainer = document.createElement('div');
      hudContainer.id = 'emotive-hud-container';
      chatColumn.insertBefore(hudContainer, chatColumn.firstChild);
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
    const floatingPortraitWidth = getFloatingPortraitWidth();
    
    return {
      isGM: isCurrentUserGM(),
      isMinimized,
      columns,
      floatingPortraitWidth,
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
  
  private getActorsToShow(): Actor[] {
    const gameInstance = getGame();
    const hudState: HUDState = getHUDState();
    const actorLimit = getActorLimit();
    
    const hudActorMap = new Map(
      hudState.actors
        .slice(0, actorLimit)
        .map(actor => [actor.uuid, actor.position])
    );
    
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
    
    if (!actorId) return;

    const gameInstance = getGame();
    const actor = gameInstance.actors?.get(actorId);
    if (!actor?.isOwner) return;

    getModule().emotivePortraitPicker.showForActor(actorId, portraitElement);
  }

  private async _onPortraitDoubleClick(event: JQuery.DoubleClickEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const portraitElement = event.currentTarget as HTMLElement;
    const actorId = portraitElement.dataset.actorId;
    
    if (!actorId) return;

    const gameInstance = getGame();
    const actor = gameInstance.actors?.get(actorId);
    if (!actor?.isOwner) return;

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
    this.render();
  }

  private getActorPortrait(actor: Actor): string {
    return actor.getFlag(CONSTANTS.MODULE_ID, 'currentPortrait') as string || actor.img || "";
  }

  public handlePortraitUpdate(updateData: PortraitUpdateData): void {
    this.render();
    setTimeout(() => {
      const portrait = document.querySelector(`.portrait[data-actor-id="${updateData.actorId}"]`);
      if (portrait) {
        portrait.classList.add('flash');
        setTimeout(() => portrait.classList.remove('flash'), POSITIONING.PORTRAIT_FLASH_DURATION);
      }
    }, 0);
  }
}