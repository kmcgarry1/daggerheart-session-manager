<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import IconSword from "../components/icons/IconSword.vue";
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
  <main class="screen">
    <section class="panel wide">
      <div class="panel-header">
        <div class="panel-icon"><IconSword /></div>
        <div>
          <p class="eyebrow">Host a session</p>
          <h1>Call your party together.</h1>
          <p class="lede">
            Give your table a home. Create the session, share the code, and set
            the fear in motion.
          </p>
        </div>
      </div>

      <form class="panel-form" @submit.prevent="handleCreate">
        <label class="field">
          <span>Host name</span>
          <input
            v-model="hostName"
            type="text"
            placeholder="Name your host"
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

        <button class="btn primary" type="submit" :disabled="creating">
          <span v-if="creating">Forging session...</span>
          <span v-else>Generate join code</span>
        </button>

        <p v-if="error" class="error">{{ error }}</p>
      </form>
    </section>
  </main>
</template>
