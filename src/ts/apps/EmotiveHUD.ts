import { EmotiveHUDData, PortraitUpdateData } from "../types";
import { getIsMinimized, setIsMinimized, getHUDState, getActorLimit, getGridColumns, getHudLayout, getPortraitRatio, getFloatingPortraitWidth } from "../settings";
import { HUDState } from '../types';
import CONSTANTS from "../constants";
import { getGame, getModule, isCurrentUserGM } from "../utils";

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
  private minimizeInProgress: boolean = false;
  private documentObserver: MutationObserver | null = null;
  private currentLayout: string = ''; // Track current layout to detect changes

  constructor(options = {}) {
    super(options);

    // Store initial layout
    this.currentLayout = getHudLayout();

    Hooks.on(`${CONSTANTS.MODULE_ID}.minimizedStateChanged`, () => {
      if (this.minimizeInProgress) {
        this.handleMinimizeStateChange();
      } else {
        this.render();
      }
    });

    // Handle layout changes with proper cleanup and delay
    Hooks.on(`${CONSTANTS.MODULE_ID}.layoutChanged`, () => {
      this.handleLayoutChange();
    });

    // Initialize sidebar watching when not floating
    Hooks.once('ready', () => {
      if (!this.isFloating) {
        this.initializeSidebarWatcher();
      }
    });
  }

  private async handleLayoutChange(): Promise<void> {
    const newLayout = getHudLayout();

    // Only proceed if layout actually changed
    if (this.currentLayout === newLayout) {
      return;
    }

    console.log(`${CONSTANTS.DEBUG_PREFIX} Layout changing from ${this.currentLayout} to ${newLayout}`);

    // Force cleanup of current state
    this.forceCleanup();

    // Update stored layout
    this.currentLayout = newLayout;

    // Small delay to ensure settings are propagated and DOM is clean
    await new Promise(resolve => setTimeout(resolve, 100));

    // Force re-render with new layout
    this.render(true);
  }

  private forceCleanup(): void {
    // More aggressive cleanup
    const existingContainers = document.querySelectorAll('#emotive-hud-container, #emotive-hud');
    existingContainers.forEach(container => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    });

    // Clean up observers
    this.cleanupObservers();

    // Reset element reference
    this.hudElement = null;

    // Reset any positioning flags
    this.isUpdatingPosition = false;
    this.minimizeInProgress = false;
  }

  private debouncedRender(force?: boolean): void {
    foundry.utils.debounce(() => {
      this.render(force);
    }, 100)();
  }

  private handleMinimizeStateChange(): void {
    if (!this.hudElement) {
      this.minimizeInProgress = false;
      return;
    }

    const isMinimized = getIsMinimized();
    const portraitContainer = this.hudElement.find('.portrait-container');
    const toggleIcon = this.hudElement.find('.toggle-visibility i');

    if (isMinimized) {
      portraitContainer.hide();
      toggleIcon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
      this.hudElement.find('.toggle-visibility').attr('title', 'Show Emotive HUD');
    } else {
      portraitContainer.show();
      toggleIcon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
      this.hudElement.find('.toggle-visibility').attr('title', 'Hide Emotive HUD');
    }

    this.minimizeInProgress = false;
  }

  get isFloating(): boolean {
    // Always get fresh value from settings to avoid caching issues
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

    this.lastSidebarWidth = sidebar.getBoundingClientRect().width;

    this.sidebarObserver = new MutationObserver(() => {
      if (!this.isUpdatingPosition && !this.minimizeInProgress) {
        this.checkAndUpdatePosition();
      }
    });

    this.sidebarObserver.observe(sidebar, {
      attributes: true,
      attributeFilter: ['class'],
      childList: false,
      subtree: false
    });

    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.isUpdatingPosition && !this.minimizeInProgress) {
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

    if (this.documentObserver) {
      this.documentObserver.disconnect();
      this.documentObserver = null;
    }
  }

  private checkAndUpdatePosition(): void {
    if (!this.isFloating || !this.hudElement || this.minimizeInProgress) return;

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const currentWidth = sidebar.getBoundingClientRect().width;

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

    if (isCollapsed) {
      return POSITIONING.MARGIN_COLLAPSED;
    } else {
      return window.innerWidth - sidebarRect.left + POSITIONING.MARGIN_BASE;
    }
  }

  private updateHUDPositionImmediate(): void {
    if (!this.isFloating || !this.hudElement || this.isUpdatingPosition || this.minimizeInProgress) return;

    this.isUpdatingPosition = true;

    const rightOffset = this.calculatePosition();

    this.hudElement.css({
      'right': `${rightOffset}px`,
      'top': `${POSITIONING.TOP_OFFSET}px`,
      'transition': 'none'
    });

    setTimeout(() => {
      if (this.hudElement && !this.minimizeInProgress) {
        this.hudElement.css('transition', 'right 0.2s ease-out');
      }
      this.isUpdatingPosition = false;
    }, 50);
  }

  override setPosition(): void {
    if (!this.isFloating || this.minimizeInProgress) return;

    setTimeout(() => {
      if (!this.minimizeInProgress) {
        this.updateHUDPositionImmediate();
      }
    }, 10);
  }

  override async close(options?: Application.CloseOptions): Promise<void> {
    this.cleanupObservers();
    this.hudElement = null;
    return super.close(options);
  }

  private cleanup(): void {
    // Use the more aggressive cleanup
    this.forceCleanup();
  }

  override async render(force?: boolean, options?: Application.RenderOptions): Promise<this> {
    if (this.minimizeInProgress) {
      return this;
    }

    // Store current position before cleanup if floating
    let currentPosition: { right: string; top: string } | null = null;
    if (this.hudElement && this.isFloating) {
      currentPosition = {
        right: this.hudElement.css('right'),
        top: this.hudElement.css('top')
      };
    }

    // Always cleanup before rendering
    this.cleanup();

    // Check current layout fresh from settings
    const currentLayout = getHudLayout();

    console.log(`${CONSTANTS.DEBUG_PREFIX} Rendering in ${currentLayout} mode`);

    if (currentLayout === 'floating') {
      await this.renderFloating(force, options, currentPosition);
    } else {
      await this.renderEmbedded(force, options);
    }

    return this;
  }

  private async renderFloating(_force?: boolean, _options?: Application.RenderOptions, previousPosition?: { right: string; top: string } | null): Promise<this> {
    console.log(`${CONSTANTS.DEBUG_PREFIX} Rendering floating HUD`);

    const templateData = this.getData();
    const content = await renderTemplate(this.template!, templateData);

    let element = document.getElementById(this.id);
    if (!element) {
      element = document.createElement('div');
      element.id = this.id;
      element.style.position = 'fixed';
      element.style.visibility = 'hidden';
      document.body.appendChild(element);
    }

    if (previousPosition) {
      element.style.right = previousPosition.right;
      element.style.top = previousPosition.top;
    } else {
      const rightOffset = this.calculatePosition();
      element.style.right = `${rightOffset}px`;
      element.style.top = `${POSITIONING.TOP_OFFSET}px`;
    }

    // Set class and content
    element.className = 'emotive-hud floating';
    element.innerHTML = content;

    this.hudElement = $(element);

    // Make visible after everything is positioned
    if (element.style.visibility === 'hidden') {
      requestAnimationFrame(() => {
        element.style.visibility = 'visible';
      });
    }

    this.initializeObservers();

    if (element instanceof HTMLElement) {
      this.activateListeners($(element));
    }

    return this;
  }

  private async renderEmbedded(_force?: boolean, _options?: Application.RenderOptions): Promise<this> {
    console.log(`${CONSTANTS.DEBUG_PREFIX} Rendering embedded HUD`);

    // Get sidebar and chat elements
    const sidebar = document.getElementById('sidebar');
    const chatTab = document.querySelector('#sidebar .tab[data-tab="chat"]') as HTMLElement;
    const isSidebarExpanded = sidebar && !sidebar.classList.contains('collapsed');

    // Check if chat tab is active using v13 method
    const isChatTabActive = chatTab?.classList.contains('active') ||
      document.querySelector('#sidebar .tab.active[data-tab="chat"]') !== null;

    let targetElement: Element | null = null;

    // Always try to embed in sidebar when user chooses embedded
    if (isSidebarExpanded && isChatTabActive) {
      // Sidebar is open and chat tab is active - embed in sidebar
      targetElement = document.querySelector('#sidebar .tab-content[data-tab="chat"], #sidebar #chat');
    } else {
      // If chat tab isn't active or sidebar is collapsed, 
      // force activate chat tab and expand sidebar for embedded mode
      if (sidebar && sidebar.classList.contains('collapsed')) {
        // Expand sidebar first
        sidebar.classList.remove('collapsed');
      }

      // Activate chat tab
      const chatTabButton = document.querySelector('#sidebar .tab[data-tab="chat"]') as HTMLElement;
      if (chatTabButton && !chatTabButton.classList.contains('active')) {
        chatTabButton.click(); // This should activate the chat tab
      }

      // Try again to find the target
      targetElement = document.querySelector('#sidebar .tab-content[data-tab="chat"], #sidebar #chat');
    }

    // If we still can't find the chat area, fall back to creating it
    if (!targetElement) {
      console.warn(`${CONSTANTS.DEBUG_PREFIX} Could not find chat container, falling back to sidebar`);
      targetElement = document.getElementById('sidebar') || document.body;
    }

    const templateData = this.getData();
    const content = await renderTemplate(this.template!, templateData);

    // Create new container - always use sidebar mode for embedded
    const hudContainer = document.createElement('div');
    hudContainer.id = 'emotive-hud-container';
    hudContainer.className = `emotive-hud-embedded emotive-hud-sidebar`; // Always sidebar, never notifications

    // Always insert at the top of the target element
    if (targetElement.firstChild) {
      targetElement.insertBefore(hudContainer, targetElement.firstChild);
    } else {
      targetElement.appendChild(hudContainer);
    }

    hudContainer.innerHTML = content;
    this.hudElement = $(hudContainer);

    if (hudContainer instanceof HTMLElement) {
      this.activateListeners($(hudContainer));
    }

    return this;
  }

  private initializeSidebarWatcher(): void {
    // Watch for sidebar state changes and tab changes
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const observer = new MutationObserver((mutations) => {
      let shouldRerender = false;

      mutations.forEach((mutation) => {
        // Check for sidebar collapse/expand
        if (mutation.target === sidebar && mutation.attributeName === 'class') {
          shouldRerender = true;
        }

        // Check for tab changes - look for active class changes on tab elements
        if (mutation.target instanceof HTMLElement &&
          (mutation.target.classList.contains('tab') ||
            mutation.target.classList.contains('tab-content')) &&
          mutation.attributeName === 'class') {
          shouldRerender = true;
        }
      });

      if (shouldRerender && !this.isFloating) {
        this.debouncedRender();
      }
    });

    // Observe sidebar and its children for class changes
    observer.observe(sidebar, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true, // Watch all descendants
      childList: false
    });

    // Also watch the document for tab changes that might happen outside sidebar
    const documentObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target instanceof HTMLElement &&
          mutation.target.closest('#sidebar') &&
          (mutation.target.classList.contains('active') ||
            mutation.attributeName === 'class')) {
          if (!this.isFloating) {
            this.debouncedRender();
          }
        }
      });
    });

    documentObserver.observe(document, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true
    });

    // Store observers for cleanup
    this.sidebarObserver = observer;
    // Store the document observer too
    if (!this.documentObserver) {
      this.documentObserver = documentObserver;
    }
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

    // Set flag to indicate minimize is in progress
    this.minimizeInProgress = true;

    const currentState = getIsMinimized();
    await setIsMinimized(!currentState);

    // The minimizeInProgress flag will be cleared in handleMinimizeStateChange()
  }

  private getActorPortrait(actor: Actor): string {
    return actor.getFlag(CONSTANTS.MODULE_ID, 'currentPortrait') as string || actor.img || "";
  }

  public handlePortraitUpdate(updateData: PortraitUpdateData): void {
    // just update the specific portrait
    const portrait = this.hudElement?.find(`.portrait[data-actor-id="${updateData.actorId}"]`);

    if (portrait && portrait.length) {
      // Update the image source directly
      const game = getGame();
      const actor = game.actors?.get(updateData.actorId);
      if (actor) {
        const newSrc = actor.getFlag(CONSTANTS.MODULE_ID, 'currentPortrait') as string || actor.img || "";
        const img = portrait.find('img');

        // Update image with animation
        img.attr('src', newSrc);
        portrait.addClass('flash');
        setTimeout(() => {
          portrait?.removeClass('flash');
        }, POSITIONING.PORTRAIT_FLASH_DURATION);
      }
    } else {
      // Fall back to full render if portrait not found
      this.render().then(() => {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          const newPortrait = this.hudElement?.find(`.portrait[data-actor-id="${updateData.actorId}"]`);
          if (newPortrait && newPortrait.length) {
            newPortrait.addClass('flash');
            setTimeout(() => {
              newPortrait?.removeClass('flash');
            }, POSITIONING.PORTRAIT_FLASH_DURATION);
          }
        });
      });
    }
  }
}