import {startQuest,destroyQuest,createProgressStore} from './quests.js';
import {PANEL_PROTOCOL} from './quest-protocol.js';

export function mountQuestPanel({window:win=globalThis.window,start=startQuest,stop=destroyQuest,snapshot=readProgress}={}){
  let controller=null,started=false,disposed=false,disposing=false;
  const send=(event,detail={})=>win.parent.postMessage({protocol:PANEL_PROTOCOL,event,...detail},win.location.origin);
  function progress(){try{send('progress',{xp:snapshot().xp});}catch{/* The in-panel store shows its own persistence warning. */}}
  function teardown(){
    if(disposed||disposing)return;disposing=true;
    // startQuest installs its controller before awaiting fetch. stop() covers closing during that await.
    if(controller)controller.destroy();else stop();
    disposed=true;
    progress();send('destroyed');win.removeEventListener('message',receive);win.removeEventListener('keydown',keydown);win.removeEventListener('pagehide',teardown);
  }
  async function receive(event){
    if(disposed||event.source!==win.parent||event.origin!==win.location.origin||event.data?.protocol!==PANEL_PROTOCOL)return;
    const data=event.data;
    if(data.command==='destroy'){teardown();return;}
    if(data.command!=='open'||started||typeof data.roomId!=='string'||typeof data.ghostId!=='string')return;
    started=true;
    try{
      const pending=await start({roomId:data.roomId,ghostId:data.ghostId,singleChallenge:data.singleChallenge===true,onComplete(result){if(disposed)return;send('result',{result});progress();}});
      if(disposed){pending.destroy();return;}
      controller=pending;progress();send('mounted');
    }catch(error){if(!disposed)send('error',{message:error.message});}
  }
  function keydown(event){if(event.key==='Escape'){event.preventDefault();send('close-request');}}
  win.addEventListener('message',receive);win.addEventListener('keydown',keydown);win.addEventListener('pagehide',teardown);send('ready');
  return {destroy:teardown};
}
function readProgress(){let storage;try{storage=globalThis.localStorage;}catch{}return createProgressStore(storage).snapshot();}
if(globalThis.window&&window.parent!==window)mountQuestPanel();
