import "../styles/style.scss";
import DogBrowser from "./apps/dogBrowser";
import EmotiveHUD from "./apps/EmotiveHUD";
import { moduleId } from "./constants";
import { MyModule } from "./types";
import { registerSettings } from "./settings";

let module: MyModule;

Hooks.once("init", () => {
  console.log(`Initializing ${moduleId}`);

  module = (game as Game).modules.get(moduleId) as MyModule;
  module.dogBrowser = new DogBrowser();
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

// When initializing the module
Hooks.once('init', () => {
  registerSettings();
});

// EmotiveHUD hook
Hooks.once("ready", () => {
  module.emotiveHUD.render(true);
});