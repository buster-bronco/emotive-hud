import type { ActorConfig, ChatCommanderApi, EmotiveHudModule, HUDState } from "./types";

type HUDPosition = { left: number; top: number } | null;

declare global {
  // setting value types keyed by "namespace.key"
  interface SettingConfig {
    "emotive-hud.actorConfigs": Record<string, ActorConfig>;
    "emotive-hud.hudState": HUDState;
    "emotive-hud.isMinimized": boolean;
    "emotive-hud.actorLimit": number;
    "emotive-hud.gridColumns": number;
    "emotive-hud.floatingPortraitWidth": number;
    "emotive-hud.portraitRatio": number;
    "emotive-hud.snapThreshold": number;
    "emotive-hud.hudPosition": HUDPosition;
    "emotive-hud.selectorPreviewRows": number;
    "emotive-hud.confirmFolderSync": boolean;
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
    "emotive-hud": Pick<EmotiveHudModule, "emotiveActorSelector" | "emotiveHUD" | "emotivePortraitPicker">;
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
      "emotive-hud.minimizedStateChanged": (value: boolean) => void;
      "emotive-hud.actorLimitChanged": (value: number) => void;
      "emotive-hud.layoutChanged": (value: number) => void;
      "emotive-hud.snapSettingsChanged": (value: number) => void;
      // fired by chat commander on ready with its api
      chatCommandsReady: (commands: ChatCommanderApi) => void;
    }
  }
}
