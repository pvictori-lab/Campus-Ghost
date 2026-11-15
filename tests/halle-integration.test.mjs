import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createEncounterDirector,encounterOrigins,planEncounter,openRouteEncounter} from '../public/route-encounters.js';
import {buildNavigationPlan} from '../public/navigation-plan.js';
import {startQuest,destroyQuest,createProgressStore} from '../public/quests.js';
import {target,FakeEvent,clockFixture,storageFixture,documentFixture,globals} from './halle-fixture.mjs';
const building=JSON.parse(await readFile(new URL('../public/building.json',import.meta.url)));
const courses=JSON.parse(await readFile(new URL('../public/courses.json',import.meta.url)));
const bank=JSON.parse(await readFile(new URL('../public/quests.json',import.meta.url)));
const appSource=(await readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*\r?\n/gm,'').replace('initialize();','globalThis.ready=initialize();')+'\nglobalThis.testApp={findRoute,confirmCheckpoint,changeDestination,resetJourney,render,getJourney:()=>structuredClone(journey)};';
const toonSource=await readFile(new URL('../public/quest-toon.js',import.meta.url),'utf8');

async function boot({storage=storageFixture(),url='http://localhost:3002/',quest=false}={}){
 const ui=documentFixture(),clock=clockFixture(),offers=[],results=[],methods=[],requests=[],window={...target(),location:new URL(url),matchMedia:()=>({matches:true})};
 window.setTimeout=clock.setTimeout;window.clearTimeout=clock.clearTimeout;
 window.history={replaceState(_,__,next){window.location.href=new URL(next,window.location.href).href;}};
 let director,panelReady,lastScanner,stops=0,waitCallback;
 const installRouteEncounters=options=>{
  director=createEncounterDirector({...options,clock,random:()=>0,onStatus(message){ui.$('encounter-status').textContent=message;},onEncounter(plan,handlers){
   offers.push({plan,handlers});
   if(quest)panelReady=startQuest({roomId:plan.roomId,ghostId:plan.ghostId,singleChallenge:true,onComplete(result){results.push(result);handlers.result(result);}});
   return {destroy(){if(quest)destroyQuest();},showResult(){if(quest)destroyQuest();}};
  }});
  const confirmed=director.confirmed;director.confirmed=snapshot=>{methods.push(snapshot.method);confirmed(snapshot);};return director;
 };
 const fetcher=async(file,options)=>{
  if(file==='/api/ghost'){requests.push({file,body:JSON.parse(options.body)});return {ok:true,json:async()=>({reply:'Sample Biology: fictional local course facts.'})};}
  return {ok:true,json:async()=>file==='building.json'?building:courses};
 };
 const context=vm.createContext({document:ui.document,window,location:window.location,localStorage:storage,installRouteEncounters,buildNavigationPlan,fetch:fetcher,URL,URLSearchParams,console,Event:FakeEvent,CustomEvent:FakeEvent,AbortController,structuredClone,
  setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,setInterval(fn){waitCallback=fn;return 1;},clearInterval(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},queueMicrotask,performance:{now:()=>0},MutationObserver:class{observe(){}},navigator:{clipboard:{writeText:async()=>{}}}});
 vm.runInContext(appSource,context);await context.ready;
 window.Html5Qrcode=class{
  constructor(){lastScanner=this;}async start(_,configuration,fn){this.configuration=configuration;this.read=fn;}async stop(){stops++;}clear(){}
 };
 vm.runInContext(toonSource,context);waitCallback();
 return {...ui,clock,storage,window,context,app:context.testApp,director,offers,results,methods,requests,get scanner(){return lastScanner;},get panelReady(){return panelReady;},get stops(){return stops;},async scan(id,param='checkpoint'){
  await ui.$('scan-now').onclick();await lastScanner.read(`${window.location.origin}${window.location.pathname}?${param}=${id}`);
 }};
}

