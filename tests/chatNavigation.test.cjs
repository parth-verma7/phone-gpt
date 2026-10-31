const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}, suffix = '') {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8') + suffix, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, ...globals, require(name) {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}
const navigation = load('src/services/chatNavigation.ts');
const { startNewConversation } = navigation;

test('repeated New chat preserves the fresh UUID and unsent text/attachment without allocating IDs', () => {
  for (const currentChat of [null, { id: 'empty-saved-id', messages: [] }]) {
    const state = { currentChat, draftChatId: 'fresh-id', message: 'unfinished question', attachedText: { name: 'notes.txt' } };
    const createId = () => assert.fail('an empty conversation must not allocate a UUID');
    assert.equal(startNewConversation(startNewConversation(state, createId), createId), state);
  }
});

test('New chat after a transcript starts one fresh UUID and clears the composer without changing history', () => {
  const chat = Object.freeze({ id: 'existing', messages: Object.freeze([{ role: 'user', content: 'hello' }]) });
  const state = Object.freeze({ currentChat: chat, draftChatId: 'unused', message: 'draft', attachedText: { name: 'notes.txt' } });
  let allocations = 0;
  const createId = () => { allocations++; return 'new-id'; };
  const next = startNewConversation(state, createId);
  assert.equal(next.currentChat, null);
  assert.equal(next.draftChatId, 'new-id');
  assert.equal(next.message, '');
  assert.equal(next.attachedText, null);
  assert.equal(startNewConversation(next, createId), next);
  assert.equal(allocations, 1);
  assert.equal(state.currentChat, chat);
  assert.equal(state.message, 'draft');
});

const jsx = (type, props) => ({ type, props });
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}

// Keep hook state between renders; native children remain inspectable callback surfaces.
function hooks() {
  const cells = [];
  let cursor = 0;
  return {
    begin() { cursor = 0; },
    react: {
      useState(initial) {
        const i = cursor++;
        if (!(i in cells)) cells[i] = typeof initial === 'function' ? initial() : initial;
        return [cells[i], (value) => { cells[i] = typeof value === 'function' ? value(cells[i]) : value; }];
      },
      useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial }; },
      useMemo: (fn) => fn(), useCallback: (fn) => fn, useEffect() {},
    },
  };
}

function appHarness() {
  const h = hooks();
  let allocations = 0;
  const dependencies = {
    react: h.react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': new Proxy({ Platform: { OS: 'android' }, Keyboard: { dismiss() {} }, StyleSheet: { create: (s) => s } }, { get: (obj, key) => obj[key] ?? key }),
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0 }) },
    './src/services/chatNavigation': navigation,
    './src/services/chatIds': { createChatId: () => `uuid-${++allocations}` },
    './src/services/models': { models: [{ id: 'model', displayName: 'Model' }] },
    './src/services/localInference': { DEFAULT_INFERENCE_SETTINGS: { contextSize: 1024, maxTokens: 192, reasoningMode: 'off' } },
    './src/services/liveDraft': { LiveDraftEditor: class {} },
    './src/theme/AppTheme': { useAppTheme: () => ({ colors: {} }) },
    './src/hooks/useLastLoadedModel': { useLastLoadedModel: () => ({}) },
    './src/hooks/useSystemPromptSettings': { useSystemPromptSettings: () => ({}) },
    './src/hooks/useVoiceTyping': { useVoiceTyping: () => ({ busy: false }) },
    './src/components/ProviderGroup': { groupModelsByProvider: () => [] },
  };
  // The imports not exercised here are opaque components/services.
  for (const match of fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8').matchAll(/from '([^']+)'/g)) {
    dependencies[match[1]] ??= new Proxy({}, { get: (_, key) => key });
  }
  const { PhoneGptApp } = load('App.tsx', dependencies, { __DEV__: true }, '\nexport { PhoneGptApp };');
  return {
    render() { h.begin(); return PhoneGptApp(); },
    allocations: () => allocations,
  };
}
const component = (tree, type) => find(tree, (n) => n.type === type || n.type?.name === type);
const label = (tree, text) => find(tree, (n) => n.props?.accessibilityLabel === text);
const menuItem = (tree, text) => find(tree, (n) => n.type === 'Pressable' && find(n, (child) => child.props?.children === text));

test('drawer search waits for exit, is adjacent to history heading, and Back closes the full-screen search', () => {
  const app = appHarness();
  let tree = app.render();
  component(tree, 'WelcomeHome').props.onChat();
  tree = app.render();
  const drawer = component(tree, 'NavigationDrawer');
  assert.equal(label(tree, 'Search chat history'), label(drawer, 'Search chat history'));
  label(tree, 'Open menu').props.onPress();
  tree = app.render();
  label(tree, 'Search chat history').props.onPress();
  tree = app.render();
  assert.equal(component(tree, 'NavigationDrawer').props.open, false);
  assert.equal(component(tree, 'ChatHistorySearch').props.open, false);
  component(tree, 'NavigationDrawer').props.onExited();
  tree = app.render();
  assert.equal(component(tree, 'ChatHistorySearch').props.open, true);
  component(tree, 'ChatHistorySearch').props.onClose();
  assert.equal(component(app.render(), 'ChatHistorySearch').props.open, false);
});

