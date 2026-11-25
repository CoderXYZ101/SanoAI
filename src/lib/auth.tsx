"use client";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  onIdTokenChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fbAuth } from "./firebase";
import { createUser, getUser, updateSettings, deleteAccount, type UserRow } from "./repo";
import { deleteUserFiles } from "./files";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  /** false until the email address is confirmed. Unverified users cannot touch the database (see firestore.rules). */
  verified: boolean;
  provider: "google" | "password";
}

interface AuthState {
  user: SessionUser | null;
  ready: boolean;
}
const Ctx = createContext<AuthState>({ user: null, ready: false });
export const useAuth = () => useContext(Ctx);

let resolved: SessionUser | null = null;
let readyPromise: Promise<void> | null = null;

const consentKey = (email: string) => `sano.pendingConsent.${email.toLowerCase()}`;
const providerOf = (u: User): SessionUser["provider"] => (u.providerData.some((p) => p.providerId === "google.com") ? "google" : "password");

// One profile creation per user at a time, so parallel auth callbacks cannot overwrite each other.
const inFlight = new Map<string, Promise<UserRow>>();
function ensureProfile(u: User): Promise<UserRow> {
  let p = inFlight.get(u.uid);
  if (!p) {
    p = (async () => {
      const existing = await getUser(u.uid);
      if (existing) return existing;
      const row = await createUser(u.uid, u.email ?? "", u.displayName || (u.email ?? "").split("@")[0] || "Friend");
      const key = consentKey(u.email ?? "");
      if (window.localStorage.getItem(key)) {
        await updateSettings(u.uid, { consentExternalAi: true });
        window.localStorage.removeItem(key);
      }
      return row;
    })().finally(() => inFlight.delete(u.uid));
    inFlight.set(u.uid, p);
  }
  return p;
}

async function toSession(u: User): Promise<SessionUser> {
  const base: SessionUser = { id: u.uid, email: u.email ?? "", name: u.displayName || (u.email ?? "").split("@")[0] || "Friend", verified: u.emailVerified, provider: providerOf(u) };
  if (!u.emailVerified) return base; // no database access before verification
  try {
    const row = await ensureProfile(u);
    return { ...base, name: row.name };
  } catch (e) {
    console.error("[auth] profile could not be loaded", e);
    return base;
  }
}

/** Resolves once Firebase has restored (or not) the previous session. */
export function authReady(): Promise<void> {
  return (readyPromise ??= new Promise<void>((resolve) => {
    const off = onAuthStateChanged(fbAuth(), async (u) => {
      resolved = u ? await toSession(u) : null;
      off();
      resolve();
    });
  }));
}

/** Current signed-in user (used by the in-browser API layer). */
export async function currentUser(): Promise<SessionUser | null> {
  await authReady();
  const u = fbAuth().currentUser;
  if (!u) return null;
  if (!resolved || resolved.id !== u.uid || resolved.verified !== u.emailVerified) resolved = await toSession(u);
  return resolved;
}

export async function getIdToken(): Promise<string | null> {
  return (await fbAuth().currentUser?.getIdToken()) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: false });
  useEffect(() => {
    // onIdTokenChanged also fires after email verification refreshes the token.
    return onIdTokenChanged(fbAuth(), async (u) => {
      if (!u) {
        resolved = null;
        setState({ user: null, ready: true });
        return;
      }
      const s = await toSession(u);
      resolved = s;
      setState({ user: s, ready: true });
    });
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

const FRIENDLY: Record<string, string> = {
  "auth/email-already-in-use": "An account with this email already exists. Try signing in.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/weak-password": "Use at least 10 characters, mixing lowercase letters with capitals or numbers.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/network-request-failed": "Can't reach the server. Check your connection and try again.",
  "auth/operation-not-allowed": "This sign-in method is not enabled for this Firebase project.",
  "auth/popup-closed-by-user": "Google sign-in was cancelled.",
  "auth/cancelled-popup-request": "Google sign-in was cancelled.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/unauthorized-domain": "This web address isn't authorised for Google sign-in (Firebase → Authentication → Settings → Authorised domains).",
  "auth/account-exists-with-different-credential": "This email already has an account. Sign in with your password instead.",
  "auth/user-mismatch": "That is a different Google account. Choose the one you are signed in with.",
};
export const authMessage = (e: unknown) => FRIENDLY[(e as { code?: string })?.code ?? ""] ?? ((e as Error)?.message || "Something went wrong.");

export function validatePassword(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (!/[a-z]/.test(pw) || !/[A-Z0-9]/.test(pw)) return "Mix lowercase letters with capitals or numbers.";
  return null;
}

export async function signUp(name: string, email: string, password: string, consentExternalAi: boolean): Promise<void> {
  const bad = validatePassword(password);
  if (bad) throw new Error(bad);
  if (!name.trim()) throw new Error("Please enter your name.");
  const cred = await createUserWithEmailAndPassword(fbAuth(), email.trim(), password);
  if (consentExternalAi) window.localStorage.setItem(consentKey(email.trim()), "1"); // applied once the email is verified
  await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
  await sendEmailVerification(cred.user).catch((e) => console.error("[auth] verification email not sent", e));
  resolved = null;
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(fbAuth(), email.trim(), password);
  resolved = null;
}

const google = () => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  return p;
};

/** Google accounts arrive with a verified email address, so no extra step is needed. */
export async function signInWithGoogle(consentExternalAi = false): Promise<void> {
  const cred = await signInWithPopup(fbAuth(), google());
  if (consentExternalAi && cred.user.emailVerified) {
    await ensureProfile(cred.user);
    await updateSettings(cred.user.uid, { consentExternalAi: true });
  }
  resolved = null;
}

export async function resendVerification(): Promise<void> {
  const u = fbAuth().currentUser;
  if (u) await sendEmailVerification(u);
}

/** Re-reads the account after the user clicked the email link; refreshes the token the database rules read. */
export async function refreshVerification(): Promise<boolean> {
  const u = fbAuth().currentUser;
  if (!u) return false;
  await u.reload();
  if (!u.emailVerified) return false;
  resolved = null;
  await u.getIdToken(true); // triggers onIdTokenChanged with email_verified=true
  return true;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(fbAuth(), email.trim());
}

export async function signOutUser(): Promise<void> {
  await signOut(fbAuth());
  resolved = null;
}

/**
 * Permanently deletes all data, then the Firebase Auth account. Re-confirms identity first:
 * password accounts supply the password; Google accounts confirm in a Google pop-up (call directly from a click).
 */
export async function deleteCurrentAccount(password?: string): Promise<void> {
  const u = fbAuth().currentUser;
  if (!u || !u.email) throw new Error("Please sign in again.");
  try {
    if (providerOf(u) === "google") await reauthenticateWithPopup(u, google());
    else await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password ?? ""));
  } catch (e) {
    if (providerOf(u) === "google") throw new Error(authMessage(e));
    throw new Error("Password incorrect. Your account was not deleted.");
  }
  await deleteUserFiles(u.uid);
  await deleteAccount(u.uid);
  await deleteUser(u);
  resolved = null;
}
