<template>
  <ModuleContainer ref="moduleContainer" :manifest="manifest">
    <div class="th-root">
      <!-- Cabeçalho -->
      <div class="text-caption text-medium-emphasis mb-4">{{ t("theme_subtitle") }}</div>

      <!-- Modo: Automático / Claro / Escuro -->
      <div class="d-flex th-mode-row mb-5">
        <div
          v-for="opt in modeOptions"
          :key="opt.id"
          class="th-mode-card flex-grow-1"
          :class="{ 'th-mode-card--active': themeMode === opt.id }"
          @click="selectMode(opt.id)"
        >
          <v-icon :color="themeMode === opt.id ? 'info' : undefined" size="30" class="mb-2">
            {{ opt.icon }}
          </v-icon>
          <span class="text-body-2 font-weight-medium">{{ t(opt.label) }}</span>
        </div>
      </div>

      <!-- Cores -->
      <div v-for="group in colorGroupsToShow" :key="group.mode" class="mb-4">
        <div class="text-caption font-weight-medium text-medium-emphasis text-uppercase th-group-title">
          {{ group.mode == "dark" ? t("dark-themes") : t("light-themes") }}
        </div>
        <div class="d-flex flex-wrap th-swatch-row">
          <div
            v-for="(theme, theme_id) in group.items"
            :key="theme_id"
            class="th-swatch"
            :class="{ 'th-swatch--active': isColorSelected(theme_id, group.mode) }"
            :style="{ background: gradientFor(theme.colors.primary) }"
            :title="theme_id"
            @click="selectColor(theme_id, group.mode)"
          >
            <v-icon v-if="isColorSelected(theme_id, group.mode)" size="18" color="white">mdi-check-bold</v-icon>
          </div>
        </div>
      </div>
    </div>
  </ModuleContainer>
</template>

<script setup>
import { ref, computed, getCurrentInstance, onMounted, onUnmounted } from "vue";
import manifest from "../manifest.json";
import ModuleContainer from "@/components/ModuleContainer.vue";

const moduleContainer = ref(null);
const t = (key) => {
  if (!moduleContainer.value) {
    const locale = 'pt';
    const tr = manifest.translations?.[locale];
    if (tr) {
      const val = key.split('.').reduce((obj, k) => obj?.[k], tr);
      if (typeof val === 'string') return val;
    }
    return key;
  }
  const result = moduleContainer.value.t(key);
  return (result && result !== `modules.${manifest.id}.${key}`) ? result : key;
};

const { proxy } = getCurrentInstance();

const modeOptions = [
  { id: "auto", icon: "mdi-theme-light-dark", label: "mode_auto" },
  { id: "light", icon: "mdi-white-balance-sunny", label: "mode_light" },
  { id: "dark", icon: "mdi-weather-night", label: "mode_dark" },
];

const current = ref("");
const themes = ref({ light: {}, dark: {} });
const themeMode = ref("light");
const themeLight = ref("light");
const themeDark = ref("dark");
let mql = null;

