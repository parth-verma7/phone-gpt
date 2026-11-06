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
  const references = [];
  let cursor = 0;
  return {
    begin() { cursor = 0; },
    references,
    react: {
      useState(initial) {
        const i = cursor++;
        if (!(i in cells)) cells[i] = typeof initial === 'function' ? initial() : initial;
        return [cells[i], (value) => { cells[i] = typeof value === 'function' ? value(cells[i]) : value; }];
      },
      useRef(initial) { const i = cursor++; if (!(i in cells)) { cells[i] = { current: initial }; references.push(cells[i]); } return cells[i]; },
      useMemo: (fn) => fn(), useCallback: (fn) => fn, useEffect() {},
    },
  };
}

function appHarness(os = 'android') {
  const h = hooks();
  let allocations = 0;
  const dependencies = {
    react: h.react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': new Proxy({ Platform: { OS: os }, Keyboard: { dismiss() {} }, StyleSheet: { create: (s) => s } }, { get: (obj, key) => obj[key] ?? key }),
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0 }) },
    './src/services/chatNavigation': navigation,
    './src/services/tokenLimits': load('src/services/tokenLimits.ts'),
    './src/services/webContextUsage': load('src/services/webContextUsage.ts'),
    './src/theme/controlStyles': load('src/theme/controlStyles.ts'),
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
    attachMessageList: list => { h.references[0].current = list; },
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

test('Web toggle shares the model row below the UUID and is absent from the composer', () => {
  const app = appHarness();
  component(app.render(), 'WelcomeHome').props.onChat();
  const tree = app.render();
  const row = find(tree, node => {
    const children = [node.props?.children].flat(Infinity);
    return children.some(child => child?.props?.accessibilityLabel === 'Choose downloaded model')
      && children.some(child => child?.type === 'WebSearchControls');
  });
  assert.ok(row, 'model selector and Web toggle must be siblings');
  const controls=[];
  function collect(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'WebSearchControls') controls.push(node);
    for (const child of [node.props?.children].flat(Infinity)) collect(child);
  }
  collect(tree);
  assert.equal(controls.length,1);
});

test('chat follows new content until the user scrolls up, then resumes near the bottom', () => {
  const app=appHarness();
  component(app.render(),'WelcomeHome').props.onChat();
  let tree=app.render();
  component(tree,'ChatHistorySearch').props.onSelect({id:'scroll-chat',messages:Array.from({length:40},(_,i)=>({id:String(i),role:i%2?'assistant':'user',content:'Message '+i}))});
  tree=app.render();
  let scrolls=0;
  app.attachMessageList({scrollToEnd:()=>{scrolls++;}});
  const list=find(tree,n=>typeof n.props?.onContentSizeChange==='function');
  const position=y=>({nativeEvent:{contentOffset:{y},contentSize:{height:2000},layoutMeasurement:{height:400}}});
  list.props.onScroll(position(1600));
  list.props.onContentSizeChange();
  assert.equal(scrolls,1,'new content follows by default');
  list.props.onScrollBeginDrag();
  list.props.onScroll(position(300));
  list.props.onContentSizeChange();
  assert.equal(scrolls,1,'incoming tokens must not pull the reader down');
  list.props.onScrollEndDrag(position(300));
  list.props.onContentSizeChange();
  assert.equal(scrolls,1,'follow stays disabled after releasing the scroll');
  list.props.onScrollBeginDrag();
  list.props.onScroll(position(1580));
  list.props.onScrollEndDrag(position(1580));
  list.props.onContentSizeChange();
  assert.equal(scrolls,2,'downward scrolling resumes follow within 24 pixels of the bottom');
});

const scrollPosition = (y, height = 2000, viewport = 400) => ({
  nativeEvent: { contentOffset: { y }, contentSize: { height }, layoutMeasurement: { height: viewport } },
});

function chatScrollHarness(os = 'android') {
  const app = appHarness(os);
  component(app.render(), 'WelcomeHome').props.onChat();
  component(app.render(), 'ChatHistorySearch').props.onSelect({
    id: 'scroll-regression',
    messages: Array.from({ length: 40 }, (_, i) => ({ id: String(i), role: i % 2 ? 'assistant' : 'user', content: `Message ${i}` })),
  });
  const list = find(app.render(), node => typeof node.props?.onContentSizeChange === 'function').props;
  const scrolls = [];
  app.attachMessageList({ scrollToEnd: options => { scrolls.push(options); } });
  list.onScroll(scrollPosition(1600));
  return { list, scrolls };
}

test('web and accessibility scrolling pause and resume follow without native drag callbacks', () => {
  for (const os of ['web', 'android', 'ios']) {
    const { list, scrolls } = chatScrollHarness(os);
    list.onContentSizeChange(400, 2000);
    assert.equal(scrolls.length, 1, `${os}: starts following`);
    list.onScroll(scrollPosition(300));
    list.onContentSizeChange(400, 2000);
    list.onLayout();
    assert.equal(scrolls.length, 1, `${os}: incoming content and layout cannot override upward scrolling`);
    list.onScroll(scrollPosition(1560));
    list.onContentSizeChange(400, 2000);
    assert.equal(scrolls.length, 1, `${os}: being 40px from the bottom is insufficient to resume`);
    list.onScroll(scrollPosition(1580));
    list.onContentSizeChange(400, 2000);
    assert.equal(scrolls.length, 2, `${os}: moving down to within 24px resumes follow`);
  }
});

