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
    // HACK: type assertion is used here because the latest stable foundry-vtt-types is not up to date with v12
    type: new (foundry as any).data.fields.NumberField({nullable: false, integer: true, min: 1, max: 15, step: 1}),
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
    // HACK: type assertion is used here because the latest stable foundry-vtt-types is not up to date with v12
    type: new (foundry as any).data.fields.NumberField({nullable: false, integer: true, min: 1, max: 6, step: 1}),
    default: 3,
    onChange: value => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.gridColumnsChanged`, value);
    }
  });

  gameInstance.settings.register(CONSTANTS.MODULE_ID, 'hudLayout', {
    name: "HUD Layout",
    hint: "Choose whether to display the HUD embedded in chat or as a floating window",
    scope: "client",
    config: true,
    // HACK: type assertion is used here because the latest stable foundry-vtt-types is not up to date with v12
    type: new (foundry as any).data.fields.StringField({
      choices: {
        "embedded": "Embedded in Chat",
        "floating": "Floating Window"
      },
    }),
    default: "embedded",
    onChange: value => {
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.layoutChanged`, value);
    }
  });
};

// Helper functions to interact with the settings
export const getActorConfigs = (): Record<string, ActorConfig> => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'actorConfigs') as Record<string, ActorConfig>;
};

export const updateActorConfig = async (uuid: string, folderPath: string | undefined): Promise<void> => {
  const configs = getActorConfigs();
  if (!configs[uuid]) return;

  try {
    // Only GM can browse files
    if (!getGame().user?.isGM) throw "Only GM Can Browse Files";

    // If config doesn't exist, create it with just the UUID
    if (!configs[uuid]) {
      configs[uuid] = { uuid };
      await getGame().settings.set(CONSTANTS.MODULE_ID, 'actorConfigs', configs);
      return;
    }

    // If folderPath is undefined or empty, keep existing config unchanged
    if (!folderPath) {
      return;
    }

    // Browsing the folder to get image files
    const browser = await FilePicker.browse("data", folderPath);
    const portraits = browser.files.filter(file => 
      file.toLowerCase().endsWith('.jpg') || 
      file.toLowerCase().endsWith('.jpeg') || 
      file.toLowerCase().endsWith('.png') || 
      file.toLowerCase().endsWith('.webp')
    );

    // Update the actor's config: portrait folder and cached portraits
    const updatedConfig = {
      ...configs[uuid], // Keep existing config
      portraitFolder: folderPath, // Update folder path
      cachedPortraits: portraits // Cache the new portraits
    };

    configs[uuid] = updatedConfig;
    
    // Save the updated config back to the settings
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

export const getHudLayout = (): string => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'hudLayout') as string;
};

// Get cached portraits for an actor
export const getActorPortraits = (uuid: string): string[] => {
  const configs = getActorConfigs();
  return configs[uuid]?.cachedPortraits ?? [];
};
