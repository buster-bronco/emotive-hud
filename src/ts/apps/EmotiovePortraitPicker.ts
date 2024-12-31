import CONSTANTS from "../constants";
import { getActorConfigs } from "../settings";

export default class EmotivePortraitPicker extends Application {
  private _actorId: string | null = null;
  private _anchor: HTMLElement | null = null;
  private _portraits: string[] = [];

  constructor(options = {}) {
    super(options);
  }

  static override get defaultOptions(): ApplicationOptions {
    return mergeObject(super.defaultOptions, {
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
    
    // Get the actor's configured portrait folder
    const configs = getActorConfigs();
    const actorConfig = configs[`Actor.${actorId}`];
    
    if (!actorConfig?.portraitFolder) {
      ui.notifications?.warn("No portrait folder configured for this actor");
      return;
    }

    // Check if folder exists and get its contents
    try {
      const browser = await FilePicker.browse("data", actorConfig.portraitFolder);
      this._portraits = browser.files.filter(file => 
        file.toLowerCase().endsWith('.jpg') || 
        file.toLowerCase().endsWith('.jpeg') || 
        file.toLowerCase().endsWith('.png') || 
        file.toLowerCase().endsWith('.webp')
      );

      if (this._portraits.length === 0) {
        ui.notifications?.warn("No valid images found in the configured folder");
        return;
      }

      this._actorId = actorId;
      this._anchor = anchor;
      this.render(true);
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, "Error accessing portrait folder:", error);
      ui.notifications?.warn("Could not access the configured portrait folder");
      return;
    }
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
  }

  private async _onSelectEmotion(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const portraitPath = $(event.currentTarget).data('path');
    
    if (!this._actorId || !portraitPath) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Missing actor ID or portrait path');
      return;
    }

    console.log(CONSTANTS.DEBUG_PREFIX, 'Selected portrait:', portraitPath);

    // Get the actor and update their image
    const actor = (game as Game)?.actors?.get(this._actorId);
    if (!actor?.isOwner) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'No permission to update actor');
      return;
    }

    try {
      await actor.update({ img: portraitPath });
      this.close();
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error updating actor portrait:', error);
      ui.notifications?.error("Failed to update actor portrait");
    }
  }

  override close(): Promise<void> {
    this._actorId = null;
    this._anchor = null;
    this._portraits = [];
    return super.close();
  }
}
