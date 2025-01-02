import { CONSTANTS } from './constants';
import { PortraitUpdateData } from './types';
import { getGame, getModule } from './utils';

/**
 * Initialize socket listeners for the module
 */
export function initializeSocketListeners(): void {
  const game = getGame();
  
  game.socket?.on(CONSTANTS.SOCKET_NAME, (data) => {
    console.log(`${CONSTANTS.DEBUG_PREFIX} Received socket message:`, data);
    handleSocketMessage(data);
  });

  console.log(CONSTANTS.DEBUG_PREFIX, 'Socket Listener Initialized', game.socket);
}

function handleSocketMessage(data: {
  action: string;
  payload: PortraitUpdateData;
}): void {
  // Handle different socket actions
  switch (data.action) {
    case 'updatePortrait':
      handlePortraitUpdate(data.payload as PortraitUpdateData);
      break;
    case 'refreshHUD':
      getModule().emotiveHUD.render();
      break;
    default:
      console.warn(`${CONSTANTS.DEBUG_PREFIX} Unknown socket action:`, data.action);
  }
}

function handlePortraitUpdate(data: PortraitUpdateData): void {
  const module = getModule();
  module.emotiveHUD.handlePortraitUpdate(data);
}

/**
 * Emit a socket event to notify other clients that a portrait was updated
 * @param actorId The ID of the actor whose portrait was updated
 */
export function emitPortraitUpdated(actorId: string): void {
  const game = getGame();
  
  const updateData: PortraitUpdateData = {
    actorId,
    timestamp: Date.now()
  };
  
  const socketData = {
    action: 'updatePortrait',
    payload: updateData
  };
  
  console.log(`${CONSTANTS.DEBUG_PREFIX} Emitting portrait update:`, socketData);
  
  // Emit the socket message
  game.socket?.emit(CONSTANTS.SOCKET_NAME, socketData);
  
  // Handle the update locally as well since emitter doesn't receive broadcast
  handlePortraitUpdate(updateData);
}

export function emitHUDRefresh(): void {
  const game = getGame();
  
  const socketData = {
    action: 'refreshHUD',
    payload: null
  };
  
  console.log(`${CONSTANTS.DEBUG_PREFIX} Emitting HUD refresh`);
  
  // Emit the socket message
  game.socket?.emit(CONSTANTS.SOCKET_NAME, socketData);
}
