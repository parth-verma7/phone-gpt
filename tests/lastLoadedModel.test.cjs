const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const models = require('../src/data/models.json');
const KEY = '@phone-gpt/last-loaded-model';
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness({ hydration, saved = null, write = async () => {} } = {}) {
  const slots = [], effects = [], calls = [];
  let cursor = 0, updates = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(initial) {
      const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { updates++; slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useCallback(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    },
  };
  const storage = {
    getItem(key) { calls.push(['get', key]); return hydration?.promise ?? Promise.resolve(saved); },
    async setItem(key, id) { calls.push(['set', key, id]); await write('set', id); saved = id; },
    async removeItem(key) { calls.push(['remove', key]); await write('remove'); saved = null; },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/hooks/useLastLoadedModel.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  const dependencies = { react, '@react-native-async-storage/async-storage': { default: storage }, '../services/models': { models } };
  vm.runInNewContext(code, { exports, require(name) { if (!(name in dependencies)) throw Error(name); return dependencies[name]; } });
  return {
    calls,
    get saved() { return saved; },
    get updates() { return updates; },
    render() { cursor = 0; const result = exports.useLastLoadedModel(); effects.splice(0).forEach(fn => fn()); return result; },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test('hydrates a catalog model once without writing storage', async () => {
  const h = harness({ saved: models[0].id });
  assert.equal(h.render().model, null);
  await tick(); assert.equal(h.render().model, models[0]); h.render();
  assert.deepEqual(h.calls, [['get', KEY]]);
});

test('missing, unknown and unreadable stored models hydrate safely to null', async () => {
  for (const saved of [null, '', 'removed-model-id']) {
    const h = harness({ saved }); h.render(); await tick();
    assert.equal(h.render().model, null); assert.deepEqual(h.calls, [['get', KEY]]);
  }
  const hydration = deferred(); const h = harness({ hydration }); h.render();
  hydration.reject(Error('storage unavailable')); await tick();
  assert.equal(h.render().model, null);
  h.render().remember(models[0]); await tick();
  assert.equal(h.saved, models[0].id);
});

test('remember updates immediately, persists and hydrates on a new mount', async () => {
  const h = harness(); h.render(); await tick();
  h.render().remember(models[0]); assert.equal(h.render().model, models[0]);
  await tick(); assert.equal(h.saved, models[0].id);
  assert.deepEqual(h.calls, [['get', KEY], ['set', KEY, models[0].id]]);
  const remounted = harness({ saved: h.saved }); remounted.render(); await tick();
  assert.equal(remounted.render().model, models[0]);
});

test('forget only removes the current model and clears it immediately', async () => {
  const h = harness({ saved: models[0].id }); h.render(); await tick();
  h.render().forget(models[1].id); await tick();
  assert.equal(h.render().model, models[0]); assert.equal(h.calls.length, 1);
  h.render().forget(models[0].id); assert.equal(h.render().model, null);
  h.render().forget(models[0].id); await tick();
  assert.equal(h.saved, null); assert.deepEqual(h.calls, [['get', KEY], ['remove', KEY]]);
});

test('late hydration cannot overwrite remember or resurrect a subsequently forgotten model', async () => {
  for (const forget of [false, true]) {
    const hydration = deferred(); const h = harness({ hydration }); h.render();
    const actions = h.render(); actions.remember(models[1]);
    if (forget) actions.forget(models[1].id);
    hydration.resolve(models[0].id); await tick();
    assert.equal(h.render().model, forget ? null : models[1]);
    assert.equal(h.saved, forget ? null : models[1].id);
  }
});

test('rapid remember/forget/remember operations serialize writes and persist the latest model', async () => {
  const gates = [deferred(), deferred(), deferred(), deferred()]; let index = 0;
  const h = harness({ write: () => gates[index++].promise }); h.render(); await tick();
  const actions = h.render();
  actions.remember(models[0]); actions.remember(models[1]);
  actions.forget(models[1].id); actions.remember(models[0]);
  assert.equal(h.render().model, models[0]);
  const expected = [['get', KEY], ['set', KEY, models[0].id], ['set', KEY, models[1].id], ['remove', KEY], ['set', KEY, models[0].id]];
  for (let i = 0; i < gates.length; i++) {
    await tick(); assert.equal(index, i + 1); assert.deepEqual(h.calls, expected.slice(0, i + 2));
    gates[i].resolve();
  }
  await tick(); assert.equal(h.saved, models[0].id);
});

test('failed writes do not block subsequent persistence or roll back the current selection', async () => {
  const failure = deferred(); let first = true;
  const h = harness({ write: () => { if (first) { first = false; return failure.promise; } } });
  h.render(); await tick(); h.render().remember(models[0]); await tick();
  failure.reject(Error('disk full')); await tick();
  assert.equal(h.render().model, models[0]);
  h.render().forget(models[0].id); h.render().remember(models[1]); await tick();
  assert.equal(h.saved, models[1].id); assert.equal(h.render().model, models[1]);
  assert.deepEqual(h.calls, [['get', KEY], ['set', KEY, models[0].id], ['remove', KEY], ['set', KEY, models[1].id]]);
});

test('unmount ignores late hydration without scheduling state updates', async () => {
  const hydration = deferred(); const h = harness({ hydration }); h.render();
  h.unmount(); const updates = h.updates;
  hydration.resolve(models[0].id); await tick(); assert.equal(h.updates, updates);
});
