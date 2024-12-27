import { ModuleData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/packages.mjs";
import DogBrowser from "./apps/dogBrowser";
import EmotiveHUD from "./apps/EmotiveHUD";

export interface MyModule extends Game.ModuleData<ModuleData> {
  dogBrowser: DogBrowser;
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