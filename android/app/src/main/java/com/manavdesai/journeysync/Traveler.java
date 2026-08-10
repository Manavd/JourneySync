package com.manavdesai.journeysync;

import java.util.HashMap;
import java.util.Map;

public class Traveler {
    private static final String[] KNOWN_KEYS = {"name", "role", "email", "avatar", "bg"};

    public String name;
    public String role;
    public String email;
    public String avatar;
    public String bg;
    public final Map<String, Object> extras = new HashMap<>();

    public static Traveler fromMap(Map<?, ?> map) {
        if (map == null) return null;
        Traveler traveler = new Traveler();
        traveler.name = MapValues.str(map.get("name"), "Traveler");
        traveler.role = MapValues.str(map.get("role"), "Traveler");
        traveler.email = MapValues.str(map.get("email"), "traveler@example.com");
        traveler.avatar = MapValues.str(map.get("avatar"), initials(traveler.name));
        traveler.bg = MapValues.str(map.get("bg"), "blue");
        MapValues.collectExtras(map, traveler.extras, KNOWN_KEYS);
        return traveler;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>(extras);
        map.put("name", name);
        map.put("role", role);
        map.put("email", email);
        map.put("avatar", avatar);
        map.put("bg", bg);
        return map;
    }

    public static String initials(String name) {
        if (name == null || name.trim().isEmpty()) return "TR";
        String[] parts = name.trim().split("\\s+");
        String value = parts[0].substring(0, 1);
        if (parts.length > 1) value += parts[parts.length - 1].substring(0, 1);
        return value.toUpperCase();
    }
}
