import { plainChatPreview } from './chatPreview';

type HistoryChat = {
  id: string;
  origin?: 'dev' | 'production';
  createdAt?: number;
  updatedAt?: number;
  messages: { id: string; role: string; content: string; attachments?: { name: string }[] }[];
};

function validTimestamp(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0 && !Number.isNaN(new Date(value).getTime()) ? value : undefined;
}

/** Older messages encode their send time in IDs such as "1792770000000-user". */
export function restoreChatMetadata<T extends HistoryChat>(chat: T) {
  const times = chat.messages.map((message) => validTimestamp(Number(message.id.match(/^\d{10,}/)?.[0]))).filter((time): time is number => time !== undefined);
  const legacyTime = /^\d+$/.test(chat.id) ? validTimestamp(Number(chat.id)) : undefined;
  const createdAt = validTimestamp(chat.createdAt) ?? times[0] ?? legacyTime;
  const updatedAt = validTimestamp(chat.updatedAt) ?? times[times.length - 1] ?? createdAt;
  return { ...chat, createdAt, updatedAt };
}

/** Human-readable titles come from the first user turn; UUIDs remain storage keys. */
export function conversationTitle(chat: Pick<HistoryChat, 'messages'>, limit = 48): string {
  const first = chat.messages.find(message => message.role === 'user');
  const text = plainChatPreview(first?.content.trim() || first?.attachments?.[0]?.name || 'New chat');
  const characters = Array.from(text);
  return characters.slice(0, limit).join('') + (characters.length > limit ? '…' : '');
}

export function chatHistoryLabels(chat: HistoryChat) {
  const title = conversationTitle(chat);
  const timestamp = validTimestamp(chat.createdAt);
  const date = timestamp ? new Date(timestamp) : null;
  return {
    title: chat.origin === 'dev' ? `Dev - ${title}` : title,
    date: date?.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) ?? '—',
    time: date?.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) ?? '—',
  };
}
