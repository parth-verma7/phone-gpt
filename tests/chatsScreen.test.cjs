const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require(name) { if (name in dependencies) return dependencies[name]; throw Error(name); } });
  return exports;
}
const history = load('src/services/chatHistory.ts', { './chatPreview': load('src/services/chatPreview.ts') });
const search = load('src/services/chatSearch.ts', { './chatHistory': history });
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const match = find(child, predicate); if (match) return match; }
}
test('visible titles use the first user turn with safe Unicode truncation, not IDs or later messages', () => {
  const chat = { id: 'internal-id', title: 'old-uuid', createdAt: 1000, messages: [{ role: 'assistant', content: 'Hello' }, { role: 'user', content: '  Help me\n plan  a weekend  ' }, { role: 'user', content: 'Different topic' }] };
  assert.equal(history.conversationTitle(chat), 'Help me plan a weekend');
  assert.equal(history.conversationTitle({ messages: [{ role: 'user', content: '**Plan** my *weekend*' }] }), 'Plan my weekend');
  assert.equal(history.chatHistoryLabels(chat).title, 'Help me plan a weekend');
  assert.equal(history.conversationTitle({ messages: [{ role: 'user', content: '', attachments: [{ name: 'notes.txt' }] }] }), 'notes.txt');
  assert.equal(history.conversationTitle({ messages: [] }), 'New chat');
  const long = history.conversationTitle({ messages: [{ role: 'user', content: '🙂'.repeat(60) }] });
  assert.equal(long, '🙂'.repeat(48) + '…');
});
function harness(chats) {
  const states = [], refs = []; let stateIndex = 0, refIndex = 0, selected, deleted, created = 0, exported = 0, confirmation;
  const removed = [];
  const colors = { primary: '#157568', onPrimary: '#fff', background: '#fff', text: '#111' };
  const theme = { useAppTheme: () => ({ colors, isDark: false }) };
  const { ChatsScreen } = load('src/components/ChatsScreen.tsx', {
    react: { useState: initial => { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; }, useRef: initial => refs[refIndex++] ??= { current: initial }, useMemo: fn => fn() }, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Alert: { alert: (...args) => { confirmation = args; } }, Platform: { OS: 'android' }, ActivityIndicator: 'Spinner', FlatList: 'List', Pressable: 'Button', View: 'View' },
    '../services/chatPreview': load('src/services/chatPreview.ts'), '../theme/AppTheme': theme, '../services/chatSearch': search, './AppIcon': { AppIcon: 'Icon' }, './PhoneGptLogo': { PhoneGptLogo: 'Logo' },
    './DeleteChatButton': { DeleteChatButton: 'Delete' }, './ScaledText': { ScaledText: 'Text', ScaledTextInput: 'Input' }, './UiKit': { ActionButton: 'Action' },
  });
  const props = { chats, ready: true, busy: false, onSelect: chat => { selected = chat; }, onNewChat: () => { created++; }, onModels() {}, onExport: () => { exported++; }, onDelete: async chat => { deleted = chat; removed.push(chat); }, version: 'test', modelName: () => 'Qwen' };
  return { render: extra => { stateIndex = refIndex = 0; return ChatsScreen({ ...props, ...extra }); }, confirmation: () => confirmation, removed, selected: () => selected, deleted: () => deleted, created: () => created, exported: () => exported, colors };
}
const sample = (id, createdAt, first, last) => ({ id, title: id, createdAt, messages: [{ id: 'u', role: 'user', content: first }, { id: 'a', role: 'assistant', content: last }] });
test('Chats lists by creation time, shows last-message previews and searches inside old turns', async () => {
  const old = sample('old', 1000, 'Hidden unique memory', 'Final answer');
  const recent = sample('recent', 2000, 'A new conversation', 'Latest preview');
  const h = harness([old, recent]); let tree = h.render(); let list = find(tree, n => n.type === 'List');
  assert.deepEqual(Array.from(list.props.data, item => item.chat.id), ['recent', 'old']);
  const row = list.props.renderItem({ item: list.props.data[0] });
  assert.ok(find(row, n => n.type === 'Text' && n.props.children?.[0]?.props?.children === 'Latest preview'));
  find(row, n => n.type === 'Button').props.onPress(); assert.equal(h.selected(), recent);
  assert.equal(find(row, n => n.type === 'Delete'), undefined, 'normal rows must not expose a trash action');
  assert.equal(find(row, n => n.type === 'Text' && n.props.children === list.props.data[0].date), undefined, 'date must not consume visible row width');
  assert.ok(find(row, n => n.type === 'Text' && n.props.children === list.props.data[0].time), 'start time remains visible');
  assert.ok(find(row, n => n.type === 'Button').props.accessibilityLabel.includes(list.props.data[0].date), 'full date remains accessible');
  find(tree, n => n.type === 'Input').props.onChangeText('unique');
  list = find(h.render(), n => n.type === 'List');
  assert.equal(list.props.data.length, 1); assert.equal(list.props.data[0].chat, old); assert.match(list.props.data[0].snippet, /unique/);
});
test('New chat and export remain visible and guarded during work; loading does not pretend history is empty', () => {
  const h = harness([sample('a', 1000, 'Hello', 'Hi')]);
  let tree = h.render(); find(tree, n => n.type === 'Action' && n.props.label === 'New chat').props.onPress(); assert.equal(h.created(), 1);
  find(tree, n => n.props?.accessibilityLabel === 'Export chat history').props.onPress(); assert.equal(h.exported(), 1);
  tree = h.render({ busy: true }); assert.equal(find(tree, n => n.type === 'Action' && n.props.label === 'New chat').props.disabled, true);
  assert.equal(find(tree, n => n.props?.accessibilityLabel === 'Export chat history').props.disabled, true);
  tree = h.render({ ready: false }); assert.ok(find(tree, n => n.type === 'Spinner')); assert.equal(find(tree, n => n.type === 'List'), undefined);
});

