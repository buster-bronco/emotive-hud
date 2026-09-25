import EmotiveHUD from "./apps/EmotiveHUD";
import EmotiveActorSelector from "./apps/EmotiveActorSelector";
import EmotivePortraitPicker from "./apps/EmotiovePortraitPicker";

export interface EmotiveHudModule extends foundry.packages.Module {
  emotiveActorSelector: EmotiveActorSelector;
  emotiveHUD: EmotiveHUD;
  emotivePortraitPicker: EmotivePortraitPicker;
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
