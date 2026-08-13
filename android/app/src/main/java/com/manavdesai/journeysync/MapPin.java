package com.manavdesai.journeysync;

import java.util.HashMap;
import java.util.Map;

public class MapPin {
    private static final String[] KNOWN_KEYS = {"name", "code", "desc", "temp", "savedOffline", "latitude", "longitude"};

    public String name;
    public String code;
    public String desc;
    public String temp;
    public boolean savedOffline;
    /** Null when the pin predates coordinates, so an absent fix is never written back as 0,0. */
    public Double latitude;
    public Double longitude;
    public final Map<String, Object> extras = new HashMap<>();

    public static MapPin fromMap(Map<?, ?> map) {
        if (map == null) return null;
        MapPin pin = new MapPin();
        pin.name = MapValues.str(map.get("name"), "Destination");
        pin.code = MapValues.str(map.get("code"), pin.name.substring(0, Math.min(3, pin.name.length())).toUpperCase());
        pin.desc = MapValues.str(map.get("desc"), "Trip destination");
        pin.temp = MapValues.str(map.get("temp"), "TBD");
        pin.savedOffline = MapValues.bool(map.get("savedOffline"), false);
        pin.latitude = coordinate(map.get("latitude"), -90d, 90d);
        pin.longitude = coordinate(map.get("longitude"), -180d, 180d);
        MapValues.collectExtras(map, pin.extras, KNOWN_KEYS);
        return pin;
    }

    private static Double coordinate(Object value, double min, double max) {
        if (value == null) return null;
        double parsed = MapValues.decimal(value, Double.NaN);
        if (Double.isNaN(parsed) || parsed < min || parsed > max) return null;
        return parsed;
    }

    /** True when this pin can be placed on a map. */
    public boolean hasCoordinates() {
        return latitude != null && longitude != null;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>(extras);
        map.put("name", name);
        map.put("code", code);
        map.put("desc", desc);
        map.put("temp", temp);
        if (savedOffline) map.put("savedOffline", true);
        if (latitude != null) map.put("latitude", latitude);
        if (longitude != null) map.put("longitude", longitude);
        return map;
    }
}
