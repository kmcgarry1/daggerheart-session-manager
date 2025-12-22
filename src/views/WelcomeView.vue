<script setup lang="ts">
import { useAuthStore } from "../stores/authStore";
import IconSword from "../components/icons/IconSword.vue";
import IconPortal from "../components/icons/IconPortal.vue";
import IconFlame from "../components/icons/IconFlame.vue";
import IconHourglass from "../components/icons/IconHourglass.vue";
import IconUsers from "../components/icons/IconUsers.vue";

const authStore = useAuthStore();
</script>

<template>
  <main class="screen welcome-screen">
    <section class="hero-split">
      <div class="hero-copy">
        <p class="eyebrow">Daggerheart by Darrington Press</p>
        <h1>Forge the session. Wield the fear.</h1>
        <p class="lede">
          Spin up a room for your table in seconds. Hosts command fear and
          countdowns; players stay in sync with a single code. Everything is
          live, shared, and made for play.
        </p>
        <div class="cta-row">
          <router-link class="btn primary" to="/create">
            <span class="icon"><IconSword /></span>
            Host a session
          </router-link>
          <router-link class="btn ghost" to="/join">
            <span class="icon"><IconPortal /></span>
            Join a session
          </router-link>
        </div>
        <div class="cta-secondary">
          <router-link class="btn subtle" to="/login">
            Sign in to save sessions
          </router-link>
          <span v-if="authStore.currentUser.value" class="meta">
            Signed in as {{ authStore.displayName.value }}
          </span>
        </div>
      </div>

      <div class="hero-showcase">
        <div class="sigil-card">
          <div class="sigil-title">The table, in sync</div>
          <div class="sigil-grid">
            <div class="sigil-item">
              <span class="icon ember"><IconFlame /></span>
              <div>
                <strong>Fear at a glance</strong>
                <p>Always visible. Always shared.</p>
              </div>
            </div>
            <div class="sigil-item">
              <span class="icon gild"><IconHourglass /></span>
              <div>
                <strong>Countdowns on demand</strong>
                <p>Name them. Track them. Turn the dial.</p>
              </div>
            </div>
            <div class="sigil-item">
              <span class="icon teal"><IconUsers /></span>
              <div>
                <strong>Guests or logged in</strong>
                <p>Invite fast, reconnect easily later.</p>
              </div>
            </div>
          </div>
        </div>
        <div class="banner-card">
          <div class="banner-label">Session limits</div>
          <div class="banner-values">
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
        </div>
      </div>
    </section>
  </main>
</template>
