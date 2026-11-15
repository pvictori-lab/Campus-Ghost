import {installRouteEncounters} from './route-encounters.js';
import {buildNavigationPlan} from './navigation-plan.js';

const $ = id => document.getElementById(id);

const STORAGE_KEY = "campus-ghost-journey-v3";
const LEGACY_STORAGE_KEY = "campus-ghost-halle-v2";
let courses = [];
const SVG_NS = "http://www.w3.org/2000/svg";

let building = null;
let nodes = new Map();
let journey = null;
let encounters = null;
let navigationPaused = false;
let savedControls = [];
function updateCheckpointEntryAvailability(){
  for(const id of ['checkpoint-code-toggle','checkpoint-code','checkpoint-code-confirm'])if($(id))$(id).disabled=navigationPaused;
}
function bindCheckpointEntry(){
  const form=$('checkpoint-code-form'),toggle=$('checkpoint-code-toggle'),input=$('checkpoint-code'),feedback=$('checkpoint-code-feedback');
  if(!form||!toggle||!input||!feedback||form.dataset.bound)return;
  form.dataset.bound='true';form.hidden=true;
  toggle.addEventListener('click',()=>{
    if(navigationPaused)return;form.hidden=!form.hidden;toggle.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)input.focus();
  });
  input.addEventListener('input',()=>{input.setAttribute('aria-invalid','false');feedback.textContent='';feedback.dataset.state='';});
  form.addEventListener('submit',event=>{
    event.preventDefault();if(navigationPaused)return;
    const code=input.value.trim().toUpperCase();
    const checkpoint=building.nodes.find(node=>isCheckpoint(node)&&node.id.toUpperCase()===code);
    if(!checkpoint){
      feedback.textContent=code?'That checkpoint code wasn’t found. Check the sign and try again, such as Q4.':'Enter a checkpoint code, such as Q4.';
      feedback.dataset.state='error';input.setAttribute('aria-invalid','true');input.focus();return;
    }
    $('checkpoint').value=checkpoint.id;updateCheckpointLink();
    const result=confirmCheckpoint({source:'manual-code'});
    if(!result?.ok){feedback.textContent=$('copyStatus').textContent||'This checkpoint could not be confirmed.';feedback.dataset.state='error';input.setAttribute('aria-invalid','true');return;}
    input.value=checkpoint.id;input.setAttribute('aria-invalid','false');feedback.dataset.state='success';
    feedback.textContent=result.changed?`You’re at ${checkpoint.label} (${checkpoint.id}).`:`You’re already at ${checkpoint.label} (${checkpoint.id}).`;
  });
  updateCheckpointEntryAvailability();
}
const newTripId = () => globalThis.crypto?.randomUUID?.() || ('trip-' + Date.now() + '-' + Math.random());
function ensureNavigationPlan(){
  if(!journey)return;
  const plan=journey.navigationPlan;
  if(!plan||!Array.isArray(plan.route)||!Array.isArray(plan.stops)||plan.route.at(-1)!==journey.destination||!plan.route.includes(journey.last)||!plan.route.every(id=>getNode(id))||!plan.route.slice(1).every((id,index)=>building.edges.some(([a,b])=>(a===plan.route[index]&&b===id)||(b===plan.route[index]&&a===id)))){
    const original=buildNavigationPlan(building,getNode(journey.start)?journey.start:journey.last,journey.destination,findRoute);
    journey.navigationPlan=original.route.includes(journey.last)?original:buildNavigationPlan(building,journey.last,journey.destination,findRoute);
  }
}
function remainingRoute(){
  if(!journey)return [];
  ensureNavigationPlan();const route=journey.navigationPlan.route;return route.slice(route.indexOf(journey.last));
}
function getNextCheckpoint(){
  if(!journey||journey.last===journey.destination)return null;
  ensureNavigationPlan();const remaining=remainingRoute();return remaining.slice(1).find(id=>isCheckpoint(getNode(id))||id===journey.destination)||null;
}
function ensureTripMetadata() {
  if (journey && (!journey.questEncounter || typeof journey.questEncounter.tripId !== 'string')) {
    journey.questEncounter = {tripId:newTripId(),consumed:false,plan:null};
  }
}
function encounterSnapshot(method = 'manual') {
  return {tripId:journey.questEncounter.tripId,destination:journey.destination,position:journey.last,route:remainingRoute(),confirmed:true,method,encounterState:journey.questEncounter};
}
function configureEncounters() {
  encounters=installRouteEncounters({building,onState(state){if(journey&&state){journey.questEncounter=state;saveJourney();}},onPause(paused){
    navigationPaused=paused;
    document.documentElement.dataset.questPaused=String(paused);
    if(paused){savedControls=['checkpoint','destination','confirm','confirm-next','reset'].map(id=>[$(id),$(id).disabled]);for(const [el]of savedControls)el.disabled=true;}
    else{for(const [el,disabled]of savedControls)el.disabled=disabled;savedControls=[];}
    updateCheckpointEntryAvailability();
    $('map').setAttribute('aria-disabled',String(paused));
    document.dispatchEvent(new CustomEvent('campus-navigation-pause',{detail:{paused}}));
  }});
  if(journey){ensureTripMetadata();encounters.startTrip(encounterSnapshot('restored'));}
}

