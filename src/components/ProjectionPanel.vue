<template>
  <!-- Painel lateral de testes/ajuste da projeção em camadas e do multiviewer
       do retorno (helpers/Layers.js) — marca e desmarca tudo num lugar só,
       sem precisar abrir cada módulo. Aberto pelo item "Projeção e
       multiviewer" do menu lateral (layout/Menu.vue). -->
  <v-navigation-drawer
    v-model="show"
    :location="$vuetify.display.width < 600 ? 'bottom' : 'left'"
    temporary
    width="340"
    class="pp-drawer"
  >
    <div class="pp-head">
      <v-icon size="20">mdi-view-dashboard-edit-outline</v-icon>
      <span class="pp-title">{{ t("title") }}</span>
      <v-spacer />
      <v-btn icon="mdi-close" variant="text" size="small" @click="show = false" />
    </div>

    <!-- ── Projeção principal ───────────────────────────────────────── -->
    <div class="pp-section">
      <div class="pp-section-title">
        <v-icon size="16">mdi-projector-screen-outline</v-icon>
        {{ t("projection") }}
      </div>
      <div class="pp-status">
        <span class="pp-dot" :class="{ on: outputOpen }" />
        <span v-if="outputOpen && mainModule">{{ t("projecting") }} <b>{{ label(mainModule) }}</b></span>
        <span v-else>{{ t("nothing_projected") }}</span>
      </div>
      <div class="pp-hint">{{ t("projection_hint") }}</div>

      <div v-for="m in LAYER_MODULES" :key="m" class="pp-row">
        <div class="pp-row-label">
          <v-icon size="16">{{ ICONS[m] }}</v-icon>
          <span>{{ label(m) }}</span>
          <span v-if="m === mainModule && outputOpen" class="pp-chip">{{ t("main") }}</span>
        </div>
        <v-btn-toggle
          :model-value="layerMode(m)"
          density="compact"
          variant="outlined"
          divided
          mandatory
          class="pp-toggle"
          :disabled="m === mainModule && outputOpen"
          @update:model-value="(v) => setLayer(m, v)"
        >
          <v-btn value="off" size="small">{{ t("off") }}</v-btn>
          <v-btn value="overlay" size="small">{{ t("overlay") }}</v-btn>
          <v-btn value="share" size="small">{{ t("share") }}</v-btn>
        </v-btn-toggle>
      </div>
    </div>

    <v-divider />

    <!-- ── Multiviewer do retorno ───────────────────────────────────── -->
    <div class="pp-section">
      <div class="pp-section-title">
        <v-icon size="16">mdi-view-grid-outline</v-icon>
        {{ t("multiview") }}
      </div>
      <div class="pp-status">
        <span class="pp-dot" :class="{ on: returnOpen }" />
        <span>{{ returnOpen ? t("return_open") : t("return_closed") }}</span>
        <v-spacer />
        <v-btn
          size="x-small"
          variant="tonal"
          :color="returnOpen ? 'error' : 'primary'"
          @click="toggleReturn"
        >{{ returnOpen ? t("close_return") : t("open_return") }}</v-btn>
      </div>
      <div class="pp-hint">{{ t("multiview_hint") }}</div>

      <v-checkbox
        v-for="m in MULTIVIEW_MODULES"
        :key="m"
        :model-value="multiview.includes(m)"
        density="compact"
        hide-details
        color="primary"
        class="pp-check"
        @update:model-value="(v) => setMultiview(m, v)"
      >
        <template #label>
          <v-icon size="16" class="mr-2">{{ ICONS[m] }}</v-icon>
          <span>{{ label(m) }}</span>
          <span v-if="!moduleOpen(m)" class="pp-chip pp-chip-dim">{{ t("closed") }}</span>
        </template>
      </v-checkbox>
      <div class="pp-hint mt-2">{{ t("tiles", { n: multiview.length }) }}</div>
    </div>

    <v-divider />

    <div class="pp-section">
      <v-btn block variant="tonal" color="error" prepend-icon="mdi-broom" @click="clearAll">
        {{ t("clear_all") }}
      </v-btn>
    </div>
  </v-navigation-drawer>
</template>

<script>
import $layers from "@/helpers/Layers";

const LAYER_MODULES = ["clock", "cronometro_culto", "bible"];
const MULTIVIEW_MODULES = ["media", "slide_editor", "bible", "clock", "cronometro_culto", "video_player", "web_link"];
const ICONS = {
  media: "mdi-music-note",
  slide_editor: "mdi-presentation",
  bible: "mdi-book-open-variant",
  clock: "mdi-clock-outline",
  cronometro_culto: "mdi-timer-outline",
  video_player: "mdi-video-outline",
  web_link: "mdi-youtube",
};

