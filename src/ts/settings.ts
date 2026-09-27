import { CONSTANTS } from './constants';
import { ActorConfig, HUDPosition, HUDState, WindowState } from './types';
import { getGame } from './utils';

export const DEFAULT_WINDOW_STATE: WindowState = {
  position: null,
  minimized: false,
  columns: 3,
  width: 125,
};

export const registerSettings = function() {
  const gameInstance = getGame();

  // Store all configured actors and their portrait folders
  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'actorConfigs', {
    name: 'Actor Portrait Configurations',
    scope: 'world',
    config: false,
    type: Object,
    default: {} as Record<string, ActorConfig>,
    onChange: value => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.configsChanged`, value);
    }
  });

  // groups and their actor order; read through state.ts
  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'hudState', {
    name: 'Active HUD State',
    scope: 'world',
    config: false,
    type: Object,
    default: { groups: [] } as HUDState,
    onChange: value => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.hudStateChanged`, value);
    }
  });

  // group id -> position, minimize, layout and tint of that window
  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'windowStates', {
    name: 'HUD Window States',
    scope: 'client',
    config: false,
    type: Object,
    default: {} as Record<string, WindowState>,
  });

  // legacy single-window settings; only read by migrateWindowStates
  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'isMinimized', {
    name: 'Emotive HUD Minimized State',
    scope: 'client',
    config: false,
    type: Boolean,
    default: false,
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'actorLimit', {
    name: "Actor Limit",
    hint: "Maximum number of actors that can be displayed on the Emotive HUD. Warning: Setting this above 12 may make the HUD unwieldy.",
    scope: "world",
    config: true,
    type: new (foundry as any).data.fields.NumberField({ nullable: false, integer: true, min: 1, max: 15, step: 1 }),
    default: 9,
    onChange: value => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.actorLimitChanged`, value);
    }
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'gridColumns', {
    name: "Grid Columns",
    scope: "client",
    config: false,
    type: new (foundry as any).data.fields.NumberField({ nullable: false, integer: true, min: 1, max: 15 }),
    default: DEFAULT_WINDOW_STATE.columns,
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'floatingPortraitWidth', {
    name: "Portrait Width",
    scope: "client",
    config: false,
    type: new (foundry as any).data.fields.NumberField({ nullable: false, integer: true, min: CONSTANTS.MIN_PORTRAIT_WIDTH, max: CONSTANTS.MAX_PORTRAIT_WIDTH }),
    default: DEFAULT_WINDOW_STATE.width,
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'portraitRatio', {
    name: "Portrait Height Ratio",
    hint: "Height ratio for portraits on your HUD (1-2). A ratio of 2 means portraits will be twice as tall as they are wide.",
    scope: "client",
    config: true,
    type: new (foundry as any).data.fields.NumberField({ nullable: false, min: 1, max: 2, step: 0.1 }),
    default: 1,
    onChange: value => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.layoutChanged`, value);
    }
  });

  // legacy global tint; now only the default for windows without their own color
  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'hudBackgroundColor', {
    name: "HUD Background Color",
    scope: "client",
    config: false,
    type: new (foundry as any).data.fields.ColorField({ nullable: false, initial: "#000000" }),
    default: "#000000",
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'hudBackgroundOpacity', {
    name: "HUD Background Opacity",
    hint: "How opaque the HUD background tint is (0 is fully transparent, 1 is solid).",
    scope: "client",
    config: true,
    type: new (foundry as any).data.fields.NumberField({ nullable: false, min: 0, max: 1, step: 0.05 }),
    default: 0.35,
    onChange: () => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.appearanceChanged`);
    }
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'snapThreshold', {
    name: "Edge Snap Distance",
    hint: "How close (in pixels) the HUD needs to be to an edge before it automatically snaps. Set to 0 to disable snapping.",
    scope: "client",
    config: true,
    type: new (foundry as any).data.fields.NumberField({ nullable: false, integer: true, min: 0, max: 100, step: 10 }),
    default: 30,
    onChange: value => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.snapSettingsChanged`, value);
    }
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'barFadeDelay', {
    name: "Control Bar Fade Delay",
    hint: "Seconds without hovering before the HUD's control bar fades out. Set to 0 to disable.",
    scope: "client",
    config: true,
    type: new (foundry as any).data.fields.NumberField({ nullable: false, integer: true, min: 0, max: 30, step: 1 }),
    default: 3,
    onChange: () => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.appearanceChanged`);
    }
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'selectorPreviewRows', {
    name: "Actor Selector Emote Rows",
    hint: "Number of rows in the emote strip shown when expanding an actor in the actor selector.",
    scope: "client",
    config: true,
    type: new (foundry as any).data.fields.NumberField({ nullable: false, integer: true, min: 1, max: 4, step: 1 }),
    default: 2,
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'confirmFolderSync', {
    name: "Confirm Portrait Folder Sync",
    hint: "Show a warning before syncing an actor's portrait folder, since syncing resets that actor's excluded portraits.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'clickToFocus', {
    name: "Enable Click to Focus",
    hint: "Clicking a portrait pans the canvas to that actor's token and selects it.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'tooltipsEnabled', {
    name: "Show Portrait Tooltips",
    hint: "Hovering a portrait shows a card with that actor's stats. The GM picks which stats appear.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'groupTooltipLock', {
    name: "Lock Tooltips to Own Group",
    hint: "Players only see portrait tooltips in the group holding their assigned character, or any actor they own if none is assigned.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  // "scope.fieldid" -> shown; missing keys fall back to the field default
  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'tooltipFields', {
    name: 'Tooltip Fields',
    scope: 'world',
    config: false,
    type: Object,
    default: {} as Record<string, boolean>,
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'hudPosition', {
    name: 'HUD Position',
    scope: 'client',
    config: false,
    type: Object,
    default: null, // null means use default positioning
  });
};

export const getActorConfigs = (): Record<string, ActorConfig> => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'actorConfigs') as Record<string, ActorConfig>;
};

const PORTRAIT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// filepicker.browse lists a data folder; keep only image files
export const scanPortraitFolder = async (folderPath: string): Promise<string[]> => {
  const browser = await FilePicker.browse("data", folderPath);
  console.log(CONSTANTS.DEBUG_PREFIX, 'FilePicker browser results:', browser);
  return browser.files.filter(file => {
    const lower = file.toLowerCase();
    return PORTRAIT_EXTENSIONS.some(ext => lower.endsWith(ext));
  });
};

// settings.get can hand back the cached object; clone before mutating
const cloneActorConfigs = (): Record<string, ActorConfig> => {
  return foundry.utils.deepClone(getActorConfigs());
};

const saveActorConfigs = async (configs: Record<string, ActorConfig>): Promise<void> => {
  await getGame().settings.set(CONSTANTS.MODULE_ID, 'actorConfigs', configs);
  console.log(CONSTANTS.DEBUG_PREFIX, 'actorConfigs updated:', configs);
};

// rescans a folder into cachedportraits; exclusions survive only if the folder is unchanged
const buildActorConfig = async (existing: ActorConfig | undefined, uuid: string, folderPath: string): Promise<ActorConfig> => {
  const portraits = await scanPortraitFolder(folderPath);
  const sameFolder = existing?.portraitFolder === folderPath;
  const excluded = sameFolder
    ? (existing?.excludedPortraits ?? []).filter(path => portraits.includes(path))
    : [];
  return { uuid, portraitFolder: folderPath, cachedPortraits: portraits, excludedPortraits: excluded };
};

export const updateActorConfig = async (uuid: string, folderPath: string | undefined): Promise<void> => {
  try {
    if (!getGame().user?.isGM) throw "Only GM Can Browse Files";
    if (!folderPath) return;

    const configs = cloneActorConfigs();
    configs[uuid] = await buildActorConfig(configs[uuid], uuid, folderPath);
    await saveActorConfigs(configs);
  } catch (error) {
    console.error(CONSTANTS.DEBUG_PREFIX, 'Error updating actor config:', error);
    throw error;
  }
};

// batch save for apply; only folders that changed get rescanned
export const saveActorFolders = async (entries: { uuid: string; portraitFolder?: string }[]): Promise<void> => {
  if (!getGame().user?.isGM) throw "Only GM Can Browse Files";

  const configs = cloneActorConfigs();
  let changed = false;

  await Promise.all(entries.map(async ({ uuid, portraitFolder }) => {
    if (!portraitFolder) return;
    const existing = configs[uuid];
    if (existing?.portraitFolder === portraitFolder && existing.cachedPortraits) return;
    configs[uuid] = await buildActorConfig(existing, uuid, portraitFolder);
    changed = true;
  }));

  if (changed) await saveActorConfigs(configs);
};

// sync rescans each folder and clears its excluded portraits
export const syncActorConfigs = async (entries: { uuid: string; portraitFolder?: string }[]): Promise<number> => {
  if (!getGame().user?.isGM) throw "Only GM Can Browse Files";

  const configs = cloneActorConfigs();
  const targets = entries.filter(entry => entry.portraitFolder);

  await Promise.all(targets.map(async ({ uuid, portraitFolder }) => {
    const portraits = await scanPortraitFolder(portraitFolder!);
    configs[uuid] = { uuid, portraitFolder, cachedPortraits: portraits, excludedPortraits: [] };
  }));

  if (targets.length) await saveActorConfigs(configs);
  return targets.length;
};

// excluded portraits are hidden from the hud picker; used for duplicate files
export const setPortraitExcluded = async (uuid: string, path: string, excluded: boolean): Promise<void> => {
  const configs = cloneActorConfigs();
  const config = configs[uuid] ?? { uuid };
  const current = new Set(config.excludedPortraits ?? []);

  if (excluded) current.add(path);
  else current.delete(path);

  configs[uuid] = { ...config, excludedPortraits: Array.from(current) };
  await saveActorConfigs(configs);
};

export const getActorLimit = (): number => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'actorLimit') as number;
};

export const getSelectorPreviewRows = (): number => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'selectorPreviewRows') as number;
};

export const getConfirmFolderSync = (): boolean => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'confirmFolderSync') as boolean;
};

export const setConfirmFolderSync = async (value: boolean): Promise<void> => {
  await getGame().settings.set(CONSTANTS.MODULE_ID, 'confirmFolderSync', value);
};

export const getPortraitRatio = (): number => {
  return 1 / (getGame().settings.get(CONSTANTS.MODULE_ID, 'portraitRatio') as number);
}

// color inputs only take #rrggbb
export const getDefaultHUDColor = (): string => {
  const color = String(getGame().settings.get(CONSTANTS.MODULE_ID, 'hudBackgroundColor') ?? '');
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#000000';
}

export const getHUDBackgroundOpacity = (): number => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'hudBackgroundOpacity') as number;
}

export const getActorPortraits = (uuid: string): string[] => {
  const config = getActorConfigs()[uuid];
  const excluded = new Set(config?.excludedPortraits ?? []);
  return (config?.cachedPortraits ?? []).filter(path => !excluded.has(path));
};

export const getSnapThreshold = (): number => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'snapThreshold') as number;
};

export const getBarFadeDelay = (): number => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'barFadeDelay') as number;
};

export const getClickToFocus = (): boolean => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'clickToFocus') as boolean;
};

export const getTooltipsEnabled = (): boolean => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'tooltipsEnabled') as boolean;
};

export const getGroupTooltipLock = (): boolean => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'groupTooltipLock') as boolean;
};

export const getTooltipFieldToggles = (): Record<string, boolean> => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'tooltipFields') as Record<string, boolean>;
};

export const setTooltipFieldToggles = async (toggles: Record<string, boolean>): Promise<void> => {
  await getGame().settings.set(CONSTANTS.MODULE_ID, 'tooltipFields', toggles);
};

const getWindowStates = (): Record<string, WindowState> => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'windowStates') as Record<string, WindowState>;
};

// unknown group ids get default layout
export const getWindowState = (groupId: string): WindowState => {
  return { ...DEFAULT_WINDOW_STATE, ...getWindowStates()[groupId] };
};

// drops window states for groups that no longer exist
export const pruneWindowStates = async (keep: Set<string>): Promise<void> => {
  const states = getWindowStates();
  const stale = Object.keys(states).filter(id => !keep.has(id));
  if (!stale.length) return;
  const pruned = foundry.utils.deepClone(states);
  stale.forEach(id => delete pruned[id]);
  await getGame().settings.set(CONSTANTS.MODULE_ID, 'windowStates', pruned);
};

export const patchWindowState = async (groupId: string, patch: Partial<WindowState>): Promise<void> => {
  const states = foundry.utils.deepClone(getWindowStates());
  states[groupId] = { ...getWindowState(groupId), ...patch };
  await getGame().settings.set(CONSTANTS.MODULE_ID, 'windowStates', states);
};

// copies the pre-group single window layout onto the first group
export const migrateWindowStates = async (groupId: string): Promise<void> => {
  if (Object.keys(getWindowStates()).length) return;
  const settings = getGame().settings;
  await patchWindowState(groupId, {
    position: settings.get(CONSTANTS.MODULE_ID, 'hudPosition') as HUDPosition | null,
    minimized: settings.get(CONSTANTS.MODULE_ID, 'isMinimized') as boolean,
    columns: settings.get(CONSTANTS.MODULE_ID, 'gridColumns') as number,
    width: settings.get(CONSTANTS.MODULE_ID, 'floatingPortraitWidth') as number,
  });
};
