"use client";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, type Firestore } from "firebase/firestore";

/**
 * Firebase web config. These NEXT_PUBLIC_* values are PUBLIC identifiers by design (not secrets) —
 * access control is enforced by Firestore security rules (firestore.rules) and Firebase Auth.
 */
const demo = { apiKey: "demo-api-key", authDomain: "demo-sanoai.firebaseapp.com", projectId: "demo-sanoai", appId: "demo-app-id" };

/** Emulator builds always use the demo project, so local testing can never touch the real one. */
const config = () =>
  usingEmulators()
    ? demo
    : {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || demo.apiKey,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || demo.authDomain,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || demo.projectId,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || demo.appId,
      };

export const usingEmulators = () => process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
export const firebaseConfigured = () => usingEmulators() || Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function fbApp(): FirebaseApp {
  return (app ??= getApps().length ? getApp() : initializeApp(config()));
}
export function fbAuth(): Auth {
  if (!auth) {
    auth = getAuth(fbApp());
    if (usingEmulators()) {
      try {
        connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      } catch {
        /* already connected */
      }
    }
  }
  return auth;
}
export function fbDb(): Firestore {
  if (!db) {
    db = initializeFirestore(fbApp(), { ignoreUndefinedProperties: true });
    if (usingEmulators()) {
      try {
        connectFirestoreEmulator(db, "127.0.0.1", 8080);
      } catch {
        /* already connected */
      }
    }
  }
  return db;
}
