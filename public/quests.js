// Quest offer controller. See QUESTS-HANDOFF.md for the v2 content contract.
import {ESCAPE_QUEST, mountEscapeRoom} from './escape-room.js';
import {MEMORY_GAMES, mountMemoryGame} from './memory-games.js';
const STORAGE_KEY = 'campus-ghost.quests.v1';
const isText = value => typeof value === 'string' && value.trim().length > 0;
const integer = value => Number.isSafeInteger(value) && value >= 0 && value <= 10000;

export function createProgressStore(storage, warn = () => {}) {
  let state = {xp:0, completed:[]};
  function valid(value) {return value && Number.isSafeInteger(value.xp) && value.xp >= 0 && Array.isArray(value.completed) && value.completed.every(isText) && new Set(value.completed).size === value.completed.length;}
  function refresh() {
    if (!storage) return;
    try {const raw = storage.getItem(STORAGE_KEY); if (raw === null) {state={xp:0,completed:[]};return;} const saved = JSON.parse(raw); if (!valid(saved)) throw Error('Invalid saved progress'); state = saved;}
    catch {storage = null; warn('Saved progress could not be read. Progress will stay in this tab only.');}
  }
  function save() {if (storage) try {storage.setItem(STORAGE_KEY, JSON.stringify(state));} catch {storage=null;warn('Progress cannot be saved. Rewards remain available in this tab only; they may be lost after reload.');}}
  refresh();
  if (!storage) warn('Persistent storage is unavailable. Progress is kept in this tab only.');
  return {
    snapshot() {refresh(); return structuredClone(state);},
    award(id, xp) {
      if (!isText(id) || !integer(xp)) throw Error('Invalid reward');
      refresh(); if (state.completed.includes(id)) return 0;
      state = {xp:state.xp + xp, completed:[...state.completed, id]}; save(); return xp;
    },
    reset() {state={xp:0, completed:[]};save();},
  };
}

export const TRIVIA_ID='ghost-trivia-streak-v1';
export const INTERACTIVE_GAMES=[{...ESCAPE_QUEST,kind:'escape'},{...MEMORY_GAMES.potion,kind:'potion'},{...MEMORY_GAMES.signal,kind:'signal'}];

export function validateQuestData(data){
  const trivia=data?.trivia;
  if(data?.version!==2||!trivia||trivia.id!==TRIVIA_ID||!isText(trivia.title)||trivia.attemptLength!==10||!integer(trivia.completionXP)||trivia.completionXP===0||!Array.isArray(trivia.questions)||trivia.questions.length<30)throw Error('Expected version 2 with a ten-question trivia challenge and at least 30 bank questions.');
  const ids=new Set(),prompts=new Set();
  for(const question of trivia.questions){
    const normalized=question?.prompt?.trim?.().toLowerCase();
    if(!question||!isText(question.id)||ids.has(question.id)||!isText(question.prompt)||prompts.has(normalized)||!isText(question.explanation)||!Array.isArray(question.options)||question.options.length<2||question.options.length>6||!question.options.every(isText)||new Set(question.options.map(option=>option.trim().toLowerCase())).size!==question.options.length||!Number.isInteger(question.answerIndex)||question.answerIndex<0||question.answerIndex>=question.options.length)throw Error('Trivia questions need unique IDs/prompts, distinct answer options, a valid answerIndex, and an explanation.');
    ids.add(question.id);prompts.add(normalized);
  }
  return trivia;
}

export async function loadQuests(url=new URL('./quests.json',import.meta.url),fetcher=globalThis.fetch){
  const response=await fetcher(url);if(!response.ok)throw Error(`Quest content could not be loaded (${response.status}).`);
  return validateQuestData(await response.json());
}

export function makeTriviaAttempt(trivia,previous=[],random=Math.random){
  const shuffled=[...trivia.questions];
  for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  let chosen=shuffled.slice(0,10);
  // Even a repeated RNG stream must not reproduce the identical previous attempt.
  if(chosen.every((question,i)=>question.id===previous[i]))chosen=shuffled.slice(1,11);
  return chosen;
}

export function chooseInteractiveGame(previousId,random=Math.random){
  const pool=INTERACTIVE_GAMES.filter(game=>game.id!==previousId);
  return pool[Math.floor(random()*pool.length)];
}

let activeController,lastInteractiveId=null;

