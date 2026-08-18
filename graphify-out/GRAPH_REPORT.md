# Graph Report - JourneySync  (2026-08-18)

## Corpus Check
- 92 files · ~128,515 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 864 nodes · 2005 edges · 80 communities (48 shown, 32 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.77)
- Token cost: 579,607 input · 0 output

## Graph Freshness
- Built from commit: `47bc976a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Trip Data Model (Shared)
- Live Flight Provider Integration
- Android Day Model
- Location & Currency Data
- Android Location Data
- Android Expense Model
- Cloudflare D1 Bindings
- Android Flight Info Model
- Cloudflare Worker Entry Point
- Android Map Pin Model
- Android Guest Flight Model
- Web Trip Map Component
- Android Date/Time Utilities
- Android Traveler Model
- Android Wallet Doc Model
- Shared Design Tokens (Android)
- Trip JSON Parser Helper (Android)
- Trip JSON Writer Helper (Android)
- Web Trip Page Component
- Firebase Client Wrapper (Web)
- Leaflet.js Minified Runtime (2)
- Next.js Layout & API Routes
- Design Token Generator Script
- Leaflet.js Minified Runtime (3)
- Leaflet.js Minified Runtime (4)
- Drizzle DB Helper & Routes
- Leaflet.js Minified Runtime (5)
- Web Trip Page State
- Leaflet.js Minified Runtime (6)
- Leaflet.js Minified Runtime (7)
- Leaflet.js Minified Runtime (1)
- Android Main Activity
- NPM Dev Dependencies
- NPM Runtime Dependencies
- NPM Scripts
- package.json Metadata
- Production Start Script
- Vite Cloudflare Plugin Config
- drizzle-kit Dependency
- ESLint Config
- eslint-config-next Dependency
- Next.js Config
- Tailwind CSS Dependency
- Leaflet TypeScript Types
- Node Types Dependency
- React Types Dependency
- React DOM Types Dependency
- TypeScript Dependency
- PostCSS Config
- TypeScript Compiler Config
- Graphify Pipeline Steps
- Android Trip Sharing & Security
- Graphify Update & Watch Commands
- Graphify Semantic Extraction Spec
- Graphify Export Formats
- Graphify Codex Platform Docs
- Graphify Query & Path Commands
- Graphify Core Rules
- Graphify Setup & Detection Steps
- JourneySync Brand & OG Image
- Project Agent Guidelines
- Leaflet Layers Icon
- Leaflet Layers Icon 2x
- Leaflet Marker Icon
- Leaflet Marker Icon 2x
- Leaflet Marker Shadow Icon
- JourneySync Favicon
- Next.js File Icon Asset
- Next.js Window Icon Asset
- Geocode API Route
- Version API Route
- Weather API Route

## God Nodes (most connected - your core abstractions)
1. `MainActivity` - 159 edges
2. `Trip` - 66 edges
3. `Home()` - 58 edges
4. `notify()` - 33 edges
5. `requireSignIn()` - 31 edges
6. `updateActiveTrip()` - 23 edges
7. `Day` - 18 edges
8. `JourneySync` - 17 edges
9. `DayEvent` - 16 edges
10. `TripSyncTest` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Steps 6b-8 - Wiki, Neo4j, FalkorDB, SVG, GraphML, MCP, benchmark` --semantically_similar_to--> `Extra exports and benchmark (Codex)`  [INFERRED] [semantically similar]
  .claude/skills/graphify/SKILL.md → .codex/skills/graphify/references/exports.md
- `--update incremental re-extraction` --semantically_similar_to--> `Incremental update and cluster-only (Codex)`  [INFERRED] [semantically similar]
  .claude/skills/graphify/references/update.md → .codex/skills/graphify/references/update.md
- `Extraction subagent prompt` --semantically_similar_to--> `Extraction subagent prompt (Codex, compact)`  [INFERRED] [semantically similar]
  .claude/skills/graphify/references/extraction-spec.md → .codex/skills/graphify/references/extraction-spec.md
- `/graphify command (Codex)` --semantically_similar_to--> `/graphify command`  [INFERRED] [semantically similar]
  .codex/skills/graphify/SKILL.md → .claude/skills/graphify/SKILL.md
