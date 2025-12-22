<script setup lang="ts">
import { computed, useAttrs } from "vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    label: string;
    as?: "label" | "div";
    id?: string;
    hint?: string;
  }>(),
  {
    as: "label",
    id: undefined,
    hint: undefined,
  },
);

const attrs = useAttrs();
const classes = computed(() => ["field", attrs.class]);

const passThrough = computed(() => {
  const { class: _class, ...rest } = attrs as Record<string, unknown>;
  return rest;
});

const labelFor = computed(() =>
  props.as === "label" ? props.id : undefined,
);
</script>

<template>
  <component :is="props.as" v-bind="passThrough" :class="classes" :for="labelFor">
    <span>{{ props.label }}</span>
    <slot />
    <p v-if="props.hint" class="field-hint">{{ props.hint }}</p>
  </component>
</template>
