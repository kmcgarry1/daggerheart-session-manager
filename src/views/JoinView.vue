<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import IconPortal from "../components/icons/IconPortal.vue";
import IconUsers from "../components/icons/IconUsers.vue";
import { useAuthStore } from "../stores/authStore";
import { useSessionStore } from "../stores/sessionStore";

const authStore = useAuthStore();
const sessionStore = useSessionStore();
const router = useRouter();

const joinCode = ref("");
const joinName = ref(authStore.displayName.value);
const joining = ref(false);
const error = ref<string | null>(null);

watch(
  () => authStore.displayName.value,
  (value) => {
    if (!joinName.value) {
      joinName.value = value;
    }
  },
);

const handleJoin = async () => {
  if (!joinCode.value.trim()) {
    error.value = "Join code is required.";
    return;
  }
  if (!joinName.value.trim()) {
    error.value = "Display name is required.";
    return;
  }

  joining.value = true;
  error.value = null;
  try {
    const sessionId = await sessionStore.joinSessionFlow({
      joinCode: joinCode.value,
      name: joinName.value,
    });
    router.push(`/session/${sessionId}`);
  } catch (err) {
    console.error(err);
    error.value = (err as Error).message || "Unable to join that session.";
  } finally {
    joining.value = false;
  }
};

const handleResume = async (sessionId: string, role: "host" | "player") => {
  joining.value = true;
  error.value = null;
  try {
    const targetId = await sessionStore.resumeSession({
      sessionId,
      role,
      fallbackName: joinName.value || authStore.displayName.value,
    });
    router.push(`/session/${targetId}`);
  } catch (err) {
    console.error(err);
    error.value = (err as Error).message || "Unable to resume that session.";
  } finally {
    joining.value = false;
  }
};
</script>

<template>
  <main class="screen">
    <section class="panel wide">
      <div class="panel-header">
        <div class="panel-icon"><IconPortal /></div>
        <div>
          <p class="eyebrow">Join a session</p>
          <h1>Step through the veil.</h1>
          <p class="lede">
            Enter the join code from your host and choose the name your table
            will see.
          </p>
        </div>
      </div>

      <form class="panel-form" @submit.prevent="handleJoin">
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

        <button class="btn primary" type="submit" :disabled="joining">
          <span v-if="joining">Opening the gate...</span>
          <span v-else>Join session</span>
        </button>

        <p v-if="error" class="error">{{ error }}</p>
      </form>
    </section>

    <section
      v-if="authStore.currentUser.value"
      class="panel wide panel-alt"
    >
      <div class="panel-header">
        <div class="panel-icon"><IconUsers /></div>
        <div>
          <p class="eyebrow">Resume</p>
          <h2>Your recent sessions</h2>
          <p class="lede">
            Jump back into sessions you have already joined.
          </p>
        </div>
      </div>

      <div v-if="authStore.loadingSavedSessions.value" class="panel-footer">
        Loading saved sessions...
      </div>
      <p v-else-if="authStore.savedSessionsError.value" class="error">
        {{ authStore.savedSessionsError.value }}
      </p>
      <div v-else-if="authStore.savedSessions.value.length" class="resume-grid">
        <button
          v-for="session in authStore.savedSessions.value"
          :key="session.id"
          class="resume-card"
          type="button"
          @click="handleResume(session.id, session.role)"
        >
          <div>
            <span class="meta">{{ session.role }}</span>
            <strong>{{ session.name || session.code }}</strong>
          </div>
          <span class="meta">
            Expires
            {{
              session.sessionExpiresAt
                ? session.sessionExpiresAt.toLocaleDateString()
                : "Unknown"
            }}
          </span>
        </button>
      </div>
      <div v-else class="panel-footer">
        No recent sessions yet. Join a session to save it here.
      </div>
    </section>
  </main>
</template>
