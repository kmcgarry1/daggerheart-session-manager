import { ref, watch } from "vue";

type ThemeMode = "dark" | "light";

const THEME_KEY = "dh_theme";
const theme = ref<ThemeMode>("dark");
let initialized = false;

const applyTheme = (value: ThemeMode) => {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.theme = value;
  document.documentElement.style.colorScheme = value;
  localStorage.setItem(THEME_KEY, value);
};

const init = () => {
  if (initialized) {
    return;
  }
  initialized = true;

  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    if (stored === "dark" || stored === "light") {
      theme.value = stored;
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      theme.value = "light";
    }
  }

  watch(
    theme,
    (value) => {
      applyTheme(value);
    },
    { immediate: true },
  );
};

const toggle = () => {
  theme.value = theme.value === "dark" ? "light" : "dark";
};

export const useThemeStore = () => ({
  theme,
  init,
  toggle,
});
