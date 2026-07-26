// Firebase Authentication & Firestore Service for JourneySync
// Wraps the real Firebase SDK behind the same interface the app already uses.
// Config comes from NEXT_PUBLIC_FIREBASE_* env vars (see .env.local.example).

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
  doc as firestoreDoc,
  setDoc as firestoreSetDoc,
  getDoc as firestoreGetDoc,
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
};

const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const CONFIG_ERROR =
  "Firebase is not configured. Copy .env.local.example to .env.local, fill in your Firebase project credentials, and restart the dev server.";

// Only touch the Firebase SDK in the browser: this module is imported by a
// "use client" component, but that component's initial render still happens
// server-side, where window/indexedDB aren't available.
let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

if (typeof window !== "undefined") {
  if (isConfigured) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
  } else {
    console.error(CONFIG_ERROR);
  }
}

export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;
export const googleProvider = new GoogleAuthProvider();

function requireAuth(): Auth {
  if (!authInstance) throw new Error(CONFIG_ERROR);
  return authInstance;
}

function requireDb(): Firestore {
  if (!dbInstance) throw new Error(CONFIG_ERROR);
  return dbInstance;
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for API-compat with real Firebase's signOut(auth) signature
export async function signOut(_auth: Auth) {
  await firebaseSignOut(requireAuth());
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
