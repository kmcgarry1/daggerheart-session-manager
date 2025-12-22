<script setup lang="ts">
import { computed } from "vue";
import { Hourglass, Trash2 } from "lucide-vue-next";
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

const levels = computed(() =>
  Array.from({ length: props.countdown.max + 1 }, (_, index) => index),
);

const radius = computed(() => {
  if (levels.value.length <= 8) return 54;
  if (levels.value.length <= 12) return 62;
  if (levels.value.length <= 18) return 70;
  return 78;
});

const dotSize = computed(() => {
  if (levels.value.length <= 10) return 22;
  if (levels.value.length <= 14) return 18;
  return 16;
});

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

    <div
      class="countdown-radial"
      :style="{
        '--count': levels.length,
        '--radius': `${radius}px`,
        '--dot-size': `${dotSize}px`,
      }"
    >
      <div class="radial-center">
        <span class="meta-label">Current</span>
        <strong>{{ countdown.value }}</strong>
      </div>
      <button
        v-for="level in levels"
        :key="level"
        class="radial-dot"
        :class="{
          'is-filled': level <= countdown.value,
          'is-active': level === countdown.value,
        }"
        :style="{ '--i': level }"
        :disabled="!canEdit"
        type="button"
        :aria-label="`Set countdown to ${level}`"
        @click="emit('set', level)"
      >
        <span>{{ level }}</span>
      </button>
    </div>

    <div class="countdown-footer">
      <div class="countdown-meta">
        <span class="meta">Max {{ countdown.max }}</span>
        <span class="meta">Current {{ countdown.value }}</span>
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
