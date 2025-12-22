<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "./firebase";
import { signInWithApple, signInWithGoogle, signOutUser } from "./services/auth";
import { getGuestIdentity, getMemberId, setGuestName } from "./services/guests";
import {
  addCountdown,
  createSession,
  fetchSessionById,
  findSessionByCode,
  joinSession,
  removeCountdown,
  subscribeToCountdowns,
  subscribeToSession,
  updateCountdown,
  updateFear,
  type CountdownData,
  type SessionData,
} from "./services/sessions";
import {
  ensureUserProfile,
  fetchUserSessions,
  saveUserSession,
  type UserSessionRecord,
} from "./services/users";
import CountdownCard from "./components/CountdownCard.vue";
import FearTracker from "./components/FearTracker.vue";

const authReady = ref(false);
const authBusy = ref(false);
const authError = ref<string | null>(null);
const currentUser = ref<User | null>(null);

const guestIdentity = ref(getGuestIdentity());

const hostName = ref("");
const sessionName = ref("");
const joinName = ref("");
const joinCode = ref("");

const createError = ref<string | null>(null);
const joinError = ref<string | null>(null);
const sessionError = ref<string | null>(null);
const countdownError = ref<string | null>(null);

const creating = ref(false);
const joining = ref(false);

const activeSessionId = ref<string | null>(null);
const activeSession = ref<SessionData | null>(null);
const countdowns = ref<CountdownData[]>([]);
const sessionLoading = ref(false);

const fearMinimized = ref(false);
const showCountdownForm = ref(false);
const countdownName = ref("");
const countdownMax = ref(6);

const savedSessions = ref<UserSessionRecord[]>([]);
const loadingSavedSessions = ref(false);
const savedSessionsError = ref<string | null>(null);

const copyStatus = ref<"idle" | "copied" | "failed">("idle");

const memberId = computed(() =>
  getMemberId(currentUser.value?.uid ?? null, guestIdentity.value.id),
);

const displayName = computed(() => {
  if (currentUser.value?.displayName) {
    return currentUser.value.displayName;
  }
  if (currentUser.value?.email) {
    return currentUser.value.email.split("@")[0];
  }
  return guestIdentity.value.name;
});

const canCreate = computed(() => hostName.value.trim().length > 0 && !creating.value);
const canJoin = computed(
  () =>
    joinCode.value.trim().length > 0 &&
    joinName.value.trim().length > 0 &&
    !joining.value,
);

const isHost = computed(
  () => activeSession.value?.host.memberId === memberId.value,
);

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);

const sessionExpiresLabel = computed(() =>
  activeSession.value ? formatDateTime(activeSession.value.sessionExpiresAt) : "",
);

const codeExpiresLabel = computed(() =>
  activeSession.value ? formatDateTime(activeSession.value.codeExpiresAt) : "",
);

const stopSessionListeners = () => {
  activeSessionId.value = null;
  activeSession.value = null;
  countdowns.value = [];
  sessionLoading.value = false;
};

let sessionUnsubscribe: (() => void) | null = null;
let countdownUnsubscribe: (() => void) | null = null;

