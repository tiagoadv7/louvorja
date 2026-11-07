<template>
  <!-- ── Dialog principal ────────────────────────────────────────────────────── -->
  <v-dialog
    v-model="show"
    max-width="1080"
    transition="fade-transition"
    :persistent="step === 'downloading'"
    @update:modelValue="v => { if (!v) close(); }"
  >
    <v-card theme="lja-glass" rounded="0" elevation="0" class="fcd-card" style="overflow:hidden">

      <!-- Cabeçalho -->
      <div class="fx-top">
        <div class="fx-logo"><v-icon size="22">mdi-folder-sync-outline</v-icon></div>
        <div class="fx-heading">
          <h1>{{ $t('components.file_check.title') }}</h1>
          <p>{{ $t('components.file_check.subtitle') }}</p>
        </div>
        <button v-if="step === 'downloading'" type="button" class="fx-close" :title="$t('components.file_check.continue_bg')" @click="minimizeDownload">
          <v-icon size="20">mdi-window-minimize</v-icon>
        </button>
        <button v-else type="button" class="fx-close" :aria-label="$t('components.file_check.close')" @click="close">
          <v-icon size="22">mdi-close</v-icon>
        </button>
      </div>

      <!-- Conteúdo com transição entre etapas -->
      <transition name="fcd-step" mode="out-in">
        <div :key="step">

          <!-- Resumo (apenas nos passos com dados) -->
          <div v-if="step === 'results' || step === 'all-good'" class="fx-summary">
            <div class="fx-stats">
              <span class="fx-stat fx-stat--good">
                <v-icon size="14">mdi-check-circle-outline</v-icon>
                {{ $t('components.file_check.found') }}: <b>{{ foundFiles }}</b>
              </span>
              <span class="fx-stat" :class="totalMissing > 0 ? 'fx-stat--missing' : 'fx-stat--good'">
                <v-icon size="14">{{ totalMissing > 0 ? 'mdi-alert-circle-outline' : 'mdi-check-all' }}</v-icon>
                {{ $t('components.file_check.missing') }}: <b>{{ totalMissing }}</b>
              </span>
              <template v-if="stats">
                <span v-if="stats.audio.missing > 0" class="fx-stat fx-stat--audio">
                  <v-icon size="14">mdi-music</v-icon>
                  {{ $t('components.file_check.audio_count', { count: stats.audio.missing }) }}
                </span>
                <span v-if="stats.cover.missing + stats.image.missing > 0" class="fx-stat fx-stat--image">
                  <v-icon size="14">mdi-image-outline</v-icon>
                  {{ $t('components.file_check.image_count', { count: stats.cover.missing + stats.image.missing }) }}
                </span>
              </template>
            </div>
            <div class="fx-totals">
              {{ $t('components.file_check.album_summary', { albums: totalScanned, files: totalFiles }) }}<template v-if="albumsOK > 0">{{ $t('components.file_check.ok_count', { count: albumsOK }) }}</template><template v-if="albumsWithIssues > 0">{{ $t('components.file_check.incomplete_count', { count: albumsWithIssues }) }}</template>
            </div>
          </div>

          <!-- ── Escaneando ── -->
          <v-card-text v-if="step === 'scanning'" class="d-flex flex-column align-center justify-center py-12">
            <div class="fcd-scan-ring mb-5">
              <v-icon size="40" class="fc-icon">mdi-folder-search-outline</v-icon>
            </div>
            <div class="text-body-1 font-weight-semibold mb-1">{{ $t('components.file_check.scanning') }}</div>
            <div v-if="scanAlbum.total > 0" class="text-caption text-medium-emphasis mb-2 text-center" style="max-width:320px">
              {{ scanAlbum.current }}/{{ scanAlbum.total }} — {{ scanAlbum.name }}
            </div>
            <div v-else class="text-caption text-medium-emphasis mb-2">{{ $t('components.file_check.scanning_hint') }}</div>
            <v-progress-linear
              :indeterminate="scanAlbum.total === 0"
              :model-value="scanAlbum.total > 0 ? Math.round((scanAlbum.current / scanAlbum.total) * 100) : 0"
              color="primary" rounded height="4" style="max-width:220px;width:100%"
            />
          </v-card-text>

          <!-- ── Lista de arquivos ── -->
          <template v-else-if="step === 'results'">
            <div class="fx-toolbar">
              <div class="fx-actions">
                <button type="button" class="fx-btn" @click="selectAll"><v-icon size="16">mdi-checkbox-marked-outline</v-icon>{{ $t('components.file_check.select_all') }}</button>
                <button type="button" class="fx-btn" @click="deselectAll"><v-icon size="16">mdi-checkbox-blank-outline</v-icon>{{ $t('components.file_check.select_none') }}</button>
                <button type="button" class="fx-btn" @click="invertSelection"><v-icon size="16">mdi-swap-horizontal</v-icon>{{ $t('components.file_check.select_invert') }}</button>
              </div>
              <div class="fx-spacer" />
              <label class="fx-search">
                <v-icon size="17">mdi-magnify</v-icon>
                <input v-model="query" type="search" :placeholder="$t('components.file_check.search')" />
              </label>
              <div class="fx-filter">
                <span class="fx-filter-label">{{ $t('components.file_check.view_label') }}</span>
                <div class="fx-switch" role="group">
                  <button type="button" :class="{ active: viewMode === 'grouped' }" :title="$t('components.file_check.view_grouped')" @click="viewMode = 'grouped'">
                    <v-icon size="16">mdi-format-list-group</v-icon>{{ $t('components.file_check.view_group_btn') }}
                  </button>
                  <button type="button" :class="{ active: viewMode === 'flat' }" :title="$t('components.file_check.view_flat')" @click="viewMode = 'flat'">
                    <v-icon size="16">mdi-format-list-bulleted</v-icon>{{ $t('components.file_check.view_list_btn') }}
                  </button>
                </div>
              </div>
              <div class="fx-filter">
                <span class="fx-filter-label">{{ $t('components.file_check.filter_label') }}</span>
