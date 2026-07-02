<template>
  <!-- ── Notificação compacta (aparece automático quando update disponível / pronto) ── -->
  <v-snackbar
    v-model="snackbar"
    :timeout="-1"
    location="bottom right"
    color="primary"
    rounded="lg"
    elevation="6"
    min-width="320"
    max-width="400"
  >
    <div class="d-flex align-center gap-3">
      <v-icon size="22" class="flex-shrink-0">{{ snackIcon }}</v-icon>
      <div class="flex-grow-1 min-w-0">
        <div class="text-body-2 font-weight-semibold">{{ snackTitle }}</div>
        <div v-if="snackSubtitle" class="text-caption" style="opacity:0.85">{{ snackSubtitle }}</div>
        <v-progress-linear
          v-if="step === 'downloading'"
          :model-value="downloadPercent"
          color="white"
          height="3"
          rounded
          class="mt-1"
        />
      </div>
    </div>
    <template #actions>
      <template v-if="step === 'available'">
        <v-btn size="small" variant="flat" color="white" class="text-primary px-3" @click="startDownload">
          Baixar
        </v-btn>
        <v-btn size="small" variant="text" color="white" class="px-2" @click="openDialog">
          Detalhes
        </v-btn>
      </template>
      <template v-else-if="step === 'downloaded'">
        <v-btn size="small" variant="flat" color="white" class="text-primary px-3" @click="install">
          Instalar
        </v-btn>
      </template>
      <v-btn size="small" variant="text" color="white" density="comfortable" icon="mdi-close" @click="snackbar = false" />
    </template>
  </v-snackbar>

  <!-- ── Dialog completo (abre via menu "Verificar atualizações") ── -->
  <v-dialog v-model="dialog" max-width="460" persistent>
    <v-card rounded="lg" elevation="12" style="overflow:hidden">

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

      <!-- ── Verificando ── -->
      <v-card-text v-if="step === 'checking'" class="d-flex flex-column align-center py-12 gap-5">
        <v-progress-circular indeterminate color="primary" size="52" width="4" />
        <div class="text-body-2 text-medium-emphasis">Verificando atualizações...</div>
      </v-card-text>

      <!-- ── Sem atualização ── -->
      <v-card-text v-else-if="step === 'up-to-date'" class="d-flex flex-column align-center py-12 gap-4">
        <v-avatar size="72" color="success" variant="tonal">
          <v-icon size="40">mdi-check-circle-outline</v-icon>
        </v-avatar>
        <div class="text-center">
          <div class="text-h6 font-weight-bold">Tudo atualizado!</div>
          <div class="text-body-2 text-medium-emphasis mt-1">
            Versão <strong>{{ currentVersion }}</strong> é a mais recente.
          </div>
        </div>
      </v-card-text>

      <!-- ── Atualização disponível ── -->
      <v-card-text v-else-if="step === 'available'" class="py-6">
        <div class="text-center mb-5">
          <v-chip size="x-large" color="primary" variant="tonal" class="text-h6 font-weight-black px-10">
            v{{ updateInfo?.version || '?' }}
          </v-chip>
          <div class="text-caption text-medium-emphasis mt-2">
            Nova versão disponível
            <template v-if="updateInfo?.releaseDate">
              · {{ formatDate(updateInfo.releaseDate) }}
            </template>
          </div>
        </div>
        <div v-if="updateInfo?.releaseNotes" class="upd-notes text-body-2 text-medium-emphasis">
          {{ stripHtml(updateInfo.releaseNotes) }}
        </div>
      </v-card-text>

      <!-- ── Baixando ── -->
      <v-card-text v-else-if="step === 'downloading'" class="py-6 px-6">
        <div class="d-flex align-center gap-4 mb-5">
          <v-progress-circular size="44" width="4" indeterminate color="primary" />
          <div class="flex-grow-1 min-w-0">
            <div class="text-body-2 font-weight-semibold mb-1">Baixando atualização...</div>
            <div class="text-caption text-medium-emphasis text-truncate">{{ downloadStatus }}</div>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-h6 font-weight-black text-primary">{{ downloadPercent }}<span class="text-body-2">%</span></div>
          </div>
        </div>
        <v-progress-linear :model-value="downloadPercent" height="8" rounded color="primary" class="mb-3" />
        <div class="d-flex justify-space-between">
          <span class="text-caption text-medium-emphasis">{{ downloadTransferred }} / {{ downloadTotal }}</span>
          <span class="text-caption text-primary font-weight-semibold">{{ downloadSpeed }}</span>
        </div>
      </v-card-text>

      <!-- ── Pronto para instalar ── -->
      <v-card-text v-else-if="step === 'downloaded'" class="d-flex flex-column align-center py-12 gap-4">
        <v-avatar size="72" color="primary" variant="tonal">
          <v-icon size="40">mdi-download-circle-outline</v-icon>
        </v-avatar>
        <div class="text-center">
          <div class="text-h6 font-weight-bold">Pronta para instalar!</div>
          <div class="text-body-2 text-medium-emphasis mt-1">
            Versão <strong>v{{ updateInfo?.version }}</strong> foi baixada.<br>
            O app será reiniciado para concluir a instalação.
          </div>
        </div>
      </v-card-text>

      <!-- ── Erro ── -->
      <v-card-text v-else-if="step === 'error'" class="d-flex flex-column align-center py-12 gap-4">
        <v-avatar size="72" color="error" variant="tonal">
          <v-icon size="40">mdi-alert-circle-outline</v-icon>
        </v-avatar>
        <div class="text-center px-4">
          <div class="text-h6 font-weight-bold">Erro ao verificar</div>
          <div class="text-body-2 text-medium-emphasis mt-2">{{ errorMessage }}</div>
        </div>
      </v-card-text>

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
          <v-btn color="primary" variant="flat" class="px-5" @click="dialog = false">Fechar</v-btn>
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
    step:     'idle', // idle | checking | available | downloading | downloaded | up-to-date | error

    currentVersion: '',
    updateInfo:     null,
    errorMessage:   '',

    downloadPercent:     0,
    downloadSpeed:       '',
    downloadTransferred: '',
    downloadTotal:       '',
    downloadStatus:      '',

    _handlers: [],
  }),

  computed: {
    // ── Snackbar ────────────────────────────────────────────────────────────
    snackIcon() {
      if (this.step === 'available')   return 'mdi-arrow-up-circle-outline';
      if (this.step === 'downloading') return 'mdi-download-circle-outline';
      if (this.step === 'downloaded')  return 'mdi-check-circle-outline';
      return 'mdi-information-outline';
    },
    snackTitle() {
      if (this.step === 'available')   return `Nova versão disponível — v${this.updateInfo?.version || '?'}`;
      if (this.step === 'downloading') return `Baixando v${this.updateInfo?.version || '?'} — ${this.downloadPercent}%`;
      if (this.step === 'downloaded')  return `v${this.updateInfo?.version} pronta — reinicie para instalar`;
      return '';
    },
    snackSubtitle() {
      if (this.step === 'downloading') return this.downloadStatus;
      return '';
    },

    // ── Dialog ──────────────────────────────────────────────────────────────
    headerColor() {
      const map = {
        checking:   'primary',
        available:  'primary',
        downloading:'primary',
        downloaded: 'primary',
        'up-to-date': 'success',
        error:      'error',
      };
      return map[this.step] || 'primary';
    },
    dialogIcon() {
      const map = {
        checking:     'mdi-cloud-search-outline',
        available:    'mdi-arrow-up-circle-outline',
        downloading:  'mdi-download-circle-outline',
        downloaded:   'mdi-check-circle-outline',
        'up-to-date': 'mdi-check-circle-outline',
        error:        'mdi-alert-circle-outline',
      };
      return map[this.step] || 'mdi-update';
    },
    dialogTitle() {
      const map = {
        checking:     'Verificando atualizações',
        available:    'Atualização disponível',
        downloading:  'Baixando atualização',
        downloaded:   'Atualização pronta',
        'up-to-date': 'LouvorJA atualizado',
        error:        'Erro ao verificar',
      };
      return map[this.step] || 'Atualizações';
    },
    dialogSubtitle() {
      if (this.step === 'available')  return `v${this.updateInfo?.version || '?'} disponível para download`;
      if (this.step === 'downloaded') return `v${this.updateInfo?.version || '?'} pronta para instalar`;
      return `Versão atual: ${this.currentVersion}`;
    },
  },

  mounted() {
    if (!this.$electron?.isElectron()) return;

    this.$electron.getVersion?.().then(v => { this.currentVersion = v || ''; }).catch(() => {});

    const listen = (channel, fn) => {
      const h = this.$electron.on(channel, fn);
      if (h) this._handlers.push([channel, h]);
    };

    listen('updater:checking', () => {
      this.step = 'checking';
    });

    listen('updater:available', (info) => {
      this.updateInfo = info;
      this.step       = 'available';
      this.snackbar   = true;
      if (this.dialog) this.dialog = true; // mantém aberto se já estava
    });

    listen('updater:not-available', () => {
      this.step = 'up-to-date';
      // Só mostra o dialog se o usuário clicou em "Verificar atualizações" manualmente
      if (!this.dialog) return;
    });

    listen('updater:progress', (prog) => {
      this.step            = 'downloading';
      this.downloadPercent = Math.round(prog.percent || 0);
      this.downloadSpeed   = prog.bytesPerSecond
        ? `${this.formatBytes(prog.bytesPerSecond)}/s`
        : '';
      this.downloadTransferred = this.formatBytes(prog.transferred || 0);
      this.downloadTotal       = this.formatBytes(prog.total || 0);
      this.downloadStatus      = this.downloadSpeed ? `${this.downloadSpeed} · ETA ${this.formatEta(prog.eta)}` : 'Calculando...';
    });

    listen('updater:downloaded', (info) => {
      this.updateInfo = info;
      this.step       = 'downloaded';
      this.snackbar   = true;
      if (this.dialog) this.dialog = true;
    });

    listen('updater:error', (msg) => {
      this.errorMessage = msg;
      this.step         = 'error';
      // Só mostra o dialog de erro se o usuário iniciou manualmente
      if (!this.dialog) return;
    });
  },

  beforeUnmount() {
    this._handlers.forEach(([ch, h]) => this.$electron.off(ch, h));
  },

  methods: {
    // Abre o dialog e inicia verificação manual
    async checkNow() {
      this.step    = 'checking';
      this.dialog  = true;
      this.snackbar = false;
      try {
        await this.$electron.updaterCheck();
      } catch (_) {
        this.step         = 'error';
        this.errorMessage = 'Não foi possível verificar atualizações.';
      }
    },

    openDialog() {
      this.dialog = true;
    },

    async startDownload() {
      this.step     = 'downloading';
      this.snackbar = true;
      try {
        await this.$electron.updaterDownload();
      } catch (_) {
        this.step         = 'error';
        this.errorMessage = 'Erro ao baixar a atualização.';
      }
    },

    install() {
      this.$electron.updaterInstall();
    },

    formatBytes(bytes) {
      if (!bytes) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
    },

    formatEta(seconds) {
      if (!seconds || seconds < 0) return '–';
      if (seconds < 60) return `${Math.round(seconds)}s`;
      return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    },

    formatDate(dateStr) {
      try {
        return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch { return ''; }
    },

    stripHtml(html) {
      if (!html) return '';
      return String(html).replace(/<[^>]*>/g, '').trim();
    },
  },
};
</script>

<style scoped>
.upd-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
}

.upd-notes {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border-radius: 8px;
  padding: 12px 14px;
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
