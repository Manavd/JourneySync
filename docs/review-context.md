# Review context: `claude/work-availability-my63sz`

Seven commits against `main`. Roughly 910 insertions and 224 deletions across 15
files, plus a `package-lock.json` regeneration that accounts for the rest of the
raw diff.

This document exists so a reviewer, human or automated, can see what was
changed, why, what was verified, and specifically what was **not** verified.
Read the "Verification boundary" section before approving anything under
`android/`.

The work was exploratory rather than scoped from a ticket: the request was to
find what was wrong and improve it. Each commit is self-contained and can be
reverted independently, with one ordering constraint noted below.

---

## Commits, oldest first

### 1. `e3b8c2e` Patch dependency vulnerabilities (21 → 6)

Only two of the original 21 advisories were reachable in production. That was
established by inspecting the built worker bundle rather than trusting the
dependency tree: none of `image-size`, `postcss`, `nanoid`, `undici`, `sharp`,
`js-yaml`, `fast-uri` or `brace-expansion` appear in `dist/server/index.js`.
`undici` matched on a grep but the hit was a code comment.

Upgraded, all semver-minor or patch:

| Package | From | To | Why |
| --- | --- | --- | --- |
| `next` | 16.2.6 | 16.3.1 | 9 advisories: Server Action SSRF and DoS, cache confusion, middleware bypass, Server Function endpoint disclosure |
| `react-server-dom-webpack` | 19.2.6 | 19.2.8 | DoS in Server Functions |
| `react`, `react-dom` | 19.2.6 | 19.2.8 | Forced by the `react-server-dom-webpack@19.2.8` peer range `^19.2.8`, not optional |
| `@cloudflare/vite-plugin` | 1.37.1 | 1.52.1 | Cascades fixes into miniflare, wrangler, undici, ws, sharp |
| `wrangler` | 4.92.0 | 4.123.0 | |
| `vite` | 8.0.13 | 8.2.1 | |

**Deliberately not fixed.** Six advisories remain, all dev-only, because npm's
suggested "fix" for each is a *downgrade* that audit still labels a fix:

- `drizzle-kit` 0.31.10 (4 moderate, via `@esbuild-kit/*` → esbuild). Suggested
  fix is 0.18.1, a major regression, to resolve esbuild dev-server advisories
  for a dev server this repo never runs.
- `vinext` → `image-size` (2 high). Genuinely unfixable: `image-size@2.0.2` is
  the latest published release and the advisory range is `*`. The suggested
  `vinext` 0.0.45 is older than the installed 0.0.50.

`npm ls --omit=dev` is empty for both and neither appears in the worker bundle.

### 2. `9fef970` Sync `eslint-config-next` with next

Hygiene. Lint passed either way; the two ship in lockstep and drifting versions
can enable rules that do not match the framework in use.

### 3. `ffa077f` Replace starter README

The README was unmodified `vinext-starter` boilerplate describing a generic
template and an OpenAI workspace auth pattern the app does not use.

Also adds `AVIATIONSTACK_API_KEY` to `.env.local.example`. The flights route has
read it since AviationStack became the fallback provider, but the example file
only documented the AeroDataBox keys, so anyone setting up from it silently got
no fallback.

### 4. `11a10f1` Remove unused ChatGPT workspace auth helper

`app/chatgpt-auth.ts`, 86 lines, deleted. Five independent checks agreed it was
dead:

1. Only tracked files mentioning it were the file itself and a README paragraph.
2. Never present in the build output; already eliminated as dead code, so
   removal cannot change runtime behavior. This is the strongest signal.
3. `git log -S` across all branches returns only the initial commit, so it was
   never imported and later dropped.
4. Its redirect targets (`/signin-with-chatgpt`, `/signout-with-chatgpt`,
   `/callback`) do not exist as routes. Anything calling it would have
   redirected into a 404.
5. Authentication is entirely Firebase.

One `chatgpt` string survives in `app/api/geocode/route.ts`, the `Referer` and
`User-Agent` pair Nominatim's usage policy requires. It contains the deployed
`chatgpt.site` hostname and is unrelated.

### 5. `9f60711` Fix map pin geocoding and rebuild-on-select

