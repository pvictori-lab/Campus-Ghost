const $ = id => document.getElementById(id);

const KEY = "campus-ghost-quest-v1";

let b;
let courses;
let journey = null;
let selectedCourse = null;

const node = id => b.nodes.find(n => n.id === id);

function save() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        courseId: selectedCourse?.id,
        destination: $("destination").value,
        journey: journey
      })
    );
  } catch {
    // Navigation still works if storage is unavailable.
  }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

function option(value, text) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = text;
  return element;
}

function path(start, end) {
  if (!node(start) || !node(end)) {
    return null;
  }

  const queue = [[start]];
  const seen = new Set([start]);

  while (queue.length) {
    const route = queue.shift();
    const last = route[route.length - 1];

    if (last === end) {
      return route;
    }

    for (const [a, z] of b.edges) {
      const next =
        a === last ? z :
        z === last ? a :
        null;

      if (next !== null && !seen.has(next)) {
        seen.add(next);
        queue.push(route.concat([next]));
      }
    }
  }

  return null;
}

function svg(tag, attributes) {
  const element = document.createElementNS(
    "http://www.w3.org/2000/svg",
    tag
  );

  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }

  $("map").append(element);
  return element;
}

function draw(route) {
  $("map").replaceChildren();

  for (const [a, z] of b.edges) {
    const p = node(a);
    const q = node(z);

    svg("line", {
      x1: p.x,
      y1: p.y,
      x2: q.x,
      y2: q.y,
      stroke: "#ccc9df",
      "stroke-width": 26,
      "stroke-linecap": "round"
    });
  }

  if (route && route.length) {
    svg("polyline", {
      points: route.map(id => {
        const point = node(id);
        return point.x + "," + point.y;
      }).join(" "),
      fill: "none",
      stroke: "#9d83d6",
      "stroke-width": 6
    });

    if (route.length > 1) {
      const p = node(route[0]);
      const q = node(route[1]);

      svg("line", {
        x1: p.x,
        y1: p.y,
        x2: q.x,
        y2: q.y,
        stroke: "#eb8e32",
        "stroke-width": 9
      });
    }
  }

  for (const n of b.nodes) {
    svg("circle", {
      cx: n.x,
      cy: n.y,
      r: 8,
      fill: "#393454"
    });

    const label = svg("text", {
      x: n.x,
      y: n.y + 28,
      "text-anchor": "middle",
      fill: "#262239",
      "font-size": 15
    });

    label.textContent = n.label;
  }

  if (journey && node(journey.last)) {
    const current = node(journey.last);

    svg("circle", {
      cx: current.x,
      cy: current.y,
      r: 15,
      fill: "#009c8f",
      stroke: "white",
      "stroke-width": 3
    });
  }
}

function displayCourse() {
  selectedCourse = courses.find(
    course => course.id === $("courses").value
  );

  $("course").replaceChildren();

  if (!selectedCourse) {
    return;
  }

  const details = [
    selectedCourse.description,
    "Meeting: " + selectedCourse.meeting,
    "Room: " + selectedCourse.roomId,
    "Milestone: " + selectedCourse.milestone
  ];

  for (const text of details) {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    $("course").append(paragraph);
  }
}

function updateLink() {
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set("checkpoint", $("checkpoint").value);

  $("checkpointLink").value = url.href;

  const selected = node($("checkpoint").value);

  $("confirm").disabled = false;
  $("confirm").textContent = selected
    ? "I reached " + selected.label
    : "Confirm selected checkpoint";
}

function render(message, mood = "ready") {
  const destination = $("destination").value;

  const route = journey
    ? path(journey.last, destination)
    : null;

  $("scene").dataset.mood
