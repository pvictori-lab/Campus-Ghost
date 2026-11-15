import {PANEL_PROTOCOL} from './quest-protocol.js';

export function graphDistance(building,start,targets,max=Infinity){
  const wanted=new Set(targets),queue=[[start,0]],seen=new Set([start]);
  for(const [id,distance]of queue){if(wanted.has(id))return distance;if(distance>=max)continue;for(const [a,b]of building.edges){const next=a===id?b:b===id?a:null;if(next&&!seen.has(next)){seen.add(next);queue.push([next,distance+1]);}}}return Infinity;
}
export function encounterOrigins(building){
  const configured=building.nodes.filter(node=>node.encounterOrigin===true);
  return configured.length?configured:building.nodes.filter(node=>node.qrCodeId&&node.encounterOrigin!==false);
}
export function planEncounter(building,route,random=Math.random){
  if(route.length<2)return null;
  const origins=encounterOrigins(building);
  const candidates=building.nodes.filter(node=>node.qrCodeId&&route.slice(1,-1).includes(node.id))
    .map(node=>({checkpointId:node.id,origins:origins.filter(origin=>graphDistance(building,node.id,[origin.id],3)<=3)})).filter(candidate=>candidate.origins.length);
  if(!candidates.length)return null;const candidate=candidates[Math.floor(random()*candidates.length)];
  return {checkpointId:candidate.checkpointId,roomId:candidate.origins[Math.floor(random()*candidate.origins.length)].id};
}

// Receives explicit route commands and student-confirmed checkpoints, never redraws.
export function createEncounterDirector({building,onEncounter,onPause=()=>{},onStatus=()=>{},onState=()=>{},clock=globalThis,random=Math.random}){
  let trip=null,active=null,epoch=0,timer=null,disposed=false;
  function close(){epoch++;if(timer!==null)clock.clearTimeout(timer);timer=null;const previous=active;active=null;if(previous)onPause(false);previous?.view?.destroy();}
  function status(message){onStatus(message);}
  function update(snapshot){trip.route=[...snapshot.route];trip.position=snapshot.position;trip.destination=snapshot.destination;}
  function persist(){onState(trip?{tripId:trip.id,consumed:trip.consumed,plan:trip.plan}:null);}
  function finish(result,token){
    if(!active||epoch!==token||active.phase!=='challenge')return;
    if(!result||result.roomId!==active.plan.roomId||result.ghostId!==active.plan.ghostId||!['completed','failed','abandoned'].includes(result.outcome)||!Number.isSafeInteger(result.xpAwarded)||result.xpAwarded<0)return;
    active.phase='result';
    if(result.outcome==='abandoned'){status('Quest left. Continue from the same confirmed checkpoint.');close();return;}
    active.view?.showResult(result);
    status(result.outcome==='completed'?`Quest complete: ${result.xpAwarded} XP awarded. Your location has not changed.`:'Trivia attempt ended. No completion XP. Your location has not changed.');
    timer=clock.setTimeout(()=>{if(epoch===token){close();status('The quest ghost has gone. Continue from your confirmed checkpoint.');}},1400);
  }
  return {
    startTrip(snapshot){
      if(disposed)return;close();const saved=snapshot.encounterState;
      const valid=saved&&saved.tripId===snapshot.tripId&&typeof saved.consumed==='boolean';
      const storedPlan=valid&&saved.plan&&snapshot.route.includes(saved.plan.checkpointId)&&building.nodes.some(n=>n.id===saved.plan.checkpointId&&n.qrCodeId)&&encounterOrigins(building).some(n=>n.id===saved.plan.roomId)?saved.plan:null;
      trip={id:snapshot.tripId,destination:snapshot.destination,position:snapshot.position,route:[...snapshot.route],consumed:valid&&saved.consumed,plan:storedPlan||planEncounter(building,snapshot.route,random)};persist();status(trip.consumed?'You’ve met this journey’s quest ghost.':trip.plan?'A quest ghost may meet you along the way.':'Follow the route to your destination.');
    },
    reroute(snapshot){
      if(disposed||!trip||snapshot.tripId!==trip.id)return;
      close();update(snapshot);
      // Rerouting never replenishes a consumed encounter.
      if(!trip.consumed&&(!trip.plan||!snapshot.route.slice(1,-1).includes(trip.plan.checkpointId)))trip.plan=planEncounter(building,snapshot.route,random);persist();
    },
    confirmed(snapshot){
      if(disposed||!trip||snapshot.tripId!==trip.id||snapshot.confirmed!==true||snapshot.destination!==trip.destination)return;
      const previous=trip.position;update(snapshot);
      if(active||trip.consumed||previous===snapshot.position||snapshot.position===trip.destination||snapshot.position!==trip.plan?.checkpointId)return;
      if(snapshot.route[0]!==snapshot.position||snapshot.route.length<2)return;
      trip.consumed=true;persist();const token=++epoch;
      const plan={...trip.plan,nextId:snapshot.route[1],tripId:trip.id,ghostId:`quest-location-${trip.plan.roomId}`};
      active={plan,phase:'challenge',view:null};onPause(true);status(`A quest ghost from ${building.nodes.find(node=>node.id===plan.roomId).label} has a challenge for you.`);
      try{
        const view=onEncounter(plan,{result:result=>finish(result,token),dismiss(){if(active&&epoch===token){status('Not now. Continue from the same confirmed checkpoint.');close();}}});
        if(active&&epoch===token)active.view=view;else view?.destroy();
      }catch{close();status('The quest panel could not open. Navigation is available; this trip’s encounter is consumed.');}
    },
    endTrip(){if(disposed)return;close();trip=null;},
    snapshot(){return trip?structuredClone({...trip,encounterActive:!!active}):null;},
    destroy(){if(disposed)return;close();trip=null;disposed=true;},
  };
}

