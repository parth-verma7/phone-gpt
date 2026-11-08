const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/searchFallback.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: api });
test('rate-limit notice shows the window start/reset, scope, local fallback and no auto-retry', () => {
  const note = api.searchLimitNotice({ kind: 'rate_limited', limit: 10, windowStartedAt: '2026-11-08T10:00:00Z', resetAt: '2026-11-08T11:00:00Z' });
  for (const pattern of [/network/, /10 web searches/, /Search window started:/, /Search available again after/, /without a fresh web search/, /No automatic retry/]) assert.match(note, pattern);
  assert.match(api.searchLimitNotice({ kind: 'daily_quota' }), /shared web-search limit/);
  assert.doesNotMatch(api.searchLimitNotice({ kind: 'daily_quota' }), /Search available again after/);
});
test('fallback instructions prohibit invented fresh facts and sources', () => {
  assert.match(api.SEARCH_LIMIT_FALLBACK_PROMPT, /No fresh web evidence/);
  assert.match(api.SEARCH_LIMIT_FALLBACK_PROMPT, /Do not claim to have searched, invent sources/);
  assert.match(api.SEARCH_LIMIT_FALLBACK_PROMPT, /cannot verify it now/);
});
