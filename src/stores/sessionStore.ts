import { computed, ref, watch } from "vue";
import {
  HEARTBEAT_INTERVAL_MS,
  STALE_MEMBER_THRESHOLD_MS,
  addCountdown,
  createSession,
  fetchSessionById,
  fetchMemberFromSession,
  findSessionByCode,
  joinSession,
  removeCountdown,
  removeStaleMembers,
  subscribeToCountdowns,
  subscribeToMembers,
  subscribeToSession,
  updateCountdown,
  updateFear,
  updateMemberHeartbeat,
  type CountdownData,
  type MemberData,
  type SessionData,
} from "../services/sessions";
import { useAuthStore } from "./authStore";
import { reportError, trackFlow } from "../monitoring";

const ACTIVE_SESSION_KEY = "dh_active_session_id";
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
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let staleCleanupInterval: ReturnType<typeof setInterval> | null = null;
let initialized = false;

const isHost = computed(() => {
  const authStore = useAuthStore();
  return activeSession.value?.host.memberId === authStore.memberId.value;
});

const membersWithPresence = computed(() => {
  const now = Date.now();
  const staleThreshold = now - STALE_MEMBER_THRESHOLD_MS;
  
  return members.value.map((member) => {
    const lastSeenTime = member.lastSeenAt?.getTime();
    // Members without lastSeenAt just joined and haven't had a heartbeat yet - consider them active
    const isActive = !lastSeenTime || lastSeenTime > staleThreshold;
    
    return {
      ...member,
      isActive,
    };
  });
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
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (staleCleanupInterval) {
    clearInterval(staleCleanupInterval);
    staleCleanupInterval = null;
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

const getStoredSessionId = () => {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = localStorage.getItem(ACTIVE_SESSION_KEY);
  if (!stored) {
    return null;
  }
  const trimmed = stored.trim();
  return trimmed ? trimmed : null;
};

const persistActiveSessionId = (sessionId: string | null) => {
  if (typeof window === "undefined") {
    return;
  }
  if (sessionId) {
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
  } else {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
};

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
      reportError(error, { flow: "session.subscribe", action: "session" });
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
      reportError(error, { flow: "session.subscribe", action: "countdowns" });
      sessionError.value = "Unable to load countdowns.";
    },
  );

  membersUnsubscribe = subscribeToMembers(
    sessionId,
    (nextMembers) => {
      members.value = nextMembers;
    },
    (error) => {
      reportError(error, { flow: "session.subscribe", action: "members" });
      sessionError.value = "Unable to load session members.";
    },
  );

  const authStore = useAuthStore();
  const memberId = authStore.memberId.value;

  // Start heartbeat to update lastSeenAt periodically
  heartbeatInterval = setInterval(async () => {
    try {
      await updateMemberHeartbeat(sessionId, memberId);
    } catch (error) {
      console.error("Failed to update heartbeat:", error);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Cleanup stale members periodically (only host does this)
  staleCleanupInterval = setInterval(async () => {
    // Check host status on each interval in case it changes
    if (isHost.value) {
      try {
        await removeStaleMembers(sessionId);
      } catch (error) {
        console.error("Failed to cleanup stale members:", error);
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
};

const restoreActiveSession = async (sessionId: string) => {
  sessionLoading.value = true;
  sessionError.value = null;

  try {
    const session = await fetchSessionById(sessionId);
    if (activeSessionId.value !== sessionId) {
      return;
    }
    if (!session || isExpired(session.sessionExpiresAt)) {
      clearSubscriptions();
      resetSessionState();
      return;
    }

    activeSession.value = session;
    startSessionListeners(session.id);
  } catch (error) {
    if (activeSessionId.value !== sessionId) {
      return;
    }
    reportError(error, { flow: "session.restore", action: "fetch" });
    sessionError.value = "Unable to restore the session.";
    sessionLoading.value = false;
    activeSession.value = null;
    countdowns.value = [];
    members.value = [];
  }
};

const init = () => {
  if (initialized) {
    return;
  }
  initialized = true;

  const storedSessionId = getStoredSessionId();
  if (storedSessionId) {
    activeSessionId.value = storedSessionId;
    void restoreActiveSession(storedSessionId);
  }

  watch(
    activeSessionId,
    (value) => {
      persistActiveSessionId(value);
    },
    { immediate: true },
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
    trackFlow("session.create", "failure", { reason: "missing_host" });
    throw new Error("Host name is required.");
  }

  const hasSessionName = Boolean(sessionName?.trim());
  let isGuest: boolean | undefined;
  try {
    await authStore.ensureGuestAuth();
    isGuest = !authStore.isSignedIn.value;
    const result = await createSession({
      hostName: trimmedHost,
      sessionName,
      hostUid: authStore.currentUser.value?.uid ?? null,
      hostMemberId: authStore.memberId.value,
      hostIsGuest: isGuest,
    });

    if (isGuest) {
      authStore.updateGuestName(trimmedHost);
    }

    if (authStore.isSignedIn.value) {
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
    trackFlow("session.create", "success", { isGuest, hasSessionName });
    return result.id;
  } catch (error) {
    const code = (error as { code?: string }).code ?? null;
    reportError(error, { flow: "session.create", action: "create", code });
    trackFlow("session.create", "failure", {
      isGuest,
      hasSessionName,
      code: code ?? "unknown",
    });
    throw error;
  }
};

const joinSessionFlow = async ({
  joinCode,
  name,
}: {
  joinCode: string;
  name: string;
}) => {
  const authStore = useAuthStore();
  try {
    await authStore.ensureGuestAuth();
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

    const isGuest = !authStore.isSignedIn.value;
    await joinSession({
      sessionId: session.id,
      memberId: authStore.memberId.value,
      name: trimmedName,
      uid: authStore.currentUser.value?.uid ?? null,
      role,
      isGuest,
    });

    if (isGuest) {
      authStore.updateGuestName(trimmedName);
    }

    if (authStore.isSignedIn.value) {
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
  } catch (error) {
    const code = (error as { code?: string }).code ?? null;
    reportError(error, { flow: "session.join", action: "join", code });
    throw error;
  }
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
  try {
    await authStore.ensureGuestAuth();
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
      isGuest: !authStore.isSignedIn.value,
    });

    if (authStore.isSignedIn.value) {
      await authStore.recordSession({
        sessionId: session.id,
        code: session.code,
        name: session.name,
        role: resolvedRole,
        codeExpiresAt: session.codeExpiresAt,
        sessionExpiresAt: session.sessionExpiresAt,
      });
      await authStore.refreshSavedSessions();
    }

    activeSessionId.value = session.id;
    startSessionListeners(session.id);
    return session.id;
  } catch (error) {
    const code = (error as { code?: string }).code ?? null;
    reportError(error, { flow: "session.resume", action: "resume", code });
    throw error;
  }
};

const attemptSessionRestore = async (sessionId: string) => {
  // Don't attempt if we're already in this session
  if (activeSessionId.value === sessionId) {
    return { success: true, requiresJoin: false };
  }

  const authStore = useAuthStore();
  sessionLoading.value = true;
  sessionError.value = null;

  try {
    await authStore.ensureGuestAuth();
    
    // Fetch the session to see if it exists and is valid
    const session = await fetchSessionById(sessionId);
    if (!session) {
      sessionError.value = "Session not found.";
      return { success: false, requiresJoin: true, error: "Session not found." };
    }

    if (isExpired(session.sessionExpiresAt)) {
      sessionError.value = "Session has expired.";
      return { success: false, requiresJoin: false, error: "Session has expired." };
    }

    // Check if user is already a member
    const memberId = authStore.memberId.value;
    const existingMember = await fetchMemberFromSession(sessionId, memberId);

    if (existingMember) {
      // User is already a member, restore the session
      activeSessionId.value = sessionId;
      activeSession.value = session;
      
      // Update heartbeat immediately to mark as active
      try {
        await updateMemberHeartbeat(sessionId, memberId);
      } catch (error) {
        console.error("Failed to update heartbeat on restore:", error);
      }
      
      startSessionListeners(sessionId);
      
      // Update saved session for signed-in users
      if (authStore.isSignedIn.value) {
        await authStore.recordSession({
          sessionId: session.id,
          code: session.code,
          name: session.name,
          role: existingMember.role,
          codeExpiresAt: session.codeExpiresAt,
          sessionExpiresAt: session.sessionExpiresAt,
        });
      }
      
      return { success: true, requiresJoin: false };
    }

    // User is not a member, they need to join
    return { 
      success: false, 
      requiresJoin: true, 
      sessionData: session,
    };
  } catch (error) {
    reportError(error, { flow: "session.restore_url", action: "attempt" });
    sessionError.value = "Unable to access session.";
    return { 
      success: false, 
      requiresJoin: false, 
      error: "Unable to access session.",
    };
  } finally {
    sessionLoading.value = false;
  }
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
    reportError(error, { flow: "session.fear", action: "update" });
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
    reportError(error, { flow: "session.countdown", action: "add" });
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
    reportError(error, { flow: "session.countdown", action: "update" });
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
    reportError(error, { flow: "session.countdown", action: "delete" });
    sessionError.value = "Unable to remove countdown.";
  }
};

export const useSessionStore = () => ({
  activeSessionId,
  activeSession,
  countdowns,
  members,
  membersWithPresence,
  sessionError,
  sessionLoading,
  countdownError,
  isHost,
  init,
  createSessionFlow,
  joinSessionFlow,
  resumeSession,
  attemptSessionRestore,
  leaveSession,
  setFear,
  addSessionCountdown,
  setCountdown,
  deleteCountdown,
});
