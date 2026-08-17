"use client";

import { FormEvent, useMemo, useState, useEffect, useRef } from "react";
import {
  auth, 
  db, 
  googleProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  doc,
  setDoc,
  onSnapshot,
  getIdToken,
  User 
} from "./firebase";
import {
  COMMON_CURRENCIES,
  TRIP_COUNTRIES,
  countryByCode,
  currencyForCountry,
  inferCountryCode,
  regionByCode,
} from "./location-data";
import TripMap from "./TripMap";

type FlightInfo = {
  number: string;
  airline: string;
  origin: string;
  destination: string;
  departureDate?: string;
  departureTerminal: string;
  arrivalTerminal: string;
  gate: string;
  arrivalGate?: string;
  scheduledDeparture: string;
  estimatedDeparture: string;
  scheduledArrival: string;
  estimatedArrival: string;
  delayMinutes: number;
  baggageClaim: string;
  lastUpdated: string;
  lastUpdatedUtc?: string;
  source?: string;
};

type DayEvent = {
  id?: string;
  time: string;
  title: string;
  meta: string;
  kind: "flight" | "stay" | "food" | "train" | "activity";
  status?: string;
  flight?: FlightInfo;
};

type GuestFlight = {
  id: string;
  guestName: string;
  note: string;
  status: string;
  flight: FlightInfo;
};

type LiveFlightUpdate = {
  status: string;
  flight: FlightInfo;
};

type LiveFlightSearchResponse = Partial<LiveFlightUpdate> & {
  flights?: LiveFlightUpdate[];
  error?: string;
};

type Day = {
  id?: string;
  isoDate?: string;
  date: string;
  short: string;
  label: string;
  events: DayEvent[];
};

type Expense = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  paidBy: string;
  date: string;
  category: string;
  settled?: boolean;
};

type Traveler = {
  name: string;
  role: string;
  email: string;
  avatar: string;
  bg: string;
};

type MapPin = {
  name: string;
  code: string;
  desc: string;
  temp: string;
  savedOffline?: boolean;
  latitude?: number;
  longitude?: number;
};

type WalletDoc = {
  id: string;
  title: string;
  meta: string;
  code: string;
  icon: string;
  coralIcon?: boolean;
};

type Trip = {
  id: string;
  name: string;
  route: string;
  startDate: string;
  endDate?: string;
  travelersCount: number;
  days: Day[];
  expenses: Expense[];
  walletDocs: WalletDoc[];
  mapPins: MapPin[];
  travelersList: Traveler[];
  guestFlights?: GuestFlight[];
  countryCode?: string;
  country?: string;
  regionCode?: string;
  region?: string;
  city?: string;
  currency?: string;
  archivedAt?: string;
};

type WeatherDay = {
  day: string;
  temp: string;
  high: string;
  low: string;
  desc: string;
  rain: string;
  icon: string;
};

type WeatherForecast = {
  destination: string;
  region: string;
  country: string;
  days: WeatherDay[];
  source?: string;
  latitude?: number;
  longitude?: number;
};

type TripCache = {
  savedTrips: Trip[];
  activeTripId: string;
  updatedAt: number;
};

/** Nominatim's usage policy allows at most one request per second. */
const MAP_GEOCODE_INTERVAL_MS = 1100;

// Firestore rejects any document larger than 1 MiB. The entire profile is a
// single document, so once a trip library crosses that line every subsequent
// write fails identically: the catch below logs to the console and the badge
// stays unsynced forever, with nothing telling the traveler why or which trip
// to trim. Checking first turns that into one actionable message. The budget
// leaves headroom for field names and Firestore's own encoding overhead, which
// the serialized payload does not account for.
const PROFILE_PAYLOAD_BUDGET_BYTES = 900_000;

function payloadByteLength(payload: string): number {
  return new TextEncoder().encode(payload).length;
}

const EMPTY_DAYS: Day[] = [];
const EMPTY_EXPENSES: Expense[] = [];
const EMPTY_WALLET_DOCS: WalletDoc[] = [];
const EMPTY_MAP_PINS: MapPin[] = [];
const EMPTY_TRAVELERS: Traveler[] = [];
const EMPTY_GUEST_FLIGHTS: GuestFlight[] = [];

function localTripsKey(uid: string) {
  return `journeysync_trips_${uid}`;
}

function readLocalTrips(uid: string): TripCache | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(localTripsKey(uid));
    if (!cached) return null;
    const parsed = JSON.parse(cached) as Partial<TripCache>;
    if (parsed && Array.isArray(parsed.savedTrips)) {
      return {
        savedTrips: parsed.savedTrips,
        activeTripId: typeof parsed.activeTripId === "string" ? parsed.activeTripId : "",
        updatedAt: timestampMillis(parsed.updatedAt),
      };
    }
  } catch { /* ignore corrupt cache */ }
  return null;
}

function writeLocalTrips(uid: string, cache: TripCache) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(localTripsKey(uid), JSON.stringify(cache));
  } catch { /* ignore quota errors */ }
}

