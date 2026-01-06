import { computed, ref } from "vue";
import { getRedirectResult, onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import {
  consumeRedirectAttempt,
  signInAnonymously,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
} from "../services/auth";
import {
  ensureUserProfile,
  fetchUserSessions,
  saveUserSession,
  type UserSessionRecord,
} from "../services/users";
import { getGuestIdentity, getMemberId, setGuestName } from "../services/guests";
import { reportError, trackFlow } from "../monitoring";

const authReady = ref(false);
const authBusy = ref(false);
const authError = ref<string | null>(null);
const authErrorCode = ref<string | null>(null);
const currentUser = ref<User | null>(null);
const guestIdentity = ref(getGuestIdentity());
const savedSessions = ref<UserSessionRecord[]>([]);
const loadingSavedSessions = ref(false);
const savedSessionsError = ref<string | null>(null);

let authReadyResolver: (() => void) | null = null;
const authReadyPromise = new Promise<void>((resolve) => {
  authReadyResolver = resolve;
});

let initialized = false;
let authUnsubscribe: (() => void) | null = null;
let guestAuthPromise: Promise<User | null> | null = null;

const isAnonymous = computed(() => currentUser.value?.isAnonymous ?? false);
const isSignedIn = computed(
  () => !!currentUser.value && !currentUser.value.isAnonymous,
);

const displayName = computed(() => {
  const name = currentUser.value?.displayName;
  if (typeof name === "string" && name.trim()) {
    return name;
  }
  const email = currentUser.value?.email;
  if (typeof email === "string" && email.includes("@")) {
    return email.split("@")[0] ?? email;
  }
  return guestIdentity.value.name.trim() || "Player";
});

const memberId = computed(() =>
  getMemberId(currentUser.value?.uid ?? null, guestIdentity.value.id),
);

const resolveAuthError = (error: unknown, fallback: string) => {
  const code = (error as { code?: string }).code;
  switch (code) {
    case "auth/email-already-in-use":
      return "That email already has an account.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is not enabled for this project.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for sign-in.";
    case "auth/web-storage-unsupported":
      return "Browser storage is blocked. Disable private mode or allow cookies.";
    case "auth/popup-blocked":
      return "Popup was blocked. Allow popups or try again.";
    case "auth/popup-closed-by-user":
      return "Popup was closed before sign-in completed.";
    case "auth/redirect-cancelled":
      return "Sign-in didn't complete. Try Safari or allow cookies.";
    default:
      return fallback;
  }
};

const setAuthError = (error: unknown, fallback: string) => {
  authErrorCode.value = extractErrorCode(error);
  authError.value = resolveAuthError(error, fallback);
};

const extractErrorCode = (error: unknown) =>
  (error as { code?: string }).code ?? null;

const trackAuth = (
  action: string,
  status: "success" | "failure",
  data?: Record<string, unknown>,
) => trackFlow("auth", status, { action, ...data });

const refreshSavedSessions = async () => {
  if (!currentUser.value || currentUser.value.isAnonymous) {
    savedSessions.value = [];
    return;
  }

  loadingSavedSessions.value = true;
  savedSessionsError.value = null;
  try {
    savedSessions.value = await fetchUserSessions(currentUser.value.uid);
  } catch (error) {
    reportError(error, { flow: "auth.sessions", action: "refresh" });
    savedSessionsError.value = "Unable to load saved sessions.";
  } finally {
    loadingSavedSessions.value = false;
  }
};

const init = () => {
  if (initialized) {
    return;
  }
  initialized = true;
  authErrorCode.value = null;
  authError.value = null;
  getRedirectResult(auth)
    .then((result) => {
      if (!result?.user && consumeRedirectAttempt()) {
        authErrorCode.value = "auth/redirect-cancelled";
        authError.value = resolveAuthError(
          { code: "auth/redirect-cancelled" },
          "Sign-in didn't complete. Please try again.",
        );
      }
    })
    .catch((error) => {
      reportError(error, { flow: "auth.redirect", action: "result" });
      setAuthError(error, "Sign-in failed. Please try again.");
    });
  authUnsubscribe = onAuthStateChanged(auth, async (user) => {
    currentUser.value = user;
    authReady.value = true;
    if (authReadyResolver) {
      authReadyResolver();
      authReadyResolver = null;
    }

    if (user && !user.isAnonymous) {
      try {
        await ensureUserProfile(user);
      } catch (error) {
        reportError(error, { flow: "auth.profile", action: "ensure" });
      }
      await refreshSavedSessions();
    } else {
      savedSessions.value = [];
    }
  });
};

const signIn = async () => {
  authBusy.value = true;
  authError.value = null;
  authErrorCode.value = null;
  try {
    await signInWithGoogle();
    trackAuth("sign_in_google", "success");
  } catch (error) {
    const code = extractErrorCode(error);
    reportError(error, { flow: "auth", action: "sign_in_google", code });
    trackAuth("sign_in_google", "failure", { code: code ?? "unknown" });
    setAuthError(error, "Sign-in failed. Please try again.");
  } finally {
    authBusy.value = false;
  }
};

const signInWithEmailAddress = async (email: string, password: string) => {
  authBusy.value = true;
  authError.value = null;
  authErrorCode.value = null;
  try {
    await signInWithEmail(email, password);
    trackAuth("sign_in_email", "success");
  } catch (error) {
    const code = extractErrorCode(error);
    reportError(error, { flow: "auth", action: "sign_in_email", code });
    trackAuth("sign_in_email", "failure", { code: code ?? "unknown" });
    setAuthError(error, "Email sign-in failed. Please try again.");
  } finally {
    authBusy.value = false;
  }
};

const signUpWithEmailAddress = async ({
  displayName: name,
  email,
  password,
}: {
  displayName: string;
  email: string;
  password: string;
}) => {
  authBusy.value = true;
  authError.value = null;
  authErrorCode.value = null;
  try {
    const user = await signUpWithEmail({ displayName: name, email, password });
    await ensureUserProfile(user);
    trackAuth("sign_up_email", "success");
  } catch (error) {
    const code = extractErrorCode(error);
    reportError(error, { flow: "auth", action: "sign_up_email", code });
    trackAuth("sign_up_email", "failure", { code: code ?? "unknown" });
    setAuthError(error, "Account creation failed. Please try again.");
  } finally {
    authBusy.value = false;
  }
};

const signOut = async () => {
  authBusy.value = true;
  authError.value = null;
  authErrorCode.value = null;
  try {
    await signOutUser();
    trackAuth("sign_out", "success");
  } catch (error) {
    const code = extractErrorCode(error);
    reportError(error, { flow: "auth", action: "sign_out", code });
    trackAuth("sign_out", "failure", { code: code ?? "unknown" });
    setAuthError(error, "Sign-out failed. Please try again.");
  } finally {
    authBusy.value = false;
  }
};

const updateGuestName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return;
  }
  setGuestName(trimmed);
  guestIdentity.value = {
    ...guestIdentity.value,
    name: trimmed,
  };
};

