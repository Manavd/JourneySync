"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
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
  travelersCount: number;
  days: Day[];
  expenses: Expense[];
  walletDocs: WalletDoc[];
  mapPins: MapPin[];
  travelersList: Traveler[];
  guestFlights?: GuestFlight[];
};

const initialDays: Day[] = [
  {
    id: "day-1",
    date: "12",
    short: "SAT",
    label: "Arrival in Zürich",
    events: [
      {
        id: "ev-1",
        time: "8:40 AM",
        title: "Arrive at Zürich Airport",
        meta: "LX 017 · Terminal 2 · Gate E52",
        kind: "flight",
        status: "On time",
        flight: {
          number: "LX 017",
          airline: "SWISS",
          origin: "JFK",
          destination: "ZRH",
          departureDate: "2026-09-12",
          departureTerminal: "1",
          arrivalTerminal: "2",
          gate: "E52",
          scheduledDeparture: "8:40 PM",
          estimatedDeparture: "8:40 PM",
          scheduledArrival: "10:15 AM (+1)",
          estimatedArrival: "10:15 AM (+1)",
          delayMinutes: 0,
          baggageClaim: "Carousel 24",
          lastUpdated: "Just now",
        },
      },
      {
        id: "ev-2",
        time: "10:18 AM",
        title: "Train to Zürich HB",
        meta: "SBB · Platform 3 · 12 min",
        kind: "train",
      },
      {
        id: "ev-3",
        time: "11:00 AM",
        title: "Check in at Marktgasse Hotel",
        meta: "Niederdorf · Reservation JS-4821",
        kind: "stay",
      },
      {
        id: "ev-4",
        time: "7:30 PM",
        title: "Dinner at Kronenhalle",
        meta: "Rämistrasse 4 · Table for 4",
        kind: "food",
      },
    ],
  },
  {
    id: "day-2",
    date: "13",
    short: "SUN",
    label: "Old Town & Lake Zürich",
    events: [
      {
        id: "ev-5",
        time: "9:30 AM",
        title: "Coffee at MAME",
        meta: "Josefstrasse 160 · 12 min walk",
        kind: "food",
      },
      {
        id: "ev-6",
        time: "11:00 AM",
        title: "Old Town walking route",
        meta: "Lindenhof → Grossmünster · 3.2 km",
        kind: "activity",
      },
      {
        id: "ev-7",
        time: "2:15 PM",
        title: "Lake Zürich cruise",
        meta: "Bürkliplatz pier · Boarding 2:00 PM",
        kind: "activity",
      },
    ],
  },
  {
    id: "day-3",
    date: "14",
    short: "MON",
    label: "Onward to Interlaken",
    events: [
      {
        id: "ev-8",
        time: "8:02 AM",
        title: "Zürich HB to Interlaken Ost",
        meta: "IC 81 · Platform 31 · 1 change",
        kind: "train",
        status: "Platform 31",
      },
      {
        id: "ev-9",
        time: "11:30 AM",
        title: "Drop bags at Hotel Interlaken",
        meta: "Höheweg 74 · Room ready after 2 PM",
        kind: "stay",
      },
      {
        id: "ev-10",
        time: "3:00 PM",
        title: "Harder Kulm funicular",
        meta: "Return ticket saved in Wallet",
        kind: "activity",
      },
    ],
  },
  {
    id: "day-4",
    date: "15",
    short: "TUE",
    label: "Lauterbrunnen Valley",
    events: [
      {
        id: "ev-11",
        time: "8:35 AM",
        title: "Train to Lauterbrunnen",
        meta: "Platform 2B · 22 min",
        kind: "train",
      },
      {
        id: "ev-12",
        time: "10:00 AM",
        title: "Staubbach Falls trail",
        meta: "Pinned offline · Easy · 4.8 km",
        kind: "activity",
      },
      {
        id: "ev-13",
        time: "1:00 PM",
        title: "Lunch at Airtime Café",
        meta: "Shared list · 4 votes",
        kind: "food",
      },
    ],
  },
];

