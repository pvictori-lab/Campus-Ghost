import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {TRIVIA_ID,INTERACTIVE_GAMES,validateQuestData,loadQuests,makeTriviaAttempt,chooseInteractiveGame,createProgressStore,startQuest} from '../public/quests.js';

const data=JSON.parse(await readFile(new URL('../public/quests.json',import.meta.url),'utf8'));
const trivia=validateQuestData(data);
function memoryStorage(){const entries=new Map();return {getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value)};}

test('v2 bank has 36 distinct questions and rejects malformed challenge content',async()=>{
 assert.equal(trivia.questions.length,36);assert.equal(trivia.attemptLength,10);assert.equal(trivia.id,TRIVIA_ID);
 for(const change of [d=>d.version=1,d=>d.trivia.id='changed',d=>d.trivia.attemptLength=3,d=>d.trivia.questions.pop()&&d.trivia.questions.splice(0,10),d=>d.trivia.questions.push(d.trivia.questions[0]),d=>d.trivia.questions[1].prompt=d.trivia.questions[0].prompt,d=>d.trivia.questions[0].answerIndex=99,d=>d.trivia.completionXP=-1,d=>d.trivia.questions[0].explanation='',d=>d.trivia.questions[0].options=['Same','same']]){
  const copy=structuredClone(data);change(copy);assert.throws(()=>validateQuestData(copy));
 }
 await assert.rejects(()=>loadQuests('unused',async()=>({ok:false,status:404})),/404/);
 await assert.rejects(()=>loadQuests('unused',async()=>({ok:true,json:async()=>({})})),/version 2/);
});

test('attempts contain ten distinct questions and retries reshuffle without mutating the bank',()=>{
 const original=trivia.questions.map(q=>q.id),seen=new Set();
 for(let n=0;n<50;n++){const attempt=makeTriviaAttempt(trivia);assert.equal(attempt.length,10);assert.equal(new Set(attempt.map(q=>q.id)).size,10);attempt.forEach(q=>seen.add(q.id));}
 assert.ok(seen.size>10);assert.deepEqual(trivia.questions.map(q=>q.id),original);
 const first=makeTriviaAttempt(trivia,[],()=>0);const retry=makeTriviaAttempt(trivia,first.map(q=>q.id),()=>0);assert.notDeepEqual(first.map(q=>q.id),retry.map(q=>q.id));
});

test('random games cover all three and never immediately repeat',()=>{
 assert.deepEqual([0,.5,.99].map(r=>chooseInteractiveGame(null,()=>r).kind),['escape','potion','signal']);
 for(const last of INTERACTIVE_GAMES)for(const random of [0,.5,.99])assert.notEqual(chooseInteractiveGame(last.id,()=>random).id,last.id);
});

test('progress preserves legacy IDs and XP, prevents replay awards and handles blocked storage',()=>{
 const storage=memoryStorage(),store=createProgressStore(storage);store.award('old-three-question-quest',50);assert.equal(store.award(TRIVIA_ID,100),100);assert.equal(store.award(TRIVIA_ID,100),0);
 const restored=createProgressStore(storage);assert.deepEqual(restored.snapshot(),{xp:150,completed:['old-three-question-quest',TRIVIA_ID]});
 let warnings=0;for(const broken of [undefined,{getItem(){throw Error('blocked');}},{getItem(){return '{bad';}},{getItem(){return null;},setItem(){throw Error('quota');}}]){
  const session=createProgressStore(broken,()=>warnings++);assert.equal(session.award(TRIVIA_ID,100),100);assert.equal(session.award(TRIVIA_ID,100),0);assert.equal(session.snapshot().xp,100);
 }assert.ok(warnings>=4);
});

function dom(){
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.style={setProperty(){}};this.disabled=false;this.hidden=false;this.textContent='';this.value='';this.classList={add(){}};}
  append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(key,value){this[key]=value;}
  addEventListener(key,fn){this.listeners[key]=fn;}removeEventListener(key){delete this.listeners[key];}focus(){}click(){if(!this.disabled&&!this.hidden)this.listeners.click?.();}
 }
 const root=new Element('main');root.id='campus-quests';const walk=el=>[el,...el.children.flatMap(walk)];const all=()=>walk(root);
 return {all,root,document:{getElementById:id=>all().find(el=>el.id===id),createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)},button(text){const item=all().find(el=>el.tagName==='button'&&el.textContent===text);assert.ok(item,`Missing button: ${text}`);return item;}};
}
function setup(ui,storage,fetcher){
 const values={document:ui.document,localStorage:storage,fetch:fetcher|| (async()=>({ok:true,json:async()=>data}))};const descriptors=new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(values))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 return ()=>{for(const [key,value]of descriptors){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}};
}
function currentQuestion(ui){const prompt=ui.all().find(el=>el.tagName==='h3')?.textContent;const q=trivia.questions.find(q=>q.prompt===prompt);assert.ok(q);return q;}