test('Halle data uses only existing checkpoint origins and dynamic map dimensions',async()=>{
 assert.equal(building.mapWidth,600);assert.equal(building.mapHeight,750);assert.equal(building.rooms.length,0);
 assert.equal(encounterOrigins(building).length,7);assert.ok(encounterOrigins(building).every(n=>n.qrCodeId));
 const app=await boot();try{
  const route=app.app.findRoute('Q8','Q5');assert.ok(route.includes('N10'));assert.equal(route.includes('Q4'),false);
  assert.equal(planEncounter(building,route,()=>0),null,'A checkpoint outside the displayed itinerary cannot be an encounter trigger');
  const plan=planEncounter(building,buildNavigationPlan(building,'Q8','Q5',app.app.findRoute).route,()=>0);assert.equal(plan.checkpointId,'Q4');assert.ok(building.nodes.some(n=>n.id===plan.roomId&&n.qrCodeId));
  const marked=structuredClone(building);marked.nodes.find(n=>n.id==='Q8').encounterOrigin=true;assert.deepEqual(encounterOrigins(marked).map(n=>n.id),['Q8']);
  assert.equal(app.$('map').attrs.viewBox,'0 0 600 750');assert.equal(app.$('map').children.find(n=>n.tagName==='image').attrs.href,'halle-map.png');
 }finally{app.director.destroy();}
});

test('checkpoint itinerary visibly includes Q4 and deterministically triggers there for every random choice',async()=>{
 const app=await boot();try{
  const plan=buildNavigationPlan(building,'Q8','Q5',app.app.findRoute);
  assert.deepEqual([...plan.stops],['Q8','Q4','Q5']);assert.equal(new Set(plan.route).size,plan.route.length);
  for(let i=1;i<plan.route.length;i++)assert.ok(building.edges.some(([a,b])=>(a===plan.route[i-1]&&b===plan.route[i])||(b===plan.route[i-1]&&a===plan.route[i])));
  for(const value of [0,.25,.5,.99])assert.equal(planEncounter(building,plan.route,()=>value).checkpointId,'Q4');
  assert.deepEqual(buildNavigationPlan(building,'missing','Q5',app.app.findRoute),{route:[],stops:[]});
 }finally{app.director.destroy();}
});

test('Next-checkpoint control uses the QR handler, updates distinct labels/progress and ignores repeated current reports',async()=>{
 const storage=storageFixture();createProgressStore(storage).award('preexisting',80);const app=await boot({storage});
 try{
  assert.equal(app.$('confirm-next').disabled,true);app.$('checkpoint').value='Q8';await app.$('confirm').click();
  assert.match(app.$('confirmed-checkpoint').textContent,/Q8/);assert.match(app.$('next-checkpoint').textContent,/Q4/);assert.match(app.$('journey-destination').textContent,/Q5/);assert.equal(app.$('progress').value,0);
  assert.ok(app.$('map').children.find(n=>n.tagName==='polyline').attrs.points.includes('384,302'));
  const stored=storage.getItem('campus-ghost-journey-v3');await app.$('confirm').click();assert.equal(storage.getItem('campus-ghost-journey-v3'),stored);assert.equal(app.offers.length,0);assert.match(app.$('temperature').textContent,/already at/);
  await app.$('confirm-next').click();assert.equal(app.app.getJourney().last,'Q4');assert.equal(app.app.getJourney().lastConfirmationMethod,'demo-next');assert.equal(app.methods.at(-1),'demo-next');assert.equal(app.$('progress').value,50);assert.equal(app.offers.length,1);assert.equal(app.$('confirm-next').disabled,true);
  app.offers[0].handlers.dismiss();assert.equal(app.$('confirm-next').disabled,false);assert.match(app.$('next-checkpoint').textContent,/Q5/);assert.equal(app.app.getJourney().last,'Q4');
  await app.$('confirm-next').click();assert.equal(app.app.getJourney().last,'Q5');assert.equal(app.$('progress').value,100);assert.equal(app.$('confirm-next').disabled,true);assert.equal(app.offers.length,1);assert.equal(createProgressStore(storage).snapshot().xp,80);
 }finally{app.director.destroy();}
});

test('saved checkpoint itinerary restores progress and consumed encounter without replenishing it',async()=>{
 const storage=storageFixture();let app=await boot({storage});app.$('checkpoint').value='Q8';await app.$('confirm').click();await app.$('confirm-next').click();app.offers[0].handlers.dismiss();app.director.destroy();
 app=await boot({storage});try{assert.equal(app.app.getJourney().last,'Q4');assert.equal(app.$('progress').value,50);assert.match(app.$('next-checkpoint').textContent,/Q5/);assert.equal(app.offers.length,0);assert.match(app.$('encounter-status').textContent,/quest ghost/);}finally{app.director.destroy();}
});