// Integration cleanup while startQuest's content-loading Promise is still pending.
// The normal resolved-controller.destroy() interface remains unchanged.
export function destroyQuest(){activeController?.destroy();}

/** Pat's interface stays unchanged. One mount, one active attempt at a time. */
export async function startQuest({roomId=null,ghostId=null,onComplete=()=>{},singleChallenge=false}={}){
  if((roomId!==null&&!isText(roomId))||(ghostId!==null&&!isText(ghostId))||typeof onComplete!=='function'||typeof singleChallenge!=='boolean')throw Error('Invalid quest integration context.');
  const root=document.getElementById('campus-quests');if(!root)throw Error('Add a #campus-quests container before calling startQuest.');
  activeController?.destroy();
  let disposed=false,run=0,view=0,loadGeneration=0,active=null,terminal=false,gameController=null,trivia=null,loadError='',warning='',warningNode,statsNode,attempt=[],previousAttempt=[],correct=0,challengeChosen=false;
  const returnLabel=singleChallenge?'Return to route':'Return to ghost offer';
  function warn(message){warning=message;if(warningNode)warningNode.textContent=message;}
  let storage;try{storage=globalThis.localStorage;}catch{warn('Persistent storage is unavailable. Progress is kept in this tab only.');}
  const progress=createProgressStore(storage,warn);
  function node(tag,text,css){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(css)el.className=css;return el;}
  function button(text,fn,primary=false){
    const token=view,el=node('button',text,primary?'primary':'');el.type='button';
    el.addEventListener('click',()=>{if(!disposed&&view===token)fn();});return el;
  }
  function focus(el){el.tabIndex=-1;el.focus();}
  function updateStats(){const saved=progress.snapshot();if(statsNode)statsNode.textContent=`${saved.xp} XP · ${saved.completed.length} saved challenge completions`;}
  function shell(){
    view++;root.replaceChildren();const header=node('header',undefined,'quest-header');header.append(node('p','Campus Ghost / Quest Arcade','quest-eyebrow'),node('h1','A challenge from your ghost'));
    statsNode=node('p',undefined,'quest-stats');updateStats();warningNode=node('p',warning,'quest-warning');warningNode.setAttribute('role','status');header.append(statsNode,warningNode);root.append(header);
  }
  function emit(quest,outcome,xpAwarded){
    try{onComplete({questId:quest.id,roomId,ghostId,outcome,xpAwarded});}catch(error){console.error('Quest callback failed',error);warn('The host could not receive this result. Local progress is still available.');}
  }
  function retire(){
    const abandoned=active&&!terminal?active:null;
    run++;gameController?.destroy();gameController=null;active=null;terminal=false;
    if(abandoned)emit(abandoned,'abandoned',0);
  }
  function leave(){if(disposed)return;retire();if(!disposed){if(singleChallenge){shell();root.append(node('p','Challenge closed. Returning to your route…'));}else offer();}}
  function offer(){
    if(disposed)return;shell();const panel=node('section',undefined,'quest-panel quest-offer'),heading=node('h2','Up for a little challenge?');
    panel.append(node('p',ghostId?`Current ghost: ${ghostId}`:'Your current quest ghost','quest-eyebrow'),heading,node('p','“Prove your knowledge with ten correct answers in a row… or let me surprise you with a game!”'));
    panel.append(node('p','Trivia uses 10 different questions per attempt. A wrong answer ends that attempt. Games are picked for you, with no immediate repeats. Saved XP always stays yours.','quest-muted'));
    const actions=node('div',undefined,'quest-actions'),play=button('Play trivia',beginTrivia,true);play.disabled=!trivia;actions.append(play,button('Give me a game instead',beginGame));panel.append(actions);
    if(loadError){const error=node('p',loadError,'quest-warning');error.setAttribute('role','alert');panel.append(error,button('Retry loading trivia',boot));}
    root.append(panel);focus(heading);
  }
  function beginTrivia(){
    if(!trivia||disposed||(singleChallenge&&challengeChosen))return;challengeChosen=true;retire();if(disposed)return;
    active=trivia;terminal=false;correct=0;attempt=makeTriviaAttempt(trivia,previousAttempt);previousAttempt=attempt.map(q=>q.id);renderQuestion();
  }
  function renderQuestion(){
    shell();const token=run,question=attempt[correct],panel=node('section',undefined,'quest-panel'),heading=node('h2',trivia.title);
    const progressText=node('p',`Question ${correct+1} of 10 · ${correct} / 10 correct in a row`,'quest-stats');panel.append(heading,progressText);
    const bar=node('progress');bar.max=10;bar.value=correct;bar.setAttribute('aria-label',`${correct} of 10 correct in a row`);panel.append(bar,node('h3',question.prompt));
    const choices=node('div',undefined,'quest-options'),feedback=node('div');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');let answered=false;
    const actions=node('div',undefined,'quest-actions');actions.append(button(returnLabel,leave));
    question.options.forEach((option,index)=>{
      const choice=button(option,()=>{
        if(answered||token!==run||terminal)return;answered=true;for(const el of choices.children)el.disabled=true;
        choice.classList.add('chosen');feedback.className='quest-feedback';
        feedback.append(node('p',index===question.answerIndex?'Correct!':'Attempt ended — the streak is broken.'),node('p',`Answer: ${question.options[question.answerIndex]}`),node('p',question.explanation));
        if(index!==question.answerIndex){
          terminal=true;feedback.append(node('p',`${correct} / 10 correct. No XP awarded; your previously saved XP and completions are unchanged.`));
          if(singleChallenge)actions.replaceChildren();else actions.replaceChildren(button('Try trivia again',beginTrivia,true),button('Give me a game instead',beginGame),button(returnLabel,leave));focus(feedback);emit(active,'failed',0);
        }else{
          correct++;progressText.textContent=`Question ${correct} of 10 · ${correct} / 10 correct in a row`;bar.value=correct;bar.setAttribute('aria-label',`${correct} of 10 correct in a row`);
          if(correct===10){
            terminal=true;const awarded=progress.award(TRIVIA_ID,trivia.completionXP);updateStats();
            feedback.append(node('h3','Challenge complete!'),node('p',`10 / 10 correct · ${awarded} XP awarded${awarded?'':' (already rewarded; practice only)'}`,'quest-stats'));
            actions.replaceChildren(...(singleChallenge?[]:[button(returnLabel,leave)]));focus(feedback);emit(active,'completed',awarded);
          }else{actions.replaceChildren(button('Next question',renderQuestion,true),button(returnLabel,leave));focus(feedback);}
        }
      });choices.append(choice);
    });panel.append(choices,feedback,actions);root.append(panel);focus(heading);
  }
  function beginGame(){
    if(disposed||(singleChallenge&&challengeChosen))return;challengeChosen=true;retire();if(disposed)return;
    // Encounters create a fresh iframe. Remember the previous game for this tab
    // so closing that frame does not defeat the no-immediate-repeat rule.
    try{const saved=globalThis.sessionStorage?.getItem('campus-ghost.quests.last-game');if(INTERACTIVE_GAMES.some(game=>game.id===saved))lastInteractiveId=saved;}catch{}
    const game=chooseInteractiveGame(lastInteractiveId);lastInteractiveId=game.id;
    try{globalThis.sessionStorage?.setItem('campus-ghost.quests.last-game',game.id);}catch{}
    active=game;terminal=false;const token=run;
    shell();const gameRoot=node('section');root.append(gameRoot);
    const current=()=>!disposed&&token===run&&active===game;
    const options={onLeave(){if(current())leave();},onRestart(){if(current()&&!singleChallenge)terminal=false;},onComplete(result){
      if(!current()||terminal)return;terminal=true;
      const awarded=progress.award(game.id,game.kind==='escape'?ESCAPE_QUEST.xp:result.potentialXP);updateStats();gameController?.setReward(awarded);if(singleChallenge)gameRoot.setAttribute('inert','');emit(game,'completed',awarded);
    }};
    gameController=game.kind==='escape'?mountEscapeRoom(gameRoot,options):mountMemoryGame(gameRoot,{...options,kind:game.kind});
  }
  const controller={destroy(){
    if(disposed)return;disposed=true;loadGeneration++;view++;retire();if(activeController===controller){root.replaceChildren();activeController=null;}
  }};
  activeController=controller;
  async function boot(){
    if(disposed)return;const token=++loadGeneration;shell();root.append(node('p','Loading trivia content…'));
    try{trivia=await loadQuests();loadError='';}catch(error){loadError=`Trivia is unavailable: ${error.message} You can still play a game.`;}
    if(!disposed&&token===loadGeneration)offer();
  }
  await boot();return controller;
}
