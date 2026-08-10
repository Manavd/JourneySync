package com.manavdesai.journeysync;

import java.util.HashMap;
import java.util.Map;

public class DayEvent {
    private static final String[] KNOWN_KEYS = {"id", "time", "title", "meta", "kind", "status", "flight"};

    public String id;
    public String time;
    public String title;
    public String meta;
    public String kind;
    public String status;
    /** Present only on flight events; null for every other kind. */
    public FlightInfo flight;
    public final Map<String, Object> extras = new HashMap<>();

    public DayEvent() {}

    public DayEvent(String id, String time, String title, String meta, String kind, String status) {
        this.id = id;
        this.time = time;
        this.title = title;
        this.meta = meta;
        this.kind = kind;
        this.status = status;
    }

    public static DayEvent fromMap(Map<?, ?> map) {
        if (map == null) return null;
        DayEvent event = new DayEvent(
                MapValues.str(map.get("id"), "ev-" + System.currentTimeMillis()),
                MapValues.str(map.get("time"), "12:00 PM"),
                MapValues.str(map.get("title"), "Untitled activity"),
                MapValues.str(map.get("meta"), ""),
                MapValues.str(map.get("kind"), "activity"),
                MapValues.str(map.get("status"), ""));
        Object rawFlight = map.get("flight");
        if (rawFlight instanceof Map) {
            event.flight = FlightInfo.fromMap((Map<?, ?>) rawFlight);
        }
        MapValues.collectExtras(map, event.extras, KNOWN_KEYS);
        return event;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>(extras);
        map.put("id", id != null ? id : ("ev-" + System.currentTimeMillis()));
        map.put("time", time != null ? time : "12:00 PM");
        map.put("title", title != null ? title : "Untitled activity");
        map.put("meta", meta != null ? meta : "");
        map.put("kind", kind != null ? kind : "activity");
        if (status != null && !status.isEmpty()) {
            map.put("status", status);
        }
        if (flight != null) {
            map.put("flight", flight.toMap());
        }
        return map;
    }

    public boolean isFlight() {
        return "flight".equalsIgnoreCase(kind);
    }

    /**
     * Flight detail for this event, creating it on first use so an event
     * promoted to a flight (or imported without detail) still has somewhere to
     * store gate and timing data.
     */
    public FlightInfo requireFlight() {
        if (flight == null) {
            flight = new FlightInfo();
            flight.estimatedDeparture = time != null ? time : FlightInfo.UNKNOWN;
            flight.scheduledDeparture = flight.estimatedDeparture;
        }
        return flight;
    }
}
