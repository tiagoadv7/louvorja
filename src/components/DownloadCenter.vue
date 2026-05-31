<template>
  <v-dialog v-model="dialog" max-width="1080" height="700" scrollable>
    <template v-slot:activator="{ props }">
      <slot :props="props" />
    </template>

    <v-card class="dc-root" rounded="lg" style="overflow:hidden; height:700px">
      <!-- Título -->
      <div class="dc-header">
        <v-icon size="18" class="mr-2">mdi-download-box-outline</v-icon>
        Centro de Downloads
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" density="compact" @click="dialog = false" />
      </div>

      <div class="dc-body">
        <!-- ── Sidebar ─────────────────────────────────────────────── -->
        <nav class="dc-sidebar">
          <v-list nav density="compact" bg-color="transparent">
            <v-list-item
              v-for="item in navItems"
              :key="item.section"
              :prepend-icon="item.icon"
              :title="item.label"
              :active="section === item.section"
              active-color="white"
              rounded="lg"
              @click="goTo(item.section)"
            />
          </v-list>

          <v-list nav density="compact" bg-color="transparent" class="mt-auto pb-2">
            <v-list-item
              prepend-icon="mdi-download-circle-outline"
              title="Meus Downloads"
              :active="section === 'downloads'"
              active-color="white"
              rounded="lg"
              @click="goTo('downloads')"
            />
            <v-list-item
              prepend-icon="mdi-cog-outline"
              title="Configurações"
              :active="section === 'settings'"
              active-color="white"
              rounded="lg"
              @click="goTo('settings')"
            />
          </v-list>
        </nav>

        <!-- ── Conteúdo ───────────────────────────────────────────── -->
        <div class="dc-content">
          <!-- Loading global -->
          <div v-if="loading" class="dc-loading">
            <v-progress-circular indeterminate color="primary" size="40" />
          </div>

          <!-- HOME -->
          <template v-else-if="section === 'home'">
            <div class="dc-section-title">Bem-vindo ao Centro de Downloads</div>
            <p class="text-body-2 text-medium-emphasis mt-1 mb-4">
              Baixe coletâneas completas (letras, capas, áudio) para usar o LouvorJA sem conexão.
            </p>
            <v-row dense>
              <v-col v-for="item in navItems" :key="item.section" cols="6">
                <v-card variant="tonal" color="primary" class="dc-home-card" @click="goTo(item.section)">
                  <v-card-text class="d-flex align-center gap-3 pa-3">
                    <v-icon size="26" color="primary">{{ item.icon }}</v-icon>
                    <span class="text-body-2 font-weight-medium">{{ item.label }}</span>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </template>

          <!-- HINÁRIOS -->
          <template v-else-if="section === 'hymnals'">
            <div class="dc-section-title">Hinários</div>
            <div class="dc-pkg-list mt-2">
              <div v-for="h in hymnalItems" :key="h.file" class="dc-pkg-row">
                <v-icon size="32" color="primary" class="mr-3 flex-shrink-0">{{ h.icon }}</v-icon>
                <div class="flex-grow-1 min-w-0">
                  <div class="text-body-1 font-weight-medium">{{ h.name }}</div>
                  <div class="text-caption text-medium-emphasis">{{ h.description }}</div>
                </div>
                <div class="d-flex align-center gap-2 flex-shrink-0">
                  <v-icon v-if="isDownloaded(h.file)" color="success" size="18">mdi-check-circle</v-icon>
                  <v-btn
                    :color="isDownloaded(h.file) ? 'success' : 'primary'"
                    variant="tonal"
                    size="small"
                    :loading="downloading[h.file]"
                    :prepend-icon="isDownloaded(h.file) ? 'mdi-refresh' : 'mdi-download'"
                    @click="downloadFile(h.file)"
                  >{{ isDownloaded(h.file) ? 'Atualizar' : 'Baixar' }}</v-btn>
                </div>
              </div>
            </div>
          </template>

          <!-- COLETÂNEAS -->
          <template v-else-if="section === 'collections'">
            <div class="dc-section-title">Coletâneas</div>
            <div v-if="!isElectron" class="text-caption text-medium-emphasis mt-1 mb-1">
              No navegador, apenas os dados de letras são baixados (sem áudio ou imagens locais).
            </div>

            <div class="dc-tabs-row">
              <button class="dc-tabs-arrow" @click="scrollTabs(-200)">
                <v-icon size="18">mdi-chevron-left</v-icon>
              </button>
              <div ref="tabsEl" class="dc-tabs">
                <button
                  class="dc-tab"
                  :class="{ 'dc-tab--active': catFilter === null }"
                  @click="catFilter = null"
                >Todas as Coletâneas</button>
                <button
                  v-for="cat in categories"
                  :key="cat.id_category"
                  class="dc-tab"
                  :class="{ 'dc-tab--active': catFilter === cat.id_category }"
                  @click="catFilter = cat.id_category"
                >{{ cat.name }}</button>
              </div>
              <button class="dc-tabs-arrow" @click="scrollTabs(200)">
                <v-icon size="18">mdi-chevron-right</v-icon>
              </button>
            </div>

            <div class="dc-albums-grid">
              <div
                v-for="album in filteredAlbums"
                :key="album.id_album"
                class="dc-album-card"
              >
                <div class="dc-album-img-wrap">
                  <img
                    v-if="album.url_image"
                    :src="resolveUrl(album.url_image)"
                    class="dc-album-img"
                    loading="lazy"
                  />
                  <v-icon v-else size="42" color="grey-lighten-1">mdi-music-box</v-icon>

                  <div v-if="albumProgress[album.id_album]" class="dc-album-overlay">
                    <div class="dc-album-progress">
                      <v-progress-circular
                        :model-value="albumProgress[album.id_album].percent"
                        color="white"
                        size="36"
                        width="3"
                      >
                        <span style="font-size:9px;color:#fff">{{ albumProgress[album.id_album].percent }}%</span>
                      </v-progress-circular>
                      <div class="dc-album-progress-msg">{{ albumProgress[album.id_album].message }}</div>
                    </div>
                  </div>

                  <div v-else-if="isAlbumFullyDownloaded(album)" class="dc-album-badge-ok">
                    <v-icon size="16" color="white">mdi-check</v-icon>
                  </div>
                </div>

                <div class="dc-album-name" :title="album.name">{{ album.name }}</div>

                <div v-if="albumStats[album.id_album]" class="dc-album-stats">
                  <span title="Músicas">🎵 {{ albumStats[album.id_album].json }}</span>
                  <span title="Áudios">🔊 {{ albumStats[album.id_album].audio }}</span>
                  <span title="Imagens">🖼 {{ albumStats[album.id_album].images }}</span>
                </div>

                <v-btn
                  icon
                  variant="text"
                  size="x-small"
                  :color="isAlbumFullyDownloaded(album) ? 'success' : 'primary'"
                  :disabled="!!albumProgress[album.id_album]"
                  @click="downloadAlbumAny(album)"
                >
                  <v-icon size="20">
                    {{ isAlbumFullyDownloaded(album) ? 'mdi-refresh' : 'mdi-download' }}
                  </v-icon>
                </v-btn>
              </div>
            </div>
          </template>

          <!-- BÍBLIAS -->
          <template v-else-if="section === 'bibles'">
            <div class="dc-section-title">Bíblias</div>
            <div class="dc-pkg-list mt-2">
              <div v-for="b in bibleItems" :key="b.id" class="dc-pkg-row">
                <v-icon size="32" :color="b.color" class="mr-3 flex-shrink-0">mdi-book-open-variant</v-icon>
                <div class="flex-grow-1 min-w-0">
                  <div class="text-body-1 font-weight-medium">{{ b.name }}</div>
                  <div class="text-caption text-medium-emphasis">{{ b.files.join(' + ') }}</div>
                </div>
                <div class="d-flex align-center gap-2 flex-shrink-0">
                  <v-icon v-if="allDownloaded(b.files)" color="success" size="18">mdi-check-circle</v-icon>
                  <v-btn
                    :color="allDownloaded(b.files) ? 'success' : 'primary'"
                    variant="tonal"
                    size="small"
                    :loading="downloading[b.id]"
                    :prepend-icon="allDownloaded(b.files) ? 'mdi-refresh' : 'mdi-download'"
                    @click="downloadMulti(b.id, b.files)"
                  >{{ allDownloaded(b.files) ? 'Atualizar' : 'Baixar' }}</v-btn>
                </div>
              </div>
            </div>
          </template>

          <!-- CONFIGURAÇÕES -->
          <template v-else-if="section === 'settings'">
            <div class="dc-section-title">Configurações</div>

            <!-- Modo offline -->
            <v-card variant="tonal" color="primary" class="mt-3 mb-3">
              <v-card-text class="pa-4">
                <div class="d-flex align-center">
                  <v-icon class="mr-3" size="28">mdi-wifi-off</v-icon>
                  <div class="flex-grow-1">
                    <div class="text-body-2 font-weight-medium">Modo offline</div>
                    <div class="text-caption text-medium-emphasis">
                      {{ localFiles.length }} arquivo(s) baixado(s) • {{ totalSize }}
                    </div>
                  </div>
                  <v-switch
                    :model-value="localEnabled"
                    @update:modelValue="setOfflineMode"
                    color="white"
                    density="compact"
                    hide-details
                  />
                </div>
              </v-card-text>
            </v-card>

            <div class="text-caption text-medium-emphasis mb-4">
              Com o <b>Modo offline</b> ativado, o app usa os arquivos já baixados
              em vez de acessar a internet. Baixe os conteúdos em <b>Coletâneas</b>.
            </div>

            <v-divider class="mb-4" />

            <!-- Verificação de arquivos -->
            <div class="text-subtitle-2 mb-3">Verificação de arquivos locais</div>
            <div class="text-caption text-medium-emphasis mb-3">
              Verifica quais arquivos de mídia (capas, imagens, áudios) estão faltando nas
              pastas locais e oferece o download automático.
            </div>

            <!-- Resultado do scan -->
            <template v-if="scanResult !== null">
              <v-alert
                v-if="scanResult.total === 0"
                type="success"
                variant="tonal"
                density="compact"
                class="mb-3"
              >
                <div class="text-body-2 font-weight-medium">Todos os arquivos estão presentes</div>
                <div class="text-caption">Nenhum arquivo de mídia em falta.</div>
              </v-alert>
              <v-alert
                v-else
                type="warning"
                variant="tonal"
                density="compact"
                class="mb-3"
              >
                <div class="text-body-2 font-weight-medium mb-1">
                  {{ scanResult.total }} arquivo(s) em falta
                </div>
                <div class="d-flex gap-3 flex-wrap">
                  <span v-if="scanResult.counts.cover" class="text-caption">
                    🖼 {{ scanResult.counts.cover }} capa(s)
                  </span>
                  <span v-if="scanResult.counts.image" class="text-caption">
                    🎨 {{ scanResult.counts.image }} imagem(ns)
                  </span>
                  <span v-if="scanResult.counts.audio" class="text-caption">
                    🔊 {{ scanResult.counts.audio }} áudio(s)
                  </span>
                </div>
              </v-alert>
            </template>

            <!-- Progresso do download de faltantes -->
            <div v-if="downloadingMissing" class="mb-3">
              <div class="d-flex align-center mb-1">
                <span class="text-caption text-medium-emphasis flex-grow-1">{{ missingProgress.message }}</span>
                <span class="text-caption font-weight-medium">{{ missingProgress.percent }}%</span>
              </div>
              <v-progress-linear
                :model-value="missingProgress.percent"
                color="primary"
                rounded
                height="6"
              />
            </div>

            <!-- Botões de ação -->
            <div class="d-flex gap-2 mb-4 flex-wrap">
              <v-btn
                variant="tonal"
                color="primary"
                size="small"
                prepend-icon="mdi-magnify-scan"
                :loading="scanning"
                :disabled="downloadingMissing"
                @click="runScanMissing"
              >Verificar arquivos</v-btn>

              <v-btn
                v-if="scanResult && scanResult.total > 0 && !downloadingMissing"
                variant="tonal"
                color="warning"
                size="small"
                prepend-icon="mdi-download-multiple"
                @click="confirmDialog = true"
              >Baixar em falta ({{ scanResult.total }})</v-btn>
            </div>

            <v-divider class="mb-4" />

            <div class="d-flex justify-end">
              <v-btn
                variant="outlined"
                color="error"
                size="small"
                :disabled="localFiles.length === 0 || clearing"
                :loading="clearing"
                prepend-icon="mdi-delete-outline"
                @click="clearAll"
              >Limpar downloads</v-btn>
            </div>

            <!-- ── Modal de confirmação ─────────────────────────────────── -->
            <v-dialog v-model="confirmDialog" max-width="460" persistent>
              <v-card rounded="lg">
                <v-card-title class="pt-5 px-5 pb-2 d-flex align-center">
                  <v-icon color="warning" class="mr-2" size="22">mdi-download-circle</v-icon>
                  Baixar arquivos em falta
                </v-card-title>

                <v-card-text class="px-5">
                  <p class="text-body-2 mb-4">
                    Foram encontrados <b>{{ scanResult && scanResult.total }}</b>
                    arquivo(s) em falta no sistema. Deseja baixá-los agora?
                  </p>

                  <div class="dc-missing-counts">
                    <div v-if="scanResult && scanResult.counts && scanResult.counts.cover" class="dc-missing-row">
                      <v-icon size="16" color="primary" class="mr-2">mdi-image-album</v-icon>
                      <span class="text-body-2 flex-grow-1">
                        {{ scanResult.counts.cover }} capa(s) de álbum
                      </span>
                      <span class="text-caption text-medium-emphasis">→ config/capas</span>
                    </div>
                    <div v-if="scanResult && scanResult.counts && scanResult.counts.image" class="dc-missing-row">
                      <v-icon size="16" color="primary" class="mr-2">mdi-image</v-icon>
                      <span class="text-body-2 flex-grow-1">
                        {{ scanResult.counts.image }} imagem(ns) de slides
                      </span>
                      <span class="text-caption text-medium-emphasis">→ config/imagens</span>
                    </div>
                    <div v-if="scanResult && scanResult.counts && scanResult.counts.audio" class="dc-missing-row">
                      <v-icon size="16" color="primary" class="mr-2">mdi-music-note</v-icon>
                      <span class="text-body-2 flex-grow-1">
                        {{ scanResult.counts.audio }} arquivo(s) de áudio
                      </span>
                      <span class="text-caption text-medium-emphasis">→ config/musicas</span>
                    </div>
                  </div>

                  <v-alert type="info" variant="tonal" density="compact" class="mt-4">
                    <div class="text-caption">
                      Os arquivos serão salvos nas pastas padrão do aplicativo
                      (<code>config/capas</code>, <code>config/imagens</code>, <code>config/musicas</code>).
                    </div>
                  </v-alert>
                </v-card-text>

                <v-card-actions class="px-5 pb-4">
                  <v-spacer />
                  <v-btn variant="text" size="small" @click="confirmDialog = false">Cancelar</v-btn>
                  <v-btn
                    color="primary"
                    variant="flat"
                    size="small"
                    prepend-icon="mdi-download"
                    @click="startMissingDownload"
                  >Baixar agora</v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </template>

          <!-- MEUS DOWNLOADS -->
          <template v-else-if="section === 'downloads'">
            <div class="dc-section-title">
              Meus Downloads
              <span class="text-caption text-medium-emphasis ml-2">({{ localFiles.length }} arquivo(s) • {{ totalSize }})</span>
            </div>
            <div v-if="localFiles.length === 0" class="text-caption text-medium-emphasis mt-3">
              Nenhum arquivo baixado ainda.
            </div>
            <div v-else class="dc-local-list mt-2">
              <div v-for="f in localFiles" :key="f.name" class="dc-local-row">
                <v-icon size="14" color="success" class="mr-2 flex-shrink-0">mdi-check-circle</v-icon>
                <span class="text-body-2 flex-grow-1">{{ f.name }}</span>
                <span class="text-caption text-medium-emphasis">{{ formatSize(f.size) }}</span>
                <v-btn icon size="x-small" variant="text" color="error" class="ml-1" @click="deleteFile(f.name)">
                  <v-icon size="14">mdi-delete-outline</v-icon>
                </v-btn>
              </div>
            </div>
          </template>
        </div>
      </div>
    </v-card>
  </v-dialog>

  <!-- ── Dialog: Substituir arquivos do álbum? ─────────────────────────────── -->
  <v-dialog v-model="replaceDialog" max-width="440" persistent>
    <v-card rounded="lg">
      <v-card-title class="pt-5 px-5 pb-2 d-flex align-center">
        <v-icon color="warning" class="mr-2" size="22">mdi-refresh-circle</v-icon>
        Álbum já baixado
      </v-card-title>
      <v-card-text class="px-5">
        <p class="text-body-2 mb-3">
          O álbum <b>{{ replaceAlbumTarget?.name }}</b> já foi baixado anteriormente.
        </p>
        <p class="text-body-2">
          Deseja <b>substituir</b> os arquivos existentes ou apenas baixar os que estão faltando?
        </p>
      </v-card-text>
      <v-card-actions class="px-5 pb-4">
        <v-btn variant="text" size="small" @click="replaceDialog = false; replaceAlbumTarget = null">
          Cancelar
        </v-btn>
        <v-spacer />
        <v-btn variant="tonal" color="primary" size="small" prepend-icon="mdi-download" @click="onReplaceChoice(false)">
          Baixar faltantes
        </v-btn>
        <v-btn variant="flat" color="warning" size="small" prepend-icon="mdi-refresh" @click="onReplaceChoice(true)">
          Substituir tudo
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import $database from '@/helpers/Database';
import $storage from '@/helpers/Storage';

