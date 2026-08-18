package com.manavdesai.journeysync;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.text.SimpleDateFormat;
import java.util.Locale;

/**
 * The Android and web clients share one Firestore document, so these tests pin
 * down the read/write contract between them.
 */
public class TripSyncTest {

    /** A trip document shaped the way the website writes it. */
    private Map<String, Object> webTripDocument() {
        Map<String, Object> flight = new LinkedHashMap<>();
        flight.put("number", "LX 017");
        flight.put("airline", "SWISS");
        flight.put("origin", "JFK");
        flight.put("destination", "ZRH");
        flight.put("departureDate", "2026-09-12");
        flight.put("departureTerminal", "1");
        flight.put("arrivalTerminal", "2");
        flight.put("gate", "E52");
        flight.put("arrivalGate", "A7");
        flight.put("scheduledDeparture", "8:40 PM");
        flight.put("estimatedDeparture", "9:10 PM");
        flight.put("scheduledArrival", "10:15 AM (+1)");
        flight.put("estimatedArrival", "10:45 AM (+1)");
        flight.put("delayMinutes", 30L); // Firestore returns whole numbers as Long.
        flight.put("baggageClaim", "Carousel 24");
        flight.put("lastUpdated", "Just now");
        flight.put("lastUpdatedUtc", "2026-09-12T22:10:00Z");
        flight.put("source", "AeroDataBox");

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("id", "ev-1");
        event.put("time", "8:40 PM");
        event.put("title", "SWISS LX 017");
        event.put("meta", "JFK → ZRH · Gate E52");
        event.put("kind", "flight");
        event.put("status", "Delayed");
        event.put("flight", flight);

        Map<String, Object> day = new LinkedHashMap<>();
        day.put("id", "day-1");
        day.put("date", "12");
        day.put("short", "SAT");
        day.put("label", "Arrival in Zürich");
        day.put("isoDate", "2026-09-12");
        day.put("events", new ArrayList<>(Arrays.asList(event)));

        Map<String, Object> trip = new LinkedHashMap<>();
        trip.put("id", "swiss-escape");
        trip.put("name", "Swiss Escape");
        trip.put("route", "Zürich → Interlaken → Zermatt");
        trip.put("startDate", "2026-09-12");
        trip.put("endDate", "2026-09-20");
        trip.put("countryCode", "CH");
        trip.put("country", "Switzerland");
        trip.put("regionCode", "ZH");
        trip.put("region", "Zurich");
        trip.put("city", "Zurich");
        trip.put("currency", "CHF");
        trip.put("timeZone", "Europe/Zurich");
        trip.put("travelersCount", 4L);
        trip.put("days", new ArrayList<>(Arrays.asList(day)));
        Map<String, Object> expense = new LinkedHashMap<>();
        expense.put("id", "exp-1"); expense.put("description", "Hotel"); expense.put("amount", 220.50);
        expense.put("currency", "CHF"); expense.put("paidBy", "Manav"); expense.put("date", "Sep 12");
        expense.put("category", "Lodging");
        Map<String, Object> wallet = new LinkedHashMap<>();
        wallet.put("id", "w-1"); wallet.put("title", "Boarding pass"); wallet.put("meta", "SWISS · PDF");
        wallet.put("code", "LX-123"); wallet.put("icon", "LX");
        Map<String, Object> pin = new LinkedHashMap<>();
        pin.put("name", "Zürich"); pin.put("code", "ZRH"); pin.put("desc", "Old Town"); pin.put("temp", "18°C");
        Map<String, Object> traveler = new LinkedHashMap<>();
        traveler.put("name", "Manav"); traveler.put("role", "Trip organizer"); traveler.put("email", "manav@example.com");
        traveler.put("avatar", "MS"); traveler.put("bg", "avatar-me");
        trip.put("expenses", new ArrayList<>(Arrays.asList(expense)));
        trip.put("walletDocs", new ArrayList<>(Arrays.asList(wallet)));
        trip.put("mapPins", new ArrayList<>(Arrays.asList(pin)));
        trip.put("travelersList", new ArrayList<>(Arrays.asList(traveler)));
        Map<String, Object> guestFlight = new LinkedHashMap<>();
        guestFlight.put("id", "guest-1"); guestFlight.put("guestName", "Amelia");
        guestFlight.put("note", "Airport pickup"); guestFlight.put("status", "Delayed"); guestFlight.put("flight", flight);
        trip.put("guestFlights", new ArrayList<>(Arrays.asList(guestFlight)));
        trip.put("futureWebField", "preserve me");
        return trip;
    }