test('typed checkpoint entry normalizes valid IDs, rejects invalid codes without state changes, and reconfirms safely',async()=>{
 const storage=storageFixture();createProgressStore(storage).award('prior-xp',80);const app=await boot({storage});
 const submit=async value=>{app.$('checkpoint-code').value=value;await app.$('checkpoint-code-form').dispatchEvent(new FakeEvent('submit'));};
 try{
  assert.equal(app.$('checkpoint-code-form').dataset.bound,'true');assert.equal(app.$('checkpoint-code-form').hidden,true);
  await app.$('checkpoint-code-toggle').click();assert.equal(app.$('checkpoint-code-form').hidden,false);assert.equal(app.$('checkpoint-code-toggle').attrs['aria-expanded'],'true');
  for(const invalid of ['', '  ', 'Q3','N10','not-a-code']){const before=storage.getItem('campus-ghost-journey-v3'),selected=app.$('checkpoint').value;await submit(invalid);assert.equal(storage.getItem('campus-ghost-journey-v3'),before);assert.equal(app.app.getJourney(),null);assert.equal(app.$('checkpoint').value,selected);assert.equal(app.$('checkpoint-code').attrs['aria-invalid'],'true');assert.equal(app.$('checkpoint-code-feedback').dataset.state,'error');}
  await submit('  q8\n');assert.equal(app.app.getJourney().last,'Q8');assert.equal(app.app.getJourney().lastConfirmationMethod,'manual-code');assert.equal(app.$('checkpoint-code').value,'Q8');assert.match(app.$('checkpoint-code-feedback').textContent,/Entrance To Floor 2/);assert.equal(app.$('confirm-next').textContent,'I’ve reached Atrium East');
  const before=storage.getItem('campus-ghost-journey-v3');await submit('q8');assert.equal(storage.getItem('campus-ghost-journey-v3'),before);assert.match(app.$('checkpoint-code-feedback').textContent,/already at/);assert.equal(app.offers.length,0);
  await submit('  q3 ');assert.equal(storage.getItem('campus-ghost-journey-v3'),before);assert.equal(app.$('confirmed-checkpoint').textContent,'Entrance To Floor 2 (Q8)');
  await submit('\tq4  ');assert.equal(app.app.getJourney().last,'Q4');assert.equal(app.methods.at(-1),'manual-code');assert.equal(app.offers.length,1);assert.equal(app.$('checkpoint-code').disabled,true);assert.equal(app.$('checkpoint-code-toggle').disabled,true);
  app.offers[0].handlers.dismiss();assert.equal(app.$('checkpoint-code').disabled,false);const consumed=storage.getItem('campus-ghost-journey-v3');await submit(' Q4 ');assert.equal(storage.getItem('campus-ghost-journey-v3'),consumed);assert.equal(app.offers.length,1);
  assert.equal(app.$('confirm-next').textContent,'I’ve reached Room 217 (Faculty)');await app.$('confirm-next').click();assert.equal(app.app.getJourney().last,'Q5');assert.equal(app.$('temperature').textContent,'You’ve arrived!');assert.equal(app.$('confirm-next').hidden,true);assert.equal(app.$('checkpoint-code-feedback').textContent,'');assert.equal(app.$('checkpoint-code').value,'');
  await submit('q5');assert.equal(app.$('temperature').textContent,'You’ve arrived!');assert.equal(app.offers.length,1);assert.equal(createProgressStore(storage).snapshot().xp,80);
 }finally{app.director.destroy();}
});

test('camera failure opens the available code fallback, whose submit still starts navigation',async()=>{
 const app=await boot();const warnings=[],original=app.context.console;app.context.console={...console,warn:(...args)=>warnings.push(args)};
 app.window.Html5Qrcode=class{async start(){throw Error('camera permission denied');}clear(){}};
 try{
  await app.$('scan-now').onclick();assert.equal(app.$('checkpoint-code-form').hidden,false);assert.equal(app.$('checkpoint-code-toggle').disabled,false);assert.match(app.$('scan-note').textContent,/Camera unavailable/);assert.equal(warnings.length,1);
  app.$('checkpoint-code').value=' q8 ';await app.$('checkpoint-code-form').dispatchEvent(new FakeEvent('submit'));assert.equal(app.app.getJourney().last,'Q8');assert.equal(app.$('confirm-next').hidden,false);
 }finally{app.context.console=original;app.director.destroy();}
});

