<template>
  <!-- ── Confirmação ─────────────────────────────────────────────────────────── -->
  <v-dialog v-model="confirmShow" max-width="420" persistent>
    <v-card rounded="lg" elevation="12" style="overflow:hidden">
      <div class="fcd-confirm-header">
        <v-avatar color="warning" size="48" variant="tonal" class="flex-shrink-0">
          <v-icon size="26">mdi-folder-alert-outline</v-icon>
        </v-avatar>
        <div>
          <div class="text-subtitle-1 font-weight-bold">Arquivos em falta</div>
          <div class="text-caption text-medium-emphasis">Coletânea incompleta detectada</div>
        </div>
      </div>
      <v-card-text class="px-5 pt-0 pb-3">
        <div class="text-body-2">
          Sua coletânea possui
          <strong class="text-warning">{{ totalMissing }} arquivo(s)</strong>
          faltando ou danificado(s).
        </div>
        <div class="text-body-2 text-medium-emphasis mt-1">
          Deseja baixá-los agora? (requer conexão com a internet)
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions class="px-5 py-4 justify-end" style="gap: 24px">
        <v-btn variant="text" class="px-5" prepend-icon="mdi-clock-outline" @click="confirmNo">Agora não</v-btn>
        <v-btn color="primary" variant="flat" class="px-5" prepend-icon="mdi-download" @click="confirmYes">
          Baixar agora
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- ── Dialog principal ────────────────────────────────────────────────────── -->
  <v-dialog
    v-model="show"
    max-width="900"
    :persistent="step === 'downloading'"
    @update:modelValue="v => { if (!v) close(); }"
  >
    <v-card rounded="lg" elevation="8" style="overflow:hidden">

      <!-- Cabeçalho -->
      <div class="fcd-header">
        <div class="d-flex align-center gap-3">
          <v-avatar color="primary" variant="tonal" size="40">
            <v-icon size="20">mdi-folder-sync-outline</v-icon>
          </v-avatar>
          <div>
            <div class="text-subtitle-2 font-weight-bold">Sincronizar arquivos</div>
            <div class="text-caption text-medium-emphasis">Verificação de integridade da coletânea</div>
          </div>
        </div>
        <v-btn v-if="step !== 'downloading'" icon="mdi-close" variant="text" size="small" density="comfortable" @click="close" />
      </div>
      <v-divider />

      <!-- Barra de estatísticas -->
      <div v-if="step === 'results' || step === 'all-good'" class="fcd-stats d-flex align-center gap-3 px-4 py-2">
        <v-chip size="small" color="success" variant="tonal" prepend-icon="mdi-check-circle-outline">
          Encontrados: <strong class="ml-1">{{ foundFiles }}</strong>
        </v-chip>
        <v-chip size="small" :color="totalMissing > 0 ? 'error' : 'success'" variant="tonal"
                :prepend-icon="totalMissing > 0 ? 'mdi-alert-circle-outline' : 'mdi-check-all'">
          Em falta: <strong class="ml-1">{{ totalMissing }}</strong>
        </v-chip>
        <v-spacer />
        <span class="text-caption text-medium-emphasis">
          {{ totalScanned }} álbum(s) verificado(s)
        </span>
      </div>

      <!-- ── Escaneando ── -->
      <v-card-text v-if="step === 'scanning'" class="d-flex flex-column align-center justify-center py-12">
        <div class="fcd-scan-ring mb-5">
          <v-icon size="40" color="primary">mdi-folder-search-outline</v-icon>
        </div>
        <div class="text-body-1 font-weight-semibold mb-1">Verificando arquivos locais...</div>
        <div class="text-caption text-medium-emphasis mb-5">Isso pode levar alguns segundos</div>
        <v-progress-linear indeterminate color="primary" rounded height="4" style="max-width:220px;width:100%" />
      </v-card-text>

      <!-- ── Lista de arquivos ── -->
      <template v-else-if="step === 'results'">
        <!-- Toolbar de seleção -->
        <div class="fcd-toolbar d-flex align-center px-4 py-2" style="gap: 16px">
          <span class="text-caption text-medium-emphasis">Selecionar:</span>
          <v-btn size="small" variant="outlined" class="px-5" prepend-icon="mdi-check-all" @click="selectAll">Todos</v-btn>
          <v-btn size="small" variant="outlined" class="px-5" prepend-icon="mdi-checkbox-blank-outline" @click="deselectAll">Nenhum</v-btn>
          <v-btn size="small" variant="outlined" class="px-5" prepend-icon="mdi-swap-horizontal" @click="invertSelection">Inverter</v-btn>
          <v-spacer />
          <v-chip size="small" color="primary" variant="tonal" prepend-icon="mdi-check">
            {{ selectedCount }} / {{ fileList.length }} selecionado(s)
          </v-chip>
        </div>
        <v-divider />

        <!-- Cabeçalho da lista -->
        <div class="fcd-list-header">
          <div class="fcd-col-check" />
          <div class="fcd-col-name">Arquivo</div>
          <div class="fcd-col-dir">Localização</div>
          <div class="fcd-col-status">Status</div>
        </div>

        <!-- Linhas (virtual scroll) -->
        <v-virtual-scroll :items="fileList" :height="310" :item-height="36">
          <template #default="{ item }">
            <div
              class="fcd-list-row"
              :class="{ 'fcd-list-row--on': selectedDests.has(item.dest) }"
              @click="toggleItem(item.dest)"
            >
              <div class="fcd-col-check">
                <v-checkbox
                  :model-value="selectedDests.has(item.dest)"
                  density="compact"
                  hide-details
                  color="primary"
                  @click.stop="toggleItem(item.dest)"
                />
              </div>
              <div class="fcd-col-name">
                <v-icon size="13" color="warning" class="me-1 flex-shrink-0">mdi-file-music-outline</v-icon>
                <span class="text-truncate text-body-2" :title="item.name">{{ item.name }}</span>
              </div>
              <div class="fcd-col-dir text-caption text-medium-emphasis text-truncate" :title="item.relPath">
                {{ item.relPath }}
              </div>
              <div class="fcd-col-status">
                <v-chip size="x-small" color="error" variant="tonal">faltando</v-chip>
              </div>
            </div>
          </template>
        </v-virtual-scroll>
      </template>

      <!-- ── Tudo ok ── -->
      <v-card-text v-else-if="step === 'all-good'" class="d-flex flex-column align-center justify-center py-10">
        <v-avatar color="success" variant="tonal" size="72" class="mb-4">
          <v-icon size="40">mdi-check-circle-outline</v-icon>
        </v-avatar>
        <div class="text-h6 font-weight-bold mb-1">Tudo em ordem!</div>
        <div class="text-body-2 text-medium-emphasis mb-6">Todos os arquivos da coletânea estão presentes.</div>
        <div class="d-flex gap-6">
          <div class="text-center">
            <div class="text-h4 font-weight-black text-primary">{{ totalScanned }}</div>
            <div class="text-caption text-medium-emphasis">álbuns</div>
          </div>
          <v-divider vertical />
          <div class="text-center">
            <div class="text-h4 font-weight-black text-success">{{ foundFiles }}</div>
            <div class="text-caption text-medium-emphasis">arquivos</div>
          </div>
        </div>
      </v-card-text>

      <!-- ── Baixando ── -->
      <v-card-text v-else-if="step === 'downloading'" class="pa-6">
        <div class="d-flex align-center gap-4 mb-5">
          <v-progress-circular size="38" width="3" indeterminate color="primary" />
          <div class="flex-grow-1 min-w-0">
            <div class="text-body-2 font-weight-semibold mb-1">Baixando arquivos...</div>
            <div class="text-caption text-medium-emphasis text-truncate">{{ dlMessage }}</div>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-subtitle-2 font-weight-bold">{{ dlCurrent }}<span class="text-medium-emphasis font-weight-regular">/{{ dlTotal }}</span></div>
            <div class="text-caption text-primary font-weight-medium">{{ dlPercent }}%</div>
          </div>
        </div>
        <v-progress-linear :model-value="dlPercent" height="8" rounded color="primary" class="mb-3" />
        <div class="d-flex justify-space-between">
          <span class="text-caption text-medium-emphasis">{{ dlFileSize }}</span>
          <span class="text-caption text-primary font-weight-semibold">{{ dlSpeed }}</span>
        </div>
      </v-card-text>

      <!-- ── Concluído ── -->
      <v-card-text v-else-if="step === 'done'" class="d-flex flex-column align-center justify-center py-10">
        <v-avatar color="success" variant="tonal" size="72" class="mb-4">
          <v-icon size="40">mdi-download-circle-outline</v-icon>
        </v-avatar>
        <div class="text-h6 font-weight-bold mb-1">Download concluído!</div>
        <div class="text-body-2 text-medium-emphasis">
          {{ dlTotal }} arquivo(s) processado(s) com sucesso.
        </div>
      </v-card-text>

      <v-divider />

      <!-- Barra de ações -->
      <div class="fcd-actions d-flex align-center px-5 py-3" style="gap: 12px">
        <div class="flex-grow-1" />

        <template v-if="step === 'results'">
          <v-btn
            size="small"
            color="primary"
            variant="flat"
            class="px-5"
            prepend-icon="mdi-download"
            :disabled="selectedCount === 0"
            @click="startDownload"
          >
            Baixar {{ selectedCount === 1 ? 'selecionado' : 'selecionados' }} ({{ selectedCount }})
          </v-btn>
          <v-divider vertical style="height:28px; align-self:center" />
          <v-btn size="small" variant="tonal" class="px-5" prepend-icon="mdi-refresh" @click="rescan">
            Verificar novamente
          </v-btn>
          <v-divider vertical style="height:28px; align-self:center" />
          <v-btn variant="text" size="small" class="px-5" prepend-icon="mdi-close" @click="close">Fechar</v-btn>
        </template>

        <template v-else-if="step === 'all-good' || step === 'done'">
          <v-btn size="small" variant="tonal" class="px-5" prepend-icon="mdi-refresh" @click="rescan">
            Verificar novamente
          </v-btn>
          <v-divider vertical style="height:28px; align-self:center" />
          <v-btn size="small" color="primary" variant="flat" class="px-5" prepend-icon="mdi-close" @click="close">Fechar</v-btn>
        </template>
      </div>

    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'FileCheckDialog',

  data: () => ({
    // Dialog states
    show:        false,
    confirmShow: false,
    step:        'scanning',   // scanning | all-good | results | downloading | done
    _autoOpen:   false,        // true = aberto automaticamente no startup

    // Scan results
    totalScanned: 0,   // álbuns verificados
    totalFiles:   0,   // total arquivos checados
    foundFiles:   0,   // encontrados
    totalMissing: 0,   // faltando
    fileList:     [],  // lista flat de arquivos faltando (estilo Delphi)

    // Seleção
    selectedDests: new Set(),

    // Download
    dlCurrent:  0,
    dlTotal:    0,
    dlPercent:  0,
    dlMessage:  '',
    dlFileSize: '',
    dlSpeed:    '',
    _dlHandler: null,
  }),

  computed: {
    selectedCount() { return this.selectedDests.size; },
    allSelected()   { return this.fileList.length > 0 && this.selectedDests.size === this.fileList.length; },
  },

  methods: {
    // Abre o dialog e inicia a varredura.
    // force=true → sempre mostra o diálogo com spinner (usado pelo menu "Sincronizar arquivos").
    // force=false (padrão) → em produção faz scan silencioso e só abre se houver faltando.
    async open(force = false) {
      if (import.meta.env.DEV || force) {
        // Dev ou trigger manual: mostra diálogo completo com spinner de scanning
        this._autoOpen = false;
        this.show = true;
        this.step = 'scanning';
        this.fileList = [];
        this.selectedDests = new Set();
        await this.scan();
      } else {
        // Produção (startup): scan silencioso em background
        this._autoOpen = true;
        await this._scanSilent();
      }
    },

    // Scan silencioso para produção: não exibe diálogo durante o scan.
    // Só abre o diálogo (na etapa 'results') se houver arquivos faltando.
    async _scanSilent() {
      this.fileList     = [];
      this.selectedDests = new Set();

      let result = null;
      try {
        result = await this.$electron.scanAlbumsFiles();
      } catch (_) { return; } // erro de IPC — silencioso

      if (!result || result.total === 0) return; // nenhum álbum baixado — OK

      this.totalScanned = result.total      || 0;
      this.totalFiles   = result.totalFiles || 0;
      this.foundFiles   = result.foundFiles || 0;
      this.fileList     = result.allMissing || [];
      this.totalMissing = this.fileList.length;

      if (this.totalMissing === 0) return; // tudo presente — sem diálogo

      // Há arquivos faltando: abre diálogo direto na etapa de resultados
      this.selectedDests = new Set(this.fileList.map(f => f.dest));
      this.show          = true;
      this.step          = 'results';
      this.confirmShow   = true; // exibe popup de confirmação imediatamente
    },

    close() {
      if (this._dlHandler) {
        this.$electron.off('files:download-progress', this._dlHandler);
        this._dlHandler = null;
      }
      this.show = false;
      this.confirmShow = false;
    },

    async scan() {
      let result = null;
      try {
        result = await this.$electron.scanAlbumsFiles();
      } catch (_) {
        // Em produção, fecha silenciosamente em caso de erro no IPC
        if (!import.meta.env.DEV) { this.show = false; return; }
      }

      // Dev: injeta dados mock quando db/ está vazio ou IPC falhou
      if (import.meta.env.DEV && (!result || result.total === 0)) {
        result = this._mockScanResult();
      }

      this.totalScanned = result?.total      || 0;
      this.totalFiles   = result?.totalFiles || 0;
      this.foundFiles   = result?.foundFiles || 0;
      this.fileList     = result?.allMissing || [];
      this.totalMissing = this.fileList.length;

      if (this.totalMissing === 0) {
        this.step = 'all-good';
      } else {
        this.step = 'results';
        this.selectedDests = new Set(this.fileList.map(f => f.dest));
        this.confirmShow = true;
      }
    },

    _mockScanResult() {
      // Nomes reais do banco SQLite (files.file_name + files.dir último segmento)
      const albums = [
        {
          name: '1992 - Brilha Jesus',
          all:  ['Nosso Sol É Jesus.mp3','Brilha Jesus.mp3','Jesus Meu Melhor Amigo.mp3','Ele Está ao Leme.mp3','Avançai Juvenis.mp3'],
          missing: ['Ele Está ao Leme.mp3','Avançai Juvenis.mp3'],
        },
        {
          name: '1993 - Já é Tempo',
          all:  ['Prefixo de Louvor.mp3','Já é Tempo.mp3','Todos Animados no Senhor.mp3','Com Jesus Em Meu Caminho.mp3','Vamos Semear.mp3','Jesus, Toda Vida.mp3','Dê Glória.mp3','Vem Espírito Santo.mp3'],
          missing: ['Dê Glória.mp3','Vem Espírito Santo.mp3'],
        },
        {
          name: '1994 - Jesus, Meu Rei, Meu Amigo',
          all:  ['Prefixo de Louvor.mp3','Deus Rei dos Reis.mp3','Tu És Deus.mp3','Junto a Cristo.mp3','Mais Semelhante a Jesus.mp3','Faz-me um Servo.mp3','Sinto a Presença do Senhor.mp3'],
          missing: [],
        },
        {
          name: '1995 - A Diferença é Cristo',
          all:  ['Prefixo de Louvor.mp3','A Diferença é Cristo.mp3','Andando Com Jesus.mp3','Em Uma Voz.mp3','Eu Me Ofereço a Ti.mp3','Unidos Em Cristo.mp3','Tudo Entregarei.mp3','Eu Só Quero Estar Onde Estás.mp3','A Diferença é Cristo - PB.mp3','Andando Com Jesus - PB.mp3','Em Uma Voz - PB.mp3','Eu Me Ofereço a Ti - PB.mp3','Unidos Em Cristo - PB.mp3','Tudo Entregarei - PB.mp3','Eu Só Quero Estar Onde Estás - PB.mp3'],
          missing: ['Unidos Em Cristo - PB.mp3','Tudo Entregarei - PB.mp3','Eu Só Quero Estar Onde Estás - PB.mp3'],
        },
        {
          name: '1997 - Na Direção de Deus',
          all:  ['Na Direção de Deus.mp3','Que bom é Estar Aqui.mp3','Descanso em Deus.mp3','Paz no Viver.mp3','Só pela Graça.mp3','Vitória só vem do Senhor.mp3','Além do Rio.mp3','Ao Deixar este Lugar.mp3','A Verdadeira Alegria.mp3','Na Direção de Deus - PB.mp3','Que bom é Estar Aqui - PB.mp3','Descanso em Deus - PB.mp3','Paz no Viver - PB.mp3','Só pela Graça - PB.mp3','Vitória só vem do Senhor - PB.mp3','Além do Rio - PB.mp3','Ao Deixar este Lugar - PB.mp3','A Verdadeira Alegria - PB.mp3'],
          missing: ['Ao Deixar este Lugar - PB.mp3','A Verdadeira Alegria - PB.mp3'],
        },
        {
          name: '1998 - Missão',
          all:  ['Missão.mp3','Em Oração.mp3','Boas Novas.mp3','Virá um Novo Tempo.mp3','Cordeiro de Deus.mp3','Eu quero ser a Voz.mp3','Minha Oração.mp3','Dá-nos Tua perfeita Paz.mp3','Ide.mp3','Vamos Juntos Cantar.mp3','Face a Face.mp3','Missão - PB.mp3','Em Oração - PB.mp3','Boas Novas - PB.mp3','Virá um Novo Tempo - PB.mp3','Cordeiro de Deus - PB.mp3','Eu quero ser a Voz - PB.mp3','Minha Oração - PB.mp3','Dá-nos Tua perfeita Paz - PB.mp3','Ide - PB.mp3','Vamos Juntos Cantar - PB.mp3','Face a Face - PB.mp3'],
          missing: ['Cordeiro de Deus - PB.mp3','Eu quero ser a Voz - PB.mp3','Minha Oração - PB.mp3','Dá-nos Tua perfeita Paz - PB.mp3'],
        },
        {
          name: '1999 - Rumo ao Porto Seguro',
          all:  ['Rumo ao Porto Seguro.mp3','Vaso de Honra-Renova-me.mp3','O Poder do Amor.mp3','Oh! Que Esperança.mp3','Eu Não me Esqueci de Ti.mp3','Sob o Sangue.mp3','Refrigera Minha Alma.mp3','Cante ao Senhor.mp3','Santo Lugar.mp3','Rumo ao Porto Seguro - PB.mp3','Vaso de Honra-Renova-me - PB.mp3','O Poder do Amor - PB.mp3','Oh! Que Esperança - PB.mp3','Eu Não me Esqueci de Ti - PB.mp3','Sob o Sangue - PB.mp3','Refrigera Minha Alma - PB.mp3','Cante ao Senhor - PB.mp3','Santo Lugar - PB.mp3'],
          missing: ['Refrigera Minha Alma - PB.mp3','Cante ao Senhor - PB.mp3','Santo Lugar - PB.mp3'],
        },
        {
          name: '2001 - Quase no Lar',
          all:  ['Poderoso Deus.mp3','Quase no Lar.mp3','Medley - Quão bom, Satisfação.mp3','Estende a Tua mão.mp3','A Esperança é Jesus.mp3','Estaremos Juntos pra Sempre.mp3','Eu quero Ouvir.mp3','Nisto Cremos.mp3','Foi Assim.mp3','Momentos.mp3','Meu Abrigo.mp3','Vou para o Lar.mp3','Poderoso Deus - PB.mp3'],
          missing: [],
        },
      ];

      const allMissing = [];
      let totalFiles = 0;
      let foundFiles = 0;

      albums.forEach(album => {
        totalFiles += album.all.length;
        const missingSet = new Set(album.missing);
        foundFiles += album.all.length - album.missing.length;
        album.missing.forEach(fileName => {
          allMissing.push({
            name:    fileName,
            relPath: album.name,
            dest:    `config/musicas/${album.name}/${fileName}`,
            url:     `https://api.louvorja.com.br/file/musics/pt/${encodeURIComponent(album.name)}/${encodeURIComponent(fileName)}`,
          });
        });
      });

      return {
        total:      albums.length,
        totalFiles,
        foundFiles,
        allMissing,
      };
    },

    // ── Popup de confirmação ────────────────────────────────────────────
    confirmYes() {
      this.confirmShow = false;
      // Inicia download dos selecionados automaticamente
      this.startDownload();
    },
    confirmNo() {
      if (this._autoOpen) {
        this.close();
      } else {
        this.confirmShow = false;
      }
    },

    // ── Seleção ─────────────────────────────────────────────────────────
    toggleItem(dest) {
      const s = new Set(this.selectedDests);
      if (s.has(dest)) s.delete(dest);
      else s.add(dest);
      this.selectedDests = s;
    },
    selectAll()      { this.selectedDests = new Set(this.fileList.map(f => f.dest)); },
    deselectAll()    { this.selectedDests = new Set(); },
    invertSelection() {
      const s = new Set(this.fileList.filter(f => !this.selectedDests.has(f.dest)).map(f => f.dest));
      this.selectedDests = s;
    },

    // ── Download ─────────────────────────────────────────────────────────
    async startDownload() {
      const items = this.fileList.filter(f => this.selectedDests.has(f.dest));
      if (!items.length) return;

      this.dlTotal    = items.length;
      this.dlCurrent  = 0;
      this.dlPercent  = 0;
      this.dlMessage  = 'Iniciando...';
      this.dlFileSize = '';
      this.dlSpeed    = '';
      this.step       = 'downloading';

      // Registra listener de progresso já no estado "downloading"
      this._dlHandler = this.$electron.on('files:download-progress', ({ current, total, message, fileSize, speed }) => {
        this.dlCurrent  = current;
        this.dlTotal    = total || this.dlTotal;
        this.dlPercent  = total > 0 ? Math.round((current / total) * 100) : 0;
        this.dlMessage  = message || '';
        this.dlFileSize = fileSize || '';
        this.dlSpeed    = speed    || '';
      });

      try {
        // JSON round-trip remove os Proxy reativos do Vue antes de passar ao IPC.
        // ipcRenderer.invoke usa structured-clone; Proxies Vue podem falhar na
        // serialização em algumas versões do Electron, causando falha silenciosa.
        const plainItems = JSON.parse(JSON.stringify(items));

        const result = await this.$electron.downloadMissingFiles(
          plainItems,
          import.meta.env.VITE_URL_FILES,
          import.meta.env.VITE_API_TOKEN,
        );

        if (result?.success === false && result?.error) {
          console.error('[FileCheckDialog] download-missing falhou:', result.error);
          this.step = 'results';
        } else {
          this.step = 'done';
        }
      } catch (err) {
        console.error('[FileCheckDialog] startDownload erro:', err);
        this.step = 'results';
      } finally {
        if (this._dlHandler) {
          this.$electron.off('files:download-progress', this._dlHandler);
          this._dlHandler = null;
        }
      }
    },

    async rescan() {
      this.step          = 'scanning';
      this.selectedDests = new Set();
      this.confirmShow   = false;
      await this.scan();
    },
  },
};
</script>

