import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

async function render(path = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the JourneySync travel application", async () => {
  const response = await render("/", { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(response.headers.get("permissions-policy") ?? "", /camera=\(\)/i);

  const html = await response.text();
  assert.match(html, /JourneySync/i);
  assert.match(html, /Checking your Firebase account/i);
  assert.doesNotMatch(html, /No trip selected/i);

  const assetsUrl = new URL("../dist/client/assets/", import.meta.url);
  const pageAsset = (await readdir(assetsUrl)).find((name) => /^page-.*\.js$/.test(name));
  assert.ok(pageAsset, "expected a built page client asset");
  const pageBundle = await readFile(new URL(pageAsset, assetsUrl), "utf8");
  assert.match(pageBundle, /Live flight information/i);
  assert.match(pageBundle, /From and to airports/i);
  assert.match(pageBundle, /Flight code/i);
  assert.match(pageBundle, /Welcome back/i);
  assert.match(pageBundle, /Active and upcoming trips/i);
  assert.match(pageBundle, /Nothing is prefilled or added as a demo/i);
  assert.match(pageBundle, /Choose a state or region first/i);
  assert.match(pageBundle, /Expenses will use/i);
  assert.match(pageBundle, /Edit trip details/i);
  assert.match(pageBundle, /Active and upcoming trips/i);
  assert.match(pageBundle, /Completed trips move to Archived automatically/i);
  assert.match(pageBundle, /Delete trip permanently/i);
  assert.match(pageBundle, /Type DELETE to confirm/i);
  assert.match(pageBundle, /It cannot be restored/i);
  assert.match(pageBundle, /isoDate/i);
  assert.match(pageBundle, /End date/i);
  assert.match(pageBundle, /OpenStreetMap/i);
  assert.match(pageBundle, /Interactive map of/i);
  assert.match(pageBundle, /Finding place/i);
  assert.match(pageBundle, /Choose an end date on or after the start date/i);
  assert.match(pageBundle, /journeysync_trips_/i);
  assert.match(pageBundle, /Share Trip Summary/i);
  assert.match(pageBundle, /Firebase did not respond within 8 seconds/i);
  assert.match(pageBundle, /Retry Firebase Connection/i);
  assert.doesNotMatch(pageBundle, /Copy Invite Link/i);
  assert.doesNotMatch(pageBundle, /journeysync_all_trips/i);
  assert.doesNotMatch(pageBundle, /journeysync_mock_user/i);
});

test("production start serves built browser assets", { timeout: 15_000 }, async () => {
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const startScript = fileURLToPath(new URL("../scripts/start.mjs", import.meta.url));
  const child = spawn(process.execPath, [
    startScript,
    "--port",
    "0",
    "--hostname",
    "127.0.0.1",
  ], {
    cwd: projectRoot,
    env: process.env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";

  try {
    const serverUrl = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Production server did not start. Output: ${output}`));
      }, 10_000);
      const collect = (chunk) => {
        output += chunk.toString();
        const match = output.match(/Production server running at (http:\/\/\S+)/);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      };
      child.stdout.on("data", collect);
      child.stderr.on("data", collect);
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Production server exited with code ${code}. Output: ${output}`));
      });
    });

    const pageResponse = await fetch(serverUrl);
    assert.equal(pageResponse.status, 200);
    const html = await pageResponse.text();
    const assetPath = html.match(/href="(\/assets\/[^"]+\.(?:css|js))"/)?.[1];
    assert.ok(assetPath, "expected a browser asset in the rendered page");

    const assetResponse = await fetch(new URL(assetPath, serverUrl));
    assert.equal(assetResponse.status, 200);
    assert.match(assetResponse.headers.get("content-type") ?? "", /(?:text\/css|javascript)/i);
  } finally {
    child.kill();
  }
});

