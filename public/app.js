const $ = id => document.getElementById(id);
const STORAGE_KEY = "campus-ghost-journey-v3";
const SVG_NS = "http://www.w3.org/2000/svg";
let building, courses = [], nodes = new Map(), journey = null, currentRoute = null;
function text(id, value) { const el = $(id); if (el) el.textContent = value == null ? "" : String(value); }
function node(id) { return nodes.get(id); }
function isCheckpoint(item) { return Boolean(item && item.qrCodeId); }
function option(id, label) { const el = document.createElement("option"); el.value = id; el.textContent = label; return el; }
function readSaved() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; } }
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(journey)); } catch (error) { console.warn("Journey could not be saved", error); } }
function routeBetween(startId, endId) {
  if (!node(startId) || !node(endId)) return null;
  const queue = [startId], previous = new Map([[startId, null]]);
  while (queue.length) {
    const current = queue.shift();
    if (current === endId) break;
    for (const edge of building.edges) {
      let next = null;
      if (edge[0] === current) next = edge[1]; else if (edge[1] === current) next = edge[0];
      if (next && !previous.has(next) && node(next)) { previous.set(next, current); queue.push(next); }
    }
  }
  if (!previous.has(endId)) return null;
  const result = []; let cursor = endId;
  while (cursor !== null) { result.unshift(cursor); cursor = previous.get(cursor); }
  return result;
}
function svg(tag, attrs, parent) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs || {}).forEach(([key, value]) => element.setAttribute(key, String(value)));
  (parent || $("map")).appendChild(element); return element;
}
function drawMap(route) {
  const map = $("map"); map.replaceChildren();
  map.setAttribute("viewBox", "0 0 " + building.mapWidth + " " + building.mapHeight);
  svg("image", { href: "halle-map.png", x: 0, y: 0, width: building.mapWidth, height: building.mapHeight, preserveAspectRatio: "none" });
  if (route && route.length > 1) {
    const points = route.map(id => node(id)).filter(Boolean).map(item => item.x + "," + item.y).join(" ");
    svg("polyline", { points, fill: "none", stroke: "#fff", "stroke-width": 13, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: .95 });
    svg("polyline", { points, fill: "none", stroke: "#f28c28", "stroke-width": 7, "stroke-linecap": "round", "stroke-linejoin": "round" });
  }
  building.nodes.forEach(item => {
    if (!isCheckpoint(item)) return;
    const selected = journey && journey.last === item.id;
    const marker = svg("circle", { cx: item.x, cy: item.y, r: selected ? 12 : 9, fill: selected ? "#2563eb" : "#087b50", stroke: "#fff", "stroke-width": 3, tabindex: 0, role: "button", "aria-label": "Confirm checkpoint: " + item.label });
    marker.style.cursor = "pointer";
    const title = svg("title", {}, marker); title.textContent = item.label;
    const select = () => { $("checkpoint").value = item.id; updateLink(); confirmCheckpoint(); };
    marker.addEventListener("click", select);
    marker.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); } });
    const label = svg("text", { x: item.x + 12, y: item.y - 12, fill: "#075c3d", "font-size": 12, "font-weight": "bold", "paint-order": "stroke", stroke: "#fff", "stroke-width": 3, "pointer-events": "none" });
    label.textContent = item.label;
  });
  if (journey && node(journey.last)) {
    const current = node(journey.last);
    svg("circle", { cx: current.x, cy: current.y, r: 16, fill: "none", stroke: "#2563eb", "stroke-width": 4, "pointer-events": "none" });
  }
}
function updateLink() {
  const selected = node($("checkpoint").value), url = new URL(window.location.href);
  url.search = ""; url.hash = ""; url.searchParams.set("checkpoint", selected ? selected.id : "");
  $("checkpointLink").value = url.href;
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
  courses.forEach(course => select.append(option(course.id, course.title)));
  renderCourse();
}
function updateProgress(route) {
  let percentage = 0;
  if (journey && journey.last === journey.destination) percentage = 100;
  else if (route && route.length > 1) {
    const checkpointIds = route.filter(id => isCheckpoint(node(id)));
    const total = Math.max(1, checkpointIds.length - 1), index = checkpointIds.indexOf(journey.last);
    percentage = Math.max(0, Math.round((Math.max(0, index) / total) * 100));
  }
  $("progress").value = percentage; text("progressLabel", percentage + "%");
}
function render(message) {
  if (!building) return;
  const destinationId = $("destination").value, destination = node(destinationId), scene = $("scene");
  currentRoute = journey ? routeBetween(journey.last, destinationId) : null;
  drawMap(currentRoute); updateProgress(currentRoute);
  if (!journey) {
    scene.dataset.mood = "ready"; text("journeyStatus", "Ready when you are");
    text("temperature", "Choose a destination to begin.");
    text("instruction", "Select a destination and confirm the checkpoint where you are.");
    text("last", "No checkpoint confirmed yet.");
    text("next-checkpoint-help", "Choose a green checkpoint marker or use the checkpoint list to set your starting point.");
    $("door").textContent = "GOAL"; return;
  }
  const current = node(journey.last);
  text("last", "Last confirmed checkpoint: " + (current ? current.label : "Unknown"));
  if (journey.last === destinationId) {
    scene.dataset.mood = "arrived"; text("journeyStatus", "Destination confirmed");
    text("temperature", "You made it!"); text("instruction", "You confirmed the destination checkpoint. Nice work!");
    text("next-checkpoint-help", "Arrival is based on your checkpoint confirmation, not automatic location detection.");
    $("door").textContent = "HERE"; return;
  }
  $("door").textContent = "GOAL";
  if (!currentRoute) {
    scene.dataset.mood = "lost"; text("journeyStatus", "Route unavailable");
    text("temperature", "No route found in the current map data.");
    text("instruction", "Try a different destination or choose a known checkpoint.");
    text("next-checkpoint-help", "The supplied map graph does not connect these points. Do not assume an unlisted corridor is walkable."); return;
  }
  scene.dataset.mood = "guiding"; text("journeyStatus", "Route preview");
  text("temperature", message || "Your ghost found a route!");
  const next = currentRoute.find((id, index) => index > 0 && isCheckpoint(node(id)));
  const nextNode = next ? node(next) : destination;
  text("instruction", "From " + current.label + ", follow the highlighted route toward " + nextNode.label + ". Confirm the next marked checkpoint when you reach it.");
  text("next-checkpoint-help", "Next checkpoint: " + nextNode.label + ". This route uses the fewest map connections, not measured walking distance.");
}
function confirmCheckpoint() {
  const checkpointId = $("checkpoint").value, destinationId = $("destination").value, selected = node(checkpointId);
  if (!isCheckpoint(selected)) { text("copyStatus", "Choose a valid QR checkpoint first."); return; }
  if (journey && journey.last !== checkpointId && journey.destination === destinationId) {
    const possible = routeBetween(journey.last, destinationId);
    if (possible && !possible.includes(checkpointId)) {
      text("copyStatus", "That checkpoint is not on the current route. Use I'm lost to reset to a different known checkpoint."); return;
    }
  }
  journey = { last: checkpointId, destination: destinationId }; save();
  render("Checkpoint confirmed: " + selected.label);
}
function changeDestination() { if (journey) { journey.destination = $("destination").value; save(); } render("Destination updated."); }
function resetJourney() { journey = null; try { localStorage.removeItem(STORAGE_KEY); } catch {} render("Journey reset."); }
function lostAndReset() {
  const scene = $("scene"); scene.classList.remove("ghost-out"); void scene.offsetWidth; scene.classList.add("ghost-out");
  scene.dataset.mood = "lost"; text("temperature", "The ghost is respawning!");
  text("instruction", "Choose a checkpoint you recognize, then confirm it to restart your route.");
  text("journeyStatus", "Choose a new checkpoint"); resetJourney();
  window.setTimeout(() => scene.classList.remove("ghost-out"), 1050);
}
async function copyLink() {
  try { await navigator.clipboard.writeText($("checkpointLink").value); text("copyStatus", "Checkpoint link copied."); }
  catch { $("checkpointLink").focus(); $("checkpointLink").select(); text("copyStatus", "Select and copy the link manually."); }
}
async function askGhost(event) {
  event.preventDefault(); const question = $("question").value.trim(); if (!question) return;
  const button = $("ask"); button.disabled = true; text("reply", "Your ghost is thinking...");
  const course = selectedCourse();
  try {
    const response = await fetch("/api/ghost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      question, courseId: course ? course.id : null, startId: journey ? journey.last : null, destinationId: $("destination").value || null
    }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Assistant request failed.");
    text("reply", data.reply || "I don't have enough verified information to answer that.");
  } catch (error) {
    console.error("Campus Ghost assistant:", error);
    text("reply", "I couldn't reach the assistant just now. The map and checkpoint controls still work. Check the server configuration and try again.");
  } finally { button.disabled = false; }
}
async function initialize() {
  try {
    const results = await Promise.all([
      fetch("building.json").then(response => { if (!response.ok) throw new Error("Could not load building.json"); return response.json(); }),
      fetch("courses.json").then(response => { if (!response.ok) throw new Error("Could not load courses.json"); return response.json(); })
    ]);
    building = results[0]; courses = results[1];
    if (!Array.isArray(building.nodes) || !Array.isArray(building.edges) || !Array.isArray(courses)) throw new Error("Building or course data has an invalid format.");
    nodes = new Map(building.nodes.map(item => [item.id, item]));
    if (nodes.size !== building.nodes.length) throw new Error("Building node IDs must be unique.");
    building.edges.forEach(edge => { if (!Array.isArray(edge) || edge.length !== 2 || !node(edge[0]) || !node(edge[1])) throw new Error("A map connection references an unknown node."); });
    const checkpoints = building.nodes.filter(isCheckpoint);
    if (!checkpoints.length) throw new Error("Add at least one QR checkpoint to building.json.");
    $("checkpoint").replaceChildren(); checkpoints.forEach(item => $("checkpoint").append(option(item.id, item.label)));
    const destinations = (building.destinations || checkpoints.map(item => item.id)).filter(id => node(id));
    if (!destinations.length) throw new Error("Add at least one destination to building.json.");
    $("destination").replaceChildren(); destinations.forEach(id => $("destination").append(option(id, node(id).label)));
    fillCourses();
    const saved = readSaved();
    if (saved && isCheckpoint(node(saved.last)) && node(saved.destination)) {
      journey = saved; $("checkpoint").value = saved.last;
      if (destinations.includes(saved.destination)) $("destination").value = saved.destination;
    }
    const params = new URLSearchParams(window.location.search), scanned = params.get("checkpoint") || params.get("qr");
    if (scanned && isCheckpoint(node(scanned))) { $("checkpoint").value = scanned; journey = { last: scanned, destination: $("destination").value }; save(); }
    text("building", building.name || "Campus building"); updateLink(); render();
    $("checkpoint").addEventListener("change", updateLink);
    $("destination").addEventListener("change", changeDestination);
    $("course").addEventListener("change", renderCourse);
    $("confirm").addEventListener("click", confirmCheckpoint);
    $("reset").addEventListener("click", resetJourney);
    $("lost").addEventListener("click", lostAndReset);
    $("copy").addEventListener("click", copyLink);
    $("chat").addEventListener("submit", askGhost);
    document.querySelectorAll("[data-question]").forEach(button => button.addEventListener("click", () => { $("question").value = button.dataset.question; $("question").focus(); }));
  } catch (error) {
    console.error("Campus Ghost initialization:", error);
    text("temperature", "The map could not load."); text("instruction", error.message); text("journeyStatus", "Setup needed");
  }
}
initialize();