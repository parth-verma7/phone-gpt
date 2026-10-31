import * as FileSystem from 'expo-file-system/legacy';
import { NativeModules, Platform } from 'react-native';
import modelCatalog from '../data/models.json';

export type ModelDefinition = (typeof modelCatalog)[number];
export type DownloadableModel = Pick<ModelDefinition, 'id' | 'downloadUrl' | 'fileName' | 'sizeBytes' | 'minFreeBytes'>;

const MODELS_DIRECTORY = `${FileSystem.documentDirectory}models/`;
const activeDownloads = new Map<string, FileSystem.DownloadResumable>();
const cancelledDownloads = new Set<string>();

export type ModelDownloadState = {
  status: 'none' | 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  uri?: string;
  error?: string;
  canPause?: boolean;
  pauseReason?: 'manual' | 'network' | 'retry';
};

type BackgroundDownloads = {
  pause?: (modelId: string) => Promise<ModelDownloadState>;
  resume?: (modelId: string) => Promise<ModelDownloadState>;
  enqueue: (modelId: string, url: string, fileName: string) => Promise<ModelDownloadState>;
  getState: (modelId: string) => Promise<ModelDownloadState>;
  cancel: (modelId: string) => Promise<boolean>;
  delete: (modelId: string) => Promise<void>;
};

function backgroundDownloads(): BackgroundDownloads | undefined {
  return Platform.OS === 'android' ? NativeModules.PhoneGptDownloads : undefined;
}

/** Query persisted OS downloads, including those started by a previous app process. */
export async function getModelDownloadState(model: DownloadableModel): Promise<ModelDownloadState> {
  const native = backgroundDownloads();
  if (native) return native.getState(model.id);
  return {
    status: activeDownloads.has(model.id) ? 'running' : 'none',
    progress: 0,
  };
}

export async function pauseModelDownload(model: DownloadableModel) {
  const native = backgroundDownloads();
  if (!native?.pause) throw new Error('Install the updated Dev APK to enable Pause and Resume.');
  return native.pause(model.id);
}

export async function resumeModelDownload(model: DownloadableModel) {
  const native = backgroundDownloads();
  if (!native?.resume) throw new Error('Install the updated Dev APK to enable Pause and Resume.');
  return native.resume(model.id);
}

export class ModelDownloadCancelledError extends Error {
  constructor() {
    super('Model download cancelled.');
    this.name = 'ModelDownloadCancelledError';
  }
}

export const models = modelCatalog as ModelDefinition[];

export function modelPath(model: DownloadableModel) {
  return `${MODELS_DIRECTORY}${model.fileName}`;
}

export async function getInstalledModelPath(model: DownloadableModel) {
  if (Platform.OS === 'web') return null;
  const native = backgroundDownloads();
  if (native) {
    const state = await native.getState(model.id);
    if (state.status === 'completed' && state.uri) return state.uri;
    // A recorded transfer is authoritative: never substitute a stale legacy
    // file while this model is incomplete, failed, or still downloading.
    if (state.status !== 'none') return null;
  }
  const path = modelPath(model);
  const file = await FileSystem.getInfoAsync(path);
  // Earlier builds wrote partial transfers straight to the final filename.
  // Do not mistake these abandoned files for usable models after a restart.
  return file.exists && (file.size ?? 0) >= model.sizeBytes * 0.8 ? path : null;
}

export async function deleteInstalledModel(model: DownloadableModel) {
  await backgroundDownloads()?.delete(model.id);
  await FileSystem.deleteAsync(modelPath(model), { idempotent: true });
}

export async function cancelModelDownload(model: DownloadableModel) {
  const native = backgroundDownloads();
  if (native) {
    cancelledDownloads.add(model.id);
    try {
      const cancelled = await native.cancel(model.id);
      if (!cancelled) cancelledDownloads.delete(model.id);
      return cancelled;
    } catch (error) {
      cancelledDownloads.delete(model.id);
      throw error;
    }
  }
  const task = activeDownloads.get(model.id);
  if (!task) return false;
  cancelledDownloads.add(model.id);
  try {
    await task.pauseAsync();
  } catch {
    // The native request may have finished just as the user tapped cancel.
  }
  await FileSystem.deleteAsync(modelPath(model), { idempotent: true });
  return true;
}

export async function downloadModel(
  model: DownloadableModel,
  onProgress: (progress: number) => void,
  onState?: (state: ModelDownloadState) => void,
) {
  const native = backgroundDownloads();
  if (Platform.OS === 'android' && !native) {
    throw new Error('Install the updated native PhoneGPT app to enable background model downloads.');
  }
  if (native) {
    cancelledDownloads.delete(model.id);
    // Reattach to an existing task without resetting it or requiring the full
    // download size to be available a second time.
    let state = await native.getState(model.id);
    if (state.status === 'none' || state.status === 'failed') {
      const freeBytes = await FileSystem.getFreeDiskStorageAsync();
      if (freeBytes < model.minFreeBytes) {
        throw new Error(`Free up at least ${formatBytes(model.minFreeBytes)} before downloading this model.`);
      }
      state = await native.enqueue(model.id, model.downloadUrl, model.fileName);
    }
    try {
      for (;;) {
        if (cancelledDownloads.has(model.id)) throw new ModelDownloadCancelledError();
        const progress = Number.isFinite(state.progress) ? Math.max(0, Math.min(1, state.progress)) : 0;
        onProgress(progress);
        onState?.({ ...state, progress });
        if (state.status === 'completed' && state.uri) return state.uri;
        if (state.status === 'failed') throw new Error(state.error || 'The model download failed. Please retry.');
        if (state.status === 'none') throw new ModelDownloadCancelledError();
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
        state = await native.getState(model.id);
      }
    } finally {
      cancelledDownloads.delete(model.id);
    }
  }
  const freeBytes = await FileSystem.getFreeDiskStorageAsync();
  if (freeBytes < model.minFreeBytes) {
    throw new Error(`Free up at least ${formatBytes(model.minFreeBytes)} before downloading this model.`);
  }

  await FileSystem.makeDirectoryAsync(MODELS_DIRECTORY, { intermediates: true });
  const destination = modelPath(model);
  await FileSystem.deleteAsync(destination, { idempotent: true });

  const task = FileSystem.createDownloadResumable(
    model.downloadUrl,
    destination,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite > 0) onProgress(totalBytesWritten / totalBytesExpectedToWrite);
    },
  );
  activeDownloads.set(model.id, task);
  try {
    const result = await task.downloadAsync();
    if (cancelledDownloads.has(model.id)) throw new ModelDownloadCancelledError();
    if (!result?.uri) throw new Error('The model download did not complete.');
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`The model host returned HTTP ${result.status}. Please retry or choose another model.`);
    }
    const downloadedFile = await FileSystem.getInfoAsync(result.uri);
    if (!downloadedFile.exists || (downloadedFile.size ?? 0) < model.sizeBytes * 0.8) {
      throw new Error('The downloaded model appears incomplete. Please try again.');
    }
    return result.uri;
  } catch (error) {
    // A failed legacy transfer must not leave a partial file looking installed.
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
    if (cancelledDownloads.has(model.id)) throw new ModelDownloadCancelledError();
    throw error;
  } finally {
    activeDownloads.delete(model.id);
    cancelledDownloads.delete(model.id);
  }
}

export function formatBytes(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(0)} MB`;
}
