import { ModuleData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/packages.mjs";
import EmotiveHUD from "./apps/EmotiveHUD";
import EmotiveActorSelector from "./apps/EmotiveActorSelector";

export interface MyModule extends Game.ModuleData<ModuleData> {
  emotiveActorSelector: EmotiveActorSelector; 
  emotiveHUD: EmotiveHUD; 
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