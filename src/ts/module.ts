import "../styles/style.scss";
import EmotiveHUD from "./apps/EmotiveHUD";
import { CONSTANTS } from "./constants";
import { MyModule } from "./types";
import { registerSettings } from "./settings";
import EmotiveActorSelector from "./apps/EmotiveActorSelector";
import EmotivePortraitPicker from "./apps/EmotiovePortraitPicker";

let module: MyModule;

Hooks.once("init", () => {
  registerSettings();

  console.log(`${CONSTANTS.DEBUG_PREFIX} Initializing ${CONSTANTS.MODULE_ID}`);

  module = (game as Game).modules.get(CONSTANTS.MODULE_ID) as MyModule;
  
  // Initialize all applications
  module.emotiveActorSelector = new EmotiveActorSelector();
  module.emotivePortraitPicker = new EmotivePortraitPicker();
  module.emotiveHUD = new EmotiveHUD();
});

// EmotiveHUD hook
Hooks.once("ready", () => {
  module.emotiveHUD.render(true);
});

export function getModule(): MyModule {
  if (!module) {
    throw new Error('Module not initialized');
  }
  return module;
}