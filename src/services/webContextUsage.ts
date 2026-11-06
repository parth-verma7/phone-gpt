/** Token estimates for one grounded request, scoped to the model/window used. */
export type WebContextUsage = {
  modelId: string;
  contextSize: number;
  inputTokens: number;
  evidenceTokens: number;
  outputTokens: number;
};
export type WebTurnUsage = { chatId: string; userId: string; usage: WebContextUsage };

export function resolveWebUsage(
  chat: { id: string; messages: { id: string; contextUsage?: WebContextUsage }[] } | null,
  turn: WebTurnUsage | null,
  modelId: string,
  contextSize: number,
) {
  const last = chat?.messages.at(-1);
  const candidate = turn?.chatId === chat?.id && turn?.userId === last?.id ? turn?.usage : last?.contextUsage;
  return matchingWebUsage(candidate, modelId, contextSize);
}

export function matchingWebUsage(value: WebContextUsage | undefined, modelId: string, contextSize: number): WebContextUsage | undefined {
  if (!value || value.modelId !== modelId || value.contextSize !== contextSize) return undefined;
  if (![value.inputTokens, value.evidenceTokens, value.outputTokens].every(n => Number.isSafeInteger(n) && n >= 0) || value.evidenceTokens > value.inputTokens) return undefined;
  return value;
}

export function webUsageTotal(usage: WebContextUsage): number {
  return usage.inputTokens + usage.outputTokens;
}