export function installRouteEncounters({building,onPause,onState,document:doc=globalThis.document,window:win=globalThis.window,clock=globalThis,random=Math.random}){
  return createEncounterDirector({building,onPause,onState,clock,random,onStatus(message){doc.getElementById('encounter-status').textContent=message;},onEncounter(plan,handlers){return openRouteEncounter({building,plan,handlers,document:doc,window:win,clock});}});
}

export function openRouteEncounter({building,plan,handlers,document:doc=globalThis.document,window:win=globalThis.window,clock=globalThis}){
  const node=(tag,text,css)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;if(css)el.className=css;return el;};
  const origin=building.nodes.find(n=>n.id===plan.roomId),current=building.nodes.find(n=>n.id===plan.checkpointId),next=building.nodes.find(n=>n.id===plan.nextId),layer=doc.getElementById('encounter-layer');
  let disposed=false,closing=false,frame=null,enterTimer=null,cleanupTimer=null,portrait=null;const timers=new Set();
  const ghost=node('div',undefined,'route-quest-ghost');ghost.setAttribute('role','img');ghost.setAttribute('aria-label',`Quest ghost from ${origin.label}, blocking the next route segment`);
  if(!(building.mapWidth>0&&building.mapHeight>0))throw Error('Map dimensions are required for encounter placement.');
  ghost.style.setProperty('--room-x',`${origin.x/building.mapWidth*100}%`);ghost.style.setProperty('--room-y',`${origin.y/building.mapHeight*100}%`);ghost.style.left=`${(current.x+next.x)/2/building.mapWidth*100}%`;ghost.style.top=`${(current.y+next.y)/2/building.mapHeight*100}%`;
  // Prefer a supplied quest-ghost asset. The local checkout only has navigator artwork;
  // clone its SVG for a separate instance without moving or modifying the navigator.
  function attachArtwork(){
    const source=doc.querySelector('[data-quest-ghost-template]')||doc.querySelector('#hero .toon-ghost');
    if(!source)return false;const art=source.cloneNode(true);art.removeAttribute('id');art.setAttribute('class','route-quest-art');ghost.append(art);if(portrait)portrait.append(art.cloneNode(true));return true;
  }
  if(!attachArtwork()){
    let attempts=0;
    const retryArtwork=()=>{if(disposed||attachArtwork()||++attempts>=20)return;const timer=clock.setTimeout(()=>{timers.delete(timer);retryArtwork();},100);timers.add(timer);};
    const timer=clock.setTimeout(()=>{timers.delete(timer);retryArtwork();},100);timers.add(timer);
  }
  ghost.append(node('span','Quest ghost'));layer.append(ghost);
  // Bring the route-blocking point into view, rather than opening from below the fold.
  const mapRect=doc.getElementById('map').getBoundingClientRect?.();
  if(mapRect&&win.scrollTo)win.scrollTo({top:Math.max(0,(win.scrollY||0)+mapRect.top+(current.y+next.y)/2/building.mapHeight*mapRect.height-(win.innerHeight||600)/2),behavior:'auto'});
  const dismiss=node('button','Not now','route-encounter-dismiss');dismiss.type='button';dismiss.addEventListener('click',handlers.dismiss);layer.append(dismiss);
  const dialog=node('dialog',undefined,'route-quest-dialog'),toolbar=node('div',undefined,'route-quest-toolbar'),heading=node('h2',`A challenge from ${origin.label}`),close=node('button','Not now'),result=node('p',undefined,'route-quest-result');
  portrait=node('span',undefined,'route-quest-portrait');portrait.setAttribute('aria-hidden','true');const existingArt=[...ghost.children].find(child=>child.tagName.toLowerCase()==='svg');if(existingArt)portrait.append(existingArt.cloneNode(true));
  heading.id='route-quest-title';dialog.setAttribute('aria-labelledby',heading.id);close.type='button';close.addEventListener('click',handlers.dismiss);toolbar.append(portrait,heading,close);dialog.append(toolbar,result);doc.body.append(dialog);
  function post(command){frame?.contentWindow?.postMessage({protocol:PANEL_PROTOCOL,command,...(command==='open'?{roomId:plan.roomId,ghostId:plan.ghostId,singleChallenge:true}:{})},win.location.origin);}
  function cleanup(){if(cleanupTimer!==null)clock.clearTimeout(cleanupTimer);cleanupTimer=null;frame?.remove();frame=null;dialog.remove();win.removeEventListener('message',receive);}
  function stopFrame(){
    if(!frame){cleanup();return;}post('destroy');if(cleanupTimer===null)cleanupTimer=clock.setTimeout(cleanup,2000);
  }
  function receive(event){
    if(!frame||event.source!==frame.contentWindow||event.origin!==win.location.origin||event.data?.protocol!==PANEL_PROTOCOL)return;
    const data=event.data;
    if(data.event==='destroyed'){
      if(closing)cleanup();else {if(cleanupTimer!==null)clock.clearTimeout(cleanupTimer);cleanupTimer=null;frame.remove();frame=null;}
      return;
    }
    if(disposed)return;
    if(data.event==='ready'){if(closing)post('destroy');else post('open');}
    if(data.event==='result')handlers.result(data.result);
    if(data.event==='close-request'||data.event==='error')handlers.dismiss();
  }
  const cancel=event=>{event.preventDefault();handlers.dismiss();};dialog.addEventListener('cancel',cancel);win.addEventListener('message',receive);
  function show(){
    if(disposed)return;frame=node('iframe');frame.title='Quest challenge — one challenge for this trip';frame.src='quests-panel.html';dialog.append(frame);dialog.showModal();close.focus();
  }
  const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduced)show();else {enterTimer=clock.setTimeout(()=>{timers.delete(enterTimer);show();},650);timers.add(enterTimer);}
  return {
    showResult(value){if(disposed)return;dialog.classList.add('showing-result');result.textContent=value.outcome==='completed'?`Challenge complete · ${value.xpAwarded} XP earned. Returning to your route…`:'Attempt ended · 0 XP. Returning to your route…';if(frame)frame.hidden=true;post('destroy');if(frame&&cleanupTimer===null)cleanupTimer=clock.setTimeout(()=>{frame?.remove();frame=null;cleanupTimer=null;},2000);},
    destroy(){
      if(disposed)return;disposed=true;closing=true;for(const timer of timers)clock.clearTimeout(timer);timers.clear();ghost.remove();dismiss.remove();if(dialog.open)dialog.close();dialog.hidden=true;stopFrame();
      const nextButton=doc.getElementById('confirm-next');
      (nextButton&&!nextButton.hidden&&!nextButton.disabled?nextButton:doc.getElementById('checkpoint-code-toggle'))?.focus();
    },
  };
}
