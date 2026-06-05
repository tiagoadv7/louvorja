<template>
  <!-- ── Popup de confirmação (igual ao LouvorJA Delphi) ────────────────────── -->
  <v-dialog v-model="confirmShow" max-width="460" persistent>
    <v-card rounded="lg" elevation="8">
      <v-card-title class="d-flex align-center pa-4 pb-2 text-subtitle-1 font-weight-semibold">
        <img src="/ico/favicon.png" width="20" class="mr-2" style="object-fit:contain" />
        LouvorJA
      </v-card-title>
      <v-card-text class="d-flex align-start gap-3 pa-4 pt-2">
        <v-icon color="primary" size="36" class="mt-1 flex-shrink-0">mdi-help-circle-outline</v-icon>
        <div>
          <div class="text-body-2 font-weight-medium mb-1">
            Sua coletânea possui <strong>{{ totalMissing }}</strong> arquivo(s) faltando ou danificado(s)!
          </div>
          <div class="text-body-2 text-medium-emphasis">
            Deseja baixar estes arquivos agora? (necessário conexão com a internet)
          </div>
        </div>
      </v-card-text>
      <v-card-actions class="pa-3 justify-center gap-3">
        <v-btn variant="elevated" color="primary" min-width="80" @click="confirmYes">Sim</v-btn>
        <v-btn variant="outlined" min-width="80" @click="confirmNo">Não</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- ── Dialog principal: lista de arquivos estilo Delphi ──────────────────── -->
  <v-dialog v-model="show" max-width="920" :persistent="step === 'downloading'"
            @update:modelValue="v => { if (!v) close(); }">
    <v-card rounded="lg" elevation="8">

      <!-- Título -->
      <v-card-title class="d-flex align-center pa-3 pb-2 text-subtitle-2">
        <v-icon size="18" color="primary" class="mr-2">mdi-folder-search-outline</v-icon>
        Verificar arquivos em falta
        <v-spacer />
        <v-btn v-if="step !== 'downloading'" icon="mdi-close" variant="text" size="x-small" @click="close" />
      </v-card-title>

      <div class="text-caption text-medium-emphasis px-4 pb-1">
        Verificação de arquivos da coletânea:
      </div>
      <v-divider />

      <!-- ── Escaneando ──────────────────────────────────────────────────── -->
      <v-card-text v-if="step === 'scanning'" class="d-flex align-center justify-center py-8">
        <v-progress-circular indeterminate size="36" width="3" color="primary" class="mr-4" />
        <span class="text-body-2">Verificando arquivos locais...</span>
      </v-card-text>

      <!-- ── Lista de arquivos (estilo Delphi) ──────────────────────────── -->
      <template v-else-if="step === 'results' || step === 'all-good'">

        <!-- Ações de seleção (topo) -->
        <div v-if="step === 'results'" class="d-flex gap-2 pa-2 pb-1">
          <v-btn size="x-small" variant="outlined" prepend-icon="mdi-check-all" @click="selectAll">
            Marcar Todos
          </v-btn>
          <v-btn size="x-small" variant="outlined" prepend-icon="mdi-checkbox-blank-outline" @click="deselectAll">
            Desmarcar Todos
          </v-btn>
          <v-btn size="x-small" variant="outlined" prepend-icon="mdi-swap-horizontal" @click="invertSelection">
            Inverter Seleção
          </v-btn>
        </div>

        <!-- Cabeçalho da tabela -->
        <div class="file-list-header">
          <div class="file-col-check"></div>
          <div class="file-col-name">Arquivo</div>
          <div class="file-col-dir">Diretório</div>
          <div class="file-col-status">Status</div>
        </div>

        <!-- Lista de arquivos faltando (virtual scroll para performance) -->
        <v-virtual-scroll
          v-if="step === 'results' && fileList.length > 0"
          :items="fileList"
          :height="360"
          :item-height="28"
        >
          <template #default="{ item }">
            <div
              class="file-list-row"
              :class="{ 'file-list-row--selected': selectedDests.has(item.dest) }"
              @click="toggleItem(item.dest)"
            >
              <div class="file-col-check">
                <v-checkbox
                  :model-value="selectedDests.has(item.dest)"
                  density="compact"
                  hide-details
                  color="primary"
                  @click.stop="toggleItem(item.dest)"
                />
              </div>
              <div class="file-col-name text-truncate" :title="item.name">{{ item.name }}</div>
              <div class="file-col-dir text-truncate text-medium-emphasis" :title="item.relPath">
                {{ item.relPath }}
              </div>
              <div class="file-col-status text-error text-caption">Não encontrado</div>
            </div>
          </template>
        </v-virtual-scroll>

        <!-- Todos encontrados -->
        <div v-else-if="step === 'all-good'" class="d-flex flex-column align-center justify-center py-6">
          <v-icon color="success" size="48" class="mb-2">mdi-check-circle-outline</v-icon>
          <div class="text-body-1 font-weight-medium">Todos os arquivos estão presentes!</div>
          <div class="text-caption text-medium-emphasis mt-1">
            {{ totalScanned }} álbum(s) · {{ foundFiles }} arquivo(s) verificado(s)
          </div>
        </div>
      </template>

      <!-- ── Baixando ─────────────────────────────────────────────────────── -->
      <v-card-text v-else-if="step === 'downloading'" class="pa-4">
        <div class="d-flex align-center mb-2">
          <v-progress-circular size="20" width="2" indeterminate color="primary" class="mr-3" />
          <span class="text-body-2 font-weight-medium">Baixando arquivos...</span>
          <v-spacer />
          <span class="text-caption text-medium-emphasis">{{ dlCurrent }}/{{ dlTotal }}</span>
        </div>
        <v-progress-linear :model-value="dlPercent" height="6" rounded color="primary" class="mb-2" />
        <div class="d-flex align-center gap-3">
          <div class="text-caption text-medium-emphasis text-truncate flex-grow-1">{{ dlMessage }}</div>
          <div v-if="dlFileSize" class="text-caption text-medium-emphasis flex-shrink-0">{{ dlFileSize }}</div>
          <div v-if="dlSpeed" class="text-caption text-medium-emphasis flex-shrink-0 font-weight-medium">{{ dlSpeed }}</div>
        </div>
      </v-card-text>

      <!-- ── Concluído ────────────────────────────────────────────────────── -->
      <v-card-text v-else-if="step === 'done'" class="d-flex flex-column align-center justify-center py-6">
        <v-icon color="success" size="48" class="mb-2">mdi-check-circle-outline</v-icon>
        <div class="text-body-1 font-weight-medium">Download concluído!</div>
        <div class="text-caption text-medium-emphasis mt-1">{{ dlTotal }} arquivo(s) processado(s)</div>
      </v-card-text>

      <v-divider />

      <!-- Barra inferior: contadores + botões ────────────────────────────── -->
      <div class="d-flex align-center pa-2 gap-2">
        <!-- Contadores estilo Delphi -->
        <div class="text-caption pl-2 flex-grow-1">
          <template v-if="step === 'results' || step === 'all-good'">
            <span class="text-success mr-3">Encontrados: <strong>{{ foundFiles }}</strong></span>
            <span class="text-error">Em falta/danificado(s): <strong>{{ totalMissing }}</strong></span>
          </template>
        </div>

        <!-- Botões estilo Delphi -->
        <template v-if="step === 'results'">
          <v-btn
            size="small"
            color="primary"
            variant="elevated"
            prepend-icon="mdi-download"
            :disabled="selectedCount === 0"
            @click="startDownload"
          >
            Baixar Arquivos Selecionados
          </v-btn>
          <v-btn
            size="small"
            variant="outlined"
            prepend-icon="mdi-refresh"
            @click="rescan"
          >
            Verificar Novamente
          </v-btn>
          <v-btn size="small" variant="text" @click="close">Fechar</v-btn>
        </template>

        <template v-else-if="step === 'all-good'">
          <v-btn size="small" variant="outlined" prepend-icon="mdi-refresh" @click="rescan">
            Verificar Novamente
          </v-btn>
          <v-btn size="small" variant="text" @click="close">Fechar</v-btn>
        </template>

        <template v-else-if="step === 'done'">
          <v-btn size="small" variant="outlined" prepend-icon="mdi-refresh" @click="rescan">
            Verificar Novamente
          </v-btn>
          <v-btn size="small" variant="text" @click="close">Fechar</v-btn>
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
        this.show = true;
        this.step = 'scanning';
        this.fileList = [];
        this.selectedDests = new Set();
        await this.scan();
      } else {
        // Produção (startup): scan silencioso em background
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
      this.confirmShow = false;
      // Mantém a lista visível para seleção manual
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
/* Cabeçalho da tabela */
.file-list-header {
  display: flex;
  align-items: center;
  background: rgba(0,0,0,0.06);
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(var(--v-theme-on-surface), 0.6);
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

/* Linha de arquivo */
.file-list-row {
  display: flex;
  align-items: center;
  padding: 0 8px;
  height: 28px;
  cursor: pointer;
  border-bottom: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.5));
  transition: background 0.1s;
}
.file-list-row:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}
.file-list-row--selected {
  background: rgba(var(--v-theme-primary), 0.08);
}

/* Colunas */
.file-col-check  { width: 36px; flex-shrink: 0; }
.file-col-name   { width: 220px; flex-shrink: 0; font-size: 12px; padding-right: 8px; }
.file-col-dir    { flex: 1; font-size: 11px; padding-right: 8px; }
.file-col-status { width: 110px; flex-shrink: 0; font-size: 11px; text-align: center; }
</style>
