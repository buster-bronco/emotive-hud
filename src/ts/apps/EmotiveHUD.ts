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
    // Get visible actors from settings
    const actors = getVisibleActors().slice(0, 3); // Limit to 3 portraits for now

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
    
    const chatLeft = document.querySelector("#chat")?.getBoundingClientRect().left || window.innerWidth;
    const hudWidth = this.element.outerWidth() || 0;
    
    this.element.css({
      right: window.innerWidth - chatLeft + "px",
      bottom: "10px",
    });
  }
}
