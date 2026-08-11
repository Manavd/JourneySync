package com.manavdesai.journeysync;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Day {
    private static final String[] KNOWN_KEYS = {"id", "date", "short", "label", "isoDate", "events"};

    public String id;
    public String date;
    public String shortName;
    public String label;
    /** Full calendar date shared with the web app, in YYYY-MM-DD form. */
    public String isoDate;
    public List<DayEvent> events;
    public final Map<String, Object> extras = new HashMap<>();

    public Day() {
        this.events = new ArrayList<>();
    }

    public Day(String id, String date, String shortName, String label, List<DayEvent> events) {
        this(id, date, shortName, label, "", events);
    }

    public Day(String id, String date, String shortName, String label, String isoDate, List<DayEvent> events) {
        this.id = id;
        this.date = date;
        this.shortName = shortName;
        this.label = label;
        this.isoDate = isoDate;
        this.events = events != null ? events : new ArrayList<>();
    }

    public static Day fromMap(Map<?, ?> map) {
        if (map == null) return null;
        String id = MapValues.str(map.get("id"), "day-" + System.currentTimeMillis());
        String date = MapValues.str(map.get("date"), "01");
        String shortName = MapValues.str(map.get("short"), "DAY");
        String label = MapValues.str(map.get("label"), "Itinerary Day");
        String isoDate = MapValues.str(map.get("isoDate"), "");
        List<DayEvent> events = new ArrayList<>();
        Object rawEvents = map.get("events");
        if (rawEvents instanceof List) {
            for (Object item : (List<?>) rawEvents) {
                if (item instanceof Map) {
                    DayEvent event = DayEvent.fromMap((Map<?, ?>) item);
                    if (event != null) events.add(event);
                }
            }
        }
        Day day = new Day(id, date, shortName, label, isoDate, events);
        MapValues.collectExtras(map, day.extras, KNOWN_KEYS);
        return day;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>(extras);
        map.put("id", id != null ? id : ("day-" + System.currentTimeMillis()));
        map.put("date", date != null ? date : "01");
        map.put("short", shortName != null ? shortName : "DAY");
        map.put("label", label != null ? label : "Itinerary Day");
        map.put("isoDate", isoDate != null ? isoDate : "");
        List<Map<String, Object>> eventsList = new ArrayList<>();
        if (events != null) {
            for (DayEvent event : events) {
                if (event != null) eventsList.add(event.toMap());
            }
        }
        map.put("events", eventsList);
        return map;
    }
}
