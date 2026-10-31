const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual TSX without adding a native renderer dependency.
function load(relativePath, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}

function wrappers() {
  let scale = 1;
  let nested = false;
  const flatten = (style) => Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean).map(flatten)) : style || {};
  const components = load('src/components/ScaledText.tsx', {
    react: { createContext: () => ({ Provider: 'Provider' }), forwardRef: (fn) => fn, useContext: () => nested },
    'react-native': { Text: 'NativeText', TextInput: 'NativeTextInput', StyleSheet: { flatten } },
    '../theme/FontScale': { useFontScale: () => ({ fontScale: scale }) },
  });
  return { ...components, flatten, setScale: (value) => { scale = value; }, setNested: (value) => { nested = value; } };
}

test('all presets scale root defaults and explicit metrics exactly once', () => {
  const { ScaledText, ScaledTextInput, flatten, setScale } = wrappers();
  const style = [{ fontSize: 12, lineHeight: 18 }, false, { fontSize: 20, color: 'red' }];
  for (const scale of [0.5, 0.8, 1, 1.2, 1.5, 1]) {
    setScale(scale);
    for (const component of [ScaledText, ScaledTextInput]) {
      assert.equal(flatten(component({}, null).props.style).fontSize, 14 * scale);
      const result = flatten(component({ style }, null).props.style);
      assert.equal(result.fontSize, 20 * scale);
      assert.equal(result.lineHeight, 18 * scale);
      assert.equal(result.color, 'red');
    }
  }
  assert.equal(style[0].fontSize, 12);
  assert.equal(style[0].lineHeight, 18);
});

test('nested text inherits metrics unless explicitly supplied', () => {
  const { ScaledText, flatten, setNested, setScale } = wrappers();
  setScale(1.5);
  const parent = ScaledText({ style: { fontSize: 20, lineHeight: 30 }, children: 'parent' }, null);
  assert.equal(parent.props.children.props.value, true);
  setNested(true);
  const inherited = flatten(ScaledText({ style: { fontWeight: '700' } }, null).props.style);
  assert.equal(inherited.fontSize, undefined);
  assert.equal(inherited.lineHeight, undefined);
  const explicit = flatten(ScaledText({ style: { fontSize: 10, lineHeight: 14 } }, null).props.style);
  assert.equal(explicit.fontSize, 15);
  assert.equal(explicit.lineHeight, 21);
});

test('input forwards the native ref and input props unchanged', () => {
  const { ScaledTextInput } = wrappers();
  const ref = { current: null };
  const onChangeText = () => {};
  const input = ScaledTextInput({ placeholder: 'Draft', multiline: true, onChangeText }, ref);
  assert.equal(input.type, 'NativeTextInput');
  assert.equal(input.props.ref, ref);
  assert.equal(input.props.placeholder, 'Draft');
  assert.equal(input.props.multiline, true);
  assert.equal(input.props.onChangeText, onChangeText);
});

const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function provider(storage) {
  const slots = [];
  const effects = [];
  let cursor = 0;
  let first = true;
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState(initial) {
      const index = cursor++;
      if (first) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (first) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect) { if (first) effects.push(effect); },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
  };
  const { FontScaleProvider } = load('src/theme/FontScale.tsx', {
    react,
    '@react-native-async-storage/async-storage': { default: storage },
  });
  function render() {
    cursor = 0;
    const value = FontScaleProvider({ children: null }).props.value;
    first = false;
    return value;
  }
  render();
  const cleanups = effects.map((effect) => effect());
  return { render, unmount: () => cleanups.forEach((cleanup) => cleanup?.()) };
}

test('hydrates valid presets without overwriting storage; ignores invalid saved sizes', async () => {
  for (const saved of ['0.5', '0.8', '1', '1.2', '1.5', 'invalid', '2', null]) {
    const writes = [];
    const instance = provider({ getItem: async () => saved, setItem: async (...args) => { writes.push(args); } });
    assert.equal(instance.render().ready, false);
    await tick();
    assert.equal(instance.render().ready, true);
    assert.equal(instance.render().fontScale, ['invalid', '2', null].includes(saved) ? 1 : Number(saved));
    assert.equal(writes.length, 0);
    instance.unmount();
  }
});

test('selection before hydration wins and rapid writes remain ordered', async () => {
  const read = deferred();
  const firstWrite = deferred();
  const writes = [];
  const instance = provider({
    getItem: () => read.promise,
    setItem: async (key, value) => { writes.push([key, value]); if (writes.length === 1) await firstWrite.promise; },
  });
  instance.render().setFontScale(0.8);
  instance.render().setFontScale(1.5);
  instance.render().setFontScale(3); // Runtime validation also guards untyped callers.
  read.resolve('0.5');
  await tick();
  assert.equal(instance.render().fontScale, 1.5);
  assert.equal(instance.render().ready, true);
  assert.equal(writes.length, 1);
  firstWrite.resolve();
  await tick();
  assert.equal(writes.map((entry) => entry[1]).join(','), '0.8,1.5');
  assert.equal(writes[0][0], '@phone-gpt/font-scale');
  instance.unmount();
});

test('storage failures keep the UI usable and repeated selection retries saving', async () => {
  let fail = true;
  const instance = provider({
    getItem: async () => { throw Error('read failed'); },
    setItem: async () => { if (fail) throw Error('write failed'); },
  });
  await tick();
  assert.equal(instance.render().ready, true);
  assert.match(instance.render().error, /load/);
  instance.render().setFontScale(1.2);
  await tick();
  assert.equal(instance.render().fontScale, 1.2);
  assert.match(instance.render().error, /save/);
  fail = false;
  instance.render().setFontScale(1.2);
  await tick();
  assert.equal(instance.render().error, null);
  instance.unmount();
});
