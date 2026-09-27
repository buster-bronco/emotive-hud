import CONSTANTS from "../constants";
import { getActorPortraits } from "../settings";
import { getGame } from "../utils";
import { emitPortraitUpdated } from "../sockets";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FADE_OUT_TIME = 100;
const PADDING = 5;

export default class EmotivePortraitPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  private _actorId: string | null = null;
  private _anchor: HTMLElement | null = null;
  private _portraits: string[] = [];

  private readonly _clickOutsideHandler = (event: MouseEvent) => {
    if (!this.element?.contains(event.target as Node)) this.close();
  };

  // frameless popup placed by hand next to its portrait
  static override DEFAULT_OPTIONS: foundry.applications.api.ApplicationV2.DefaultOptions = {
    id: "emotive-portrait-picker",
    classes: ["emotive-picker-popup"],
    window: {
      frame: false,
      positioned: false,
    },
    actions: {
      selectEmotion: EmotivePortraitPicker._onSelectEmotion as any,
      resetPortrait: EmotivePortraitPicker._onResetPortrait as any,
    },
  };

  static override PARTS = {
    picker: { template: `modules/${CONSTANTS.MODULE_ID}/templates/emotion-picker.hbs` },
  };

  get actorId(): string | null {
    return this._actorId;
  }

  async showForActor(actorId: string, anchor: HTMLElement): Promise<void> {
    this._portraits = getActorPortraits(`Actor.${actorId}`);

    if (this._portraits.length === 0) {
      ui.notifications?.warn("No portraits available for this actor");
      return;
    }

    this._actorId = actorId;
    this._anchor = anchor;
    // drop a tooltip that was already up on this portrait
    getGame().tooltip?.deactivate();
    this.render({ force: true });
  }

  override async _prepareContext(_options: any): Promise<any> {
    return {
      actorId: this._actorId,
      portraits: this._portraits.map(path => ({
        path,
        name: path.split('/').pop()?.split('.')[0] || 'Unknown'
      }))
    };
  }

  override async _onFirstRender(context: any, options: any): Promise<void> {
    await super._onFirstRender(context, options);
    window.addEventListener('click', this._clickOutsideHandler);
  }

  override async _onRender(context: any, options: any): Promise<void> {
    await super._onRender(context, options);
    this.element.classList.remove('closing');
    this.placeNearAnchor();
  }

  // above the portrait when it fits, else below
  private placeNearAnchor(): void {
    if (!this._anchor) return;

    const anchor = this._anchor.getBoundingClientRect();
    const { width, height } = this.element.getBoundingClientRect();

    const left = Math.max(PADDING, Math.min(
      window.innerWidth - width - PADDING,
      anchor.left + (anchor.width / 2) - (width / 2)
    ));
    const top = anchor.top > height + PADDING
      ? anchor.top - height - PADDING
      : Math.min(anchor.bottom + PADDING, window.innerHeight - height - PADDING);

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }

  private static async _onSelectEmotion(this: EmotivePortraitPicker, event: PointerEvent, target: HTMLElement): Promise<void> {
    event.preventDefault();
    const portraitPath = target.dataset.path;
    if (!this._actorId || !portraitPath) return;

    try {
      const actor = getGame().actors?.get(this._actorId);
      if (!actor) throw new Error('Actor not found');

      await actor.setFlag(CONSTANTS.MODULE_ID, 'currentPortrait', portraitPath);
      emitPortraitUpdated(this._actorId);
      this.close();
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error updating portrait:', error);
      ui.notifications?.error("Failed to update portrait");
    }
  }

  private static async _onResetPortrait(this: EmotivePortraitPicker, event: PointerEvent): Promise<void> {
    event.preventDefault();
    if (!this._actorId) return;

    try {
      const actor = getGame().actors?.get(this._actorId);
      if (!actor) throw new Error('Actor not found');

      await actor.unsetFlag(CONSTANTS.MODULE_ID, 'currentPortrait');
      emitPortraitUpdated(this._actorId);
      this.close();
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error resetting portrait:', error);
      ui.notifications?.error("Failed to reset portrait");
    }
  }

  override _onClose(options: any): void {
    super._onClose(options);
    window.removeEventListener('click', this._clickOutsideHandler);
  }

  // css fade; frameless windows have no close transition of their own
  override async close(options: any = {}): Promise<this | void> {
    if (!this.rendered) return this;
    this._actorId = null;
    this.element.classList.add('closing');
    await new Promise(resolve => setTimeout(resolve, FADE_OUT_TIME));
    return super.close({ ...options, animate: false });
  }
}
