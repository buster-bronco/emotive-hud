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
  isVertical: boolean;
  isMinimized: boolean;
  portraits: PortraitData[];
}

export interface PortraitData {
  actorId: string;
  imgSrc: string;
  name: string;
  isSelected?: boolean;
}

export interface PortraitUpdateData {
  actorId: string;
  timestamp: number;
}