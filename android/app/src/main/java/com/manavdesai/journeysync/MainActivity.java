package com.manavdesai.journeysync;

import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.AdapterView;
import android.widget.Button;
import android.widget.ArrayAdapter;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
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
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.SetOptions;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.text.SimpleDateFormat;

/** A native Android JourneySync experience backed by Firebase Authentication and Firestore with full website feature parity. */
public class MainActivity extends android.app.Activity {
    private static final int RC_GOOGLE_SIGN_IN = 4021;
    /** Shared JourneySync palette used by the current website. */
    private static final String BLUE = "#89B8D8";
    private static final String INK = "#1B2731";
    private static final String SURFACE = "#FFFDF8";
    private static final String CORAL = "#EF7159";
    /** Darker coral used for the pressed state on filled buttons. */
    private static final String CORAL_PRESSED = "#D85C45";
    private static final String NAVY = "#17212B";
    private static final String CREAM = "#F4F1EA";
    private static final String MINT = "#B9DDC7";
    private static final String GREEN = "#1D7A48";
    private static final String ORANGE = "#D97706";
    private static final String PURPLE = "#7C3AED";
    private static final String MUTED = "#72808A";
    private static final String FAINT = "#7B8990";
    private static final String LINE = "#DEDBD2";

    private static final int SECTION_OVERVIEW = 0;
    private static final int SECTION_ITINERARY = 1;
    private static final int SECTION_FLIGHTS = 2;
    private static final int SECTION_MAP = 3;
    private static final int SECTION_EXPENSES = 4;
    private static final int SECTION_WALLET = 5;
    private static final int SECTION_TRAVELERS = 6;
    private static final int SECTION_GUEST_FLIGHTS = 7;

    /** How often the open flight tracker looks for a flight worth refreshing. */
    private static final long REFRESH_TICK_MS = 60_000L;

    /** Date, "T" or a space, time, optional seconds/fraction, optional "Z" or +/-HH:MM offset. */
    private static final Pattern TIMESTAMP = Pattern.compile(
            "(\\d{4})-(\\d{2})-(\\d{2})[T ](\\d{2}):(\\d{2})(?::(\\d{2}))?(?:\\.(\\d{1,9}))?\\s*(Z|z|[+-]\\d{2}:?\\d{2})?");

    private static final String[] EVENT_KINDS = {"activity", "flight", "stay", "food", "train"};
    private static final String[] EVENT_KIND_LABELS = {
            "🏛️ Activity", "✈️ Flight", "🏨 Stay", "🍽️ Food / Dining", "🚆 Train / Transit"
    };
    // Must cover every status the /api/flights/status route can return, including
    // Diverted and Incident from the AviationStack fallback. indexOfIgnoreCase
    // falls back to index 0 ("Scheduled") for anything missing here, so an
    // absent status would silently rewrite a diverted flight as scheduled when
    // the edit dialog is saved.
    private static final String[] FLIGHT_STATUSES = {"Scheduled", "On time", "Delayed", "Boarding", "Departed", "Landed", "Diverted", "Incident", "Cancelled"};

    private FirebaseAuth firebaseAuth;
    private FirebaseFirestore firestore;
    private GoogleSignInClient googleClient;
    private LinearLayout appRoot;
    private LinearLayout screen;

    private final List<Button> authButtons = new ArrayList<>();
    private final Set<String> liveRefreshes = new HashSet<>();
    private final Map<String, RefreshThrottle> liveRefreshThrottles = new HashMap<>();
    private final Handler liveRefreshHandler = new Handler(Looper.getMainLooper());
    private List<Trip.TrackedFlight> liveRefreshFlights = new ArrayList<>();
    private Runnable liveRefreshLoop;
    private ProgressBar authProgress;

    private static final String STATE_ACTIVE_TRIP_ID = "journeysync.activeTripId";
    private static final String STATE_ACTIVE_DAY_INDEX = "journeysync.activeDayIndex";
    private static final String STATE_ACTIVE_SECTION = "journeysync.activeSection";
    private static final String STATE_SHOWING_TRIP_LIBRARY = "journeysync.showingTripLibrary";
    private static final String STATE_SHOW_ARCHIVED_TRIPS = "journeysync.showArchivedTrips";

    private final List<Trip> savedTrips = new ArrayList<>();
    private String activeTripId = "";
    private int activeDayIndex = 0;
    private int activeSection = SECTION_OVERVIEW;
    private boolean showingTripLibrary = true;
    private boolean showArchivedTrips = false;
    private final Map<String, WeatherSnapshot> weatherByTrip = new HashMap<>();
    private final Set<String> weatherLoading = new HashSet<>();

    /**
     * The uid whose screen is currently on display, so returning to the
     * foreground does not tear down and refetch a dashboard that is already
     * correct. Null means the sign-in screen is showing.
     */
    private String renderedUid;
    private boolean tripsLoaded;
    private ListenerRegistration tripsListener;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        firebaseAuth = FirebaseAuth.getInstance();
        // The project's Firestore database is named "default" (no parens), not
        // the SDK's implicit "(default)" database. Without pinning this
        // explicitly, every read/write silently targets a database that
        // doesn't exist and retries forever - trips never load. Same bug and
        // same fix as app/firebase.ts on the web side.
        firestore = FirebaseFirestore.getInstance("default");
        getWindow().setStatusBarColor(Color.parseColor(SURFACE));
        getWindow().setNavigationBarColor(Color.parseColor(INK));
        setLightStatusBar(true);

