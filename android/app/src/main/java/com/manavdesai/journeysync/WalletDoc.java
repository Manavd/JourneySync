package com.manavdesai.journeysync;

import java.util.HashMap;
import java.util.Map;

public class WalletDoc {
    private static final String[] KNOWN_KEYS = {"id", "title", "meta", "code", "icon", "coralIcon"};

    public String id;
    public String title;
    public String meta;
    public String code;
    public String icon;
    public boolean coralIcon;
    public final Map<String, Object> extras = new HashMap<>();

    public static WalletDoc fromMap(Map<?, ?> map) {
        if (map == null) return null;
        WalletDoc doc = new WalletDoc();
        doc.id = MapValues.str(map.get("id"), "wallet-" + System.currentTimeMillis());
        doc.title = MapValues.str(map.get("title"), "Travel document");
        doc.meta = MapValues.str(map.get("meta"), "Trip document");
        doc.code = MapValues.str(map.get("code"), "TBD");
        doc.icon = MapValues.str(map.get("icon"), "DOC");
        doc.coralIcon = MapValues.bool(map.get("coralIcon"), false);
        MapValues.collectExtras(map, doc.extras, KNOWN_KEYS);
        return doc;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>(extras);
        map.put("id", id);
        map.put("title", title);
        map.put("meta", meta);
        map.put("code", code);
        map.put("icon", icon);
        if (coralIcon) map.put("coralIcon", true);
        return map;
    }
}