test('Back, destination changes, and drawer reopening cancel deferred search permanently', () => {
  for (const cancel of [
    (tree) => component(tree, 'NavigationDrawer').props.onRequestClose(),
    (tree) => menuItem(tree, 'Models').props.onPress(),
    (tree) => component(tree, 'SimpleScreen').props.onMenu(),
  ]) {
    const app = appHarness();
    let tree = app.render();
    component(tree, 'SimpleScreen').props.onMenu();
    tree = app.render();
    label(tree, 'Search chat history').props.onPress();
    tree = app.render();
    const lateExit = component(tree, 'NavigationDrawer').props.onExited;
    cancel(tree);
    lateExit();
    tree = app.render();
    assert.equal(component(tree, 'ChatHistorySearch').props.open, false);
  }
});

test('plus and menu New chat both reuse a fresh conversation', () => {
  const app = appHarness();
  let tree = app.render();
  menuItem(tree, 'New chat').props.onPress();
  tree = app.render();
  const before = app.allocations();
  component(tree, 'NewChatButton').props.onPress();
  tree = app.render();
  menuItem(tree, 'New chat').props.onPress();
  app.render();
  assert.equal(app.allocations(), before);
});

function drawerHarness(os) {
  const cells = [], effects = [], frames = new Map(), animations = [];
  let cursor = 0, frameId = 0, exited = 0, tree;
  const react = {
    useRef(value) { const i = cursor++; return cells[i] ??= { current: value }; },
    useState(value) {
      const i = cursor++;
      if (!(i in cells)) cells[i] = value;
      return [cells[i], (next) => { cells[i] = next; }];
    },
    useEffect(fn, deps) {
      const i = cursor++, previous = cells[i];
      if (previous && deps.every((v, j) => Object.is(v, previous.deps[j]))) return;
      effects.push(() => { previous?.cleanup?.(); cells[i] = { deps, cleanup: fn() }; });
    },
  };
  const { NavigationDrawer } = load('src/components/NavigationDrawer.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      Animated: {
        Value: class { interpolate() { return 0; } }, View: 'AnimatedView',
        timing(value, config) {
          let callback, stopped = false;
          const animation = { config, start(fn) { callback = fn; }, stop() { stopped = true; }, finish() { if (!stopped) callback({ finished: true }); } };
          animations.push(animation);
          return animation;
        },
      },
      Easing: { out: (v) => v }, Modal: 'Modal', Platform: { OS: os },
      Pressable: 'Pressable', StyleSheet: { absoluteFill: {} }, View: 'View', useWindowDimensions: () => ({ width: 400 }),
    },
    '../theme/AppTheme': { useAppTheme: () => ({ colors: {} }) },
  }, {
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  return {
    render(open) {
      cursor = 0;
      tree = NavigationDrawer({ open, onClose() {}, onRequestClose() {}, onExited() { exited++; }, children: null });
      while (effects.length) effects.shift()();
      return tree;
    },
    finishAnimation() { animations.at(-1).finish(); },
    frame() { const pending = [...frames.values()]; frames.clear(); pending.forEach((fn) => fn()); },
    exited: () => exited,
  };
}

test('Android drawer completes slide-out and hides its Modal before notifying exit', () => {
  const drawer = drawerHarness('android');
  drawer.render(true);
  drawer.finishAnimation();
  assert.equal(drawer.render(false).props.visible, true);
  assert.equal(drawer.exited(), 0);
  drawer.finishAnimation();
  assert.equal(drawer.render(false).props.visible, false);
  assert.equal(drawer.exited(), 0);
  drawer.frame();
  assert.equal(drawer.exited(), 0);
  drawer.frame();
  assert.equal(drawer.exited(), 1);
  drawer.render(false).props.onDismiss();
  assert.equal(drawer.exited(), 1);
});

test('iOS drawer waits for native dismissal; reopening cancels Android exit notification', () => {
  const ios = drawerHarness('ios');
  ios.render(true);
  ios.render(false);
  ios.finishAnimation();
  const modal = ios.render(false);
  ios.frame(); ios.frame();
  assert.equal(ios.exited(), 0);
  modal.props.onDismiss();
  assert.equal(ios.exited(), 1);

  const android = drawerHarness('android');
  android.render(true);
  android.render(false);
  android.finishAnimation();
  android.render(false);
  android.frame();
  android.render(true);
  android.frame();
  assert.equal(android.exited(), 0);
});
