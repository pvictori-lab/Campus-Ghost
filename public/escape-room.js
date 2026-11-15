// Predefined fictional room. No map, location, QR, or ghost ownership dependencies.
export const ESCAPE_QUEST = Object.freeze({id:'haunted-study-escape-v1',title:'Haunted Room Escape',xp:80});
export const ROOM_CONTENT = Object.freeze({
  note:'A folded note: MOON = 4, STAR = 2, KEY = 7. Keep this symbol guide.',
  strip:'A brass key and an exit instruction: “Use the brass key first. Then enter the symbols in this order: KEY → MOON → STAR.”',
  hints:[
    'The wall inscription mentions ivy. Inspect the ivy pot: something is tucked beneath it.',
    'Collect the folded note beneath the ivy. The desk asks for MOON → STAR → KEY. The note translates that to 4 → 2 → 7.',
    'Open the desk with 427. Take its key and instruction strip. Use the brass key at the exit, then translate KEY → MOON → STAR with the folded note: 742.',
  ],
});

export function newEscapeState(){return {note:false,desk:false,keyUsed:false,escaped:false,hints:0};}
export function actInRoom(state, action, value=''){
  const next={...state};let message='';
  if(state.escaped)return {state:next,message:'The door is already open. Beautifully un-haunted!'};
  switch(action){
    case 'collect': next.note=true;message=state.note?'You already saved the folded note. Check your inventory.':`You collected the folded note. ${ROOM_CONTENT.note}`;break;
    case 'desk':
      if(!state.note)message='The lock clicks, but you need a symbol guide. The ivy might be hiding one.';
      else if(value.trim()!=='427')message='Not quite. Translate MOON → STAR → KEY using your folded note. Nothing is lost; try again.';
      else {next.desk=true;message=state.desk?'The desk is already open.':`Click! You collected the brass key and exit instruction. ${ROOM_CONTENT.strip}`;}
      break;
    case 'key':
      if(!state.desk)message='No key yet. A little desk investigation, perhaps?';
      else {next.keyUsed=true;message=state.keyUsed?'The key is already in the exit.':'The brass key turns! One last puzzle: read the exit instruction and your symbol guide together.';}
      break;
    case 'exit':
      if(!state.keyUsed)message='The exit needs its brass key before the code can work.';
      else if(value.trim()!=='742')message='The exit stays shut. Its order is KEY → MOON → STAR. Use the folded note to translate it.';
      else {next.escaped=true;message='You escaped! I was going to haunt you, but honestly, I’m impressed.';}
      break;
    case 'hint':next.hints=Math.min(3,state.hints+1);message=ROOM_CONTENT.hints[next.hints-1];break;
    default:throw Error('Unknown room action');
  }
  return {state:next,message};
}

