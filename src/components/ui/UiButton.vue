<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

defineOptions({ inheritAttrs: false });

type ButtonVariant = "primary" | "ghost" | "subtle";
type ButtonSize = "default" | "compact";

const props = withDefaults(
  defineProps<{
    to?: RouteLocationRaw;
    variant?: ButtonVariant;
    size?: ButtonSize;
    full?: boolean;
    danger?: boolean;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
  }>(),
  {
    variant: "ghost",
    size: "default",
    full: false,
    danger: false,
    type: "button",
    disabled: false,
  },
);

const attrs = useAttrs();
const isLink = computed(() => props.to !== undefined);
const componentTag = computed(() => (isLink.value ? RouterLink : "button"));

const classes = computed(() => [
  "btn",
  props.variant,
  {
    compact: props.size === "compact",
    full: props.full,
    danger: props.danger,
  },
  attrs.class,
]);

const passThrough = computed(() => {
  const { class: _class, ...rest } = attrs as Record<string, unknown>;
  return rest;
});
</script>

<template>
  <component
    :is="componentTag"
    v-bind="passThrough"
    :to="isLink ? props.to : undefined"
    :type="!isLink ? props.type : undefined"
    :disabled="!isLink ? props.disabled : undefined"
    :class="classes"
  >
    <slot />
  </component>
</template>