<v-menu location="bottom end" offset="6" content-class="fx-menu">
                  <template #activator="{ props, isActive }">
                    <button type="button" class="fx-select" :class="{ open: isActive }" v-bind="props">
                      <span>{{ statusOptions.find(o => o.value === statusFilter)?.label }}</span>
                      <v-icon size="18" class="fx-select-arrow">mdi-chevron-down</v-icon>
                    </button>
                  </template>
                  <div class="fx-menu-list">
                    <button
                      v-for="opt in statusOptions"
                      :key="opt.value"
                      type="button"
                      class="fx-menu-item"
                      :class="{ active: statusFilter === opt.value }"
                      @click="statusFilter = opt.value"
                    >
                      <v-icon size="16" class="fx-menu-icon">{{ opt.icon }}</v-icon>
                      <span>{{ opt.label }}</span>
                      <v-icon v-if="statusFilter === opt.value" size="16" class="fx-menu-check">mdi-check</v-icon>
                    </button>
                  </div>
                </v-menu>
              </div>
              <span class="fx-selected">{{ $t('components.file_check.selected_short', { count: selectedCount }) }}</span>
            </div>

            <!-- Agrupado por álbum: só os álbuns abertos desenham as linhas -->
            <div v-if="viewMode === 'grouped'" class="fx-content">
              <div
                v-for="album in visibleAlbums"
                :key="album.key"
                class="fx-album"
                :class="{ open: isAlbumOpen(album) }"
              >
                <button type="button" class="fx-album-head" @click="toggleAlbum(album)">
                  <v-icon size="16" class="fx-chevron">mdi-chevron-right</v-icon>
                  <span class="fx-album-name">{{ album.name }}</span>
                  <span v-if="album.missing > 0" class="fx-pill fx-pill--missing">{{ $t('components.file_check.album_missing', { count: album.missing }) }}</span>
                  <span v-else class="fx-pill fx-pill--ok">{{ $t('components.file_check.album_complete') }}</span>
                  <span class="fx-album-count">{{ $t('components.file_check.album_files', { found: album.foundFiles, total: album.totalFiles }) }}</span>
                </button>
                <div v-if="isAlbumOpen(album) && album.items.length" class="fx-tracks">
                  <label
                    v-for="item in album.items"
                    :key="item.dest"
                    class="fx-track"
                    :class="{ on: selectedDests.has(item.dest) }"
                  >
                    <input type="checkbox" :checked="selectedDests.has(item.dest)" @change="toggleItem(item.dest)" />
                    <div class="fx-file">
                      <v-icon size="15" class="fx-file-icon" :class="'fx-file-icon--' + item.type">{{ item.type === 'audio' ? 'mdi-music-note' : 'mdi-image-outline' }}</v-icon>
                      <span :title="item.name">{{ item.name }}</span>
                    </div>
                    <div class="fx-folder" :title="item.relPath">{{ item.relPath }}</div>
                    <span class="fx-tag" :class="'fx-tag--' + item.type">{{ typeLabel(item.type) }}</span>
                  </label>
                </div>
              </div>
              <div v-if="!visibleAlbums.length" class="fx-empty">{{ $t('components.file_check.no_match') }}</div>
            </div>

            <!-- Lista contínua (rolagem virtual: aguenta milhares de arquivos) -->
            <div v-else class="fx-content fx-content--list">
              <v-virtual-scroll v-if="visibleFiles.length" :items="visibleFiles" height="100%" :item-height="46" class="fx-vscroll">
                <template #default="{ item }">
                  <label class="fx-track fx-track--flat" :class="{ on: selectedDests.has(item.dest) }">
                    <input type="checkbox" :checked="selectedDests.has(item.dest)" @change="toggleItem(item.dest)" />
                    <div class="fx-file">
                      <v-icon size="15" class="fx-file-icon" :class="'fx-file-icon--' + item.type">{{ item.type === 'audio' ? 'mdi-music-note' : 'mdi-image-outline' }}</v-icon>
                      <span :title="item.name">{{ item.name }}</span>
                    </div>
                    <div class="fx-folder" :title="item.relPath">{{ item.relPath }}</div>
                    <span class="fx-tag" :class="'fx-tag--' + item.type">{{ typeLabel(item.type) }}</span>
                  </label>
                </template>
              </v-virtual-scroll>
              <div v-else class="fx-empty">{{ $t('components.file_check.no_match') }}</div>
            </div>
          </template>

          <!-- ── Tudo ok ── -->
          <v-card-text v-else-if="step === 'all-good'" class="d-flex flex-column align-center justify-center py-10">
            <v-avatar color="success" variant="tonal" size="72" class="mb-4">
              <v-icon size="40">mdi-check-circle-outline</v-icon>
            </v-avatar>
            <div class="text-body-2 text-medium-emphasis mb-6">{{ $t('components.file_check.all_good') }}</div>
            <div class="d-flex ga-6">
              <div class="text-center">
                <div class="text-h4 font-weight-black text-primary">{{ totalScanned }}</div>
                <div class="text-caption text-medium-emphasis">{{ $t('components.file_check.stat_albums') }}</div>
              </div>
              <v-divider vertical />
              <div class="text-center">
                <div class="text-h4 font-weight-black text-success">{{ totalFiles }}</div>
                <div class="text-caption text-medium-emphasis">{{ $t('components.file_check.stat_files') }}</div>
              </div>
              <template v-if="stats && stats.audio.found > 0">
                <v-divider vertical />
                <div class="text-center">
                  <div class="text-h4 font-weight-black text-warning">{{ stats.audio.found }}</div>
                  <div class="text-caption text-medium-emphasis">{{ $t('components.file_check.stat_audios') }}</div>
                </div>
              </template>
              <template v-if="stats && (stats.cover.found + stats.image.found) > 0">
                <v-divider vertical />
                <div class="text-center">
                  <div class="text-h4 font-weight-black text-secondary">{{ stats.cover.found + stats.image.found }}</div>
                  <div class="text-caption text-medium-emphasis">{{ $t('components.file_check.stat_images') }}</div>
                </div>
              </template>
            </div>
          </v-card-text>

          <!-- ── Baixando ── -->
          <v-card-text v-else-if="step === 'downloading'" class="py-7 px-6">
            <div class="d-flex align-center ga-5 mb-6">
              <v-progress-circular size="42" width="3" indeterminate color="primary" />
              <div class="flex-grow-1 min-w-0">
                <div class="text-body-2 font-weight-semibold mb-2">{{ $t('components.file_check.downloading') }}</div>
                <div class="text-caption text-medium-emphasis text-truncate">{{ dlMessage }}</div>
              </div>
              <div class="text-right flex-shrink-0">
                <div class="text-subtitle-2 font-weight-bold">{{ dlCurrent }}<span class="text-medium-emphasis font-weight-regular">/{{ dlTotal }}</span></div>
                <div class="text-caption text-primary font-weight-medium">{{ dlPercent }}%</div>
              </div>
            </div>
            <v-progress-linear :model-value="dlPercent" height="8" rounded color="primary" class="mb-4" />
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
            <div class="text-h6 font-weight-bold mb-1">{{ $t('components.file_check.done_title') }}</div>
            <div class="text-body-2 text-medium-emphasis">
              {{ $t('components.file_check.done_text', { count: dlTotal }) }}
            </div>
          </v-card-text>

        </div>
      </transition>

      <!-- Rodapé -->
      <div v-if="step === 'results' || step === 'all-good' || step === 'done'" class="fx-footer">
        <span class="fx-footer-note">
          <template v-if="step === 'results'">{{ $t('components.file_check.footer_note') }}</template>
        </span>
        <template v-if="step === 'results'">
          <button type="button" class="fx-btn fx-btn--primary" :disabled="selectedCount === 0" @click="startDownload">
            <v-icon size="17">mdi-download</v-icon>
            {{ selectedCount === 1 ? $t('components.file_check.download_one', { count: selectedCount }) : $t('components.file_check.download_many', { count: selectedCount }) }}
          </button>
          <button type="button" class="fx-btn" @click="rescan"><v-icon size="17">mdi-refresh</v-icon>{{ $t('components.file_check.rescan') }}</button>
          <button type="button" class="fx-btn fx-btn--ghost" @click="close"><v-icon size="17">mdi-close</v-icon>{{ $t('components.file_check.close') }}</button>
        </template>
        <template v-else>
          <button type="button" class="fx-btn" @click="rescan"><v-icon size="17">mdi-refresh</v-icon>{{ $t('components.file_check.rescan') }}</button>
          <button type="button" class="fx-btn fx-btn--primary" @click="close"><v-icon size="17">mdi-close</v-icon>{{ $t('components.file_check.close') }}</button>
        </template>
      </div>

    </v-card>
  </v-dialog>

  <!-- Indicador discreto do download em segundo plano: sem scrim, só o próprio
       botão captura clique, e some sozinho alguns segundos após concluir. -->
  <transition name="fcd-pill">
    <button
      v-if="showPill"
      type="button"
      class="fcd-pill"
      :title="dlDoneInBackground ? $t('components.file_check.pill_done_title') : $t('components.file_check.pill_running_title')"
      @click="restore"
    >
      <v-progress-circular
        :size="16"
        :width="2"
        :model-value="dlDoneInBackground ? 100 : dlPercent"
        :color="dlDoneInBackground ? 'success' : 'primary'"
      />
      <span>{{ dlDoneInBackground ? $t('components.file_check.pill_done') : `${dlPercent}%` }}</span>
    </button>
  </transition>
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
    expandedAlbums: [],         // chaves dos álbuns abertos no modo agrupado
    query:          '',         // busca por arquivo ou álbum
    collapsedAlbums: [],        // fechados à mão durante uma busca
    statusFilter:   'all',      // all | missing (incompletos) | found (completos)

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
    dlMinimized:        false, // download segue, diálogo escondido (ver minimizeDownload)
    dlDoneInBackground: false, // terminou com o diálogo minimizado; indicador some sozinho
    _pillTimer:         null,
  }),

  computed: {
    showPill()         { return (this.dlMinimized && this.step === 'downloading') || this.dlDoneInBackground; },
    selectedCount()    { return this.selectedDests.size; },
    allSelected()      { return this.fileList.length > 0 && this.selectedDests.size === this.fileList.length; },
    albumsOK()         { return this.albumList.filter(a => a.missing === 0).length; },
    albumsWithIssues() { return this.albumList.filter(a => a.missing > 0).length; },
    albumsIncomplete() { return this.albumList.filter(a => a.missing > 0); },
    statusOptions() {
      return [
        { value: 'all', label: this.$t('components.file_check.filter_all'), icon: 'mdi-folder-multiple-outline' },
        { value: 'missing', label: this.$t('components.file_check.filter_missing'), icon: 'mdi-alert-circle-outline' },
        { value: 'found', label: this.$t('components.file_check.filter_found'), icon: 'mdi-check-circle-outline' },
      ];
    },
    normQuery()        { return (this.query || '').trim().toLocaleLowerCase(); },
    // Álbuns na tela, já com busca e filtro aplicados (incompletos primeiro).
    // A verificação só lista os arquivos que FALTAM; dos encontrados vem a
    // contagem — por isso "Completos" filtra álbuns, não arquivos.
    visibleAlbums() {
      const q = this.normQuery;
      const out = [];
      const ordered = [...this.albumList].sort((a, b) => (b.missing > 0) - (a.missing > 0));
      for (const a of ordered) {
        if (this.statusFilter === 'missing' && !(a.missing > 0)) continue;
        if (this.statusFilter === 'found' && a.missing > 0) continue;
        let items = a.items || [];
        if (q) {
          const albumHit = (a.name || '').toLocaleLowerCase().includes(q);
          if (!albumHit) {
            items = items.filter(f => `${f.name} ${f.relPath || ''}`.toLocaleLowerCase().includes(q));
            if (!items.length) continue;
          }
        }
        out.push({ ...a, key: this.albumKey(a), items });
      }
      return out;
    },
    visibleFiles() {
      return this.visibleAlbums.flatMap(a => a.items);
    },
  },

  watch: {
    query() { this.collapsedAlbums = []; },
  },

  methods: {
    // Expande todos os álbuns incompletos por padrão, exceto quando há muitos —
    // v-expansion-panels não é virtualizado (ao contrário da vista "flat"), então
    // expandir centenas/milhares de linhas de uma vez trava o processo de render
    // e os cliques no cabeçalho/rodapé (X, Fechar) parecem não fazer nada.
    defaultExpandedAlbums() {
      if (this.albumsIncomplete.length > 8) return [];
      return this.albumsIncomplete.map(a => this.albumKey(a));
    },
    albumKey(a) { return String(a.id_album || a.name); },
    // Com busca ativa, os primeiros álbuns que combinam abrem sozinhos
    isAlbumOpen(album) {
      if (this.expandedAlbums.includes(album.key)) return true;
      if (!this.normQuery || this.collapsedAlbums.includes(album.key)) return false;
      const idx = this.visibleAlbums.findIndex(a => a.key === album.key);
      return idx > -1 && idx < 12;
    },
    toggleAlbum(album) {
      const open = this.isAlbumOpen(album);
      this.expandedAlbums = this.expandedAlbums.filter(k => k !== album.key);
      this.collapsedAlbums = this.collapsedAlbums.filter(k => k !== album.key);
      if (open) this.collapsedAlbums.push(album.key);
      else this.expandedAlbums.push(album.key);
    },
    typeLabel(type) {
      return type === 'audio' ? this.$t('components.file_check.type_audio')
        : type === 'cover' ? this.$t('components.file_check.type_cover')
        : this.$t('components.file_check.type_image');
    },

    // Abre o dialog e inicia a varredura.
    // force=true → sempre mostra o diálogo com spinner (usado pelo menu "Sincronizar arquivos").
    // force=false (padrão) → em produção mostra scanning imediatamente e fecha se não houver faltando.
    async open(force = false) {
      if (this.step === 'downloading') {
        this.restore();
        return;
      }
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

    // Roda a varredura inteira em segundo plano, SEM abrir o dialog (sem
    // scrim nenhum) — antes o dialog abria com "Verificando..." assim que a
    // varredura começava e só fechava sozinho no final, deixando um scrim de
    // v-dialog cobrindo a tela inteira por toda a duração do scan (podem ser
    // vários segundos com muitos álbuns). Qualquer clique do operador em
    // OUTRA parte do app nesse meio-tempo (ex.: abrir "Músicas" assim que o
    // programa termina de carregar) era engolido pelo scrim sem nenhum
    // feedback — parecia que o botão/ícone clicado "não funcionava". Agora só
    // abre o dialog no final, e só se realmente houver arquivo faltando.
    async _scanSilent() {
      const myId = ++this._scanId;
      this.fileList      = [];
      this.albumList     = [];
      this.stats         = null;
      this.selectedDests = new Set();
      this.scanAlbum     = { current: 0, total: 0, name: '' };

      let result = null;
      try {
        this._scanProgressHandler = this.$electron.on('files:scan-progress', ({ current, total, albumName }) => {
          if (this._scanId === myId) this.scanAlbum = { current, total, name: albumName };
        });
        result = await this.$electron.scanAlbumsFiles(this.$i18n.locale?.value || this.$i18n.locale);
      } catch (_) {
        return;
      } finally {
        if (this._scanProgressHandler) {
          this.$electron.off('files:scan-progress', this._scanProgressHandler);
          this._scanProgressHandler = null;
        }
      }

      if (this._scanId !== myId) return;
      if (!result || result.total === 0) return;

      this.totalScanned = result.total      || 0;
      this.totalFiles   = result.totalFiles || 0;
      this.foundFiles   = result.foundFiles || 0;
      this.fileList     = result.allMissing || [];
      this.albumList    = result.allAlbums  || [];
      this.stats        = result.stats      || null;
      this.scanSource   = result.source     || null;
      this.totalMissing = this.fileList.length;

      if (this.totalMissing === 0) return; // tudo ok — nunca precisou aparecer nada

      // Só agora, com algo real pra mostrar, abre o dialog direto na tela de
      // resultados (sem passar pelo "Verificando..."/"Tudo certo" — eram só
      // pra dar feedback visual de um dialog já aberto, que deixou de existir
      // aqui).
      this.selectedDests  = new Set(this.fileList.map(f => f.dest));
      this.expandedAlbums = this.defaultExpandedAlbums();
      this.query = '';
      this.statusFilter = 'all';
      this.step           = 'results';
      this.show           = true;
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
        result = await this.$electron.scanAlbumsFiles(this.$i18n.locale?.value || this.$i18n.locale);
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
        this.expandedAlbums = this.defaultExpandedAlbums();
      this.query = '';
      this.statusFilter = 'all';
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
    // Todos / Nenhum / Inverter valem para o que está na tela (busca e filtro)
    selectAll() {
      const s = new Set(this.selectedDests);
      this.visibleFiles.forEach(f => s.add(f.dest));
      this.selectedDests = s;
    },
    deselectAll() {
      const s = new Set(this.selectedDests);
      this.visibleFiles.forEach(f => s.delete(f.dest));
      this.selectedDests = s;
    },
    invertSelection() {
      const s = new Set(this.selectedDests);
      this.visibleFiles.forEach(f => (s.has(f.dest) ? s.delete(f.dest) : s.add(f.dest)));
      this.selectedDests = s;
    },

    // ── Download ─────────────────────────────────────────────────────────
    async startDownload() {
      const items = this.fileList.filter(f => this.selectedDests.has(f.dest));
      if (!items.length) return;

      this.dlTotal    = items.length;
      this.dlCurrent  = 0;
      this.dlPercent  = 0;
      this.dlMessage  = this.$t('components.file_check.starting');
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

      if (this.dlMinimized) {
        this.dlMinimized = false;
        if (this.step === 'done') {
          this.dlDoneInBackground = true;
          clearTimeout(this._pillTimer);
          this._pillTimer = setTimeout(() => { this.dlDoneInBackground = false; }, 5000);
        } else {
          this.show = true;
        }
      }
    },

    minimizeDownload() {
      this.dlMinimized = true;
      this.show = false;
    },

    restore() {
      clearTimeout(this._pillTimer);
      this.dlDoneInBackground = false;
      this.dlMinimized = false;
      this.show = true;
    },

    async rescan() {
      this.step          = 'scanning';
      this.selectedDests = new Set();
      this.scanAlbum     = { current: 0, total: 0, name: '' };
      await this.scan();
    },
  },

  beforeUnmount() {
    clearTimeout(this._pillTimer);
  },
};
</script>

<style scoped>
/* Mesmas cores azuis do app (coletâneas e centro de downloads), no lugar do cinza padrão do tema escuro */
/* Listas (álbuns e arquivos) com a mesma cor dos cartões do centro de downloads */
.fcd-card .v-expansion-panel,
.fcd-card .v-expansion-panel-text,
.fcd-card .v-expansion-panel-text__wrapper {
  background: transparent !important;
  color: #eef4ff;
}
.fcd-card .v-expansion-panel {
  border-bottom: 1px solid #1b2f48;
  box-shadow: none !important;
}
.fcd-card .v-expansion-panel-title {
  background: #13213a !important;
  color: #eef4ff;
}
.fcd-card .v-expansion-panel-title:hover {
  background: #182a4a !important;
}
.fcd-card .fcd-list-row {
  border-bottom: 1px solid #1b2f48;
}
/* Mesma paleta do centro de downloads: janela em degradê azul, cartões em #13213a */
/* ── Visual "Sincronizar arquivos" (design de referência) ──────────────── */
.fcd-card {
  --fx-panel: #0e2238;
  --fx-line: #29445f;
  --fx-text: #e8f1fb;
  --fx-muted: #9eb2c8;
  --fx-blue: #38bdf8;
  --fx-blue-2: #0ea5e9;
  --fx-green: #34d399;
  --fx-red: #fb7185;
  --fx-amber: #fbbf24;
  --v-theme-surface: 14, 34, 56;
  --v-theme-background: 7, 21, 37;
  --v-theme-primary: 56, 189, 248;
  background: var(--fx-panel) !important;
  color: var(--fx-text);
  border: 1px solid #31516f !important;
  border-radius: 18px !important;
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.6) !important;
  font-size: 14px;
  line-height: 1.45;
}
.fx-top {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 22px;
  background: linear-gradient(110deg, #123858, #10253c);
  border-bottom: 1px solid var(--fx-line);
}
.fx-logo {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 14px;
  background: #164c70;
  border: 1px solid #32759b;
}
.fx-logo .v-icon { color: #7dd3fc; }
.fx-heading { flex: 1; min-width: 0; }
.fx-heading h1 { font-size: 18px; margin: 0 0 3px; font-weight: 700; }
.fx-heading p { margin: 0; color: #a9c4dc; }
.fx-close {
  border: 0;
  background: transparent;
  color: #dbeafe;
  padding: 6px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.fx-close:hover { background: rgba(255, 255, 255, 0.09); }

.fx-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 22px;
  background: #142d46;
  border-bottom: 1px solid var(--fx-line);
}
.fx-stats { display: flex; gap: 8px; flex-wrap: wrap; }
.fx-stat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.07);
}
.fx-stat--good { color: var(--fx-green); }
.fx-stat--missing { color: var(--fx-red); }
.fx-stat--audio { color: var(--fx-amber); }
.fx-stat--image { color: #c4b5fd; }
.fx-totals { color: #b9c9da; font-weight: 600; }

.fx-toolbar {
  padding: 12px 22px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--fx-line);
  background: #10263d;
}
.fx-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.fx-spacer { flex: 1; }
.fx-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #466783;
  background: #193650;
  color: #e4f2ff;
  padding: 8px 12px;
  border-radius: 9px;
  font-weight: 600;
  font-size: 13.5px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.18s, border-color 0.18s, transform 0.18s, color 0.18s;
}
.fx-btn .v-icon { color: inherit; }
.fx-btn:hover { background: #244b6a; border-color: #5b91b7; transform: translateY(-1px); }
.fx-btn--primary { background: var(--fx-blue-2); border-color: var(--fx-blue); color: #032338; }
.fx-btn--primary:hover { background: var(--fx-blue); border-color: var(--fx-blue); }
.fx-btn--ghost { background: transparent; }
.fx-btn:disabled { opacity: 0.45; cursor: default; transform: none; }

.fx-search {
  position: relative;
  min-width: 150px;
  flex: 1;
  max-width: 230px;
  display: flex;
  align-items: center;
}
.fx-search .v-icon { position: absolute; left: 10px; color: #8ba8c2; pointer-events: none; }
.fx-search input {
  width: 100%;
  padding: 8px 12px 8px 34px;
  border-radius: 9px;
  border: 1px solid #36536e;
  background: #0b1d30;
  color: var(--fx-text);
  outline: none;
}
.fx-search input:focus { border-color: var(--fx-blue); box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.14); }
.fx-filter { display: flex; align-items: center; gap: 7px; }
.fx-filter-label { font-size: 12px; color: #91a9c0; }
.fx-switch {
  display: flex;
  padding: 3px;
  gap: 3px;
  background: #091a2b;
  border: 1px solid #304d67;
  border-radius: 10px;
}
.fx-switch button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  color: #9fb5c9;
  background: transparent;
  border-radius: 7px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 13px;
}
.fx-switch button .v-icon { color: inherit; }
.fx-switch button.active { background: #1d5275; color: #7dd3fc; box-shadow: inset 0 0 0 1px #397fa8; }
.fx-select {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 170px;
  justify-content: space-between;
  background: #0b1d30;
  color: #dceafa;
  border: 1px solid #36536e;
  padding: 7px 8px 7px 12px;
  border-radius: 10px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.fx-select:hover { border-color: #4f7ea3; }
.fx-select.open { border-color: var(--fx-blue); box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.14); }
.fx-select-arrow { color: #8fb8d6 !important; transition: transform 0.2s; }
.fx-select.open .fx-select-arrow { transform: rotate(180deg); }
.fx-menu-list {
  min-width: 190px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #0f2740;
  border: 1px solid #36536e;
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}
.fx-menu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #dceafa;
  font-size: 13.5px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.fx-menu-item:hover { background: #1b3a57; }
.fx-menu-item.active { background: #1d5275; color: #7dd3fc; }
.fx-menu-item span { flex: 1; }
.fx-menu-icon { color: #8fb8d6 !important; }
.fx-menu-item.active .fx-menu-icon,
.fx-menu-check { color: #7dd3fc !important; }
.fx-selected {
  font-size: 12px;
  color: #7dd3fc;
  background: #123c57;
  padding: 7px 10px;
  border-radius: 999px;
  white-space: nowrap;
}

.fx-content {
  overflow: auto;
  padding: 12px 16px 18px;
  min-height: 230px;
  max-height: min(52vh, 460px);
}
.fx-content--list {
  height: min(52vh, 460px);
  overflow: hidden;
  padding: 10px 12px;
}
.fx-vscroll { height: 100%; }
.fx-album {
  border: 1px solid #29445d;
  border-radius: 12px;
  overflow: hidden;
  margin: 0 0 10px;
  background: #10283f;
}
.fx-album-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  background: #142b43;
  border: 0;
  color: var(--fx-text);
  text-align: left;
  cursor: pointer;
}
.fx-album-head:hover { background: #18334f; }
.fx-chevron { color: #8fb8d6 !important; transition: transform 0.2s; }
.fx-album.open .fx-chevron { transform: rotate(90deg); }
.fx-album-name { font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fx-album-count { color: #a8bdd0; font-size: 12px; white-space: nowrap; }
.fx-pill { font-size: 11px; padding: 4px 8px; border-radius: 999px; white-space: nowrap; }
.fx-pill--missing { color: #fda4af; background: #55283c; }
.fx-pill--ok { color: #6ee7b7; background: #173f3a; }
.fx-tracks { padding: 4px 7px 7px; }
.fx-track {
  display: grid;
  grid-template-columns: 26px minmax(0, 1.15fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 8px;
  background: #1b354c;
  margin: 4px 0;
  min-height: 42px;
  cursor: pointer;
}
.fx-track:hover { background: #23445e; }
.fx-track--flat { height: 42px; margin: 0 0 4px; }
.fx-track input { width: 17px; height: 17px; accent-color: var(--fx-blue); cursor: pointer; margin: 0; }
.fx-file { display: flex; align-items: center; gap: 7px; min-width: 0; font-weight: 600; }
.fx-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fx-file-icon { flex-shrink: 0; }
.fx-file-icon--audio { color: var(--fx-amber) !important; }
.fx-file-icon--cover,
.fx-file-icon--image { color: #c4b5fd !important; }
.fx-folder { color: #a8bed2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.fx-tag { font-size: 10px; padding: 4px 8px; border-radius: 999px; white-space: nowrap; }
.fx-tag--audio { color: #fda4af; background: #572c40; }
.fx-tag--cover,
.fx-tag--image { color: #ddd6fe; background: #3b2d5c; }
.fx-empty { padding: 35px; text-align: center; color: var(--fx-muted); }

.fx-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 20px;
  background: #0b1b2b;
  border-top: 1px solid var(--fx-line);
}
.fx-footer-note { font-size: 12px; color: #8da5bb; flex: 1; min-width: 0; }

@media (max-width: 700px) {
  .fx-top, .fx-summary, .fx-toolbar { padding-left: 13px; padding-right: 13px; }
  .fx-totals { width: 100%; }
  .fx-search { max-width: none; order: 2; flex-basis: 100%; }
  .fx-track { grid-template-columns: 24px minmax(0, 1fr) auto; }
  .fx-folder, .fx-album-count { display: none; }
  .fx-footer { flex-wrap: wrap; }
  .fx-footer-note { flex-basis: 100%; }
}
/* Ícones em azul claro (#7FCDF4 / #4FB6EC), a mesma família de azuis do layout */
.fc-icon {
  color: #7fcdf4 !important;
}
/* "Verificar novamente" e "Fechar": mesmo azul do "Baixar" ao passar o mouse */
.fcd-act {
  background: rgba(79, 182, 236, 0.1) !important;
  color: #cfe9f8 !important;
  border: 1px solid rgba(79, 182, 236, 0.28);
  transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.fcd-act:hover {
  background: rgb(var(--v-theme-primary)) !important;
  color: rgb(var(--v-theme-on-primary)) !important;
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 4px 14px rgba(79, 182, 236, 0.35);
}
.fcd-act :deep(.v-btn__overlay),
.fcd-act :deep(.v-btn__underlay) {
  display: none;
}
.fcd-pill {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: rgba(var(--v-theme-surface), 0.9);
  color: rgb(var(--v-theme-on-surface));
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  cursor: pointer;
  user-select: none;
  opacity: 0.85;
  transition: opacity 0.15s ease;
}
.fcd-pill:hover {
  opacity: 1;
}
.fcd-pill-enter-active,
.fcd-pill-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fcd-pill-enter-from,
.fcd-pill-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* Separa visualmente os dois botões (grade/lista) do grupo — por padrão o
   v-btn-toggle deixa tudo colado, formando um só bloco sem nenhum respiro
   entre os ícones. O v-btn-group do Vuetify vem com "overflow-x: auto" por
   padrão (pensado pra grupos com muitos botões) — como o gap deixa o
   conteúdo mais largo que a caixa original, isso sozinho já bastava pra
   aparecer uma barra de rolagem horizontal por baixo dos dois ícones.
   overflow: visible + width: auto removem essa rolagem, já que só são 2
   botões e cabem tranquilamente sem precisar rolar. */
.fcd-view-toggle {
  gap: 6px;
  overflow: visible !important;
  width: auto !important;
  flex-shrink: 0;
}
.fcd-view-toggle :deep(.v-btn) {
  border-radius: 6px !important;
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
  background: radial-gradient(circle at 30% 25%, rgba(79, 182, 236, 0.28), rgba(0, 151, 215, 0.1) 70%);
  border: 2px solid rgba(79, 182, 236, 0.45);
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
  border-radius: 6px;
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
