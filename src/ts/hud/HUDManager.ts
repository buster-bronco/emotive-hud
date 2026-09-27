import CONSTANTS from "../constants";
import EmotiveHUD from "../apps/EmotiveHUD";
import { getWindowState, patchWindowState, pruneWindowStates } from "../settings";
import { createGroup, getDisplayGroups, getHUDState, moveActor, reorderGroup } from "../state";
import { PortraitUpdateData } from "../types";
import { PortraitDrop } from "./portraitDrag";

// must match .portrait-container padding + border and the bar above it in emotive-hud.scss
const PORTRAIT_INSET = 16 + 1;
const BAR_OFFSET = 34 + 4;
// fallback so a lost render never strands a drag ghost
const SHOWN_TIMEOUT = 2000;

// keeps one hud window open per displayed group
export default class HUDManager {
  private windows = new Map<string, EmotiveHUD>();
  // setting hooks can fire during ready migration; wait for start()
  private started = false;
  // portrait dragging gate; resets to locked every load
  private _unlocked = false;
  // group id -> resolvers waiting for that window's first placement
  private shownWaiters = new Map<string, () => void>();

  constructor() {
    Hooks.on(`${CONSTANTS.MODULE_ID}.hudStateChanged`, () => this.sync());
    Hooks.on(`${CONSTANTS.MODULE_ID}.actorLimitChanged`, () => this.sync());
    Hooks.on(`${CONSTANTS.MODULE_ID}.layoutChanged`, () => this.renderAll());
    Hooks.on(`${CONSTANTS.MODULE_ID}.appearanceChanged`, () => this.renderAll());
  }

  get unlocked(): boolean {
    return this._unlocked;
  }

  toggleLock(): void {
    this._unlocked = !this._unlocked;
    this.renderAll();
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

    // spawning groups have a window state before they reach hud state
    const keep = new Set([...ids, ...getHUDState().groups.map(group => group.id), ...this.shownWaiters.keys()]);
    pruneWindowStates(keep);
  }

  renderAll(): void {
    this.windows.forEach(hud => hud.render());
  }

  notifyShown(groupId: string): void {
    this.shownWaiters.get(groupId)?.();
  }

  // resolves once the group's window is placed on screen
  private whenShown(groupId: string): Promise<void> {
    return new Promise(resolve => {
      const done = () => {
        window.clearTimeout(timer);
        this.shownWaiters.delete(groupId);
        resolve();
      };
      const timer = window.setTimeout(done, SHOWN_TIMEOUT);
      this.shownWaiters.set(groupId, done);
    });
  }

  // only the window holding that actor finds its portrait
  handlePortraitUpdate(data: PortraitUpdateData): void {
    this.windows.forEach(hud => hud.handlePortraitUpdate(data));
  }

  async dropPortrait(drop: PortraitDrop): Promise<void> {
    const uuid = `Actor.${drop.actorId}`;
    try {
      if (!drop.toGroupId) {
        await this.spawnGroup(uuid, drop);
      } else if (drop.toGroupId === drop.fromGroupId) {
        await reorderGroup(drop.toGroupId, (drop.order ?? []).map(id => `Actor.${id}`));
      } else {
        const index = drop.order ? drop.order.indexOf(drop.actorId) : Infinity;
        await moveActor(uuid, drop.toGroupId, index);
      }
    } catch (error) {
      console.error(CONSTANTS.DEBUG_PREFIX, 'Error moving portrait:', error);
      ui.notifications?.error("Failed to move portrait");
      // drag left the dom rearranged
      this.renderAll();
    }
  }

  // new window lands where the ghost was dropped, sized like its source; resolves once it shows
  private async spawnGroup(uuid: string, drop: PortraitDrop): Promise<void> {
    const id = foundry.utils.randomID();
    const source = getWindowState(drop.fromGroupId);
    const shown = this.whenShown(id);
    await patchWindowState(id, {
      position: { left: drop.point.left - PORTRAIT_INSET, top: drop.point.top - PORTRAIT_INSET - BAR_OFFSET },
      columns: source.columns,
      width: source.width,
    });
    await createGroup([uuid], id);
    await shown;
  }
}
