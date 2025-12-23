<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import UiButton from "../components/ui/UiButton.vue";
import UiCard from "../components/ui/UiCard.vue";
import UiField from "../components/ui/UiField.vue";
import UiInput from "../components/ui/UiInput.vue";
import {
  LogIn,
  Mail,
  ScrollText,
  Shield,
  Sparkles,
  Users,
} from "lucide-vue-next";

const authStore = useAuthStore();
const router = useRouter();

const email = ref("");
const password = ref("");

const diagnostics = computed(() => {
  if (typeof window === "undefined") {
    return {
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "unknown",
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "unknown",
      origin: "unavailable",
      prefersRedirect: false,
      userAgent: "unavailable",
      authReady: authStore.authReady.value,
      currentUid: authStore.currentUser.value?.uid ?? "none",
      authError: authStore.authError.value ?? "none",
      authErrorCode: authStore.authErrorCode.value ?? "none",
    };
  }

  const prefersRedirect =
    window.matchMedia("(max-width: 720px)").matches ||
    window.matchMedia("(pointer: coarse)").matches;

  return {
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "unknown",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "unknown",
    origin: window.location.origin,
    prefersRedirect,
    userAgent: window.navigator.userAgent,
    authReady: authStore.authReady.value,
    currentUid: authStore.currentUser.value?.uid ?? "none",
    authError: authStore.authError.value ?? "none",
    authErrorCode: authStore.authErrorCode.value ?? "none",
  };
});

const handleEmailSignIn = async () => {
  await authStore.signInWithEmail(email.value, password.value);
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
      <p class="eyebrow">Choose your path</p>
      <h1>Enter the Hall.</h1>
      <div class="rune-divider" aria-hidden="true"></div>
      <p class="lede">
        Sign in to save sessions, reconnect instantly, and invite friends with a
        single click.
      </p>
      <div class="auth-note">
        <span class="icon gild"><Shield /></span>
        Guests can still join with a name.
      </div>
      <UiButton
        variant="primary"
        full
        type="button"
        :disabled="authStore.authBusy.value"
        @click="authStore.signIn"
      >
        <span class="icon"><LogIn /></span>
        Sign in with Google
      </UiButton>
      <div class="auth-divider">Or sign in with email</div>
      <form class="panel-form auth-form" @submit.prevent="handleEmailSignIn">
        <UiField label="Email" id="login-email">
          <UiInput
            id="login-email"
            v-model="email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
          />
        </UiField>
        <UiField label="Password" id="login-password">
          <UiInput
            id="login-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </UiField>
        <UiButton
          variant="ghost"
          full
          type="submit"
          :disabled="authStore.authBusy.value"
        >
          <span class="icon"><Mail /></span>
          Sign in with email
        </UiButton>
      </form>
      <UiButton variant="ghost" full to="/create">
        Continue as guest
      </UiButton>
      <p v-if="authStore.authError.value" class="error">
        {{ authStore.authError.value }}
      </p>
      <div class="auth-links">
        <span>New here?</span>
        <router-link to="/signup">Create an account</router-link>
      </div>
      <details class="auth-debug">
        <summary>Auth diagnostics</summary>
        <div class="auth-debug-grid">
          <div>
            <span class="meta">authDomain</span>
            <strong>{{ diagnostics.authDomain }}</strong>
          </div>
          <div>
            <span class="meta">projectId</span>
            <strong>{{ diagnostics.projectId }}</strong>
          </div>
          <div>
            <span class="meta">origin</span>
            <strong>{{ diagnostics.origin }}</strong>
          </div>
          <div>
            <span class="meta">prefersRedirect</span>
            <strong>{{ diagnostics.prefersRedirect ? "true" : "false" }}</strong>
          </div>
          <div>
            <span class="meta">authReady</span>
            <strong>{{ diagnostics.authReady ? "true" : "false" }}</strong>
          </div>
          <div>
            <span class="meta">currentUid</span>
            <strong>{{ diagnostics.currentUid }}</strong>
          </div>
          <div>
            <span class="meta">authErrorCode</span>
            <strong>{{ diagnostics.authErrorCode }}</strong>
          </div>
        </div>
        <div>
          <span class="meta">authError</span>
          <p class="auth-debug-ua">{{ diagnostics.authError }}</p>
        </div>
        <div>
          <span class="meta">user agent</span>
          <p class="auth-debug-ua">{{ diagnostics.userAgent }}</p>
        </div>
      </details>
    </UiCard>
    <section class="auth-aside">
      <UiCard variant="lore">
        <h2>Why sign in?</h2>
        <ul class="lore-list">
          <li>
            <span class="icon ember"><ScrollText /></span>
            <div>
              <strong>Resume instantly</strong>
              <p>Jump back into sessions without hunting for codes.</p>
            </div>
          </li>
          <li>
            <span class="icon teal"><Users /></span>
            <div>
              <strong>Build your party</strong>
              <p>Invite friends faster with saved profiles.</p>
            </div>
          </li>
          <li>
            <span class="icon gild"><Sparkles /></span>
            <div>
              <strong>Keep the lore</strong>
              <p>Your active tables stay organized across devices.</p>
            </div>
          </li>
        </ul>
      </UiCard>
      <div class="path-grid">
        <UiCard as="article" variant="path">
          <span class="icon ember"><ScrollText /></span>
          <strong>Saved sessions</strong>
          <p>Rejoin your latest table in one tap.</p>
        </UiCard>
        <UiCard as="article" variant="path">
          <span class="icon teal"><Users /></span>
          <strong>Friend invites</strong>
          <p>Keep your party roster ready for the next night.</p>
        </UiCard>
        <UiCard as="article" variant="path">
          <span class="icon gild"><Shield /></span>
          <strong>Secure sign-in</strong>
          <p>Google login keeps your tables safe.</p>
        </UiCard>
      </div>
    </section>
  </main>
</template>
