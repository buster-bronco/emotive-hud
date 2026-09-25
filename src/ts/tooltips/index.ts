import CONSTANTS from "../constants";
import { EmotiveHudApi } from "../types";
import { registerPF2eFields } from "./systems/pf2e";
import { registerSystemFields } from "./registry";

export { buildActorTooltip, getSystemFields, isFieldEnabled } from "./registry";

export const tooltipApi: EmotiveHudApi = { registerSystemFields };

// pf2e is built in; other systems come in through the api
export const registerBuiltinTooltipFields = (): void => {
  registerPF2eFields();
};

// fired on setup so every module's init has already run
export const announceTooltipApi = (): void => {
  Hooks.callAll(`${CONSTANTS.MODULE_ID}.registerTooltipFields`, tooltipApi);
};
