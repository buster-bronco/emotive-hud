import { CONSTANTS } from './constants';
import { getActorLimit } from './settings';
import { HUDGroup, HUDState, LegacyHUDState } from './types';
import { getGame } from './utils';

// id the pre-group actor list migrates into
export const DEFAULT_GROUP_ID = 'default';

const isLegacy = (raw: HUDState | LegacyHUDState): raw is LegacyHUDState =>
  Array.isArray((raw as LegacyHUDState).actors);

const normalizeHUDState = (raw: HUDState | LegacyHUDState | null | undefined): HUDState => {
  if (!raw) return { groups: [] };
  if (isLegacy(raw)) {
    const actors = [...raw.actors].sort((a, b) => a.position - b.position).map(actor => actor.uuid);
    return { groups: actors.length ? [{ id: DEFAULT_GROUP_ID, actors }] : [] };
  }
  return { groups: raw.groups ?? [] };
};

// settings.get can hand back the cached object; always a fresh copy
export const getHUDState = (): HUDState => {
  const raw = getGame().settings.get(CONSTANTS.MODULE_ID, 'hudState') as HUDState | LegacyHUDState;
  return foundry.utils.deepClone(normalizeHUDState(raw));
};

// empty groups never persist
export const saveHUDState = async (state: HUDState): Promise<void> => {
  const groups = state.groups.filter(group => group.actors.length);
  await getGame().settings.set(CONSTANTS.MODULE_ID, 'hudState', { groups });
};

// gm rewrites a legacy flat list as groups once
export const migrateHUDState = async (): Promise<void> => {
  if (!getGame().user?.isGM) return;
  const raw = getGame().settings.get(CONSTANTS.MODULE_ID, 'hudState') as HUDState | LegacyHUDState;
  if (raw && isLegacy(raw)) await saveHUDState(normalizeHUDState(raw));
};

export const allHudActorUuids = (state: HUDState = getHUDState()): string[] =>
  state.groups.flatMap(group => group.actors);

export const findGroupOf = (uuid: string, state: HUDState = getHUDState()): HUDGroup | undefined =>
  state.groups.find(group => group.actors.includes(uuid));

// actor limit counts across groups in order; always at least one window for the bar
export const getDisplayGroups = (state: HUDState = getHUDState()): HUDGroup[] => {
  let room = getActorLimit();
  const groups = state.groups
    .map(group => {
      const actors = group.actors.slice(0, Math.max(0, room));
      room -= actors.length;
      return { id: group.id, actors };
    })
    .filter(group => group.actors.length);
  return groups.length ? groups : [{ id: DEFAULT_GROUP_ID, actors: [] }];
};

// shown actors take the new order; ones past the limit keep their tail slots
export const reorderGroup = async (groupId: string, uuids: string[]): Promise<void> => {
  const state = getHUDState();
  const group = state.groups.find(g => g.id === groupId);
  if (!group) return;
  group.actors = [...uuids, ...group.actors.filter(uuid => !uuids.includes(uuid))];
  await saveHUDState(state);
};

export const moveActor = async (uuid: string, toGroupId: string, index: number): Promise<void> => {
  const state = getHUDState();
  const target = state.groups.find(g => g.id === toGroupId);
  if (!target) return;
  state.groups.forEach(group => group.actors = group.actors.filter(a => a !== uuid));
  target.actors.splice(index, 0, uuid);
  await saveHUDState(state);
};

// pulls the actors out of their groups into a new one; returns its id
export const createGroup = async (uuids: string[], id: string = foundry.utils.randomID()): Promise<string> => {
  const state = getHUDState();
  state.groups.forEach(group => group.actors = group.actors.filter(a => !uuids.includes(a)));
  state.groups.push({ id, actors: uuids });
  await saveHUDState(state);
  return id;
};
