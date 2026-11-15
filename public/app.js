
const $ = id => document.getElementById(id);

const STORAGE_KEY = "campus-ghost-halle-v2";
const SVG_NS = "http://www.w3.org/2000/svg";

let building = null;
let nodes = new Map();
let journey = null;

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
      localStorage.getItem(STORAGE_KEY) || "null"
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

// Find the shortest route by walking distance.
// Connections must be verified against the real floor.
function findRoute(startId, endId) {
  if (!getNode(startId) || !getNode(endId)) {
    return null;
  }

  const distances = new Map();
  const previous = new Map();
  const unvisited = new Set(nodes.keys());

  for (const id of nodes.keys()) {
    distances.set(id, Infinity);
  }

  distances.set(startId, 0);

  while (unvisited.size > 0) {
    let current = null;
    let best = Infinity;

    for (const id of unvisited) {
      const distance = distances.get(id);
      if (distance < best) {
        best = distance;
        current = id;
      }
    }

    if (current === null) break;
    if (current === endId) break;

    unvisited.delete(current);

    for (const [a, b] of building.edges) {
      let neighbor = null;

      if (a === current) neighbor = b;
      if (b === current) neighbor = a;

      if (!neighbor || !unvisited.has(neighbor)) {
        continue;
      }

      const p = getNode(current);
      const q = getNode(neighbor);

      if (!p || !q) continue;

      const weight = Math.hypot(
        q.x - p.x,
        q.y - p.y
      );

      const candidate =
        distances.get(current) + weight;

      if (candidate < distances.get(neighbor)) {
        distances.set(neighbor, candidate);
        previous.set(neighbor, current);
      }
    }
  }

  if (!Number.isFinite(distances.get(endId))) {
    return null;
  }

  const result = [];
  let current = endId;

  while (current !== undefined) {
    result.unshift(current);
    current = previous.get(current);
  }

  return result[0] === startId ? result : null;
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
      fill: "#087b50",
      stroke: "#ffffff",
      "stroke-width": 3,
      tabindex: 0,
      role: "button",
      "aria-label": `Start at ${n.label}`
    });

    marker.style.cursor = "pointer";

    const title = document.createElementNS(
      SVG_NS,
      "title"
    );
    title.textContent = n.label;
    marker.appendChild(title);

    const selectCheckpoint = () => {
      $("checkpoint").value = n.id;
      updateCheckpointLink();
      confirmCheckpoint();
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

    label.textContent = n.id;
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
    ? `I reached ${selected.label}`
    : "Confirm selected checkpoint";
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

  // Progress is checkpoint-based, not live tracking.
  // Show an initial confirmed position.
  bar.value = 10;

  if (route && route.length === 2) {
    bar.value = 70;
  } else if (route && route.length <= 4) {
    bar.value = 40;
  }
}

function render(message = "") {
  if (!building) return;

  const destinationId = $("destination").value;
  const destination = getNode(destinationId);

  const route = journey
    ? findRoute(journey.last, destinationId)
    : null;

  draw(route);
  updateProgress(route);

  const scene = $("scene");

  if (!journey) {
    if (scene) scene.dataset.mood = "ready";

    setText(
      "temperature",
      "Select a checkpoint to begin your journey."
    );

    setText(
      "instruction",
      "Choose your destination, then confirm your location."
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
    if (scene) scene.dataset.mood = "happy";

    setText("temperature", "Destination reached!");
    setText(
      "instruction",
      `You have arrived at ${destination.label}.`
    );

    setText("door", "HERE");
    return;
  }

  setText("door", "GOAL");

  if (!route) {
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
    `Follow the orange route from ${current.label} to ${destination.label}. Scan another QR checkpoint to update your location.`
  );
}

function confirmCheckpoint() {
  const checkpointId = $("checkpoint").value;
  const destinationId = $("destination").value;

  if (!isCheckpoint(getNode(checkpointId))) {
    return;
  }

  journey = {
    last: checkpointId,
    destination: destinationId
  };

  saveJourney();
  render("Checkpoint confirmed!");
}

function changeDestination() {
  if (journey) {
    journey.destination = $("destination").value;
    saveJourney();
  }

  render("Destination updated!");
}

function resetJourney() {
  journey = null;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}

  render();
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

// Preserve the AI assistant interface.
// This requires a compatible server-side endpoint.
async function askGhost(event) {
  event.preventDefault();

  const question = $("question").value.trim();
  if (!question) return;

  const button = $("ask");
  button.disabled = true;
  setText("reply", "Your ghost is thinking...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question,
        message: question
      })
    });

    if (!response.ok) {
      throw new Error(
        `Assistant server returned ${response.status}`
      );
    }

    const data = await response.json();

    const answer =
      data.reply ||
      data.answer ||
      data.message ||
      data.response;

    if (typeof answer !== "string") {
      throw new Error("Unexpected assistant response");
    }

    setText("reply", answer);

  } catch (error) {
    console.error("Ghost assistant:", error);

    setText(
      "reply",
      "The ghost assistant isn't connected yet. " +
      "The map and QR navigation can still be used."
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

    // Every navigation node can be a destination.
    for (const n of building.nodes) {
      $("destination").append(
        makeOption(n.id, n.label)
      );
    }

    $("checkpoint").value = "Q8";
    $("destination").value = "Q5";

    // Restore previous journey if its nodes still exist.
    const saved = loadJourney();

    if (
      saved &&
      isCheckpoint(getNode(saved.last)) &&
      getNode(saved.destination)
    ) {
      journey = saved;
      $("checkpoint").value = saved.last;
      $("destination").value = saved.destination;
    }

    // Support both old and new QR URL formats.
    const params = new URLSearchParams(
      window.location.search
    );

    const scannedId =
      params.get("checkpoint") || params.get("qr");

    if (scannedId && isCheckpoint(getNode(scannedId))) {
      $("checkpoint").value = scannedId;

      journey = {
        last: scannedId,
        destination: $("destination").value
      };

      saveJourney();
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

    $("reset").addEventListener(
      "click",
      resetJourney
    );

    $("copy").addEventListener(
      "click",
      copyCheckpointLink
    );

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

initialize();
