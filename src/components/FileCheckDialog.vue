<template>
  <!-- ── Dialog principal ────────────────────────────────────────────────────── -->
  <v-dialog
    v-model="show"
    max-width="900"
    transition="fade-transition"
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

      <!-- Conteúdo com transição entre etapas -->
      <transition name="fcd-step" mode="out-in">
        <div :key="step">

          <!-- Barra de estatísticas (apenas nos passos com dados) -->
          <div v-if="step === 'results' || step === 'all-good'" class="fcd-stats d-flex align-center flex-wrap gap-2 px-4 py-2">
            <v-chip size="small" color="success" variant="tonal" prepend-icon="mdi-check-circle-outline">
              Encontrados: <strong class="ml-1">{{ foundFiles }}</strong>
            </v-chip>
            <v-chip size="small" :color="totalMissing > 0 ? 'error' : 'success'" variant="tonal"
                    :prepend-icon="totalMissing > 0 ? 'mdi-alert-circle-outline' : 'mdi-check-all'">
              Em falta: <strong class="ml-1">{{ totalMissing }}</strong>
            </v-chip>
            <template v-if="stats">
              <v-chip v-if="stats.audio.missing > 0" size="x-small" color="warning" variant="tonal" prepend-icon="mdi-music">
                {{ stats.audio.missing }} áudio(s)
              </v-chip>
              <v-chip v-if="stats.cover.missing + stats.image.missing > 0" size="x-small" color="secondary" variant="tonal" prepend-icon="mdi-image-outline">
                {{ stats.cover.missing + stats.image.missing }} imagem(ns)
              </v-chip>
            </template>
            <v-spacer />
            <span class="text-caption text-medium-emphasis">
              {{ totalScanned }} álbum(s) · {{ totalFiles }} arquivo(s)
              <template v-if="albumsOK > 0"> · {{ albumsOK }} ok</template>
              <template v-if="albumsWithIssues > 0"> · {{ albumsWithIssues }} incompleto(s)</template>
            </span>
          </div>

          <!-- ── Escaneando ── -->
          <v-card-text v-if="step === 'scanning'" class="d-flex flex-column align-center justify-center py-12">
            <div class="fcd-scan-ring mb-5">
              <v-icon size="40" color="primary">mdi-folder-search-outline</v-icon>
            </div>
            <div class="text-body-1 font-weight-semibold mb-1">Verificando arquivos locais...</div>
            <div v-if="scanAlbum.total > 0" class="text-caption text-medium-emphasis mb-2 text-center" style="max-width:320px">
              {{ scanAlbum.current }}/{{ scanAlbum.total }} — {{ scanAlbum.name }}
            </div>
            <div v-else class="text-caption text-medium-emphasis mb-2">Isso pode levar alguns segundos</div>
            <v-progress-linear
              :indeterminate="scanAlbum.total === 0"
              :model-value="scanAlbum.total > 0 ? Math.round((scanAlbum.current / scanAlbum.total) * 100) : 0"
              color="primary" rounded height="4" style="max-width:220px;width:100%"
            />
          </v-card-text>

          <!-- ── Lista de arquivos ── -->
          <template v-else-if="step === 'results'">
            <!-- Toolbar de seleção -->
            <div class="fcd-toolbar d-flex align-center px-4 py-2" style="gap: 12px">
              <span class="text-caption text-medium-emphasis">Selecionar:</span>
              <v-btn size="small" variant="outlined" class="px-3" prepend-icon="mdi-check-all" @click="selectAll">Todos</v-btn>
              <v-btn size="small" variant="outlined" class="px-3" prepend-icon="mdi-checkbox-blank-outline" @click="deselectAll">Nenhum</v-btn>
              <v-btn size="small" variant="outlined" class="px-3" prepend-icon="mdi-swap-horizontal" @click="invertSelection">Inverter</v-btn>
              <v-spacer />
              <v-btn-toggle v-model="viewMode" density="compact" variant="outlined" mandatory rounded="lg">
                <v-btn value="grouped" size="small" icon="mdi-format-list-group" :title="'Agrupado por álbum'" />
                <v-btn value="flat" size="small" icon="mdi-format-list-bulleted" :title="'Lista simples'" />
              </v-btn-toggle>
              <v-chip size="small" color="primary" variant="tonal" prepend-icon="mdi-check">
                {{ selectedCount }} / {{ fileList.length }} selecionado(s)
              </v-chip>
            </div>
            <v-divider />

            <!-- Vista agrupada por álbum -->
            <template v-if="viewMode === 'grouped'">
              <v-expansion-panels v-model="expandedAlbums" multiple flat style="max-height:346px;overflow-y:auto">
                <v-expansion-panel
                  v-for="album in albumsIncomplete"
                  :key="album.id_album || album.name"
                  :value="album.id_album || album.name"
                  rounded="0"
                >
                  <v-expansion-panel-title class="fcd-album-header" hide-actions>
                    <template #default="{ isOpen }">
                      <v-icon size="16" class="me-2 flex-shrink-0">
                        {{ isOpen ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                      </v-icon>
                      <span class="text-body-2 font-weight-medium text-truncate flex-grow-1">{{ album.name }}</span>
                      <v-chip size="x-small" color="error" variant="tonal" class="mx-2 flex-shrink-0">
                        {{ album.missing }} em falta
                      </v-chip>
                      <span class="text-caption text-medium-emphasis flex-shrink-0 me-2">
                        {{ album.foundFiles }}/{{ album.totalFiles }} arquivo(s)
                      </span>
                    </template>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text class="pa-0">
                    <div
                      v-for="item in album.items"
                      :key="item.dest"
                      class="fcd-list-row fcd-list-row--indent"
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
                        <v-icon size="13" :color="item.type === 'audio' ? 'warning' : 'secondary'" class="me-1 flex-shrink-0">
                          {{ item.type === 'audio' ? 'mdi-file-music-outline' : 'mdi-image-outline' }}
                        </v-icon>
                        <span class="text-truncate text-body-2" :title="item.name">{{ item.name }}</span>
                      </div>
                      <div class="fcd-col-dir text-caption text-medium-emphasis text-truncate" :title="item.relPath">
                        {{ item.relPath }}
                      </div>
                      <div class="fcd-col-status">
                        <v-chip size="x-small" :color="item.type === 'audio' ? 'error' : 'secondary'" variant="tonal">
                          {{ item.type === 'audio' ? 'áudio' : item.type === 'cover' ? 'capa' : 'imagem' }}
                        </v-chip>
                      </div>
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </template>

            <!-- Vista lista plana -->
            <template v-else>
              <!-- Cabeçalho da lista -->
              <div class="fcd-list-header">
                <div class="fcd-col-check" />
                <div class="fcd-col-name">Arquivo</div>
                <div class="fcd-col-dir">Localização</div>
                <div class="fcd-col-status">Tipo</div>
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
                      <v-icon size="13" :color="item.type === 'audio' ? 'warning' : 'secondary'" class="me-1 flex-shrink-0">
                        {{ item.type === 'audio' ? 'mdi-file-music-outline' : 'mdi-image-outline' }}
                      </v-icon>
                      <span class="text-truncate text-body-2" :title="item.name">{{ item.name }}</span>
                    </div>
                    <div class="fcd-col-dir text-caption text-medium-emphasis text-truncate" :title="item.relPath">
                      {{ item.relPath }}
                    </div>
                    <div class="fcd-col-status">
                      <v-chip size="x-small" :color="item.type === 'audio' ? 'error' : 'secondary'" variant="tonal">
                        {{ item.type === 'audio' ? 'áudio' : item.type === 'cover' ? 'capa' : 'imagem' }}
                      </v-chip>
                    </div>
                  </div>
                </template>
              </v-virtual-scroll>
            </template>
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
                <div class="text-h4 font-weight-black text-success">{{ totalFiles }}</div>
                <div class="text-caption text-medium-emphasis">arquivos</div>
              </div>
              <template v-if="stats && stats.audio.found > 0">
                <v-divider vertical />
                <div class="text-center">
                  <div class="text-h4 font-weight-black text-warning">{{ stats.audio.found }}</div>
                  <div class="text-caption text-medium-emphasis">áudios</div>
                </div>
              </template>
              <template v-if="stats && (stats.cover.found + stats.image.found) > 0">
                <v-divider vertical />
                <div class="text-center">
                  <div class="text-h4 font-weight-black text-secondary">{{ stats.cover.found + stats.image.found }}</div>
                  <div class="text-caption text-medium-emphasis">imagens</div>
                </div>
              </template>
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

        </div>
      </transition>

      <v-divider v-if="step === 'results' || step === 'all-good' || step === 'done'" />

      <!-- Barra de ações -->
      <div v-if="step === 'results' || step === 'all-good' || step === 'done'" class="fcd-actions d-flex align-center px-5 py-3" style="gap: 12px">
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
    show:      false,
    step:      'scanning',   // scanning | all-good | results | downloading | done
    _autoOpen: false,        // true = aberto automaticamente no startup

    // Scan results
    totalScanned:   0,    // álbuns verificados
    totalFiles:     0,    // total arquivos checados
    foundFiles:     0,    // encontrados
    totalMissing:   0,    // faltando
    fileList:       [],   // lista flat de arquivos faltando
    albumList:      [],   // todos os álbuns (incluindo completos)
    stats:          null, // {audio, cover, image} contagem por tipo
    scanSource:     null, // 'delphi' | 'json' | null

    // Progresso do scan
    scanAlbum: { current: 0, total: 0, name: '' },
    _scanProgressHandler: null,
    _scanId: 0,             // incrementado a cada scan; close() também incrementa para cancelar pendentes

    // Vista
    viewMode:       'grouped',  // 'grouped' | 'flat'
    expandedAlbums: [],         // painéis expandidos no modo agrupado

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
    selectedCount()    { return this.selectedDests.size; },
    allSelected()      { return this.fileList.length > 0 && this.selectedDests.size === this.fileList.length; },
    albumsOK()         { return this.albumList.filter(a => a.missing === 0).length; },
    albumsWithIssues() { return this.albumList.filter(a => a.missing > 0).length; },
    albumsIncomplete() { return this.albumList.filter(a => a.missing > 0); },
  },

  methods: {
    // Abre o dialog e inicia a varredura.
    // force=true → sempre mostra o diálogo com spinner (usado pelo menu "Sincronizar arquivos").
    // force=false (padrão) → em produção mostra scanning imediatamente e fecha se não houver faltando.
    async open(force = false) {
      if (import.meta.env.DEV || force) {
        this._autoOpen = false;
        this._scanId++;  // cancela eventual _scanSilent() ainda em andamento
        this.show = true;
        this.step = 'scanning';
        this.fileList = [];
        this.albumList = [];
        this.stats = null;
        this.selectedDests = new Set();
        this.scanAlbum = { current: 0, total: 0, name: '' };
        await this.scan();
      } else {
        this._autoOpen = true;
        await this._scanSilent();
      }
    },

    async _scanSilent() {
      const myId = ++this._scanId;
      this.fileList      = [];
      this.albumList     = [];
      this.stats         = null;
      this.selectedDests = new Set();
      this.scanAlbum     = { current: 0, total: 0, name: '' };

      // Mostra a tela de escaneamento imediatamente
      this.step = 'scanning';
      this.show = true;

      let result = null;
      try {
        this._scanProgressHandler = this.$electron.on('files:scan-progress', ({ current, total, albumName }) => {
          if (this._scanId === myId) this.scanAlbum = { current, total, name: albumName };
        });
        result = await this.$electron.scanAlbumsFiles();
      } catch (_) {
        if (this._scanId === myId) this.close();
        return;
      } finally {
        if (this._scanProgressHandler) {
          this.$electron.off('files:scan-progress', this._scanProgressHandler);
          this._scanProgressHandler = null;
        }
      }

      if (this._scanId !== myId) return;
      if (!result || result.total === 0) {
        this.close();
        return;
      }

      this.totalScanned = result.total      || 0;
      this.totalFiles   = result.totalFiles || 0;
      this.foundFiles   = result.foundFiles || 0;
      this.fileList     = result.allMissing || [];
      this.albumList    = result.allAlbums  || [];
      this.stats        = result.stats      || null;
      this.scanSource   = result.source     || null;
      this.totalMissing = this.fileList.length;

      if (this.totalMissing === 0) {
        // Sem problemas: mostra "tudo ok" brevemente e fecha
        this.step = 'all-good';
        await new Promise(r => setTimeout(r, 1500));
        if (this._scanId === myId) this.close();
        return;
      }

      // Arquivos faltando: mostra resultados diretamente
      this.selectedDests  = new Set(this.fileList.map(f => f.dest));
      this.expandedAlbums = this.albumsIncomplete.map(a => a.id_album || a.name);
      this.step           = 'results';
    },

    close() {
      this._scanId++; // invalida qualquer scan em andamento — resultado será ignorado
      if (this._dlHandler) {
        this.$electron.off('files:download-progress', this._dlHandler);
        this._dlHandler = null;
      }
      if (this._scanProgressHandler) {
        this.$electron.off('files:scan-progress', this._scanProgressHandler);
        this._scanProgressHandler = null;
      }
      this.show = false;
    },

    async scan() {
      const myId = ++this._scanId;
      let result = null;
      try {
        this._scanProgressHandler = this.$electron.on('files:scan-progress', ({ current, total, albumName }) => {
          if (this._scanId === myId) this.scanAlbum = { current, total, name: albumName };
        });
        result = await this.$electron.scanAlbumsFiles();
      } catch (_) {
        if (!import.meta.env.DEV) { this.show = false; return; }
      } finally {
        if (this._scanProgressHandler) {
          this.$electron.off('files:scan-progress', this._scanProgressHandler);
          this._scanProgressHandler = null;
        }
      }

      // Scan cancelado (close() foi chamado durante a varredura)
      if (this._scanId !== myId) return;

      if (import.meta.env.DEV && (!result || result.total === 0)) {
        result = this._mockScanResult();
      }

      this.totalScanned = result?.total      || 0;
      this.totalFiles   = result?.totalFiles || 0;
      this.foundFiles   = result?.foundFiles || 0;
      this.fileList     = result?.allMissing || [];
      this.albumList    = result?.allAlbums  || [];
      this.stats        = result?.stats      || null;
      this.scanSource   = result?.source     || null;
      this.totalMissing = this.fileList.length;

      // Usuário fechou o dialog enquanto o scan rodava
      if (!this.show) return;

      if (this.totalMissing === 0) {
        this.step = 'all-good';
      } else {
        this.step           = 'results';
        this.selectedDests  = new Set(this.fileList.map(f => f.dest));
        this.expandedAlbums = this.albumsIncomplete.map(a => a.id_album || a.name);
      }
    },

    _mockScanResult() {
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
      const allAlbums  = [];
      const stats = { audio: { found: 0, missing: 0 }, cover: { found: 0, missing: 0 }, image: { found: 0, missing: 0 } };
      let totalFiles = 0;
      let foundFiles = 0;

      albums.forEach((album, idx) => {
        const albumMissingItems = album.missing.map(fileName => ({
          name:    fileName,
          relPath: album.name,
          dest:    `config/musicas/${album.name}/${fileName}`,
          url:     `https://api.louvorja.com.br/file/musics/pt/${encodeURIComponent(album.name)}/${encodeURIComponent(fileName)}`,
          type:    'audio',
        }));
        totalFiles += album.all.length;
        foundFiles += album.all.length - album.missing.length;
        stats.audio.found   += album.all.length - album.missing.length;
        stats.audio.missing += album.missing.length;
        allMissing.push(...albumMissingItems);
        allAlbums.push({
          id_album:   idx + 1,
          name:       album.name,
          url_image:  '',
          totalFiles: album.all.length,
          foundFiles: album.all.length - album.missing.length,
          missing:    album.missing.length,
          items:      albumMissingItems,
        });
      });

      return { total: albums.length, totalFiles, foundFiles, allMissing, allAlbums, stats };
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
      this.selectedDests = new Set(this.fileList.filter(f => !this.selectedDests.has(f.dest)).map(f => f.dest));
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

      this._dlHandler = this.$electron.on('files:download-progress', ({ current, total, message, fileSize, speed }) => {
        this.dlCurrent  = current;
        this.dlTotal    = total || this.dlTotal;
        this.dlPercent  = total > 0 ? Math.round((current / total) * 100) : 0;
        this.dlMessage  = message || '';
        this.dlFileSize = fileSize || '';
        this.dlSpeed    = speed    || '';
      });

      try {
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
      this.scanAlbum     = { current: 0, total: 0, name: '' };
      await this.scan();
    },
  },
};
</script>

<style scoped>
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
.fcd-list-row--indent { padding-left: 32px; }
.fcd-list-row:hover       { background: rgba(var(--v-theme-primary), 0.05); }
.fcd-list-row--on         { background: rgba(var(--v-theme-primary), 0.09); }
.fcd-list-row--on:hover   { background: rgba(var(--v-theme-primary), 0.13); }

/* ── Cabeçalho de álbum (expansion panel) ────────────────────────────────── */
.fcd-album-header {
  padding: 0 16px;
  min-height: 40px !important;
  border-bottom: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.4));
  background: rgba(var(--v-theme-surface-variant), 0.2);
}

/* ── Colunas ─────────────────────────────────────────────────────────────── */
.fcd-col-check  { width: 38px; flex-shrink: 0; }
.fcd-col-name   { display: flex; align-items: center; width: 250px; flex-shrink: 0; padding-right: 12px; overflow: hidden; }
.fcd-col-dir    { flex: 1; padding-right: 12px; overflow: hidden; }
.fcd-col-status { width: 84px; flex-shrink: 0; display: flex; justify-content: center; }

/* ── Barra de ações ──────────────────────────────────────────────────────── */
.fcd-actions {
  background: rgba(var(--v-theme-surface-variant), 0.1);
}

/* ── Expansion panels sem padding extra ─────────────────────────────────── */
:deep(.v-expansion-panel-text__wrapper) {
  padding: 0 !important;
}

/* ── Transição entre etapas ─────────────────────────────────────────────── */
.fcd-step-enter-active,
.fcd-step-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.fcd-step-enter-from { opacity: 0; transform: translateY(6px); }
.fcd-step-leave-to   { opacity: 0; transform: translateY(-4px); }
</style>
