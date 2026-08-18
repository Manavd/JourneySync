"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { db, doc, onSnapshot, serverTimestamp, setDoc, User } from "./firebase";
import { countryByCode, TRIP_COUNTRIES } from "./location-data";

type HomeLocation = {
  city: string;
  region: string;
  country: string;
  countryCode: string;
  timeZone: string;
  source: "device" | "confirmed";
};

type ClockDestination = {
  city: string;
  region?: string;
  country: string;
  countryCode?: string;
  timeZone?: string;
};

function inferredHomeLocation(): HomeLocation {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  let countryCode = "";
  try {
    countryCode = new Intl.Locale(navigator.language).region || "";
  } catch { /* use the supported-country fallback below */ }
  const knownCountry = countryByCode(countryCode);
  return {
    city: "",
    region: "",
    country: knownCountry?.name || (countryCode || "Home"),
    countryCode: knownCountry?.code || countryCode,
    timeZone,
    source: "device",
  };
}

function homeFromData(data: Record<string, unknown> | undefined): HomeLocation | null {
  if (!data || typeof data.timeZone !== "string" || !data.timeZone.trim()) return null;
  return {
    city: typeof data.city === "string" ? data.city : "",
    region: typeof data.region === "string" ? data.region : "",
    country: typeof data.country === "string" ? data.country : "Home",
    countryCode: typeof data.countryCode === "string" ? data.countryCode : "",
    timeZone: data.timeZone,
    source: data.source === "confirmed" ? "confirmed" : "device",
  };
}

function locationLabel(location: { city?: string; region?: string; country?: string }, fallback: string): string {
  return [location.city, location.region, location.country].filter(Boolean).join(", ") || fallback;
}

function timeInZone(now: number, timeZone?: string): string {
  if (!timeZone) return "--:--";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(now);
  } catch {
    return "--:--";
  }
}

function dateInZone(now: number, timeZone?: string): string {
  if (!timeZone) return "Time zone unavailable";
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone,
    }).format(now);
  } catch {
    return "Time zone unavailable";
  }
}

function offsetMinutes(now: number, timeZone?: string): number | null {
  if (!timeZone) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZone,
    }).formatToParts(now);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const represented = Date.UTC(
      Number(value.year), Number(value.month) - 1, Number(value.day),
      Number(value.hour), Number(value.minute), Number(value.second),
    );
    return Math.round((represented - now) / 60_000);
  } catch {
    return null;
  }
}

function differenceLabel(now: number, homeZone?: string, destinationZone?: string): string {
  const homeOffset = offsetMinutes(now, homeZone);
  const destinationOffset = offsetMinutes(now, destinationZone);
  if (homeOffset === null || destinationOffset === null) return "Destination time zone is loading";
  const difference = destinationOffset - homeOffset;
  if (difference === 0) return "Same time as home";
  const absolute = Math.abs(difference);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  const duration = [hours ? `${hours} hr` : "", minutes ? `${minutes} min` : ""].filter(Boolean).join(" ");
  return `Destination is ${duration} ${difference > 0 ? "ahead of" : "behind"} home`;
}

export default function WorldClock({ user, destination }: { user: User; destination: ClockDestination }) {
  const [home, setHome] = useState<HomeLocation>(() => inferredHomeLocation());
  const [now, setNow] = useState(() => Date.now());
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const profileRef = doc(db, "users", user.uid, "profile", "home");
    return onSnapshot(profileRef, (snapshot) => {
      const stored = homeFromData(snapshot.exists() ? snapshot.data() as Record<string, unknown> : undefined);
      if (stored) {
        setHome(stored);
        return;
      }
      const inferred = inferredHomeLocation();
      setHome(inferred);
      void setDoc(profileRef, { ...inferred, updatedAt: serverTimestamp() }, { merge: true });
    }, () => {
      setHome(inferredHomeLocation());
    });
  }, [user.uid]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const destinationTimeZone = destination.timeZone || "";
  const difference = useMemo(
    () => differenceLabel(now, home.timeZone, destinationTimeZone),
    [now, home.timeZone, destinationTimeZone],
  );

  async function saveHome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const city = String(form.get("city") || "").trim();
    const region = String(form.get("region") || "").trim();
    const countryCode = String(form.get("countryCode") || "");
    const country = countryByCode(countryCode)?.name || countryCode;
    if (!city || !countryCode) return;

    setSaving(true);
    setError("");
    try {
      const query = new URLSearchParams({ city, region, country, countryCode });
      const response = await fetch(`/api/weather?${query.toString()}`);
      const body = await response.json() as {
        destination?: string;
        region?: string;
        country?: string;
        countryCode?: string;
        timeZone?: string;
        error?: string;
      };
      if (!response.ok || !body.timeZone) throw new Error(body.error || "That city's time zone could not be found.");
      const confirmed: HomeLocation = {
        city: body.destination || city,
        region: body.region || region,
        country: body.country || country,
        countryCode: body.countryCode || countryCode,
        timeZone: body.timeZone,
        source: "confirmed",
      };
      await setDoc(doc(db, "users", user.uid, "profile", "home"), {
        ...confirmed,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setHome(confirmed);
      setEditorOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Home location could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="world-clock-card" aria-label="Home and destination world clock">
        <div className="world-clock-heading">
          <span>WORLD CLOCK</span>
          <button type="button" onClick={() => { setError(""); setEditorOpen(true); }}>
            {home.source === "confirmed" ? "Change home" : "Confirm home"}
          </button>
        </div>
        <div className="world-clock-grid">
          <div>
            <small>HOME · {locationLabel(home, "Device time")}</small>
            <strong>{timeInZone(now, home.timeZone)}</strong>
            <span>{dateInZone(now, home.timeZone)}</span>
          </div>
          <div>
            <small>DESTINATION · {locationLabel(destination, "Trip location")}</small>
            <strong>{timeInZone(now, destinationTimeZone)}</strong>
            <span>{dateInZone(now, destinationTimeZone)}</span>
          </div>
        </div>
        <p>{difference}</p>
        {home.source !== "confirmed" && <small className="world-clock-note">Home country and time zone were estimated from this device. Confirm your city once and it will sync to your account.</small>}
      </section>

      {editorOpen && (
        <div className="modal-backdrop" onMouseDown={() => !saving && setEditorOpen(false)}>
          <section className="modal home-location-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="home-location-title">
            <button className="modal-close" type="button" onClick={() => setEditorOpen(false)} disabled={saving}>×</button>
            <span className="eyebrow">YOUR WORLD CLOCK</span>
            <h2 id="home-location-title">Set your home location</h2>
            <p className="modal-copy">JourneySync saves this to your private Firebase profile so every device compares trips against the same home clock.</p>
            <form onSubmit={saveHome}>
              <label>Country
                <select name="countryCode" defaultValue={home.countryCode || "US"} required>
                  {TRIP_COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
                </select>
              </label>
              <label>State or region<input name="region" defaultValue={home.region} placeholder="Optional" /></label>
              <label>Home city<input name="city" defaultValue={home.city} placeholder="e.g. Atlanta" required autoFocus /></label>
              {error && <div className="auth-error" role="alert">{error}</div>}
              <button className="primary-action" type="submit" disabled={saving}>{saving ? "Finding time zone…" : "Save home location"}</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
