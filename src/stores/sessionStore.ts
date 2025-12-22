import { computed, ref } from "vue";
import {
  addCountdown,
  createSession,
  fetchSessionById,
  findSessionByCode,
  joinSession,
  removeCountdown,
  subscribeToCountdowns,
  subscribeToMembers,
  subscribeToSession,
  updateCountdown,
  updateFear,
  type CountdownData,
  type MemberData,
  type SessionData,
} from "../services/sessions";
import { useAuthStore } from "./authStore";

const activeSessionId = ref<string | null>(null);
const activeSession = ref<SessionData | null>(null);
const countdowns = ref<CountdownData[]>([]);
const members = ref<MemberData[]>([]);
const sessionError = ref<string | null>(null);
const sessionLoading = ref(false);
const countdownError = ref<string | null>(null);

let sessionUnsubscribe: (() => void) | null = null;
let countdownUnsubscribe: (() => void) | null = null;
let membersUnsubscribe: (() => void) | null = null;

const isHost = computed(() => {
  const authStore = useAuthStore();
  return activeSession.value?.host.memberId === authStore.memberId.value;
});

const clearSubscriptions = () => {
  if (sessionUnsubscribe) {
    sessionUnsubscribe();
    sessionUnsubscribe = null;
  }
  if (countdownUnsubscribe) {
    countdownUnsubscribe();
    countdownUnsubscribe = null;
  }
  if (membersUnsubscribe) {
    membersUnsubscribe();
    membersUnsubscribe = null;
  }
};

const resetSessionState = () => {
  activeSessionId.value = null;
  activeSession.value = null;
  countdowns.value = [];
  members.value = [];
  sessionLoading.value = false;
};

const isExpired = (date: Date) => date.getTime() <= Date.now();

const startSessionListeners = (sessionId: string) => {
  clearSubscriptions();
  sessionLoading.value = true;

  sessionUnsubscribe = subscribeToSession(
    sessionId,
    (session) => {
      sessionLoading.value = false;
      if (!session) {
        sessionError.value = "That session has ended.";
        clearSubscriptions();
        resetSessionState();
        return;
      }
      activeSession.value = session;
      sessionError.value = null;
    },
    (error) => {
      console.error(error);
      sessionError.value = "Unable to sync the session.";
      sessionLoading.value = false;
    },
  );

  countdownUnsubscribe = subscribeToCountdowns(
    sessionId,
    (nextCountdowns) => {
      countdowns.value = nextCountdowns;
    },
    (error) => {
      console.error(error);
      sessionError.value = "Unable to load countdowns.";
    },
  );

  membersUnsubscribe = subscribeToMembers(
    sessionId,
    (nextMembers) => {
      members.value = nextMembers;
    },
    (error) => {
      console.error(error);
      sessionError.value = "Unable to load session members.";
    },
  );
};

const createSessionFlow = async ({
  hostName,
  sessionName,
}: {
  hostName: string;
  sessionName?: string;
}) => {
  const authStore = useAuthStore();
  const trimmedHost = hostName.trim();
  if (!trimmedHost) {
    throw new Error("Host name is required.");
  }

  const result = await createSession({
    hostName: trimmedHost,
    sessionName,
    hostUid: authStore.currentUser.value?.uid ?? null,
    hostMemberId: authStore.memberId.value,
  });

  if (!authStore.currentUser.value) {
    authStore.updateGuestName(trimmedHost);
  }

  if (authStore.currentUser.value) {
    await authStore.recordSession({
      sessionId: result.id,
      code: result.code,
      name: sessionName?.trim() || null,
      role: "host",
      codeExpiresAt: result.codeExpiresAt,
      sessionExpiresAt: result.sessionExpiresAt,
    });
    await authStore.refreshSavedSessions();
  }

  activeSessionId.value = result.id;
  startSessionListeners(result.id);
  return result.id;
};

