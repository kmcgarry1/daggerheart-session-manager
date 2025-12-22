<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  value: number;
  max?: number;
  canEdit: boolean;
  minimized: boolean;
}>();

const emit = defineEmits<{
  (e: "set", value: number): void;
  (e: "toggle"): void;
}>();

const maxValue = computed(() => props.max ?? 12);
const levels = computed(() =>
  Array.from({ length: maxValue.value + 1 }, (_, index) => index),
);
const clampedValue = computed(() =>
  Math.min(Math.max(props.value, 0), maxValue.value),
);

const decrement = () => emit("set", clampedValue.value - 1);
const increment = () => emit("set", clampedValue.value + 1);
</script>

<template>
  <aside class="fear-panel" :class="{ minimized }">
    <div class="fear-header">
      <div>
        <span class="meta-label">Fear tracker</span>
        <strong>{{ clampedValue }}</strong>
      </div>
      <button class="btn secondary compact" type="button" @click="emit('toggle')">
        {{ minimized ? "Expand" : "Minimize" }}
      </button>
    </div>

    <div v-if="!minimized" class="fear-body">
      <div class="fear-dots">
        <button
          v-for="level in levels"
          :key="level"
          class="fear-dot"
          :class="{
            'is-filled': level <= clampedValue,
            'is-active': level === clampedValue,
          }"
          type="button"
          :disabled="!canEdit"
          :aria-label="`Set fear to ${level}`"
          @click="emit('set', level)"
        >
          <span>{{ level }}</span>
        </button>
      </div>

      <div v-if="canEdit" class="fear-controls">
        <button class="btn ghost" type="button" @click="decrement">-1</button>
        <button class="btn ghost" type="button" @click="increment">+1</button>
      </div>
    </div>
  </aside>
</template>
