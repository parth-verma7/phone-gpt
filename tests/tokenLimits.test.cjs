const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/tokenLimits.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: api });
test('GGUF context comes from the current architecture, not unrelated metadata', () => {
  assert.equal(api.modelContextLimit({ 'general.architecture': 'qwen3', 'qwen3.context_length': '131072', 'llama.context_length': 4096 }), 131072);
  for (const value of [null, {}, { 'general.architecture': 'qwen3' }, { 'general.architecture': 'qwen3', 'qwen3.context_length': '-1' }]) assert.equal(api.modelContextLimit(value), null);
});
test('custom token values reject decimals, infinity, negative values and numbers outside model capacity', () => {
  for (const value of [NaN, Infinity, -1, 0, 1.5, '2048', 131073, Number.MAX_SAFE_INTEGER + 1]) assert.equal(api.validTokenValue(value, 1, 131072), false);
  for (const value of [384, 5000, 100000, 131072]) assert.equal(api.validTokenValue(value, 1, 131072), true);
});
test('large requests are available within a capable context and reply shares that window', () => {
  const settings = api.normalizeTokenSettings({ contextSize: 131072, maxTokens: 100000 }, 131072);
  assert.equal(settings.contextSize, 131072); assert.equal(settings.maxTokens, 100000);
  const reduced = api.normalizeTokenSettings(settings, 4096);
  assert.equal(reduced.contextSize, 4096); assert.equal(reduced.maxTokens, 3840);
});
test('corrupted saved settings recover defaults; unknown metadata allows larger opt-in windows', () => {
  const invalid = api.normalizeTokenSettings({ contextSize: NaN, maxTokens: -1 });
  assert.equal(invalid.contextSize, 2048); assert.equal(invalid.maxTokens, 384);
  assert.equal(api.normalizeTokenSettings({ contextSize: 2048, maxTokens: 192 }).maxTokens, 384);
  assert.equal(api.MIN_REPLY_TOKENS, 384); assert.equal(api.MIN_CONTEXT_TOKENS, 1024);
  const fallback = api.normalizeTokenSettings({ contextSize: 100000, maxTokens: 100000 });
  assert.equal(fallback.contextSize, 32768); assert.equal(fallback.maxTokens, 32512);
});
test('a large reply ceiling automatically fits the current input without rejecting a valid turn', () => {
  assert.equal(api.availableReplyTokens(4096, 1000, 100000), 2840);
  assert.equal(api.availableReplyTokens(4096, 1000, 384), 384);
  assert.equal(api.availableReplyTokens(4096, 4000, 384), 0);
});
test('native initialization receives the GGUF-bounded context and completion receives a custom long reply budget', async () => {
  const inference = {}; const calls = { allocations: 0, releases: 0 };
  const code = ts.transpileModule(fs.readFileSync('src/services/localInference.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports: inference, require: name => {
    if (name === '../config/systemPrompt') { const result = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/config/systemPrompt.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: result }); return result; }
    if (name === './tokenLimits') return api;
    if (name === 'react-native') return { Platform: { OS: 'android' } };
    if (name === 'llama.rn') return {
      loadLlamaModelInfo: async () => ({ 'general.architecture': 'test', 'test.context_length': 131072 }),
      initLlama: async params => { calls.allocations++; calls.init = params; return { release: async () => { calls.releases++; }, completion: async params => { calls.completion = params; return { text: 'Done' }; } }; },
    };
    throw Error(name);
  } });
  const loaded = await inference.loadLocalModel({}, 'test.gguf', 200000);
  assert.equal(calls.init.n_ctx, 131072); assert.equal(loaded.contextSize, 131072); assert.equal(loaded.maxContextTokens, 131072);
  await inference.generateLocalReply([], { reasoningMode: 'off', contextSize: 131072, maxTokens: 100000 });
  assert.equal(calls.completion.n_predict, 100000);
  await inference.loadLocalModel({}, 'test.gguf', 131072);
  assert.equal(calls.allocations, 1, 'unchanged preference reuses the ready model');
  await inference.loadLocalModel({}, 'test.gguf', 4096);
  assert.equal(calls.allocations, 2, 'next use with a changed context reinitializes');
  assert.equal(calls.releases, 1, 'old allocation is released before replacement');
  assert.equal(calls.init.n_ctx, 4096);
  await inference.loadLocalModel({}, 'test.gguf', 4096);
  assert.equal(calls.allocations, 2, 'subsequent turns reuse the new allocation');
});

test('10k and 20k contexts are opt-in while a known smaller model limit still wins', () => {
  for (const contextSize of [10000, 20000]) {
    assert.equal(api.normalizeTokenSettings({ contextSize, maxTokens: 384 }).contextSize, contextSize);
    assert.equal(api.normalizeTokenSettings({ contextSize, maxTokens: 384 }, 8192).contextSize, 8192);
  }
  assert.equal(api.normalizeTokenSettings({ contextSize: NaN, maxTokens: 384 }).contextSize, 2048);
});
