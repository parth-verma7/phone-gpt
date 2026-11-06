import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { buildChatArchive, type ExportChat } from './chatExport';

export async function exportChatsToDevice(chats: readonly ExportChat[]) {
  if (!chats.length) throw new Error('Select at least one conversation.');
  if (Platform.OS !== 'android' && Platform.OS !== 'web') throw new Error('Chat export is currently available on Android and the web preview.');
  const fileName = `PhoneGPT-chats-${Date.now()}.zip`;
  // Ask for a destination before preparing potentially large archives. Cancellation writes nothing.
  const folder = Platform.OS === 'android' ? await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync() : undefined;
  if (folder && !folder.granted) return { status: 'cancelled' as const };
  const archive = await buildChatArchive(chats, async file => {
    const info = await FileSystem.getInfoAsync(file.uri);
    if (!info.exists || info.isDirectory || info.size > 32 * 1024) throw new Error('Attachment unavailable.');
    return FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
  });
  if (Platform.OS === 'web') {
    const blob = new Blob([new Uint8Array(archive.bytes)], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = fileName;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { status: 'started' as const, fileName, count: archive.count, warnings: archive.warnings };
  }
  if (!folder?.granted) return { status: 'cancelled' as const };
  const uri = await FileSystem.StorageAccessFramework.createFileAsync(folder.directoryUri, fileName, 'application/zip');
  try {
    await FileSystem.writeAsStringAsync(uri, Buffer.from(archive.bytes).toString('base64'), { encoding: FileSystem.EncodingType.Base64 });
  } catch (error) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    throw error;
  }
  return { status: 'saved' as const, fileName, count: archive.count, warnings: archive.warnings };
}
