<script setup lang="ts">
import { computed, useAttrs } from "vue";

defineOptions({ inheritAttrs: false });

type CardVariant =
  | "panel"
  | "panel-alt"
  | "side"
  | "sigil"
  | "banner"
  | "countdown"
  | "countdown-panel"
  | "resume"
  | "auth"
  | "lore"
  | "path"
  | (string & {});

const props = withDefaults(
  defineProps<{
    as?: keyof HTMLElementTagNameMap;
    variant?: CardVariant;
    wide?: boolean;
  }>(),
  {
    as: "div",
    variant: "panel",
    wide: false,
  },
);

const attrs = useAttrs();

const variantClass = computed(() => {
  const map: Record<string, string> = {
    panel: "panel",
    "panel-alt": "panel panel-alt",
    side: "side-card",
    sigil: "sigil-card",
    banner: "banner-card",
    countdown: "countdown-card",
    "countdown-panel": "countdown-panel",
    resume: "resume-card",
    auth: "auth-card",
    lore: "lore-card",
    path: "path-card",
  };
  const key = props.variant ?? "panel";
  return map[key] ?? key;
});

const classes = computed(() => [
  variantClass.value,
  { wide: props.wide },
  attrs.class,
]);

const passThrough = computed(() => {
  const { class: _class, ...rest } = attrs as Record<string, unknown>;
  return rest;
});
</script>

<template>
  <component :is="props.as" v-bind="passThrough" :class="classes">
    <slot />
  </component>
</template>
