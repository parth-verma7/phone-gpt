import { strToU8, zipSync } from 'fflate';
import type { WebContextUsage } from './webContextUsage';
import type { WebSearchProvenance } from './webSearchTypes';

export type ExportChat = {
  id: string; title?: string; createdAt?: number; updatedAt?: number; systemPrompt?: string; origin?: 'dev' | 'production';
  messages: { id: string; role: string; content: string; web?: WebSearchProvenance; contextUsage?: WebContextUsage; attachments?: { name: string; uri: string; size: number }[] }[];
};
export type AttachmentReader = (attachment: { name: string; uri: string; size: number }) => Promise<string>;
const MAX_EXPORT_BYTES = 25 * 1024 * 1024;
function timestamp(value?: number) {
  const date = value && Number.isFinite(value) ? new Date(value) : undefined;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}
function messageTime(id: string) {
  const value = Number(id.match(/^\d{10,13}(?=-|$)/)?.[0]);
  return value > 0 ? timestamp(value) : undefined;
}

/** Portable export: original UUIDs, UTF-8 transcripts, JSON and available attachments. No phone paths. */
export async function buildChatArchive(chats: readonly ExportChat[], readAttachment: AttachmentReader, now = new Date()) {
  if (!chats.length) throw new Error('Select at least one conversation.');
  const files: Record<string, Uint8Array> = Object.create(null);
  const warnings: string[] = [];
  const ids = new Set<string>();
  let bytes = 0;
  const add = (name: string, content: string) => {
    const value = strToU8(content); bytes += value.byteLength;
    if (bytes > MAX_EXPORT_BYTES) throw new Error('This export is too large. Select fewer conversations and export in batches.');
    files[name] = value;
  };
  for (const chat of chats) {
    if (!/^[a-z0-9-]{1,100}$/i.test(chat.id) || ids.has(chat.id)) throw new Error('A conversation has an invalid or duplicate ID. Nothing was exported.');
    ids.add(chat.id);
    const lines = [`PhoneGPT conversation`, `UUID: ${chat.id}`, `Started: ${timestamp(chat.createdAt) ?? 'Unknown'}`, `Updated: ${timestamp(chat.updatedAt) ?? 'Unknown'}`, ''];
    const messages: Record<string, unknown>[] = [];
    for (const message of chat.messages) {
      const attachments: { name: string; path?: string; unavailable?: boolean }[] = [];
      lines.push(`${message.role.toUpperCase()}${messageTime(message.id) ? ` — ${messageTime(message.id)}` : ''}`, message.content, '');
      for (const [index, attachment] of (message.attachments ?? []).entries()) {
        // All archive paths are constructed here; neither user filenames nor URIs become paths.
        const path: string = `attachments/${chat.id}/${messages.length}-${index}.txt`;
        try {
          const text = await readAttachment(attachment);
          add(path, text);
          attachments.push({ name: attachment.name, path });
          lines.push(`Attached file: ${attachment.name} (${path})`, '');
        } catch (error) {
          if (error instanceof Error && error.message.includes('export is too large')) throw error;
          const warning = `${chat.id}: attached file "${attachment.name}" is unavailable.`;
          warnings.push(warning); attachments.push({ name: attachment.name, unavailable: true });
          lines.push(warning, '');
        }
      }
      const web = message.web && Array.isArray(message.web.sources) ? {
        provider: message.web.provider, retrievedAt: message.web.retrievedAt,
        sources: message.web.sources.map(source => ({ id: source.id, title: source.title, url: source.url, snippet: source.snippet, ...(source.publishedAt ? { publishedAt: source.publishedAt } : {}) })),
      } : undefined;
      if (web) lines.push('Web sources:', ...web.sources.map(source => `[${source.id}] ${source.title}\n${source.url}`), `Retrieved: ${web.retrievedAt}`, '');
      messages.push({ id: message.id, role: message.role, content: message.content, ...(messageTime(message.id) ? { createdAt: messageTime(message.id) } : {}), ...(attachments.length ? { attachments } : {}), ...(web ? { web } : {}), ...(message.contextUsage ? { contextUsage: { modelId: message.contextUsage.modelId, contextSize: message.contextUsage.contextSize, inputTokens: message.contextUsage.inputTokens, evidenceTokens: message.contextUsage.evidenceTokens, outputTokens: message.contextUsage.outputTokens } } : {}) });
    }
    add(`chats/${chat.id}.txt`, lines.join('\n'));
    add(`chats/${chat.id}.json`, JSON.stringify({ schemaVersion: 1, id: chat.id, title: chat.title, createdAt: chat.createdAt, updatedAt: chat.updatedAt, origin: chat.origin, systemPrompt: chat.systemPrompt, messages }, null, 2));
  }
  add('manifest.json', JSON.stringify({ schemaVersion: 1, application: 'PhoneGPT', exportedAt: now.toISOString(), conversationIds: [...ids], warnings }, null, 2));
  add('README.txt', 'PhoneGPT chat export\n\nEach conversation has a readable .txt file and structured .json file in chats/, named by its UUID. Available attached text files are in attachments/. Missing attachments are listed in manifest.json.\n\nThis archive is unencrypted and may include private chats, custom system prompts and attached text. Keep it somewhere you trust. This exports chats only, not model files or application settings. Importing this archive is not implemented yet.\n');
  return { bytes: zipSync(files, { level: 1 }), warnings, count: chats.length };
}
