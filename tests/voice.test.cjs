const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const catalog = require('../src/data/voiceModels.json');
function load(file, dependencies, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => { if (!(name in dependencies)) throw Error(name); return dependencies[name]; }, ...globals });
  return exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; }
function harness({ permission = async () => {}, transcription, contextInit, mode = 'recording', snapshots = [], missingSnapshot = false } = {}) {
  const slots = []; let cursor = 0, pendingEffects = [], key = 'chat-one', now = 1000, timerId = 0;
  const listeners = new Set(), timers = new Map();
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useCallback(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) { pendingEffects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); } },
  };
  const calls = { inits: 0, liveIds: [], start: 0, stop: 0, cancel: 0, release: 0, abort: 0, texts: [], removed: [], alerts: [], options: null, subscriptions: [], unsubscribed: 0 };
  const context = { release: async () => calls.release++, transcribe(uri, options) { calls.options = options; return { stop: async () => calls.abort++, promise: transcription?.promise ?? Promise.resolve({ result: ' Hello world. ', isAborted: false }) }; } };
  const recorder = { start: async () => { calls.start++; return 'file:///cache/voice/recording.wav'; }, stop: async () => { calls.stop++; return 'file:///cache/voice/recording.wav'; }, cancel: async () => { calls.cancel++; return true; } };
  if (!missingSnapshot) recorder.snapshot = async () => snapshots.shift() ?? { uri: null, sampleCount: 0, endSample: 0, hasSpeech: false };
  const globals = {
    Date: class extends Date { static now() { return now; } },
    setInterval(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearInterval(id) { timers.delete(id); },
  };
  const live = load('src/services/liveTranscription.ts', { '../config/voice': { LIVE_TRANSCRIPTION_INTERVAL_MS: 1000 } }, globals);
  const hook = load('src/hooks/useVoiceTyping.ts', {
    react,
    '@react-native-async-storage/async-storage': { default: { getItem: async () => catalog[0].id, setItem: async () => {}, removeItem: async () => {} } },
    'expo-file-system/legacy': { deleteAsync: async uri => calls.removed.push(uri) },
    'react-native': {
      Alert: { alert: (...a) => calls.alerts.push(a) },
      AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
      DeviceEventEmitter: { addListener(name, listener) {
        calls.subscriptions.push(name); listeners.add(listener);
        return { remove() { if (listeners.delete(listener)) calls.unsubscribed++; } };
      } },
    },
    '../services/models': { getInstalledModelPath: async () => '/model.bin', getModelDownloadState: async () => ({ status: 'completed' }) },
    '../services/voice': { voiceModels: catalog, createVoiceContext: async () => { calls.inits++; return contextInit ? contextInit.promise : context; }, getVoiceRecorder: () => recorder, requestMicrophonePermission: permission },
    '../config/voice': { VOICE_TRANSCRIPTION_MODE: mode },
    '../services/liveTranscription': live,
  }, globals).useVoiceTyping;
  function render(nextKey = key) { key = nextKey; cursor = 0; const result = hook(key, (text, liveId) => { calls.texts.push(text); calls.liveIds.push(liveId); }); const effects = pendingEffects; pendingEffects = []; effects.forEach(fn => fn()); return result; }
  return {
    render, calls, context, listeners, timers,
    emit(event) { for (const listener of listeners) listener(event); },
    advance(ms) { now += ms; for (const timer of [...timers.values()]) timer.fn(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}
test('append preserves typed draft, joins with one space and ignores empty transcription', () => {
  const { appendTranscript } = load('src/services/voice.ts', { 'react-native': {}, '../data/voiceModels.json': catalog });
  assert.equal(appendTranscript('Typed draft  ', ' spoken text '), 'Typed draft spoken text');
  assert.equal(appendTranscript('', ' hello '), 'hello');
  assert.equal(appendTranscript('Keep this', '  '), 'Keep this');
});
test('four English models use distinct IDs/files and sufficient storage allowances', () => {
  assert.equal(catalog.length, 4);
  assert.equal(new Set(catalog.map(m => m.id)).size, 4);
  assert.equal(new Set(catalog.map(m => m.fileName)).size, 4);
  for (const m of catalog) { assert.equal(m.language, 'en'); assert(m.minFreeBytes > m.sizeBytes); assert(m.downloadUrl.endsWith(m.fileName)); }
});
test('record, stop, transcribe English locally, append once, release and delete recording', async () => {
  const h = harness(); h.render(); await tick(); let voice = h.render();
  await voice.start(); voice = h.render(); assert.equal(voice.status, 'recording');
  await voice.stop(); voice = h.render();
  assert.equal(voice.status, 'idle'); assert.equal(h.calls.start, 1); assert.equal(h.calls.stop, 1);
  assert.deepEqual(h.calls.texts, ['Hello world.']); assert.equal(h.calls.options.language, 'en'); assert.equal(h.calls.options.translate, false);
  assert.equal(h.calls.release, 1); assert.equal(h.calls.removed.length, 1);
});
test('denied microphone permission preserves draft and never starts recording', async () => {
  const h = harness({ permission: async () => { throw Error('Permission denied'); } }); h.render(); await tick();
  await h.render().start(); assert.equal(h.calls.start, 0); assert.equal(h.calls.texts.length, 0); assert.equal(h.calls.alerts.length, 1); assert.equal(h.render().status, 'idle');
});
test('cancel recording discards audio; duplicate start is blocked', async () => {
  const h = harness(); h.render(); await tick(); let voice = h.render();
  await Promise.all([voice.start(), voice.start()]); assert.equal(h.calls.start, 1);
  await h.render().cancel(); assert.equal(h.render().status, 'idle'); assert.equal(h.calls.texts.length, 0); assert.equal(h.calls.removed.length, 1);
});
test('switching chats aborts transcription and never inserts text into another draft', async () => {
  const transcription = deferred(); const h = harness({ transcription }); h.render(); await tick();
  await h.render().start(); const stopping = h.render().stop(); await tick();
  h.render('another-chat'); await tick(); transcription.resolve({ result: 'Must not insert', isAborted: false }); await stopping;
  assert.equal(h.calls.abort, 1); assert.equal(h.calls.texts.length, 0); assert.equal(h.calls.release, 1); assert.equal(h.calls.removed.length, 1);
});

test('microphone meter subscribes only while recording, clamps levels and ignores invalid samples', async () => {
  const h = harness(); h.render(); await tick();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.render().audioLevel, 0);
  await h.render().start(); h.render();
  assert.deepEqual(h.calls.subscriptions, ['PhoneGptAudioLevel']);
  for (const [level, expected] of [[0.45, 0.45], [2, 1], [-1, 0], [0.7, 0.7]]) {
    h.emit({ level }); assert.equal(h.render().audioLevel, expected);
  }
  for (const event of [undefined, null, {}, { level: '0.2' }, { level: NaN }, { level: Infinity }, { level: -Infinity }]) {
    h.emit(event); assert.equal(h.render().audioLevel, 0.7);
  }
  await h.render().cancel(); h.render();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.calls.unsubscribed, 1);
  assert.equal(h.timers.size, 0);
  assert.equal(h.render().audioLevel, 0);
});

test('microphone meter clears stale samples and invalid samples do not extend freshness', async () => {
  const h = harness(); h.render(); await tick(); await h.render().start(); h.render();
  h.emit({ level: 0.8 });
  h.advance(350); assert.equal(h.render().audioLevel, 0.8);
  h.emit({ level: NaN });
  h.advance(1); assert.equal(h.render().audioLevel, 0);
  h.emit({ level: 0.4 }); assert.equal(h.render().audioLevel, 0.4);
  h.advance(351); assert.equal(h.render().audioLevel, 0);
  await h.render().cancel(); h.render();
});

test('queued meter callbacks cannot update levels after stopping and subscription is removed', async () => {
  const transcription = deferred(); const h = harness({ transcription });
  h.render(); await tick(); await h.render().start(); h.render();
  h.emit({ level: 0.6 });
  const queued = [...h.listeners][0];
  const stopping = h.render().stop();
  queued({ level: 1 });
  assert.equal(h.render().audioLevel, 0.6);
  assert.equal(h.render().audioLevel, 0);
  assert.equal(h.listeners.size, 0); assert.equal(h.calls.unsubscribed, 1);
  assert.equal(h.timers.size, 0);
  await tick(); transcription.resolve({ result: '', isAborted: true }); await stopping;
});

test('unmount removes meter subscription and timers; another recording gets a fresh subscription', async () => {
  const h = harness(); h.render(); await tick(); await h.render().start(); h.render();
  h.emit({ level: 1 }); await h.render().cancel(); h.render();
  await h.render().start(); h.render();
  assert.equal(h.render().audioLevel, 0);
  assert.equal(h.listeners.size, 1); assert.equal(h.calls.subscriptions.length, 2);
  h.unmount(); await tick();
  assert.equal(h.listeners.size, 0); assert.equal(h.calls.unsubscribed, 2);
  assert.equal(h.timers.size, 0); assert.equal(h.calls.cancel, 2);
});

const liveSlice = end => ({ uri: `file:///slice-${end}.wav`, sampleCount: end, endSample: end, hasSpeech: true });
test('live hook loads Whisper before recording and emits drafts every second, reusing context through stop', async () => {
  const h = harness({ mode: 'live', snapshots: [liveSlice(32000), liveSlice(64000)] });
  h.render(); await tick(); await h.render().start(); h.render();
  assert.equal(h.calls.inits, 1); assert.equal(h.calls.start, 1);
  h.advance(2000); await tick(); assert.equal(h.calls.texts.length, 1);
  assert.equal(typeof h.calls.liveIds[0], 'string');
  await h.render().stop(); h.render();
  assert.equal(h.calls.inits, 1); assert.equal(h.calls.release, 1);
  assert.equal(h.calls.texts.length, 2); assert.equal(h.calls.liveIds[0], h.calls.liveIds[1]);
  assert.equal(h.calls.removed.length, 3); assert.equal(h.timers.size, 0);
});
test('live cancel during final flush aborts decoding before releasing context', async () => {
  const transcription = deferred(); const h = harness({ mode: 'live', snapshots: [liveSlice(32000)], transcription });
  h.render(); await tick(); await h.render().start(); h.render();
  const stopping = h.render().stop(); await tick();
  const cancellation = h.render().cancel(); await tick();
  assert.equal(h.calls.abort, 1); assert.equal(h.calls.release, 0);
  transcription.resolve({ result: 'late words', isAborted: true });
  await Promise.all([stopping, cancellation]); h.render();
  assert.equal(h.calls.texts.length, 0); assert.equal(h.calls.release, 1);
  assert.equal(h.render().status, 'idle');
});
test('live chat changes abort inference and never insert into the new chat', async () => {
  const transcription = deferred(); const h = harness({ mode: 'live', snapshots: [liveSlice(32000)], transcription });
  h.render(); await tick(); await h.render().start(); h.render(); h.advance(2000); await tick();
  h.render('another-chat'); await tick(); assert.equal(h.calls.abort, 1);
  transcription.resolve({ result: 'wrong chat', isAborted: false }); await tick(); await tick();
  assert.equal(h.calls.texts.length, 0); assert.equal(h.calls.release, 1);
});
test('live mode explains an outdated native build and does not start recording', async () => {
  const h = harness({ mode: 'live', missingSnapshot: true }); h.render(); await tick(); await h.render().start();
  assert.equal(h.calls.start, 0); assert.equal(h.calls.inits, 0);
  assert.match(h.calls.alerts[0][1], /updated PhoneGPT live transcription APK/);
  assert.equal(h.render().status, 'idle');
});
