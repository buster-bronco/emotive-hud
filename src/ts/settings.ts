import CONSTANTS from "./constants";

export function registerSettings() {
  const gameInstance = game as Game;
  
  // GM Setting: Configure which actors should appear on the HUD
  gameInstance.settings.register(CONSTANTS.MODULE_ID, "actorsOnHud", {
    name: "Actors on the HUD",
    hint: "Select which actors will appear on the Emotive HUD.",
    scope: "world", // GM-level setting
    config: true,
    type: Array,
    default: [],
    onChange: () => {
      // Action when the list of actors changes (maybe refresh HUD)
    }
  });

  // GM Setting: Configure the folder path for each actor's expressions
  gameInstance.settings.register(CONSTANTS.MODULE_ID, "actorExpressionPaths", {
    name: "Actor Expression Folders",
    hint: "Set the folder path for character expressions.",
    scope: "world", // GM-level setting
    config: true,
    type: Object,
    default: {},
    onChange: () => {
      // Any necessary action when the setting changes
    }
  });

}
