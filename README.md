# Daggerheart Session Manager

A real-time session tool for Daggerheart tables. Hosts create a session, share a code, and manage fear + countdowns while players follow along.

## Setup

1) Create a Firebase project with Firestore and Authentication enabled.
2) Enable Google and Apple providers in Firebase Auth (Apple requires a Service ID + key).
3) Add your Firebase config to `.env`:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

4) Deploy Firestore rules:

```bash
firebase deploy --only firestore:rules
```

## Firestore TTL

To auto-clean sessions after 24 hours, enable TTL in the Firebase console:

- Collection: `sessions`
- Field: `sessionExpiresAt`

The app already sets `sessionExpiresAt` on creation. Join codes expire based on `codeExpiresAt`.

## Local dev

```bash
npm install
npm run dev
```
# daggerheart-session-manager
