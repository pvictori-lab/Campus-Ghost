# Campus Ghost

A checkpoint-based Halle Library navigation prototype with a navigator ghost, one optional quest encounter per journey, and three interactive games.

Location changes only when a student scans a checkpoint or confirms one. This is not live indoor tracking. Map routes and room access must be verified on site.

## Run locally

Requires Node 20.18 or newer; tested locally with Node 26. No dependencies need installing.

```powershell
$env:HOST = '127.0.0.1'
$env:PORT = '3002'
npm.cmd start
```

Open **http://localhost:3002/**. Stop with Ctrl+C. If Node is not on PATH, run `& 'C:\Program Files\nodejs\node.exe' server.mjs` from the repository directory after setting the variables above.

The default server bind remains `0.0.0.0` for compatibility with the existing hosting setup; `HOST` overrides it for local-only use. This change does not deploy the application.

## Try a complete journey

1. Choose **Start New Journey** and keep destination **Room 217 (Faculty), Q5**.
2. Choose **Enter checkpoint code**, type `q8`, and select **Confirm location** (or press Enter).
3. Check **You're at**, **Next stop**, and **Destination**. The orange route passes through Q4.
4. Choose **I've reached Atrium East** to report Q4, or scan/enter its code. One quest ghost opens its challenge.
5. Play trivia, or choose **Give me a game instead**. Complete the challenge or choose **Not now**.
6. Navigation resumes at Q4. Choose **I've reached Room 217 (Faculty)** to arrive at Q5. No second encounter appears in that journey.

Reconfirming the current checkpoint does not count as movement. Unknown typed codes leave location and route unchanged. The code-entry fallback remains available if camera access fails.

## Quests

- **Trivia:** 10 distinct random questions from a 36-question bank. Ten correct answers in a row complete the challenge; one wrong answer ends the attempt.
- **Haunted Room Escape:** inspect a fictional room, collect clues, solve two connected locks, and escape.
- **Potion Panic:** recreate ordered recipes across five increasingly difficult rounds.
- **Ghost Signal:** repeat five growing sequences using labeled shapes, touch/click, or number keys.

Rewards are granted only on the first completion of each stable challenge ID. Previously earned XP survives retries, navigation resets, exits, and reloads. Storage belongs to the exact browser origin: localhost:3002 and localhost:3000 have separate progress. The app never clears the other origin's rewards.

Standalone quests: `/quests.html`. Isolated integration example: `/quests-preview.html`. The main app's quest panel is an iframe so quest styles do not change the map page.

## Checks

```powershell
npm.cmd test
npm.cmd run check
# Or:
& 'C:\Program Files\nodejs\node.exe' --test
```

The 38 automated tests cover navigation/QR confirmation, approved printed QR URLs, code entry, route geometry, full journeys, encounter consumption across reloads, migration of saved journeys, cancellation, stale callbacks, rewards, all games, course cards, and server validation/throttling. Camera hardware is mocked; printed QR decoding and assistive-technology behavior still need device testing. The existing GitHub Actions checks also run this suite on pull requests.

`tests/browser-journey.mjs` additionally verifies the live app in an isolated Edge/Chromium debugging session, including native Enter submission and desktop/mobile viewport bounds. See [QUESTS-HANDOFF.md](QUESTS-HANDOFF.md) for setup. Browser profiles and generated screenshots are excluded from Git.

## Integration and data

- [Quest interface, content schema, rewards, and lifecycle](QUESTS-HANDOFF.md)
- [Checkpoint confirmation behavior and manual checks](CHECKPOINT-CONFIRMATION.md)
- `public/building.json`: James's original 600 x 750 Halle map graph and existing QR IDs. The floor images and Pat's original SVG artwork/CSS are retained.
- `public/quests.json`: validated, predefined trivia content; the games need no OpenAI or other API.

Because `rooms` is empty, encounter origins use existing QR checkpoint nodes, never invented rooms. James can mark verified existing entrance nodes with `encounterOrigin: true`; if any are marked, only those origins are used. `encounterOrigin: false` excludes a checkpoint from fallback selection. An encounter trigger must be an intermediate checkpoint on the displayed itinerary. Routes with no eligible intermediate checkpoint have no encounter.

Routing retains main's breadth-first search through the bidirectional map graph. Where possible, the itinerary adds one small, simple detour through a reportable QR checkpoint; no invented connections or repeated corridors are added. These are drawing coordinates and graph connections, not measured walking distances. Map points, connections, and accessibility need on-site verification.

Journey storage uses main's `campus-ghost-journey-v3` key and restores the older integration's `campus-ghost-halle-v2` records when needed. Confirmed location and original checkpoint progress survive migration. Starting over or using **I'm lost** resets navigation only. Course records retain main's `id`, `title`, `description`, `professor`, `meeting`, `room`, `destinationId`, `milestones`, and `demo` fields; the included entries remain labeled placeholders.

## Optional course chat

Copy `.env.example` to `.env`, configure a server-side API key/model if desired, then restart. Never commit `.env` or real keys. Chat retains main's `POST /api/ghost` endpoint, course cards, suggested prompts, data-based fallback, health endpoint, and request throttling. The request contains `{question, courseId, startId, destinationId, routeIds}` and receives `{reply, mode}` (or `{error}` on invalid input). The optional route IDs are validated against the server's graph so the assistant describes the itinerary actually shown. Requests without route IDs retain main's route calculation. Without a key, or if the AI is unavailable, it returns a labeled local summary. Missing professor/room facts remain unknown. Navigation and all quests work without a key.
