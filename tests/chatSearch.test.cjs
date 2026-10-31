const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}

const history = load('src/services/chatHistory.ts');
const search = load('src/services/chatSearch.ts', { './chatHistory': history });
const { searchChats, highlightMatches, findLiteralMatches, searchSnippet } = search;
const plain = (value) => JSON.parse(JSON.stringify(value));
const chat = (id, content, createdAt, title = id) => ({
  id, title, createdAt,
  messages: [{ id: `${id}-user`, role: 'user', content }],
});

test('finds prefix, middle and suffix substrings case-insensitively', () => {
  const chats = [chat('a', 'ALPHAbet', 1), chat('b', 'preAlphaPost', 2), chat('c', 'the alpha', 3), chat('d', 'unrelated', 4)];
  assert.deepEqual(plain(searchChats(chats, 'aLpHa').map((r) => r.chat.id)), ['c', 'b', 'a']);
});

test('searches saved titles, history labels, attachments labels and all message roles', () => {
  const savedTitle = chat('title', 'different', 1, 'Custom [title]');
  const assistant = chat('assistant', 'question', 2);
  assistant.messages.push({ id: 'answer', role: 'assistant', content: 'Deep hidden answer' });
  assistant.messages.push({ id: 'system', role: 'system', content: 'System instruction' });
  const attachment = { ...chat('attachment', '', 3), origin: 'dev' };
  attachment.messages[0].attachments = [{ name: 'budget.csv' }];
  assert.equal(searchChats([savedTitle], '[TITLE]')[0].title, 'Custom [title]');
  assert.equal(searchChats([assistant], 'hidden')[0].chat, assistant);
  assert.equal(searchChats([assistant], 'instruction').length, 1);
  assert.equal(searchChats([attachment], 'Dev - budget')[0].chat, attachment);
});

test('sorts by start time rather than update time or match location, without mutation', () => {
  const old = { ...chat('old', 'hit', 10), updatedAt: 9000 };
  const recent = { ...chat('recent', 'middle hit end', 20), updatedAt: 20 };
  const tie = chat('tie', 'hit', 20);
  const missing = chat('missing', 'hit');
  const chats = Object.freeze([old, recent, tie, missing]);
  chats.forEach((c) => { Object.freeze(c.messages[0]); Object.freeze(c.messages); Object.freeze(c); });
  assert.deepEqual(plain(searchChats(chats, 'hit').map((r) => r.chat.id)), ['recent', 'tie', 'old', 'missing']);
  assert.equal(chats[0], old);
  assert.equal(searchChats(chats, 'hit')[2].chat, old);
});

test('empty query shows every chat; no matches returns an empty array; spaces stay literal', () => {
  const chats = [chat('a', 'a b', 1), chat('b', 'solo', 2)];
  assert.deepEqual(plain(searchChats(chats, '').map((r) => r.chat.id)), ['b', 'a']);
  assert.equal(searchChats(chats, 'absent').length, 0);
  assert.equal(searchChats(chats, ' ').length, 1);
  assert.equal(searchChats([], '').length, 0);
});

test('restores legacy start times and ignores invalid dates consistently with history', () => {
  const legacy = chat('legacy', 'hello');
  legacy.messages[0].id = '1792770000000-user';
  const numeric = chat('1792780000000', 'hello');
  const invalid = chat('invalid', 'hello', Infinity);
  const explicit = chat('explicit', 'hello', 1792790000000);
  assert.deepEqual(plain(searchChats([invalid, legacy, explicit, numeric], '').map((r) => r.chat.id)), ['explicit', numeric.id, 'legacy', 'invalid']);
  assert.equal(searchChats([legacy], '')[0].createdAt, 1792770000000);
  assert.equal(legacy.createdAt, undefined);
});

test('regex punctuation is literal in filtering and highlighting', () => {
  for (const needle of ['.*', '[x]', '(a)', '$', '^', '+', '?', '\\', '{2}', '|']) {
    const text = `before ${needle} after ${needle}`;
    const matches = findLiteralMatches(text, needle);
    assert.equal(matches.length, 2, needle);
    assert.equal(searchChats([chat('literal', text, 1), chat('other', 'unrelated', 2)], needle).length, 1);
    const parts = highlightMatches(text, needle);
    assert.equal(parts.map((p) => p.text).join(''), text);
    assert.deepEqual(plain(parts.filter((p) => p.match).map((p) => p.text)), [needle, needle]);
  }
});

test('highlighting preserves source spelling, all nonoverlapping hits and plain markup', () => {
  const text = '<b>BanANA & banana</b>';
  const parts = highlightMatches(text, 'ana');
  assert.equal(parts.map((p) => p.text).join(''), text);
  assert.deepEqual(plain(parts.filter((p) => p.match).map((p) => p.text)), ['anA', 'ana']);
  assert.deepEqual(plain(highlightMatches('plain', '')), [{ text: 'plain', match: false }]);
  assert.deepEqual(plain(highlightMatches('', '')), []);
  assert.equal(findLiteralMatches('aaaa', 'aa').length, 2);
});

