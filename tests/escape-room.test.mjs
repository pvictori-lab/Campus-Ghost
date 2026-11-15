import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {actInRoom,newEscapeState,ESCAPE_QUEST} from '../public/escape-room.js';
import {startQuest,createProgressStore} from '../public/quests.js';

test('room puzzles enforce discovery, correct code, key use, and final combination',()=>{
 let state=newEscapeState();
 const act=(action,value)=>{state=actInRoom(state,action,value).state;};
 act('desk','427');assert.equal(state.desk,false);
 act('key');assert.equal(state.keyUsed,false);
 act('exit','742');assert.equal(state.escaped,false);
 act('collect');assert.equal(state.note,true);
 act('desk','000');assert.equal(state.desk,false);
 act('desk','427');assert.equal(state.desk,true);
 act('exit','742');assert.equal(state.escaped,false);
 act('key');act('exit','427');assert.equal(state.escaped,false);
 act('exit','742');assert.equal(state.escaped,true);
 assert.deepEqual(actInRoom(state,'collect').state,state);
 assert.deepEqual(newEscapeState(),{note:false,desk:false,keyUsed:false,escaped:false,hints:0});
});

test('hints reveal three increasingly explicit steps without solving the room',()=>{
 let state=newEscapeState();const messages=[];
 for(let i=0;i<4;i++){const result=actInRoom(state,'hint');state=result.state;messages.push(result.message);}
 assert.equal(state.hints,3);assert.equal(state.escaped,false);assert.equal(state.note,false);
 assert.match(messages[0],/ivy/);assert.match(messages[1],/4 → 2 → 7/);assert.match(messages[2],/742/);assert.equal(messages[2],messages[3]);
});

function fakeDOM(){
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.style={setProperty(){}};this.disabled=false;this.hidden=false;this.textContent='';this.value='';}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items;}
  setAttribute(key,value){this[key]=value;}
  addEventListener(name,fn){this.listeners[name]=fn;}
  removeEventListener(name){delete this.listeners[name];}
  focus(){this.focused=true;}
  click(){if(!this.disabled)this.listeners.click?.();}
 }
 const root=new Element('main');root.id='campus-quests';
 const walk=el=>[el,...el.children.flatMap(walk)];
 const all=()=>walk(root);
 const find=fn=>{const match=all().find(fn);assert.ok(match,'Expected DOM element');return match;};
 return {all,document:{getElementById:id=>all().find(el=>el.id===id),createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)},
  button:text=>find(el=>el.tagName==='button'&&el.textContent===text),object:name=>find(el=>el['aria-label']===`Inspect ${name}`),
  submit(type,value){const input=find(el=>el.id===`escape-${type}-code`);assert.equal(input.disabled,false);input.value=value;const form=find(el=>el.tagName==='form'&&el.children.includes(input));form.listeners.submit({preventDefault(){}});},
 };
}

test('standalone integration: complete, restart, replay, reload, leave, reset and callback XP',async()=>{
 const names=['document','fetch','localStorage','confirm'];const original=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const ui=fakeDOM(),entries=new Map();let allowRestart=false;const events=[];
 const content=JSON.parse(await readFile(new URL('../public/quests.json',import.meta.url),'utf8'));
 Object.defineProperties(globalThis,{
  document:{configurable:true,writable:true,value:ui.document},
  fetch:{configurable:true,writable:true,value:async()=>({ok:true,json:async()=>content})},
  localStorage:{configurable:true,writable:true,value:{getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value)}},
  confirm:{configurable:true,writable:true,value:()=>allowRestart},
 });
 const open=()=>startQuest({roomId:'demo-room',ghostId:'demo-ghost',onComplete:result=>events.push(result)});
 let controller;
 const launchEscape=()=>{
 const random=Math.random;Math.random=()=>0;
 try{
  ui.button('Give me a game instead').click();
  if(!ui.all().some(el=>el['aria-label']==='Inspect wall inscription')){ui.button('Exit game').click();ui.button('Give me a game instead').click();}
 }finally{Math.random=random;}
};
 const solve=()=>{
  ui.object('ivy pot').click();ui.button('Collect folded note').click();
  ui.object('locked desk').click();ui.submit('desk','000');assert.ok(ui.all().some(el=>el.textContent.startsWith('Not quite')));
  ui.submit('desk','427');ui.object('exit door').click();ui.button('Use brass key').click();ui.submit('exit','742');
 };
 try{
  controller=await open();launchEscape();
  ui.object('wall inscription').click();assert.ok(ui.all().some(el=>el.textContent.includes('look beneath the ivy')));
  ui.object('locked desk').click();assert.equal(ui.document.getElementById('escape-desk-code').disabled,true);
  ui.button('Hint 1 of 3').click();ui.button('Hint 2 of 3').click();ui.button('Hint 3 of 3').click();assert.equal(ui.button('Hint 3 of 3').disabled,true);
  solve();assert.equal(events.length,1);assert.deepEqual(events[0],{questId:ESCAPE_QUEST.id,roomId:'demo-room',ghostId:'demo-ghost',outcome:'completed',xpAwarded:80});
  assert.match(ui.document.getElementById('escape-reward').textContent,/80 XP/);
  ui.button('Restart room').click();assert.ok(ui.all().some(el=>el.textContent==='Room escaped!'));
  allowRestart=true;ui.button('Restart room').click();assert.ok(ui.button('Hint 1 of 3'));solve();assert.equal(events.at(-1).xpAwarded,0);assert.equal(events.length,2);
  ui.button('Return to ghost offer').click();launchEscape();ui.object('ivy pot').click();ui.button('Collect folded note').click();ui.button('Restart room').click();assert.ok(ui.all().some(el=>el.textContent==='Nothing collected yet. Inspect the room to begin.'));
  ui.button('Leave room').click();assert.equal(events.at(-1).outcome,'abandoned');assert.equal(events.at(-1).xpAwarded,0);
  controller.destroy();controller=await open();launchEscape();solve();assert.equal(events.at(-1).xpAwarded,0);
  ui.button('Return to ghost offer').click();createProgressStore(globalThis.localStorage).reset();assert.equal(createProgressStore(globalThis.localStorage).snapshot().xp,0);
  launchEscape();solve();assert.equal(events.at(-1).xpAwarded,80);
 }finally{
  controller?.destroy();for(const [name,descriptor]of original){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
 }
});
