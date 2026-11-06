const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(file,modules={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{if(name in modules)return modules[name];throw Error(name)}});return exports;}
function harness(label='Maximum reply length'){
 const cells=[],effects=[],deps=[];let cursor=0;const calls=[];
 const props={label,value:label==='Conversation context'?2048:384,min:label==='Conversation context'?1024:384,max:8192,presets:[384,512,768,1024,2048,4096],disabled:false,onChange:value=>{calls.push(value);props.value=value}};
 const react={useState(initial){const i=cursor++;if(!(i in cells))cells[i]=initial;return[cells[i],v=>{cells[i]=typeof v==='function'?v(cells[i]):v}]},useRef(initial){const i=cursor++;return cells[i]??={current:initial}},useEffect(fn,values){const i=cursor++;if(!deps[i]||values.some((v,n)=>v!==deps[i][n])){deps[i]=values;effects.push(fn)}}};
 const jsx=(type,props)=>({type,props});
 const {TokenLimitControl}=load('src/components/TokenLimitControl.tsx',{'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',Pressable:'Button',PanResponder:{create:panHandlers=>({panHandlers})}},'../theme/controlStyles':load('src/theme/controlStyles.ts'),'../theme/AppTheme':{useAppTheme:()=>({colors:{primary:'green',raised:'pale',onPrimary:'white',muted:'grey'}})},'./ScaledText':{ScaledText:'Text',ScaledTextInput:'Input'},'../services/tokenLimits':load('src/services/tokenLimits.ts')});
 const render=()=>{cursor=0;TokenLimitControl(props);while(effects.length)effects.shift()();cursor=0;return TokenLimitControl(props)};
 function find(node,p){if(!node||typeof node!=='object')return;if(p(node))return node;for(const child of[node.props?.children].flat(Infinity)){const result=find(child,p);if(result)return result}}
 const field=tree=>find(tree,n=>n.type==='Input');const apply=tree=>find(tree,n=>n.props?.accessibilityLabel===`Apply ${label.toLowerCase()}`);const slider=tree=>find(tree,n=>n.props?.accessibilityRole==='adjustable');
 return{props,calls,render,find,field,apply,slider};
}
test('pending typed values turn Apply green, commit once, then become subdued for both controls',()=>{
 for(const label of ['Maximum reply length','Conversation context']){
  const h=harness(label);let tree=h.render();assert.equal(h.apply(tree).props.disabled,true);
  const next=label==='Conversation context'?'4096':'768';h.field(tree).props.onChangeText(next);tree=h.render();assert.equal(h.calls.length,0);assert.equal(h.apply(tree).props.disabled,false);assert.equal(h.apply(tree).props.style[1].backgroundColor,'green');
  h.apply(tree).props.onPress();tree=h.render();assert.deepEqual(h.calls,[Number(next)]);assert.equal(h.apply(tree).props.disabled,true);assert.equal(h.apply(tree).props.style[1].backgroundColor,'pale');h.apply(tree).props.onPress();assert.equal(h.calls.length,1);
 }
});
test('presets and dragging stage changes without reloading context until Apply',()=>{
 const h=harness('Conversation context');let tree=h.render();h.find(tree,n=>n.props?.accessibilityLabel==='Conversation context: 4096 tokens').props.onPress();tree=h.render();assert.equal(h.field(tree).props.value,'4096');assert.equal(h.calls.length,0);
 let slider=h.slider(tree);slider.props.onLayout({nativeEvent:{layout:{width:100}}});slider.props.onPanResponderGrant({nativeEvent:{locationX:70}});slider.props.onPanResponderMove(null,{dx:20});slider.props.onPanResponderRelease();tree=h.render();assert.equal(h.calls.length,0);const draft=Number(h.field(tree).props.value);assert.ok(draft>4096&&draft<=8192);h.apply(tree).props.onPress();assert.deepEqual(h.calls,[draft]);
});
test('invalid/unchanged values cannot apply and the heading does not repeat the current value',()=>{
 const h=harness();let tree=h.render();assert.equal(tree.props.children[0].props.children,'Maximum reply length');
 for(const value of ['0','-1','3.5','no','999999','']){h.field(tree).props.onChangeText(value);tree=h.render();assert.equal(h.apply(tree).props.disabled,true);h.apply(tree).props.onPress();assert.equal(h.calls.length,0)}
 h.field(tree).props.onBlur();tree=h.render();assert.ok(h.find(tree,n=>n.props?.accessibilityRole==='alert'));
 h.field(tree).props.onChangeText('384');tree=h.render();assert.equal(h.apply(tree).props.disabled,true);
});