<style scoped>
/* ── Confirmação ─────────────────────────────────────────────────────────── */
.fcd-confirm-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px 20px 14px;
}

/* ── Cabeçalho principal ─────────────────────────────────────────────────── */
.fcd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

/* ── Barra de estatísticas ───────────────────────────────────────────────── */
.fcd-stats {
  background: rgba(var(--v-theme-surface-variant), 0.25);
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

/* ── Scanning ring ───────────────────────────────────────────────────────── */
.fcd-scan-ring {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.08);
  border: 2px solid rgba(var(--v-theme-primary), 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fcd-pulse 2s ease-in-out infinite;
}

@keyframes fcd-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--v-theme-primary), 0.25); }
  50%       { box-shadow: 0 0 0 12px rgba(var(--v-theme-primary), 0); }
}

/* ── Toolbar de seleção ──────────────────────────────────────────────────── */
.fcd-toolbar {
  background: rgba(var(--v-theme-surface-variant), 0.15);
}

/* ── Cabeçalho da lista ──────────────────────────────────────────────────── */
.fcd-list-header {
  display: flex;
  align-items: center;
  padding: 5px 16px;
  background: rgba(var(--v-theme-surface-variant), 0.35);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(var(--v-theme-on-surface), 0.5);
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

/* ── Linhas ──────────────────────────────────────────────────────────────── */
.fcd-list-row {
  display: flex;
  align-items: center;
  padding: 0 16px;
  height: 36px;
  cursor: pointer;
  border-bottom: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.4));
  transition: background 0.1s;
}
.fcd-list-row:hover       { background: rgba(var(--v-theme-primary), 0.05); }
.fcd-list-row--on         { background: rgba(var(--v-theme-primary), 0.09); }
.fcd-list-row--on:hover   { background: rgba(var(--v-theme-primary), 0.13); }

/* ── Colunas ─────────────────────────────────────────────────────────────── */
.fcd-col-check  { width: 38px; flex-shrink: 0; }
.fcd-col-name   { display: flex; align-items: center; width: 250px; flex-shrink: 0; padding-right: 12px; overflow: hidden; }
.fcd-col-dir    { flex: 1; padding-right: 12px; overflow: hidden; }
.fcd-col-status { width: 84px; flex-shrink: 0; display: flex; justify-content: center; }

/* ── Barra de ações ──────────────────────────────────────────────────────── */
.fcd-actions {
  background: rgba(var(--v-theme-surface-variant), 0.1);
}
</style>