function getNode(id) {
  return nodes.get(id);
}

function isCheckpoint(n) {
  return Boolean(n && n.qrCodeId);
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function saveJourney() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(journey)
    );
  } catch (error) {
    console.warn("Storage unavailable:", error);
  }
}

function loadJourney() {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "null"
    );
  } catch {
    return null;
  }
}

function makeOption(id, label) {
  const el = document.createElement("option");
  el.value = id;
  el.textContent = label;
  return el;
}

// Preserve main's fewest-map-connections route; these are not measured distances.
function findRoute(startId, endId) {
  if (!getNode(startId) || !getNode(endId)) return null;
  const queue = [startId], previous = new Map([[startId, null]]);
  while (queue.length) {
    const current = queue.shift();
    if (current === endId) break;
    for (const edge of building.edges) {
      let next = null;
      if (edge[0] === current) next = edge[1]; else if (edge[1] === current) next = edge[0];
      if (next && !previous.has(next) && getNode(next)) { previous.set(next, current); queue.push(next); }
    }
  }
  if (!previous.has(endId)) return null;
  const result = []; let cursor = endId;
  while (cursor !== null) { result.unshift(cursor); cursor = previous.get(cursor); }
  return result;
}

function svg(tag, attributes = {}, parent = $("map")) {
  const el = document.createElementNS(SVG_NS, tag);

  for (const [key, value] of Object.entries(attributes)) {
    el.setAttribute(key, value);
  }

  parent.appendChild(el);
  return el;
}

