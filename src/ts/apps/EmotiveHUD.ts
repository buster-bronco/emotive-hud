import { EmotiveHUDData, PortraitUpdateData } from "../types";
import { getIsMinimized, setIsMinimized, getGridColumns, getPortraitRatio, getFloatingPortraitWidth, getHUDState, getActorLimit, getSnapThreshold, getHUDPosition, setHUDPosition } from "../settings";
import { HUDState } from '../types';
import CONSTANTS from "../constants";
import { getGame, getModule, isCurrentUserGM } from "../utils";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class EmotiveHUD extends HandlebarsApplicationMixin(ApplicationV2) {
  private minimizeInProgress: boolean = false;
  private sidebarObserver: ResizeObserver | null = null;
  private hasBeenPositioned: boolean = false;

  // Constants for positioning and sidebar detection
  private static readonly POSITION_MARGIN = 16;
  private static readonly SIDEBAR_MIN_WIDTH = 100;
  private static readonly NAV_MIN_WIDTH = 50;
  private static readonly SIDEBAR_PROXIMITY_THRESHOLD = 100;
  private static readonly SIDEBAR_CHANGE_THRESHOLD = 10;
  private static readonly SIDEBAR_DEBOUNCE_DELAY = 100;

  static DEFAULT_OPTIONS = {
    id: "emotive-hud",
    classes: ['emotive-hud-widget'],
    tag: 'div',
    window: {
      frame: false,        // Remove default window frame
      resizable: false,    // Disable resizing to maintain widget feel
      positioned: true,    // Allow positioning
      minimizable: false,  // Disable default minimize
      controls: []         // Remove all default window controls
    },
    position: {
      width: 'auto',
      height: 'auto'
    }
  };

  static PARTS = {
    widget: {
      template: `modules/${CONSTANTS.MODULE_ID}/templates/emotive-hud.hbs`
    }
  };

  constructor(options = {}) {
    super(options);

    console.log(`${CONSTANTS.DEBUG_PREFIX} EmotiveHUD constructor called`);

    // Hook into setting changes for reactive updates
    Hooks.on(`${CONSTANTS.MODULE_ID}.minimizedStateChanged`, () => {
      if (this.minimizeInProgress) {
        this.handleMinimizeStateChange();
      } else {
        this.render();
      }
    });

    Hooks.on(`${CONSTANTS.MODULE_ID}.layoutChanged`, () => {
      this.render();
    });

    Hooks.on(`${CONSTANTS.MODULE_ID}.hudStateChanged`, () => {
      this.render();
    });

    Hooks.on(`${CONSTANTS.MODULE_ID}.snapSettingsChanged`, () => {
      // No need to update position immediately, snapping happens during drag
    });
  }

  _insertElement(element: HTMLElement): void {
    document.body.appendChild(element);

    element.style.position = 'fixed';
    element.style.zIndex = '100';
    element.style.pointerEvents = 'auto';

    // Prevent ApplicationV2 from doing its own positioning
    element.style.left = '';
    element.style.top = '';
    element.style.right = '';
    element.style.bottom = '';
    element.style.transform = '';
    element.style.inset = '';
  }

  private updateWidgetPosition(): void {
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    if (!this.element) return;

    // Only position the widget once, unless explicitly requested
    if (this.hasBeenPositioned) return;

    const savedPosition = getHUDPosition();
    if (savedPosition) {
      this.applyPosition(savedPosition.left, savedPosition.top);
    } else {
      this.setDefaultPosition();
    }

    this.hasBeenPositioned = true;
  }

  private setDefaultPosition(): void {
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    if (!this.element) return;

    const sidebar = document.getElementById('sidebar');
    const sidebarRect = sidebar?.getBoundingClientRect();
    const isCollapsed = !sidebarRect || sidebarRect.width < EmotiveHUD.SIDEBAR_MIN_WIDTH;
    const rightOffset = isCollapsed ? EmotiveHUD.POSITION_MARGIN : (sidebarRect?.width || 0) + EmotiveHUD.POSITION_MARGIN;

    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    const left = window.innerWidth - rightOffset - this.element.offsetWidth;
    const top = EmotiveHUD.POSITION_MARGIN;

    this.applyPosition(left, top);

    // Don't save this as user preference yet - only save when user drags
  }

  private applyPosition(left: number, top: number): void {
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    if (!this.element) return;

    // Ensure position is within viewport bounds
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    const maxLeft = window.innerWidth - this.element.offsetWidth;
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    const maxTop = window.innerHeight - this.element.offsetHeight;

    left = Math.max(0, Math.min(maxLeft, left));
    top = Math.max(0, Math.min(maxTop, top));

    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    this.element.style.left = `${left}px`;
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    this.element.style.top = `${top}px`;
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    this.element.style.right = 'auto';
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    this.element.style.bottom = 'auto';
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    this.element.style.transform = '';
  }

  // Override setPosition to prevent ApplicationV2 from repositioning our widget
  setPosition(position: any = {}): void {
    console.log('EmotiveHUD: setPosition called with:', position);

    // If we haven't been positioned yet, allow normal positioning
    if (!this.hasBeenPositioned) {
      console.log('EmotiveHUD: Not yet positioned, allowing setPosition');
      // @ts-ignore - Call parent method
      return super.setPosition(position);
    }

    // If we have been positioned, ignore ApplicationV2's repositioning attempts
    const savedPosition = getHUDPosition();
    if (savedPosition) {
      console.log('EmotiveHUD: Ignoring setPosition, using saved position:', savedPosition);
      this.applyPosition(savedPosition.left, savedPosition.top);
      return;
    }

    console.log('EmotiveHUD: No saved position, allowing setPosition');
    // @ts-ignore - Call parent method
    return super.setPosition(position);
  }

  private handleMinimizeStateChange(): void {
    if (!this.element) {
      this.minimizeInProgress = false;
      return;
    }

    const isMinimized = getIsMinimized();
    const portraitContainer = this.element.querySelector('.portrait-container') as HTMLElement;
    const toggleIcon = this.element.querySelector('.toggle-visibility i') as HTMLElement;
    const toggleButton = this.element.querySelector('.toggle-visibility') as HTMLElement;

    if (portraitContainer && toggleIcon && toggleButton) {
      if (isMinimized) {
        portraitContainer.style.display = 'none';
        toggleIcon.className = 'fas fa-chevron-up';
        toggleButton.setAttribute('title', 'Show Emotive HUD');
      } else {
        portraitContainer.style.display = '';
        toggleIcon.className = 'fas fa-chevron-down';
        toggleButton.setAttribute('title', 'Hide Emotive HUD');
      }
    }

    this.minimizeInProgress = false;
  }

  async _prepareContext(_options: any): Promise<EmotiveHUDData> {
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
        return {
          actorId: actor.id ?? "",
          imgSrc: imgSrc || actor.img || "",
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

  _onRender(_context: any, _options: any): void {
    this.setupDragging();
    this.setupSidebarObserver();

    // Set up event listeners using jQuery for compatibility
    // TODO: Remove this after we convert everything else to V2
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    const html = $(this.element);

    html.find('.open-selector').on('click', this._onOpenSelector.bind(this));
    html.find('.toggle-visibility').on('click', this._onToggleVisibility.bind(this));

    // Position after a short delay to ensure ApplicationV2 has finished its positioning logic
    setTimeout(() => {
      this.updateWidgetPosition();
    }, 10);

    const portraits = html.find('.portrait');

    portraits.on('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._onPortraitRightClick(event);
    });

    portraits.on('dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._onPortraitDoubleClick(event);
    });
  }

  private calculateEdgeSnapping(left: number, top: number, threshold: number): { left: number; top: number } {
    if (!this.element) return { left, top };

    const elementWidth = this.element.offsetWidth;
    const elementHeight = this.element.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get sidebar dimensions for more intelligent snapping
    const sidebar = document.getElementById('sidebar');
    const sidebarRect = sidebar?.getBoundingClientRect();
    const sidebarWidth = sidebarRect && sidebarRect.width > EmotiveHUD.SIDEBAR_MIN_WIDTH ? sidebarRect.width : 0;

    const navigation = document.getElementById('navigation');
    const navRect = navigation?.getBoundingClientRect();
    const navWidth = navRect && navRect.width > EmotiveHUD.NAV_MIN_WIDTH ? navRect.width : 0;

    let snappedLeft = left;
    let snappedTop = top;

    // Snap to left edge (considering navigation sidebar)
    if (left <= navWidth + threshold) {
      snappedLeft = navWidth + EmotiveHUD.POSITION_MARGIN;
    }
    // Snap to right edge (considering main sidebar)
    else if (left + elementWidth >= viewportWidth - sidebarWidth - threshold) {
      snappedLeft = viewportWidth - sidebarWidth - elementWidth - EmotiveHUD.POSITION_MARGIN;
    }
    // Snap to window left edge if no navigation
    else if (navWidth === 0 && left <= threshold) {
      snappedLeft = EmotiveHUD.POSITION_MARGIN;
    }
    // Snap to window right edge if no sidebar
    else if (sidebarWidth === 0 && left + elementWidth >= viewportWidth - threshold) {
      snappedLeft = viewportWidth - elementWidth - EmotiveHUD.POSITION_MARGIN;
    }

    // Snap to top edge
    if (top <= threshold) {
      snappedTop = EmotiveHUD.POSITION_MARGIN;
    }
    // Snap to bottom edge
    else if (top + elementHeight >= viewportHeight - threshold) {
      snappedTop = viewportHeight - elementHeight - EmotiveHUD.POSITION_MARGIN;
    }

    return { left: snappedLeft, top: snappedTop };
  }

  private showSnapIndicators(left: number, top: number): void {
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    if (!this.element) return;

    // Remove any existing indicators
    this.hideSnapIndicators();

    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    const elementWidth = this.element.offsetWidth;
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    const elementHeight = this.element.offsetHeight;

    // Create snap indicator element
    const indicator = document.createElement('div');
    indicator.className = 'snap-indicator active';
    indicator.style.left = `${left}px`;
    indicator.style.top = `${top}px`;
    indicator.style.width = `${elementWidth}px`;
    indicator.style.height = `${elementHeight}px`;

    // Add to widget container
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    this.element.appendChild(indicator);
  }

  private hideSnapIndicators(): void {
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    if (!this.element) return;

    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    const indicators = this.element.querySelectorAll('.snap-indicator');
    indicators.forEach((indicator: Element) => indicator.remove());
  }

  private setupSidebarObserver(): void {
    // Clean up existing observer
    if (this.sidebarObserver) {
      this.sidebarObserver.disconnect();
      this.sidebarObserver = null;
    }

    // Set up new observer to watch for sidebar changes
    const sidebar = document.getElementById('sidebar');
    const navigation = document.getElementById('navigation');

    if (sidebar || navigation) {
      // Store current sidebar dimensions to detect changes
      let lastSidebarWidth = sidebar?.getBoundingClientRect().width || 0;
      let lastNavWidth = navigation?.getBoundingClientRect().width || 0;

      this.sidebarObserver = new ResizeObserver(() => {
        // Debounce the repositioning to avoid too many updates
        clearTimeout((this as any).repositionTimeout);
        (this as any).repositionTimeout = setTimeout(() => {
          this.handleSidebarChange(lastSidebarWidth, lastNavWidth);

          // Update stored dimensions
          lastSidebarWidth = sidebar?.getBoundingClientRect().width || 0;
          lastNavWidth = navigation?.getBoundingClientRect().width || 0;
        }, EmotiveHUD.SIDEBAR_DEBOUNCE_DELAY);
      });

      if (sidebar) this.sidebarObserver.observe(sidebar);
      if (navigation) this.sidebarObserver.observe(navigation);
    }
  }

  private handleSidebarChange(oldSidebarWidth: number, oldNavWidth: number): void {
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    if (!this.element) return;

    const sidebar = document.getElementById('sidebar');
    const navigation = document.getElementById('navigation');
    const newSidebarWidth = sidebar?.getBoundingClientRect().width || 0;
    const newNavWidth = navigation?.getBoundingClientRect().width || 0;

    const sidebarDelta = newSidebarWidth - oldSidebarWidth;
    const navDelta = newNavWidth - oldNavWidth;

    // Only adjust if there's a significant change
    if (sidebarDelta === 0 && navDelta === 0) {
      return;
    }

    if (Math.abs(sidebarDelta) > EmotiveHUD.SIDEBAR_CHANGE_THRESHOLD || Math.abs(navDelta) > EmotiveHUD.SIDEBAR_CHANGE_THRESHOLD) {
      // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
      const rect = this.element.getBoundingClientRect();
      let newLeft = rect.left;
      let shouldReposition = false;

      // If HUD is near the right edge, adjust for sidebar changes
      const distanceFromRight = window.innerWidth - (rect.left + rect.width);
      if (distanceFromRight < newSidebarWidth + EmotiveHUD.SIDEBAR_PROXIMITY_THRESHOLD) {
        newLeft = rect.left - sidebarDelta;
        shouldReposition = true;
      }

      // If HUD is near the left edge, adjust for navigation changes  
      if (rect.left < newNavWidth + EmotiveHUD.SIDEBAR_PROXIMITY_THRESHOLD) {
        newLeft = rect.left + navDelta;
        shouldReposition = true;
      }

      // Only reposition if we determined it's necessary
      if (shouldReposition) {
        this.applyPosition(newLeft, rect.top);
        setHUDPosition({ left: newLeft, top: rect.top });
      }
    }
  }



  private setupDragging(): void {
    if (!this.element) return;

    const dragHandle = this.element.querySelector('.drag-handle') as HTMLElement;
    if (!dragHandle) return;

    let isDragging = false;
    let startPos = { x: 0, y: 0 };
    let elementPos = { x: 0, y: 0 };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;

      isDragging = true;
      startPos.x = event.clientX;
      startPos.y = event.clientY;

      const rect = this.element!.getBoundingClientRect();
      elementPos.x = rect.left;
      elementPos.y = rect.top;

      dragHandle.style.cursor = 'grabbing';
      this.element!.classList.add('dragging');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      event.preventDefault();
      event.stopPropagation();
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = event.clientX - startPos.x;
      const deltaY = event.clientY - startPos.y;

      let newLeft = elementPos.x + deltaX;
      let newTop = elementPos.y + deltaY;

      // Constrain to viewport
      const maxLeft = window.innerWidth - this.element!.offsetWidth;
      const maxTop = window.innerHeight - this.element!.offsetHeight;

      newLeft = Math.max(0, Math.min(maxLeft, newLeft));
      newTop = Math.max(0, Math.min(maxTop, newTop));

      // Check for edge snapping and show visual indicators
      const snapThreshold = getSnapThreshold();
      let willSnap = false;
      if (snapThreshold > 0) {
        const originalPosition = { left: newLeft, top: newTop };
        const snappedPosition = this.calculateEdgeSnapping(newLeft, newTop, snapThreshold);

        // Check if position will change (indicates snapping will occur)
        willSnap = originalPosition.left !== snappedPosition.left || originalPosition.top !== snappedPosition.top;

        if (willSnap) {
          this.showSnapIndicators(snappedPosition.left, snappedPosition.top);
        } else {
          this.hideSnapIndicators();
        }

        newLeft = snappedPosition.left;
        newTop = snappedPosition.top;
      } else {
        this.hideSnapIndicators();
      }

      this.element!.style.left = `${newLeft}px`;
      this.element!.style.top = `${newTop}px`;
      this.element!.style.right = 'auto'; // Override right positioning during drag
      this.element!.style.transform = ''; // Reset any transform
    };

    const onMouseUp = () => {
      isDragging = false;
      dragHandle.style.cursor = 'grab';
      // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
      this.element!.classList.remove('dragging');
      this.hideSnapIndicators();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Save the final position as user preference
      // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
      if (this.element) {
        const rect = this.element.getBoundingClientRect();
        setHUDPosition({ left: rect.left, top: rect.top });
      }
    };

    dragHandle.addEventListener('mousedown', onMouseDown);
  }

  private async _onPortraitRightClick(event: JQuery.ContextMenuEvent): Promise<void> {
    const portraitElement = event.currentTarget as HTMLElement;
    const actorId = portraitElement.dataset.actorId;

    if (!actorId) return;

    const gameInstance = getGame();
    const actor = gameInstance.actors?.get(actorId);
    if (!actor?.isOwner) return;

    getModule().emotivePortraitPicker.showForActor(actorId, portraitElement);
  }

  private async _onPortraitDoubleClick(event: JQuery.DoubleClickEvent): Promise<void> {
    const portraitElement = event.currentTarget as HTMLElement;
    const actorId = portraitElement.dataset.actorId;

    if (!actorId) return;

    const gameInstance = getGame();
    const actor = gameInstance.actors?.get(actorId);
    if (!actor?.isOwner) return;

    actor.sheet?.render(true);
  }

  private _onOpenSelector(event: JQuery.ClickEvent): void {
    if (!getGame().user?.isGM) {
      ui.notifications?.error("Only GM Can Open Selector");
      return;
    }

    event.preventDefault();
    getModule().emotiveActorSelector.render(true);
  }

  private async _onToggleVisibility(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    this.minimizeInProgress = true;
    const currentState = getIsMinimized();
    await setIsMinimized(!currentState);
  }

  private getActorPortrait(actor: Actor): string {
    return actor.getFlag(CONSTANTS.MODULE_ID, 'currentPortrait') as string || actor.img || "";
  }

  public handlePortraitUpdate(updateData: PortraitUpdateData): void {
    // Just update the specific portrait image instead of full re-render to avoid position jumping
    const portrait = this.element?.querySelector(`.portrait[data-actor-id="${updateData.actorId}"] img`) as HTMLImageElement;
    if (portrait) {
      const gameInstance = getGame();
      const actor = gameInstance.actors?.get(updateData.actorId);
      if (actor) {
        const newSrc = this.getActorPortrait(actor);
        portrait.src = newSrc;

        // Add flash effect
        const portraitContainer = portrait.closest('.portrait');
        if (portraitContainer) {
          portraitContainer.classList.add('flash');
          setTimeout(() => portraitContainer.classList.remove('flash'), 500);
        }
      }
    }
  }
}