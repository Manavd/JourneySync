package com.manavdesai.journeysync;

import java.util.HashMap;
import java.util.Map;

/** A friend or family member's flight, separate from the owner's itinerary. */
public class GuestFlight {
    private static final String[] KNOWN_KEYS = {"id", "guestName", "note", "status", "flight"};

    public String id;
    public String guestName;
    public String note;
    public String status;
    public FlightInfo flight;
    public final Map<String, Object> extras = new HashMap<>();

    public static GuestFlight fromMap(Map<?, ?> map) {
        if (map == null) return null;
        GuestFlight guest = new GuestFlight();
        guest.id = MapValues.str(map.get("id"), "guest-flight-" + System.currentTimeMillis());
        guest.guestName = MapValues.str(map.get("guestName"), "Guest");
        guest.note = MapValues.str(map.get("note"), "Friend or family flight");
        guest.status = MapValues.str(map.get("status"), "Scheduled");
        Object rawFlight = map.get("flight");
        guest.flight = rawFlight instanceof Map ? FlightInfo.fromMap((Map<?, ?>) rawFlight) : new FlightInfo();
        MapValues.collectExtras(map, guest.extras, KNOWN_KEYS);
        return guest;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>(extras);
        map.put("id", id);
        map.put("guestName", guestName);
        map.put("note", note);
        map.put("status", status);
        map.put("flight", (flight == null ? new FlightInfo() : flight).toMap());
        return map;
    }

    public boolean isDelayed() {
        return (flight != null && flight.delayMinutes > 0) || "delayed".equalsIgnoreCase(status);
    }
}
