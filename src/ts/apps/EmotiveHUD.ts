import { moduleId } from "../constants";

export default class EmotiveHUD extends Application {
    static override get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: `${moduleId}-hud`,
            template: `modules/${moduleId}/templates/emotive-hud.hbs`,
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