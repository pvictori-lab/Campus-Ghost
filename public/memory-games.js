// Predefined, dependency-free games. Host owns persistence and terminal callbacks.
export const MEMORY_GAMES = {
  potion:{id:'potion-panic-v1',title:'Potion Panic',items:[
    {label:'Moon dew',shape:'☾',color:'#acd7ff'}, {label:'Dreamleaf',shape:'♧',color:'#b6efbc'},
    {label:'Stardust',shape:'✧',color:'#ffe5a2'}, {label:'Ember salt',shape:'△',color:'#ffb8a2'},
    {label:'Cloud milk',shape:'○',color:'#e0d8ff'}, {label:'Nightberry',shape:'◇',color:'#edb1dc'},
  ],rounds:[[0,1],[2,0,3],[1,4,2,0],[5,3,1,4,2],[2,5,0,3,1,4]]},
  signal:{id:'ghost-signal-v1',title:'Ghost Signal',items:[
    {label:'Orb ghost · Circle',shape:'○',color:'#b5e7ff'}, {label:'Rune ghost · Square',shape:'□',color:'#dabfff'},
    {label:'Fang ghost · Triangle',shape:'△',color:'#ffcf9c'}, {label:'Wisp ghost · Diamond',shape:'◇',color:'#a4edcb'},
  ],rounds:[[0,2,1,3],[1,0,3,1,2],[2,3,0,2,1,3],[3,1,2,0,3,2,1],[0,1,3,2,0,3,1,2]]},
};

export function newMemoryState(){return {round:0,phase:'intro',input:[],assisted:false,revealed:false,score:0,roundScores:[],cue:-1,step:0};}

// Pure state transitions are separate from rendering and playback timers.
export function memoryAction(game,state,action,value){
  const next={...state,input:[...state.input],roundScores:[...state.roundScores]};
  if(action==='restart')return newMemoryState();
  if(action==='start' && (state.phase==='intro'||state.phase==='failed'||state.phase==='roundDone')){
    if(state.phase==='roundDone'){next.round++;next.assisted=false;}
    if(state.phase==='failed')next.assisted=true;
    next.phase=game==='potion'?'study':'playback';next.input=[];next.revealed=false;next.cue=-1;next.step=0;return next;
  }
  if(action==='ready' && ['study','playback'].includes(state.phase)){next.phase='input';next.cue=-1;return next;}
  if(action==='reveal' && state.phase==='input'){next.assisted=true;next.revealed=true;return next;}
  if(action==='watch' && state.phase==='input'){next.assisted=true;next.input=[];next.phase='playback';next.cue=-1;next.step=0;return next;}
  if(action==='undo' && state.phase==='input' && game==='potion'){next.input.pop();return next;}
  if(action==='pick' && state.phase==='input' && Number.isInteger(value) && value>=0 && value<MEMORY_GAMES[game].items.length){
    const sequence=MEMORY_GAMES[game].rounds[state.round];
    if(game==='signal' && value!==sequence[state.input.length]){next.input.push(value);next.phase='failed';next.assisted=true;return next;}
    if(next.input.length<sequence.length)next.input.push(value);
    if(game==='signal' && next.input.length===sequence.length)return finishRound(next);
  }
  if(action==='brew' && game==='potion' && state.phase==='input'){
    const sequence=MEMORY_GAMES.potion.rounds[state.round];
    if(state.input.length!==sequence.length)return next;
    if(state.input.some((value,i)=>value!==sequence[i])){next.phase='failed';next.assisted=true;}
    else return finishRound(next);
  }
  return next;
}

function finishRound(state){
  const points=state.assisted?10:20;
  return {...state,phase:state.round===4?'complete':'roundDone',score:state.score+points,roundScores:[...state.roundScores,points],cue:-1};
}

