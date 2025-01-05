// Import module.json data
import { id } from "./../module.json";

export const CONSTANTS = {
  /**
   * The ID of the module
   * This is derived from module.json to ensure consistency
   */
  MODULE_ID: id,

  /**
   * The display name of the module
   */
  MODULE_NAME: "Emotive HUD",

  /**
   * Debugging prefix console messages
   */
  DEBUG_PREFIX: "EMOTIVE-HUD:",

  /**
   * Socket event name for module communication
   */
  SOCKET_NAME: `module.${id}`,

  /**
   * Chat command used for the emotive chat message functionality
   */
  CHAT_COMMAND: {
    SAY: "/say",
    DO: "/do",
  }
} as const;

export default CONSTANTS;