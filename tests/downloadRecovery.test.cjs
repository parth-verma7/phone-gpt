const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const model = { id: 'test-model', downloadUrl: 'https://example.com/model.gguf', fileName: 'model.gguf', sizeBytes: 1000, minFreeBytes: 2000 };
function harness({ native, platform = 'android', info = { exists: true, size: 1000 }, result = { uri: 'file:///model.gguf', status: 200 }, free = 10000 } = {}) {
  const calls = { disk: 0, files: 0, removed: [], timers: 0 };
  const fileSystem = {
    documentDirectory: 'file:///private/',
    getInfoAsync: async () => { calls.files++; return info; },
    getFreeDiskStorageAsync: async () => { calls.disk++; return free; },
    deleteAsync: async uri => { calls.removed.push(uri); },
    makeDirectoryAsync: async () => {},
    createDownloadResumable: () => ({ downloadAsync: async () => result }),
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/services/models.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name === 'expo-file-system/legacy') return fileSystem;
    if (name === 'react-native') return { Platform: { OS: platform }, NativeModules: { PhoneGptDownloads: native } };
    if (name === '../data/models.json') return [model];
    throw Error(name);
  }, setTimeout: fn => { calls.timers++; queueMicrotask(fn); } });
  return { api: exports, calls };
}

test('paused download reattaches without enqueue or a second free-space requirement', async () => {
  let checks = 0, enqueues = 0;
  const h = harness({ free: 0, native: {
    getState: async () => ++checks === 1 ? { status: 'paused', progress: 0.45 } : { status: 'completed', progress: 1, uri: 'file:///saved.gguf' },
    enqueue: async () => { enqueues++; throw Error('must not enqueue'); },
  } });
  const states = [];
  assert.equal(await h.api.downloadModel(model, () => {}, state => states.push(state.status)), 'file:///saved.gguf');
  assert.deepEqual(states, ['paused', 'completed']);
  assert.equal(enqueues, 0); assert.equal(h.calls.disk, 0);
});

test('failed download retries once and reports the recovered running/completed states', async () => {
  let checks = 0, enqueues = 0;
  const h = harness({ native: {
    getState: async () => ++checks === 1 ? { status: 'failed', progress: 0.2 } : { status: 'completed', progress: 1, uri: 'file:///saved.gguf' },
    enqueue: async () => { enqueues++; return { status: 'running', progress: 0 }; },
  } });
  const states = [];
  await h.api.downloadModel(model, () => {}, state => states.push(state.status));
  assert.equal(enqueues, 1); assert.deepEqual(states, ['running', 'completed']);
});

test('incomplete native transfers never fall back to stale legacy files', async () => {
  for (const status of ['pending', 'running', 'paused', 'failed']) {
    const h = harness({ native: { getState: async () => ({ status, progress: 0.8 }) } });
    assert.equal(await h.api.getInstalledModelPath(model), null);
    assert.equal(h.calls.files, 0);
  }
});

test('old installed files remain discoverable when no native download is recorded', async () => {
  const h = harness({ native: { getState: async () => ({ status: 'none', progress: 0 }) } });
  assert.equal(await h.api.getInstalledModelPath(model), 'file:///private/models/model.gguf');
});

test('low storage produces an actionable error without scheduling a download', async () => {
  let enqueues = 0;
  const h = harness({ free: 10, native: {
    getState: async () => ({ status: 'none', progress: 0 }),
    enqueue: async () => { enqueues++; },
  } });
  await assert.rejects(h.api.downloadModel(model, () => {}), /Free up at least/);
  assert.equal(enqueues, 0);
});

test('failed cancel does not poison the next attachment to a running download', async () => {
  let checks = 0;
  const h = harness({ native: {
    cancel: async () => { throw Error('storage unavailable'); },
    getState: async () => ++checks === 1 ? { status: 'running', progress: 0.5 } : { status: 'completed', progress: 1, uri: 'file:///saved.gguf' },
  } });
  await assert.rejects(h.api.cancelModelDownload(model), /storage unavailable/);
  assert.equal(await h.api.downloadModel(model, () => {}), 'file:///saved.gguf');
});

test('legacy HTTP error removes the destination even if the error body is large', async () => {
  const h = harness({ platform: 'ios', result: { uri: 'file:///model.gguf', status: 403 } });
  await assert.rejects(h.api.downloadModel(model, () => {}), /HTTP 403/);
  assert.equal(h.calls.removed.at(-1), 'file:///private/models/model.gguf');
});

test('legacy incomplete transfer is removed after verification fails', async () => {
  const h = harness({ platform: 'ios', info: { exists: true, size: 20 } });
  await assert.rejects(h.api.downloadModel(model, () => {}), /incomplete/);
  assert.equal(h.calls.removed.at(-1), 'file:///private/models/model.gguf');
});

test('manual pause and resume call native controls without canceling or enqueueing', async () => {
  const calls = [];
  const h = harness({ native: {
    pause: async id => { calls.push(['pause', id]); return { status: 'paused', progress: 0.4, pauseReason: 'manual', canPause: true }; },
    resume: async id => { calls.push(['resume', id]); return { status: 'running', progress: 0.4, canPause: true }; },
  } });
  assert.equal((await h.api.pauseModelDownload(model)).pauseReason, 'manual');
  assert.equal((await h.api.resumeModelDownload(model)).progress, 0.4);
  assert.deepEqual(calls, [['pause', model.id], ['resume', model.id]]);
});

test('manual pause stays paused when reattaching; no implicit resume', async () => {
  let queries = 0;
  const h = harness({ native: {
    getState: async () => ++queries < 3 ? { status: 'paused', progress: 0.4, pauseReason: 'manual', canPause: true } : { status: 'none', progress: 0 },
  } });
  const reasons = [];
  await assert.rejects(h.api.downloadModel(model, () => {}, state => reasons.push(state.pauseReason)), /cancelled/);
  assert.deepEqual(reasons.slice(0, 2), ['manual', 'manual']);
});

test('old native APK gets an actionable upgrade error for pause and resume', async () => {
  const h = harness({ native: {} });
  await assert.rejects(h.api.pauseModelDownload(model), /updated Dev APK/);
  await assert.rejects(h.api.resumeModelDownload(model), /updated Dev APK/);
});
