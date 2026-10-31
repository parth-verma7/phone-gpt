const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relativePath, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, Error, ...globals, require(name) {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}

const root = 'file:///private/documents/';
const uuid = '4d8c8310-110e-4f09-b853-f41d022b481a';
const numeric = '1792770000000';

function storage(files = [], overrides = {}) {
  const entries = new Set(files);
  const calls = [];
  const api = {
    documentDirectory: root,
    async deleteAsync(uri, options) {
      calls.push({ uri, idempotent: options.idempotent });
      assert.equal(options.idempotent, true);
      for (const entry of entries) if (entry.startsWith(uri)) entries.delete(entry);
    },
    ...overrides,
  };
  return { api, entries, calls, ...load('src/services/deleteChat.ts', { 'expo-file-system/legacy': api }) };
}

test('UUID and legacy numeric IDs delete only the exact private attachments directory', async () => {
  for (const id of [uuid, numeric]) {
    const target = `${root}chats/${id}/attachments/`;
    const preserved = [
      `${root}chats/other/attachments/private.txt`,
      `${root}chats/${id}-other/attachments/private.txt`,
      `${root}chats/${id}/chat.json`,
      `${root}chats/${id}/voice/recording.wav`,
      `${root}chats/${id}/attachments-other/keep.txt`,
      `${root}models/model.gguf`, `${root}voice/model.bin`,
      'file:///picker/original.txt',
    ];
    const store = storage([...preserved, `${target}message-0.txt`, `${target}nested/private.txt`]);
    await store.removeChatFiles(id);
    assert.deepEqual([...store.entries], preserved);
    assert.deepEqual(store.calls, [{ uri: target, idempotent: true }]);
  }
});

test('cleanup matches the actual text attachment writer destination', async () => {
  let written;
  const store = storage([], {
    async makeDirectoryAsync() {},
    async copyAsync({ to }) { written = to; },
  });
  const { persistTextAttachment } = load('src/services/textAttachments.ts', { 'expo-file-system/legacy': store.api });
  for (const id of [uuid, numeric]) {
    const saved = await persistTextAttachment({ name: 'notes.txt', uri: 'file:///picker/notes.txt', size: 10 }, id, 'message-1');
    store.entries.add(written);
    await store.removeChatFiles(id);
    assert.equal(store.entries.has(saved.uri), false);
    assert.equal(saved.uri, `${store.calls.at(-1).uri}message-1-0.txt`);
  }
});

test('missing attachments and repeated cleanup are idempotent', async () => {
  const preserved = `${root}chats/${numeric}/chat.json`;
  const store = storage([preserved]);
  await store.removeChatFiles(numeric);
  await store.removeChatFiles(numeric);
  assert.equal(store.calls.length, 2);
  assert.deepEqual([...store.entries], [preserved]);
});

test('unsafe IDs are rejected before any filesystem operation', async () => {
  const store = storage();
  const unsafe = [
    '', '.', '..', '../other', 'a/../../models', '/models', 'a\\..\\models',
    '%2e%2e', '%2Fmodels', 'a%252fb', 'file:///models', 'a?b', 'a#b',
    ' a', 'a ', 'abc\n', 'abc\r', 'a\0b', 'ü', null, undefined, 123,
  ];
  for (const id of unsafe) await assert.rejects(store.removeChatFiles(id), /Invalid chat attachment path/);
  assert.deepEqual(store.calls, []);
});

test('unavailable storage fails closed and real deletion errors propagate', async () => {
  for (const documentDirectory of [null, undefined, '']) {
    const store = storage([], { documentDirectory });
    await assert.rejects(store.removeChatFiles(uuid), /Local attachment storage is unavailable/);
    assert.deepEqual(store.calls, []);
  }
  const failure = new Error('Permission denied');
  const store = storage([], { async deleteAsync() { throw failure; } });
  await assert.rejects(store.removeChatFiles(uuid), (error) => error === failure);
});

function buttonHarness({ platform = 'android', browser, onConfirm = () => {}, disabled = false } = {}) {
  const states = [], refs = [], alerts = [];
  let stateIndex = 0, refIndex = 0;
  const jsx = (type, props) => ({ type, props });
  const { DeleteChatButton } = load('src/components/DeleteChatButton.tsx', {
    react: {
      useState(initial) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (value) => { states[index] = value; }];
      },
      useRef(initial) {
        const index = refIndex++;
        return refs[index] ??= { current: initial };
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      Alert: { alert: (...args) => alerts.push(args) }, Platform: { OS: platform },
      Pressable: 'Pressable', View: 'View', StyleSheet: { create: (value) => value },
    },
    '../theme/AppTheme': { useAppTheme: () => ({ colors: { error: '#B42318', errorSurface: '#FCECEA' } }) },
    './AppIcon': { AppIcon: 'AppIcon' }, './ScaledText': { ScaledText: 'Text' },
  }, browser === undefined ? {} : { window: browser });
  let props = { onConfirm, disabled, chatTitle: 'Private notes' };
  function render(nextProps = {}) {
    props = { ...props, ...nextProps };
    stateIndex = refIndex = 0;
    const tree = DeleteChatButton(props);
    const children = [tree.props.children].flat();
    return { button: children.find((child) => child?.type === 'Pressable'), error: children.find((child) => child?.type === 'Text') };
  }
  return { render, alerts };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('button has a 44px target, accessible label, subtle destructive icon and native confirmation', async () => {
  let deleted = 0;
  const harness = buttonHarness({ onConfirm: () => { deleted++; } });
  const { button } = harness.render();
  assert.equal(button.props.accessibilityRole, 'button');
  assert.equal(button.props.accessibilityLabel, 'Delete conversation');
  const [size, normal] = button.props.style({ pressed: false });
  assert.equal(size.minWidth, 44);
  assert.equal(size.minHeight, 44);
  assert.equal(normal.backgroundColor, 'transparent');
  assert.equal(button.props.children.props.name, 'trash');
  assert.equal(button.props.children.props.color, '#B42318');
  button.props.onPress();
  button.props.onPress();
  assert.equal(harness.alerts.length, 1);
  assert.equal(deleted, 0);
  const [title, message, actions, options] = harness.alerts[0];
  assert.equal(title, 'Delete chat?');
  assert.match(message, /Private notes/);
  assert.equal(actions[0].text, 'Cancel');
  assert.equal(actions[0].style, 'cancel');
  assert.equal(actions[1].style, 'destructive');
  actions[1].onPress();
  options.onDismiss();
  actions[1].onPress();
  await settle();
  assert.equal(deleted, 1);
  assert.equal(harness.render().button.props.disabled, false);
});

