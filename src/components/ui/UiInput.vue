<script setup lang="ts">
import { computed, useAttrs } from "vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    modelModifiers?: Record<string, boolean>;
    type?: string;
    id?: string;
  }>(),
  {
    modelValue: "",
    modelModifiers: () => ({}),
    type: "text",
    id: undefined,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string | number): void;
}>();

const attrs = useAttrs();
const classes = computed(() => ["field-input", attrs.class]);

const passThrough = computed(() => {
  const { class: _class, ...rest } = attrs as Record<string, unknown>;
  return rest;
});

const normalizeValue = (rawValue: string) => {
  let next: string | number = rawValue;
  if (props.modelModifiers?.trim) {
    next = next.trim();
  }
  if (props.modelModifiers?.number) {
    const parsed = Number(next);
    if (!Number.isNaN(parsed) && rawValue !== "") {
      next = parsed;
    }
  }
  return next;
};

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit("update:modelValue", normalizeValue(target.value));
};
</script>

<template>
  <input
    v-bind="passThrough"
    :id="props.id"
    :type="props.type"
    :value="props.modelValue"
    :class="classes"
    @input="handleInput"
  />
</template>
