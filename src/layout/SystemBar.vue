<template>
  <v-system-bar
    v-if="is_desktop"
    id="system-bar"
    tile
    window
    color="primary"
    style="-webkit-app-region: drag; user-select: none;"
  >
    <img :src="logoUrl" height="16" width="16" class="me-2" style="vertical-align: middle; object-fit: contain;" />
    <span class="text-caption font-weight-medium">{{ $t('app.name') }}</span>

    <v-spacer />

    <!-- Janela de saída: quando fechada abre direto no monitor salvo -->
    <v-tooltip v-if="!outputOpen" location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn
          v-bind="props"
          icon="mdi-monitor"
          variant="text"
          size="small"
          style="-webkit-app-region: no-drag;"
          @click="openOutput"
        />
      </template>
      Abrir saída
    </v-tooltip>

    <!-- Janela de saída: quando aberta mostra botão de fechar -->
    <v-tooltip v-else location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn
          v-bind="props"
          icon="mdi-monitor-off"
          variant="text"
          size="small"
          color="success"
          style="-webkit-app-region: no-drag;"
          @click="closeOutputWindow"
        />
      </template>
      Fechar saída
    </v-tooltip>

    <v-divider vertical class="mx-1" />

    <!-- Minimizar -->
    <v-btn
      icon="mdi-minus"
      variant="text"
      size="small"
      style="-webkit-app-region: no-drag;"
      @click="$electron.windowMinimize()"
    />

    <!-- Maximizar / Restaurar -->
    <v-btn
      :icon="isMaximized ? 'mdi-window-restore' : 'mdi-window-maximize'"
      variant="text"
      size="small"
      style="-webkit-app-region: no-drag;"
      @click="toggleMaximize"
    />

    <!-- Fechar -->
    <v-btn
      icon="mdi-close"
      variant="text"
      size="small"
      color="error"
      style="-webkit-app-region: no-drag;"
      @click="$electron.windowClose()"
    />
  </v-system-bar>
</template>

<script>

export default {
  name: "SystemBarLayout",
  data: () => ({
    isMaximized: false,
    outputOpen: false,
    menuHandler: null,
    outputHandlers: [],
    logoUrl: `${import.meta.env.BASE_URL}ico/favicon.svg`,
  }),
  computed: {
    is_desktop() {
      return this.$appdata.get("is_desktop");
    },
    activeModuleTitle() {
      const modules = this.$appdata.get("modules") || {};
      for (const mod of Object.values(modules)) {
        if (mod.show && mod.title) {
          const translated = this.$t(mod.title);
          return translated !== mod.title ? translated : (mod.manifest?.name || translated);
        }
      }
      return null;
    },
  },
  watch: {
    activeModuleTitle(title) { this.updateWindowTitle(title); },
    '$i18n.locale'()          { this.updateWindowTitle(this.activeModuleTitle); },
  },
  methods: {
    updateWindowTitle(moduleTitle) {
      if (!this.$electron.isElectron()) return;
      const appName = this.$t('app.name');
      this.$electron.windowSetTitle(moduleTitle ? `${appName} — ${moduleTitle}` : appName);
    },
    async toggleMaximize() {
      await this.$electron.windowMaximize();
      this.isMaximized = await this.$electron.windowIsMaximized();
    },
    async closeOutputWindow() {
      await this.$electron.closeOutput();
      this.outputOpen = false;
    },
    async openOutput() {
      let moduleId = this.$appdata.get('popup_module');

      // Se não há módulo definido para o popup, usar o módulo ativo no momento
      if (!moduleId) {
        const modules = this.$appdata.get('modules') || {};
        for (const [id, mod] of Object.entries(modules)) {
          if (mod && mod.show) { moduleId = id; break; }
        }
        if (moduleId) {
          this.$appdata.set('popup_module', moduleId);
        }
      }

      await this.$electron.openOutput(moduleId, null);
      this.outputOpen = true;
    },
  },
  async mounted() {
    if (!this.$electron.isElectron()) return;

    this.isMaximized = await this.$electron.windowIsMaximized();
    this.outputOpen = await this.$electron.isOutputOpen();

    // Escuta eventos de menu
    this.menuHandler = this.$electron.on("menu:open-output", () => {
      if (!this.outputOpen) this.openOutputOnDisplay(null);
    });

    // Escuta fechamento da janela de saída
    const h1 = this.$electron.on("output-window-closed", () => {
      this.outputOpen = false;
      this.$appdata.set("popup", null);
      this.$appdata.set("popup_module", "");
    });
    const h2 = this.$electron.on("output-window-opened", () => {
      this.outputOpen = true;
    });
    // Janela de saída pronta: envia estado completo (cores, números, módulo, tema, etc.)
    const h3 = this.$electron.on("output-ready", () => {
      const data = this.$appdata.getFlatten();
      Object.keys(data).forEach((param) => {
        this.$electron.sendStateUpdate({ param, value: data[param] });
      });
      // slide_global_bg não está no appdata (fica no localStorage) — envia separadamente
      // para que o output window fique em sincronia com qualquer fundo definido na sessão.
      try {
        const raw = localStorage.getItem('slide_global_bg');
        const bgValue = raw ? JSON.parse(raw) : null;
        this.$electron.sendStateUpdate({ param: 'slide_global_bg', value: bgValue });
      } catch (_) {}
    });
    this.outputHandlers = [
      h1 ? { channel: "output-window-closed", handler: h1 } : null,
      h2 ? { channel: "output-window-opened", handler: h2 } : null,
      h3 ? { channel: "output-ready", handler: h3 } : null,
    ].filter(Boolean);
  },
  beforeUnmount() {
    if (this.menuHandler) this.$electron.off("menu:open-output", this.menuHandler);
    this.outputHandlers.forEach(({ channel, handler }) => this.$electron.off(channel, handler));
  },
};
</script>

<style scoped>
#system-bar {
  position: initial !important;
  flex: 0 !important;
}
</style>
