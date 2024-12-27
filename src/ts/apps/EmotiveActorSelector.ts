import { CONSTANTS } from "../constants";

export default class EmotiveActorSelector extends Application {
  private selectedActors: Actor[] = [];

  override get title(): string {
    return (game as Game).i18n.localize("EMOTIVEHUD.emotive-actor-selector");
  }

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "expressive-actor-select",
      template: `modules/${CONSTANTS.MODULE_ID}/templates/emotive-actor-select.hbs`,
      width: 720,
      height: 720,
    }) as ApplicationOptions;
  }

  override getData() {
    return {
      selectedActors: this.selectedActors,
    };
  }

  override activateListeners(html: JQuery<HTMLElement>): void {
    super.activateListeners(html);
    html
      .find(".refresh-button")
      .on("click", this._onClickRefreshButton.bind(this));
  }

  private _onClickRefreshButton(event: Event): void {
    event.preventDefault();
    // Implement refresh functionality here
  }
}
