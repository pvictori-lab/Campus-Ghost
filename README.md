# Campus Ghost — runnable one-floor demo

## Start on Windows
1. Extract this ZIP.
2. Open PowerShell in the extracted folder that contains `package.json` and `server.mjs`.
3. Run `npm.cmd start`.
4. Open http://localhost:3000 in your browser.

Requires a modern Node.js with `--env-file-if-exists` (the user's installed Node 26 supports this). No package installation or external dependencies needed. Stop with Ctrl+C. Server binds to this computer only.

## Included
Animated SVG ghost; schematic one-floor map; course cards; fewest-segment graph routing; student-confirmed progress; local summary fallback; optional OpenAI Responses API connection.

This is starter code, not a production product. It has not been browser-tested in this environment. All locations, courses, and meetings are fictional. It does not track position. Map points are manually entered. Route steps update only on confirmation. Routes minimize number of connections, not physical distance. Next-class scheduling, QR codes, voice, AR, accounts, and distances are not implemented.

## Edit floor
Edit `public/building.json`: nodes have unique IDs, labels and SVG x/y coordinates; edges are bidirectional connected ID pairs; rooms lists destination node IDs. Keep coordinates within the map's 720 by 410 viewBox, or change it in index.html. Every referenced node must exist. Walk and verify connections before presenting them as real. This schematic does not render walls or prove accessibility. Add measured distances and weighted routing later if needed.

## Edit courses
Edit `public/courses.json`. Each roomId must appear in building.rooms. Milestones are text labels, not automatically calculated deadlines. Do not enter private student records: public JSON is visible to browser users.

## Optional AI
Copy `.env.example` to `.env`, enter your API key and a model accessible to your API project, then restart the server. Never share or commit `.env`. No API key is required for maps or local course summaries. The default model is configurable and availability is not guaranteed. AI requests can incur charges. This demo sends the selected fictional course and question to OpenAI; do not send sensitive information.

The AI does not calculate routes or track location. The server loads course facts from its own data file. Without an API key, questions return a clearly labeled local summary.

## GitHub
Upload source files including hidden .gitignore and .env.example, not .env. GitHub stores the source; GitHub Pages cannot run this Node server. Run locally for the hackathon. Do not expose this demo server publicly without authentication/rate limits and further security review.

## Test checklist
- Start app and select all three courses.
- Route entrance to each room; confirm each checkpoint.
- Reset after selecting a different starting point.
- Confirm start equals destination works.
- Try chat without a key; verify local summary label.
- If configuring AI, test both valid credentials and failure.
- Verify all replaced floor connections in person.