test('real Pat scanner → James confirmCheckpoint → one quest → complete → resume → arrive, preserving XP',async()=>{
 const storage=storageFixture();createProgressStore(storage).award('earned-before-integration',80);let app;
 const restore=globals({localStorage:storage,fetch:async()=>({ok:true,json:async()=>bank})});
 try{
  app=await boot({storage,quest:true});const resetDocument=globals({document:app.document});
  try{
   await app.scan('Q8');assert.equal(app.offers.length,0);const id=app.app.getJourney().questEncounter.tripId;
   await app.scan('Q4','qr');const retiredScanner=app.scanner;await app.panelReady;assert.equal(app.offers.length,1);assert.equal(app.methods.at(-1),'qr');assert.ok(app.stops>=1);assert.equal(app.$('scan-now').disabled,true);
   const savedBefore=app.app.getJourney();assert.equal(savedBefore.last,'Q4');assert.equal(savedBefore.destination,'Q5');assert.equal(savedBefore.questEncounter.consumed,true);assert.equal(savedBefore.questEncounter.tripId,id);
   const marker=app.$('map').children.find(n=>n.attrs['aria-label']==='Confirm checkpoint: Computers (North)');await marker.click();assert.equal(app.app.getJourney().last,'Q4');assert.equal(app.$('checkpoint').value,'Q4');
   app.button('Play trivia').click();
   for(let i=0;i<10;i++){const prompt=app.all().find(n=>n.tagName==='h3').textContent,q=bank.trivia.questions.find(q=>q.prompt===prompt);app.button(q.options[q.answerIndex]).click();if(i<9)app.button('Next question').click();}
   assert.equal(app.results.at(-1).xpAwarded,100);assert.equal(createProgressStore(storage).snapshot().xp,180);app.clock.flush();
   assert.equal(app.$('confirm').disabled,false);assert.equal(app.app.getJourney().last,'Q4');assert.equal(app.app.getJourney().destination,'Q5');assert.equal(app.app.getJourney().questEncounter.tripId,id);
   assert.equal(app.all().some(n=>n.textContent==='Give me a game instead'),false);
   await app.$('scan-now').onclick();await retiredScanner.read('http://localhost:3002/?checkpoint=Q1');assert.equal(app.app.getJourney().last,'Q4','Retired camera callbacks must not move the new journey');
   await app.scan('Q4');assert.equal(app.offers.length,1);await app.scan('Q5');assert.match(app.$('temperature').textContent,/arrived/);assert.equal(app.$('scene').dataset.mood,'arrived');assert.equal(app.offers.length,1);assert.equal(app.$('confirm-next').hidden,true);
   app.$('destination').value='Q8';app.app.changeDestination();assert.notEqual(app.app.getJourney().questEncounter.tripId,id);assert.equal(app.app.getJourney().questEncounter.consumed,false);assert.equal(app.offers.length,1);
   await app.scan(app.director.snapshot().plan.checkpointId);await app.panelReady;assert.equal(app.offers.length,2);app.button('Play trivia').click();
   for(let i=0;i<10;i++){const prompt=app.all().find(n=>n.tagName==='h3').textContent,q=bank.trivia.questions.find(q=>q.prompt===prompt);app.button(q.options[q.answerIndex]).click();if(i<9)app.button('Next question').click();}
   assert.equal(app.results.at(-1).xpAwarded,0);assert.equal(createProgressStore(storage).snapshot().xp,180);app.clock.flush();
  }finally{resetDocument();}
 }finally{app?.director.destroy();destroyQuest();restore();}
});

