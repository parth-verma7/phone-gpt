const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { if (name in dependencies) return dependencies[name]; throw Error(name); } });
  return exports;
}
const palette = load('src/theme/themeColors.ts');
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
test('every accent keeps text readable on buttons, bubbles and light/dark surfaces', () => {
  for (const option of palette.THEME_OPTIONS) for (const dark of [false, true]) {
    const colors = palette.themeColors(dark, option.id);
    for (const [text, background] of [['onPrimary', 'primary'], ['userText', 'userBubble'], ['text', 'background'], ['text', 'surface'], ['secondary', 'surface']]) {
      assert.ok(contrast(colors[text], colors[background]) >= 4.5, `${option.id}/${dark}: ${text}/${background}`);
    }
  }
});
test('unknown stored colors fall back to teal; every named theme restores', () => {
  for (const saved of [null, undefined, '', 'unknown', {}, 'BLUE']) assert.equal(palette.restoreThemeAccent(saved), 'teal');
  for (const option of palette.THEME_OPTIONS) assert.equal(palette.restoreThemeAccent(option.id), option.id);
  assert.equal(palette.restoreThemeAccent('sage-blue'), 'light-blue');
  assert.equal(palette.restoreThemeAccent('white'), 'teal');
  assert.equal(palette.THEME_OPTIONS.some(option => ['sage-blue', 'white'].includes(option.id)), false);
});
test('theme provider hydrates both preferences before writing and persists later selections', async () => {
  let cursor = 0; const slots = []; const effects = []; const previous = []; const writes = [];
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useMemo: fn => fn(), useContext: () => {},
    useEffect: (fn, deps) => { const i = cursor++; if (!previous[i] || deps.some((value, n) => value !== previous[i][n])) { previous[i] = deps; effects.push(fn); } },
  };
  const { AppThemeProvider } = load('src/theme/AppTheme.tsx', {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) }, './themeColors': palette,
    '@react-native-async-storage/async-storage': { default: {
      getItem: async key => key === '@phone-gpt/theme' ? 'dark' : 'royal-blue',
      setItem: async (...args) => { writes.push(args); },
    } },
  });
  function render() { cursor = 0; const value = AppThemeProvider({ children: null }).props.value; while (effects.length) effects.shift()(); return value; }
  assert.equal(render().ready, false); assert.equal(writes.length, 0);
  await new Promise(resolve => setImmediate(resolve));
  const loaded = render(); assert.equal(loaded.ready, true); assert.equal(loaded.isDark, true); assert.equal(loaded.accent, 'royal-blue');
  assert.deepEqual(writes, [['@phone-gpt/theme', 'dark'], [palette.THEME_ACCENT_KEY, 'royal-blue']]);
  loaded.setAccent('pink'); const changed = render(); assert.equal(changed.accent, 'pink');
  assert.deepEqual(writes.at(-1), [palette.THEME_ACCENT_KEY, 'pink']);
  changed.setDarkMode(false); assert.equal(render().colors.primary, palette.themeColors(false, 'pink').primary);
});
