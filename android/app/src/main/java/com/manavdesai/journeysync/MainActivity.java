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
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.gms.auth.api.Auth;
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

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** A native Android JourneySync experience backed by Firebase Authentication and Firestore. */
public class MainActivity extends android.app.Activity {
    private static final int RC_GOOGLE_SIGN_IN = 4021;
    private static final String BLUE = "#0C79D8";
    private static final String INK = "#14213D";
    private static final String SURFACE = "#F7F9FC";

    private FirebaseAuth firebaseAuth;
    private FirebaseFirestore firestore;
    private GoogleSignInClient googleClient;
    private LinearLayout screen;
    private ProgressBar progress;
    private final List<TripEvent> events = new ArrayList<>();

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
        screen.setPadding(dp(24), dp(36), dp(24), dp(36));
        screen.setBackgroundColor(Color.parseColor(SURFACE));
        scroll.addView(screen, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT, ScrollView.LayoutParams.WRAP_CONTENT));
        setContentView(scroll);
    }

    private void showLogin() {
        prepareScreen();
        addBrandHeader();

        TextView heading = text("Welcome back", 28, INK, true);
        screen.addView(heading, margins(0, 28, 0, 6));
        screen.addView(text("Sign in to your trips with Firebase.", 15, "#516072", false), margins(0, 0, 0, 24));

        EditText email = input("Email address", InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        EditText password = input("Password", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        screen.addView(email, margins(0, 0, 0, 12));
        screen.addView(password, margins(0, 0, 0, 12));

        Button signIn = primaryButton("Sign in with email");
        signIn.setOnClickListener(v -> emailSignIn(email, password, false));
        screen.addView(signIn, margins(0, 4, 0, 12));

        Button createAccount = outlineButton("Create an account");
        createAccount.setOnClickListener(v -> emailSignIn(email, password, true));
        screen.addView(createAccount, margins(0, 0, 0, 20));

        TextView divider = text("OR", 12, "#7A8795", true);
        divider.setGravity(Gravity.CENTER);
        screen.addView(divider, margins(0, 0, 0, 18));

        Button google = outlineButton("Continue with Google");
        google.setOnClickListener(v -> startActivityForResult(googleClient.getSignInIntent(), RC_GOOGLE_SIGN_IN));
        screen.addView(google);

        TextView help = text("This is a native Android app. Your sign-in is handled directly by Firebase, not by the website.", 13, "#516072", false);
        screen.addView(help, margins(0, 24, 0, 0));
    }

    private void emailSignIn(EditText emailView, EditText passwordView, boolean create) {
        String email = emailView.getText().toString().trim();
        String password = passwordView.getText().toString();
        if (email.isEmpty() || password.isEmpty()) {
            toast("Enter both your email and password.");
            return;
        }
        showBusy(true);
        if (create) {
            firebaseAuth.createUserWithEmailAndPassword(email, password)
                    .addOnCompleteListener(task -> handleEmailResult(task, "Account created."));
        } else {
            firebaseAuth.signInWithEmailAndPassword(email, password)
                    .addOnCompleteListener(task -> handleEmailResult(task, "Signed in."));
        }
    }

    private void handleEmailResult(@NonNull Task<?> task, String successMessage) {
        showBusy(false);
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
                toast("Google did not return a usable account. Try again.");
                return;
            }
            showBusy(true);
            AuthCredential credential = GoogleAuthProvider.getCredential(account.getIdToken(), null);
            firebaseAuth.signInWithCredential(credential).addOnCompleteListener(task -> {
                showBusy(false);
                if (task.isSuccessful()) {
                    toast("Signed in with Google.");
                    showCurrentState();
                } else {
                    toast(friendlyError(task.getException()));
                }
            });
        } catch (ApiException exception) {
            toast("Google sign-in was cancelled or unavailable (code " + exception.getStatusCode() + ").");
        }
    }

    private void showDashboard(FirebaseUser user) {
        prepareScreen();
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        TextView welcome = text("JourneySync", 24, INK, true);
        top.addView(welcome, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        Button signOut = outlineButton("Sign out");
        signOut.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        signOut.setOnClickListener(v -> {
            firebaseAuth.signOut();
            googleClient.signOut();
            showLogin();
        });
        top.addView(signOut);
        screen.addView(top);

        screen.addView(text("Swiss Escape", 28, INK, true), margins(0, 30, 0, 4));
        screen.addView(text("Zürich → Interlaken → Zermatt  •  4 travelers", 15, "#516072", false), margins(0, 0, 0, 20));

        LinearLayout syncCard = card();
        syncCard.addView(text("Cloud sync active", 15, "#1D7A48", true));
        syncCard.addView(text("Signed in as " + safeEmail(user), 13, "#516072", false), margins(0, 4, 0, 0));
        screen.addView(syncCard, margins(0, 0, 0, 20));

        LinearLayout actionRow = new LinearLayout(this);
        actionRow.setOrientation(LinearLayout.HORIZONTAL);
        Button add = primaryButton("Add event");
        add.setOnClickListener(v -> showAddEventDialog());
        actionRow.addView(add, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        Button refresh = outlineButton("Refresh");
        refresh.setOnClickListener(v -> loadEvents(user));
        actionRow.addView(refresh, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 0.65f));
        screen.addView(actionRow, margins(0, 0, 0, 24));

        screen.addView(text("Today’s itinerary", 19, INK, true), margins(0, 0, 0, 10));
        progress = new ProgressBar(this);
        progress.setVisibility(View.VISIBLE);
        screen.addView(progress, margins(0, 6, 0, 6));
        loadEvents(user);
    }

    private void loadEvents(FirebaseUser user) {
        if (progress != null) progress.setVisibility(View.VISIBLE);
        dashboardDoc(user).get().addOnSuccessListener(snapshot -> {
            events.clear();
            Object rawEvents = snapshot.get("events");
            if (rawEvents instanceof List) {
                for (Object raw : (List<?>) rawEvents) {
                    if (raw instanceof Map) {
                        Map<?, ?> map = (Map<?, ?>) raw;
                        events.add(new TripEvent(stringValue(map.get("time")), stringValue(map.get("title")), stringValue(map.get("details"))));
                    }
                }
            }
            if (events.isEmpty()) {
                events.addAll(defaultEvents());
                saveEvents(user);
            }
            renderEvents();
        }).addOnFailureListener(error -> {
            if (events.isEmpty()) events.addAll(defaultEvents());
            renderEvents();
            toast("Showing saved itinerary while cloud sync reconnects.");
        });
    }

    private void renderEvents() {
        if (progress != null) progress.setVisibility(View.GONE);
        for (int i = screen.getChildCount() - 1; i >= 0; i--) {
            View child = screen.getChildAt(i);
            if ("event-card".equals(child.getTag())) screen.removeViewAt(i);
        }
        for (TripEvent event : events) {
            LinearLayout card = card();
            card.setTag("event-card");
            card.addView(text(event.time, 13, BLUE, true));
            card.addView(text(event.title, 17, INK, true), margins(0, 5, 0, 2));
            card.addView(text(event.details, 13, "#516072", false));
            screen.addView(card, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT) {{
                        setMargins(0, 0, 0, dp(10));
                    }});
        }
    }

    private void showAddEventDialog() {
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(20);
        form.setPadding(pad, 0, pad, 0);
        EditText title = input("What are you planning?", InputType.TYPE_CLASS_TEXT);
        EditText time = input("Time (for example, 7:30 PM)", InputType.TYPE_CLASS_TEXT);
        EditText details = input("Location or details", InputType.TYPE_CLASS_TEXT);
        form.addView(title, margins(0, 0, 0, 10));
        form.addView(time, margins(0, 0, 0, 10));
        form.addView(details);
        new AlertDialog.Builder(this)
                .setTitle("Add itinerary event")
                .setView(form)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Save", (dialog, which) -> {
                    String eventTitle = title.getText().toString().trim();
                    if (eventTitle.isEmpty()) {
                        toast("Give the event a title first.");
                        return;
                    }
                    events.add(new TripEvent(
                            valueOr(time.getText().toString().trim(), "Any time"),
                            eventTitle,
                            valueOr(details.getText().toString().trim(), "No extra details")));
                    renderEvents();
                    FirebaseUser user = firebaseAuth.getCurrentUser();
                    if (user != null) saveEvents(user);
                })
                .show();
    }

    private void saveEvents(FirebaseUser user) {
        List<Map<String, String>> eventMaps = new ArrayList<>();
        for (TripEvent event : events) {
            Map<String, String> row = new HashMap<>();
            row.put("time", event.time);
            row.put("title", event.title);
            row.put("details", event.details);
            eventMaps.add(row);
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("events", eventMaps);
        payload.put("updatedAt", System.currentTimeMillis());
        dashboardDoc(user).set(payload).addOnFailureListener(error -> toast("Could not sync the new event yet."));
    }

    private DocumentReference dashboardDoc(FirebaseUser user) {
        return firestore.collection("users").document(user.getUid())
                .collection("android_dashboard").document("primary");
    }

    private void addBrandHeader() {
        TextView brand = text("JourneySync", 25, BLUE, true);
        screen.addView(brand);
        screen.addView(text(getString(R.string.app_tagline), 14, "#516072", false), margins(0, 4, 0, 0));
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(16), dp(18), dp(16));
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.WHITE);
        background.setCornerRadius(dp(16));
        background.setStroke(dp(1), Color.parseColor("#DDE4ED"));
        card.setBackground(background);
        return card;
    }

    private EditText input(String hint, int inputType) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        input.setInputType(inputType);
        input.setPadding(dp(16), dp(14), dp(16), dp(14));
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.WHITE);
        background.setCornerRadius(dp(12));
        background.setStroke(dp(1), Color.parseColor("#C9D4E1"));
        input.setBackground(background);
        return input;
    }

    private Button primaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.WHITE);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        button.setAllCaps(false);
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.parseColor(BLUE));
        background.setCornerRadius(dp(12));
        button.setBackground(background);
        button.setPadding(dp(16), dp(12), dp(16), dp(12));
        return button;
    }

    private Button outlineButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.parseColor(INK));
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        button.setAllCaps(false);
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.WHITE);
        background.setCornerRadius(dp(12));
        background.setStroke(dp(1), Color.parseColor("#AFC0D2"));
        button.setBackground(background);
        button.setPadding(dp(16), dp(12), dp(16), dp(12));
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

    private List<TripEvent> defaultEvents() {
        return Arrays.asList(
                new TripEvent("8:40 AM", "Arrive at Zürich Airport", "SWISS LX 017 · Terminal 2 · Gate E52"),
                new TripEvent("10:18 AM", "Train to Zürich HB", "SBB · Platform 3 · 12 min"),
                new TripEvent("7:30 PM", "Dinner at Kronenhalle", "Rämistrasse 4 · Table for 4"));
    }

    private void showBusy(boolean busy) {
        if (busy) toast("Connecting securely to Firebase…");
    }

    private String safeEmail(FirebaseUser user) {
        return user.getEmail() == null ? "your JourneySync account" : user.getEmail();
    }

    private String friendlyError(Exception error) {
        String message = error == null ? "Firebase could not complete the request." : String.valueOf(error.getMessage()).toLowerCase();
        if (message.contains("invalid-credential") || message.contains("wrong-password")) return "That email or password is incorrect.";
        if (message.contains("email-already-in-use")) return "An account already exists for this email.";
        if (message.contains("weak-password")) return "Use a password with at least six characters.";
        if (message.contains("network")) return "Check your connection and try again.";
        return "Firebase could not complete the request. Please try again.";
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String valueOr(String value, String fallback) {
        return value.isEmpty() ? fallback : value;
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    private static class TripEvent {
        final String time;
        final String title;
        final String details;

        TripEvent(String time, String title, String details) {
            this.time = time;
            this.title = title;
            this.details = details;
        }
    }
}
