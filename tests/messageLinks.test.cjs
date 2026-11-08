const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const opened = [], alerts = [];
const jsx = (type, props) => ({ type, props });
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/MessageContent.tsx', 'utf8') + '\nexport { renderInline };', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports: api, URL, require(name) {
  if (name === 'react') return {};
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
  if (name === './ScaledText') return { ScaledText: 'Text' };
  if (name === 'react-native') return { Platform: { OS: 'android' }, StyleSheet: { create: x => x }, View: 'View', Linking: { openURL: async url => { opened.push(url); if (url.includes('failure')) throw Error('No browser'); } }, Alert: { alert: (...args) => alerts.push(args) } };
  throw Error(name);
}});
const flatten = nodes => [nodes].flat(Infinity).flatMap(n => typeof n === 'object' && n ? [n, ...flatten(n.props?.children)] : []);
const links = text => flatten(api.renderInline(text, '#123')).filter(n => n.props?.accessibilityRole === 'link');

test('Markdown links have readable labels and open the provided URL, including balanced parentheses', async () => {
  const found = links('Read [NVIDIA](https://www.nvidia.com/) and [Reference](https://example.com/wiki/Company_(business)).');
  assert.equal(found.length, 2);
  assert.equal(found[0].props.children.join(''), 'NVIDIA');
  await found[1].props.onPress();
  assert.equal(opened.at(-1), 'https://example.com/wiki/Company_(business)');
});
test('bare URLs are clickable without trailing prose punctuation; code and names remain literal', () => {
  assert.equal(links('See https://example.com/page.')[0].props.accessibilityHint, 'https://example.com/page');
  assert.equal(links('(https://example.com/page)')[0].props.accessibilityHint, 'https://example.com/page');
  assert.equal(links('`https://example.com` and Wall Street Journal').length, 0);
  assert.equal(links('**[Company](https://example.com)**').length, 1);
});
test('unsafe schemes, credentials and incomplete Markdown do not create unsafe targets', () => {
  assert.equal(links('[Bad](javascript:alert(1)) [File](file:///tmp/test) [Secret](https://user:pass@example.com)').length, 0);
  // Streaming incomplete link markup remains readable; a complete URL can still be tapped.
  assert.ok(api.renderInline('[Company](https://example.com', '#123').length);
});
test('opening failures produce a message instead of an unhandled rejection', async () => {
  links('[Example](https://failure.example)')[0].props.onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(alerts.at(-1)[0], 'Unable to open link');
});
