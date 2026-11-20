/**
 * Firebase app initialization for EduConnect360.
 *
 * Configuration values are read from Vite environment variables so no
 * secrets are hard-coded in source. Firebase web config values are
 * public identifiers (safe to ship in a client bundle); access control
 * is enforced server-side via Firebase Auth + Firestore/Storage rules.
 */
import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";
import { type Firestore, getFirestore } from "firebase/firestore";
import { type FirebaseStorage, getStorage } from "firebase/storage";

const requiredEnvVars = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCSvi6-C3Gar4Fkb9EsxjbR5DVJ44o41AI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "educonnect360-d5c47.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "educonnect360-d5c47",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "educonnect360-d5c47.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "296532522863",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:296532522863:web:8fc1b0b22fd4b1fb839a9a",
} as const;

const missingKeys = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value)
  .map(([key]) => key);

/** Whether all required Firebase environment variables are present. */
export const isFirebaseConfigured = missingKeys.length === 0;

if (!isFirebaseConfigured) {
  // Don't throw: allow the app shell to render and surface a clear status
  // message instead of a blank white screen.
  console.error(
    `Firebase is not configured. Missing environment variables: ${missingKeys.join(", ")}`,
  );
}

const firebaseConfig = requiredEnvVars;

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

if (isFirebaseConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage, firebaseConfig };
