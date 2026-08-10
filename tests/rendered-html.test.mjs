import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

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

  const html = await response.text();
  assert.match(html, /JourneySync/i);
  assert.match(html, /Swiss Escape/i);
  assert.match(html, /Arrival in Zürich/i);
  assert.match(html, /Flight Tracker/i);
  assert.match(html, /Guest Flights/i);

  const assetsUrl = new URL("../dist/client/assets/", import.meta.url);
  const pageAsset = (await readdir(assetsUrl)).find((name) => /^page-.*\.js$/.test(name));
  assert.ok(pageAsset, "expected a built page client asset");
  const pageBundle = await readFile(new URL(pageAsset, assetsUrl), "utf8");
  assert.match(pageBundle, /Live flight information/i);
  assert.match(pageBundle, /From and to airports/i);
  assert.match(pageBundle, /Flight code/i);
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
