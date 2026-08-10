package com.manavdesai.journeysync;

import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** A native Android JourneySync experience backed by Firebase Authentication and Firestore with full website feature parity. */
public class MainActivity extends android.app.Activity {
    private static final int RC_GOOGLE_SIGN_IN = 4021;
    private static final String BLUE = "#0C79D8";
    private static final String INK = "#14213D";
    private static final String SURFACE = "#F7F9FC";
    private static final String CORAL = "#E11D48";
    private static final String GREEN = "#1D7A48";
    private static final String ORANGE = "#D97706";
    private static final String PURPLE = "#7C3AED";
    private static final String MUTED = "#516072";
    private static final String FAINT = "#7A8795";
    private static final String LINE = "#DDE4ED";

    private static final int SECTION_OVERVIEW = 0;
    private static final int SECTION_ITINERARY = 1;
    private static final int SECTION_FLIGHTS = 2;
    private static final int SECTION_MAP = 3;
    private static final int SECTION_EXPENSES = 4;
    private static final int SECTION_WALLET = 5;
    private static final int SECTION_TRAVELERS = 6;
    private static final int SECTION_GUEST_FLIGHTS = 7;

    private static final String[] EVENT_KINDS = {"activity", "flight", "stay", "food", "train"};
    private static final String[] EVENT_KIND_LABELS = {
            "🏛️ Activity", "✈️ Flight", "🏨 Stay", "🍽️ Food / Dining", "🚆 Train / Transit"
    };
    private static final String[] FLIGHT_STATUSES = {"Scheduled", "On time", "Delayed", "Boarding", "Landed", "Cancelled"};

    private FirebaseAuth firebaseAuth;
    private FirebaseFirestore firestore;
    private GoogleSignInClient googleClient;
    private LinearLayout screen;

    private final List<Button> authButtons = new ArrayList<>();
    private ProgressBar authProgress;

    private final List<Trip> savedTrips = new ArrayList<>();
    private String activeTripId = "";
    private int activeDayIndex = 0;
    private int activeSection = SECTION_OVERVIEW;

    /**
     * The uid whose screen is currently on display, so returning to the
     * foreground does not tear down and refetch a dashboard that is already
     * correct. Null means the sign-in screen is showing.
     */
    private String renderedUid;
    private boolean tripsLoaded;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        firebaseAuth = FirebaseAuth.getInstance();
        firestore = FirebaseFirestore.getInstance();