const initialExpenses: Expense[] = [
  { id: "exp-1", description: "Dinner at Kronenhalle", amount: 186.00, currency: "CHF", paidBy: "Manav", date: "Sep 12", category: "Dining" },
  { id: "exp-2", description: "Zürich HB Train Passes", amount: 42.40, currency: "CHF", paidBy: "Amelia", date: "Sep 12", category: "Transport" },
  { id: "exp-3", description: "Harder Kulm Funicular Tickets", amount: 120.20, currency: "CHF", paidBy: "Manav", date: "Sep 14", category: "Activities" },
  { id: "exp-4", description: "Coffee & Pastries at MAME", amount: 80.00, currency: "CHF", paidBy: "Noah", date: "Sep 13", category: "Dining" }
];

const initialWalletDocs: WalletDoc[] = [
  { id: "w-1", title: "Boarding pass", meta: "SWISS LX 017 · PDF", code: "LX-98421-ZRH", icon: "LX" },
  { id: "w-2", title: "Hotel confirmation", meta: "Marktgasse · PDF", code: "HTL-ZH-4821", icon: "M", coralIcon: true },
  { id: "w-3", title: "Harder Kulm Pass", meta: "Funicular Return · Mobile Ticket", code: "HK-PASS-991", icon: "HK" },
  { id: "w-4", title: "Swiss Travel Pass", meta: "8 Consecutive Days", code: "STP-2026-884", icon: "STP", coralIcon: true },
  { id: "w-5", title: "Travel Insurance", meta: "Allianz Global · Policy PDF", code: "AZ-981245-A", icon: "AZ" },
  { id: "w-6", title: "Interlaken Hotel", meta: "Höheweg 74 · Conf #4091", code: "INT-HOTEL-4091", icon: "IH" }
];

const initialTravelers: Traveler[] = [
  { name: "Manav S.", role: "Trip organizer", email: "manav@example.com", avatar: "MS", bg: "avatar-me" },
  { name: "Amelia L.", role: "Co-organizer", email: "amelia@example.com", avatar: "AL", bg: "peach" },
  { name: "Noah K.", role: "Traveler", email: "noah@example.com", avatar: "NK", bg: "blue" },
  { name: "Riya P.", role: "Traveler", email: "riya@example.com", avatar: "RP", bg: "green" },
];

const initialMapPins: MapPin[] = [
  { name: "Zürich", code: "ZRH", desc: "Arrival & Old Town", temp: "18°C" },
  { name: "Interlaken", code: "INT", desc: "Alpine Lakes & Funicular", temp: "16°C" },
  { name: "Lauterbrunnen", code: "LTB", desc: "Waterfalls & Valley Trail", temp: "15°C" },
  { name: "Zermatt", code: "ZMT", desc: "Matterhorn Peak", temp: "12°C" },
];