test('QR link page loads retain the trip/consumed state across reloads; restore and redraw never trigger',async()=>{
 const storage=storageFixture();let app=await boot({storage,url:'http://localhost:3002/?checkpoint=Q8'});const id=app.app.getJourney().questEncounter.tripId;assert.equal(app.offers.length,0);app.director.destroy();
 app=await boot({storage,url:'http://localhost:3002/?qr=Q4'});
 try{
  assert.equal(app.methods.at(-1),'qr-link');assert.equal(app.offers.length,1);assert.equal(app.app.getJourney().questEncounter.tripId,id);assert.equal(app.window.location.search,'');
  app.offers[0].handlers.dismiss();assert.equal(app.app.getJourney().last,'Q4');assert.equal(app.app.getJourney().questEncounter.consumed,true);
 }finally{app.director.destroy();}
 app=await boot({storage,url:'http://localhost:3002/?checkpoint=Q4'});
 try{assert.equal(app.offers.length,0);assert.equal(app.app.getJourney().questEncounter.consumed,true);app.app.render();app.app.render();assert.equal(app.offers.length,0);}finally{app.director.destroy();}
});

test('dismissal, destination changes, reset and stale callbacks preserve location and saved rewards',async()=>{
 const storage=storageFixture();createProgressStore(storage).award('history',100);const app=await boot({storage});
 try{
  app.$('checkpoint').value='Q8';await app.$('confirm').click();app.$('checkpoint').value='Q4';await app.$('confirm').click();const first=app.offers[0];assert.equal(app.offers.length,1);
  app.$('destination').value='Q6';app.app.changeDestination();assert.equal(app.$('confirm').disabled,false);assert.equal(app.app.getJourney().last,'Q4');assert.equal(app.app.getJourney().questEncounter.consumed,true);
  first.handlers.result({roomId:first.plan.roomId,ghostId:first.plan.ghostId,outcome:'completed',xpAwarded:999});app.clock.flush();assert.equal(app.app.getJourney().destination,'Q6');assert.equal(createProgressStore(storage).snapshot().xp,100);
  app.$('checkpoint').value='Q7';await app.$('confirm').click();assert.equal(app.offers.length,1);
  app.app.resetJourney();assert.equal(app.app.getJourney(),null);assert.equal(createProgressStore(storage).snapshot().xp,100);
  app.$('checkpoint').value='Q8';await app.$('confirm').click();const trigger=app.director.snapshot().plan.checkpointId;app.$('checkpoint').value=trigger;await app.$('confirm').click();assert.equal(app.offers.length,2);
  app.offers[1].handlers.dismiss();assert.equal(app.$('confirm').disabled,false);assert.equal(app.app.getJourney().last,trigger);assert.equal(createProgressStore(storage).snapshot().xp,100);
 }finally{app.director.destroy();}
});

test('map keyboard confirmations and chat use the preserved interfaces with real course IDs',async()=>{
 const app=await boot();try{
  const marker=app.$('map').children.find(n=>n.attrs['aria-label']==='Confirm checkpoint: Entrance To Floor 2');await marker.dispatchEvent(new FakeEvent('keydown',{key:'Enter'}));assert.equal(app.app.getJourney().last,'Q8');
  app.$('question').value='What is this course about?';app.$('course').value='demo-biology';await app.$('chat').dispatchEvent(new FakeEvent('submit'));
  assert.deepEqual(app.requests,[{file:'/api/ghost',body:{question:'What is this course about?',courseId:'demo-biology',startId:'Q8',destinationId:'Q5',routeIds:[...app.app.getJourney().navigationPlan.route]}}]);assert.match(app.$('reply').textContent,/Sample Biology/);
 }finally{app.director.destroy();}
});

test('main v3 and legacy journeys retain confirmed position, course cards, stable progress and earned XP',async()=>{
 for(const key of ['campus-ghost-journey-v3','campus-ghost-halle-v2']){
  const storage=storageFixture();storage.setItem(key,JSON.stringify({start:'Q8',last:'Q4',destination:'Q5'}));createProgressStore(storage).award('already-earned',80);
  const app=await boot({storage});try{
   assert.equal(app.app.getJourney().last,'Q4');assert.equal(app.$('progress').value,50);assert.equal(app.$('progressLabel').textContent,'50%');assert.equal(app.offers.length,0);
   assert.equal(app.$('course').value,'demo-biology');assert.equal(app.$('courseCard').children[0].textContent,courses[0].title);assert.match(app.$('courseCard').children.at(-1).textContent,/DEMO PLACEHOLDER/);
   assert.equal(JSON.parse(storage.getItem('campus-ghost-journey-v3')).last,'Q4');assert.equal(createProgressStore(storage).snapshot().xp,80);
   await app.$('confirm-next').click();assert.equal(app.app.getJourney().last,'Q5');assert.equal(app.$('progressLabel').textContent,'100%');assert.equal(app.$('journeyStatus').textContent,'Destination confirmed');
   await app.$('lost').click();assert.equal(app.app.getJourney(),null);app.clock.flush();assert.equal(storage.getItem('campus-ghost-journey-v3'),null);assert.equal(storage.getItem('campus-ghost-halle-v2'),null);assert.equal(createProgressStore(storage).snapshot().xp,80);
  }finally{app.director.destroy();}
 }
});

