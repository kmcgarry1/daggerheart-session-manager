<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Crown, Flame, Hourglass, ScrollText, Sword } from "lucide-vue-next";
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

const hostName = ref(authStore.displayName.value);
const sessionName = ref("");
const creating = ref(false);
const error = ref<string | null>(null);

watch(
  () => authStore.displayName.value,
  (value) => {
    if (!hostName.value) {
      hostName.value = value;
    }
  },
);

const handleCreate = async () => {
  if (!hostName.value.trim()) {
    error.value = "Host name is required.";
    return;
  }

  creating.value = true;
  error.value = null;
  try {
    const sessionId = await sessionStore.createSessionFlow({
      hostName: hostName.value,
      sessionName: sessionName.value,
    });
    router.push(`/session/${sessionId}`);
  } catch (err) {
    console.error(err);
    error.value = (err as Error).message || "Unable to create the session.";
  } finally {
    creating.value = false;
  }
};
</script>

<template>
  <main class="screen split-screen">
    <UiCard as="section" variant="panel" wide>
      <UiPanelHeader>
        <template #icon>
          <Sword />
        </template>
        <p class="eyebrow">Host a session</p>
        <h1>Call your party together.</h1>
        <div class="rune-divider" aria-hidden="true"></div>
        <p class="lede">
          Give your table a home. Create the session, share the code, and set
          the fear in motion.
        </p>
      </UiPanelHeader>

      <form class="panel-form" @submit.prevent="handleCreate">
        <UiField label="Host name" id="host-name">
          <UiInput
            id="host-name"
            v-model="hostName"
            type="text"
            placeholder="Name your host"
            maxlength="32"
            autocomplete="nickname"
            required
          />
        </UiField>

        <UiField label="Session name" id="session-name">
          <UiInput
            id="session-name"
            v-model="sessionName"
            type="text"
            placeholder="Midnight in Emberfall (optional)"
            maxlength="48"
          />
        </UiField>

        <UiButton variant="primary" type="submit" :disabled="creating">
          <span v-if="creating">Forging session...</span>
          <span v-else>Generate join code</span>
        </UiButton>

        <p v-if="error" class="error">{{ error }}</p>
      </form>
    </UiCard>

    <aside class="side-panel">
      <UiCard as="section" variant="side">
        <UiPanelTitle>
          <template #icon>
            <span class="icon ember"><Crown /></span>
          </template>
          <div>
            <h3>Host's oath</h3>
            <p class="lede small">Set the tone before the party arrives.</p>
          </div>
        </UiPanelTitle>
        <ul class="lore-list">
          <li>
            <span class="icon gild"><ScrollText /></span>
            <div>
              <strong>Name the session</strong>
              <p>Give your table a story hook to remember.</p>
            </div>
          </li>
          <li>
            <span class="icon ember"><Flame /></span>
            <div>
              <strong>Keep fear central</strong>
              <p>The tracker stays visible for every player.</p>
            </div>
          </li>
          <li>
            <span class="icon teal"><Hourglass /></span>
            <div>
              <strong>Shape the countdowns</strong>
              <p>Add as many clocks as the story demands.</p>
            </div>
          </li>
        </ul>
      </UiCard>

      <UiCard as="section" variant="side">
        <UiPanelTitle>
          <template #icon>
            <span class="icon gild"><Hourglass /></span>
          </template>
          <div>
            <h3>Session cadence</h3>
            <p class="lede small">Short-lived rooms keep focus sharp.</p>
          </div>
        </UiPanelTitle>
        <div class="detail-grid">
          <div>
            <span class="meta">Join code</span>
            <strong>1 hour</strong>
          </div>
          <div>
            <span class="meta">Session</span>
            <strong>24 hours</strong>
          </div>
          <div>
            <span class="meta">Countdowns</span>
            <strong>Unlimited</strong>
          </div>
        </div>
      </UiCard>
    </aside>
  </main>
</template>