    @Test
    public void readsFlightDetailWrittenByTheWebsite() {
        Trip trip = Trip.fromMap(webTripDocument());
        assertNotNull(trip);
        assertEquals("Swiss Escape", trip.name);
        assertEquals(4, trip.travelersCount);
        assertEquals("CHF", trip.currency);
        assertEquals("Europe/Zurich", trip.timeZone);
        assertEquals("2026-09-20", trip.endDate);
        assertEquals("2026-09-12", trip.days.get(0).isoDate);

        List<Trip.TrackedFlight> flights = trip.trackedFlights();
        assertEquals(1, flights.size());
        FlightInfo flight = flights.get(0).event.flight;
        assertNotNull(flight);
        assertEquals("E52", flight.gate);
        assertEquals("A7", flight.arrivalGate);
        assertEquals("2026-09-12", flight.departureDate);
        assertEquals("1", flight.departureTerminal);
        assertEquals(30, flight.delayMinutes);
        assertTrue(flight.isDelayed());
        assertEquals("Carousel 24", flight.baggageClaim);
        assertEquals("AeroDataBox", flight.source);
        assertEquals(0, flights.get(0).dayIndex);
    }

    /**
     * Android exposes every major web collection and still keeps future fields
     * it does not understand.
     */
    @Test
    public void readsAndPreservesSharedFeatureCollections() {
        Map<String, Object> original = webTripDocument();
        Trip parsed = Trip.fromMap(original);
        assertEquals(1, parsed.expenses.size());
        assertEquals(220.50, parsed.expenses.get(0).amount, 0.001);
        assertEquals("Boarding pass", parsed.walletDocs.get(0).title);
        assertEquals("ZRH", parsed.mapPins.get(0).code);
        assertEquals("manav@example.com", parsed.travelersList.get(0).email);
        assertEquals("Amelia", parsed.guestFlights.get(0).guestName);
        assertTrue(parsed.guestFlights.get(0).isDelayed());
        assertEquals(220.50, parsed.totalExpenses(), 0.001);

        Map<String, Object> written = parsed.toMap();

        for (String key : new String[]{"expenses", "walletDocs", "mapPins", "travelersList"}) {
            assertEquals("field " + key + " must survive", original.get(key), written.get(key));
        }
        assertEquals("swiss-escape", written.get("id"));
        assertEquals(4, written.get("travelersCount"));
        assertEquals("preserve me", written.get("futureWebField"));
        @SuppressWarnings("unchecked")
        Map<String, Object> writtenGuest = ((List<Map<String, Object>>) written.get("guestFlights")).get(0);
        assertEquals("Amelia", writtenGuest.get("guestName"));
        assertEquals("Delayed", writtenGuest.get("status"));

        @SuppressWarnings("unchecked")
        Map<String, Object> writtenDay = ((List<Map<String, Object>>) written.get("days")).get(0);
        assertEquals("SAT", writtenDay.get("short"));
        @SuppressWarnings("unchecked")
        Map<String, Object> writtenEvent = ((List<Map<String, Object>>) writtenDay.get("events")).get(0);
        assertEquals("Delayed", writtenEvent.get("status"));
        @SuppressWarnings("unchecked")
        Map<String, Object> writtenFlight = (Map<String, Object>) writtenEvent.get("flight");
        assertEquals("E52", writtenFlight.get("gate"));
        assertEquals(30, writtenFlight.get("delayMinutes"));
    }