Three defects in the map path.

**Roughly every other legacy pin never got coordinates.** The backfill effect
depends on `mapPins`, and a successful lookup writes coordinates back into
`mapPins`, so every success restarts the effect and aborts the loop mid-flight.
Because a pin was added to the attempted set on loop *entry*, any pin whose
pacing delay was interrupted by that abort was retired for the session without
ever being looked up. The attempt is now recorded only after the abort check,
when the request is actually going out.

**The Nominatim rate limit was defeated.** Pacing was gated on `index > 0`, but
the loop index resets to 0 on every rerun, and reruns happen after every
success. Pacing now reads a timestamp ref that outlives the restart.

**Clicking a pin rebuilt the entire map.** `selectedName` and `onSelect` were
dependencies of the effect constructing the Leaflet instance, so each click ran
`map.remove()`, rebuilt the map, refetched tiles and re-ran `fitBounds`,
discarding pan and zoom. Markers are now tracked in a ref and restyled in place.

Leaflet remains lazily imported. The added `CircleMarker` import is type-only and
erased at build; the leaflet chunk is still absent from the initial preload set.

Also adds a guard on Firestore's hard 1 MiB document limit. The whole profile is
one document, so past that line every write fails identically, logging to console
while the badge stays unsynced with nothing explaining why.

### 6. `36aa11f` Adapt layouts to varying screens and ratios

**Android.** The app has no layout XML; the UI is built programmatically.

- Rotation reset navigation. `activeSection`, `activeTripId`, `activeDayIndex`
  and the library flags are plain fields with no saved-state handling, so every
  recreation threw the user back to the library and Overview. Now round-tripped
  through `onSaveInstanceState`.
- Insets covered only top and bottom. In landscape a display cutout sits on a
  *side* edge where `systemBars()` reports nothing, so the header slid under the
  camera housing. Now unions with `displayCutout()` and pads all four edges.
- The trip map was pinned at 240dp, about a third of a portrait phone but nearly
  the whole usable height of a landscape one. Now proportional and clamped so
  portrait renders exactly as before.
- The bottom nav was a fixed 68dp bar holding six tabs whose text is sized in
  `sp`; raising the system font size cropped tabs mid-glyph. Bar and items now
  measure to content with the old heights as minimums, captions capped to one
  ellipsized line.
- Manifest gains `resizeableActivity` and `windowSoftInputMode="adjustResize"`.

**Web.** `100vh` means the viewport with the URL bar retracted, taller than what
is visible while it shows, so panels ran off the bottom hiding the sign-in
submit button and modal action rows.

Worth a reviewer's attention: the obvious fix is wrong here. The usual
`100vh` then `100dvh` declaration pair does not survive this build, because the
minifier collapses same-property declarations to the last one and deleted all
nine `100vh` fallbacks, leaving browsers without `dvh` support with no height
bound at all, worst on modals which lost `max-height` and would overflow with
nothing to scroll. This was caught by inspecting the built stylesheet, not the
source. An `@supports` group rule survives; that is why the CSS looks unusual.

### 7. `01fb7d6` Single-source the design tokens

The clients are written in different languages with no shared build, so the
palette existed twice and was synced by hand. It did not stay synced: the
Android launcher colour was `#EC3013`, a red appearing nowhere on the website,
recorded in the old `colors.xml` comment. That drift is invisible in review
because neither diff looks wrong alone.

`design/tokens.json` is now the only place a shared value is written.
`scripts/generate-design-tokens.mjs` renders it into `app/design-tokens.css`,
`android/.../res/values/colors.xml` and `android/.../DesignTokens.java`.
`MainActivity`'s colour constants became aliases of the generated class, so
call sites are unchanged.

`npm run tokens:check` runs first in `npm test` and fails naming any drifted
file. Consistency here means the *value*, not the vocabulary: the page
background stays `--paper` on web and `SURFACE` on Android, so each token
carries explicit per-platform names.

`success` `#1D7A48` and `successOnDark` `#73C994` are kept as separate tokens on
purpose. They are the same signal on different backgrounds, chosen for contrast;
collapsing them would fail on whichever surface lost.

---

## Verification boundary