export default {
  name: "ProjectionPanel",
  data: () => ({
    LAYER_MODULES,
    MULTIVIEW_MODULES,
    ICONS,
    outputOpen: false,
    returnOpen: false,
  }),
  computed: {
    show: {
      get() { return !!this.$appdata.get("projection_panel.show"); },
      set(v) { this.$appdata.set("projection_panel.show", !!v); },
    },
    mainModule() {
      return this.$appdata.get("popup_module") || "";
    },
    layers() {
      return this.$appdata.get("projection_layers") || {};
    },
    multiview() {
      return this.$appdata.get("return_multiview") || [];
    },
  },
  watch: {
    show(v) { if (v) this.refreshWindows(); },
  },
  mounted() {
    this._h = [
      ["output-window-opened", () => { this.outputOpen = true; }],
      ["output-window-closed", () => { this.outputOpen = false; }],
      ["return-window-opened", () => { this.returnOpen = true; }],
      ["return-window-closed", () => { this.returnOpen = false; }],
    ].map(([ch, fn]) => [ch, this.$electron.on?.(ch, fn)]).filter(([, h]) => h);
    this.refreshWindows();
  },
  beforeUnmount() {
    (this._h || []).forEach(([ch, h]) => this.$electron.off?.(ch, h));
  },
  methods: {
    t(k, p) { return this.$t(`components.projection_panel.${k}`, p || {}); },
    label(m) { return this.t(`m_${m}`); },
    layerMode(m) { return this.layers[m] || "off"; },
    moduleOpen(m) {
      return !!this.$appdata.get(`modules.${m}.show`) || !!this.$appdata.get(`modules.${m}.minimized`);
    },
    async refreshWindows() {
      if (!this.$electron.isElectron()) return;
      this.outputOpen = !!(await this.$electron.isOutputOpen());
      this.returnOpen = !!(await this.$electron.isReturnScreenOpen());
    },
    // As camadas/quadros só aparecem com o módulo aberto (Popup.vue e
    // ReturnScreen.vue checam show || minimized) — abre se estiver fechado.
    // Abre minimizado (vai pra bandeja) — aberto normal, a janela do módulo
    // cobriria este painel e o operador perderia o que estava marcando.
    ensureModuleOpen(m) {
      if (m === "web_link" || this.moduleOpen(m) || !this.$modules.check(m)) return;
      this.$modules.minimize(m);
      if (!this.moduleOpen(m)) this.$modules.open(m);
    },
    async setLayer(m, mode) {
      if (!mode || mode === "off") {
        $layers.clearLayer(m);
        return;
      }
      this.ensureModuleOpen(m);
      // Nada projetado ainda: não há sobre o que sobrepor/dividir — projeta normal
      if (!this.outputOpen || !this.mainModule) {
        $layers.clearLayer(m);
        await this.$popup.open(m);
        return;
      }
      if (m === this.mainModule) return;
      $layers.setLayer(m, mode);
    },
    async setMultiview(m, on) {
      const has = this.multiview.includes(m);
      if (!!on === has) return;
      if (on) this.ensureModuleOpen(m);
      $layers.toggleMultiview(m);
      if (on && !this.returnOpen) await this.openReturn();
      else this.$electron.invalidateOutput?.();
    },
    async openReturn() {
      if (!this.$electron.isElectron()) return;
      const displayId = await this.$electron.storeGet("return_display_id");
      const ok = await this.$electron.openReturnScreen(displayId || undefined);
      if (ok !== false) this.returnOpen = true;
    },
    async toggleReturn() {
      if (this.returnOpen) {
        await this.$electron.closeReturnScreen?.();
        this.returnOpen = false;
      } else {
        await this.openReturn();
      }
    },
    clearAll() {
      $layers.clearAllLayers();
      this.$appdata.set("return_multiview", []);
      this.$electron.invalidateOutput?.();
    },
  },
};
</script>

<style scoped>
.pp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 8px 10px 16px;
}
.pp-title { font-weight: 600; font-size: 15px; }
.pp-section { padding: 12px 16px; }
.pp-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.8;
  margin-bottom: 8px;
}
.pp-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 4px;
}
.pp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(150, 150, 150, 0.6);
  flex: none;
}
.pp-dot.on { background: #22c55e; box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2); }
.pp-hint { font-size: 11.5px; opacity: 0.65; line-height: 1.35; margin-bottom: 8px; }
.pp-row { padding: 6px 0; }
.pp-row-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  margin-bottom: 4px;
}
.pp-toggle { width: 100%; border-radius: 8px; }
.pp-toggle :deep(.v-btn) { flex: 1; text-transform: none; letter-spacing: 0; }
.pp-chip {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(56, 189, 248, 0.18);
  color: rgb(var(--v-theme-primary));
  margin-left: 6px;
}
.pp-chip-dim { background: rgba(150, 150, 150, 0.18); color: inherit; opacity: 0.75; }
.pp-check :deep(.v-label) { font-size: 13px; opacity: 1; }
</style>