test('off-route reports leave state unchanged; approved printed production QR codes also work locally',async()=>{
 const app=await boot();try{
  await app.scan('Q8');const before=JSON.stringify(app.app.getJourney());
  await app.scan('Q2');assert.equal(JSON.stringify(app.app.getJourney()),before);assert.match(app.$('scan-note').textContent,/not on the current route/);assert.equal(app.offers.length,0);
  app.$('checkpoint-code').value='q2';await app.$('checkpoint-code-form').dispatchEvent(new FakeEvent('submit'));assert.equal(JSON.stringify(app.app.getJourney()),before);assert.match(app.$('checkpoint-code-feedback').textContent,/not on the current route/);
  for(const bad of ['http://campus-ghost.onrender.com/?checkpoint=Q4','https://campus-ghost.onrender.com.evil.invalid/?checkpoint=Q4','https://campus-ghost.onrender.com:9999/?checkpoint=Q4','https://campus-ghost.onrender.com/other?checkpoint=Q4']){
   await app.scanner.read(bad);assert.equal(JSON.stringify(app.app.getJourney()),before);assert.match(app.$('scan-note').textContent,/from this site/);
  }
  await app.scanner.read('https://campus-ghost.onrender.com/index.html?checkpoint=q4');assert.equal(app.app.getJourney().last,'Q4');assert.equal(app.offers.length,1);app.offers[0].handlers.dismiss();
 }finally{app.director.destroy();}
});

test('latest teammate QR parsing accepts relative URLs and normalized IDs while retaining same-site validation/configuration',async()=>{
 const app=await boot();app.window.Html5QrcodeSupportedFormats={QR_CODE:0};try{
  await app.scan('Q8');assert.equal(app.scanner.configuration.fps,10);assert.equal(app.scanner.configuration.formatsToSupport[0],0);
  await app.scan('  q4  ','qr');assert.equal(app.app.getJourney().last,'Q4');assert.equal(app.offers.length,1);app.offers[0].handlers.dismiss();
  await app.$('scan-now').onclick();await app.scanner.read('/?checkpoint=q5');assert.equal(app.app.getJourney().last,'Q5');
  const before=JSON.stringify(app.app.getJourney());await app.$('scan-now').onclick();await app.scanner.read('https://example.invalid/?checkpoint=Q8');assert.equal(JSON.stringify(app.app.getJourney()),before);assert.match(app.$('scan-note').textContent,/from this site/);
  await app.scanner.read('/?checkpoint=Q3');assert.equal(JSON.stringify(app.app.getJourney()),before);assert.match(app.$('scan-note').textContent,/Unknown checkpoint/);
 }finally{app.director.destroy();}
});

test('a QR decoded during scanner startup is queued and confirmed once the camera is ready',async()=>{
 const app=await boot();let stopped=0;app.window.Html5Qrcode=class{async start(_,__,read){read('/?checkpoint=q8');}async stop(){stopped++;}clear(){}};
 try{await app.$('scan-now').onclick();assert.equal(app.app.getJourney().last,'Q8');assert.equal(app.app.getJourney().lastConfirmationMethod,'qr');assert.equal(app.offers.length,0);assert.equal(stopped,1);}finally{app.director.destroy();}
});

