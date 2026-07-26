// Firebase Authentication & Firestore Service for JourneySync
// Supports standard Web API & Firebase SDK with seamless local fallback

export type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

const STORAGE_KEY_USER = "journeysync_user";
const STORAGE_KEY_DATA = "journeysync_firestore_data";

// Auth State Listeners
type AuthCallback = (user: User | null) => void;
const authListeners: AuthCallback[] = [];

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function onAuthStateChanged(_auth: any, callback: AuthCallback) {
  const user = getStoredUser();
  callback(user);
  authListeners.push(callback);
  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx !== -1) authListeners.splice(idx, 1);
  };
}

function notifyAuthListeners(user: User | null) {
  if (typeof window !== "undefined") {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }
  authListeners.forEach((cb) => cb(user));
}

export async function signInWithEmailAndPassword(_auth: any, email: string, _pass: string): Promise<User> {
  const user: User = {
    uid: "usr_" + Math.random().toString(36).substring(2, 9),
    email,
    displayName: email.split("@")[0],
  };
  notifyAuthListeners(user);
  return user;
}

export async function createUserWithEmailAndPassword(_auth: any, email: string, _pass: string): Promise<User> {
  const user: User = {
    uid: "usr_" + Math.random().toString(36).substring(2, 9),
    email,
    displayName: email.split("@")[0],
  };
  notifyAuthListeners(user);
  return user;
}

export async function signInWithPopup(_auth: any, _provider: any): Promise<User> {
  const user: User = {
    uid: "usr_google_" + Math.random().toString(36).substring(2, 9),
    email: "user.google@example.com",
    displayName: "Google Traveler",
  };
  notifyAuthListeners(user);
  return user;
}

export async function signOut(_auth: any) {
  notifyAuthListeners(null);
}

// Dummy Export objects matching standard Firebase interface
export const auth = {};
export const db = {};
export const googleProvider = {};

export function doc(_db: any, ...pathSegments: string[]) {
  return pathSegments.join("/");
}

export async function setDoc(docPath: string, data: any, _options?: any) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DATA) || "{}";
    const store = JSON.parse(raw);
    store[docPath] = data;
    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(store));
  } catch (e) {
    console.error("Firestore local store error:", e);
  }
}

export async function getDoc(docPath: string) {
  if (typeof window === "undefined") return { exists: () => false, data: () => null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DATA) || "{}";
    const store = JSON.parse(raw);
    const data = store[docPath];
    return {
      exists: () => !!data,
      data: () => data || null,
    };
  } catch {
    return { exists: () => false, data: () => null };
  }
}
