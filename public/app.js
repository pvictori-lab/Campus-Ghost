const $ = id => document.getElementById(id);

const KEY = "campus-ghost-quest-v1";

let b;
let courses;
let journey = null;
let selectedCourse = null;

const node = id => b.nodes.find(n => n.id === id);

/* Saved journey */

function save() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        courseId: selectedCourse?.id,
        destination: $("destination").value,
        journey
      })
    );
  } catch {
    // Navigation can continue without saved storage.
  }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

/* Form options */

function option(value, text) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = text;
  return element;
}

/* Find a route through the mapped connections */

function path(start, end) {
  if (!node(start) || !node(end)) {
    return null;
  }

  const queue = [[start]];
  const seen = new Set([start]);

  while (queue.length) {
    const route = queue.shift();
    const last = route.at(-1);

    if (last === end) {
      return route;
    }

    for (const [a, z] of b.edges) {
      const next =
        a === last
          ? z
          : z === last
            ? a
            : null;

      if (next !== null && !seen.has(next)) {
        seen.add(next);
        queue.push([...route, next]);
      }
    }
  }

  return null;
}

/* Map drawing */

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

  if (route?.length) {
    svg("polyline", {
      points: route
        .map(id => `${node(id).x},${node(id).y}`)
        .join(" "),
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

/* Course card */

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
    `Meeting: ${selectedCourse.meeting}`,
    `Room: ${selectedCourse.roomId}`,
    `Milestone: ${selectedCourse.milestone}`
  ];

  for (const text of details) {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    $("course").append(paragraph);
  }
}

/* Checkpoint link and confirmation button */

function updateLink() {
  const selected = node($("checkpoint").value);

  const url = new URL(location.origin + location.pathname);
  url.searchParams.set("checkpoint", $("checkpoint").value);

  $("checkpointLink").value = url.href;

  $("confirm").disabled = false;

  $("confirm").textContent = selected
    ? `I reached ${selected.label}`
    : "Confirm selected checkpoint";
}

/* Journey display */

function render(message, mood = "ready") {
  const destination = $("destination").value;

  const route = journey
    ? path(journey.last, destination)
    : null;

  $("scene").dataset.mood = mood;

  $("door").textContent =
    node(destination)?.label || "CLASS";

  $("temperature").textContent = message;
  $("progress").max = 100;

  if (!journey) {
    $("progress").value = 0;

    $("instruction").textContent =
      "Select your actual starting checkpoint and confirm it, " +
      "or scan its QR code.";

    $("last").textContent =
      "No checkpoint recorded for this journey.";
  } else {
    const remaining = route ? route.length - 1 : null;

    const fraction =
      remaining === null
        ? 0
        : remaining === 0
          ? 1
          : Math.max(
              0,
              Math.min(
                0.92,
                1 - remaining / Math.max(1, journey.initial)
              )
            );

    $("progress").value = Math.round(fraction * 100);

    if (!route) {
      $("instruction").textContent =
        "No mapped route from this checkpoint. " +
        "Select another verified checkpoint and confirm it.";

      $("checkpoint").value = journey.last;
    } else if (remaining === 0) {
      $("instruction").textContent =
        "Destination checkpoint confirmed! " +
        "Check the door label in person and review your course card. " +
        "Choose another course or destination to start a new journey.";

      $("checkpoint").value = journey.last;
    } else {
      const next = node(route[1]);

      $("instruction").textContent =
        `${remaining} mapped connection` +
        `${remaining === 1 ? "" : "s"} remaining. ` +
        `Follow the highlighted segment toward ${next.label}. ` +
        `When you arrive, tap “I reached ${next.label}” ` +
        "or scan its QR code. " +
        "If you are somewhere else, select your actual checkpoint.";

      // Suggest the next location, but do not record arrival yet.
      $("checkpoint").value = next.id;
    }

    const method =
