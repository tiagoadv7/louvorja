<template>
  <!-- ── Notificação compacta (aparece automático quando update disponível / pronto) ── -->
  <v-snackbar
    v-model="snackbar"
    :timeout="-1"
    location="bottom right"
    color="primary"
    rounded="lg"
    elevation="6"
    min-width="340"
    max-width="420"
    style="margin-bottom: 48px"
  >
    <div class="d-flex align-start ga-5">
      <v-icon size="22" class="flex-shrink-0 mt-1 mr-1">{{ snackIcon }}</v-icon>
      <div class="flex-grow-1 min-w-0">
        <div class="text-body-2 font-weight-semibold">{{ snackTitle }}</div>
        <div v-if="snackSubtitle" class="text-caption mt-1" style="opacity:0.85">{{ snackSubtitle }}</div>
        <v-progress-linear
          v-if="step === 'downloading'"
          :model-value="downloadPercent"
          color="white"
          height="3"
          rounded
          class="mt-2"
        />
      </div>
      <v-btn size="small" variant="text" color="white" density="comfortable" icon="mdi-close" class="flex-shrink-0" @click="snackbar = false" />
    </div>
    <div v-if="step === 'available' || step === 'downloaded'" class="d-flex justify-end ga-2 mt-4">
      <template v-if="step === 'available'">
        <v-btn size="small" variant="text" color="white" class="px-2" @click="openDialog">
          Detalhes
        </v-btn>
        <v-btn size="small" variant="flat" color="white" class="text-primary px-3" @click="startDownload">
          Baixar
        </v-btn>
      </template>
      <template v-else-if="step === 'downloaded'">
        <v-btn size="small" variant="flat" color="white" class="text-primary px-3" @click="install">
          Instalar
        </v-btn>
      </template>
    </div>
  </v-snackbar>

  <!-- ── Dialog completo (abre via menu "Verificar atualizações") ── -->
  <!-- .upd-card (ver <style> abaixo): em janelas baixas o v-dialog do
       Vuetify simplesmente corta o conteúdo que passa da viewport (sem como
       rolar até lá) — o próprio card fica mais alto que a tela e a ação do
       rodapé ("Fechar"/"Instalar e reiniciar"/etc.) acaba inacessível.
       Cabeçalho e rodapé ficam FORA da área que rola (.upd-scroll-body),
       sempre visíveis. -->
  <v-dialog v-model="dialog" max-width="460" persistent>
    <v-card rounded="lg" elevation="12" class="upd-card">

      <!-- Cabeçalho -->
      <div class="upd-header">
        <v-avatar size="44" :color="headerColor" variant="tonal" class="flex-shrink-0">
          <v-icon size="22">{{ dialogIcon }}</v-icon>
        </v-avatar>
        <div class="flex-grow-1 min-w-0">
          <div class="text-subtitle-1 font-weight-bold">{{ dialogTitle }}</div>
          <div class="text-caption text-medium-emphasis">{{ dialogSubtitle }}</div>
        </div>
        <v-btn
          v-if="step !== 'downloading'"
          icon="mdi-close"
          size="small"
          variant="text"
          density="comfortable"
          @click="dialog = false"
        />
      </div>
      <v-divider />

      <div class="upd-scroll-body">
      <!-- ── Configurações (beta / verificar ao iniciar / baixar automático) ──
           Sempre visíveis, junto com o status abaixo (não é mais uma tela à
           parte atrás de um botão "Configurações" — ver pedido do usuário). -->
      <v-card-text class="py-3 upd-settings">
        <v-checkbox
          v-model="useBeta"
          color="primary"
          hide-details
          density="compact"
          label="Usar versões beta (pré-release)"
        />
        <v-checkbox
          v-model="autoCheck"
          color="primary"
          hide-details
          density="compact"
          label="Verificar novas versões ao iniciar"
        />
        <v-checkbox
          v-model="autoDownload"
          color="primary"
          hide-details
          density="compact"
          label="Baixar atualizações automaticamente"
        />
      </v-card-text>
      <v-divider />

      <!-- ── Verificando ── -->
      <v-card-text v-if="step === 'checking'" class="d-flex flex-column align-center py-6 ga-5">
          <v-progress-circular indeterminate color="primary" size="52" width="4" />
          <div class="text-body-2 text-medium-emphasis">Verificando atualizações...</div>
        </v-card-text>

        <!-- ── Sem atualização ── -->
        <v-card-text v-else-if="step === 'not-available'" class="d-flex flex-column align-center py-6 ga-4">
          <v-avatar size="72" color="success" variant="tonal">
            <v-icon size="40">mdi-check-circle-outline</v-icon>
          </v-avatar>
          <div class="text-center">
            <div class="text-h6 font-weight-bold">Você está atualizado!</div>
            <div class="text-body-2 text-medium-emphasis mt-1">
              A versão instalada (<strong>v{{ currentVersion }}</strong>) já é a mais recente disponível.
            </div>
          </div>
        </v-card-text>

        <!-- ── Atualização disponível ── -->
        <!-- Sem changelog aqui de propósito — as novidades da versão aparecem
             só no ReleaseNotesDialog (modal separado, exibido no boot após a
             instalação), pra não duplicar a mesma informação em dois lugares. -->
        <v-card-text v-else-if="step === 'available'" class="py-6 text-center">
          <v-chip size="x-large" color="primary" variant="tonal" class="text-h6 font-weight-black px-10">
            v{{ updateInfo?.version || '?' }}
          </v-chip>
          <div class="text-caption text-medium-emphasis mt-2">Nova versão disponível</div>
        </v-card-text>

        <!-- ── Baixando ── -->
        <v-card-text v-else-if="step === 'downloading'" class="py-7 px-6">
          <div class="d-flex align-center ga-5 mb-6">
            <v-progress-circular size="48" width="4" indeterminate color="primary" />
            <div class="flex-grow-1 min-w-0">
              <div class="text-body-2 font-weight-semibold mb-1">Baixando atualização...</div>
              <div class="text-caption text-medium-emphasis text-truncate mt-2">{{ downloadStatus }}</div>
            </div>
            <div class="text-right flex-shrink-0">
              <div class="text-h6 font-weight-black text-primary">{{ downloadPercent }}<span class="text-body-2">%</span></div>
            </div>
          </div>
          <v-progress-linear :model-value="downloadPercent" height="8" rounded color="primary" class="mb-4" />
          <div class="d-flex justify-space-between">
            <span class="text-caption text-medium-emphasis">{{ downloadTransferred }} / {{ downloadTotal }}</span>
            <span class="text-caption text-primary font-weight-semibold">{{ downloadSpeed }}</span>
          </div>
        </v-card-text>

        <!-- ── Pronto para instalar ── -->
        <v-card-text v-else-if="step === 'downloaded'" class="d-flex flex-column align-center py-6 ga-4">
          <v-avatar size="72" color="primary" variant="tonal">
            <v-icon size="40">mdi-download-circle-outline</v-icon>
          </v-avatar>
          <div class="text-center">
            <div class="text-h6 font-weight-bold">Pronta para instalar!</div>
            <div class="text-body-2 text-medium-emphasis mt-1">
              Versão <strong>v{{ updateInfo?.version }}</strong> foi baixada.<br>
              {{ autoDownload ? 'Será instalada automaticamente ao fechar o programa.' : 'O app será reiniciado para concluir a instalação.' }}
            </div>
          </div>
        </v-card-text>

        <!-- ── Erro ── -->
        <v-card-text v-else-if="step === 'error'" class="d-flex flex-column align-center py-6 ga-4">
          <v-avatar size="72" color="error" variant="tonal">
            <v-icon size="40">mdi-alert-circle-outline</v-icon>
          </v-avatar>
          <div class="text-center px-4">
            <div class="text-h6 font-weight-bold">Erro ao baixar atualização</div>
            <div class="text-body-2 text-medium-emphasis mt-2">{{ errorMessage }}</div>
            <v-btn size="small" variant="text" color="primary" class="mt-3" prepend-icon="mdi-open-in-new" @click="openReleasePage">
              Baixar manualmente pelo navegador
            </v-btn>
          </div>
        </v-card-text>
      </div>

      <v-divider />

      <!-- Ações -->
      <v-card-actions class="px-5 py-3 justify-end" style="gap:12px">
        <template v-if="step === 'checking'">
          <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
        </template>
        <template v-else-if="step === 'available'">
          <v-btn variant="text" @click="dialog = false">Mais tarde</v-btn>
          <v-btn color="primary" variant="flat" class="px-5" prepend-icon="mdi-download" @click="startDownload">
            Baixar agora
          </v-btn>
        </template>
        <template v-else-if="step === 'downloading'">
          <v-btn variant="text" disabled>Baixando...</v-btn>
        </template>
        <template v-else-if="step === 'downloaded'">
          <v-btn variant="text" @click="dialog = false">Mais tarde</v-btn>
          <v-btn color="primary" variant="flat" class="px-5" prepend-icon="mdi-restart" @click="install">
            Instalar e reiniciar
          </v-btn>
        </template>
        <template v-else>
          <v-btn color="primary" variant="flat" class="px-5" prepend-icon="mdi-close" @click="dialog = false">Fechar</v-btn>
        </template>
      </v-card-actions>

    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'UpdateDialog',

  data: () => ({
    dialog:   false,
    snackbar: false,
    // idle | checking | available | not-available | downloading | downloaded | error
    // — mesmo vocabulário de status usado por electron/updater.js (_state.status),
    // espelhado aqui via um único evento 'updater:state' (ver mounted()).
    step:     'idle',

    currentVersion: '',
    updateInfo:     null,
    errorMessage:   '',

    downloadPercent:     0,
    downloadSpeed:       '',
    downloadTransferred: '',
    downloadTotal:       '',
    downloadStatus:      '',

    // Configurações de atualização (persistidas via $userdata, aplicadas em
    // tempo real via updaterSetOptions — ver electron/updater.js). Espelham
    // as mesmas opções que main.js lê do Store no boot (registerIpcHandlers).
    // Sempre visíveis junto com o status, não é mais uma tela à parte.
    useBeta:       false,
    autoCheck:     true,
    autoDownload:  false,
    _settingsLoaded: false,

    _handlers: [],
  }),

  computed: {
    // ── Snackbar ────────────────────────────────────────────────────────────
    snackIcon() {
      if (this.step === 'available')   return 'mdi-arrow-up-circle-outline';
      if (this.step === 'downloading') return 'mdi-download-circle-outline';
      if (this.step === 'downloaded')  return 'mdi-check-circle-outline';
      if (this.step === 'error')       return 'mdi-alert-circle-outline';
      return 'mdi-information-outline';
    },
    snackTitle() {
      if (this.step === 'available')   return 'Nova versão disponível';
      if (this.step === 'downloading') return `Baixando atualização — ${this.downloadPercent}%`;
      if (this.step === 'downloaded')  return 'Pronta para instalar';
      if (this.step === 'error')       return this.errorMessage || 'Erro ao baixar a atualização';
      return '';
    },
    snackSubtitle() {
      if (this.step === 'available')   return `v${this.updateInfo?.version || '?'}`;
      if (this.step === 'downloading') return this.downloadStatus;
      if (this.step === 'downloaded')  return `v${this.updateInfo?.version} — reinicie para instalar`;
      return '';
    },

    // ── Dialog ──────────────────────────────────────────────────────────────
    headerColor() {
      const map = {
        checking:       'primary',
        available:      'primary',
        downloading:    'primary',
        downloaded:     'primary',
        'not-available': 'success',
        error:          'error',
      };
      return map[this.step] || 'primary';
    },
    dialogIcon() {
      const map = {
        checking:       'mdi-cloud-search-outline',
        available:      'mdi-arrow-up-circle-outline',
        downloading:    'mdi-download-circle-outline',
        downloaded:     'mdi-check-circle-outline',
        'not-available': 'mdi-check-circle-outline',
        error:          'mdi-alert-circle-outline',
      };
      return map[this.step] || 'mdi-update';
    },
    dialogTitle() {
      const map = {
        checking:       'Verificando atualizações',
        available:      'Atualização disponível',
        downloading:    'Baixando atualização',
        downloaded:     'Atualização pronta',
        'not-available': 'Verificar atualizações',
        error:          'Erro ao baixar atualização',
      };
      return map[this.step] || 'Atualizações';
    },
    dialogSubtitle() {
      if (this.step === 'available')  return `v${this.updateInfo?.version || '?'} disponível para download`;
      if (this.step === 'downloaded') return `v${this.updateInfo?.version || '?'} pronta para instalar`;
      return `Versão atual: ${this.currentVersion}`;
    },
  },

  watch: {
    // Persiste + aplica em tempo real (updaterSetOptions já reconfigura o
    // autoUpdater sem precisar reiniciar o app) — _settingsLoaded evita
    // regravar os mesmos valores durante o carregamento inicial em mounted().
    useBeta()      { this.saveOptions(); },
    autoCheck()    { this.saveOptions(); },
    autoDownload() { this.saveOptions(); },
  },

  mounted() {
    if (!this.$electron?.isElectron()) return;

    this.$electron.getVersion?.().then(v => { this.currentVersion = v || ''; }).catch(() => {});

    // Carrega as opções persistidas (mesmas 3 que main.js lê do Store no
    // boot — ver registerIpcHandlers em electron/main.js) antes de ligar o
    // watch acima, senão o valor padrão inicial já dispararia um save.
    this.useBeta      = !!this.$userdata.get('update_use_beta', false);
    this.autoCheck    = this.$userdata.get('update_check_on_startup', true) !== false;
    this.autoDownload = !!this.$userdata.get('update_auto_download', false);
    this._settingsLoaded = true;

    const listen = (channel, fn) => {
      const h = this.$electron.on(channel, fn);
      if (h) this._handlers.push([channel, h]);
    };

    // Único canal — o processo main (electron/updater.js) manda o estado
    // inteiro a cada mudança, em vez de 6 eventos separados. Mesmo padrão do
    // fork mais avançado deste app (louvorja/violin-app).
    listen('updater:state', (state) => this.applyState(state));
  },

  beforeUnmount() {
    this._handlers.forEach(([ch, h]) => this.$electron.off(ch, h));
  },

  methods: {
    // Persiste as 3 opções e aplica no processo main em tempo real.
    saveOptions() {
      if (!this._settingsLoaded) return;
      this.$userdata.set('update_use_beta', this.useBeta);
      this.$userdata.set('update_check_on_startup', this.autoCheck);
      this.$userdata.set('update_auto_download', this.autoDownload);
      this.$electron.updaterSetOptions?.({
        useBeta: this.useBeta,
        autoCheck: this.autoCheck,
        autoDownload: this.autoDownload,
      });
    },

    // Aplica o snapshot de estado vindo de electron/updater.js aos campos
    // locais que o template já usa. O snackbar só reabre numa TRANSIÇÃO pra
    // 'available'/'downloaded' (não a cada atualização de estado que mantém
    // o mesmo status), pra não reaparecer depois que o usuário já fechou.
    applyState(state) {
      const prevStep = this.step;
      this.step = state.status;
      this.updateInfo = { version: state.newVersion, releaseNotes: state.releaseNotes };
      this.errorMessage = state.error || '';

      if (state.status === 'downloading') {
        this.downloadPercent = Math.round(state.progress || 0);
        this.downloadSpeed = state.bytesPerSecond ? `${this.formatBytes(state.bytesPerSecond)}/s` : '';
        this.downloadTransferred = this.formatBytes(state.transferred || 0);
        this.downloadTotal = this.formatBytes(state.total || 0);
        // Sem repetir o percentual aqui — já aparece grande do lado direito
        // da linha (ver template); antes ficava "1.1 MB/s · 96%" colado embaixo
        // do título "Baixando atualização...", duplicando a mesma informação.
        this.downloadStatus = this.downloadSpeed || 'Calculando...';
      }

      if ((state.status === 'available' || state.status === 'downloaded') && prevStep !== state.status) {
        this.snackbar = true;
        if (this.dialog) this.dialog = true; // mantém aberto se já estava
      }
    },

    // Abre o dialog e inicia verificação manual
    async checkNow() {
      this.step    = 'checking';
      this.dialog  = true;
      this.snackbar = false;
      try {
        await this.$electron.updaterCheck();
      } catch (_) {
        // Falha ao verificar não deve assustar o usuário com uma tela de erro
        // — trata como "sem atualização disponível" (ver electron/updater.js).
        this.step = 'not-available';
      }
    },

    openDialog() {
      this.dialog = true;
    },

    async startDownload() {
      // Não força step='downloading' aqui — o diálogo nativo "Salvar como"
      // abre primeiro (ver downloadPackage em electron/updater.js), e só
      // depois de escolhido o destino o download começa de fato (o evento
      // 'updater:state' já cuida de mudar o step). Se o usuário cancelar o
      // diálogo, o step permanece 'available' — sem tela de erro.
      try {
        const result = await this.$electron.updaterDownload();
        if (result?.canceled) return;
        // Erro real já chega via 'updater:state' (applyState) antes desta
        // Promise resolver — isso aqui é só uma rede de segurança caso, por
        // algum motivo, nenhum estado tenha chegado.
        if (result && result.ok === false && this.step !== 'error') {
          this.errorMessage = result.error || 'Erro ao baixar a atualização.';
          this.step = 'error';
        }
      } catch (_) {
        if (this.step !== 'error') {
          this.step = 'error';
          if (!this.errorMessage) this.errorMessage = 'Erro ao baixar a atualização.';
        }
      }
    },

    install() {
      this.$electron.updaterInstall();
    },

    openReleasePage() {
      this.$electron.updaterOpenReleasePage?.();
    },

    formatBytes(bytes) {
      if (!bytes) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
    },
  },
};
</script>

<style scoped>
.upd-card {
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  overflow: hidden;
}
.upd-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  flex-shrink: 0;
}
/* Só essa área rola — cabeçalho e ações (rodapé) ficam sempre visíveis,
   mesmo com o conteúdo das configurações (3 switches + texto) deixando o
   dialog mais alto que janelas pequenas/baixas. */
.upd-scroll-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

/* Centraliza cada linha (checkbox + texto) como um bloco só, em vez de
   ficar tudo encostado na esquerda. */
.upd-settings :deep(.v-selection-control) {
  justify-content: center;
}
</style>
