export function target(){const listeners=new Map();return {addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},dispatchEvent(event){const pending=[...listeners.get(event.type)||[]].map(fn=>fn(event));return Promise.all(pending);}};}
export class FakeEvent{constructor(type,options={}){this.type=type;Object.assign(this,options);}preventDefault(){}}
export function clockFixture(){let next=0;const tasks=new Map();return {setTimeout(fn){tasks.set(++next,fn);return next;},clearTimeout(id){tasks.delete(id);},flush(){let guard=0;while(tasks.size){if(++guard>100)throw Error('Timer loop');const [id,fn]=tasks.entries().next().value;tasks.delete(id);fn();}},get size(){return tasks.size;}};}
export function storageFixture(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
export function documentFixture(){
 const registry=new Map();let document;
 class Element{
  constructor(tag){Object.assign(this,target());this.tagName=tag;this.children=[];this.style={setProperty(key,value){this[key]=value;}};this.dataset={};this.attrs={};this.disabled=false;this.hidden=false;this.textContent='';this.value='';this.max=100;this.classList={add(){},remove(){}};this.clientWidth=800;this.offsetWidth=100;if(tag==='iframe')this.contentWindow={postMessage(){}};}
  set id(value){this._id=value;registry.set(value,this);}get id(){return this._id;}
  append(...items){for(const item of items)item.parent=this;this.children.push(...items);if(this.tagName==='select'&&!this.value)this.value=items[0]?.value||'';}appendChild(item){this.append(item);return item;}
  replaceChildren(...items){this.children=[];this.value='';this.append(...items);}
  get options(){return this.children;}
  setAttribute(key,value){this.attrs[key]=value;if(key==='id')this.id=value;else this[key]=value;}removeAttribute(key){delete this.attrs[key];}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(item=>item!==this);if(this.id)registry.delete(this.id);}
  before(item){this.parent?.append(item);}after(item){this.parent?.append(item);}closest(){return document.navSection;}
  focus(){}select(){}showModal(){this.open=true;}close(){this.open=false;}
  click(){if(this.disabled)return Promise.resolve();const event=new FakeEvent('click');const direct=this.onclick?.(event);return Promise.all([direct,this.dispatchEvent(event)]);}
  cloneNode(){const el=new Element(this.tagName);el.attrs={...this.attrs};return el;}
  set innerHTML(html){this.children=[];for(const match of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){const el=new Element(match[1]);el.id=match[2];this.append(el);}if(html.includes('class="toon-ghost"')){const svg=new Element('svg');svg.className='toon-ghost';this.append(svg);}}
 }
 document={...target(),documentElement:{dataset:{}},body:new Element('body'),head:new Element('head'),hidden:false,getElementById:id=>registry.get(id)||null,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)};
 document.navSection=new Element('section');document.body.append(document.navSection);
 for(const id of ['map','checkpoint','destination','confirm','confirm-next','confirmed-checkpoint','next-checkpoint','journey-destination','reset','lost','copy','chat','question','ask','reply','temperature','instruction','last','progress','progressLabel','journeyStatus','next-checkpoint-help','hero','scene','door','building','checkpointLink','copyStatus','encounter-layer','encounter-status','course','courseCard','campus-quests']){const el=new Element(['checkpoint','destination','course'].includes(id)?'select':'div');el.id=id;document.navSection.append(el);}
 const walk=el=>[el,...el.children.flatMap(walk)];
 document.querySelector=selector=>selector==='#checkpoint option'?document.getElementById('checkpoint').children[0]:selector==='#hero .toon-ghost'?walk(document.getElementById('hero')).find(el=>el.className==='toon-ghost'):null;
 document.querySelectorAll=()=>[];
 return {document,$:id=>document.getElementById(id),all:()=>walk(document.getElementById('campus-quests')),button(text){const el=walk(document.getElementById('campus-quests')).find(el=>el.tagName==='button'&&el.textContent===text);if(!el)throw Error('Missing button '+text);return el;}};
}
export function globals(values){const old=new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const [key,value]of Object.entries(values))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});return ()=>{for(const [key,desc]of old){if(desc)Object.defineProperty(globalThis,key,desc);else delete globalThis[key];}};}
