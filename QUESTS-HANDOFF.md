# Quest module handoff

## Public interface

The module uses plain HTML/CSS/JavaScript and has no package dependencies. Pat's entry point remains:

```js
import {startQuest} from './quests.js';
const controller = await startQuest({
  roomId: currentMappedOriginId,
  ghostId: currentQuestGhostId,
  onComplete(result) {
    // Display the outcome. XP has already been awarded by the module.
  },
  singleChallenge: true // main navigation encounter; defaults to false elsewhere
});
// On close or replacement:
controller.destroy();
```

Mount inside an element named `campus-quests`. In the main app, `quests-panel.html` owns that container in a same-origin iframe. Load `quests.css` only inside that document; it contains a standalone body theme. The parent map does not load it.

`startQuest` returns a Promise resolving to `{destroy()}`. `destroyQuest()` is also exported so the iframe can cancel an active controller while content loading is pending. Room/ghost context is passed through unchanged and does not establish sensor-verified location.

Callbacks have this shape:

```json
{"questId":"ghost-trivia-streak-v1","roomId":"Q4","ghostId":"quest-location-Q4","outcome":"completed","xpAwarded":100}
```

Outcomes are `completed`, `failed` (wrong trivia answer), and `abandoned`. Failures/abandonment award zero; completed replays also award zero. Each attempt/run emits one terminal result. Interactive round mistakes remain retryable and do not emit a terminal result. Hosts must not award XP a second time.

Normal standalone mode returns to the ghost offer after an activity. `singleChallenge: true` permits exactly one selected challenge for that encounter, with no second offer after completion/failure. The navigation host briefly shows the result and closes, or dismisses immediately on abandonment/Not now.

## Confirmed navigation and encounter host

James's `confirmCheckpoint()` is shared by manual codes, map markers, camera QR callbacks, QR links, and the named next-stop button. Repeating the current node records no movement. The original map dimensions, graph, images, and Pat's artwork remain in use.

`navigation-plan.js` composes the existing coordinate-weighted shortest-path function into a reportable checkpoint route. It uses a simple adjacent-checkpoint detour when needed and never invents connections or revisits a dead-end just to find a marker. Default Q8 -> Q5 has stops Q8 -> Q4 -> Q5.

`route-encounters.js` plans from actual mapped nodes, listens only to confirmed progress, and consumes the encounter before opening its panel. `journey.questEncounter` persists the trip ID, plan, and consumed state in James's existing journey record. Restore/redraw/reroute does not replenish it. A genuine new trip, including a new destination after arrival, may receive another encounter.

Origin selection uses explicitly marked `encounterOrigin: true` nodes when present, otherwise existing `qrCodeId` nodes. It searches a bounded graph neighborhood, not a fabricated distance in meters. `rooms` stays empty; callback `roomId` is a compatibility field carrying the existing origin node ID. No classroom is inferred from that field.

The host pauses navigation and scanner startup, preserves route/destination/position, and opens the isolated panel with checked origin/source messages from `quest-protocol.js`. Destroy handshakes, trip/view epochs, camera instance tokens, and owned timers reject old callbacks. Resume never confirms another location. The existing navigator remains in `#hero`; a separate clone of Pat's SVG represents the quest ghost.

## Version 2 trivia content

`loadQuests(url?, fetcher?)` fetches and validates this envelope; `validateQuestData(data)` returns the validated `trivia` record:

```json
{
  "version": 2,
  "trivia": {
    "id": "ghost-trivia-streak-v1",
    "title": "Ghost Trivia: Ten in a Row",
    "attemptLength": 10,
    "completionXP": 100,
    "questions": [
      {
        "id": "trivia-01",
        "prompt": "Which planet is closest to the Sun?",
        "options": ["Venus", "Mercury", "Mars"],
        "answerIndex": 1,
        "explanation": "Mercury has the closest orbit to the Sun."
      }
    ]
  }
}
```

The example shows one record; a valid bank requires at least 30. The supplied bank has 36. IDs and normalized prompts must be unique; all text fields are nonempty. Each question has 2-6 distinct options, a zero-based valid answerIndex, and an explanation. The challenge ID is fixed, attemptLength is exactly 10, and completionXP is a positive integer up to 10,000. Version 1 records are rejected.

