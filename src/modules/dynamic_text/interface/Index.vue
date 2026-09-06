<template>
  <l-window
    v-model="module.show"
    :title="t('title')"
    :icon="module.icon"
    closable
    minimizable
    :index="show ? 1 : 0"
    size="small"
    @close="close()"
    @minimize="$modules.minimize(module_id)"
  >
    <template v-slot:system_buttons>
      <LScreenBtn module="dynamic_text" />
    </template>

    <template v-slot:customize>
      <l-customization-tools
        :module="module"
        :items="[
          {
            name: t('customization.background'),
            items: ['background_color', ['image', 'image_opacity', 'image_fit']],
          },
        ]"
      />
    </template>

    <div class="dt-root">
      <div class="dt-group-label">{{ t("labels.display") }}</div>
      <div class="dt-row">
        <input
          v-model="text"
          type="text"
          class="dt-text-input"
          :placeholder="t('labels.text_placeholder')"
          @keydown.enter="showText"
        />
        <button class="se-btn-outline" @click="showText">
          <v-icon size="16">mdi-play</v-icon> {{ t("actions.show_text") }}
        </button>
      </div>

      <v-divider class="my-3" />

      <div class="dt-group-label">{{ t("labels.formatting") }}</div>
      <div class="dt-row">
        <button class="se-btn-outline" @click="formatDialog = true">
          <v-icon size="16">mdi-palette-outline</v-icon> {{ t("actions.format") }}
        </button>
        <button class="se-btn-outline" @click="restoreFormat">
          <v-icon size="16">mdi-restore</v-icon> {{ t("actions.restore") }}
        </button>
      </div>
    </div>

    <v-dialog v-model="formatDialog" max-width="380">
      <v-card>
        <v-card-title>{{ t("actions.format") }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="userdata.font"
            :items="FONT_OPTIONS"
            item-title="label"
            item-value="value"
            :label="t('labels.font')"
            density="compact"
            hide-details
            class="mb-3"
            @update:model-value="rebroadcastIfShown"
          />
          <v-text-field
            v-model.number="userdata.font_size"
            type="number"
            min="5"
            max="40"
            :label="t('labels.size')"
            density="compact"
            hide-details
            class="mb-3"
            @update:model-value="rebroadcastIfShown"
          />
          <div class="dt-row mb-3">
            <label class="dt-inline-label">{{ t("labels.text_color") }}</label>
            <input type="color" v-model="userdata.color" class="se-color-input" @change="rebroadcastIfShown" />
          </div>
          <div class="dt-group-label">{{ t("labels.alignment") }}</div>
          <div class="se-align-group">
            <button
              v-for="opt in ['left', 'center', 'right']"
              :key="opt"
              type="button"
              class="se-btn-icon"
              :class="{ 'is-active': userdata.text_align === opt }"
              @click="setAlign(opt)"
            >
              <v-icon size="16">{{ `mdi-format-align-${opt}` }}</v-icon>
            </button>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="formatDialog = false">{{ t("actions.close") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </l-window>
</template>

<script>
import manifest from "../manifest.json";
import LWindow from "@/components/Window.vue";
import LScreenBtn from "@/components/buttons/Screen.vue";
import LCustomizationTools from "@/components/CustomizationTools.vue";

const FONT_OPTIONS = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, sans-serif" },
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "DIN Condensed", value: "DINCondensedBold, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
];

const DEFAULT_FORMAT = {
  font: "Arial, sans-serif",
  font_size: 12,
  color: "#FFFFFF",
  text_align: "center",
};

export default {
  name: "DynamicTextModule",
  components: {
    LWindow,
    LScreenBtn,
    LCustomizationTools,
  },
  data: () => ({
    FONT_OPTIONS,
    text: "",
    shown: false,
    formatDialog: false,
  }),
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => this.$userdata.get(`modules.${this.module_id}.${key}`, DEFAULT_FORMAT[key] ?? null),
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module_id}.${key}`, value);
            return true;
          },
        }
      );
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
    show() {
      return this.module.show;
    },
  },
  methods: {
    /* METHODS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      const key = `modules.${this.module_id}.${text}`;
      const result = this.$t(key);
      if (result === key) {
        if (text === "title") return manifest.name || result;
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || "pt";
        const storedManifest = this.$appdata.get(`modules.${this.module_id}.manifest`);
        const translations = storedManifest?.translations?.[locale] || storedManifest?.translations?.["pt"];
        if (translations) {
          const val = text.split(".").reduce((obj, k) => obj?.[k], translations);
          if (typeof val === "string") return val;
        }
      }
      return result;
    },
    close() {
      this.$modules.close(this.module_id);
    },
    /* METHODS OBRIGATÓRIAS - FIM */

    showText() {
      this.shown = this.text.trim() !== "";
      this.broadcast();
    },
    setAlign(opt) {
      this.userdata.text_align = opt;
      this.rebroadcastIfShown();
    },
    restoreFormat() {
      Object.entries(DEFAULT_FORMAT).forEach(([key, value]) => {
        this.userdata[key] = value;
      });
      this.rebroadcastIfShown();
    },
    rebroadcastIfShown() {
      if (this.shown) this.broadcast();
    },
    broadcast() {
      const base = `modules.${this.module_id}`;
      this.$appdata.setMultiple([
        [`${base}.text`, this.shown ? this.text : ""],
        [`${base}.font`, this.userdata.font],
        [`${base}.font_size`, this.userdata.font_size],
        [`${base}.color`, this.userdata.color],
        [`${base}.text_align`, this.userdata.text_align],
      ]);
    },
  },
  mounted() {
    this.broadcast();
  },
};
</script>

<style scoped>
.dt-root {
  padding: 16px 20px;
}
.dt-group-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
  font-weight: 600;
  margin-bottom: 8px;
}
.dt-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dt-text-input {
  flex: 1;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  padding: 8px 12px;
  background: transparent;
  color: inherit;
  font-size: 14px;
}
.dt-inline-label {
  flex: 1;
  font-size: 13px;
}

/* Botões compactos — mesmo padrão do resto da interface */
.se-btn-outline,
.se-btn-icon {
  display: flex;
  align-items: center;
  gap: 5px;
  border-radius: 6px;
  font-size: 12.5px;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  transition: background 0.15s;
  white-space: nowrap;
}
.se-btn-outline {
  padding: 8px 14px;
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}
.se-btn-outline:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.se-btn-icon {
  padding: 6px;
  width: 28px;
  height: 28px;
  justify-content: center;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.se-btn-icon:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.se-btn-icon.is-active {
  color: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}
.se-align-group {
  display: flex;
  gap: 4px;
}
.se-color-input {
  width: 34px;
  height: 28px;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}
</style>