- `Whisper transcription with domain-hint prompt` --semantically_similar_to--> `Whisper transcription (Codex)`  [INFERRED] [semantically similar]
  .claude/skills/graphify/references/transcribe.md → .codex/skills/graphify/references/transcribe.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Design Token Generation Pipeline** — design_readme_tokens_json, design_readme_design_tokens_css, design_readme_colors_xml, design_readme_designtokens_java [EXTRACTED 1.00]
- **Server-Side Flight API Key Protection** — readme_api_flights_status, readme_aerodatabox_api, android_readme_flight_tracking [EXTRACTED 1.00]
- **Claude/Codex Platform Parity Skill Set** — claude_skills_graphify_skill_graphify_command, codex_skills_graphify_skill_graphify_command, claude_skills_graphify_references_extraction_spec_prompt, codex_skills_graphify_references_extraction_spec_prompt [INFERRED 0.75]
- **Cross-Client Firestore Trip Sync** — readme_journeysync, android_readme_journeysync_android, readme_cloud_firestore [INFERRED 0.85]
- **Query/Path/Explain Interrogation Flows** — claude_skills_graphify_references_query_traversal, claude_skills_graphify_references_query_path, claude_skills_graphify_references_query_explain, claude_skills_graphify_references_query_save_result [INFERRED 0.85]
- **Structural + Semantic Extraction Pipeline** — claude_skills_graphify_skill_step3_extract, claude_skills_graphify_skill_step3a_ast, claude_skills_graphify_skill_step3b_semantic, claude_skills_graphify_skill_step3c_merge [INFERRED 0.85]

## Communities (80 total, 32 thin omitted)

### Community 0 - "Trip Data Model (Shared)"
Cohesion: 0.07
Nodes (30): MainActivity, WeatherSnapshot, Trip, Activity, DayEvent, Expense, FlightInfo, GuestFlight (+22 more)

### Community 1 - "Live Flight Provider Integration"
Cohesion: 0.06
Nodes (60): AeroAirportMovement, AeroFids, AeroFlight, AeroTime, AviationFlight, AviationMovement, FlightRequest, LiveFlightResult (+52 more)

### Community 12 - "Android Day Model"
Cohesion: 0.20
Nodes (4): Day, DayEvent, TrackedFlight, Day

### Community 13 - "Location & Currency Data"
Cohesion: 0.22
Nodes (11): TripCountry, TripRegion, countryByCode(), currencyForCountry(), inferCountryCode(), regionByCode(), createTrip(), locationFromForm() (+3 more)

### Community 15 - "Android Location Data"
Cohesion: 0.24
Nodes (3): Country, LocationData, Region

### Community 23 - "Cloudflare D1 Bindings"
Cohesion: 0.22
Nodes (3): D1Database, Fetcher, cloudflare:workers

### Community 29 - "Cloudflare Worker Entry Point"
Cohesion: 0.25
Nodes (3): Env, ExecutionContext, worker

### Community 37 - "Web Trip Map Component"
Cohesion: 0.40
Nodes (5): Coordinates, TripMapPoint, TripMapProps, pinStyle(), TripMap()

### Community 4 - "Android Date/Time Utilities"
Cohesion: 0.09
Nodes (6): RefreshThrottle, TimeFormat, TripSyncTest, java.text.SimpleDateFormat, org.junit.Test, SimpleDateFormat

### Community 6 - "Web Trip Page Component"
Cohesion: 0.07
Nodes (30): Day, DayEvent, Expense, FlightInfo, GuestFlight, LiveFlightSearchResponse, LiveFlightUpdate, MapPin (+22 more)

### Community 9 - "Firebase Client Wrapper (Web)"
Cohesion: 0.11
Nodes (25): User, createUserWithEmailAndPassword(), deleteField(), doc(), getIdToken(), onAuthStateChanged(), onSnapshot(), requireAuth() (+17 more)

### Community 11 - "Leaflet.js Minified Runtime (2)"
Cohesion: 0.18
Nodes (15): F(), G(), h(), j(), k(), ke(), me(), ne() (+7 more)

