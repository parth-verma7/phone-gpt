import * as FileSystem from 'expo-file-system/legacy';
import type { DocumentPickerAsset } from 'expo-document-picker';

export type TextAttachment = { name: string; uri: string; size: number };
export const MAX_TEXT_FILE_BYTES = 32 * 1024;

type FileMessage = { id?: string; role: 'user' | 'assistant'; content: string; attachments?: TextAttachment[] };

function validateText(text: string) {
  const decoded = text.replace(/^\uFEFF/, '');
  if (!decoded.trim()) throw new Error('This text file is empty.');
  if (decoded.includes('\0') || decoded.includes('\uFFFD')) {
    throw new Error('Choose a plain UTF-8 .txt file. This file uses an unsupported encoding or contains binary data.');
  }
  return decoded;
}

async function fileText(file: TextAttachment) {
  const info = await FileSystem.getInfoAsync(file.uri);
  if (!info.exists) throw new Error(`The attached file "${file.name}" is no longer available. Please attach it again.`);
  if (info.size > MAX_TEXT_FILE_BYTES) throw new Error('Choose a text file up to 32 KB.');
  return validateText(await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 }));
}

export async function readTextAttachment(asset: DocumentPickerAsset): Promise<TextAttachment> {
  if (!asset.name.toLowerCase().endsWith('.txt')) throw new Error('Only .txt files are supported for now.');
  const info = await FileSystem.getInfoAsync(asset.uri);
  if (!info.exists) throw new Error('The selected file could not be read. Please select it again.');
  const file = { name: asset.name.replace(/[\r\n]/g, ' '), uri: asset.uri, size: info.size };
  // Validate now, but retain only the file reference in composer state.
  await fileText(file);
  return file;
}

async function destination(chatId: string, messageId: string, index: number) {
  if (!/^[a-z0-9-]+$/i.test(chatId) || !/^[a-z0-9-]+$/i.test(messageId)) throw new Error('Invalid chat attachment path.');
  if (!FileSystem.documentDirectory) throw new Error('Local attachment storage is unavailable.');
  const directory = `${FileSystem.documentDirectory}chats/${chatId}/attachments/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return `${directory}${messageId}-${index}.txt`;
}

/** Copy the original file bytes out of the picker cache before saving the chat. */
export async function persistTextAttachment(file: TextAttachment, chatId: string, messageId: string, index = 0): Promise<TextAttachment> {
  const uri = await destination(chatId, messageId, index);
  if (uri !== file.uri) await FileSystem.copyAsync({ from: file.uri, to: uri });
  return { name: file.name, uri, size: file.size };
}

/** Upgrade older chat JSON once: move inline text into real .txt files. */
export async function migrateChatAttachments<T extends { id: string; messages: FileMessage[] }>(chat: T): Promise<T> {
  const messages = await Promise.all(chat.messages.map(async (message, messageIndex) => {
    if (!message.attachments?.length) return message;
    const attachments = await Promise.all(message.attachments.map(async (file, index) => {
      const legacy = file as TextAttachment & { text?: string };
      if (typeof legacy.text !== 'string') return file;
      const uri = await destination(chat.id, message.id ?? `legacy-${messageIndex}`, index);
      await FileSystem.writeAsStringAsync(uri, legacy.text, { encoding: FileSystem.EncodingType.UTF8 });
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error('Could not restore a saved attachment.');
      return { name: file.name, uri, size: info.size };
    }));
    return { ...message, attachments };
  }));
  return { ...chat, messages };
}

/** Read original files only while preparing model input; never save the expanded prompt. */
export async function messageForInference(message: FileMessage) {
  const blocks = await Promise.all((message.attachments ?? []).map(async (file) => {
    // Preserve old history if a storage failure deferred its one-time migration.
    const legacy = file as TextAttachment & { text?: string };
    const text = typeof legacy.text === 'string' ? legacy.text : await fileText(file);
    return `--- File attached: ${file.name} ---\n${text}\n--- End of file ---`;
  }));
  return { role: message.role, content: [message.content, ...blocks].filter(Boolean).join('\n\n') };
}

export async function messagesForInference(messages: FileMessage[]) {
  return Promise.all(messages.map(messageForInference));
}
