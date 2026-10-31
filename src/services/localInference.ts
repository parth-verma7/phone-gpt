import { Platform } from 'react-native';
import type { LlamaContext } from 'llama.rn';
import type { ModelDefinition } from './models';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ReasoningMode = 'off' | 'short' | 'extended';
export type ContextSize = 1024 | 2048 | 4096;
export type InferenceSettings = {
  reasoningMode: ReasoningMode;
  maxTokens: 192 | 384 | 512 | 768;
  contextSize: ContextSize;
};

export const DEFAULT_INFERENCE_SETTINGS: InferenceSettings = {
  reasoningMode: 'off',
  maxTokens: 384,
  contextSize: 2048,
};

type LocalContext = Pick<LlamaContext, 'completion' | 'release' | 'tokenize' | 'stopCompletion'>;

let context: LocalContext | null = null;
let loadedModelPath: string | null = null;
let loadedContextSize: ContextSize | null = null;

const STOP_WORDS = ['</s>', '<|end|>', '<|eot_id|>', '<|end_of_text|>', '<|im_end|>', '<|EOT|>', '<|END_OF_TURN_TOKEN|>', '<|end_of_turn|>', '<|endoftext|>'];

function systemPrompt(reasoningMode: ReasoningMode) {
  const base = 'You are Parth, a helpful and concise assistant. Use relevant facts from earlier messages in this same conversation when answering.';
  if (reasoningMode === 'short') return `${base} Keep reasoning brief.`;
  if (reasoningMode === 'extended') return `${base} Reason through complex questions thoroughly.`;
  return base;
}

function effectiveSystemPrompt(settings: InferenceSettings, customPrompt?: string) {
  return customPrompt?.trim() || systemPrompt(settings.reasoningMode);
}

function conversationText(messages: ChatMessage[]) {
  return messages.map((message) => `${message.role}: ${message.content}`).join('\n');
}

/** Counts only the current conversation for the visible tracker. */
export async function getContextTokenCount(messages: ChatMessage[]) {
  const text = conversationText(messages);
  if (!text) return 0;
  if (!context) return Math.ceil(text.length / 4);
  const result = await context.tokenize(text);
  return result.tokens.length;
}

/** Include the hidden prompt when checking the model's input budget. */
export async function getInputTokenCount(messages: ChatMessage[], settings: InferenceSettings, customPrompt?: string) {
  const text = `system: ${effectiveSystemPrompt(settings, customPrompt)}\n${conversationText(messages)}`;
  if (!context) return Math.ceil(text.length / 4);
  return (await context.tokenize(text)).tokens.length;
}

export async function loadLocalModel(
  model: ModelDefinition,
  path: string,
  contextSize: ContextSize,
  onProgress?: (progress: number) => void,
) {
  if (Platform.OS === 'web') throw new Error('Local model inference requires the native Android PhoneGPT app.');
  if (context && loadedModelPath === path && loadedContextSize === contextSize) return;

  await unloadLocalModel();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initLlama } = require('llama.rn') as typeof import('llama.rn');
  context = await initLlama(
    {
      model: path,
      n_ctx: contextSize,
      n_threads: 4,
      n_gpu_layers: 0,
      use_mlock: true,
    },
    // llama.rn reports a percentage (0–100); app progress uses a fraction (0–1).
    (percent) => {
      if (Number.isFinite(percent)) onProgress?.(Math.max(0, Math.min(100, percent)) / 100);
    },
  );
  loadedModelPath = path;
  loadedContextSize = contextSize;
}

export class GenerationStoppedError extends Error {
  constructor(public readonly partialText: string) {
    super('Generation stopped.');
    this.name = 'GenerationStoppedError';
  }
}

export async function generateLocalReply(
  messages: ChatMessage[],
  settings: InferenceSettings = DEFAULT_INFERENCE_SETTINGS,
  customPrompt?: string,
  onProgress?: (fullText: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (!context) throw new Error('Load a model before sending a message.');
  if (signal?.aborted) throw new GenerationStoppedError('');
  const activeContext = context;
  const thinkingEnabled = settings.reasoningMode !== 'off';
  let streamedText = '';
  let settled = false;
  let stopTask: Promise<void> | undefined;
  let stopTimer: ReturnType<typeof setInterval> | undefined;
  const requestStop = () => {
    if (settled || stopTask) return;
    stopTask = Promise.resolve().then(() => activeContext.stopCompletion()).catch(() => undefined).finally(() => { stopTask = undefined; });
  };
  const abort = () => {
    requestStop();
    // completion() formats chat asynchronously before starting native work.
    // Retry the stop across that boundary, without overlapping stop requests.
    stopTimer ??= setInterval(requestStop, 100);
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const result = await activeContext.completion({
      messages: [
        {
          role: 'system',
          content: effectiveSystemPrompt(settings, customPrompt),
        },
        ...messages,
      ],
      // Qwen's GGUF chat template receives this directly. Passing it both ways
      // covers templates that read the value from Jinja kwargs.
      enable_thinking: thinkingEnabled,
      // Parsing only affects content/reasoning_content metadata. Native token
      // deltas and result.text retain raw output regardless of the parser.
      reasoning_format: 'auto',
      // These controls depend on the template exposing thinking support/tags.
      // Reserve part of n_predict for the answer, even with a small token limit.
      thinking_budget_tokens: settings.reasoningMode === 'short'
        ? Math.min(128, Math.floor(settings.maxTokens / 3))
        : settings.reasoningMode === 'extended'
          ? Math.min(512, Math.floor(settings.maxTokens * 2 / 3))
          : 0,
      chat_template_kwargs: { enable_thinking: thinkingEnabled },
      n_predict: settings.maxTokens,
      temperature: 0.7,
      top_p: 0.9,
      stop: STOP_WORDS,
    }, ({ token }) => {
      if (signal?.aborted) { requestStop(); return; }
      // token is a raw delta. accumulated_text includes parser prefill, so using
      // it here could duplicate text that was already part of the prompt.
      streamedText += token;
      onProgress?.(streamedText);
    });
    if (signal?.aborted) throw new GenerationStoppedError(streamedText);
    // Replace the stream with the authoritative raw result; never append it or
    // merge parsed fields, which can duplicate text or discard reasoning.
    const fullText = result.text || streamedText;
    if (fullText !== streamedText) onProgress?.(fullText);
    return fullText || 'I could not generate a response. Please try again.';
  } catch (error) {
    if (signal?.aborted) throw new GenerationStoppedError(streamedText);
    throw error;
  } finally {
    settled = true;
    signal?.removeEventListener('abort', abort);
    if (stopTimer) clearInterval(stopTimer);
    // Drain a pending stop before allowing the next request to use this context.
    await stopTask;
  }
}

export async function unloadLocalModel() {
  if (context) await context.release();
  context = null;
  loadedModelPath = null;
  loadedContextSize = null;
}