An attempt shuffles with Fisher-Yates and selects ten distinct questions. Retry reshuffles, begins at question 1, and cannot repeat the identical ten-question sequence. A wrong answer ends the attempt with its explanation. Only ten correct answers complete it. Generated content could use this same validation boundary later; no generation/API integration exists and structural validation does not establish factual accuracy.

## Games and rewards

- `ghost-trivia-streak-v1`: 100 XP for the first ten-answer streak.
- `haunted-study-escape-v1`: 80 XP for the first escape. Inspect wall/ivy, collect the symbol guide, unlock the desk with 427, fit its key, then open the exit with 742. Three hints are free. All objects work by keyboard/touch and have readable text.
- `potion-panic-v1`: five recipes with 2-6 ingredients. Reveal, undo, retry, restart, and exit are available.
- `ghost-signal-v1`: four distinct labeled shapes, five sequences of 4-8 signals, click/touch/number keys, and automatic or self-paced playback.

The memory games award 20 completion XP plus five round scores: 20 points per unaided round, 10 per assisted/retried round (70-120 total). Replays cannot upgrade or duplicate a previous reward. No partial XP is saved for unfinished runs.

Progress remains under `campus-ghost.quests.v1` as `{xp, completed}`. Old completed IDs and XP are preserved. Navigation uses main's `campus-ghost-journey-v3`, with a fallback migration from `campus-ghost-halle-v2`; resetting navigation never clears quest progress. The previous interactive game is remembered in sessionStorage (`campus-ghost.quests.last-game`) so a new encounter iframe still avoids immediately repeating it. If sessionStorage is unavailable, repeat avoidance lasts for the current module instance. Blocked/corrupt reward storage falls back to memory with a visible warning. Browser storage is user-editable and cross-tab writes are not transactional; this is a local prototype ledger, not a multiplayer reward server.

## Verification

Run `npm.cmd test` (or `node --test`) from the repository. The suite covers game scoring, schemas, randomization, replay rewards, real confirmation handlers, scanner callbacks/configuration, QR links, saved journeys, manual codes, full encounters, coordinate alignment, dismissal, and stale timer/callback rejection.

For an optional real-browser check, start the app on localhost:3002 and launch a **separate** Edge profile with remote debugging port 9223:

```powershell
$browserProfile = Join-Path $PWD '.browser-debug'
$edgeArgs = '--headless=new --disable-gpu --remote-debugging-port=9223 --user-data-dir="{0}" --no-first-run about:blank' -f $browserProfile
Start-Process -FilePath 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -ArgumentList $edgeArgs -WindowStyle Hidden
node tests/browser-journey.mjs
```

The browser check intentionally seeds/resets only its isolated profile's test-origin keys. Never use an everyday browser debugging session. It verifies a complete journey, native Enter submission, camera-failure fallback, QR callbacks with a mocked decoder, focus, reduced motion, viewport bounds, all three game completions, repeat avoidance across fresh encounter frames, zero-reward replay, trivia failure, class cards, the route-aware local assistant, and saved XP. Screenshots are generated into ignored `browser-artifacts/`. Physical camera decoding, permissions, real-device touch, and screen-reader behavior still need manual verification.

## Teammate compatibility

The branch incorporates main through `9d0ced2`, including the class cards/data, responsive styling, BFS routing, lost/respawn control, saved-route progress, health endpoint, assistant fallback/validation/throttling, Node requirement, and CI workflow. James's building data, floor images, and Pat's SVG artwork/CSS are unchanged. The scanner accepts generated same-origin links and James's HTTPS `campus-ghost.onrender.com` printed links (only `/` or `/index.html`), rejecting other hosts/paths. Startup scans are queued until the camera is ready so retired camera instances cannot change later journeys. Rejected off-route reports do not claim a successful confirmation. Detection errors show readable feedback without logging raw QR contents.

An earlier note about an incomplete `public/app.js` referred to historical snapshots. Current main and this combined branch have complete, syntax-checked initialization; no such blocker remains. Integration-specific changes preserve the hidden `confirm` and `last` hooks used by Pat, while the visible student controls remain concise. Triggers are now limited to intermediate checkpoints on the actual displayed route, not adjacent off-route nodes.

No deployment is part of this source change. See README.md for local running instructions and CHECKPOINT-CONFIRMATION.md for the student flow.