const NAV_ITEMS = [
  { section: 'home',        icon: 'mdi-home-outline',         label: 'Início' },
  { section: 'hymnals',     icon: 'mdi-music-note',           label: 'Hinários' },
  { section: 'collections', icon: 'mdi-music-box-multiple',   label: 'Coletâneas' },
  { section: 'bibles',      icon: 'mdi-book-open-variant',    label: 'Bíblias' },
];

const HYMNAL_ITEMS = [
  { file: 'pt_hymnal',      name: 'Hinário',      description: 'Hinário moderno das AdPB',           icon: 'mdi-music-note' },
  { file: 'pt_hymnal_1996', name: 'Hinário 1996', description: 'Hinário histórico de 1996 das AdPB', icon: 'mdi-music-note-outline' },
];

const BIBLE_ITEMS = [
  { id: 'bible_pt', name: 'Bíblia Português', files: ['pt_bible_book', 'pt_bible_version'], color: 'green' },
  { id: 'bible_es', name: 'Biblia Español',   files: ['es_bible_book', 'es_bible_version'], color: 'orange' },
];

export default {
  name: 'DownloadCenter',

  props: {
    modelValue: { type: Boolean, default: false },
  },

  emits: ['update:modelValue'],

  watch: {
    modelValue(v) { this.dialog = v; },
    dialog(v) {
      this.$emit('update:modelValue', v);
      this.onToggle(v);
    },
  },

  data: () => ({
    dialog:        false,
    section:       'home',
    loading:       false,
    categories:    [],
    catFilter:     null,
    localFiles:    [],
    downloading:   {},
    albumProgress: {},
    albumStats:    {},
    _progressHandler: null,
    navItems:    NAV_ITEMS,
    hymnalItems: HYMNAL_ITEMS,
    bibleItems:  BIBLE_ITEMS,
    // Modo offline (data reativo — localStorage não é reativo sozinho)
    localEnabled: false,
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
  }),

  computed: {
    isElectron() {
      return this.$electron.isElectron();
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

    totalSize() {
      const t = this.localFiles.reduce((s, f) => s + (f.size || 0), 0);
      return this.formatSize(t);
    },
  },

  methods: {
    onToggle(open) {
      if (open) {
        this.localEnabled = $storage.get('db_local_enabled', false) === true;
        this.init();
        this.subscribeProgress();
      } else {
        this.unsubscribeProgress();
        this.unsubscribeMissingProgress();
      }
    },

    setOfflineMode(val) {
      this.localEnabled = val;
      $storage.set('db_local_enabled', val);
    },

    async init() {
      await this.loadLocalFiles();
      if (this.section === 'collections') await this.loadCategories();
    },

    async goTo(s) {
      this.section = s;
      if (s === 'collections' && this.categories.length === 0) await this.loadCategories();
      if (s === 'downloads') await this.loadLocalFiles();
      if (s === 'settings') await this.loadLocalFiles();
    },

    async loadCategories() {
      this.loading = true;
      const locale = this.$i18n?.locale?.value ?? this.$i18n?.locale ?? 'pt';
      this.categories = await $database.get(`${locale}_categories`) || [];
      this.loading = false;
    },

    async loadLocalFiles() {
      this.localFiles = await this.$electron.dbLocalList() || [];
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

    resolveUrl(url) {
      if (!url) return '';
      if (url.startsWith('file://') || url.startsWith('http://') || url.startsWith('https://')) return url;
      return this.$path.file(url);
    },

    // ── Downloads simples ────────────────────────────────────────────────────
    async downloadFile(filename) {
      this.downloading = { ...this.downloading, [filename]: true };
      try {
        const ok = await $database.download(filename);
        if (!ok) this.$alert?.error?.({ text: `Falha ao baixar: ${filename}. Verifique sua conexão.` });
        await this.loadLocalFiles();
      } catch (e) {
        this.$alert?.error?.({ text: String(e) });
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
        if (failed.length) this.$alert?.error?.({ text: `Falha ao baixar: ${failed.join(', ')}. Verifique sua conexão.` });
      } catch (e) {
        this.$alert?.error?.({ text: String(e) });
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
      setProgress(0, 'Baixando dados do álbum...');
      const statsLocal = { json: 0, audio: 0, images: 0 };

      try {
        const okAlbum = await $database.download(`album_${id}`);
        if (!okAlbum) throw new Error(`Falha ao baixar álbum "${album.name}"`);
        statsLocal.json++;

        const albumData  = await this.$electron.dbLocalGet(`album_${id}`);
        const musics     = albumData?.musics || [];
        const hasCover   = !!albumData?.url_image;
        const grandTotal = 1 + (hasCover ? 1 : 0) + musics.length;
        let done = 1;

        setProgress(Math.round((done / grandTotal) * 100),
          hasCover ? 'Baixando capa...' : `Baixando ${musics.length} músicas...`);

        if (albumData.url_image) {
          await this._cacheUrl(this.resolveUrl(albumData.url_image));
          statsLocal.images++;
          done++;
          setProgress(Math.round((done / grandTotal) * 100), `Baixando ${musics.length} músicas...`);
        }

        for (let i = 0; i < musics.length; i++) {
          const m = musics[i];
          setProgress(Math.round((done / grandTotal) * 100),
            `[${i + 1}/${musics.length}] ${m.name || 'música'}`);

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
        this.$alert?.error?.({ text: String(e) });
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
      this.albumProgress = { ...this.albumProgress, [id]: { percent: 0, message: 'Iniciando...' } };
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
          if ((s.skipped || 0) > 0 && !overwrite) {
            this.$alert?.info?.({
              text: `${s.skipped} arquivo(s) já existiam e foram ignorados. Use "Substituir" para forçar o re-download.`,
            });
          }
        } else {
          this.$alert?.error?.({ text: `Falha ao baixar álbum "${album.name}": ${result.error || 'erro desconhecido'}` });
        }
        await this.loadLocalFiles();
      } catch (e) {
        this.$alert?.error?.({ text: String(e) });
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
      } catch (e) {
        this.$alert?.error?.({ text: String(e) });
      } finally {
        this.scanning = false;
      }
    },

    async startMissingDownload() {
      this.confirmDialog = false;
      if (!this.scanResult?.missing?.length) return;

      this.downloadingMissing = true;
      this.missingProgress    = { percent: 0, message: 'Iniciando...' };
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
        } else {
          this.$alert?.error?.({ text: result.error || 'Erro ao baixar arquivos.' });
        }
      } catch (e) {
        this.$alert?.error?.({ text: String(e) });
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
/* ── Layout raiz ────────────────────────────────────────────────── */
.dc-root { display: flex; flex-direction: column; }

.dc-header {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.25);
  flex-shrink: 0;
}

.dc-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Sidebar ────────────────────────────────────────────────────── */
.dc-sidebar {
  width: 210px;
  min-width: 210px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255,255,255,0.08);
  padding: 8px 0;
  overflow: hidden;
  background: rgba(0,0,0,0.15);
}

/* ── Conteúdo ───────────────────────────────────────────────────── */
.dc-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}
.dc-content::-webkit-scrollbar { width: 5px; }
.dc-content::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 3px; }

.dc-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* ── Comuns ─────────────────────────────────────────────────────── */
.dc-section-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
.dc-home-card { cursor: pointer; transition: opacity 0.15s; }
.dc-home-card:hover { opacity: 0.85; }

/* ── Lista de pacotes ───────────────────────────────────────────── */
.dc-pkg-list { display: flex; flex-direction: column; gap: 12px; }
.dc-pkg-row {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid rgba(128,128,128,0.15);
  background: rgba(128,128,128,0.04);
}

/* ── Tabs de categoria ──────────────────────────────────────────── */
.dc-tabs-row {
  display: flex;
  align-items: center;
  margin: 10px 0 12px;
  border-bottom: 1px solid rgba(128,128,128,0.2);
}
.dc-tabs-arrow { flex-shrink: 0; padding: 2px; opacity: 0.5; cursor: pointer; background: none; border: none; }
.dc-tabs-arrow:hover { opacity: 1; }
.dc-tabs { flex: 1; display: flex; overflow-x: auto; scroll-behavior: smooth; scrollbar-width: none; }
.dc-tabs::-webkit-scrollbar { display: none; }
.dc-tab {
  flex-shrink: 0;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  background: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: opacity 0.15s, border-color 0.15s;
}
.dc-tab:hover { opacity: 0.9; }
.dc-tab--active { opacity: 1; border-bottom-color: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-primary)); }

