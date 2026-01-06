<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  DoorOpen,
  Flame,
  Hourglass,
  ScrollText,
  Shield,
  Users,
} from "lucide-vue-next";
import UiButton from "../components/ui/UiButton.vue";
import UiCard from "../components/ui/UiCard.vue";
import UiField from "../components/ui/UiField.vue";
import UiInput from "../components/ui/UiInput.vue";
import UiPanelHeader from "../components/ui/UiPanelHeader.vue";
import UiPanelTitle from "../components/ui/UiPanelTitle.vue";
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
    error.value = (err as Error).message || "Unable to resume that session.";
  } finally {
    joining.value = false;
  }
};
</script>

<template>
  <main class="screen split-screen">
    <div class="panel-stack">
      <UiCard as="section" variant="panel" wide>
        <UiPanelHeader>
          <template #icon>
            <DoorOpen />
          </template>
          <p class="eyebrow">Join a session</p>
          <h1>Step through the veil.</h1>
          <div class="rune-divider" aria-hidden="true"></div>
          <p class="lede">
            Enter the join code from your host and choose the name your table
            will see.
          </p>
        </UiPanelHeader>

        <form class="panel-form" @submit.prevent="handleJoin">
          <UiField label="Join code" id="join-code">
            <UiInput
              id="join-code"
              v-model="joinCode"
              class="code-input"
              type="text"
              placeholder="ABC123"
              maxlength="6"
              autocomplete="one-time-code"
              required
            />
          </UiField>

          <UiField label="Display name" id="display-name">
            <UiInput
              id="display-name"
              v-model="joinName"
              type="text"
              placeholder="Player name"
              maxlength="32"
              autocomplete="nickname"
              required
            />
          </UiField>

          <UiButton variant="primary" type="submit" :disabled="joining">
            <span v-if="joining">Opening the gate...</span>
            <span v-else>Join session</span>
          </UiButton>

          <p v-if="error" class="error">{{ error }}</p>
        </form>
      </UiCard>

      <UiCard
        v-if="authStore.isSignedIn.value"
        as="section"
        variant="panel-alt"
        wide
      >
        <UiPanelHeader>
          <template #icon>
            <Users />
          </template>
          <p class="eyebrow">Resume</p>
          <h2>Your recent sessions</h2>
          <p class="lede">
            Jump back into sessions you have already joined.
          </p>
        </UiPanelHeader>

        <div v-if="authStore.loadingSavedSessions.value" class="panel-footer">
          Loading saved sessions...
        </div>
        <p v-else-if="authStore.savedSessionsError.value" class="error">
          {{ authStore.savedSessionsError.value }}
        </p>
        <div
          v-else-if="authStore.savedSessions.value.length"
          class="resume-grid"
        >
          <UiCard
            v-for="session in authStore.savedSessions.value"
            :key="session.id"
            as="button"
            variant="resume"
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
          </UiCard>
        </div>
        <div v-else class="panel-footer">
          No recent sessions yet. Join a session to save it here.
        </div>
      </UiCard>
    </div>

    <aside class="side-panel">
      <UiCard as="section" variant="side">
        <UiPanelTitle>
          <template #icon>
            <span class="icon ember"><Flame /></span>
          </template>
          <div>
            <h3>What you'll see</h3>
            <p class="lede small">The table stays locked in.</p>
          </div>
        </UiPanelTitle>
        <ul class="lore-list">
          <li>
            <span class="icon ember"><Flame /></span>
            <div>
              <strong>Fear stays front</strong>
              <p>The tracker never leaves the screen.</p>
            </div>
          </li>
          <li>
            <span class="icon gild"><Hourglass /></span>
            <div>
              <strong>Live countdowns</strong>
              <p>Each card updates the moment it changes.</p>
            </div>
          </li>
          <li>
            <span class="icon teal"><Users /></span>
            <div>
              <strong>Roster clarity</strong>
              <p>See every guest and signed-in ally.</p>
            </div>
          </li>
        </ul>
      </UiCard>

      <UiCard as="section" variant="side">
        <UiPanelTitle>
          <template #icon>
            <span class="icon gild"><Shield /></span>
          </template>
          <div>
            <h3>Guests welcome</h3>
            <p class="lede small">Sign in to return faster later.</p>
          </div>
        </UiPanelTitle>
        <ul class="lore-list">
          <li>
            <span class="icon ember"><DoorOpen /></span>
            <div>
              <strong>Join instantly</strong>
              <p>Enter the code, set your name, and play.</p>
            </div>
          </li>
          <li>
            <span class="icon gild"><ScrollText /></span>
            <div>
              <strong>Save your place</strong>
              <p>Signed-in players see recent sessions.</p>
            </div>
          </li>
        </ul>
      </UiCard>
    </aside>
  </main>
</template>
