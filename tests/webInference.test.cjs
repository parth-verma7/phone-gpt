const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, requireStub) {
 const exports = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText, {exports,require:requireStub,setInterval,clearInterval});
 return exports;
}
async function harness(text) {
 let params;
 const tokens=load('src/services/tokenLimits.ts');
 const api=load('src/services/localInference.ts', name=>{
  if(name==='react-native')return {Platform:{OS:'android'}};
  if (name === '../config/systemPrompt') { const result = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/config/systemPrompt.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: result }); return result; }
  if(name==='./tokenLimits')return tokens;
  if(name==='llama.rn')return {initLlama:async()=>({completion:async(p)=>{params=p;if(text instanceof Error)throw text;return {text}},stopCompletion:async()=>{},release:async()=>{},tokenize:async()=>({tokens:[]})})};
  throw Error(name);
 });
 await api.loadLocalModel({id:'mock'},'mock.gguf',2048);
 return {api,params:()=>params};
}
test('uncertain search routing uses a short YES/NO pass without chat history or JSON schema',async()=>{
 const h=await harness('YES');
 assert.equal(await h.api.shouldSearchWithLocalModel('Who leads this company?',h.api.DEFAULT_INFERENCE_SETTINGS),true);
 const p=h.params();assert.equal(p.response_format,undefined);assert.equal(p.temperature,0);assert.equal(p.n_predict,16);
 assert.equal(p.messages.length,2);assert.match(p.messages[0].content,/timeless definitions/);assert.match(p.messages[0].content,/historical office holders/);assert.match(p.messages[0].content,/explicitly requested web search/);assert.equal(p.messages[1].content,'Who leads this company?');
});
test('invalid local routing output falls back to local without failing the turn',async()=>{
 const h=await harness('Perhaps search the web.');
 assert.equal(await h.api.shouldSearchWithLocalModel('Question',h.api.DEFAULT_INFERENCE_SETTINGS),false);
});
test('timeless routing result and pre-aborted decision',async()=>{
 const h=await harness('NO');
 assert.equal(await h.api.shouldSearchWithLocalModel('Explain recursion',h.api.DEFAULT_INFERENCE_SETTINGS),false);
 const c=new AbortController();c.abort();
 await assert.rejects(h.api.shouldSearchWithLocalModel('Question',h.api.DEFAULT_INFERENCE_SETTINGS,c.signal),e=>e.name==='GenerationStoppedError');
});
test('display removes known and unknown numeric citations while source cards stay separate',()=>{
 const api=load('src/services/webCitations.ts');
 const provenance={sources:[{id:'1'},{id:'2'}]};
 const original=JSON.stringify(provenance);
 assert.equal(api.validateWebCitationMarkers('Fact [1]. More [9]. Year 2026.',provenance),'Fact. More. Year 2026.');
 assert.equal(api.validateWebCitationMarkers('42[1][2]; 17[999].',provenance),'42; 17.');
 assert.equal(JSON.stringify(provenance),original);
});
test('citation display preserves Markdown code and JSON exactly',()=>{
 const api=load('src/services/webCitations.ts');
 const blocks=[
  '`arr[1]` and `JSON: [1]`',
  '``literal ` and [1]``',
  '```json\n{"items": [1], "nested": [[2]]}\n```',
  '~~~json\r\n[1]\r\n~~~',
  '````markdown\n```json\n[1]\n```\n````',
  '    arr[1]\n    [2]',
  '```json\n[1]',
  '`unfinished [1]',
 ];
 for(const block of blocks) {
  const input='Fact [1].\n'+block;
  assert.equal(api.validateWebCitationMarkers(input,{sources:[]}),'Fact.\n'+block,input);
 }
 assert.equal(api.validateWebCitationMarkers('`[1]` Fact [2]. ```[3]``` More [4].',{sources:[]}),'`[1]` Fact. ```[3]``` More.');
});
test('citation display preserves array subscripts, escapes and explicit link labels',()=>{
 const api=load('src/services/webCitations.ts');
 const text='arr[1], arr2[2], matrix[1][2], getItems()[1], obj.items[3], 数组[1], \\[1].\n'+
  '[1](https://example.com/items[2]) [2][reference] [3][] ![4](image.png) [outer [5]](https://example.com)\n'+
  '[6][7] [8]\n[7]: https://example.com\n[8]: https://example.org';
 assert.equal(api.validateWebCitationMarkers(text,{sources:[]}),text);
});
test('citation spacing changes stay local and leave prose and code spacing intact',()=>{
 const api=load('src/services/webCitations.ts');
 for(const [input,expected] of [
  ['Fact [1]. Next [2], yes [3]; fine [4]!', 'Fact. Next, yes; fine!'],
  ['One  [1] \t [2]   two.', 'One two.'],
  ['Fact. [1] Next.', 'Fact. Next.'],
  ['Fact [1]\n\nNext.', 'Fact\n\nNext.'],
  ['Unchanged  spacing.\n\nFact [1].\n`a  [2]  b`', 'Unchanged  spacing.\n\nFact.\n`a  [2]  b`'],
 ]) assert.equal(api.validateWebCitationMarkers(input,{sources:[]}),expected,input);
});
test('citation display preserves prose, specific uncertainty, formatting and existing links',()=>{
 const api=load('src/services/webCitations.ts');
 const text='The price is 42 USD as of 2026-11-06.\n\nSource 2 confirms the earlier value, but the latest figure is missing. Link 2 says the estimate conflicts.\n- Keep this context.\n[1](https://example.com) [2][reference] [reference] [2026]';
 assert.equal(api.validateWebCitationMarkers(text,{sources:[{id:'2'}]}),text);
 assert.equal(api.validateWebCitationMarkers('The current value is missing.[2]\nThe 2020 estimate was 42 USD.',{sources:[]}), 'The current value is missing.\nThe 2020 estimate was 42 USD.');
});

