package com.manavdesai.journeysync;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Firestore hands back loosely typed values (numbers arrive as Long or Double,
 * missing fields as null). These helpers keep that coercion in one place so the
 * models stay readable.
 */
final class MapValues {
    private MapValues() {}

    static String str(Object value, String fallback) {
        if (value == null) return fallback;
        String text = String.valueOf(value).trim();
        if (text.isEmpty() || "null".equals(text)) return fallback;
        return text;
    }

    static int integer(Object value, int fallback) {
        if (value instanceof Number) return ((Number) value).intValue();
        if (value == null) return fallback;
        try {
            return (int) Double.parseDouble(String.valueOf(value).trim());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    static double decimal(Object value, double fallback) {
        if (value instanceof Number) return ((Number) value).doubleValue();
        if (value == null) return fallback;
        try {
            return Double.parseDouble(String.valueOf(value).trim());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    static boolean bool(Object value, boolean fallback) {
        if (value instanceof Boolean) return (Boolean) value;
        if (value == null) return fallback;
        String text = String.valueOf(value).trim();
        if ("true".equalsIgnoreCase(text)) return true;
        if ("false".equalsIgnoreCase(text)) return false;
        return fallback;
    }

    /** Copies every key the caller does not model into {@code target}. */
    static void collectExtras(Map<?, ?> source, Map<String, Object> target, String[] knownKeys) {
        List<String> known = Arrays.asList(knownKeys);
        for (Map.Entry<?, ?> entry : source.entrySet()) {
            String key = entry.getKey() == null ? null : String.valueOf(entry.getKey());
            if (key == null || known.contains(key)) continue;
            target.put(key, entry.getValue());
        }
    }
}
