"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type TripMapPoint = {
  name: string;
  code: string;
  description: string;
  latitude?: number;
  longitude?: number;
};

type Coordinates = { latitude: number; longitude: number };

type TripMapProps = {
  location: string;
  countryCode: string;
  center?: Coordinates;
  points: TripMapPoint[];
  selectedName: string;
  onSelect: (name: string) => void;
};

export default function TripMap({
  location,
  countryCode,
  center,
  points,
  selectedName,
  onSelect,
}: TripMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const [resolvedCenter, setResolvedCenter] = useState<Coordinates | null>(null);
  const [mapError, setMapError] = useState("");
  const pointKey = useMemo(() => JSON.stringify(points), [points]);
  const effectiveCenter = center ?? resolvedCenter;

  useEffect(() => {
    if (center || !location) return;

    const controller = new AbortController();
    const query = new URLSearchParams({ q: location, countryCode });
    Promise.resolve()
      .then(() => {
        setResolvedCenter(null);
        setMapError("");
        return fetch(`/api/geocode?${query.toString()}`, { cache: "no-store", signal: controller.signal });
      })
      .then(async (response) => {
        const body = await response.json() as Coordinates & { error?: string };
        if (!response.ok) throw new Error(body.error || "This location could not be mapped.");
        return body;
      })
      .then((coordinates) => {
        setResolvedCenter(coordinates);
        setMapError("");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResolvedCenter(null);
        setMapError(error instanceof Error ? error.message : "This location could not be mapped.");
      });

    return () => controller.abort();
  }, [center, location, countryCode]);

  useEffect(() => {
    if (!mapElementRef.current || !effectiveCenter) return;
    let cancelled = false;
    let cleanup = () => {};

    void import("leaflet").then((L) => {
      if (cancelled || !mapElementRef.current) return;

      const map = L.map(mapElementRef.current, {
        center: [effectiveCenter.latitude, effectiveCenter.longitude],
        zoom: 12,
        scrollWheelZoom: false,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const destination = L.circleMarker([effectiveCenter.latitude, effectiveCenter.longitude], {
        radius: 10,
        color: "#ffffff",
        weight: 3,
        fillColor: "#0c79d8",
        fillOpacity: 1,
      }).addTo(map);
      const destinationLabel = document.createElement("strong");
      destinationLabel.textContent = location || "Trip destination";
      destination.bindTooltip(destinationLabel);

      const bounds = L.latLngBounds([[effectiveCenter.latitude, effectiveCenter.longitude]]);
      points.forEach((point) => {
        if (typeof point.latitude !== "number" || typeof point.longitude !== "number") return;
        const selected = point.name === selectedName;
        const marker = L.circleMarker([point.latitude, point.longitude], {
          radius: selected ? 10 : 8,
          color: "#ffffff",
          weight: 3,
          fillColor: selected ? "#ef7159" : "#17212b",
          fillOpacity: 1,
        }).addTo(map);
        const content = document.createElement("div");
        const title = document.createElement("strong");
        const description = document.createElement("p");
        title.textContent = `${point.code} · ${point.name}`;
        description.textContent = point.description;
        description.style.margin = "4px 0 0";
        content.append(title, description);
        marker.bindPopup(content);
        marker.on("click", () => onSelect(point.name));
        bounds.extend([point.latitude, point.longitude]);
      });

      if (bounds.isValid() && points.some((point) => typeof point.latitude === "number" && typeof point.longitude === "number")) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
      window.setTimeout(() => map.invalidateSize(), 0);
      cleanup = () => map.remove();
    }).catch(() => setMapError("The interactive map could not load. Refresh and try again."));

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [effectiveCenter, location, pointKey, points, selectedName, onSelect]);

  if (!location) return <div className="trip-map-status" role="alert">Choose a city in trip details to show its map.</div>;
  if (!center && mapError) return <div className="trip-map-status" role="alert">{mapError}</div>;
  if (!effectiveCenter) return <div className="trip-map-status" aria-live="polite">Locating {location}…</div>;

  return <div ref={mapElementRef} className="trip-map" aria-label={`Interactive map of ${location}`} />;
}
