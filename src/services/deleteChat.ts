import * as FileSystem from 'expo-file-system/legacy';

/** Remove only this chat's private attachments. The caller owns saved chat state. */
export async function removeChatFiles(chatId: string): Promise<void> {
  // Match textAttachments.ts's destination IDs; never accept paths or encoded paths.
  if (typeof chatId !== 'string' || !chatId || /[^a-z0-9-]/i.test(chatId)) {
    throw new Error('Invalid chat attachment path.');
  }
  if (!FileSystem.documentDirectory) throw new Error('Local attachment storage is unavailable.');
  await FileSystem.deleteAsync(`${FileSystem.documentDirectory}chats/${chatId}/attachments/`, { idempotent: true });
}
