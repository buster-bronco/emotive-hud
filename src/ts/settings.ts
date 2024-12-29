import { CONSTANTS } from './constants';

export interface ActorConfig {
  uuid: string;
  portraitFolder?: string;
  portraitPath?: string;
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
      // Trigger any necessary updates when configurations change
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
      // Trigger any necessary updates when HUD state changes
      Hooks.callAll(`${CONSTANTS.MODULE_ID}.hudStateChanged`, value);
    }
  });
};

// Helper functions to interact with the settings
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

// Helper to get currently visible actors in their correct order
export const getVisibleActors = (): ActorConfig[] => {
  const configs = getActorConfigs();
  const state = getHUDState();
  
  return state.actors
    .sort((a, b) => a.position - b.position)
    .map(({uuid}) => configs[uuid])
    .filter(config => config !== undefined);
};
