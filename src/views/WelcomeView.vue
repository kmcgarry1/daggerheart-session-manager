<script setup lang="ts">
import { useAuthStore } from "../stores/authStore";
import UiButton from "../components/ui/UiButton.vue";
import UiCard from "../components/ui/UiCard.vue";
import {
  DoorOpen,
  Flame,
  Hourglass,
  ScrollText,
  Shield,
  Sparkles,
  Sword,
  Swords,
  Users,
} from "lucide-vue-next";

const authStore = useAuthStore();
const fearPreviewMax = 12;
const fearPreviewValue = 6;
const fearPreview = Array.from(
  { length: fearPreviewMax },
  (_, index) => index + 1,
);
const fearPreviewFill = `${(fearPreviewValue / fearPreviewMax) * 100}%`;
</script>

<template>
  <main class="screen welcome-screen">
    <section class="hero-split">
      <div class="hero-copy">
        <p class="eyebrow">Daggerheart by Darrington Press</p>
        <h1>Forge the session. Wield the fear.</h1>
        <div class="rune-divider" aria-hidden="true"></div>
        <p class="lede">
          Spin up a room for your table in seconds. Hosts command fear and
          countdowns; players stay in sync with a single code. Everything is
          live, shared, and made for play.
        </p>
        <div class="cta-row">
          <UiButton variant="primary" to="/create">
            <span class="icon"><Sword /></span>
            Host a session
          </UiButton>
          <UiButton variant="ghost" to="/join">
            <span class="icon"><DoorOpen /></span>
            Join a session
          </UiButton>
        </div>
        <div class="cta-secondary">
          <UiButton variant="subtle" to="/login">
            Sign in to save sessions
          </UiButton>
          <span v-if="authStore.isSignedIn.value" class="meta">
            Signed in as {{ authStore.displayName.value }}
          </span>
        </div>
      </div>

      <div class="hero-showcase">
        <UiCard variant="sigil">
          <div class="sigil-title">The table, in sync</div>
          <div class="sigil-grid">
            <div class="sigil-item">
              <span class="icon ember"><Flame /></span>
              <div>
                <strong>Fear at a glance</strong>
                <p>Always visible. Always shared.</p>
              </div>
            </div>
            <div class="sigil-item">
              <span class="icon gild"><Hourglass /></span>
              <div>
                <strong>Countdowns on demand</strong>
                <p>Name them. Track them. Turn the dial.</p>
              </div>
            </div>
            <div class="sigil-item">
              <span class="icon teal"><Users /></span>
              <div>
                <strong>Guests or logged in</strong>
                <p>Invite fast, reconnect easily later.</p>
              </div>
            </div>
          </div>
        </UiCard>
        <UiCard variant="banner">
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
        </UiCard>
      </div>
    </section>

    <section class="ritual-section">
      <div class="section-header">
        <p class="eyebrow">The ritual</p>
        <h2>Three breaths to gather the table.</h2>
        <div class="rune-divider" aria-hidden="true"></div>
        <p class="lede">
          Host, share, and play without passing phones or losing the moment.
        </p>
      </div>
      <div class="ritual-grid">
        <UiCard as="article" variant="ritual-card">
          <span class="icon ember"><Sparkles /></span>
          <h3>Summon a session</h3>
          <p>Forge a room, name the host, and claim the code.</p>
          <span class="meta">Host</span>
        </UiCard>
        <UiCard as="article" variant="ritual-card">
          <span class="icon gild"><ScrollText /></span>
          <h3>Share the sigil</h3>
          <p>Players join in seconds with a short code and their name.</p>
          <span class="meta">Guest friendly</span>
        </UiCard>
        <UiCard as="article" variant="ritual-card">
          <span class="icon teal"><Swords /></span>
          <h3>Keep the table synced</h3>
          <p>Fear and countdowns update live for everyone at once.</p>
          <span class="meta">Realtime</span>
        </UiCard>
      </div>
    </section>

    <section class="fear-spotlight">
      <div class="spotlight-copy">
        <p class="eyebrow">Fear first</p>
        <h2>The fear tracker is the heartbeat of the session.</h2>
        <div class="rune-divider" aria-hidden="true"></div>
        <p class="lede">
          Players keep the dial on-screen while the host shapes the tension.
          Every shift lands instantly across the table.
        </p>
        <ul class="spotlight-list">
          <li>
            <span class="icon ember"><Flame /></span>
            <div>
              <strong>Always visible</strong>
              <p>Fear stays centered and can be minimized, not hidden.</p>
            </div>
          </li>
          <li>
            <span class="icon gild"><Shield /></span>
            <div>
              <strong>Host-driven control</strong>
              <p>Players watch the pressure rise while hosts drive the dial.</p>
            </div>
          </li>
        </ul>
      </div>
      <UiCard variant="spotlight-card">
        <div class="fear-preview">
          <div class="fear-preview-readout">
            <span class="meta">Fear</span>
            <strong>{{ fearPreviewValue }}</strong>
            <span class="meta">/ {{ fearPreviewMax }}</span>
          </div>
          <div
            class="fear-preview-bar tracker-bar"
            :style="{
              '--count': fearPreview.length,
              '--fill': fearPreviewFill,
            }"
          >
            <div class="tracker-fill" aria-hidden="true"></div>
            <div class="tracker-segments">
              <span
                v-for="level in fearPreview"
                :key="level"
                class="tracker-segment"
                :class="{
                  'is-filled': level <= fearPreviewValue,
                  'is-active': level === fearPreviewValue,
                }"
                aria-hidden="true"
              ></span>
            </div>
          </div>
          <div class="fear-preview-footer">
            <div class="fear-preview-pill">
              <span class="icon ember"><Flame /></span>
              Live for every player
            </div>
            <p class="meta">0 - 12 tension scale</p>
          </div>
        </div>
      </UiCard>
    </section>

    <section class="feature-section">
      <div class="section-header">
        <p class="eyebrow">Session kit</p>
        <h2>Tools for hosts and players alike.</h2>
        <div class="rune-divider" aria-hidden="true"></div>
        <p class="lede">
          Build momentum with named countdowns, a shared roster, and fast
          reconnection for signed-in players.
        </p>
      </div>
      <div class="feature-grid">
        <UiCard as="article" variant="feature-card">
          <span class="icon ember"><Hourglass /></span>
          <h3>Named countdowns</h3>
          <p>Drop as many looming clocks as you need.</p>
        </UiCard>
        <UiCard as="article" variant="feature-card">
          <span class="icon teal"><Users /></span>
          <h3>Live roster</h3>
          <p>Track every guest and signed-in player in one list.</p>
        </UiCard>
        <UiCard as="article" variant="feature-card">
          <span class="icon gild"><ScrollText /></span>
          <h3>Rejoin with ease</h3>
          <p>Signed-in players can jump back into saved sessions.</p>
        </UiCard>
        <UiCard as="article" variant="feature-card">
          <span class="icon ember"><Shield /></span>
          <h3>Safe, short-lived rooms</h3>
          <p>Join codes rotate hourly, sessions last 24 hours.</p>
        </UiCard>
      </div>
    </section>

    <UiCard as="section" variant="cta-banner">
      <div>
        <p class="eyebrow">Ready to play</p>
        <h2>Light the hallfire.</h2>
        <p class="lede">
          Create a session to command fear, or join your party with a single
          code.
        </p>
      </div>
      <div class="cta-row">
        <UiButton variant="primary" to="/create">
          <span class="icon"><Sword /></span>
          Host a session
        </UiButton>
        <UiButton variant="ghost" to="/join">
          <span class="icon"><DoorOpen /></span>
          Join a session
        </UiButton>
      </div>
    </UiCard>
  </main>
</template>