export function mountMemoryGame(root,{kind,onComplete,onLeave,onRestart=()=>{},clock=globalThis}){
  if(!Object.hasOwn(MEMORY_GAMES,kind))throw Error('Unknown memory game');
  const game=MEMORY_GAMES[kind];let state=newMemoryState(),disposed=false,timer=null,generation=0,manual=false,reported=false,rewardText='';
  const node=(tag,text,css)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(css)el.className=css;return el;};
  const button=(text,fn,css)=>{const el=node('button',text,css);el.type='button';el.addEventListener('click',fn);return el;};
  const content=node('div'),status=node('p',undefined,'memory-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
  root.className=`memory-game memory-${kind}`;root.replaceChildren(status,content);
  function cancel(){generation++;if(timer!==null)clock.clearTimeout(timer);timer=null;}
  function later(fn,ms){const token=generation;timer=clock.setTimeout(()=>{timer=null;if(!disposed&&token===generation)fn();},ms);}
  function sequenceText(){return game.rounds[state.round].map(i=>game.items[i].label).join(' → ');}
  function send(action,value){
    if(disposed)return;
    const before=state.phase;state=memoryAction(kind,state,action,value);
    if(before!==state.phase)cancel();
    render(action==='pick'&&state.phase==='input'?`memory-pad-${value}`:null);
    if(['start','watch'].includes(action)&&['study','playback'].includes(state.phase))playback();
    if(state.phase==='complete'&&!reported){reported=true;onComplete({potentialXP:20+state.score,score:state.score,roundScores:[...state.roundScores]});}
  }
  function playback(){
    cancel();
    if(kind==='potion'){
      // The reveal aid remains available after the brief memorization stage.
      later(()=>send('ready'),2600+game.rounds[state.round].length*450);return;
    }
    if(!manual)lightNext();
  }
  function lightNext(){
    if(disposed||state.phase!=='playback')return;
    const sequence=game.rounds[state.round];
    if(state.step>=sequence.length){send('ready');return;}
    state={...state,cue:sequence[state.step],step:state.step+1};render(null,false);
    if(!manual)later(()=>{state={...state,cue:-1};render(null,false);later(lightNext,400);},1100);
  }
  function speak(){
    if(state.phase==='intro')return kind==='potion'?'Five tiny potions. One very forgetful ghost. Ready to help?':'The ghosts have a message. Watch their shapes, then echo them back.';
    if(state.phase==='study')return 'Memorize the recipe. It will hide shortly; choose “Ready to mix” to start sooner.';
    if(state.phase==='playback')return state.cue<0?'Watch the signals. Input is locked during playback.':`Signal ${state.step} of ${game.rounds[state.round].length}: ${game.items[state.cue].label}.`;
    if(state.phase==='input')return `Your turn. ${state.input.length} of ${game.rounds[state.round].length} ${kind==='potion'?'ingredients selected':'signals matched'}.${state.revealed?' Recipe revealed: this round is worth 10 points.':''}`;
    if(state.phase==='failed')return 'A harmless puff of ectoplasm! Retry this round for 10 points. Earlier rounds and saved XP stay safe.';
    if(state.phase==='roundDone')return `Perfect order! Round ${state.round+1} complete: +${state.roundScores.at(-1)} points.`;
    return 'Five rounds complete. The ghosts are giving you a standing boo-vation!';
  }
  function render(focusId=null,moveFocus=true){
    content.replaceChildren();const heading=node('h2',game.title);content.append(node('p','Interactive game · Five rounds','quest-eyebrow'),heading);
    const progress=node('p',`Round ${state.round+1} / 5 · ${state.score} points banked this run`,'quest-stats');content.append(progress);
    const bar=node('progress');bar.max=5;bar.value=state.roundScores.length;bar.setAttribute('aria-label',`${state.roundScores.length} of 5 rounds complete`);content.append(bar);
    if(state.phase==='intro'){
      content.append(node('p',kind==='potion'?'Memorize each briefly shown recipe, then select its ingredients in order and brew. Recipes grow from 2 to 6 ingredients. Reveal the recipe if you need help; that round earns 10 instead of 20 points. These are imaginary ingredients, not real recipes.':'Watch four named ghost shapes light up one at a time, then repeat their order. Sequences grow from 4 to 8 signals. Use the pads or number keys 1–4. You can choose step-by-step playback instead of automatic playback.'));
      content.append(node('p','Finish five rounds to earn 20 completion XP plus your round points (70–120 XP). A reveal, replayed sequence, or retry makes that round worth 10 instead of 20. No saved XP is ever deducted. Completion rewards are earned once per game.','quest-muted'));
      if(kind==='signal'){const mode=button(manual?'Playback: step-by-step':'Playback: automatic',()=>{manual=!manual;render();});mode.setAttribute('aria-pressed',String(manual));content.append(mode);}
      content.append(button('Start game',()=>send('start'),'primary'));
    }else if(state.phase==='complete'){
      content.append(node('div','✧  ✦  ✧','memory-celebrate'),node('h3','All five rounds complete!'),node('p',`Round points: ${state.roundScores.join(' + ')} = ${state.score}. Completion bonus: 20 XP.`));
      const reward=node('p',rewardText||'Recording completion…','quest-stats');reward.id='memory-reward';content.append(reward,button('Return to ghost offer',onLeave,'primary'));
    }else{
      const stage=node('section',undefined,'memory-stage');
      if(kind==='potion'){
        const cauldron=node('div',undefined,'potion-cauldron');cauldron.append(node('span',state.phase==='roundDone'?'✧':'☾'));cauldron.setAttribute('aria-hidden','true');stage.append(cauldron);
        if(state.phase==='study'||state.revealed||state.phase==='failed'||state.phase==='roundDone'){
          stage.append(node('h3',state.phase==='study'?'Memorize this recipe':'Recipe reference'),node('p',sequenceText(),'memory-recipe'));
        }else stage.append(node('h3','Recipe hidden'),node('p','Select ingredients in order. You can undo before brewing.'));
        if(state.phase==='study')stage.append(button('Ready to mix',()=>send('ready'),'primary'));
      }else stage.append(node('h3',state.phase==='playback'?'Watch the ghosts':'Echo the ghosts'),node('p',state.phase==='playback'&&state.cue>=0?`${state.step}. ${game.items[state.cue].shape} ${game.items[state.cue].label}`:'Four shapes. Four names. One ghostly message.','memory-cue'));
      const pads=node('div',undefined,`memory-pads ${kind==='potion'?'potion-pads':'signal-pads'}`);
      game.items.forEach((item,i)=>{
        const pad=button('',()=>send('pick',i),'memory-pad');pad.id=`memory-pad-${i}`;pad.style.setProperty('--pad-color',item.color);pad.disabled=state.phase!=='input'||(kind==='potion'&&state.input.length===game.rounds[state.round].length);pad.setAttribute('aria-label',`${i+1}: ${item.label}`);pad.setAttribute('aria-keyshortcuts',String(i+1));
        const shape=node('span',item.shape,'memory-shape');shape.setAttribute('aria-hidden','true');pad.append(shape,node('span',`${i+1} · ${item.label}`));
        if(kind==='signal'&&state.cue===i){pad.className+=' lit';pad.append(node('span','SIGNAL','memory-lit-label'));}
        pads.append(pad);
      });stage.append(pads);
      if(state.phase==='playback'&&manual){const step=button(state.step<game.rounds[state.round].length?'Next signal':'Start repeating',lightNext,'primary');step.id='memory-next-signal';stage.append(step);}
      if(state.phase==='input'||state.phase==='failed'||state.phase==='roundDone'){
        const picks=node('ol',undefined,'memory-picks');state.input.forEach(i=>picks.append(node('li',game.items[i].label)));stage.append(node('h3','Your order'),picks);
        if(!state.input.length)stage.append(node('p','No selections yet.','quest-muted'));
      }
      if(state.phase==='input'){
        const actions=node('div',undefined,'quest-actions');
        if(kind==='potion'){
          const undo=button('Undo ingredient',()=>send('undo'));undo.disabled=!state.input.length;
          const reveal=button('Reveal recipe · 10-point round',()=>send('reveal'));reveal.disabled=state.revealed;
          const brew=button('Brew potion',()=>send('brew'),'primary');brew.id='memory-brew';brew.disabled=state.input.length!==game.rounds[state.round].length;actions.append(undo,reveal,brew);
        }else actions.append(button('Watch again · 10-point round',()=>send('watch')));
        stage.append(actions);
      }
      if(state.phase==='failed')stage.append(button('Retry round',()=>send('start'),'primary'));
      if(state.phase==='roundDone')stage.append(button('Next round',()=>send('start'),'primary'));
      content.append(stage);
    }
    const controls=node('div',undefined,'quest-actions');controls.append(button('Restart game',()=>{
      if(globalThis.confirm('Restart all five rounds? Saved XP stays safe; unfinished run points will reset.')){cancel();onRestart();reported=false;rewardText='';state=newMemoryState();render();}
    }));if(state.phase!=='complete')controls.append(button('Exit game',()=>{cancel();onLeave();}));content.append(controls);
    status.textContent=speak();
    if(moveFocus){let target=focusId?document.getElementById(focusId):heading;if(target?.disabled)target=document.getElementById('memory-brew')||heading;if(target){if(target===heading)target.tabIndex=-1;target.focus();}}
    else if(manual&&state.phase==='playback')document.getElementById('memory-next-signal')?.focus();
  }
  function keydown(event){
    if(disposed||event.repeat||event.ctrlKey||event.metaKey||event.altKey||state.phase!=='input')return;
    const index=Number(event.key)-1;
    if(/^[1-6]$/.test(event.key)&&index<game.items.length){event.preventDefault();send('pick',index);}
  }
  root.addEventListener('keydown',keydown);render();
  return {destroy(){if(disposed)return;disposed=true;cancel();root.removeEventListener('keydown',keydown);root.replaceChildren();},setReward(xp){rewardText=xp?`+${xp} XP awarded!`:'Practice complete · Already rewarded, so 0 XP awarded.';const el=document.getElementById('memory-reward');if(el)el.textContent=rewardText;}};
}
