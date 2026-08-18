"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  db,
  doc,
  limitToLast,
  onQuerySnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type User,
} from "./firebase";

export type ChatTrip = {
  id: string;
  name: string;
  route: string;
  travelersList?: Array<{ email?: string }>;
};

type TripChat = {
  id: string;
  tripName: string;
  tripRoute: string;
  ownerUid: string;
  ownerEmail: string;
  memberEmails: string[];
  updatedAt: number;
};

type ChatMessage = {
  id: string;
  text: string;
  senderUid: string;
  senderEmail: string;
  senderName: string;
  createdAt: number;
};

const metadataSignatures = new Map<string, string>();

function normalizeEmail(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function timestampMillis(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    const timestamp = value as { toMillis?: () => number; seconds?: number };
    if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
    if (typeof timestamp.seconds === "number") return timestamp.seconds * 1000;
  }
  return 0;
}

function memberEmails(user: User, trip: ChatTrip): string[] {
  const values = [
    normalizeEmail(user.email),
    ...(trip.travelersList || []).map((traveler) => normalizeEmail(traveler.email)),
  ].filter((email) => email.includes("@"));
  return Array.from(new Set(values)).slice(0, 50);
}

function localChat(user: User, trip: ChatTrip): TripChat {
  return {
    id: trip.id,
    tripName: trip.name || "Untitled trip",
    tripRoute: trip.route || "",
    ownerUid: user.uid,
    ownerEmail: normalizeEmail(user.email),
    memberEmails: memberEmails(user, trip),
    updatedAt: 0,
  };
}

function cloudChat(id: string, data: Record<string, unknown>): TripChat {
  return {
    id,
    tripName: typeof data.tripName === "string" ? data.tripName : "Trip chat",
    tripRoute: typeof data.tripRoute === "string" ? data.tripRoute : "",
    ownerUid: typeof data.ownerUid === "string" ? data.ownerUid : "",
    ownerEmail: typeof data.ownerEmail === "string" ? data.ownerEmail : "",
    memberEmails: Array.isArray(data.memberEmails)
      ? data.memberEmails.filter((email): email is string => typeof email === "string")
      : [],
    updatedAt: timestampMillis(data.updatedAt),
  };
}

