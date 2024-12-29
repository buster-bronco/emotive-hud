import { EmotiveHUDData } from "../types";
import { getVisibleActors } from "../settings";

export default class EmotiveHUD extends Application {
  static override get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "emotive-hud",
      template: "modules/emotive-hud/templates/emotive-hud.hbs",
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
    
    // Watch for sidebar collapse/expand using DOM mutation observer
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            this.setPosition();
          }
        });
      });
      
      observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }
}
