import { computed, ref } from "vue";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import { signInWithGoogle, signOutUser } from "../services/auth";
import {
  ensureUserProfile,
  fetchUserSessions,
  saveUserSession,
  type UserSessionRecord,
} from "../services/users";
import { getGuestIdentity, getMemberId, setGuestName } from "../services/guests";

const authReady = ref(false);
const authBusy = ref(false);
const authError = ref<string | null>(null);
const currentUser = ref<User | null>(null);
const guestIdentity = ref(getGuestIdentity());
const savedSessions = ref<UserSessionRecord[]>([]);
const loadingSavedSessions = ref(false);
const savedSessionsError = ref<string | null>(null);

let initialized = false;
let authUnsubscribe: (() => void) | null = null;

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

const refreshSavedSessions = async () => {
  if (!currentUser.value) {
    savedSessions.value = [];
    return;
  }

  loadingSavedSessions.value = true;
  savedSessionsError.value = null;
  try {
    savedSessions.value = await fetchUserSessions(currentUser.value.uid);
  } catch (error) {
    console.error(error);
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
  authUnsubscribe = onAuthStateChanged(auth, async (user) => {
    currentUser.value = user;
    authReady.value = true;

    if (user) {
      try {
        await ensureUserProfile(user);
      } catch (error) {
        console.error(error);
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
  try {
    await signInWithGoogle();
  } catch (error) {
    console.error(error);
    authError.value = "Sign-in failed. Please try again.";
  } finally {
    authBusy.value = false;
  }
};

const signOut = async () => {
  authBusy.value = true;
  authError.value = null;
  try {
    await signOutUser();
  } catch (error) {
    console.error(error);
    authError.value = "Sign-out failed. Please try again.";
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
  if (!currentUser.value) {
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
  currentUser,
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
  refreshSavedSessions,
  updateGuestName,
  recordSession,
});
