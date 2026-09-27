import CONSTANTS from "../constants";
import EmotiveHUD from "../apps/EmotiveHUD";
import { getDisplayGroups } from "../state";
import { PortraitUpdateData } from "../types";

// keeps one hud window open per displayed group
export default class HUDManager {
  private windows = new Map<string, EmotiveHUD>();
  // setting hooks can fire during ready migration; wait for start()
  private started = false;

  constructor() {
    Hooks.on(`${CONSTANTS.MODULE_ID}.hudStateChanged`, () => this.sync());
    Hooks.on(`${CONSTANTS.MODULE_ID}.actorLimitChanged`, () => this.sync());
    Hooks.on(`${CONSTANTS.MODULE_ID}.layoutChanged`, () => this.renderAll());
    Hooks.on(`${CONSTANTS.MODULE_ID}.appearanceChanged`, () => this.renderAll());
  }

  start(): void {
    this.started = true;
    this.sync();
  }

  // opens new groups, closes removed ones, re-renders the rest
  sync(): void {
    if (!this.started) return;
    const groups = getDisplayGroups();
    const ids = new Set(groups.map(group => group.id));

    for (const [id, hud] of this.windows) {
      if (ids.has(id)) continue;
      hud.close();
      this.windows.delete(id);
    }

    groups.forEach((group, index) => {
      const existing = this.windows.get(group.id);
      if (existing) {
        existing.render();
        return;
      }
      const hud = new EmotiveHUD(group.id, index);
      this.windows.set(group.id, hud);
      hud.render(true);
    });
  }

  renderAll(): void {
    this.windows.forEach(hud => hud.render());
  }

  // only the window holding that actor finds its portrait
  handlePortraitUpdate(data: PortraitUpdateData): void {
    this.windows.forEach(hud => hud.handlePortraitUpdate(data));
  }
}
