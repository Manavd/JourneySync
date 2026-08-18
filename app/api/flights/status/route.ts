import { fetchWithTimeout } from "../../fetch-with-timeout";

export const dynamic = "force-dynamic";

// Live flight data comes from AeroDataBox first, with AviationStack as a
// fallback when AeroDataBox errors out or has no record of the flight.
//
// AeroDataBox is primary because it answers date-scoped lookups on the current
// plan; AviationStack gates its `flight_date` parameter behind Basic and above
// and allows only 100 requests per month on Free, so it is the safety net
// rather than the workhorse. Fallback also fires on an empty primary result,
// which is the case where a second source is actually worth spending.
//
// Neither provider key ever reaches a client. Browsers and the Android app
// call this route with a Firebase ID token; the token is verified here and
// only then is an upstream provider called with a server-held key.

type AeroTime = {
  local?: string | null;
  utc?: string | null;
};

type AeroAirportMovement = {
  airport?: { iata?: string | null; name?: string | null } | null;
  scheduledTime?: AeroTime | null;
  revisedTime?: AeroTime | null;
  actualTime?: AeroTime | null;
  terminal?: string | null;
  gate?: string | null;
  baggageBelt?: string | null;
};

type AeroFlight = {
  number?: string | null;
  status?: string | null;
  lastUpdatedUtc?: string | null;
  airline?: { name?: string | null; iata?: string | null } | null;
  departure?: AeroAirportMovement | null;
  arrival?: AeroAirportMovement | null;
};

type FlightRequest = {
  searchMode?: unknown;
  flightNumber?: unknown;
  departureDate?: unknown;
  origin?: unknown;
  destination?: unknown;
};

type AeroFids = {
  departures?: AeroFlight[] | null;
};

type AviationMovement = {
  airport?: string | null;
  timezone?: string | null;
  iata?: string | null;
  icao?: string | null;
  terminal?: string | null;
  gate?: string | null;
  baggage?: string | null;
  delay?: number | string | null;
  scheduled?: string | null;
  estimated?: string | null;
  actual?: string | null;
  estimated_runway?: string | null;
  actual_runway?: string | null;
};

type AviationFlight = {
  flight_date?: string | null;
  flight_status?: string | null;
  departure?: AviationMovement | null;
  arrival?: AviationMovement | null;
  airline?: { name?: string | null; iata?: string | null; icao?: string | null } | null;
  flight?: { number?: string | null; iata?: string | null; icao?: string | null } | null;
  live?: { updated?: string | null; is_ground?: boolean | null } | null;
};

/** Shape both providers normalize into, so clients never learn which one answered. */
type LiveFlightResult = {
  status: string;
  flight: {
    number: string;
    airline: string;
    origin: string;
    destination: string;
    departureDate: string;
    departureTerminal: string;
    arrivalTerminal: string;
    gate: string;
    arrivalGate: string;
    scheduledDeparture: string;
    estimatedDeparture: string;
    scheduledArrival: string;
    estimatedArrival: string;
    delayMinutes: number;
    baggageClaim: string;
    lastUpdated: string;
    lastUpdatedUtc: string;
    source: string;
  };
};

type SearchMode = "number" | "route";

type SearchQuery = {
  searchMode: SearchMode;
  flightNumber: string;
  departureDate: string;
  origin: string;
  destination: string;
};

const DEFAULT_AERODATABOX_HOST = "aerodatabox.p.rapidapi.com";
const AVIATIONSTACK_BASE = "https://api.aviationstack.com/v1/flights";
const FIREBASE_LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";
const ROUTE_RESULT_LIMIT = 20;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function normalizeFlightNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function airportCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isoTime(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value.replace(" ", "T"));
  return Number.isNaN(parsed) ? null : parsed;
}

