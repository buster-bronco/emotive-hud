import { ModuleData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/packages.mjs";
import EmotiveHUD from "./apps/EmotiveHUD";
import EmotiveActorSelector from "./apps/EmotiveActorSelector";
import EmotivePortraitPicker from "./apps/EmotiovePortraitPicker";

export interface EmotiveHudModule extends Game.ModuleData<ModuleData> {
  emotiveActorSelector: EmotiveActorSelector; 
  emotiveHUD: EmotiveHUD; 
  emotivePortraitPicker: EmotivePortraitPicker; 
}

export interface EmotiveHUDData {
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

export interface HUDState {
  actors: {
    uuid: string;
    position: number; // Index/position on the Emotive HUD
  }[];
}