const clearSubscriptions = () => {
  if (sessionUnsubscribe) {
    sessionUnsubscribe();
    sessionUnsubscribe = null;
  }
  if (countdownUnsubscribe) {
    countdownUnsubscribe();
    countdownUnsubscribe = null;
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
        stopSessionListeners();
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
};

const isExpired = (date: Date) => date.getTime() <= Date.now();

const loadSavedSessions = async () => {
  if (!currentUser.value) {
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

const ensureNames = () => {
  if (displayName.value && !hostName.value) {
    hostName.value = displayName.value;
  }
  if (displayName.value && !joinName.value) {
    joinName.value = displayName.value;
  }
};

watch(currentUser, () => {
  ensureNames();
});

watch(
  () => guestIdentity.value.name,
  () => {
    ensureNames();
  },
);

const handleAuth = async (provider: "google" | "apple") => {
  authBusy.value = true;
  authError.value = null;
  try {
    if (provider === "google") {
      await signInWithGoogle();
    } else {
      await signInWithApple();
    }
  } catch (error) {
    console.error(error);
    authError.value = "Sign-in failed. Please try again.";
  } finally {
    authBusy.value = false;
  }
};

const handleSignOut = async () => {
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

const handleCreateSession = async () => {
  if (!canCreate.value) {
    return;
  }
  creating.value = true;
  createError.value = null;
  copyStatus.value = "idle";

  try {
    const result = await createSession({
      hostName: hostName.value,
      sessionName: sessionName.value,
      hostUid: currentUser.value?.uid ?? null,
      hostMemberId: memberId.value,
    });

    if (!currentUser.value) {
      setGuestName(hostName.value);
      guestIdentity.value = {
        ...guestIdentity.value,
        name: hostName.value.trim(),
      };
    }

    if (currentUser.value) {
      await saveUserSession({
        uid: currentUser.value.uid,
        sessionId: result.id,
        code: result.code,
        name: sessionName.value.trim() || null,
        role: "host",
        codeExpiresAt: result.codeExpiresAt,
        sessionExpiresAt: result.sessionExpiresAt,
      });
      await loadSavedSessions();
    }

    activeSessionId.value = result.id;
    startSessionListeners(result.id);
  } catch (err) {
    console.error(err);
    createError.value = "Unable to create a session right now. Please try again.";
  } finally {
    creating.value = false;
  }
};

const handleJoinSession = async () => {
  if (!canJoin.value) {
    return;
  }
  joining.value = true;
  joinError.value = null;
  copyStatus.value = "idle";

  try {
    const session = await findSessionByCode(joinCode.value);
    if (!session) {
      joinError.value = "That join code does not match an active session.";
      joining.value = false;
      return;
    }

    if (isExpired(session.sessionExpiresAt)) {
      joinError.value = "That session has expired.";
      joining.value = false;
      return;
    }

    if (isExpired(session.codeExpiresAt)) {
      joinError.value = "That join code has expired.";
      joining.value = false;
      return;
    }

    const role = session.host.memberId === memberId.value ? "host" : "player";

    await joinSession({
      sessionId: session.id,
      memberId: memberId.value,
      name: joinName.value,
      uid: currentUser.value?.uid ?? null,
      role,
    });

    if (!currentUser.value) {
      setGuestName(joinName.value);
      guestIdentity.value = {
        ...guestIdentity.value,
        name: joinName.value.trim(),
      };
    }

    if (currentUser.value) {
      await saveUserSession({
        uid: currentUser.value.uid,
        sessionId: session.id,
        code: session.code,
        name: session.name,
        role,
        codeExpiresAt: session.codeExpiresAt,
        sessionExpiresAt: session.sessionExpiresAt,
      });
      await loadSavedSessions();
    }

    activeSessionId.value = session.id;
    startSessionListeners(session.id);
  } catch (err) {
    console.error(err);
    joinError.value = "Unable to join that session right now.";
  } finally {
    joining.value = false;
  }
};

const handleResumeSession = async (sessionRecord: UserSessionRecord) => {
  joinError.value = null;
  sessionError.value = null;
  sessionLoading.value = true;

  try {
    const session = await fetchSessionById(sessionRecord.id);
    if (!session) {
      joinError.value = "That session is no longer available.";
      sessionLoading.value = false;
      return;
    }

    if (isExpired(session.sessionExpiresAt)) {
      joinError.value = "That session has expired.";
      sessionLoading.value = false;
      return;
    }

    const name = joinName.value.trim() || hostName.value.trim() || displayName.value;
    if (!name) {
      joinError.value = "Enter a display name before resuming.";
      sessionLoading.value = false;
      return;
    }

    const role = session.host.memberId === memberId.value ? "host" : sessionRecord.role;

    await joinSession({
      sessionId: session.id,
      memberId: memberId.value,
      name,
      uid: currentUser.value?.uid ?? null,
      role,
    });

    if (currentUser.value) {
      await saveUserSession({
        uid: currentUser.value.uid,
        sessionId: session.id,
        code: session.code,
        name: session.name,
        role,
        codeExpiresAt: session.codeExpiresAt,
        sessionExpiresAt: session.sessionExpiresAt,
      });
      await loadSavedSessions();
    }

    activeSessionId.value = session.id;
    startSessionListeners(session.id);
  } catch (error) {
    console.error(error);
    sessionError.value = "Unable to resume that session.";
  } finally {
    sessionLoading.value = false;
  }
};

const leaveSession = () => {
  clearSubscriptions();
  stopSessionListeners();
  sessionError.value = null;
  showCountdownForm.value = false;
  countdownError.value = null;
};

const copyCode = async () => {
  if (!activeSession.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(activeSession.value.code);
    copyStatus.value = "copied";
  } catch (err) {
    console.error(err);
    copyStatus.value = "failed";
  } finally {
    window.setTimeout(() => {
      copyStatus.value = "idle";
    }, 2000);
  }
};

const handleSetFear = async (value: number) => {
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

const handleAddCountdown = async () => {
  if (!activeSessionId.value || !isHost.value) {
    return;
  }

  const trimmedName = countdownName.value.trim();
  if (!trimmedName) {
    countdownError.value = "Countdown name is required.";
    return;
  }

  if (!countdownMax.value || countdownMax.value < 1) {
    countdownError.value = "Countdown max must be at least 1.";
    return;
  }

  try {
    countdownError.value = null;
    await addCountdown(activeSessionId.value, {
      name: trimmedName,
      max: countdownMax.value,
      createdBy: {
        name: hostName.value || displayName.value,
        uid: currentUser.value?.uid ?? null,
        memberId: memberId.value,
        isGuest: !currentUser.value,
      },
    });

    countdownName.value = "";
    countdownMax.value = 6;
    showCountdownForm.value = false;
  } catch (error) {
    console.error(error);
    countdownError.value = "Unable to add that countdown.";
  }
};

const handleSetCountdown = async (countdown: CountdownData, value: number) => {
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

const handleRemoveCountdown = async (countdown: CountdownData) => {
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

let authUnsubscribe: (() => void) | null = null;

onMounted(() => {
  authUnsubscribe = onAuthStateChanged(auth, async (user) => {
    currentUser.value = user;
    authReady.value = true;

    if (user) {
      try {
        await ensureUserProfile(user);
      } catch (error) {
        console.error(error);
      }
      await loadSavedSessions();
    } else {
      savedSessions.value = [];
    }
  });
});

onBeforeUnmount(() => {
  if (authUnsubscribe) {
    authUnsubscribe();
  }
  clearSubscriptions();
});
</script>

<template>
  <main class="app">
    <header class="topbar">
      <div class="brand">Daggerheart Session Manager</div>
      <div class="auth-panel">
        <div v-if="currentUser" class="auth-info">
          <img
            v-if="currentUser.photoURL"
            :src="currentUser.photoURL"
            alt="Profile photo"
            class="avatar"
          />
          <div>
            <span class="meta-label">Signed in</span>
            <strong>{{
              currentUser.displayName || currentUser.email || "Player"
            }}</strong>
          </div>
          <button
            class="btn secondary compact"
            type="button"
            :disabled="authBusy"
            @click="handleSignOut"
          >
            Sign out
          </button>
        </div>

        <div v-else class="auth-actions">
          <span class="meta-label">Sign in for rejoin</span>
          <div class="auth-buttons">
            <button
              class="btn secondary compact"
              type="button"
              :disabled="authBusy"
              @click="handleAuth('google')"
            >
              Google
            </button>
            <button
              class="btn secondary compact"
              type="button"
              :disabled="authBusy"
              @click="handleAuth('apple')"
            >
              Apple
            </button>
          </div>
          <p v-if="authError" class="error auth-error" role="alert">
            {{ authError }}
          </p>
        </div>
      </div>
    </header>

    <section v-if="activeSessionId" class="session-view">
      <header class="session-header">
        <div>
          <span class="meta-label">Session</span>
          <h1>{{ activeSession?.name || "Untitled session" }}</h1>
        </div>
        <div class="session-meta">
          <div>
            <span class="meta-label">Join code</span>
            <strong class="code-value small">{{ activeSession?.code }}</strong>
          </div>
          <div>
            <span class="meta-label">Host</span>
            <strong>{{ activeSession?.host.name }}</strong>
          </div>
          <div>
            <span class="meta-label">Expires</span>
            <strong>{{ sessionExpiresLabel }}</strong>
          </div>
        </div>
        <div class="session-actions">
          <button class="btn secondary compact" type="button" @click="copyCode">
            <span v-if="copyStatus === 'copied'">Copied</span>
            <span v-else-if="copyStatus === 'failed'">Copy failed</span>
            <span v-else>Copy code</span>
          </button>
          <button class="btn ghost" type="button" @click="leaveSession">
            Leave session
          </button>
        </div>
      </header>

      <p v-if="sessionError" class="error" role="alert">{{ sessionError }}</p>
      <p v-else-if="sessionLoading" class="panel-footer">Syncing session...</p>

      <div v-if="activeSession" class="session-content">
        <section class="countdown-panel">
          <div class="countdown-panel-header">
            <div>
              <h2>Countdowns</h2>
              <p class="lede">
                Add a countdown for looming threats, progress clocks, or hazards.
              </p>
            </div>
            <button
              v-if="isHost"
              class="btn"
              type="button"
              @click="showCountdownForm = !showCountdownForm"
            >
              {{ showCountdownForm ? "Close" : "Add countdown" }}
            </button>
          </div>

          <form
            v-if="showCountdownForm"
            class="countdown-form"
            @submit.prevent="handleAddCountdown"
          >
            <label class="field">
              <span>Name</span>
              <input
                v-model="countdownName"
                type="text"
                placeholder="Reinforcements arrive"
                maxlength="40"
                required
              />
            </label>
            <label class="field">
              <span>Max</span>
              <input v-model.number="countdownMax" type="number" min="1" />
            </label>
            <button class="btn" type="submit">Create countdown</button>
            <p v-if="countdownError" class="error" role="alert">
              {{ countdownError }}
            </p>
          </form>

          <div v-if="countdowns.length" class="countdown-grid">
            <CountdownCard
              v-for="countdown in countdowns"
              :key="countdown.id"
              :countdown="countdown"
              :can-edit="isHost"
              @set="(value) => handleSetCountdown(countdown, value)"
              @remove="() => handleRemoveCountdown(countdown)"
            />
          </div>

          <div v-else class="panel-footer">
            No countdowns yet. Create one to get started.
          </div>
        </section>

        <FearTracker
          :value="activeSession.fear"
          :can-edit="isHost"
          :minimized="fearMinimized"
          @set="handleSetFear"
          @toggle="fearMinimized = !fearMinimized"
        />
      </div>

      <div class="session-footer">
        <div>
          <span class="meta-label">Code expires</span>
          <strong>{{ codeExpiresLabel }}</strong>
        </div>
        <div>
          <span class="meta-label">You are</span>
          <strong>{{ isHost ? "Host" : "Player" }}</strong>
        </div>
      </div>
    </section>

    <section v-else class="landing">
      <header class="hero">
        <h1>Start the session. Share the code. Track the tension.</h1>
        <p class="lede">
          Spin up a room for your table in seconds. The host sets the fear and
          runs countdowns, players join with a single code, and everyone stays in
          sync in real time.
        </p>
        <div class="hero-meta">
          <div class="meta-card">
            <span class="meta-label">Join codes last</span>
            <strong>1 hour</strong>
          </div>
          <div class="meta-card">
            <span class="meta-label">Sessions last</span>
            <strong>24 hours</strong>
          </div>
          <div class="meta-card">
            <span class="meta-label">Countdowns</span>
            <strong>Unlimited</strong>
          </div>
        </div>
      </header>

      <div class="panel-stack">
        <section class="panel">
          <div class="panel-header">
            <h2>Create a session</h2>
            <p>Generate a room code for your players and start tracking fear.</p>
          </div>

          <form class="session-form" @submit.prevent="handleCreateSession">
            <label class="field">
              <span>Host name</span>
              <input
                v-model="hostName"
                type="text"
                placeholder="Enter a display name"
                maxlength="32"
                autocomplete="nickname"
                required
              />
            </label>

            <label class="field">
              <span>Session name</span>
              <input
                v-model="sessionName"
                type="text"
                placeholder="Midnight in Emberfall (optional)"
                maxlength="48"
              />
            </label>

            <button class="btn" type="submit" :disabled="!canCreate">
              <span v-if="creating">Creating session...</span>
              <span v-else>Generate join code</span>
            </button>

            <p v-if="createError" class="error" role="alert">{{ createError }}</p>
          </form>

          <div class="panel-footer">
            Guest sessions are available now. Sign in later to resume sessions and
            invite friends more easily.
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2>Join a session</h2>
            <p>Enter the join code from your host and a display name.</p>
          </div>

          <form class="session-form" @submit.prevent="handleJoinSession">
            <label class="field">
              <span>Join code</span>
              <input
                v-model="joinCode"
                class="code-input"
                type="text"
                placeholder="ABC123"
                maxlength="6"
                autocomplete="one-time-code"
                required
              />
            </label>

            <label class="field">
              <span>Display name</span>
              <input
                v-model="joinName"
                type="text"
                placeholder="Player name"
                maxlength="32"
                autocomplete="nickname"
                required
              />
            </label>

            <button class="btn" type="submit" :disabled="!canJoin">
              <span v-if="joining">Joining session...</span>
              <span v-else>Join session</span>
            </button>

            <p v-if="joinError" class="error" role="alert">{{ joinError }}</p>
          </form>
        </section>

        <section v-if="authReady && currentUser" class="panel">
          <div class="panel-header">
            <h2>Resume a session</h2>
            <p>Pick up a recent session without re-entering the code.</p>
          </div>

          <div v-if="loadingSavedSessions" class="panel-footer">
            Loading saved sessions...
          </div>
          <p v-else-if="savedSessionsError" class="error" role="alert">
            {{ savedSessionsError }}
          </p>
          <div v-else-if="savedSessions.length" class="saved-sessions">
            <button
              v-for="session in savedSessions"
              :key="session.id"
              class="btn ghost saved-session"
              type="button"
              @click="handleResumeSession(session)"
            >
              <div>
                <span class="meta-label">{{ session.role }}</span>
                <strong>{{ session.name || session.code }}</strong>
              </div>
              <span class="meta-value">
                Expires
                {{
                  session.sessionExpiresAt
                    ? formatDate(session.sessionExpiresAt)
                    : "Unknown"
                }}
              </span>
            </button>
          </div>
          <div v-else class="panel-footer">
            No recent sessions yet. Join or create one to save it here.
          </div>
        </section>
      </div>
    </section>
  </main>
</template>
