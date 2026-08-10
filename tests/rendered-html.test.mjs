import assert from "node:assert/strict";
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
