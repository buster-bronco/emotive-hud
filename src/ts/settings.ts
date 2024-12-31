import { CONSTANTS } from './constants';

export interface ActorConfig {
  uuid: string;
  portraitFolder?: string;
  portraitPath?: string;
  currentPortrait?: string;
  cachedPortraits?: string[]; 
}

export interface HUDState {
  actors: {
    uuid: string;
    position: number;  // Index/position on the Emotive HUD
  }[];
}

export const registerSettings = function() {
  const gameInstance = game as Game;

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
export const updateActorPortrait = async (uuid: string, portraitPath: string | null): Promise<void> => {
  const configs = getActorConfigs();
  if (!configs[uuid]) return;
  
  configs[uuid] = {
    ...configs[uuid],
    currentPortrait: portraitPath || undefined
  };
  
  await (game as Game).settings.set(CONSTANTS.MODULE_ID, 'actorConfigs', configs);
};

export const getActorConfigs = (): Record<string, ActorConfig> => {
  return (game as Game).settings.get(CONSTANTS.MODULE_ID, 'actorConfigs') as Record<string, ActorConfig>;
};

export const setActorConfig = async (uuid: string, config: ActorConfig): Promise<void> => {
  const configs = getActorConfigs();
  configs[uuid] = config;
  await (game as Game).settings.set(CONSTANTS.MODULE_ID, 'actorConfigs', configs);
};

export const getHUDState = (): HUDState => {
  return (game as Game).settings.get(CONSTANTS.MODULE_ID, 'hudState') as HUDState;
};

export const setHUDState = async (state: HUDState): Promise<void> => {
  await (game as Game).settings.set(CONSTANTS.MODULE_ID, 'hudState', state);
};

export const getIsMinimized = (): boolean => {
  const gameInstance = game as Game;
  const value = gameInstance.settings.get(CONSTANTS.MODULE_ID, 'isMinimized');
  console.log(`${CONSTANTS.DEBUG_PREFIX} Getting minimized state:`, value);
  return value as boolean;
};

export const setIsMinimized = async (isMinimized: boolean): Promise<void> => {
  const gameInstance = game as Game;
  console.log(`${CONSTANTS.DEBUG_PREFIX} Setting minimized state to:`, isMinimized);
  await gameInstance.settings.set(CONSTANTS.MODULE_ID, 'isMinimized', isMinimized);
  console.log(`${CONSTANTS.DEBUG_PREFIX} State set complete`);
};

export const cacheActorPortraits = async (uuid: string, folderPath: string): Promise<void> => {
  const configs = getActorConfigs();
  if (!configs[uuid]) return;

  try {
    // Only GM can browse files
    if (!(game as Game).user?.isGM) return;
    
    const browser = await FilePicker.browse("data", folderPath);
    const portraits = browser.files.filter(file => 
      file.toLowerCase().endsWith('.jpg') || 
      file.toLowerCase().endsWith('.jpeg') || 
      file.toLowerCase().endsWith('.png') || 
      file.toLowerCase().endsWith('.webp')
    );

    configs[uuid] = {
      ...configs[uuid],
      portraitFolder: folderPath,
      portraitPath: folderPath,
      cachedPortraits: portraits
    };

    await (game as Game).settings.set(CONSTANTS.MODULE_ID, 'actorConfigs', configs);
  } catch (error) {
    console.error(CONSTANTS.DEBUG_PREFIX, 'Error caching portraits:', error);
    throw error;
  }
};

// Get cached portraits for an actor
export const getActorPortraits = (uuid: string): string[] => {
  const configs = getActorConfigs();
  return configs[uuid]?.cachedPortraits ?? [];
};
