import CONSTANTS from "../constants";
import { getActorPortraits } from "../settings";
import { EmotiveHudModule } from "../types";

export default class EmotivePortraitPicker extends Application {
  private _actorId: string | null = null;
  private _anchor: HTMLElement | null = null;
  private _portraits: string[] = [];

  constructor(options = {}) {
    super(options);
  }

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "emotive-portrait-picker",
      template: `modules/${CONSTANTS.MODULE_ID}/templates/emotion-picker.hbs`,
      classes: ["emotive-picker-popup"],
      popOut: true,
      minimizable: false,
      resizable: false,
      width: "auto",
      height: "auto"
    }) as ApplicationOptions;
  }

  async showForActor(actorId: string, anchor: HTMLElement): Promise<void> {
    console.log(CONSTANTS.DEBUG_PREFIX, "Showing picker for actor:", actorId);
    
    const actorUuid = `Actor.${actorId}`;
    
    // Get cached portraits
    this._portraits = getActorPortraits(actorUuid);
    
    if (this._portraits.length === 0) {
      ui.notifications?.warn("No portraits available for this actor");
      return;
    }

    this._actorId = actorId;
    this._anchor = anchor;
    this.render(true);
  }

  override async getData() {
    return {
      actorId: this._actorId,
      portraits: this._portraits.map(path => ({
        path,
        name: path.split('/').pop()?.split('.')[0] || 'Unknown'
      }))
    };
  }

  override setPosition(): void {
    if (!this.element || !this._anchor) return;

    const position = this._anchor.getBoundingClientRect();
    const pickerHeight = this.element.height() || 0;
    const pickerWidth = this.element.width() || 0;

    // Position above the portrait, centered
    const top = position.top - pickerHeight - 5;
    const left = position.left + (position.width / 2) - (pickerWidth / 2);

    this.element.css({
      top: `${top}px`,
      left: `${left}px`
    });
  }

  override activateListeners(html: JQuery<HTMLElement>): void {
    super.activateListeners(html);
    html.find('.emotion-item').on('click', this._onSelectEmotion.bind(this));
    html.find('.reset-portrait').on('click', this._onResetPortrait.bind(this));
  }

  private async _onSelectEmotion(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const portraitPath = $(event.currentTarget).data('path');
    
    if (!this._actorId || !portraitPath) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Missing actor ID or portrait path');
      return;
    }

    console.log(CONSTANTS.DEBUG_PREFIX, 'Selected portrait:', portraitPath);

    try {
      // Get the actor
      const gameInstance = game as Game;
      const actor = gameInstance.actors?.get(this._actorId);
      if (!actor) {
          throw new Error('Actor not found');
      }

      // Update the portrait using flags
      await actor.setFlag(CONSTANTS.MODULE_ID, 'currentPortrait', portraitPath);
      
      // Trigger a re-render of the HUD
      const module = gameInstance.modules.get(CONSTANTS.MODULE_ID) as EmotiveHudModule;
      module.emotiveHUD.render();
      
      this.close();
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error updating portrait:', error);
      ui.notifications?.error("Failed to update portrait");
    }
  }

  private async _onResetPortrait(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    
    if (!this._actorId) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Missing actor ID');
      return;
    }

    try {
      // Get the actor
      const gameInstance = game as Game;
      const actor = gameInstance.actors?.get(this._actorId);
      if (!actor) {
          throw new Error('Actor not found');
      }

      // Clear the portrait flag
      await actor.unsetFlag(CONSTANTS.MODULE_ID, 'currentPortrait');
      
      // Trigger a re-render of the HUD
      const module = gameInstance.modules.get(CONSTANTS.MODULE_ID) as EmotiveHudModule;
      module.emotiveHUD.render();
      
      this.close();
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error resetting portrait:', error);
      ui.notifications?.error("Failed to reset portrait");
    }
  }
}
