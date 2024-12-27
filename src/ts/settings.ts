import CONSTANTS from "./constants";

export function registerSettings() {
    // Type assertion to inform TypeScript that `game` is indeed a Game object
    const gameInstance = game as Game;

    gameInstance.settings.register(CONSTANTS.MODULE_ID, "MyModuleKey", {
        name: "My Setting",
        hint: "Add your setting here",
        scope: "client",
        config: true,
        type: String,
        default: ""
    });
}