test('search rollout flag behaves identically in Dev and production', () => {
 const code=ts.transpileModule(fs.readFileSync('src/config/webSearch.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 function flags(dev, enabled) {
  const exports={};
  vm.runInNewContext(code,{exports,__DEV__:dev,process:{env:{EXPO_PUBLIC_WEB_SEARCH_ENABLED:enabled,EXPO_PUBLIC_WEB_SEARCH_API_URL:'https://search.example/'}}});
  return exports;
 }
 assert.equal(flags(true,'true').WEB_SEARCH_FEATURE_ENABLED,true);
 assert.equal(flags(false,'true').WEB_SEARCH_FEATURE_ENABLED,true);
 assert.equal(flags(true,'false').WEB_SEARCH_FEATURE_ENABLED,false);
 assert.equal(flags(true,undefined).WEB_SEARCH_FEATURE_ENABLED,false);
 assert.equal(flags(true,'true').WEB_SEARCH_API_URL,'https://search.example');
 const preference=flags(true,'true').restoreWebPreference;
 assert.equal(preference(null),true);
 assert.equal(preference('true'),true);
 assert.equal(preference('false'),false);
 assert.equal(preference('malformed'),false);
});

test('routing parses leading YES/NO with a short second line but rejects ambiguous or reasoning-only text', async () => {
 const h=await harness('YES');
 for(const text of ['YES', 'yes.', 'Decision: YES\nNeeds fresh information.', '<think>maybe no</think>\nYES']) assert.equal(h.api.parseSearchDecision(text),true,text);
 for(const text of ['NO', 'No. A timeless concept.', 'Answer: NO\nCan answer locally.']) assert.equal(h.api.parseSearchDecision(text),false,text);
 for(const text of ['Perhaps yes.', 'YES or NO', '', '<think>YES', 'I think it needs verification']) assert.equal(h.api.parseSearchDecision(text),null,text);
});
test('native routing failure falls back to a local answer instead of a decision error', async () => {
 const h=await harness(new Error('Native routing failed'));
 assert.equal(await h.api.shouldSearchWithLocalModel('Question',h.api.DEFAULT_INFERENCE_SETTINGS),false);
});
