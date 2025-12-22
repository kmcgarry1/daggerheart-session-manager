<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import { useSessionStore } from "../stores/sessionStore";
import CountdownCard from "../components/CountdownCard.vue";
import FearTracker from "../components/FearTracker.vue";
import IconFlame from "../components/icons/IconFlame.vue";
import IconHourglass from "../components/icons/IconHourglass.vue";
import IconUsers from "../components/icons/IconUsers.vue";

const authStore = useAuthStore();
const sessionStore = useSessionStore();
const route = useRoute();
const router = useRouter();

const fearMinimized = ref(false);
const showCountdownForm = ref(false);
const countdownName = ref("");
const countdownMax = ref(6);
const copyStatus = ref<"idle" | "copied" | "failed">("idle");

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
    console.error(error);
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
      isGuest: !authStore.currentUser.value,
    },
  });

  if (!sessionStore.countdownError.value) {
    countdownName.value = "";
    countdownMax.value = 6;
    showCountdownForm.value = false;
  }
};
</script>

<template>
  <main class="screen screen-wide session-screen">
    <section v-if="!isActiveSession" class="panel wide">
      <p class="eyebrow">No active session</p>
      <h1>The hall is quiet.</h1>
      <p class="lede">
        Join or create a session to enter. Once connected, the session will
        appear here automatically.
      </p>
      <div class="cta-row">
        <router-link class="btn primary" to="/create">Host a session</router-link>
        <router-link class="btn ghost" to="/join">Join a session</router-link>
      </div>
    </section>

    <section v-else class="session-core">
      <header class="session-banner">
        <div>
          <p class="eyebrow">Session</p>
          <h1>{{ session?.name || "Untitled session" }}</h1>
          <p class="lede">
            Host: {{ session?.host.name }} ·
            <span class="meta">Expires {{ sessionExpiresLabel }}</span>
          </p>
        </div>
        <div class="session-banner-actions">
          <button class="btn ghost compact" type="button" @click="handleCopyCode">
            <span v-if="copyStatus === 'copied'">Code copied</span>
            <span v-else-if="copyStatus === 'failed'">Copy failed</span>
            <span v-else>Copy join code</span>
          </button>
          <button class="btn subtle compact" type="button" @click="handleLeave">
            Leave session
          </button>
        </div>
      </header>

      <p v-if="sessionStore.sessionError.value" class="error">
        {{ sessionStore.sessionError.value }}
      </p>
      <p v-else-if="sessionStore.sessionLoading.value" class="panel-footer">
        Syncing session...
      </p>

      <FearTracker
        :value="session?.fear ?? 0"
        :can-edit="sessionStore.isHost.value"
        :minimized="fearMinimized"
        @set="sessionStore.setFear"
        @toggle="fearMinimized = !fearMinimized"
      />

      <div class="session-grid">
        <section class="countdown-panel">
          <div class="countdown-panel-header">
            <div class="panel-title">
              <span class="icon ember"><IconHourglass /></span>
              <div>
                <h2>Countdowns</h2>
                <p class="lede">
                  Track looming threats, rituals, or escape clocks.
                </p>
              </div>
            </div>
            <button
              v-if="sessionStore.isHost.value"
              class="btn primary compact"
              type="button"
              @click="showCountdownForm = !showCountdownForm"
            >
              {{ showCountdownForm ? "Close" : "Add countdown" }}
            </button>
          </div>

          <form
            v-if="showCountdownForm"
            class="panel-form split"
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
            <button class="btn primary" type="submit">Create countdown</button>
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
        </section>

        <aside class="side-panel">
          <section class="side-card">
            <div class="panel-title">
              <span class="icon ember"><IconUsers /></span>
              <div>
                <h3>Roster</h3>
                <p class="lede small">
                  {{ sessionStore.members.value.length }} in session
                </p>
              </div>
            </div>
            <ul v-if="sessionStore.members.value.length" class="roster-list">
              <li
                v-for="member in sessionStore.members.value"
                :key="member.id"
                class="roster-item"
              >
                <div>
                  <strong>{{ member.name }}</strong>
                  <span class="meta">
                    {{ member.role === "host" ? "Host" : "Player" }}
                  </span>
                </div>
                <span class="roster-badge">
                  {{ member.isGuest ? "Guest" : "Signed in" }}
                </span>
              </li>
            </ul>
            <p v-else class="panel-footer">No members yet.</p>
          </section>

          <section class="side-card">
            <div class="panel-title">
              <span class="icon ember"><IconFlame /></span>
              <div>
                <h3>Session details</h3>
                <p class="lede small">Keep the table moving.</p>
              </div>
            </div>
            <div class="detail-grid">
              <div>
                <span class="meta">Join code</span>
                <strong class="code-text">{{ session?.code }}</strong>
              </div>
              <div>
                <span class="meta">Code expires</span>
                <strong>{{ codeExpiresLabel }}</strong>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  </main>
</template>