test("map geocoding resolves saved places with durable public caching", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      assert.equal(url.hostname, "nominatim.openstreetmap.org");
      assert.equal(url.searchParams.get("countrycodes"), "us");
      assert.match(url.searchParams.get("q") ?? "", /Millennium Park, Chicago/i);
      return Response.json([{
          name: "Millennium Park",
          display_name: "Millennium Park, Chicago, Illinois, United States",
          lat: "41.8826",
          lon: "-87.6226",
          address: { state: "Illinois", country: "United States", country_code: "us" },
      }]);
    };

    const response = await render("/api/geocode?q=Millennium%20Park%2C%20Chicago&countryCode=US");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /public/i);
    assert.match(response.headers.get("cache-control") ?? "", /s-maxage=2592000/i);
    const body = await response.json();
    assert.equal(body.name, "Millennium Park");
    assert.equal(body.latitude, 41.8826);
    assert.equal(body.longitude, -87.6226);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("release endpoint is never cached and reports the deployed build", async () => {
  const response = await render("/api/version");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/i);
  assert.match(response.headers.get("cache-control") ?? "", /no-cache/i);
  const body = await response.json();
  assert.equal(typeof body.version, "string");
  assert.ok(body.version.length > 0);
});

test("weather endpoint geocodes the selected city and returns a short-lived cached forecast", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      if (url.hostname === "geocoding-api.open-meteo.com") {
        assert.equal(url.searchParams.get("countryCode"), "US");
        assert.match(url.searchParams.get("name") ?? "", /Atlanta, Georgia/i);
        return Response.json({
          results: [{
            name: "Atlanta",
            admin1: "Georgia",
            country: "United States",
            country_code: "US",
            latitude: 33.749,
            longitude: -84.388,
          }],
        });
      }
      if (url.hostname === "api.open-meteo.com") {
        assert.equal(url.searchParams.get("temperature_unit"), "fahrenheit");
        assert.equal(url.searchParams.get("forecast_days"), "5");
        return Response.json({
          timezone: "America/New_York",
          utc_offset_seconds: -14400,
          daily_units: { temperature_2m_max: "°F" },
          daily: {
            time: ["2026-08-10"],
            weather_code: [0],
            temperature_2m_max: [91.2],
            temperature_2m_min: [73.4],
            precipitation_probability_max: [12],
          },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    const response = await render("/api/weather?city=Atlanta&region=Georgia&country=United%20States&countryCode=US");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /max-age=600/i);
    assert.match(response.headers.get("cache-control") ?? "", /s-maxage=900/i);
    const body = await response.json();
    assert.equal(body.destination, "Atlanta");
    assert.equal(body.days[0].high, "91°F");
    assert.equal(body.days[0].low, "73°F");
    assert.equal(body.days[0].rain, "12%");
    assert.equal(body.source, "Open-Meteo");
    assert.equal(body.timeZone, "America/New_York");
    assert.equal(body.utcOffsetSeconds, -14400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("weather endpoint falls back to 7Timer when Open-Meteo forecast is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      if (url.hostname === "geocoding-api.open-meteo.com") {
        return Response.json({
          results: [{
            name: "Chicago",
            admin1: "Illinois",
            country: "United States",
            country_code: "US",
            timezone: "America/Chicago",
            latitude: 41.8781,
            longitude: -87.6298,
          }],
        });
      }
      if (url.hostname === "api.open-meteo.com") return new Response("rate limited", { status: 429 });
      if (url.hostname === "www.7timer.info") {
        assert.equal(url.searchParams.get("lat"), "41.878");
        assert.equal(url.searchParams.get("lon"), "-87.630");
        assert.equal(url.searchParams.get("product"), "civillight");
        return Response.json({
          product: "civillight",
          dataseries: [{
            date: 20260810,
            weather: "lightrain",
            temp2m: { max: 25, min: 20 },
          }],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    const response = await render("/api/weather?city=Chicago&region=Illinois&country=United%20States&countryCode=US");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /s-maxage=900/i);
    const body = await response.json();
    assert.equal(body.destination, "Chicago");
    assert.equal(body.days[0].high, "77°F");
    assert.equal(body.days[0].low, "68°F");
    assert.equal(body.days[0].rain, "Expected");
    assert.equal(body.source, "7Timer");
    assert.equal(body.timeZone, "America/Chicago");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("live flight endpoint rejects unauthenticated requests", async () => {
  const response = await render("/api/flights/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      flightNumber: "AA100",
      departureDate: "2026-08-10",
      origin: "JFK",
      destination: "LHR",
    }),
  });

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.match(body.error, /sign in/i);
});

test("Firestore rules isolate profiles and restrict trip chats to listed account emails", async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /request\.auth\s*!=\s*null/);
  assert.match(rules, /request\.auth\.uid\s*==\s*userId/);
  assert.match(rules, /match \/trip_chats\/\{chatId\}/);
  assert.match(rules, /request\.auth\.token\.email\.lower\(\)/);
  assert.match(rules, /accountEmail\(\) in chat\.memberEmails/);
  assert.match(rules, /senderUid == request\.auth\.uid/);
  assert.match(rules, /allow update, delete: if false/);
  assert.doesNotMatch(rules, /allow\s+(?:read|write|read,\s*write)\s*:\s*if\s+true/);
});

test("native Android app bundles its map UI and shares summaries safely", async () => {
  const source = await readFile(new URL(
    "../android/app/src/main/java/com/manavdesai/journeysync/MainActivity.java",
    import.meta.url,
  ), "utf8");
  const manifest = await readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
  const colors = await readFile(new URL("../android/app/src/main/res/values/colors.xml", import.meta.url), "utf8");
  const leaflet = await readFile(new URL("../android/app/src/main/assets/leaflet/leaflet.js", import.meta.url));

  assert.match(source, /file:\/\/\/android_asset\/leaflet\//);
  assert.match(source, /Intent\.ACTION_SEND/);
  assert.match(source, /FieldValue\.delete\(\)/);
  assert.match(source, /whereArrayContains\("memberEmails"/);
  assert.match(source, /collection\("messages"\)\.add\(payload\)/);
  assert.match(source, /styleButton\(button, BLUE, BLUE_PRESSED, null, NAVY\)/);
  assert.match(source, /renderWorldClockCard\(user, trip\)/);
  assert.match(source, /text\("HOME", 13/);
  assert.doesNotMatch(source, /text\("ATL", 13/);
  assert.match(colors, /<color name="journeysync_blue">#89B8D8<\/color>/);
  assert.doesNotMatch(source, /unpkg\.com/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.ok(leaflet.byteLength > 100_000, "expected bundled Leaflet runtime");
});

test("route search returns normalized AeroDataBox flight information", async () => {
  const originalFetch = globalThis.fetch;
  const originalFirebaseKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const originalAeroKey = process.env.AERODATABOX_API_KEY;
  const originalAeroHost = process.env.AERODATABOX_API_HOST;
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "firebase-test-key";
  process.env.AERODATABOX_API_KEY = "aero-test-key";
  process.env.AERODATABOX_API_HOST = "aerodatabox.test";
  try {
    globalThis.fetch = async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith("https://identitytoolkit.googleapis.com/")) {
        return Response.json({ users: [{ localId: "user-123" }] });
      }
      if (url.startsWith("https://aerodatabox.test/flights/airports/iata/JFK/")) {
        return Response.json({
          departures: [{
            number: "DL 5399",
            status: "Delayed",
            lastUpdatedUtc: "2026-08-10T18:22:00Z",
            airline: { name: "Delta Air Lines" },
            departure: {
              airport: { iata: "JFK" },
              terminal: "4",
              gate: "B31",
              scheduledTime: { local: "2026-08-10 12:42-04:00", utc: "2026-08-10 16:42Z" },
              revisedTime: { local: "2026-08-10 13:02-04:00", utc: "2026-08-10 17:02Z" },
            },
            arrival: {
              airport: { iata: "PWM" },
              terminal: "1",
              gate: "5",
              baggageBelt: "2",
              scheduledTime: { local: "2026-08-10 14:05-04:00", utc: "2026-08-10 18:05Z" },
              revisedTime: { local: "2026-08-10 14:25-04:00", utc: "2026-08-10 18:25Z" },
            },
          }],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    const response = await render("/api/flights/status", {
      method: "POST",
      headers: { authorization: "Bearer test-token", "content-type": "application/json" },
      body: JSON.stringify({ searchMode: "route", departureDate: "2026-08-10", origin: "JFK", destination: "PWM" }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.flights.length, 1);
    assert.equal(body.flights[0].flight.number, "DL 5399");
    assert.equal(body.flights[0].flight.gate, "B31");
    assert.equal(body.flights[0].flight.delayMinutes, 20);
    assert.equal(body.flights[0].status, "Delayed");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalFirebaseKey === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    else process.env.NEXT_PUBLIC_FIREBASE_API_KEY = originalFirebaseKey;
    if (originalAeroKey === undefined) delete process.env.AERODATABOX_API_KEY;
    else process.env.AERODATABOX_API_KEY = originalAeroKey;
    if (originalAeroHost === undefined) delete process.env.AERODATABOX_API_HOST;
    else process.env.AERODATABOX_API_HOST = originalAeroHost;
  }
});
