import "../styles/style.scss";
import { CONSTANTS } from "./constants";
import { EmotiveHudModule } from "./types";
import { migrateGroupColors, migrateWindowStates, registerSettings } from "./settings";
import { DEFAULT_GROUP_ID, getHUDState, migrateHUDState } from "./state";
import HUDManager from "./hud/HUDManager";
import EmotiveActorSelector from "./apps/EmotiveActorSelector";
import EmotivePortraitPicker from "./apps/EmotiovePortraitPicker";
import { initializeSocketListeners } from "./sockets";
import { getGame } from "./utils";
import { initializeChatCommands } from "./chatCommand";
import { announceTooltipApi, registerBuiltinTooltipFields, tooltipApi } from "./tooltips";
import TooltipConfig from "./apps/TooltipConfig";

let module: EmotiveHudModule;

Hooks.once("init", () => {
  registerSettings();
  TooltipConfig.registerMenu();
  registerBuiltinTooltipFields();

  console.log(`${CONSTANTS.DEBUG_PREFIX} Initializing ${CONSTANTS.MODULE_ID}`);

  module = getGame().modules.get(CONSTANTS.MODULE_ID) as EmotiveHudModule;
  module.api = tooltipApi;
  
  // Initialize all applications
  module.emotiveActorSelector = new EmotiveActorSelector();
  module.emotivePortraitPicker = new EmotivePortraitPicker();
  module.hud = new HUDManager();

  initializeSocketListeners();
  initializeChatCommands();
});

// legacy single-window worlds become one group before the first render
Hooks.once("ready", async () => {
  await migrateHUDState();
  await migrateWindowStates(getHUDState().groups[0]?.id ?? DEFAULT_GROUP_ID);
  await migrateGroupColors();
  module.hud.start();
});

Hooks.once("setup", () => {
  announceTooltipApi();
});
