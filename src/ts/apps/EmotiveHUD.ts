import { CONSTANTS } from "../constants";

export default class EmotiveHUD extends Application {
    static override get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: `${CONSTANTS.MODULE_ID}-hud`,
            template: `modules/${CONSTANTS.MODULE_ID}/templates/emotive-hud.hbs`,
            popOut: false,
            minimizable: true
        });
    }

    override async getData() {
        return {
            // TODO: Initial data structure
        };
    }
}