test('touch pauses incoming content immediately and releasing or cancelling cannot resume follow', () => {
  for (const release of ['onTouchEnd', 'onTouchCancel']) {
    const { list, scrolls } = chatScrollHarness();
    // Capture a callback before the gesture, as a previously queued follow would.
    const pendingFollow = list.onContentSizeChange;
    list.onTouchStart();
    pendingFollow(400, 2000);
    list.onLayout();
    assert.equal(scrolls.length, 0, 'touch wins before the first movement event');
    list[release]();
    list.onScroll(scrollPosition(1600));
    pendingFollow(400, 2000);
    assert.equal(scrolls.length, 0, 'release at the old bottom does not express downward intent');
    list.onScroll(scrollPosition(1592));
    pendingFollow(400, 2000);
    assert.equal(scrolls.length, 0, 'a tiny upward move stays paused despite being near the bottom');
    list.onScroll(scrollPosition(1600));
    pendingFollow(400, 2000);
    assert.equal(scrolls.length, 1, 'explicit downward movement resumes follow');
  }
});

test('drag and momentum never snap a reader back after a tiny upward move near the bottom', () => {
  const { list, scrolls } = chatScrollHarness();
  list.onScrollBeginDrag(scrollPosition(1600));
  list.onContentSizeChange(400, 2000);
  assert.equal(scrolls.length, 0, 'drag start pauses before any scroll movement');
  list.onScroll(scrollPosition(1592));
  list.onScrollEndDrag(scrollPosition(1592));
  list.onContentSizeChange(400, 2000);
  assert.equal(scrolls.length, 0, 'releasing 8px from bottom must not resume');
  list.onMomentumScrollBegin();
  list.onScroll(scrollPosition(1584));
  list.onMomentumScrollEnd(scrollPosition(1584));
  list.onContentSizeChange(400, 2000);
  assert.equal(scrolls.length, 0, 'momentum end must not snap back either');
  list.onScrollBeginDrag(scrollPosition(1584));
  list.onScroll(scrollPosition(1600));
  list.onScrollEndDrag(scrollPosition(1600));
  list.onContentSizeChange(400, 2000);
  assert.equal(scrolls.length, 1, 'moving back down restores follow after the drag');
});

test('content growth, reflow, viewport changes and programmatic following preserve auto-follow', () => {
  const { list, scrolls } = chatScrollHarness();
  list.onScroll(scrollPosition(1600, 2400));
  list.onContentSizeChange(400, 2400);
  assert.equal(scrolls.length, 1, 'content growth opens a gap without expressing upward intent');
  list.onScroll(scrollPosition(2000, 2400));
  list.onContentSizeChange(400, 2400);
  assert.equal(scrolls.length, 2, 'the scrollToEnd result keeps following enabled');
  list.onScroll(scrollPosition(1800, 2200));
  list.onContentSizeChange(400, 2200);
  assert.equal(scrolls.length, 3, 'reflow can move the offset upward without pausing follow');
  list.onScroll(scrollPosition(1700, 2200, 500));
  list.onLayout();
  assert.equal(scrolls.length, 4, 'viewport resizing can move the offset upward without pausing follow');
  assert.ok(scrolls.every(options => options.animated === false), 'stream following stays non-animated');
});

test('content growth and layout at the bottom cannot re-enable a paused reader', () => {
  const { list, scrolls } = chatScrollHarness();
  list.onScroll(scrollPosition(1592));
  list.onScroll(scrollPosition(1592, 2400));
  list.onContentSizeChange(400, 2400);
  list.onScroll(scrollPosition(1592, 1992));
  list.onLayout();
  list.onContentSizeChange(400, 1992);
  assert.equal(scrolls.length, 0, 'layout closing the gap cannot substitute for downward movement');
});

test('web upward wheel and keyboard intent pause before scroll position changes', () => {
  for (const interrupt of [
    list => list.onWheel({ nativeEvent: { deltaY: -10 } }),
    list => list.onWheel({ deltaY: -10 }),
    ...['ArrowUp', 'PageUp', 'Home'].map(key => list => list.onKeyDown({ key })),
  ]) {
    const { list, scrolls } = chatScrollHarness('web');
    const pendingFollow = list.onLayout;
    interrupt(list);
    pendingFollow();
    list.onContentSizeChange(400, 2000);
    assert.equal(scrolls.length, 0, 'upward intent wins over a pending follow before onScroll arrives');
    list.onScroll(scrollPosition(1400));
    list.onScroll(scrollPosition(1600));
    list.onContentSizeChange(400, 2000);
    assert.equal(scrolls.length, 1, 'scrolling down restores follow after web input');
  }
});
