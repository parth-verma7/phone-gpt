const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createChatId(): string {
  // IDs identify local conversations; they are not authentication credentials.
  // Hermes may not expose Web Crypto, so retain a dependency-free UUID fallback.
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (letter) => {
    const value = Math.floor(Math.random() * 16);
    return (letter === 'x' ? value : (value & 3) | 8).toString(16);
  });
}

export function ensureChatUuid<T extends { id: string }>(chat: T): T {
  return UUID_V4.test(chat.id) ? chat : { ...chat, id: createChatId() };
}