test('Unicode expansion and emoji preserve original highlight boundaries', () => {
  assert.deepEqual(plain(highlightMatches('İ hello 😀 END', 'end')).filter((p) => p.match), [{ text: 'END', match: true }]);
  assert.deepEqual(plain(highlightMatches('A😀B', '😀')), [
    { text: 'A', match: false }, { text: '😀', match: true }, { text: 'B', match: false },
  ]);
  assert.equal(highlightMatches('İx', 'i')[0].text, 'İ');
  assert.equal(highlightMatches('ΟΣ', 'ος')[0].match, true);
});

test('snippets center deep hits, retain long queries and mark clipped boundaries', () => {
  const text = `${'prefix '.repeat(100)}NeEdLe${' suffix'.repeat(100)}`;
  const result = searchChats([chat('a', text, 1)], 'needle')[0];
  assert.ok(result.snippet.startsWith('…'));
  assert.ok(result.snippet.endsWith('…'));
  assert.ok(result.snippet.includes('NeEdLe'));
  assert.ok(result.snippet.length < 200);
  const longQuery = 'x'.repeat(300);
  assert.ok(searchSnippet(`before ${longQuery} after`, longQuery).includes(longQuery));
  assert.equal(searchSnippet('short', ''), 'short');
});

test('first-hit snippets preserve Unicode source offsets and literal query boundaries', () => {
  const prefix = 'İ😀'.repeat(100);
  const text = `${prefix}NeEdLe${'later needle '.repeat(1000)}`;
  assert.equal(searchSnippet(text, 'needle', 6), `…${prefix.slice(-6)}NeEdLe${text.slice(prefix.length + 6, prefix.length + 18)}…`);
  assert.equal(searchSnippet('before İ after', 'i\u0307', 0), '…İ…');
  assert.equal(searchSnippet('before 😀 after', '😀', 0), '…😀…');
  assert.equal(searchSnippet('before .* after .*', '.*', 0), '….*…');
  assert.equal(searchChats([chat('unicode', text, 1)], 'NEEDLE').length, 1);
  assert.equal(searchChats([chat('unicode', 'ΟΣ İ 😀', 1)], 'ος').length, 1);
  assert.equal(searchChats([chat('unicode', 'ΟΣ İ 😀', 1)], 'i\u0307').length, 1);
});

test('modal routes Back, clear, selection and deletion through separate callbacks', async () => {
  let closed = 0, selected, deleted, dismissed = 0, focused = 0;
  const values = [];
  const jsx = (type, props) => ({ type, props });
  const ref = { current: { focus() { focused++; }, blur() {} } };
  let refIndex = 0;
  const native = {
    Animated: { Value: class { interpolate() { return 0; } }, View: 'AnimatedView' },
    Easing: {}, FlatList: 'FlatList', Keyboard: { dismiss() { dismissed++; } },
    KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: 'Modal', Platform: { OS: 'android' },
    Pressable: 'Pressable', StyleSheet: { create: (v) => v }, View: 'View',
  };
  const { ChatHistorySearch } = load('src/components/ChatHistorySearch.tsx', {
    react: {
      useCallback: (fn) => fn, useEffect() {}, useMemo: (fn) => fn(),
      useRef: (v) => (++refIndex === 2 ? ref : { current: v }),
      useState: (initial) => [typeof initial === 'string' ? 'needle' : initial, (v) => values.push(v)],
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../theme/AppTheme': { useAppTheme: () => ({ colors: {}, isDark: true }) },
    '../services/chatSearch': search,
    './AppIcon': { AppIcon: 'AppIcon' },
    './DeleteChatButton': { DeleteChatButton: 'DeleteChatButton' },
    './ScaledText': { ScaledText: 'Text', ScaledTextInput: 'Input' },
  });
  const original = chat('a', 'needle', 1);
  const tree = ChatHistorySearch({ open: true, chats: [original], onClose: () => closed++, onSelect: (c) => { selected = c; }, onDelete: async (c) => { deleted = c; } });
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child, predicate);
      if (found) return found;
    }
  }
  assert.equal(tree.type, 'Modal');
  tree.props.onShow();
  assert.equal(focused, 1);
  tree.props.onRequestClose();
  assert.equal(closed, 1);
  find(tree, (n) => n.props?.accessibilityLabel === 'Clear search').props.onPress();
  assert.equal(values.at(-1), '');
  const list = find(tree, (n) => n.type === 'FlatList');
  assert.equal(list.props.keyboardShouldPersistTaps, 'handled');
  const row = list.props.renderItem({ item: list.props.data[0] });
  await find(row, (n) => n.type === 'DeleteChatButton').props.onConfirm();
  assert.equal(deleted, original);
  assert.equal(selected, undefined);
  assert.equal(closed, 1);
  find(row, (n) => n.type === 'Pressable').props.onPress();
  assert.equal(selected, original);
  assert.equal(closed, 2);
  assert.equal(dismissed, 2);
});