test('Edit selects chats without opening them; deletion requires confirmation and cancel preserves selection', async () => {
 const chats=[sample('a',1000,'First','Reply'),sample('b',2000,'Second','Reply')];
 const h=harness(chats);
 find(h.render(), n=>n.props?.accessibilityLabel==='Edit chats').props.onPress();
 let tree=h.render(); let list=find(tree,n=>n.type==='List');
 const row=list.props.renderItem({item:list.props.data[0]});
 const checkbox=find(row,n=>n.props?.accessibilityRole==='checkbox');
 checkbox.props.onPress(); assert.equal(h.selected(),undefined);
 tree=h.render();
 find(tree,n=>n.type==='Action'&&n.props.label==='Delete selected').props.onPress();
 assert.equal(h.removed.length,0);
 h.confirmation()[2][0].onPress();
 assert.equal(h.removed.length,0);
 find(h.render(),n=>n.type==='Action'&&n.props.label==='Delete selected').props.onPress();
 h.confirmation()[2][1].onPress();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(h.removed,[chats[1]]);
});
test('Select all is scoped to visible matches and query changes clear selection', () => {
 const h=harness([sample('a',1000,'First','Reply'),sample('b',2000,'Second','Reply')]);
 find(h.render(),n=>n.props?.accessibilityLabel==='Edit chats').props.onPress();
 find(h.render(),n=>n.props?.accessibilityLabel==='Select all chats').props.onPress();
 assert.equal(find(h.render(),n=>n.props?.accessibilityLabel==='Select all chats').props.accessibilityState.checked,true);
 find(h.render(),n=>n.type==='Input').props.onChangeText('First');
 const tree=h.render();
 assert.equal(find(tree,n=>n.type==='Action'&&n.props.label==='Delete selected').props.disabled,true);
 assert.ok(find(tree,n=>n.props?.accessibilityLabel==='Select all matching chats'));
});
