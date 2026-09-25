import EmotiveHUD from "./apps/EmotiveHUD";
import EmotiveActorSelector from "./apps/EmotiveActorSelector";
import EmotivePortraitPicker from "./apps/EmotiovePortraitPicker";

export interface EmotiveHudModule extends foundry.packages.Module {
  emotiveActorSelector: EmotiveActorSelector;
  emotiveHUD: EmotiveHUD;
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
  isGM: boolean,
  columns: number;
  isMinimized: boolean;
  portraits: PortraitData[];
  floatingPortraitWidth: number;
}

export interface PortraitData {
  actorId: string;
  imgSrc: string;
  name: string;
  isSelected?: boolean;
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

export type HUDState = {
  actors: {
    uuid: string;
    position: number; // Index/position on the Emotive HUD
  }[];
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
export type VerticalAnchor = 'top' | 'bottom';
