package com.manavdesai.journeysync;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

/** A traveler's private, account-synced home location and IANA time zone. */
public class HomeLocation {
    public String city;
    public String region;
    public String country;
    public String countryCode;
    public String timeZone;
    public String source;

    public static HomeLocation inferredFromDevice() {
        HomeLocation home = new HomeLocation();
        String localeCountry = Locale.getDefault().getCountry();
        LocationData.Country known = LocationData.country(localeCountry);
        boolean supported = localeCountry != null && known.code.equalsIgnoreCase(localeCountry);
        home.city = "";
        home.region = "";
        home.countryCode = supported ? known.code : safe(localeCountry);
        home.country = supported ? known.name : safe(Locale.getDefault().getDisplayCountry());
        if (home.country.isEmpty()) home.country = "Home";
        home.timeZone = TimeZone.getDefault().getID();
        home.source = "device";
        return home;
    }

    public static HomeLocation fromMap(Map<?, ?> map) {
        if (map == null) return null;
        String zone = MapValues.str(map.get("timeZone"), "").trim();
        if (zone.isEmpty()) return null;
        HomeLocation home = new HomeLocation();
        home.city = MapValues.str(map.get("city"), "");
        home.region = MapValues.str(map.get("region"), "");
        home.country = MapValues.str(map.get("country"), "Home");
        home.countryCode = MapValues.str(map.get("countryCode"), "");
        home.timeZone = zone;
        home.source = "confirmed".equals(MapValues.str(map.get("source"), "")) ? "confirmed" : "device";
        return home;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("city", safe(city));
        map.put("region", safe(region));
        map.put("country", safe(country));
        map.put("countryCode", safe(countryCode));
        map.put("timeZone", safe(timeZone));
        map.put("source", "confirmed".equals(source) ? "confirmed" : "device");
        return map;
    }

    public String label() {
        StringBuilder value = new StringBuilder();
        append(value, city);
        append(value, region);
        append(value, country);
        return value.length() == 0 ? "Device time" : value.toString();
    }

    public boolean isConfirmed() {
        return "confirmed".equals(source) && city != null && !city.trim().isEmpty();
    }

    private static void append(StringBuilder value, String part) {
        String cleaned = safe(part);
        if (cleaned.isEmpty()) return;
        if (value.length() > 0) value.append(", ");
        value.append(cleaned);
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
