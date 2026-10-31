const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const tick = () => new Promise(resolve => setImmediate(resolve));
async function harness({ delayedStart = false, rejectOnStop = false } = {}) {
  let callback, current, active = false, timer;
  const calls = { completions: 0, stops: 0, timerCleared: 0 };
  const context = {
    completion(params, onToken) { calls.completions++; callback = onToken; current = deferred(); active = !delayedStart; return current.promise; },
    stopCompletion: async () => { calls.stops++; if (active) { active = false; rejectOnStop ? current.reject(Error('native interrupted')) : current.resolve({ text: 'ignored late result' }); } },
    release: async () => {}, tokenize: async () => ({ tokens: [] }),
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/services/localInference.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name === 'react-native') return { Platform: { OS: 'android' } };
    if (name === 'llama.rn') return { initLlama: async () => context };
    throw Error(name);
  }, setInterval: fn => { timer = fn; return 1; }, clearInterval: () => { timer = undefined; calls.timerCleared++; } });
  await exports.loadLocalModel({ id: 'test' }, 'model.gguf', 2048);
  return { api: exports, calls, token: token => callback({ token }), startNative: () => { active = true; }, timer: () => timer?.(), finish: text => current.resolve({ text }) };
}

test('stop preserves streamed text and drops late tokens without inventing a reply', async () => {
  const h = await harness(); const controller = new AbortController(); const chunks = [];
  const generation = h.api.generateLocalReply([{ role: 'user', content: 'Explain' }], undefined, undefined, text => chunks.push(text), controller.signal);
  const stopped = assert.rejects(generation, error => error.name === 'GenerationStoppedError' && error.partialText === 'Hello');
  h.token('Hello'); controller.abort(); h.token(' late text'); await stopped;
  assert.deepEqual(chunks, ['Hello']); assert.equal(h.calls.stops, 1); assert.equal(h.calls.timerCleared, 1);
});

test('stopping before the first token produces an empty cancellation, not fallback text', async () => {
  const h = await harness(); const controller = new AbortController();
  const generation = h.api.generateLocalReply([], undefined, undefined, undefined, controller.signal);
  const stopped = assert.rejects(generation, error => error.name === 'GenerationStoppedError' && error.partialText === '');
  controller.abort(); await stopped;
});

test('an already stopped request never starts native completion', async () => {
  const h = await harness(); const controller = new AbortController(); controller.abort();
  await assert.rejects(h.api.generateLocalReply([], undefined, undefined, undefined, controller.signal), /stopped/);
  assert.equal(h.calls.completions, 0);
});

test('stop retries across the SDK asynchronous chat-formatting boundary', async () => {
  const h = await harness({ delayedStart: true }); const controller = new AbortController();
  const generation = h.api.generateLocalReply([], undefined, undefined, undefined, controller.signal);
  const stopped = assert.rejects(generation, /stopped/);
  controller.abort(); await tick(); assert.equal(h.calls.stops, 1);
  h.startNative(); h.timer(); await stopped;
  assert.equal(h.calls.stops, 2);
});

test('native interruption rejection is treated as a user stop', async () => {
  const h = await harness({ rejectOnStop: true }); const controller = new AbortController();
  const generation = h.api.generateLocalReply([], undefined, undefined, undefined, controller.signal);
  const stopped = assert.rejects(generation, error => error.name === 'GenerationStoppedError' && error.partialText === 'Partial');
  h.token('Partial'); controller.abort(); await stopped;
});

test('completed request removes stop listener so it cannot stop a later turn', async () => {
  const h = await harness(); const old = new AbortController();
  const first = h.api.generateLocalReply([], undefined, undefined, undefined, old.signal);
  h.token('Done'); h.finish('Done'); assert.equal(await first, 'Done');
  const next = h.api.generateLocalReply([]); old.abort(); await tick();
  assert.equal(h.calls.stops, 0); h.finish('Next'); assert.equal(await next, 'Next');
});