const joinSessionFlow = async ({
  joinCode,
  name,
}: {
  joinCode: string;
  name: string;
}) => {
  const authStore = useAuthStore();
  const session = await findSessionByCode(joinCode);
  if (!session) {
    throw new Error("That join code does not match an active session.");
  }

  if (isExpired(session.sessionExpiresAt)) {
    throw new Error("That session has expired.");
  }

  if (isExpired(session.codeExpiresAt)) {
    throw new Error("That join code has expired.");
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Display name is required.");
  }

  const role =
    session.host.memberId === authStore.memberId.value ? "host" : "player";

  await joinSession({
    sessionId: session.id,
    memberId: authStore.memberId.value,
    name: trimmedName,
    uid: authStore.currentUser.value?.uid ?? null,
    role,
  });

  if (!authStore.currentUser.value) {
    authStore.updateGuestName(trimmedName);
  }

  if (authStore.currentUser.value) {
    await authStore.recordSession({
      sessionId: session.id,
      code: session.code,
      name: session.name,
      role,
      codeExpiresAt: session.codeExpiresAt,
      sessionExpiresAt: session.sessionExpiresAt,
    });
    await authStore.refreshSavedSessions();
  }

  activeSessionId.value = session.id;
  startSessionListeners(session.id);
  return session.id;
};

const resumeSession = async ({
  sessionId,
  role,
  fallbackName,
}: {
  sessionId: string;
  role: "host" | "player";
  fallbackName: string;
}) => {
  const authStore = useAuthStore();
  const session = await fetchSessionById(sessionId);
  if (!session) {
    throw new Error("That session is no longer available.");
  }

  if (isExpired(session.sessionExpiresAt)) {
    throw new Error("That session has expired.");
  }

  const trimmedName = fallbackName.trim();
  if (!trimmedName) {
    throw new Error("Enter a display name before resuming.");
  }

  const resolvedRole =
    session.host.memberId === authStore.memberId.value ? "host" : role;

  await joinSession({
    sessionId: session.id,
    memberId: authStore.memberId.value,
    name: trimmedName,
    uid: authStore.currentUser.value?.uid ?? null,
    role: resolvedRole,
  });

  await authStore.recordSession({
    sessionId: session.id,
    code: session.code,
    name: session.name,
    role: resolvedRole,
    codeExpiresAt: session.codeExpiresAt,
    sessionExpiresAt: session.sessionExpiresAt,
  });
  await authStore.refreshSavedSessions();

  activeSessionId.value = session.id;
  startSessionListeners(session.id);
  return session.id;
};

const leaveSession = () => {
  clearSubscriptions();
  resetSessionState();
  sessionError.value = null;
  countdownError.value = null;
};

const setFear = async (value: number) => {
  if (!activeSessionId.value || !isHost.value) {
    return;
  }

  try {
    await updateFear(activeSessionId.value, value);
  } catch (error) {
    console.error(error);
    sessionError.value = "Unable to update fear right now.";
  }
};

const addSessionCountdown = async ({
  name,
  max,
  createdBy,
}: {
  name: string;
  max: number;
  createdBy: {
    name: string;
    uid: string | null;
    memberId: string;
    isGuest: boolean;
  };
}) => {
  if (!activeSessionId.value || !isHost.value) {
    return;
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    countdownError.value = "Countdown name is required.";
    return;
  }

  if (!max || max < 1) {
    countdownError.value = "Countdown max must be at least 1.";
    return;
  }

  try {
    countdownError.value = null;
    await addCountdown(activeSessionId.value, {
      name: trimmedName,
      max,
      createdBy,
    });
  } catch (error) {
    console.error(error);
    countdownError.value = "Unable to add that countdown.";
  }
};

const setCountdown = async (countdown: CountdownData, value: number) => {
  if (!activeSessionId.value || !isHost.value) {
    return;
  }

  const nextValue = Math.min(Math.max(value, 0), countdown.max);
  try {
    await updateCountdown(activeSessionId.value, countdown.id, nextValue);
  } catch (error) {
    console.error(error);
    sessionError.value = "Unable to update countdown.";
  }
};

const deleteCountdown = async (countdown: CountdownData) => {
  if (!activeSessionId.value || !isHost.value) {
    return;
  }

  try {
    await removeCountdown(activeSessionId.value, countdown.id);
  } catch (error) {
    console.error(error);
    sessionError.value = "Unable to remove countdown.";
  }
};

export const useSessionStore = () => ({
  activeSessionId,
  activeSession,
  countdowns,
  members,
  sessionError,
  sessionLoading,
  countdownError,
  isHost,
  createSessionFlow,
  joinSessionFlow,
  resumeSession,
  leaveSession,
  setFear,
  addSessionCountdown,
  setCountdown,
  deleteCountdown,
});