const initialTrip: Trip = {
  id: "swiss-escape",
  name: "Swiss Escape",
  route: "Zürich → Interlaken → Zermatt",
  startDate: "2026-09-12",
  travelersCount: 4,
  days: initialDays,
  expenses: initialExpenses,
  walletDocs: initialWalletDocs,
  mapPins: initialMapPins,
  travelersList: initialTravelers,
  guestFlights: [],
};

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

  // App Data State - Multi-Trip Architecture
  const [savedTrips, setSavedTrips] = useState<Trip[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("journeysync_all_trips");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.savedTrips) && parsed.savedTrips.length > 0) {
            return parsed.savedTrips;
          }
        }
      } catch { /* ignore */ }
    }
    return [initialTrip];
  });
  const [activeTripId, setActiveTripId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("journeysync_all_trips");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.activeTripId) return parsed.activeTripId;
        }
      } catch { /* ignore */ }
    }
    return "swiss-escape";
  });

  const activeTrip = useMemo(() => {
    return savedTrips.find((t) => t.id === activeTripId) || savedTrips[0] || initialTrip;
  }, [savedTrips, activeTripId]);

  const {
    name: tripName,
    route: tripRoute,
    travelersCount: tripTravelers,
    days: itineraryDays,
    expenses,
    walletDocs,
    mapPins,
    travelersList,
  } = activeTrip;
  const guestFlights = activeTrip.guestFlights || [];

  const [activeDay, setActiveDay] = useState(0);

  function updateActiveTrip(updater: (currentTrip: Trip) => Trip) {
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
  const [plannerOpen, setPlannerOpen] = useState<"trip" | "day" | "item" | "edit-item" | "edit-day" | "expense" | "pass" | "flight" | "flight-edit" | "track-flight" | "guest-flight" | "weather" | "travelers" | "trip-switcher" | "map-pin" | "settle" | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DayEvent | null>(null);
  const [selectedGuestFlight, setSelectedGuestFlight] = useState<GuestFlight | null>(null);
  const [liveUpdating, setLiveUpdating] = useState<string | null>(null);
  const [flightSearchMode, setFlightSearchMode] = useState<"route" | "number">("route");
  const [flightSearchResults, setFlightSearchResults] = useState<LiveFlightUpdate[]>([]);
  const [flightSearchBusy, setFlightSearchBusy] = useState(false);
  const [flightSearchError, setFlightSearchError] = useState("");
  const [dayDropdownOpen, setDayDropdownOpen] = useState(false);
  const [selectedMapPin, setSelectedMapPin] = useState<string>(() => mapPins[0]?.name || "Zürich");

  // Auth Listener & Firestore Sync
  useEffect(() => {
    let unsubscribeCloud = () => {};
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      unsubscribeCloud();
      unsubscribeCloud = () => {};
      setCloudReady(false);
      setUser(currentUser);
      setAuthChecking(false);
      if (currentUser) {
        setAuthError("");
        notify(`Welcome back, ${currentUser.displayName || currentUser.email}`);
        const docRef = doc(db, "users", currentUser.uid, "user_trips", "all_trips");
        unsubscribeCloud = onSnapshot(docRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Record<string, any> | undefined;
            if (data && data.savedTrips && Array.isArray(data.savedTrips) && data.savedTrips.length > 0) {
              const incomingTrips = data.savedTrips as Trip[];
              setSavedTrips((current) => JSON.stringify(current) === JSON.stringify(incomingTrips) ? current : incomingTrips);
              if (data.activeTripId) setActiveTripId(data.activeTripId as string);
            }
          }
          setCloudReady(true);
          setSynced(true);
        }, (error) => {
          console.error("Could not load Firestore trip data:", error);
          setSynced(false);
          notify("Cloud data could not load. Your local copy is still available.");
          setCloudReady(true);
        });
      } else {
        setCloudReady(false);
      }
    });
    return () => {
      unsubscribeCloud();
      unsubscribe();
    };
  }, []);

  // Sync to Firestore and LocalStorage whenever data changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("journeysync_all_trips", JSON.stringify({ savedTrips, activeTripId }));
      } catch { /* ignore */ }
    }
    if (user && cloudReady) {
      const syncData = async () => {
        setSynced(false);
        try {
          const docRef = doc(db, "users", user.uid, "user_trips", "all_trips");
          await setDoc(docRef, {
            savedTrips,
            activeTripId,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          setSynced(true);
        } catch (e) {
          console.error("Firestore sync error:", e);
          setSynced(false);
        }
      };
      syncData();
    }
  }, [user, cloudReady, savedTrips, activeTripId]);

  useEffect(() => {
    if (activeDay >= itineraryDays.length && itineraryDays.length > 0) {
      setActiveDay(0);
    }
  }, [activeDay, itineraryDays.length]);

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
      const paid = unsettled.filter(e => e.paidBy.toLowerCase().startsWith(t.name.split(" ")[0].toLowerCase())).reduce((a, b) => a + b.amount, 0);
      const totalPaidEver = expenses.filter(e => e.paidBy.toLowerCase().startsWith(t.name.split(" ")[0].toLowerCase())).reduce((a, b) => a + b.amount, 0);
      const balance = paid - perPerson;
      return { ...t, paid: totalPaidEver, balance };
    });
  }, [expenses, activeUnsettledAmount, travelersList]);

  // Compute trip date range from itinerary data and start date
  const tripDateRange = useMemo(() => {
    const startObj = new Date(activeTrip.startDate ? `${activeTrip.startDate}T12:00:00` : Date.now());
    const monthStr = new Intl.DateTimeFormat("en-US", { month: "long" }).format(startObj).toUpperCase();
    const yearStr = String(startObj.getFullYear() || 2026);
    if (itineraryDays.length === 0) return { startDate: "01", endDate: "01", month: monthStr, year: yearStr };
    const first = itineraryDays[0];
    const last = itineraryDays[itineraryDays.length - 1];
    return {
      startDate: first.date,
      endDate: last.date,
      month: monthStr,
      year: yearStr,
    };
  }, [itineraryDays, activeTrip.startDate]);

  // Compute dynamic weather forecast for the trip
  const dynamicWeatherForecast = useMemo(() => {
    const startObj = new Date(activeTrip.startDate ? `${activeTrip.startDate}T12:00:00` : Date.now());
    const dest = mapPins[0]?.name || tripName.split(" ")[0] || "Destination";
    const conditions = [
      { desc: "Partly Cloudy", icon: "☁", rain: "10%", offsetTemp: 0 },
      { desc: "Sunny", icon: "☀", rain: "0%", offsetTemp: 3 },
      { desc: "Light Showers", icon: "🌧", rain: "40%", offsetTemp: -2 },
      { desc: "Clear Air", icon: "☀", rain: "5%", offsetTemp: -1 },
      { desc: "Mostly Sunny", icon: "🌤", rain: "15%", offsetTemp: 1 },
    ];
    const baseTemp = parseInt(mapPins[0]?.temp || "18", 10) || 18;

    return {
      destination: dest,
      days: conditions.map((c, i) => {
        const d = new Date(startObj.getTime() + i * 86400000);
        const dayStr = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(d);
        return {
          day: dayStr,
          temp: `${baseTemp + c.offsetTemp}°C`,
          desc: c.desc,
          rain: c.rain,
          icon: c.icon
        };
      })
    };
  }, [activeTrip.startDate, mapPins, tripName]);

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
    if (user) return true;
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
    if (!requireSignIn("create a trip")) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "My Trip");
    const route = String(form.get("route") || "Custom Route");
    const start = String(form.get("start") || "");
    const travelersCount = Number(form.get("travelers") || 1);
    const date = start ? new Date(`${start}T12:00:00`) : new Date();

    const firstDay: Day = {
      id: "day-" + Date.now(),
      date: String(date.getDate()).padStart(2, "0"),
      short: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date).toUpperCase(),
      label: String(form.get("firstDay") || "Arrival"),
      events: [],
    };

    const routeParts = route.split(/→|->|,|-/).map((s) => s.trim()).filter(Boolean);
    const newPins: MapPin[] = (routeParts.length > 0 ? routeParts : [name]).slice(0, 5).map((loc, idx) => ({
      name: loc,
      code: loc.substring(0, 3).toUpperCase(),
      desc: idx === 0 ? "Starting point" : `Stop #${idx + 1} on route`,
      temp: `${Math.floor(Math.random() * 8) + 16}°C`,
    }));

    const defaultOrganizer: Traveler = {
      name: user ? (user.displayName || user.email?.split("@")[0] || "Organizer") : "Manav S.",
      role: "Trip organizer",
      email: user ? (user.email || "organizer@example.com") : "manav@example.com",
      avatar: (user ? (user.displayName || user.email || "MS") : "MS").slice(0, 2).toUpperCase(),
      bg: "avatar-me",
    };
    const newTravelers: Traveler[] = [defaultOrganizer];
    for (let i = 1; i < travelersCount; i++) {
      newTravelers.push({
        name: `Traveler ${i + 1}`,
        role: "Traveler",
        email: `traveler${i + 1}@example.com`,
        avatar: `T${i + 1}`,
        bg: ["peach", "blue", "green", "coral"][i % 4],
      });
    }

    const newTripObj: Trip = {
      id: "trip-" + Date.now(),
      name,
      route,
      startDate: start || date.toISOString().slice(0, 10),
      travelersCount,
      days: [firstDay],
      expenses: [],
      walletDocs: [],
      mapPins: newPins,
      travelersList: newTravelers,
      guestFlights: [],
    };

    setSavedTrips((prev) => [newTripObj, ...prev]);
    setActiveTripId(newTripObj.id);
    setActiveDay(0);
    setSelectedMapPin(newPins[0]?.name || name);
    setPlannerOpen(null);
    notify(`New itinerary "${name}" created!`);
  }

  function deleteTrip(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    if (!requireSignIn("delete a trip")) return;
    if (savedTrips.length <= 1) {
      notify("You must keep at least one itinerary!");
      return;
    }
    const target = savedTrips.find((t) => t.id === id);
    const newTrips = savedTrips.filter((t) => t.id !== id);
    setSavedTrips(newTrips);
    if (activeTripId === id && newTrips.length > 0) {
      setActiveTripId(newTrips[0].id);
      setActiveDay(0);
    }
    notify(`Itinerary "${target?.name || "Trip"}" deleted.`);
  }

  function addDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("add a day")) return;
    const form = new FormData(event.currentTarget);
    const entered = String(form.get("date") || "");
    const date = entered ? new Date(`${entered}T12:00:00`) : new Date(Date.now() + itineraryDays.length * 86400000);
    const newDay: Day = {
      id: "day-" + Date.now(),
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
    updateActiveTrip((trip) => ({
      ...trip,
      days: trip.days.map((d, index) => (index === activeDay ? { ...d, label: newLabel } : d)),
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
      id: "ev-" + Date.now(),
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
      id: `flight-${Date.now()}`,
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
      notify(`${live.flight.number} refreshed from AeroDataBox`);
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
      id: `flight-${Date.now()}`,
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
      id: selectedGuestFlight?.id || `guest-flight-${Date.now()}`,
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
      id: "exp-" + Date.now(),
      description: String(form.get("description") || "Expense"),
      amount,
      currency: String(form.get("currency") || "CHF"),
      paidBy: String(form.get("paidBy") || travelersList[0]?.name || "Organizer"),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      category: String(form.get("category") || "General"),
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
      id: "w-" + Date.now(),
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

  function addMapPinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireSignIn("add a map pin")) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "New Place");
    const code = String(form.get("code") || name.slice(0, 3)).toUpperCase();
    const temp = String(form.get("temp") || "18°C");
    const desc = String(form.get("desc") || "Route destination");

    updateActiveTrip((trip) => ({
      ...trip,
      mapPins: [...trip.mapPins, { name, code, temp, desc }],
    }));
    setSelectedMapPin(name);
    setPlannerOpen(null);
    notify(`${name} pin added to map!`);
  }

  function toggleSavePinOffline(pinName: string) {
    if (!requireSignIn("save a pin offline")) return;
    updateActiveTrip((trip) => ({
      ...trip,
      mapPins: trip.mapPins.map((p) => (p.name === pinName ? { ...p, savedOffline: !p.savedOffline } : p)),
    }));
    const pin = mapPins.find((p) => p.name === pinName);
    notify(`Offline map for ${pinName} ${pin?.savedOffline ? "removed" : "downloaded and saved"}!`);
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
            setSynced(!synced);
            localStorage.setItem("journeysync_all_trips", JSON.stringify({ savedTrips, activeTripId }));
            notify(synced ? "Offline cache refreshed" : "Trip saved for offline access");
          }}>
            <span className="download-icon">↓</span>
            <span>
              <strong>{synced ? "Available offline" : "Save for offline"}</strong>
              <small>{synced ? "Updated just now" : "Download trip"}</small>
            </span>
            <i>✓</i>
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
              <span className="avatar avatar-me">{user ? (user.displayName ? user.displayName.slice(0, 2).toUpperCase() : user.email?.slice(0, 2).toUpperCase()) : "MS"}</span>
              <i aria-hidden="true" />
            </span>
            <span>
              <strong>{user ? (user.displayName || user.email?.split("@")[0]) : "Manav S. (Guest)"}</strong>
              <small>{authChecking ? "Checking account…" : user ? (!cloudReady ? "Signed in · Loading cloud trips" : synced ? "Signed in · Cloud synced" : "Signed in · Sync paused") : "Click to sign in & sync"}</small>
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
            <span className="flag" onClick={() => setPlannerOpen("trip-switcher")} style={{ cursor: "pointer" }}>✦</span>
            <span onClick={() => setPlannerOpen("trip-switcher")} style={{ cursor: "pointer" }} title="Click to switch trips">
              <small>CURRENT TRIP ▾ ({savedTrips.length})</small>
              <strong>{tripName}</strong>
            </span>
            <button aria-label="Create a new trip" onClick={() => openMutationPanel("trip")} title="Create new itinerary">＋</button>
          </div>

          <div className="top-actions">
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
                <div className="notification-item">
                  <div className="notification-icon">✈</div>
                  <div>
                    <strong>Flight LX 017 Gate Assigned</strong>
                    <p style={{ margin: "2px 0 0", color: "#64748b" }}>Gate E52 confirmed for Departure at 8:40 AM.</p>
                  </div>
                </div>
                <div className="notification-item">
                  <div className="notification-icon">☀</div>
                  <div>
                    <strong>Zürich Weather Alert</strong>
                    <p style={{ margin: "2px 0 0", color: "#64748b" }}>Partly sunny, 18°C expected for your arrival date.</p>
                  </div>
                </div>
                <div className="notification-item">
                  <div className="notification-icon">💳</div>
                  <div>
                    <strong>Expense Split Added</strong>
                    <p style={{ margin: "2px 0 0", color: "#64748b" }}>Amelia paid CHF 42.40 for Zürich HB Passes.</p>
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
            </div>
            <div className="date-range">
              <span>{tripDateRange.startDate}</span>
              <div><small>{tripDateRange.month}</small><strong>{tripDateRange.year}</strong></div>
              <i>—</i>
              <span>{tripDateRange.endDate}</span>
              <div><small>{tripDateRange.month}</small><strong>{tripDateRange.year}</strong></div>
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
                  <strong>CHF {totalExpenseAmount.toFixed(2)}</strong>
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
                  <p>Organized by Manav S.</p>
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
                      <small>{dynamicWeatherForecast.destination.toUpperCase()} · {dynamicWeatherForecast.days[0]?.day || "DAY 1"}</small>
                      <strong>{dynamicWeatherForecast.days[0]?.temp || "18°C"}</strong>
                      <span>{dynamicWeatherForecast.days[0]?.desc || "Partly cloudy"} (Click for 5-Day)</span>
                    </div>
                    <div className="sun-cloud"><i>{dynamicWeatherForecast.days[0]?.icon || "☀"}</i><b>☁</b></div>
                    <div className="weather-meta"><span>H {parseInt(dynamicWeatherForecast.days[0]?.temp || "20") + 2}°</span><span>L {parseInt(dynamicWeatherForecast.days[0]?.temp || "11") - 5}°</span><span>Rain {dynamicWeatherForecast.days[0]?.rain || "10%"}</span></div>
                  </section>

                  <section className="expense-card">
                    <div className="rail-heading"><span>EXPENSES SNAPSHOT</span><button onClick={() => openMutationPanel("expense")}>＋</button></div>
                    <strong className="expense-total">CHF {totalExpenseAmount.toFixed(2)}</strong>
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
                    <label>Departure date<input name="departureDate" type="date" defaultValue={activeTrip.startDate || ""} required /></label>
                    <button className="primary-action live-search-button" disabled={flightSearchBusy}>
                      {flightSearchBusy ? "Checking AeroDataBox…" : "Search live flights"}
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
              <p className="tracker-note">Live updates come from AeroDataBox and are saved to Firebase for your other devices.</p>
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
              <p className="tracker-note">AeroDataBox supplies live operational updates; JourneySync saves the latest result to your Firebase account.</p>
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
                    <small>{dynamicWeatherForecast.destination.toUpperCase()} · {dynamicWeatherForecast.days[0]?.day || "DAY 1"}</small>
                    <strong>{dynamicWeatherForecast.days[0]?.temp || "18°C"}</strong>
                    <span>{dynamicWeatherForecast.days[0]?.desc || "Partly cloudy"} (Click for 5-Day)</span>
                  </div>
                  <div className="sun-cloud"><i>{dynamicWeatherForecast.days[0]?.icon || "☀"}</i><b>☁</b></div>
                  <div className="weather-meta"><span>H {parseInt(dynamicWeatherForecast.days[0]?.temp || "20") + 2}°</span><span>L {parseInt(dynamicWeatherForecast.days[0]?.temp || "11") - 5}°</span><span>Rain {dynamicWeatherForecast.days[0]?.rain || "10%"}</span></div>
                </section>

                <section className="expense-card">
                  <div className="rail-heading">
                    <span>GROUP EXPENSES</span>
                    <button onClick={() => openMutationPanel("expense")}>＋</button>
                  </div>
                  <strong className="expense-total">CHF {totalExpenseAmount.toFixed(2)}</strong>
                  <small>Total spent so far</small>
                  <div className="balances">
                    {expenseBalances.slice(0, 2).map((person) => (
                      <div key={person.email}>
                        <span className={`avatar ${person.bg}`}>{person.avatar}</span>
                        <p><strong>{person.name.split(" ")[0]}</strong><small>{person.balance >= 0 ? "is owed" : "owes"}</small></p>
                        <b className={person.balance >= 0 ? "positive" : "negative"}>{person.balance >= 0 ? "+" : "-"} CHF {Math.abs(person.balance).toFixed(2)}</b>
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

              <div className="map-canvas">
                <div className="map-route-line" />
                <div className="map-pins">
                  {mapPins.map((pin, idx) => (
                    <div className="map-pin" key={`${pin.name}-${idx}`} onClick={() => setSelectedMapPin(pin.name)}>
                      <div className="pin-bubble" style={{ background: selectedMapPin === pin.name ? "#ef7159" : "#17212b" }}>
                        {pin.code}
                      </div>
                      <label>{pin.name}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: "24px", background: "white", padding: "20px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                <h3 style={{ margin: "0 0 8px", fontFamily: "Georgia, serif" }}>Destination Focus: {selectedMapPin}</h3>
                <p style={{ margin: "0 0 14px", fontSize: "11px", color: "#64748b" }}>
                  {mapPins.find((p) => p.name === selectedMapPin)?.desc || `Explore highlights, activities, and dining in ${selectedMapPin}.`}
                </p>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <button className="primary-action" style={{ width: "auto", padding: "8px 16px" }} onClick={() => toggleSavePinOffline(selectedMapPin)}>
                    {mapPins.find((p) => p.name === selectedMapPin)?.savedOffline ? "✓ Saved Offline" : "Save Map Offline"}
                  </button>
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
                        <button style={{ border: 0, background: "transparent", color: "#e53e3e", cursor: "pointer", fontSize: "14px" }} onClick={() => deleteExpense(exp.id)}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="right-rail">
                <section className="expense-card" style={{ background: "white" }}>
                  <div className="rail-heading"><span>BALANCE SUMMARY</span></div>
                  <strong className="expense-total">CHF {totalExpenseAmount.toFixed(2)}</strong>
                  <small>Total spent across all categories</small>

                  <div className="balances" style={{ marginTop: "16px" }}>
                    {expenseBalances.map((person) => (
                      <div key={person.email}>
                        <span className={`avatar ${person.bg}`}>{person.avatar}</span>
                        <p><strong>{person.name}</strong><small>Paid total CHF {person.paid.toFixed(2)}</small></p>
                        <b className={person.balance >= 0 ? "positive" : "negative"}>{person.balance >= 0 ? "+" : "-"} CHF {Math.abs(person.balance).toFixed(2)}</b>
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
                      <button style={{ color: "#e53e3e" }} onClick={() => deleteWalletDoc(doc.id)}>Delete</button>
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
                <div className={`auth-sync-status ${synced ? "is-synced" : "is-paused"}`}>
                  <strong>{synced ? "Cloud sync is active" : "Cloud sync needs attention"}</strong>
                  <small>{synced ? "Your itinerary is backed up to Firestore." : "Your local trip is safe. JourneySync will retry cloud sync."}</small>
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
              <label>Local departure date<input name="departureDate" type="date" defaultValue={activeTrip.startDate || ""} required /></label>
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
              <label>Local departure date<input name="departureDate" type="date" defaultValue={selectedGuestFlight?.flight.departureDate || activeTrip.startDate || ""} required /></label>
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
            <h2>{dynamicWeatherForecast.destination} & Region</h2>
            <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
              {dynamicWeatherForecast.days.map((w) => (
                <div key={w.day} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderRadius: "6px", fontSize: "10px" }}>
                  <strong>{w.day}</strong>
                  <span>{w.icon} {w.desc} ({w.temp})</span>
                  <small style={{ color: "#64748b" }}>Rain {w.rain}</small>
                </div>
              ))}
            </div>
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
                    <button style={{ border: 0, background: "transparent", color: "#e53e3e", cursor: "pointer", fontSize: "13px" }} onClick={() => removeTraveler(t.email)} title="Remove traveler">×</button>
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
                <label>Trip name<input name="name" placeholder="e.g. Japan in spring" required autoFocus /></label>
                <label>Route or destination<input name="route" placeholder="e.g. Tokyo → Kyoto → Osaka" required /></label>
                <div className="form-row">
                  <label>Start date<input name="start" type="date" /></label>
                  <label>Travelers<input name="travelers" type="number" min="1" defaultValue="1" /></label>
                </div>
                <label>First day title<input name="firstDay" placeholder="e.g. Arrival in Tokyo" /></label>
                <button className="primary-action">Create itinerary</button>
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
                <label>Description<input name="description" defaultValue="Dinner at Kronenhalle" required autoFocus /></label>
                <div className="form-row">
                  <label>Amount<input name="amount" defaultValue="186.00" inputMode="decimal" required /></label>
                  <label>Currency<select name="currency" defaultValue="CHF"><option>CHF</option><option>EUR</option><option>USD</option></select></label>
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
            <h2>Switch or Manage Trips</h2>
            <div style={{ display: "grid", gap: "10px", marginBottom: "20px", maxHeight: "280px", overflowY: "auto" }}>
              {savedTrips.map((t) => (
                <div key={t.id} onClick={() => { setActiveTripId(t.id); setActiveDay(0); setPlannerOpen(null); notify(`Switched to "${t.name}"`); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: activeTripId === t.id ? "#fff7ed" : "#f8fafc", border: activeTripId === t.id ? "1.5px solid var(--coral)" : "1px solid var(--line)", borderRadius: "8px", cursor: "pointer" }}>
                  <div>
                    <strong style={{ fontSize: "13px", display: "block", color: activeTripId === t.id ? "var(--coral)" : "#0f172a" }}>{t.name} {activeTripId === t.id && "(Active)"}</strong>
                    <small style={{ fontSize: "10px", color: "#64748b" }}>{t.route} · {t.days.length} Days · {t.travelersCount} Travelers</small>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {savedTrips.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => deleteTrip(t.id, e)}
                        style={{ border: 0, background: "transparent", color: "#e53e3e", cursor: "pointer", fontSize: "16px", padding: "4px" }}
                        title="Delete itinerary"
                      >
                        🗑
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
              <button className="primary-action">Add Pin to Map</button>
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

      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </main>
  );
}
