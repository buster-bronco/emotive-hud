import CONSTANTS from "../constants";

export default class EmotivePortraitPicker extends Application {
  private _actorId: string | null = null;
  private _anchor: HTMLElement | null = null;

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

  showForActor(actorId: string, anchor: HTMLElement): void {
    console.log(CONSTANTS.DEBUG_PREFIX, "Showing picker for actor:", actorId);
    this._actorId = actorId;
    this._anchor = anchor;
    this.render(true);
  }

  override async getData() {
    return {
      actorId: this._actorId,
      emotions: [
        // TODO: Replace Temp mock data for testing layout
        { path: "path1", name: "Happy" },
        { path: "path2", name: "Sad" },
        { path: "path3", name: "Angry" }
      ]
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

  private _onSelectEmotion(event: JQuery.ClickEvent): void {
    event.preventDefault();
    const emotionPath = $(event.currentTarget).data('path');
    console.log(CONSTANTS.DEBUG_PREFIX, 'Selected emotion:', emotionPath);
    this.close();
  }

  override close(): Promise<void> {
    this._actorId = null;
    this._anchor = null;
    return super.close();
  }
}