test('offer, wrong-answer end, new attempts, exact ten-answer completion, callbacks and saved XP',async()=>{
 const ui=dom(),storage=memoryStorage(),restore=setup(ui,storage),events=[];let controller;
 try{
  const store=createProgressStore(storage);store.award('legacy',80);
  controller=await startQuest({roomId:'demo-room',ghostId:'demo-ghost',onComplete:result=>events.push(result)});
  assert.ok(ui.all().some(el=>el.textContent==='Current ghost: demo-ghost'));
  assert.deepEqual(ui.all().filter(el=>el.tagName==='button').map(el=>el.textContent),['Play trivia','Give me a game instead']);
  const staleOffer=ui.button('Play trivia');staleOffer.click();const first=currentQuestion(ui).id;staleOffer.click();assert.equal(currentQuestion(ui).id,first);
  const failedSequence=[];
  for(let i=0;i<3;i++){const q=currentQuestion(ui);failedSequence.push(q.id);ui.button(q.options[q.answerIndex]).click();ui.button('Next question').click();}
  const wrong=currentQuestion(ui),wrongButton=ui.button(wrong.options[(wrong.answerIndex+1)%wrong.options.length]);wrongButton.click();wrongButton.click();
  assert.deepEqual(events,[{questId:TRIVIA_ID,roomId:'demo-room',ghostId:'demo-ghost',outcome:'failed',xpAwarded:0}]);
  assert.ok(ui.all().some(el=>el.textContent===wrong.explanation));assert.equal(store.snapshot().xp,80);assert.ok(!ui.all().some(el=>el.textContent==='Next question'));
  ui.button('Try trivia again').click();assert.ok(ui.all().some(el=>el.textContent==='Question 1 of 10 · 0 / 10 correct in a row'));
  function win(){const ids=[];for(let i=0;i<10;i++){const q=currentQuestion(ui);ids.push(q.id);const choice=ui.button(q.options[q.answerIndex]);choice.click();choice.click();if(i<9){assert.equal(store.snapshot().completed.includes(TRIVIA_ID),false);const next=ui.button('Next question');next.click();next.click();}}return ids;}
  const ids=win();assert.equal(new Set(ids).size,10);assert.equal(events.length,2);assert.equal(events.at(-1).xpAwarded,100);assert.equal(store.snapshot().xp,180);
  ui.button('Return to ghost offer').click();ui.button('Play trivia').click();
  for(let i=0;i<10;i++){const q=currentQuestion(ui);ui.button(q.options[q.answerIndex]).click();if(i<9)ui.button('Next question').click();}
  assert.equal(events.at(-1).xpAwarded,0);assert.equal(store.snapshot().xp,180);
  ui.button('Return to ghost offer').click();ui.button('Play trivia').click();ui.button('Return to ghost offer').click();assert.equal(events.at(-1).outcome,'abandoned');assert.equal(store.snapshot().xp,180);
  controller.destroy();controller=await startQuest({onComplete:result=>events.push(result)});ui.button('Play trivia').click();for(let i=0;i<10;i++){const q=currentQuestion(ui);ui.button(q.options[q.answerIndex]).click();if(i<9)ui.button('Next question').click();}assert.equal(events.at(-1).xpAwarded,0);
 }finally{controller?.destroy();restore();}
});

test('failed trivia switches directly to a random game, returns to offer, ignores stale buttons and timers',async()=>{
 const ui=dom(),storage=memoryStorage(),restore=setup(ui,storage),events=[];let controller;const random=Math.random;
 try{
  controller=await startQuest({onComplete:result=>events.push(result)});ui.button('Play trivia').click();const q=currentQuestion(ui);ui.button(q.options[(q.answerIndex+1)%q.options.length]).click();
  Math.random=()=>0;const switchButton=ui.button('Give me a game instead');switchButton.click();const title=ui.all().find(el=>el.tagName==='h2').textContent;switchButton.click();assert.equal(ui.all().find(el=>el.tagName==='h2').textContent,title);
  const exit=ui.all().find(el=>el.tagName==='button'&&['Leave room','Exit game'].includes(el.textContent));exit.click();ui.button('Give me a game instead').click();assert.notEqual(ui.all().find(el=>el.tagName==='h2').textContent,title);
  // Exit while a memory game's timer is pending, then invoke the removed start button.
  const start=ui.button('Start game');start.click();ui.button('Exit game').click();start.click();assert.ok(ui.button('Play trivia'));assert.equal(storeXP(),0);
  function storeXP(){return createProgressStore(storage).snapshot().xp;}
 }finally{Math.random=random;controller?.destroy();restore();}
});

test('missing trivia offers retry and still allows interactive games',async()=>{
 const ui=dom(),restore=setup(ui,memoryStorage(),async()=>({ok:false,status:404}));let controller;
 try{
  controller=await startQuest();assert.equal(ui.button('Play trivia').disabled,true);assert.ok(ui.button('Give me a game instead'));assert.ok(ui.button('Retry loading trivia'));
  globalThis.fetch=async()=>({ok:true,json:async()=>data});ui.button('Retry loading trivia').click();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(ui.button('Play trivia').disabled,false);
 }finally{controller?.destroy();restore();}
});

test('unchanged server serves final interface without game picker or temporary lab',async()=>{
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'31988',OPENAI_API_KEY:''},stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Server exited early');})]);
  for(const file of ['quests.html','quests.js','quests.css','quests.json','escape-room.js','memory-games.js','quest-protocol.js','route-encounters.js','route-encounters.css']){const response=await fetch(`http://127.0.0.1:31988/${file}`);assert.equal(response.status,200);const text=await response.text();assert.ok(text.length);if(file==='quests.html')assert.doesNotMatch(text,/test-potion|test-signal|launchTestGame|game lab/);}
 }finally{child.kill();await once(child,'exit');}
});
