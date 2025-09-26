import { CONSTANTS } from './constants';
import { emitHUDRefresh } from './sockets';
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

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'gridColumns', {
    name: "Grid Columns",
    hint: "Number of columns to display in the HUD. Set to 1 for vertical layout.",
    scope: "client",
    config: true,
    type: new (foundry as any).data.fields.NumberField({ nullable: false, integer: true, min: 1, max: 6, step: 1 }),
    default: 3,
    onChange: value => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.layoutChanged`, value);
    }
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'floatingPortraitWidth', {
    name: "Portrait Width",
    hint: "The Portrait Width for the widget",
    scope: "client",
    config: true,
    type: new (foundry as any).data.fields.NumberField({ nullable: false, integer: true, min: 100, max: 200, step: 25 }),
    default: 125,
    onChange: value => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.layoutChanged`, value);
    }
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'portraitRatio', {
    name: "Portrait Height Ratio",
    hint: "Set the height ratio for portraits (1-2). A ratio of 2 means portraits will be twice as tall as they are wide.",
    scope: "world",
    config: true,
    type: new (foundry as any).data.fields.NumberField({ nullable: false, min: 1, max: 2, step: 0.1 }),
    default: 1,
    onChange: value => {
      emitHUDRefresh();
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.layoutChanged`, value);
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

  // Store user's preferred HUD position (distance from edges)
  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'hudPosition', {
    name: 'HUD Position',
    scope: 'client',
    config: false,
    type: Object,
    default: null, // null means use default positioning
    onChange: value => {
      // No hook needed, position is applied on render
    }
  });
};

export const getActorConfigs = (): Record<string, ActorConfig> => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'actorConfigs') as Record<string, ActorConfig>;
};

export const updateActorConfig = async (uuid: string, folderPath: string | undefined): Promise<void> => {
  const configs = getActorConfigs();

  try {
    if (!getGame().user?.isGM) throw "Only GM Can Browse Files";

    if (!configs[uuid]) {
      configs[uuid] = { uuid };
    }

    if (!folderPath) {
      return;
    }

    const browser = await FilePicker.browse("data", folderPath);
    console.log(CONSTANTS.DEBUG_PREFIX, 'FilePicker browser results:', browser);

    const portraits = browser.files.filter(file => {
      const ext = file.toLowerCase();
      return ext.endsWith('.jpg') ||
        ext.endsWith('.jpeg') ||
        ext.endsWith('.png') ||
        ext.endsWith('.gif') ||
        ext.endsWith('.webp');
    });

    console.log(CONSTANTS.DEBUG_PREFIX, 'Caching following portraits:', portraits);

    const updatedConfig = {
      uuid,
      portraitFolder: folderPath,
      cachedPortraits: portraits
    };

    configs[uuid] = updatedConfig;

    await getGame().settings.set(CONSTANTS.MODULE_ID, 'actorConfigs', configs);
    console.log(CONSTANTS.DEBUG_PREFIX, 'Actor config updated:', {
      uuid,
      config: updatedConfig,
      allConfigs: configs
    });

    configs[uuid] = updatedConfig;

    await getGame().settings.set(CONSTANTS.MODULE_ID, 'actorConfigs', configs);
    console.log(CONSTANTS.DEBUG_PREFIX, ' actorConfigs updated: ', configs);
  } catch (error) {
    console.error(CONSTANTS.DEBUG_PREFIX, 'Error updating actor config:', error);
    throw error;
  }
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

export const getPortraitRatio = (): number => {
  return 1 / (getGame().settings.get(CONSTANTS.MODULE_ID, 'portraitRatio') as number);
}

export const getFloatingPortraitWidth = (): number => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'floatingPortraitWidth') as number;
}

export const getActorPortraits = (uuid: string): string[] => {
  const configs = getActorConfigs();
  return configs[uuid]?.cachedPortraits ?? [];
};

export const getSnapThreshold = (): number => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'snapThreshold') as number;
};

export const getHUDPosition = (): { left: number; top: number } | null => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'hudPosition') as { left: number; top: number } | null;
};

export const setHUDPosition = async (position: { left: number; top: number } | null): Promise<void> => {
  await getGame().settings.set(CONSTANTS.MODULE_ID, 'hudPosition', position);
};