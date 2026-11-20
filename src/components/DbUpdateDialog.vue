<template>
  <!-- Mesmo padrão das outras janelas do sistema (Gerenciar Álbuns,
       Sincronizar arquivos...): cartão lja-glass, cabeçalho com ícone e as
       cores do tema atual. -->
  <v-dialog v-model="dialog" max-width="520" persistent>
    <v-card rounded="lg" elevation="12" class="lja-glass" theme="lja-glass" style="overflow:hidden">
      <div class="dbu-header">
        <v-avatar size="44" :color="state === 'done' ? 'success' : state === 'error' ? 'error' : 'primary'" variant="tonal" class="flex-shrink-0">
          <v-icon size="22">{{ state === 'done' ? 'mdi-database-check' : state === 'error' ? 'mdi-database-alert' : 'mdi-database-sync' }}</v-icon>
        </v-avatar>
        <div class="flex-grow-1 min-w-0">
          <div class="text-subtitle-1 font-weight-bold">{{ t('title') }}</div>
          <div class="text-caption text-medium-emphasis">{{ t(state === 'done' ? 'sub_done' : 'sub') }}</div>
        </div>
        <v-btn v-if="state !== 'running'" icon="mdi-close" size="small" variant="text" density="comfortable" @click="dismiss" />
      </div>
      <v-divider />

      <v-card-text class="px-5 py-4">
        <!-- Versão atual → nova -->
        <div class="dbu-versions">
          <div class="dbu-ver">
            <v-icon size="20" class="text-medium-emphasis">mdi-database</v-icon>
            <div>
              <div class="text-caption text-medium-emphasis">{{ t('current') }}</div>
              <div class="text-subtitle-1 font-weight-bold">v{{ currentVersion }}</div>
            </div>
          </div>
          <v-icon color="primary">mdi-arrow-right</v-icon>
          <div class="dbu-ver">
            <v-icon size="20" color="primary">mdi-database-check</v-icon>
            <div>
              <div class="text-caption text-medium-emphasis">{{ t('new') }}</div>
              <div class="text-subtitle-1 font-weight-bold text-primary">v{{ newVersion }}</div>
            </div>
          </div>
        </div>

        <div class="mt-4 text-body-2">
          <template v-if="state === 'done'">
            <div class="dbu-line"><v-icon color="success" size="18">mdi-check-circle</v-icon>{{ t('done_catalog', { count: result.catalog }) }}</div>
            <div v-if="result.sqlite === 'updated'" class="dbu-line"><v-icon color="success" size="18">mdi-check-circle</v-icon>{{ t('done_sqlite') }}</div>
            <div v-else-if="result.sqlite === 'locked'" class="dbu-line"><v-icon color="warning" size="18">mdi-alert</v-icon>{{ t('done_locked') }}</div>
            <div class="text-caption text-medium-emphasis mt-2">{{ t('done_hint') }}</div>
          </template>
          <template v-else-if="state === 'error'">
            <div class="dbu-line"><v-icon color="error" size="18">mdi-alert-circle</v-icon>{{ t('error') }}</div>
            <div class="text-caption text-medium-emphasis mt-2" style="word-break: break-word">{{ errorText }}</div>
          </template>
          <template v-else>
            <div class="font-weight-bold mb-1">{{ t('what') }}</div>
            <ul class="dbu-list text-medium-emphasis">
              <li>{{ t('what_catalog') }}</li>
              <li>{{ t('what_sqlite') }}</li>
              <li>{{ t('what_keep') }}</li>
            </ul>
          </template>
        </div>

        <div v-if="state === 'running'" class="mt-4">
          <div class="d-flex justify-space-between text-caption mb-1">
            <span>{{ t('step_' + step) }}</span>
            <span class="text-primary font-weight-bold">{{ percent }}%</span>
          </div>
          <v-progress-linear :model-value="percent" color="primary" height="6" rounded />
        </div>
      </v-card-text>

      <v-divider />
      <v-card-actions class="px-5 py-3" style="gap:12px">
        <template v-if="state === 'done'">
          <v-btn variant="text" prepend-icon="mdi-folder-sync-outline" @click="syncFiles">{{ t('sync_files') }}</v-btn>
          <v-spacer />
          <v-btn color="primary" variant="flat" @click="finish">{{ t('finish') }}</v-btn>
        </template>
        <template v-else>
          <v-btn variant="text" :disabled="state === 'running'" @click="dismiss">{{ t('later') }}</v-btn>
          <v-spacer />
          <v-btn color="primary" variant="flat" :loading="state === 'running'" prepend-icon="mdi-download" @click="apply">
            {{ state === 'error' ? t('retry') : t('update') }}
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import $storage from '@/helpers/Storage';

