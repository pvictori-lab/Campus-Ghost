# Campus Ghost

Campus Ghost is a student-project prototype for indoor campus wayfinding and class questions. The current map is a single-floor Halle Library prototype. It is not a complete EMU building directory and does not continuously track a student's location.

## Current experience
- Original vintage-cartoon ghost guide with idle, movement, arrival, and respawn states.
- Schematic floor map with selectable QR checkpoints and highlighted route.
- Student-confirmed checkpoint progress; QR links preselect a checkpoint.
- Course information cards backed by editable JSON.
- Assistant endpoint using supplied course, building, and computed route context.
- Local fallback answers when no OpenAI API key is configured or AI is unavailable.
- Basic in-memory request throttling and server-side API-key handling.

## Run locally
Requires Node.js 20 or newer.
1. Clone or download this repository.
2. In the project root, run npm start.
3. Open http://localhost:3000.
4. Stop the server with Ctrl+C.
No external npm packages are required.

## Optional AI configuration
Copy .env.example to .env, add an API key your project is authorized to use, and restart the server.
- OPENAI_API_KEY=...
- OPENAI_MODEL=gpt-4.1-mini
- PORT=3000
Keep .env private. Never place the API key in public/, frontend JavaScript, screenshots, or Git commits. AI API use may incur charges. Without a configured key, the app uses a local data-based response and remains usable.

## Update building information
Edit public/building.json.
- nodes contains map points with unique IDs, labels, and SVG x/y coordinates.
- Nodes with qrCodeId are selectable QR checkpoints.
- edges contains pairs of connected node IDs. The current graph treats edges as bidirectional.
- Add a destinations array of node IDs to limit the destination selector; otherwise QR checkpoints are used.
- Add intermediate nodes at hallway bends. The map draws straight segments between connected nodes.
- Every edge endpoint and destination ID must refer to an existing node.
The route algorithm minimizes the number of graph connections. It does not calculate measured walking distance. Directional turns, accessibility certification, room-level indoor positioning, and automatic location detection are not implemented.

**Verification requirement:** Replace or verify every room label, map point, and connection using current building information and an authorized floor plan. Do not treat the existing map graph as confirmed real-world directions without checking it in person and with appropriate university sources.

## Update courses and professor information
Edit public/courses.json. Each record may include id, title, description, professor, meeting, room, destinationId, milestones (array), and demo.
The included course entries are intentionally labeled DEMO ONLY. Replace them with accurate information from authorized, current sources before presenting the app as a real class schedule. Do not add private student records or unapproved LMS information.

## QR checkpoints
Choose a checkpoint in the app and copy its generated URL. A QR-code generator can encode that URL for a printed sign, subject to building permission. When scanned, the link opens the app with that checkpoint selected. The user must still confirm their location. The prototype does not use camera-based scanning or indoor sensors.

## Testing checklist
- npm start launches the server.
- /api/health returns {"ok":true}.
- The page loads both JSON data files.
- All graph edges refer to valid node IDs.
- Select a start checkpoint and destination; a route appears when connected.
- Confirm a checkpoint and verify ghost/progress updates.
- Open a generated checkpoint link and verify the selected checkpoint.
- Ask a question with no API key; local fallback responds.
- If AI is configured, test a known course fact and a missing professor-office fact.
- Try an invalid/disconnected route and verify the app does not invent a path.
- Check the hosted deployment after the latest commit.

## Important limitations before final submission
- The supplied map is a one-floor prototype, not a verified directory for all EMU buildings.
- Course records are placeholders, not actual course schedules.
- The route uses fewest graph edges, not real measured distance.
- Position changes only when the student confirms a checkpoint.
- Production deployment would need stronger abuse protection, privacy review, data verification, and accessibility testing.
