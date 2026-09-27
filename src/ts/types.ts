import HUDManager from "./hud/HUDManager";
import EmotiveActorSelector from "./apps/EmotiveActorSelector";
import EmotivePortraitPicker from "./apps/EmotiovePortraitPicker";

export interface EmotiveHudModule extends foundry.packages.Module {
  emotiveActorSelector: EmotiveActorSelector;
  hud: HUDManager;
  emotivePortraitPicker: EmotivePortraitPicker;
  api: EmotiveHudApi;
}

export interface EmotiveHudApi {
  // fields only show in worlds running that game.system.id
  registerSystemFields(systemId: string, fields: TooltipField[]): void;
}

export type TooltipSection =
  | { kind: "stat"; label: string; value: string | number }
  | { kind: "bar"; label: string; value: number; max: number; temp?: number }
  | { kind: "icons"; label: string; items: { img: string; name: string; badge?: string | number | null }[] }
  | { kind: "list"; label: string; items: string[] }
  | { kind: "table"; label: string; columns: string[]; rows: string[][] };

export interface TooltipField {
  // unique within its system
  id: string;
  label: string;
  // shown until a gm turns it off; defaults to true
  defaultEnabled?: boolean;
  render(actor: Actor): TooltipSection | TooltipSection[] | null;
}

export interface EmotiveHUDData extends foundry.applications.api.ApplicationV2.RenderContext {
  canManage: boolean;
  columns: number;
  isMinimized: boolean;
  portraits: PortraitData[];
  floatingPortraitWidth: number;
  backgroundColor: string;
  backgroundOpacity: number;
  dockSide: string;
  toggleIcon: string;
}

export interface PortraitData {
  actorId: string;
  imgSrc: string;
  name: string;
  emotivePortraitRatio: number; // needs to be set here because of CSS witchcraft
}

export interface PortraitUpdateData {
  actorId: string;
  timestamp: number;
}

export interface ActorConfig {
  uuid: string;
  portraitFolder?: string;
  cachedPortraits?: string[];
  excludedPortraits?: string[];
}

// setting shapes are type aliases; foundry setting types reject interfaces
// one hud window per group; array order is display order
export type HUDGroup = {
  id: string;
  actors: string[];
};

export type HUDState = {
  groups: HUDGroup[];
};

// pre-group shape, migrated on read
export interface LegacyHUDState {
  actors: { uuid: string; position: number }[];
}

export type HUDPosition = { left: number; top: number };

// client-side layout for one group window
export type WindowState = {
  position: HUDPosition | null;
  minimized: boolean;
  columns: number;
  width: number;
  color?: string;
};

// subset of the chat commander module api (game.chatCommands)
export interface ChatCommanderApi {
  register(command: {
    name: string;
    module: string;
    description?: string;
    icon?: string;
    callback?: (chat: unknown, parameters: string, messageData: object) => object | null | undefined;
  }): void;
}

// edge of the viewport the hud is snapped against
export type DockSide = 'left' | 'right' | 'top' | 'bottom' | null;

// which end of the controls column the toggle stays pinned to
