<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import UiButton from "../components/ui/UiButton.vue";
import UiCard from "../components/ui/UiCard.vue";
import UiField from "../components/ui/UiField.vue";
import UiInput from "../components/ui/UiInput.vue";
import { useAuthStore } from "../stores/authStore";
import { ScrollText, Shield, Sparkles, UserRoundPlus } from "lucide-vue-next";

const authStore = useAuthStore();
const router = useRouter();

const displayName = ref("");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const localError = ref<string | null>(null);

const handleSignup = async () => {
  localError.value = null;
  if (password.value !== confirmPassword.value) {
    localError.value = "Passwords do not match.";
    return;
  }

  await authStore.signUpWithEmail({
    displayName: displayName.value,
    email: email.value,
    password: password.value,
  });

  if (!authStore.authError.value) {
    router.push("/account");
  }
};

watch(
  () => authStore.isSignedIn.value,
  (signedIn) => {
    if (signedIn) {
      router.replace("/account");
    }
  },
  { immediate: true },
);
</script>

<template>
  <main class="screen auth-screen">
    <UiCard as="section" variant="auth">
      <p class="eyebrow">Create your account</p>
      <h1>Claim your sigil.</h1>
      <div class="rune-divider" aria-hidden="true"></div>
      <p class="lede">
        Create an account to save sessions, invite friends, and return to your
        table in one tap.
      </p>

      <form class="panel-form auth-form" @submit.prevent="handleSignup">
        <UiField label="Display name" id="signup-name">
          <UiInput
            id="signup-name"
            v-model="displayName"
            type="text"
            placeholder="How should we call you?"
            autocomplete="nickname"
            maxlength="40"
            required
          />
        </UiField>
        <UiField label="Email" id="signup-email">
          <UiInput
            id="signup-email"
            v-model="email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
          />
        </UiField>
        <UiField label="Password" id="signup-password" hint="Minimum 6 characters">
          <UiInput
            id="signup-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            minlength="6"
            required
          />
        </UiField>
        <UiField label="Confirm password" id="signup-confirm">
          <UiInput
            id="signup-confirm"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            minlength="6"
            required
          />
        </UiField>
        <UiButton
          variant="primary"
          full
          type="submit"
          :disabled="authStore.authBusy.value"
        >
          Create account
        </UiButton>
      </form>

      <p v-if="localError" class="error">{{ localError }}</p>
      <p v-if="authStore.authError.value" class="error">
        {{ authStore.authError.value }}
      </p>

      <div class="auth-links">
        <span>Already have an account?</span>
        <router-link to="/login">Sign in</router-link>
      </div>
    </UiCard>

    <section class="auth-aside">
      <UiCard variant="lore">
        <h2>What you'll unlock</h2>
        <ul class="lore-list">
          <li>
            <span class="icon ember"><ScrollText /></span>
            <div>
              <strong>Saved tables</strong>
              <p>Keep your active sessions close at hand.</p>
            </div>
          </li>
          <li>
            <span class="icon teal"><UserRoundPlus /></span>
            <div>
              <strong>Friend invites</strong>
              <p>Send sigils straight to your party.</p>
            </div>
          </li>
          <li>
            <span class="icon gild"><Sparkles /></span>
            <div>
              <strong>Persistent profile</strong>
              <p>Carry your name and status across sessions.</p>
            </div>
          </li>
        </ul>
      </UiCard>
      <UiCard variant="path" as="article">
        <span class="icon gild"><Shield /></span>
        <strong>Protected access</strong>
        <p>Secure sign-in keeps your tables in your hands.</p>
      </UiCard>
    </section>
  </main>
</template>
