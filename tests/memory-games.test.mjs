import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MEMORY_GAMES,newMemoryState,memoryAction,mountMemoryGame} from '../public/memory-games.js';
import {startQuest,createProgressStore} from '../public/quests.js';

test('both games have five increasingly long rounds and four distinct signal shapes',()=>{
 assert.equal(new Set(MEMORY_GAMES.signal.items.map(item=>item.shape)).size,4);
 for(const [kind,game]of Object.entries(MEMORY_GAMES)){
  assert.equal(game.rounds.length,5);let length=0;
  for(const sequence of game.rounds){assert.ok(sequence.length>length);length=sequence.length;assert.ok(sequence.every(i=>i>=0&&i<game.items.length));}
  let state=newMemoryState();
  for(let round=0;round<5;round++){
   state=memoryAction(kind,state,'start');
   assert.deepEqual(memoryAction(kind,state,'pick',0),state,'No input during presentation');
   state=memoryAction(kind,state,'ready');
   for(const value of game.rounds[round])state=memoryAction(kind,state,'pick',value);
   if(kind==='potion')state=memoryAction(kind,state,'brew');
  }
  assert.equal(state.phase,'complete');assert.equal(state.score,100);assert.deepEqual(state.roundScores,[20,20,20,20,20]);
  assert.deepEqual(memoryAction(kind,state,'pick',0),state,'No input after completion');
 }
});

test('recipe reveal, undo, wrong orders, retries and restart preserve banked rounds',()=>{
 let state=memoryAction('potion',newMemoryState(),'start');state=memoryAction('potion',state,'ready');
 state=memoryAction('potion',state,'reveal');
 state=memoryAction('potion',state,'pick',0);state=memoryAction('potion',state,'undo');assert.equal(state.input.length,0);
 for(const value of [0,1])state=memoryAction('potion',state,'pick',value);state=memoryAction('potion',state,'brew');assert.equal(state.score,10);
 state=memoryAction('potion',state,'start');state=memoryAction('potion',state,'ready');assert.equal(state.assisted,false);
 for(const value of [0,0,0])state=memoryAction('potion',state,'pick',value);state=memoryAction('potion',state,'brew');assert.equal(state.phase,'failed');assert.equal(state.score,10);
 state=memoryAction('potion',state,'start');state=memoryAction('potion',state,'ready');for(const value of [2,0,3])state=memoryAction('potion',state,'pick',value);state=memoryAction('potion',state,'brew');assert.equal(state.score,20);
 assert.deepEqual(memoryAction('potion',state,'restart'),newMemoryState());
 let signal=memoryAction('signal',newMemoryState(),'start');signal=memoryAction('signal',signal,'ready');signal=memoryAction('signal',signal,'pick',3);assert.equal(signal.phase,'failed');
 signal=memoryAction('signal',signal,'start');assert.equal(signal.phase,'playback');signal=memoryAction('signal',signal,'ready');
 signal=memoryAction('signal',signal,'watch');assert.equal(signal.assisted,true);assert.deepEqual(signal.input,[]);
});

function fixture(){
 let focused;class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.style={setProperty(){}};this.disabled=false;this.value='';this.textContent='';}
  append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(key,value){this[key]=value;}
  addEventListener(key,callback){this.listeners[key]=callback;}removeEventListener(key){delete this.listeners[key];}
  focus(){focused=this;}click(){if(!this.disabled)this.listeners.click?.();}
 }
 const root=new Element('main');root.id='campus-quests';const walk=el=>[el,...el.children.flatMap(walk)];const all=()=>walk(root);
 const find=fn=>{const item=all().find(fn);assert.ok(item,'Expected DOM element');return item;};
 return {root,all,get focused(){return focused;},document:{getElementById:id=>all().find(el=>el.id===id),createElement:tag=>new Element(tag)},
  button:text=>find(el=>el.tagName==='button'&&el.textContent===text),pad:i=>find(el=>el.id===`memory-pad-${i}`),
  key(key,repeat=false){const section=find(el=>el.className?.startsWith('memory-game '));let prevented=false;section.listeners.keydown?.({key,repeat,preventDefault(){prevented=true;}});return prevented;},
 };
}
function clockFixture(){let id=0;const tasks=new Map();return {setTimeout(fn){tasks.set(++id,fn);return id;},clearTimeout(key){tasks.delete(key);},flush(){let guard=0;while(tasks.size){assert.ok(++guard<100);const [key,fn]=tasks.entries().next().value;tasks.delete(key);fn();}},get size(){return tasks.size;}};}
function globals(ui,extra={}){
 const values={document:ui.document,confirm:()=>true,...extra};const original=new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(values))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 return ()=>{for(const [key,descriptor]of original){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}};
}

