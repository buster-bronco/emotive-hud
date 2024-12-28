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
} as const;

// Using 'as const' makes all properties read-only and gives better type inference

export default CONSTANTS;