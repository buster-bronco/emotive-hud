import { EmotiveHUDData } from "../types";
import { getVisibleActors } from "../settings";
import { getModule } from "../module";
import CONSTANTS from "../constants";

export default class EmotiveHUD extends Application {
  static override get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "emotive-hud",
      template: `modules/${CONSTANTS.MODULE_ID}/templates/emotive-hud.hbs`,
      popOut: false,
    }) as ApplicationOptions;
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

  override setPosition() {
    if (!this.element) return;

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const sidebarRect = sidebar.getBoundingClientRect();
    
    // Check if sidebar has the collapsed class
    const isSidebarCollapsed = sidebar.classList.contains('collapsed');
    const sidebarWidth = isSidebarCollapsed ? 32 : 320;
    
    this.element.css({
      right: (window.innerWidth - sidebarRect.left + 10) + 'px',
      bottom: '10px'
    });
  }

  override activateListeners(html: JQuery) {
    super.activateListeners(html);
    
    // Debug logging
    console.log(CONSTANTS.DEBUG_PREFIX, "Activating HUD listeners");
    
    html.find('.open-selector').on('click', this._onOpenSelector.bind(this));
    
    // Make sure we're using the correct selector and event binding
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

    // Check if user owns this actor
    const actor = await fromUuid(actorId) as Actor;
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
}
