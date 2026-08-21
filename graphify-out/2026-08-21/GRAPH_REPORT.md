# Graph Report - JourneySync  (2026-08-21)

## Corpus Check
- 96 files · ~147,324 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1032 nodes · 2445 edges · 93 communities (57 shown, 36 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `db72cabc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- MainActivity
- status/route.ts
- JourneySync
- Home
- TripSyncTest
- leaflet.js
- page.tsx
- MainActivity.java
- compilerOptions
- requireAuth
- devDependencies
- k
- Day
- location-data.ts
- dependencies
- HomeLocation
- layout.tsx
- Whisper transcription with domain-hint prompt
- generate-design-tokens.mjs
- firebase.ts
- scripts
- Ae
- m
- D1Database
- notes/route.ts
- e
- .refreshLiveFlight
- /graphify command (Codex)
- Extraction subagent prompt
- worker/index.ts
- What You Must Do When Invoked
- WorldClock.tsx
- Steps 6b-8 - Wiki, Neo4j, FalkorDB, SVG, GraphML, MCP, benchmark
- Part A - Structural (AST) extraction
- For /graphify query
- package.json
- GuestFlight
- TripMap.tsx
- /graphify command
- GitHub clone and cross-repo merge
- .updateClockViews
- og.png (Open Graph Preview Image)
- start.mjs
- Approach Guidelines
- Je
- graphify reference: extra exports and benchmark
- F
- DesignTokens
- .applyLiveFlight
- vite.config.ts
- Writer
- drizzle-kit
- eslint.config.mjs
- eslint-config-next
- next.config.ts
- .isoFormat
- @types/leaflet
- @types/node
- @types/react
- @types/react-dom
- typescript
- postcss.config.mjs
- Leaflet Layers Control Icon
- Leaflet Layers Control Icon (2x)
- Leaflet Marker Icon (marker-icon.png)
- Leaflet Marker Icon 2x (Vendored Asset)
- Leaflet Marker Shadow Icon
- JourneySync Favicon Brand Mark
- File Icon (Next.js Starter Asset)
- window.svg (Window Icon)
- /api/geocode route
- /api/version route
- /api/weather route
- TripChat
- ke
- TimeFormat
- Q: Should low-cohesion communities be split into smaller modules?
- Q: Why does Trip connect to Leaflet.js Minified Parser and Writer communities?
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- .recordRefreshFailure
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- extraction-spec.md
- @vitejs/plugin-react

## God Nodes (most connected - your core abstractions)
1. `MainActivity` - 197 edges
2. `Trip` - 71 edges
3. `Home()` - 61 edges
4. `notify()` - 34 edges
5. `requireSignIn()` - 31 edges
6. `updateActiveTrip()` - 23 edges
7. `Day` - 18 edges
8. `TripSyncTest` - 18 edges
9. `JourneySync` - 17 edges
10. `DayEvent` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Steps 6b-8 - Wiki, Neo4j, FalkorDB, SVG, GraphML, MCP, benchmark` --semantically_similar_to--> `Extra exports and benchmark (Codex)`  [INFERRED] [semantically similar]
  .claude/skills/graphify/SKILL.md → .codex/skills/graphify/references/exports.md
- `Extraction subagent prompt` --semantically_similar_to--> `Extraction subagent prompt (Codex, compact)`  [INFERRED] [semantically similar]
  .claude/skills/graphify/references/extraction-spec.md → .codex/skills/graphify/references/extraction-spec.md
- `/graphify command (Codex)` --semantically_similar_to--> `/graphify command`  [INFERRED] [semantically similar]
  .codex/skills/graphify/SKILL.md → .claude/skills/graphify/SKILL.md
- `Whisper transcription with domain-hint prompt` --semantically_similar_to--> `Whisper transcription (Codex)`  [INFERRED] [semantically similar]
  .claude/skills/graphify/references/transcribe.md → .codex/skills/graphify/references/transcribe.md
- `Known Token Gaps` --semantically_similar_to--> `Decisions Deferred`  [INFERRED] [semantically similar]
  design/README.md → docs/review-context.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Design Token Generation Pipeline** — design_readme_tokens_json, design_readme_design_tokens_css, design_readme_colors_xml, design_readme_designtokens_java [EXTRACTED 1.00]
- **Server-Side Flight API Key Protection** — readme_api_flights_status, readme_aerodatabox_api, android_readme_flight_tracking [EXTRACTED 1.00]
- **Claude/Codex Platform Parity Skill Set** — claude_skills_graphify_skill_graphify_command, codex_skills_graphify_skill_graphify_command, claude_skills_graphify_references_extraction_spec_prompt, codex_skills_graphify_references_extraction_spec_prompt [INFERRED 0.75]
- **Cross-Client Firestore Trip Sync** — readme_journeysync, android_readme_journeysync_android, readme_cloud_firestore [INFERRED 0.85]
- **Query/Path/Explain Interrogation Flows** — claude_skills_graphify_references_query_traversal, claude_skills_graphify_references_query_path, claude_skills_graphify_references_query_explain, claude_skills_graphify_references_query_save_result [INFERRED 0.85]
- **Structural + Semantic Extraction Pipeline** — claude_skills_graphify_skill_step3_extract, claude_skills_graphify_skill_step3a_ast, claude_skills_graphify_skill_step3b_semantic, claude_skills_graphify_skill_step3c_merge [INFERRED 0.85]

## Communities (93 total, 36 thin omitted)

### Community 0 - "MainActivity"
Cohesion: 0.07
Nodes (32): Activity, DayEvent, Expense, FlightInfo, GuestFlight, MapPin, Traveler, WalletDoc (+24 more)

### Community 1 - "status/route.ts"
Cohesion: 0.06
Nodes (60): fetchWithTimeout(), AeroAirportMovement, AeroFids, AeroFlight, AeroTime, airportCode(), aviationDelayMinutes(), aviationEndpoint() (+52 more)

### Community 2 - "JourneySync"
Cohesion: 0.06
Nodes (48): Leaflet BSD 2-Clause License, AeroDataBox Key Protection (Android), Shared Firestore Trip Document (Android), Debug Signing Key (gitignored), Firebase Authentication (Android), Live Flight Refresh (Android), JourneySync Android (overview), com.manavdesai.journeysync package (+40 more)

### Community 3 - "Home"
Cohesion: 0.16
Nodes (36): formatTime(), friendlyFlightError(), Home(), addDay(), addExpenseSubmit(), addItem(), addLiveSearchResult(), addMapPinSubmit() (+28 more)

### Community 5 - "leaflet.js"
Cohesion: 0.07
Nodes (7): a(), Ci(), ei(), ii(), l(), ri(), x()

### Community 6 - "page.tsx"
Cohesion: 0.06
Nodes (37): deleteDoc(), activeTripStatus(), buildTripSummary(), Day, DayEvent, EMPTY_DAYS, EMPTY_EXPENSES, EMPTY_GUEST_FLIGHTS (+29 more)

### Community 7 - "MainActivity.java"
Cohesion: 0.06
Nodes (23): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal, android.app.AlertDialog, android.content.Intent, android.content.SharedPreferences (+15 more)

### Community 8 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 9 - "requireAuth"
Cohesion: 0.24
Nodes (12): createUserWithEmailAndPassword(), getIdToken(), onAuthStateChanged(), requireAuth(), signInWithEmailAndPassword(), signInWithPopup(), signOut(), toUser() (+4 more)

### Community 10 - "devDependencies"
Cohesion: 0.11
Nodes (19): @cloudflare/vite-plugin, eslint, devDependencies, @cloudflare/vite-plugin, eslint, react-server-dom-webpack, tailwindcss, @tailwindcss/postcss (+11 more)

### Community 11 - "k"
Cohesion: 0.40
Nodes (6): G(), k(), me(), Oe(), Se(), ze()

### Community 12 - "Day"
Cohesion: 0.05
Nodes (10): Day, DayEvent, Expense, Day, MapPin, MapValues, Traveler, Parser (+2 more)

### Community 13 - "location-data.ts"
Cohesion: 0.24
Nodes (10): COMMON_CURRENCIES, countryByCode(), currencyForCountry(), inferCountryCode(), regionByCode(), TRIP_COUNTRIES, TripCountry, TripRegion (+2 more)

### Community 14 - "dependencies"
Cohesion: 0.15
Nodes (13): drizzle-orm, firebase, next, dependencies, drizzle-orm, firebase, leaflet, next (+5 more)

### Community 15 - "HomeLocation"
Cohesion: 0.14
Nodes (4): HomeLocation, Country, LocationData, Region

### Community 16 - "layout.tsx"
Cohesion: 0.21
Nodes (5): dynamic, geistMono, geistSans, JOURNEYSYNC_BUILD_ID, ReleaseRefresh()

### Community 17 - "Whisper transcription with domain-hint prompt"
Cohesion: 0.20
Nodes (10): Whisper transcription with domain-hint prompt, God Nodes, Step 2.5 - Video and audio transcription, Step 3 - Extract entities and relationships, Part C - Merge AST + semantic, Step 4.5 - Graph health check, Step 4 - Build graph, cluster, analyze, generate outputs, Step 5 - Label communities (+2 more)

### Community 18 - "generate-design-tokens.mjs"
Cohesion: 0.24
Nodes (9): BANNER_LINES, cssFile(), javaFile(), lower(), outputs, repoRoot, tokensPath, upper() (+1 more)

### Community 19 - "firebase.ts"
Cohesion: 0.12
Nodes (32): addDoc(), auth, collection(), db, deleteField(), firebaseConfig, googleProvider, invalidConfigKeys (+24 more)

### Community 20 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, db:generate, dev, lint, start, test, tokens (+2 more)

### Community 21 - "Ae"
Cohesion: 0.33
Nodes (6): Ae(), Ie(), Le(), O(), Re(), te()

### Community 22 - "m"
Cohesion: 0.31
Nodes (9): at(), be(), d(), m(), ve(), W(), xe(), ye() (+1 more)

### Community 23 - "D1Database"
Cohesion: 0.22
Nodes (3): cloudflare:workers, D1Database, Fetcher

### Community 24 - "notes/route.ts"
Cohesion: 0.39
Nodes (5): getDb(), GET(), POST(), toRouteErrorMessage(), notes

### Community 25 - "e"
Cohesion: 0.25
Nodes (8): bi(), c(), e(), hi(), Pi(), Qe(), Ti(), u()

### Community 27 - "/graphify command (Codex)"
Cohesion: 0.24
Nodes (11): /graphify add <url> ingestion, --watch folder watcher, --cluster-only, --update incremental re-extraction, For /graphify add and --watch, Step 9 - Save manifest, update cost tracker, cleanup, For --update and --cluster-only, Add URL and watch folder (Codex) (+3 more)

### Community 28 - "Extraction subagent prompt"
Cohesion: 0.32
Nodes (8): Hyperedges rule, Extraction subagent prompt, Semantic similarity edges, Gemini semantic extraction backend, Step B0 - extraction cache check, Part B - Semantic extraction (subagents), Extraction subagent prompt (Codex, compact), Step 3B2 - spawn_agent/wait_agent/close_agent dispatch (Codex)

### Community 29 - "worker/index.ts"
Cohesion: 0.25
Nodes (3): Env, ExecutionContext, worker

### Community 30 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 31 - "WorldClock.tsx"
Cohesion: 0.24
Nodes (15): doc(), onSnapshot(), serverTimestamp(), setDoc(), ClockDestination, dateInZone(), differenceLabel(), homeFromData() (+7 more)

### Community 32 - "Steps 6b-8 - Wiki, Neo4j, FalkorDB, SVG, GraphML, MCP, benchmark"
Cohesion: 0.29
Nodes (7): Token reduction benchmark, FalkorDB export, MCP stdio server, Neo4j export, SVG and GraphML export, Wiki export, Steps 6b-8 - Wiki, Neo4j, FalkorDB, SVG, GraphML, MCP, benchmark

### Community 33 - "Part A - Structural (AST) extraction"
Cohesion: 0.33
Nodes (6): Node ID format, native CLAUDE.md integration, post-commit auto-rebuild hook, For the commit hook and native CLAUDE.md integration, Part A - Structural (AST) extraction, Commit hook and CLAUDE.md integration (Codex)

### Community 34 - "For /graphify query"
Cohesion: 0.43
Nodes (7): /graphify explain, /graphify path - shortest path, save-result work memory feedback loop, graphify query BFS/DFS traversal, Constrained query vocabulary expansion, For /graphify query, Query, path, explain (Codex)

### Community 35 - "package.json"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 37 - "TripMap.tsx"
Cohesion: 0.40
Nodes (5): Coordinates, pinStyle(), TripMap(), TripMapPoint, TripMapProps

### Community 38 - "/graphify command"
Cohesion: 0.33
Nodes (6): graphify Skill Trigger, Confidence score rubric (EXTRACTED/INFERRED/AMBIGUOUS), Fast path - existing graph, /graphify command, Honesty Rules, Interpreter guard for subcommands

### Community 39 - "GitHub clone and cross-repo merge"
Cohesion: 0.33
Nodes (6): GitHub clone and cross-repo merge, Monorepo / multi-subfolder merge, Step 0 - GitHub repos and multi-path merge, Step 1 - Ensure graphify installed, Step 2 - Detect files, GitHub clone and cross-repo merge (Codex)

### Community 41 - "og.png (Open Graph Preview Image)"
Cohesion: 0.60
Nodes (5): JourneySync Brand Identity, Trip Privacy/Security Feature (Lock Icon Motif), Tagline: 'Your trips, all in one place.', Trip Folder Cards Visual Motif, og.png (Open Graph Preview Image)

### Community 42 - "start.mjs"
Cohesion: 0.40
Nodes (4): parsed, projectRoot, vinextDist, vinextEntry

### Community 43 - "Approach Guidelines"
Cohesion: 0.67
Nodes (4): Approach Guidelines, Graphify Workflow (AGENTS.md), Approach Guidelines (CLAUDE.md), Graphify Workflow (CLAUDE.md)

### Community 44 - "Je"
Cohesion: 0.67
Nodes (4): Je(), ni(), oi(), si()

### Community 45 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 46 - "F"
Cohesion: 0.32
Nodes (8): F(), i(), Mi(), ne(), e(), p(), q(), zi()

### Community 80 - "TripChat"
Cohesion: 0.43
Nodes (3): Message, TripChat, com.google.firebase.firestore.DocumentSnapshot

### Community 81 - "ke"
Cohesion: 0.29
Nodes (7): h(), j(), Jt(), ke(), Qt(), s(), $t()

### Community 83 - "Q: Should low-cohesion communities be split into smaller modules?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Should low-cohesion communities be split into smaller modules?, Source Nodes

### Community 84 - "Q: Why does Trip connect to Leaflet.js Minified Parser and Writer communities?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why does Trip connect to Leaflet.js Minified Parser and Writer communities?, Source Nodes

### Community 85 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 86 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 87 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

## Knowledge Gaps
- **221 isolated node(s):** `ChatTrip`, `TripChat`, `ChatMessage`, `metadataSignatures`, `TripMapPoint` (+216 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MainActivity` connect `MainActivity` to `TripSyncTest`, `MainActivity.java`, `.updateClockViews`, `Day`, `HomeLocation`, `.applyLiveFlight`, `TripChat`, `.isoFormat`, `.recordRefreshFailure`, `.refreshLiveFlight`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `Trip` connect `MainActivity` to `GuestFlight`, `.updateClockViews`, `Day`, `Writer`, `.isoFormat`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `Home()` connect `Home` to `page.tsx`, `requireAuth`, `location-data.ts`, `firebase.ts`, `WorldClock.tsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `ChatTrip`, `TripChat`, `ChatMessage` to the rest of the system?**
  _221 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `MainActivity` be split into smaller, more focused modules?**
  _Cohesion score 0.06658112346735101 - nodes in this community are weakly interconnected._
- **Should `status/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06299603174603174 - nodes in this community are weakly interconnected._
- **Should `JourneySync` be split into smaller, more focused modules?**
  _Cohesion score 0.05851063829787234 - nodes in this community are weakly interconnected._