test('native cancel and dismissal release the lock without deleting', () => {
  let deleted = 0;
  const harness = buttonHarness({ onConfirm: () => { deleted++; } });
  harness.render().button.props.onPress();
  harness.alerts[0][2][0].onPress();
  assert.equal(harness.render().button.props.disabled, false);
  harness.render().button.props.onPress();
  harness.alerts[1][3].onDismiss();
  assert.equal(harness.render().button.props.disabled, false);
  assert.equal(deleted, 0);
});

test('disabled guards presses and a pending native confirmation uses current props', async () => {
  let deleted = 0;
  const harness = buttonHarness({ disabled: true, onConfirm: () => { deleted++; } });
  harness.render().button.props.onPress();
  assert.equal(harness.alerts.length, 0);
  harness.render({ disabled: false }).button.props.onPress();
  harness.render({ disabled: true });
  harness.alerts[0][2][1].onPress();
  await settle();
  assert.equal(deleted, 0);
  harness.render({ disabled: false }).button.props.onPress();
  harness.render({ onConfirm: () => { deleted += 10; } });
  harness.alerts[1][2][1].onPress();
  await settle();
  assert.equal(deleted, 10);
});

test('async deletion stays busy through dialog dismissal and ignores repeated actions', async () => {
  let finish, deleted = 0;
  const harness = buttonHarness({ onConfirm: () => {
    deleted++;
    return new Promise((resolve) => { finish = resolve; });
  } });
  const original = harness.render().button;
  original.props.onPress();
  harness.alerts[0][2][1].onPress();
  harness.alerts[0][3].onDismiss();
  const pending = harness.render().button;
  assert.equal(pending.props.disabled, true);
  assert.equal(pending.props.accessibilityState.busy, true);
  original.props.onPress();
  pending.props.onPress();
  harness.alerts[0][2][1].onPress();
  assert.equal(harness.alerts.length, 1);
  assert.equal(deleted, 1);
  finish();
  await settle();
  assert.equal(harness.render().button.props.accessibilityState.busy, false);
});

test('sync throws and async rejections produce a visible accessible alert and allow retry', async () => {
  for (const onConfirm of [() => { throw new Error('Disk failure'); }, async () => { throw new Error('Disk failure'); }, () => { throw null; }]) {
    const harness = buttonHarness({ onConfirm });
    harness.render().button.props.onPress();
    harness.alerts[0][2][1].onPress();
    await settle();
    const failed = harness.render();
    assert.equal(failed.button.props.disabled, false);
    assert.equal(failed.error.props.accessibilityRole, 'alert');
    assert.match(failed.error.props.children, /Disk failure|Could not delete/);
    harness.render({ onConfirm: () => {} }).button.props.onPress();
    assert.equal(harness.render().error, undefined);
    harness.alerts[1][2][1].onPress();
    await settle();
    assert.equal(harness.render().error, undefined);
  }
});

test('web uses browser confirmation instead of the nonfunctional native Alert', async () => {
  for (const accepted of [false, true]) {
    let deleted = 0, message;
    const harness = buttonHarness({ platform: 'web', browser: { confirm(text) { message = text; return accepted; } }, onConfirm: () => { deleted++; } });
    harness.render().button.props.onPress();
    await settle();
    assert.match(message, /Delete chat\?/);
    assert.match(message, /Private notes/);
    assert.equal(deleted, accepted ? 1 : 0);
    assert.equal(harness.alerts.length, 0);
    assert.equal(harness.render().button.props.disabled, false);
  }
});

test('web confirmation unavailable or throwing fails closed with a visible alert', () => {
  for (const browser of [undefined, {}, { confirm() { throw new Error('Dialog blocked'); } }]) {
    let deleted = 0;
    const harness = buttonHarness({ platform: 'web', browser, onConfirm: () => { deleted++; } });
    harness.render().button.props.onPress();
    const failed = harness.render();
    assert.equal(deleted, 0);
    assert.equal(failed.button.props.disabled, false);
    assert.equal(failed.error.props.accessibilityRole, 'alert');
    assert.match(failed.error.props.children, /Confirmation is unavailable|Dialog blocked/);
  }
});
