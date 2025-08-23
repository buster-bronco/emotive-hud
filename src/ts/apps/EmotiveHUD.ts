import { EmotiveHUDData, PortraitUpdateData } from "../types";
import { getIsMinimized, setIsMinimized, getGridColumns, getPortraitRatio, getFloatingPortraitWidth, getHUDState, getActorLimit } from "../settings";
import { HUDState } from '../types';
import CONSTANTS from "../constants";
import { getGame, getModule, isCurrentUserGM } from "../utils";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class EmotiveHUD extends HandlebarsApplicationMixin(ApplicationV2) {
  private minimizeInProgress: boolean = false;
  private hasCustomPosition: boolean = false;

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
  }

  _insertElement(element: HTMLElement): void {
    document.body.appendChild(element);

    element.style.position = 'fixed';
    element.style.zIndex = '100';
    element.style.pointerEvents = 'auto';

    // Only set default position on first render
    this.updateWidgetPosition();
  }

  private updateWidgetPosition(): void {
    if (!this.element || this.hasCustomPosition) return; // Don't update if user has custom position

    const sidebar = document.getElementById('sidebar');
    const sidebarRect = sidebar?.getBoundingClientRect();
    const isCollapsed = !sidebarRect || sidebarRect.width < 100;

    const rightOffset = isCollapsed ? 16 : (sidebarRect?.width || 0) + 16;

    this.element.style.right = `${rightOffset}px`;
    this.element.style.top = '16px';
    this.element.style.left = 'auto'; // Ensure left is auto when using right positioning
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
    // Only update position if user hasn't dragged to custom position
    this.updateWidgetPosition();
    this.setupDragging();

    // Set up event listeners using jQuery for compatibility
    // TODO: Remove this after we convert everything else to V2
    const html = $(this.element);

    html.find('.open-selector').on('click', this._onOpenSelector.bind(this));
    html.find('.toggle-visibility').on('click', this._onToggleVisibility.bind(this));

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
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      event.preventDefault();
      event.stopPropagation();
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = event.clientX - startPos.x;
      const deltaY = event.clientY - startPos.y;

      const newLeft = elementPos.x + deltaX;
      const newTop = elementPos.y + deltaY;

      // Constrain to viewport
      const maxLeft = window.innerWidth - this.element!.offsetWidth;
      const maxTop = window.innerHeight - this.element!.offsetHeight;

      this.element!.style.left = `${Math.max(0, Math.min(maxLeft, newLeft))}px`;
      this.element!.style.top = `${Math.max(0, Math.min(maxTop, newTop))}px`;
      this.element!.style.right = 'auto'; // Override right positioning during drag

      // Mark that user has set a custom position
      this.hasCustomPosition = true;
    };

    const onMouseUp = () => {
      isDragging = false;
      dragHandle.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
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