### Community 16 - "Next.js Layout & API Routes"
Cohesion: 0.21
Nodes (5): ReleaseRefresh(), dynamic, geistMono, geistSans, JOURNEYSYNC_BUILD_ID

### Community 18 - "Design Token Generator Script"
Cohesion: 0.24
Nodes (9): cssFile(), javaFile(), lower(), upper(), xmlFile(), BANNER_LINES, outputs, repoRoot (+1 more)

### Community 21 - "Leaflet.js Minified Runtime (3)"
Cohesion: 0.22
Nodes (9): Ae(), Ie(), Jt(), Le(), O(), Qt(), Re(), $t() (+1 more)

### Community 22 - "Leaflet.js Minified Runtime (4)"
Cohesion: 0.31
Nodes (9): at(), be(), d(), m(), ve(), W(), xe(), ye() (+1 more)

### Community 24 - "Drizzle DB Helper & Routes"
Cohesion: 0.39
Nodes (5): getDb(), GET(), POST(), toRouteErrorMessage(), notes

### Community 25 - "Leaflet.js Minified Runtime (5)"
Cohesion: 0.25
Nodes (8): bi(), c(), e(), hi(), Pi(), Qe(), Ti(), u()

### Community 3 - "Web Trip Page State"
Cohesion: 0.15
Nodes (39): activeTripStatus(), formatTime(), friendlyFlightError(), Home(), addDay(), addExpenseSubmit(), addItem(), addLiveSearchResult() (+31 more)

### Community 44 - "Leaflet.js Minified Runtime (6)"
Cohesion: 0.67
Nodes (4): Je(), ni(), oi(), si()

### Community 46 - "Leaflet.js Minified Runtime (7)"
Cohesion: 1.00
Nodes (3): i(), Mi(), zi()

### Community 5 - "Leaflet.js Minified Runtime (1)"
Cohesion: 0.07
Nodes (7): a(), Ci(), ei(), ii(), l(), ri(), x()

### Community 7 - "Android Main Activity"
Cohesion: 0.08
Nodes (18): android.content.Intent, android.content.SharedPreferences, android.graphics.drawable.GradientDrawable, android.os.Bundle, android.os.Handler, android.view.View, android.webkit.WebView, android.widget.ProgressBar (+10 more)

### Community 10 - "NPM Dev Dependencies"
Cohesion: 0.11
Nodes (19): devDependencies, @cloudflare/vite-plugin, eslint, react-server-dom-webpack, @tailwindcss/postcss, vinext, vite, @vitejs/plugin-react (+11 more)

### Community 14 - "NPM Runtime Dependencies"
Cohesion: 0.15
Nodes (13): dependencies, drizzle-orm, firebase, leaflet, next, react, react-dom, drizzle-orm (+5 more)

### Community 20 - "NPM Scripts"
Cohesion: 0.20
Nodes (10): scripts, build, db:generate, dev, lint, start, test, tokens (+2 more)

### Community 35 - "package.json Metadata"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 42 - "Production Start Script"
Cohesion: 0.40
Nodes (4): parsed, projectRoot, vinextDist, vinextEntry

### Community 8 - "TypeScript Compiler Config"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 17 - "Graphify Pipeline Steps"
Cohesion: 0.18
Nodes (12): Node ID format, Whisper transcription with domain-hint prompt, God Nodes, Step 2.5 - Video and audio transcription, Step 3 - Extract entities and relationships, Part A - Structural (AST) extraction, Part C - Merge AST + semantic, Step 4.5 - Graph health check (+4 more)

### Community 2 - "Android Trip Sharing & Security"
Cohesion: 0.06
Nodes (48): com.manavdesai.journeysync package, android colors.xml, app/design-tokens.css, DesignTokens.java, npm run tokens, npm run tokens:check, design/tokens.json, JourneySync Android Client (+40 more)

### Community 27 - "Graphify Update & Watch Commands"
Cohesion: 0.32
Nodes (8): /graphify add <url> ingestion, --watch folder watcher, --cluster-only, --update incremental re-extraction, For /graphify add and --watch, Step 9 - Save manifest, update cost tracker, cleanup, For --update and --cluster-only, Add URL and watch folder (Codex)

