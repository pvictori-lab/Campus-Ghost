const $=id=>document.getElementById(id);
const [b,courses]=await Promise.all([fetch('building.json').then(r=>r.json()),fetch('courses.json').then(r=>r.json())]);
let route=[],step=0;const byId=id=>b.nodes.find(n=>n.id===id);
const option=(value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;return o;};
$('building').textContent=b.name;
b.nodes.forEach(n=>$('start').append(option(n.id,n.label)));
b.rooms.forEach(id=>$('destination').append(option(id,byId(id).label)));
courses.forEach(c=>$('courses').append(option(c.id,c.title)));
function current(){return courses.find(c=>c.id===$('courses').value);}
function course(){const c=current();$('course').replaceChildren();[c.description,`Meets: ${c.meeting}`,`Room: ${c.roomId}`,`Milestone: ${c.milestone}`].forEach(t=>{const p=document.createElement('p');p.textContent=t;$('course').append(p);});$('destination').value=c.roomId;reset();}
function path(start,end){const q=[[start]],seen=new Set([start]);while(q.length){const p=q.shift(),last=p.at(-1);if(last===end)return p;for(const [a,z] of b.edges){const next=a===last?z:z===last?a:null;if(next&&!seen.has(next)){seen.add(next);q.push([...p,next]);}}}return [];}
function svg(tag,attrs){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);$('map').append(el);return el;}
function draw(){ $('map').replaceChildren();for(const [a,z] of b.edges){const p=byId(a),q=byId(z);svg('line',{x1:p.x,y1:p.y,x2:q.x,y2:q.y,stroke:'#d2cfe2','stroke-width':30,'stroke-linecap':'round'});}if(route.length){svg('polyline',{points:route.map(id=>{const n=byId(id);return `${n.x},${n.y}`;}).join(' '),fill:'none',stroke:'#8662d3','stroke-width':7});}b.nodes.forEach(n=>{svg('circle',{cx:n.x,cy:n.y,r:9,fill:'#303650'});const t=svg('text',{x:n.x,y:n.y+30,'text-anchor':'middle',fill:'#25253c','font-size':16});t.textContent=n.label;});if(route.length){const n=byId(route[step]);svg('circle',{cx:n.x,cy:n.y,r:16,fill:'#08a99e',stroke:'white','stroke-width':3});}}
function guidance(){draw();if(!route.length){$('next').disabled=true;return;}if(step===route.length-1){$('instruction').textContent=`You confirmed arrival at ${byId(route[step]).label}. Review your course details above.`;$('next').disabled=true;}else{$('instruction').textContent=`Last confirmed: ${byId(route[step]).label}. Follow the highlighted segment to ${byId(route[step+1]).label}. Confirm only when you reach it.`;$('next').disabled=false;}}
function reset(){route=[];step=0;$('next').disabled=true;$('instruction').textContent='Choose your actual starting checkpoint, then select Guide me. The ghost does not track movement.';draw();}
$('go').onclick=()=>{route=path($('start').value,$('destination').value);step=0;if(!route.length)$('instruction').textContent='No verified route available.';guidance();};
$('next').onclick=()=>{if(step<route.length-1)step++;guidance();};$('lost').onclick=reset;$('start').onchange=reset;$('destination').onchange=reset;$('courses').onchange=course;
$('chat').onsubmit=async e=>{e.preventDefault();$('ask').disabled=true;$('reply').textContent='Ghost is thinking…';try{const r=await fetch('/api/ghost',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:$('question').value,courseId:current().id})});const data=await r.json();$('reply').textContent=data.reply;}catch{$('reply').textContent='Connection unavailable. Your map and course cards still work.';}finally{$('ask').disabled=false;}};
course();
