import "../styles/style.scss";
import EmotiveHUD from "./apps/EmotiveHUD";
import { CONSTANTS } from "./constants";
import { EmotiveHudModule } from "./types";
import { registerSettings } from "./settings";
import EmotiveActorSelector from "./apps/EmotiveActorSelector";
import EmotivePortraitPicker from "./apps/EmotiovePortraitPicker";

let module: EmotiveHudModule;

Hooks.once("init", () => {
  registerSettings();

  console.log(`${CONSTANTS.DEBUG_PREFIX} Initializing ${CONSTANTS.MODULE_ID}`);

  module = (game as Game).modules.get(CONSTANTS.MODULE_ID) as EmotiveHudModule;
  
  // Initialize all applications
  module.emotiveActorSelector = new EmotiveActorSelector();
  module.emotivePortraitPicker = new EmotivePortraitPicker();
  module.emotiveHUD = new EmotiveHUD();
});

// EmotiveHUD hook
Hooks.once("ready", () => {
  module.emotiveHUD.render(true);
});
