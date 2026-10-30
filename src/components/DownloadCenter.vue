<template>
  <v-dialog v-model="dialog" max-width="1180" scrollable>
    <template v-slot:activator="{ props }">
      <slot :props="props" />
    </template>

    <div class="ah">
      <!-- ── Barra lateral (modelo AlbumHub) ───────────────────────────── -->
      <aside class="ah-side">
        <div class="ah-brand">
          <v-icon color="#009fe3" size="26" class="mr-2">mdi-floppy</v-icon>
          <span>{{ $t('components.download_center.brand_a') }} <span class="ah-brand-accent">{{ $t('components.download_center.brand_b') }}</span></span>
        </div>
        <div class="ah-brand-sub">{{ $t('components.download_center.brand_sub') }}</div>

        <button class="ah-nav" :class="{ active: isExplore }" @click="goTo('collections')">
          <v-icon size="18">mdi-view-grid-outline</v-icon>
          <span>{{ $t('components.download_center.nav_collections') }}</span>
        </button>
        <button class="ah-nav" :class="{ active: section === 'hymnals' }" @click="goTo('hymnals')">
          <v-icon size="18">mdi-music-note</v-icon>
          <span>{{ $t('components.download_center.nav_hymnals') }}</span>
        </button>
        <button class="ah-nav" :class="{ active: section === 'bibles' }" @click="goTo('bibles')">
          <v-icon size="18">mdi-book-open-variant</v-icon>
          <span>{{ $t('components.download_center.nav_bibles') }}</span>
        </button>
        <button class="ah-nav" :class="{ active: section === 'downloads' }" @click="goTo('downloads')">
          <v-icon size="18">mdi-download-circle-outline</v-icon>
          <span>{{ $t('components.download_center.downloads') }}</span>
        </button>
        <button class="ah-nav" :class="{ active: section === 'settings' }" @click="goTo('settings')">
          <v-icon size="18">mdi-cog-outline</v-icon>
          <span>{{ $t('components.download_center.settings') }}</span>
        </button>

        <!-- Cartão de espaço em disco (rodapé da barra lateral) -->
        <div v-if="storage" class="ah-storage">
          <div class="ah-storage-head"><v-icon size="18" color="#009fe3">mdi-harddisk</v-icon><b>{{ $t('components.download_center.storage_title') }}</b></div>
          <strong v-if="storage.disk">{{ fmtBytes(storage.disk.freeBytes) }}</strong>
          <div class="ah-progress"><span :style="{ width: diskUsedPct() + '%' }" /></div>
          <div class="ah-muted">{{ $t('components.download_center.storage_used', { used: fmtBytes(storage.usedBytes) }) }}</div>
        </div>
      </aside>

      <!-- ── Área principal ──────────────────────────────────────────────── -->
      <main class="ah-main">
        <header class="ah-top">
          <b>{{ section === 'downloads' ? $t('components.download_center.downloads')
            : section === 'settings' ? $t('components.download_center.settings')
            : section === 'hymnals' ? $t('components.download_center.nav_hymnals')
            : section === 'bibles' ? $t('components.download_center.nav_bibles')
            : $t('components.download_center.nav_collections') }}</b>
          <input
            v-if="isExplore"
            v-model="albumSearch"
            class="ah-search"
            :placeholder="$t('components.download_center.lib_search')"
          />
          <span class="ah-local">● {{ $t('components.download_center.local') }}</span>
          <v-btn icon="mdi-close" variant="text" size="small" density="compact" @click="dialog = false" />
        </header>

        <div class="ah-content">
          <div v-if="loading" class="ah-loading">
            <v-progress-circular indeterminate color="primary" size="40" />
          </div>

          <!-- EXPLORAR: coletâneas -->
          <section v-if="isExplore">
            <div class="ah-heading">{{ $t('components.download_center.nav_collections') }}</div>
            <div class="ah-muted">{{ $t('components.download_center.nav_collections_desc') }}</div>

            <div class="ah-chips">
              <button class="ah-chip" :class="{ active: catFilter === null }" @click="catFilter = null">
                {{ $t('components.download_center.all_collections') }} · {{ allAlbumsCount }}
              </button>
              <button
                v-for="cat in categories"
                :key="cat.id_category"
                class="ah-chip"
                :class="{ active: catFilter === cat.id_category }"
                @click="catFilter = cat.id_category"
              >{{ cat.name }} · {{ (cat.albums || []).length }}</button>
            </div>

            <div class="ah-toolbar">
              <b>{{ libraryAlbums.length }} {{ $t('components.download_center.lib_count') }}</b>
              <select v-model="albumStatus" class="ah-select">
                <option value="all">{{ $t('components.download_center.lib_status_all') }}</option>
                <option value="downloaded">{{ $t('components.download_center.lib_status_downloaded') }}</option>
                <option value="pending">{{ $t('components.download_center.lib_status_pending') }}</option>
              </select>
              <select v-model="albumSort" class="ah-select">
                <option value="recent">{{ $t('components.download_center.lib_sort_recent') }}</option>
                <option value="name">{{ $t('components.download_center.lib_sort_name') }}</option>
              </select>
              <div class="ah-view">
                <button :class="{ on: albumView === 'grid' }" @click="albumView = 'grid'"><v-icon size="16">mdi-view-grid-outline</v-icon></button>
                <button :class="{ on: albumView === 'list' }" @click="albumView = 'list'"><v-icon size="16">mdi-view-list</v-icon></button>
              </div>
              <button class="ah-btn-main" :disabled="!isElectron || !libraryPending" @click="downloadAllLibrary">
                <v-icon size="16">mdi-cloud-download-outline</v-icon>
                {{ $t('components.download_center.lib_download_all') }}
              </button>
            </div>

            <div :class="albumView === 'grid' ? 'ah-grid' : 'ah-rows'">
              <article v-for="album in libraryAlbums" :key="album.id_album" class="ah-album">
                <div class="ah-cover">
                  <img v-if="albumImageUrl(album)" :src="resolveUrl(albumImageUrl(album))" loading="lazy" />
                  <span v-else class="ah-cover-fallback">{{ (album.name || '').slice(0, 14) }}</span>
                  <div v-if="isAlbumComplete(album)" class="ah-badge-ok"><v-icon size="14">mdi-check</v-icon></div>
                </div>
                <div class="ah-album-body">
                  <div class="ah-album-title" :title="album.name">{{ album.name }}</div>
                  <div class="ah-muted ah-clamp">{{ albumSubtitle(album) }}</div>
                  <div class="ah-meta">
                    <span>{{ albumCategoryName(album) }}</span>
                    <span>{{ albumSizeLabel(album) }}</span>
                  </div>
                  <div class="ah-action">
                    <button
                      class="ah-btn-main"
                      :disabled="!!albumProgress[album.id_album]"
                      @click="downloadAlbumAny(album)"
                    >
                      <template v-if="albumProgress[album.id_album]">{{ albumProgress[album.id_album].percent }}%</template>
                      <template v-else>{{ isAlbumComplete(album) ? $t('components.download_center.lib_redownload') : $t('components.download_center.lib_download') }}</template>
                    </button>
                    <span class="ah-size">{{ albumSizeLabel(album) || albumSongsHint(album) }}</span>
                  </div>
                </div>
              </article>
              <div v-if="libraryAlbums.length === 0" class="ah-empty">{{ $t('components.download_center.lib_empty') }}</div>
            </div>
          </section>

          <!-- HINÁRIOS -->
          <section v-else-if="section === 'hymnals'">
            <div class="ah-heading">{{ $t('components.download_center.nav_hymnals') }}</div>
            <div class="ah-grid mt-3">
              <article v-for="h in hymnalItems" :key="h.file" class="ah-album">
                <div class="ah-cover ah-cover--logo">
                  <div v-if="h.coverSvg" class="ah-logo" v-html="h.coverSvg" />
                  <v-icon v-else size="56" :color="h.color">{{ h.icon }}</v-icon>
                  <div v-if="isDownloaded(h.file)" class="ah-badge-ok"><v-icon size="14">mdi-check</v-icon></div>
                </div>
                <div class="ah-album-body">
                  <div class="ah-album-title">{{ h.name }}</div>
                  <div class="ah-muted ah-clamp">{{ h.description }}</div>
                  <div v-if="folderBytes(h.folder)" class="ah-meta"><span>{{ fmtBytes(folderBytes(h.folder)) }}</span></div>
                  <button
                    v-if="!h.localOnly"
                    class="ah-btn-main ah-btn-block"
                    :disabled="!!downloading[h.file]"
                    @click="downloadFile(h.file)"
                  >{{ isDownloaded(h.file) ? $t('components.download_center.update') : $t('components.download_center.download') }}</button>
                </div>
              </article>
            </div>
          </section>

          <!-- BÍBLIAS -->
          <section v-else-if="section === 'bibles'">
            <div class="ah-heading">{{ $t('components.download_center.nav_bibles') }}</div>
            <div class="ah-grid mt-3">
              <article v-for="b in bibleItems" :key="b.id" class="ah-album">
                <div class="ah-cover ah-cover--logo">
                  <v-icon size="64" :color="b.color">mdi-book-open-variant</v-icon>
                  <div v-if="allDownloaded(b.files)" class="ah-badge-ok"><v-icon size="14">mdi-check</v-icon></div>
                </div>
                <div class="ah-album-body">
                  <div class="ah-album-title">{{ b.name }}</div>
                  <div class="ah-muted ah-clamp">{{ b.files.join(' + ') }}</div>
                  <button class="ah-btn-main ah-btn-block" :disabled="!!downloading[b.id]" @click="downloadMulti(b.id, b.files)">
                    {{ allDownloaded(b.files) ? $t('components.download_center.update') : $t('components.download_center.download') }}
                  </button>
                </div>
              </article>
            </div>
          </section>

          <!-- MEUS DOWNLOADS -->
          <section v-else-if="section === 'downloads'">
            <div class="ah-stats">
              <div class="ah-stat">
                <span class="ah-muted">{{ $t('components.download_center.stat_done') }}</span>
                <strong>{{ downloadedAlbums.length + downloadedHymnals.length + downloadedBibleSets.length }}</strong>
              </div>
              <div class="ah-stat">
                <span class="ah-muted">{{ $t('components.download_center.stat_queue') }}</span>
                <strong>{{ activeDownloads.length }}</strong>
              </div>
              <div class="ah-stat">
                <span class="ah-muted">{{ $t('components.download_center.stat_used') }}</span>
                <strong>{{ totalSize }}</strong>
              </div>
            </div>

            <div class="ah-panel mt-4">
              <b>{{ $t('components.download_center.in_progress') }}</b>
              <div v-if="activeDownloads.length === 0" class="ah-empty">{{ $t('components.download_center.no_active') }}</div>
              <div v-for="d in activeDownloads" :key="d.id" class="ah-item">
                <div class="ah-row-info">
                  <div class="ah-album-title">{{ d.name }}</div>
                  <div class="ah-progress"><span :style="{ width: d.percent + '%' }" /></div>
                  <div class="ah-muted">{{ d.message }} · {{ d.percent }}%</div>
                </div>
              </div>
            </div>

            <div class="ah-panel mt-4">
              <b>{{ $t('components.download_center.library') }}</b>
              <div v-if="localFiles.length === 0" class="ah-empty">{{ $t('components.download_center.no_downloads') }}</div>
              <div v-if="downloadedAlbums.length" class="ah-grid mt-3">
                <article v-for="album in downloadedAlbums" :key="album.id_album" class="ah-album">
                  <div class="ah-cover">
                    <img v-if="album.url_image" :src="resolveUrl(album.url_image)" loading="lazy" />
                    <span v-else class="ah-cover-fallback">{{ album.name }}</span>
                    <div class="ah-badge-ok" :class="{ warn: albumMissingCount(album.id_album) > 0 }">
                      <v-icon size="14">{{ albumMissingCount(album.id_album) > 0 ? 'mdi-alert' : 'mdi-check' }}</v-icon>
                    </div>
                  </div>
                  <div class="ah-album-body">
                    <div class="ah-album-title">{{ album.name }}</div>
                  </div>
                </article>
              </div>
              <div v-for="h in downloadedHymnals" :key="h.name" class="ah-item">
                <v-icon size="20" color="success">mdi-check-circle</v-icon>
                <span class="ah-row-info">{{ h.label }}</span>
              </div>
              <div v-for="b in downloadedBibleSets" :key="b.id" class="ah-item">
                <v-icon size="20" color="success">mdi-check-circle</v-icon>
                <span class="ah-row-info">{{ b.name }} · {{ formatSize(b.totalSize) }}</span>
              </div>
              <div v-for="f in downloadedOthers" :key="f.name" class="ah-item">
                <v-icon size="18" color="success">mdi-check-circle</v-icon>
                <span class="ah-row-info">{{ f.name }}</span>
                <span class="ah-muted">{{ formatSize(f.size) }}</span>
              </div>
            </div>
          </section>

          <!-- CONFIGURAÇÕES -->
          <section v-else-if="section === 'settings'">
            <div class="ah-heading">{{ $t('components.download_center.settings') }}</div>
            <div class="ah-muted">{{ $t('components.download_center.verify_desc') }}</div>

            <div class="ah-panel mt-4">
              <b>{{ $t('components.download_center.folders') }}</b>
              <div v-if="dbFolder" class="ah-item">
                <div class="ah-row-info">
                  <div class="ah-album-title">{{ $t('components.download_center.folder_db') }}</div>
                  <div class="ah-muted ah-path" :title="dbFolder">{{ dbFolder }}</div>
                </div>
                <button class="ah-btn-ghost" @click="$electron.shellOpenFolder(dbFolder)">{{ $t('components.download_center.open_folder') }}</button>
              </div>
              <div v-if="configFolder" class="ah-item">
                <div class="ah-row-info">
                  <div class="ah-album-title">{{ $t('components.download_center.folder_media') }}</div>
                  <div class="ah-muted ah-path" :title="configFolder">{{ configFolder }}</div>
                </div>
                <button class="ah-btn-ghost" @click="$electron.shellOpenFolder(configFolder)">{{ $t('components.download_center.open_folder') }}</button>
              </div>
            </div>

            <div class="ah-panel mt-4">
              <b>{{ $t('components.download_center.verify_title') }}</b>
              <div class="ah-muted">{{ $t('components.download_center.verify_desc') }}</div>
              <div class="ah-actions mt-3">
                <button class="ah-btn-ghost" :disabled="scanning || downloadingMissing" @click="runScanMissing">
                  {{ $t('components.download_center.verify_btn') }}
                </button>
                <button
                  v-if="scanResult && scanResult.total > 0 && !downloadingMissing"
                  class="ah-btn-main"
                  @click="confirmDialog = true"
                >{{ $t('components.download_center.download_missing_btn') }} ({{ scanResult.total }})</button>
              </div>
              <div v-if="scanResult && scanResult.total === 0" class="ah-muted mt-2">
                {{ $t('components.download_center.all_present') }}
              </div>
              <div v-if="downloadingMissing" class="mt-3">
                <div class="ah-muted">{{ missingProgress.message }} · {{ missingProgress.percent }}%</div>
                <div class="ah-progress"><span :style="{ width: missingProgress.percent + '%' }" /></div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>

    <!-- Diálogo: substituir arquivos do álbum? -->
    <v-dialog v-model="replaceDialog" max-width="440" persistent>
      <v-card rounded="lg" theme="dark">
        <v-card-title class="pt-5 px-5 pb-2 d-flex align-center">
          <v-icon color="warning" class="mr-2" size="22">mdi-refresh-circle</v-icon>
          {{ $t('components.download_center.replace_title') }}
        </v-card-title>
        <v-card-text class="px-5">
          <p class="text-body-2 mb-3">
            {{ $t('components.download_center.album_word') }} <b>{{ replaceAlbumTarget?.name }}</b> {{ $t('components.download_center.downloaded_before') }}
          </p>
          <p class="text-body-2">
            {{ $t('components.download_center.want') }} <b>{{ $t('components.download_center.replace_word') }}</b> {{ $t('components.download_center.replace_question') }}
          </p>
        </v-card-text>
        <v-card-actions class="px-5 pb-4">
          <v-btn variant="text" size="small" @click="replaceDialog = false; replaceAlbumTarget = null">{{ $t('components.download_center.cancel') }}</v-btn>
          <v-spacer />
          <v-btn variant="tonal" color="primary" size="small" prepend-icon="mdi-download" @click="onReplaceChoice(false)">
            {{ $t('components.download_center.download_missing_only') }}
          </v-btn>
          <v-btn variant="flat" color="warning" size="small" prepend-icon="mdi-refresh" @click="onReplaceChoice(true)">
            {{ $t('components.download_center.replace_all_btn') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Diálogo: confirmar download dos faltantes -->
    <v-dialog v-model="confirmDialog" max-width="460" persistent>
      <v-card rounded="lg" theme="dark">
        <v-card-title class="pt-5 px-5 pb-2 d-flex align-center">
          <v-icon color="warning" class="mr-2" size="22">mdi-download-circle</v-icon>
          {{ $t('components.download_center.download_missing_title') }}
        </v-card-title>
        <v-card-text class="px-5">
          <p class="text-body-2 mb-4">
            {{ $t('components.download_center.found_label') }} <b>{{ scanResult && scanResult.total }}</b>
            {{ $t('components.download_center.missing_question') }}
          </p>
          <v-alert type="info" variant="tonal" density="compact" class="mt-4">
            <div class="text-caption">
              {{ $t('components.download_center.saved_in') }}
              <span class="font-weight-medium" style="word-break:break-all">{{ configFolder || 'config/' }}</span>
            </div>
          </v-alert>
        </v-card-text>
        <v-card-actions class="px-5 pb-4">
          <v-spacer />
          <v-btn variant="text" size="small" @click="confirmDialog = false">{{ $t('components.download_center.cancel') }}</v-btn>
          <v-btn color="primary" variant="flat" size="small" prepend-icon="mdi-download" @click="startMissingDownload">
            {{ $t('components.download_center.download_now') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script>
import $database from '@/helpers/Database';
import $storage from '@/helpers/Storage';
import hasdFlame from '@/assets/imgs/hasd-flame.svg';
import hymnalLogoRaw from '@/assets/imgs/hymnal-logo.svg?raw';
// Sem as dimensões físicas (mm) e sem o <style> próprio: o tamanho e a cor vêm do CSS do tema.
const hymnalLogoSvg = hymnalLogoRaw
  .replace(/<metadata[\s\S]*?<\/metadata>/g, '')
  .replace(/<title>[\s\S]*?<\/title>/g, '')
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/\s(width|height)="[^"]*"/g, '');

// Capa dos hinários: símbolo da Igreja Adventista (SVG local, embutido no app),
// substituindo o antigo /covers/hasd.bmp que dependia do CDN remoto.
const DC = 'components.download_center.';

export default {
  name: 'DownloadCenter',

  props: {
    modelValue:     { type: Boolean, default: false },
    initialSection: { type: String,  default: 'home' },
  },

  emits: ['update:modelValue'],

  watch: {
    modelValue(v) { this.dialog = v; },
    dialog(v) {
      this.$emit('update:modelValue', v);
      this.onToggle(v);
    },
    // Navega para a seção solicitada mesmo se o dialog já estava aberto
    initialSection(s) {
      if (this.dialog && s && s !== 'home') {
        this.goTo(s);
      }
    },
  },

  data: () => ({
    dialog:        false,
    section:       'home',
    loading:       false,
    storage:       null,
    categories:    [],
    catFilter:     null,
    albumSearch:   '',
    albumSort:     'recent',
    albumStatus:   'all',
    albumEstimates: {},
    albumView:     'grid',
    selectedAlbumId: null,
    localFiles:    [],
    downloading:   {},
    albumProgress: {},
    albumStats:    {},
    _progressHandler: null,
    // Configurações
    clearing: false,
    // Verificação de arquivos
    scanning:              false,
    scanResult:            null,
    confirmDialog:         false,
    downloadingMissing:    false,
    missingProgress:       { percent: 0, message: '' },
    _missingProgressHandler: null,
    // Dialog de substituição de álbum
    replaceDialog:         false,
    replaceAlbumTarget:    null,
    // Infos dos álbuns baixados (id_album -> {name, url_image})
    downloadedAlbumInfos:  {},
    // Completude real dos álbuns da aba Coletâneas (id_album -> {missing, totalFiles}),
    // verificada no disco — inclui álbuns nunca baixados pelo app (ex: já
    // completos por virem da instalação legada do LouvorJA Delphi)
    albumCompleteStatus:   {},
    // Completude real dos álbuns baixados (id_album -> {missing, totalFiles}),
    // obtida verificando os arquivos no disco — não apenas se o JSON existe
    downloadedAlbumStatus: {},
    // Caminhos das pastas locais
    dbFolder:     '',
    configFolder: '',
  }),

  computed: {
    navItems() {
      const t = (k) => this.$t(DC + k);
      return [
        { section: 'home',        icon: 'mdi-home-outline',       label: t('nav_home') },
        { section: 'hymnals',     icon: 'mdi-music-note',         label: t('nav_hymnals'),     description: t('nav_hymnals_desc'),     color: '#1565C0' },
        { section: 'collections', icon: 'mdi-music-box-multiple', label: t('nav_collections'), description: t('nav_collections_desc'), color: '#2E7D32' },
        { section: 'bibles',      icon: 'mdi-book-open-variant',  label: t('nav_bibles'),      description: t('nav_bibles_desc'),      color: '#EF6C00' },
      ];
    },
    // Hinário espanhol é só local (ver scripts/import-hinario-es.mjs): não tem
    // download pela API, então o card só mostra o que já está no disco.
    hymnalItems() {
      const t = (k) => this.$t(DC + k);
      const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
      if (locale === 'es') {
        return [{ file: 'es_hymnal', name: t('hymnal_es'), description: t('hymnal_es_desc'), cover: hasdFlame, coverSvg: hymnalLogoSvg, icon: 'mdi-music-note', color: '#1B5E43', localOnly: true, folder: 'Himnario Adventista' }];
      }
      return [
        { file: 'pt_hymnal',      name: t('hymnal_2022'), description: t('hymnal_2022_desc'), cover: hasdFlame, coverSvg: hymnalLogoSvg, icon: 'mdi-music-note',         color: '#1B5E43' },
        { file: 'pt_hymnal_1996', name: t('hymnal_1996'), description: t('hymnal_1996_desc'), cover: hasdFlame, coverSvg: hymnalLogoSvg, icon: 'mdi-music-note-outline', color: '#1B5E43' },
      ];
    },
    bibleItems() {
      return [
        { id: 'bible_pt', name: this.$t(DC + 'bible_pt'), files: ['pt_bible_book', 'pt_bible_version'], color: 'green' },
        { id: 'bible_es', name: this.$t(DC + 'bible_es'), files: ['es_bible_book', 'es_bible_version'], color: 'orange' },
      ];
    },
    isElectron() {
      return this.$electron.isElectron();
    },

    // Total de coletâneas distintas (a aba "Todas" conta cada uma uma vez).
    allAlbumsCount() {
      const ids = new Set();
      for (const cat of this.categories || []) for (const a of cat.albums || []) ids.add(a.id_album);
      return ids.size;
    },
    // Lista da coluna central: categoria escolhida + busca + ordenação.
    libraryAlbums() {
      const q = this.albumSearch.trim().toLowerCase();
      let list = this.filteredAlbums.slice();
      if (q) list = list.filter(a => (a.name || '').toLowerCase().includes(q));
      if (this.albumStatus === 'downloaded') list = list.filter(a => this.isAlbumComplete(a));
      if (this.albumStatus === 'pending') list = list.filter(a => !this.isAlbumComplete(a));
      if (this.albumSort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
      else list.sort((a, b) => (b.id_album || 0) - (a.id_album || 0));
      return list;
    },
    selectedAlbum() {
      const list = this.libraryAlbums;
      return list.find(a => a.id_album === this.selectedAlbumId) || list[0] || null;
    },
    libraryPending() {
      return this.libraryAlbums.some(a => !this.isAlbumComplete(a));
    },

    filteredAlbums() {
      if (!this.categories.length) return [];
      if (this.catFilter === null) {
        const seen = new Set();
        const list = [];
        for (const cat of this.categories) {
          for (const album of (cat.albums || [])) {
            if (!seen.has(album.id_album)) { seen.add(album.id_album); list.push(album); }
          }
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
      }
      const cat = this.categories.find(c => c.id_category === this.catFilter);
      return (cat?.albums || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },

    userFiles() {
      // Exclui arquivos gerados automaticamente pelo sistema (não são downloads do usuário)
      return this.localFiles.filter(f => !this._isSystemFile(f.name));
    },

    // Explorar (coletâneas): também é a tela inicial da seção.
    isExplore() {
      return this.section === 'collections' || this.section === 'home';
    },
    // Coletâneas em download agora (vem do albumProgress que o download já atualiza).
    activeDownloads() {
      return Object.entries(this.albumProgress).map(([id, p]) => ({
        id,
        name: this.albumNameById(id),
        percent: p.percent || 0,
        message: p.message || '',
      }));
    },

    totalSize() {
      const t = this.userFiles.reduce((s, f) => s + (f.size || 0), 0);
      return this.formatSize(t);
    },

    downloadedAlbums() {
      return this.localFiles
        .filter(f => f.name.startsWith('album_'))
        .map(f => {
          const id = f.name.replace('album_', '');
          const info = this.downloadedAlbumInfos[id] || {};
          return { id_album: id, name: info.name || f.name, url_image: info.url_image || '', size: f.size };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    downloadedHymnals() {
      const map = Object.fromEntries(this.hymnalItems.map(h => [h.file, h]));
      return this.localFiles
        .filter(f => map[f.name])
        .map(f => ({ ...f, label: map[f.name].name, icon: map[f.name].icon, color: map[f.name].color, cover: map[f.name].cover || '' }));
    },

    downloadedBibleSets() {
      const sizeMap = Object.fromEntries(this.localFiles.map(f => [f.name, f.size || 0]));
      const downloaded = new Set(this.localFiles.map(f => f.name));
      return this.bibleItems
        .filter(b => b.files.some(f => downloaded.has(f)))
        .map(b => ({ ...b, totalSize: b.files.reduce((s, f) => s + (sizeMap[f] || 0), 0) }));
    },

    downloadedOthers() {
      const known = new Set([
        'pt_hymnal', 'pt_hymnal_1996', 'es_hymnal',
        ...this.bibleItems.flatMap(b => b.files),
      ]);
      return this.userFiles.filter(f =>
        !f.name.startsWith('album_') &&
        !f.name.startsWith('music_') &&
        !known.has(f.name)
      );
    },
  },

  methods: {
    _isSystemFile(name) {
      // Arquivos gerados automaticamente — índice de músicas/categorias por locale
      // e cache individual de músicas. Não representam downloads do usuário.
      return /_(musics|categories)$/.test(name) || name.startsWith('music_');
    },

    onToggle(open) {
      if (open) {
        // Usa a seção solicitada (ex: 'collections' quando vem do botão do álbum)
        if (this.initialSection && this.initialSection !== 'home') {
          this.section = this.initialSection;
        }
        this.init();
        this.subscribeProgress();
      } else {
        this.section = 'home';
        this.unsubscribeProgress();
        this.unsubscribeMissingProgress();
      }
    },

    async init() {
      await this.loadLocalFiles();
      this.loadStorage();
      if (this.section === 'collections') {
        await this.loadCategories();
        this.loadStorage();
        await this.loadDownloadedAlbumInfos();
        this.loadCollectionsCompleteStatus();
      }
      if (this.section === 'downloads') {
        await this.loadDownloadedAlbumInfos();
        this.loadDownloadedAlbumsStatus();
      }
      if (this.section === 'settings') await this.loadFolderPaths();
    },

    async goTo(s) {
      this.section = s;
      this.loadStorage();
      if (s === 'collections') {
        if (this.categories.length === 0) {
          await this.loadCategories();
          this.loadStorage();
        }
        await this.loadDownloadedAlbumInfos();
        this.loadCollectionsCompleteStatus();
      }
      if (s === 'downloads') {
        await this.loadLocalFiles();
        await this.loadDownloadedAlbumInfos();
        this.loadDownloadedAlbumsStatus();
      }
      if (s === 'settings') {
        await this.loadLocalFiles();
        await this.loadFolderPaths();
      }
    },

    async loadCategories() {
      this.loading = true;
      const locale = this.$i18n?.locale?.value ?? this.$i18n?.locale ?? 'pt';
      this.categories = await this.fetchCatalog(`${locale}_categories`) || [];
      this.loadAlbumEstimates();
      this.loading = false;
    },

    // Busca o catálogo de coletâneas para navegação/download. Diferente de $database.get,
    // não respeita o Modo Offline: o Centro de Downloads precisa listar tudo que existe
    // (mesmo o que ainda não foi baixado) para o usuário escolher o que baixar. Se não
    // houver conexão, cai para o índice salvo localmente em downloads anteriores.
    async fetchCatalog(file) {
      const cache_name = `db:${file}`;
      const cached = $storage.get(cache_name, null, 'session');
      if (cached) return cached;

      try {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const url = `${this.$path.db(`/${file}`)}?${date}`;
        const response = await fetch(url, { headers: { 'Api-Token': import.meta.env.VITE_API_TOKEN } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        $storage.set(cache_name, data, 'session');
        this.$electron.dbLocalSave(file, data).catch(() => {});
        return data;
      } catch (e) {
        if (this.$electron.isElectron()) {
          try {
            const local = await this.$electron.dbLocalGet(file);
            if (local) return local;
          } catch (_) {}
        }
        return null;
      }
    },

    async loadLocalFiles() {
      this.localFiles = await this.$electron.dbLocalList() || [];
    },

    async loadFolderPaths() {
      if (!this.isElectron) return;
      this.dbFolder     = await this.$electron.dbGetActualDir() || '';
      this.configFolder = await this.$electron.configGetDir()   || '';
    },

    async loadDownloadedAlbumInfos() {
      const albumFiles = this.localFiles.filter(f => f.name.startsWith('album_'));
      if (!albumFiles.length) { this.downloadedAlbumInfos = {}; return; }

      // Garante que as categories estão carregadas para complementar dados ausentes
      if (!this.categories.length) await this.loadCategories();

      const infos = {};
      for (const f of albumFiles) {
        const id = f.name.replace('album_', '');
        let found = null;

        // 1. Lê do JSON local primeiro — após o download, a capa já foi convertida
        //    para app-local://, funcionando sem internet. Usar a categoria (URL
        //    online) aqui faria a capa sumir no Modo Offline sem conexão real.
        try {
          const data = await this.$electron.dbLocalGet(f.name);
          if (data) found = { name: data.name || '', url_image: data.url_image || '' };
        } catch { /* segue para o fallback abaixo */ }

        // 2. Complementa com as categories (fonte online) só o que faltar
        if (!found?.name || !found?.url_image) {
          for (const cat of this.categories) {
            const album = (cat.albums || []).find(a => String(a.id_album) === String(id));
            if (album) {
              found = {
                name:      found?.name      || album.name,
                url_image: found?.url_image || album.url_image || '',
              };
              break;
            }
          }
        }

        infos[id] = found?.name ? found : { name: f.name, url_image: found?.url_image || '' };
      }
      this.downloadedAlbumInfos = infos;
    },

    // Verifica no disco se os álbuns baixados estão realmente completos (áudio,
    // capas e imagens presentes) — sem isso, "Meus Downloads" mostrava sempre
    // "completo" só porque o JSON do álbum existe, mesmo com arquivos faltando.
    async loadDownloadedAlbumsStatus() {
      if (!this.isElectron) return;
      const ids = this.downloadedAlbums.map(a => a.id_album);
      if (!ids.length) { this.downloadedAlbumStatus = {}; return; }
      try {
        const result = await this.$electron.checkAlbumsComplete(ids);
        const map = {};
        for (const id of ids) {
          const st = result?.[String(id)];
          if (st) map[String(id)] = { missing: st.missing || 0, totalFiles: st.totalFiles || 0 };
        }
        this.downloadedAlbumStatus = map;
      } catch (_) {
        // Sem informação nova — mantém o estado anterior (badges neutras)
      }
    },

    // Retorna a quantidade de arquivos em falta de um álbum baixado, ou null
    // quando a verificação ainda não rodou (status desconhecido).
    albumMissingCount(id_album) {
      const st = this.downloadedAlbumStatus[String(id_album)];
      return st ? st.missing : null;
    },

    // Verifica no disco a completude real dos álbuns exibidos na aba Coletâneas
    // (áudio, capa e imagens) — sem isso, o check "OK" só aparecia para álbuns
    // já baixados pelo app, mesmo quando os arquivos já existiam localmente
    // (ex: instalação legada do LouvorJA Delphi). Roda em background: não
    // bloqueia a renderização da grade de álbuns.
    async loadCollectionsCompleteStatus() {
      if (!this.isElectron) return;
      const ids = this.filteredAlbums.map(a => a.id_album);
      if (!ids.length) return;
      try {
        const result = await this.$electron.checkAlbumsComplete(ids);
        const map = { ...this.albumCompleteStatus };
        for (const id of ids) {
          const st = result?.[String(id)];
          if (st) map[String(id)] = { missing: st.missing || 0, totalFiles: st.totalFiles || 0 };
        }
        this.albumCompleteStatus = map;
      } catch (_) {
        // Sem informação nova — mantém o estado anterior
      }
    },

    // Espaço da biblioteca: pastas do hinário e dos álbuns carregados (ver electron/ipc.js#library:storage).
    async loadStorage() {
      const folders = new Set(['Himnario Adventista']);
      for (const cat of this.categories || []) {
        for (const album of cat.albums || []) folders.add(album.folder_name || album.name);
      }
      try {
        this.storage = await this.$electron.libraryStorage([...folders]);
      } catch (_) {
        this.storage = null;
      }
    },
    // Percentual do disco ocupado (barra da pílula de espaço).
    diskUsedPct() {
      const d = this.storage?.disk;
      if (!d || !d.totalBytes) return 0;
      return Math.min(100, ((d.totalBytes - d.freeBytes) / d.totalBytes) * 100);
    },
    // Antes de baixar o servidor não publica o tamanho: mostra a quantidade de músicas.
    albumSongsHint(album) {
      const n = (album.songCount ?? null);
      return n ? `${n} ${this.$t('components.download_center.lib_songs').toLowerCase()}` : '—';
    },
    // Tamanho estimado (o servidor não publica o peso): duração das músicas × ~30 KB/s
    // (cantado + playback, medido nos arquivos do hinário). Só enquanto não está baixada.
    async loadAlbumEstimates() {
      const seen = new Set();
      const todo = (this.categories || []).flatMap(c => c.albums || []).filter(a => {
        if (seen.has(a.id_album) || this.albumEstimates[a.id_album]) return false;
        seen.add(a.id_album);
        return true;
      });
      const origin = new URL(import.meta.env.VITE_URL_DATABASE).origin;
      const headers = import.meta.env.VITE_API_TOKEN ? { 'Api-Token': import.meta.env.VITE_API_TOKEN } : {};
      let next = 0;
      const worker = async () => {
        while (next < todo.length) {
          const album = todo[next++];
          try {
            const resp = await fetch(`${origin}/db/album_${album.id_album}`, { headers });
            if (!resp.ok) continue;
            const body = await resp.json();
            const musics = (body.data || body).musics || [];
            const secs = musics.reduce((sum, m) => sum + this.hmsSeconds(m.duration), 0);
            this.albumEstimates = { ...this.albumEstimates, [album.id_album]: secs * 30000 };
          } catch (_) { /* sem estimativa para este álbum */ }
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
    },
    hmsSeconds(hms) {
      const [h = 0, m = 0, sec = 0] = String(hms || '').split(':').map(Number);
      return h * 3600 + m * 60 + sec;
    },
    albumNameById(id) {
      for (const cat of this.categories || []) {
        const album = (cat.albums || []).find(a => String(a.id_album) === String(id));
        if (album) return album.name;
      }
      return `#${id}`;
    },
    folderBytes(name) {
      return name && this.storage?.perFolder ? this.storage.perFolder[name] || 0 : 0;
    },
    fmtBytes(bytes) {
      if (!bytes || bytes <= 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
      return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
    },

    isDownloaded(filename) {
      return this.localFiles.some(f => f.name === filename);
    },

    allDownloaded(files) {
      return files.every(f => this.isDownloaded(f));
    },

    isAlbumFullyDownloaded(album) {
      return this.isDownloaded(`album_${album.id_album}`);
    },

    // Completude "real" de um álbum na grade de Coletâneas: usa a verificação
    // de disco quando disponível (cobre álbuns nunca baixados pelo app, mas já
    // completos localmente); enquanto isso não chega, cai para o critério
    // anterior (JSON do álbum já baixado pelo app) para não deixar a badge em
    // branco durante o carregamento.
    isAlbumComplete(album) {
      const st = this.albumCompleteStatus[String(album.id_album)];
      if (st) return st.missing === 0;
      return this.isAlbumFullyDownloaded(album);
    },

    // Capa a exibir para um álbum na grade de Coletâneas: se já foi baixado,
    // usa a capa do JSON local (app-local://, funciona sem internet). Só cai
    // para a URL online (categories) quando o álbum ainda não foi baixado.
    albumSubtitle(album) {
      return album.description || album.subtitle || '';
    },
    albumCategoryName(album) {
      const cat = (this.categories || []).find(c => (c.albums || []).some(a => a.id_album === album.id_album));
      return cat ? cat.name : '—';
    },
    albumSongCount(album) {
      const s = this.albumStats[album.id_album];
      return s ? s.json : '—';
    },
    albumSizeLabel(album) {
      const bytes = this.folderBytes(album.folder_name || album.name);
      if (bytes) return this.fmtBytes(bytes);
      const est = this.albumEstimates[album.id_album];
      return est ? `≈ ${this.fmtBytes(est)}` : '';
    },
    // Baixa, em sequência, só as coletâneas da lista atual que ainda faltam.
    async downloadAllLibrary() {
      for (const album of this.libraryAlbums) {
        if (!this.isAlbumComplete(album)) await this.downloadAlbumFull(album, false);
      }
    },

    albumImageUrl(album) {
      const local = this.downloadedAlbumInfos[String(album.id_album)];
      if (local?.url_image) return local.url_image;
      return album.url_image || '';
    },

    resolveUrl(url) {
      if (!url) return '';
      // Já é URL absoluta (file://, http://, https://) → usa direto
      if (url.startsWith('file://') || url.startsWith('app-local://') || url.startsWith('http://') || url.startsWith('https://')) return url;
      // URL relativa (ex: /covers/2026.bmp da API):
      // Se tiver arquivo local em cache (capas), a syncLocalFileUrls já teria substituído.
      // Fallback: resolve contra VITE_URL_FILES para acesso online.
      return this.$path.file(url);
    },

    // ── Downloads simples ────────────────────────────────────────────────────
    async downloadFile(filename) {
      this.downloading = { ...this.downloading, [filename]: true };
      try {
        const ok = await $database.download(filename);
        if (!ok) this.$alert?.error?.({ text: this.$t('components.download_center.fail_download_file', { filename }), translate: false });
        await this.loadLocalFiles();
      } catch (e) {
        this.$alert?.error?.({ text: String(e), translate: false });
      } finally {
        this.downloading = { ...this.downloading, [filename]: false };
      }
    },

    async downloadMulti(key, files) {
      this.downloading = { ...this.downloading, [key]: true };
      try {
        const failed = [];
        for (const f of files) {
          if (!await $database.download(f)) failed.push(f);
        }
        await this.loadLocalFiles();
        if (failed.length) this.$alert?.error?.({ text: this.$t('components.download_center.fail_download_list', { files: failed.join(', ') }), translate: false });
      } catch (e) {
        this.$alert?.error?.({ text: String(e), translate: false });
      } finally {
        this.downloading = { ...this.downloading, [key]: false };
      }
    },

    // ── Downloads de álbum ────────────────────────────────────────────────────
    downloadAlbumAny(album) {
      if (!this.$electron.isElectron()) return this.downloadAlbumBrowser(album);
      // Se álbum já baixado, pergunta se deseja substituir
      if (this.isAlbumFullyDownloaded(album)) {
        this.replaceAlbumTarget = album;
        this.replaceDialog = true;
        return;
      }
      return this.downloadAlbumFull(album, false);
    },

    onReplaceChoice(overwrite) {
      this.replaceDialog = false;
      const album = this.replaceAlbumTarget;
      this.replaceAlbumTarget = null;
      if (album) this.downloadAlbumFull(album, overwrite);
    },

    async downloadAlbumBrowser(album) {
      const id = album.id_album;
      const setProgress = (percent, message) => {
        this.albumProgress = { ...this.albumProgress, [id]: { percent, message } };
      };
      setProgress(0, this.$t('components.download_center.downloading_album_data'));
      const statsLocal = { json: 0, audio: 0, images: 0 };

      try {
        const okAlbum = await $database.download(`album_${id}`);
        if (!okAlbum) throw new Error(this.$t('components.download_center.fail_album', { name: album.name }));
        statsLocal.json++;

        const albumData  = await this.$electron.dbLocalGet(`album_${id}`);
        const musics     = albumData?.musics || [];
        const hasCover   = !!albumData?.url_image;
        const grandTotal = 1 + (hasCover ? 1 : 0) + musics.length;
        let done = 1;

        setProgress(Math.round((done / grandTotal) * 100),
          hasCover ? this.$t('components.download_center.downloading_cover') : this.$t('components.download_center.downloading_songs', { count: musics.length }));

        if (albumData.url_image) {
          await this._cacheUrl(this.resolveUrl(albumData.url_image));
          statsLocal.images++;
          done++;
          setProgress(Math.round((done / grandTotal) * 100), this.$t('components.download_center.downloading_songs', { count: musics.length }));
        }

        for (let i = 0; i < musics.length; i++) {
          const m = musics[i];
          setProgress(Math.round((done / grandTotal) * 100),
            `[${i + 1}/${musics.length}] ${m.name || this.$t('components.download_center.song')}`);

          const okMusic = await $database.download(`music_${m.id_music}`);
          if (okMusic) {
            statsLocal.json++;
            const md = await this.$electron.dbLocalGet(`music_${m.id_music}`);
            const slideList = Array.isArray(md?.slides) ? md.slides
              : (md?.lyric && typeof md.lyric === 'object' ? Object.values(md.lyric) : []);
            const allImgs = [md?.url_image, ...slideList.map(s => s?.url_image)].filter(Boolean);
            for (const raw of allImgs) {
              await this._cacheUrl(this.resolveUrl(raw));
              statsLocal.images++;
            }
          }
          done++;
        }

        this.albumStats = { ...this.albumStats, [id]: statsLocal };
        await this.loadLocalFiles();
      } catch (e) {
        this.$alert?.error?.({ text: String(e), translate: false });
      } finally {
        const p = { ...this.albumProgress };
        delete p[id];
        this.albumProgress = p;
      }
    },

    async _cacheUrl(url) {
      if (!url || !('caches' in window)) return;
      try {
        const cache = await caches.open('louvorja-media');
        if (await cache.match(url)) return;
        const resp = await fetch(url);
        if (resp.ok) await cache.put(url, resp);
      } catch {}
    },

    async downloadAlbumFull(album, overwrite = false) {
      const id = album.id_album;
      this.albumProgress = { ...this.albumProgress, [id]: { percent: 0, message: this.$t('components.download_center.starting') } };
      try {
        const result = await this.$electron.albumDownloadFull(
          id,
          import.meta.env.VITE_URL_DATABASE,
          import.meta.env.VITE_URL_FILES,
          import.meta.env.VITE_API_TOKEN,
          overwrite,
        );
        if (result.success) {
          const s = result.stats || {};
          this.albumStats = { ...this.albumStats, [id]: s };
          // Recarrega do JSON local (não das categories online) para que a capa
          // já convertida para app-local:// pelo download seja exibida
          await this.loadLocalFiles();
          await this.loadDownloadedAlbumInfos();
          if ((s.skipped || 0) > 0 && !overwrite) {
            this.$alert?.info?.({
              text: this.$t('components.download_center.skipped_files', { count: s.skipped }),
              translate: false,
            });
          }
        } else {
          this.$alert?.error?.({
            text: this.$t('components.download_center.fail_album_result', { name: album.name, error: result.error || this.$t('components.download_center.unknown_error') }),
            translate: false,
          });
          await this.loadLocalFiles();
        }
      } catch (e) {
        this.$alert?.error?.({ text: String(e), translate: false });
      } finally {
        const p = { ...this.albumProgress };
        delete p[id];
        this.albumProgress = p;
      }
    },

    // ── Progresso do download de álbum ───────────────────────────────────────
    subscribeProgress() {
      if (this._progressHandler) return;
      this._progressHandler = this.$electron.on('album:download-progress', (data) => {
        const { albumId, step, total, current, message } = data;
        if (step === 'done') {
          const p = { ...this.albumProgress };
          delete p[albumId];
          this.albumProgress = p;
          return;
        }
        const percent = total > 0 ? Math.min(99, Math.round((current / total) * 100)) : 0;
        this.albumProgress = { ...this.albumProgress, [albumId]: { percent, message } };
      });
    },

    unsubscribeProgress() {
      if (this._progressHandler) {
        this.$electron.off('album:download-progress', this._progressHandler);
        this._progressHandler = null;
      }
    },

    // ── Verificação e download de arquivos em falta ──────────────────────────
    async runScanMissing() {
      if (!this.isElectron) return;
      this.scanning   = true;
      this.scanResult = null;
      try {
        const raw = await this.$electron.scanMissingFiles();
        // Store as plain object so Vue reactivity doesn't wrap nested items in Proxy
        this.scanResult = raw ? JSON.parse(JSON.stringify(raw)) : null;
        // Reconcilia "Meus Downloads" com o que o verificador encontrou de fato no
        // disco — sem isso, um álbum que o verificador confirma como OK podia
        // continuar marcado como "faltando" na outra aba, por ter sido calculado
        // separadamente (e antes) por checkAlbumsComplete.
        await this.loadDownloadedAlbumsStatus();
      } catch (e) {
        this.$alert?.error?.({ text: String(e), translate: false });
      } finally {
        this.scanning = false;
      }
    },

    async startMissingDownload() {
      this.confirmDialog = false;
      if (!this.scanResult?.missing?.length) return;

      this.downloadingMissing = true;
      this.missingProgress    = { percent: 0, message: this.$t('components.download_center.starting') };
      this.subscribeMissingProgress();

      try {
        // JSON round-trip strips Vue reactive Proxies — IPC structured clone requires plain objects
        const plainList = JSON.parse(JSON.stringify(this.scanResult.missing));
        const result = await this.$electron.downloadMissingFiles(
          plainList,
          import.meta.env.VITE_URL_FILES,
          import.meta.env.VITE_API_TOKEN,
        );
        if (result.success) {
          this.scanResult = null;
          await this.loadLocalFiles();
          await this.loadDownloadedAlbumsStatus();
        } else {
          this.$alert?.error?.({ text: result.error || this.$t('components.download_center.download_files_error'), translate: false });
        }
      } catch (e) {
        this.$alert?.error?.({ text: String(e), translate: false });
      } finally {
        this.downloadingMissing = false;
        this.missingProgress    = { percent: 0, message: '' };
        this.unsubscribeMissingProgress();
      }
    },

    subscribeMissingProgress() {
      if (this._missingProgressHandler) return;
      this._missingProgressHandler = this.$electron.on('files:download-progress', (data) => {
        const { current, total, message } = data;
        const percent = total > 0 ? Math.min(99, Math.round((current / total) * 100)) : 0;
        this.missingProgress = { percent, message };
      });
    },

    unsubscribeMissingProgress() {
      if (this._missingProgressHandler) {
        this.$electron.off('files:download-progress', this._missingProgressHandler);
        this._missingProgressHandler = null;
      }
    },

    // ── Utilitários ──────────────────────────────────────────────────────────
    async deleteFile(filename) {
      await this.$electron.dbLocalDelete(filename);
      await this.loadLocalFiles();
      if (this.section === 'downloads') await this.loadDownloadedAlbumInfos();
    },

    async deleteFiles(filenames) {
      for (const name of filenames) {
        if (this.localFiles.some(f => f.name === name)) {
          await this.$electron.dbLocalDelete(name);
        }
      }
      await this.loadLocalFiles();
      if (this.section === 'downloads') await this.loadDownloadedAlbumInfos();
    },

    async clearAll() {
      this.clearing = true;
      try {
        await this.$electron.dbLocalClear();
        await this.loadLocalFiles();
      } finally {
        this.clearing = false;
      }
    },

    formatSize(bytes) {
      if (!bytes) return '0 B';
      const kb = bytes / 1024;
      if (kb < 1024) return `${kb.toFixed(1)} KB`;
      return `${(kb / 1024).toFixed(1)} MB`;
    },

    scrollTabs(delta) {
      const el = this.$refs.tabsEl;
      if (el) el.scrollLeft += delta;
    },
  },

  beforeUnmount() {
    this.unsubscribeProgress();
    this.unsubscribeMissingProgress();
  },
};
</script>

<style scoped>
/* Centro de downloads no modelo do protótipo AlbumHub. */
.ah {
  --bg: #0b1420;
  --side: #0d1828;
  --panel: #101c2e;
  --card: #13213a;
  --line: #1b2f48;
  --muted: #91a9c6;
  --accent: #009fe3;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  height: 720px;
  background: var(--bg);
  color: #eef4ff;
  font-size: 14px;
  overflow: hidden;
  border-radius: 12px;
}
.ah-side {
  background: var(--side);
  border-right: 1px solid #1b2f48;
  padding: 20px 13px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.ah-brand { display: flex; align-items: center; font-size: 22px; font-weight: 800; padding: 4px 8px 20px; letter-spacing: -0.5px; }
.ah-brand-accent { color: #009fe3; }
.ah-rows .ah-album { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 14px; align-items: center; padding: 10px 14px; }
.ah-rows .ah-cover { width: 64px; margin: 0; }
.ah-rows .ah-album-body { min-width: 0; }
.ah-rows .ah-meta { justify-content: flex-start; gap: 16px; }
.ah-rows .ah-action { margin-top: 8px; }
.ah-brand-sub { font-size: 11px; font-weight: 400; color: var(--muted); letter-spacing: 0; margin: -14px 0 18px 8px; }
.ah-nav {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 12px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #a9bdd8;
  width: 100%;
  text-align: left;
  cursor: pointer;
}
.ah-nav:hover { background: #192c43; }
.ah-nav.active { background: #0f2a40; color: var(--accent); border-left: 3px solid var(--accent); }
.ah-storage {
  margin-top: auto;
  background: var(--card);
  border: 1px solid #1f3550;
  border-radius: 10px;
  padding: 9px 11px;
}
.ah-storage-head { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.ah-action { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
.ah-action .ah-btn-main { flex-shrink: 0; }
.ah-size { font-size: 12px; color: var(--muted); white-space: nowrap; }
.ah-storage strong { display: block; font-size: 14px; margin: 4px 0 0; }
.ah-muted { color: var(--muted); font-size: 12px; }
.ah-progress { height: 7px; background: #243b55; border-radius: 10px; overflow: hidden; margin: 10px 0; }
.ah-progress span { display: block; height: 100%; background: var(--accent); border-radius: 10px; transition: width 0.3s; }

.ah-main { min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.ah-top {
  height: 66px;
  border-bottom: 1px solid #1b2f48;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 22px;
  flex-shrink: 0;
}
.ah-top > b { font-size: 15px; white-space: nowrap; }
.ah-search {
  flex: 1;
  max-width: 480px;
  background: #10253e;
  border: 1px solid #1f3550;
  border-radius: 9px;
  padding: 10px 14px;
  color: white;
  outline: none;
}
.ah-local { margin-left: auto; color: var(--muted); font-size: 12px; white-space: nowrap; }
.ah-content { padding: 22px; overflow-y: auto; flex: 1; min-height: 0; position: relative; }
.ah-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(7,20,38,0.6); z-index: 2; }
.ah-heading { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
.ah-chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; }
.ah-chip {
  padding: 7px 14px;
  border-radius: 22px;
  background: #10253e;
  border: 1px solid #1f3550;
  color: #b9cce4;
  font-size: 12px;
  cursor: pointer;
}
.ah-chip.active { background: var(--accent); color: #111827; border-color: var(--accent); font-weight: 700; }
.ah-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.ah-toolbar > b { margin-right: auto; }
.ah-select {
  background: #10253e;
  border: 1px solid #1f3550;
  border-radius: 8px;
  padding: 7px 10px;
  color: #eef4ff;
  font-size: 12px;
}
.ah-view { display: flex; border: 1px solid #1f3550; border-radius: 8px; overflow: hidden; }
.ah-view button { background: #10253e; border: 0; padding: 6px 9px; color: #b9cce4; cursor: pointer; }
.ah-view button.on { background: #0f2a40; color: var(--accent); }

.ah-btn-main {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border: 0;
  border-radius: 8px;
  background: var(--accent);
  color: #171b23;
  font-weight: 750;
  font-size: 12px;
  cursor: pointer;
}
.ah-btn-main:hover { background: #33b5ea; }
.ah-btn-main:disabled { opacity: 0.45; cursor: default; }
.ah-btn-ghost {
  padding: 7px 12px;
  border-radius: 8px;
  background: #10253e;
  border: 1px solid #1f3550;
  color: #b9cce4;
  font-size: 12px;
  cursor: pointer;
}
.ah-btn-block { width: 100%; margin-top: 10px; }
.ah-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.ah-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
.ah-album {
  border: 1px solid var(--line);
  background: var(--panel);
  border-radius: 12px;
  padding: 12px;
  min-width: 0;
  transition: 0.2s;
}
.ah-album:hover { border-color: var(--accent); transform: translateY(-2px); }
.ah-cover {
  position: relative;
  aspect-ratio: 1;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #0a111c;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}
.ah-cover img { width: 100%; height: 100%; object-fit: cover; }
.ah-cover-fallback { font-weight: 900; text-align: center; padding: 8px; font-size: 15px; text-shadow: 0 2px 8px #0008; }
.ah-cover--logo { background: #0a111c; }
.ah-logo { width: 62%; }
.ah-logo :deep(svg) { width: 100%; height: auto; display: block; }
.ah-logo :deep(path) { fill: var(--accent) !important; }
.ah-badge-ok {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #163b32;
  color: #57d8a5;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ah-badge-ok.warn { background: #3d2e12; color: #33b5ea; }
.ah-album-title { font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ah-clamp { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 3px; }
.ah-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-top: 8px; }
.ah-rows { display: flex; flex-direction: column; gap: 10px; }
.ah-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  background: var(--panel);
  border-radius: 12px;
}
.ah-row-info { flex: 1; min-width: 0; }
.ah-path { word-break: break-all; font-family: monospace; font-size: 11px; }

.ah-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.ah-stat {
  background: var(--card);
  border: 1px solid #1f3550;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.ah-stat strong { font-size: 22px; color: #33b5ea; }
.ah-panel {
  background: var(--card);
  border: 1px solid #1f3550;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ah-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #203750;
}
.ah-item:last-child { border-bottom: 0; }
.ah-empty { text-align: center; padding: 26px 16px; color: var(--muted); }
</style>