function draw(route = null) {
  const map = $("map");
  if (!map || !building) return;

  map.replaceChildren();
  map.setAttribute(
    "viewBox",
    `0 0 ${building.mapWidth} ${building.mapHeight}`
  );

  // Actual Halle Library floor-plan image.
  svg("image", {
    href: "halle-map.png",
    x: 0,
    y: 0,
    width: building.mapWidth,
    height: building.mapHeight,
    preserveAspectRatio: "none"
  });

  // Draw only the active route, not every edge.
  if (route && route.length) {
    const points = route
      .map(id => getNode(id))
      .filter(Boolean)
      .map(n => `${n.x},${n.y}`)
      .join(" ");

    svg("polyline", {
      points,
      fill: "none",
      stroke: "#ffffff",
      "stroke-width": 11,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      opacity: 0.95
    });

    svg("polyline", {
      points,
      fill: "none",
      stroke: "#f28c28",
      "stroke-width": 6,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    });

    const destination = getNode(route.at(-1));

    if (destination) {
      svg("circle", {
        cx: destination.x,
        cy: destination.y,
        r: 12,
        fill: "#f28c28",
        stroke: "white",
        "stroke-width": 3
      });
    }
  }

  // QR checkpoint markers.
  for (const n of building.nodes) {
    if (!isCheckpoint(n)) continue;

    const marker = svg("circle", {
      cx: n.x,
      cy: n.y,
      r: 9,
      fill: journey?.last === n.id ? "#2563eb" : "#087b50",
      stroke: "#ffffff",
      "stroke-width": 3,
      tabindex: 0,
      role: "button",
      "aria-label": `Confirm checkpoint: ${n.label}`
    });

    marker.style.cursor = "pointer";

    const title = document.createElementNS(
      SVG_NS,
      "title"
    );
    title.textContent = n.label;
    marker.appendChild(title);

    const selectCheckpoint = () => {
      if(navigationPaused)return;
      $("checkpoint").value = n.id;
      updateCheckpointLink();
      confirmCheckpoint({source:"map"});
    };

    marker.addEventListener("click", selectCheckpoint);

    marker.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectCheckpoint();
      }
    });

    const label = svg("text", {
      x: n.x + 12,
      y: n.y - 12,
      fill: "#075c3d",
      "font-size": 12,
      "font-weight": "bold",
      "paint-order": "stroke",
      stroke: "#ffffff",
      "stroke-width": 3,
      "pointer-events": "none"
    });

    label.textContent = n.label;
  }

  // Blue ring indicates last confirmed location.
  if (journey && getNode(journey.last)) {
    const current = getNode(journey.last);

    svg("circle", {
      cx: current.x,
      cy: current.y,
      r: 15,
      fill: "none",
      stroke: "#2563eb",
      "stroke-width": 4,
      "pointer-events": "none"
    });
    const nextId=getNextCheckpoint(),nextNode=getNode(nextId);
    if(nextNode)svg('circle',{cx:nextNode.x,cy:nextNode.y,r:17,fill:'none',stroke:'#7c3aed','stroke-width':4,'stroke-dasharray':'5 3','pointer-events':'none'});
  }
}

function updateCheckpointLink() {
  const id = $("checkpoint").value;
  const selected = getNode(id);

  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("checkpoint", id);

  $("checkpointLink").value = url.href;

  $("confirm").textContent = selected
    ? `${journey?'Confirm selected checkpoint:':'Start journey at'} ${selected.label} (${selected.id})`
    : "Confirm selected checkpoint";
}

function selectedCourse() { return courses.find(course => course.id === $("course").value) || null; }
function renderCourse() {
  const course = selectedCourse(), card = $("courseCard"); card.replaceChildren();
  if (!course) {
    const h = document.createElement("h3"), p = document.createElement("p");
    h.textContent = "No course records yet"; p.textContent = "Add verified course details to public/courses.json."; card.append(h, p); return;
  }
  const h = document.createElement("h3"), p = document.createElement("p"), list = document.createElement("dl"), badge = document.createElement("p");
  h.textContent = course.title; p.textContent = course.description || "No description supplied.";
  [["Professor", course.professor || "Not supplied"], ["Meeting", course.meeting || "Not supplied"], ["Room", course.room || "Not supplied"], ["Milestones", Array.isArray(course.milestones) && course.milestones.length ? course.milestones.join("; ") : "Not supplied"]].forEach(([key, value]) => {
    const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = key; dd.textContent = value; list.append(dt, dd);
  });
  badge.className = "small-note";
  badge.textContent = course.demo ? "DEMO PLACEHOLDER — replace with verified course information." : "Project dataset information; verify with official EMU sources.";
  card.append(h, p, list, badge);
}
function fillCourses() {
  const select = $("course"); select.replaceChildren();
  courses.forEach(course => select.append(makeOption(course.id, course.title)));
  renderCourse();
}

function updateProgress(route) {
  const bar = $("progress");
  if (!bar) return;

  if (!journey) {
    bar.value = 0;
    return;
  }

  if (journey.last === journey.destination) {
    bar.value = 100;
    return;
  }

  ensureNavigationPlan();
  const stops=journey.navigationPlan.stops,index=stops.indexOf(journey.last);
  bar.value=index<0?0:Math.round(index/Math.max(1,stops.length-1)*100);
  bar.setAttribute('aria-label',`Journey progress: ${Math.max(0,index)} of ${Math.max(0,stops.length-1)} checkpoints reached.`);
}

