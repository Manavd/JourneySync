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
  getDoc,
  User 
} from "./firebase";

type DayEvent = {
  id?: string;
  time: string;
  title: string;
  meta: string;
  kind: "flight" | "stay" | "food" | "train" | "activity";
  status?: string;
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
};

type WalletDoc = {
  id: string;
  title: string;
  meta: string;
  code: string;
  icon: string;
  coralIcon?: boolean;
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

const iconFor = {
  flight: "✈",
  stay: "⌂",
  food: "◆",
  train: "↗",
  activity: "◎",
};

export default function Home() {
  // Navigation & User State
  const [activeNav, setActiveNav] = useState("Itinerary");
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // App Data State
  const [activeDay, setActiveDay] = useState(0);
  const [itineraryDays, setItineraryDays] = useState<Day[]>(initialDays);
  const [tripName, setTripName] = useState("Swiss Escape");
  const [tripRoute, setTripRoute] = useState("Zürich → Interlaken → Zermatt");
  const [tripTravelers, setTripTravelers] = useState(4);
  const [travelersList, setTravelersList] = useState([
    { name: "Manav S.", role: "Trip organizer", email: "manav@example.com", avatar: "MS", bg: "avatar-me" },
    { name: "Amelia L.", role: "Co-organizer", email: "amelia@example.com", avatar: "AL", bg: "peach" },
    { name: "Noah K.", role: "Traveler", email: "noah@example.com", avatar: "NK", bg: "blue" },
    { name: "Riya P.", role: "Traveler", email: "riya@example.com", avatar: "RP", bg: "green" },
  ]);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [walletDocs, setWalletDocs] = useState<WalletDoc[]>(initialWalletDocs);

  // Status & Modals
  const [synced, setSynced] = useState(true);
  const [toast, setToast] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState<"trip" | "day" | "item" | "edit-item" | "edit-day" | "expense" | "pass" | "flight" | "weather" | "travelers" | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DayEvent | null>(null);
  const [dayDropdownOpen, setDayDropdownOpen] = useState(false);
  const [selectedMapPin, setSelectedMapPin] = useState("Zürich");

  // Auth Listener & Firestore Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        notify(`Welcome back, ${currentUser.displayName || currentUser.email}`);
        // Load data from Firestore
        try {
          const docRef = doc(db, "users", currentUser.uid, "trips", "swiss-escape");
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data.tripName) setTripName(data.tripName);
            if (data.tripRoute) setTripRoute(data.tripRoute);
            if (data.itineraryDays) setItineraryDays(data.itineraryDays);
            if (data.expenses) setExpenses(data.expenses);
            if (data.walletDocs) setWalletDocs(data.walletDocs);
          }
        } catch (e) {
          console.log("Using local state / fallback for user data");
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync to Firestore whenever data changes (if logged in)
  useEffect(() => {
    if (user) {
      try {
        const docRef = doc(db, "users", user.uid, "trips", "swiss-escape");
        setDoc(docRef, {
          tripName,
          tripRoute,
          itineraryDays,
          expenses,
          walletDocs,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.error("Firestore sync error:", e);
      }
    }
  }, [user, tripName, tripRoute, itineraryDays, expenses, walletDocs]);

  const day = useMemo(() => itineraryDays[activeDay] || itineraryDays[0] || { date: "12", short: "SAT", label: "Day 1", events: [] }, [activeDay, itineraryDays]);

  const totalExpenseAmount = useMemo(() => {
    return expenses.reduce((sum, item) => sum + item.amount, 0);
  }, [expenses]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  // Auth Handlers
  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        setAuthModalOpen(false);
      } else {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        setAuthModalOpen(false);
      }
    } catch (err: any) {
      notify(err.message || "Authentication error");
    }
  }

  async function handleGoogleAuth() {
    try {
      await signInWithPopup(auth, googleProvider);
      setAuthModalOpen(false);
    } catch (err: any) {
      notify("Google sign-in error or cancelled");
    }
  }

  async function handleLogOut() {
    await signOut(auth);
    setAuthModalOpen(false);
    notify("Logged out successfully");
  }

  // Trip & Itinerary Handlers
  function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = String(form.get("start") || "");
    const date = start ? new Date(`${start}T12:00:00`) : new Date();
    const firstDay: Day = {
      id: "day-" + Date.now(),
      date: String(date.getDate()).padStart(2, "0"),
      short: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date).toUpperCase(),
      label: String(form.get("firstDay") || "Arrival"),
      events: [],
    };
    setTripName(String(form.get("name") || "My Trip"));
    setTripRoute(String(form.get("route") || "Custom Route"));
    setTripTravelers(Number(form.get("travelers") || 1));
    setItineraryDays([firstDay]);
    setActiveDay(0);
    setPlannerOpen(null);
    notify("New trip itinerary created!");
  }

  function addDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    setItineraryDays(current => [...current, newDay]);
    setActiveDay(itineraryDays.length);
    setPlannerOpen(null);
    notify("New day added to trip!");
  }

  function editCurrentDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newLabel = String(form.get("label") || day.label);
    setItineraryDays(current => current.map((d, index) => index === activeDay ? { ...d, label: newLabel } : d));
    setPlannerOpen(null);
    notify("Day title updated!");
  }

  function deleteCurrentDay() {
    if (itineraryDays.length <= 1) {
      notify("Trip must have at least one day!");
      return;
    }
    setItineraryDays(current => current.filter((_, index) => index !== activeDay));
    setActiveDay(0);
    setDayDropdownOpen(false);
    notify("Day deleted.");
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item: DayEvent = {
      id: "ev-" + Date.now(),
      time: String(form.get("time") || "12:00 PM"),
      title: String(form.get("title") || "Untitled activity"),
      meta: String(form.get("details") || "No details provided"),
      kind: (String(form.get("kind") || "activity")) as DayEvent["kind"],
    };
    setItineraryDays(current => current.map((entry, index) => index === activeDay ? { ...entry, events: [...entry.events, item] } : entry));
    setPlannerOpen(null);
    notify("Item added to day!");
  }

  function editItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEvent) return;
    const form = new FormData(event.currentTarget);
    const updated: DayEvent = {
      ...selectedEvent,
      title: String(form.get("title") || selectedEvent.title),
      time: String(form.get("time") || selectedEvent.time),
      meta: String(form.get("details") || selectedEvent.meta),
      kind: String(form.get("kind") || selectedEvent.kind) as DayEvent["kind"],
    };
    setItineraryDays(current => current.map((d, dIdx) => dIdx === activeDay ? {
      ...d,
      events: d.events.map(ev => ev.id === selectedEvent.id || (ev.title === selectedEvent.title && ev.time === selectedEvent.time) ? updated : ev)
    } : d));
    setPlannerOpen(null);
    setSelectedEvent(null);
    notify("Event updated!");
  }

  function deleteSelectedEvent() {
    if (!selectedEvent) return;
    setItineraryDays(current => current.map((d, dIdx) => dIdx === activeDay ? {
      ...d,
      events: d.events.filter(ev => !(ev.id === selectedEvent.id || (ev.title === selectedEvent.title && ev.time === selectedEvent.time)))
    } : d));
    setPlannerOpen(null);
    setSelectedEvent(null);
    notify("Event deleted!");
  }

  // Expense Handlers
  function addExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newExp: Expense = {
      id: "exp-" + Date.now(),
      description: String(form.get("description") || "Expense"),
      amount: Number(form.get("amount") || 0),
      currency: String(form.get("currency") || "CHF"),
      paidBy: String(form.get("paidBy") || "Manav"),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      category: String(form.get("category") || "General")
    };
    setExpenses(prev => [newExp, ...prev]);
    setPlannerOpen(null);
    notify(`Expense added: ${newExp.currency} ${newExp.amount}`);
  }

  function deleteExpense(id: string) {
    setExpenses(prev => prev.filter(e => e.id !== id));
    notify("Expense removed");
  }

  // Wallet Handlers
  function addPassSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newDoc: WalletDoc = {
      id: "w-" + Date.now(),
      title: String(form.get("title") || "Pass"),
      meta: String(form.get("meta") || "Ticket Document"),
      code: String(form.get("code") || "JS-TICKET-" + Math.floor(Math.random() * 10000)),
      icon: String(form.get("icon") || "DOC").substring(0, 3).toUpperCase(),
      coralIcon: Math.random() > 0.5
    };
    setWalletDocs(prev => [...prev, newDoc]);
    setPlannerOpen(null);
    notify("Document added to Trip Wallet");
  }

  function deleteWalletDoc(id: string) {
    setWalletDocs(prev => prev.filter(w => w.id !== id));
    notify("Document deleted");
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
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="download-card" onClick={() => {
            setSynced(!synced);
            localStorage.setItem("journeysync_trip", JSON.stringify({ tripName, tripRoute, itineraryDays }));
            notify(synced ? "Offline cache refreshed" : "Trip saved for offline access");
          }}>
            <span className="download-icon">↓</span>
            <span>
              <strong>{synced ? "Available offline" : "Save for offline"}</strong>
              <small>{synced ? "Updated just now" : "Download trip"}</small>
            </span>
            <i>✓</i>
          </button>

          <button className="profile" onClick={() => setAuthModalOpen(true)}>
            <span className="avatar avatar-me">{user ? (user.displayName ? user.displayName.slice(0, 2).toUpperCase() : user.email?.slice(0, 2).toUpperCase()) : "MS"}</span>
            <span>
              <strong>{user ? (user.displayName || user.email?.split("@")[0]) : "Manav S. (Guest)"}</strong>
              <small>{user ? "Logged In Account" : "Click to Sign In / Sync"}</small>
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
            <span className="flag">✦</span>
            <span>
              <small>CURRENT TRIP</small>
              <strong>{tripName}</strong>
            </span>
            <button aria-label="Create a new trip" onClick={() => setPlannerOpen("trip")}>＋</button>
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
              <span>12</span>
              <div><small>SEPTEMBER</small><strong>2026</strong></div>
              <i>—</i>
              <span>20</span>
              <div><small>SEPTEMBER</small><strong>2026</strong></div>
            </div>
          </div>

          {/* Flight Banner */}
          <div className="status-banner">
            <div className="status-symbol">✈</div>
            <div>
              <small>NEXT UP · IN 18 HOURS</small>
              <strong>SWISS LX 017 to Zürich</strong>
              <span>New York JFK · Terminal 1</span>
            </div>
            <div className="flight-line">
              <span>JFK</span><i><b>✈</b></i><span>ZRH</span>
            </div>
            <div className="flight-time"><strong>8:40 AM</strong><span className="on-time">On time</span></div>
            <button onClick={() => setPlannerOpen("flight")}>View details <span>→</span></button>
          </div>

          {/* MAIN DYNAMIC VIEW NAVIGATION */}
          {activeNav === "Overview" && (
            <div className="view-grid">
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
                      <small>ZÜRICH · SAT 12</small>
                      <strong>18°</strong>
                      <span>Partly cloudy (Click for 5-Day)</span>
                    </div>
                    <div className="sun-cloud"><i>☀</i><b>☁</b></div>
                    <div className="weather-meta"><span>H 20°</span><span>L 11°</span><span>Rain 10%</span></div>
                  </section>

                  <section className="expense-card">
                    <div className="rail-heading"><span>EXPENSES SNAPSHOT</span><button onClick={() => setPlannerOpen("expense")}>＋</button></div>
                    <strong className="expense-total">CHF {totalExpenseAmount.toFixed(2)}</strong>
                    <button className="text-link" onClick={() => setActiveNav("Expenses")}>View Full Expense Breakdown <span>→</span></button>
                  </section>
                </aside>
              </div>
            </div>
          )}

          {activeNav === "Itinerary" && (
            <div className="dashboard-grid">
              <section className="itinerary-panel">
                <div className="section-heading">
                  <div><span>YOUR ITINERARY</span><h2>Day by day</h2></div>
                  <div className="heading-actions">
                    <button onClick={() => setPlannerOpen("day")}>＋ Add day</button>
                    <button onClick={() => setPlannerOpen("item")}>＋ Add item</button>
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
                  <button className="more-days" onClick={() => setPlannerOpen("day")}>
                    <small>ADD</small><strong>+</strong>
                  </button>
                </div>

                <div className="day-title" style={{ position: "relative" }}>
                  <div><strong>Day {activeDay + 1}</strong><span>{day.label}</span></div>
                  <button aria-label="Day options" onClick={() => setDayDropdownOpen(!dayDropdownOpen)}>•••</button>
                  
                  {dayDropdownOpen && (
                    <div className="dropdown-menu">
                      <button className="dropdown-item" onClick={() => { setDayDropdownOpen(false); setPlannerOpen("edit-day"); }}>Edit Day Title</button>
                      <button className="dropdown-item danger" onClick={deleteCurrentDay}>Delete Day</button>
                    </div>
                  )}
                </div>

                <div className="timeline">
                  {day.events.length === 0 && (
                    <button className="empty-day" onClick={() => setPlannerOpen("item")}>
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
                          setPlannerOpen("edit-item");
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
                    <small>ZÜRICH · SAT 12</small>
                    <strong>18°</strong>
                    <span>Partly cloudy (Forecast)</span>
                  </div>
                  <div className="sun-cloud"><i>☀</i><b>☁</b></div>
                  <div className="weather-meta"><span>H 20°</span><span>L 11°</span><span>Rain 10%</span></div>
                </section>

                <section className="expense-card">
                  <div className="rail-heading">
                    <span>GROUP EXPENSES</span>
                    <button onClick={() => setPlannerOpen("expense")}>＋</button>
                  </div>
                  <strong className="expense-total">CHF {totalExpenseAmount.toFixed(2)}</strong>
                  <small>Total spent so far</small>
                  <div className="balances">
                    <div>
                      <span className="avatar avatar-me">MS</span>
                      <p><strong>You</strong><small>are owed</small></p>
                      <b className="positive">+ CHF 86.40</b>
                    </div>
                    <div>
                      <span className="avatar peach">AL</span>
                      <p><strong>Amelia</strong><small>owes you</small></p>
                      <b>CHF 42.20</b>
                    </div>
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
            <div className="map-view-container">
              <div className="section-heading">
                <div><span>INTERACTIVE TRIP MAP</span><h2>Route & Destinations</h2></div>
              </div>

              <div className="map-canvas">
                <div className="map-route-line" />
                <div className="map-pins">
                  {[
                    { name: "Zürich", code: "ZRH", desc: "Arrival & Old Town", temp: "18°C" },
                    { name: "Interlaken", code: "INT", desc: "Alpine Lakes & Funicular", temp: "16°C" },
                    { name: "Lauterbrunnen", code: "LTB", desc: "Waterfalls & Valley Trail", temp: "15°C" },
                    { name: "Zermatt", code: "ZMT", desc: "Matterhorn Peak", temp: "12°C" },
                  ].map((pin) => (
                    <div className="map-pin" key={pin.name} onClick={() => setSelectedMapPin(pin.name)}>
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
                  {selectedMapPin === "Zürich" && "Switzerland’s vibrant cultural hub with picturesque lakeside promenades, historic Lindenhof, and world-class cafés."}
                  {selectedMapPin === "Interlaken" && "Nestled between Lake Thun and Lake Brienz, the gateway to alpine adventure and the Harder Kulm funicular."}
                  {selectedMapPin === "Lauterbrunnen" && "The valley of 72 waterfalls, featuring the famous Staubbach Falls and stunning hiking routes."}
                  {selectedMapPin === "Zermatt" && "Car-free mountain resort village below the iconic Matterhorn peak."}
                </p>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button className="primary-action" style={{ width: "auto", padding: "8px 16px" }} onClick={() => notify(`Route to ${selectedMapPin} saved to offline maps`)}>Save Destination Map</button>
                  <button className="secondary-action" style={{ width: "auto", margin: 0, padding: "8px 16px" }} onClick={() => setActiveNav("Itinerary")}>View Day Plans</button>
                </div>
              </div>
            </div>
          )}

          {activeNav === "Expenses" && (
            <div className="expenses-view-container">
              <div>
                <div className="section-heading">
                  <div><span>GROUP EXPENSES</span><h2>All Transactions</h2></div>
                  <button onClick={() => setPlannerOpen("expense")}>＋ Add Expense</button>
                </div>

                <div className="expense-list">
                  {expenses.map((exp) => (
                    <div className="expense-item-row" key={exp.id}>
                      <div className="expense-item-info">
                        <strong>{exp.description}</strong>
                        <small>Paid by {exp.paidBy} · {exp.date} · {exp.category}</small>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div className="expense-item-amount">
                          {exp.currency} {exp.amount.toFixed(2)}
                          <small>Split 4 ways</small>
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
                    <div>
                      <span className="avatar avatar-me">MS</span>
                      <p><strong>You (Manav)</strong><small>Paid total CHF {(expenses.filter(e => e.paidBy === "Manav").reduce((a,b)=>a+b.amount,0)).toFixed(2)}</small></p>
                      <b className="positive">+ CHF 86.40</b>
                    </div>
                    <div>
                      <span className="avatar peach">AL</span>
                      <p><strong>Amelia</strong><small>Paid total CHF {(expenses.filter(e => e.paidBy === "Amelia").reduce((a,b)=>a+b.amount,0)).toFixed(2)}</small></p>
                      <b>Owes CHF 42.20</b>
                    </div>
                    <div>
                      <span className="avatar blue">NK</span>
                      <p><strong>Noah</strong><small>Paid total CHF {(expenses.filter(e => e.paidBy === "Noah").reduce((a,b)=>a+b.amount,0)).toFixed(2)}</small></p>
                      <b>Owes CHF 22.10</b>
                    </div>
                    <div>
                      <span className="avatar green">RP</span>
                      <p><strong>Riya</strong><small>Paid total CHF 0.00</small></p>
                      <b>Owes CHF 22.10</b>
                    </div>
                  </div>

                  <button className="primary-action" style={{ marginTop: "16px" }} onClick={() => notify("Settlement request sent to group members!")}>Settle Balances</button>
                </section>
              </aside>
            </div>
          )}

          {activeNav === "Wallet" && (
            <div className="wallet-view">
              <div className="section-heading">
                <div><span>TRIP WALLET</span><h2>Tickets, Passes & Documents</h2></div>
                <button onClick={() => setPlannerOpen("pass")}>＋ Add Pass</button>
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
            <button className="modal-close" onClick={() => setAuthModalOpen(false)}>×</button>
            <span className="eyebrow">FIREBASE ACCOUNT</span>
            <h2>{user ? "Your Profile" : (authMode === "login" ? "Sign in to JourneySync" : "Create your Account")}</h2>

            {user ? (
              <div>
                <p style={{ fontSize: "11px", color: "#475569", marginBottom: "16px" }}>
                  Signed in as <strong>{user.email}</strong>
                </p>
                <div style={{ background: "#f1f5f9", padding: "14px", borderRadius: "8px", marginBottom: "20px", fontSize: "10px" }}>
                  ✓ Real-time Firestore sync active<br />
                  ✓ Cloud itinerary backup enabled
                </div>
                <button className="danger-action" onClick={handleLogOut}>Sign Out</button>
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit}>
                <div className="auth-tabs">
                  <button type="button" className={`auth-tab ${authMode === "login" ? "active" : ""}`} onClick={() => setAuthMode("login")}>Sign In</button>
                  <button type="button" className={`auth-tab ${authMode === "signup" ? "active" : ""}`} onClick={() => setAuthMode("signup")}>Register</button>
                </div>

                <label>Email Address
                  <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required placeholder="you@example.com" />
                </label>

                <label>Password
                  <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required placeholder="••••••••" />
                </label>

                <button className="primary-action" type="submit">
                  {authMode === "login" ? "Sign In with Email" : "Create Account"}
                </button>

                <div className="auth-divider">OR</div>

                <button type="button" className="google-btn" onClick={handleGoogleAuth}>
                  Continue with Google
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      {/* Flight Details Modal */}
      {plannerOpen === "flight" && (
        <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPlannerOpen(null)}>×</button>
            <span className="eyebrow">FLIGHT DETAILS</span>
            <h2>SWISS LX 017</h2>
            <div style={{ fontSize: "11px", display: "grid", gap: "10px", marginBottom: "20px" }}>
              <div><strong>Departure:</strong> New York JFK (Terminal 1) · 8:40 AM</div>
              <div><strong>Arrival:</strong> Zürich ZRH (Terminal 2) · 10:15 AM (+1)</div>
              <div><strong>Gate:</strong> E52 · Seat 14A (Window)</div>
              <div><strong>Status:</strong> <span style={{ color: "#3e9162", fontWeight: "bold" }}>On Time</span></div>
            </div>
            <button className="primary-action" onClick={() => setPlannerOpen(null)}>Close Flight Details</button>
          </section>
        </div>
      )}

      {/* Weather 5-Day Forecast Modal */}
      {plannerOpen === "weather" && (
        <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPlannerOpen(null)}>×</button>
            <span className="eyebrow">5-DAY WEATHER FORECAST</span>
            <h2>Zürich & Interlaken</h2>
            <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
              {[
                { day: "Sat Sep 12", temp: "18°C", desc: "Partly Cloudy", rain: "10%" },
                { day: "Sun Sep 13", temp: "21°C", desc: "Sunny", rain: "0%" },
                { day: "Mon Sep 14", temp: "17°C", desc: "Light Showers", rain: "40%" },
                { day: "Tue Sep 15", temp: "16°C", desc: "Clear Mountain Air", rain: "5%" },
                { day: "Wed Sep 16", temp: "19°C", desc: "Mostly Sunny", rain: "15%" },
              ].map((w) => (
                <div key={w.day} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderRadius: "6px", fontSize: "10px" }}>
                  <strong>{w.day}</strong>
                  <span>{w.desc} ({w.temp})</span>
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
            <h2>Manage Trip Travelers</h2>
            
            <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
              {travelersList.map((t) => (
                <div key={t.email} style={{ display: "flex", alignItems: "center", justifyBetween: "space-between", gap: "10px", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                  <span className={`avatar ${t.bg}`}>{t.avatar}</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: "11px", display: "block" }}>{t.name}</strong>
                    <small style={{ fontSize: "9px", color: "#64748b" }}>{t.email} · {t.role}</small>
                  </div>
                </div>
              ))}
            </div>

            <button className="primary-action" onClick={() => {
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
      {plannerOpen && !["flight", "weather", "travelers", "edit-day", "edit-item"].includes(plannerOpen) && (
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
                <label>Paid by<select name="paidBy" defaultValue="Manav"><option>Manav</option><option>Amelia</option><option>Noah</option><option>Riya</option></select></label>
                <label>Category<select name="category" defaultValue="Dining"><option>Dining</option><option>Transport</option><option>Activities</option><option>Lodging</option></select></label>
                <button className="primary-action">Split between 4 travelers</button>
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

      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </main>
  );
}
