<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "./stores/authStore";
import { useSessionStore } from "./stores/sessionStore";

const authStore = useAuthStore();
const sessionStore = useSessionStore();
authStore.init();

const route = useRoute();
const router = useRouter();

const hideNav = computed(() => route.meta?.hideNav === true);
const activeSessionId = computed(() => sessionStore.activeSessionId.value);

const goLogin = () => router.push("/login");
const goToSession = () => {
  if (activeSessionId.value) {
    router.push(`/session/${activeSessionId.value}`);
  }
};
</script>

<template>
  <div class="app-shell">
    <header v-if="!hideNav" class="site-nav">
      <div class="brand-lockup">
        <span class="brand-mark">Daggerheart</span>
        <span class="brand-sub">Session Manager</span>
      </div>

      <nav class="nav-links">
        <router-link to="/" class="nav-link">Sanctum</router-link>
        <router-link to="/create" class="nav-link">Host</router-link>
        <router-link to="/join" class="nav-link">Join</router-link>
      </nav>

      <div class="nav-actions">
        <button
          v-if="activeSessionId"
          class="btn ghost compact"
          type="button"
          @click="goToSession"
        >
          Return to session
        </button>

        <div v-if="authStore.currentUser.value" class="user-chip">
          <span class="user-name">{{ authStore.displayName.value }}</span>
          <button
            class="btn ghost compact"
            type="button"
            :disabled="authStore.authBusy.value"
            @click="authStore.signOut"
          >
            Sign out
          </button>
        </div>
        <button
          v-else
          class="btn ghost compact"
          type="button"
          @click="goLogin"
        >
          Sign in
        </button>
      </div>
    </header>

    <router-view />
  </div>
</template>