function nextCheckpointHelp(route) {
  if (!journey) return 'Choose a green checkpoint marker, scan a code, or enter a checkpoint to set your starting point.';
  if (journey.last === journey.destination) return 'Destination checkpoint confirmed.';
  if (!route?.length) return 'No connected route exists in the supplied map graph.';
  return 'Follow the orange route through the marked checkpoints.';
}

function render(message = "") {
  if (!building) return;

  const destinationId = $("destination").value;
  const destination = getNode(destinationId);

  const route = journey
    ? remainingRoute()
    : null;

  draw(route);
  updateProgress(route);
  setText('progressLabel', $('progress').value + '%');
  setText('journeyStatus', !journey ? 'Ready when you are' : journey.last === destinationId ? 'Destination confirmed' : route?.length ? 'Route preview' : 'Route unavailable');
  setText('next-checkpoint-help', nextCheckpointHelp(route));
  updateCheckpointLink();
  const nextId=getNextCheckpoint(),nextNode=getNode(nextId);
  setText('confirmed-checkpoint',journey?`${getNode(journey.last).label} (${journey.last})`:'Scan a code or enter a checkpoint');
  setText('next-checkpoint',nextNode?`${nextNode.label} (${nextId})`:journey?.last===destinationId?'—':'Choose your starting location');
  setText('journey-destination',`${destination.label} (${destinationId})`);
  $('confirm-next').disabled=navigationPaused||!nextId;
  $('confirm-next').hidden=!nextNode;
  $('confirm-next').textContent=nextNode?`I’ve reached ${nextNode.label}`:'I’ve reached the next stop';

  const scene = $("scene");

  if (!journey) {
    if (scene) scene.dataset.mood = "ready";

    setText(
      "temperature",
      "Where are you starting?"
    );

    setText(
      "instruction",
      "Choose a destination, then scan a code or enter a checkpoint."
    );

    setText("last", "");
    return;
  }

  const current = getNode(journey.last);

  setText(
    "last",
    `Last confirmed location: ${current?.label || "Unknown"}`
  );

  if (journey.last === destinationId) {
    if (scene) scene.dataset.mood = "arrived";

    setText("temperature", "You’ve arrived!");
    setText(
      "instruction",
      `${destination.label}.`
    );

    setText("door", "HERE");
    return;
  }

  setText("door", "GOAL");

  if (!route?.length) {
    if (scene) scene.dataset.mood = "ready";

    setText("temperature", "No route available.");
    setText(
      "instruction",
      "This destination is not connected in the current map data."
    );
    return;
  }

  if (scene) scene.dataset.mood = "moving";

  setText(
    "temperature",
    message || "Your ghost found a route!"
  );

  setText(
    "instruction",
    `Follow the orange route to ${nextNode?.label||destination.label}.`
  );
}

function confirmCheckpoint(event) {
  $('confirm').dataset.confirmationAccepted='false';
  if(navigationPaused)return {ok:false};
  const checkpointId=event?.source==='demo-next'?getNextCheckpoint():$('checkpoint').value,destinationId=$('destination').value;
  if((!isCheckpoint(getNode(checkpointId))&&!(event?.source==='demo-next'&&getNode(checkpointId)))||!getNode(destinationId))return {ok:false};
  if(journey?.last===checkpointId){$('confirm').dataset.confirmationAccepted='true';setText('temperature',journey.last===journey.destination?'You’ve arrived!':`You’re already at ${getNode(checkpointId).label}.`);return {ok:true,changed:false};}
  if (journey && journey.destination === destinationId && journey.last !== journey.destination && !remainingRoute().includes(checkpointId)) {
    setText('copyStatus', "That checkpoint is not on the current route. Use I'm lost to restart from a known checkpoint.");
    return {ok:false};
  }
  setText('copyStatus', '');
  $('confirm').dataset.confirmationAccepted='true';
  const previous=journey;
  const startsNewTrip=!previous||(previous.last===previous.destination&&checkpointId!==previous.last);
  journey={...previous,last:checkpointId,destination:destinationId};
  if(isCheckpoint(getNode(checkpointId)))$('checkpoint').value=checkpointId;
  if(startsNewTrip){journey.start=checkpointId;journey.navigationPlan=null;journey.questEncounter={tripId:newTripId(),consumed:false,plan:null};}
  ensureNavigationPlan();
  ensureTripMetadata();
  const method=event?.source||$('confirm').dataset.confirmationMethod||'manual';
  if(method!=='manual-code'&&$('checkpoint-code-feedback')){
    $('checkpoint-code-feedback').textContent='';$('checkpoint-code-feedback').dataset.state='';
    $('checkpoint-code').value='';$('checkpoint-code').setAttribute('aria-invalid','false');
  }
  journey.lastConfirmationMethod=method;
  saveJourney();render(`You’re at ${getNode(checkpointId).label}.`);
  if(startsNewTrip)encounters?.startTrip(encounterSnapshot(method));
  else encounters?.confirmed(encounterSnapshot(method));
  saveJourney();
  return {ok:true,changed:true};
}

