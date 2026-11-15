import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mountQuestPreview,PREVIEW_CONTEXT,PANEL_PROTOCOL} from '../public/quests-preview.js';
import {mountQuestPanel} from '../public/quests-panel.js';
import {createProgressStore} from '../public/quests.js';

function eventTarget(){
 const listeners=new Map();return {addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},dispatch(type,event){return Promise.all([...listeners.get(type)||[]].map(fn=>fn(event)));}};
}
function fakeClock(){let next=0;const tasks=new Map();return {setTimeout(fn){tasks.set(++next,fn);return next;},clearTimeout(id){tasks.delete(id);},flush(){for(const [id,fn]of [...tasks]){tasks.delete(id);fn();}},get size(){return tasks.size;}};}
function fakeDocument(host=false){
 class Element{
  constructor(tag){Object.assign(this,eventTarget());this.tagName=tag;this.children=[];this.style={setProperty(){}};this.textContent='';this.disabled=false;this.open=false;this.classList={add(){}};if(tag==='iframe')this.contentWindow={messages:[],postMessage(data,origin){this.messages.push({data,origin});}};}
  append(...items){for(const item of items)item.parent=this;this.children.push(...items);}
  replaceChildren(...items){this.children=[];this.append(...items);}
  setAttribute(key,value){this[key]=value;}
  focus(){this.focused=true;}
  click(){if(!this.disabled)return this.dispatch('click',{});}
  showModal(){this.open=true;}close(){this.open=false;this.dispatch('close',{});}
  remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
 }
 const root=new Element('main');root.id='campus-quests';const walk=el=>[el,...el.children.flatMap(walk)];const all=()=>walk(root);
 if(host)for(const id of ['quest-dialog','quest-panel-slot','open-quest','close-quest','host-status','host-xp','quest-debug']){const el=new Element('div');el.id=id;root.append(el);}
 const document={getElementById:id=>all().find(el=>el.id===id),createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)};
 return {document,root,all,button(text){const found=all().find(el=>el.tagName==='button'&&el.textContent===text);assert.ok(found,`Missing button ${text}`);return found;}};
}
function fakeWindow(){const win={...eventTarget(),location:{origin:'http://localhost:3000'}};win.parent={messages:[],postMessage(data,origin){this.messages.push({data,origin});}};return win;}
const message=(win,data,source=win.parent,origin=win.location.origin)=>win.dispatch('message',{source,origin,data:{protocol:PANEL_PROTOCOL,...data}});
function override(values){const prior=new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const [key,value]of Object.entries(values))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});return ()=>{for(const [key,descriptor]of prior){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}};}

test('host handshake validates sources, shows callbacks/XP, destroys before reopen and cleans timeout',async()=>{
 const ui=fakeDocument(true),win=fakeWindow(),clock=fakeClock(),preview=mountQuestPreview({document:ui.document,window:win,clock});const get=id=>ui.document.getElementById(id);
 try{
  preview.open();preview.open();assert.equal(get('quest-panel-slot').children.length,1);assert.equal(get('quest-dialog').open,true);
  let frame=get('quest-panel-slot').children[0];const fromFrame=data=>message(win,data,frame.contentWindow);
  await message(win,{event:'ready'},{},'http://evil.invalid');assert.equal(frame.contentWindow.messages.length,0);
  await fromFrame({event:'ready'});await fromFrame({event:'ready'});assert.equal(frame.contentWindow.messages.length,1);assert.deepEqual(frame.contentWindow.messages[0].data,{protocol:PANEL_PROTOCOL,command:'open',...PREVIEW_CONTEXT});
  await fromFrame({event:'progress',xp:180});assert.equal(get('host-xp').textContent,'180');
  await fromFrame({event:'result',result:{questId:'ghost-trivia-streak-v1',...PREVIEW_CONTEXT,outcome:'completed',xpAwarded:100}});assert.match(get('quest-debug').textContent,/completed/);
  preview.close();assert.equal(get('quest-dialog').open,false);assert.equal(clock.size,1);assert.equal(frame.contentWindow.messages.at(-1).data.command,'destroy');
  preview.open();assert.match(get('host-status').textContent,/Finishing cleanup/);
  await fromFrame({event:'destroyed'});assert.equal(clock.size,0);assert.equal(get('quest-dialog').open,true);assert.equal(get('host-xp').textContent,'180');
  await get('quest-dialog').dispatch('close',{});assert.equal(get('quest-dialog').open,true,'Late close event from the old dialog must not close its reopened session');
  const stale=frame;frame=get('quest-panel-slot').children[0];assert.notEqual(frame,stale);
  await message(win,{event:'progress',xp:999},stale.contentWindow);assert.equal(get('host-xp').textContent,'180');
  // Escape/dialog cancel follows the same cleanup path, including load failures.
  await get('quest-dialog').dispatch('cancel',{preventDefault(){}});assert.equal(get('quest-dialog').open,false);clock.flush();assert.equal(get('quest-panel-slot').children.length,0);
 }finally{preview.destroy();assert.equal(clock.size,0);}
});