Read this before approving.

**Fully verified.** Lint, `tsc --noEmit`, a clean production build, the 8 tests
in `tests/rendered-html.test.mjs`, and the new token drift check. Beyond the
suite: the server was run and `/`, `/api/version` and an unauthenticated
`/api/flights/status` were exercised directly; the built stylesheet was
inspected to confirm both `100vh` and `100dvh` ship; the drift check was
tamper-tested by corrupting a generated colour and confirming it exits 1 and
halts `npm test` before lint.

**Not verified, and reviewers should treat as unproven.**

- **The Android app was never compiled.** This environment has a JDK and Gradle
  but no Android SDK, and the repo has no Gradle wrapper. `MainActivity.java`
  was syntax-checked with `javac` and diffed against the pre-change baseline:
  986 errors both before and after, all missing-SDK symbols, with the only new
  diagnostic being the added `@Override` that cannot resolve without platform
  classes. That is not a compile. `DesignTokens.java` *does* compile cleanly on
  its own since it has no Android imports, and compiling it together with
  `MainActivity` produces no unresolved `DesignTokens` symbols, so the aliasing
  holds. **Build in Android Studio before trusting commits 6 and 7.**
- **No Android change was seen running on a device.** Rotation, insets, map
  height and nav sizing are reasoned from the code and the platform contract.
- **The weather and geocode upstreams were never reached.** This sandbox's
  egress policy returns 403 for `nominatim.openstreetmap.org` and
  `geocoding-api.open-meteo.com`, so those routes answer 502 locally. The app
  degrades correctly, returning a clean 502 rather than crashing, but the live
  paths are exercised only by the mocked tests.
- **No visual check of the web UI.** The `dvh` and token changes were verified
  by reading built CSS, not by looking at a rendered page.

## Ordering constraint

Commit 7 depends on commit 6 only in `app/globals.css`, which both touch.
Everything else reverts independently.

## Decisions deferred rather than taken

Each of these was found, judged to be the owner's call, and left alone.

- **`/api/geocode` and `/api/weather` send `no-store` and hit their upstream on
  every request.** Caching would cut upstream calls substantially, and a city's
  coordinates never change. Not changed because `no-store` on both is explicitly
  asserted by existing tests, making it a deliberate decision rather than an
  oversight.
- **`page.tsx` carries a second, off-brand palette:** Tailwind's slate ramp
  inline, `#64748b` about ten times plus `#f8fafc`, `#475569`, `#cbd5e1`,
  `#e2e8f0`, `#f1f5f9`, `#0f172a`. Cool greys against a warm cream and paper
  brand, with no Android counterpart. Consolidating is a visual change.
- **`#0c79d8` belongs to no palette** yet is both the map destination marker and
  the PWA `theme-color`. Android's map draws its route in coral with no blue
  marker.
- **`.green` `#b9d8b9` is a third green**, near but not equal to `mint`.
- **Nav vocabulary differs by design.** Web has seven tabs including "Itinerary"
  and "Flight Tracker"; Android has six, using "Plan" and "Flights". A code
  comment shows the Android naming was a considered redesign, and the longer web
  labels would truncate in the roughly 50dp each Android tab gets. Left alone.
- **`viewport-fit=cover` with `env(safe-area-inset-*)`** for notched devices in
  installed-PWA mode, and `sw600dp` tablet layouts. Both change layout on real
  hardware that could not be observed here.
- **Two deployment hosts are live in the source:** geocode identifies as
  `journeysync-travel.manavdesai53.chatgpt.site` while the Android
  `FLIGHT_API_BASE_URL` points at
  `journeysync-travel-planner.manavdesai.workers.dev`. Both may be intentional;
  flagged in case one is stale.

## Suggested review order

1. `9f60711` — the densest logic. The geocoding abort interaction is the subtle
   part and deserves the most scrutiny.
2. `36aa11f` — Android correctness cannot be confirmed without a build.
3. `01fb7d6` — mostly generated; review `design/tokens.json` and the generator,
   then confirm the generated files match by running `npm run tokens`.
4. `e3b8c2e` — check the reasoning for the six deliberately unfixed advisories.
5. The rest are documentation and deletion.
