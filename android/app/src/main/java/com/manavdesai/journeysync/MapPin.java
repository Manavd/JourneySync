package com.manavdesai.journeysync;

import java.util.HashMap;
import java.util.Map;

public class MapPin {
    private static final String[] KNOWN_KEYS = {"name", "code", "desc", "temp", "savedOffline"};

    public String name;
    public String code;
    public String desc;
    public String temp;
    public boolean savedOffline;
    public final Map<String, Object> extras = new HashMap<>();

    public static MapPin fromMap(Map<?, ?> map) {
        if (map == null) return null;
        MapPin pin = new MapPin();
        pin.name = MapValues.str(map.get("name"), "Destination");
        pin.code = MapValues.str(map.get("code"), pin.name.substring(0, Math.min(3, pin.name.length())).toUpperCase());
        pin.desc = MapValues.str(map.get("desc"), "Trip destination");
        pin.temp = MapValues.str(map.get("temp"), "TBD");
        pin.savedOffline = MapValues.bool(map.get("savedOffline"), false);
        MapValues.collectExtras(map, pin.extras, KNOWN_KEYS);
        return pin;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>(extras);
        map.put("name", name);
        map.put("code", code);
        map.put("desc", desc);
        map.put("temp", temp);
        if (savedOffline) map.put("savedOffline", true);
        return map;
    }
}
