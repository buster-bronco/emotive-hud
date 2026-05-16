import { CONSTANTS } from "./constants";
import { getHUDState } from "./settings";
import { getGame } from "./utils";

type ChatCommandMatch = RegExpMatchArray | RegExpMatchArray[] | string[];

interface ChatCommandPattern {
  rgx: RegExp;
  fn: (command: string, match: ChatCommandMatch) => Promise<false>;
}

interface ChatLogConstructor {
  CHAT_COMMANDS?: Record<string, ChatCommandPattern>;
}

export function initializeChatCommands(): void {
  registerFoundryChatCommands();
}

function registerFoundryChatCommands(): void {
  const chatLogClass = ((CONFIG as any).ui?.chat ?? (foundry as any).applications?.sidebar?.tabs?.ChatLog) as ChatLogConstructor | undefined;

  if (!chatLogClass?.CHAT_COMMANDS) return;

  chatLogClass.CHAT_COMMANDS.say = createChatCommand(CONSTANTS.CHAT_COMMAND.SAY, false);
  chatLogClass.CHAT_COMMANDS.do = createChatCommand(CONSTANTS.CHAT_COMMAND.DO, true);
}

function createChatCommand(command: string, italicize: boolean): ChatCommandPattern {
  return {
    rgx: new RegExp(`^(${escapeRegExp(command)}(?:\\s+|$))([^]*)`, "i"),
    fn: async (_command: string, match: ChatCommandMatch): Promise<false> => {
      await handleEmotiveChatMessage(normalizeChatText(String(match[2] ?? "")), italicize);
      return false;
    },
  };
}

function normalizeChatText(text: string): string {
  const trimmed = text.trim();

  if (!/[<&]/.test(trimmed) || typeof document === "undefined") return trimmed;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = trimmed.replace(/<br\s*\/?>/gi, "\n");

  return wrapper.innerText.trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function handleEmotiveChatMessage(messageText: string, italicize?: boolean): Promise<void> {
  const game = getGame();
  // First try user's assigned character
  let speaker: StoredDocument<Actor> | undefined = game.user?.character;

  // If no assigned character, check selected token
  if (!speaker) {
    const controlled = canvas?.tokens?.controlled[0];
    if (controlled?.actor && controlled.actor.id) {  // Ensure actor and id exist
      const hudState = getHUDState();
      const actorUuid = `Actor.${controlled.actor.id}`;

      // Check if the selected token's actor is on the HUD
      const isOnHud = hudState.actors.some(a => a.uuid === actorUuid);

      if (isOnHud && controlled.actor.testUserPermission(game.user!, "OWNER")) {
        speaker = game.actors!.get(controlled.actor.id) ?? undefined;
      }
    }
  }

  if (!speaker) {
    ui.notifications?.warn("You must have a character assigned or select a token you own that is on the Emotive HUD");
    return;
  }

  // Get the current portrait from EmotiveHUD flags or fall back to default image
  const portrait = speaker.getFlag(CONSTANTS.MODULE_ID, 'currentPortrait') as string || speaker.img;

  // Create chat message content from template
  const renderTemplateV14 = (foundry as any).applications?.handlebars?.renderTemplate ?? renderTemplate;
  const content = await renderTemplateV14(
    `modules/${CONSTANTS.MODULE_ID}/templates/emotive-chat-message.hbs`,
    {
      portrait,
      name: speaker.name,
      message: messageText,
      italicize: italicize ? italicize : false,
    }
  );

  // Create chat message data
  const chatData = {
    style: (CONST as any).CHAT_MESSAGE_STYLES.IC,
    author: game.user?.id,
    speaker: {
      alias: speaker.name
    },
    content: content,
    flags: {
      [CONSTANTS.MODULE_ID]: {
        isEmotiveMessage: true
      }
    }
  };

  await ChatMessage.create(chatData);
}
