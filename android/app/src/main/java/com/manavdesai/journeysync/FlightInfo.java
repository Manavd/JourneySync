package com.manavdesai.journeysync;

import java.util.HashMap;
import java.util.Map;

/**
 * Operational detail for a tracked flight. Mirrors the `flight` object the web
 * client writes onto a flight event so both clients read the same document.
 */
public class FlightInfo {
    static final String UNKNOWN = "TBD";

    private static final String[] KNOWN_KEYS = {
            "number", "airline", "origin", "destination", "departureDate", "departureTerminal", "arrivalTerminal",
            "gate", "arrivalGate", "scheduledDeparture", "estimatedDeparture", "scheduledArrival", "estimatedArrival",
            "delayMinutes", "baggageClaim", "lastUpdated", "lastUpdatedUtc", "source"
    };

    public String number = UNKNOWN;
    public String airline = "Airline";
    public String origin = "ORG";
    public String destination = "DST";
    public String departureDate = "";
    public String departureTerminal = UNKNOWN;
    public String arrivalTerminal = UNKNOWN;
    public String gate = UNKNOWN;
    public String arrivalGate = UNKNOWN;
    public String scheduledDeparture = UNKNOWN;
    public String estimatedDeparture = UNKNOWN;
    public String scheduledArrival = UNKNOWN;
    public String estimatedArrival = UNKNOWN;
    public int delayMinutes;
    public String baggageClaim = UNKNOWN;
    public String lastUpdated = "when added";
    public String lastUpdatedUtc = "";
    public String source = "";
    public final Map<String, Object> extras = new HashMap<>();

    public static FlightInfo fromMap(Map<?, ?> map) {
        if (map == null) return null;
        FlightInfo flight = new FlightInfo();
        flight.number = MapValues.str(map.get("number"), UNKNOWN);
        flight.airline = MapValues.str(map.get("airline"), "Airline");
        flight.origin = MapValues.str(map.get("origin"), "ORG");
        flight.destination = MapValues.str(map.get("destination"), "DST");
        flight.departureDate = MapValues.str(map.get("departureDate"), "");
        flight.departureTerminal = MapValues.str(map.get("departureTerminal"), UNKNOWN);
        flight.arrivalTerminal = MapValues.str(map.get("arrivalTerminal"), UNKNOWN);
        flight.gate = MapValues.str(map.get("gate"), UNKNOWN);
        flight.arrivalGate = MapValues.str(map.get("arrivalGate"), UNKNOWN);
        flight.scheduledDeparture = MapValues.str(map.get("scheduledDeparture"), UNKNOWN);
        flight.estimatedDeparture = MapValues.str(map.get("estimatedDeparture"), UNKNOWN);
        flight.scheduledArrival = MapValues.str(map.get("scheduledArrival"), UNKNOWN);
        flight.estimatedArrival = MapValues.str(map.get("estimatedArrival"), UNKNOWN);
        flight.delayMinutes = Math.max(0, MapValues.integer(map.get("delayMinutes"), 0));
        flight.baggageClaim = MapValues.str(map.get("baggageClaim"), UNKNOWN);
        flight.lastUpdated = MapValues.str(map.get("lastUpdated"), "when added");
        flight.lastUpdatedUtc = MapValues.str(map.get("lastUpdatedUtc"), "");
        flight.source = MapValues.str(map.get("source"), "");
        MapValues.collectExtras(map, flight.extras, KNOWN_KEYS);
        return flight;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>(extras);
        map.put("number", number);
        map.put("airline", airline);
        map.put("origin", origin);
        map.put("destination", destination);
        map.put("departureDate", departureDate);
        map.put("departureTerminal", departureTerminal);
        map.put("arrivalTerminal", arrivalTerminal);
        map.put("gate", gate);
        map.put("arrivalGate", arrivalGate);
        map.put("scheduledDeparture", scheduledDeparture);
        map.put("estimatedDeparture", estimatedDeparture);
        map.put("scheduledArrival", scheduledArrival);
        map.put("estimatedArrival", estimatedArrival);
        map.put("delayMinutes", delayMinutes);
        map.put("baggageClaim", baggageClaim);
        map.put("lastUpdated", lastUpdated);
        map.put("lastUpdatedUtc", lastUpdatedUtc);
        map.put("source", source);
        return map;
    }

    public boolean isDelayed() {
        return delayMinutes > 0;
    }

    /** "SWISS LX 017", matching the title the web client generates. */
    public String displayTitle() {
        return (airline + " " + number).trim();
    }

    /** "JFK → ZRH · Gate E52", matching the meta line the web client generates. */
    public String displayMeta() {
        return origin + " → " + destination + " · Gate " + gate;
    }
}
