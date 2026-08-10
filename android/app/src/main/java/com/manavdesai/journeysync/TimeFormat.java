package com.manavdesai.journeysync;

/** Shared time normalization used by itinerary and flight forms. */
final class TimeFormat {
    private TimeFormat() {}

    static String display(String raw) {
        if (raw == null) return "12:00 PM";
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return "12:00 PM";
        String lower = trimmed.toLowerCase();
        if (lower.contains("am") || lower.contains("pm")) return trimmed;
        String[] parts = trimmed.split(":");
        if (parts.length < 2) return trimmed;
        int hour;
        try {
            hour = Integer.parseInt(parts[0].trim());
        } catch (NumberFormatException notATime) {
            return trimmed;
        }
        String minutes = parts[1].trim();
        if (minutes.length() < 2) minutes = "0" + minutes;
        String suffix = hour >= 12 ? "PM" : "AM";
        if (hour == 0) hour = 12;
        else if (hour > 12) hour -= 12;
        return hour + ":" + minutes + " " + suffix;
    }
}
