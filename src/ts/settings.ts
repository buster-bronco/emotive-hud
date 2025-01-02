import { CONSTANTS } from './constants';
import { getGame } from './utils';

export interface ActorConfig {
  uuid: string;
  portraitFolder?: string;
  cachedPortraits?: string[]; 
}

export interface HUDState {
  actors: {
    uuid: string;
    position: number;  // Index/position on the Emotive HUD
  }[];
}

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
};

// Helper functions to interact with the settings
export const getActorConfigs = (): Record<string, ActorConfig> => {
  return getGame().settings.get(CONSTANTS.MODULE_ID, 'actorConfigs') as Record<string, ActorConfig>;
};

export const updateActorConfig = async (uuid: string, folderPath: string): Promise<void> => {
  const configs = getActorConfigs();
  if (!configs[uuid]) return;

  try {
    // Only GM can browse files
    if (!getGame().user?.isGM) return;

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

// Get cached portraits for an actor
export const getActorPortraits = (uuid: string): string[] => {
  const configs = getActorConfigs();
  return configs[uuid]?.cachedPortraits ?? [];
};
