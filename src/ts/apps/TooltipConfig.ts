import CONSTANTS from "../constants";
import { getTooltipFieldToggles, setTooltipFieldToggles } from "../settings";
import { getSystemFields, isFieldEnabled } from "../tooltips";
import { getGame } from "../utils";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class TooltipConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static override DEFAULT_OPTIONS: foundry.applications.api.ApplicationV2.DefaultOptions = {
    id: "emotive-hud-tooltip-config",
    tag: "form",
    classes: ["emotive-tooltip-config"],
    window: {
      title: "Emotive HUD Tooltip Fields",
      icon: "fas fa-comment-dots",
    },
    position: { width: 420, height: "auto" },
    form: {
      handler: TooltipConfig.onSubmit as any,
      closeOnSubmit: true,
    },
  };

  static override PARTS = {
    form: { template: `modules/${CONSTANTS.MODULE_ID}/templates/tooltip-config.hbs` },
  };

  override async _prepareContext(_options: any): Promise<any> {
    return {
      fields: getSystemFields().map(registered => ({
        key: registered.key,
        label: registered.field.label,
        enabled: isFieldEnabled(registered),
      })),
      systemTitle: getGame().system?.title ?? "this system",
    };
  }

  // formdata.object is flat and keyed by input name; checkbox names are field keys
  private static async onSubmit(_event: SubmitEvent, _form: HTMLFormElement, formData: { object: Record<string, unknown> }): Promise<void> {
    const toggles = { ...getTooltipFieldToggles() };
    for (const { key } of getSystemFields()) {
      toggles[key] = !!formData.object[key];
    }
    await setTooltipFieldToggles(toggles);
  }

  static registerMenu(): void {
    getGame().settings.registerMenu(CONSTANTS.MODULE_ID, "tooltipConfig", {
      name: "Portrait Tooltip Fields",
      label: "Configure Tooltip Fields",
      hint: "Choose which actor stats show when hovering a portrait.",
      icon: "fas fa-comment-dots",
      type: TooltipConfig as any,
      restricted: true,
    });
  }
}
