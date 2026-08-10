package com.manavdesai.journeysync;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * One saved itinerary shared by the native Android and web clients.
 */
public class Trip {
    private static final String[] KNOWN_KEYS = {"id", "name", "route", "startDate", "travelersCount", "days",
            "expenses", "walletDocs", "mapPins", "travelersList", "guestFlights"};

    public String id;
    public String name;
    public String route;
    public String startDate;
    public int travelersCount;
    public List<Day> days;
    public List<Expense> expenses;
    public List<WalletDoc> walletDocs;
    public List<MapPin> mapPins;
    public List<Traveler> travelersList;
    public List<GuestFlight> guestFlights;
    public final Map<String, Object> extras = new HashMap<>();

    public Trip() {
        this.days = new ArrayList<>();
        this.expenses = new ArrayList<>();
        this.walletDocs = new ArrayList<>();
        this.mapPins = new ArrayList<>();
        this.travelersList = new ArrayList<>();
        this.guestFlights = new ArrayList<>();
    }

    public Trip(String id, String name, String route, String startDate, int travelersCount, List<Day> days) {
        this();
        this.id = id;
        this.name = name;
        this.route = route;
        this.startDate = startDate;
        this.travelersCount = travelersCount;
        this.days = days != null ? days : new ArrayList<>();
    }

    public static Trip fromMap(Map<?, ?> map) {
        if (map == null) return null;
        Trip trip = new Trip();
        trip.id = MapValues.str(map.get("id"), "trip-" + System.currentTimeMillis());
        trip.name = MapValues.str(map.get("name"), "Untitled trip");
        trip.route = MapValues.str(map.get("route"), "Route to be planned");
        trip.startDate = MapValues.str(map.get("startDate"), "");
        trip.travelersCount = MapValues.integer(map.get("travelersCount"), 1);
        trip.days = new ArrayList<>();
        Object rawDays = map.get("days");
        if (rawDays instanceof List) {
            for (Object item : (List<?>) rawDays) {
                if (item instanceof Map) {
                    Day day = Day.fromMap((Map<?, ?>) item);
                    if (day != null) trip.days.add(day);
                }
            }
        }
        trip.expenses = parseList(map.get("expenses"), Expense::fromMap);
        trip.walletDocs = parseList(map.get("walletDocs"), WalletDoc::fromMap);
        trip.mapPins = parseList(map.get("mapPins"), MapPin::fromMap);
        trip.travelersList = parseList(map.get("travelersList"), Traveler::fromMap);
        trip.guestFlights = parseList(map.get("guestFlights"), GuestFlight::fromMap);
        MapValues.collectExtras(map, trip.extras, KNOWN_KEYS);
        return trip;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>(extras);
        map.put("id", id != null ? id : ("trip-" + System.currentTimeMillis()));
        map.put("name", name != null ? name : "Untitled trip");
        map.put("route", route != null ? route : "Route to be planned");
        map.put("startDate", startDate != null ? startDate : "");
        map.put("travelersCount", travelersCount);
        List<Map<String, Object>> dayList = new ArrayList<>();
        if (days != null) {
            for (Day day : days) {
                if (day != null) dayList.add(day.toMap());
            }
        }
        map.put("days", dayList);
        map.put("expenses", toMapList(expenses, Expense::toMap));
        map.put("walletDocs", toMapList(walletDocs, WalletDoc::toMap));
        map.put("mapPins", toMapList(mapPins, MapPin::toMap));
        map.put("travelersList", toMapList(travelersList, Traveler::toMap));
        map.put("guestFlights", toMapList(guestFlights, GuestFlight::toMap));
        return map;
    }

    private interface Parser<T> { T parse(Map<?, ?> value); }
    private interface Writer<T> { Map<String, Object> write(T value); }

    private static <T> List<T> parseList(Object raw, Parser<T> parser) {
        List<T> values = new ArrayList<>();
        if (raw instanceof List) {
            for (Object item : (List<?>) raw) {
                if (!(item instanceof Map)) continue;
                T parsed = parser.parse((Map<?, ?>) item);
                if (parsed != null) values.add(parsed);
            }
        }
        return values;
    }

    private static <T> List<Map<String, Object>> toMapList(List<T> values, Writer<T> writer) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (values != null) {
            for (T value : values) {
                if (value != null) list.add(writer.write(value));
            }
        }
        return list;
    }

    public double totalExpenses() {
        double total = 0;
        if (expenses != null) for (Expense expense : expenses) if (expense != null) total += expense.amount;
        return total;
    }

    public double unsettledExpenses() {
        double total = 0;
        if (expenses != null) for (Expense expense : expenses) if (expense != null && !expense.settled) total += expense.amount;
        return total;
    }

    /** Every flight event in this trip, paired with the day it belongs to. */
    public List<TrackedFlight> trackedFlights() {
        List<TrackedFlight> tracked = new ArrayList<>();
        if (days == null) return tracked;
        for (int i = 0; i < days.size(); i++) {
            Day day = days.get(i);
            if (day == null || day.events == null) continue;
            for (DayEvent event : day.events) {
                if (event != null && "flight".equalsIgnoreCase(event.kind)) {
                    tracked.add(new TrackedFlight(event, day, i));
                }
            }
        }
        return tracked;
    }

    /** A flight event together with the itinerary day that holds it. */
    public static class TrackedFlight {
        public final DayEvent event;
        public final Day day;
        public final int dayIndex;

        TrackedFlight(DayEvent event, Day day, int dayIndex) {
            this.event = event;
            this.day = day;
            this.dayIndex = dayIndex;
        }
    }
}