// Nova versão do banco de conteúdo publicada (electron/ipc.js
// #sqlite:check-db-update): agora a atualização é feita DE VERDADE aqui
// (electron/ipc.js#db:update-content) — catálogo (álbuns, músicas, hinários)
// e, se o app usa o database.db do Delphi, o banco SQLite novo. Antes só
// levava ao "Sincronizar arquivos" (áudios/capas) e o catálogo ficava velho.
export default {
  name: 'DbUpdateDialog',
  emits: ['sync-requested'],

  data: () => ({
    dialog: false,
    state: 'idle', // idle | running | done | error
    step: 'catalog-download',
    percent: 0,
    currentVersion: '?',
    newVersion: '?',
    _rawVersion: 0,
    result: { catalog: 0, sqlite: 'none' },
    errorText: '',
    _progressHandler: null,
  }),

  mounted() {
    this._progressHandler = this.$electron.on?.('db:update-progress', ({ step, percent } = {}) => {
      if (step) this.step = step;
      if (typeof percent === 'number') this.percent = Math.max(this.percent, Math.min(100, percent));
    });
  },
  beforeUnmount() {
    if (this._progressHandler) this.$electron.off?.('db:update-progress', this._progressHandler);
  },

  methods: {
    t(k, p) { return this.$t(`components.db_update.${k}`, p || {}); },

    // Verifica em segundo plano; só abre quando há versão nova.
    async check() {
      if (!this.$electron?.isElectron()) return;
      try {
        const result = await this.$electron.sqliteCheckDbUpdate(import.meta.env.VITE_URL_DATABASE, import.meta.env.VITE_API_TOKEN);
        if (!result?.updateAvailable) return;
        this.currentVersion = result.currentVersion || '?';
        this.newVersion = result.newVersion || '?';
        this._rawVersion = result.rawVersion || 0;
        this.state = 'idle';
        this.percent = 0;
        this.dialog = true;
      } catch (e) {
        console.error('[DbUpdateDialog] check falhou:', e);
      }
    },

    // "Agora não": pergunta de novo na próxima abertura do app.
    dismiss() {
      this.dialog = false;
    },

    async apply() {
      this.state = 'running';
      this.step = 'catalog-download';
      this.percent = 0;
      const lang = this.$userdata?.get?.('language') || 'pt';
      const res = await this.$electron
        .dbUpdateContent({ dbBaseUrl: import.meta.env.VITE_URL_DATABASE, lang, version: this._rawVersion })
        .catch((e) => ({ ok: false, error: String(e?.message || e) }));
      if (res?.ok) {
        this.result = { catalog: res.catalog || 0, sqlite: res.sqlite || 'none' };
        this.state = 'done';
        this.percent = 100;
        // Listas já carregadas nesta sessão vêm do cache — limpa para reler
        try { $storage.removeAll('db', 'session'); } catch (_) { /* */ }
        window.dispatchEvent(new Event('lja-db-updated'));
      } else {
        this.errorText = res?.error || '';
        this.state = 'error';
      }
    },

    finish() {
      this.dialog = false;
    },

    // Áudios e capas novos (o banco só traz os dados)
    syncFiles() {
      this.dialog = false;
      this.$emit('sync-requested');
    },
  },
};
</script>

<style scoped>
.dbu-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
}
.dbu-versions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.dbu-ver {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dbu-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.dbu-list {
  margin: 0 0 0 18px;
  line-height: 1.6;
}
</style>
