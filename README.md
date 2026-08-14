# JourneySync

Every plan. Every person. One journey.

A collaborative trip planner: itineraries, live flight tracking, group
expenses, travel documents, and a trip map, all synced to a signed-in user's
private Firestore document and mirrored by a companion Android app.

## Stack

- [vinext](https://github.com/cloudflare/vinext) (Next.js App Router APIs on
  Vite), React 19 RSC
- Cloudflare Workers runtime, with the Images binding for image optimization
- Firebase Authentication and Cloud Firestore
- Leaflet with OpenStreetMap tiles
- Tailwind CSS 4
- Drizzle ORM with Cloudflare D1 (scaffolded, not currently used)

## Prerequisites

- Node.js `>=22.13.0`
- A Firebase project with Authentication (Email/Password and Google) and
  Firestore enabled
- Optional: an AeroDataBox and/or AviationStack API key for live flight data

## Quick start

```bash
npm install
cp .env.local.example .env.local   # then fill in your Firebase values
npm run dev
```

The Firebase values are read at build time and inlined into the browser
bundle, so a running dev server must be restarted after editing `.env.local`.
If the placeholders are left in place, the app logs a configuration error and
sign-in is disabled rather than failing silently.

## Environment variables

Client values are inlined into the browser bundle and are safe to expose.
Server values must never be prefixed with `NEXT_PUBLIC_`.

| Variable | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | client | yes | Firebase config, and server-side ID token verification |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | client | yes | Firebase config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | client | yes | Firebase config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | client | yes | Firebase config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | client | no | Firebase config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | client | no | Firebase config |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | client | no | Firebase config |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | client | no | Firebase config |
| `AERODATABOX_API_KEY` | server | no | Primary live flight provider |
| `AERODATABOX_API_HOST` | server | no | Defaults to `aerodatabox.p.rapidapi.com` |
| `AVIATIONSTACK_API_KEY` | server | no | Fallback live flight provider |

Only `NEXT_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID` and `APP_ID`
are validated at startup. Live flight tracking returns HTTP 503 when neither
provider key is set; everything else in the app still works.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vinext dev server with Cloudflare bindings simulated locally |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | lint, typecheck, build, then the `tests/` suite |
| `npm run db:generate` | Drizzle migration generation (unused today) |

## Features

The signed-in app is a single page with seven sections:

- **Overview**: next arrival, today's plan, and a running expense summary
- **Itinerary**: day-by-day events typed as flight, stay, food, train, or
  activity
- **Flight Tracker**: live status by flight number or by origin/destination
  route and date
- **Guest Flights**: the same live lookup for other travelers' inbound flights
- **Map**: geocoded trip pins on a Leaflet map
- **Expenses**: per-trip spending with currency inferred from the destination
- **Wallet**: boarding passes and travel documents attached to the trip

Trips can be archived, and a trip whose end date has passed is shown as
completed rather than active.

## API routes

All routes are `force-dynamic` and send no-store cache headers.

| Route | Method | Auth | Upstream |
| --- | --- | --- | --- |
| `/api/flights/status` | POST | Firebase ID token | AeroDataBox, then AviationStack |
| `/api/weather` | GET | none | Open-Meteo, falling back to 7Timer |
| `/api/geocode` | GET | none | Nominatim (OpenStreetMap) |
| `/api/version` | GET | none | none |

### Live flight lookups

`/api/flights/status` is the only authenticated route. The client sends a
Firebase ID token as a bearer token, the route verifies it against the
Identity Toolkit, and only then calls an upstream provider with a server-held
key. Provider keys never reach a browser or the Android app.

AeroDataBox is primary because it answers date-scoped lookups on the free
plan. AviationStack is the fallback because it gates `flight_date` behind a
paid tier and allows 100 requests per month for free. The fallback fires both
when the primary errors and when it returns no record. Both providers are
normalized into one response shape, so clients never learn which one answered.

### Release refresh

`/api/version` returns the build ID baked in at build time as
`__JOURNEYSYNC_BUILD_ID__`. The client polls it once a minute while the tab is
visible and reloads when the deployed build changes, so travelers on a
long-lived tab pick up new releases. A failed poll is ignored rather than
interrupting someone offline.

## Data and sync

Trips are stored as a single JSON document per user:

```
users/{uid}/user_trips/all_trips
```

Firestore rules restrict every document under `users/{userId}` to that
authenticated user. There is no shared or cross-user access path.

Two details are load-bearing and easy to break:

- The Firestore database is named `default`, not the SDK's implicit
  `(default)`. `app/firebase.ts` pins it explicitly. Without the pin, every
  read and write targets a database that does not exist and retries forever,
  so trips never load and sign-in appears to hang.
- The client uses `persistentLocalCache`, so a returning sign-in paints from
  IndexedDB while Firestore reconciles in the background. It falls back to the
  memory-only cache where IndexedDB is unavailable (private browsing, or
  multiple tabs without broadcast support).

Trips are also cached in `localStorage` per uid, and the newer of the local
and cloud copies wins by `updatedAt`.

## Android app

`android/` holds a native Java client (`com.manavdesai.journeysync`,
`minSdk 23`, `targetSdk 35`) that signs in with Google and reads and writes the
same `users/{uid}/user_trips/all_trips` document as the web app, so itineraries,
expenses, wallet documents, map pins, and travelers stay in sync across both.

For live flight data it calls the deployed `/api/flights/status` route with the
signed-in user's Firebase ID token rather than talking to providers directly, so
no provider key is ever packaged into the APK. The target host is baked in as
the `FLIGHT_API_BASE_URL` build config field in `android/app/build.gradle.kts`
and points at the deployed Worker; change it there to test against another
environment.

There is no Gradle wrapper checked in. Open `android/` in Android Studio, sync
Gradle, and run the `app` configuration. The `com.google.gms.google-services`
plugin expects a `google-services.json` for the Firebase project. The debug
signing key and build output are gitignored. See `android/README.md` for more.

## Deployment

Deploys to Cloudflare Workers using `wrangler.jsonc`. `worker/index.ts` is the
entry point: it handles `/_vinext/image` through the Cloudflare Images binding
and passes everything else to the vinext app router. Static assets are served
from `dist/client` via the `ASSETS` binding.

Server-only keys must be set as Worker secrets, not committed. Firestore rules
deploy separately through `firebase.json`.

## Tests

`npm test` runs lint, typecheck, a production build, and then
`tests/rendered-html.test.mjs`, which covers server rendering, geocoding, the
weather fallback path, cache headers on the release endpoint, rejection of
unauthenticated flight lookups, normalized flight results, and the Firestore
rules isolation property.

## Repo layout

```
app/          web app, API routes, Firebase client
worker/       Cloudflare Worker entry point
android/      native Android client
db/           Drizzle schema (empty) and D1 helper
public/       icons, OG image, PWA manifest
tests/        integration tests
examples/d1/  optional D1 example, not wired into the app
design/       vendored design reference (zip)
```
