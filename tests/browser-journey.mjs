// Optional real-browser check. Run an isolated Edge with CDP port 9223 first.
// This script resets ONLY that isolated profile's test-origin progress/journey keys.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {MEMORY_GAMES} from '../public/memory-games.js';
const base='http://localhost:3002';
const tab=await(await fetch('http://127.0.0.1:9223/json/new?'+encodeURIComponent(base),{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let seq=0;const pending=new Map(),errors=[];
ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id){const request=pending.get(msg.id);if(request){pending.delete(msg.id);msg.error?request.reject(msg.error):request.resolve(msg.result);}}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function evaluate(expression){const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw Error(JSON.stringify(response.exceptionDetails));return response.result.value;}
async function until(expression){for(let n=0;n<100;n++){if(await evaluate(expression))return;await pause(50);}throw Error('Browser condition timed out: '+expression);}
async function snapshot(){return evaluate(`(()=>({current:document.querySelector('#confirmed-checkpoint').textContent,next:document.querySelector('#next-checkpoint').textContent,destination:document.querySelector('#journey-destination').textContent,progress:Number(document.querySelector('#progress').value),ghost:!!document.querySelector('.route-quest-ghost'),panel:!!document.querySelector('.route-quest-dialog'),paused:document.querySelector('#confirm-next').disabled,xp:JSON.parse(localStorage.getItem('campus-ghost.quests.v1')).xp,journey:JSON.parse(localStorage.getItem('campus-ghost-journey-v3'))}))()`);}
async function visiblePanel(){return evaluate(`(()=>{const rect=selector=>{const el=document.querySelector(selector);const r=el?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};return {width:innerWidth,height:innerHeight,dialog:rect('.route-quest-dialog'),portrait:rect('.route-quest-portrait'),frame:rect('.route-quest-dialog iframe'),ghost:rect('.route-quest-ghost')};})()`);}
function assertVisible(bounds){for(const key of ['dialog','portrait','frame']){const r=bounds[key];assert.ok(r,`${key} exists`);assert.ok(r.left>=-1&&r.top>=-1&&r.right<=bounds.width+1&&r.bottom<=bounds.height+1,`${key} fits viewport: ${JSON.stringify(bounds)}`);}assert.ok(bounds.frame.height>200);assert.ok(bounds.ghost.top>=0&&bounds.ghost.bottom<=bounds.height);}
async function enterCode(code){await evaluate(`(()=>{const f=document.querySelector('#checkpoint-code-form');if(f.hidden)document.querySelector('#checkpoint-code-toggle').click();const input=document.querySelector('#checkpoint-code');input.value=${JSON.stringify(code)};input.dispatchEvent(new Event('input',{bubbles:true}));f.requestSubmit();})()`);}
async function start(){await evaluate(`document.querySelector('#reset').click();document.querySelector('#destination').value='Q5';document.querySelector('#destination').dispatchEvent(new Event('change'));`);await enterCode('  q8  ');}
async function trigger(){await evaluate(`document.querySelector('#confirm-next').click()`);await until(`!!document.querySelector('.route-quest-dialog iframe')?.contentDocument?.querySelector('.quest-offer')`);}
try{
 await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');await send('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
 await until(`document.querySelector('#checkpoint-code-form')?.dataset.bound==='true'`);
 await evaluate(`localStorage.removeItem('campus-ghost-journey-v3');localStorage.removeItem('campus-ghost-halle-v2');sessionStorage.removeItem('campus-ghost.quests.last-game');localStorage.setItem('campus-ghost.quests.v1',JSON.stringify({xp:80,completed:['pre-debug-existing-xp']}));`);await send('Page.reload',{ignoreCache:true});await until(`document.querySelector('#checkpoint-code-form')?.dataset.bound==='true'`);
 await enterCode('invalid');assert.equal((await snapshot()).journey,null);assert.ok(await evaluate(`document.querySelector('#checkpoint-code-feedback').textContent.includes('wasn’t found')`));
 await start();let state=await snapshot();assert.match(state.next,/Q4/);assert.equal(state.progress,0);assert.equal(state.ghost,false);const initialNavigator=await evaluate(`parseFloat(document.querySelector('#hero').style.left)||0`);
 assert.ok(await evaluate(`document.querySelector('#map polyline').getAttribute('points').includes('384,302')`));
 await enterCode(' Q8 ');assert.equal((await snapshot()).current,state.current);assert.ok(await evaluate(`document.querySelector('#temperature').textContent.includes('already at')`));
 assert.equal(await evaluate(`document.querySelector('#confirm-next').textContent`),'I’ve reached Atrium East');
 assert.equal(await evaluate(`document.body.innerText.split('Your location updates when you scan a code or confirm a checkpoint.').length-1`),1);
 assert.equal(await evaluate(`document.body.innerText.includes('Manual / demo')||document.body.innerText.includes('simulated report')`),false);
 await trigger();state=await snapshot();assert.match(state.current,/Q4/);assert.equal(state.progress,50);assert.equal(state.paused,true);assert.ok((await evaluate(`parseFloat(document.querySelector('#hero').style.left)||0`))>initialNavigator);const desktop=await visiblePanel();assertVisible(desktop);
 await fs.mkdir(new URL('../browser-artifacts/',import.meta.url),{recursive:true});
 await fs.writeFile(new URL('../browser-artifacts/quest-desktop.png',import.meta.url),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 const bank=JSON.parse(await fs.readFile(new URL('../public/quests.json',import.meta.url),'utf8'));
 await evaluate(`(()=>{const d=document.querySelector('.route-quest-dialog iframe').contentDocument;[...d.querySelectorAll('button')].find(b=>b.textContent==='Play trivia').click();})()`);
 for(let i=0;i<10;i++)await evaluate(`(()=>{const d=document.querySelector('.route-quest-dialog iframe').contentDocument,q=${JSON.stringify(bank.trivia.questions)}.find(q=>q.prompt===d.querySelector('h3').textContent);[...d.querySelectorAll('button')].find(b=>b.textContent===q.options[q.answerIndex]).click();[...d.querySelectorAll('button')].find(b=>b.textContent==='Next question')?.click();})()`);
 await until(`!document.querySelector('.route-quest-dialog')`);state=await snapshot();assert.match(state.current,/Q4/);assert.equal(state.xp,180);assert.equal(state.ghost,false);assert.equal(state.paused,false);assert.match(state.next,/Q5/);assert.equal(await evaluate(`document.activeElement.id`),'confirm-next');
 await evaluate(`document.querySelector('#confirm-next').click()`);await pause(1500);state=await snapshot();assert.match(state.current,/Q5/);assert.equal(state.progress,100);assert.equal(state.ghost,false);assert.equal(state.journey.lastConfirmationMethod,'demo-next');assert.equal(await evaluate(`document.querySelector('#confirm-next').hidden`),true);assert.equal(await evaluate(`document.querySelector('#temperature').textContent`),'You’ve arrived!');
 await start();await trigger();await evaluate(`(()=>{const d=document.querySelector('.route-quest-dialog iframe').contentDocument;[...d.querySelectorAll('button')].find(b=>b.textContent==='Give me a game instead').click();})()`);await evaluate(`document.querySelector('.route-quest-toolbar button').click()`);await until(`!document.querySelector('.route-quest-dialog')`);state=await snapshot();assert.equal(state.xp,180);assert.match(state.current,/Q4/);assert.equal(state.journey.questEncounter.consumed,true);
 await start();await trigger();await evaluate(`document.querySelector('#destination').value='Q6';document.querySelector('#destination').dispatchEvent(new Event('change'));`);await until(`!document.querySelector('.route-quest-dialog')`);await pause(1600);state=await snapshot();assert.match(state.current,/Q4/);assert.match(state.destination,/Q6/);assert.equal(state.ghost,false);assert.equal(state.xp,180);
 await send('Emulation.setDeviceMetricsOverride',{width:360,height:740,deviceScaleFactor:1,mobile:true});await start();await trigger();const mobile=await visiblePanel();assertVisible(mobile);await fs.writeFile(new URL('../browser-artifacts/quest-mobile.png',import.meta.url),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate(`document.querySelector('.route-quest-toolbar button').click()`);await until(`!document.querySelector('.route-quest-dialog')`);
 // Native form submission via Enter, including an invalid code that must not move the student.
 await evaluate(`document.querySelector('#reset').click();const f=document.querySelector('#checkpoint-code-form');if(f.hidden)document.querySelector('#checkpoint-code-toggle').click();document.querySelector('#checkpoint-code').value=' q8 ';document.querySelector('#checkpoint-code').focus();`);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await until(`JSON.parse(localStorage.getItem('campus-ghost-journey-v3'))?.last==='Q8'`);
 const beforeInvalid=await evaluate(`localStorage.getItem('campus-ghost-journey-v3')`);await enterCode(' q3 ');assert.equal(await evaluate(`localStorage.getItem('campus-ghost-journey-v3')`),beforeInvalid);await enterCode(' q8 ');assert.equal(await evaluate(`localStorage.getItem('campus-ghost-journey-v3')`),beforeInvalid);
 // Real Pat scanner callbacks with a mocked decoder, leaving the QR handler itself intact.
 await evaluate(`window.Html5Qrcode=class{async start(a,b,read){window.testQRRead=read;}async stop(){}clear(){}};document.querySelector('#scan-now').click();`);await until(`typeof window.testQRRead==='function'`);await evaluate(`window.testQRRead(location.origin+'/?checkpoint=Q4')`);await until(`!!document.querySelector('.route-quest-dialog iframe')?.contentDocument?.querySelector('.quest-offer')`);assert.match((await snapshot()).current,/Q4/);await evaluate(`document.querySelector('.route-quest-toolbar button').click()`);await until(`!document.querySelector('.route-quest-dialog')`);
 // Camera failure must preserve the entry option and show the form automatically.
 await evaluate(`if(!document.querySelector('#checkpoint-code-form').hidden)document.querySelector('#checkpoint-code-toggle').click();window.Html5Qrcode=class{async start(){throw Error('test permission denied');}clear(){}};document.querySelector('#scan-now').click();`);await until(`document.querySelector('#scan-note').textContent.includes('Camera unavailable')`);assert.equal(await evaluate(`document.querySelector('#checkpoint-code-form').hidden`),false);
 await evaluate(`document.querySelector('#checkpoint-code-form').scrollIntoView({block:'center'})`);await fs.writeFile(new URL('../browser-artifacts/checkpoint-entry-mobile.png',import.meta.url),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await start();await trigger();assert.equal(await evaluate(`getComputedStyle(document.querySelector('.route-quest-ghost')).animationName`),'none');await evaluate(`document.querySelector('.route-quest-toolbar button').click()`);await until(`!document.querySelector('.route-quest-dialog')`);
 // Complete all three real game UIs in successive fresh encounter frames.
 // Fixed random values make the regression deterministic; the offer still launches the game.
 await evaluate(`sessionStorage.removeItem('campus-ghost.quests.last-game')`);
 const gameRuns=[['escape',0,80],['potion',0,120],['signal',.99,120],['potion',.99,0]];
 let expectedXP=180;
 for(const [kind,random,xp] of gameRuns){
  await start();await trigger();
  await evaluate(`(()=>{const w=document.querySelector('.route-quest-dialog iframe').contentWindow,d=w.document;const saved=w.Math.random;w.Math.random=()=>${random};try{[...d.querySelectorAll('button')].find(b=>b.textContent==='Give me a game instead').click();}finally{w.Math.random=saved;}})()`);
  const title=kind==='escape'?'Haunted Room Escape':MEMORY_GAMES[kind].title;
  assert.ok(await evaluate(`document.querySelector('.route-quest-dialog iframe').contentDocument.body.innerText.includes(${JSON.stringify(title)})`));
  if(kind==='escape'){
   await evaluate(`(()=>{const d=document.querySelector('.route-quest-dialog iframe').contentDocument,click=t=>[...d.querySelectorAll('button')].find(b=>b.textContent===t).click();d.querySelector('[aria-label="Inspect ivy pot"]').click();click('Collect folded note');d.querySelector('[aria-label="Inspect locked desk"]').click();d.querySelector('#escape-desk-code').value='427';d.querySelector('#escape-desk-code').form.requestSubmit();d.querySelector('[aria-label="Inspect exit door"]').click();click('Use brass key');d.querySelector('#escape-exit-code').value='742';d.querySelector('#escape-exit-code').form.requestSubmit();})()`);
  }else{
   await evaluate(`(()=>{const d=document.querySelector('.route-quest-dialog iframe').contentDocument,click=t=>[...d.querySelectorAll('button')].find(b=>b.textContent===t).click();if(${JSON.stringify(kind)}==='signal')click('Playback: automatic');click('Start game');})()`);
   for(let round=0;round<5;round++){
    await evaluate(`(()=>{const w=document.querySelector('.route-quest-dialog iframe').contentWindow,d=w.document,click=t=>[...d.querySelectorAll('button')].find(b=>b.textContent===t).click();const sequence=${JSON.stringify(MEMORY_GAMES[kind].rounds[round])};if(${JSON.stringify(kind)}==='potion')click('Ready to mix');else for(let step=0;step<=sequence.length;step++)d.querySelector('#memory-next-signal').click();for(const index of sequence)d.querySelector('.memory-game').dispatchEvent(new w.KeyboardEvent('keydown',{key:String(index+1),bubbles:true}));if(${JSON.stringify(kind)}==='potion')click('Brew potion');if(${round}<4)click('Next round');})()`);
   }
  }
  expectedXP+=xp;
  await until(`!document.querySelector('.route-quest-dialog')`);state=await snapshot();assert.equal(state.xp,expectedXP);assert.match(state.current,/Q4/);assert.equal(state.ghost,false);assert.equal(state.paused,false);
 }
 // Main's class cards, data-based route-aware fallback, and approved printed QR host.
 assert.ok(await evaluate(`document.querySelector('#courseCard').textContent.includes('DEMO PLACEHOLDER')`));
 await evaluate(`document.querySelector('#question').value='Where is my professor office? Explain my route.';document.querySelector('#chat').requestSubmit();`);
 await until(`document.querySelector('#reply').textContent.includes('Local demo response')`);assert.ok(await evaluate(`document.querySelector('#reply').textContent.includes('not listed in the project data')`));
 await start();await evaluate(`window.Html5Qrcode=class{async start(a,b,read){window.testQRRead=read;}async stop(){}clear(){}};document.querySelector('#scan-now').click();`);await pause(50);
 await evaluate(`window.testQRRead('https://campus-ghost.onrender.com/?checkpoint=Q2')`);assert.match((await snapshot()).current,/Q8/);assert.ok(await evaluate(`document.querySelector('#scan-note').textContent.includes('not on the current route')`));
 await evaluate(`window.testQRRead('https://campus-ghost.onrender.com/?checkpoint=Q4')`);await until(`!!document.querySelector('.route-quest-dialog iframe')?.contentDocument?.querySelector('.quest-offer')`);
 await evaluate(`(()=>{const d=document.querySelector('.route-quest-dialog iframe').contentDocument,click=t=>[...d.querySelectorAll('button')].find(b=>b.textContent===t).click();click('Play trivia');const q=${JSON.stringify(bank.trivia.questions)}.find(q=>q.prompt===d.querySelector('h3').textContent);click(q.options[(q.answerIndex+1)%q.options.length]);})()`);
 await until(`!document.querySelector('.route-quest-dialog')`);assert.equal((await snapshot()).xp,expectedXP);assert.match((await snapshot()).current,/Q4/);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,journey:'Q8 -> Q4 -> trivia -> Q5',preservedXP:expectedXP,games:gameRuns.map(run=>run[0]),desktop,mobile,runtimeErrors:errors.length},null,2));
}finally{ws.close();await fetch('http://127.0.0.1:9223/json/close/'+tab.id);}
