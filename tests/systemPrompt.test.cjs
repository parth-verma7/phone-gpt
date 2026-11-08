const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require(name) { if (name in modules) return modules[name]; throw Error(name); } });
  return exports;
}
const config = load('src/config/systemPrompt.ts');
function settings(saved, failWrite = false) {
  const state = [], effects = [], writes = []; let cursor = 0, mounted = false;
  const react = {
    useRef: initial => { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i]; },
    useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = value; }]; },
    useEffect: effect => { if (!mounted) effects.push(effect); },
  };
  const api = load('src/hooks/useSystemPromptSettings.ts', {
    react, '../config/systemPrompt': config,
    '@react-native-async-storage/async-storage': { default: {
      getItem: async key => key.endsWith('versions-v1') ? (saved?.includes('\"activePrompt\"') ? saved : null) : saved,
      setItem: async (key, value) => { if (failWrite) throw Error('storage failed'); writes.push({ key, value }); },
    } },
  });
  return { writes, render() { cursor = 0; const value = api.useSystemPromptSettings(); mounted = true; while (effects.length) effects.shift()(); return value; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('missing or blank preferences show the actual default as editable text without overwriting storage', async () => {
  for (const saved of [null, '', '  ']) {
    const h = settings(saved); assert.equal(h.render().draft, config.DEFAULT_SYSTEM_PROMPT);
    await tick(); const value = h.render(); assert.equal(value.ready, true);
    assert.equal(value.draft, config.DEFAULT_SYSTEM_PROMPT); assert.equal(value.savedPrompt, config.DEFAULT_SYSTEM_PROMPT);
    assert.equal(h.writes.length, 0);
  }
});
test('saved custom instructions survive hydration; saving edits affects the prompt for new chats', async () => {
  const h = settings('My custom instructions'); h.render(); await tick();
  assert.equal(h.render().draft, 'My custom instructions');
  h.render().setDraft('  Respond in Hindi.  '); await h.render().save();
  assert.equal(h.render().savedPrompt, 'Respond in Hindi.');
  assert.equal(JSON.parse(h.writes[0].value).activePrompt, 'Respond in Hindi.');
});
test('saving an empty box restores the visible default; a failed save does not replace saved instructions', async () => {
  const h = settings('Custom'); h.render(); await tick();
  h.render().setDraft(' '); await h.render().save();
  assert.equal(h.render().draft, config.DEFAULT_SYSTEM_PROMPT); assert.equal(JSON.parse(h.writes[0].value).activePrompt, config.DEFAULT_SYSTEM_PROMPT);
  const failed = settings('Original', true); failed.render(); await tick(); failed.render().setDraft('Edited'); await failed.render().save();
  assert.equal(failed.render().savedPrompt, 'Original'); assert.equal(failed.render().draft, 'Edited'); assert.ok(failed.render().error);
});
test('inference uses the displayed default, honors custom prompts and retains reasoning controls', () => {
  const api = load('src/services/localInference.ts', {
    'react-native': { Platform: { OS: 'android' } }, './tokenLimits': load('src/services/tokenLimits.ts'), '../config/systemPrompt': config,
  });
  const off = { reasoningMode: 'off', maxTokens: 384, contextSize: 2048 };
  assert.equal(api.effectiveSystemPrompt(off), config.DEFAULT_SYSTEM_PROMPT);
  assert.equal(api.effectiveSystemPrompt(off, config.DEFAULT_SYSTEM_PROMPT), config.DEFAULT_SYSTEM_PROMPT);
  assert.equal(api.effectiveSystemPrompt(off, '  Custom  '), 'Custom');
  assert.match(api.effectiveSystemPrompt({ ...off, reasoningMode: 'short' }, config.DEFAULT_SYSTEM_PROMPT), /Keep reasoning brief/);
  assert.match(config.DEFAULT_SYSTEM_PROMPT, /Introduce yourself only when asked/);
  assert.match(config.DEFAULT_SYSTEM_PROMPT, /When using web search, answer the question without mentioning sources, websites or link numbers/);
  assert.doesNotMatch(api.effectiveSystemPrompt(off), /Parth|concise guide|As PhoneGPT/);
});

test('history preserves previous instructions and restores an older version across reloads', async () => {
  const h = settings('Original'); h.render(); await tick();
  h.render().setDraft('Second'); await h.render().save();
  assert.deepEqual(Array.from(h.render().versions, v => v.text), ['Second', 'Original']);
  const restored = settings(h.writes[0].value); restored.render(); await tick();
  assert.equal(restored.render().savedPrompt, 'Second');
  restored.render().setDraft(restored.render().versions[1].text);
  assert.equal(restored.render().savedPrompt, 'Second'); // selecting alone does not apply
  await restored.render().save();
  assert.equal(restored.render().savedPrompt, 'Original');
  assert.equal(restored.render().versions.length, 3);
  await restored.render().save();
  assert.equal(restored.writes.length, 1); // identical Save makes no duplicate
});
test('failed writes keep history and malformed envelopes cannot be overwritten', async () => {
  const h = settings('Original', true); h.render(); await tick();
  h.render().setDraft('New'); await h.render().save();
  assert.equal(h.render().versions.length, 0); assert.equal(h.render().savedPrompt, 'Original');
  const broken = settings('{"schemaVersion":1,"activePrompt":"x","versions":null}'); broken.render(); await tick();
  assert.equal(broken.render().ready, false); await broken.render().save(); assert.equal(broken.writes.length, 0);
});

test('legacy JSON instructions remain ordinary text and oversized edits preserve saved history', async () => {
  const original = '{"schemaVersion":2,"instructions":"Be concise"}';
  const h = settings(original); h.render(); await tick(); assert.equal(h.render().savedPrompt, original);
  h.render().setDraft('x'.repeat(16001)); await h.render().save();
  assert.equal(h.writes.length, 0); assert.equal(h.render().savedPrompt, original);
});
test('removing a version does not change active instructions', async () => {
  const h = settings('Original'); h.render(); await tick(); h.render().setDraft('Second'); await h.render().save();
  const oldId = h.render().versions[1].id; await h.render().removeVersion(oldId);
  assert.equal(h.render().versions.length, 1); assert.equal(h.render().savedPrompt, 'Second');
});

test('original default stays separate from all 50 user history slots and can be restored when full', async () => {
  const h = settings(null); h.render(); await tick();
  for (let i = 0; i < 50; i++) { h.render().setDraft(`Instructions ${i}`); await h.render().save(); }
  assert.equal(h.render().versions.length, 50);
  assert.equal(h.render().versions.some(v => v.text === config.DEFAULT_SYSTEM_PROMPT), false);
  h.render().setDraft('One too many'); await h.render().save(); assert.equal(h.render().versions.length, 50);
  assert.equal(h.render().savedPrompt, 'Instructions 49');
  h.render().setDraft(config.DEFAULT_SYSTEM_PROMPT); await h.render().save();
  assert.equal(h.render().savedPrompt, config.DEFAULT_SYSTEM_PROMPT); assert.equal(h.render().versions.length, 50);
});
