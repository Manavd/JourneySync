export const dynamic = "force-dynamic";

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

const DEFAULT_AERODATABOX_HOST = "aerodatabox.p.rapidapi.com";
const FIREBASE_LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

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

function localClock(value?: string | null): string {
  if (!value) return "TBD";
  const match = value.match(/(?:^|\s)(\d{2}):(\d{2})/);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${suffix}`;
}

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

function normalizedFlight(match: AeroFlight, departureDate: string, origin = "", destination = "") {
  const departureDelay = delayMinutes(match.departure);
  const arrivalDelay = delayMinutes(match.arrival);
  const delay = Math.max(departureDelay, arrivalDelay);
  const lastUpdatedUtc = match.lastUpdatedUtc || new Date().toISOString();

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
    response = await fetch(url, { headers: providerHeaders(apiKey, apiHost) });
  } catch {
    throw new Error("unreachable");
  }
  if (response.status === 404 || response.status === 204) return null;
  if (response.status === 429) throw new Error("rate-limit");
  if (!response.ok) throw new Error(`provider-${response.status}`);
  return response.json();
}

async function requireFirebaseUser(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!token || !firebaseApiKey) return null;

  const response = await fetch(`${FIREBASE_LOOKUP_URL}?key=${encodeURIComponent(firebaseApiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
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
  const searchMode = body.searchMode === "route" ? "route" : "number";

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

  const apiKey = process.env.AERODATABOX_API_KEY;
  const apiHost = process.env.AERODATABOX_API_HOST || DEFAULT_AERODATABOX_HOST;
  if (!apiKey) return json({ error: "Live flight tracking is not configured on this server yet." }, 503);

  try {
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
      const matches = departures
        .filter((flight) => airportCode(flight.arrival?.airport?.iata) === destination)
        .filter((flight, index, all) => all.findIndex((item) => item.number === flight.number && item.departure?.scheduledTime?.local === flight.departure?.scheduledTime?.local) === index)
        .slice(0, 20)
        .map((flight) => normalizedFlight(flight, departureDate, origin, destination));
      if (matches.length === 0) return json({ error: `No ${origin} to ${destination} flights were found on ${departureDate}.` }, 404);
      return json({ uid, searchMode, flights: matches, source: "AeroDataBox" });
    }

    const endpoint = new URL(`https://${apiHost}/flights/number/${encodeURIComponent(flightNumber)}/${departureDate}`);
    endpoint.searchParams.set("dateLocalRole", "Departure");
    endpoint.searchParams.set("withAircraftImage", "false");
    endpoint.searchParams.set("withLocation", "false");
    const data = await providerJson(endpoint, apiKey, apiHost);
    const flights = Array.isArray(data) ? (data as AeroFlight[]) : [];
    const match = selectFlight(flights, origin, destination);
    if (!match) return json({ error: `No live record was found for ${flightNumber} on ${departureDate}.` }, 404);
    return json({ uid, searchMode, ...normalizedFlight(match, departureDate, origin, destination) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "rate-limit") return json({ error: "AeroDataBox is receiving searches too quickly. Wait a moment and try again." }, 429);
    if (message === "unreachable") return json({ error: "AeroDataBox could not be reached. Try again shortly." }, 502);
    const status = message.startsWith("provider-") ? message.slice("provider-".length) : "unknown";
    return json({ error: `AeroDataBox returned an unexpected response (${status}).` }, 502);
  }
}
