<script setup lang="ts">
import { computed } from "vue";
import { Clock, Hourglass, Trash2 } from "lucide-vue-next";
import UiButton from "./ui/UiButton.vue";
import UiCard from "./ui/UiCard.vue";
import type { CountdownData } from "../services/sessions";

const props = defineProps<{
  countdown: CountdownData;
  canEdit: boolean;
}>();

const emit = defineEmits<{
  (e: "set", value: number): void;
  (e: "remove"): void;
}>();

const maxValue = computed(() => Math.max(props.countdown.max, 1));
const clampedValue = computed(() =>
  Math.min(Math.max(props.countdown.value, 0), maxValue.value),
);
const levels = computed(() =>
  Array.from({ length: maxValue.value }, (_, index) => index + 1),
);
const fillPercent = computed(
  () => `${(clampedValue.value / maxValue.value) * 100}%`,
);

const clampValue = (value: number) =>
  Math.min(Math.max(value, 0), props.countdown.max);

const decrement = () => emit("set", clampValue(props.countdown.value - 1));
const increment = () => emit("set", clampValue(props.countdown.value + 1));
</script>

<template>
  <UiCard variant="countdown">
    <div class="countdown-header">
      <div class="countdown-title">
        <span class="icon ember"><Hourglass /></span>
        <div>
          <p class="eyebrow">Countdown</p>
          <h3>{{ countdown.name || "Countdown" }}</h3>
        </div>
      </div>
      <UiButton
        v-if="canEdit"
        variant="ghost"
        size="compact"
        danger
        type="button"
        @click="emit('remove')"
      >
        <span class="icon"><Trash2 /></span>
        Dispel
      </UiButton>
    </div>

    <div class="countdown-tracker tracker">
      <div class="tracker-header">
        <span class="meta-label">Current</span>
        <div class="tracker-value">
          <strong>{{ clampedValue }}</strong>
          <span class="meta">/ {{ countdown.max }}</span>
        </div>
      </div>
      <div
        class="tracker-bar"
        :style="{
          '--count': levels.length,
          '--fill': fillPercent,
        }"
      >
        <div class="tracker-fill" aria-hidden="true"></div>
        <div class="tracker-segments">
          <button
            v-for="level in levels"
            :key="level"
            class="tracker-segment"
            :class="{
              'is-filled': level <= clampedValue,
              'is-active': level === clampedValue,
            }"
            :disabled="!canEdit"
            type="button"
            :aria-label="`Set countdown to ${level}`"
            @click="emit('set', level)"
          >
            <span class="icon tracker-icon" aria-hidden="true">
              <Clock />
            </span>
          </button>
        </div>
      </div>
      <div class="tracker-labels">
        <span class="meta">0</span>
        <span class="meta">{{ countdown.max }}</span>
      </div>
    </div>

    <div class="countdown-footer">
      <div class="countdown-meta">
        <span class="meta">Max {{ countdown.max }}</span>
        <span class="meta">Current {{ clampedValue }}</span>
      </div>
      <div v-if="canEdit" class="countdown-controls">
        <UiButton variant="ghost" size="compact" type="button" @click="decrement">
          -1
        </UiButton>
        <UiButton variant="ghost" size="compact" type="button" @click="increment">
          +1
        </UiButton>
      </div>
    </div>
  </UiCard>
</template>