test('a camera still starting when navigation pauses stops after startup and remains disabled',async()=>{
 const app=await boot();let release,stopped=0;
 app.window.Html5Qrcode=class{start(){return new Promise(resolve=>{release=resolve;});}async stop(){stopped++;}clear(){}};
 try{
  const opening=app.$('scan-now').onclick();await Promise.resolve();await Promise.resolve();assert.equal(typeof release,'function');
  app.document.documentElement.dataset.questPaused='true';await app.document.dispatchEvent(new FakeEvent('campus-navigation-pause',{detail:{paused:true}}));
  release();await opening;assert.equal(stopped,1);assert.equal(app.$('scan-now').disabled,true);
  app.document.documentElement.dataset.questPaused='false';await app.document.dispatchEvent(new FakeEvent('campus-navigation-pause',{detail:{paused:false}}));assert.equal(app.$('scan-now').disabled,false);
 }finally{app.director.destroy();}
});

test('a camera startup canceled by a quest stays canceled even if the quest ends before startup resolves',async()=>{
 const app=await boot();let release,stopped=0;app.window.Html5Qrcode=class{start(){return new Promise(resolve=>{release=resolve;});}async stop(){stopped++;}clear(){}};
 try{
  const opening=app.$('scan-now').onclick();await Promise.resolve();await Promise.resolve();
  app.document.documentElement.dataset.questPaused='true';await app.document.dispatchEvent(new FakeEvent('campus-navigation-pause',{detail:{paused:true}}));
  app.document.documentElement.dataset.questPaused='false';await app.document.dispatchEvent(new FakeEvent('campus-navigation-pause',{detail:{paused:false}}));
  release();await opening;assert.equal(stopped,1);assert.equal(app.$('scan-now').disabled,false);
 }finally{app.director.destroy();}
});

test('encounter SVG aligns to 600×750 map and reuses the existing Pat ghost instance without moving it',async()=>{
 const app=await boot(),clock=clockFixture();try{
  const original=app.document.querySelector('#hero .toon-ghost');assert.ok(original);
  const before=app.$('hero').children.length;
  const view=openRouteEncounter({building,plan:{roomId:'Q8',checkpointId:'Q4',nextId:'N10',ghostId:'quest-location-Q8'},handlers:{dismiss(){},result(){}},document:app.document,window:app.window,clock});
  const ghost=app.$('encounter-layer').children[0];assert.equal(ghost.style['--room-x'],'64%');assert.equal(ghost.style['--room-y'],'27.200000000000003%');assert.ok(Math.abs(parseFloat(ghost.style.left)-63.6666666667)<1e-6);assert.equal(parseFloat(ghost.style.top),44.4);
  assert.equal(app.$('hero').children.length,before);assert.notEqual(ghost.children[0],original);view.destroy();clock.flush();assert.equal(app.$('encounter-layer').children.length,0);
 }finally{app.director.destroy();}
});

test('integration HTTP endpoints serve floor image and quests; existing API returns its course summary',async()=>{
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'31990',OPENAI_API_KEY:''},stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Server exited early');})]);
  for(const file of ['','halle-map.png','quest-toon.js','quests.html','route-encounters.js','quest-protocol.js'])assert.equal((await fetch('http://127.0.0.1:31990/'+file)).status,200);
  const response=await fetch('http://127.0.0.1:31990/api/ghost',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'Overview?',courseId:'demo-biology'})});assert.equal(response.status,200);assert.match((await response.json()).reply,/Sample Biology[\s\S]*Local demo response/);
  assert.equal((await(await fetch('http://127.0.0.1:31990/api/health')).json()).ok,true);
  const request=body=>fetch('http://127.0.0.1:31990/api/ghost',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const routeIds=['Q8','N17','N7','Q4','N10','N11','N14','Q5'];
  const answer=await request({question:'Where is my professor office? Explain my route.',courseId:'demo-biology',startId:'Q8',destinationId:'Q5',routeIds});assert.equal(answer.status,200);const data=await answer.json();assert.equal(data.mode,'local-fallback');assert.match(data.reply,/not listed in the project data/);assert.match(data.reply,/Atrium East/);
  assert.equal((await request({question:'route?',startId:'Q8',destinationId:'Q5',routeIds:['Q8','Q5']})).status,400);
  assert.equal((await request({question:''})).status,400);
  assert.equal((await request(null)).status,400);
  for(let i=0;i<25;i++){const rate=await request({question:'route?'});if(rate.status===429){assert.match((await rate.json()).error,/wait/);break;}if(i===24)assert.fail('Main request throttling must remain active');}
 }finally{child.kill();await once(child,'exit');}
});
