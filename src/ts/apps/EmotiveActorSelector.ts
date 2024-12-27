import { CONSTANTS } from "../constants";

export default class EmotiveActorSelector extends Application {
  override get title(): string {
    return (game as Game).i18n.localize("MYMODULE.dog-browser");
  }

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dog-browser",
      template: `modules/${CONSTANTS.MODULE_ID}/templates/expressive-actor-select.hbs`,
      width: 720,
      height: 720,
    }) as ApplicationOptions;
  }
}
