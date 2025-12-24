<script setup lang="ts">
import { computed } from "vue";
import { Flame, Skull } from "lucide-vue-next";
import UiButton from "./ui/UiButton.vue";
import UiPanelTitle from "./ui/UiPanelTitle.vue";

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
  Array.from({ length: maxValue.value }, (_, index) => index + 1)
);
const clampedValue = computed(() =>
  Math.min(Math.max(props.value, 0), maxValue.value)
);
const fillPercent = computed(() => {
  const safeMax = Math.max(maxValue.value, 1);
  return `${(clampedValue.value / safeMax) * 100}%`;
});

const decrement = () => emit("set", clampedValue.value - 1);
const increment = () => emit("set", clampedValue.value + 1);
</script>

<template>
  <section class="fear-altar" :class="{ minimized }">
    <header class="fear-header">
      <UiPanelTitle>
        <template #icon>
          <span class="icon ember"><Flame /></span>
        </template>
        <div>
          <p class="eyebrow">Fear tracker</p>
          <h2>Fear commands the table</h2>
        </div>
      </UiPanelTitle>
      <UiButton
        variant="ghost"
        size="compact"
        type="button"
        @click="emit('toggle')"
      >
        {{ minimized ? "Expand" : "Minimize" }}
      </UiButton>
    </header>

    <div v-if="!minimized" class="fear-body">
      <div class="fear-tracker tracker">
        <div class="tracker-header">
          <span class="meta-label">Current fear</span>
          <div class="tracker-value">
            <strong>{{ clampedValue }}</strong>
            <span class="meta">/ {{ maxValue }}</span>
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
              type="button"
              :disabled="!canEdit"
              :aria-label="`Set fear to ${level}`"
              @click="emit('set', level)"
            >
              <span class="icon tracker-icon" aria-hidden="true">
                <Skull />
              </span>
            </button>
          </div>
        </div>
        <div class="tracker-labels">
          <span class="meta">0</span>
          <span class="meta">{{ maxValue }}</span>
        </div>
      </div>

      <div v-if="canEdit" class="fear-controls">
        <UiButton variant="subtle" type="button" @click="decrement">
          <span class="icon"><Skull /></span>
          Lower
        </UiButton>
        <UiButton variant="primary" type="button" @click="increment">
          <span class="icon"><Skull /></span>
          Raise
        </UiButton>
      </div>
    </div>
  </section>
</template>
