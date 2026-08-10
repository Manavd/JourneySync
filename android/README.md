# JourneySync Android

This is the native Android client for JourneySync. It uses Firebase Authentication
and the same Firestore trip document as the web app, so changes to itineraries,
flight tracking, guest-flight watchlists, expenses, wallet documents, map pins, and travelers stay in sync
between both clients.

Live flight refreshes call JourneySync's authenticated server endpoint. The
native app sends the signed-in user's Firebase ID token; the AeroDataBox key is
kept only in the hosted server environment and is never packaged into the APK.

Package name: `com.manavdesai.journeysync`

The local debug signing key and generated build output are intentionally ignored
by Git. Add the Android project to Android Studio, sync Gradle, and run the `app`
configuration on an emulator or device.