    @Test
    public void readsTripChatMembershipMetadata() {
        Map<String, Object> chatMap = new LinkedHashMap<>();
        chatMap.put("tripName", "Swiss Escape");
        chatMap.put("tripRoute", "Zurich to Zermatt");
        chatMap.put("ownerUid", "owner-1");
        chatMap.put("ownerEmail", "owner@example.com");
        chatMap.put("memberEmails", Arrays.asList("owner@example.com", "friend@example.com"));
        chatMap.put("updatedAt", 1234L);

        TripChat chat = TripChat.fromMap("swiss-escape", chatMap);
        assertNotNull(chat);
        assertEquals("swiss-escape", chat.id);
        assertEquals("Swiss Escape", chat.tripName);
        assertEquals(2, chat.memberEmails.size());
        assertEquals("friend@example.com", chat.memberEmails.get(1));
        assertEquals(1234L, chat.updatedAt);
    }

    @Test
    public void keepsUnknownEventFieldsOnEvents() {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("id", "ev-9");
        event.put("kind", "stay");
        event.put("bookingReference", "AB12CD"); // a field only the website knows

        Map<String, Object> written = DayEvent.fromMap(event).toMap();
        assertEquals("AB12CD", written.get("bookingReference"));
    }

    @Test
    public void nonFlightEventsCarryNoFlightObject() {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("id", "ev-2");
        event.put("kind", "train");

        DayEvent parsed = DayEvent.fromMap(event);
        assertNull(parsed.flight);
        assertNull(parsed.toMap().get("flight"));
    }

    @Test
    public void promotingAnEventToAFlightGivesItTrackableDetail() {
        DayEvent event = new DayEvent("ev-3", "6:30 PM", "Hop to Geneva", "", "flight", "Scheduled");
        FlightInfo flight = event.requireFlight();

        assertEquals("6:30 PM", flight.estimatedDeparture);
        assertEquals(FlightInfo.UNKNOWN, flight.gate);
        assertEquals("ORG → DST · Gate TBD", flight.displayMeta());
        assertEquals(1, new Trip("t", "T", "R", "2026-01-01",
                1, new ArrayList<>(Arrays.asList(new Day("d", "01", "MON", "Day", new ArrayList<>(Arrays.asList(event))))))
                .trackedFlights().size());
    }

    @Test
    public void missingFieldsFallBackInsteadOfCrashing() {
        Trip trip = Trip.fromMap(new HashMap<String, Object>());
        assertNotNull(trip);
        assertEquals(1, trip.travelersCount);
        assertTrue(trip.days.isEmpty());
        assertTrue(trip.trackedFlights().isEmpty());
        assertNull(Trip.fromMap(null));
    }

    @Test
    public void formatsTimesTheSameWayTheWebsiteDoes() {
        assertEquals("8:40 PM", TimeFormat.display("20:40"));
        assertEquals("12:05 AM", TimeFormat.display("0:05"));
        assertEquals("12:30 PM", TimeFormat.display("12:30"));
        assertEquals("9:07 AM", TimeFormat.display("9:7"));
        assertEquals("10:15 AM", TimeFormat.display("10:15 AM"));
        assertEquals("12:00 PM", TimeFormat.display(""));
        assertEquals("12:00 PM", TimeFormat.display(null));
        assertEquals("Any time", TimeFormat.display("Any time"));
    }

    @Test
    public void acceptsAirlineNamesWhenSearchingLiveFlights() {
        assertEquals("DL0055", MainActivity.normalizeFlightCodeInput("Delta flight 0055"));
        assertEquals("AA100", MainActivity.normalizeFlightCodeInput("American Airlines 100"));
        assertEquals("UA42", MainActivity.normalizeFlightCodeInput("UA 42"));
    }

    @Test
    public void liveRefreshTimingRespondsToFlightStatus() {
        assertTrue(MainActivity.shouldAutoRefresh("Delayed", "2000-01-01T00:00:00Z"));
        assertTrue(MainActivity.shouldAutoRefresh("Boarding", ""));
        assertFalse(MainActivity.shouldAutoRefresh("Delayed", "2999-01-01T00:00:00Z"));
    }