function changeDestination() {
  // Mid-trip changes cancel the panel without replenishing this trip's encounter.
  if (journey) {
    const startsNewTrip=journey.last===journey.destination&&$("destination").value!==journey.destination;
    journey.start = journey.last;
    journey.destination = $("destination").value;
    if(startsNewTrip)journey.questEncounter={tripId:newTripId(),consumed:false,plan:null};
    ensureTripMetadata();
    if(startsNewTrip)encounters?.startTrip(encounterSnapshot('new-destination-after-arrival'));
    else encounters?.reroute(encounterSnapshot("destination-change"));
    saveJourney();
  }

  render("Destination updated!");
}

function resetJourney() {
  encounters?.endTrip();
  journey = null;
  if($('checkpoint-code-feedback')){
    $('checkpoint-code-feedback').textContent='';$('checkpoint-code-feedback').dataset.state='';
    $('checkpoint-code').value='';$('checkpoint-code').setAttribute('aria-invalid','false');
  }
  setText('encounter-status','Scan a code or enter a checkpoint to begin.');

  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {}

  render();
}

// Preserve main's lost/respawn control, canceling an encounter through resetJourney.
let respawnTimer = null;
function lostAndReset() {
  if (respawnTimer !== null) window.clearTimeout(respawnTimer);
  resetJourney();
  const scene = $('scene');
  scene.classList.remove('ghost-out'); void scene.offsetWidth; scene.classList.add('ghost-out');
  scene.dataset.mood='lost';
  setText('journeyStatus','Choose a new checkpoint');
  setText('temperature','The ghost is respawning!');
  setText('instruction','Choose a checkpoint you recognize to restart your route.');
  respawnTimer=window.setTimeout(()=>{scene.classList.remove('ghost-out');respawnTimer=null;},1050);
}

async function copyCheckpointLink() {
  const value = $("checkpointLink").value;

  try {
    await navigator.clipboard.writeText(value);
    setText("copyStatus", "Checkpoint link copied!");
  } catch {
    const input = $("checkpointLink");
    input.focus();
    input.select();

    setText(
      "copyStatus",
      "Select and copy the highlighted link manually."
    );
  }
}

// Use main's assistant contract and the current confirmed route context.
async function askGhost(event) {
  event.preventDefault();

  const question = $("question").value.trim();
  if (!question) return;

  const button = $("ask");
  button.disabled = true;
  setText("reply", "Your ghost is thinking...");

  try {
    const response = await fetch("/api/ghost", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question,
        courseId: selectedCourse()?.id || null,
        startId: journey?.last || null,
        destinationId: $("destination").value || null,
        routeIds: journey && remainingRoute().length ? remainingRoute() : null
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.reply || `Assistant request failed: HTTP ${response.status}`);
    }

    const answer = data.reply;

    if (typeof answer !== "string") {
      throw new Error("Unexpected assistant response");
    }

    setText("reply", answer);

  } catch (error) {
    console.error("Ghost assistant:", error);

    setText(
      "reply",
      "Assistant error: " + error.message + ". Your map and QR navigation are still available."
    );
  } finally {
    button.disabled = false;
  }
}

