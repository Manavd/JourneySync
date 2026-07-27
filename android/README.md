# JourneySync Android

This Android app is a Trusted Web App for the deployed JourneySync site. It
uses Chrome's secure browser context so the existing Firebase Google and
email/password authentication flows continue to work.

Package name: `com.manavdesai.journeysync`

The local debug signing key is intentionally ignored by Git. The public
certificate fingerprint is published in `public/.well-known/assetlinks.json`
so Android can verify and open the app full-screen.