test('child bridge completes real trivia, preserves XP across closing/reopening, and tears down',async()=>{
 const ui=fakeDocument(),win=fakeWindow(),entries=new Map(),storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value)};
 const bank=JSON.parse(await readFile(new URL('../public/quests.json',import.meta.url),'utf8'));
 const restore=override({document:ui.document,localStorage:storage,fetch:async()=>({ok:true,json:async()=>bank})});let panel;
 try{
  createProgressStore(storage).award('earlier-progress',80);
  panel=mountQuestPanel({window:win});assert.equal(win.parent.messages.at(-1).data.event,'ready');
  await message(win,{command:'open',...PREVIEW_CONTEXT});assert.ok(ui.button('Play trivia'));ui.button('Play trivia').click();
  for(let index=0;index<10;index++){
   const question=bank.trivia.questions.find(q=>q.prompt===ui.all().find(el=>el.tagName==='h3').textContent);ui.button(question.options[question.answerIndex]).click();if(index<9)ui.button('Next question').click();
  }
  const results=()=>win.parent.messages.filter(item=>item.data.event==='result').map(item=>item.data.result);
  assert.deepEqual(results().at(-1),{questId:bank.trivia.id,...PREVIEW_CONTEXT,outcome:'completed',xpAwarded:100});
  assert.equal(createProgressStore(storage).snapshot().xp,180);
  await message(win,{command:'destroy'});assert.equal(ui.root.children.length,0);assert.equal(results().length,1);assert.equal(win.parent.messages.at(-1).data.event,'destroyed');
  panel=mountQuestPanel({window:win});await message(win,{command:'open',...PREVIEW_CONTEXT});assert.ok(ui.button('Play trivia'));assert.equal(win.parent.messages.filter(item=>item.data.event==='progress').at(-1).data.xp,180);
  // Escape from inside the iframe requests the host's close handshake.
  await win.dispatch('keydown',{key:'Escape',preventDefault(){}});assert.equal(win.parent.messages.at(-1).data.event,'close-request');
  ui.button('Play trivia').click();await message(win,{command:'destroy'});assert.equal(results().at(-1).outcome,'abandoned');assert.equal(results().at(-1).xpAwarded,0);assert.equal(createProgressStore(storage).snapshot().xp,180);
 }finally{panel?.destroy();restore();}
});

test('closing during pending startQuest destroys immediately and cannot remount on late load',async()=>{
 const ui=fakeDocument(),win=fakeWindow();let finish;
 const bank=JSON.parse(await readFile(new URL('../public/quests.json',import.meta.url),'utf8'));
 const restore=override({document:ui.document,localStorage:undefined,fetch:()=>new Promise(resolve=>{finish=resolve;})});const panel=mountQuestPanel({window:win});
 try{
  const pending=message(win,{command:'open',...PREVIEW_CONTEXT});assert.ok(ui.root.children.length>0);
  await message(win,{command:'destroy'});assert.equal(ui.root.children.length,0);
  finish({ok:true,json:async()=>bank});await pending;assert.equal(ui.root.children.length,0);assert.equal(win.parent.messages.some(item=>item.data.event==='mounted'),false);
 }finally{panel.destroy();restore();}
});

test('closing a real random memory game cancels playback and stale controls',async()=>{
 const ui=fakeDocument(),win=fakeWindow(),clock=fakeClock();const bank=JSON.parse(await readFile(new URL('../public/quests.json',import.meta.url),'utf8'));
 const restore=override({document:ui.document,localStorage:undefined,fetch:async()=>({ok:true,json:async()=>bank}),setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});const random=Math.random;let panel;
 try{
  panel=mountQuestPanel({window:win});await message(win,{command:'open',...PREVIEW_CONTEXT});Math.random=()=>.99;ui.button('Give me a game instead').click();Math.random=random;
  const oldStart=ui.button('Start game');oldStart.click();assert.equal(clock.size,1);
  await message(win,{command:'destroy'});assert.equal(clock.size,0);oldStart.click();clock.flush();assert.equal(ui.root.children.length,0);assert.equal(clock.size,0);
  assert.equal(win.parent.messages.filter(item=>item.data.event==='result').at(-1).data.result.outcome,'abandoned');
 }finally{Math.random=random;panel?.destroy();restore();}
});

test('preview and standalone use separate documents for CSS; unchanged server serves assets',async()=>{
 const html=await readFile(new URL('../public/quests-preview.html',import.meta.url),'utf8');assert.doesNotMatch(html,/(?:href|src)=["'](?:quests\.css|app\.js|styles\.css|quest-toon\.js)/);
 const panel=await readFile(new URL('../public/quests-panel.html',import.meta.url),'utf8');assert.match(panel,/href="quests.css"/);assert.match(await readFile(new URL('../public/quests.html',import.meta.url),'utf8'),/href="quests.css"/);
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'31989',OPENAI_API_KEY:''},stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Server exited early');})]);
  for(const file of ['quests-preview.html','quests-preview.css','quests-preview.js','quests-panel.html','quests-panel.js','quests.html'])assert.equal((await fetch(`http://127.0.0.1:31989/${file}`)).status,200);
 }finally{child.kill();await once(child,'exit');}
});
