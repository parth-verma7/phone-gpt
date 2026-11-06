const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies={}) {
 const exports={};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>{if(name in dependencies)return dependencies[name];throw Error(name)}});
 return exports;
}
const usage=load('src/services/webContextUsage.ts');
test('grounded context includes the hidden input and reply without double-counting evidence',()=>{
 const data={modelId:'qwen',contextSize:2048,inputTokens:700,evidenceTokens:250,outputTokens:100};
 assert.equal(usage.matchingWebUsage(data,'qwen',2048),data);
 assert.equal(usage.webUsageTotal(data),800);
});
test('saved usage cannot bleed into a different model/window or accept malformed old JSON',()=>{
 const data={modelId:'qwen',contextSize:2048,inputTokens:700,evidenceTokens:250,outputTokens:100};
 for(const value of [undefined,null,{}, {...data,inputTokens:-1},{...data,evidenceTokens:701},{...data,outputTokens:Infinity},{...data,outputTokens:'100'}])assert.equal(usage.matchingWebUsage(value,'qwen',2048),undefined);
 assert.equal(usage.matchingWebUsage(data,'deepseek',2048),undefined);
 assert.equal(usage.matchingWebUsage(data,'qwen',4096),undefined);
});
test('search overlay is app-owned, removable, accessible and does not block composer/Stop',()=>{
 const jsx=(type,props)=>({type,props});
 const {WebSearchOverlay}=load('src/components/WebSearchOverlay.tsx',{
  'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-native':{ActivityIndicator:'Spinner',View:'View',StyleSheet:{absoluteFillObject:{position:'absolute'}}},
  './ScaledText':{ScaledText:'Text'},
  '../theme/AppTheme':{useAppTheme:()=>({colors:{surface:'#fff',text:'#111',primary:'#066',border:'#ddd'}})},
 });
 assert.equal(WebSearchOverlay({visible:false}),null);
 const overlay=WebSearchOverlay({visible:true});
 assert.equal(overlay.props.pointerEvents,'none');
 const card=overlay.props.children;
 assert.equal(card.props.accessibilityRole,'progressbar');
 assert.equal(card.props.accessibilityState.busy,true);
 assert.equal(card.props.children[1].props.children,'Searching the web…');
});

test('active search input is visible before the first reply and stays scoped to that turn',()=>{
 const metrics={modelId:'qwen',contextSize:2048,inputTokens:700,evidenceTokens:250,outputTokens:0};
 const active={chatId:'chat-a',userId:'question',usage:metrics};
 const chat={id:'chat-a',messages:[{id:'question'}]};
 assert.equal(usage.resolveWebUsage(chat,active,'qwen',2048),metrics);
 assert.equal(usage.resolveWebUsage({...chat,id:'chat-b'},active,'qwen',2048),undefined);
 assert.equal(usage.resolveWebUsage({...chat,messages:[{id:'new-question'}]},active,'qwen',2048),undefined);
 assert.equal(usage.resolveWebUsage(null,active,'qwen',2048),undefined);
 const finished={...metrics,outputTokens:128};
 const restored={id:'chat-a',messages:[{id:'answer',contextUsage:JSON.parse(JSON.stringify(finished))}]};
 assert.equal(usage.webUsageTotal(usage.resolveWebUsage(restored,null,'qwen',2048)),828);
});

test('Web on is a filled accent control and off is a neutral surface with explicit switch state',()=>{
 const jsx=(type,props)=>({type,props});
 const colors={primary:'accent',onPrimary:'on-accent',surface:'surface',raised:'raised',border:'border',secondary:'secondary'};
 const {WebSearchControls}=load('src/components/WebSearchControls.tsx',{
  'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{Pressable:'Button'},'../theme/AppTheme':{useAppTheme:()=>({colors})},'../theme/controlStyles':load('src/theme/controlStyles.ts'),'./AppIcon':{AppIcon:'Icon'},'./ScaledText':{ScaledText:'Text'},
 });
 for(const enabled of [true,false]){
  const control=WebSearchControls({enabled,onToggle(){}});
  assert.equal(control.props.accessibilityState.checked,enabled);
  const style=Object.assign({},...control.props.style({pressed:false}));
  assert.equal(style.backgroundColor,enabled?'accent':'surface');
  assert.equal(control.props.children[0].props.color,enabled?'on-accent':'secondary');
  assert.equal(control.props.children[1].props.style.color,enabled?'on-accent':'secondary');
 }
});
