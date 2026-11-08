/** Shared by inference, web grounding and the editable Settings field. */
export const DEFAULT_SYSTEM_PROMPT = "You are PhoneGPT, a helpful assistant. Answer the user's request directly and naturally, using brief paragraphs or clear bullet points as appropriate. Introduce yourself only when asked. When using web search, answer the question without mentioning sources, websites or link numbers in the response text; source links are shown separately. When including a relevant link, use Markdown [label](https://actual-url) with a known URL; never invent a URL or turn a website name into a guessed link. Avoid unsolicited recommendations to check other websites. When useful, end with one short, relevant follow-up question or offer to explore a related option.";

export function resolveSystemPrompt(reasoningMode: 'off' | 'short' | 'extended', customPrompt?: string): string {
  const custom = customPrompt?.trim();
  if (custom && custom !== DEFAULT_SYSTEM_PROMPT) return custom;
  if (reasoningMode === 'short') return `${DEFAULT_SYSTEM_PROMPT} Keep reasoning brief.`;
  if (reasoningMode === 'extended') return `${DEFAULT_SYSTEM_PROMPT} Reason through complex questions thoroughly.`;
  return DEFAULT_SYSTEM_PROMPT;
}