async function writeChatMetadata(user: User, trip: ChatTrip) {
  const ownerEmail = normalizeEmail(user.email);
  if (!ownerEmail) throw new Error("Your Firebase account needs an email address to use group chat.");
  await setDoc(doc(db, "trip_chats", trip.id), {
    tripId: trip.id,
    tripName: (trip.name || "Untitled trip").slice(0, 160),
    tripRoute: (trip.route || "").slice(0, 300),
    ownerUid: user.uid,
    ownerEmail,
    memberEmails: memberEmails(user, trip),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

function useChatGroups(user: User) {
  const email = normalizeEmail(user.email);
  const [state, setState] = useState<{ email: string; groups: TripChat[]; error: string }>({
    email: "",
    groups: [],
    error: "",
  });

  useEffect(() => {
    if (!email) return;
    const rooms = query(
      collection(db, "trip_chats"),
      where("memberEmails", "array-contains", email),
    );
    return onQuerySnapshot(rooms, (snapshot) => {
      const next = snapshot.docs
        .map((room) => cloudChat(room.id, room.data() as Record<string, unknown>))
        .sort((left, right) => right.updatedAt - left.updatedAt || left.tripName.localeCompare(right.tripName));
      setState({ email, groups: next, error: "" });
    }, (listenError) => {
      console.error("Could not load trip chats:", listenError);
      setState({
        email,
        groups: [],
        error: "Group chat could not connect to Firestore. Make sure the latest security rules are deployed.",
      });
    });
  }, [email]);

  if (!email) {
    return {
      groups: [],
      loading: false,
      error: "Your Firebase account needs an email address to use group chat.",
    };
  }
  return {
    groups: state.email === email ? state.groups : [],
    loading: state.email !== email,
    error: state.email === email ? state.error : "",
  };
}

function mergedGroups(user: User, trips: ChatTrip[], groups: TripChat[]): TripChat[] {
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const trip of trips) {
    if (!byId.has(trip.id)) byId.set(trip.id, localChat(user, trip));
  }
  return Array.from(byId.values()).sort(
    (left, right) => right.updatedAt - left.updatedAt || left.tripName.localeCompare(right.tripName),
  );
}

export function TripChatSync({ user, trips }: { user: User; trips: ChatTrip[] }) {
  useEffect(() => {
    const prefix = user.uid + ":";
    const activeIds = new Set(trips.map((trip) => trip.id));
    for (const knownKey of metadataSignatures.keys()) {
      if (knownKey.startsWith(prefix) && !activeIds.has(knownKey.slice(prefix.length))) {
        metadataSignatures.delete(knownKey);
      }
    }

    for (const trip of trips) {
      const signatureKey = prefix + trip.id;
      const signature = JSON.stringify({
        name: trip.name,
        route: trip.route,
        members: memberEmails(user, trip),
      });
      if (metadataSignatures.get(signatureKey) === signature) continue;
      metadataSignatures.set(signatureKey, signature);
      void writeChatMetadata(user, trip).catch((syncError) => {
        metadataSignatures.delete(signatureKey);
        console.error("Could not sync group chat metadata for " + trip.id + ":", syncError);
      });
    }
  }, [trips, user]);

  return null;
}

export function GroupChatLauncher({
  user,
  trips,
  onOpen,
}: {
  user: User;
  trips: ChatTrip[];
  onOpen: (chatId: string) => void;
}) {
  const { groups, loading, error } = useChatGroups(user);
  const rooms = useMemo(() => mergedGroups(user, trips, groups), [groups, trips, user]);

  return (
    <section className="chat-launcher" aria-labelledby="chat-launcher-title">
      <div className="chat-launcher-heading">
        <div>
          <span className="eyebrow">LIVE GROUP CHAT</span>
          <h2 id="chat-launcher-title">Plan together, in one conversation</h2>
          <p>Traveler emails grant access to this chat only. Your private itinerary and account data stay private.</p>
        </div>
        {rooms[0] && (
          <button className="primary-action" type="button" onClick={() => onOpen(rooms[0].id)}>
            Open group chats
          </button>
        )}
      </div>
      {error && <p className="chat-error" role="alert">{error}</p>}
      {loading && rooms.length === 0 ? (
        <p className="chat-empty">Connecting to your conversations…</p>
      ) : rooms.length > 0 ? (
        <div className="chat-launcher-rooms">
          {rooms.map((room) => (
            <button type="button" key={room.id} onClick={() => onOpen(room.id)}>
              <span className="chat-room-mark" aria-hidden="true">••</span>
              <span><strong>{room.tripName}</strong><small>{room.tripRoute || "Trip group"} · {room.memberEmails.length} member{room.memberEmails.length === 1 ? "" : "s"}</small></span>
              <i aria-hidden="true">→</i>
            </button>
          ))}
        </div>
      ) : (
        <p className="chat-empty">Create a trip, then add traveler account emails to start a conversation.</p>
      )}
    </section>
  );
}

export default function GroupChat({
  user,
  trips,
  initialChatId,
}: {
  user: User;
  trips: ChatTrip[];
  initialChatId?: string;
}) {
  const { groups, loading: groupsLoading, error: groupsError } = useChatGroups(user);
  const rooms = useMemo(() => mergedGroups(user, trips, groups), [groups, trips, user]);
  const [chosenId, setChosenId] = useState(initialChatId || "");
  const selectedId = rooms.some((room) => room.id === chosenId)
    ? chosenId
    : rooms.some((room) => room.id === initialChatId)
      ? (initialChatId || "")
      : (rooms[0]?.id || initialChatId || "");
  const [messageState, setMessageState] = useState<{ chatId: string; messages: ChatMessage[]; error: string }>({
    chatId: "",
    messages: [],
    error: "",
  });
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEnd = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    const messageQuery = query(
      collection(db, "trip_chats", selectedId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(200),
    );
    return onQuerySnapshot(messageQuery, (snapshot) => {
      const nextMessages = snapshot.docs.map((message) => {
        const data = message.data() as Record<string, unknown>;
        return {
          id: message.id,
          text: typeof data.text === "string" ? data.text : "",
          senderUid: typeof data.senderUid === "string" ? data.senderUid : "",
          senderEmail: typeof data.senderEmail === "string" ? data.senderEmail : "",
          senderName: typeof data.senderName === "string" ? data.senderName : "Traveler",
          createdAt: timestampMillis(data.createdAt)
            || (typeof data.clientCreatedAt === "number" ? data.clientCreatedAt : 0),
        };
      });
      setMessageState({ chatId: selectedId, messages: nextMessages, error: "" });
    }, (listenError) => {
      console.error("Could not load chat messages:", listenError);
      setMessageState({
        chatId: selectedId,
        messages: [],
        error: "Messages could not load. Check the Firestore rules and your traveler email.",
      });
    });
  }, [selectedId]);

  const messages = useMemo(() => messageState.chatId === selectedId ? messageState.messages : [], [messageState, selectedId]);
  const messagesLoading = Boolean(selectedId) && messageState.chatId !== selectedId;
  const messagesError = sendError || (messageState.chatId === selectedId ? messageState.error : "");

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  const selected = rooms.find((room) => room.id === selectedId) || null;

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || sending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = String(data.get("message") || "").trim();
    if (!text) return;

    setSending(true);
    setSendError("");
    try {
      const ownedTrip = trips.find((trip) => trip.id === selectedId);
      if (ownedTrip && (!selected || selected.ownerUid === user.uid)) {
        await writeChatMetadata(user, ownedTrip);
      }
      const senderEmail = normalizeEmail(user.email);
      await addDoc(collection(db, "trip_chats", selectedId, "messages"), {
        text: text.slice(0, 1000),
        senderUid: user.uid,
        senderEmail,
        senderName: (user.displayName || senderEmail.split("@")[0] || "Traveler").slice(0, 80),
        createdAt: serverTimestamp(),
        clientCreatedAt: Date.now(),
      });
      form.reset();
    } catch (sendError) {
      console.error("Could not send group message:", sendError);
      setSendError("That message could not be sent. Confirm this account email is listed as a traveler.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="group-chat-layout">
      <aside className="chat-room-list" aria-label="Trip conversations">
        <span className="eyebrow">CONVERSATIONS</span>
        <h2>Group chats</h2>
        <p>Only the organizer and listed traveler account emails can enter.</p>
        {groupsError && <p className="chat-error" role="alert">{groupsError}</p>}
        {groupsLoading && rooms.length === 0 && <p className="chat-empty">Connecting…</p>}
        <div className="chat-room-buttons">
          {rooms.map((room) => (
            <button
              type="button"
              className={room.id === selectedId ? "selected" : ""}
              key={room.id}
              onClick={() => { setChosenId(room.id); setSendError(""); }}
            >
              <span className="chat-room-mark" aria-hidden="true">••</span>
              <span><strong>{room.tripName}</strong><small>{room.memberEmails.length} member{room.memberEmails.length === 1 ? "" : "s"}</small></span>
            </button>
          ))}
        </div>
      </aside>

      <section className="chat-room" aria-live="polite">
        {selected ? (
          <>
            <header className="chat-room-header">
              <div>
                <span className="eyebrow">LIVE FIRESTORE CHAT</span>
                <h2>{selected.tripName}</h2>
                <p>{selected.tripRoute || "Trip group"} · {selected.memberEmails.length} member{selected.memberEmails.length === 1 ? "" : "s"}</p>
              </div>
              <span className="chat-live-status"><i /> Live</span>
            </header>

            <div className="chat-messages">
              {messagesLoading && messages.length === 0 ? (
                <p className="chat-empty">Loading messages…</p>
              ) : messages.length === 0 ? (
                <div className="chat-welcome">
                  <span aria-hidden="true">••</span>
                  <h3>Start the trip conversation</h3>
                  <p>Messages appear here instantly on the website and Android app for every listed traveler.</p>
                </div>
              ) : messages.map((message) => {
                const mine = message.senderUid === user.uid;
                return (
                  <article className={`chat-message ${mine ? "mine" : ""}`} key={message.id}>
                    <span className="chat-avatar" aria-hidden="true">{message.senderName.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <header><strong>{mine ? "You" : message.senderName}</strong><time>{message.createdAt ? new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(message.createdAt) : "Sending…"}</time></header>
                      <p>{message.text}</p>
                    </div>
                  </article>
                );
              })}
              <div ref={messagesEnd} />
            </div>

            {messagesError && <p className="chat-error chat-message-error" role="alert">{messagesError}</p>}
            <form className="chat-composer" onSubmit={sendMessage}>
              <label htmlFor="group-message">Message the group</label>
              <div>
                <textarea id="group-message" name="message" rows={2} maxLength={1000} placeholder="Share an update, question, or meetup plan…" required disabled={sending} />
                <button className="primary-action" type="submit" disabled={sending}>{sending ? "Sending…" : "Send"}</button>
              </div>
              <small>Visible only to the organizer and traveler account emails on this trip.</small>
            </form>
          </>
        ) : (
          <div className="chat-welcome chat-room-empty">
            <span aria-hidden="true">••</span>
            <h3>No group chat yet</h3>
            <p>Create a trip and add at least one traveler email. JourneySync will create the secure conversation automatically.</p>
          </div>
        )}
      </section>
    </div>
  );
}
