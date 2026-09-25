import { EmotiveHUDData, PortraitUpdateData } from "../types";
import { getIsMinimized, setIsMinimized, getGridColumns, getPortraitRatio, getFloatingPortraitWidth, getHUDState, getActorLimit, getSnapThreshold, getHUDPosition, setHUDPosition, setHUDLayout, getClickToFocus, getTooltipsEnabled } from "../settings";
import { HUDState, DockSide, VerticalAnchor } from '../types';
import CONSTANTS from "../constants";
import { getGame, getModule, isCurrentUserGM } from "../utils";
import { buildActorTooltip } from "../tooltips";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class EmotiveHUD extends HandlebarsApplicationMixin(ApplicationV2) {
  private minimizeInProgress: boolean = false;
  private sidebarObserver: ResizeObserver | null = null;
  private hasBeenPositioned: boolean = false;
  private isAnimating: boolean = false;
  private dock: { side: DockSide; anchor: VerticalAnchor } = { side: null, anchor: 'top' };

  // Constants for positioning and sidebar detection
  private static readonly POSITION_MARGIN = 16;
  private static readonly SIDEBAR_MIN_WIDTH = 100;
  private static readonly NAV_MIN_WIDTH = 50;
  private static readonly SIDEBAR_PROXIMITY_THRESHOLD = 100;
  private static readonly SIDEBAR_CHANGE_THRESHOLD = 10;
  private static readonly SIDEBAR_DEBOUNCE_DELAY = 100;
  private static readonly DOCK_EPSILON = 4;
  private static readonly COLLAPSE_OFFSET = 16;
  private static readonly COLLAPSE_DURATION = 200;

  // must match .portrait-container padding/border/gap in emotive-hud.scss
  private static readonly CONTAINER_CHROME = 2 * 16 + 2 * 1;
  private static readonly PORTRAIT_GAP = 8;
  private static readonly TOOLTIP_DELAY = 300;

  static override DEFAULT_OPTIONS: foundry.applications.api.ApplicationV2.DefaultOptions = {
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

  static override PARTS = {
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

  override _insertElement(element: HTMLElement): void {
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
  override setPosition(position: any = {}): void {
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

  private async handleMinimizeStateChange(): Promise<void> {
    const hud = this.element?.querySelector('.emotive-hud') as HTMLElement | null;
    const portraitContainer = this.element?.querySelector('.portrait-container') as HTMLElement | null;
    if (!this.element || !hud || !portraitContainer) {
      this.minimizeInProgress = false;
      return;
    }

    const isMinimized = getIsMinimized();
    const before = this.getToggleRect();
    const hidden = { opacity: 0, transform: this.getCollapseTransform() };
    const shown = { opacity: 1, transform: 'none' };

    this.isAnimating = true;
    try {
      if (isMinimized) {
        await portraitContainer.animate([shown, hidden], {
          duration: EmotiveHUD.COLLAPSE_DURATION,
          easing: 'ease-in',
        }).finished;
        hud.classList.add('minimized');
        this.pinToggle(before);
      } else {
        hud.classList.remove('minimized');
        this.pinToggle(before);
        await portraitContainer.animate([hidden, shown], {
          duration: EmotiveHUD.COLLAPSE_DURATION,
          easing: 'ease-out',
        }).finished;
      }
      // dock is kept as-is so the toggle doesn't hop mid-interaction
      this.applyDockState(false);
    } finally {
      this.isAnimating = false;
      this.minimizeInProgress = false;
    }
  }

  // sidebar and nav widths eat into the usable viewport edges
  private getEdgeInsets(): { sidebarWidth: number; navWidth: number } {
    const sidebarRect = document.getElementById('sidebar')?.getBoundingClientRect();
    const navRect = document.getElementById('navigation')?.getBoundingClientRect();
    return {
      sidebarWidth: sidebarRect && sidebarRect.width > EmotiveHUD.SIDEBAR_MIN_WIDTH ? sidebarRect.width : 0,
      navWidth: navRect && navRect.width > EmotiveHUD.NAV_MIN_WIDTH ? navRect.width : 0,
    };
  }

  // horizontal edges win over vertical ones in corners
  private getDockSide(): DockSide {
    if (!this.element) return null;

    const rect = this.element.getBoundingClientRect();
    const { sidebarWidth, navWidth } = this.getEdgeInsets();
    const reach = EmotiveHUD.POSITION_MARGIN + EmotiveHUD.DOCK_EPSILON;

    if (rect.right >= window.innerWidth - sidebarWidth - reach) return 'right';
    if (rect.left <= navWidth + reach) return 'left';
    if (rect.top <= reach) return 'top';
    if (rect.bottom >= window.innerHeight - reach) return 'bottom';
    return null;
  }

  // floating huds in the lower half open upward like a drop-up
  private getVerticalAnchor(side: DockSide): VerticalAnchor {
    if (side === 'top' || side === 'bottom') return side;
    const toggle = this.getToggleRect();
    if (!toggle) return 'top';

    return toggle.top + toggle.height / 2 > window.innerHeight / 2 ? 'bottom' : 'top';
  }

  // chevron direction while expanded; flipped when minimized
  private getToggleDirection(): 'left' | 'right' | 'up' | 'down' {
    const { side, anchor } = this.dock;
    if (side === 'left' || side === 'right') return side;
    if (side === 'top') return 'up';
    if (side === 'bottom') return 'down';
    return anchor === 'top' ? 'down' : 'up';
  }

  // docked grids slide into their edge; floating ones fold toward the toggle
  private getCollapseTransform(): string {
    const offset = EmotiveHUD.COLLAPSE_OFFSET;
    const { side, anchor } = this.dock;
    if (side === 'left') return `translateX(-${offset}px)`;
    if (side === 'right') return `translateX(${offset}px)`;
    return anchor === 'top' ? `translateY(-${offset}px)` : `translateY(${offset}px)`;
  }

  // data-dock / data-anchor drive the controls placement in css
  private applyDockState(recompute: boolean = true): void {
    const hud = this.element?.querySelector('.emotive-hud') as HTMLElement | null;
    const toggleIcon = this.element?.querySelector('.toggle-visibility i') as HTMLElement | null;
    const toggleButton = this.element?.querySelector('.toggle-visibility') as HTMLElement | null;
    if (!hud || !toggleIcon || !toggleButton) return;

    if (recompute) {
      const side = this.getDockSide();
      this.dock = { side, anchor: this.getVerticalAnchor(side) };
    }

    const isMinimized = getIsMinimized();
    const opposite = { left: 'right', right: 'left', up: 'down', down: 'up' } as const;
    const direction = this.getToggleDirection();

    hud.dataset.dock = this.dock.side ?? 'none';
    hud.dataset.anchor = this.dock.anchor;
    toggleIcon.className = `fas fa-chevron-${isMinimized ? opposite[direction] : direction}`;
    toggleButton.setAttribute('title', `${isMinimized ? 'Show' : 'Hide'} Emotive HUD`);
  }

  private getToggleRect(): DOMRect | null {
    return this.element?.querySelector('.toggle-visibility')?.getBoundingClientRect() ?? null;
  }

  // shift the hud so the toggle ends up back under the cursor
  private pinToggle(before: DOMRect | null): void {
    const after = this.getToggleRect();
    if (!this.element || !before || !after) return;

    const rect = this.element.getBoundingClientRect();
    const left = rect.left + before.left - after.left;
    const top = rect.top + before.top - after.top;

    this.applyPosition(left, top);
    setHUDPosition({ left, top });
  }

  override async _prepareContext(_options: any): Promise<EmotiveHUDData> {
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

  override async _onRender(_context: any, _options: any): Promise<void> {
    this.setupDragging();
    this.setupResizing();
    this.setupSidebarObserver();
    this.applyDockState();

    // Set up event listeners using jQuery for compatibility
    // TODO: Remove this after we convert everything else to V2
    // @ts-ignore - TypeScript types for ApplicationV2 are inconsistent
    const html = $(this.element);

    html.find('.open-selector').on('click', this._onOpenSelector.bind(this));
    html.find('.toggle-visibility').on('click', this._onToggleVisibility.bind(this));

    // Position after a short delay to ensure ApplicationV2 has finished its positioning logic
    setTimeout(() => {
      this.updateWidgetPosition();
      this.applyDockState();
    }, 10);

    const portraits = html.find('.portrait');

    portraits.on('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._onPortraitClick(event);
    });

    portraits.on('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._onPortraitRightClick(event);
    });

    portraits.on('dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._onOpenPortraitSheet(event);
    });

    // button 1 is middle click; mousedown default starts autoscroll
    portraits.on('mousedown', (event) => {
      if (event.button === 1) event.preventDefault();
    });

    portraits.on('auxclick', (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
      this._onOpenPortraitSheet(event);
    });

    portraits.each((_, portrait) => this.setupPortraitTooltip(portrait));
  }

  // core tooltip manager handles leave/dismiss once activated on the portrait
  private setupPortraitTooltip(portrait: HTMLElement): void {
    let timer: number | undefined;

    portrait.addEventListener('pointerenter', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => this.showPortraitTooltip(portrait), EmotiveHUD.TOOLTIP_DELAY);
    });

    portrait.addEventListener('pointerleave', () => window.clearTimeout(timer));
    portrait.addEventListener('pointerdown', () => window.clearTimeout(timer));
  }

  private async showPortraitTooltip(portrait: HTMLElement): Promise<void> {
    if (!getTooltipsEnabled() || !portrait.matches(':hover')) return;
    if (this.element?.classList.contains('dragging') || this.element?.classList.contains('resizing')) return;
    if (getModule().emotivePortraitPicker.rendered) return;

    const actor = getGame().actors?.get(portrait.dataset.actorId ?? '');
    if (!actor) return;

    const html = await buildActorTooltip(actor);
    // hover may have ended while the template rendered
    if (!html || !portrait.matches(':hover')) return;

    const tooltip = getGame().tooltip;
    if (!tooltip) return;
    tooltip.activate(portrait, {
      html,
      cssClass: `emotive-tooltip ${getGame().system?.id ?? ''}`,
      direction: this.getTooltipDirection(),
    });
  }

  // open away from the docked edge
  private getTooltipDirection(): foundry.helpers.interaction.TooltipManager.TOOLTIP_DIRECTIONS | undefined {
    const directions = foundry.helpers.interaction.TooltipManager.TOOLTIP_DIRECTIONS;
    switch (this.dock.side) {
      case 'right': return directions.LEFT;
      case 'left': return directions.RIGHT;
      case 'top': return directions.DOWN;
      case 'bottom': return directions.UP;
      default: return undefined;
    }
  }

  private calculateEdgeSnapping(left: number, top: number, threshold: number): { left: number; top: number } {
    if (!this.element) return { left, top };

    const elementWidth = this.element.offsetWidth;
    const elementHeight = this.element.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get sidebar dimensions for more intelligent snapping
    const { sidebarWidth, navWidth } = this.getEdgeInsets();

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
        this.applyDockState();
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
        this.applyDockState();
      }
    };

    dragHandle.addEventListener('mousedown', onMouseDown);
  }

  // fit-to-box: pick the column count giving the largest portraits inside the box
  private fitLayout(boxW: number, boxH: number, count: number, aspect: number): { columns: number; width: number } {
    const chrome = EmotiveHUD.CONTAINER_CHROME;
    const gap = EmotiveHUD.PORTRAIT_GAP;

    let best = { columns: 1, width: -Infinity };
    for (let c = 1; c <= count; c++) {
      const rows = Math.ceil(count / c);
      const wByW = (boxW - chrome - gap * (c - 1)) / c;
      // aspect is width/height, so height budget converts back to width
      const wByH = (boxH - chrome - gap * (rows - 1)) / rows * aspect;
      const w = Math.min(wByW, wByH);
      if (w > best.width) best = { columns: c, width: w };
    }

    const width = Math.floor(Math.max(CONSTANTS.MIN_PORTRAIT_WIDTH, Math.min(CONSTANTS.MAX_PORTRAIT_WIDTH, best.width)));
    return { columns: best.columns, width };
  }

  private setupResizing(): void {
    if (!this.element) return;

    const container = this.element.querySelector('.portrait-container') as HTMLElement;
    const handles = this.element.querySelectorAll<HTMLElement>('.resize-handle');
    if (!container || handles.length === 0) return;

    const count = container.querySelectorAll('.portrait').length;
    if (count === 0) return;

    let corner = '';
    let startPos = { x: 0, y: 0 };
    let startBox = { width: 0, height: 0 };
    let anchor = { right: 0, bottom: 0 };
    let layout = { columns: getGridColumns(), width: getFloatingPortraitWidth() };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;

      corner = (event.currentTarget as HTMLElement).dataset.corner ?? 'se';
      startPos = { x: event.clientX, y: event.clientY };

      const boxRect = container.getBoundingClientRect();
      startBox = { width: boxRect.width, height: boxRect.height };

      const elementRect = this.element!.getBoundingClientRect();
      anchor = { right: elementRect.right, bottom: elementRect.bottom };

      this.element!.classList.add('resizing');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      event.preventDefault();
      event.stopPropagation();
    };

    const onMouseMove = (event: MouseEvent) => {
      const dx = event.clientX - startPos.x;
      const dy = event.clientY - startPos.y;

      const boxW = corner.includes('e') ? startBox.width + dx : startBox.width - dx;
      const boxH = corner.includes('s') ? startBox.height + dy : startBox.height - dy;

      layout = this.fitLayout(boxW, boxH, count, getPortraitRatio());

      // css vars update the grid live without a re-render
      container.style.setProperty('--grid-columns', `${layout.columns}`);
      container.style.setProperty('--floatingPortraitWidth', `${layout.width}px`);

      // keep the opposite corner pinned
      const rect = this.element!.getBoundingClientRect();
      const left = corner.includes('w') ? anchor.right - this.element!.offsetWidth : rect.left;
      const top = corner.includes('n') ? anchor.bottom - this.element!.offsetHeight : rect.top;
      this.applyPosition(left, top);
    };

    const onMouseUp = async () => {
      this.element?.classList.remove('resizing');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (!this.element) return;
      const rect = this.element.getBoundingClientRect();
      this.applyDockState();
      await setHUDPosition({ left: rect.left, top: rect.top });
      await setHUDLayout(layout.columns, layout.width);
    };

    handles.forEach(handle => handle.addEventListener('mousedown', onMouseDown));
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

  private _onPortraitClick(event: JQuery.ClickEvent): void {
    if (!getClickToFocus()) return;

    const actorId = (event.currentTarget as HTMLElement).dataset.actorId;
    if (!actorId) return;

    const actor = getGame().actors?.get(actorId);
    if (!actor || !canvas?.ready) return;

    // getactivetokens() returns this actor's placeables on the viewed scene
    const tokens = actor.getActiveTokens() as Token[];
    const token = tokens.find(t => t.isOwner && t.isVisible) ?? tokens.find(t => t.isVisible);
    if (!token) return;

    // control() selects without targeting; fails silently for unowned tokens
    token.control({ releaseOthers: true });
    canvas.animatePan({ x: token.center.x, y: token.center.y });
  }

  private async _onOpenPortraitSheet(event: JQuery.TriggeredEvent): Promise<void> {
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
    if (this.isAnimating || this.minimizeInProgress) return;
    this.minimizeInProgress = true;
    const currentState = getIsMinimized();
    await setIsMinimized(!currentState);
  }

  private getActorPortrait(actor: Actor): string {
    return actor.getFlag(CONSTANTS.MODULE_ID, 'currentPortrait') as string || actor.img || "";
  }

  public handlePortraitUpdate(updateData: PortraitUpdateData): void {
    // Just update the specific portrait image instead of full re-render to avoid position jumping
    // @ts-ignore - ApplicationV2 element access
    const portrait = this.element?.querySelector<HTMLImageElement>(`.portrait[data-actor-id="${updateData.actorId}"] img`);
    if (!portrait) return;

    const gameInstance = getGame();
    const actor = gameInstance.actors?.get(updateData.actorId);
    if (!actor) return;

    const newSrc = this.getActorPortrait(actor);
    portrait.src = newSrc;

    // Add flash effect
    const portraitContainer = portrait.closest<HTMLElement>('.portrait');
    if (portraitContainer) {
      // reading offsetWidth forces a reflow so the css animation restarts
      portraitContainer.classList.remove('flash');
      void portraitContainer.offsetWidth;
      portraitContainer.classList.add('flash');
      portraitContainer.addEventListener('animationend', () => portraitContainer.classList.remove('flash'), { once: true });
    }
  }
}