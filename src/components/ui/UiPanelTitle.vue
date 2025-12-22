<script setup lang="ts">
import { computed, useAttrs } from "vue";

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const classes = computed(() => ["panel-title", attrs.class]);

const passThrough = computed(() => {
  const { class: _class, ...rest } = attrs as Record<string, unknown>;
  return rest;
});
</script>

<template>
  <div v-bind="passThrough" :class="classes">
    <slot name="icon" />
    <slot />
  </div>
</template>
