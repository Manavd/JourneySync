package com.manavdesai.journeysync;

import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.Timestamp;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Shared Firestore chat metadata and messages used by the native client. */
public class TripChat {
    public String id;
    public String tripName;
    public String tripRoute;
    public String ownerUid;
    public String ownerEmail;
    public List<String> memberEmails = new ArrayList<>();
    public long updatedAt;

    public static TripChat fromDocument(DocumentSnapshot snapshot) {
        if (snapshot == null) return null;
        TripChat chat = new TripChat();
        chat.id = snapshot.getId();
        chat.tripName = value(snapshot.get("tripName"), "Trip chat");
        chat.tripRoute = value(snapshot.get("tripRoute"), "");
        chat.ownerUid = value(snapshot.get("ownerUid"), "");
        chat.ownerEmail = value(snapshot.get("ownerEmail"), "");
        Object rawMembers = snapshot.get("memberEmails");
        if (rawMembers instanceof List) {
            for (Object member : (List<?>) rawMembers) {
                if (member instanceof String) chat.memberEmails.add((String) member);
            }
        }
        Timestamp updated = snapshot.getTimestamp("updatedAt");
        chat.updatedAt = updated == null ? 0L : updated.toDate().getTime();
        return chat;
    }

    public static class Message {
        public String id;
        public String text;
        public String senderUid;
        public String senderEmail;
        public String senderName;
        public long createdAt;

        public static Message fromDocument(DocumentSnapshot snapshot) {
            if (snapshot == null) return null;
            Message message = new Message();
            message.id = snapshot.getId();
            message.text = value(snapshot.get("text"), "");
            message.senderUid = value(snapshot.get("senderUid"), "");
            message.senderEmail = value(snapshot.get("senderEmail"), "");
            message.senderName = value(snapshot.get("senderName"), "Traveler");
            Timestamp created = snapshot.getTimestamp("createdAt");
            Object clientCreated = snapshot.get("clientCreatedAt");
            message.createdAt = created != null
                    ? created.toDate().getTime()
                    : clientCreated instanceof Number ? ((Number) clientCreated).longValue() : 0L;
            return message;
        }
    }

    static TripChat fromMap(String id, Map<String, Object> map) {
        if (map == null) return null;
        TripChat chat = new TripChat();
        chat.id = id;
        chat.tripName = value(map.get("tripName"), "Trip chat");
        chat.tripRoute = value(map.get("tripRoute"), "");
        chat.ownerUid = value(map.get("ownerUid"), "");
        chat.ownerEmail = value(map.get("ownerEmail"), "");
        Object rawMembers = map.get("memberEmails");
        if (rawMembers instanceof List) {
            for (Object member : (List<?>) rawMembers) {
                if (member instanceof String) chat.memberEmails.add((String) member);
            }
        }
        Object updated = map.get("updatedAt");
        chat.updatedAt = updated instanceof Number ? ((Number) updated).longValue() : 0L;
        return chat;
    }

    private static String value(Object value, String fallback) {
        return value instanceof String && !((String) value).trim().isEmpty()
                ? (String) value : fallback;
    }
}