function cleanText(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/**
 * Reads the wall-clock portion of a provider timestamp. AeroDataBox emits
 * "2026-08-13 19:05-04:00" (space separated) and AviationStack emits
 * "2026-08-13T19:05:00+00:00" (ISO `T`), and in both cases that wall clock is
 * already local to the airport - so read it directly instead of going through
 * Date, which would shift it into the server's zone.
 */
function localClock(value?: string | null): string {
  if (!value) return "TBD";
  const match = value.match(/[T ](\d{2}):(\d{2})/) ?? value.match(/^(\d{2}):(\d{2})/);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${suffix}`;
}

function isoUtcStamp(value?: string | null): string {
  const parsed = isoTime(value);
  return parsed === null ? new Date().toISOString() : new Date(parsed).toISOString();
}

// --- AeroDataBox (primary) ---------------------------------------------------

function delayMinutes(movement?: AeroAirportMovement | null): number {
  const scheduled = isoTime(movement?.scheduledTime?.utc ?? movement?.scheduledTime?.local);
  const revised = isoTime(
    movement?.actualTime?.utc ?? movement?.actualTime?.local ?? movement?.revisedTime?.utc ?? movement?.revisedTime?.local,
  );
  if (scheduled === null || revised === null) return 0;
  return Math.max(0, Math.round((revised - scheduled) / 60_000));
}

function normalizeStatus(status: string | null | undefined, delay: number): string {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("arriv") || normalized.includes("land")) return "Landed";
  if (normalized.includes("depart") || normalized.includes("en route") || normalized.includes("airborne")) return "Departed";
  if (normalized.includes("board")) return "Boarding";
  if (delay > 0 || normalized.includes("delay")) return "Delayed";
  if (normalized.includes("sched") || normalized.includes("expected")) return "Scheduled";
  return status?.trim() || "On time";
}

function preferredTime(movement?: AeroAirportMovement | null): string | null {
  return movement?.actualTime?.local ?? movement?.revisedTime?.local ?? movement?.scheduledTime?.local ?? null;
}

function selectFlight(flights: AeroFlight[], origin: string, destination: string): AeroFlight | null {
  const matchesOrigin = (flight: AeroFlight) => airportCode(flight.departure?.airport?.iata) === origin;
  const matchesDestination = (flight: AeroFlight) => airportCode(flight.arrival?.airport?.iata) === destination;
  return (
    flights.find((flight) => matchesOrigin(flight) && matchesDestination(flight)) ??
    flights.find(matchesOrigin) ??
    flights.find(matchesDestination) ??
    flights[0] ??
    null
  );
}

function normalizedFlight(match: AeroFlight, departureDate: string, origin = "", destination = ""): LiveFlightResult {
  const departureDelay = delayMinutes(match.departure);
  const arrivalDelay = delayMinutes(match.arrival);
  const delay = Math.max(departureDelay, arrivalDelay);
  const lastUpdatedUtc = isoUtcStamp(match.lastUpdatedUtc);

  return {
    status: normalizeStatus(match.status, delay),
    flight: {
      number: match.number?.trim() || "Flight",
      airline: match.airline?.name?.trim() || "Airline",
      origin: airportCode(match.departure?.airport?.iata) || origin,
      destination: airportCode(match.arrival?.airport?.iata) || destination,
      departureDate,
      departureTerminal: match.departure?.terminal?.trim() || "TBD",
      arrivalTerminal: match.arrival?.terminal?.trim() || "TBD",
      gate: match.departure?.gate?.trim() || "TBD",
      arrivalGate: match.arrival?.gate?.trim() || "TBD",
      scheduledDeparture: localClock(match.departure?.scheduledTime?.local),
      estimatedDeparture: localClock(preferredTime(match.departure)),
      scheduledArrival: localClock(match.arrival?.scheduledTime?.local),
      estimatedArrival: localClock(preferredTime(match.arrival)),
      delayMinutes: delay,
      baggageClaim: match.arrival?.baggageBelt?.trim() || "TBD",
      lastUpdated: "Live just now",
      lastUpdatedUtc,
      source: "AeroDataBox",
    },
  };
}

function providerHeaders(apiKey: string, apiHost: string): HeadersInit {
  return {
    "X-RapidAPI-Key": apiKey,
    "X-RapidAPI-Host": apiHost,
    Accept: "application/json",
  };
}

async function providerJson(url: URL, apiKey: string, apiHost: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchWithTimeout(url, { headers: providerHeaders(apiKey, apiHost) }, 12_000);
  } catch {
    throw new Error("unreachable");
  }
  if (response.status === 404 || response.status === 204) return null;
  if (response.status === 429) throw new Error("rate-limit");
  if (!response.ok) throw new Error(`provider-${response.status}`);
  return response.json();
}

async function searchAeroDataBox(query: SearchQuery, apiKey: string, apiHost: string): Promise<LiveFlightResult[]> {
  const { searchMode, flightNumber, departureDate, origin, destination } = query;

  if (searchMode === "route") {
    const windows = [["00:00", "12:00"], ["12:00", "23:59"]] as const;
    const departures: AeroFlight[] = [];
    for (const [index, [from, to]] of windows.entries()) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1100));
      const endpoint = new URL(`https://${apiHost}/flights/airports/iata/${origin}/${departureDate}T${from}/${departureDate}T${to}`);
      endpoint.searchParams.set("direction", "Departure");
      endpoint.searchParams.set("withLeg", "true");
      endpoint.searchParams.set("withLocation", "false");
      const data = (await providerJson(endpoint, apiKey, apiHost)) as AeroFids | null;
      departures.push(...(Array.isArray(data?.departures) ? data.departures : []));
    }
    return departures
      .filter((flight) => airportCode(flight.arrival?.airport?.iata) === destination)
      .filter((flight, index, all) => all.findIndex((item) => item.number === flight.number && item.departure?.scheduledTime?.local === flight.departure?.scheduledTime?.local) === index)
      .slice(0, ROUTE_RESULT_LIMIT)
      .map((flight) => normalizedFlight(flight, departureDate, origin, destination));
  }

  const endpoint = new URL(`https://${apiHost}/flights/number/${encodeURIComponent(flightNumber)}/${departureDate}`);
  endpoint.searchParams.set("dateLocalRole", "Departure");
  endpoint.searchParams.set("withAircraftImage", "false");
  endpoint.searchParams.set("withLocation", "false");
  const data = await providerJson(endpoint, apiKey, apiHost);
  const flights = Array.isArray(data) ? (data as AeroFlight[]) : [];
  const match = selectFlight(flights, origin, destination);
  return match ? [normalizedFlight(match, departureDate, origin, destination)] : [];
}