async function initialize() {
  try {
    const response = await fetch("building.json");

    if (!response.ok) {
      throw new Error(
        `building.json returned ${response.status}`
      );
    }

    building = await response.json();

    if (
      !Array.isArray(building.nodes) ||
      !Array.isArray(building.edges)
    ) {
      throw new Error("Invalid building.json format");
    }

    nodes = new Map(
      building.nodes.map(n => [n.id, n])
    );

    setText(
      "building",
      building.name || "Halle Library — Second Floor"
    );

    const checkpoints = building.nodes.filter(isCheckpoint);

    $("checkpoint").replaceChildren();
    $("destination").replaceChildren();

    for (const n of checkpoints) {
      $("checkpoint").append(
        makeOption(n.id, n.label)
      );
    }

    if(nodes.size!==building.nodes.length)throw Error("Building node IDs must be unique.");
    for(const edge of building.edges)if(!Array.isArray(edge)||edge.length!==2||!getNode(edge[0])||!getNode(edge[1]))throw Error("A map connection references an unknown node.");
    if(!checkpoints.length)throw Error("Add at least one QR checkpoint.");
    const destinations=(building.destinations||checkpoints.map(n=>n.id)).filter(id=>getNode(id));
    if(!destinations.length)throw Error("Add at least one destination.");
    for (const id of destinations) {
      const n=getNode(id);
      $("destination").append(
        makeOption(n.id, n.label)
      );
    }

    if(isCheckpoint(getNode("Q8")))$("checkpoint").value="Q8";
    if(destinations.includes("Q5"))$("destination").value="Q5";

    // Restore previous journey if its nodes still exist.
    const saved = loadJourney();

    if (
      saved &&
      getNode(saved.last) &&
      destinations.includes(saved.destination)
    ) {
      journey = saved;
      if(isCheckpoint(getNode(saved.last)))$("checkpoint").value = saved.last;
      $("destination").value = saved.destination;
    }

    if(journey){ensureTripMetadata();ensureNavigationPlan();saveJourney();}
    configureEncounters();

    // Support both old and new QR URL formats.
    const params = new URLSearchParams(
      window.location.search
    );

    const scannedId =
      params.get("checkpoint") || params.get("qr");

    if (scannedId && isCheckpoint(getNode(scannedId))) {
      $("checkpoint").value = scannedId;

      confirmCheckpoint({source:'qr-link'});
      const cleaned=new URL(window.location.href);cleaned.searchParams.delete('checkpoint');cleaned.searchParams.delete('qr');
      window.history.replaceState(null,'',cleaned.pathname+cleaned.search+cleaned.hash);
    }

    updateCheckpointLink();
    render();

    $("checkpoint").addEventListener(
      "change",
      updateCheckpointLink
    );

    $("destination").addEventListener(
      "change",
      changeDestination
    );

    $("confirm").addEventListener(
      "click",
      confirmCheckpoint
    );
    $('confirm-next').addEventListener('click',()=>confirmCheckpoint({source:'demo-next'}));

    $("reset").addEventListener(
      "click",
      resetJourney
    );

    $("copy").addEventListener(
      "click",
      copyCheckpointLink
    );

    // Preserve main's class cards and route-aware chat; a course-data failure does not disable navigation.
    try {
      const response=await fetch('courses.json');
      if(!response.ok)throw Error('Course data unavailable');
      courses=await response.json();
      if(!Array.isArray(courses))throw Error('Invalid course data');
      fillCourses();
    } catch { courses=[];fillCourses();setText('reply','Course details are unavailable. You can still ask about the route.'); }
    $('course').addEventListener('change',renderCourse);
    $('lost').addEventListener('click',lostAndReset);
    document.querySelectorAll('[data-question]').forEach(button=>button.addEventListener('click',()=>{$('question').value=button.dataset.question;$('question').focus();}));

    $("chat").addEventListener(
      "submit",
      askGhost
    );

  } catch (error) {
    console.error("Campus Ghost initialization:", error);

    setText(
      "temperature",
      "Map loading error: " + error.message
    );

    setText(
      "instruction",
      "Check building.json and refresh the page."
    );
  }
}

document.addEventListener('campus-checkpoint-entry-ready',bindCheckpointEntry);
initialize();
