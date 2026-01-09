<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import { useSessionStore } from "../stores/sessionStore";
import CountdownCard from "../components/CountdownCard.vue";
import FearTracker from "../components/FearTracker.vue";
import UiButton from "../components/ui/UiButton.vue";
import UiCard from "../components/ui/UiCard.vue";
import UiField from "../components/ui/UiField.vue";
import UiInput from "../components/ui/UiInput.vue";
import UiPanelTitle from "../components/ui/UiPanelTitle.vue";
import { reportError } from "../monitoring";
import {
  CirclePlus,
  ClipboardCopy,
  Crown,
  Hourglass,
  LogOut,
  ScrollText,
  Users,
  X,
} from "lucide-vue-next";

const authStore = useAuthStore();
const sessionStore = useSessionStore();
const route = useRoute();
const router = useRouter();

const fearMinimized = ref(false);
const showCountdownForm = ref(false);
const countdownName = ref("");
const countdownMax = ref(6);
const copyStatus = ref<"idle" | "copied" | "failed">("idle");
const restoringSession = ref(false);

const sessionId = computed(() => route.params.sessionId as string);
const session = computed(() => sessionStore.activeSession.value);
const isActiveSession = computed(
  () => sessionStore.activeSessionId.value === sessionId.value,
);

const sessionExpiresLabel = computed(() =>
  session.value?.sessionExpiresAt
    ? session.value.sessionExpiresAt.toLocaleString()
    : "",
);

const codeExpiresLabel = computed(() =>
  session.value?.codeExpiresAt ? session.value.codeExpiresAt.toLocaleString() : "",
);

const handleCopyCode = async () => {
  if (!session.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(session.value.code);
    copyStatus.value = "copied";
  } catch (error) {
    reportError(error, { flow: "clipboard", action: "copy_session_code" });
    copyStatus.value = "failed";
  } finally {
    window.setTimeout(() => {
      copyStatus.value = "idle";
    }, 2000);
  }
};

const handleLeave = () => {
  sessionStore.leaveSession();
  router.push("/");
};

const handleAddCountdown = async () => {
  const name = countdownName.value.trim();
  if (!name) {
    sessionStore.countdownError.value = "Countdown name is required.";
    return;
  }

  await sessionStore.addSessionCountdown({
    name,
    max: countdownMax.value,
    createdBy: {
      name: authStore.displayName.value,
      uid: authStore.currentUser.value?.uid ?? null,
      memberId: authStore.memberId.value,
      isGuest: !authStore.isSignedIn.value,
    },
  });

  if (!sessionStore.countdownError.value) {
    countdownName.value = "";
    countdownMax.value = 6;
    showCountdownForm.value = false;
  }
};

// Attempt to restore session when visiting a session URL
const tryRestoreSession = async () => {
  const id = sessionId.value;
  if (!id || isActiveSession.value || restoringSession.value) {
    return;
  }

  restoringSession.value = true;
  try {
    const result = await sessionStore.attemptSessionRestore(id);
    if (!result.success && result.requiresJoin) {
      // User is not a member, redirect to join page
      router.push("/join");
    }
  } catch (error) {
    reportError(error, { flow: "session.view", action: "restore" });
  } finally {
    restoringSession.value = false;
  }
};

// Watch for session ID changes in the route
watch(sessionId, () => {
  tryRestoreSession();
});

// Try to restore when component mounts
onMounted(() => {
  tryRestoreSession();
});
</script>

