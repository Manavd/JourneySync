"use client";

import { FormEvent, useMemo, useState } from "react";

type Day = {
  date: string;
  short: string;
  label: string;
  events: Array<{
    time: string;
    title: string;
    meta: string;
    kind: "flight" | "stay" | "food" | "train" | "activity";
    status?: string;
  }>;
};

type Trip = { name: string; route: string; dates: string; travelers: number; days: Day[] };

const days: Day[] = [
  {
    date: "12",
    short: "SAT",
    label: "Arrival in Zürich",
    events: [
      {
        time: "8:40 AM",
        title: "Arrive at Zürich Airport",
        meta: "LX 017 · Terminal 2 · Gate E52",
        kind: "flight",
        status: "On time",
      },
      {
        time: "10:18 AM",
        title: "Train to Zürich HB",
        meta: "SBB · Platform 3 · 12 min",
        kind: "train",
      },
      {
        time: "11:00 AM",
        title: "Check in at Marktgasse Hotel",
        meta: "Niederdorf · Reservation JS-4821",
        kind: "stay",
      },
      {
        time: "7:30 PM",
        title: "Dinner at Kronenhalle",
        meta: "Rämistrasse 4 · Table for 4",
        kind: "food",
      },
    ],
  },
  {
    date: "13",
    short: "SUN",
    label: "Old Town & Lake Zürich",
    events: [
      {
        time: "9:30 AM",
        title: "Coffee at MAME",
        meta: "Josefstrasse 160 · 12 min walk",
        kind: "food",
      },
      {
        time: "11:00 AM",
        title: "Old Town walking route",
        meta: "Lindenhof → Grossmünster · 3.2 km",
        kind: "activity",
      },
      {
        time: "2:15 PM",
        title: "Lake Zürich cruise",
        meta: "Bürkliplatz pier · Boarding 2:00 PM",
        kind: "activity",
      },
    ],
  },
  {
    date: "14",
    short: "MON",
    label: "Onward to Interlaken",
    events: [
      {
        time: "8:02 AM",
        title: "Zürich HB to Interlaken Ost",
        meta: "IC 81 · Platform 31 · 1 change",
        kind: "train",
        status: "Platform 31",
      },
      {
        time: "11:30 AM",
        title: "Drop bags at Hotel Interlaken",
        meta: "Höheweg 74 · Room ready after 2 PM",
        kind: "stay",
      },
      {
        time: "3:00 PM",
        title: "Harder Kulm funicular",
        meta: "Return ticket saved in Wallet",
        kind: "activity",
      },
    ],
  },
  {
    date: "15",
    short: "TUE",
    label: "Lauterbrunnen Valley",
    events: [
      {
        time: "8:35 AM",
        title: "Train to Lauterbrunnen",
        meta: "Platform 2B · 22 min",
        kind: "train",
      },
      {
        time: "10:00 AM",
        title: "Staubbach Falls trail",
        meta: "Pinned offline · Easy · 4.8 km",
        kind: "activity",
      },
      {
        time: "1:00 PM",
        title: "Lunch at Airtime Café",
        meta: "Shared list · 4 votes",
        kind: "food",
      },
    ],
  },
];

const iconFor = {
  flight: "✈",
  stay: "⌂",
  food: "◆",
  train: "↗",
  activity: "◎",
};

