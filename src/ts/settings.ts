import { CONSTANTS } from './constants';
import { ActorConfig, HUDState } from './types';
import { getGame } from './utils';

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

  // Store current HUD state (which actors are visible and their order)
  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'hudState', {
    name: 'Active HUD State',
    scope: 'world',
    config: false,
    type: Object,
    default: { actors: [] } as HUDState,
    onChange: value => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.hudStateChanged`, value);
    }
  });

  // Store minimized state for each client
  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'isMinimized', {
    name: 'Emotive HUD Minimized State',
    scope: 'client',
    config: false,
    type: Boolean,
    default: false,
    onChange: value => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.minimizedStateChanged`, value);
    }
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'actorLimit', {
    name: "Actor Limit",
    hint: "Maximum number of actors that can be displayed on the Emotive HUD. Warning: Setting this above 9 may make the HUD unwieldy.",
    scope: "world",
    config: true,
    type: new (foundry as any).data.fields.NumberField({ nullable: false, integer: true, min: 1, max: 15, step: 1 }),
    default: 9,
    onChange: value => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.actorLimitChanged`, value);
    }
  });

  // columns and portrait width are set by dragging the hud corners
  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'gridColumns', {
    name: "Grid Columns",
    scope: "client",
    config: false,
    type: new (foundry as any).data.fields.NumberField({ nullable: false, integer: true, min: 1, max: 15 }),
    default: 3,
    onChange: value => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.layoutChanged`, value);
    }
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'floatingPortraitWidth', {
    name: "Portrait Width",
    scope: "client",
    config: false,
    type: new (foundry as any).data.fields.NumberField({ nullable: false, integer: true, min: CONSTANTS.MIN_PORTRAIT_WIDTH, max: CONSTANTS.MAX_PORTRAIT_WIDTH }),
    default: 125,
    onChange: value => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.layoutChanged`, value);
    }
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

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'hudBackgroundColor', {
    name: "HUD Background Color",
    hint: "Tint color behind your HUD's portraits and buttons.",
    scope: "client",
    config: true,
    type: new (foundry as any).data.fields.ColorField({ nullable: false, initial: "#000000" }),
    default: "#000000",
    onChange: () => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.appearanceChanged`);
    }
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

  // "scope.fieldid" -> shown; missing keys fall back to the field default
  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'tooltipFields', {
    name: 'Tooltip Fields',
    scope: 'world',
    config: false,
    type: Object,
    default: {} as Record<string, boolean>,
  });


  // Store user's preferred HUD position (distance from edges)
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

export const getHUDState = (): HUDState => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'hudState') as HUDState;
};

export const setHUDState = async (state: HUDState): Promise<void> => {
  await getGame().settings.set(CONSTANTS.MODULE_ID, 'hudState', state);
};

export const getIsMinimized = (): boolean => {
  const gameInstance = getGame();
  const value = gameInstance.settings.get(CONSTANTS.MODULE_ID, 'isMinimized');
  return value as boolean;
};

export const setIsMinimized = async (isMinimized: boolean): Promise<void> => {
  const gameInstance = getGame();
  await gameInstance.settings.set(CONSTANTS.MODULE_ID, 'isMinimized', isMinimized);
};

export const getActorLimit = (): number => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'actorLimit') as number;
};

export const getGridColumns = (): number => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'gridColumns') as number;
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

export const getFloatingPortraitWidth = (): number => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'floatingPortraitWidth') as number;
}

export const getHUDBackgroundColor = (): string => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'hudBackgroundColor') as string;
}

export const getHUDBackgroundOpacity = (): number => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'hudBackgroundOpacity') as number;
}

export const setHUDLayout =async (columns: number, width: number): Promise<void> => {
  const settings = getGame().settings;
  await settings.set(CONSTANTS.MODULE_ID, 'gridColumns', columns);
  await settings.set(CONSTANTS.MODULE_ID, 'floatingPortraitWidth', width);
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

export const getHUDPosition = (): { left: number; top: number } | null => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'hudPosition') as { left: number; top: number } | null;
};

export const setHUDPosition = async (position: { left: number; top: number } | null): Promise<void> => {
  await getGame().settings.set(CONSTANTS.MODULE_ID, 'hudPosition', position);
};
export const getTooltipsEnabled = (): boolean => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'tooltipsEnabled') as boolean;
};

export const getTooltipFieldToggles = (): Record<string, boolean> => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'tooltipFields') as Record<string, boolean>;
};

export const setTooltipFieldToggles = async (toggles: Record<string, boolean>): Promise<void> => {
  await getGame().settings.set(CONSTANTS.MODULE_ID, 'tooltipFields', toggles);
};