// --- AviationStack (secondary) -----------------------------------------------

function aviationDelayMinutes(movement?: AviationMovement | null): number {
  const raw = movement?.delay;
  const parsed = typeof raw === "string" ? Number(raw) : raw;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

/**
 * AviationStack's documented `flight_status` values are scheduled, active,
 * landed, cancelled, incident and diverted. Map them onto the vocabulary the
 * web and Android clients already render.
 */
function aviationNormalizeStatus(status: string | null | undefined, delay: number): string {
  const normalized = cleanText(status).toLowerCase();
  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("divert")) return "Diverted";
  if (normalized.includes("incident")) return "Incident";
  if (normalized.includes("land") || normalized.includes("arriv")) return "Landed";
  if (normalized === "active" || normalized.includes("en route") || normalized.includes("airborne") || normalized.includes("depart")) {
    return "Departed";
  }
  if (normalized.includes("board")) return "Boarding";
  if (delay > 0) return "Delayed";
  if (normalized.includes("sched") || normalized.includes("expected")) return "Scheduled";
  return cleanText(status) || "On time";
}

function aviationPreferredTime(movement?: AviationMovement | null): string | null {
  return (
    movement?.actual
    ?? movement?.actual_runway
    ?? movement?.estimated
    ?? movement?.estimated_runway
    ?? movement?.scheduled
    ?? null
  );
}

function aviationFlightNumber(entry: AviationFlight): string {
  return cleanText(entry.flight?.iata) || cleanText(entry.flight?.icao) || cleanText(entry.flight?.number) || "Flight";
}

function aviationSelectFlight(flights: AviationFlight[], origin: string, destination: string): AviationFlight | null {
  const matchesOrigin = (entry: AviationFlight) => airportCode(entry.departure?.iata) === origin;
  const matchesDestination = (entry: AviationFlight) => airportCode(entry.arrival?.iata) === destination;
  return (
    flights.find((entry) => matchesOrigin(entry) && matchesDestination(entry))
    ?? flights.find(matchesOrigin)
    ?? flights.find(matchesDestination)
    ?? flights[0]
    ?? null
  );
}