// ── Gradiente das amostras de cor ───────────────────────────────────────────
function shade(hex, percent) {
  let h = (hex || "#777777").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const num = parseInt(h, 16) || 0x777777;
  let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  const target = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  r = Math.round((target - r) * p) + r;
  g = Math.round((target - g) * p) + g;
  b = Math.round((target - b) * p) + b;
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
function gradientFor(hex) {
  return `linear-gradient(135deg, ${shade(hex, 30)} 0%, ${hex} 55%, ${shade(hex, -25)} 100%)`;
}

// ── Cores exibidas conforme o modo selecionado ──────────────────────────────
const colorGroupsToShow = computed(() => {
  if (themeMode.value === "light") return [{ mode: "light", items: themes.value.light }];
  if (themeMode.value === "dark") return [{ mode: "dark", items: themes.value.dark }];
  // Automático: mostra as duas paletas, para configurar a cor de cada modo do sistema
  return [
    { mode: "light", items: themes.value.light },
    { mode: "dark", items: themes.value.dark },
  ];
});

function isColorSelected(theme_id, mode) {
  return mode === "dark" ? themeDark.value === theme_id : themeLight.value === theme_id;
}

// ── Tema ─────────────────────────────────────────────────────────────────────
function applyTheme(theme_id) {
  if (!theme_id) return;
  proxy.$vuetify.theme.global.name = theme_id;
  proxy.$userdata.set("theme", theme_id);
  proxy.$appdata.set("is_dark", proxy.$vuetify.theme.global.current.dark);
  proxy.$appdata.set("theme", theme_id);
  current.value = theme_id;
}

function systemPrefersDark() {
  return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function selectMode(mode) {
  themeMode.value = mode;
  proxy.$userdata.set("theme_mode", mode);
  proxy.$appdata.set("theme_mode", mode);

  if (mode === "auto") applyTheme(systemPrefersDark() ? themeDark.value : themeLight.value);
  else if (mode === "light") applyTheme(themeLight.value);
  else applyTheme(themeDark.value);
}

function selectColor(theme_id, mode) {
  if (mode === "dark") {
    themeDark.value = theme_id;
    proxy.$userdata.set("theme_dark", theme_id);
  } else {
    themeLight.value = theme_id;
    proxy.$userdata.set("theme_light", theme_id);
  }

  // Só aplica na hora se a cor escolhida pertence ao modo atualmente ativo
  const activeIsDark = themeMode.value === "auto" ? systemPrefersDark() : themeMode.value === "dark";
  if ((mode === "dark") === activeIsDark) applyTheme(theme_id);
}

function onSystemThemeChange() {
  if (themeMode.value === "auto") applyTheme(systemPrefersDark() ? themeDark.value : themeLight.value);
}

// ── Mounted ───────────────────────────────────────────────────────────────────
onMounted(async () => {
  current.value = proxy.$vuetify.theme.global.name;
  themes.value = { light: {}, dark: {} };

  for (const key in proxy.$vuetify.theme.themes) {
    const item = proxy.$vuetify.theme.themes[key];
    if (item.dark) themes.value.dark[key] = item;
    else themes.value.light[key] = item;
  }

  // Reconcilia com o tema atualmente ativo (compatibilidade com dados antigos)
  const isDarkNow = proxy.$vuetify.theme.global.current.dark;
  if (isDarkNow && themes.value.dark[current.value]) themeDark.value = current.value;
  else if (!isDarkNow && themes.value.light[current.value]) themeLight.value = current.value;

  themeLight.value = proxy.$userdata.get("theme_light") || themeLight.value || "light";
  themeDark.value = proxy.$userdata.get("theme_dark") || themeDark.value || "dark";
  themeMode.value = proxy.$userdata.get("theme_mode") || (isDarkNow ? "dark" : "light");

  mql = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  mql?.addEventListener("change", onSystemThemeChange);
});

onUnmounted(() => {
  mql?.removeEventListener("change", onSystemThemeChange);
});
</script>

<style scoped>
.th-mode-row {
  gap: 10px;
}
.th-mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 18px 8px;
  border-radius: 16px;
  cursor: pointer;
  text-align: center;
  border: 2px solid rgba(128, 128, 128, 0.18);
  background: transparent;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}
.th-mode-card:hover {
  border-color: rgba(128, 128, 128, 0.35);
  transform: translateY(-1px);
}
.th-mode-card--active {
  border-color: rgb(var(--v-theme-info));
  background: linear-gradient(160deg, rgba(var(--v-theme-info), 0.18), rgba(var(--v-theme-info), 0.04));
  box-shadow: 0 4px 14px rgba(var(--v-theme-info), 0.22);
}
.th-mode-card--active span {
  color: rgb(var(--v-theme-info));
}

.th-group-title {
  margin-bottom: 8px;
  letter-spacing: 0.4px;
}
.th-swatch-row {
  gap: 12px;
}
.th-swatch {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18), inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.18s ease;
}
.th-swatch:hover {
  transform: scale(1.08);
}
.th-swatch--active {
  transform: scale(1.12);
  box-shadow: 0 0 0 3px rgba(var(--v-theme-info), 0.45), 0 3px 8px rgba(0, 0, 0, 0.25);
}
</style>