        GoogleSignInOptions googleOptions = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(getString(R.string.google_web_client_id))
                .requestEmail()
                .build();
        googleClient = GoogleSignIn.getClient(this, googleOptions);
        restoreNavigationState(savedInstanceState);
        showCurrentState();
    }

    /**
     * Rotation, unfolding, and entering multi-window all destroy and recreate the
     * activity. Navigation state lives in plain fields, so without this the
     * traveler is thrown back to the trip library and the Overview tab of the
     * first trip every time the screen turns - the most common thing a device
     * with a changing aspect ratio does. Only the small navigation cursor is
     * saved; trip content itself is reloaded from Firestore and the local cache.
     */
    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putString(STATE_ACTIVE_TRIP_ID, activeTripId);
        outState.putInt(STATE_ACTIVE_DAY_INDEX, activeDayIndex);
        outState.putInt(STATE_ACTIVE_SECTION, activeSection);
        outState.putBoolean(STATE_SHOWING_TRIP_LIBRARY, showingTripLibrary);
        outState.putBoolean(STATE_SHOW_ARCHIVED_TRIPS, showArchivedTrips);
    }

    private void restoreNavigationState(Bundle savedInstanceState) {
        if (savedInstanceState == null) return;
        activeTripId = savedInstanceState.getString(STATE_ACTIVE_TRIP_ID, activeTripId);
        activeDayIndex = savedInstanceState.getInt(STATE_ACTIVE_DAY_INDEX, activeDayIndex);
        activeSection = savedInstanceState.getInt(STATE_ACTIVE_SECTION, activeSection);
        showingTripLibrary = savedInstanceState.getBoolean(STATE_SHOWING_TRIP_LIBRARY, showingTripLibrary);
        showArchivedTrips = savedInstanceState.getBoolean(STATE_SHOW_ARCHIVED_TRIPS, showArchivedTrips);
    }

    @Override
    protected void onStart() {
        super.onStart();
        showCurrentState();
    }

    @Override
    protected void onResume() {
        super.onResume();
        FirebaseUser user = firebaseAuth == null ? null : firebaseAuth.getCurrentUser();
        Trip trip = getActiveTrip();
        if (user != null && tripsLoaded && activeSection == SECTION_FLIGHTS && trip != null) {
            scheduleFlightRefresh(trip.trackedFlights());
        }
    }

    @Override
    protected void onPause() {
        stopFlightRefreshLoop();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        stopFlightRefreshLoop();
        if (tripsListener != null) {
            tripsListener.remove();
            tripsListener = null;
        }
        super.onDestroy();
    }

    private void showCurrentState() {
        FirebaseUser user = firebaseAuth == null ? null : firebaseAuth.getCurrentUser();
        String uid = user == null ? null : user.getUid();
        // Both onCreate and onStart run at launch; without this guard the
        // dashboard would render (and refetch) twice, which could also create
        // two starter itineraries for a brand-new account.
        if (screen != null && equalIds(uid, renderedUid)) return;
        if (user != null && renderedUid != null && !user.getUid().equals(renderedUid)) {
            if (tripsListener != null) {
                tripsListener.remove();
                tripsListener = null;
            }
            savedTrips.clear();
            activeTripId = "";
            activeDayIndex = 0;
            showingTripLibrary = true;
            showArchivedTrips = false;
            tripsLoaded = false;
        }
        if (user == null) {
            showLogin();
        } else {
            showDashboard(user);
        }
    }

    private void prepareScreen() {
        appRoot = new LinearLayout(this);
        appRoot.setOrientation(LinearLayout.VERTICAL);
        appRoot.setBackgroundColor(Color.parseColor(SURFACE));
        applySystemBarInsets(appRoot);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setPadding(dp(20), dp(20), dp(20), dp(32));
        screen.setBackgroundColor(Color.parseColor(SURFACE));
        scroll.addView(screen, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT, ScrollView.LayoutParams.WRAP_CONTENT));
        appRoot.addView(scroll, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(appRoot);
    }

    private void showLogin() {
        if (tripsListener != null) {
            tripsListener.remove();
            tripsListener = null;
        }
        prepareScreen();
        // Dark icons: with insets applied the status bar sits on the cream
        // surface rather than on the navy hero, so white icons were invisible.
        setLightStatusBar(true);
        renderedUid = null;
        tripsLoaded = false;
        showingTripLibrary = true;
        showArchivedTrips = false;
        savedTrips.clear();
        weatherByTrip.clear();
        authButtons.clear();

        LinearLayout hero = new LinearLayout(this);
        hero.setOrientation(LinearLayout.VERTICAL);
        hero.setPadding(dp(20), dp(28), dp(20), dp(28));
        hero.setBackgroundColor(Color.parseColor(NAVY));
        hero.addView(text("JOURNEYSYNC", 13, "#FFFFFF", true));
        hero.addView(text("Every plan.\nEvery person.\nOne journey.", 32, "#FFFFFF", true), margins(0, 14, 0, 0));
        screen.addView(hero, margins(-20, -20, -20, 30));

        TextView heading = text("SIGN IN", 12, INK, true);
        heading.setLetterSpacing(.12f);
        screen.addView(heading, margins(0, 0, 0, 8));
        screen.addView(text("Your trips stay synced across JourneySync web and Android.", 15, MUTED, false), margins(0, 0, 0, 24));

        EditText email = input("Email address", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, "");
        EditText password = input("Password", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD, "");
        screen.addView(text("EMAIL ADDRESS", 11, FAINT, true));
        screen.addView(email, margins(0, 2, 0, 14));
        screen.addView(text("PASSWORD", 11, FAINT, true));
        screen.addView(password, margins(0, 2, 0, 20));

        Button signIn = primaryButton("Sign in with email");
        signIn.setOnClickListener(v -> emailSignIn(email, password, false));
        screen.addView(signIn, margins(0, 0, 0, 10));

        Button createAccount = outlineButton("Create an account");
        createAccount.setOnClickListener(v -> emailSignIn(email, password, true));
        screen.addView(createAccount, margins(0, 0, 0, 24));

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

        TextView help = text("REAL FIREBASE LOGIN  ·  CLOUD-SYNCED TRIPS", 11, FAINT, true);
        help.setGravity(Gravity.CENTER);
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
        setLightStatusBar(true);
        renderedUid = user.getUid();
        if (tripsLoaded) {
            renderCurrentView(user);
            return;
        }
        screen.addView(text("JourneySync", 25, INK, true));
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
        if (tripsListener != null) tripsListener.remove();
        tripsListener = allTripsDoc(user).addSnapshotListener((snapshot, error) -> {
            if (!user.getUid().equals(renderedUid)) return;
            if (error != null) {
                tripsLoaded = true;
                renderCurrentView(user);
                toast("Cloud sync is unavailable. Device changes will sync when Firebase reconnects.");
                return;
            }
            if (snapshot == null) return;
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
                activeTripId = "";
            } else {
                Trip active = findTrip(activeTripId);
                if (active == null) activeTripId = savedTrips.get(0).id;
            }
            renderCurrentView(user);
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
        renderCurrentView(user);
        saveTrips(user);
    }

    private void renderCurrentView(FirebaseUser user) {
        if (showingTripLibrary) renderTripLibrary(user);
        else renderDashboard(user);
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

    private void renderTripLibrary(FirebaseUser user) {
        screen.removeAllViews();
        while (appRoot != null && appRoot.getChildCount() > 1) appRoot.removeViewAt(1);
        showingTripLibrary = true;
        stopFlightRefreshLoop();

        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.HORIZONTAL);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout title = new LinearLayout(this);
        title.setOrientation(LinearLayout.VERTICAL);
        title.addView(text("JOURNEYSYNC", 12, CORAL, true));
        title.addView(text("Your trips", 31, NAVY, true), margins(0, 5, 0, 2));
        title.addView(text("Saved to " + safeEmail(user), 13, MUTED, false));
        heading.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        Button signOut = outlineButton("Sign out");
        signOut.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        signOut.setOnClickListener(v -> signOut());
        heading.addView(signOut);
        screen.addView(heading, margins(0, 0, 0, 22));

        int activeCount = 0;
        int archivedCount = 0;
        long now = System.currentTimeMillis();
        for (Trip trip : savedTrips) {
            if (trip != null && trip.isArchived(now)) archivedCount++;
            else if (trip != null) activeCount++;
        }

        LinearLayout filters = new LinearLayout(this);
        filters.setOrientation(LinearLayout.HORIZONTAL);
        Button activeFilter = showArchivedTrips ? outlineButton("Active " + activeCount) : primaryButton("Active " + activeCount);
        Button archiveFilter = showArchivedTrips ? primaryButton("Archived " + archivedCount) : outlineButton("Archived " + archivedCount);
        activeFilter.setOnClickListener(v -> { showArchivedTrips = false; renderTripLibrary(user); });
        archiveFilter.setOnClickListener(v -> { showArchivedTrips = true; renderTripLibrary(user); });
        filters.addView(activeFilter, new LinearLayout.LayoutParams(0, dp(50), 1));
        LinearLayout.LayoutParams archiveParams = new LinearLayout.LayoutParams(0, dp(50), 1);
        archiveParams.setMargins(dp(8), 0, 0, 0);
        filters.addView(archiveFilter, archiveParams);
        screen.addView(filters, margins(0, 0, 0, 14));

        Button create = primaryButton("Create a trip");
        create.setOnClickListener(v -> showCreateTripDialog(user));
        screen.addView(create, margins(0, 0, 0, 20));

        int shown = 0;
        for (Trip trip : savedTrips) {
            if (trip == null || trip.isArchived(now) != showArchivedTrips) continue;
            shown++;
            LinearLayout tripCard = card();
            String status = trip.isCompleted(now) ? "COMPLETED" : trip.isManuallyArchived() ? "ARCHIVED" : "ACTIVE OR UPCOMING";
            tripCard.addView(text(status, 11, trip.isArchived(now) ? MUTED : GREEN, true));
            tripCard.addView(text(safeText(trip.name, "Untitled trip"), 24, NAVY, true), margins(0, 7, 0, 3));
            tripCard.addView(text(safeText(trip.route, locationLabel(trip)), 14, MUTED, false));
            tripCard.addView(text(tripDateRange(trip) + "  ·  " + Math.max(1, trip.travelersCount) + " travelers", 12, FAINT, false), margins(0, 5, 0, 14));
            if (trip.isCompleted(now)) {
                tripCard.addView(text("The trip finished, so it was archived automatically. Your itinerary is still here.", 13, MUTED, false), margins(0, 0, 0, 12));
            }

            Button open = primaryButton("Open trip");
            open.setOnClickListener(v -> {
                activeTripId = trip.id;
                activeDayIndex = 0;
                activeSection = SECTION_OVERVIEW;
                showingTripLibrary = false;
                commit(user);
            });
            tripCard.addView(open, margins(0, 0, 0, 9));

            if (!trip.isCompleted(now)) {
                Button archive = outlineButton(trip.isManuallyArchived() ? "Restore trip" : "Archive trip");
                archive.setOnClickListener(v -> {
                    trip.archivedAt = trip.isManuallyArchived() ? "" : utcTimestamp(System.currentTimeMillis());
                    if (trip.id != null && trip.id.equals(activeTripId)) showingTripLibrary = true;
                    commit(user);
                    toast(trip.isManuallyArchived() ? "Trip archived." : "Trip restored to active trips.");
                });
                tripCard.addView(archive, margins(0, 0, 0, 9));
            }

            Button delete = dangerButton("Delete permanently");
            delete.setOnClickListener(v -> confirmDeleteTrip(user, trip));
            tripCard.addView(delete);
            screen.addView(tripCard, margins(0, 0, 0, 14));
        }

        if (shown == 0) {
            LinearLayout empty = card();
            empty.addView(text(showArchivedTrips ? "No archived trips" : "No active trips", 21, NAVY, true));
            empty.addView(text(showArchivedTrips ? "Completed and manually archived trips will appear here." : "Create a trip to start planning.", 14, MUTED, false), margins(0, 6, 0, 0));
            screen.addView(empty);
        }
    }

    private void renderDashboard(FirebaseUser user) {
        screen.removeAllViews();
        while (appRoot != null && appRoot.getChildCount() > 1) appRoot.removeViewAt(1);
        Trip activeTrip = getActiveTrip();
        if (activeTrip == null) {
            showingTripLibrary = true;
            renderTripLibrary(user);
            return;
        }
        final Trip trip = activeTrip;
        Day activeDay = getActiveDay(trip);

        // Compact editorial trip header from the supplied mobile design.
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.TOP);
        LinearLayout identity = new LinearLayout(this);
        identity.setOrientation(LinearLayout.VERTICAL);
        int dayCount = trip.days == null ? 0 : trip.days.size();
        TextView meta = text("CURRENT TRIP  ·  " + dayCount + " DAYS  ·  " + trip.travelersCount + " TRAVELERS", 11, FAINT, true);
        meta.setLetterSpacing(.08f);
        identity.addView(meta);
        identity.addView(text(safeText(trip.name, "YOUR JOURNEY"), 28, INK, true), margins(0, 7, 0, 4));
        identity.addView(text(safeText(trip.route, locationLabel(trip)) + "  ·  " + tripDateRange(trip), 13, MUTED, false));
        top.addView(identity, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        Button menu = squareButton("+");
        menu.setContentDescription("Journey and feature menu");
        menu.setOnClickListener(v -> showUtilityMenu(user, trip));
        top.addView(menu, new LinearLayout.LayoutParams(dp(44), dp(44)));
        screen.addView(top, margins(0, 2, 0, 14));

        View headerRule = new View(this);
        headerRule.setBackgroundColor(Color.parseColor(INK));
        screen.addView(headerRule, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(2)));
        screen.addView(text("CLOUD SYNC ACTIVE  ·  " + safeEmail(user), 10, GREEN, true), margins(0, 9, 0, 22));

        if (activeSection == SECTION_OVERVIEW) renderOverview(user, trip);
        else if (activeSection == SECTION_FLIGHTS) renderFlightTracker(user, trip);
        else if (activeSection == SECTION_MAP) renderMap(user, trip);
        else if (activeSection == SECTION_EXPENSES) renderExpenses(user, trip);
        else if (activeSection == SECTION_WALLET) renderWallet(user, trip);
        else if (activeSection == SECTION_TRAVELERS) renderTravelers(user, trip);
        else if (activeSection == SECTION_GUEST_FLIGHTS) renderGuestFlights(user, trip);
        else renderItinerary(user, trip, activeDay);

        addBottomNavigation(user);
    }

    private void renderEmptyDashboard(FirebaseUser user) {
        screen.addView(text("JOURNEYSYNC", 13, CORAL, true));
        screen.addView(text("Create your first trip", 30, INK, true), margins(0, 18, 0, 8));
        screen.addView(text("Build any itinerary you want. Days, activities, flights, expenses, passes, places, and travelers will be saved to your Firebase profile.",
                15, MUTED, false), margins(0, 0, 0, 24));

        Button create = primaryButton("Create an itinerary");
        create.setOnClickListener(v -> showCreateTripDialog(user));
        screen.addView(create, margins(0, 0, 0, 12));

        Button signOut = outlineButton("Sign out");
        signOut.setOnClickListener(v -> {
            firebaseAuth.signOut();
            googleClient.signOut();
            activeSection = SECTION_OVERVIEW;
            activeDayIndex = 0;
            showLogin();
        });
        screen.addView(signOut);
    }

    private void addBottomNavigation(FirebaseUser user) {
        LinearLayout nav = new LinearLayout(this);
        nav.setOrientation(LinearLayout.HORIZONTAL);
        nav.setBackgroundColor(Color.parseColor(SURFACE));
        GradientDrawable border = new GradientDrawable();
        border.setColor(Color.parseColor(SURFACE));
        border.setStroke(dp(2), Color.parseColor(INK));
        nav.setBackground(border);

        // Labels and glyphs mirror the website's sidebar. The tabs previously read
        // "1 TODAY / 2 PLAN / 3 ROUTE / 4 SPLIT / 5 WALLET", which hid the map
        // behind a number and a synonym. Flights gets a tab of its own rather
        // than living only behind an overview link.
        String[] glyphs = {"⌂", "≡", "✈", "◇", "¤", "▣"};
        String[] labels = {"Overview", "Plan", "Flights", "Map", "Expenses", "Wallet"};
        int[] sections = {SECTION_OVERVIEW, SECTION_ITINERARY, SECTION_FLIGHTS, SECTION_MAP, SECTION_EXPENSES, SECTION_WALLET};
        int selected = activeSection;
        if (selected == SECTION_GUEST_FLIGHTS || selected == SECTION_TRAVELERS) {
            selected = SECTION_OVERVIEW;
        }
        for (int i = 0; i < labels.length; i++) {
            final int section = sections[i];
            LinearLayout item = navItem(glyphs[i], labels[i], section == selected, () -> {
                activeSection = section;
                renderDashboard(user);
            });
            item.setMinimumHeight(dp(66));
            nav.addView(item, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        }
        // The bar keeps its 68dp look on default settings but measures to its
        // content, because the glyph and caption inside are sized in sp. Pinned
        // to an exact height the tabs were cropped mid-glyph once a traveler
        // raised the system font size.
        nav.setMinimumHeight(dp(68));
        appRoot.addView(nav, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
    }

    private void renderOverview(FirebaseUser user, Trip trip) {
        screen.addView(sectionLabel("TODAY"), margins(0, 0, 0, 12));
        List<Trip.TrackedFlight> flights = trip.trackedFlights();
        if (!flights.isEmpty()) {
            Trip.TrackedFlight next = flights.get(0);
            FlightInfo flight = next.event.flight;
            LinearLayout agenda = card();
            agenda.addView(text("●  NOW  ·  NEXT FLIGHT", 11, BLUE, true), margins(0, 0, 0, 12));
            agenda.addView(text(flight == null ? safeText(next.event.time, "TBD") : safeText(flight.estimatedDeparture, "TBD"), 40, INK, true));
            agenda.addView(text(flight == null ? safeText(next.event.title, "Flight") : flight.displayTitle(), 21, INK, true), margins(0, 3, 0, 3));
            agenda.addView(text(flight == null ? safeText(next.event.meta, "") : flight.displayMeta(), 13, MUTED, false), margins(0, 0, 0, 16));
            String gate = flight == null ? FlightInfo.UNKNOWN : flight.gate;
            String delay = flight != null && flight.isDelayed() ? flight.delayMinutes + " MIN" : "ON TIME";
            agenda.addView(factRow("STATUS", safeText(next.event.status, "Scheduled").toUpperCase(), flight != null && flight.isDelayed() ? CORAL : GREEN,
                    "GATE", gate, INK));
            agenda.addView(factRow("CHECK-IN", flight == null ? FlightInfo.UNKNOWN : flight.departureTerminal,
                    INK, "DELAY", delay, flight != null && flight.isDelayed() ? CORAL : GREEN), margins(0, 13, 0, 16));
            Button boarding = primaryButton("VIEW LIVE FLIGHT DETAILS");
            boarding.setOnClickListener(v -> showFlightDetailsDialog(user, next.event));
            agenda.addView(boarding);
            screen.addView(agenda, margins(0, 0, 0, 24));
        } else {
            LinearLayout emptyAgenda = card();
            emptyAgenda.addView(text("NO FLIGHT ON DECK", 11, FAINT, true));
            emptyAgenda.addView(text("Add a flight to see live timing, gates, and delays here.", 19, INK, true), margins(0, 8, 0, 14));
            Button track = primaryButton("TRACK A FLIGHT");
            track.setOnClickListener(v -> {
                activeSection = SECTION_FLIGHTS;
                renderDashboard(user);
            });
            emptyAgenda.addView(track);
            screen.addView(emptyAgenda, margins(0, 0, 0, 24));
        }

        renderWeatherCard(user, trip);

        screen.addView(sectionLabel("TRAVEL TOOLS"), margins(0, 0, 0, 8));
        screen.addView(sectionLink("FLIGHT TRACKER", "Live gates, terminals, timing and delay status", () -> {
            activeSection = SECTION_FLIGHTS;
            renderDashboard(user);
        }));
        screen.addView(sectionLink("GUEST FLIGHT WATCH", "Track friends and family with live flight updates", () -> {
            activeSection = SECTION_GUEST_FLIGHTS;
            renderDashboard(user);
        }));
        screen.addView(sectionLink("TRAVELERS", "Invite and manage everyone on this trip", () -> {
            activeSection = SECTION_TRAVELERS;
            renderDashboard(user);
        }), margins(0, 0, 0, 22));

        screen.addView(sectionLabel("TRIP SUMMARY"), margins(0, 0, 0, 10));
        LinearLayout summary = card();
        int activities = 0;
        if (trip.days != null) for (Day day : trip.days) if (day != null && day.events != null) activities += day.events.size();
        summary.addView(factRow("ACTIVITIES", String.valueOf(activities), INK,
                "FLIGHTS", flights.size() + " YOURS · " + (trip.guestFlights == null ? 0 : trip.guestFlights.size()) + " GUEST", BLUE));
        summary.addView(factRow("YOU ARE TRACKING", money(expenseCurrency(trip), trip.unsettledExpenses()), INK,
                "WALLET", String.valueOf(trip.walletDocs == null ? 0 : trip.walletDocs.size()) + " DOCUMENTS", INK), margins(0, 14, 0, 0));
        screen.addView(summary);
    }

    private void renderWeatherCard(FirebaseUser user, Trip trip) {
        if (trip == null || trip.city == null || trip.city.trim().isEmpty()) return;
        screen.addView(sectionLabel("LIVE WEATHER"), margins(0, 0, 0, 10));
        LinearLayout weather = card();
        WeatherSnapshot snapshot = weatherByTrip.get(trip.id);
        if (snapshot == null) {
            weather.addView(text("Loading weather for " + locationLabel(trip) + "…", 15, MUTED, false));
            if (!weatherLoading.contains(trip.id)) fetchWeather(user, trip);
        } else if (snapshot.error != null) {
            weather.addView(text("Weather is unavailable", 19, NAVY, true));
            weather.addView(text(snapshot.error, 13, MUTED, false), margins(0, 5, 0, 10));
        } else {
            weather.addView(text(snapshot.destination, 19, NAVY, true));
            weather.addView(text(snapshot.day + "  ·  " + snapshot.description, 13, MUTED, false), margins(0, 3, 0, 8));
            weather.addView(text(snapshot.icon + "  " + snapshot.high + " / " + snapshot.low, 28, NAVY, true));
            weather.addView(text("Precipitation " + snapshot.rain + "  ·  Live from " + snapshot.source, 12, FAINT, false), margins(0, 5, 0, 10));
        }
        Button refresh = outlineButton("Refresh weather");
        refresh.setOnClickListener(v -> {
            weatherByTrip.remove(trip.id);
            fetchWeather(user, trip);
            renderDashboard(user);
        });
        weather.addView(refresh);
        screen.addView(weather, margins(0, 0, 0, 24));
    }

    private void fetchWeather(FirebaseUser user, Trip trip) {
        if (trip == null || trip.id == null || weatherLoading.contains(trip.id)) return;
        weatherLoading.add(trip.id);
        final String tripId = trip.id;
        Uri uri = Uri.parse(BuildConfig.FLIGHT_API_BASE_URL + "/api/weather").buildUpon()
                .appendQueryParameter("city", safeText(trip.city, ""))
                .appendQueryParameter("region", safeText(trip.region, ""))
                .appendQueryParameter("country", safeText(trip.country, ""))
                .appendQueryParameter("countryCode", safeText(trip.countryCode, ""))
                .appendQueryParameter("refresh", String.valueOf(System.currentTimeMillis()))
                .build();
        new Thread(() -> {
            HttpURLConnection connection = null;
            WeatherSnapshot result = new WeatherSnapshot();
            try {
                connection = (HttpURLConnection) new URL(uri.toString()).openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(15_000);
                connection.setReadTimeout(25_000);
                connection.setUseCaches(false);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0");
                connection.setRequestProperty("Pragma", "no-cache");
                int status = connection.getResponseCode();
                InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
                JSONObject response = new JSONObject(readResponse(stream));
                if (status < 200 || status >= 300) throw new IllegalStateException(response.optString("error", "Live weather could not be loaded."));
                JSONArray days = response.optJSONArray("days");
                if (days == null || days.length() == 0) throw new IllegalStateException("No forecast is available for this city.");
                JSONObject day = days.getJSONObject(0);
                result.destination = response.optString("destination", trip.city);
                result.day = day.optString("day", "Today");
                result.high = day.optString("high", "TBD");
                result.low = day.optString("low", "TBD");
                result.rain = day.optString("rain", "TBD");
                result.icon = day.optString("icon", "");
                result.description = day.optString("desc", "Live conditions");
                result.source = response.optString("source", "JourneySync weather");
            } catch (Exception error) {
                result.error = error.getMessage() == null ? "Live weather could not be loaded." : error.getMessage();
            } finally {
                if (connection != null) connection.disconnect();
            }
            runOnUiThread(() -> {
                weatherLoading.remove(tripId);
                weatherByTrip.put(tripId, result);
                if (!showingTripLibrary && tripId.equals(activeTripId) && activeSection == SECTION_OVERVIEW) renderDashboard(user);
            });
        }).start();
    }

    /**
     * Builds a Leaflet/OpenStreetMap page for the pins that carry coordinates.
     * Mirrors the web TripMap component, and needs no API key or billing the
     * way the Google Maps SDK would. Coordinates are emitted as a JSON array
     * rather than interpolated into JS statements so a quote in a pin name
     * cannot break the script.
     */
    private String tripMapHtml(List<MapPin> pins) {
        StringBuilder markers = new StringBuilder("[");
        boolean first = true;
        for (MapPin pin : pins) {
            if (pin == null || !pin.hasCoordinates()) continue;
            if (!first) markers.append(',');
            first = false;
            markers.append("{\"lat\":").append(pin.latitude)
                    .append(",\"lon\":").append(pin.longitude)
                    .append(",\"name\":").append(JSONObject.quote(safeText(pin.name, "Destination")))
                    .append(",\"desc\":").append(JSONObject.quote(safeText(pin.desc, "")))
                    .append('}');
        }
        markers.append(']');

        return "<!doctype html><html><head><meta charset='utf-8'>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1,maximum-scale=1'>"
                + "<link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'/>"
                + "<style>html,body,#map{height:100%;margin:0;background:" + CREAM + ";}"
                + ".leaflet-container{font-family:sans-serif;}</style></head><body><div id='map'></div>"
                + "<script src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'></script><script>"
                + "var pts=" + markers + ";"
                + "var map=L.map('map',{zoomControl:true,attributionControl:false});"
                + "L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(map);"
                + "if(pts.length){var g=[];pts.forEach(function(p){"
                + "var m=L.marker([p.lat,p.lon]).addTo(map);"
                + "m.bindPopup('<b>'+p.name+'</b>'+(p.desc?'<br>'+p.desc:''));g.push([p.lat,p.lon]);});"
                + "if(g.length>1){map.fitBounds(g,{padding:[30,30]});}else{map.setView(g[0],11);}"
                + "if(g.length>1){L.polyline(g,{color:'" + CORAL + "',weight:3,opacity:.7}).addTo(map);}"
                + "}else{map.setView([20,0],1);}"
                + "</script></body></html>";
    }

    private void renderMap(FirebaseUser user, Trip trip) {
        screen.addView(sectionLabel("MAP"), margins(0, 0, 0, 8));

        List<MapPin> located = new ArrayList<>();
        if (trip.mapPins != null) {
            for (MapPin pin : trip.mapPins) {
                if (pin != null && pin.hasCoordinates()) located.add(pin);
            }
        }
        if (!located.isEmpty()) {
            WebView map = new WebView(this);
            WebSettings settings = map.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            map.setBackgroundColor(Color.parseColor(CREAM));
            GradientDrawable frame = new GradientDrawable();
            frame.setColor(Color.parseColor(CREAM));
            frame.setCornerRadius(dp(RADIUS_DP));
            map.setBackground(frame);
            map.setClipToOutline(true);
            map.loadDataWithBaseURL("https://tile.openstreetmap.org/", tripMapHtml(located),
                    "text/html", "utf-8", null);
            LinearLayout.LayoutParams mapParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, tripMapHeightPx());
            mapParams.bottomMargin = dp(16);
            screen.addView(map, mapParams);
        }

        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.HORIZONTAL);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        heading.addView(text("PLACES", 25, INK, true), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
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
        screen.addView(sectionLabel("EXPENSES"), margins(0, 0, 0, 8));
        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.HORIZONTAL);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        heading.addView(text("EXPENSES", 25, INK, true), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
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
        screen.addView(sectionLabel("WALLET"), margins(0, 0, 0, 8));
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
        screen.addView(sectionLabel("TRIP PEOPLE"), margins(0, 0, 0, 8));
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
        screen.addView(sectionLabel("FRIENDS & FAMILY"), margins(0, 0, 0, 8));
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
            guestCard.addView(text(flight.origin + " → " + flight.destination + " · Gates " + flight.gate + " → " + flight.arrivalGate, 14, MUTED, false), margins(0, 4, 0, 10));
            guestCard.addView(factRow("DEPARTURE", flight.estimatedDeparture, INK,
                    "ARRIVAL", flight.estimatedArrival, INK));
            guestCard.addView(factRow("TERMINALS", flight.departureTerminal + " → " + flight.arrivalTerminal, INK,
                    "DELAY", guest.isDelayed() ? flight.delayMinutes + " min" : "None", guest.isDelayed() ? CORAL : GREEN), margins(0, 12, 0, 12));
            LinearLayout actions = new LinearLayout(this);
            actions.setOrientation(LinearLayout.HORIZONTAL);
            Button live = outlineButton("↻ Live update");
            live.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            live.setOnClickListener(v -> refreshLiveFlight(user, null, guest));
            actions.addView(live, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
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
        screen.addView(sectionLabel("PLAN"), margins(0, 0, 0, 8));
        LinearLayout titleRow = new LinearLayout(this);
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        titleRow.addView(text("ITINERARY", 25, INK, true), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        Button addDay = primaryButton("+ DAY");
        addDay.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        addDay.setMinHeight(dp(40));
        addDay.setOnClickListener(v -> showAddDayDialog(user, trip));
        titleRow.addView(addDay);
        screen.addView(titleRow, margins(0, 0, 0, 14));

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
                dayBtn.setText((d != null ? d.shortName : "DAY") + "\n" + (d != null ? d.date : String.valueOf(i + 1)));
                dayBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
                dayBtn.setAllCaps(true);
                dayBtn.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
                GradientDrawable bg = new GradientDrawable();
                bg.setCornerRadius(0);
                if (i == activeDayIndex) {
                    bg.setColor(Color.parseColor(INK));
                    dayBtn.setTextColor(Color.WHITE);
                } else {
                    bg.setColor(Color.parseColor(SURFACE));
                    bg.setStroke(dp(1), Color.parseColor(INK));
                    dayBtn.setTextColor(Color.parseColor(MUTED));
                }
                dayBtn.setBackground(bg);
                dayBtn.setPadding(dp(10), dp(7), dp(10), dp(7));
                dayBtn.setOnClickListener(v -> {
                    activeDayIndex = idx;
                    renderDashboard(user);
                });
                LinearLayout.LayoutParams dayParams = new LinearLayout.LayoutParams(dp(78), dp(64));
                dayParams.rightMargin = dp(6);
                dayTabs.addView(dayBtn, dayParams);
            }
        }
        dayScroll.addView(dayTabs);
        screen.addView(dayScroll, margins(0, 0, 0, 12));

        // Day Management Buttons
        LinearLayout dayActions = new LinearLayout(this);
        dayActions.setOrientation(LinearLayout.HORIZONTAL);
        Button renameDayBtn = outlineButton("RENAME DAY");
        renameDayBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        renameDayBtn.setOnClickListener(v -> showRenameDayDialog(user, trip, activeDay));
        dayActions.addView(renameDayBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        View gapDay = new View(this);
        dayActions.addView(gapDay, new LinearLayout.LayoutParams(dp(8), 1));

        Button delDayBtn = dangerButton("DELETE DAY");
        delDayBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        delDayBtn.setOnClickListener(v -> confirmDeleteDay(user, trip));
        dayActions.addView(delDayBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        screen.addView(dayActions, margins(0, 0, 0, 24));

        // Activities Section
        String dayHeader = activeDay != null
                ? ("DAY " + (activeDayIndex + 1) + "  ·  " + activeDay.label)
                : "DAY ACTIVITIES";
        screen.addView(text(dayHeader, 18, INK, true), margins(0, 0, 0, 10));

        Button addEvBtn = primaryButton("ADD ACTIVITY TO DAY " + (activeDayIndex + 1));
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

    private void refreshLiveFlight(FirebaseUser user, DayEvent event, GuestFlight guest) {
        refreshLiveFlight(user, event, guest, false);
    }

    private void refreshLiveFlight(FirebaseUser user, DayEvent event, GuestFlight guest, boolean background) {
        FlightInfo flight = event != null ? event.requireFlight() : guest == null ? null : guest.flight;
        if (flight == null) {
            if (!background) toast("This flight has no saved details yet.");
            return;
        }
        if (flight.departureDate == null || flight.departureDate.trim().isEmpty()) {
            if (!background) toast("Add the local departure date before requesting a live update.");
            return;
        }
        String refreshKey = refreshKey(flight);
        synchronized (liveRefreshes) {
            if (liveRefreshes.contains(refreshKey)) return;
            liveRefreshes.add(refreshKey);
        }

        if (!background) toast("Checking live flight data for " + flight.number + "…");
        user.getIdToken(false).addOnSuccessListener(tokenResult -> new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(BuildConfig.FLIGHT_API_BASE_URL + "/api/flights/status");
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(15_000);
                connection.setReadTimeout(25_000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Authorization", "Bearer " + tokenResult.getToken());
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setRequestProperty("Accept", "application/json");

                JSONObject request = new JSONObject();
                request.put("flightNumber", flight.number);
                request.put("departureDate", flight.departureDate);
                request.put("origin", flight.origin);
                request.put("destination", flight.destination);
                byte[] payload = request.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(payload);
                }

                int statusCode = connection.getResponseCode();
                InputStream stream = statusCode >= 200 && statusCode < 300
                        ? connection.getInputStream() : connection.getErrorStream();
                JSONObject response = new JSONObject(readResponse(stream));
                if (statusCode < 200 || statusCode >= 300) {
                    throw new IllegalStateException(response.optString("error", "Live flight data could not be refreshed."));
                }

                JSONObject liveFlight = response.getJSONObject("flight");
                String liveStatus = response.optString("status", "On time");
                clearRefreshBackoff(refreshKey);
                runOnUiThread(() -> {
                    applyLiveFlight(flight, liveFlight);
                    if (event != null) {
                        event.status = liveStatus;
                        event.title = flight.displayTitle();
                        event.time = flight.estimatedDeparture;
                        event.meta = flight.displayMeta();
                    }
                    if (guest != null) guest.status = liveStatus;
                    commit(user);
                    if (!background) toast(flight.number + " refreshed from " + sourceLabel(flight));
                });
            } catch (Exception error) {
                recordRefreshFailure(refreshKey);
                String message = error.getMessage() == null || error.getMessage().trim().isEmpty()
                        ? "Live flight data could not be refreshed." : error.getMessage();
                if (!background) runOnUiThread(() -> toast(message));
            } finally {
                if (connection != null) connection.disconnect();
                synchronized (liveRefreshes) {
                    liveRefreshes.remove(refreshKey);
                }
            }
        }).start()).addOnFailureListener(error -> {
            synchronized (liveRefreshes) {
                liveRefreshes.remove(refreshKey);
            }
            recordRefreshFailure(refreshKey);
            if (!background) toast("Firebase could not authorize the live update.");
        });
    }

    /**
     * Picks at most one flight to refresh per tick. Flights serving a backoff
     * after a failed attempt are skipped so a single unrecognised flight number
     * cannot starve the others out of ever being refreshed.
     */
    private void refreshStaleTrackedFlight(FirebaseUser user, List<Trip.TrackedFlight> flights) {
        for (Trip.TrackedFlight tracked : flights) {
            FlightInfo flight = tracked == null || tracked.event == null ? null : tracked.event.flight;
            if (flight == null) continue;
            if (!shouldAutoRefresh(tracked.event.status, flight.lastUpdatedUtc)) continue;
            if (!canAttemptRefresh(refreshKey(flight))) continue;
            refreshLiveFlight(user, tracked.event, null, true);
            return; // One request per tick protects the provider quota.
        }
    }

    /**
     * Starts the tracker's polling loop, or adopts the latest flight list if it
     * is already running. Re-rendering must not fire a request: a refresh calls
     * commit(), which re-renders, which lands back here, so restarting the loop
     * on every render would let a flight that always reads as stale drive an
     * unbounded request cycle.
     */
    private void scheduleFlightRefresh(List<Trip.TrackedFlight> flights) {
        liveRefreshFlights = flights;
        if (liveRefreshLoop != null) return;
        liveRefreshLoop = new Runnable() {
            @Override public void run() {
                FirebaseUser current = firebaseAuth == null ? null : firebaseAuth.getCurrentUser();
                if (current == null || isFinishing() || activeSection != SECTION_FLIGHTS) {
                    liveRefreshLoop = null; // Let a later visit start a fresh loop.
                    return;
                }
                refreshStaleTrackedFlight(current, liveRefreshFlights);
                liveRefreshHandler.postDelayed(this, REFRESH_TICK_MS);
            }
        };
        liveRefreshHandler.post(liveRefreshLoop);
    }

    private void stopFlightRefreshLoop() {
        if (liveRefreshLoop != null) {
            liveRefreshHandler.removeCallbacks(liveRefreshLoop);
            liveRefreshLoop = null;
        }
    }

    private static String refreshKey(FlightInfo flight) {
        return safeText(flight.number, "flight") + "|" + safeText(flight.departureDate, "");
    }

    private boolean canAttemptRefresh(String key) {
        synchronized (liveRefreshThrottles) {
            RefreshThrottle throttle = liveRefreshThrottles.get(key);
            return throttle == null || System.currentTimeMillis() >= throttle.nextAttemptAt;
        }
    }

    private void clearRefreshBackoff(String key) {
        synchronized (liveRefreshThrottles) {
            liveRefreshThrottles.remove(key);
        }
    }

    private void recordRefreshFailure(String key) {
        synchronized (liveRefreshThrottles) {
            RefreshThrottle throttle = liveRefreshThrottles.get(key);
            if (throttle == null) {
                throttle = new RefreshThrottle();
                liveRefreshThrottles.put(key, throttle);
            }
            throttle.failures++;
            throttle.nextAttemptAt = System.currentTimeMillis() + backoffMillis(throttle.failures);
        }
    }

    /** Doubles from one minute per consecutive failure, capped at half an hour. */
    static long backoffMillis(int failures) {
        int steps = Math.max(1, Math.min(failures, 16));
        long minutes = Math.min(1L << (steps - 1), 30L);
        return minutes * 60_000L;
    }

    /** Backoff state for one flight, so failures stop hammering the provider. */
    private static class RefreshThrottle {
        long nextAttemptAt;
        int failures;
    }

    static boolean shouldAutoRefresh(String status, String lastUpdatedUtc) {
        if (lastUpdatedUtc == null || lastUpdatedUtc.trim().isEmpty()) return true;
        long updatedAt = parseIsoUtc(lastUpdatedUtc);
        if (updatedAt <= 0) return true;
        String normalized = status == null ? "" : status.trim().toLowerCase(Locale.US);
        long intervalMinutes;
        if (normalized.contains("delay") || normalized.contains("board")) intervalMinutes = 2;
        else if (normalized.contains("depart") || normalized.contains("airborne")) intervalMinutes = 5;
        else if (normalized.contains("land") || normalized.contains("cancel")) intervalMinutes = 360;
        else intervalMinutes = 15;
        return System.currentTimeMillis() - updatedAt >= intervalMinutes * 60_000L;
    }

    /**
     * Reads the timestamp shapes the flight endpoint can return, including
     * AeroDataBox's own "2026-08-10 20:11Z" form. Deliberately avoids the
     * SimpleDateFormat "X" pattern letter, which needs API 24 and would throw
     * on this app's minSdk of 23, leaving every flight looking permanently
     * stale. Returns -1 when nothing usable is present.
     */
    static long parseIsoUtc(String value) {
        if (value == null) return -1L;
        Matcher match = TIMESTAMP.matcher(value.trim());
        if (!match.matches()) return -1L;
        Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"), Locale.US);
        calendar.clear();
        calendar.setLenient(false);
        calendar.set(
                Integer.parseInt(match.group(1)), Integer.parseInt(match.group(2)) - 1, Integer.parseInt(match.group(3)),
                Integer.parseInt(match.group(4)), Integer.parseInt(match.group(5)),
                match.group(6) == null ? 0 : Integer.parseInt(match.group(6)));
        if (match.group(7) != null) {
            String fraction = (match.group(7) + "00").substring(0, 3);
            calendar.set(Calendar.MILLISECOND, Integer.parseInt(fraction));
        }
        long epochMillis;
        try {
            epochMillis = calendar.getTimeInMillis();
        } catch (Exception invalidDate) {
            return -1L;
        }
        String zone = match.group(8);
        if (zone != null && !"Z".equalsIgnoreCase(zone)) {
            String digits = zone.substring(1).replace(":", "");
            long offset = (Long.parseLong(digits.substring(0, 2)) * 60L
                    + Long.parseLong(digits.substring(2))) * 60_000L;
            epochMillis += zone.charAt(0) == '-' ? offset : -offset;
        }
        return epochMillis;
    }

    /** Writes the canonical shape parseIsoUtc reads back, in UTC. */
    static String utcTimestamp(long epochMillis) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date(epochMillis));
    }

    private void applyLiveFlight(FlightInfo target, JSONObject source) {
        target.number = source.optString("number", target.number);
        target.airline = source.optString("airline", target.airline);
        target.origin = source.optString("origin", target.origin);
        target.destination = source.optString("destination", target.destination);
        target.departureDate = source.optString("departureDate", target.departureDate);
        target.departureTerminal = source.optString("departureTerminal", FlightInfo.UNKNOWN);
        target.arrivalTerminal = source.optString("arrivalTerminal", FlightInfo.UNKNOWN);
        target.gate = source.optString("gate", FlightInfo.UNKNOWN);
        target.arrivalGate = source.optString("arrivalGate", FlightInfo.UNKNOWN);
        target.scheduledDeparture = source.optString("scheduledDeparture", target.scheduledDeparture);
        target.estimatedDeparture = source.optString("estimatedDeparture", target.estimatedDeparture);
        target.scheduledArrival = source.optString("scheduledArrival", target.scheduledArrival);
        target.estimatedArrival = source.optString("estimatedArrival", target.estimatedArrival);
        target.delayMinutes = Math.max(0, source.optInt("delayMinutes", 0));
        target.baggageClaim = source.optString("baggageClaim", FlightInfo.UNKNOWN);
        target.lastUpdated = source.optString("lastUpdated", "Live just now");
        // Stamp the refresh locally when the server's timestamp is missing or in a
        // shape we cannot read, so the flight does not read as stale forever.
        String updatedUtc = source.optString("lastUpdatedUtc", "");
        target.lastUpdatedUtc = parseIsoUtc(updatedUtc) > 0 ? updatedUtc : utcTimestamp(System.currentTimeMillis());
        target.source = source.optString("source", "AeroDataBox");
    }

    private String readResponse(InputStream stream) throws Exception {
        if (stream == null) return "{}";
        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
        }
        return body.toString();
    }

    private void renderFlightTracker(FirebaseUser user, Trip trip) {
        screen.addView(text("TRIP OPERATIONS", 12, FAINT, true), margins(0, 0, 0, 4));
        screen.addView(text("Flight Tracker", 22, INK, true), margins(0, 0, 0, 4));
        screen.addView(text("Search live flight information, then keep gate, terminal, timing, delay, and baggage details with your itinerary.",
                14, MUTED, false), margins(0, 0, 0, 14));

        LinearLayout liveFinder = card();
        liveFinder.addView(text("Live flight information", 18, INK, true));
        liveFinder.addView(text("Search by flight number and departure airport, or by route. Then choose the correct live result from a dropdown.",
                13, MUTED, false), margins(0, 4, 0, 12));
        Button liveSearch = primaryButton("Search live flights");
        liveSearch.setOnClickListener(v -> showLiveFlightSearchDialog(user, trip));
        liveFinder.addView(liveSearch);
        screen.addView(liveFinder, margins(0, 0, 0, 14));

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
            scheduleFlightRefresh(flights);
        }

        screen.addView(text("Status-aware refresh is automatic while this tracker is open. Delayed and boarding flights refresh most often; every result is saved to Firebase.",
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
        flightCard.addView(factRow("GATES", flight != null ? flight.gate + " → " + flight.arrivalGate : FlightInfo.UNKNOWN, INK,
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

        Button liveBtn = outlineButton("↻ Live update");
        liveBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        liveBtn.setPadding(dp(12), dp(8), dp(12), dp(8));
        liveBtn.setOnClickListener(v -> refreshLiveFlight(user, event, null));
        actions.addView(liveBtn, margins(0, 0, 8, 0));

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

    /** Searches the protected JourneySync endpoint by route/date or by flight code. */
    private void showLiveFlightSearchDialog(FirebaseUser user, Trip trip) {
        LinearLayout form = formContainer();
        Spinner mode = new Spinner(this);
        ArrayAdapter<String> modeAdapter = new ArrayAdapter<>(this,
                android.R.layout.simple_spinner_item,
                new String[]{"Flight number + departure airport", "From and to airports"});
        modeAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        mode.setAdapter(modeAdapter);

        EditText origin = input("Departure airport (e.g. ATL)", InputType.TYPE_CLASS_TEXT, "");
        EditText destination = input("Arrival airport (e.g. LAX)", InputType.TYPE_CLASS_TEXT, "");
        EditText flightNumber = input("Flight number (e.g. DL 0055)", InputType.TYPE_CLASS_TEXT, "");
        EditText date = input("YYYY-MM-DD", InputType.TYPE_CLASS_DATETIME, safeText(trip.startDate, ""));
        LinearLayout numberGroup = fieldGroup("Airline and flight number", flightNumber);
        LinearLayout originGroup = fieldGroup("Departure airport", origin);
        LinearLayout destinationGroup = fieldGroup("Arrival airport", destination);

        form.addView(text("SEARCH USING", 12, MUTED, true), margins(0, 0, 0, 4));
        form.addView(mode, margins(0, 0, 0, 12));
        form.addView(numberGroup);
        form.addView(originGroup);
        form.addView(destinationGroup);
        addField(form, "Local departure date", date);
        TextView guidance = text("Enter the flight number and where it leaves from. JourneySync will fill the destination, airline, times, gates, terminals, delay, baggage, and live status.",
                12, FAINT, false);
        form.addView(guidance, margins(0, 5, 0, 0));

        mode.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                boolean routeSearch = position == 1;
                numberGroup.setVisibility(routeSearch ? View.GONE : View.VISIBLE);
                destinationGroup.setVisibility(routeSearch ? View.VISIBLE : View.GONE);
                guidance.setText(routeSearch
                        ? "Enter both airports and a date, then choose the correct live flight from the results dropdown."
                        : "Enter the flight number and where it leaves from. JourneySync will auto-fill all live operational details.");
            }

            @Override public void onNothingSelected(AdapterView<?> parent) { }
        });

        new AlertDialog.Builder(this)
                .setTitle("Live flight information")
                .setView(scrollable(form))
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Search live flights", (dialog, which) -> {
                    boolean routeSearch = mode.getSelectedItemPosition() == 1;
                    String dateValue = date.getText().toString().trim();
                    String originValue = origin.getText().toString().trim().toUpperCase();
                    String destinationValue = destination.getText().toString().trim().toUpperCase();
                    String numberValue = normalizeFlightCodeInput(flightNumber.getText().toString());
                    if (!dateValue.matches("\\d{4}-\\d{2}-\\d{2}")) {
                        toast("Enter the departure date as YYYY-MM-DD.");
                        return;
                    }
                    if (routeSearch && (!originValue.matches("[A-Z]{3}") || !destinationValue.matches("[A-Z]{3}"))) {
                        toast("Enter three-letter from and to airport codes.");
                        return;
                    }
                    if (!routeSearch && !originValue.matches("[A-Z]{3}")) {
                        toast("Enter the three-letter departure airport, such as ATL.");
                        return;
                    }
                    if (!routeSearch && !numberValue.matches("[A-Z0-9]{2,8}")) {
                        toast("Enter an airline and flight number, such as DL 0055.");
                        return;
                    }
                    requestLiveFlightSearch(user, trip, routeSearch, originValue, destinationValue, numberValue, dateValue);
                })
                .show();
    }

    private void requestLiveFlightSearch(FirebaseUser user, Trip trip, boolean routeSearch,
                                         String origin, String destination, String number, String date) {
        toast("Checking live flight information…");
        user.getIdToken(false).addOnSuccessListener(tokenResult -> new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(BuildConfig.FLIGHT_API_BASE_URL + "/api/flights/status");
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(15_000);
                connection.setReadTimeout(35_000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Authorization", "Bearer " + tokenResult.getToken());
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setRequestProperty("Accept", "application/json");

                JSONObject request = new JSONObject();
                request.put("searchMode", routeSearch ? "route" : "number");
                request.put("departureDate", date);
                request.put("origin", origin);
                request.put("destination", destination);
                request.put("flightNumber", number);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(request.toString().getBytes(StandardCharsets.UTF_8));
                }

                int statusCode = connection.getResponseCode();
                InputStream stream = statusCode >= 200 && statusCode < 300
                        ? connection.getInputStream() : connection.getErrorStream();
                JSONObject response = new JSONObject(readResponse(stream));
                if (statusCode < 200 || statusCode >= 300) {
                    throw new IllegalStateException(response.optString("error", "Live flight search failed."));
                }

                List<JSONObject> results = new ArrayList<>();
                JSONArray flights = response.optJSONArray("flights");
                if (flights != null) {
                    for (int index = 0; index < flights.length(); index++) results.add(flights.getJSONObject(index));
                }
                if (results.isEmpty() && response.optJSONObject("flight") != null) results.add(response);
                if (results.isEmpty()) throw new IllegalStateException("No matching flights were returned.");
                runOnUiThread(() -> showLiveFlightSearchResults(user, trip, results));
            } catch (Exception error) {
                String message = error.getMessage() == null || error.getMessage().trim().isEmpty()
                        ? "Live flight search failed." : error.getMessage();
                runOnUiThread(() -> toast(message));
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start()).addOnFailureListener(error -> toast("Firebase could not authorize the live flight search."));
    }

    private void showLiveFlightSearchResults(FirebaseUser user, Trip trip, List<JSONObject> results) {
        String[] labels = new String[results.size()];
        for (int index = 0; index < results.size(); index++) {
            JSONObject result = results.get(index);
            JSONObject flight = result.optJSONObject("flight");
            if (flight == null) flight = new JSONObject();
            labels[index] = flight.optString("number", "Flight") + "  ·  "
                    + flight.optString("origin", "ORG") + " → " + flight.optString("destination", "DST")
                    + "  ·  " + result.optString("status", "Scheduled");
        }

        LinearLayout content = formContainer();
        content.addView(text("SELECT LIVE RESULT", 11, FAINT, true), margins(0, 0, 0, 5));
        Spinner resultSelector = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, labels);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        resultSelector.setAdapter(adapter);
        content.addView(resultSelector, margins(0, 0, 0, 16));
        TextView preview = text(liveFlightPreview(results.get(0)), 14, INK, false);
        preview.setPadding(dp(14), dp(14), dp(14), dp(14));
        GradientDrawable previewBackground = new GradientDrawable();
        previewBackground.setColor(Color.parseColor(SURFACE));
        previewBackground.setStroke(dp(1), Color.parseColor(INK));
        preview.setBackground(previewBackground);
        content.addView(preview);
        content.addView(text("The selected result will populate the tracked flight with current live flight data.",
                12, FAINT, false), margins(0, 10, 0, 0));
        resultSelector.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                preview.setText(liveFlightPreview(results.get(position)));
            }

            @Override public void onNothingSelected(AdapterView<?> parent) { }
        });

        new AlertDialog.Builder(this)
                .setTitle("Choose a live flight")
                .setView(content)
                .setPositiveButton("Track selected flight", (dialog, which) ->
                        addLiveFlightResult(user, trip, results.get(resultSelector.getSelectedItemPosition())))
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void addLiveFlightResult(FirebaseUser user, Trip trip, JSONObject result) {
        Day day = getActiveDay(trip);
        JSONObject live = result.optJSONObject("flight");
        if (day == null || live == null) {
            toast("Add an itinerary day before tracking this flight.");
            return;
        }
        FlightInfo flight = new FlightInfo();
        applyLiveFlight(flight, live);
        DayEvent event = new DayEvent("flight-" + System.currentTimeMillis(),
                flight.estimatedDeparture, flight.displayTitle(), flight.displayMeta(), "flight",
                result.optString("status", "Scheduled"));
        event.flight = flight;
        if (day.events == null) day.events = new ArrayList<>();
        day.events.add(event);
        activeSection = SECTION_FLIGHTS;
        commit(user);
        toast(flight.number + " added from " + sourceLabel(flight));
    }

    private String liveFlightPreview(JSONObject result) {
        JSONObject flight = result.optJSONObject("flight");
        if (flight == null) return "Live flight details were unavailable.";
        int delay = Math.max(0, flight.optInt("delayMinutes", 0));
        String status = result.optString("status", "Scheduled");
        return flight.optString("airline", "Airline") + "  ·  " + flight.optString("number", "Flight")
                + "\n" + flight.optString("origin", "ORG") + "  →  " + flight.optString("destination", "DST")
                + "\n\nDEPARTURE  " + flight.optString("estimatedDeparture", "TBD")
                + "  ·  ARRIVAL  " + flight.optString("estimatedArrival", "TBD")
                + "\nSTATUS  " + status.toUpperCase() + "  ·  DELAY  " + (delay > 0 ? delay + " MIN" : "NONE")
                + "\nGATE  " + flight.optString("gate", "TBD") + "  ·  TERMINAL  " + flight.optString("departureTerminal", "TBD")
                + "\nBAGGAGE  " + flight.optString("baggageClaim", "TBD");
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
        EditText dateInput = input("Local departure date (YYYY-MM-DD)", InputType.TYPE_CLASS_DATETIME, safeText(trip.startDate, ""));
        EditText departureInput = input("Departs (e.g. 8:40 PM)", InputType.TYPE_CLASS_TEXT, "");
        EditText arrivalInput = input("Arrives (e.g. 10:15 AM)", InputType.TYPE_CLASS_TEXT, "");

        addField(form, "Airline", airlineInput);
        addField(form, "Flight number", numberInput);
        addField(form, "From (airport code)", originInput);
        addField(form, "To (airport code)", destinationInput);
        addField(form, "Local departure date", dateInput);
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
                    flight.departureDate = fallback(dateInput, "");
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
        EditText dateInput = input("Local departure date", InputType.TYPE_CLASS_DATETIME, flight.departureDate);
        EditText depTerminalInput = input("Departure terminal", InputType.TYPE_CLASS_TEXT, flight.departureTerminal);
        EditText arrTerminalInput = input("Arrival terminal", InputType.TYPE_CLASS_TEXT, flight.arrivalTerminal);
        EditText gateInput = input("Gate", InputType.TYPE_CLASS_TEXT, flight.gate);
        EditText arrivalGateInput = input("Arrival gate", InputType.TYPE_CLASS_TEXT, flight.arrivalGate);
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
        addField(form, "Local departure date", dateInput);
        addField(form, "Departure terminal", depTerminalInput);
        addField(form, "Arrival terminal", arrTerminalInput);
        addField(form, "Gate", gateInput);
        addField(form, "Arrival gate", arrivalGateInput);
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
                    flight.departureDate = fallback(dateInput, "");
                    flight.departureTerminal = fallback(depTerminalInput, FlightInfo.UNKNOWN);
                    flight.arrivalTerminal = fallback(arrTerminalInput, FlightInfo.UNKNOWN);
                    flight.gate = fallback(gateInput, FlightInfo.UNKNOWN).toUpperCase();
                    flight.arrivalGate = fallback(arrivalGateInput, FlightInfo.UNKNOWN).toUpperCase();
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
        EditText departureDate = input("Local departure date", InputType.TYPE_CLASS_DATETIME,
                existing == null ? safeText(trip.startDate, "") : current.departureDate);
        EditText scheduledDeparture = input("Scheduled departure", InputType.TYPE_CLASS_TEXT, current.scheduledDeparture);
        EditText estimatedDeparture = input("Estimated departure", InputType.TYPE_CLASS_TEXT, current.estimatedDeparture);
        EditText scheduledArrival = input("Scheduled arrival", InputType.TYPE_CLASS_TEXT, current.scheduledArrival);
        EditText estimatedArrival = input("Estimated arrival", InputType.TYPE_CLASS_TEXT, current.estimatedArrival);
        EditText departureTerminal = input("Departure terminal", InputType.TYPE_CLASS_TEXT, current.departureTerminal);
        EditText arrivalTerminal = input("Arrival terminal", InputType.TYPE_CLASS_TEXT, current.arrivalTerminal);
        EditText gate = input("Gate", InputType.TYPE_CLASS_TEXT, current.gate);
        EditText arrivalGate = input("Arrival gate", InputType.TYPE_CLASS_TEXT, current.arrivalGate);
        EditText delay = input("Delay in minutes", InputType.TYPE_CLASS_NUMBER, String.valueOf(current.delayMinutes));
        EditText baggage = input("Baggage claim", InputType.TYPE_CLASS_TEXT, current.baggageClaim);
        final int[] statusIndex = {Math.max(0, indexOfIgnoreCase(FLIGHT_STATUSES, existing == null ? "Scheduled" : existing.status))};
        Button status = outlineButton("Status: " + FLIGHT_STATUSES[statusIndex[0]]);
        status.setOnClickListener(v -> new AlertDialog.Builder(this).setTitle("Flight status")
                .setItems(FLIGHT_STATUSES, (dialog, which) -> { statusIndex[0] = which; status.setText("Status: " + FLIGHT_STATUSES[which]); }).show());
        addField(form, "Guest name", guestName); addField(form, "Note", note);
        addField(form, "Airline", airline); addField(form, "Flight number", number);
        addField(form, "Origin", origin); addField(form, "Destination", destination);
        addField(form, "Local departure date", departureDate);
        addField(form, "Scheduled departure", scheduledDeparture); addField(form, "Estimated departure", estimatedDeparture);
        addField(form, "Scheduled arrival", scheduledArrival); addField(form, "Estimated arrival", estimatedArrival);
        addField(form, "Departure terminal", departureTerminal); addField(form, "Arrival terminal", arrivalTerminal);
        addField(form, "Departure gate", gate); addField(form, "Arrival gate", arrivalGate);
        addField(form, "Delay in minutes", delay); addField(form, "Baggage claim", baggage);
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
                    flight.departureDate = fallback(departureDate, "");
                    flight.scheduledDeparture = formatTime(scheduledDeparture.getText().toString());
                    flight.estimatedDeparture = formatTime(estimatedDeparture.getText().toString());
                    flight.scheduledArrival = formatTime(scheduledArrival.getText().toString());
                    flight.estimatedArrival = formatTime(estimatedArrival.getText().toString());
                    flight.departureTerminal = fallback(departureTerminal, FlightInfo.UNKNOWN);
                    flight.arrivalTerminal = fallback(arrivalTerminal, FlightInfo.UNKNOWN);
                    flight.gate = fallback(gate, FlightInfo.UNKNOWN).toUpperCase();
                    flight.arrivalGate = fallback(arrivalGate, FlightInfo.UNKNOWN).toUpperCase();
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
        EditText paidBy = input("Traveler name", InputType.TYPE_CLASS_TEXT,
                trip.travelersList != null && !trip.travelersList.isEmpty() ? trip.travelersList.get(0).name : "Traveler");
        EditText category = input("Dining, Transport, Lodging…", InputType.TYPE_CLASS_TEXT, "Other");
        EditText date = input("Date label", InputType.TYPE_CLASS_TEXT, "Today");
        addField(form, "Description", description);
        addField(form, "Amount", amount);
        form.addView(text("Currency: " + expenseCurrency(trip) + " based on " + safeText(trip.country, "the trip location"), 13, MUTED, true), margins(0, 0, 0, 12));
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
                    expense.currency = expenseCurrency(trip);
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
        List<Trip> available = new ArrayList<>();
        for (Trip trip : savedTrips) if (trip != null && !trip.isArchived(System.currentTimeMillis())) available.add(trip);
        if (available.isEmpty()) {
            showingTripLibrary = true;
            renderTripLibrary(user);
            return;
        }
        String[] names = new String[available.size()];
        for (int i = 0; i < available.size(); i++) {
            Trip t = available.get(i);
            String name = t != null ? safeText(t.name, "Trip") : "Trip";
            boolean isActive = t != null && t.id != null && t.id.equals(activeTripId);
            names[i] = name + (isActive ? " (Active)" : "");
        }
        new AlertDialog.Builder(this)
                .setTitle("Select active trip (" + available.size() + ")")
                .setItems(names, (dialog, which) -> {
                    Trip selected = available.get(which);
                    if (selected != null) {
                        activeTripId = selected.id;
                        activeDayIndex = 0;
                        showingTripLibrary = false;
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
        showTripDetailsDialog(user, null);
    }

    private void showTripDetailsDialog(FirebaseUser user, Trip existing) {
        LinearLayout form = formContainer();
        EditText nameInput = input("Trip name", InputType.TYPE_CLASS_TEXT, existing == null ? "" : existing.name);
        Spinner countrySpinner = new Spinner(this);
        Spinner regionSpinner = new Spinner(this);
        Spinner citySpinner = new Spinner(this);
        countrySpinner.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, LocationData.countryNames()));
        int initialCountryIndex = existing == null ? 0 : LocationData.countryIndex(existing.countryCode);
        LocationData.Country initialCountry = LocationData.COUNTRIES.get(initialCountryIndex);
        List<String> initialRegions = new ArrayList<>();
        for (LocationData.Region region : initialCountry.regions) initialRegions.add(region.name);
        regionSpinner.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, initialRegions));
        int initialRegionIndex = existing == null ? 0 : LocationData.regionIndex(initialCountry, existing.regionCode);
        LocationData.Region initialRegion = initialCountry.regions.get(initialRegionIndex);
        citySpinner.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, initialRegion.cities));
        countrySpinner.setSelection(initialCountryIndex);
        regionSpinner.setSelection(initialRegionIndex);
        if (existing != null) {
            int initialCityIndex = initialRegion.cities.indexOf(existing.city);
            if (initialCityIndex >= 0) citySpinner.setSelection(initialCityIndex);
        }
        EditText startInput = input("YYYY-MM-DD", InputType.TYPE_CLASS_DATETIME, existing == null ? todayIso() : existing.startDate);
        EditText endInput = input("YYYY-MM-DD", InputType.TYPE_CLASS_DATETIME, existing == null ? todayIso() : existing.endDate);
        EditText travelersInput = input("Number of travelers", InputType.TYPE_CLASS_NUMBER, existing == null ? "1" : String.valueOf(Math.max(1, existing.travelersCount)));
        TextView currencyNote = text("Expenses will use " + initialCountry.currency + ".", 13, MUTED, false);
        addField(form, "Trip Name", nameInput);
        addSpinnerField(form, "Country", countrySpinner);
        addSpinnerField(form, "State or region", regionSpinner);
        addSpinnerField(form, "City", citySpinner);
        form.addView(currencyNote, margins(0, 0, 0, 12));
        addField(form, "Start Date", startInput);
        addField(form, "End Date", endInput);
        addField(form, "Travelers Count", travelersInput);

        final boolean[] firstCountryCallback = {true};
        final boolean[] firstRegionCallback = {true};
        countrySpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onNothingSelected(AdapterView<?> parent) {}
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                LocationData.Country country = LocationData.COUNTRIES.get(position);
                if (firstCountryCallback[0] && position == initialCountryIndex) {
                    firstCountryCallback[0] = false;
                    currencyNote.setText("Expenses will use " + country.currency + ".");
                    return;
                }
                firstCountryCallback[0] = false;
                List<String> regions = new ArrayList<>();
                for (LocationData.Region region : country.regions) regions.add(region.name);
                regionSpinner.setAdapter(new ArrayAdapter<>(MainActivity.this, android.R.layout.simple_spinner_dropdown_item, regions));
                currencyNote.setText("Expenses will use " + country.currency + ".");
            }
        });
        regionSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onNothingSelected(AdapterView<?> parent) {}
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                LocationData.Country country = LocationData.COUNTRIES.get(countrySpinner.getSelectedItemPosition());
                if (country.regions.isEmpty()) return;
                LocationData.Region region = country.regions.get(Math.min(position, country.regions.size() - 1));
                if (firstRegionCallback[0] && country == initialCountry && position == initialRegionIndex) {
                    firstRegionCallback[0] = false;
                    return;
                }
                firstRegionCallback[0] = false;
                citySpinner.setAdapter(new ArrayAdapter<>(MainActivity.this, android.R.layout.simple_spinner_dropdown_item, region.cities));
            }
        });

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(existing == null ? "Create a trip" : "Edit trip details")
                .setView(scrollable(form))
                .setNegativeButton("Cancel", null)
                .setPositiveButton(existing == null ? "Create" : "Save", null)
                .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                    String name = nameInput.getText().toString().trim();
                    String start = startInput.getText().toString().trim();
                    String end = endInput.getText().toString().trim();
                    if (name.isEmpty()) { toast("Enter a trip name."); return; }
                    if (!isValidIsoDate(start) || !isValidIsoDate(end)) { toast("Use YYYY-MM-DD for both dates."); return; }
                    if (end.compareTo(start) < 0) { toast("End date must be on or after the start date."); return; }
                    int count = Math.max(1, parseInt(travelersInput.getText().toString(), 1));
                    LocationData.Country country = LocationData.COUNTRIES.get(countrySpinner.getSelectedItemPosition());
                    LocationData.Region region = country.regions.get(regionSpinner.getSelectedItemPosition());
                    String city = region.cities.get(citySpinner.getSelectedItemPosition());
                    Trip trip = existing;
                    if (trip == null) {
                        String tripId = "trip-" + System.currentTimeMillis();
                        List<Day> initialDays = new ArrayList<>();
                        initialDays.add(dayForDate("day-" + System.currentTimeMillis(), start, "Arrival"));
                        trip = new Trip(tripId, name, city + ", " + region.name + ", " + country.name, start, count, initialDays);
                        Traveler organizer = new Traveler();
                        organizer.name = user.getDisplayName() != null ? user.getDisplayName() : safeEmail(user).split("@")[0];
                        organizer.email = safeEmail(user);
                        organizer.role = "Trip organizer";
                        organizer.avatar = Traveler.initials(organizer.name);
                        organizer.bg = "avatar-me";
                        trip.travelersList.add(organizer);
                        MapPin firstPin = new MapPin();
                        firstPin.name = city;
                        firstPin.code = city.substring(0, Math.min(3, city.length())).toUpperCase(Locale.US);
                        firstPin.desc = "Starting point";
                        firstPin.temp = "Live weather";
                        trip.mapPins.add(firstPin);
                        savedTrips.add(0, trip);
                    }
                    trip.name = name;
                    trip.startDate = start;
                    trip.endDate = end;
                    trip.travelersCount = count;
                    trip.countryCode = country.code;
                    trip.country = country.name;
                    trip.regionCode = region.code;
                    trip.region = region.name;
                    trip.city = city;
                    trip.currency = country.currency;
                    trip.route = city + ", " + region.name + ", " + country.name;
                    activeTripId = trip.id;
                    activeDayIndex = 0;
                    activeSection = SECTION_OVERVIEW;
                    showingTripLibrary = false;
                    weatherByTrip.remove(trip.id);
                    commit(user);
                    toast(existing == null ? "Trip created." : "Trip details updated.");
                    dialog.dismiss();
                }));
        dialog.show();
    }

    private void confirmDeleteTrip(FirebaseUser user, Trip trip) {
        if (trip == null) return;
        LinearLayout form = formContainer();
        form.addView(text("This permanently removes the trip and its itinerary from your Firebase profile. Type DELETE to confirm.", 14, MUTED, false), margins(0, 0, 0, 10));
        EditText confirmation = input("DELETE", InputType.TYPE_CLASS_TEXT, "");
        form.addView(confirmation);
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Delete trip permanently?")
                .setView(form)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Delete permanently", null)
                .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                    if (!"DELETE".equals(confirmation.getText().toString().trim())) {
                        toast("Type DELETE to confirm permanent deletion.");
                        return;
                    }
                    savedTrips.remove(trip);
                    weatherByTrip.remove(trip.id);
                    activeTripId = firstActiveTripId();
                    activeDayIndex = 0;
                    showingTripLibrary = true;
                    commit(user);
                    toast("Trip permanently deleted.");
                    dialog.dismiss();
                }));
        dialog.show();
    }

    // ------------------------------------------------------------------ days

    private void showAddDayDialog(FirebaseUser user, Trip trip) {
        if (trip == null) return;
        LinearLayout form = formContainer();

        int nextNum = (trip.days != null ? trip.days.size() + 1 : 1);
        EditText labelInput = input("Day Title (e.g. Exploring Old Town)", InputType.TYPE_CLASS_TEXT, "Day " + nextNum + " Excursion");
        EditText dateInput = input("YYYY-MM-DD", InputType.TYPE_CLASS_DATETIME, nextTripDayIso(trip));

        addField(form, "Day Title", labelInput);
        addField(form, "Calendar Date", dateInput);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Add Itinerary Day")
                .setView(scrollable(form))
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Add Day", null)
                .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                    String label = fallback(labelInput, "Day " + nextNum);
                    String isoDate = dateInput.getText().toString().trim();
                    if (!isValidIsoDate(isoDate)) { toast("Use a full date in YYYY-MM-DD format."); return; }

                    if (trip.days == null) trip.days = new ArrayList<>();
                    Day newDay = dayForDate("day-" + System.currentTimeMillis(), isoDate, label);
                    trip.days.add(newDay);
                    activeDayIndex = trip.days.size() - 1;
                    activeSection = SECTION_ITINERARY;
                    commit(user);
                    toast("Added " + label + ".");
                    dialog.dismiss();
                }));
        dialog.show();
    }

    private void showRenameDayDialog(FirebaseUser user, Trip trip, Day day) {
        if (trip == null || day == null) return;
        LinearLayout form = formContainer();
        EditText labelInput = input("Day Title", InputType.TYPE_CLASS_TEXT, day.label);
        EditText dateInput = input("YYYY-MM-DD", InputType.TYPE_CLASS_DATETIME,
                safeText(day.isoDate, dateFromTripAndIndex(trip, activeDayIndex)));
        addField(form, "Day Title", labelInput);
        addField(form, "Calendar Date", dateInput);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Edit Day " + (activeDayIndex + 1))
                .setView(scrollable(form))
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Save", null)
                .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                    String isoDate = dateInput.getText().toString().trim();
                    if (!isValidIsoDate(isoDate)) { toast("Use a full date in YYYY-MM-DD format."); return; }
                    day.label = fallback(labelInput, day.label);
                    applyDate(day, isoDate);
                    commit(user);
                    toast("Day updated.");
                    dialog.dismiss();
                }));
        dialog.show();
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

    // ------------------------------------------------------------- ui helpers

    private void showUtilityMenu(FirebaseUser user, Trip trip) {
        boolean completed = trip != null && trip.isCompleted(System.currentTimeMillis());
        String archiveAction = completed ? "COMPLETED (AUTO ARCHIVED)" : trip != null && trip.isManuallyArchived() ? "RESTORE TRIP" : "ARCHIVE TRIP";
        String[] actions = {
                "ALL TRIPS",
                "EDIT TRIP DETAILS",
                archiveAction,
                "FLIGHT TRACKER",
                "GUEST FLIGHT WATCH",
                "TRAVELERS",
                "SWITCH TRIP (" + savedTrips.size() + ")",
                "NEW TRIP",
                "DELETE CURRENT TRIP",
                "SIGN OUT"
        };
        new AlertDialog.Builder(this)
                .setTitle("JOURNEYSYNC")
                .setItems(actions, (dialog, which) -> {
                    if (which == 0) {
                        showingTripLibrary = true;
                        renderTripLibrary(user);
                    } else if (which == 1) {
                        showTripDetailsDialog(user, trip);
                    } else if (which == 2) {
                        if (completed) {
                            toast("This trip was archived automatically after its final day.");
                        } else {
                            trip.archivedAt = trip.isManuallyArchived() ? "" : utcTimestamp(System.currentTimeMillis());
                            showingTripLibrary = true;
                            commit(user);
                        }
                    } else if (which == 3) {
                        activeSection = SECTION_FLIGHTS;
                        renderDashboard(user);
                    } else if (which == 4) {
                        activeSection = SECTION_GUEST_FLIGHTS;
                        renderDashboard(user);
                    } else if (which == 5) {
                        activeSection = SECTION_TRAVELERS;
                        renderDashboard(user);
                    } else if (which == 6) {
                        showTripSwitcherDialog(user);
                    } else if (which == 7) {
                        showCreateTripDialog(user);
                    } else if (which == 8) {
                        confirmDeleteTrip(user, trip);
                    } else {
                        signOut();
                    }
                })
                .show();
    }

    private Button squareButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        button.setTextColor(Color.WHITE);
        button.setAllCaps(false);
        button.setPadding(0, 0, 0, 0);
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.parseColor(INK));
        background.setCornerRadius(0);
        button.setBackground(background);
        return button;
    }

    private LinearLayout navItem(String glyph, String label, boolean selected, Runnable action) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.VERTICAL);
        item.setGravity(Gravity.CENTER_HORIZONTAL);
        item.setClickable(true);
        item.setOnClickListener(v -> action.run());

        View indicator = new View(this);
        indicator.setBackgroundColor(Color.parseColor(selected ? CORAL : SURFACE));
        item.addView(indicator, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(3)));

        TextView icon = text(glyph, 17, selected ? CORAL : INK, true);
        icon.setGravity(Gravity.CENTER);
        icon.setMaxLines(1);
        item.addView(icon, margins(0, 8, 0, 1));
        TextView caption = text(label, 9, selected ? CORAL : MUTED, true);
        caption.setGravity(Gravity.CENTER);
        caption.setLetterSpacing(.08f);
        // Six tabs share the width, so a narrow screen leaves roughly 50dp each.
        // Captions are sized in sp and grow with the system font scale, so
        // without a single-line cap "Expenses" wrapped and was then clipped by
        // the bar's fixed height. Ellipsizing keeps every tab on one readable row.
        caption.setMaxLines(1);
        caption.setEllipsize(TextUtils.TruncateAt.END);
        item.addView(caption);
        return item;
    }

    private TextView sectionLabel(String label) {
        TextView view = text(label, 12, INK, true);
        view.setLetterSpacing(.12f);
        return view;
    }

    private LinearLayout sectionLink(String title, String subtitle, Runnable action) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(14), dp(14), dp(12), dp(14));
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.parseColor(SURFACE));
        background.setCornerRadius(0);
        background.setStroke(dp(1), Color.parseColor(LINE));
        row.setBackground(background);
        row.setClickable(true);
        row.setOnClickListener(v -> action.run());

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        TextView titleView = text(title, 13, INK, true);
        titleView.setLetterSpacing(.06f);
        copy.addView(titleView);
        copy.addView(text(subtitle, 12, MUTED, false), margins(0, 4, 0, 0));
        row.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        row.addView(text("→", 22, BLUE, true));
        return row;
    }

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

    private void addSpinnerField(LinearLayout form, String label, Spinner spinner) {
        form.addView(text(label, 13, MUTED, true), margins(0, 0, 0, 4));
        spinner.setMinimumHeight(dp(50));
        form.addView(spinner, margins(0, 0, 0, 10));
    }

    private LinearLayout fieldGroup(String label, EditText field) {
        LinearLayout group = new LinearLayout(this);
        group.setOrientation(LinearLayout.VERTICAL);
        addField(group, label, field);
        return group;
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(16), dp(18), dp(16));
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.parseColor(SURFACE));
        background.setCornerRadius(0);
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
        bg.setCornerRadius(0);
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
        input.setMinHeight(dp(50));
        // Rounded to match the buttons; square-cornered fields next to rounded
        // buttons was a large part of the unfinished look.
        input.setPadding(dp(14), dp(12), dp(14), dp(12));
        input.setTextColor(Color.parseColor(INK));
        input.setHintTextColor(Color.parseColor(MUTED));
        input.setBackground(roundedFill(SURFACE, LINE));
        return input;
    }

    /** Rounded corner radius shared by buttons and cards, matching the web UI. */
    private static final int RADIUS_DP = 10;

    private GradientDrawable roundedFill(String fill, String stroke) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(Color.parseColor(fill));
        shape.setCornerRadius(dp(RADIUS_DP));
        if (stroke != null) shape.setStroke(dp(1), Color.parseColor(stroke));
        return shape;
    }

    /**
     * Buttons previously used square corners with no pressed state, which read
     * as unfinished next to the website. This gives them the site's rounded
     * shape plus a visible press response.
     */
    private void styleButton(Button button, String fill, String pressedFill, String stroke, String textColor) {
        button.setTextColor(Color.parseColor(textColor));
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        button.setAllCaps(false);
        button.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        button.setLetterSpacing(.01f);
        button.setMinHeight(dp(48));
        button.setPadding(dp(18), dp(12), dp(18), dp(12));
        button.setStateListAnimator(null);

        StateListDrawable states = new StateListDrawable();
        states.addState(new int[]{android.R.attr.state_pressed}, roundedFill(pressedFill, stroke));
        states.addState(new int[]{}, roundedFill(fill, stroke));
        button.setBackground(states);
    }

    private Button primaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        styleButton(button, CORAL, CORAL_PRESSED, null, "#FFFFFF");
        return button;
    }

    private Button outlineButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        styleButton(button, SURFACE, CREAM, LINE, INK);
        return button;
    }

    private Button dangerButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.parseColor(CORAL));
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        button.setAllCaps(true);
        button.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        button.setMinHeight(dp(48));
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.parseColor(SURFACE));
        background.setCornerRadius(0);
        background.setStroke(dp(2), Color.parseColor(CORAL));
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

    /**
     * Sizes the trip map against the viewport instead of pinning it to one dp
     * value. A flat 240dp is about a third of a portrait phone but nearly the
     * whole usable height of a landscape one, where it pushed the places list
     * and the section heading entirely below the fold. The ceiling keeps
     * portrait phones looking exactly as before; the floor keeps the map usable
     * on short viewports and on tall system font scales that inflate everything
     * stacked above it.
     */
    private int tripMapHeightPx() {
        int viewportHeight = getResources().getDisplayMetrics().heightPixels;
        int proportional = Math.round(viewportHeight * 0.34f);
        return Math.max(dp(150), Math.min(proportional, dp(240)));
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

    private void signOut() {
        firebaseAuth.signOut();
        googleClient.signOut();
        activeSection = SECTION_OVERVIEW;
        activeDayIndex = 0;
        showingTripLibrary = true;
        showLogin();
    }

    private String firstActiveTripId() {
        long now = System.currentTimeMillis();
        for (Trip trip : savedTrips) if (trip != null && !trip.isArchived(now)) return safeText(trip.id, "");
        return savedTrips.isEmpty() ? "" : safeText(savedTrips.get(0).id, "");
    }

    private static String locationLabel(Trip trip) {
        if (trip == null) return "Location not set";
        String city = safeText(trip.city, "");
        String region = safeText(trip.region, "");
        String country = safeText(trip.country, "");
        List<String> parts = new ArrayList<>();
        if (!city.isEmpty()) parts.add(city);
        if (!region.isEmpty()) parts.add(region);
        if (!country.isEmpty()) parts.add(country);
        return parts.isEmpty() ? "Location not set" : android.text.TextUtils.join(", ", parts);
    }

    private static String tripDateRange(Trip trip) {
        if (trip == null) return "Dates not set";
        String start = safeText(trip.startDate, "Date not set");
        String end = safeText(trip.endDate, "");
        return end.isEmpty() ? start : start + " to " + end;
    }

    private static String todayIso() {
        return isoFormat().format(new Date());
    }

    private static SimpleDateFormat isoFormat() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        format.setLenient(false);
        return format;
    }

    private static Date parseCalendarDate(String value) {
        if (value == null || !value.matches("\\d{4}-\\d{2}-\\d{2}")) return null;
        try { return isoFormat().parse(value); }
        catch (Exception ignored) { return null; }
    }

    private static boolean isValidIsoDate(String value) {
        return parseCalendarDate(value) != null;
    }

    private static Day dayForDate(String id, String isoDate, String label) {
        Day day = new Day(id, "01", "DAY", label, isoDate, new ArrayList<>());
        applyDate(day, isoDate);
        return day;
    }

    private static void applyDate(Day day, String isoDate) {
        Date parsed = parseCalendarDate(isoDate);
        if (day == null || parsed == null) return;
        day.isoDate = isoDate;
        day.date = new SimpleDateFormat("dd", Locale.US).format(parsed);
        day.shortName = new SimpleDateFormat("EEE", Locale.US).format(parsed).toUpperCase(Locale.US);
    }

    private static String dateFromTripAndIndex(Trip trip, int index) {
        Date start = trip == null ? null : parseCalendarDate(trip.startDate);
        if (start == null) start = new Date();
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(start);
        calendar.add(Calendar.DAY_OF_MONTH, Math.max(0, index));
        return isoFormat().format(calendar.getTime());
    }

    private static String nextTripDayIso(Trip trip) {
        Date latest = trip == null ? null : parseCalendarDate(trip.startDate);
        if (trip != null && trip.days != null) {
            for (Day day : trip.days) {
                Date candidate = day == null ? null : parseCalendarDate(day.isoDate);
                if (candidate != null && (latest == null || candidate.after(latest))) latest = candidate;
            }
        }
        if (latest == null) latest = new Date();
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(latest);
        calendar.add(Calendar.DAY_OF_MONTH, 1);
        return isoFormat().format(calendar.getTime());
    }

    private static final class WeatherSnapshot {
        String destination;
        String day;
        String high;
        String low;
        String rain;
        String icon;
        String description;
        String source;
        String error;
    }

    /** Mirrors the website's formatTime so 24h entry renders as 8:40 PM. */
    static String formatTime(String raw) {
        return TimeFormat.display(raw);
    }

    /** Lets travelers type either an airline code or a familiar airline name. */
    static String normalizeFlightCodeInput(String raw) {
        String normalized = raw == null ? "" : raw.toUpperCase(Locale.US).replace("FLIGHT", "").trim();
        String[][] airlines = {
                {"DELTA", "DL"}, {"AMERICAN AIRLINES", "AA"}, {"AMERICAN", "AA"},
                {"UNITED AIRLINES", "UA"}, {"UNITED", "UA"}, {"SOUTHWEST", "WN"},
                {"JETBLUE", "B6"}, {"AIR CANADA", "AC"}, {"BRITISH AIRWAYS", "BA"},
                {"LUFTHANSA", "LH"}, {"EMIRATES", "EK"}
        };
        for (String[] airline : airlines) {
            if (normalized.startsWith(airline[0])) {
                normalized = airline[1] + normalized.substring(airline[0].length());
                break;
            }
        }
        return normalized.replaceAll("[^A-Z0-9]", "");
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
        return trip == null ? "USD" : safeText(trip.currency, "USD").toUpperCase(Locale.US);
    }

    /**
     * Switches the status bar icons between dark (for light backgrounds) and
     * light. setSystemUiVisibility is deprecated and ignored from Android 11,
     * which left the icons unreadable against the cream surface, so R and above
     * go through WindowInsetsController instead.
     */
    private void setLightStatusBar(boolean darkIcons) {
        // Reading the decor view first forces the window to build it. Going
        // straight to Window#getInsetsController() during onCreate throws,
        // because the decor view does not exist until it is requested.
        View decor = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            android.view.WindowInsetsController controller = decor.getWindowInsetsController();
            if (controller != null) {
                controller.setSystemBarsAppearance(
                        darkIcons ? android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS : 0,
                        android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        } else {
            decor.setSystemUiVisibility(darkIcons ? View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR : 0);
        }
    }

    /**
     * Keeps content clear of the status and navigation bars.
     *
     * targetSdk 35 opts the app into Android 15's enforced edge-to-edge layout,
     * where the window is laid out behind the system bars. Without consuming
     * the insets the header renders underneath the notification bar, so pad the
     * root by whatever the system bars occupy. Uses the typed WindowInsets API
     * on R+ and the pre-R accessors below that, since minSdk is 23.
     */
    private void applySystemBarInsets(View root) {
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int top;
            int bottom;
            int left;
            int right;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Union with the cutout: in landscape a notch sits on a side edge,
                // where systemBars() alone reports nothing and the header slides
                // under the camera housing.
                android.graphics.Insets bars = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                top = bars.top;
                bottom = bars.bottom;
                left = bars.left;
                right = bars.right;
            } else {
                top = insets.getSystemWindowInsetTop();
                bottom = insets.getSystemWindowInsetBottom();
                left = insets.getSystemWindowInsetLeft();
                right = insets.getSystemWindowInsetRight();
            }
            // Absolute rather than preserving the current left/right padding, so
            // repeated inset passes stay idempotent.
            view.setPadding(left, top, right, bottom);
            return insets;
        });
        root.requestApplyInsets();
    }

    /**
     * Names the provider that actually answered. The server picks between
     * AeroDataBox and AviationStack per request and reports it as `source`, so
     * the UI reads that back instead of naming one provider it may not have used.
     */
    private static String sourceLabel(FlightInfo flight) {
        if (flight != null && flight.source != null && !flight.source.trim().isEmpty()) {
            return flight.source.trim();
        }
        return "live flight data";
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
