type Conversation = { id: string; messages: readonly unknown[] };

/** New chat reuses a conversation until it has a transcript, including its draft. */
export function startNewConversation<C extends Conversation, A>(state: {
  currentChat: C | null;
  draftChatId: string;
  message: string;
  attachedText: A | null;
}, createId: () => string): typeof state {
  if (!state.currentChat?.messages.length) return state;
  return { currentChat: null, draftChatId: createId(), message: '', attachedText: null };
}