    @Test
    public void readsEveryTimestampShapeTheFlightEndpointCanReturn() {
        long noon = 1609502400000L; // 2021-01-01T12:00:00Z
        assertEquals(noon, MainActivity.parseIsoUtc("2021-01-01T12:00:00.000Z"));
        assertEquals(noon, MainActivity.parseIsoUtc("2021-01-01T12:00:00Z"));
        assertEquals(noon, MainActivity.parseIsoUtc("2021-01-01 12:00Z")); // AeroDataBox's own shape
        assertEquals(noon, MainActivity.parseIsoUtc("2021-01-01T14:00:00+02:00"));
        assertEquals(noon, MainActivity.parseIsoUtc("2021-01-01T09:30:00-0230"));
        assertEquals(noon, MainActivity.parseIsoUtc(MainActivity.utcTimestamp(noon)));
    }

    @Test
    public void unreadableTimestampsReportFailureRatherThanLookingCurrent() {
        assertEquals(-1L, MainActivity.parseIsoUtc("not a timestamp"));
        assertEquals(-1L, MainActivity.parseIsoUtc(""));
        assertEquals(-1L, MainActivity.parseIsoUtc(null));
        assertEquals(-1L, MainActivity.parseIsoUtc("2021-13-45T99:99:99Z"));
    }

    /** A flight the provider never recognises must not be retried every tick. */
    @Test
    public void repeatedRefreshFailuresBackOff() {
        assertEquals(60_000L, MainActivity.backoffMillis(1));
        assertEquals(120_000L, MainActivity.backoffMillis(2));
        assertEquals(240_000L, MainActivity.backoffMillis(3));
        assertEquals(1_800_000L, MainActivity.backoffMillis(9));
        assertEquals(1_800_000L, MainActivity.backoffMillis(500));
    }

    @Test
    public void archivesTheDayAfterTheLatestItineraryDate() throws Exception {
        Trip trip = Trip.fromMap(webTripDocument());
        trip.endDate = "2026-11-10";
        trip.days.get(0).isoDate = "2026-11-12";
        SimpleDateFormat dates = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        dates.setLenient(false);

        assertFalse(trip.isCompleted(dates.parse("2026-11-12").getTime()));
        assertTrue(trip.isCompleted(dates.parse("2026-11-13").getTime()));
        assertTrue(trip.isArchived(dates.parse("2026-11-13").getTime()));
    }

    @Test
    public void manualArchiveAndLocationFieldsRoundTrip() {
        Trip trip = Trip.fromMap(webTripDocument());
        trip.archivedAt = "2026-08-10T12:00:00Z";
        Map<String, Object> saved = trip.toMap();

        assertEquals("CH", saved.get("countryCode"));
        assertEquals("Zurich", saved.get("city"));
        assertEquals("CHF", saved.get("currency"));
        assertEquals("Europe/Zurich", saved.get("timeZone"));
        assertEquals("2026-08-10T12:00:00Z", saved.get("archivedAt"));
        trip.archivedAt = "";
        assertFalse(trip.toMap().containsKey("archivedAt"));
    }
    @Test
    public void homeLocationAndWorldClockRoundTrip() {
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("country", "United States");
        profile.put("countryCode", "US");
        profile.put("region", "Georgia");
        profile.put("city", "Atlanta");
        profile.put("timeZone", "America/New_York");
        profile.put("source", "confirmed");

        HomeLocation home = HomeLocation.fromMap(profile);

        assertEquals("Atlanta, Georgia, United States", home.label());
        assertEquals("America/New_York", home.timeZone);
        assertTrue(home.isConfirmed());
        assertEquals("America/New_York", home.toMap().get("timeZone"));
        assertEquals(
                "Destination is 6 hr ahead of home",
                MainActivity.clockDifference(1767225600000L, "America/New_York", "Europe/Zurich")
        );
    }
}