export function mountEscapeRoom(root,{onComplete,onLeave,onRestart=()=>{}}){
  let state=newEscapeState(),disposed=false,view='intro',feedback='Welcome, brave scholar! My challenge: escape this study room. Inspect its secrets, collect clues, and outwit my locks. No spooky outside knowledge required.',reported=false;
  function el(tag,text,css){const item=document.createElement(tag);if(text!==undefined)item.textContent=text;if(css)item.className=css;return item;}
  function btn(text,fn,css){const button=el('button',text,css);button.type='button';button.addEventListener('click',fn);return button;}
  function focus(item){item.tabIndex=-1;item.focus();}
  function svg(tag,attrs){const item=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))item.setAttribute(key,value);return item;}
  function action(type,value){if(disposed||state.escaped)return;const result=actInRoom(state,type,value);state=result.state;feedback=result.message;if(state.escaped)view='won';render();if(state.escaped&&!reported){reported=true;onComplete({hintsUsed:state.hints});}}
  function inspect(object){
    if(disposed||state.escaped)return;
    view=object;
    feedback={wall:'“When midnight hides the way, look beneath the ivy.” A very dramatic way to label a hiding place.',ivy:state.note?'Just ivy now. Your folded note is safely in the inventory.':'A corner of paper peeks out beneath the ivy pot. No gardening skills required.',desk:state.desk?'The desk is open. You have its key and exit instruction.':'The desk has a three-digit lock engraved MOON → STAR → KEY. Find the matching symbol guide.',exit:state.keyUsed?'Key fitted. Now combine the exit instruction with your folded note.':'A keyhole and a three-digit panel. The door reads: “A key, then a code.”'}[object];render();
  }
  function icon(kind){
    const image=svg('svg',{viewBox:'0 0 120 120','aria-hidden':'true',focusable:'false'});
    const shapes={wall:[['rect',{x:20,y:18,width:80,height:80,rx:4,fill:'#dcb888',stroke:'#5b3650','stroke-width':7}],['path',{d:'M38 45H82M38 60H75M38 75H80',stroke:'#62425f','stroke-width':5}]],ivy:[['path',{d:'M32 72H88L79 110H41Z',fill:'#ca926c'}],['path',{d:'M60 77V24M60 40Q20 5 25 50Q45 66 60 40M60 60Q105 25 100 65Q75 84 60 60',fill:'#7dbb9f',stroke:'#477d70','stroke-width':4}]],desk:[['rect',{x:8,y:30,width:104,height:65,rx:5,fill:'#9b6b87',stroke:'#e4b88e','stroke-width':5}],['path',{d:'M20 95V112M100 95V112M15 64H105',stroke:'#e4b88e','stroke-width':7}],['circle',{cx:60,cy:78,r:6,fill:'#ffd783'}]],exit:[['path',{d:'M25 110V35A35 35 0 0 1 95 35V110Z',fill:state.escaped?'#aaf5cc':'#68658e',stroke:'#d7b58b','stroke-width':7}],['circle',{cx:79,cy:70,r:5,fill:'#ffdf95'}]]};
    for(const [tag,attrs]of shapes[kind])image.append(svg(tag,attrs));return image;
  }
  function codeForm(label,order,type,disabled){
    const form=el('form',undefined,'escape-code'),id=`escape-${type}-code`,input=el('input'),caption=el('label',label);
    caption.htmlFor=id;input.id=id;input.type='text';input.inputMode='numeric';input.pattern='[0-9]{3}';input.maxLength=3;input.required=true;input.autocomplete='off';input.setAttribute('aria-describedby',`${id}-order`);input.disabled=disabled;
    const orderText=el('p',order,'escape-order');orderText.id=`${id}-order`;const submit=el('button',type==='desk'?'Unlock desk':'Open exit','primary');submit.type='submit';submit.disabled=disabled;
    form.addEventListener('submit',event=>{event.preventDefault();action(type,input.value);});form.append(caption,orderText,input,submit);return form;
  }
  function render(){
    root.replaceChildren();root.className=`escape-game${state.escaped?' escape-won':''}`;
    const heading=el('h2',state.escaped?'Room escaped!':ESCAPE_QUEST.title);root.append(el('p','A fictional room · About 2–3 minutes · No timer','quest-eyebrow'),heading);
    const step=state.escaped?3:state.desk?2:state.note?1:0;
    const steps=el('ol',undefined,'escape-steps');['Find the hidden clue','Unlock the desk','Open the exit'].forEach((label,index)=>{const item=el('li',`${index<step?'✓ ':''}${label}`);if(index===step)item.setAttribute('aria-current','step');steps.append(item);});root.append(steps);
    const room=el('div',undefined,'escape-room');room.setAttribute('role','group');room.setAttribute('aria-label','Study room. Inspect any object using its labeled button.');room.append(el('div',undefined,'escape-window'),el('div',undefined,'escape-rug'));
    for(const [kind,label]of [['wall','Wall inscription'],['ivy','Ivy pot'],['desk',state.desk?'Open desk':'Locked desk'],['exit',state.escaped?'Open doorway':'Exit door']]){
      const object=btn('',()=>inspect(kind),`escape-object escape-${kind}`);object.disabled=state.escaped;object.setAttribute('aria-label',`Inspect ${label.toLowerCase()}`);object.append(icon(kind),el('span',label));room.append(object);
    }root.append(room);
    const ghost=el('div',undefined,'escape-ghost');const ghostLabel=el('strong','Quest ghost');ghost.append(ghostLabel,el('p',feedback));ghost.setAttribute('role','status');ghost.setAttribute('aria-live','polite');root.append(ghost);
    const workspace=el('div',undefined,'escape-workspace'),panel=el('section',undefined,'escape-inspect');
    const title=el('h3',state.escaped?'Fresh air. Excellent detective work.':{intro:'Your room awaits',wall:'The wall inscription',ivy:'Beneath the ivy',desk:'The symbol desk',exit:'The final door'}[view]);panel.append(title);
    if(view==='intro')panel.append(el('p','Inspect the four labeled objects. Collect clues, read them in your inventory, and use what you discover to open the door. No outside knowledge needed.'));
    if(view==='wall')panel.append(el('p','“When midnight hides the way, look beneath the ivy.”'));
    if(view==='ivy')panel.append(state.note?el('p','The folded note is in your inventory.'):btn('Collect folded note',()=>action('collect'),'primary'));
    if(view==='desk'){
      if(state.desk)panel.append(el('p',ROOM_CONTENT.strip));
      else {panel.append(el('p',state.note?'Translate the engraving with your folded note.':'You need a symbol guide before using the lock. Explore the room.'));panel.append(codeForm('Desk code','MOON → STAR → KEY','desk',!state.note));}
    }
    if(view==='exit'&&!state.escaped){
      panel.append(el('p',state.desk?ROOM_CONTENT.strip:'A small label reads: “A key, then a code.” The desk might hold something useful.'));
      const use=btn(state.keyUsed?'Brass key fitted':'Use brass key',()=>action('key'),'primary');use.disabled=!state.desk||state.keyUsed;panel.append(use);
      if(state.keyUsed)panel.append(codeForm('Exit code','KEY → MOON → STAR','exit',false));
    }
    if(state.escaped){
      const burst=el('div','✦  ✧  ✦','escape-burst');burst.setAttribute('aria-hidden','true');panel.append(burst,el('p',`Three puzzles solved · ${state.hints} / 3 hints used. Hints never reduce your reward.`));
      const summary=el('p','Recording your escape…','quest-stats');summary.id='escape-reward';panel.append(summary);
      panel.append(btn('Return to ghost offer',onLeave,'primary'));
    }
    const inventory=el('section',undefined,'escape-inventory');inventory.append(el('h3','Inventory & clue journal'));
    if(!state.note)inventory.append(el('p','Nothing collected yet. Inspect the room to begin.','quest-muted'));
    if(state.note)inventory.append(el('p',ROOM_CONTENT.note));
    if(state.desk)inventory.append(el('p',`Brass key: ${state.keyUsed?'fitted in exit':'collected — use at exit'}.`),el('p',ROOM_CONTENT.strip));
    workspace.append(panel,inventory);root.append(workspace);
    if(state.hints){const list=el('ol',undefined,'escape-hints');ROOM_CONTENT.hints.slice(0,state.hints).forEach(h=>list.append(el('li',h)));root.append(list);}
    const actions=el('div',undefined,'quest-actions');
    if(!state.escaped){const hint=btn(`Hint ${Math.min(state.hints+1,3)} of 3`,()=>action('hint'));hint.disabled=state.hints===3;actions.append(hint);}
    actions.append(btn('Restart room',()=>{if(globalThis.confirm('Restart this room? Puzzle clues and hints will reset. Earned XP will stay saved.')){onRestart();state=newEscapeState();view='intro';reported=false;feedback='A fresh haunting! Same room, clean notebook. Let’s try again.';render();}}));
    if(!state.escaped)actions.append(btn('Leave room',onLeave));root.append(actions);focus(title);
  }
  render();
  return {destroy(){disposed=true;root.replaceChildren();},setReward(xp){const text=document.getElementById('escape-reward');if(text)text.textContent=xp?`+${xp} XP · Escape recorded!`:'Practice escape · Already completed, so no additional XP.';}};
}
