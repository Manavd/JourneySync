package com.manavdesai.journeysync;

import java.util.HashMap;
import java.util.Map;

public class Expense {
    private static final String[] KNOWN_KEYS = {"id", "description", "amount", "currency", "paidBy", "date", "category", "settled"};

    public String id;
    public String description;
    public double amount;
    public String currency;
    public String paidBy;
    public String date;
    public String category;
    public boolean settled;
    public final Map<String, Object> extras = new HashMap<>();

    public static Expense fromMap(Map<?, ?> map) {
        if (map == null) return null;
        Expense expense = new Expense();
        expense.id = MapValues.str(map.get("id"), "exp-" + System.currentTimeMillis());
        expense.description = MapValues.str(map.get("description"), "Trip expense");
        expense.amount = Math.max(0, MapValues.decimal(map.get("amount"), 0));
        expense.currency = MapValues.str(map.get("currency"), "USD");
        expense.paidBy = MapValues.str(map.get("paidBy"), "Traveler");
        expense.date = MapValues.str(map.get("date"), "Today");
        expense.category = MapValues.str(map.get("category"), "Other");
        expense.settled = MapValues.bool(map.get("settled"), false);
        MapValues.collectExtras(map, expense.extras, KNOWN_KEYS);
        return expense;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>(extras);
        map.put("id", id);
        map.put("description", description);
        map.put("amount", amount);
        map.put("currency", currency);
        map.put("paidBy", paidBy);
        map.put("date", date);
        map.put("category", category);
        if (settled) map.put("settled", true);
        return map;
    }
}
