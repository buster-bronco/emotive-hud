import "../styles/style.scss";
import DogBrowser from "./apps/dogBrowser";
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
  module.dogBrowser = new DogBrowser();
  module.emotiveActorSelector = new EmotiveActorSelector();
  module.emotiveHUD = new EmotiveHUD();
});

// Dog HUD from template. for sanity checking
Hooks.on("renderActorDirectory", (_: Application, html: JQuery) => {
  const button = $(
    `<button class="cc-sidebar-button" type="button">🐶</button>`
  );
  button.on("click", () => {
    module.dogBrowser.render(true);
  });
  html.find(".directory-header .action-buttons").append(button);
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