test('automatic playback gates input, handles keyboard repeats, and cancels all timers on exit/destroy',()=>{
 const ui=fixture(),restore=globals(ui);let controller;const clock=clockFixture();
 try{
  const gameRoot=ui.document.createElement('section');ui.root.append(gameRoot);
  controller=mountMemoryGame(gameRoot,{kind:'signal',clock,onComplete(){},onLeave(){controller.destroy();}});
  ui.button('Start game').click();assert.equal(ui.pad(0).disabled,true);assert.equal(clock.size,1);assert.equal(ui.key('1'),false);
  clock.flush();assert.equal(ui.pad(0).disabled,false);assert.equal(ui.key('1',true),false);assert.equal(ui.key('1'),true);
  // Replay clears earlier input and locks input while showing the sequence again.
  ui.button('Watch again · 10-point round').click();assert.equal(ui.pad(0).disabled,true);assert.equal(clock.size,1);
  ui.button('Exit game').click();assert.equal(clock.size,0);clock.flush();assert.equal(gameRoot.children.length,0);
  controller=mountMemoryGame(gameRoot,{kind:'potion',clock,onComplete(){},onLeave(){}});ui.button('Start game').click();assert.equal(clock.size,1);clock.flush();assert.equal(ui.pad(0).disabled,false);
  ui.button('Restart game').click();ui.button('Start game').click();assert.equal(clock.size,1);controller.destroy();assert.equal(clock.size,0);clock.flush();assert.equal(gameRoot.children.length,0);
 }finally{controller?.destroy();restore();}
});

test('standalone integration completes five rounds, scores reveals/retries, prevents replay XP and preserves saved XP',async()=>{
 const ui=fixture(),entries=new Map();const storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value)};
 const data=JSON.parse(await readFile(new URL('../public/quests.json',import.meta.url),'utf8'));
 const restore=globals(ui,{localStorage:storage,fetch:async()=>({ok:true,json:async()=>data})});const events=[];let controller;
 function launch(kind){
 const random=Math.random;Math.random=()=>kind==='potion'?0.5:0.99;
 try{ui.button('Give me a game instead').click();}finally{Math.random=random;}
}
 function finish(kind,{aid=false,fail=false}={}){
  if(kind==='signal'&&ui.all().some(el=>el.textContent==='Playback: automatic'))ui.button('Playback: automatic').click();
  ui.button('Start game').click();
  for(let round=0;round<5;round++){
   const prepare=()=>{if(kind==='potion')ui.button('Ready to mix').click();else{for(let i=0;i<MEMORY_GAMES.signal.rounds[round].length;i++)ui.button('Next signal').click();ui.button('Start repeating').click();}};
   prepare();
   if(fail&&round===1){
    if(kind==='signal')ui.key(String((MEMORY_GAMES.signal.rounds[round][0]+1)%4+1));
    else{for(let i=0;i<MEMORY_GAMES.potion.rounds[round].length;i++)ui.pad(0).click();ui.button('Brew potion').click();}
    ui.button('Retry round').click();prepare();
   }
   if(kind==='potion'&&aid&&round===0)ui.button('Reveal recipe · 10-point round').click();
   for(const index of MEMORY_GAMES[kind].rounds[round]){
    if(kind==='signal')assert.equal(ui.key(String(index+1)),true);else ui.pad(index).click();
   }
   if(kind==='potion'){assert.equal(ui.focused.id,'memory-brew');ui.button('Brew potion').click();}
   if(round<4)ui.button('Next round').click();
  }
 }
 try{
  controller=await startQuest({roomId:'room-test',ghostId:'ghost-test',onComplete:result=>events.push(result)});
  createProgressStore(storage).award('earned-before-memory-games',80);
  for(const kind of ['potion','signal']){
   launch(kind);finish(kind,{aid:true,fail:true});
   assert.deepEqual(events.at(-1),{questId:MEMORY_GAMES[kind].id,roomId:'room-test',ghostId:'ghost-test',outcome:'completed',xpAwarded:kind==='potion'?100:110});
   const total=createProgressStore(storage).snapshot().xp;
   ui.button('Restart game').click();finish(kind);assert.equal(events.at(-1).xpAwarded,0);assert.equal(createProgressStore(storage).snapshot().xp,total);
   ui.button('Restart game').click();ui.button('Start game').click();ui.button('Exit game').click();assert.equal(events.at(-1).outcome,'abandoned');assert.equal(events.at(-1).xpAwarded,0);assert.equal(createProgressStore(storage).snapshot().xp,total);
  }
  assert.equal(createProgressStore(storage).snapshot().xp,290);
  controller.destroy();controller=await startQuest({onComplete:result=>events.push(result)});launch('potion');finish('potion');assert.equal(events.at(-1).xpAwarded,0);
  // Replacing a game mid-play cancels its run without awarding any XP.
  ui.button('Return to ghost offer').click();launch('signal');ui.button('Start game').click();controller.destroy();controller=await startQuest({onComplete:result=>events.push(result)});launch('potion');assert.equal(events.at(-1).outcome,'abandoned');assert.equal(createProgressStore(storage).snapshot().xp,290);
 }finally{controller?.destroy();restore();}
});