function aviationNormalizedFlight(entry: AviationFlight, departureDate: string, origin = "", destination = ""): LiveFlightResult {
  const delay = Math.max(aviationDelayMinutes(entry.departure), aviationDelayMinutes(entry.arrival));

  return {
    status: aviationNormalizeStatus(entry.flight_status, delay),
    flight: {
      number: aviationFlightNumber(entry),
      airline: cleanText(entry.airline?.name) || cleanText(entry.airline?.iata) || "Airline",
      origin: airportCode(entry.departure?.iata) || origin,
      destination: airportCode(entry.arrival?.iata) || destination,
      departureDate: cleanText(entry.flight_date) || departureDate,
      departureTerminal: cleanText(entry.departure?.terminal) || "TBD",
      arrivalTerminal: cleanText(entry.arrival?.terminal) || "TBD",
      gate: cleanText(entry.departure?.gate).toUpperCase() || "TBD",
      arrivalGate: cleanText(entry.arrival?.gate).toUpperCase() || "TBD",
      scheduledDeparture: localClock(entry.departure?.scheduled),
      estimatedDeparture: localClock(aviationPreferredTime(entry.departure)),
      scheduledArrival: localClock(entry.arrival?.scheduled),
      estimatedArrival: localClock(aviationPreferredTime(entry.arrival)),
      delayMinutes: delay,
      baggageClaim: cleanText(entry.arrival?.baggage) || "TBD",
      lastUpdated: "Live just now",
      lastUpdatedUtc: isoUtcStamp(entry.live?.updated),
      source: "AviationStack",
    },
  };
}

/**
 * AviationStack signals failure two ways: a non-2xx status, and a 200 carrying
 * an `error` object. Both are treated as errors so a plan restriction never
 * reads as "no flights found".
 */
async function aviationJson(url: URL): Promise<AviationFlight[]> {
  let response: Response;
  try {
    response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 12_000);
  } catch {
    throw new Error("unreachable");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`provider-${response.status}`);
  }

  const errorCode = cleanText((payload as { error?: { code?: string | null } })?.error?.code);
  if (errorCode || !response.ok) {
    if (errorCode === "function_access_restricted") throw new Error("plan-restricted");
    if (errorCode === "usage_limit_reached") throw new Error("quota");
    if (errorCode === "rate_limit_reached") throw new Error("rate-limit");
    if (errorCode === "invalid_access_key" || errorCode === "missing_access_key" || errorCode === "inactive_user") {
      throw new Error("bad-key");
    }
    if (response.status === 429) throw new Error("rate-limit");
    throw new Error(`provider-${response.status}`);
  }

  // Their published examples disagree on the collection key ("data" for most
  // endpoints, "results" in the /flights samples), so accept either.
  const source = payload as { data?: unknown; results?: unknown };
  const rows = Array.isArray(source?.data) ? source.data : Array.isArray(source?.results) ? source.results : [];
  return rows as AviationFlight[];
}

function aviationEndpoint(query: SearchQuery, accessKey: string, withDate: boolean): URL {
  const { searchMode, flightNumber, departureDate, origin, destination } = query;
  const endpoint = new URL(AVIATIONSTACK_BASE);
  endpoint.searchParams.set("access_key", accessKey);
  if (withDate) endpoint.searchParams.set("flight_date", departureDate);
  if (searchMode === "route") {
    endpoint.searchParams.set("dep_iata", origin);
    endpoint.searchParams.set("arr_iata", destination);
    endpoint.searchParams.set("limit", String(ROUTE_RESULT_LIMIT));
  } else {
    endpoint.searchParams.set("flight_iata", flightNumber);
  }
  return endpoint;
}

async function searchAviationStack(query: SearchQuery, accessKey: string): Promise<LiveFlightResult[]> {
  const { searchMode, departureDate, origin, destination } = query;

  let rows: AviationFlight[];
  try {
    rows = await aviationJson(aviationEndpoint(query, accessKey, true));
  } catch (error) {
    // Historical (date-scoped) lookups are Basic-and-above, so a Free key
    // answers `flight_date` with function_access_restricted. The undated
    // real-time endpoint is available on every plan, so retry against it and
    // narrow the window locally rather than giving up.
    if (error instanceof Error && error.message === "plan-restricted") {
      rows = await aviationJson(aviationEndpoint(query, accessKey, false));
    } else {
      throw error;
    }
  }

  // The undated endpoint returns several days in one payload, so drop anything
  // that is not the requested departure date. Entries without a flight_date are
  // kept rather than guessed away.
  const onDate = rows.filter((entry) => {
    const entryDate = cleanText(entry.flight_date);
    return !entryDate || entryDate === departureDate;
  });

  if (searchMode === "route") {
    return onDate.slice(0, ROUTE_RESULT_LIMIT).map((entry) => aviationNormalizedFlight(entry, departureDate, origin, destination));
  }
  const match = aviationSelectFlight(onDate, origin, destination);
  return match ? [aviationNormalizedFlight(match, departureDate, origin, destination)] : [];
}

// -----------------------------------------------------------------------------

function providerErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  if (message === "plan-restricted") {
    return json({ error: "This AviationStack plan does not allow looking up flights by date. The Free plan excludes historical flights; Basic or higher is required." }, 502);
  }
  if (message === "quota") {
    return json({ error: "The AviationStack monthly request quota has been used up." }, 429);
  }
  if (message === "bad-key") {
    return json({ error: "A live flight provider rejected its access key. Check the AERODATABOX_API_KEY and AVIATIONSTACK_API_KEY secrets." }, 502);
  }
  if (message === "rate-limit") {
    return json({ error: "Live flight data is being requested too quickly. Wait a moment and try again." }, 429);
  }
  if (message === "unreachable") {
    return json({ error: "Live flight data could not be reached. Try again shortly." }, 502);
  }
  const status = message.startsWith("provider-") ? message.slice("provider-".length) : "unknown";
  return json({ error: `A live flight provider returned an unexpected response (${status}).` }, 502);
}

async function requireFirebaseUser(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!token || !firebaseApiKey) return null;

  const response = await fetchWithTimeout(`${FIREBASE_LOOKUP_URL}?key=${encodeURIComponent(firebaseApiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  }, 8_000);
  if (!response.ok) return null;

  const data = (await response.json()) as { users?: Array<{ localId?: string }> };
  return data.users?.[0]?.localId ?? null;
}

export async function POST(request: Request): Promise<Response> {
  let uid: string | null;
  try {
    uid = await requireFirebaseUser(request);
  } catch {
    return json({ error: "Firebase authentication could not be verified right now." }, 503);
  }
  if (!uid) return json({ error: "Sign in to JourneySync before refreshing live flight data." }, 401);

  let body: FlightRequest;
  try {
    body = (await request.json()) as FlightRequest;
  } catch {
    return json({ error: "The flight request was not valid JSON." }, 400);
  }

  const flightNumber = typeof body.flightNumber === "string" ? normalizeFlightNumber(body.flightNumber) : "";
  const departureDate = typeof body.departureDate === "string" ? body.departureDate.trim() : "";
  const origin = airportCode(body.origin);
  const destination = airportCode(body.destination);
  const searchMode: SearchMode = body.searchMode === "route" ? "route" : "number";

  if (searchMode === "number" && !/^[A-Z0-9]{2,8}$/.test(flightNumber)) {
    return json({ error: "Enter a valid airline flight number, such as AA100." }, 400);
  }
  if (!validDate(departureDate)) {
    return json({ error: "Choose the flight's local departure date." }, 400);
  }
  if (searchMode === "route" && (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination))) {
    return json({ error: "Origin and destination must be three-letter airport codes." }, 400);
  }
  if (searchMode === "number" && ((origin && !/^[A-Z]{3}$/.test(origin)) || (destination && !/^[A-Z]{3}$/.test(destination)))) {
    return json({ error: "Airport codes must contain three letters." }, 400);
  }

  const aeroKey = process.env.AERODATABOX_API_KEY;
  const aeroHost = process.env.AERODATABOX_API_HOST || DEFAULT_AERODATABOX_HOST;
  const aviationKey = process.env.AVIATIONSTACK_API_KEY;
  if (!aeroKey && !aviationKey) {
    return json({ error: "Live flight tracking is not configured on this server yet." }, 503);
  }

  const query: SearchQuery = { searchMode, flightNumber, departureDate, origin, destination };
  let results: LiveFlightResult[] = [];
  let primaryError: unknown = null;

  if (aeroKey) {
    try {
      results = await searchAeroDataBox(query, aeroKey, aeroHost);
    } catch (error) {
      primaryError = error;
    }
  }

  // Secondary runs when the primary errored or simply had no record.
  if (results.length === 0 && aviationKey) {
    try {
      results = await searchAviationStack(query, aviationKey);
    } catch (error) {
      if (!primaryError) primaryError = error;
    }
  }

  if (results.length === 0) {
    // Surface a provider failure ahead of "not found", so a misconfigured key
    // or exhausted quota never masquerades as a missing flight.
    if (primaryError) return providerErrorResponse(primaryError);
    return searchMode === "route"
      ? json({ error: `No ${origin} to ${destination} flights were found on ${departureDate}.` }, 404)
      : json({ error: `No live record was found for ${flightNumber} on ${departureDate}.` }, 404);
  }

  const source = results[0].flight.source;
  if (searchMode === "route") {
    return json({ uid, searchMode, flights: results, source });
  }
  return json({ uid, searchMode, ...results[0] });
}
