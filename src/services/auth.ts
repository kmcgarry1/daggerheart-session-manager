import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase";

const REDIRECT_KEY = "dh_auth_redirect";

const prefersRedirect = () =>
  window.matchMedia("(max-width: 720px)").matches ||
  window.matchMedia("(pointer: coarse)").matches;

const setRedirectAttempt = () => {
  try {
    sessionStorage.setItem(REDIRECT_KEY, "1");
  } catch {
    // Ignore storage failures.
  }
};

export const consumeRedirectAttempt = () => {
  try {
    const value = sessionStorage.getItem(REDIRECT_KEY);
    sessionStorage.removeItem(REDIRECT_KEY);
    return value === "1";
  } catch {
    return false;
  }
};

const signInWithProvider = async (provider: GoogleAuthProvider | OAuthProvider) => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    const authError = error as { code?: string };
    if (
      authError.code === "auth/popup-blocked" ||
      authError.code === "auth/popup-closed-by-user" ||
      authError.code === "auth/operation-not-supported-in-this-environment"
    ) {
      if (!prefersRedirect()) {
        throw error;
      }
      setRedirectAttempt();
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
};

export const signInWithGoogle = () => {
  const provider = new GoogleAuthProvider();
  return signInWithProvider(provider);
};

export const signInWithApple = () => {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return signInWithProvider(provider);
};

export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const signUpWithEmail = async ({
  displayName,
  email,
  password,
}: {
  displayName: string;
  email: string;
  password: string;
}) => {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const trimmedName = displayName.trim();
  if (trimmedName) {
    await updateProfile(credential.user, { displayName: trimmedName });
  }
  return credential.user;
};

export const signOutUser = () => signOut(auth);
