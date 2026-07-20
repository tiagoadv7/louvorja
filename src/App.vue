<template>
  <AppLoading />
  <v-btn
    v-show="false"
    @shortkey="handleKeydown()"
    v-shortkey="['ctrl', 'alt', 'd']"
  />
  <v-app id="app-container">
    <router-view />
  </v-app>

  <!-- Verificador de arquivos locais -->
  <FileCheckDialog ref="fileCheck" />

  <!-- Auto-updater -->
  <UpdateDialog ref="updater" />

  <!-- Snackbar do auto-import SQLite -->
  <v-snackbar
    v-model="autoImportSnack"
    :timeout="autoImportDone ? 4000 : -1"
    location="bottom right"
    color="primary"
    rounded="lg"
    elevation="4"
    min-width="280"
  >
    <div class="d-flex align-center">
      <v-progress-circular
        v-if="!autoImportDone"
        size="18"
        width="2"
        indeterminate
        color="white"
        class="mr-2"
      />
      <v-icon v-else color="white" size="18" class="mr-2">mdi-check-circle</v-icon>
      <span class="text-body-2">{{ autoImportMessage }}</span>
    </div>
  </v-snackbar>
</template>

<script>
import AppLoading    from "@/layout/Loading.vue";
import FileCheckDialog from "@/components/FileCheckDialog.vue";
import UpdateDialog    from "@/components/UpdateDialog.vue";

export default {
  name: "App",
  components: { AppLoading, FileCheckDialog, UpdateDialog },

  data: () => ({
    autoImportSnack:     false,
    autoImportDone:      false,
    autoImportMessage:   '',
    _autoImportRunning:  false,
    _handlers:              [],
    _syncFilesHandler:      null,
    _checkUpdatesHandler:   null,
  }),

  mounted() {
    if (!this.$electron.isElectron()) return;
    // Janelas de projeção não precisam de verificação de arquivos nem notificações
    const _hash = window.location.hash;
    if (_hash.includes('/popup') || _hash.includes('/return-screen') || _hash.includes('/video-pip')) return;

    // Garante que o fundo personalizado não persista de sessões anteriores.
    // O slide sempre inicia com a imagem padrão do álbum (globalBg = null).
    try {
      localStorage.removeItem('slide_global_bg');
      window.dispatchEvent(new CustomEvent('slide-bg-changed'));
    } catch (_) {}

    // Segurança: se offline mode estava ativo mas não há nenhum arquivo local
    // (build nova ou localStorage persistido de sessão de desenvolvimento),
    // desativa automaticamente para que os álbuns sejam carregados pela API.
    // Storage.js persiste em DOIS lugares: localStorage + electron-store.
    this.$electron.dbLocalList().then(files => {
      if (!files || files.length === 0) {
        // Limpa localStorage
        try { localStorage.removeItem('db_local_enabled'); } catch (_) {}
        // Limpa electron-store
        this.$electron.storeRemove('db_local_enabled').catch(() => {});
        console.log('[App] Modo offline desativado: sem arquivos locais.');
      }
    }).catch(() => {});

    // 1. Ouve auto-import disparado pelo processo principal (database.db local)
    const onAutoImport = this.$electron.on('sqlite:auto-import', async ({ dbPath }) => {
      await this.startAutoImport(dbPath);
      // Após o import, aguarda render e abre o verificador
      await this.$nextTick();
      setTimeout(() => this.openFileCheck(), 1500);
    });
    if (onAutoImport) this._handlers.push(['sqlite:auto-import', onAutoImport]);

    // 2. Ouve progresso do import
    const onProgress = this.$electron.on('sqlite:progress', ({ percent }) => {
      if (!this.autoImportSnack) return;
      this.autoImportMessage = `Carregando banco local... ${percent}%`;
      if (percent >= 100) {
        this.autoImportDone    = true;
        this.autoImportMessage = 'Banco local carregado com sucesso!';
      }
    });
    if (onProgress) this._handlers.push(['sqlite:progress', onProgress]);

    // 3. Abre verificador de arquivos após o app carregar — só automaticamente na
    //    primeira vez (flag persistida via Store). Nas próximas aberturas do app,
    //    só roda de novo se houver conteúdo novo (ver checkSqliteUpdate) ou
    //    manualmente via "Sincronizar arquivos" no menu (fileCheck.open(true)).
    //    Delay maior para garantir que o router e os refs estão prontos.
    this.$electron.storeGet('startup_file_check_done', false)
      .then(done => { if (!done) this.scheduleStartupFileCheck(); })
      .catch(() => this.scheduleStartupFileCheck());

    // 4. Verifica atualização do banco SQLite via API (após 6s para não competir com o auto-import)
    setTimeout(() => this.checkSqliteUpdate(), 6000);

    // 5. Ouve evento global para abrir o verificador de arquivos (disparado pelo Menu)
    this._syncFilesHandler = () => this.$refs.fileCheck?.open(true);
    window.addEventListener('sync-files', this._syncFilesHandler);

    // 5b. Ouve evento global de verificar atualizações (disparado pelo Menu lateral)
    this._checkUpdatesHandler = () => this.$refs.updater?.checkNow();
    window.addEventListener('check-updates', this._checkUpdatesHandler);

    // 6. Ouve "Verificar atualizações" do menu nativo
    const onCheckUpdates = this.$electron.on('menu:check-updates', () => {
      this.$refs.updater?.checkNow();
    });
    if (onCheckUpdates) this._handlers.push(['menu:check-updates', onCheckUpdates]);
  },

  beforeUnmount() {
    this._handlers.forEach(([ch, h]) => this.$electron.off(ch, h));
    window.removeEventListener('sync-files', this._syncFilesHandler);
    window.removeEventListener('check-updates', this._checkUpdatesHandler);
  },

  methods: {
    handleKeydown() {
      console.log("click ");
      this.$dev.toogle();
    },

    // Abre o verificador de arquivos no startup (dev e prod).
    // O dialog internamente decide se exibe ou fecha automaticamente.
    async openFileCheck() {
      if (this._autoImportRunning) return;
      try {
        await this.$nextTick();
        this.$refs.fileCheck?.open();
      } catch (_) {}
    },

    // Roda a verificação automática de arquivos uma única vez e marca a flag,
    // para que não rode de novo sozinha nas próximas aberturas do app.
    scheduleStartupFileCheck() {
      setTimeout(async () => {
        await this.openFileCheck();
        this.$electron.storeSet('startup_file_check_done', true).catch(() => {});
      }, 4000);
    },

    async checkSqliteUpdate() {
      if (this._autoImportRunning) return;
      try {
        const result = await this.$electron.sqliteCheckUpdate(
          import.meta.env.VITE_URL_DATABASE,
          import.meta.env.VITE_API_TOKEN,
        );
        if (result?.updated && result?.dbPath) {
          await this.startAutoImport(result.dbPath);
          await this.$nextTick();
          setTimeout(() => this.openFileCheck(), 1500);
        }
      } catch (_) {}
    },

    async startAutoImport(dbPath) {
      this._autoImportRunning = true;
      this.autoImportDone     = false;
      this.autoImportMessage  = 'Carregando banco local...';
      this.autoImportSnack    = true;
      try {
        await this.$electron.sqliteImport({ dbPath, capasPath: null });
      } catch (_) {
        this.autoImportMessage = 'Erro ao carregar banco local.';
        this.autoImportDone    = true;
      } finally {
        this._autoImportRunning = false;
      }
    },
  },
};
</script>

<style>
#app-container > .v-application__wrap {
  height: 100vh;
}
</style>
