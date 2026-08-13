// Firebase Authentication & Firestore service for JourneySync.
//
// Keep every public value as a direct NEXT_PUBLIC_* reference. Vinext/Vite
// replaces these references in the browser bundle at build time; dynamically
// indexing process.env or import.meta.env leaves the deployed app with the
// placeholder values instead.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  signInWithPopup as firebaseSignInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User as FirebaseAuthUser,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  doc as firestoreDoc,
  setDoc as firestoreSetDoc,
  getDoc as firestoreGetDoc,
  onSnapshot as firestoreOnSnapshot,
  type Firestore,
  type DocumentReference,
  type SetOptions,
} from "firebase/firestore";

export type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const requiredConfig = {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId,
};

const invalidConfigKeys = Object.entries(requiredConfig)
  .filter(([, value]) => {
    if (!value) return true;
    const normalized = value.toLowerCase();
    return (
      normalized.includes("yourapikeyhere") ||
      normalized.includes("your-app") ||
      normalized.includes("your-project")
    );
  })
  .map(([key]) => key);

const CONFIG_ERROR =
  invalidConfigKeys.length > 0
    ? `Firebase configuration is missing or still contains placeholders: ${invalidConfigKeys.join(", ")}. Update .env.local and rebuild the app.`
    : "Firebase could not be initialized in this browser.";

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let initializationError: unknown;

// A client component is also rendered on the server. Initialize the browser
// SDK only in the browser, where Firebase Auth persistence and popup flows live.
if (typeof window !== "undefined") {
  if (invalidConfigKeys.length === 0) {
    try {
      app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      authInstance = getAuth(app);
      // The project's Firestore database is named "default" (no parens),
      // not the SDK's implicit "(default)" database. Without pinning this
      // explicitly, every read/write silently targets a database that
      // doesn't exist and retries forever with exponential backoff -
      // trips never load and sign-in appears to hang indefinitely.
      //
      // Persistent local cache lets a returning sign-in paint trip data
      // instantly from IndexedDB while Firestore reconciles in the
      // background, instead of every load waiting on a fresh network
      // round trip. Falls back to the default memory-only cache in
      // environments where IndexedDB persistence isn't available (e.g.
      // private browsing, multiple open tabs without broadcast support).
      try {
        dbInstance = initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
        }, "default");
      } catch {
        dbInstance = getFirestore(app, "default");
      }
    } catch (error) {
      initializationError = error;
      console.error("Firebase initialization failed:", error);
    }
  } else {
    console.error(CONFIG_ERROR);
  }
}

// These exports retain the Firebase-shaped API used by the page. The wrapper
// functions below validate initialization before using either value.
export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;
export const googleProvider = new GoogleAuthProvider();

function requireAuth(): Auth {
  if (authInstance) return authInstance;
  if (initializationError instanceof Error) {
    throw new Error(`Firebase initialization failed: ${initializationError.message}`);
  }
  throw new Error(CONFIG_ERROR);
}

function requireDb(): Firestore {
  if (dbInstance) return dbInstance;
  if (initializationError instanceof Error) {
    throw new Error(`Firebase initialization failed: ${initializationError.message}`);
  }
  throw new Error(CONFIG_ERROR);
}

function toUser(firebaseUser: FirebaseAuthUser | null): User | null {
  if (!firebaseUser) return null;
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
  };
}

export function onAuthStateChanged(_auth: Auth, callback: (user: User | null) => void) {
  if (!authInstance) {
    callback(null);
    return () => {};
  }
  return firebaseOnAuthStateChanged(authInstance, (firebaseUser) => callback(toUser(firebaseUser)));
}

export async function signInWithEmailAndPassword(_auth: Auth, email: string, password: string): Promise<User> {
  const credential = await firebaseSignInWithEmailAndPassword(requireAuth(), email, password);
  return toUser(credential.user)!;
}

export async function createUserWithEmailAndPassword(_auth: Auth, email: string, password: string): Promise<User> {
  const credential = await firebaseCreateUserWithEmailAndPassword(requireAuth(), email, password);
  return toUser(credential.user)!;
}

export async function signInWithPopup(_auth: Auth, provider: GoogleAuthProvider): Promise<User> {
  const credential = await firebaseSignInWithPopup(requireAuth(), provider);
  return toUser(credential.user)!;
}

export async function signOut(_auth: Auth) {
  void _auth;
  await firebaseSignOut(requireAuth());
}

export async function getIdToken(): Promise<string> {
  const currentUser = requireAuth().currentUser;
  if (!currentUser) throw new Error("Sign in to refresh live flight data.");
  return currentUser.getIdToken();
}

export function doc(_db: Firestore, ...pathSegments: string[]): DocumentReference {
  return firestoreDoc(requireDb(), pathSegments.join("/"));
}

export async function setDoc(docRef: DocumentReference, data: Record<string, unknown>, options?: SetOptions) {
  await firestoreSetDoc(docRef, data, options ?? {});
}

export async function getDoc(docRef: DocumentReference) {
  return firestoreGetDoc(docRef);
}

export function onSnapshot(
  docRef: DocumentReference,
  onNext: (snapshot: Awaited<ReturnType<typeof firestoreGetDoc>>) => void,
  onError?: (error: Error) => void,
) {
  return firestoreOnSnapshot(docRef, onNext, onError);
}
