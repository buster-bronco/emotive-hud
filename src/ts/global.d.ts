import type { ActorConfig, ChatCommanderApi, EmotiveHudApi, EmotiveHudModule, HUDPosition, HUDState, WindowState } from "./types";

declare global {
  // setting value types keyed by "namespace.key"
  interface SettingConfig {
    "emotive-hud.actorConfigs": Record<string, ActorConfig>;
    "emotive-hud.hudState": HUDState;
    "emotive-hud.windowStates": Record<string, WindowState>;
    "emotive-hud.groupColors": Record<string, string>;
    "emotive-hud.isMinimized": boolean;
    "emotive-hud.actorLimit": number;
    "emotive-hud.gridColumns": number;
    "emotive-hud.floatingPortraitWidth": number;
    "emotive-hud.portraitRatio": number;
    "emotive-hud.hudBackgroundColor": string;
    "emotive-hud.hudBackgroundOpacity": number;
    "emotive-hud.snapThreshold": number;
    "emotive-hud.barFadeDelay": number;
    "emotive-hud.hudPosition": HUDPosition | null;
    "emotive-hud.selectorPreviewRows": number;
    "emotive-hud.confirmFolderSync": boolean;
    "emotive-hud.clickToFocus": boolean;
    "emotive-hud.tooltipsEnabled": boolean;
    "emotive-hud.groupTooltipLock": boolean;
    "emotive-hud.tooltipFields": Record<string, boolean>;
  }

  // document flag shapes keyed by document name then scope
  interface FlagConfig {
    Actor: {
      "emotive-hud": {
        currentPortrait: string;
      };
    };
    ChatMessage: {
      "emotive-hud": {
        isEmotiveMessage: boolean;
      };
    };
  }

  // extra props attached to game.modules.get("emotive-hud")
  interface ModuleConfig {
    "emotive-hud": Pick<EmotiveHudModule, "emotiveActorSelector" | "hud" | "emotivePortraitPicker" | "api">;
  }

  interface RequiredModules {
    "emotive-hud": true;
  }
}

declare module "@league-of-foundry-developers/foundry-vtt-types/configuration" {
  namespace Hooks {
    // custom hooks fired from setting onChange handlers
    interface HookConfig {
      "emotive-hud.configsChanged": (value: Record<string, ActorConfig>) => void;
      "emotive-hud.hudStateChanged": (value: HUDState) => void;
      "emotive-hud.actorLimitChanged": (value: number) => void;
      "emotive-hud.layoutChanged": (value: number) => void;
      "emotive-hud.appearanceChanged": () => void;
      "emotive-hud.snapSettingsChanged": (value: number) => void;
      // other modules add system tooltip fields here
      "emotive-hud.registerTooltipFields": (api: EmotiveHudApi) => void;
      // fired by chat commander on ready with its api
      chatCommandsReady: (commands: ChatCommanderApi) => void;
    }
  }
}