/* ── Grid de álbuns ─────────────────────────────────────────────── */
.dc-albums-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 14px;
}
.dc-album-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 10px;
  border: 1px solid rgba(128,128,128,0.15);
  overflow: hidden;
  background: rgba(128,128,128,0.04);
  transition: box-shadow 0.15s;
}
.dc-album-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.12); }
.dc-album-img-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: rgba(128,128,128,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.dc-album-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(0.55);
  transition: filter 0.2s;
}
.dc-album-card:hover .dc-album-img { filter: grayscale(0); }
.dc-album-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dc-album-progress { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.dc-album-progress-msg {
  font-size: 9px;
  color: rgba(255,255,255,0.85);
  text-align: center;
  max-width: 120px;
  line-height: 1.2;
}
.dc-album-badge-ok {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(46,204,113,0.85);
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dc-album-name {
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  padding: 6px 6px 2px;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}
.dc-album-stats {
  display: flex;
  gap: 6px;
  font-size: 9px;
  opacity: 0.6;
  padding-bottom: 2px;
}

/* ── Verificação de arquivos em falta ───────────────────────────── */
.dc-missing-counts { display: flex; flex-direction: column; gap: 10px; }
.dc-missing-row {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(128,128,128,0.06);
  border: 1px solid rgba(128,128,128,0.12);
}

/* ── Meus Downloads ─────────────────────────────────────────────── */
.dc-local-list { display: flex; flex-direction: column; gap: 2px; max-height: 380px; overflow-y: auto; }
.dc-local-row {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 12px;
}
.dc-local-row:hover { background: rgba(128,128,128,0.06); }
</style>