export default function Home() {
  const [activeDay, setActiveDay] = useState(0);
  const [itineraryDays, setItineraryDays] = useState(days);
  const [tripName, setTripName] = useState("Swiss Escape");
  const [tripRoute, setTripRoute] = useState("Zürich → Interlaken → Zermatt");
  const [tripTravelers, setTripTravelers] = useState(4);
  const [activeNav, setActiveNav] = useState("Itinerary");
  const [synced, setSynced] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState<"trip" | "day" | "item" | null>(null);
  const [toast, setToast] = useState("");

  const day = useMemo(() => itineraryDays[activeDay], [activeDay, itineraryDays]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = String(form.get("start") || "");
    const date = start ? new Date(`${start}T12:00:00`) : new Date();
    const firstDay: Day = {
      date: String(date.getDate()).padStart(2, "0"),
      short: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date).toUpperCase(),
      label: String(form.get("firstDay") || "First day"), events: [],
    };
    setTripName(String(form.get("name") || "My trip"));
    setTripRoute(String(form.get("route") || "Choose your route"));
    setTripTravelers(Number(form.get("travelers") || 1));
    setItineraryDays([firstDay]); setActiveDay(0); setPlannerOpen(null);
    notify("New itinerary created. Add anything you want.");
  }

  function addDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const entered = String(form.get("date") || "");
    const date = entered ? new Date(`${entered}T12:00:00`) : new Date(Date.now() + itineraryDays.length * 86400000);
    setItineraryDays(current => [...current, { date: String(date.getDate()).padStart(2, "0"), short: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date).toUpperCase(), label: String(form.get("label") || "New day"), events: [] }]);
    setActiveDay(itineraryDays.length); setPlannerOpen(null); notify("Day added.");
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item: Day["events"][number] = { time: String(form.get("time") || "Any time"), title: String(form.get("title") || "Untitled plan"), meta: String(form.get("details") || "No details yet"), kind: String(form.get("kind") || "activity") as Day["events"][number]["kind"] };
    setItineraryDays(current => current.map((entry, index) => index === activeDay ? { ...entry, events: [...entry.events, item] } : entry));
    setPlannerOpen(null); notify("Item added to your itinerary.");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
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
                if (label !== "Itinerary") notify(`${label} view is ready for your trip`);
              }}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
              {label === "Wallet" && <small>6</small>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="download-card" onClick={() => {
            setSynced(true);
            notify("Trip saved for offline access");
          }}>
            <span className="download-icon">↓</span>
            <span>
              <strong>{synced ? "Available offline" : "Save for offline"}</strong>
              <small>{synced ? "Updated just now" : "Download trip"}</small>
            </span>
            <i>✓</i>
          </button>
          <button className="profile">
            <span className="avatar avatar-me">MS</span>
            <span><strong>Manav S.</strong><small>Trip organizer</small></span>
            <span>•••</span>
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open menu">≡</button>
          <div className="trip-switcher">
            <span className="flag">✦</span>
            <span>
              <small>CURRENT TRIP</small>
              <strong>{tripName}</strong>
            </span>
            <button aria-label="Create a new trip" onClick={() => setPlannerOpen("trip")}>＋</button>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Notifications" onClick={() => notify("You’re all caught up")}>●<i /></button>
            <div className="avatar-stack" aria-label="Four travelers">
              <span className="avatar peach">AL</span>
              <span className="avatar blue">NK</span>
              <span className="avatar green">RP</span>
              <span className="avatar more">+1</span>
            </div>
            <button className="share-button" onClick={() => notify("Invite link copied")}>↗ <span>Invite</span></button>
          </div>
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
            <button onClick={() => notify("Flight details opened")}>View details <span>→</span></button>
          </div>

          <div className="dashboard-grid">
            <section className="itinerary-panel">
              <div className="section-heading">
                <div><span>YOUR ITINERARY</span><h2>Day by day</h2></div>
                <div className="heading-actions"><button onClick={() => setPlannerOpen("day")}>＋ Add day</button><button onClick={() => setPlannerOpen("item")}>＋ Add item</button></div>
              </div>

              <div className="day-tabs" role="tablist" aria-label="Trip days">
                {itineraryDays.map((item, index) => (
                  <button
                    role="tab"
                    aria-selected={activeDay === index}
                    className={activeDay === index ? "selected" : ""}
                    key={item.date}
                    onClick={() => setActiveDay(index)}
                  >
                    <small>{item.short}</small><strong>{item.date}</strong>
                  </button>
                ))}
                <button className="more-days" onClick={() => setPlannerOpen("day")}>
                  <small>ADD</small><strong>+</strong>
                </button>
              </div>

              <div className="day-title">
                <div><strong>Day {activeDay + 1}</strong><span>{day.label}</span></div>
                <button aria-label="Day options">•••</button>
              </div>

              <div className="timeline">
                {day.events.length === 0 && <button className="empty-day" onClick={() => setPlannerOpen("item")}>＋ Add your first plan for this day</button>}
                {day.events.map((event, index) => (
                  <article className="timeline-item" key={`${event.time}-${event.title}`}>
                    <time>{event.time}</time>
                    <div className={`event-icon ${event.kind}`}>{iconFor[event.kind]}</div>
                    <button className="event-card" onClick={() => notify(`${event.title} selected`)}>
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
              <section className="weather-card">
                <div>
                  <small>ZÜRICH · SAT 12</small>
                  <strong>18°</strong>
                  <span>Partly cloudy</span>
                </div>
                <div className="sun-cloud"><i>☀</i><b>☁</b></div>
                <div className="weather-meta"><span>H 20°</span><span>L 11°</span><span>Rain 10%</span></div>
              </section>

              <section className="expense-card">
                <div className="rail-heading"><span>GROUP EXPENSES</span><button onClick={() => setExpenseOpen(true)}>＋</button></div>
                <strong className="expense-total">CHF 428.60</strong>
                <small>Total spent so far</small>
                <div className="balances">
                  <div><span className="avatar avatar-me">MS</span><p><strong>You</strong><small>are owed</small></p><b className="positive">+ CHF 86.40</b></div>
                  <div><span className="avatar peach">AL</span><p><strong>Amelia</strong><small>owes you</small></p><b>CHF 42.20</b></div>
                </div>
                <button className="text-link" onClick={() => notify("All balances opened")}>View all balances <span>→</span></button>
              </section>

              <section className="wallet-card">
                <div className="rail-heading"><span>TRIP WALLET</span><small>6 items</small></div>
                <button onClick={() => notify("SWISS boarding pass opened")}><i className="doc-icon">LX</i><span><strong>Boarding pass</strong><small>SWISS LX 017 · PDF</small></span><b>›</b></button>
                <button onClick={() => notify("Hotel confirmation opened")}><i className="doc-icon coral">M</i><span><strong>Hotel confirmation</strong><small>Marktgasse · PDF</small></span><b>›</b></button>
              </section>
            </aside>
          </div>
        </div>
      </section>

      {expenseOpen && (
        <div className="modal-backdrop" onMouseDown={() => setExpenseOpen(false)}>
          <section className="modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="expense-title">
            <button className="modal-close" onClick={() => setExpenseOpen(false)}>×</button>
            <span className="eyebrow">GROUP EXPENSE</span>
            <h2 id="expense-title">Add a shared cost</h2>
            <label>Description<input defaultValue="Dinner at Kronenhalle" /></label>
            <div className="form-row">
              <label>Amount<input defaultValue="186.00" inputMode="decimal" /></label>
              <label>Currency<select defaultValue="CHF"><option>CHF</option><option>EUR</option><option>USD</option></select></label>
            </div>
            <label>Paid by<select defaultValue="Manav"><option>Manav</option><option>Amelia</option><option>Noah</option><option>Riya</option></select></label>
            <button className="primary-action" onClick={() => { setExpenseOpen(false); notify("Expense split between 4 travelers"); }}>Split between 4 travelers</button>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">✓ {toast}</div>}
      {plannerOpen && (
        <div className="modal-backdrop" onMouseDown={() => setPlannerOpen(null)}>
          <section className="modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <button className="modal-close" onClick={() => setPlannerOpen(null)}>×</button>
            {plannerOpen === "trip" && <form onSubmit={createTrip}><span className="eyebrow">NEW ITINERARY</span><h2>Create any trip</h2><label>Trip name<input name="name" placeholder="e.g. Japan in spring" required autoFocus /></label><label>Route or destination<input name="route" placeholder="e.g. Tokyo → Kyoto → Osaka" required /></label><div className="form-row"><label>Start date<input name="start" type="date" /></label><label>Travelers<input name="travelers" type="number" min="1" defaultValue="1" /></label></div><label>First day title<input name="firstDay" placeholder="e.g. Arrival in Tokyo" /></label><button className="primary-action">Create itinerary</button></form>}
            {plannerOpen === "day" && <form onSubmit={addDay}><span className="eyebrow">ADD A DAY</span><h2>Shape your itinerary</h2><label>Date<input name="date" type="date" autoFocus /></label><label>Day title<input name="label" placeholder="e.g. Beach day" required /></label><button className="primary-action">Add day</button></form>}
            {plannerOpen === "item" && <form onSubmit={addItem}><span className="eyebrow">ADD TO DAY {activeDay + 1}</span><h2>What are you planning?</h2><label>Title<input name="title" placeholder="e.g. Dinner reservation" required autoFocus /></label><div className="form-row"><label>Time<input name="time" type="time" /></label><label>Type<select name="kind" defaultValue="activity"><option value="activity">Activity</option><option value="flight">Flight</option><option value="train">Train</option><option value="stay">Stay</option><option value="food">Food</option></select></label></div><label>Details<input name="details" placeholder="Location, confirmation, notes…" /></label><button className="primary-action">Add to itinerary</button></form>}
          </section>
        </div>
      )}
    </main>
  );
}
