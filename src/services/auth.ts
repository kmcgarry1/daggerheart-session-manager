import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";

const prefersRedirect = () =>
  window.matchMedia("(max-width: 720px)").matches ||
  window.matchMedia("(pointer: coarse)").matches;

const signInWithProvider = async (provider: GoogleAuthProvider | OAuthProvider) => {
  if (prefersRedirect()) {
    await signInWithRedirect(auth, provider);
    return;
  }

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    const authError = error as { code?: string };
    if (
      authError.code === "auth/popup-blocked" ||
      authError.code === "auth/popup-closed-by-user" ||
      authError.code === "auth/operation-not-supported-in-this-environment"
    ) {
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

export const signOutUser = () => signOut(auth);
