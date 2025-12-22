<script setup lang="ts">
import { useAuthStore } from "../stores/authStore";
import IconPortal from "../components/icons/IconPortal.vue";

const authStore = useAuthStore();
</script>

<template>
  <main class="screen auth-screen">
    <section class="auth-card">
      <p class="eyebrow">Choose your path</p>
      <h1>Enter the Hall.</h1>
      <p class="lede">
        Sign in to save sessions, reconnect instantly, and invite friends with a
        single click.
      </p>
      <button
        class="btn primary full"
        type="button"
        :disabled="authStore.authBusy.value"
        @click="authStore.signIn"
      >
        <span class="icon"><IconPortal /></span>
        Sign in with Google
      </button>
      <router-link class="btn ghost full" to="/create">
        Continue as guest
      </router-link>
      <p v-if="authStore.authError.value" class="error">
        {{ authStore.authError.value }}
      </p>
    </section>
    <section class="auth-aside">
      <div class="lore-card">
        <h2>Why sign in?</h2>
        <ul>
          <li>Resume sessions with one tap.</li>
          <li>Build your friends list and invite faster.</li>
          <li>Keep your tables organized across devices.</li>
        </ul>
      </div>
    </section>
  </main>
</template>