const ensureGuestAuth = async () => {
  if (!initialized) {
    init();
  }
  if (!authReady.value) {
    await authReadyPromise;
  }
  if (currentUser.value) {
    return currentUser.value;
  }
  if (guestAuthPromise) {
    return guestAuthPromise;
  }

  guestAuthPromise = signInAnonymously()
    .then((credential) => {
      // Don't set currentUser or authReady here - let onAuthStateChanged handle it
      trackAuth("sign_in_guest", "success");
      return credential.user;
    })
    .catch((error) => {
      const code = extractErrorCode(error);
      reportError(error, { flow: "auth", action: "sign_in_guest", code });
      trackAuth("sign_in_guest", "failure", { code: code ?? "unknown" });
      throw error;
    })
    .finally(() => {
      guestAuthPromise = null;
    });

  return guestAuthPromise;
};

const recordSession = async ({
  sessionId,
  code,
  name,
  role,
  codeExpiresAt,
  sessionExpiresAt,
}: {
  sessionId: string;
  code: string;
  name: string | null;
  role: "host" | "player";
  codeExpiresAt: Date;
  sessionExpiresAt: Date;
}) => {
  if (!currentUser.value || currentUser.value.isAnonymous) {
    return;
  }

  await saveUserSession({
    uid: currentUser.value.uid,
    sessionId,
    code,
    name,
    role,
    codeExpiresAt,
    sessionExpiresAt,
  });
};

const dispose = () => {
  if (authUnsubscribe) {
    authUnsubscribe();
    authUnsubscribe = null;
  }
};

export const useAuthStore = () => ({
  authReady,
  authBusy,
  authError,
  authErrorCode,
  currentUser,
  isAnonymous,
  isSignedIn,
  guestIdentity,
  savedSessions,
  loadingSavedSessions,
  savedSessionsError,
  displayName,
  memberId,
  init,
  dispose,
  signIn,
  signOut,
  signInWithEmail: signInWithEmailAddress,
  signUpWithEmail: signUpWithEmailAddress,
  refreshSavedSessions,
  updateGuestName,
  ensureGuestAuth,
  recordSession,
});
