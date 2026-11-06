const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const fflate=require('fflate');
function load(file,modules={},globals={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,...globals,require:name=>{if(name in modules)return modules[name];throw Error(name)}});
 return exports;
}
const archiveApi=load('src/services/chatExport.ts',{'fflate':fflate});
const chat=id=>({id,createdAt:1793900000000,systemPrompt:'Private instructions',messages:[{id:'1793900000000-user',role:'user',content:'नमस्ते 👋'},{id:'1793900000001-assistant',role:'assistant',content:'Hello\n1. One\n2. Two',web:{provider:'brave',retrievedAt:'2026-11-06T00:00:00Z',sources:[{id:'1',title:'Example',url:'https://example.com',snippet:'Evidence'}]}}]});
const unpack=bytes=>Object.fromEntries(Object.entries(fflate.unzipSync(bytes)).map(([name,data])=>[name,fflate.strFromU8(data)]));
test('ZIP round-trip preserves selected UUID transcripts, UTF-8, metadata and web sources',async()=>{
 const result=await archiveApi.buildChatArchive([chat('chat-a'),chat('chat-b')],async()=>assert.fail('unexpected attachment'));
 const files=unpack(result.bytes);
 assert.equal(result.count,2);assert.ok(files['chats/chat-a.txt']);assert.ok(files['chats/chat-b.json']);
 assert.match(files['chats/chat-a.txt'],/नमस्ते 👋/);assert.match(files['chats/chat-a.txt'],/https:\/\/example.com/);
 const structured=JSON.parse(files['chats/chat-a.json']);assert.equal(structured.id,'chat-a');assert.equal(structured.systemPrompt,'Private instructions');assert.equal(structured.messages[1].web.sources[0].snippet,'Evidence');
 const subset=unpack((await archiveApi.buildChatArchive([chat('chat-b')],async()=>'' )).bytes);
 assert.equal(subset['chats/chat-a.txt'],undefined);assert.ok(subset['chats/chat-b.txt']);
});
test('attachment contents travel without private URIs and missing files are reported',async()=>{
 const c=chat('with-file');c.messages[0].attachments=[{name:'../../notes.txt',uri:'file:///private/device/secret.txt',size:12},{name:'gone.txt',uri:'file:///gone',size:1}];
 const result=await archiveApi.buildChatArchive([c],async file=>{if(file.name==='gone.txt')throw Error('gone');return 'File contents';});
 const files=unpack(result.bytes);assert.equal(files['attachments/with-file/0-0.txt'],'File contents');assert.equal(result.warnings.length,1);
 assert.equal(Object.values(files).join('').includes('file:///'),false);
 const json=JSON.parse(files['chats/with-file.json']);assert.equal(json.messages[0].attachments[1].unavailable,true);
 assert.equal(Object.keys(files).some(name=>name.includes('..')),false);
});
test('empty, duplicate, unsafe and oversized exports fail before producing an archive',async()=>{
 for(const chats of [[],[chat('../escape')],[chat('same'),chat('same')]])await assert.rejects(archiveApi.buildChatArchive(chats,async()=>''));
 const c=chat('large');c.messages[0].content='x'.repeat(26*1024*1024);await assert.rejects(archiveApi.buildChatArchive([c],async()=>''),/too large/);
});
function nativeHarness({granted=true,failWrite=false}={}){
 const calls=[];let written;
 const system={StorageAccessFramework:{requestDirectoryPermissionsAsync:async()=>({granted,directoryUri:'content://folder'}),createFileAsync:async(...args)=>{calls.push(['create',...args]);return 'content://archive'}},EncodingType:{Base64:'base64',UTF8:'utf8'},writeAsStringAsync:async(uri,data)=>{calls.push(['write',uri]);if(failWrite)throw Error('disk full');written=data;},deleteAsync:async(uri)=>calls.push(['delete',uri])};
 const api=load('src/services/chatExportDevice.ts',{'react-native':{Platform:{OS:'android'}},'expo-file-system/legacy':system,buffer:{Buffer},'./chatExport':archiveApi});
 return {api,calls,written:()=>written};
}
test('Android folder cancellation writes nothing',async()=>{
 const h=nativeHarness({granted:false});assert.equal((await h.api.exportChatsToDevice([chat('a')])).status,'cancelled');assert.equal(h.calls.length,0);
});
test('Android saves a readable ZIP through the system-selected folder and cleans a failed write',async()=>{
 const h=nativeHarness();const result=await h.api.exportChatsToDevice([chat('a')]);assert.equal(result.status,'saved');assert.equal(h.calls[0][1],'content://folder');assert.ok(unpack(Buffer.from(h.written(),'base64'))['chats/a.txt']);
 const bad=nativeHarness({failWrite:true});await assert.rejects(bad.api.exportChatsToDevice([chat('a')]),/disk full/);assert.deepEqual(bad.calls.at(-1),['delete','content://archive']);
});
test('single All chats toggle clears/selects everything and supports individual choices without modifying history',async()=>{
 let cells=[],cursor=0,sent;const chats=[chat('a'),chat('b')];
 const jsx=(type,props)=>({type,props});
 const React={useState(initial){const i=cursor++;if(!(i in cells))cells[i]=initial;return[cells[i],v=>cells[i]=typeof v==='function'?v(cells[i]):v]},useRef(initial){const i=cursor++;return cells[i]??={current:initial}},useEffect(){}};
 const {ChatExport}=load('src/components/ChatExport.tsx',{'react':React,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{Platform:{OS:'android'},ActivityIndicator:'Spinner',FlatList:'List',Modal:'Modal',Pressable:'Pressable',View:'View'},'react-native-safe-area-context':{SafeAreaView:'Safe'},'../theme/AppTheme':{useAppTheme:()=>({colors:{}})},'../theme/controlStyles':load('src/theme/controlStyles.ts'),'../services/chatHistory':load('src/services/chatHistory.ts', { './chatPreview': load('src/services/chatPreview.ts') }),'../services/chatExportDevice':{exportChatsToDevice:async selection=>{sent=selection;return{status:'saved',count:selection.length,fileName:'test.zip',warnings:[]}}},'./AppIcon':{AppIcon:'Icon'},'./UiKit':{ActionButton:'Button'},'./ScaledText':{ScaledText:'Text'}});
 const render=()=>{cursor=0;return ChatExport({open:true,chats,onClose(){}})};
 function find(node,p){if(!node||typeof node!=='object')return;if(p(node))return node;for(const child of[node.props?.children].flat(Infinity)){const found=find(child,p);if(found)return found}}
 const button=(tree,label)=>find(tree,n=>n.type==='Button'&&n.props.label===label);
 const allToggle=tree=>find(tree,n=>n.props?.accessibilityRole==='checkbox'&&n.props.accessibilityLabel==='All chats');
 let tree=render();assert.equal(button(tree,'Export 2 chats').props.disabled,false);assert.equal(allToggle(tree).props.accessibilityState.checked,true);
 assert.equal(button(tree,'Choose chats'),undefined);assert.equal(button(tree,'Select all'),undefined);
 allToggle(tree).props.onPress();tree=render();assert.equal(button(tree,'Export 0 chats').props.disabled,true);
 find(tree,n=>n.type==='List').props.renderItem({item:chats[1]}).props.onPress();tree=render();assert.ok(button(tree,'Export 1 chat'));
 allToggle(tree).props.onPress();tree=render();assert.ok(button(tree,'Export 2 chats'));
 allToggle(tree).props.onPress();tree=render();assert.ok(button(tree,'Export 0 chats'));
 find(tree,n=>n.type==='List').props.renderItem({item:chats[0]}).props.onPress();tree=render();button(tree,'Export 1 chat').props.onPress();await new Promise(resolve=>setImmediate(resolve));assert.equal(sent.length,1);assert.equal(sent[0].id,'a');assert.equal(chats.length,2);
});
