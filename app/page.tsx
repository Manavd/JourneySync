"use client";

import { useMemo, useState } from "react";

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
  const [activeNav, setActiveNav] = useState("Itinerary");
  const [synced, setSynced] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [toast, setToast] = useState("");

  const day = useMemo(() => days[activeDay], [activeDay]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
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
              <strong>Swiss Escape</strong>
            </span>
            <button aria-label="Switch trip">⌄</button>
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
              <div className="eyebrow"><span /> 9 DAYS · 4 TRAVELERS</div>
              <h1>Swiss Escape</h1>
              <p>Zürich <b>→</b> Interlaken <b>→</b> Zermatt</p>
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
                <button onClick={() => notify("New itinerary item started")}>＋ Add item</button>
              </div>

              <div className="day-tabs" role="tablist" aria-label="Trip days">
                {days.map((item, index) => (
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
                <button className="more-days" onClick={() => notify("Five more days in this trip")}>
                  <small>MORE</small><strong>+5</strong>
                </button>
              </div>

              <div className="day-title">
                <div><strong>Day {activeDay + 1}</strong><span>{day.label}</span></div>
                <button aria-label="Day options">•••</button>
              </div>

              <div className="timeline">
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
    </main>
  );
}
