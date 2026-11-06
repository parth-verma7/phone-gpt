const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies, globals = {}) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, AbortController, setTimeout, clearTimeout, ...globals, require(name) {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const valid = { name: 'Parth', email: 'reply+phone@example.com', message: 'Please help.' };
function service(fetchImpl = async () => ({ ok: true }), globals = {}) {
  return load('src/services/contactForm.ts', {}, { fetch: fetchImpl, ...globals });
}

test('direct submission uses only contact fields and fixed Formspree endpoint, preserving long Unicode messages', async () => {
  const calls = [];
  const api = service(async (...args) => { calls.push(args); return { ok: true }; });
  const draft = { name: ' Zoë & 李 ', email: ' reply+phone@example.com ', message: '👋 hello\n'.repeat(2000) };
  assert.equal(await api.sendContactMessage(draft), 'sent');
  assert.equal(calls.length, 1);
  const [url, request] = calls[0];
  assert.equal(url, 'https://formspree.io/f/mljjawvn');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.Accept, 'application/json');
  assert.deepEqual(JSON.parse(request.body), { name: draft.name.trim(), email: draft.email.trim(), message: draft.message.trim(), _subject: 'PhoneGPT feedback' });
  assert.equal(request.signal.aborted, false);
});

test('invalid required/name/email fields never make a request; messages have no application length cap', async () => {
  let calls = 0;
  const api = service(async () => { calls++; return { ok: true }; });
  for (const [field, value] of [['name', ''], ['name', 'N'.repeat(101)], ['name', 'Name\r\nBcc:foo'], ['email', ''], ['email', 'a@b..com'], ['email', 'a@@b.com'], ['email', 'x'.repeat(255)], ['message', '  \n']]) {
    const draft = { ...valid, [field]: value };
    assert.ok(api.validateContactDraft(draft)[field]);
    await assert.rejects(api.sendContactMessage(draft), /Check the contact fields/);
  }
  assert.equal(calls, 0);
  assert.equal(Object.keys(api.validateContactDraft({ ...valid, message: 'x'.repeat(100000) })).length, 0);
});

test('network and HTTP failures never report success or retry automatically', async () => {
  for (const response of [{ ok: false, status: 429 }, { ok: false, status: 413 }, { ok: false, status: 500 }, new Error('offline')]) {
    let calls = 0;
    const api = service(async () => { calls++; if (response instanceof Error) throw response; return response; });
    assert.equal(await api.sendContactMessage(valid), 'unavailable');
    assert.equal(calls, 1);
  }
});

test('timeout aborts a stalled request and releases the timer', async () => {
  let expire, signal, cleared = false;
  const api = service(async (_, request) => { signal = request.signal; return new Promise(() => {}); }, { setTimeout: fn => { expire = fn; return 42; }, clearTimeout: id => { cleared = id === 42; } });
  const pending = api.sendContactMessage(valid);
  expire();
  assert.equal(await pending, 'unavailable'); assert.equal(signal.aborted, true); assert.equal(cleared, true);
});

function formHarness(fetchImpl) {
  const states = [], refs = [], focused = [];
  let stateIndex = 0, refIndex = 0, dismissals = 0;
  const jsx = (type, props) => ({ type, props });
  const api = service(fetchImpl);
  const { ContactForm } = load('src/components/ContactForm.tsx', {
    react: {
      useState(initial) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
      },
      useRef(initial) { return refs[refIndex++] ??= { current: initial }; },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Keyboard: { dismiss() { dismissals++; } }, View: 'View' },
    '../theme/AppTheme': { useAppTheme: () => ({ colors: { text: 'text', secondary: 'secondary', raised: 'raised', border: 'border', error: 'error' }, isDark: true }) },
    '../services/contactForm': api,
    './ScaledText': { ScaledText: 'Text', ScaledTextInput: 'TextInput' },
    './UiKit': { ActionButton: 'ActionButton', SettingsCard: 'SettingsCard' },
  });
  function render() {
    stateIndex = refIndex = 0;
    const nodes = [];
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      nodes.push(node);
      [node.props?.children].flat(Infinity).forEach(visit);
    }
    visit(ContactForm());
    const inputs = nodes.filter((node) => node.type === 'TextInput');
    inputs.forEach((input, index) => { input.props.ref.current = { focus() { focused.push(index); } }; });
    return { inputs, button: nodes.find((node) => node.type === 'ActionButton'), nodes };
  }
  function fill() {
    render().inputs.forEach((input, index) => input.props.onChangeText(Object.values(valid)[index]));
  }
  return { render, fill, focused, dismissals: () => dismissals };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('form focuses invalid input, exposes errors and supports next-field keyboard navigation', async () => {
  let calls = 0;
  const harness = formHarness(async () => { calls++; });
  harness.render().button.props.onPress();
  await settle();
  const form = harness.render();
  assert.equal(calls, 0);
  assert.equal(form.nodes.filter((node) => node.props?.accessibilityRole === 'alert').length, 3);
  assert.deepEqual(harness.focused, [0]);
  form.inputs[0].props.onSubmitEditing();
  form.inputs[1].props.onSubmitEditing();
  assert.deepEqual(harness.focused, [0, 1, 2]);
  assert.equal(form.inputs[1].props.keyboardType, 'email-address');
  assert.equal(form.inputs[2].props.multiline, true);
  assert.equal(form.inputs[2].props.scrollEnabled, true);
  for (const input of form.inputs) assert.equal(input.props.keyboardAppearance, 'dark');
});

test('pending submission blocks duplicate presses; failure preserves draft and allows manual retry', async () => {
  let reject, calls = 0;
  const harness = formHarness(() => { calls++; return new Promise((_, fail) => { reject = fail; }); });
  harness.fill();
  const button = harness.render().button;
  button.props.onPress();
  button.props.onPress();
  assert.equal(calls, 1);
  assert.equal(harness.render().button.props.busy, true);
  assert.equal(harness.dismissals(), 1);
  reject(new Error('Unavailable'));
  await settle();
  const failed = harness.render();
  assert.equal(failed.button.props.busy, false);
  assert.deepEqual(failed.inputs.map((input) => input.props.value), Object.values(valid));
  assert.ok(failed.nodes.some((node) => node.props?.accessibilityRole === 'alert' && /draft is still here/.test(node.props.children)));
  assert.ok(!failed.nodes.some((node) => /gmail\.com|mailto:/.test(String(node.props?.children ?? ''))));
  failed.button.props.onPress();
  assert.equal(calls, 2);
  reject(new Error('Unavailable again'));
  await settle();
});

test('accepted submission clears draft, removes limits and shows acknowledgement without claiming inbox delivery', async () => {
  const harness = formHarness(async () => ({ ok: true }));
  harness.fill();
  harness.render().button.props.onPress();
  await settle();
  const form = harness.render();
  assert.equal(form.button.props.label, 'Send message');
  assert.equal(form.inputs[2].props.maxLength, undefined);
  assert.deepEqual(form.inputs.map((input) => input.props.value), ['', '', '']);
  const notice = form.nodes.find((node) => node.props?.accessibilityLiveRegion === 'polite');
  assert.match(notice.props.children, /message has been submitted/);
  form.inputs[2].props.onChangeText('New draft');
  assert.ok(!harness.render().nodes.some((node) => node.props?.accessibilityLiveRegion));
});