function timestampMillis(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function normalizeTripCache(savedTrips: Trip[], activeTripId: string, updatedAt = 0): TripCache {
  const validActive = savedTrips.some((trip) => trip.id === activeTripId)
    ? activeTripId
    : (savedTrips[0]?.id ?? "");
  return { savedTrips, activeTripId: validActive, updatedAt };
}

function tripsFromCloud(data: Record<string, unknown> | undefined): TripCache {
  const savedTrips = data && Array.isArray(data.savedTrips) ? (data.savedTrips as Trip[]) : [];
  const activeTripId = data && typeof data.activeTripId === "string" ? data.activeTripId : "";
  return normalizeTripCache(savedTrips, activeTripId, timestampMillis(data?.updatedAt));
}

function tripCachePayload(cache: TripCache): string {
  return JSON.stringify({ savedTrips: cache.savedTrips, activeTripId: cache.activeTripId });
}

const iconFor = {
  flight: "✈",
  stay: "⌂",
  food: "◆",
  train: "↗",
  activity: "◎",
};

/** Convert 24h "HH:MM" from <input type="time"> to "h:MM AM/PM" display format */
function formatTime(raw: string): string {
  if (!raw) return "12:00 PM";
  // Already in 12h format (has AM/PM)
  if (/am|pm/i.test(raw)) return raw;
  const parts = raw.split(":");
  if (parts.length < 2) return raw;
  let h = parseInt(parts[0], 10);
  const m = parts[1].padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

function formatTripStartDate(startDate: string): string {
  if (!startDate) return "Dates not set";
  const date = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Dates not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function tripEndDate(trip: Trip): Date | null {
  if (!trip.startDate) return null;
  const start = new Date(`${trip.startDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const savedEnd = trip.endDate ? new Date(`${trip.endDate}T12:00:00`) : null;
  const configuredEnd = savedEnd && !Number.isNaN(savedEnd.getTime()) ? savedEnd : start;
  const dayDates = trip.days.map((day, index) => {
    if (day.isoDate) {
      const savedDate = new Date(`${day.isoDate}T12:00:00`);
      if (!Number.isNaN(savedDate.getTime())) return savedDate;
    }
    const fallback = new Date(start);
    fallback.setDate(fallback.getDate() + index);
    return fallback;
  });
  return dayDates.reduce((latest, date) => date.getTime() > latest.getTime() ? date : latest, configuredEnd);
}

function isTripCompleted(trip: Trip, now = new Date()): boolean {
  const end = tripEndDate(trip);
  if (!end) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return end.getTime() < today.getTime();
}

function activeTripStatus(trip: Trip): "Active" | "Upcoming" {
  if (!trip.startDate) return "Active";
  const start = new Date(`${trip.startDate}T12:00:00`);
  return !Number.isNaN(start.getTime()) && start.getTime() > Date.now() ? "Upcoming" : "Active";
}

function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();

  if (normalized.includes("auth/invalid-credential") || normalized.includes("invalid_login_credentials")) {
    return "That email or password is incorrect. Check both fields and try again.";
  }
  if (normalized.includes("auth/user-not-found")) {
    return "No JourneySync account exists for that email. Choose Register to create one.";
  }
  if (normalized.includes("auth/wrong-password")) {
    return "That password is incorrect. Please try again.";
  }
  if (normalized.includes("auth/email-already-in-use")) {
    return "An account already exists for that email. Choose Sign In instead.";
  }
  if (normalized.includes("auth/weak-password")) {
    return "Choose a stronger password with at least six characters.";
  }
  if (normalized.includes("auth/invalid-email")) {
    return "Enter a valid email address.";
  }
  if (normalized.includes("auth/too-many-requests")) {
    return "Firebase temporarily blocked more attempts. Wait a moment, then try again.";
  }
  if (normalized.includes("auth/popup-closed-by-user") || normalized.includes("auth/cancelled-popup-request")) {
    return "Google sign-in was cancelled before it finished.";
  }
  if (normalized.includes("auth/popup-blocked")) {
    return "The Google sign-in window was blocked. Allow popups for this site and try again.";
  }
  if (normalized.includes("auth/unauthorized-domain")) {
    return "Google sign-in is not authorized for this site domain in Firebase yet.";
  }
  if (normalized.includes("firebase configuration") || normalized.includes("firebase initialization")) {
    return message;
  }

  return "Firebase could not sign you in. Please try again.";
}

function friendlyFlightError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Live flight data could not be refreshed. Try again shortly.";
}

function locationFromForm(form: FormData) {
  const countryCode = String(form.get("countryCode") || "US");
  const selectedCountry = countryByCode(countryCode);
  const country = countryCode === "OTHER"
    ? String(form.get("customCountry") || "Other country").trim()
    : selectedCountry?.name || "United States";
  const regionCode = String(form.get("regionCode") || "");
  const selectedRegion = regionByCode(countryCode, regionCode);
  const region = regionCode === "OTHER"
    ? String(form.get("customRegion") || "").trim()
    : selectedRegion?.name || "";
  const cityChoice = String(form.get("city") || "");
  const city = cityChoice === "OTHER"
    ? String(form.get("customCity") || "").trim()
    : cityChoice.trim();
  const currency = countryCode === "OTHER"
    ? String(form.get("currency") || "USD")
    : currencyForCountry(countryCode);

  return { countryCode, country, regionCode, region, city, currency };
}

function TripLocationFields({
  defaultCountryCode = "US",
  defaultCountry = "",
  defaultRegionCode = "",
  defaultRegion = "",
  defaultCity = "",
  defaultCurrency = "USD",
}: {
  defaultCountryCode?: string;
  defaultCountry?: string;
  defaultRegionCode?: string;
  defaultRegion?: string;
  defaultCity?: string;
  defaultCurrency?: string;
}) {
  const knownCountry = countryByCode(defaultCountryCode);
  const initialCountryCode = knownCountry ? defaultCountryCode : defaultCountry ? "OTHER" : "US";
  const [countryCode, setCountryCode] = useState(initialCountryCode);
  const initialCountry = countryByCode(initialCountryCode);
  const knownRegion = initialCountry?.regions.some((region) => region.code === defaultRegionCode);
  const [regionCode, setRegionCode] = useState(knownRegion ? defaultRegionCode : defaultRegion ? "OTHER" : "");
  const initialRegion = regionByCode(initialCountryCode, knownRegion ? defaultRegionCode : "");
  const [city, setCity] = useState(defaultCity && initialRegion?.cities.includes(defaultCity) ? defaultCity : defaultCity ? "OTHER" : "");
  const country = countryByCode(countryCode);
  const region = regionByCode(countryCode, regionCode);
  const cityIsCustom = city === "OTHER";

  return (
    <fieldset className="location-fields">
      <legend>Trip location</legend>
      <label>Country
        <select
          name="countryCode"
          value={countryCode}
          onChange={(event) => {
            setCountryCode(event.target.value);
            setRegionCode("");
            setCity("");
          }}
          required
        >
          {TRIP_COUNTRIES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
          <option value="OTHER">Other country</option>
        </select>
      </label>

      {countryCode === "OTHER" ? (
        <>
          <label>Country name<input name="customCountry" defaultValue={defaultCountry} placeholder="Enter country" required /></label>
          <label>State or region<input name="customRegion" defaultValue={defaultRegion} placeholder="Enter state or region" required /></label>
          <input type="hidden" name="regionCode" value="OTHER" />
          <label>City<input name="customCity" defaultValue={defaultCity} placeholder="Enter city" required /></label>
          <input type="hidden" name="city" value="OTHER" />
          <label>Trip currency
            <select name="currency" defaultValue={defaultCurrency}>
              {COMMON_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
        </>
      ) : (
        <>
          <label>{country?.regionLabel || "State or region"}
            <select
              name="regionCode"
              value={regionCode}
              onChange={(event) => {
                setRegionCode(event.target.value);
                setCity("");
              }}
              required
            >
              <option value="">Choose {country?.regionLabel.toLocaleLowerCase() || "state or region"}</option>
              {country?.regions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              <option value="OTHER">Other {country?.regionLabel.toLocaleLowerCase() || "state or region"}</option>
            </select>
          </label>

          {regionCode === "OTHER" ? (
            <label>State or region name<input name="customRegion" defaultValue={defaultRegion} placeholder="Enter state or region" required /></label>
          ) : null}

          <label>City
            <select name="city" value={regionCode === "OTHER" || cityIsCustom ? "OTHER" : city} onChange={(event) => setCity(event.target.value)} disabled={!regionCode} required>
              <option value="">{regionCode ? "Choose city" : "Choose a state or region first"}</option>
              {region?.cities.map((item) => <option key={item} value={item}>{item}</option>)}
              {regionCode ? <option value="OTHER">Other city</option> : null}
            </select>
          </label>

          {cityIsCustom || regionCode === "OTHER" ? (
            <label>City name<input name="customCity" defaultValue={defaultCity} placeholder="Enter city" required /></label>
          ) : null}

          <input type="hidden" name="currency" value={country?.currency || "USD"} />
          <p className="location-currency">Expenses will use <strong>{country?.currency || "USD"}</strong>.</p>
        </>
      )}
    </fieldset>
  );
}

function TripDateFields({ defaultStart = "", defaultEnd = "" }: { defaultStart?: string; defaultEnd?: string }) {
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  return (
    <div className="form-row trip-date-fields">
      <label>Start date
        <input
          name="start"
          type="date"
          value={startDate}
          onChange={(event) => {
            const nextStart = event.target.value;
            setStartDate(nextStart);
            if (endDate && endDate < nextStart) setEndDate(nextStart);
          }}
          required
        />
      </label>
      <label>End date
        <input name="end" type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
      </label>
    </div>
  );
}

function DeleteTripDialog({ trip, onCancel, onConfirm }: {
  trip: Trip;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const confirmed = confirmation.trim().toUpperCase() === "DELETE";

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <section className="modal delete-trip-modal" onMouseDown={(event) => event.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="delete-trip-title">
        <button className="modal-close" type="button" onClick={onCancel} aria-label="Close permanent delete dialog">×</button>
        <span className="eyebrow">PERMANENT DELETE</span>
        <h2 id="delete-trip-title">Delete {trip.name}?</h2>
        <p className="modal-copy">This removes the itinerary, expenses, flights, travelers, map pins, and wallet items from your Firebase profile. It cannot be restored.</p>
        <label>Type DELETE to confirm
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoFocus autoComplete="off" />
        </label>
        <button className="danger-action" type="button" disabled={!confirmed} onClick={onConfirm}>Delete trip permanently</button>
        <button className="secondary-action" type="button" onClick={onCancel}>Keep trip</button>
      </section>
    </div>
  );
}

export default function Home() {
  // Navigation & User State
  const [activeNav, setActiveNav] = useState("Itinerary");
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [offlineCachedAt, setOfflineCachedAt] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  const activeUidRef = useRef<string | null>(null);
  const baselineRef = useRef<{ uid: string; payload: string; updatedAt: number } | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncGenerationRef = useRef(0);

  // App Data State - Multi-Trip Architecture
  const [savedTrips, setSavedTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState("");
  const [appView, setAppView] = useState<"trips" | "trip">("trips");
  const [libraryFilter, setLibraryFilter] = useState<"active" | "archived">("active");
  const [pendingDeleteTripId, setPendingDeleteTripId] = useState<string | null>(null);

  const activeTrips = useMemo(() => savedTrips
    .filter((trip) => !trip.archivedAt && !isTripCompleted(trip))
    .sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999")), [savedTrips]);
  const archivedTrips = useMemo(() => savedTrips
    .filter((trip) => !!trip.archivedAt || isTripCompleted(trip))
    .sort((a, b) => {
      const aDate = a.archivedAt || tripEndDate(a)?.toISOString() || "";
      const bDate = b.archivedAt || tripEndDate(b)?.toISOString() || "";
      return bDate.localeCompare(aDate);
    }), [savedTrips]);
  const visibleTrips = libraryFilter === "active" ? activeTrips : archivedTrips;
  const pendingDeleteTrip = pendingDeleteTripId ? savedTrips.find((trip) => trip.id === pendingDeleteTripId) || null : null;

  const activeTrip = useMemo(() => {
    if (savedTrips.length === 0) return null;
    return savedTrips.find((t) => t.id === activeTripId) || savedTrips[0] || null;
  }, [savedTrips, activeTripId]);

  const hasActiveTrip = activeTrip !== null;

  const tripName = activeTrip?.name ?? "No trip selected";
  const tripRoute = activeTrip?.route ?? "";
  const tripTravelers = activeTrip?.travelersCount ?? 0;
  const itineraryDays = activeTrip?.days ?? EMPTY_DAYS;
  const expenses = activeTrip?.expenses ?? EMPTY_EXPENSES;
  const walletDocs = activeTrip?.walletDocs ?? EMPTY_WALLET_DOCS;
  const mapPins = activeTrip?.mapPins ?? EMPTY_MAP_PINS;
  const mapPoints = useMemo(() => mapPins.map((pin) => ({
    name: pin.name,
    code: pin.code,
    description: pin.desc,
    latitude: pin.latitude,
    longitude: pin.longitude,
  })), [mapPins]);
  const travelersList = activeTrip?.travelersList ?? EMPTY_TRAVELERS;
  const guestFlights = activeTrip?.guestFlights ?? EMPTY_GUEST_FLIGHTS;
  const inferredCountryCode = useMemo(() => {
    if (activeTrip?.countryCode) return activeTrip.countryCode;
    const locationText = [activeTrip?.route, activeTrip?.name, ...(activeTrip?.mapPins ?? []).map((pin) => pin.name)].filter(Boolean).join(" ");
    return inferCountryCode(locationText) || "US";
  }, [activeTrip]);
  const tripCurrency = activeTrip?.currency || currencyForCountry(inferredCountryCode);
  const tripCity = activeTrip?.city || mapPins[0]?.name || tripRoute.split(/→|->|,/)[0]?.trim() || "";
  const tripRegion = activeTrip?.region || "";
  const tripCountry = activeTrip?.country || countryByCode(inferredCountryCode)?.name || "";

  const [activeDay, setActiveDay] = useState(0);

  function updateActiveTrip(updater: (currentTrip: Trip) => Trip) {
    if (!activeTrip) return;
    setSavedTrips((prevTrips) =>
      prevTrips.map((trip) => {
        if (trip.id === activeTrip.id) {
          return updater(trip);
        }
        return trip;
      })
    );
  }

  // Status & Modals
  const [synced, setSynced] = useState(true);
  const [toast, setToast] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState<"trip" | "trip-settings" | "day" | "item" | "edit-item" | "edit-day" | "expense" | "pass" | "flight" | "flight-edit" | "track-flight" | "guest-flight" | "weather" | "travelers" | "trip-switcher" | "map-pin" | "settle" | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DayEvent | null>(null);
  const [selectedGuestFlight, setSelectedGuestFlight] = useState<GuestFlight | null>(null);
  const [liveUpdating, setLiveUpdating] = useState<string | null>(null);
  const [flightSearchMode, setFlightSearchMode] = useState<"route" | "number">("route");
  const [flightSearchResults, setFlightSearchResults] = useState<LiveFlightUpdate[]>([]);
  const [flightSearchBusy, setFlightSearchBusy] = useState(false);
  const [flightSearchError, setFlightSearchError] = useState("");
  const [dayDropdownOpen, setDayDropdownOpen] = useState(false);
  const [selectedMapPin, setSelectedMapPin] = useState<string>("");
  const [weatherForecast, setWeatherForecast] = useState<WeatherForecast | null>(null);
  const [weatherLocationKey, setWeatherLocationKey] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const mapGeocodeAttemptsRef = useRef(new Set<string>());
  const lastMapGeocodeAtRef = useRef(0);

  // Auth Listener & Firestore Sync
  useEffect(() => {
    let unsubscribeCloud = () => {};
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      unsubscribeCloud();
      unsubscribeCloud = () => {};

      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      syncGenerationRef.current += 1;

      const nextUid = currentUser?.uid ?? null;
      activeUidRef.current = nextUid;

      setCloudReady(false);
      setSynced(true);
      setOfflineCachedAt(null);
      setProfileReady(false);
      baselineRef.current = null;
      setUser(currentUser);
      setAuthChecking(false);

      if (!currentUser) {
        setSavedTrips([]);
        setActiveTripId("");
        setActiveDay(0);
        setAppView("trips");
        return;
      }

      setAuthError("");
      const uid = currentUser.uid;
      const cached = readLocalTrips(uid);
      if (cached) {
        const normalizedCache = normalizeTripCache(cached.savedTrips, cached.activeTripId, cached.updatedAt);
        baselineRef.current = { uid, payload: tripCachePayload(normalizedCache), updatedAt: normalizedCache.updatedAt };
        setSavedTrips(normalizedCache.savedTrips);
        setActiveTripId(normalizedCache.activeTripId);
        setOfflineCachedAt(normalizedCache.updatedAt > 0 ? new Date(normalizedCache.updatedAt).toISOString() : null);
        setProfileReady(true);
      } else {
        setSavedTrips([]);
        setActiveTripId("");
      }

      const docRef = doc(db, "users", uid, "user_trips", "all_trips");
      unsubscribeCloud = onSnapshot(docRef, (snap) => {
        if (activeUidRef.current !== uid) return;
        const cloud = tripsFromCloud(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined);
        const latestLocal = readLocalTrips(uid);
        const selected = latestLocal && latestLocal.updatedAt > cloud.updatedAt ? latestLocal : cloud;
        const cloudPayload = tripCachePayload(cloud);
        const selectedPayload = tripCachePayload(selected);

        // Keep the cloud payload as the comparison baseline. If a newer device
        // copy won, the sync effect below sees the difference and uploads it.
        baselineRef.current = { uid, payload: cloudPayload, updatedAt: cloud.updatedAt };
        setSavedTrips(selected.savedTrips);
        setActiveTripId(selected.activeTripId);
        setActiveDay(0);
        writeLocalTrips(uid, selected);
        setProfileReady(true);
        setCloudReady(true);
        setSynced(selectedPayload === cloudPayload);
        setOfflineCachedAt(selected.updatedAt > 0 ? new Date(selected.updatedAt).toISOString() : null);
      }, (error) => {
        if (activeUidRef.current !== uid) return;
        console.error("Could not load Firestore trip data:", error);
        setSynced(false);
        setCloudReady(false);
        const latestLocal = readLocalTrips(uid);
        if (latestLocal) {
          baselineRef.current = { uid, payload: tripCachePayload(latestLocal), updatedAt: latestLocal.updatedAt };
          setSavedTrips(latestLocal.savedTrips);
          setActiveTripId(latestLocal.activeTripId);
          setOfflineCachedAt(latestLocal.updatedAt > 0 ? new Date(latestLocal.updatedAt).toISOString() : null);
        } else {
          const empty = normalizeTripCache([], "");
          baselineRef.current = { uid, payload: tripCachePayload(empty), updatedAt: 0 };
          setSavedTrips([]);
          setActiveTripId("");
        }
        setProfileReady(true);
        notify("Cloud data could not load. Device changes will stay saved and sync when Firebase reconnects.");
      });
    });
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      unsubscribeCloud();
      unsubscribe();
    };
  }, []);

  // Persist signed-in changes to an account-specific device cache immediately,
  // then debounce the whole-profile Firestore write to avoid stale write races.
  useEffect(() => {
    if (!user || !profileReady) return;

    const normalized = normalizeTripCache(savedTrips, activeTripId);
    const payload = tripCachePayload(normalized);
    const baseline = baselineRef.current;
    if (baseline?.uid === user.uid && baseline.payload === payload) return;

    const cache = { ...normalized, updatedAt: Date.now() };
    baselineRef.current = { uid: user.uid, payload, updatedAt: cache.updatedAt };
    writeLocalTrips(user.uid, cache);
    const cachedAt = new Date(cache.updatedAt).toISOString();

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    const generation = ++syncGenerationRef.current;

    if (!cloudReady) {
      syncTimerRef.current = setTimeout(() => {
        if (activeUidRef.current === user.uid && syncGenerationRef.current === generation) {
          setOfflineCachedAt(cachedAt);
          setSynced(false);
        }
      }, 0);
    } else {
      syncTimerRef.current = setTimeout(async () => {
        if (activeUidRef.current === user.uid && syncGenerationRef.current === generation) {
          setOfflineCachedAt(cachedAt);
          setSynced(false);
        }
        const payloadBytes = payloadByteLength(payload);
        if (payloadBytes > PROFILE_PAYLOAD_BUDGET_BYTES) {
          if (activeUidRef.current === user.uid && syncGenerationRef.current === generation) {
            setSynced(false);
            notify(
              `This trip library is too large to sync (${Math.round(payloadBytes / 1024)} KB of a 1 MB limit). ` +
              "Changes stay on this device. Archive or delete a trip to resume syncing.",
            );
          }
          return;
        }

        try {
          const docRef = doc(db, "users", user.uid, "user_trips", "all_trips");
          await setDoc(docRef, {
            savedTrips: cache.savedTrips,
            activeTripId: cache.activeTripId,
            updatedAt: cache.updatedAt,
          }, { merge: true });
          if (activeUidRef.current === user.uid && syncGenerationRef.current === generation) {
            setSynced(true);
          }
        } catch (e) {
          console.error("Firestore sync error:", e);
          if (activeUidRef.current === user.uid && syncGenerationRef.current === generation) {
            setSynced(false);
          }
        }
      }, 250);
    }

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [user, profileReady, cloudReady, savedTrips, activeTripId]);

  const day = useMemo(() => itineraryDays[activeDay] || itineraryDays[0] || { date: "12", short: "SAT", label: "Day 1", events: [] }, [activeDay, itineraryDays]);

  const totalExpenseAmount = useMemo(() => {
    return expenses.reduce((sum, item) => sum + item.amount, 0);
  }, [expenses]);

  const activeUnsettledAmount = useMemo(() => {
    return expenses.filter(e => !e.settled).reduce((sum, item) => sum + item.amount, 0);
  }, [expenses]);

  // Compute per-person expense balances dynamically
  const expenseBalances = useMemo(() => {
    const unsettled = expenses.filter(e => !e.settled);
    const perPerson = activeUnsettledAmount / Math.max(travelersList.length, 1);
    return travelersList.map((t) => {
      const paid = unsettled.filter(e => e.paidBy === t.name).reduce((a, b) => a + b.amount, 0);
      const totalPaidEver = expenses.filter(e => e.paidBy === t.name).reduce((a, b) => a + b.amount, 0);
      const balance = paid - perPerson;
      return { ...t, paid: totalPaidEver, balance };
    });
  }, [expenses, activeUnsettledAmount, travelersList]);

  // Compute trip date range from itinerary data and start date
  const tripDateRange = useMemo(() => {
    const startObj = new Date(activeTrip?.startDate ? `${activeTrip.startDate}T12:00:00` : Date.now());
    const itineraryDates = itineraryDays.map((tripDay, index) => {
      if (tripDay.isoDate) {
        const savedDate = new Date(`${tripDay.isoDate}T12:00:00`);
        if (!Number.isNaN(savedDate.getTime())) return savedDate;
      }
      const fallback = new Date(startObj);
      fallback.setDate(fallback.getDate() + index);
      return fallback;
    });
    const savedEnd = activeTrip?.endDate ? new Date(`${activeTrip.endDate}T12:00:00`) : null;
    const validDates = [
      startObj,
      ...itineraryDates,
      ...(savedEnd && !Number.isNaN(savedEnd.getTime()) ? [savedEnd] : []),
    ].sort((a, b) => a.getTime() - b.getTime());
    const first = validDates[0] || startObj;
    const last = validDates[validDates.length - 1] || startObj;
    const month = (date: Date) => new Intl.DateTimeFormat("en-US", { month: "long" }).format(date).toUpperCase();
    return {
      startDate: String(first.getDate()).padStart(2, "0"),
      endDate: String(last.getDate()).padStart(2, "0"),
      startMonth: month(first),
      endMonth: month(last),
      startYear: String(first.getFullYear()),
      endYear: String(last.getFullYear()),
    };
  }, [itineraryDays, activeTrip?.startDate, activeTrip?.endDate]);

  // Weather is fetched fresh for the trip's saved city instead of being generated
  // from placeholder temperatures. The API route also sends no-store headers.
  const requestedWeatherKey = [activeTrip?.id, tripCity, tripRegion, tripCountry, inferredCountryCode].join("|");
  useEffect(() => {
    if (!activeTrip?.id || !tripCity) return;

    const controller = new AbortController();
    const query = new URLSearchParams({
      city: tripCity,
      region: tripRegion,
      country: tripCountry,
      countryCode: inferredCountryCode,
    });
    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        setWeatherLoading(true);
        setWeatherError("");
        return fetch(`/api/weather?${query.toString()}`, { cache: "no-store", signal: controller.signal });
      })
      .then(async (response) => {
        const body = await response.json() as WeatherForecast & { error?: string };
        if (!response.ok) throw new Error(body.error || "Weather is unavailable.");
        return body;
      })
      .then((forecast) => {
        setWeatherForecast(forecast);
        setWeatherLocationKey(requestedWeatherKey);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setWeatherForecast(null);
        setWeatherLocationKey(requestedWeatherKey);
        setWeatherError(error instanceof Error ? error.message : "Weather is unavailable.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setWeatherLoading(false);
      });

    return () => controller.abort();
  }, [activeTrip?.id, tripCity, tripRegion, tripCountry, inferredCountryCode, requestedWeatherKey]);

  // Older saved pins predate coordinate storage. Resolve them one at a time
  // when the map is opened, then let the normal profile sync persist them.
  //
  // Storing a resolved pin changes `mapPins`, which is a dependency here, so a
  // successful lookup always restarts this effect and aborts the loop mid-flight.
  // Every run therefore has to be safe to cut short at any point:
  //
  //   - An attempt is recorded only once its request is actually being sent.
  //     Marking on entry meant an abort during the pacing delay retired that pin
  //     for the rest of the session without ever having looked it up, so pins
  //     after the first were silently skipped and never got coordinates.
  //   - Pacing reads a timestamp that outlives the restart. The loop index resets
  //     to 0 on every rerun, so gating the delay on `index > 0` let each restart
  //     fire immediately and defeated Nominatim's one-request-per-second policy.
  useEffect(() => {
    if (activeNav !== "Map" || !activeTrip?.id) return;
    const tripId = activeTrip.id;
    const missingPins = mapPins.filter((pin) =>
      typeof pin.latitude !== "number" || typeof pin.longitude !== "number",
    ).filter((pin) => !mapGeocodeAttemptsRef.current.has(`${tripId}:${pin.name}`));
    if (missingPins.length === 0) return;

    const controller = new AbortController();
    void (async () => {
      for (const pin of missingPins) {
        const sinceLastLookup = Date.now() - lastMapGeocodeAtRef.current;
        if (sinceLastLookup < MAP_GEOCODE_INTERVAL_MS) {
          await new Promise((resolve) => window.setTimeout(resolve, MAP_GEOCODE_INTERVAL_MS - sinceLastLookup));
        }
        if (controller.signal.aborted) return;

        mapGeocodeAttemptsRef.current.add(`${tripId}:${pin.name}`);
        lastMapGeocodeAtRef.current = Date.now();
        try {
          const location = [pin.name, tripCity, tripRegion, tripCountry].filter(Boolean).join(", ");
          const query = new URLSearchParams({ q: location, countryCode: inferredCountryCode });
          const response = await fetch(`/api/geocode?${query.toString()}`, { cache: "no-store", signal: controller.signal });
          const body = await response.json() as { latitude?: number; longitude?: number };
          if (!response.ok || typeof body.latitude !== "number" || typeof body.longitude !== "number") continue;
          setSavedTrips((trips) => trips.map((trip) => trip.id === tripId ? {
            ...trip,
            mapPins: trip.mapPins.map((savedPin) => savedPin.name === pin.name ? {
              ...savedPin,
              latitude: body.latitude,
              longitude: body.longitude,
            } : savedPin),
          } : trip));
        } catch (error) {
          if (!controller.signal.aborted) console.warn(`Could not locate saved map pin ${pin.name}.`, error);
        }
      }
    })();

    return () => controller.abort();
  }, [activeNav, activeTrip?.id, mapPins, tripCity, tripRegion, tripCountry, inferredCountryCode]);

  const weatherIsCurrent = weatherLocationKey === requestedWeatherKey;
  const currentWeatherError = !tripCity ? "Choose a city in trip details." : weatherIsCurrent ? weatherError : "";
  const currentWeatherLoading = !!tripCity && (!weatherIsCurrent || weatherLoading);
  const mapCenter = useMemo(() => (
    weatherIsCurrent && typeof weatherForecast?.latitude === "number" && typeof weatherForecast.longitude === "number"
      ? { latitude: weatherForecast.latitude, longitude: weatherForecast.longitude }
      : undefined
  ), [weatherIsCurrent, weatherForecast?.latitude, weatherForecast?.longitude]);
  const dynamicWeatherForecast: WeatherForecast = (weatherIsCurrent ? weatherForecast : null) || {
    destination: tripCity || "Trip location",
    region: tripRegion,
    country: tripCountry,
    days: [],
  };

  // Compute arrival transport / flight banner from itinerary or wallet
  const mainArrivalEvent = useMemo(() => {
    for (const d of itineraryDays) {
      const found = d.events.find(e => e.kind === "flight" || e.kind === "train");
      if (found) return { title: found.title, meta: found.meta, time: found.time, status: found.status || "Planned", kind: found.kind, event: found };
    }
    const docFound = walletDocs.find(w => w.title.toLowerCase().includes("flight") || w.title.toLowerCase().includes("boarding") || w.title.toLowerCase().includes("train") || w.meta.toLowerCase().includes("lx") || w.meta.toLowerCase().includes("air"));
    if (docFound) return { title: docFound.title, meta: docFound.meta, time: "Check pass", status: "In Wallet", kind: "flight" as const, event: null };
    return null;
  }, [itineraryDays, walletDocs]);

  const trackedFlights = useMemo(() => itineraryDays.flatMap((tripDay, dayIndex) =>
    tripDay.events
      .filter((event) => event.kind === "flight")
      .map((event) => ({ event, tripDay, dayIndex })),
  ), [itineraryDays]);
  const delayedTripFlights = trackedFlights.filter(({ event }) =>
    (event.flight?.delayMinutes || 0) > 0 || event.status?.toLowerCase() === "delayed");
  const delayedGuestFlights = guestFlights.filter((entry) =>
    entry.flight.delayMinutes > 0 || entry.status.toLowerCase() === "delayed");

  const selectedFlight = selectedEvent?.kind === "flight"
    ? selectedEvent
    : trackedFlights[0]?.event || null;

  function openFlightDetails(flight: DayEvent | null) {
    setSelectedEvent(flight);
    setPlannerOpen("flight");
  }

  function notify(message: string) {
    setToast(message);
    if (typeof window !== "undefined") {
      window.setTimeout(() => setToast(""), 2800);
    }
  }

  // Trip data can only be created, edited, or deleted while signed in, so it
  // always has an account to sync to. Guests get a read-only view.
  function requireSignIn(action: string): boolean {
    if (user && profileReady) return true;
    if (user) {
      notify("Your Firebase profile is still loading. Try again in a moment.");
      return false;
    }
    setPlannerOpen(null);
    setAuthError("");
    setAuthModalOpen(true);
    notify(`Sign in to ${action}`);
    return false;
  }

  function openMutationPanel(
    type: Exclude<NonNullable<typeof plannerOpen>, "flight" | "weather" | "trip-switcher" | "travelers">
  ) {
    if (!requireSignIn("edit your trip")) return;
    setPlannerOpen(type);
  }

  // Auth Handlers
  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      }
      setAuthPassword("");
      setAuthModalOpen(false);
      notify("Signed in successfully");
    } catch (err) {
      setAuthError(friendlyAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setAuthError("");
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setAuthModalOpen(false);
      notify("Signed in with Google");
    } catch (err) {
      setAuthError(friendlyAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogOut() {
    setAuthError("");
    setAuthLoading(true);
    try {
      await signOut(auth);
      setAuthPassword("");
      setAuthModalOpen(false);
      notify("Logged out successfully");
    } catch (err) {
      setAuthError(friendlyAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  }

  // Trip & Itinerary Handlers - Multi-Trip
  function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !profileReady) {
      requireSignIn("create a trip");
      return;
    }
    const form = new FormData(event.currentTarget);
    const location = locationFromForm(form);
    const name = String(form.get("name") || `${location.city} trip` || "My Trip").trim();
    const route = [location.city, location.region, location.country].filter(Boolean).join(", ");
    const start = String(form.get("start") || "");
    const end = String(form.get("end") || "");
    if (!start || !end || end < start) {
      notify("Choose an end date on or after the start date.");
      return;
    }
    const travelersCount = Number(form.get("travelers") || 1);
    const date = start ? new Date(`${start}T12:00:00`) : new Date();

    const firstDay: Day = {
      id: "day-" + crypto.randomUUID(),
      isoDate: start || date.toISOString().slice(0, 10),
      date: String(date.getDate()).padStart(2, "0"),
      short: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date).toUpperCase(),
      label: String(form.get("firstDay") || "Arrival"),
      events: [],
    };

    const newPins: MapPin[] = [{
      name: location.city,
      code: location.city.substring(0, 3).toUpperCase(),
      desc: [location.region, location.country].filter(Boolean).join(", "),
      temp: "",
    }];

    const defaultOrganizer: Traveler = {
      name: user.displayName || user.email?.split("@")[0] || "Organizer",
      role: "Trip organizer",
      email: user.email || "",
      avatar: (user.displayName || user.email || "OR").slice(0, 2).toUpperCase(),
      bg: "avatar-me",
    };
    const newTravelers: Traveler[] = [defaultOrganizer];

    const newTripObj: Trip = {
      id: "trip-" + crypto.randomUUID(),
      name,
      route,
      startDate: start || date.toISOString().slice(0, 10),
      endDate: end,
      travelersCount,
      days: [firstDay],
      expenses: [],
      walletDocs: [],
      mapPins: newPins,
      travelersList: newTravelers,
      guestFlights: [],
      ...location,
    };

    setSavedTrips((prev) => [newTripObj, ...prev]);
    setActiveTripId(newTripObj.id);
    setActiveDay(0);
    setSelectedMapPin(newPins[0]?.name || name);
    setPlannerOpen(null);
    setActiveNav("Overview");
    setAppView("trip");
    notify(`New itinerary "${name}" created!`);
  }

  function editTripDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTrip || !requireSignIn("edit your trip details")) return;
    const form = new FormData(event.currentTarget);
    const location = locationFromForm(form);
    const name = String(form.get("name") || activeTrip.name).trim();
    const startDate = String(form.get("start") || activeTrip.startDate);
    const endDate = String(form.get("end") || activeTrip.endDate || startDate);
    if (!startDate || !endDate || endDate < startDate) {
      notify("Choose an end date on or after the start date.");
      return;
    }
    const parsedStart = new Date(`${startDate}T12:00:00`);
    const route = [location.city, location.region, location.country].filter(Boolean).join(", ");
    updateActiveTrip((trip) => ({
      ...trip,
      ...location,
      name,
      route,
      startDate,
      endDate,
      days: trip.days.map((tripDay, index) => index === 0 && (!tripDay.isoDate || tripDay.isoDate === trip.startDate) ? {
        ...tripDay,
        isoDate: startDate,
        date: String(parsedStart.getDate()).padStart(2, "0"),
        short: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(parsedStart).toUpperCase(),
      } : tripDay),
      mapPins: trip.mapPins.length > 0
        ? trip.mapPins.map((pin, index) => index === 0 ? {
          ...pin,
          name: location.city,
          code: location.city.substring(0, 3).toUpperCase(),
          desc: [location.region, location.country].filter(Boolean).join(", "),
          temp: "",
        } : pin)
        : [{
          name: location.city,
          code: location.city.substring(0, 3).toUpperCase(),
          desc: [location.region, location.country].filter(Boolean).join(", "),
          temp: "",
        }],
      expenses: trip.expenses.map((expense) => ({ ...expense, currency: location.currency })),
    }));
    setSelectedMapPin(location.city);
    setPlannerOpen(null);
    notify(`Updated ${name}'s location, currency, and weather.`);
  }

  function openTrip(tripId: string) {
    setActiveTripId(tripId);
    setActiveDay(0);
    setActiveNav("Overview");
    setPlannerOpen(null);
    setAppView("trip");
  }

  function archiveTrip(id: string) {
    if (!requireSignIn("archive a trip")) return;
    const target = savedTrips.find((trip) => trip.id === id);
    if (!target) return;
    const archivedAt = new Date().toISOString();
    const nextActiveTrip = savedTrips.find((trip) => trip.id !== id && !trip.archivedAt && !isTripCompleted(trip));
    setSavedTrips((trips) => trips.map((trip) => trip.id === id ? { ...trip, archivedAt } : trip));
    if (activeTripId === id) {
      setActiveTripId(nextActiveTrip?.id ?? "");
      setActiveDay(0);
    }
    if (appView === "trip") setAppView("trips");
    setLibraryFilter("active");
    setPlannerOpen(null);
    notify(`Archived "${target.name}". Its itinerary is still saved.`);
  }

  function restoreTrip(id: string) {
    if (!requireSignIn("restore a trip")) return;
    const target = savedTrips.find((trip) => trip.id === id);
    if (!target) return;
    setSavedTrips((trips) => trips.map((trip) => {
      if (trip.id !== id) return trip;
      const restored = { ...trip };
      delete restored.archivedAt;
      return restored;
    }));
    setLibraryFilter("active");
    notify(`Restored "${target.name}" to active trips.`);
  }

  function requestPermanentDelete(id: string) {
    if (!requireSignIn("delete a trip")) return;
    setPlannerOpen(null);
    setPendingDeleteTripId(id);
  }

  function confirmPermanentDelete() {
    if (!pendingDeleteTrip || !requireSignIn("delete a trip")) return;
    const id = pendingDeleteTrip.id;
    const name = pendingDeleteTrip.name;
    const remainingTrips = savedTrips.filter((trip) => trip.id !== id);
    const nextActiveTrip = remainingTrips.find((trip) => !trip.archivedAt && !isTripCompleted(trip)) || remainingTrips[0];
    setSavedTrips(remainingTrips);
    if (activeTripId === id) {
      setActiveTripId(nextActiveTrip?.id ?? "");
      setActiveDay(0);
      setAppView("trips");
    }
    setPendingDeleteTripId(null);
    notify(`Permanently deleted "${name}" from your profile.`);
  }

  function addDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("add a day")) return;
    const form = new FormData(event.currentTarget);
    const entered = String(form.get("date") || "");
    const date = entered ? new Date(`${entered}T12:00:00`) : (() => {
      const d = new Date();
      d.setDate(d.getDate() + itineraryDays.length);
      return d;
    })();
    const newDay: Day = {
      id: "day-" + crypto.randomUUID(),
      isoDate: entered || date.toISOString().slice(0, 10),
      date: String(date.getDate()).padStart(2, "0"),
      short: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date).toUpperCase(),
      label: String(form.get("label") || "New Day"),
      events: [],
    };
    updateActiveTrip((trip) => ({ ...trip, days: [...trip.days, newDay] }));
    setActiveDay(itineraryDays.length);
    setPlannerOpen(null);
    notify("New day added to trip!");
  }

  function editCurrentDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("edit this day")) return;
    const form = new FormData(event.currentTarget);
    const newLabel = String(form.get("label") || day.label);
    const enteredDate = String(form.get("date") || day.isoDate || "");
    const parsedDate = enteredDate ? new Date(`${enteredDate}T12:00:00`) : null;
    updateActiveTrip((trip) => ({
      ...trip,
      days: trip.days.map((d, index) => (index === activeDay ? {
        ...d,
        label: newLabel,
        ...(parsedDate && !Number.isNaN(parsedDate.getTime()) ? {
          isoDate: enteredDate,
          date: String(parsedDate.getDate()).padStart(2, "0"),
          short: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(parsedDate).toUpperCase(),
        } : {}),
      } : d)),
    }));
    setPlannerOpen(null);
    notify("Day title updated!");
  }

  function deleteCurrentDay() {
    if (!requireSignIn("delete a day")) return;
    if (itineraryDays.length <= 1) {
      notify("Trip must have at least one day!");
      return;
    }
    updateActiveTrip((trip) => ({
      ...trip,
      days: trip.days.filter((_, index) => index !== activeDay),
    }));
    setActiveDay(0);
    setDayDropdownOpen(false);
    notify("Day deleted.");
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("add an item")) return;
    const form = new FormData(event.currentTarget);
    const rawTime = String(form.get("time") || "");
    const item: DayEvent = {
      id: "ev-" + crypto.randomUUID(),
      time: rawTime ? formatTime(rawTime) : "12:00 PM",
      title: String(form.get("title") || "Untitled activity"),
      meta: String(form.get("details") || "No details provided"),
      kind: (String(form.get("kind") || "activity")) as DayEvent["kind"],
    };
    updateActiveTrip((trip) => ({
      ...trip,
      days: trip.days.map((entry, index) => (index === activeDay ? { ...entry, events: [...entry.events, item] } : entry)),
    }));
    setPlannerOpen(null);
    notify("Item added to day!");
  }

  function editItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("edit this activity")) return;
    if (!selectedEvent) return;
    const form = new FormData(event.currentTarget);
    const rawEditTime = String(form.get("time") || selectedEvent.time);
    const updated: DayEvent = {
      ...selectedEvent,
      title: String(form.get("title") || selectedEvent.title),
      time: formatTime(rawEditTime),
      meta: String(form.get("details") || selectedEvent.meta),
      kind: String(form.get("kind") || selectedEvent.kind) as DayEvent["kind"],
    };
    updateActiveTrip((trip) => ({
      ...trip,
      days: trip.days.map((d, dIdx) =>
        dIdx === activeDay
          ? {
              ...d,
              events: d.events.map((ev) =>
                ((selectedEvent.id && ev.id === selectedEvent.id) || (ev.title === selectedEvent.title && ev.time === selectedEvent.time))
                  ? updated
                  : ev
              ),
            }
          : d
      ),
    }));
    setPlannerOpen(null);
    setSelectedEvent(null);
    notify("Event updated!");
  }

  function saveFlightDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("update flight details") || !selectedFlight?.id) return;
    const form = new FormData(event.currentTarget);
    const flight = {
      number: String(form.get("number") || "Flight"),
      airline: String(form.get("airline") || "Airline"),
      origin: String(form.get("origin") || "ORG").toUpperCase(),
      destination: String(form.get("destination") || "DST").toUpperCase(),
      departureDate: String(form.get("departureDate") || ""),
      departureTerminal: String(form.get("departureTerminal") || "TBD"),
      arrivalTerminal: String(form.get("arrivalTerminal") || "TBD"),
      gate: String(form.get("gate") || "TBD").toUpperCase(),
      arrivalGate: String(form.get("arrivalGate") || "TBD").toUpperCase(),
      scheduledDeparture: String(form.get("scheduledDeparture") || "TBD"),
      estimatedDeparture: String(form.get("estimatedDeparture") || "TBD"),
      scheduledArrival: String(form.get("scheduledArrival") || "TBD"),
      estimatedArrival: String(form.get("estimatedArrival") || "TBD"),
      delayMinutes: Math.max(0, Number(form.get("delayMinutes") || 0)),
      baggageClaim: String(form.get("baggageClaim") || "TBD"),
      lastUpdated: "Just now",
      lastUpdatedUtc: new Date().toISOString(),
    };
    const status = String(form.get("status") || "Scheduled");
    updateActiveTrip((trip) => ({
      ...trip,
      days: trip.days.map((tripDay) => ({
        ...tripDay,
        events: tripDay.events.map((item) => item.id === selectedFlight.id
          ? { ...item, title: `${flight.airline} ${flight.number}`, time: flight.estimatedDeparture, meta: `${flight.origin} → ${flight.destination} · Gate ${flight.gate}`, status, flight }
          : item),
      })),
    }));
    setSelectedEvent((current) => current ? { ...current, title: `${flight.airline} ${flight.number}`, time: flight.estimatedDeparture, meta: `${flight.origin} → ${flight.destination} · Gate ${flight.gate}`, status, flight } : current);
    setPlannerOpen("flight");
    notify("Flight status updated");
  }

  async function requestLiveFlight(flight: FlightInfo): Promise<LiveFlightUpdate> {
    if (!flight.departureDate) {
      throw new Error("Add the local departure date before requesting a live update.");
    }
    const token = await getIdToken();
    const response = await fetch("/api/flights/status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        flightNumber: flight.number,
        departureDate: flight.departureDate,
        origin: flight.origin,
        destination: flight.destination,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as Partial<LiveFlightUpdate> & { error?: string };
    if (!response.ok || !result.flight || !result.status) {
      throw new Error(result.error || "Live flight data could not be refreshed.");
    }
    return result as LiveFlightUpdate;
  }

  async function searchLiveFlights(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("search live flight information")) return;
    const form = new FormData(event.currentTarget);
    setFlightSearchBusy(true);
    setFlightSearchError("");
    setFlightSearchResults([]);
    try {
      const token = await getIdToken();
      const response = await fetch("/api/flights/status", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          searchMode: flightSearchMode,
          departureDate: String(form.get("departureDate") || ""),
          flightNumber: String(form.get("flightNumber") || ""),
          origin: String(form.get("origin") || ""),
          destination: String(form.get("destination") || ""),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as LiveFlightSearchResponse;
      const flights = result.flights || (result.flight && result.status ? [{ flight: result.flight, status: result.status }] : []);
      if (!response.ok || flights.length === 0) throw new Error(result.error || "No matching flights were returned.");
      setFlightSearchResults(flights);
      notify(`${flights.length} live flight ${flights.length === 1 ? "match" : "matches"} found`);
    } catch (error) {
      setFlightSearchError(friendlyFlightError(error));
    } finally {
      setFlightSearchBusy(false);
    }
  }

  function addLiveSearchResult(result: LiveFlightUpdate) {
    if (!requireSignIn("add a live flight to your tracker")) return;
    const details = result.flight;
    const newFlight: DayEvent = {
      id: `flight-${crypto.randomUUID()}`,
      time: details.estimatedDeparture,
      title: `${details.airline} ${details.number}`,
      meta: `${details.origin} → ${details.destination} · Gate ${details.gate}`,
      kind: "flight",
      status: result.status,
      flight: details,
    };
    updateActiveTrip((trip) => ({
      ...trip,
      days: trip.days.map((tripDay, index) => index === activeDay
        ? { ...tripDay, events: [...tripDay.events, newFlight] }
        : tripDay),
    }));
    setSelectedEvent(newFlight);
    setFlightSearchResults((current) => current.filter((item) => item !== result));
    notify(`${details.number} added to Day ${activeDay + 1}`);
  }

  async function refreshTrackedFlight(event: DayEvent) {
    if (!event.flight || !requireSignIn("refresh live flight data")) return;
    const updateKey = `trip:${event.id || event.title}`;
    setLiveUpdating(updateKey);
    try {
      const live = await requestLiveFlight(event.flight);
      updateActiveTrip((trip) => ({
        ...trip,
        days: trip.days.map((tripDay) => ({
          ...tripDay,
          events: tripDay.events.map((item) => item.id === event.id
            ? {
                ...item,
                title: `${live.flight.airline} ${live.flight.number}`,
                time: live.flight.estimatedDeparture,
                meta: `${live.flight.origin} → ${live.flight.destination} · Gate ${live.flight.gate}`,
                status: live.status,
                flight: { ...item.flight, ...live.flight },
              }
            : item),
        })),
      }));
      setSelectedEvent((current) => (current && current.id === event.id)
        ? { ...current, status: live.status, flight: { ...(current.flight || {}), ...live.flight } } as DayEvent
        : current);
      notify(`${live.flight.number} refreshed from ${live.flight.source || "live flight data"}`);
    } catch (error) {
      notify(friendlyFlightError(error));
    } finally {
      setLiveUpdating(null);
    }
  }

  async function refreshGuestFlight(entry: GuestFlight) {
    if (!requireSignIn("refresh a guest flight")) return;
    const updateKey = `guest:${entry.id}`;
    setLiveUpdating(updateKey);
    try {
      const live = await requestLiveFlight(entry.flight);
      updateActiveTrip((trip) => ({
        ...trip,
        guestFlights: (trip.guestFlights || []).map((item) => item.id === entry.id
          ? { ...item, status: live.status, flight: { ...item.flight, ...live.flight } }
          : item),
      }));
      notify(`${live.flight.number} refreshed for ${entry.guestName}`);
    } catch (error) {
      notify(friendlyFlightError(error));
    } finally {
      setLiveUpdating(null);
    }
  }

  function addTrackedFlight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("track a flight")) return;
    const form = new FormData(event.currentTarget);
    const number = String(form.get("number") || "Flight").toUpperCase();
    const airline = String(form.get("airline") || "Airline");
    const origin = String(form.get("origin") || "ORG").toUpperCase();
    const destination = String(form.get("destination") || "DST").toUpperCase();
    const departureDate = String(form.get("departureDate") || "");
    const departure = formatTime(String(form.get("departure") || ""));
    const arrival = formatTime(String(form.get("arrival") || ""));
    const newFlight: DayEvent = {
      id: `flight-${crypto.randomUUID()}`,
      time: departure,
      title: `${airline} ${number}`,
      meta: `${origin} → ${destination} · Gate TBD`,
      kind: "flight",
      status: "Scheduled",
      flight: {
        number, airline, origin, destination, departureDate,
        departureTerminal: "TBD", arrivalTerminal: "TBD", gate: "TBD", arrivalGate: "TBD",
        scheduledDeparture: departure, estimatedDeparture: departure,
        scheduledArrival: arrival, estimatedArrival: arrival,
        delayMinutes: 0, baggageClaim: "TBD", lastUpdated: "Just now",
      },
    };
    updateActiveTrip((trip) => ({
      ...trip,
      days: trip.days.map((tripDay, index) => index === activeDay
        ? { ...tripDay, events: [...tripDay.events, newFlight] }
        : tripDay),
    }));
    setSelectedEvent(newFlight);
    setPlannerOpen("flight");
    notify(`${number} added to your tracker`);
  }

  function saveGuestFlight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("save a guest flight")) return;
    const form = new FormData(event.currentTarget);
    const delayMinutes = Math.max(0, Number(form.get("delayMinutes") || 0));
    const requestedStatus = String(form.get("status") || "Scheduled");
    const status = delayMinutes > 0 ? "Delayed" : requestedStatus;
    const flight: GuestFlight = {
      id: selectedGuestFlight?.id || `guest-flight-${crypto.randomUUID()}`,
      guestName: String(form.get("guestName") || "Guest"),
      note: String(form.get("note") || "Friend or family flight"),
      status,
      flight: {
        number: String(form.get("number") || "Flight").toUpperCase(),
        airline: String(form.get("airline") || "Airline"),
        origin: String(form.get("origin") || "ORG").toUpperCase(),
        destination: String(form.get("destination") || "DST").toUpperCase(),
        departureDate: String(form.get("departureDate") || ""),
        departureTerminal: String(form.get("departureTerminal") || "TBD"),
        arrivalTerminal: String(form.get("arrivalTerminal") || "TBD"),
        gate: String(form.get("gate") || "TBD").toUpperCase(),
        arrivalGate: String(form.get("arrivalGate") || "TBD").toUpperCase(),
        scheduledDeparture: formatTime(String(form.get("departure") || "")),
        estimatedDeparture: formatTime(String(form.get("estimatedDeparture") || form.get("departure") || "")),
        scheduledArrival: formatTime(String(form.get("arrival") || "")),
        estimatedArrival: formatTime(String(form.get("estimatedArrival") || form.get("arrival") || "")),
        delayMinutes,
        baggageClaim: String(form.get("baggageClaim") || "TBD"),
        lastUpdated: "Just now",
      },
    };
    updateActiveTrip((trip) => ({
      ...trip,
      guestFlights: selectedGuestFlight
        ? (trip.guestFlights || []).map((item) => item.id === flight.id ? flight : item)
        : [...(trip.guestFlights || []), flight],
    }));
    setSelectedGuestFlight(null);
    setPlannerOpen(null);
    setActiveNav("Guest Flights");
    notify(`${flight.flight.number} saved for ${flight.guestName}`);
  }

  function deleteGuestFlight(id: string) {
    if (!requireSignIn("remove a guest flight")) return;
    updateActiveTrip((trip) => ({
      ...trip,
      guestFlights: (trip.guestFlights || []).filter((item) => item.id !== id),
    }));
    notify("Guest flight removed");
  }

  function deleteSelectedEvent() {
    if (!requireSignIn("delete this activity")) return;
    if (!selectedEvent) return;
    updateActiveTrip((trip) => ({
      ...trip,
      days: trip.days.map((d, dIdx) =>
        dIdx === activeDay
          ? {
              ...d,
              events: d.events.filter(
                (ev) => !((selectedEvent.id && ev.id === selectedEvent.id) || (ev.title === selectedEvent.title && ev.time === selectedEvent.time))
              ),
            }
          : d
      ),
    }));
    setPlannerOpen(null);
    setSelectedEvent(null);
    notify("Event deleted!");
  }

  // Expense Handlers
  function addExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("add an expense")) return;
    const form = new FormData(event.currentTarget);
    const rawAmount = String(form.get("amount") || "0").replace(",", ".");
    const parsedAmount = parseFloat(rawAmount);
    const amount = Number.isNaN(parsedAmount) ? 0 : parsedAmount;
    const newExp: Expense = {
      id: "exp-" + crypto.randomUUID(),
      description: String(form.get("description") || "Expense"),
      amount,
      currency: String(form.get("currency") || tripCurrency),
      paidBy: String(form.get("paidBy") || travelersList[0]?.name || "Organizer"),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      category: String(form.get("category") || "General"),
      settled: false
    };
    updateActiveTrip((trip) => ({
      ...trip,
      expenses: [newExp, ...trip.expenses],
    }));
    setPlannerOpen(null);
    notify(`Expense added: ${newExp.currency} ${newExp.amount.toFixed(2)}`);
  }

  function deleteExpense(id: string) {
    if (!requireSignIn("delete an expense")) return;
    updateActiveTrip((trip) => ({
      ...trip,
      expenses: trip.expenses.filter((e) => e.id !== id),
    }));
    notify("Expense removed");
  }

  function settleAllBalances() {
    if (!requireSignIn("settle balances")) return;
    updateActiveTrip((trip) => ({
      ...trip,
      expenses: trip.expenses.map((e) => ({ ...e, settled: true })),
    }));
    setPlannerOpen(null);
    notify("All group balances have been settled and marked as paid!");
  }

  // Wallet Handlers
  function addPassSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("add a pass")) return;
    const form = new FormData(event.currentTarget);
    const newDoc: WalletDoc = {
      id: "w-" + crypto.randomUUID(),
      title: String(form.get("title") || "Pass"),
      meta: String(form.get("meta") || "Ticket Document"),
      code: String(form.get("code") || "JS-TICKET-" + Math.floor(Math.random() * 10000)),
      icon: String(form.get("icon") || "DOC").substring(0, 3).toUpperCase(),
      coralIcon: Math.random() > 0.5,
    };
    updateActiveTrip((trip) => ({
      ...trip,
      walletDocs: [...trip.walletDocs, newDoc],
    }));
    setPlannerOpen(null);
    notify("Document added to Trip Wallet");
  }

  function deleteWalletDoc(id: string) {
    if (!requireSignIn("delete a document")) return;
    updateActiveTrip((trip) => ({
      ...trip,
      walletDocs: trip.walletDocs.filter((w) => w.id !== id),
    }));
    notify("Document deleted");
  }

  // Team & Map Handlers
  function addTravelerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("invite a traveler")) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "New Traveler");
    const email = String(form.get("email") || "traveler@example.com");
    const role = String(form.get("role") || "Traveler");
    const avatar = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "TR";
    const bg = ["peach", "blue", "green", "coral"][travelersList.length % 4];

    updateActiveTrip((trip) => ({
      ...trip,
      travelersCount: trip.travelersList.length + 1,
      travelersList: [...trip.travelersList, { name, email, role, avatar, bg }],
    }));
    notify(`${name} added to travel team!`);
  }

  function removeTraveler(email: string) {
    if (!requireSignIn("remove a traveler")) return;
    if (travelersList.length <= 1) {
      notify("Trip must have at least one organizer.");
      return;
    }
    updateActiveTrip((trip) => {
      const newList = trip.travelersList.filter((t) => t.email !== email);
      return {
        ...trip,
        travelersCount: newList.length,
        travelersList: newList,
      };
    });
    notify("Traveler removed from team.");
  }

  async function addMapPinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("add a map pin")) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "New Place");
    const code = String(form.get("code") || name.slice(0, 3)).toUpperCase();
    const temp = String(form.get("temp") || "18°C");
    const desc = String(form.get("desc") || "Route destination");

    setLiveUpdating("map-pin");
    let coordinates: { latitude: number; longitude: number };
    try {
      const location = [name, tripCity, tripRegion, tripCountry].filter(Boolean).join(", ");
      const query = new URLSearchParams({ q: location, countryCode: inferredCountryCode });
      const response = await fetch(`/api/geocode?${query.toString()}`, { cache: "no-store" });
      const body = await response.json() as Partial<typeof coordinates> & { error?: string };
      if (!response.ok || typeof body.latitude !== "number" || typeof body.longitude !== "number") {
        throw new Error(body.error || "That place could not be located.");
      }
      coordinates = { latitude: body.latitude, longitude: body.longitude };
    } catch (error) {
      notify(error instanceof Error ? error.message : "That place could not be located.");
      setLiveUpdating(null);
      return;
    }

    updateActiveTrip((trip) => ({
      ...trip,
      mapPins: [...trip.mapPins, { name, code, temp, desc, ...coordinates }],
    }));
    setSelectedMapPin(name);
    setPlannerOpen(null);
    setLiveUpdating(null);
    notify(`${name} pin added to map!`);
  }

  if (authChecking) {
    return (
      <main className="auth-gate auth-gate-loading" aria-live="polite">
        <div className="auth-gate-brand"><span className="brand-mark">J</span><strong>JourneySync</strong></div>
        <div className="auth-loader" aria-hidden="true" />
        <p>Checking your Firebase account…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-gate">
        <section className="auth-gate-intro" aria-label="JourneySync introduction">
          <div className="auth-gate-brand"><span className="brand-mark">J</span><strong>JourneySync</strong></div>
          <div>
            <span className="eyebrow">EVERY PLAN · EVERY PERSON · ONE JOURNEY</span>
            <h1>Your trips,<br />all in one place.</h1>
            <p>Build itineraries, keep travel details together, and return to every saved trip from one private account.</p>
          </div>
          <small>Trip data is saved to your Firebase profile.</small>
        </section>

        <section className="auth-gate-panel" aria-labelledby="auth-page-title">
          <div className="auth-card">
            <span className="eyebrow">FIREBASE ACCOUNT</span>
            <h2 id="auth-page-title">{authMode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p>{authMode === "login" ? "Sign in to see your trips." : "Create an account to save your first trip."}</p>

            <div className="auth-tabs">
              <button type="button" className={`auth-tab ${authMode === "login" ? "active" : ""}`} onClick={() => { setAuthMode("login"); setAuthError(""); }} disabled={authLoading}>Sign In</button>
              <button type="button" className={`auth-tab ${authMode === "signup" ? "active" : ""}`} onClick={() => { setAuthMode("signup"); setAuthError(""); }} disabled={authLoading}>Register</button>
            </div>

            <form onSubmit={handleAuthSubmit}>
              <label>Email Address
                <input type="email" value={authEmail} onChange={(event) => { setAuthEmail(event.target.value); setAuthError(""); }} required placeholder="you@example.com" autoComplete="email" disabled={authLoading} />
              </label>
              <label>Password
                <input type="password" value={authPassword} onChange={(event) => { setAuthPassword(event.target.value); setAuthError(""); }} required placeholder="••••••••" autoComplete={authMode === "login" ? "current-password" : "new-password"} disabled={authLoading} />
              </label>

              {authError && <div className="auth-error" role="alert">{authError}</div>}

              <button className="primary-action auth-submit" type="submit" disabled={authLoading}>
                {authLoading ? "Connecting to Firebase…" : authMode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div className="auth-divider">OR</div>
            <button type="button" className="google-btn" onClick={handleGoogleAuth} disabled={authLoading}>
              {authLoading ? "Please wait…" : "Continue with Google"}
            </button>
            <p className="auth-help">Use Chrome or Edge for Google sign-in. Your session stays signed in when you return.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!profileReady) {
    return (
      <main className="auth-gate auth-gate-loading" aria-live="polite">
        <div className="auth-gate-brand"><span className="brand-mark">J</span><strong>JourneySync</strong></div>
        <div className="auth-loader" aria-hidden="true" />
        <h1>Loading your trips</h1>
        <p>JourneySync is checking your Firebase profile.</p>
      </main>
    );
  }

  if (appView === "trips") {
    return (
      <main className="trip-library-shell">
        <header className="trip-library-header">
          <div className="auth-gate-brand"><span className="brand-mark">J</span><strong>JourneySync</strong></div>
          <div className="trip-library-account">
            <span className="avatar avatar-me">{(user.displayName || user.email || "JS").slice(0, 2).toUpperCase()}</span>
            <span><strong>{user.displayName || user.email?.split("@")[0] || "Traveler"}</strong><small>{cloudReady && synced ? "Firebase synced" : cloudReady ? "Saving changes" : "Saved on this device"}</small></span>
            <button type="button" onClick={handleLogOut} disabled={authLoading}>{authLoading ? "Signing out…" : "Sign out"}</button>
          </div>
        </header>

        <section className="trip-library-content">
          <div className="trip-library-heading">
            <div>
              <span className="eyebrow">YOUR JOURNEYS</span>
              <h1>{libraryFilter === "active" ? "Active and upcoming trips" : "Archived trips"}</h1>
              <p>{libraryFilter === "active" ? "Completed trips move to Archived automatically, where their full itinerary stays saved." : "Open an old itinerary, restore a manually archived trip, or delete one permanently."}</p>
            </div>
            <button className="primary-action trip-library-create" onClick={() => setPlannerOpen("trip")}>＋ Create a trip</button>
          </div>

          <div className="trip-library-filters" role="tablist" aria-label="Filter trips">
            <button type="button" role="tab" aria-selected={libraryFilter === "active"} className={libraryFilter === "active" ? "active" : ""} onClick={() => setLibraryFilter("active")}>Active and upcoming <span>{activeTrips.length}</span></button>
            <button type="button" role="tab" aria-selected={libraryFilter === "archived"} className={libraryFilter === "archived" ? "active" : ""} onClick={() => setLibraryFilter("archived")}>Archived <span>{archivedTrips.length}</span></button>
          </div>

          {visibleTrips.length > 0 ? (
            <div className="trip-library-grid">
              {visibleTrips.map((trip) => {
                const activityCount = trip.days.reduce((total, tripDay) => total + tripDay.events.length, 0);
                const completed = isTripCompleted(trip);
                return (
                  <article className={`trip-library-card${libraryFilter === "archived" ? " archived" : ""}`} key={trip.id}>
                    <button type="button" className="trip-library-card-main" onClick={() => openTrip(trip.id)} aria-label={`Open ${trip.name}`}>
                      <span className="trip-library-card-mark" aria-hidden="true">✦</span>
                      <span className="trip-library-card-copy">
                        <small>{libraryFilter === "active" ? activeTripStatus(trip) : completed ? "Completed" : "Archived"} · {formatTripStartDate(trip.startDate)}</small>
                        <strong>{trip.name}</strong>
                        <span>{trip.route || "Route not set"}</span>
                      </span>
                      <span className="trip-library-card-arrow" aria-hidden="true">→</span>
                    </button>
                    <div className="trip-library-card-meta">
                      <span><strong>{trip.days.length}</strong> days</span>
                      <span><strong>{activityCount}</strong> plans</span>
                      <span><strong>{trip.travelersCount}</strong> traveler{trip.travelersCount === 1 ? "" : "s"}</span>
                    </div>
                    <div className="trip-library-card-actions">
                      {libraryFilter === "active" ? (
                        <button type="button" onClick={() => archiveTrip(trip.id)}>Archive trip</button>
                      ) : !completed && trip.archivedAt ? (
                        <button type="button" onClick={() => restoreTrip(trip.id)}>Restore trip</button>
                      ) : (
                        <span>Itinerary kept for your records</span>
                      )}
                      <button type="button" className="delete" onClick={() => requestPermanentDelete(trip.id)}>Delete permanently</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="trip-library-empty">
              <span aria-hidden="true">✦</span>
              <h2>{libraryFilter === "active" ? "No active trips" : "No archived trips"}</h2>
              <p>{libraryFilter === "active" ? "Create a trip to start planning. Nothing is prefilled or added as a demo." : "Completed and manually archived trips will appear here."}</p>
              {libraryFilter === "active" ? (
                <button className="primary-action" onClick={() => setPlannerOpen("trip")}>Create your first trip</button>
              ) : (
                <button className="secondary-action" onClick={() => setLibraryFilter("active")}>View active trips</button>
              )}
            </div>
          )}
        </section>

        {plannerOpen === "trip" && (
          <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
            <section className="modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Create a trip">
              <button className="modal-close" onClick={() => setPlannerOpen(null)} aria-label="Close create trip dialog">×</button>
              <form onSubmit={createTrip}>
                <span className="eyebrow">NEW ITINERARY</span>
                <h2>Create any trip</h2>
                <label>Trip name<input name="name" placeholder="e.g. Spring break" required autoFocus /></label>
                <TripLocationFields />
                <TripDateFields />
                <div className="form-row">
                  <label>Travelers<input name="travelers" type="number" min="1" defaultValue="1" /></label>
                  <label>First day title<input name="firstDay" placeholder="e.g. Arrival" /></label>
                </div>
                <button className="primary-action">Create itinerary</button>
              </form>
            </section>
          </div>
        )}

        {pendingDeleteTrip && (
          <DeleteTripDialog trip={pendingDeleteTrip} onCancel={() => setPendingDeleteTripId(null)} onConfirm={confirmPermanentDelete} />
        )}

        {toast && <div className="toast" role="status">{toast}</div>}
      </main>
    );
  }

  return (
    <main className="app-shell">
      {/* Mobile Overlay Drawer backdrop */}
      {mobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={mobileMenuOpen ? "sidebar mobile-open" : "sidebar"}>
        <div className="brand" aria-label="JourneySync home">
          <span className="brand-mark">J</span>
          <span>JourneySync</span>
        </div>

        <nav className="main-nav" aria-label="Primary navigation">
          {[
            ["⌂", "Overview"],
            ["≡", "Itinerary"],
            ["✈", "Flight Tracker"],
            ["◎", "Guest Flights"],
            ["◇", "Map"],
            ["¤", "Expenses"],
            ["▣", "Wallet"],
          ].map(([icon, label]) => (
            <button
              className={activeNav === label ? "nav-item active" : "nav-item"}
              key={label}
              onClick={() => {
                setActiveNav(label);
                setMobileMenuOpen(false);
              }}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
              {label === "Wallet" && <small>{walletDocs.length}</small>}
              {label === "Guest Flights" && guestFlights.length > 0 && <small>{guestFlights.length}</small>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="download-card" onClick={() => {
            if (!user) {
              setAuthError("");
              setAuthModalOpen(true);
              notify("Sign in to save trips offline");
              return;
            }
            if (!hasActiveTrip) {
              notify("Create a trip before saving offline");
              return;
            }
            const updatedAt = Date.now();
            writeLocalTrips(user.uid, normalizeTripCache(savedTrips, activeTripId, updatedAt));
            setOfflineCachedAt(new Date(updatedAt).toISOString());
            notify("Device backup refreshed");
          }}>
            <span className="download-icon">↓</span>
            <span>
              <strong>{offlineCachedAt ? "Saved on this device" : "Back up on this device"}</strong>
              <small>{offlineCachedAt ? "Ready if your connection drops" : "Keep an account-scoped copy"}</small>
            </span>
            <i>{offlineCachedAt ? "✓" : ""}</i>
          </button>

          <button
            className={`profile ${user ? "signed-in" : "signed-out"}`}
            onClick={() => {
              setAuthError("");
              setAuthModalOpen(true);
            }}
            aria-label={user ? `Open account: signed in as ${user.email || user.displayName || "JourneySync user"}` : "Open account: sign in to JourneySync"}
          >
            <span className="profile-avatar-wrap">
              <span className="avatar avatar-me">{user ? (user.displayName ? user.displayName.slice(0, 2).toUpperCase() : user.email?.slice(0, 2).toUpperCase()) : "G"}</span>
              <i aria-hidden="true" />
            </span>
            <span>
              <strong>{user ? (user.displayName || user.email?.split("@")[0]) : "Guest"}</strong>
              <small>{authChecking ? "Checking account…" : user ? (!profileReady ? "Signed in · Loading your trips" : !cloudReady ? "Signed in · Saved on device" : synced ? "Signed in · Cloud synced" : "Signed in · Saving changes") : "Sign in to view your trips"}</small>
            </span>
            <span>•••</span>
          </button>
        </div>
      </aside>

      {/* Workspace */}
      <section className="workspace">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open menu" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>≡</button>

          <div className="trip-switcher">
            <span className="flag" onClick={() => setAppView("trips")} style={{ cursor: "pointer" }}>✦</span>
            <span onClick={() => setAppView("trips")} style={{ cursor: "pointer" }} title="Return to all trips">
              <small>CURRENT TRIP ▾ ({savedTrips.length})</small>
              <strong>{tripName}</strong>
            </span>
            <button aria-label="Create a new trip" onClick={() => openMutationPanel("trip")} title="Create new itinerary">＋</button>
          </div>

          <div className="top-actions">
            <button className="all-trips-button" type="button" onClick={() => setAppView("trips")}>← All trips</button>
            <button className="icon-button" aria-label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}>
              ●<i />
            </button>
            
            <div className="avatar-stack" aria-label="Travelers" onClick={() => setPlannerOpen("travelers")} style={{ cursor: "pointer" }}>
              {travelersList.slice(0, 3).map((t) => (
                <span key={t.email} className={`avatar ${t.bg}`}>{t.avatar}</span>
              ))}
              {travelersList.length > 3 && <span className="avatar more">+{travelersList.length - 3}</span>}
            </div>

            <button className="share-button" onClick={() => setPlannerOpen("travelers")}>↗ <span>Invite</span></button>
          </div>

          {/* Notifications Popover */}
          {notificationsOpen && (
            <>
              <div className="popover-backdrop" onClick={() => setNotificationsOpen(false)} />
              <div className="notifications-popover">
                <div className="notifications-header">
                  <h3>Trip Notifications</h3>
                  <button style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: "11px", color: "var(--coral)" }} onClick={() => setNotificationsOpen(false)}>Close</button>
                </div>
                {mainArrivalEvent && (
                  <div className="notification-item">
                    <div className="notification-icon">{mainArrivalEvent.kind === "flight" ? "✈" : "↗"}</div>
                    <div>
                      <strong>{mainArrivalEvent.title}</strong>
                      <p style={{ margin: "2px 0 0", color: "#64748b" }}>{mainArrivalEvent.time} · {mainArrivalEvent.meta || "Added to your itinerary"}</p>
                    </div>
                  </div>
                )}
                <div className="notification-item">
                  <div className="notification-icon">≡</div>
                  <div>
                    <strong>{tripName} is ready</strong>
                    <p style={{ margin: "2px 0 0", color: "#64748b" }}>{itineraryDays.length} day{itineraryDays.length === 1 ? "" : "s"} and {itineraryDays.reduce((total, tripDay) => total + tripDay.events.length, 0)} saved plan{itineraryDays.reduce((total, tripDay) => total + tripDay.events.length, 0) === 1 ? "" : "s"}.</p>
                  </div>
                </div>
                <div className="notification-item">
                  <div className="notification-icon">✓</div>
                  <div>
                    <strong>{cloudReady && synced ? "Firebase profile synced" : "Profile saved on this device"}</strong>
                    <p style={{ margin: "2px 0 0", color: "#64748b" }}>{cloudReady && synced ? "Your latest trip changes are stored in Firestore." : "JourneySync will sync when Firebase is available."}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </header>

        <div className="content">
          <div className="hero-row">
            <div>
              <div className="eyebrow"><span /> {itineraryDays.length} DAYS · {tripTravelers} TRAVELER{tripTravelers === 1 ? "" : "S"}</div>
              <h1>{tripName}</h1>
              <p>{tripRoute}</p>
              <div className="trip-management-actions">
                <button className="trip-details-button" type="button" onClick={() => openMutationPanel("trip-settings")}>Edit trip details</button>
                {activeTrip?.archivedAt && !isTripCompleted(activeTrip) ? (
                  <button className="trip-details-button" type="button" onClick={() => restoreTrip(activeTrip.id)}>Restore trip</button>
                ) : !activeTrip?.archivedAt && activeTrip && !isTripCompleted(activeTrip) ? (
                  <button className="trip-details-button" type="button" onClick={() => archiveTrip(activeTrip.id)}>Archive trip</button>
                ) : (
                  <span className="trip-completed-label">Completed and archived</span>
                )}
                {activeTrip && <button className="trip-details-button delete" type="button" onClick={() => requestPermanentDelete(activeTrip.id)}>Delete trip</button>}
              </div>
            </div>
            <div className="date-range">
              <span>{tripDateRange.startDate}</span>
              <div><small>{tripDateRange.startMonth}</small><strong>{tripDateRange.startYear}</strong></div>
              <i>-</i>
              <span>{tripDateRange.endDate}</span>
              <div><small>{tripDateRange.endMonth}</small><strong>{tripDateRange.endYear}</strong></div>
            </div>
          </div>

          {/* Flight / Arrival Banner */}
          {mainArrivalEvent ? (
            <div className="status-banner">
              <div className="status-symbol">{mainArrivalEvent.kind === "train" ? "↗" : "✈"}</div>
              <div>
                <small>NEXT UP · {mainArrivalEvent.time}</small>
                <strong>{mainArrivalEvent.title}</strong>
                <span>{mainArrivalEvent.meta}</span>
              </div>
              <div className="flight-line">
                <span>START</span><i><b>{mainArrivalEvent.kind === "train" ? "↗" : "✈"}</b></i><span>DEST</span>
              </div>
              <div className="flight-time"><strong>{mainArrivalEvent.time}</strong><span className="on-time">{mainArrivalEvent.status}</span></div>
              <button onClick={() => mainArrivalEvent.kind === "flight" ? openFlightDetails(mainArrivalEvent.event || null) : setActiveNav("Itinerary")}>View details <span>→</span></button>
            </div>
          ) : (
            <div className="status-banner" style={{ background: "#f8fafc", border: "1px dashed #cbd5e1" }}>
              <div className="status-symbol">✦</div>
              <div>
                <small>NO ARRIVAL PASS YET</small>
                <strong>Plan your arrival transport</strong>
                <span>Add a flight or train pass in your Wallet or Itinerary</span>
              </div>
              <button onClick={() => openMutationPanel("item")} style={{ marginLeft: "auto" }}>Add Activity <span>→</span></button>
            </div>
          )}

          {/* MAIN DYNAMIC VIEW NAVIGATION */}
          {activeNav === "Overview" && (
            <div className="view-grid view-fade">
              <div className="overview-cards">
                <div className="overview-card">
                  <small>ITINERARY DURATION</small>
                  <strong>{itineraryDays.length} Days</strong>
                  <p>{itineraryDays.reduce((acc, d) => acc + d.events.length, 0)} Total Activities Planned</p>
                </div>
                <div className="overview-card">
                  <small>TOTAL EXPENSES</small>
                  <strong>{tripCurrency} {totalExpenseAmount.toFixed(2)}</strong>
                  <p>Split across {travelersList.length} Travelers</p>
                </div>
                <div className="overview-card">
                  <small>TRAVEL DOCUMENTS</small>
                  <strong>{walletDocs.length} Passes</strong>
                  <p>Boarding passes & hotel confirmations</p>
                </div>
                <div className="overview-card">
                  <small>TRAVEL TEAM</small>
                  <strong>{travelersList.length} Members</strong>
                  <p>Organized by {user.displayName || user.email?.split("@")[0] || "you"}.</p>
                </div>
              </div>

              <div className="dashboard-grid">
                <section className="itinerary-panel">
                  <div className="section-heading">
                    <div><span>UPCOMING HIGHLIGHTS</span><h2>Trip Timeline</h2></div>
                    <button onClick={() => setActiveNav("Itinerary")}>Go to Full Itinerary →</button>
                  </div>
                  <div className="timeline">
                    {itineraryDays.slice(0, 2).map((d) => (
                      <div key={d.id || d.date} style={{ marginBottom: "16px" }}>
                        <h4 style={{ margin: "0 0 10px", fontSize: "13px", color: "#64748b" }}>Day {d.date} - {d.label}</h4>
                        {d.events.map((event) => (
                          <article className="timeline-item" key={`${event.time}-${event.title}`} style={{ marginBottom: "8px" }}>
                            <time>{event.time}</time>
                            <div className={`event-icon ${event.kind}`}>{iconFor[event.kind]}</div>
                            <div className="event-card">
                              <span>
                                <strong>{event.title}</strong>
                                <small>{event.meta}</small>
                              </span>
                            </div>
                          </article>
                        ))}
                      </div>
                    ))}
                  </div>
                </section>

                <aside className="right-rail">
                  <section className="weather-card" onClick={() => setPlannerOpen("weather")} style={{ cursor: "pointer" }}>
                    <div>
                      <small>{dynamicWeatherForecast.destination.toUpperCase()} · {dynamicWeatherForecast.days[0]?.day || "LIVE WEATHER"}</small>
                      <strong>{currentWeatherLoading ? "Loading…" : dynamicWeatherForecast.days[0]?.temp || "Unavailable"}</strong>
                      <span>{currentWeatherError || dynamicWeatherForecast.days[0]?.desc || "Choose a city in trip details"}</span>
                    </div>
                    <div className="sun-cloud"><i>{dynamicWeatherForecast.days[0]?.icon || "🌐"}</i><b>☁</b></div>
                    <div className="weather-meta"><span>H {dynamicWeatherForecast.days[0]?.high || "—"}</span><span>L {dynamicWeatherForecast.days[0]?.low || "—"}</span><span>Precip. {dynamicWeatherForecast.days[0]?.rain || "—"}</span></div>
                  </section>

                  <section className="expense-card">
                    <div className="rail-heading"><span>EXPENSES SNAPSHOT</span><button onClick={() => openMutationPanel("expense")}>＋</button></div>
                    <strong className="expense-total">{tripCurrency} {totalExpenseAmount.toFixed(2)}</strong>
                    <button className="text-link" onClick={() => setActiveNav("Expenses")}>View Full Expense Breakdown <span>→</span></button>
                  </section>
                </aside>
              </div>
            </div>
          )}

          {activeNav === "Flight Tracker" && (
            <div className="flight-tracker view-fade">
              <div className="tracker-heading">
                <div>
                  <span className="eyebrow">TRIP OPERATIONS</span>
                  <h2>Flight Tracker</h2>
                  <p>Search live flight information, then keep gate, terminal, timing, delay, and baggage updates with your itinerary.</p>
                </div>
                <button className="primary-action tracker-add" onClick={() => openMutationPanel("track-flight")}>＋ Track a flight</button>
              </div>

              <details className="live-flight-finder" open>
                <summary>
                  <span><strong>Live flight information</strong><small>Search by route and date, or by flight code</small></span>
                  <span className="finder-chevron" aria-hidden="true">⌄</span>
                </summary>
                <form className="live-flight-search" onSubmit={searchLiveFlights}>
                  <label className="search-mode-label">Find a flight using
                    <select value={flightSearchMode} onChange={(event) => { setFlightSearchMode(event.target.value as "route" | "number"); setFlightSearchResults([]); setFlightSearchError(""); }}>
                      <option value="route">From and to airports</option>
                      <option value="number">Flight code</option>
                    </select>
                  </label>
                  <div className="live-flight-fields">
                    {flightSearchMode === "route" ? (
                      <>
                        <label>From airport<input name="origin" maxLength={3} placeholder="JFK" autoCapitalize="characters" required /></label>
                        <label>To airport<input name="destination" maxLength={3} placeholder="LHR" autoCapitalize="characters" required /></label>
                      </>
                    ) : (
                      <label className="flight-code-field">Flight code<input name="flightNumber" placeholder="AA 100" autoCapitalize="characters" required /></label>
                    )}
                    <label>Departure date<input name="departureDate" type="date" defaultValue={activeTrip?.startDate || ""} required /></label>
                    <button className="primary-action live-search-button" disabled={flightSearchBusy}>
                      {flightSearchBusy ? "Checking live flights…" : "Search live flights"}
                    </button>
                  </div>
                </form>
                {flightSearchError && <div className="flight-search-error" role="alert">{flightSearchError}</div>}
                {flightSearchResults.length > 0 && (
                  <div className="live-search-results" aria-live="polite">
                    {flightSearchResults.map((result, index) => {
                      const details = result.flight;
                      const delayed = details.delayMinutes > 0 || result.status.toLowerCase() === "delayed";
                      return (
                        <article className="live-search-result" key={`${details.number}-${details.scheduledDeparture}-${index}`}>
                          <div>
                            <span className={`flight-status ${delayed ? "delayed" : "on-time"}`}>{result.status}</span>
                            <strong>{details.number}</strong>
                            <small>{details.airline}</small>
                          </div>
                          <div className="search-result-route"><strong>{details.origin} → {details.destination}</strong><span>{details.estimatedDeparture} → {details.estimatedArrival}</span></div>
                          <div className="search-result-gate"><small>GATE / DELAY</small><strong>{details.gate} · {details.delayMinutes ? `${details.delayMinutes} min` : "No delay"}</strong></div>
                          <button type="button" className="secondary-action" onClick={() => addLiveSearchResult(result)}>Add to tracker</button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </details>

              {delayedTripFlights.length > 0 && (
                <div className="delay-alert" role="status">
                  <strong>Delay alert</strong>
                  <span>{delayedTripFlights.map(({ event }) => `${event.flight?.number || event.title} · ${event.flight?.delayMinutes ? `${event.flight.delayMinutes} min` : event.status}`).join("  •  ")}</span>
                </div>
              )}

              {trackedFlights.length > 0 ? (
                <div className="flight-card-grid">
                  {trackedFlights.map(({ event, tripDay }) => {
                    const details = event.flight;
                    const delayed = (details?.delayMinutes || 0) > 0;
                    return (
                      <article className="flight-tracker-card" key={event.id || `${event.title}-${event.time}`}>
                        <div className="flight-card-topline">
                          <div><span>{details?.airline || "FLIGHT"}</span><strong>{details?.number || event.title}</strong></div>
                          <span className={`flight-status ${delayed ? "delayed" : "on-time"}`}>{event.status || "Scheduled"}</span>
                        </div>
                        <div className="flight-route">
                          <div><strong>{details?.origin || "ORG"}</strong><span>{details?.estimatedDeparture || event.time}</span></div>
                          <div className="route-path"><span>✈</span></div>
                          <div><strong>{details?.destination || "DST"}</strong><span>{details?.estimatedArrival || "TBD"}</span></div>
                        </div>
                        <div className="flight-facts">
                          <div><small>GATES</small><strong>{details ? `${details.gate || "TBD"} → ${details.arrivalGate || "TBD"}` : "TBD"}</strong></div>
                          <div><small>TERMINALS</small><strong>{details ? `${details.departureTerminal} → ${details.arrivalTerminal}` : "TBD"}</strong></div>
                          <div><small>DELAY</small><strong className={delayed ? "delay-text" : ""}>{delayed ? `${details?.delayMinutes} min` : "None"}</strong></div>
                          <div><small>BAGGAGE</small><strong>{details?.baggageClaim || "TBD"}</strong></div>
                        </div>
                        <div className="flight-card-footer">
                          <span>{tripDay.short} {tripDay.date} · Updated {details?.lastUpdated || "when added"}</span>
                          <div className="live-flight-actions">
                            <button
                              className="live-refresh-button"
                              disabled={!details || liveUpdating === `trip:${event.id || event.title}`}
                              onClick={() => void refreshTrackedFlight(event)}
                            >
                              {liveUpdating === `trip:${event.id || event.title}` ? "Refreshing…" : "↻ Live update"}
                            </button>
                            <button onClick={() => openFlightDetails(event)}>View details →</button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="flight-empty">
                  <span>✈</span>
                  <h3>No flights tracked yet</h3>
                  <p>Add a flight to the selected itinerary day and keep its travel-day details together.</p>
                  <button className="primary-action tracker-add" onClick={() => openMutationPanel("track-flight")}>Track your first flight</button>
                </div>
              )}
              <p className="tracker-note">Live updates come from AeroDataBox, with AviationStack as a backup, and are saved to Firebase for your other devices.</p>
            </div>
          )}

          {activeNav === "Guest Flights" && (
            <div className="flight-tracker view-fade">
              <div className="tracker-heading">
                <div>
                  <span className="eyebrow">FRIENDS & FAMILY</span>
                  <h2>Guest Flight Watch</h2>
                  <p>Keep a separate watchlist for the people you are meeting, picking up, or traveling alongside.</p>
                </div>
                <button className="primary-action tracker-add" onClick={() => { setSelectedGuestFlight(null); openMutationPanel("guest-flight"); }}>＋ Add guest flight</button>
              </div>

              {delayedGuestFlights.length > 0 && (
                <div className="delay-alert" role="status">
                  <strong>{delayedGuestFlights.length === 1 ? "Guest flight delayed" : `${delayedGuestFlights.length} guest flights delayed`}</strong>
                  <span>{delayedGuestFlights.map((entry) => `${entry.guestName}: ${entry.flight.number} · ${entry.flight.delayMinutes} min`).join("  •  ")}</span>
                </div>
              )}

              {guestFlights.length > 0 ? (
                <div className="flight-card-grid">
                  {guestFlights.map((entry) => {
                    const delayed = entry.flight.delayMinutes > 0 || entry.status.toLowerCase() === "delayed";
                    return (
                      <article className={`flight-tracker-card guest-flight-card ${delayed ? "has-delay" : ""}`} key={entry.id}>
                        <div className="guest-flight-owner"><span>{entry.guestName.slice(0, 2).toUpperCase()}</span><div><strong>{entry.guestName}</strong><small>{entry.note}</small></div></div>
                        <div className="flight-card-topline">
                          <div><span>{entry.flight.airline}</span><strong>{entry.flight.number}</strong></div>
                          <span className={`flight-status ${delayed ? "delayed" : "on-time"}`}>{entry.status}</span>
                        </div>
                        <div className="flight-route">
                          <div><strong>{entry.flight.origin}</strong><span>{entry.flight.estimatedDeparture}</span></div>
                          <div className="route-path"><span>✈</span></div>
                          <div><strong>{entry.flight.destination}</strong><span>{entry.flight.estimatedArrival}</span></div>
                        </div>
                        <div className="flight-facts">
                          <div><small>GATES</small><strong>{entry.flight.gate} → {entry.flight.arrivalGate || "TBD"}</strong></div>
                          <div><small>TERMINALS</small><strong>{entry.flight.departureTerminal} → {entry.flight.arrivalTerminal}</strong></div>
                          <div><small>DELAY</small><strong className={delayed ? "delay-text" : ""}>{entry.flight.delayMinutes ? `${entry.flight.delayMinutes} min` : "None"}</strong></div>
                          <div><small>UPDATED</small><strong>{entry.flight.lastUpdated}</strong></div>
                        </div>
                        <div className="guest-flight-actions">
                          <button
                            className="live-refresh-button"
                            disabled={liveUpdating === `guest:${entry.id}`}
                            onClick={() => void refreshGuestFlight(entry)}
                          >
                            {liveUpdating === `guest:${entry.id}` ? "Refreshing…" : "↻ Live update"}
                          </button>
                          <button onClick={() => { setSelectedGuestFlight(entry); openMutationPanel("guest-flight"); }}>Update details</button>
                          <button className="danger-link" onClick={() => deleteGuestFlight(entry.id)}>Remove</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="flight-empty">
                  <span>◎</span>
                  <h3>No guest flights watched yet</h3>
                  <p>Add a friend or family member’s flight to see their gate, times, and delay status separately from your itinerary.</p>
                  <button className="primary-action tracker-add" onClick={() => { setSelectedGuestFlight(null); openMutationPanel("guest-flight"); }}>Watch a guest flight</button>
                </div>
              )}
              <p className="tracker-note">AeroDataBox supplies live operational updates, falling back to AviationStack; JourneySync saves the latest result to your Firebase account.</p>
            </div>
          )}

          {activeNav === "Itinerary" && (
            <div className="dashboard-grid view-fade">
              <section className="itinerary-panel">
                <div className="section-heading">
                  <div><span>YOUR ITINERARY</span><h2>Day by day</h2></div>
                  <div className="heading-actions">
                    <button onClick={() => openMutationPanel("day")}>＋ Add day</button>
                    <button onClick={() => openMutationPanel("item")}>＋ Add item</button>
                  </div>
                </div>

                <div className="day-tabs" role="tablist" aria-label="Trip days">
                  {itineraryDays.map((item, index) => (
                    <button
                      role="tab"
                      aria-selected={activeDay === index}
                      className={activeDay === index ? "selected" : ""}
                      key={item.id || item.date}
                      onClick={() => setActiveDay(index)}
                    >
                      <small>{item.short}</small><strong>{item.date}</strong>
                    </button>
                  ))}
                  <button className="more-days" onClick={() => openMutationPanel("day")}>
                    <small>ADD</small><strong>+</strong>
                  </button>
                </div>

                <div className="day-title" style={{ position: "relative" }}>
                  <div><strong>Day {activeDay + 1}</strong><span>{day.label}</span></div>
                  <button aria-label="Day options" onClick={() => setDayDropdownOpen(!dayDropdownOpen)}>•••</button>
                  
                  {dayDropdownOpen && (
                    <div className="dropdown-menu">
                      <button className="dropdown-item" onClick={() => { setDayDropdownOpen(false); openMutationPanel("edit-day"); }}>Edit Day Title</button>
                      <button className="dropdown-item danger" onClick={deleteCurrentDay}>Delete Day</button>
                    </div>
                  )}
                </div>

                <div className="timeline">
                  {day.events.length === 0 && (
                    <button className="empty-day" onClick={() => openMutationPanel("item")}>
                      ＋ Add your first plan for this day
                    </button>
                  )}
                  {day.events.map((event, index) => (
                    <article className="timeline-item" key={event.id || `${event.time}-${event.title}`}>
                      <time>{event.time}</time>
                      <div className={`event-icon ${event.kind}`}>{iconFor[event.kind]}</div>
                      <button 
                        className="event-card" 
                        onClick={() => {
                          setSelectedEvent(event);
                          openMutationPanel("edit-item");
                        }}
                      >
                        <span>
                          <strong>{event.title}</strong>
                          <small>{event.meta}</small>
                        </span>
                        {event.status && <em>{event.status}</em>}
                        <b>›</b>
                      </button>
                      {index < day.events.length - 1 && <i className="timeline-line" />}
                    </article>
                  ))}
                </div>
              </section>

              <aside className="right-rail">
                <section className="weather-card" onClick={() => setPlannerOpen("weather")} style={{ cursor: "pointer" }}>
                  <div>
                    <small>{dynamicWeatherForecast.destination.toUpperCase()} · {dynamicWeatherForecast.days[0]?.day || "LIVE WEATHER"}</small>
                    <strong>{currentWeatherLoading ? "Loading…" : dynamicWeatherForecast.days[0]?.temp || "Unavailable"}</strong>
                    <span>{currentWeatherError || dynamicWeatherForecast.days[0]?.desc || "Choose a city in trip details"}</span>
                  </div>
                  <div className="sun-cloud"><i>{dynamicWeatherForecast.days[0]?.icon || "🌐"}</i><b>☁</b></div>
                  <div className="weather-meta"><span>H {dynamicWeatherForecast.days[0]?.high || "—"}</span><span>L {dynamicWeatherForecast.days[0]?.low || "—"}</span><span>Precip. {dynamicWeatherForecast.days[0]?.rain || "—"}</span></div>
                </section>

                <section className="expense-card">
                  <div className="rail-heading">
                    <span>GROUP EXPENSES</span>
                    <button onClick={() => openMutationPanel("expense")}>＋</button>
                  </div>
                  <strong className="expense-total">{tripCurrency} {totalExpenseAmount.toFixed(2)}</strong>
                  <small>Total spent so far</small>
                  <div className="balances">
                    {expenseBalances.slice(0, 2).map((person) => (
                      <div key={person.email}>
                        <span className={`avatar ${person.bg}`}>{person.avatar}</span>
                        <p><strong>{person.name.split(" ")[0]}</strong><small>{person.balance >= 0 ? "is owed" : "owes"}</small></p>
                        <b className={person.balance >= 0 ? "positive" : "negative"}>{person.balance >= 0 ? "+" : "-"} {tripCurrency} {Math.abs(person.balance).toFixed(2)}</b>
                      </div>
                    ))}
                  </div>
                  <button className="text-link" onClick={() => setActiveNav("Expenses")}>View all balances <span>→</span></button>
                </section>

                <section className="wallet-card">
                  <div className="rail-heading">
                    <span>TRIP WALLET</span>
                    <small>{walletDocs.length} items</small>
                  </div>
                  {walletDocs.slice(0, 2).map((doc) => (
                    <button key={doc.id} onClick={() => {
                      navigator.clipboard.writeText(doc.code);
                      notify(`Copied ${doc.title} code: ${doc.code}`);
                    }}>
                      <i className={`doc-icon ${doc.coralIcon ? "coral" : ""}`}>{doc.icon}</i>
                      <span>
                        <strong>{doc.title}</strong>
                        <small>{doc.meta}</small>
                      </span>
                      <b>›</b>
                    </button>
                  ))}
                  <button className="text-link" onClick={() => setActiveNav("Wallet")} style={{ marginTop: "8px" }}>Manage Wallet Passes <span>→</span></button>
                </section>
              </aside>
            </div>
          )}

          {activeNav === "Map" && (
            <div className="map-view-container view-fade">
              <div className="section-heading">
                <div><span>INTERACTIVE TRIP MAP</span><h2>Route & Destinations</h2></div>
                <button onClick={() => openMutationPanel("map-pin")}>＋ Add Pin</button>
              </div>

              <TripMap
                location={[tripCity, tripRegion, tripCountry].filter(Boolean).join(", ")}
                countryCode={inferredCountryCode}
                center={mapCenter}
                points={mapPoints}
                selectedName={selectedMapPin}
                onSelect={setSelectedMapPin}
              />

              {mapPins.length > 0 && (
                <div className="map-place-list" aria-label="Saved map places">
                  {mapPins.map((pin, idx) => (
                    <button
                      type="button"
                      className={selectedMapPin === pin.name ? "selected" : ""}
                      key={`${pin.name}-${idx}`}
                      onClick={() => setSelectedMapPin(pin.name)}
                    >
                      <span>{pin.code}</span>{pin.name}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginTop: "24px", background: "white", padding: "20px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                <h3 style={{ margin: "0 0 8px", fontFamily: "Georgia, serif" }}>Destination Focus: {selectedMapPin || tripCity}</h3>
                <p style={{ margin: "0 0 14px", fontSize: "11px", color: "#64748b" }}>
                  {mapPins.find((p) => p.name === selectedMapPin)?.desc || `Explore highlights, activities, and dining in ${tripCity}.`}
                </p>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <a
                    className="primary-action"
                    style={{ width: "auto", padding: "8px 16px", textDecoration: "none" }}
                    href={`https://www.openstreetmap.org/search?query=${encodeURIComponent([selectedMapPin || tripCity, tripRegion, tripCountry].filter(Boolean).join(", "))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in OpenStreetMap
                  </a>
                  <button className="secondary-action" style={{ width: "auto", margin: 0, padding: "8px 16px" }} onClick={() => setActiveNav("Itinerary")}>View Day Plans</button>
                </div>
              </div>
            </div>
          )}

          {activeNav === "Expenses" && (
            <div className="expenses-view-container view-fade">
              <div>
                <div className="section-heading">
                  <div><span>GROUP EXPENSES</span><h2>All Transactions</h2></div>
                  <button onClick={() => openMutationPanel("expense")}>＋ Add Expense</button>
                </div>

                <div className="expense-list">
                  {expenses.map((exp) => (
                    <div className="expense-item-row" key={exp.id} style={{ opacity: exp.settled ? 0.6 : 1 }}>
                      <div className="expense-item-info">
                        <strong>
                          {exp.description} {exp.settled && <span style={{ fontSize: "10px", background: "#e2e8f0", color: "#475569", padding: "2px 6px", borderRadius: "4px", marginLeft: "6px", fontWeight: "normal" }}>Settled</span>}
                        </strong>
                        <small>Paid by {exp.paidBy} · {exp.date} · {exp.category}</small>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div className="expense-item-amount">
                          {exp.currency} {exp.amount.toFixed(2)}
                          <small>Split {travelersList.length} ways</small>
                        </div>
                        <button style={{ border: 0, background: "transparent", color: "var(--danger)", cursor: "pointer", fontSize: "14px" }} onClick={() => deleteExpense(exp.id)}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="right-rail">
                <section className="expense-card" style={{ background: "white" }}>
                  <div className="rail-heading"><span>BALANCE SUMMARY</span></div>
                  <strong className="expense-total">{tripCurrency} {totalExpenseAmount.toFixed(2)}</strong>
                  <small>Total spent across all categories</small>

                  <div className="balances" style={{ marginTop: "16px" }}>
                    {expenseBalances.map((person) => (
                      <div key={person.email}>
                        <span className={`avatar ${person.bg}`}>{person.avatar}</span>
                        <p><strong>{person.name}</strong><small>Paid total {tripCurrency} {person.paid.toFixed(2)}</small></p>
                        <b className={person.balance >= 0 ? "positive" : "negative"}>{person.balance >= 0 ? "+" : "-"} {tripCurrency} {Math.abs(person.balance).toFixed(2)}</b>
                      </div>
                    ))}
                  </div>

                  <button className="primary-action" style={{ marginTop: "16px" }} onClick={() => openMutationPanel("settle")}>Settle Balances</button>
                </section>
              </aside>
            </div>
          )}

          {activeNav === "Wallet" && (
            <div className="wallet-view view-fade">
              <div className="section-heading">
                <div><span>TRIP WALLET</span><h2>Tickets, Passes & Documents</h2></div>
                <button onClick={() => openMutationPanel("pass")}>＋ Add Pass</button>
              </div>

              <div className="wallet-grid">
                {walletDocs.map((doc) => (
                  <div className="wallet-doc-card" key={doc.id}>
                    <div className="wallet-doc-header">
                      <i className={`doc-icon ${doc.coralIcon ? "coral" : ""}`}>{doc.icon}</i>
                      <div>
                        <strong style={{ fontSize: "12px", display: "block" }}>{doc.title}</strong>
                        <small style={{ fontSize: "9px", color: "#64748b" }}>{doc.meta}</small>
                      </div>
                    </div>

                    <div style={{ background: "#f8fafc", padding: "8px", borderRadius: "6px", fontSize: "10px", fontFamily: "monospace" }}>
                      Code: {doc.code}
                    </div>

                    <div className="wallet-doc-actions">
                      <button onClick={() => {
                        navigator.clipboard.writeText(doc.code);
                        notify(`Copied ticket code: ${doc.code}`);
                      }}>Copy Code</button>
                      <button style={{ color: "var(--danger)" }} onClick={() => deleteWalletDoc(doc.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ALL MODALS */}

      {/* Auth Modal */}
      {authModalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setAuthModalOpen(false)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button className="modal-close" onClick={() => setAuthModalOpen(false)} aria-label="Close account dialog">×</button>
            <span className="eyebrow">FIREBASE ACCOUNT</span>
            <h2>{user ? "Your Profile" : (authMode === "login" ? "Sign in to JourneySync" : "Create your Account")}</h2>

            {user ? (
              <div>
                <div className="auth-success" role="status">
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>You’re signed in</strong>
                    <small>Your Firebase session stays active when you return.</small>
                  </div>
                </div>
                <p style={{ fontSize: "11px", color: "#475569", marginBottom: "16px" }}>
                  Signed in as <strong>{user.email}</strong>
                </p>
                <div className={`auth-sync-status ${cloudReady && synced ? "is-synced" : "is-paused"}`}>
                  <strong>{!profileReady ? "Loading your profile" : !cloudReady ? "Saved on this device" : synced ? "Cloud sync is active" : "Saving changes"}</strong>
                  <small>{!profileReady ? "JourneySync is checking Firebase for your trips." : !cloudReady ? "Firebase is unavailable. Your account-specific device copy will sync after reconnecting." : synced ? "Your itinerary is backed up to Firestore." : "Your device copy is safe while JourneySync finishes the Firestore update."}</small>
                </div>
                {authError && <div className="auth-error" role="alert">{authError}</div>}
                <button className="danger-action" onClick={handleLogOut} disabled={authLoading}>
                  {authLoading ? "Signing out…" : "Sign Out"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit}>
                <div className="auth-tabs">
                  <button type="button" className={`auth-tab ${authMode === "login" ? "active" : ""}`} onClick={() => { setAuthMode("login"); setAuthError(""); }} disabled={authLoading}>Sign In</button>
                  <button type="button" className={`auth-tab ${authMode === "signup" ? "active" : ""}`} onClick={() => { setAuthMode("signup"); setAuthError(""); }} disabled={authLoading}>Register</button>
                </div>

                <label>Email Address
                  <input type="email" value={authEmail} onChange={(e) => { setAuthEmail(e.target.value); setAuthError(""); }} required placeholder="you@example.com" autoComplete="email" disabled={authLoading} />
                </label>

                <label>Password
                  <input type="password" value={authPassword} onChange={(e) => { setAuthPassword(e.target.value); setAuthError(""); }} required placeholder="••••••••" autoComplete={authMode === "login" ? "current-password" : "new-password"} disabled={authLoading} />
                </label>

                {authError && <div className="auth-error" role="alert">{authError}</div>}

                <button className="primary-action" type="submit" disabled={authLoading || authChecking}>
                  {authLoading ? "Connecting to Firebase…" : authChecking ? "Checking account…" : authMode === "login" ? "Sign In with Email" : "Create Account"}
                </button>

                <div className="auth-divider">OR</div>

                <button type="button" className="google-btn" onClick={handleGoogleAuth} disabled={authLoading || authChecking}>
                  {authLoading ? "Please wait…" : "Continue with Google"}
                </button>
                <p className="auth-help">The dialog stays open until Firebase confirms your account.</p>
              </form>
            )}
          </section>
        </div>
      )}

      {/* Flight Details Modal */}
      {plannerOpen === "flight" && (
        <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
          <section className="modal flight-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Flight details">
            <button className="modal-close" onClick={() => setPlannerOpen(null)}>×</button>
            <span className="eyebrow">FLIGHT DETAILS</span>
            {selectedFlight ? (
              <>
                <div className="flight-modal-title">
                  <h2>{selectedFlight.flight?.airline || "Flight"} {selectedFlight.flight?.number || selectedFlight.title}</h2>
                  <span className={`flight-status ${(selectedFlight.flight?.delayMinutes || 0) > 0 ? "delayed" : "on-time"}`}>{selectedFlight.status || "Scheduled"}</span>
                </div>
                <div className="flight-modal-route">
                  <div><strong>{selectedFlight.flight?.origin || "ORG"}</strong><span>Terminal {selectedFlight.flight?.departureTerminal || "TBD"}</span></div>
                  <span>✈</span>
                  <div><strong>{selectedFlight.flight?.destination || "DST"}</strong><span>Terminal {selectedFlight.flight?.arrivalTerminal || "TBD"}</span></div>
                </div>
                <div className="flight-detail-list">
                  <div><span>Scheduled departure</span><strong>{selectedFlight.flight?.scheduledDeparture || selectedFlight.time}</strong></div>
                  <div><span>Estimated departure</span><strong>{selectedFlight.flight?.estimatedDeparture || selectedFlight.time}</strong></div>
                  <div><span>Scheduled arrival</span><strong>{selectedFlight.flight?.scheduledArrival || "TBD"}</strong></div>
                  <div><span>Estimated arrival</span><strong>{selectedFlight.flight?.estimatedArrival || "TBD"}</strong></div>
                  <div><span>Gate</span><strong>{selectedFlight.flight?.gate || "TBD"}</strong></div>
                  <div><span>Delay</span><strong>{selectedFlight.flight?.delayMinutes ? `${selectedFlight.flight.delayMinutes} minutes` : "No delay"}</strong></div>
                  <div><span>Baggage claim</span><strong>{selectedFlight.flight?.baggageClaim || "TBD"}</strong></div>
                  <div><span>Last updated</span><strong>{selectedFlight.flight?.lastUpdated || "Not yet updated"}</strong></div>
                </div>
                <button className="primary-action" onClick={() => {
                  if (!requireSignIn("update flight details")) return;
                  setPlannerOpen("flight-edit");
                }}>Update Flight Details</button>
                <button className="secondary-action" onClick={() => { setPlannerOpen(null); setActiveNav("Flight Tracker"); }}>Open Flight Tracker</button>
              </>
            ) : (
              <>
                <h2>No tracked flight</h2>
                <p className="modal-copy">Add a flight to your itinerary to track its gate, schedule, and delay details.</p>
                <button className="primary-action" onClick={() => openMutationPanel("track-flight")}>Track a flight</button>
              </>
            )}
          </section>
        </div>
      )}

      {plannerOpen === "flight-edit" && selectedFlight && (
        <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
          <section className="modal flight-edit-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Update flight details">
            <button className="modal-close" onClick={() => setPlannerOpen(null)}>×</button>
            <form onSubmit={saveFlightDetails}>
              <span className="eyebrow">UPDATE FLIGHT</span>
              <h2>{selectedFlight.flight?.number || selectedFlight.title}</h2>
              <div className="form-row">
                <label>Airline<input name="airline" defaultValue={selectedFlight.flight?.airline || ""} required /></label>
                <label>Flight number<input name="number" defaultValue={selectedFlight.flight?.number || ""} required /></label>
              </div>
              <div className="form-row">
                <label>Origin<input name="origin" maxLength={3} defaultValue={selectedFlight.flight?.origin || ""} required /></label>
                <label>Destination<input name="destination" maxLength={3} defaultValue={selectedFlight.flight?.destination || ""} required /></label>
              </div>
              <label>Local departure date<input name="departureDate" type="date" defaultValue={selectedFlight.flight?.departureDate || ""} required /></label>
              <div className="form-row">
                <label>Departure terminal<input name="departureTerminal" defaultValue={selectedFlight.flight?.departureTerminal || "TBD"} /></label>
                <label>Arrival terminal<input name="arrivalTerminal" defaultValue={selectedFlight.flight?.arrivalTerminal || "TBD"} /></label>
              </div>
              <div className="form-row">
                <label>Gate<input name="gate" defaultValue={selectedFlight.flight?.gate || "TBD"} /></label>
                <label>Arrival gate<input name="arrivalGate" defaultValue={selectedFlight.flight?.arrivalGate || "TBD"} /></label>
              </div>
              <div className="form-row">
                <label>Status<select name="status" defaultValue={selectedFlight.status || "Scheduled"}><option>Scheduled</option><option>On time</option><option>Boarding</option><option>Delayed</option><option>Departed</option><option>Landed</option><option>Cancelled</option></select></label>
                <span />
              </div>
              <div className="form-row">
                <label>Scheduled departure<input name="scheduledDeparture" defaultValue={selectedFlight.flight?.scheduledDeparture || selectedFlight.time} /></label>
                <label>Estimated departure<input name="estimatedDeparture" defaultValue={selectedFlight.flight?.estimatedDeparture || selectedFlight.time} /></label>
              </div>
              <div className="form-row">
                <label>Scheduled arrival<input name="scheduledArrival" defaultValue={selectedFlight.flight?.scheduledArrival || "TBD"} /></label>
                <label>Estimated arrival<input name="estimatedArrival" defaultValue={selectedFlight.flight?.estimatedArrival || "TBD"} /></label>
              </div>
              <div className="form-row">
                <label>Delay in minutes<input name="delayMinutes" type="number" min="0" defaultValue={selectedFlight.flight?.delayMinutes || 0} /></label>
                <label>Baggage claim<input name="baggageClaim" defaultValue={selectedFlight.flight?.baggageClaim || "TBD"} /></label>
              </div>
              <button className="primary-action">Save Flight Status</button>
            </form>
          </section>
        </div>
      )}

      {plannerOpen === "track-flight" && (
        <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Track a flight">
            <button className="modal-close" onClick={() => setPlannerOpen(null)}>×</button>
            <form onSubmit={addTrackedFlight}>
              <span className="eyebrow">FLIGHT TRACKER</span>
              <h2>Add a flight</h2>
              <p className="modal-copy">This flight will be added to Day {activeDay + 1} of {tripName}.</p>
              <div className="form-row">
                <label>Airline<input name="airline" placeholder="e.g. SWISS" required autoFocus /></label>
                <label>Flight number<input name="number" placeholder="e.g. LX 017" required /></label>
              </div>
              <div className="form-row">
                <label>Origin<input name="origin" placeholder="JFK" maxLength={3} required /></label>
                <label>Destination<input name="destination" placeholder="ZRH" maxLength={3} required /></label>
              </div>
              <label>Local departure date<input name="departureDate" type="date" defaultValue={activeTrip?.startDate || ""} required /></label>
              <div className="form-row">
                <label>Departure<input name="departure" type="time" required /></label>
                <label>Arrival<input name="arrival" type="time" required /></label>
              </div>
              <button className="primary-action">Add to Flight Tracker</button>
            </form>
          </section>
        </div>
      )}

      {plannerOpen === "guest-flight" && (
        <div className="modal-backdrop" onMouseDown={() => { setPlannerOpen(null); setSelectedGuestFlight(null); }}>
          <section className="modal flight-edit-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Guest flight details">
            <button className="modal-close" onClick={() => { setPlannerOpen(null); setSelectedGuestFlight(null); }}>×</button>
            <form onSubmit={saveGuestFlight}>
              <span className="eyebrow">FRIENDS & FAMILY</span>
              <h2>{selectedGuestFlight ? "Update guest flight" : "Watch a guest flight"}</h2>
              <div className="form-row">
                <label>Guest name<input name="guestName" defaultValue={selectedGuestFlight?.guestName || ""} placeholder="e.g. Amelia" required autoFocus /></label>
                <label>Note<input name="note" defaultValue={selectedGuestFlight?.note || ""} placeholder="e.g. Airport pickup" /></label>
              </div>
              <div className="form-row">
                <label>Airline<input name="airline" defaultValue={selectedGuestFlight?.flight.airline || ""} placeholder="e.g. Delta" required /></label>
                <label>Flight number<input name="number" defaultValue={selectedGuestFlight?.flight.number || ""} placeholder="e.g. DL 104" required /></label>
              </div>
              <div className="form-row">
                <label>Origin<input name="origin" defaultValue={selectedGuestFlight?.flight.origin || ""} maxLength={3} placeholder="JFK" required /></label>
                <label>Destination<input name="destination" defaultValue={selectedGuestFlight?.flight.destination || ""} maxLength={3} placeholder="LHR" required /></label>
              </div>
              <label>Local departure date<input name="departureDate" type="date" defaultValue={selectedGuestFlight?.flight.departureDate || activeTrip?.startDate || ""} required /></label>
              <div className="form-row">
                <label>Scheduled departure<input name="departure" defaultValue={selectedGuestFlight?.flight.scheduledDeparture || ""} placeholder="8:40 PM" required /></label>
                <label>Estimated departure<input name="estimatedDeparture" defaultValue={selectedGuestFlight?.flight.estimatedDeparture || ""} placeholder="9:10 PM" /></label>
              </div>
              <div className="form-row">
                <label>Scheduled arrival<input name="arrival" defaultValue={selectedGuestFlight?.flight.scheduledArrival || ""} placeholder="10:15 AM" required /></label>
                <label>Estimated arrival<input name="estimatedArrival" defaultValue={selectedGuestFlight?.flight.estimatedArrival || ""} placeholder="10:45 AM" /></label>
              </div>
              <div className="form-row">
                <label>Departure terminal<input name="departureTerminal" defaultValue={selectedGuestFlight?.flight.departureTerminal || "TBD"} /></label>
                <label>Arrival terminal<input name="arrivalTerminal" defaultValue={selectedGuestFlight?.flight.arrivalTerminal || "TBD"} /></label>
              </div>
              <div className="form-row">
                <label>Gate<input name="gate" defaultValue={selectedGuestFlight?.flight.gate || "TBD"} /></label>
                <label>Arrival gate<input name="arrivalGate" defaultValue={selectedGuestFlight?.flight.arrivalGate || "TBD"} /></label>
              </div>
              <div className="form-row">
                <label>Status<select name="status" defaultValue={selectedGuestFlight?.status || "Scheduled"}><option>Scheduled</option><option>On time</option><option>Boarding</option><option>Delayed</option><option>Departed</option><option>Landed</option><option>Cancelled</option></select></label>
                <span />
              </div>
              <div className="form-row">
                <label>Delay in minutes<input name="delayMinutes" type="number" min="0" defaultValue={selectedGuestFlight?.flight.delayMinutes || 0} /></label>
                <label>Baggage claim<input name="baggageClaim" defaultValue={selectedGuestFlight?.flight.baggageClaim || "TBD"} /></label>
              </div>
              <button className="primary-action">{selectedGuestFlight ? "Save Guest Flight Update" : "Add to Guest Watch"}</button>
            </form>
          </section>
        </div>
      )}

      {/* Weather 5-Day Forecast Modal */}
      {plannerOpen === "weather" && (
        <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPlannerOpen(null)}>×</button>
            <span className="eyebrow">5-DAY WEATHER FORECAST</span>
            <h2>{[dynamicWeatherForecast.destination, dynamicWeatherForecast.region].filter(Boolean).join(", ")}</h2>
            <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
              {currentWeatherLoading && <p>Loading the latest forecast…</p>}
              {!currentWeatherLoading && currentWeatherError && <div className="auth-error" role="alert">{currentWeatherError}</div>}
              {dynamicWeatherForecast.days.map((w) => (
                <div key={w.day} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderRadius: "6px", fontSize: "10px" }}>
                  <strong>{w.day}</strong>
                  <span>{w.icon} {w.desc} ({w.low}–{w.high})</span>
                  <small style={{ color: "#64748b" }}>Precip. {w.rain}</small>
                </div>
              ))}
            </div>
            {dynamicWeatherForecast.source && <small className="weather-source">Live forecast from {dynamicWeatherForecast.source}</small>}
            <button className="primary-action" onClick={() => setPlannerOpen(null)}>Close Weather</button>
          </section>
        </div>
      )}

      {/* Manage Travelers Modal */}
      {plannerOpen === "travelers" && (
        <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPlannerOpen(null)}>×</button>
            <span className="eyebrow">TRAVEL TEAM</span>
            <h2>Manage Trip Travelers ({travelersList.length})</h2>
            
            <div style={{ display: "grid", gap: "10px", marginBottom: "20px", maxHeight: "220px", overflowY: "auto" }}>
              {travelersList.map((t) => (
                <div key={t.email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                  <span className={`avatar ${t.bg}`}>{t.avatar}</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: "11px", display: "block" }}>{t.name}</strong>
                    <small style={{ fontSize: "9px", color: "#64748b" }}>{t.email} · {t.role}</small>
                  </div>
                  {travelersList.length > 1 && (
                    <button style={{ border: 0, background: "transparent", color: "var(--danger)", cursor: "pointer", fontSize: "13px" }} onClick={() => removeTraveler(t.email)} title="Remove traveler">×</button>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={(e) => { addTravelerSubmit(e); }} style={{ background: "#f1f5f9", padding: "12px", borderRadius: "8px", marginBottom: "16px", display: "grid", gap: "8px" }}>
              <strong style={{ fontSize: "11px" }}>＋ Invite New Traveler</strong>
              <div className="form-row">
                <input name="name" placeholder="Full Name" required style={{ fontSize: "11px", padding: "6px" }} />
                <input name="email" type="email" placeholder="Email Address" required style={{ fontSize: "11px", padding: "6px" }} />
              </div>
              <button className="primary-action" style={{ margin: 0, padding: "6px 12px", fontSize: "11px" }}>Add to Team</button>
            </form>

            <button className="secondary-action" onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              notify("Trip invite link copied to clipboard!");
            }}>
              Copy Invite Link
            </button>
          </section>
        </div>
      )}

      {/* Edit Day Title Modal */}
      {plannerOpen === "edit-day" && (
        <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPlannerOpen(null)}>×</button>
            <form onSubmit={editCurrentDay}>
              <span className="eyebrow">EDIT DAY</span>
              <h2>Day {activeDay + 1} Settings</h2>
              <label>Date
                <input name="date" type="date" defaultValue={day.isoDate || ""} />
              </label>
              <label>Day Title
                <input name="label" defaultValue={day.label} required autoFocus />
              </label>
              <button className="primary-action">Save Changes</button>
            </form>
          </section>
        </div>
      )}

      {/* Edit Event Modal */}
      {plannerOpen === "edit-item" && selectedEvent && (
        <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPlannerOpen(null)}>×</button>
            <form onSubmit={editItemSubmit}>
              <span className="eyebrow">EDIT ACTIVITY</span>
              <h2>Update Plan</h2>

              <label>Title
                <input name="title" defaultValue={selectedEvent.title} required autoFocus />
              </label>

              <div className="form-row">
                <label>Time
                  <input name="time" defaultValue={selectedEvent.time} />
                </label>
                <label>Category
                  <select name="kind" defaultValue={selectedEvent.kind}>
                    <option value="activity">Activity</option>
                    <option value="flight">Flight</option>
                    <option value="train">Train</option>
                    <option value="stay">Stay</option>
                    <option value="food">Food</option>
                  </select>
                </label>
              </div>

              <label>Details / Address
                <input name="details" defaultValue={selectedEvent.meta} />
              </label>

              <button className="primary-action" type="submit">Save Activity</button>
              <button className="danger-action" type="button" onClick={deleteSelectedEvent}>Delete Activity</button>
            </form>
          </section>
        </div>
      )}

      {/* Existing Dynamic Modals: Trip, Day, Item, Expense, Pass */}
      {plannerOpen && !["flight", "flight-edit", "track-flight", "guest-flight", "weather", "travelers", "edit-day", "edit-item", "trip-switcher", "map-pin", "settle"].includes(plannerOpen) && (
        <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
          <section className="modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <button className="modal-close" onClick={() => setPlannerOpen(null)}>×</button>

            {plannerOpen === "trip" && (
              <form onSubmit={createTrip}>
                <span className="eyebrow">NEW ITINERARY</span>
                <h2>Create any trip</h2>
                <label>Trip name<input name="name" placeholder="e.g. Spring break" required autoFocus /></label>
                <TripLocationFields />
                <TripDateFields />
                <div className="form-row">
                  <label>Travelers<input name="travelers" type="number" min="1" defaultValue="1" /></label>
                  <label>First day title<input name="firstDay" placeholder="e.g. Arrival" /></label>
                </div>
                <button className="primary-action">Create itinerary</button>
              </form>
            )}

            {plannerOpen === "trip-settings" && activeTrip && (
              <form onSubmit={editTripDetails}>
                <span className="eyebrow">TRIP SETTINGS</span>
                <h2>Edit trip details</h2>
                <label>Trip name<input name="name" defaultValue={activeTrip.name} required autoFocus /></label>
                <TripDateFields defaultStart={activeTrip.startDate} defaultEnd={activeTrip.endDate || activeTrip.startDate} />
                <TripLocationFields
                  key={`${activeTrip.id}-${activeTrip.countryCode || inferredCountryCode}-${activeTrip.regionCode || activeTrip.region}-${activeTrip.city}`}
                  defaultCountryCode={activeTrip.countryCode || inferredCountryCode}
                  defaultCountry={activeTrip.country || tripCountry}
                  defaultRegionCode={activeTrip.regionCode || countryByCode(activeTrip.countryCode || inferredCountryCode)?.regions.find((item) => item.name === activeTrip.region)?.code || ""}
                  defaultRegion={activeTrip.region || tripRegion}
                  defaultCity={activeTrip.city || tripCity}
                  defaultCurrency={tripCurrency}
                />
                <button className="primary-action">Save trip details</button>
              </form>
            )}

            {plannerOpen === "day" && (
              <form onSubmit={addDay}>
                <span className="eyebrow">ADD A DAY</span>
                <h2>Shape your itinerary</h2>
                <label>Date<input name="date" type="date" autoFocus /></label>
                <label>Day title<input name="label" placeholder="e.g. Beach day" required /></label>
                <button className="primary-action">Add day</button>
              </form>
            )}

            {plannerOpen === "item" && (
              <form onSubmit={addItem}>
                <span className="eyebrow">ADD TO DAY {activeDay + 1}</span>
                <h2>What are you planning?</h2>
                <label>Title<input name="title" placeholder="e.g. Dinner reservation" required autoFocus /></label>
                <div className="form-row">
                  <label>Time<input name="time" type="time" /></label>
                  <label>Type<select name="kind" defaultValue="activity"><option value="activity">Activity</option><option value="flight">Flight</option><option value="train">Train</option><option value="stay">Stay</option><option value="food">Food</option></select></label>
                </div>
                <label>Details<input name="details" placeholder="Location, confirmation, notes…" /></label>
                <button className="primary-action">Add to itinerary</button>
              </form>
            )}

            {plannerOpen === "expense" && (
              <form onSubmit={addExpenseSubmit}>
                <span className="eyebrow">GROUP EXPENSE</span>
                <h2>Add a shared cost</h2>
                <label>Description<input name="description" placeholder="e.g. Dinner reservation" required autoFocus /></label>
                <div className="form-row">
                  <label>Amount<input name="amount" defaultValue="186.00" inputMode="decimal" required /></label>
                  <label>Currency<input name="currency" value={tripCurrency} readOnly /></label>
                </div>
                <label>Paid by
                  <select name="paidBy" defaultValue={travelersList[0]?.name || "Organizer"}>
                    {travelersList.map((t) => (
                      <option key={t.email || t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </label>
                <label>Category<select name="category" defaultValue="Dining"><option>Dining</option><option>Transport</option><option>Activities</option><option>Lodging</option></select></label>
                <button className="primary-action">Split between {travelersList.length} traveler{travelersList.length === 1 ? "" : "s"}</button>
              </form>
            )}

            {plannerOpen === "pass" && (
              <form onSubmit={addPassSubmit}>
                <span className="eyebrow">ADD TO TRIP WALLET</span>
                <h2>Save Pass or Document</h2>
                <label>Document Title<input name="title" placeholder="e.g. Swiss Museum Pass" required autoFocus /></label>
                <label>Metadata / Type<input name="meta" placeholder="e.g. Mobile Ticket · PDF" required /></label>
                <div className="form-row">
                  <label>Ticket / Pass Code<input name="code" placeholder="e.g. SWISS-8842" required /></label>
                  <label>Badge Text<input name="icon" placeholder="e.g. SMP" maxLength={3} required /></label>
                </div>
                <button className="primary-action">Save to Trip Wallet</button>
              </form>
            )}
          </section>
        </div>
      )}

      {/* Trip Switcher Modal */}
      {plannerOpen === "trip-switcher" && (
        <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPlannerOpen(null)}>×</button>
            <span className="eyebrow">YOUR ITINERARIES</span>
            <h2>Switch active trips</h2>
            <div style={{ display: "grid", gap: "10px", marginBottom: "20px", maxHeight: "280px", overflowY: "auto" }}>
              {activeTrips.length === 0 && <p className="modal-copy">No active or upcoming trips. Open the trip dashboard to view Archived.</p>}
              {activeTrips.map((t) => (
                <div key={t.id} onClick={() => { setActiveTripId(t.id); setActiveDay(0); setPlannerOpen(null); notify(`Switched to "${t.name}"`); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: activeTripId === t.id ? "#fff7ed" : "#f8fafc", border: activeTripId === t.id ? "1.5px solid var(--coral)" : "1px solid var(--line)", borderRadius: "8px", cursor: "pointer" }}>
                  <div>
                    <strong style={{ fontSize: "13px", display: "block", color: activeTripId === t.id ? "var(--coral)" : "#0f172a" }}>{t.name} {activeTripId === t.id && "(Active)"}</strong>
                    <small style={{ fontSize: "10px", color: "#64748b" }}>{t.route} · {t.days.length} Days · {t.travelersCount} Travelers</small>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {activeTrips.length > 0 && (
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); archiveTrip(t.id); }}
                        style={{ border: 0, background: "transparent", color: "#64748b", cursor: "pointer", fontSize: "11px", padding: "4px" }}
                        title="Archive itinerary"
                      >
                        Archive
                      </button>
                    )}
                    <b style={{ fontSize: "16px", color: activeTripId === t.id ? "var(--coral)" : "#cbd5e1" }}>›</b>
                  </div>
                </div>
              ))}
            </div>
            <button className="primary-action" onClick={() => openMutationPanel("trip")}>＋ Create New Trip</button>
          </section>
        </div>
      )}

      {/* Add Map Pin Modal */}
      {plannerOpen === "map-pin" && (
        <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPlannerOpen(null)}>×</button>
            <form onSubmit={addMapPinSubmit}>
              <span className="eyebrow">NEW DESTINATION</span>
              <h2>Add Map Pin</h2>
              <label>Place Name<input name="name" placeholder="e.g. Lucerne" required autoFocus /></label>
              <div className="form-row">
                <label>Code (3 chars)<input name="code" placeholder="e.g. LCR" maxLength={3} required /></label>
                <label>Expected Temp<input name="temp" defaultValue="18°C" required /></label>
              </div>
              <label>Description<input name="desc" placeholder="e.g. Chapel Bridge & Old Town" required /></label>
              <button className="primary-action" disabled={liveUpdating === "map-pin"}>
                {liveUpdating === "map-pin" ? "Finding place…" : "Add Pin to Map"}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Settle Balances Modal */}
      {plannerOpen === "settle" && (
        <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPlannerOpen(null)}>×</button>
            <span className="eyebrow">DEBT SETTLEMENT</span>
            <h2>Settle All Group Expenses</h2>
            <p style={{ fontSize: "12px", color: "#475569", lineHeight: 1.5, marginBottom: "16px" }}>
              This will mark all current group transactions as settled and zero out the per-person balance calculations for <strong>{tripName}</strong>.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="primary-action" onClick={settleAllBalances}>Confirm & Zero Balances</button>
              <button className="secondary-action" style={{ margin: 0 }} onClick={() => setPlannerOpen(null)}>Cancel</button>
            </div>
          </section>
        </div>
      )}

      {pendingDeleteTrip && (
        <DeleteTripDialog trip={pendingDeleteTrip} onCancel={() => setPendingDeleteTripId(null)} onConfirm={confirmPermanentDelete} />
      )}

      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </main>
  );
}
