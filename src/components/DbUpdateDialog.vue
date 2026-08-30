<template>
  <v-dialog v-model="dialog" max-width="460" persistent>
    <v-card rounded="lg" elevation="12" style="overflow:hidden">

      <!-- Cabeçalho -->
      <div class="dbupd-header">
        <v-avatar size="44" color="primary" variant="tonal" class="flex-shrink-0">
          <v-icon size="22">mdi-cloud-sync-outline</v-icon>
        </v-avatar>
        <div class="flex-grow-1 min-w-0">
          <div class="text-subtitle-1 font-weight-bold">Nova Versão de Banco de Dados</div>
          <div class="text-caption text-medium-emphasis">Versão {{ newVersion }}</div>
        </div>
        <v-btn icon="mdi-close" size="small" variant="text" density="comfortable" @click="dismiss" />
      </div>
      <v-divider />

      <v-card-text class="d-flex flex-column align-center py-8 gap-4 px-6">
        <v-avatar size="72" color="primary" variant="tonal">
          <v-icon size="40">mdi-folder-sync-outline</v-icon>
        </v-avatar>
        <div class="text-center">
          <div class="text-h6 font-weight-bold">Nova versão do banco de dados disponível</div>
          <div class="text-body-2 text-medium-emphasis mt-1">
            Uma nova versão do banco de dados oficial foi publicada no servidor.
            Sincronize os arquivos para manter sua coletânea atualizada.
          </div>
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions class="px-5 py-3" style="gap:12px">
        <v-btn variant="text" @click="dismiss">Agora não</v-btn>
        <v-spacer />
        <v-btn color="primary" variant="flat" prepend-icon="mdi-folder-sync-outline" @click="apply">
          Sincronizar arquivos
        </v-btn>
      </v-card-actions>

    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'DbUpdateDialog',

  // Diferente do modelo antigo, não existe mais "database.db" pra baixar
  // (a API real não serve esse arquivo — só a versão via params?type=env,
  // ver electron/ipc.js#fetchRemoteDbVersion). Este diálogo só avisa que
  // há uma nova versão do banco de dados; a sincronização de verdade é
  // delegada pro FileCheckDialog (arquivo por arquivo, já testado), via
  // este evento.
  emits: ['sync-requested'],

  data: () => ({
    dialog: false,
    newVersion: '',
    _rawVersion: 0,
  }),

  methods: {
    // Verifica em segundo plano se há nova versão do banco de dados publicada
    // (ver electron/ipc.js#sqlite:check-db-update). Só abre o diálogo quando
    // encontra algo — silencioso quando já está atualizado ou a API está fora.
    async check() {
      if (!this.$electron?.isElectron()) return;

      const dbBaseUrl = import.meta.env.VITE_URL_DATABASE;
      const token = import.meta.env.VITE_API_TOKEN;

      try {
        const result = await this.$electron.sqliteCheckDbUpdate(dbBaseUrl, token);
        if (!result?.updateAvailable) return;

        this.newVersion  = result.newVersion || '?';
        this._rawVersion = result.rawVersion || 0;
        this.dialog      = true;
      } catch (e) {
        console.error('[DbUpdateDialog] check falhou:', e);
      }
    },

    // Fecha sem marcar como visto — a próxima verificação (próxima abertura
    // do app) vai perguntar de novo pra essa mesma versão.
    dismiss() {
      this.dialog = false;
    },

    // Marca a versão como vista e delega a sincronização real pro
    // FileCheckDialog (App.vue escuta este evento).
    async apply() {
      this.dialog = false;
      if (this._rawVersion) {
        await this.$electron.sqliteApplyDbUpdate(this._rawVersion).catch(() => {});
      }
      this.$emit('sync-requested');
    },
  },
};
</script>

<style scoped>
.dbupd-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
}
</style>
