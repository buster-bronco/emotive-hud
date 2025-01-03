import { CONSTANTS } from "./constants";
import { getHUDState } from "./settings";
import { getGame } from "./utils";

export function initializeChatCommands(): void {
  // Register native Foundry chat command
  Hooks.on("chatMessage", (_app: any, message: string, _chatData: any) => {
    const command = CONSTANTS.CHAT_COMMAND;
    
    if (!message.startsWith(command)) return true;
    
    handleEmotiveChatMessage(message.slice(command.length).trim());
    return false;
  });

  // Register with Chat Commander if available
  Hooks.on('chatCommandsReady', () => {
    const game = getGame() as any;
    
    if (!game.chatCommands) return;

    game.chatCommands.register({
      name: CONSTANTS.CHAT_COMMAND,
      module: CONSTANTS.MODULE_ID,
      description: "Send a message with your character's current emotive portrait",
      icon: "<i class='fas fa-theater-masks'></i>",
    });
  });
}

async function handleEmotiveChatMessage(messageText: string): Promise<void> {
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
  const content = await renderTemplate(
    `modules/${CONSTANTS.MODULE_ID}/templates/emotive-chat-message.hbs`,
    {
      portrait,
      name: speaker.name,
      message: messageText
    }
  );

  // Create chat message data
  const chatData: any = {
    user: game.user?.id,
    content: content,
    flags: {
      [CONSTANTS.MODULE_ID]: {
        isEmotiveMessage: true
      }
    }
  };

  await ChatMessage.create(chatData);
}
