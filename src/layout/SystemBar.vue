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

    <!-- Alerta de atualização — cor laranja fixa (não usa "primary"/tema
         atual) de propósito: o próprio app-bar já É a cor primary escolhida
         pelo usuário (inclusive laranja, em alguns temas — ver vuetify.js),
         então um alerta "primary" desapareceria de vez em quando. Laranja
         fixo + contorno/sombra sutil garante contraste em QUALQUER tema
         claro/escuro/colorido, sem precisar de uma cor por tema. -->
    <v-tooltip v-if="updateBadge" location="bottom">
      <template v-slot:activator="{ props }">
        <button
          v-bind="props"
          class="sysbar-update-badge"
          style="-webkit-app-region: no-drag;"
          @click="openUpdateDialog"
        >
          <v-progress-circular
            v-if="updateStep === 'downloading'"
            :model-value="updateDownloadPercent"
            size="14"
            width="2"
            color="white"
          />
          <v-icon v-else size="14">{{ updateBadgeIcon }}</v-icon>
          <span>{{ updateBadgeText }}</span>
        </button>
      </template>
      {{ updateBadgeTooltip }}
    </v-tooltip>

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
      Projetar
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
      Parar projeção
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
    _f5Handler: null,
    logoUrl: `${import.meta.env.BASE_URL}ico/favicon.svg`,

    // ── Alerta de atualização (ver electron/updater.js) ─────────────────────
    // Mesmo canal 'updater:state' que UpdateDialog.vue escuta — cada um
    // mantém seu próprio espelho local do estado (mesmo padrão já usado
    // pelo mini-player do rodapé em relação aos módulos "donos" do estado).
    updateStep: 'idle',
    updateVersion: null,
    updateDownloadPercent: 0,
    _updateStateHandler: null,
  }),
  computed: {
    is_desktop() {
      return this.$appdata.get("is_desktop");
    },
    updateBadge() {
      return ['available', 'downloading', 'downloaded'].includes(this.updateStep);
    },
    updateBadgeIcon() {
      if (this.updateStep === 'downloaded') return 'mdi-check-circle';
      return 'mdi-arrow-up-circle';
    },
    updateBadgeText() {
      if (this.updateStep === 'downloading') return `${this.updateDownloadPercent}%`;
      if (this.updateStep === 'downloaded') return 'Instalar';
      return 'Atualizar';
    },
    updateBadgeTooltip() {
      const v = this.updateVersion ? `v${this.updateVersion}` : '';
      if (this.updateStep === 'downloading') return `Baixando atualização ${v}...`;
      if (this.updateStep === 'downloaded') return `Atualização ${v} pronta — clique para instalar`;
      return `Atualização ${v} disponível — clique para ver detalhes`;
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
    // Abre o UpdateDialog já existente (App.vue) sem repetir a checagem — o
    // estado que o badge mostra já É o mesmo que o dialog vai exibir. Mesmo
    // padrão de "abrir um modal de outro componente via evento" já usado por
    // Menu.vue/AboutDialog.vue com 'check-updates', só que sem re-checar.
    openUpdateDialog() {
      window.dispatchEvent(new CustomEvent('open-update-dialog'));
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

      // Se não há módulo definido para o popup, usar o módulo ativo no momento.
      // Media minimizado (modo áudio) é ativo mesmo que show=false.
      if (!moduleId) {
        const modules = this.$appdata.get('modules') || {};
        if (modules?.media?.minimized) {
          moduleId = 'media';
        } else if (modules?.slide_editor?.minimized) {
          moduleId = 'slide_editor';
        } else {
          for (const [id, mod] of Object.entries(modules)) {
            if (mod && mod.show) { moduleId = id; break; }
          }
        }
        if (moduleId) {
          this.$appdata.set('popup_module', moduleId);
        }
      }

      await this.$electron.openOutput(moduleId, null);
      this.outputOpen = true;
      // Registra o stub de popup para que Media.close() saiba que o output está aberto,
      // mesmo quando aberto via barra do sistema (sem passar por $popup.open()).
      this.$appdata.set("popup", { closed: false, _electron: true });
    },
  },
  async mounted() {
    if (!this.$electron.isElectron()) return;

    this.isMaximized = await this.$electron.windowIsMaximized();
    this.outputOpen = await this.$electron.isOutputOpen();

    // Atalho F5: abre/fecha a janela de projeção
    this._f5Handler = (e) => {
      if (e.key === 'F5') {
        e.preventDefault();
        if (this.outputOpen) {
          this.closeOutputWindow();
        } else {
          this.openOutput();
        }
      }
    };
    window.addEventListener('keydown', this._f5Handler);

    // Alerta de atualização — mesmo canal que UpdateDialog.vue escuta.
    this._updateStateHandler = this.$electron.on('updater:state', (state) => {
      this.updateStep = state.status;
      this.updateVersion = state.newVersion;
      this.updateDownloadPercent = Math.round(state.progress || 0);
    });

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
    // Janela de saída/retorno/PIP pronta: envia estado completo (cores, números,
    // módulo, tema, etc.) SÓ para quem pediu (target) — nunca em broadcast pras
    // outras, senão campos que a própria janela de saída atualiza localmente e
    // nunca manda de volta (ex. currentTime do vídeo tocando) seriam sobrescritos
    // com o valor desatualizado daqui, fazendo a projeção "voltar no tempo".
    const h3 = this.$electron.on("output-ready", (target) => {
      const data = this.$appdata.getFlatten();
      Object.keys(data).forEach((param) => {
        this.$electron.sendStateUpdate({ param, value: data[param], target });
      });
      // slide_global_bg não está no appdata (fica no localStorage) — envia separadamente
      // para que o output window fique em sincronia com qualquer fundo definido na sessão.
      try {
        const raw = localStorage.getItem('slide_global_bg');
        const bgValue = raw ? JSON.parse(raw) : null;
        this.$electron.sendStateUpdate({ param: 'slide_global_bg', value: bgValue, target });
      } catch (_) {}
    });
    this.outputHandlers = [
      h1 ? { channel: "output-window-closed", handler: h1 } : null,
      h2 ? { channel: "output-window-opened", handler: h2 } : null,
      h3 ? { channel: "output-ready", handler: h3 } : null,
    ].filter(Boolean);
  },
  beforeUnmount() {
    if (this._f5Handler) window.removeEventListener('keydown', this._f5Handler);
    if (this.menuHandler) this.$electron.off("menu:open-output", this.menuHandler);
    if (this._updateStateHandler) this.$electron.off('updater:state', this._updateStateHandler);
    this.outputHandlers.forEach(({ channel, handler }) => this.$electron.off(channel, handler));
  },
};
</script>

<style scoped>
#system-bar {
  position: initial !important;
  flex: 0 !important;
}

/* Cor laranja fixa (não "primary") + sombra pra sempre destacar do app-bar,
   mesmo nos temas em que "primary" já É um tom de laranja (ver vuetify.js:
   "orange"/"dark-orange") — sem isso o badge sumiria de vez em quando. */
.sysbar-update-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 8px;
  margin: 0 4px;
  border: none;
  border-radius: 10px;
  background: #fb8c00;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.35);
  transition: filter 0.12s;
}
.sysbar-update-badge:hover {
  filter: brightness(1.08);
}
.sysbar-update-badge :deep(.v-progress-circular) {
  flex-shrink: 0;
}
</style>
