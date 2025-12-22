<script setup lang="ts">
import { computed } from "vue";
import IconFlame from "./icons/IconFlame.vue";

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
  <section class="fear-altar" :class="{ minimized }">
    <header class="fear-header">
      <div class="panel-title">
        <span class="icon ember"><IconFlame /></span>
        <div>
          <p class="eyebrow">Fear tracker</p>
          <h2>Fear commands the table</h2>
        </div>
      </div>
      <button class="btn ghost compact" type="button" @click="emit('toggle')">
        {{ minimized ? "Expand" : "Minimize" }}
      </button>
    </header>

    <div v-if="!minimized" class="fear-body">
      <div
        class="fear-dial"
        :style="{
          '--count': levels.length,
          '--radius': '120px',
          '--dot-size': '36px',
        }"
      >
        <div class="fear-core">
          <span class="meta">Current fear</span>
          <strong>{{ clampedValue }}</strong>
          <span class="meta">/ {{ maxValue }}</span>
        </div>
        <button
          v-for="level in levels"
          :key="level"
          class="fear-marker"
          :class="{
            'is-filled': level <= clampedValue,
            'is-active': level === clampedValue,
          }"
          :style="{ '--i': level }"
          type="button"
          :disabled="!canEdit"
          :aria-label="`Set fear to ${level}`"
          @click="emit('set', level)"
        >
          <span>{{ level }}</span>
        </button>
      </div>

      <div v-if="canEdit" class="fear-controls">
        <button class="btn subtle" type="button" @click="decrement">
          Lower
        </button>
        <button class="btn primary" type="button" @click="increment">
          Raise
        </button>
      </div>
    </div>
  </section>
</template>
