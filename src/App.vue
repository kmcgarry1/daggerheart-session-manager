<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Analytics } from "@vercel/analytics/vue";
import { useAuthStore } from "./stores/authStore";
import { useSessionStore } from "./stores/sessionStore";
import { useInviteStore } from "./stores/inviteStore";
import { useFriendStore } from "./stores/friendStore";
import { useThemeStore } from "./stores/themeStore";
import { DoorOpen, Flame, Moon, Sun, Sword, UserRound } from "lucide-vue-next";
import UiButton from "./components/ui/UiButton.vue";

const authStore = useAuthStore();
const sessionStore = useSessionStore();
const inviteStore = useInviteStore();
const friendStore = useFriendStore();
const themeStore = useThemeStore();
authStore.init();
inviteStore.init();
friendStore.init();
themeStore.init();

const notificationCount = computed(
  () => inviteStore.pendingCount.value + friendStore.pendingIncomingCount.value,
);
const isLightMode = computed(() => themeStore.theme.value === "light");

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
        <router-link to="/" class="nav-link">
          <span class="icon"><Flame /></span>
          Sanctum
        </router-link>
        <router-link to="/create" class="nav-link">
          <span class="icon"><Sword /></span>
          Host
        </router-link>
        <router-link to="/join" class="nav-link">
          <span class="icon"><DoorOpen /></span>
          Join
        </router-link>
        <router-link to="/account" class="nav-link">
          <span class="icon"><UserRound /></span>
          Account
          <span v-if="notificationCount" class="nav-badge">
            {{ notificationCount }}
          </span>
        </router-link>
      </nav>

      <div class="nav-actions">
        <UiButton
          v-if="activeSessionId"
          variant="ghost"
          size="compact"
          type="button"
          @click="goToSession"
        >
          Return to session
        </UiButton>

        <UiButton
          class="theme-toggle"
          variant="ghost"
          size="compact"
          type="button"
          :aria-label="isLightMode ? 'Switch to dark mode' : 'Switch to light mode'"
          @click="themeStore.toggle"
        >
          <span class="icon">
            <Sun v-if="isLightMode" />
            <Moon v-else />
          </span>
        </UiButton>

        <div v-if="authStore.isSignedIn.value" class="user-chip">
          <span class="user-name">{{ authStore.displayName.value }}</span>
          <UiButton
            variant="ghost"
            size="compact"
            type="button"
            :disabled="authStore.authBusy.value"
            @click="authStore.signOut"
          >
            Sign out
          </UiButton>
        </div>
        <UiButton
          v-else
          variant="ghost"
          size="compact"
          type="button"
          @click="goLogin"
        >
          Sign in
        </UiButton>
      </div>
    </header>

    <router-view v-slot="{ Component }">
      <transition name="page-fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <Analytics />
  </div>
</template>
