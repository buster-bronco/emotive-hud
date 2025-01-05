import CONSTANTS from "../constants";
import { getActorPortraits, getHudLayout } from "../settings";
import { getGame } from "../utils";
import { emitPortraitUpdated } from "../sockets";

const _fadeOutTime : number = 100;

export default class EmotivePortraitPicker extends Application {
  private _actorId: string | null = null;
  private _anchor: HTMLElement | null = null;
  private _portraits: string[] = [];

  private _clickOutsideHandler: ((event: MouseEvent) => void) | null = null;

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
    const padding = 5; // Space between picker and anchor
    
    // get initial position
    let top: number;
    let left = Math.max(padding, Math.min(
      window.innerWidth - pickerWidth - padding,
      position.left + (position.width / 2) - (pickerWidth / 2)
    ));
    
    const isEmbedded = getHudLayout() === 'embedded';
    
    if (isEmbedded) {
      // For embedded mode, try to position above first
      if (position.top > pickerHeight + padding) {
        // Enough space above
        top = position.top - pickerHeight - padding;
        this.element.css({ top: `${top}px`, left: `${left}px` });
      } else {
        // Position below if not enough space above
        top = position.bottom + padding;
        if (top + pickerHeight > window.innerHeight) {
          top = window.innerHeight - pickerHeight - padding;
        }
        this.element.css({ top: `${top}px`, left: `${left}px` });
      }
    } else {
      // For floating mode, always try above first
      if (position.top > pickerHeight + padding) {
        // Enough space above
        top = position.top - pickerHeight - padding;
        this.element.css({ top: `${top}px`, left: `${left}px` });
      } else {
        // Position below if not enough space above
        top = position.bottom + padding;
        if (top + pickerHeight > window.innerHeight) {
          top = window.innerHeight - pickerHeight - padding;
        }
        this.element.css({ top: `${top}px`, left: `${left}px` });
      }
    }
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
      const game = getGame();
      const actor = game.actors?.get(this._actorId);
      if (!actor) {
          throw new Error('Actor not found');
      }

      // Update the portrait using flags
      await actor.setFlag(CONSTANTS.MODULE_ID, 'currentPortrait', portraitPath);
      
      // Emit socket event
      emitPortraitUpdated(this._actorId);
      
      // Close the picker
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
      const game = getGame();
      const actor = game.actors?.get(this._actorId);
      if (!actor) {
          throw new Error('Actor not found');
      }

      // Clear the portrait flag
      await actor.unsetFlag(CONSTANTS.MODULE_ID, 'currentPortrait');
      
      // Emit socket event
      emitPortraitUpdated(this._actorId);
      
      this.close();
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error resetting portrait:', error);
      ui.notifications?.error("Failed to reset portrait");
    }
  }

  override async render(force?: boolean, options?: Application.RenderOptions): Promise<this> {
    await super.render(force, options);

    // Remove any existing handler first
    this._removeClickOutsideHandler();

    // Add new click outside handler
    this._clickOutsideHandler = (event: MouseEvent) => {
      const elementDom = this.element?.get(0);
      if (!elementDom) return;
      const target = event.target as HTMLElement;
      if (!elementDom.contains(target)) {
        this.close();
      }
    };
    window.addEventListener('click', this._clickOutsideHandler);

    return this;
  }

  private _removeClickOutsideHandler(): void {
    if (this._clickOutsideHandler) {
      window.removeEventListener('click', this._clickOutsideHandler);
      this._clickOutsideHandler = null;
    }
  }

  override async close(options?: Application.CloseOptions): Promise<void> {
    if (this.element) {
      this.element.fadeOut(_fadeOutTime);
      await new Promise(resolve => setTimeout(resolve, _fadeOutTime));
    }
    return super.close(options);
  }
}
