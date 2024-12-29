import "../styles/style.scss";
import EmotiveHUD from "./apps/EmotiveHUD";
import { CONSTANTS } from "./constants";
import { MyModule } from "./types";
import { registerSettings } from "./settings";
import EmotiveActorSelector from "./apps/EmotiveActorSelector";

let module: MyModule;

Hooks.once("init", () => {
  registerSettings();

  console.log(`Initializing ${CONSTANTS.MODULE_ID}`);

  module = (game as Game).modules.get(CONSTANTS.MODULE_ID) as MyModule;
  module.emotiveActorSelector = new EmotiveActorSelector();
  module.emotiveHUD = new EmotiveHUD();
});

// EmotiveHUD hook
Hooks.once("ready", () => {
  module.emotiveHUD.render(true);
});


Hooks.on("renderActorDirectory", (_: Application, html: JQuery) => {
  const button = $(
    `<button class="cc-sidebar-button" type="button">🐶</button>`
  );
  button.on("click", () => {
    module.emotiveActorSelector.render(true);
  });
  html.find(".directory-header .action-buttons").append(button);
});