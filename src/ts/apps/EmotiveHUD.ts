import { EmotiveHUDData, MyModule } from "../types";
import { getVisibleActors } from "../settings";
import CONSTANTS from "../constants";

export default class EmotiveHUD extends Application {
  private sidebarObserver: MutationObserver | null = null;

  constructor(options = {}) {
    super(options);
    this.initializeSidebarObserver();
  }

  private get module(): MyModule {
    return (game as Game).modules.get(CONSTANTS.MODULE_ID) as MyModule;
  }

  static override get defaultOptions(): ApplicationOptions {
    return mergeObject(super.defaultOptions, {
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
    const actors = getVisibleActors().slice(0, 3);
    const gameInstance = game as Game;
    
    return {
      isMinimized: false,
      isVertical: false,
      portraits: actors.map(actor => ({
        actorId: actor.uuid,
        imgSrc: gameInstance.actors?.get(actor.uuid)?.img || "",
        name: gameInstance.actors?.get(actor.uuid)?.name || "",
      }))
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    
    console.log(CONSTANTS.DEBUG_PREFIX, "Activating HUD listeners");
    
    html.find('.open-selector').on('click', this._onOpenSelector.bind(this));
    
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

    const actor = await fromUuid(actorId) as Actor;
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
}
