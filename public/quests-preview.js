import {PANEL_PROTOCOL} from './quest-protocol.js';
export {PANEL_PROTOCOL};
export const PREVIEW_CONTEXT=Object.freeze({roomId:'demo-study-room-101',ghostId:'demo-popup-ghost'});

export function mountQuestPreview({document:doc=globalThis.document,window:win=globalThis.window,clock=globalThis}={}){
  const get=id=>doc.getElementById(id),dialog=get('quest-dialog'),slot=get('quest-panel-slot'),openButton=get('open-quest');
  let session=null,reopen=false,disposed=false;const events=[];
  function log(event,detail={}){events.unshift({event,...detail});events.length=Math.min(events.length,8);get('quest-debug').textContent=events.map(item=>JSON.stringify(item,null,2)).join('\n\n');}
  function post(command){session?.frame.contentWindow?.postMessage({protocol:PANEL_PROTOCOL,command,...(command==='open'?PREVIEW_CONTEXT:{})},win.location.origin);}
  function removeSession(reason){
    if(!session)return;clock.clearTimeout(session.timeout);session.frame.remove();session=null;get('host-status').textContent='Panel closed. Saved XP has not been cleared.';log(reason);
    if(reopen&&!disposed){reopen=false;open();}
  }
  function close(){
    if(!session||session.closing)return;session.closing=true;
    post('destroy');if(dialog.open)dialog.close();openButton.focus();
    get('host-status').textContent='Closing panel and cleaning up its activity…';log('destroy-requested');
    // Failed iframe loads cannot acknowledge. Removing their browsing context also stops its timers.
    const closingSession=session;
    session.timeout=clock.setTimeout(()=>{if(session===closingSession)removeSession('iframe-removed-without-acknowledgment');},2000);
  }
  function open(){
    if(disposed)return;
    if(session){if(session.closing){reopen=true;get('host-status').textContent='Finishing cleanup before reopening…';}return;}
    const frame=doc.createElement('iframe');frame.title='Campus Ghost quest challenge';frame.src='quests-panel.html';
    session={frame,closing:false,started:false,timeout:null};slot.append(frame);dialog.showModal();get('close-quest').focus();
    get('host-status').textContent='Opening the quest offer…';log('panel-created',PREVIEW_CONTEXT);
  }
  function receive(event){
    if(!session||event.source!==session.frame.contentWindow||event.origin!==win.location.origin||event.data?.protocol!==PANEL_PROTOCOL)return;
    const data=event.data;
    if(data.event==='ready'){
      if(session.closing)post('destroy');else if(!session.started){session.started=true;post('open');}
    }else if(data.event==='mounted'&&!session.closing){get('host-status').textContent='Quest offer open. Your host page keeps its own styles.';log('startQuest-resolved',PREVIEW_CONTEXT);}
    else if(data.event==='result'&&validResult(data.result)){log('quest-result',data.result);}
    else if(data.event==='progress'&&Number.isSafeInteger(data.xp)&&data.xp>=0){get('host-xp').textContent=String(data.xp);}
    else if(data.event==='close-request')close();
    else if(data.event==='destroyed'&&session.closing)removeSession('destroy-confirmed');
    else if(data.event==='error'){get('host-status').textContent='The quest panel could not start. Close it and try again.';log('panel-error',{message:String(data.message)});}
  }
  function validResult(result){return result&&typeof result.questId==='string'&&result.roomId===PREVIEW_CONTEXT.roomId&&result.ghostId===PREVIEW_CONTEXT.ghostId&&['completed','failed','abandoned'].includes(result.outcome)&&Number.isSafeInteger(result.xpAwarded)&&result.xpAwarded>=0;}
  const cancel=event=>{event.preventDefault();close();};
  const afterClose=()=>{if(!dialog.open)close();};
  openButton.addEventListener('click',open);get('close-quest').addEventListener('click',close);dialog.addEventListener('cancel',cancel);dialog.addEventListener('close',afterClose);win.addEventListener('message',receive);
  return {open,close,destroy(){
    if(disposed)return;disposed=true;reopen=false;close();
    // A host teardown removes the iframe context even if the child cannot acknowledge.
    removeSession('preview-destroyed');if(dialog.open)dialog.close();
    openButton.removeEventListener('click',open);get('close-quest').removeEventListener('click',close);dialog.removeEventListener('cancel',cancel);dialog.removeEventListener('close',afterClose);win.removeEventListener('message',receive);
  }};
}

if(globalThis.document?.getElementById('quest-dialog'))mountQuestPreview();
