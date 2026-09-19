<template>
  <ModuleContainer ref="moduleContainer" :manifest="manifest">
    <!-- Temas Claros / Escuros -->
    <div v-for="(group, mode) in themes" :key="mode" class="mb-3">
      <div class="subtitle-1 font-weight-medium">
        {{ mode == "dark" ? t("dark-themes") : t("light-themes") }}
      </div>

      <v-btn
        v-for="(theme, theme_id) in group"
        :key="theme_id"
        icon
        density="compact"
        :variant="current == theme_id ? 'outlined' : 'plain'"
        :color="theme.colors.primary"
        class="mx-1"
        @click="setTheme(theme_id)"
      >
        <v-avatar
          :color="theme.colors.primary"
          size="22"
          style="outline: 1.5px solid rgba(128,128,128,0.45); outline-offset: 1px;"
        />
      </v-btn>
    </div>

  </ModuleContainer>
</template>

<script setup>
import { ref, computed, getCurrentInstance, onMounted } from "vue";
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

const current = ref("");
const themes = ref({ light: {}, dark: {} });

// ── Tema ─────────────────────────────────────────────────────────────────────
function setTheme(theme_id) {
  current.value = theme_id;
  proxy.$vuetify.theme.global.name = current.value;
  proxy.$userdata.set("theme", current.value);
  proxy.$appdata.set("is_dark", proxy.$vuetify.theme.global.current.dark);
  proxy.$appdata.set("theme", current.value);
  moduleContainer.value.close();
}

// ── Mounted ───────────────────────────────────────────────────────────────────
onMounted(async () => {
  current.value = proxy.$vuetify.theme.global.name;
  themes.value = { light: {}, dark: {} };

  for (const key in proxy.$vuetify.theme.themes) {
    const item = proxy.$vuetify.theme.themes[key];
    if (item.dark) {
      themes.value.dark[key] = item;
    } else {
      themes.value.light[key] = item;
    }
  }

});
</script>