        GoogleSignInOptions googleOptions = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(getString(R.string.google_web_client_id))
                .requestEmail()
                .build();
        googleClient = GoogleSignIn.getClient(this, googleOptions);
        showCurrentState();
    }

    @Override
    protected void onStart() {
        super.onStart();
        showCurrentState();
    }

    private void showCurrentState() {
        FirebaseUser user = firebaseAuth == null ? null : firebaseAuth.getCurrentUser();
        String uid = user == null ? null : user.getUid();
        // Both onCreate and onStart run at launch; without this guard the
        // dashboard would render (and refetch) twice, which could also create
        // two starter itineraries for a brand-new account.
        if (screen != null && equalIds(uid, renderedUid)) return;
        if (user == null) {
            showLogin();
        } else {
            showDashboard(user);
        }
    }

    private void prepareScreen() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setPadding(dp(20), dp(24), dp(20), dp(40));
        screen.setBackgroundColor(Color.parseColor(SURFACE));
        scroll.addView(screen, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT, ScrollView.LayoutParams.WRAP_CONTENT));
        setContentView(scroll);
    }

    private void showLogin() {
        prepareScreen();
        renderedUid = null;
        tripsLoaded = false;
        savedTrips.clear();
        authButtons.clear();
        addBrandHeader();

        TextView heading = text("Welcome back", 28, INK, true);
        screen.addView(heading, margins(0, 28, 0, 6));
        screen.addView(text("Sign in to your trips with Firebase.", 15, MUTED, false), margins(0, 0, 0, 24));

        EditText email = input("Email address", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, "");
        EditText password = input("Password", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD, "");
        screen.addView(email, margins(0, 0, 0, 12));
        screen.addView(password, margins(0, 0, 0, 12));

        Button signIn = primaryButton("Sign in with email");
        signIn.setOnClickListener(v -> emailSignIn(email, password, false));
        screen.addView(signIn, margins(0, 4, 0, 12));

        Button createAccount = outlineButton("Create an account");
        createAccount.setOnClickListener(v -> emailSignIn(email, password, true));
        screen.addView(createAccount, margins(0, 0, 0, 20));

        TextView divider = text("OR", 12, FAINT, true);
        divider.setGravity(Gravity.CENTER);
        screen.addView(divider, margins(0, 0, 0, 18));

        Button google = outlineButton("Continue with Google");
        google.setOnClickListener(v -> {
            setAuthBusy(true);
            startActivityForResult(googleClient.getSignInIntent(), RC_GOOGLE_SIGN_IN);
        });
        screen.addView(google);

        authProgress = new ProgressBar(this);
        authProgress.setVisibility(View.GONE);
        screen.addView(authProgress, margins(0, 16, 0, 0));

        authButtons.add(signIn);
        authButtons.add(createAccount);
        authButtons.add(google);

        TextView help = text("This native Android app syncs seamlessly with your JourneySync web account.", 13, MUTED, false);
        screen.addView(help, margins(0, 24, 0, 0));
    }

    private void emailSignIn(EditText emailView, EditText passwordView, boolean create) {
        String email = emailView.getText().toString().trim();
        String password = passwordView.getText().toString();
        if (email.isEmpty() || password.isEmpty()) {
            toast("Enter both your email and password.");
            return;
        }
        if (create && password.length() < 6) {
            toast("Use a password with at least six characters.");
            return;
        }
        setAuthBusy(true);
        if (create) {
            firebaseAuth.createUserWithEmailAndPassword(email, password)
                    .addOnCompleteListener(task -> handleEmailResult(task, "Account created."));
        } else {
            firebaseAuth.signInWithEmailAndPassword(email, password)
                    .addOnCompleteListener(task -> handleEmailResult(task, "Signed in."));
        }
    }

    private void handleEmailResult(@NonNull Task<?> task, String successMessage) {
        setAuthBusy(false);
        if (task.isSuccessful()) {
            toast(successMessage);
            showCurrentState();
        } else {
            toast(friendlyError(task.getException()));
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != RC_GOOGLE_SIGN_IN) return;
        try {
            GoogleSignInAccount account = GoogleSignIn.getSignedInAccountFromIntent(data)
                    .getResult(ApiException.class);
            if (account == null || account.getIdToken() == null) {
                setAuthBusy(false);
                toast("Google did not return a usable account. Try again.");
                return;
            }
            AuthCredential credential = GoogleAuthProvider.getCredential(account.getIdToken(), null);
            firebaseAuth.signInWithCredential(credential).addOnCompleteListener(task -> {
                setAuthBusy(false);
                if (task.isSuccessful()) {
                    toast("Signed in with Google.");
                    showCurrentState();
                } else {
                    toast(friendlyError(task.getException()));
                }
            });
        } catch (ApiException exception) {
            setAuthBusy(false);
            toast("Google sign-in was cancelled or unavailable (code " + exception.getStatusCode() + ").");
        }
    }

    private void showDashboard(FirebaseUser user) {
        prepareScreen();
        renderedUid = user.getUid();
        if (tripsLoaded) {
            renderDashboard(user);
            return;
        }
        screen.addView(text("JourneySync", 25, BLUE, true));
        screen.addView(text("Loading your itineraries…", 14, MUTED, false), margins(0, 6, 0, 16));
        ProgressBar progress = new ProgressBar(this);
        screen.addView(progress, margins(0, 10, 0, 10));
        loadTrips(user);
    }

    private DocumentReference allTripsDoc(FirebaseUser user) {
        return firestore.collection("users").document(user.getUid())
                .collection("user_trips").document("all_trips");
    }

    private void loadTrips(FirebaseUser user) {
        allTripsDoc(user).get().addOnSuccessListener(snapshot -> {
            savedTrips.clear();
            Object rawTrips = snapshot.get("savedTrips");
            if (rawTrips instanceof List) {
                for (Object raw : (List<?>) rawTrips) {
                    if (raw instanceof Map) {
                        Trip trip = Trip.fromMap((Map<?, ?>) raw);
                        if (trip != null) savedTrips.add(trip);
                    }
                }
            }
            String storedActiveId = snapshot.getString("activeTripId");
            if (storedActiveId != null) {
                activeTripId = storedActiveId;
            }
            tripsLoaded = true;
            if (savedTrips.isEmpty()) {
                Trip defaultTrip = createDefaultTrip();
                savedTrips.add(defaultTrip);
                activeTripId = defaultTrip.id;
                renderDashboard(user);
                saveTrips(user);
            } else {
                Trip active = findTrip(activeTripId);
                if (active == null) activeTripId = savedTrips.get(0).id;
                renderDashboard(user);
            }
        }).addOnFailureListener(error -> {
            tripsLoaded = true;
            if (savedTrips.isEmpty()) {
                Trip defaultTrip = createDefaultTrip();
                savedTrips.add(defaultTrip);
                activeTripId = defaultTrip.id;
            }
            renderDashboard(user);
            toast("Showing saved itinerary while cloud sync reconnects.");
        });
    }

    private void saveTrips(FirebaseUser user) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (Trip trip : savedTrips) {
            if (trip != null) list.add(trip.toMap());
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("savedTrips", list);
        payload.put("activeTripId", activeTripId);
        payload.put("updatedAt", System.currentTimeMillis());
        allTripsDoc(user).set(payload, SetOptions.merge())
                .addOnFailureListener(error -> toast("Could not sync changes to cloud yet."));
    }

    /** Re-renders the dashboard and pushes the change to Firestore. */
    private void commit(FirebaseUser user) {
        renderDashboard(user);
        saveTrips(user);
    }

    private Trip findTrip(String tripId) {
        if (tripId == null) return null;
        for (Trip trip : savedTrips) {
            if (trip != null && tripId.equals(trip.id)) return trip;
        }
        return null;
    }

    private Trip getActiveTrip() {
        Trip active = findTrip(activeTripId);
        if (active != null) return active;
        return savedTrips.isEmpty() ? null : savedTrips.get(0);
    }

    private Day getActiveDay(Trip trip) {
        if (trip == null || trip.days == null || trip.days.isEmpty()) return null;
        if (activeDayIndex < 0 || activeDayIndex >= trip.days.size()) {
            activeDayIndex = 0;
        }
        return trip.days.get(activeDayIndex);
    }

    private void renderDashboard(FirebaseUser user) {
        screen.removeAllViews();
        Trip activeTrip = getActiveTrip();
        if (activeTrip == null) {
            activeTrip = createDefaultTrip();
            savedTrips.add(activeTrip);
            activeTripId = activeTrip.id;
        }
        final Trip trip = activeTrip;
        Day activeDay = getActiveDay(trip);

        // Top Bar
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        TextView welcome = text("JourneySync", 24, BLUE, true);
        top.addView(welcome, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        Button signOut = outlineButton("Sign out");
        signOut.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        signOut.setOnClickListener(v -> {
            firebaseAuth.signOut();
            googleClient.signOut();
            activeSection = SECTION_OVERVIEW;
            activeDayIndex = 0;
            showLogin();
        });
        top.addView(signOut);
        screen.addView(top, margins(0, 0, 0, 16));

        // Sync Status Card
        LinearLayout syncCard = new LinearLayout(this);
        syncCard.setOrientation(LinearLayout.HORIZONTAL);
        syncCard.setGravity(Gravity.CENTER_VERTICAL);
        syncCard.setPadding(dp(12), dp(8), dp(12), dp(8));
        GradientDrawable syncBg = new GradientDrawable();
        syncBg.setColor(Color.parseColor("#E8F5E9"));
        syncBg.setCornerRadius(dp(8));
        syncCard.setBackground(syncBg);
        syncCard.addView(text("● Cloud sync active (" + safeEmail(user) + ")", 12, GREEN, true));
        screen.addView(syncCard, margins(0, 0, 0, 16));

        // Active Trip Card
        LinearLayout tripCard = card();
        TextView tripTitle = text(trip.name, 24, INK, true);
        tripCard.addView(tripTitle);
        TextView tripSubtitle = text(trip.route + " • " + trip.travelersCount + " travelers • Starts " + trip.startDate, 14, MUTED, false);
        tripCard.addView(tripSubtitle, margins(0, 4, 0, 16));

        // Trip Actions Row
        LinearLayout tripActions = new LinearLayout(this);
        tripActions.setOrientation(LinearLayout.HORIZONTAL);

        Button switchBtn = primaryButton("🧳 Switch Trip (" + savedTrips.size() + ")");
        switchBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        switchBtn.setOnClickListener(v -> showTripSwitcherDialog(user));
        tripActions.addView(switchBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.2f));

        View gap1 = new View(this);
        tripActions.addView(gap1, new LinearLayout.LayoutParams(dp(8), 1));

        Button newTripBtn = outlineButton("＋ New Trip");
        newTripBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        newTripBtn.setOnClickListener(v -> showCreateTripDialog(user));
        tripActions.addView(newTripBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        View gap2 = new View(this);
        tripActions.addView(gap2, new LinearLayout.LayoutParams(dp(8), 1));

        Button delTripBtn = dangerButton("🗑 Delete");
        delTripBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        delTripBtn.setOnClickListener(v -> confirmDeleteTrip(user, trip));
        tripActions.addView(delTripBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 0.8f));

        tripCard.addView(tripActions);
        screen.addView(tripCard, margins(0, 0, 0, 20));

        addSectionTabs(user, trip);

        if (activeSection == SECTION_OVERVIEW) renderOverview(user, trip);
        else if (activeSection == SECTION_FLIGHTS) renderFlightTracker(user, trip);
        else if (activeSection == SECTION_MAP) renderMap(user, trip);
        else if (activeSection == SECTION_EXPENSES) renderExpenses(user, trip);
        else if (activeSection == SECTION_WALLET) renderWallet(user, trip);
        else if (activeSection == SECTION_TRAVELERS) renderTravelers(user, trip);
        else if (activeSection == SECTION_GUEST_FLIGHTS) renderGuestFlights(user, trip);
        else renderItinerary(user, trip, activeDay);
    }

    /** Scrollable section navigation mirroring the website's primary features. */
    private void addSectionTabs(FirebaseUser user, Trip trip) {
        HorizontalScrollView tabScroll = new HorizontalScrollView(this);
        tabScroll.setHorizontalScrollBarEnabled(false);
        LinearLayout tabs = new LinearLayout(this);
        tabs.setOrientation(LinearLayout.HORIZONTAL);

        String[] labels = {"⌂ Overview", "🗓 Itinerary", "✈ Flights (" + trip.trackedFlights().size() + ")",
                "◎ Guests (" + (trip.guestFlights == null ? 0 : trip.guestFlights.size()) + ")",
                "◇ Map", "¤ Expenses", "▣ Wallet", "● Travelers"};
        int[] sections = {SECTION_OVERVIEW, SECTION_ITINERARY, SECTION_FLIGHTS, SECTION_GUEST_FLIGHTS,
                SECTION_MAP, SECTION_EXPENSES, SECTION_WALLET, SECTION_TRAVELERS};
        for (int i = 0; i < labels.length; i++) {
            final int section = sections[i];
            Button tab = new Button(this);
            tab.setText(labels[i]);
            tab.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
            tab.setAllCaps(false);
            GradientDrawable bg = new GradientDrawable();
            bg.setCornerRadius(dp(10));
            if (section == activeSection) {
                bg.setColor(Color.parseColor(BLUE));
                tab.setTextColor(Color.WHITE);
                tab.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
            } else {
                bg.setColor(Color.WHITE);
                bg.setStroke(dp(1), Color.parseColor("#C9D4E1"));
                tab.setTextColor(Color.parseColor(MUTED));
            }
            tab.setBackground(bg);
            tab.setPadding(dp(10), dp(10), dp(10), dp(10));
            tab.setOnClickListener(v -> {
                activeSection = section;
                renderDashboard(user);
            });
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            params.rightMargin = dp(8);
            tabs.addView(tab, params);
        }
        tabScroll.addView(tabs);
        screen.addView(tabScroll, margins(0, 0, 0, 20));
    }

    private void renderOverview(FirebaseUser user, Trip trip) {
        screen.addView(text("Trip Overview", 22, INK, true), margins(0, 0, 0, 12));
        LinearLayout summary = card();
        int activities = 0;
        if (trip.days != null) for (Day day : trip.days) if (day != null && day.events != null) activities += day.events.size();
        summary.addView(factRow("DAYS", String.valueOf(trip.days == null ? 0 : trip.days.size()), INK,
                "ACTIVITIES", String.valueOf(activities), INK));
        summary.addView(factRow("FLIGHTS", trip.trackedFlights().size() + " trip · " + (trip.guestFlights == null ? 0 : trip.guestFlights.size()) + " guest", BLUE,
                "TRAVELERS", String.valueOf(trip.travelersList == null ? trip.travelersCount : trip.travelersList.size()), INK), margins(0, 14, 0, 0));
        summary.addView(factRow("EXPENSES", money(expenseCurrency(trip), trip.totalExpenses()), INK,
                "WALLET", String.valueOf(trip.walletDocs == null ? 0 : trip.walletDocs.size()) + " documents", INK), margins(0, 14, 0, 0));
        screen.addView(summary, margins(0, 0, 0, 16));

        List<Trip.TrackedFlight> flights = trip.trackedFlights();
        if (!flights.isEmpty()) {
            Trip.TrackedFlight next = flights.get(0);
            screen.addView(text("Next Flight", 18, INK, true), margins(0, 4, 0, 8));
            screen.addView(buildFlightCard(user, trip, next), margins(0, 0, 0, 16));
        }

        LinearLayout actions = card();
        actions.addView(text("Quick Actions", 18, INK, true), margins(0, 0, 0, 10));
        Button itinerary = outlineButton("Add itinerary activity");
        itinerary.setOnClickListener(v -> {
            activeSection = SECTION_ITINERARY;
            renderDashboard(user);
        });
        actions.addView(itinerary, margins(0, 0, 0, 8));
        Button expense = outlineButton("Add group expense");
        expense.setOnClickListener(v -> showAddExpenseDialog(user, trip));
        actions.addView(expense, margins(0, 0, 0, 8));
        Button pass = outlineButton("Save travel document");
        pass.setOnClickListener(v -> showAddWalletDocDialog(user, trip));
        actions.addView(pass);
        screen.addView(actions);
    }

    private void renderMap(FirebaseUser user, Trip trip) {
        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.HORIZONTAL);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        heading.addView(text("Trip Map & Places", 22, INK, true), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        Button add = primaryButton("＋ Add Place");
        add.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        add.setOnClickListener(v -> showAddMapPinDialog(user, trip));
        heading.addView(add);
        screen.addView(heading, margins(0, 0, 0, 14));

        if (trip.mapPins == null || trip.mapPins.isEmpty()) {
            LinearLayout empty = card();
            empty.addView(text("No destinations pinned yet.", 16, MUTED, true));
            empty.addView(text("Add a city or stop to keep route notes and offline-save status with the trip.", 13, FAINT, false), margins(0, 5, 0, 0));
            screen.addView(empty);
            return;
        }
        for (MapPin pin : trip.mapPins) {
            if (pin == null) continue;
            LinearLayout pinCard = card();
            LinearLayout top = new LinearLayout(this);
            top.setOrientation(LinearLayout.HORIZONTAL);
            top.setGravity(Gravity.CENTER_VERTICAL);
            top.addView(badge(safeText(pin.code, "PIN"), pin.savedOffline ? GREEN : BLUE));
            LinearLayout title = new LinearLayout(this);
            title.setOrientation(LinearLayout.VERTICAL);
            title.addView(text(safeText(pin.name, "Destination"), 17, INK, true));
            title.addView(text(safeText(pin.desc, "Trip destination") + " · " + safeText(pin.temp, "TBD"), 13, MUTED, false));
            top.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            pinCard.addView(top, margins(0, 0, 0, 12));
            LinearLayout actions = new LinearLayout(this);
            actions.setOrientation(LinearLayout.HORIZONTAL);
            Button offline = outlineButton(pin.savedOffline ? "✓ Saved Offline" : "Save Offline");
            offline.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            offline.setOnClickListener(v -> {
                pin.savedOffline = !pin.savedOffline;
                commit(user);
                toast(pin.savedOffline ? "Place saved for offline reference." : "Offline save removed.");
            });
            actions.addView(offline, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            Button delete = dangerButton("Delete");
            delete.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            delete.setOnClickListener(v -> confirmDeleteMapPin(user, trip, pin));
            actions.addView(delete, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 0.55f));
            pinCard.addView(actions);
            screen.addView(pinCard, margins(0, 0, 0, 12));
        }
    }

    private void renderExpenses(FirebaseUser user, Trip trip) {
        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.HORIZONTAL);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        heading.addView(text("Group Expenses", 22, INK, true), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        Button add = primaryButton("＋ Add Expense");
        add.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        add.setOnClickListener(v -> showAddExpenseDialog(user, trip));
        heading.addView(add);
        screen.addView(heading, margins(0, 0, 0, 12));

        LinearLayout total = card();
        total.addView(text(money(expenseCurrency(trip), trip.totalExpenses()), 28, INK, true));
        total.addView(text(money(expenseCurrency(trip), trip.unsettledExpenses()) + " unsettled", 13, trip.unsettledExpenses() > 0 ? CORAL : GREEN, true), margins(0, 4, 0, 10));
        Button settle = outlineButton("Mark all as settled");
        settle.setEnabled(trip.unsettledExpenses() > 0);
        settle.setOnClickListener(v -> confirmSettleExpenses(user, trip));
        total.addView(settle);
        screen.addView(total, margins(0, 0, 0, 14));

        if (trip.expenses == null || trip.expenses.isEmpty()) {
            LinearLayout empty = card();
            empty.addView(text("No shared expenses yet.", 15, MUTED, true));
            screen.addView(empty);
            return;
        }
        for (Expense expense : trip.expenses) {
            if (expense == null) continue;
            LinearLayout expenseCard = card();
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout info = new LinearLayout(this);
            info.setOrientation(LinearLayout.VERTICAL);
            info.addView(text(expense.description, 16, INK, true));
            info.addView(text(expense.category + " · Paid by " + expense.paidBy + " · " + expense.date, 12, MUTED, false));
            row.addView(info, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            LinearLayout amount = new LinearLayout(this);
            amount.setOrientation(LinearLayout.VERTICAL);
            amount.setGravity(Gravity.END);
            amount.addView(text(money(expense.currency, expense.amount), 16, INK, true));
            amount.addView(text(expense.settled ? "SETTLED" : "OPEN", 10, expense.settled ? GREEN : CORAL, true));
            row.addView(amount);
            expenseCard.addView(row, margins(0, 0, 0, 10));
            LinearLayout actions = new LinearLayout(this);
            actions.setOrientation(LinearLayout.HORIZONTAL);
            Button toggle = outlineButton(expense.settled ? "Reopen" : "Settle");
            toggle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            toggle.setOnClickListener(v -> { expense.settled = !expense.settled; commit(user); });
            actions.addView(toggle, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            Button delete = dangerButton("Delete");
            delete.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            delete.setOnClickListener(v -> confirmDeleteExpense(user, trip, expense));
            actions.addView(delete, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 0.6f));
            expenseCard.addView(actions);
            screen.addView(expenseCard, margins(0, 0, 0, 12));
        }
    }

    private void renderWallet(FirebaseUser user, Trip trip) {
        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.HORIZONTAL);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        heading.addView(text("Trip Wallet", 22, INK, true), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        Button add = primaryButton("＋ Add Document");
        add.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        add.setOnClickListener(v -> showAddWalletDocDialog(user, trip));
        heading.addView(add);
        screen.addView(heading, margins(0, 0, 0, 14));
        if (trip.walletDocs == null || trip.walletDocs.isEmpty()) {
            LinearLayout empty = card();
            empty.addView(text("No passes or documents saved yet.", 15, MUTED, true));
            screen.addView(empty);
            return;
        }
        for (WalletDoc doc : trip.walletDocs) {
            if (doc == null) continue;
            LinearLayout docCard = card();
            LinearLayout top = new LinearLayout(this);
            top.setOrientation(LinearLayout.HORIZONTAL);
            top.setGravity(Gravity.CENTER_VERTICAL);
            top.addView(badge(safeText(doc.icon, "DOC"), doc.coralIcon ? CORAL : BLUE));
            LinearLayout info = new LinearLayout(this);
            info.setOrientation(LinearLayout.VERTICAL);
            info.addView(text(doc.title, 17, INK, true));
            info.addView(text(doc.meta, 12, MUTED, false));
            info.addView(text("Code: " + doc.code, 12, BLUE, true), margins(0, 4, 0, 0));
            top.addView(info, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            docCard.addView(top, margins(0, 0, 0, 10));
            Button delete = dangerButton("Remove from Wallet");
            delete.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            delete.setOnClickListener(v -> confirmDeleteWalletDoc(user, trip, doc));
            docCard.addView(delete);
            screen.addView(docCard, margins(0, 0, 0, 12));
        }
    }

    private void renderTravelers(FirebaseUser user, Trip trip) {
        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.HORIZONTAL);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        heading.addView(text("Travel Team", 22, INK, true), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        Button add = primaryButton("＋ Invite");
        add.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        add.setOnClickListener(v -> showAddTravelerDialog(user, trip));
        heading.addView(add);
        screen.addView(heading, margins(0, 0, 0, 14));
        if (trip.travelersList == null || trip.travelersList.isEmpty()) {
            LinearLayout empty = card();
            empty.addView(text("No traveler profiles saved yet.", 15, MUTED, true));
            screen.addView(empty);
            return;
        }
        for (Traveler traveler : trip.travelersList) {
            if (traveler == null) continue;
            LinearLayout travelerCard = card();
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.addView(badge(safeText(traveler.avatar, Traveler.initials(traveler.name)), BLUE));
            LinearLayout info = new LinearLayout(this);
            info.setOrientation(LinearLayout.VERTICAL);
            info.addView(text(traveler.name, 16, INK, true));
            info.addView(text(traveler.role + " · " + traveler.email, 12, MUTED, false));
            row.addView(info, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            Button remove = dangerButton("Remove");
            remove.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
            remove.setOnClickListener(v -> confirmDeleteTraveler(user, trip, traveler));
            row.addView(remove);
            travelerCard.addView(row);
            screen.addView(travelerCard, margins(0, 0, 0, 12));
        }
    }

    private void renderGuestFlights(FirebaseUser user, Trip trip) {
        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.HORIZONTAL);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        heading.addView(text("Guest Flight Watch", 22, INK, true), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        Button add = primaryButton("＋ Add Guest Flight");
        add.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        add.setOnClickListener(v -> showGuestFlightDialog(user, trip, null));
        heading.addView(add);
        screen.addView(heading, margins(0, 0, 0, 6));
        screen.addView(text("Track friends and family separately from your itinerary.", 13, MUTED, false), margins(0, 0, 0, 14));

        int delayed = 0;
        if (trip.guestFlights != null) for (GuestFlight guest : trip.guestFlights) if (guest != null && guest.isDelayed()) delayed++;
        if (delayed > 0) {
            LinearLayout alert = card();
            alert.addView(text("⚠ " + delayed + (delayed == 1 ? " guest flight is delayed" : " guest flights are delayed"), 16, CORAL, true));
            alert.addView(text("Open a flight below for the latest saved delay and gate details.", 12, MUTED, false), margins(0, 4, 0, 0));
            screen.addView(alert, margins(0, 0, 0, 14));
        }

        if (trip.guestFlights == null || trip.guestFlights.isEmpty()) {
            LinearLayout empty = card();
            empty.addView(text("No guest flights watched yet.", 16, MUTED, true));
            empty.addView(text("Add the flight of someone you are meeting or picking up.", 13, FAINT, false), margins(0, 4, 0, 0));
            screen.addView(empty);
            return;
        }

        for (GuestFlight guest : trip.guestFlights) {
            if (guest == null) continue;
            FlightInfo flight = guest.flight == null ? new FlightInfo() : guest.flight;
            LinearLayout guestCard = card();
            LinearLayout owner = new LinearLayout(this);
            owner.setOrientation(LinearLayout.HORIZONTAL);
            owner.setGravity(Gravity.CENTER_VERTICAL);
            owner.addView(badge(Traveler.initials(guest.guestName), BLUE));
            LinearLayout ownerText = new LinearLayout(this);
            ownerText.setOrientation(LinearLayout.VERTICAL);
            ownerText.addView(text(guest.guestName, 16, INK, true));
            ownerText.addView(text(guest.note, 12, MUTED, false));
            owner.addView(ownerText, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            owner.addView(badge(guest.status, guest.isDelayed() ? ORANGE : GREEN));
            guestCard.addView(owner, margins(0, 0, 0, 14));
            guestCard.addView(text(flight.displayTitle(), 19, INK, true));
            guestCard.addView(text(flight.origin + " → " + flight.destination + " · Gate " + flight.gate, 14, MUTED, false), margins(0, 4, 0, 10));
            guestCard.addView(factRow("DEPARTURE", flight.estimatedDeparture, INK,
                    "ARRIVAL", flight.estimatedArrival, INK));
            guestCard.addView(factRow("TERMINALS", flight.departureTerminal + " → " + flight.arrivalTerminal, INK,
                    "DELAY", guest.isDelayed() ? flight.delayMinutes + " min" : "None", guest.isDelayed() ? CORAL : GREEN), margins(0, 12, 0, 12));
            LinearLayout actions = new LinearLayout(this);
            actions.setOrientation(LinearLayout.HORIZONTAL);
            Button update = outlineButton("Update details");
            update.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            update.setOnClickListener(v -> showGuestFlightDialog(user, trip, guest));
            actions.addView(update, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            Button remove = dangerButton("Remove");
            remove.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            remove.setOnClickListener(v -> confirmDeleteGuestFlight(user, trip, guest));
            actions.addView(remove, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, .6f));
            guestCard.addView(actions);
            screen.addView(guestCard, margins(0, 0, 0, 12));
        }
    }

    private void renderItinerary(FirebaseUser user, Trip trip, Day activeDay) {
        screen.addView(text("Itinerary Days", 18, INK, true), margins(0, 0, 0, 8));

        HorizontalScrollView dayScroll = new HorizontalScrollView(this);
        dayScroll.setHorizontalScrollBarEnabled(false);
        LinearLayout dayTabs = new LinearLayout(this);
        dayTabs.setOrientation(LinearLayout.HORIZONTAL);
        dayTabs.setGravity(Gravity.CENTER_VERTICAL);

        if (trip.days != null) {
            for (int i = 0; i < trip.days.size(); i++) {
                Day d = trip.days.get(i);
                final int idx = i;
                Button dayBtn = new Button(this);
                dayBtn.setText("Day " + (i + 1) + ": " + (d != null ? d.shortName : "DAY"));
                dayBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
                dayBtn.setAllCaps(false);
                GradientDrawable bg = new GradientDrawable();
                bg.setCornerRadius(dp(10));
                if (i == activeDayIndex) {
                    bg.setColor(Color.parseColor(INK));
                    dayBtn.setTextColor(Color.WHITE);
                } else {
                    bg.setColor(Color.WHITE);
                    bg.setStroke(dp(1), Color.parseColor("#C9D4E1"));
                    dayBtn.setTextColor(Color.parseColor(MUTED));
                }
                dayBtn.setBackground(bg);
                dayBtn.setPadding(dp(14), dp(8), dp(14), dp(8));
                dayBtn.setOnClickListener(v -> {
                    activeDayIndex = idx;
                    renderDashboard(user);
                });
                dayTabs.addView(dayBtn, margins(0, 0, 8, 0));
            }
        }
        dayScroll.addView(dayTabs);
        screen.addView(dayScroll, margins(0, 0, 0, 12));

        // Day Management Buttons
        LinearLayout dayActions = new LinearLayout(this);
        dayActions.setOrientation(LinearLayout.HORIZONTAL);
        Button addDayBtn = outlineButton("＋ Add Day");
        addDayBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        addDayBtn.setOnClickListener(v -> showAddDayDialog(user, trip));
        dayActions.addView(addDayBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        View gapDay1 = new View(this);
        dayActions.addView(gapDay1, new LinearLayout.LayoutParams(dp(8), 1));

        Button renameDayBtn = outlineButton("✏️ Rename Day");
        renameDayBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        renameDayBtn.setOnClickListener(v -> showRenameDayDialog(user, trip, activeDay));
        dayActions.addView(renameDayBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        View gapDay2 = new View(this);
        dayActions.addView(gapDay2, new LinearLayout.LayoutParams(dp(8), 1));

        Button delDayBtn = dangerButton("🗑 Delete Day");
        delDayBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        delDayBtn.setOnClickListener(v -> confirmDeleteDay(user, trip));
        dayActions.addView(delDayBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        screen.addView(dayActions, margins(0, 0, 0, 24));

        // Activities Section
        String dayHeader = activeDay != null
                ? ("Day " + (activeDayIndex + 1) + " Activities: " + activeDay.label + " (" + activeDay.shortName + " " + activeDay.date + ")")
                : "Day Activities";
        screen.addView(text(dayHeader, 18, INK, true), margins(0, 0, 0, 10));

        Button addEvBtn = primaryButton("＋ Add Activity to Day " + (activeDayIndex + 1));
        addEvBtn.setOnClickListener(v -> showAddEventDialog(user, activeDay));
        screen.addView(addEvBtn, margins(0, 0, 0, 16));

        if (activeDay != null && activeDay.events != null && !activeDay.events.isEmpty()) {
            for (DayEvent ev : activeDay.events) {
                if (ev == null) continue;
                screen.addView(buildEventCard(user, activeDay, ev), margins(0, 0, 0, 12));
            }
        } else {
            LinearLayout emptyCard = card();
            emptyCard.addView(text("No activities planned for this day yet.", 15, MUTED, false));
            emptyCard.addView(text("Tap '＋ Add Activity to Day' above to get started!", 13, FAINT, false), margins(0, 4, 0, 0));
            screen.addView(emptyCard, margins(0, 0, 0, 12));
        }
    }

    private LinearLayout buildEventCard(FirebaseUser user, Day day, DayEvent ev) {
        LinearLayout evCard = card();

        LinearLayout topRow = new LinearLayout(this);
        topRow.setOrientation(LinearLayout.HORIZONTAL);
        topRow.setGravity(Gravity.CENTER_VERTICAL);

        TextView timeText = text(ev.time != null ? ev.time : "", 14, BLUE, true);
        topRow.addView(timeText, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView kindBadge = badge(ev.kind != null ? ev.kind.toUpperCase() : "ACTIVITY", colorForKind(ev.kind));
        topRow.addView(kindBadge);
        evCard.addView(topRow, margins(0, 0, 0, 6));

        evCard.addView(text(ev.title != null ? ev.title : "Activity", 17, INK, true), margins(0, 0, 0, 4));
        evCard.addView(text(ev.meta != null ? ev.meta : "", 14, MUTED, false), margins(0, 0, 0, ev.isFlight() ? 8 : 12));

        if (ev.isFlight()) {
            FlightInfo flight = ev.flight;
            String statusLabel = ev.status != null && !ev.status.isEmpty() ? ev.status : "Scheduled";
            String delayLabel = flight != null && flight.isDelayed() ? " · Delayed " + flight.delayMinutes + " min" : "";
            evCard.addView(text("✈ " + statusLabel + delayLabel, 13,
                    flight != null && flight.isDelayed() ? CORAL : GREEN, true), margins(0, 0, 0, 12));
        }

        LinearLayout evActions = new LinearLayout(this);
        evActions.setOrientation(LinearLayout.HORIZONTAL);
        evActions.setGravity(Gravity.END);

        if (ev.isFlight()) {
            Button trackBtn = outlineButton("✈ Flight details");
            trackBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            trackBtn.setPadding(dp(12), dp(6), dp(12), dp(6));
            trackBtn.setOnClickListener(v -> showFlightDetailsDialog(user, ev));
            evActions.addView(trackBtn, margins(0, 0, 8, 0));
        }

        Button editBtn = outlineButton("✏️ Edit");
        editBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        editBtn.setPadding(dp(12), dp(6), dp(12), dp(6));
        editBtn.setOnClickListener(v -> showEditEventDialog(user, day, ev));
        evActions.addView(editBtn, margins(0, 0, 8, 0));

        Button delBtn = dangerButton("🗑 Delete");
        delBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        delBtn.setPadding(dp(12), dp(6), dp(12), dp(6));
        delBtn.setOnClickListener(v -> confirmDeleteEvent(user, day, ev));
        evActions.addView(delBtn);

        evCard.addView(evActions);
        return evCard;
    }

    // ---------------------------------------------------------------- flights

    private void renderFlightTracker(FirebaseUser user, Trip trip) {
        screen.addView(text("TRIP OPERATIONS", 12, FAINT, true), margins(0, 0, 0, 4));
        screen.addView(text("Flight Tracker", 22, INK, true), margins(0, 0, 0, 4));
        screen.addView(text("Gate, terminal, timing, delay, and baggage details stored with your itinerary.",
                14, MUTED, false), margins(0, 0, 0, 14));

        Button addFlight = primaryButton("＋ Track a flight");
        addFlight.setOnClickListener(v -> showTrackFlightDialog(user, trip));
        screen.addView(addFlight, margins(0, 0, 0, 18));

        List<Trip.TrackedFlight> flights = trip.trackedFlights();
        if (flights.isEmpty()) {
            LinearLayout empty = card();
            empty.addView(text("✈", 30, "#C9D4E1", true));
            empty.addView(text("No flights tracked yet", 18, INK, true), margins(0, 8, 0, 4));
            empty.addView(text("Add a flight to an itinerary day and keep its travel-day details together.",
                    14, MUTED, false), margins(0, 0, 0, 0));
            screen.addView(empty, margins(0, 0, 0, 14));
        } else {
            for (Trip.TrackedFlight tracked : flights) {
                screen.addView(buildFlightCard(user, trip, tracked), margins(0, 0, 0, 14));
            }
        }

        screen.addView(text("Flight details are managed by your group. Live airline data requires a connected flight-data provider.",
                12, FAINT, false), margins(0, 4, 0, 0));
    }

    private LinearLayout buildFlightCard(FirebaseUser user, Trip trip, Trip.TrackedFlight tracked) {
        DayEvent event = tracked.event;
        FlightInfo flight = event.flight;
        boolean delayed = flight != null && flight.isDelayed();

        LinearLayout flightCard = card();

        // Airline + number on the left, status pill on the right.
        LinearLayout topline = new LinearLayout(this);
        topline.setOrientation(LinearLayout.HORIZONTAL);
        topline.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout identity = new LinearLayout(this);
        identity.setOrientation(LinearLayout.VERTICAL);
        identity.addView(text(flight != null ? flight.airline : "FLIGHT", 12, FAINT, true));
        identity.addView(text(flight != null ? flight.number : safeText(event.title, "Flight"), 20, INK, true));
        topline.addView(identity, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        topline.addView(badge(safeText(event.status, "Scheduled").toUpperCase(), delayed ? CORAL : GREEN));
        flightCard.addView(topline, margins(0, 0, 0, 14));

        // Route: origin/time  ✈  destination/time
        LinearLayout route = new LinearLayout(this);
        route.setOrientation(LinearLayout.HORIZONTAL);
        route.setGravity(Gravity.CENTER_VERTICAL);
        route.addView(routeEnd(flight != null ? flight.origin : "ORG",
                        flight != null ? flight.estimatedDeparture : safeText(event.time, FlightInfo.UNKNOWN), Gravity.START),
                new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        TextView plane = text("✈", 18, BLUE, true);
        plane.setGravity(Gravity.CENTER);
        route.addView(plane, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 0.6f));
        route.addView(routeEnd(flight != null ? flight.destination : "DST",
                        flight != null ? flight.estimatedArrival : FlightInfo.UNKNOWN, Gravity.END),
                new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        flightCard.addView(route, margins(0, 0, 0, 14));

        // Facts grid: two rows of two.
        String terminals = flight != null
                ? flight.departureTerminal + " → " + flight.arrivalTerminal
                : FlightInfo.UNKNOWN;
        String delay = delayed ? flight.delayMinutes + " min" : "None";
        flightCard.addView(factRow("GATE", flight != null ? flight.gate : FlightInfo.UNKNOWN, INK,
                "TERMINALS", terminals, INK), margins(0, 0, 0, 10));
        flightCard.addView(factRow("DELAY", delay, delayed ? CORAL : INK,
                "BAGGAGE", flight != null ? flight.baggageClaim : FlightInfo.UNKNOWN, INK), margins(0, 0, 0, 14));

        String dayLabel = tracked.day.shortName + " " + tracked.day.date;
        String updated = flight != null ? flight.lastUpdated : "when added";
        flightCard.addView(text("Day " + (tracked.dayIndex + 1) + " · " + dayLabel + " · Updated " + updated,
                12, FAINT, false), margins(0, 0, 0, 12));

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.END);

        Button editBtn = primaryButton("✏️ Update status");
        editBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        editBtn.setPadding(dp(12), dp(8), dp(12), dp(8));
        editBtn.setOnClickListener(v -> showFlightDetailsDialog(user, event));
        actions.addView(editBtn, margins(0, 0, 8, 0));

        Button removeBtn = dangerButton("🗑 Remove");
        removeBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        removeBtn.setPadding(dp(12), dp(8), dp(12), dp(8));
        removeBtn.setOnClickListener(v -> confirmDeleteEvent(user, tracked.day, event));
        actions.addView(removeBtn);

        flightCard.addView(actions);
        return flightCard;
    }

    private LinearLayout routeEnd(String code, String time, int gravity) {
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        TextView codeView = text(code, 22, INK, true);
        codeView.setGravity(gravity);
        TextView timeView = text(time, 13, MUTED, false);
        timeView.setGravity(gravity);
        column.addView(codeView);
        column.addView(timeView);
        return column;
    }

    private LinearLayout factRow(String leftLabel, String leftValue, String leftColor,
                                 String rightLabel, String rightValue, String rightColor) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.addView(fact(leftLabel, leftValue, leftColor),
                new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        row.addView(fact(rightLabel, rightValue, rightColor),
                new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        return row;
    }

    private LinearLayout fact(String label, String value, String valueColor) {
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.addView(text(label, 11, FAINT, true));
        column.addView(text(safeText(value, FlightInfo.UNKNOWN), 15, valueColor, true), margins(0, 2, 0, 0));
        return column;
    }

    /** Adds a new flight to the active day, matching the website's "Track a flight" form. */
    private void showTrackFlightDialog(FirebaseUser user, Trip trip) {
        Day day = getActiveDay(trip);
        if (day == null) {
            toast("Add an itinerary day before tracking a flight.");
            return;
        }

        LinearLayout form = formContainer();
        EditText airlineInput = input("Airline (e.g. SWISS)", InputType.TYPE_CLASS_TEXT, "");
        EditText numberInput = input("Flight number (e.g. LX 017)", InputType.TYPE_CLASS_TEXT, "");
        EditText originInput = input("From (e.g. JFK)", InputType.TYPE_CLASS_TEXT, "");
        EditText destinationInput = input("To (e.g. ZRH)", InputType.TYPE_CLASS_TEXT, "");
        EditText departureInput = input("Departs (e.g. 8:40 PM)", InputType.TYPE_CLASS_TEXT, "");
        EditText arrivalInput = input("Arrives (e.g. 10:15 AM)", InputType.TYPE_CLASS_TEXT, "");

        addField(form, "Airline", airlineInput);
        addField(form, "Flight number", numberInput);
        addField(form, "From (airport code)", originInput);
        addField(form, "To (airport code)", destinationInput);
        addField(form, "Departure time", departureInput);
        addField(form, "Arrival time", arrivalInput);
        form.addView(text("Adds to Day " + (activeDayIndex + 1) + " · " + safeText(day.label, "this day"),
                12, FAINT, false), margins(0, 4, 0, 0));

        new AlertDialog.Builder(this)
                .setTitle("Track a flight")
                .setView(scrollable(form))
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Track", (dialog, which) -> {
                    FlightInfo flight = new FlightInfo();
                    flight.airline = fallback(airlineInput, "Airline");
                    flight.number = fallback(numberInput, "Flight").toUpperCase();
                    flight.origin = fallback(originInput, "ORG").toUpperCase();
                    flight.destination = fallback(destinationInput, "DST").toUpperCase();
                    flight.scheduledDeparture = formatTime(departureInput.getText().toString());
                    flight.estimatedDeparture = flight.scheduledDeparture;
                    flight.scheduledArrival = formatTime(arrivalInput.getText().toString());
                    flight.estimatedArrival = flight.scheduledArrival;
                    flight.lastUpdated = "Just now";

                    DayEvent event = new DayEvent(
                            "flight-" + System.currentTimeMillis(),
                            flight.estimatedDeparture,
                            flight.displayTitle(),
                            flight.displayMeta(),
                            "flight",
                            "Scheduled");
                    event.flight = flight;

                    if (day.events == null) day.events = new ArrayList<>();
                    day.events.add(event);
                    activeSection = SECTION_FLIGHTS;
                    commit(user);
                    toast(flight.number + " added to your tracker");
                })
                .show();
    }

    /** Full gate/terminal/timing/delay editor for one tracked flight. */
    private void showFlightDetailsDialog(FirebaseUser user, DayEvent event) {
        if (event == null) return;
        FlightInfo flight = event.requireFlight();

        LinearLayout form = formContainer();
        EditText airlineInput = input("Airline", InputType.TYPE_CLASS_TEXT, flight.airline);
        EditText numberInput = input("Flight number", InputType.TYPE_CLASS_TEXT, flight.number);
        EditText originInput = input("From", InputType.TYPE_CLASS_TEXT, flight.origin);
        EditText destinationInput = input("To", InputType.TYPE_CLASS_TEXT, flight.destination);
        EditText depTerminalInput = input("Departure terminal", InputType.TYPE_CLASS_TEXT, flight.departureTerminal);
        EditText arrTerminalInput = input("Arrival terminal", InputType.TYPE_CLASS_TEXT, flight.arrivalTerminal);
        EditText gateInput = input("Gate", InputType.TYPE_CLASS_TEXT, flight.gate);
        EditText schedDepInput = input("Scheduled departure", InputType.TYPE_CLASS_TEXT, flight.scheduledDeparture);
        EditText estDepInput = input("Estimated departure", InputType.TYPE_CLASS_TEXT, flight.estimatedDeparture);
        EditText schedArrInput = input("Scheduled arrival", InputType.TYPE_CLASS_TEXT, flight.scheduledArrival);
        EditText estArrInput = input("Estimated arrival", InputType.TYPE_CLASS_TEXT, flight.estimatedArrival);
        EditText delayInput = input("Delay in minutes", InputType.TYPE_CLASS_NUMBER, String.valueOf(flight.delayMinutes));
        EditText baggageInput = input("Baggage claim", InputType.TYPE_CLASS_TEXT, flight.baggageClaim);

        int statusIndex = indexOfIgnoreCase(FLIGHT_STATUSES, event.status);
        final int[] selectedStatus = {statusIndex};
        Button statusBtn = outlineButton("Status: " + FLIGHT_STATUSES[statusIndex]);
        statusBtn.setOnClickListener(v -> new AlertDialog.Builder(this)
                .setTitle("Flight status")
                .setItems(FLIGHT_STATUSES, (d, which) -> {
                    selectedStatus[0] = which;
                    statusBtn.setText("Status: " + FLIGHT_STATUSES[which]);
                })
                .show());

        addField(form, "Airline", airlineInput);
        addField(form, "Flight number", numberInput);
        addField(form, "From", originInput);
        addField(form, "To", destinationInput);
        addField(form, "Departure terminal", depTerminalInput);
        addField(form, "Arrival terminal", arrTerminalInput);
        addField(form, "Gate", gateInput);
        addField(form, "Scheduled departure", schedDepInput);
        addField(form, "Estimated departure", estDepInput);
        addField(form, "Scheduled arrival", schedArrInput);
        addField(form, "Estimated arrival", estArrInput);
        addField(form, "Delay (minutes)", delayInput);
        addField(form, "Baggage claim", baggageInput);
        form.addView(text("Status", 13, MUTED, true), margins(0, 0, 0, 4));
        form.addView(statusBtn);

        new AlertDialog.Builder(this)
                .setTitle("Flight details")
                .setView(scrollable(form))
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Save", (dialog, which) -> {
                    flight.airline = fallback(airlineInput, "Airline");
                    flight.number = fallback(numberInput, "Flight").toUpperCase();
                    flight.origin = fallback(originInput, "ORG").toUpperCase();
                    flight.destination = fallback(destinationInput, "DST").toUpperCase();
                    flight.departureTerminal = fallback(depTerminalInput, FlightInfo.UNKNOWN);
                    flight.arrivalTerminal = fallback(arrTerminalInput, FlightInfo.UNKNOWN);
                    flight.gate = fallback(gateInput, FlightInfo.UNKNOWN).toUpperCase();
                    flight.scheduledDeparture = formatTime(schedDepInput.getText().toString());
                    flight.estimatedDeparture = formatTime(estDepInput.getText().toString());
                    flight.scheduledArrival = formatTime(schedArrInput.getText().toString());
                    flight.estimatedArrival = formatTime(estArrInput.getText().toString());
                    flight.delayMinutes = Math.max(0, parseInt(delayInput.getText().toString(), 0));
                    flight.baggageClaim = fallback(baggageInput, FlightInfo.UNKNOWN);
                    flight.lastUpdated = "Just now";

                    // Keep the itinerary row in step with the flight detail, the
                    // same way the website rewrites title/time/meta on save.
                    event.title = flight.displayTitle();
                    event.time = flight.estimatedDeparture;
                    event.meta = flight.displayMeta();
                    event.status = FLIGHT_STATUSES[selectedStatus[0]];

                    commit(user);
                    toast("Flight status updated");
                })
                .show();
    }

    // ----------------------------------------------------------------- trips

    // -------------------------------------------------------- shared features

    private void showGuestFlightDialog(FirebaseUser user, Trip trip, GuestFlight existing) {
        LinearLayout form = formContainer();
        FlightInfo current = existing != null && existing.flight != null ? existing.flight : new FlightInfo();
        EditText guestName = input("Friend or family member", InputType.TYPE_CLASS_TEXT, existing == null ? "" : existing.guestName);
        EditText note = input("Airport pickup, meeting them…", InputType.TYPE_CLASS_TEXT, existing == null ? "" : existing.note);
        EditText airline = input("Airline", InputType.TYPE_CLASS_TEXT, existing == null ? "" : current.airline);
        EditText number = input("Flight number", InputType.TYPE_CLASS_TEXT, existing == null ? "" : current.number);
        EditText origin = input("Origin airport", InputType.TYPE_CLASS_TEXT, existing == null ? "" : current.origin);
        EditText destination = input("Destination airport", InputType.TYPE_CLASS_TEXT, existing == null ? "" : current.destination);
        EditText scheduledDeparture = input("Scheduled departure", InputType.TYPE_CLASS_TEXT, current.scheduledDeparture);
        EditText estimatedDeparture = input("Estimated departure", InputType.TYPE_CLASS_TEXT, current.estimatedDeparture);
        EditText scheduledArrival = input("Scheduled arrival", InputType.TYPE_CLASS_TEXT, current.scheduledArrival);
        EditText estimatedArrival = input("Estimated arrival", InputType.TYPE_CLASS_TEXT, current.estimatedArrival);
        EditText departureTerminal = input("Departure terminal", InputType.TYPE_CLASS_TEXT, current.departureTerminal);
        EditText arrivalTerminal = input("Arrival terminal", InputType.TYPE_CLASS_TEXT, current.arrivalTerminal);
        EditText gate = input("Gate", InputType.TYPE_CLASS_TEXT, current.gate);
        EditText delay = input("Delay in minutes", InputType.TYPE_CLASS_NUMBER, String.valueOf(current.delayMinutes));
        EditText baggage = input("Baggage claim", InputType.TYPE_CLASS_TEXT, current.baggageClaim);
        final int[] statusIndex = {Math.max(0, indexOfIgnoreCase(FLIGHT_STATUSES, existing == null ? "Scheduled" : existing.status))};
        Button status = outlineButton("Status: " + FLIGHT_STATUSES[statusIndex[0]]);
        status.setOnClickListener(v -> new AlertDialog.Builder(this).setTitle("Flight status")
                .setItems(FLIGHT_STATUSES, (dialog, which) -> { statusIndex[0] = which; status.setText("Status: " + FLIGHT_STATUSES[which]); }).show());
        addField(form, "Guest name", guestName); addField(form, "Note", note);
        addField(form, "Airline", airline); addField(form, "Flight number", number);
        addField(form, "Origin", origin); addField(form, "Destination", destination);
        addField(form, "Scheduled departure", scheduledDeparture); addField(form, "Estimated departure", estimatedDeparture);
        addField(form, "Scheduled arrival", scheduledArrival); addField(form, "Estimated arrival", estimatedArrival);
        addField(form, "Departure terminal", departureTerminal); addField(form, "Arrival terminal", arrivalTerminal);
        addField(form, "Gate", gate); addField(form, "Delay in minutes", delay); addField(form, "Baggage claim", baggage);
        form.addView(text("Status", 13, MUTED, true), margins(0, 0, 0, 4)); form.addView(status);

        new AlertDialog.Builder(this).setTitle(existing == null ? "Watch a Guest Flight" : "Update Guest Flight")
                .setView(scrollable(form)).setNegativeButton("Cancel", null)
                .setPositiveButton("Save", (dialog, which) -> {
                    GuestFlight guest = existing == null ? new GuestFlight() : existing;
                    if (existing == null) guest.id = "guest-flight-" + System.currentTimeMillis();
                    guest.guestName = fallback(guestName, "Guest");
                    guest.note = fallback(note, "Friend or family flight");
                    int delayMinutes = Math.max(0, parseInt(delay.getText().toString(), 0));
                    guest.status = delayMinutes > 0 ? "Delayed" : FLIGHT_STATUSES[statusIndex[0]];
                    FlightInfo flight = current;
                    flight.airline = fallback(airline, "Airline"); flight.number = fallback(number, "Flight").toUpperCase();
                    flight.origin = fallback(origin, "ORG").toUpperCase(); flight.destination = fallback(destination, "DST").toUpperCase();
                    flight.scheduledDeparture = formatTime(scheduledDeparture.getText().toString());
                    flight.estimatedDeparture = formatTime(estimatedDeparture.getText().toString());
                    flight.scheduledArrival = formatTime(scheduledArrival.getText().toString());
                    flight.estimatedArrival = formatTime(estimatedArrival.getText().toString());
                    flight.departureTerminal = fallback(departureTerminal, FlightInfo.UNKNOWN);
                    flight.arrivalTerminal = fallback(arrivalTerminal, FlightInfo.UNKNOWN);
                    flight.gate = fallback(gate, FlightInfo.UNKNOWN).toUpperCase();
                    flight.delayMinutes = delayMinutes; flight.baggageClaim = fallback(baggage, FlightInfo.UNKNOWN); flight.lastUpdated = "Just now";
                    guest.flight = flight;
                    if (trip.guestFlights == null) trip.guestFlights = new ArrayList<>();
                    if (existing == null) trip.guestFlights.add(guest);
                    activeSection = SECTION_GUEST_FLIGHTS;
                    commit(user);
                    toast(flight.number + " saved for " + guest.guestName);
                }).show();
    }

    private void confirmDeleteGuestFlight(FirebaseUser user, Trip trip, GuestFlight guest) {
        new AlertDialog.Builder(this).setTitle("Remove Guest Flight")
                .setMessage("Stop watching " + guest.flight.number + " for " + guest.guestName + "?")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Remove", (dialog, which) -> { trip.guestFlights.remove(guest); commit(user); })
                .show();
    }

    private void showAddExpenseDialog(FirebaseUser user, Trip trip) {
        LinearLayout form = formContainer();
        EditText description = input("What was purchased?", InputType.TYPE_CLASS_TEXT, "");
        EditText amount = input("0.00", InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL, "");
        EditText currency = input("Currency", InputType.TYPE_CLASS_TEXT, expenseCurrency(trip));
        EditText paidBy = input("Traveler name", InputType.TYPE_CLASS_TEXT,
                trip.travelersList != null && !trip.travelersList.isEmpty() ? trip.travelersList.get(0).name : "Traveler");
        EditText category = input("Dining, Transport, Lodging…", InputType.TYPE_CLASS_TEXT, "Other");
        EditText date = input("Date label", InputType.TYPE_CLASS_TEXT, "Today");
        addField(form, "Description", description);
        addField(form, "Amount", amount);
        addField(form, "Currency", currency);
        addField(form, "Paid by", paidBy);
        addField(form, "Category", category);
        addField(form, "Date", date);
        new AlertDialog.Builder(this)
                .setTitle("Add Group Expense")
                .setView(scrollable(form))
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Add Expense", (dialog, which) -> {
                    double value = parseDouble(amount.getText().toString(), -1);
                    if (value < 0) { toast("Enter a valid expense amount."); return; }
                    Expense expense = new Expense();
                    expense.id = "exp-" + System.currentTimeMillis();
                    expense.description = fallback(description, "Trip expense");
                    expense.amount = value;
                    expense.currency = fallback(currency, "USD").toUpperCase();
                    expense.paidBy = fallback(paidBy, "Traveler");
                    expense.category = fallback(category, "Other");
                    expense.date = fallback(date, "Today");
                    if (trip.expenses == null) trip.expenses = new ArrayList<>();
                    trip.expenses.add(expense);
                    activeSection = SECTION_EXPENSES;
                    commit(user);
                    toast("Expense added to the group.");
                }).show();
    }

    private void confirmDeleteExpense(FirebaseUser user, Trip trip, Expense expense) {
        new AlertDialog.Builder(this).setTitle("Delete Expense")
                .setMessage("Remove \"" + expense.description + "\"?")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Delete", (dialog, which) -> { trip.expenses.remove(expense); commit(user); })
                .show();
    }

    private void confirmSettleExpenses(FirebaseUser user, Trip trip) {
        new AlertDialog.Builder(this).setTitle("Settle Group Expenses")
                .setMessage("Mark every open expense as settled?")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Settle All", (dialog, which) -> {
                    if (trip.expenses != null) for (Expense expense : trip.expenses) if (expense != null) expense.settled = true;
                    commit(user);
                    toast("All expenses are settled.");
                }).show();
    }

    private void showAddWalletDocDialog(FirebaseUser user, Trip trip) {
        LinearLayout form = formContainer();
        EditText title = input("Boarding pass", InputType.TYPE_CLASS_TEXT, "");
        EditText meta = input("Airline, hotel, ticket type…", InputType.TYPE_CLASS_TEXT, "");
        EditText code = input("Confirmation or ticket code", InputType.TYPE_CLASS_TEXT, "");
        EditText icon = input("Short badge, up to 3 letters", InputType.TYPE_CLASS_TEXT, "DOC");
        addField(form, "Document title", title);
        addField(form, "Type / details", meta);
        addField(form, "Code", code);
        addField(form, "Badge", icon);
        new AlertDialog.Builder(this).setTitle("Add to Trip Wallet")
                .setView(scrollable(form)).setNegativeButton("Cancel", null)
                .setPositiveButton("Save", (dialog, which) -> {
                    WalletDoc doc = new WalletDoc();
                    doc.id = "wallet-" + System.currentTimeMillis();
                    doc.title = fallback(title, "Travel document");
                    doc.meta = fallback(meta, "Trip document");
                    doc.code = fallback(code, "TBD");
                    String badgeText = fallback(icon, "DOC").toUpperCase();
                    doc.icon = badgeText.substring(0, Math.min(3, badgeText.length()));
                    if (trip.walletDocs == null) trip.walletDocs = new ArrayList<>();
                    trip.walletDocs.add(doc);
                    activeSection = SECTION_WALLET;
                    commit(user);
                    toast("Document saved to the trip wallet.");
                }).show();
    }

    private void confirmDeleteWalletDoc(FirebaseUser user, Trip trip, WalletDoc doc) {
        new AlertDialog.Builder(this).setTitle("Remove Document")
                .setMessage("Remove \"" + doc.title + "\" from the trip wallet?")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Remove", (dialog, which) -> { trip.walletDocs.remove(doc); commit(user); })
                .show();
    }

    private void showAddMapPinDialog(FirebaseUser user, Trip trip) {
        LinearLayout form = formContainer();
        EditText name = input("City or place", InputType.TYPE_CLASS_TEXT, "");
        EditText code = input("3-letter code", InputType.TYPE_CLASS_TEXT, "");
        EditText description = input("Why this stop matters", InputType.TYPE_CLASS_TEXT, "");
        EditText temp = input("Forecast or temperature", InputType.TYPE_CLASS_TEXT, "TBD");
        addField(form, "Place", name);
        addField(form, "Code", code);
        addField(form, "Notes", description);
        addField(form, "Weather", temp);
        new AlertDialog.Builder(this).setTitle("Add Map Pin")
                .setView(scrollable(form)).setNegativeButton("Cancel", null)
                .setPositiveButton("Add Place", (dialog, which) -> {
                    MapPin pin = new MapPin();
                    pin.name = fallback(name, "Destination");
                    String defaultCode = pin.name.substring(0, Math.min(3, pin.name.length()));
                    pin.code = fallback(code, defaultCode).toUpperCase();
                    pin.desc = fallback(description, "Trip destination");
                    pin.temp = fallback(temp, "TBD");
                    if (trip.mapPins == null) trip.mapPins = new ArrayList<>();
                    trip.mapPins.add(pin);
                    activeSection = SECTION_MAP;
                    commit(user);
                    toast(pin.name + " added to the map.");
                }).show();
    }

    private void confirmDeleteMapPin(FirebaseUser user, Trip trip, MapPin pin) {
        new AlertDialog.Builder(this).setTitle("Delete Map Pin")
                .setMessage("Remove " + pin.name + " from this route?")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Delete", (dialog, which) -> { trip.mapPins.remove(pin); commit(user); })
                .show();
    }

    private void showAddTravelerDialog(FirebaseUser user, Trip trip) {
        LinearLayout form = formContainer();
        EditText name = input("Traveler name", InputType.TYPE_CLASS_TEXT, "");
        EditText email = input("Email address", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, "");
        EditText role = input("Traveler or co-organizer", InputType.TYPE_CLASS_TEXT, "Traveler");
        addField(form, "Name", name);
        addField(form, "Email", email);
        addField(form, "Role", role);
        new AlertDialog.Builder(this).setTitle("Invite Traveler")
                .setView(scrollable(form)).setNegativeButton("Cancel", null)
                .setPositiveButton("Add Traveler", (dialog, which) -> {
                    Traveler traveler = new Traveler();
                    traveler.name = fallback(name, "Traveler");
                    traveler.email = fallback(email, "traveler@example.com");
                    traveler.role = fallback(role, "Traveler");
                    traveler.avatar = Traveler.initials(traveler.name);
                    traveler.bg = "blue";
                    if (trip.travelersList == null) trip.travelersList = new ArrayList<>();
                    trip.travelersList.add(traveler);
                    trip.travelersCount = trip.travelersList.size();
                    activeSection = SECTION_TRAVELERS;
                    commit(user);
                    toast(traveler.name + " added to the travel team.");
                }).show();
    }

    private void confirmDeleteTraveler(FirebaseUser user, Trip trip, Traveler traveler) {
        if (trip.travelersList == null || trip.travelersList.size() <= 1) {
            toast("A trip needs at least one traveler.");
            return;
        }
        new AlertDialog.Builder(this).setTitle("Remove Traveler")
                .setMessage("Remove " + traveler.name + " from this trip?")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Remove", (dialog, which) -> {
                    trip.travelersList.remove(traveler);
                    trip.travelersCount = trip.travelersList.size();
                    commit(user);
                }).show();
    }

    // ---------------------------------------------------------------- trips

    private void showTripSwitcherDialog(FirebaseUser user) {
        if (savedTrips.isEmpty()) return;
        String[] names = new String[savedTrips.size()];
        for (int i = 0; i < savedTrips.size(); i++) {
            Trip t = savedTrips.get(i);
            String name = t != null ? safeText(t.name, "Trip") : "Trip";
            boolean isActive = t != null && t.id != null && t.id.equals(activeTripId);
            names[i] = name + (isActive ? " (Active)" : "");
        }
        new AlertDialog.Builder(this)
                .setTitle("Select Itinerary (" + savedTrips.size() + ")")
                .setItems(names, (dialog, which) -> {
                    Trip selected = savedTrips.get(which);
                    if (selected != null) {
                        activeTripId = selected.id;
                        activeDayIndex = 0;
                        // Persist the switch so the web app opens the same trip.
                        commit(user);
                        toast("Switched to \"" + selected.name + "\"");
                    }
                })
                .setNegativeButton("Cancel", null)
                .setPositiveButton("＋ New Itinerary", (dialog, which) -> showCreateTripDialog(user))
                .show();
    }

    private void showCreateTripDialog(FirebaseUser user) {
        LinearLayout form = formContainer();

        EditText nameInput = input("Trip Name (e.g. Alpine Adventure)", InputType.TYPE_CLASS_TEXT, "");
        EditText routeInput = input("Route (e.g. Zürich → Zermatt)", InputType.TYPE_CLASS_TEXT, "");
        EditText startInput = input("Start Date (YYYY-MM-DD)", InputType.TYPE_CLASS_TEXT, "2026-08-01");
        EditText travelersInput = input("Number of Travelers (e.g. 2)", InputType.TYPE_CLASS_NUMBER, "2");

        addField(form, "Trip Name", nameInput);
        addField(form, "Route", routeInput);
        addField(form, "Start Date", startInput);
        addField(form, "Travelers Count", travelersInput);

        new AlertDialog.Builder(this)
                .setTitle("Create New Itinerary")
                .setView(scrollable(form))
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Create", (dialog, which) -> {
                    String name = fallback(nameInput, "New Adventure");
                    String route = fallback(routeInput, "Custom Route");
                    String start = fallback(startInput, "2026-08-01");
                    int count = Math.max(1, parseInt(travelersInput.getText().toString(), 1));

                    String tripId = "trip-" + System.currentTimeMillis();
                    List<Day> initialDays = new ArrayList<>();
                    initialDays.add(new Day("day-" + System.currentTimeMillis(), "01", "DAY 1", "Arrival", new ArrayList<>()));

                    Trip newTrip = new Trip(tripId, name, route, start, count, initialDays);
                    Traveler organizer = new Traveler();
                    organizer.name = user.getDisplayName() != null ? user.getDisplayName() : safeEmail(user).split("@")[0];
                    organizer.email = safeEmail(user);
                    organizer.role = "Trip organizer";
                    organizer.avatar = Traveler.initials(organizer.name);
                    organizer.bg = "avatar-me";
                    newTrip.travelersList.add(organizer);
                    for (int i = 1; i < count; i++) {
                        Traveler traveler = new Traveler();
                        traveler.name = "Traveler " + (i + 1);
                        traveler.email = "traveler" + (i + 1) + "@example.com";
                        traveler.role = "Traveler";
                        traveler.avatar = "T" + (i + 1);
                        traveler.bg = "blue";
                        newTrip.travelersList.add(traveler);
                    }
                    MapPin firstPin = new MapPin();
                    String firstStop = route.split("→|->|,")[0].trim();
                    firstPin.name = firstStop.isEmpty() ? name : firstStop;
                    firstPin.code = firstPin.name.substring(0, Math.min(3, firstPin.name.length())).toUpperCase();
                    firstPin.desc = "Starting point";
                    firstPin.temp = "TBD";
                    newTrip.mapPins.add(firstPin);
                    savedTrips.add(0, newTrip);
                    activeTripId = tripId;
                    activeDayIndex = 0;
                    activeSection = SECTION_OVERVIEW;
                    commit(user);
                    toast("Created new itinerary: \"" + name + "\"!");
                })
                .show();
    }

    private void confirmDeleteTrip(FirebaseUser user, Trip trip) {
        if (trip == null) return;
        if (savedTrips.size() <= 1) {
            toast("You must keep at least one itinerary!");
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle("Delete Itinerary")
                .setMessage("Are you sure you want to permanently delete \"" + trip.name + "\"?")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Delete", (dialog, which) -> {
                    savedTrips.remove(trip);
                    activeTripId = savedTrips.get(0).id;
                    activeDayIndex = 0;
                    commit(user);
                    toast("Itinerary deleted.");
                })
                .show();
    }

    // ------------------------------------------------------------------ days

    private void showAddDayDialog(FirebaseUser user, Trip trip) {
        if (trip == null) return;
        LinearLayout form = formContainer();

        int nextNum = (trip.days != null ? trip.days.size() + 1 : 1);
        EditText labelInput = input("Day Title (e.g. Exploring Old Town)", InputType.TYPE_CLASS_TEXT, "Day " + nextNum + " Excursion");
        EditText dateInput = input("Day of Month (e.g. 14)", InputType.TYPE_CLASS_TEXT, String.valueOf(10 + nextNum));
        EditText shortInput = input("Weekday Short (e.g. MON)", InputType.TYPE_CLASS_TEXT, "DAY");

        addField(form, "Day Title", labelInput);
        addField(form, "Day of Month", dateInput);
        addField(form, "Weekday Short (3 chars)", shortInput);

        new AlertDialog.Builder(this)
                .setTitle("Add Itinerary Day")
                .setView(scrollable(form))
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Add Day", (dialog, which) -> {
                    String label = fallback(labelInput, "Day " + nextNum);
                    String date = fallback(dateInput, String.valueOf(10 + nextNum));
                    String shortName = fallback(shortInput, "DAY").toUpperCase();

                    if (trip.days == null) trip.days = new ArrayList<>();
                    Day newDay = new Day("day-" + System.currentTimeMillis(), date, shortName, label, new ArrayList<>());
                    trip.days.add(newDay);
                    activeDayIndex = trip.days.size() - 1;
                    activeSection = SECTION_ITINERARY;
                    commit(user);
                    toast("Added " + label + "!");
                })
                .show();
    }

    private void showRenameDayDialog(FirebaseUser user, Trip trip, Day day) {
        if (trip == null || day == null) return;
        LinearLayout form = formContainer();
        EditText labelInput = input("Day Title", InputType.TYPE_CLASS_TEXT, day.label);
        EditText dateInput = input("Day of Month", InputType.TYPE_CLASS_TEXT, day.date);
        EditText shortInput = input("Weekday Short", InputType.TYPE_CLASS_TEXT, day.shortName);
        addField(form, "Day Title", labelInput);
        addField(form, "Day of Month", dateInput);
        addField(form, "Weekday Short", shortInput);

        new AlertDialog.Builder(this)
                .setTitle("Edit Day " + (activeDayIndex + 1))
                .setView(scrollable(form))
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Save", (d, which) -> {
                    day.label = fallback(labelInput, day.label);
                    day.date = fallback(dateInput, day.date);
                    day.shortName = fallback(shortInput, day.shortName).toUpperCase();
                    commit(user);
                    toast("Day updated!");
                })
                .show();
    }

    private void confirmDeleteDay(FirebaseUser user, Trip trip) {
        if (trip == null || trip.days == null || trip.days.size() <= 1) {
            toast("An itinerary must have at least one day!");
            return;
        }
        if (activeDayIndex < 0 || activeDayIndex >= trip.days.size()) return;
        Day target = trip.days.get(activeDayIndex);
        new AlertDialog.Builder(this)
                .setTitle("Delete Day " + (activeDayIndex + 1))
                .setMessage("Delete \"" + (target != null ? target.label : "this day") + "\" and all its activities?")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Delete", (dialog, which) -> {
                    trip.days.remove(activeDayIndex);
                    if (activeDayIndex >= trip.days.size()) {
                        activeDayIndex = trip.days.size() - 1;
                    }
                    commit(user);
                    toast("Day deleted.");
                })
                .show();
    }

    // ---------------------------------------------------------------- events

    private void showAddEventDialog(FirebaseUser user, Day day) {
        if (day == null) {
            toast("Add an itinerary day first.");
            return;
        }
        LinearLayout form = formContainer();

        EditText titleInput = input("Activity Title (e.g. Museum Visit)", InputType.TYPE_CLASS_TEXT, "");
        EditText timeInput = input("Time (e.g. 10:30 AM)", InputType.TYPE_CLASS_TEXT, "10:00 AM");
        EditText detailsInput = input("Location or details", InputType.TYPE_CLASS_TEXT, "");

        final int[] selectedKind = {0};
        Button kindBtn = outlineButton("Category: " + EVENT_KIND_LABELS[0]);
        kindBtn.setOnClickListener(v -> new AlertDialog.Builder(this)
                .setTitle("Select Category")
                .setItems(EVENT_KIND_LABELS, (d, which) -> {
                    selectedKind[0] = which;
                    kindBtn.setText("Category: " + EVENT_KIND_LABELS[which]);
                })
                .show());

        addField(form, "Activity Title", titleInput);
        addField(form, "Time", timeInput);
        addField(form, "Details / Location", detailsInput);
        form.addView(text("Category", 13, MUTED, true), margins(0, 0, 0, 4));
        form.addView(kindBtn);

        new AlertDialog.Builder(this)
                .setTitle("Add Activity")
                .setView(scrollable(form))
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Save", (dialog, which) -> {
                    String title = titleInput.getText().toString().trim();
                    if (title.isEmpty()) {
                        toast("Give the activity a title first.");
                        return;
                    }
                    String time = formatTime(timeInput.getText().toString());
                    String details = fallback(detailsInput, "No details provided");
                    String kind = EVENT_KINDS[selectedKind[0]];

                    if (day.events == null) day.events = new ArrayList<>();
                    DayEvent event = new DayEvent("ev-" + System.currentTimeMillis(), time, title, details, kind, "");
                    if ("flight".equals(kind)) {
                        // Give it flight detail up front so it shows in the tracker.
                        event.status = "Scheduled";
                        event.requireFlight();
                    }
                    day.events.add(event);
                    commit(user);
                    toast("Added \"" + title + "\"!");
                })
                .show();
    }

    private void showEditEventDialog(FirebaseUser user, Day day, DayEvent event) {
        if (day == null || event == null) return;
        LinearLayout form = formContainer();

        EditText titleInput = input("Activity Title", InputType.TYPE_CLASS_TEXT, event.title);
        EditText timeInput = input("Time", InputType.TYPE_CLASS_TEXT, event.time);
        EditText detailsInput = input("Details", InputType.TYPE_CLASS_TEXT, event.meta);

        int initialIdx = Math.max(0, indexOfIgnoreCase(EVENT_KINDS, event.kind));
        final int[] selectedKind = {initialIdx};
        Button kindBtn = outlineButton("Category: " + EVENT_KIND_LABELS[initialIdx]);
        kindBtn.setOnClickListener(v -> new AlertDialog.Builder(this)
                .setTitle("Select Category")
                .setItems(EVENT_KIND_LABELS, (d, which) -> {
                    selectedKind[0] = which;
                    kindBtn.setText("Category: " + EVENT_KIND_LABELS[which]);
                })
                .show());

        addField(form, "Activity Title", titleInput);
        addField(form, "Time", timeInput);
        addField(form, "Details / Location", detailsInput);
        form.addView(text("Category", 13, MUTED, true), margins(0, 0, 0, 4));
        form.addView(kindBtn);
        if (event.isFlight()) {
            form.addView(text("Gate, terminal, and delay live in ✈ Flight details.", 12, FAINT, false),
                    margins(0, 8, 0, 0));
        }

        new AlertDialog.Builder(this)
                .setTitle("Edit Activity")
                .setView(scrollable(form))
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Update", (dialog, which) -> {
                    event.title = fallback(titleInput, event.title);
                    event.time = formatTime(timeInput.getText().toString());
                    event.meta = detailsInput.getText().toString().trim();
                    event.kind = EVENT_KINDS[selectedKind[0]];
                    if (event.isFlight()) {
                        if (event.status == null || event.status.isEmpty()) event.status = "Scheduled";
                        event.requireFlight();
                    } else {
                        event.status = "";
                        event.flight = null;
                    }
                    commit(user);
                    toast("Activity updated!");
                })
                .show();
    }

    private void confirmDeleteEvent(FirebaseUser user, Day day, DayEvent event) {
        if (day == null || day.events == null || event == null) return;
        new AlertDialog.Builder(this)
                .setTitle(event.isFlight() ? "Remove flight" : "Delete Activity")
                .setMessage("Remove \"" + event.title + "\" from this day?")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Delete", (dialog, which) -> {
                    day.events.remove(event);
                    commit(user);
                    toast(event.isFlight() ? "Flight removed from tracker." : "Activity removed.");
                })
                .show();
    }

    private Trip createDefaultTrip() {
        FlightInfo arrivalFlight = new FlightInfo();
        arrivalFlight.number = "LX 017";
        arrivalFlight.airline = "SWISS";
        arrivalFlight.origin = "JFK";
        arrivalFlight.destination = "ZRH";
        arrivalFlight.departureTerminal = "1";
        arrivalFlight.arrivalTerminal = "2";
        arrivalFlight.gate = "E52";
        arrivalFlight.scheduledDeparture = "8:40 PM";
        arrivalFlight.estimatedDeparture = "8:40 PM";
        arrivalFlight.scheduledArrival = "10:15 AM (+1)";
        arrivalFlight.estimatedArrival = "10:15 AM (+1)";
        arrivalFlight.baggageClaim = "Carousel 24";
        arrivalFlight.lastUpdated = "Just now";

        DayEvent arrival = new DayEvent("ev-1", "8:40 AM", "Arrive at Zürich Airport",
                "LX 017 · Terminal 2 · Gate E52", "flight", "On time");
        arrival.flight = arrivalFlight;

        List<DayEvent> events = new ArrayList<>(Arrays.asList(
                arrival,
                new DayEvent("ev-2", "10:18 AM", "Train to Zürich HB", "SBB · Platform 3 · 12 min", "train", ""),
                new DayEvent("ev-3", "7:30 PM", "Dinner at Kronenhalle", "Rämistrasse 4 · Table for 4", "food", "")
        ));
        List<Day> days = new ArrayList<>();
        days.add(new Day("day-1", "12", "SAT", "Arrival in Zürich", events));
        // Matches the website's starter itinerary so both clients agree on the
        // trip a fresh account opens with.
        Trip trip = new Trip("swiss-escape", "Swiss Escape", "Zürich → Interlaken → Zermatt", "2026-09-12", 4, days);

        String[][] travelerData = {
                {"Manav S.", "Trip organizer", "manav@example.com", "MS", "avatar-me"},
                {"Amelia L.", "Co-organizer", "amelia@example.com", "AL", "peach"},
                {"Noah K.", "Traveler", "noah@example.com", "NK", "blue"},
                {"Riya P.", "Traveler", "riya@example.com", "RP", "green"}
        };
        for (String[] row : travelerData) {
            Traveler traveler = new Traveler();
            traveler.name = row[0]; traveler.role = row[1]; traveler.email = row[2]; traveler.avatar = row[3]; traveler.bg = row[4];
            trip.travelersList.add(traveler);
        }

        String[][] pinData = {
                {"Zürich", "ZRH", "Arrival & Old Town", "18°C"},
                {"Interlaken", "INT", "Alpine Lakes & Funicular", "16°C"},
                {"Lauterbrunnen", "LTB", "Waterfalls & Valley Trail", "15°C"},
                {"Zermatt", "ZMT", "Matterhorn Peak", "12°C"}
        };
        for (String[] row : pinData) {
            MapPin pin = new MapPin();
            pin.name = row[0]; pin.code = row[1]; pin.desc = row[2]; pin.temp = row[3];
            trip.mapPins.add(pin);
        }

        String[][] walletData = {
                {"Boarding pass", "SWISS LX 017 · PDF", "LX-98421-ZRH", "LX"},
                {"Hotel confirmation", "Marktgasse · PDF", "HTL-ZH-4821", "M"},
                {"Swiss Travel Pass", "8 Consecutive Days", "STP-2026-884", "STP"}
        };
        for (String[] row : walletData) {
            WalletDoc doc = new WalletDoc();
            doc.id = "wallet-" + trip.walletDocs.size(); doc.title = row[0]; doc.meta = row[1]; doc.code = row[2]; doc.icon = row[3];
            trip.walletDocs.add(doc);
        }

        Expense dinner = new Expense();
        dinner.id = "exp-1"; dinner.description = "Dinner at Kronenhalle"; dinner.amount = 186.00;
        dinner.currency = "CHF"; dinner.paidBy = "Manav"; dinner.date = "Sep 12"; dinner.category = "Dining";
        trip.expenses.add(dinner);
        Expense trainPasses = new Expense();
        trainPasses.id = "exp-2"; trainPasses.description = "Zürich HB Train Passes"; trainPasses.amount = 42.40;
        trainPasses.currency = "CHF"; trainPasses.paidBy = "Amelia"; trainPasses.date = "Sep 12"; trainPasses.category = "Transport";
        trip.expenses.add(trainPasses);
        return trip;
    }

    // ------------------------------------------------------------- ui helpers

    private void addBrandHeader() {
        TextView brand = text("JourneySync", 25, BLUE, true);
        screen.addView(brand);
        screen.addView(text(getString(R.string.app_tagline), 14, MUTED, false), margins(0, 4, 0, 0));
    }

    private LinearLayout formContainer() {
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(20), dp(10), dp(20), dp(10));
        return form;
    }

    /** Dialog forms can outgrow the screen, so every one of them scrolls. */
    private ScrollView scrollable(View content) {
        ScrollView scroll = new ScrollView(this);
        scroll.addView(content, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT, ScrollView.LayoutParams.WRAP_CONTENT));
        return scroll;
    }

    private void addField(LinearLayout form, String label, EditText field) {
        form.addView(text(label, 13, MUTED, true), margins(0, 0, 0, 4));
        form.addView(field, margins(0, 0, 0, 10));
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(16), dp(18), dp(16));
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.WHITE);
        background.setCornerRadius(dp(16));
        background.setStroke(dp(1), Color.parseColor(LINE));
        card.setBackground(background);
        return card;
    }

    private TextView badge(String label, String bgColorHex) {
        TextView badge = new TextView(this);
        badge.setText(label);
        badge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        badge.setTextColor(Color.WHITE);
        badge.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        badge.setPadding(dp(8), dp(3), dp(8), dp(3));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor(bgColorHex));
        bg.setCornerRadius(dp(6));
        badge.setBackground(bg);
        return badge;
    }

    private String colorForKind(String kind) {
        if ("stay".equalsIgnoreCase(kind)) return GREEN;
        if ("food".equalsIgnoreCase(kind)) return ORANGE;
        if ("train".equalsIgnoreCase(kind)) return PURPLE;
        if ("activity".equalsIgnoreCase(kind)) return CORAL;
        return BLUE;
    }

    private EditText input(String hint, int inputType, String defaultValue) {
        EditText input = new EditText(this);
        input.setHint(hint);
        if (defaultValue != null && !defaultValue.isEmpty()) {
            input.setText(defaultValue);
        }
        input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        input.setInputType(inputType);
        input.setSingleLine(true);
        input.setPadding(dp(14), dp(12), dp(14), dp(12));
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.WHITE);
        background.setCornerRadius(dp(10));
        background.setStroke(dp(1), Color.parseColor("#C9D4E1"));
        input.setBackground(background);
        return input;
    }

    private Button primaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.WHITE);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        button.setAllCaps(false);
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.parseColor(BLUE));
        background.setCornerRadius(dp(10));
        button.setBackground(background);
        button.setPadding(dp(14), dp(10), dp(14), dp(10));
        return button;
    }

    private Button outlineButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.parseColor(INK));
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        button.setAllCaps(false);
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.WHITE);
        background.setCornerRadius(dp(10));
        background.setStroke(dp(1), Color.parseColor("#AFC0D2"));
        button.setBackground(background);
        button.setPadding(dp(14), dp(10), dp(14), dp(10));
        return button;
    }

    private Button dangerButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.parseColor(CORAL));
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        button.setAllCaps(false);
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.WHITE);
        background.setCornerRadius(dp(10));
        background.setStroke(dp(1), Color.parseColor(CORAL));
        button.setBackground(background);
        button.setPadding(dp(14), dp(10), dp(14), dp(10));
        return button;
    }

    private TextView text(String content, int size, String color, boolean bold) {
        TextView text = new TextView(this);
        text.setText(content);
        text.setTextSize(TypedValue.COMPLEX_UNIT_SP, size);
        text.setTextColor(Color.parseColor(color));
        text.setLineSpacing(0, 1.15f);
        if (bold) text.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        return text;
    }

    private LinearLayout.LayoutParams margins(int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        return params;
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics());
    }

    /** Blocks repeat taps while a sign-in request is in flight. */
    private void setAuthBusy(boolean busy) {
        for (Button button : authButtons) {
            button.setEnabled(!busy);
            button.setAlpha(busy ? 0.55f : 1f);
        }
        if (authProgress != null) {
            authProgress.setVisibility(busy ? View.VISIBLE : View.GONE);
        }
    }

    // ---------------------------------------------------------- value helpers

    /** Mirrors the website's formatTime so 24h entry renders as 8:40 PM. */
    static String formatTime(String raw) {
        return TimeFormat.display(raw);
    }

    private static int parseInt(String raw, int fallback) {
        if (raw == null) return fallback;
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException notANumber) {
            return fallback;
        }
    }

    private static double parseDouble(String raw, double fallback) {
        if (raw == null) return fallback;
        try {
            return Double.parseDouble(raw.trim());
        } catch (NumberFormatException notANumber) {
            return fallback;
        }
    }

    private static String money(String currency, double amount) {
        return safeText(currency, "USD") + " " + String.format(java.util.Locale.US, "%.2f", amount);
    }

    private static String expenseCurrency(Trip trip) {
        if (trip != null && trip.expenses != null) {
            for (Expense expense : trip.expenses) {
                if (expense != null && expense.currency != null && !expense.currency.trim().isEmpty()) return expense.currency;
            }
        }
        return "USD";
    }

    private static int indexOfIgnoreCase(String[] values, String needle) {
        if (needle != null) {
            for (int i = 0; i < values.length; i++) {
                if (values[i].equalsIgnoreCase(needle.trim())) return i;
            }
        }
        return 0;
    }

    private static String fallback(EditText field, String fallback) {
        String value = field.getText().toString().trim();
        return value.isEmpty() ? fallback : value;
    }

    private static String safeText(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private static boolean equalIds(String left, String right) {
        return left == null ? right == null : left.equals(right);
    }

    private String safeEmail(FirebaseUser user) {
        return user.getEmail() == null ? "JourneySync account" : user.getEmail();
    }

    private String friendlyError(Exception error) {
        String message = error == null ? "" : String.valueOf(error.getMessage()).toLowerCase();
        if (message.contains("invalid-credential") || message.contains("wrong-password")
                || message.contains("invalid_login_credentials") || message.contains("password is invalid")) {
            return "That email or password is incorrect.";
        }
        if (message.contains("email-already-in-use")) return "An account already exists for this email.";
        if (message.contains("weak-password")) return "Use a password with at least six characters.";
        if (message.contains("badly formatted") || message.contains("invalid-email")) return "That email address does not look right.";
        if (message.contains("no user record") || message.contains("user-not-found")) return "No account found for that email.";
        if (message.contains("network")) return "Check your connection and try again.";
        if (message.contains("too-many-requests")) return "Too many attempts. Wait a moment and try again.";
        return "Firebase could not complete the request. Please try again.";
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }
}
