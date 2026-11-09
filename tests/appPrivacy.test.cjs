const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({type, props});
const flatten = node => [node].flat(Infinity).flatMap(n => n && typeof n === 'object' ? [n, ...flatten(n.props?.children)] : []);
function render(fail) {
  const opened = [], alerts = [], exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/AppInfo.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, __DEV__: false, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === './ScaledText') return { ScaledText: 'Text' };
    if (name === 'react-native') return { Platform: { OS: 'android' }, View: 'View', Linking: { openURL: async url => { opened.push(url); if(fail) throw Error('No browser'); } }, Alert: { alert: (...args) => alerts.push(args) } };
    if (name === '../theme/AppTheme') return {useAppTheme: () => ({colors: {text: '#111', secondary: '#333'}})};
    if (name === './UiKit') return {SettingsCard: 'Card', ActionButton: 'Button'};
    if (name === './PhoneGptLogo') return {PhoneGptLogo: 'Logo'};
    if (name === '../config/voice') return {VOICE_TRANSCRIPTION_MODE: 'live'};
    if (name === './ContactForm') return {ContactForm: 'ContactForm'};
    throw Error(name);
  }});
  return {nodes: flatten(exports.AppInfo({version:'v0.5.14'})), opened, alerts};
}
test('App Info gives the public privacy policy a working visible action', async () => {
  const h = render(false);
  const button = h.nodes.find(n => n.props?.label === 'Read Privacy Policy'); assert.ok(button);
  button.props.onPress(); await new Promise(setImmediate);
  assert.deepEqual(h.opened, ['https://phone-gpt.pages.dev/privacy/']); assert.equal(h.alerts.length, 0);
});
test('privacy URL opening failures give a usable manual URL', async () => {
  const h = render(true); h.nodes.find(n => n.props?.label === 'Read Privacy Policy').props.onPress(); await new Promise(setImmediate);
  assert.equal(h.alerts[0][0], 'Unable to open privacy policy');
  assert.match(h.alerts[0][1], /https:\/\/phone-gpt.pages.dev\/privacy\//);
});