<template>
  <main class="screen screen-wide session-screen">
    <UiCard v-if="!isActiveSession" as="section" variant="panel" wide>
      <p v-if="restoringSession" class="eyebrow">Restoring session</p>
      <p v-else-if="sessionStore.sessionError.value" class="eyebrow">Session error</p>
      <p v-else class="eyebrow">No active session</p>
      
      <h1 v-if="restoringSession">Finding your way back...</h1>
      <h1 v-else-if="sessionStore.sessionError.value">Unable to connect.</h1>
      <h1 v-else>The hall is quiet.</h1>
      
      <p v-if="restoringSession" class="lede">
        Checking if you have access to this session...
      </p>
      <p v-else-if="sessionStore.sessionError.value" class="error">
        {{ sessionStore.sessionError.value }}
      </p>
      <p v-else class="lede">
        Join or create a session to enter. Once connected, the session will
        appear here automatically.
      </p>
      
      <div v-if="!restoringSession" class="cta-row">
        <UiButton variant="primary" to="/create">Host a session</UiButton>
        <UiButton variant="ghost" to="/join">Join a session</UiButton>
      </div>
    </UiCard>

    <section v-else class="session-core">
      <header class="session-banner">
        <div class="session-banner-main">
          <div>
            <p class="eyebrow">Session</p>
            <h1>{{ session?.name || "Untitled session" }}</h1>
            <p class="lede">Host: {{ session?.host.name }}</p>
          </div>
          <div class="session-code">
            <span class="meta">Join code</span>
            <strong class="code-text code-chip">{{ session?.code }}</strong>
          </div>
        </div>
        <div class="session-banner-actions">
          <UiButton
            variant="ghost"
            size="compact"
            type="button"
            @click="handleCopyCode"
          >
            <span class="icon"><ClipboardCopy /></span>
            <span v-if="copyStatus === 'copied'">Code copied</span>
            <span v-else-if="copyStatus === 'failed'">Copy failed</span>
            <span v-else>Copy join code</span>
          </UiButton>
          <UiButton
            variant="subtle"
            size="compact"
            type="button"
            @click="handleLeave"
          >
            <span class="icon"><LogOut /></span>
            Leave session
          </UiButton>
        </div>
      </header>

      <p v-if="sessionStore.sessionError.value" class="error">
        {{ sessionStore.sessionError.value }}
      </p>
      <p v-else-if="sessionStore.sessionLoading.value" class="panel-footer">
        Syncing session...
      </p>

      <div class="fear-stage">
        <FearTracker
          :value="session?.fear ?? 0"
          :can-edit="sessionStore.isHost.value"
          :minimized="fearMinimized"
          @set="sessionStore.setFear"
          @toggle="fearMinimized = !fearMinimized"
        />
      </div>

      <div class="session-grid">
        <UiCard as="section" variant="countdown-panel">
          <div class="countdown-panel-header">
            <UiPanelTitle>
              <template #icon>
                <span class="icon ember"><Hourglass /></span>
              </template>
              <div>
                <h2>Countdowns</h2>
                <p class="lede">
                  Track looming threats, rituals, or escape clocks.
                </p>
              </div>
            </UiPanelTitle>
            <UiButton
              v-if="sessionStore.isHost.value"
              variant="primary"
              size="compact"
              type="button"
              @click="showCountdownForm = !showCountdownForm"
            >
              <span class="icon">
                <X v-if="showCountdownForm" />
                <CirclePlus v-else />
              </span>
              {{ showCountdownForm ? "Close" : "Add countdown" }}
            </UiButton>
          </div>

          <form
            v-if="showCountdownForm"
            class="panel-form split"
            @submit.prevent="handleAddCountdown"
          >
            <UiField label="Name" id="countdown-name">
              <UiInput
                id="countdown-name"
                v-model="countdownName"
                type="text"
                placeholder="Reinforcements arrive"
                maxlength="40"
                required
              />
            </UiField>
            <UiField label="Max" id="countdown-max">
              <UiInput
                id="countdown-max"
                v-model.number="countdownMax"
                type="number"
                min="1"
              />
            </UiField>
            <UiButton variant="primary" type="submit">
              Create countdown
            </UiButton>
          </form>

          <p v-if="sessionStore.countdownError.value" class="error">
            {{ sessionStore.countdownError.value }}
          </p>

          <div v-if="sessionStore.countdowns.value.length" class="countdown-grid">
            <CountdownCard
              v-for="countdown in sessionStore.countdowns.value"
              :key="countdown.id"
              :countdown="countdown"
              :can-edit="sessionStore.isHost.value"
              @set="(value) => sessionStore.setCountdown(countdown, value)"
              @remove="() => sessionStore.deleteCountdown(countdown)"
            />
          </div>
          <div v-else class="panel-footer">
            No countdowns yet. Create one to get started.
          </div>
        </UiCard>

        <aside class="side-panel">
          <UiCard as="section" variant="side">
            <UiPanelTitle>
              <template #icon>
                <span class="icon ember"><Users /></span>
              </template>
              <div>
                <h3>Roster</h3>
                <p class="lede small">
                  {{ sessionStore.membersWithPresence.value.length }} in session
                </p>
              </div>
            </UiPanelTitle>
            <ul v-if="sessionStore.membersWithPresence.value.length" class="roster-list">
              <li
                v-for="member in sessionStore.membersWithPresence.value"
                :key="member.id"
                class="roster-item"
                :class="{ 'is-host': member.role === 'host', 'is-inactive': !member.isActive }"
              >
                <div>
                  <strong>{{ member.name }}</strong>
                  <span class="meta roster-role">
                    <Crown
                      v-if="member.role === 'host'"
                      class="inline-icon"
                    />
                    {{ member.role === "host" ? "Host" : "Player" }}
                  </span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span
                    v-if="!member.isActive"
                    class="roster-badge inactive"
                    title="Member appears inactive"
                  >
                    Inactive
                  </span>
                  <span
                    class="roster-badge"
                    :class="member.isGuest ? 'guest' : 'signed-in'"
                  >
                    {{ member.isGuest ? "Guest" : "Signed in" }}
                  </span>
                </div>
              </li>
            </ul>
            <p v-else class="panel-footer">No members yet.</p>
          </UiCard>

          <UiCard as="section" variant="side">
            <UiPanelTitle>
              <template #icon>
                <span class="icon gild"><ScrollText /></span>
              </template>
              <div>
                <h3>Session details</h3>
                <p class="lede small">Short-lived rooms keep focus sharp.</p>
              </div>
            </UiPanelTitle>
            <div class="detail-grid">
              <div>
                <span class="meta">Code rotates</span>
                <strong>{{ codeExpiresLabel }}</strong>
              </div>
              <div>
                <span class="meta">Session ends</span>
                <strong>{{ sessionExpiresLabel }}</strong>
              </div>
              <div>
                <span class="meta">Countdowns</span>
                <strong>Unlimited</strong>
              </div>
            </div>
          </UiCard>
        </aside>
      </div>
    </section>
  </main>
</template>
