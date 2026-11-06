const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/services/chatPreview.ts'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(code, { exports: exportsObject });
const { plainChatPreview } = exportsObject;

test('keeps prose, Unicode and numeric punctuation; normalizes whitespace without clipping', () => {
  assert.equal(plainChatPreview('  Hello\r\nworld!\t café 😀  '), 'Hello world! café 😀');
  const text = 'Version 1.2 costs $3.50; -2 + 4 = 2, 50%, #42, C# and C++.';
  assert.equal(plainChatPreview(text), text);
  assert.equal(plainChatPreview('a'.repeat(1000)), 'a'.repeat(1000));
  assert.equal(plainChatPreview(''), '');
  assert.equal(plainChatPreview('\n\t '), '');
});

test('removes paired emphasis including nested styles and strikethrough', () => {
  assert.equal(plainChatPreview('**bold**, *italic*, __strong__, _soft_, ***both***, ___both___ and ~~old~~.'),
    'bold, italic, strong, soft, both, both and old.');
  assert.equal(plainChatPreview('**bold and *italic***'), 'bold and italic');
  assert.equal(plainChatPreview('(**hi**) *é* **😀**'), '(hi) é 😀');
});

test('flattens headings, lists, tasks, quotes, rules and setext headings', () => {
  assert.equal(plainChatPreview('# Title ###\n> **Quote**\n- first\n* second\n+ third\n1. fourth\n2) fifth\n- [x] done\n- [ ] todo\n---\nEnd\n==='),
    'Title Quote first second third fourth fifth done todo End');
  assert.equal(plainChatPreview('>> nested\n  - item\n3.14 is pi\n2026.11.06'), 'nested item 3.14 is pi 2026.11.06');
});

test('protects inline and fenced code content from Markdown interpretation', () => {
  assert.equal(plainChatPreview('Run `a * b ** 2` and ``use `tick` here``.'), 'Run a * b ** 2 and use `tick` here.');
  assert.equal(plainChatPreview('Before\n```ts\nconst x = "**literal**";\n# code\n```\nAfter'), 'Before const x = "**literal**"; # code After');
  assert.equal(plainChatPreview('~~~python\nx = a * b\n~~~'), 'x = a * b');
  assert.equal(plainChatPreview('    **literal**\n\t# code'), '**literal** # code');
  assert.equal(plainChatPreview('**`a*b`** and `[x](url)`'), 'a*b and [x](url)');
});

test('keeps link labels and image alt text, balanced destinations and optional titles', () => {
  assert.equal(plainChatPreview('See [**guide**](https://example.test/a_(b) "A guide") and ![diagram](image.png).'), 'See guide and diagram.');
  assert.equal(plainChatPreview('[array [index]](target) [code `a*b`](target)'), 'array [index] code a*b');
  assert.equal(plainChatPreview('https://example.test/a?x=1&y=2'), 'https://example.test/a?x=1&y=2');
});

test('retains meaningful literal symbols, identifiers and escaped punctuation', () => {
  for (const text of ['a * b', '2 * 3 * 4', 'a*b*c', 'a ** b', 'snake_case_name', 'file_name.txt', '* wildcard', '***unfinished', '**unfinished', 'unfinished*', '#hashtag']) {
    // A leading star followed by space is intentionally treated as a list.
    assert.equal(plainChatPreview(text), text === '* wildcard' ? 'wildcard' : text);
  }
  assert.equal(plainChatPreview(String.raw`\*literal\* \_name\_ \[label\](url) C:\Users\me`), '*literal* _name_ [label](url) C:\\Users\\me');
});

test('handles truncated Markdown and unfinished fences without dropping content', () => {
  for (const text of ['[label](broken', '[missing', '`unfinished', '**', '![alt](', '[a](url "unfinished)', 'text ](url)']) {
    assert.equal(plainChatPreview(text), text);
  }
  assert.equal(plainChatPreview('Before\n```js\n**literal**\n2 * 3'), 'Before **literal** 2 * 3');
  assert.equal(plainChatPreview('\u0000preview0\u0000 **ok**'), '\u0000preview0\u0000 ok');
  assert.equal(plainChatPreview('['.repeat(2000)), '['.repeat(2000));
});