### Community 28 - "Graphify Semantic Extraction Spec"
Cohesion: 0.32
Nodes (8): Hyperedges rule, Extraction subagent prompt, Semantic similarity edges, Step B0 - extraction cache check, Part B - Semantic extraction (subagents), Extraction subagent prompt (Codex, compact), Gemini semantic extraction backend, Step 3B2 - spawn_agent/wait_agent/close_agent dispatch (Codex)

### Community 32 - "Graphify Export Formats"
Cohesion: 0.29
Nodes (7): Token reduction benchmark, FalkorDB export, MCP stdio server, Neo4j export, SVG and GraphML export, Wiki export, Steps 6b-8 - Wiki, Neo4j, FalkorDB, SVG, GraphML, MCP, benchmark

### Community 33 - "Graphify Codex Platform Docs"
Cohesion: 0.29
Nodes (7): native CLAUDE.md integration, post-commit auto-rebuild hook, For the commit hook and native CLAUDE.md integration, Extra exports and benchmark (Codex), Commit hook and CLAUDE.md integration (Codex), Incremental update and cluster-only (Codex), /graphify command (Codex)

### Community 34 - "Graphify Query & Path Commands"
Cohesion: 0.43
Nodes (7): /graphify explain, /graphify path - shortest path, save-result work memory feedback loop, graphify query BFS/DFS traversal, For /graphify query, Query, path, explain (Codex), Constrained query vocabulary expansion

### Community 38 - "Graphify Core Rules"
Cohesion: 0.33
Nodes (6): Fast path - existing graph, /graphify command, Interpreter guard for subcommands, graphify Skill Trigger, Confidence score rubric (EXTRACTED/INFERRED/AMBIGUOUS), Honesty Rules

### Community 39 - "Graphify Setup & Detection Steps"
Cohesion: 0.33
Nodes (6): GitHub clone and cross-repo merge, Monorepo / multi-subfolder merge, Step 0 - GitHub repos and multi-path merge, Step 1 - Ensure graphify installed, Step 2 - Detect files, GitHub clone and cross-repo merge (Codex)

### Community 41 - "JourneySync Brand & OG Image"
Cohesion: 0.60
Nodes (5): JourneySync Brand Identity, Trip Privacy/Security Feature (Lock Icon Motif), Tagline: 'Your trips, all in one place.', Trip Folder Cards Visual Motif, og.png (Open Graph Preview Image)

### Community 43 - "Project Agent Guidelines"
Cohesion: 0.67
Nodes (4): Graphify Workflow (AGENTS.md), Graphify Workflow (CLAUDE.md), Approach Guidelines, Approach Guidelines (CLAUDE.md)

## Knowledge Gaps
- **167 isolated node(s):** `AeroAirportMovement`, `AeroFids`, `AeroFlight`, `AeroTime`, `AviationFlight` (+162 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MainActivity` connect `Trip Data Model (Shared)` to `Android Map Pin Model`, `Android Day Model`, `Android Date/Time Utilities`, `Android Main Activity`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `Trip` connect `Trip Data Model (Shared)` to `Android Guest Flight Model`, `Android Date/Time Utilities`, `Android Traveler Model`, `Android Day Model`, `Android Wallet Doc Model`, `Trip JSON Parser Helper (Android)`, `Trip JSON Writer Helper (Android)`, `Android Expense Model`, `Android Model Parsing Helpers`, `Android Map Pin Model`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `Home()` connect `Web Trip Page State` to `Firebase Client Wrapper (Web)`, `Location & Currency Data`, `Web Trip Page Component`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `AeroAirportMovement`, `AeroFids`, `AeroFlight` to the rest of the system?**
  _167 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Trip Data Model (Shared)` be split into smaller, more focused modules?**
  _Cohesion score 0.06836945304437564 - nodes in this community are weakly interconnected._
- **Should `Live Flight Provider Integration` be split into smaller, more focused modules?**
  _Cohesion score 0.06299603174603174 - nodes in this community are weakly interconnected._
- **Should `Android Date/Time Utilities` be split into smaller, more focused modules?**
  _Cohesion score 0.08534850640113797 - nodes in this community are weakly interconnected._