<template>
  <v-dialog v-model="dialog" max-width="560" persistent>
    <v-card rounded="lg" elevation="12" style="overflow:hidden">

      <!-- Cabeçalho -->
      <div class="rn-header">
        <v-avatar size="44" color="primary" variant="tonal" class="flex-shrink-0">
          <v-icon size="22">mdi-bullhorn-outline</v-icon>
        </v-avatar>
        <div class="flex-grow-1 min-w-0">
          <div class="text-subtitle-1 font-weight-bold">Novidades desta versão</div>
          <div class="text-caption text-medium-emphasis">v{{ version }}</div>
        </div>
        <v-btn icon="mdi-close" size="small" variant="text" density="comfortable" @click="close" />
      </div>
      <v-divider />

      <!-- ── Carregando ── -->
      <v-card-text v-if="loading" class="d-flex flex-column align-center py-12 ga-5">
        <v-progress-circular indeterminate color="primary" size="52" width="4" />
        <div class="text-body-2 text-medium-emphasis">Carregando novidades...</div>
      </v-card-text>

      <!-- ── Sem conexão / release não encontrada ── -->
      <v-card-text v-else-if="error" class="d-flex flex-column align-center py-10 ga-3">
        <v-avatar size="60" color="warning" variant="tonal">
          <v-icon size="32">mdi-cloud-off-outline</v-icon>
        </v-avatar>
        <div class="text-body-2 text-medium-emphasis text-center">
          Não foi possível carregar as novidades desta versão agora.
        </div>
      </v-card-text>

      <!-- ── Conteúdo ── -->
      <v-card-text v-else class="rn-body">
        <div v-if="release?.name" class="rn-title">{{ release.name }}</div>
        <div v-html="formatChangelog(release?.bodyHtml || release?.body)" />
      </v-card-text>

      <v-divider />

      <v-card-actions class="px-5 py-3" style="gap:12px">
        <v-checkbox
          v-model="dontShowAgain"
          density="compact"
          hide-details
          label="Não mostrar novamente"
          class="rn-checkbox"
        />
        <v-spacer />
        <v-btn
          v-if="release?.url"
          variant="text"
          size="small"
          :href="release.url"
          target="_blank"
          rel="noopener noreferrer"
          prepend-icon="mdi-open-in-new"
        >
          Ver no GitHub
        </v-btn>
        <v-btn color="primary" variant="flat" class="px-5" @click="close">Fechar</v-btn>
      </v-card-actions>

    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'ReleaseNotesDialog',

  data: () => ({
    dialog: false,
    loading: false,
    error: false,
    dontShowAgain: false,
    version: '',
    release: null,
  }),

  methods: {
    // Chamado pelo App.vue depois de checar se a versão instalada ainda não
    // foi vista (skip_release_notes_version no electron-store) — busca o
    // changelog dessa versão nas Releases do GitHub (ver
    // electron/updater.js#getCurrentReleaseNotes) e mostra o modal.
    async open(version) {
      this.version = version;
      this.dialog = true;
      this.loading = true;
      this.error = false;
      this.release = null;
      try {
        const data = await this.$electron.updaterGetReleaseNotes(version);
        if (!data) {
          this.error = true;
        } else {
          this.release = data;
        }
      } catch (_) {
        this.error = true;
      } finally {
        this.loading = false;
      }
    },

    // Só grava a versão como "vista" se o operador marcar a caixa — do
    // contrário o modal volta a aparecer nos próximos boots até ser
    // reconhecido (mesmo comportamento do fork mais avançado deste app,
    // louvorja/violin-app, ReleaseNotesDialog.vue).
    close() {
      this.dialog = false;
      if (this.dontShowAgain && this.version) {
        this.$electron.storeSet('skip_release_notes_version', this.version).catch(() => {});
      }
    },

    // Mesma heurística de UpdateDialog.vue#formatChangelog: bodyHtml já vem
    // renderizado (GitHub /markdown); só reformata marcadores de lista quando
    // ainda é texto cru (fallback de rede/API).
    formatChangelog(text) {
      if (!text) return '<span class="text-medium-emphasis">Sem notas para esta versão.</span>';
      if (/<[a-z][\s\S]*>/i.test(text)) return text;
      const escaped = String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return escaped
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.replace(/^\s*[-*]\s+/, '• '))
        .join('<br>');
    },
  },
};
</script>

<style scoped>
.rn-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
}

.rn-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 10px;
}

.rn-body {
  max-height: 50vh;
  overflow-y: auto;
  line-height: 1.6;
  font-size: 14px;
}

.rn-body :deep(h1),
.rn-body :deep(h2),
.rn-body :deep(h3) {
  font-size: 1rem;
  font-weight: 700;
  margin: 14px 0 6px;
}

.rn-body :deep(ul),
.rn-body :deep(ol) {
  margin: 6px 0;
  padding-left: 22px;
}

.rn-body :deep(li) {
  margin: 3px 0;
}

.rn-body :deep(a) {
  color: rgb(var(--v-theme-primary));
}

.rn-checkbox {
  flex: 0 1 auto;
  margin: 0;
}
</style>
