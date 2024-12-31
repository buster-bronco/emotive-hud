import CONSTANTS from './constants';
import { EmotiveHudModule } from './types';

export class GameError extends Error {
  constructor(message: string) {
    super(`${CONSTANTS.MODULE_ID} | ${message}`);
    this.name = 'GameError';
  }
}

/**
 * Gets the game instance, throwing an error if it's not available.
 * This should only throw error if something is seriously wrong with Foundry's initialization.
 */
export function getGame(): Game {
  const gameInstance = game;
  
  if (!gameInstance) {
    throw new GameError('Game instance not available - this should never happen during normal operation');
  }
  
  return gameInstance as Game;
}

/**
 * Gets the current user, throwing an error if not available.
 * This should only throw error if something is seriously wrong with Foundry's initialization.
 */
export function getCurrentUser(): User {
  const gameInstance = getGame();
  
  if (!gameInstance.user) {
    throw new GameError('Current user not available - this should never happen during normal operation');
  }
  
  return gameInstance.user;
}

/**
 * Checks if the current user is a GM.
 * Throws if user information isn't available.
 */
export function isCurrentUserGM(): boolean {
  return getCurrentUser().isGM;
}

/**
 * Gets the game module instance for our module.
 * Throws if the module isn't properly registered.
 */
export function getModule(): EmotiveHudModule {
  const gameInstance = getGame();
  const module = gameInstance.modules.get(CONSTANTS.MODULE_ID) as EmotiveHudModule;
  
  if (!module) {
    throw new GameError(`Module ${CONSTANTS.MODULE_ID} not properly registered`);
  }
  
  return module;
}

/**
 * Safely gets the value of a game setting.
 * @throws if the game instance isn't available
 */
export function getGameSetting<T>(key: string): T {
  const gameInstance = getGame();
  return gameInstance.settings.get(CONSTANTS.MODULE_ID, key) as T;
}

/**
 * Safely sets a game setting value.
 * @throws if the game instance isn't available
 */
export async function setGameSetting<T>(key: string, value: T): Promise<void> {
  const gameInstance = getGame();
  await gameInstance.settings.set(CONSTANTS.MODULE_ID, key, value);
}
