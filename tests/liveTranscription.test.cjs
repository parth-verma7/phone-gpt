const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in dependencies)) throw Error(name); return dependencies[name];
  }, ...globals });
  return exports;
}
const voiceService = load('src/services/voice.ts', { 'react-native': {}, '../data/voiceModels.json': [] });
const voiceConfig = load('src/config/voice.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; }
function harness({ snapshots = [], transcripts = [], held, heldSnapshot, heldCleanup } = {}) {
  let callback, active = false, index = 0;
  const calls = { snapshots: [], transcribes: [], text: [], errors: [], removed: [], aborts: 0 };
  const { LiveTranscription, joinOverlappingTranscript } = load('src/services/liveTranscription.ts', {
    '../config/voice': voiceConfig, './voice': voiceService,
  }, {
    setTimeout(fn, ms) { assert.equal(ms, 200); callback = fn; active = true; return 1; },
    clearTimeout() { active = false; },
  });
  const live = new LiveTranscription({
    context: { transcribe(uri, options) {
      calls.transcribes.push({ uri, options });
      const result = held && calls.transcribes.length === 1 ? held.promise : Promise.resolve({ result: transcripts[index++] ?? 'hello', isAborted: false });
      return { promise: result, stop: async () => { calls.aborts++; held?.resolve({ result: 'aborted', isAborted: true }); } };
    } },
    recorder: { snapshot: async (...args) => {
      calls.snapshots.push(args);
      if (heldSnapshot && calls.snapshots.length === 1) return heldSnapshot.promise;
      return snapshots.shift() ?? { uri: null, sampleCount: 0, endSample: 0, hasSpeech: false };
    } },
    uri: 'recording.wav', onText: text => calls.text.push(text), onError: error => calls.errors.push(error),
    removeFile: async uri => { calls.removed.push(uri); if (heldCleanup && calls.removed.length === 1) await heldCleanup.promise; },
  });
  return { live, calls, joinOverlappingTranscript, timer: () => { if (active) { active = false; callback(); } }, active: () => active };
}
const slice = (end, count = end, hasSpeech = true) => ({ uri: `slice-${end}.wav`, endSample: end, sampleCount: count, hasSpeech });

test('ready audio replaces a provisional phrase immediately and reuses one context', async () => {
  const h = harness({ snapshots: [slice(32000), slice(64000)], transcripts: ['I scream', 'Ice cream please'] });
  h.live.start(); h.timer(); await tick(); h.timer(); await tick();
  assert.deepEqual(h.calls.text, ['I scream', 'Ice cream please']);
  assert.equal(h.calls.transcribes.length, 2);
  assert.equal(h.calls.transcribes[0].options.language, 'en');
  assert.equal(h.calls.transcribes[0].options.temperature, 0);
  assert.equal(h.calls.removed.length, 2);
  await h.live.cancel(); assert.equal(h.active(), false);
});
test('slow inference coalesces timer ticks without parallel work or an audio queue', async () => {
  const held = deferred(); const h = harness({ snapshots: [slice(32000), slice(96000)], held });
  h.live.start(); h.timer(); await tick();
  for (let i = 0; i < 20; i++) h.timer();
  assert.equal(h.calls.snapshots.length, 1); assert.equal(h.calls.transcribes.length, 1);
  held.resolve({ result: 'hello', isAborted: false }); await tick();
  h.timer(); await tick(); assert.equal(h.calls.snapshots.length, 4);
  await h.live.cancel();
});
test('stop drains bounded windows with overlap and joins repeated boundary words', async () => {
  const h = harness({ snapshots: [slice(192000), slice(368000, 192000), slice(400000, 48000)], transcripts: ['Hello world', 'world this is', 'this is done.'] });
  h.live.start(); await h.live.finish();
  assert.deepEqual(h.calls.snapshots.map(args => args[1]), [0, 176000, 352000]);
  assert(h.calls.snapshots.every(args => args[2] === 192000));
  assert.equal(h.calls.text.at(-1), 'Hello world this is done.');
  assert.equal(h.calls.transcribes[1].options.prompt, 'Hello world');
  assert.equal(h.calls.removed.length, 3); assert.equal(h.active(), false);
});
test('silence is not decoded; unchanged audio is not retranscribed and files are removed', async () => {
  const h = harness({ snapshots: [slice(32000, 32000, false), slice(32000, 32000, false), slice(64000)], transcripts: ['hello'] });
  h.live.start(); h.timer(); await tick(); h.timer(); await tick(); h.timer(); await tick();
  assert.equal(h.calls.transcribes.length, 1); assert.equal(h.calls.removed.length, 3);
  await h.live.cancel();
});
test('cancel aborts in-flight inference, suppresses results and removes temporary files', async () => {
  const held = deferred(); const h = harness({ snapshots: [slice(32000)], held });
  h.live.start(); h.timer(); await tick(); await h.live.cancel();
  assert.equal(h.calls.aborts, 1); assert.equal(h.calls.text.length, 0);
  assert.equal(h.calls.removed.length, 1); assert.equal(h.active(), false);
});
test('cancel while snapshot is pending never starts native inference', async () => {
  const heldSnapshot = deferred(); const h = harness({ heldSnapshot });
  h.live.start(); h.timer(); const cancel = h.live.cancel();
  heldSnapshot.resolve(slice(32000)); await cancel;
  assert.equal(h.calls.transcribes.length, 0); assert.equal(h.calls.removed.length, 1);
});
test('transcription failures are surfaced and snapshots still cleaned', async () => {
  const h = harness({ snapshots: [slice(32000)], held: { promise: Promise.reject(Error('decoder failed')), resolve() {} } });
  h.live.start(); h.timer(); await tick();
  assert.equal(h.calls.errors.length, 1); assert.equal(h.calls.removed.length, 1);
  assert.equal(h.active(), false);
  h.timer(); await tick(); assert.equal(h.calls.snapshots.length, 1);
  await h.live.cancel();
});
test('boundary merge handles capitalization, punctuation and unmatched phrases', () => {
  const h = harness();
  assert.equal(h.joinOverlappingTranscript('Hello WORLD.', 'world again'), 'Hello WORLD. again');
  assert.equal(h.joinOverlappingTranscript('hello', 'another phrase'), 'hello another phrase');
});
const { LiveDraftEditor } = load('src/services/liveDraft.ts');
test('live draft replaces provisional text, keeps existing text and resets between recordings', () => {
  const editor = new LiveDraftEditor();
  let draft = editor.update('Typed question', 'a', 'I scream');
  draft = editor.update(draft, 'a', 'Ice cream please');
  assert.equal(draft, 'Typed question Ice cream please');
  assert.equal(editor.update(draft, 'b', 'Thank you'), 'Typed question Ice cream please Thank you');
});
test('typing before or after dictated text survives transcript revisions', () => {
  const editor = new LiveDraftEditor(); let draft = editor.update('Question ', 'a', 'hello');
  editor.edit(draft, draft + ' typed suffix'); draft += ' typed suffix';
  draft = editor.update(draft, 'a', 'hello world'); assert.equal(draft, 'Question hello world typed suffix');
  editor.edit(draft, 'My ' + draft); draft = 'My ' + draft;
  assert.equal(editor.update(draft, 'a', 'hello world again'), 'My Question hello world again typed suffix');
});
test('editing or clearing dictated words protects the user edits while later speech appends', () => {
  const editor = new LiveDraftEditor(); let draft = editor.update('', 'a', 'hello world');
  editor.edit(draft, 'edited world'); draft = 'edited world';
  draft = editor.update(draft, 'a', 'Hello world again'); assert.equal(draft, 'edited world again');
  editor.edit(draft, ''); draft = '';
  assert.equal(editor.update(draft, 'a', 'Hello world again today'), 'today');
});

test('feature flag enables live mode with bounded readiness checks', () => {
  const config = load('src/config/voice.ts');
  assert.equal(config.VOICE_TRANSCRIPTION_MODE, 'live');
  assert.equal(config.LIVE_TRANSCRIPTION_READINESS_MS, 200);
});

test('decode settlement immediately starts ready work without a timer or parallel jobs', async () => {
  const held = deferred();
  const h = harness({ snapshots: [slice(16000), slice(32000), slice(32000)], held });
  h.live.start(); h.timer(); await tick();
  assert.equal(h.active(), false, 'no readiness polling during native work');
  for (let i = 0; i < 20; i++) h.timer();
  assert.equal(h.calls.snapshots.length, 1);
  held.resolve({ result: 'first words', isAborted: false });
  await tick();
  assert.equal(h.calls.transcribes.length, 2, 'second decode needs no timer tick');
  assert.equal(h.calls.snapshots.length, 3, 'one immediate check observes unchanged audio');
  assert.equal(h.active(), true, 'unchanged audio schedules bounded readiness check');
  await tick();
  assert.equal(h.calls.snapshots.length, 3, 'no busy microtask polling');
  await h.live.cancel();
});

test('minimum window and genuinely new samples gate decode; duplicate and older samples are ignored', async () => {
  const snapshots = [slice(2000)];
  const h = harness({ snapshots });
  h.live.start(); h.timer(); await tick();
  assert.equal(h.calls.transcribes.length, 0);
  snapshots.push(slice(4799)); h.timer(); await tick();
  assert.equal(h.calls.transcribes.length, 0);
  snapshots.push(slice(4800), slice(4800)); h.timer(); await tick();
  assert.equal(h.calls.transcribes.length, 1);
  snapshots.push(slice(9599)); h.timer(); await tick();
  assert.equal(h.calls.transcribes.length, 1, 'long window with less than 300ms new audio is not decoded');
  snapshots.push(slice(4000)); h.timer(); await tick();
  assert.equal(h.calls.transcribes.length, 1, 'older end sample is not decoded');
  snapshots.push(slice(9600), slice(9600)); h.timer(); await tick();
  assert.equal(h.calls.transcribes.length, 2);
  assert.equal(h.calls.removed.length, 8, 'even insufficient/unchanged snapshots are deleted');
  await h.live.cancel();
});

test('stop flushes a short new tail once, while identical audio is never decoded twice', async () => {
  const snapshots = [slice(16000), slice(16000)];
  const h = harness({ snapshots, transcripts: ['first', 'first final'] });
  h.live.start(); h.timer(); await tick();
  snapshots.push(slice(16001));
  await h.live.finish();
  assert.deepEqual(h.calls.text, ['first', 'first final']);
  assert.equal(h.active(), false);
  snapshots.push(slice(16001));
  await h.live.finish();
  assert.equal(h.calls.transcribes.length, 2);
});

test('blank provisional results never reach drafts; later real speech replaces cleanly', async () => {
  const snapshots = [slice(16000), slice(16000)];
  const h = harness({ snapshots, transcripts: ['[BLANK_AUDIO] [SILENCE]', '[BLANK_AUDIO] Hello [no_speech] world.'] });
  h.live.start(); h.timer(); await tick();
  assert.deepEqual(h.calls.text, []);
  snapshots.push(slice(32000), slice(32000)); h.timer(); await tick();
  assert.deepEqual(h.calls.text, ['Hello world.']);
  await h.live.cancel();
});

test('markers cannot contaminate committed windows, boundary merges or future prompts', async () => {
  const h = harness({
    snapshots: [slice(192000), slice(368000, 192000), slice(400000, 48000)],
    transcripts: ['[BLANK_AUDIO] Hello world', '[silence] world this is', 'this is [BLANK_AUDIO] done.'],
  });
  h.live.start(); h.timer(); await tick();
  assert.equal(h.calls.text.at(-1), 'Hello world this is done.');
  assert.equal(h.calls.transcribes[1].options.prompt, 'Hello world');
  assert.equal(h.calls.transcribes[2].options.prompt, 'Hello world this is');
  assert(h.calls.text.every(text => !/BLANK_AUDIO|silence/i.test(text)));
  await h.live.cancel();
});

test('cancelling an idle readiness check prevents future snapshots and callbacks', async () => {
  const h = harness({ snapshots: [slice(16000)] });
  h.live.start(); h.live.start(); await h.live.cancel(); h.timer(); await tick();
  assert.equal(h.active(), false);
  assert.equal(h.calls.snapshots.length, 0);
  assert.equal(h.calls.text.length, 0);
});

test('stop waits for pending live inference then flushes without a concurrent job', async () => {
  const held = deferred();
  const h = harness({ snapshots: [slice(16000), slice(20000)], held, transcripts: ['hello tail'] });
  h.live.start(); h.timer(); await tick();
  const finish = h.live.finish(); await tick();
  assert.equal(h.calls.snapshots.length, 1);
  assert.equal(h.calls.transcribes.length, 1);
  held.resolve({ result: 'hello', isAborted: false }); await finish;
  assert.equal(h.calls.transcribes.length, 2);
  assert.equal(h.calls.text.at(-1), 'hello tail');
  assert.equal(h.active(), false);
});

test('snapshot cleanup settles before checking or decoding the next audio window', async () => {
  const heldCleanup = deferred();
  const h = harness({ snapshots: [slice(16000), slice(32000)], heldCleanup });
  h.live.start(); h.timer(); await tick();
  assert.equal(h.calls.transcribes.length, 1);
  assert.equal(h.calls.removed.length, 1);
  assert.equal(h.active(), false);
  for (let i = 0; i < 10; i++) h.timer();
  assert.equal(h.calls.snapshots.length, 1);
  heldCleanup.resolve(); await tick();
  assert.equal(h.calls.transcribes.length, 2);
  await h.live.cancel();
});
