<template>
  <v-dialog v-model="dialog" max-width="1080" height="700" scrollable>
    <template v-slot:activator="{ props }">
      <slot :props="props" />
    </template>

    <v-card class="dc-root dc-root--library" :class="{ 'dc-root--collections': section === 'collections' }" rounded="lg" style="overflow:hidden; height:700px">
      <!-- Cabeçalho (modelo Biblioteca Local do flute): identidade à esquerda,
           espaço em disco e fechar à direita -->
      <div class="dc-header">
        <div class="dc-header-title">
          <v-icon size="38" color="#009fe3" class="mr-5 flex-shrink-0">mdi-library</v-icon>
          <div>
            <h2 class="dc-header-name">{{ $t('components.download_center.title') }}</h2>
            <span class="dc-header-subtitle">{{ $t('components.download_center.subtitle') }}</span>
          </div>
        </div>
        <div class="dc-header-actions">
          <!-- Widget de espaço: o que os downloads ocupam e o disco livre -->
          <div v-if="storage" class="dc-storage-widget">
            <v-icon size="20" class="mr-3">mdi-harddisk</v-icon>
            <div class="dc-storage-text">
              <span>{{ $t('components.download_center.storage_used', { used: fmtBytes(storage.usedBytes) }) }}</span>
              <span v-if="storage.disk" class="dc-storage-free">{{ $t('components.download_center.storage_free', { free: fmtBytes(storage.disk.freeBytes), total: fmtBytes(storage.disk.totalBytes) }) }}</span>
              <v-progress-linear
                v-if="storage.disk"
                :model-value="diskUsedPct()"
                color="#009fe3"
                bg-color="rgba(255,255,255,0.12)"
                height="4"
                rounded
              />
            </div>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" density="compact" @click="dialog = false" />
        </div>
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
              :title="$t('components.download_center.downloads')"
              :active="section === 'downloads'"
              active-color="white"
              rounded="lg"
              @click="goTo('downloads')"
            />
            <v-list-item
              prepend-icon="mdi-cog-outline"
              :title="$t('components.download_center.settings')"
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
            <div class="dc-section-title">{{ $t('components.download_center.welcome') }}</div>
            <p class="text-body-2 text-medium-emphasis mt-1 mb-4">
              {{ $t('components.download_center.welcome_desc') }}
            </p>
            <div class="dc-home-grid mt-3">
              <div
                v-for="item in navItems.filter(i => i.section !== 'home')"
                :key="item.section"
                class="dc-home-card"
                @click="goTo(item.section)"
              >
                <div class="dc-home-cover">
                  <v-icon size="48" :color="item.color">{{ item.icon }}</v-icon>
                </div>
                <div class="dc-home-info">
                  <div class="dc-home-label">{{ item.label }}</div>
                  <div class="dc-home-desc">{{ item.description }}</div>
                </div>
              </div>
            </div>
          </template>

          <!-- HINÁRIOS -->
          <template v-else-if="section === 'hymnals'">
            <div class="dc-section-title">{{ $t('components.download_center.nav_hymnals') }}</div>
            <div class="dc-hymnal-grid mt-3">
              <div v-for="h in hymnalItems" :key="h.file" class="dc-hymnal-card">
                <!-- Capa: ícone do hinário (SVG local) -->
                <div class="dc-hymnal-cover">
                  <!-- Mesmo SVG, pintado com a cor primária do tema (máscara), igual aos ícones da biblioteca do flute -->
                  <div
                    v-if="h.coverSvg"
                    class="dc-hymnal-icon dc-hymnal-icon--themed"
                    v-html="h.coverSvg"
                  />
                  <v-icon v-else size="72" :color="h.color">{{ h.icon }}</v-icon>
                  <div v-if="isDownloaded(h.file)" class="dc-album-badge-ok">
                    <v-icon size="18" color="success">mdi-check</v-icon>
                  </div>
                </div>

                <!-- Info + botão -->
                <div class="dc-hymnal-info">
                  <div class="dc-hymnal-name">{{ h.name }}</div>
                  <div class="dc-hymnal-desc">{{ h.description }}</div>
                  <div v-if="folderBytes(h.folder)" class="text-caption text-medium-emphasis">{{ fmtBytes(folderBytes(h.folder)) }}</div>
                  <v-btn
                    v-if="!h.localOnly"
                    :color="isDownloaded(h.file) ? 'success' : 'primary'"
                    variant="tonal"
                    size="small"
                    block
                    class="mt-3"
                    :loading="downloading[h.file]"
                    :prepend-icon="isDownloaded(h.file) ? 'mdi-refresh' : 'mdi-download'"
                    @click="downloadFile(h.file)"
                  >{{ isDownloaded(h.file) ? $t('components.download_center.update') : $t('components.download_center.download') }}</v-btn>
                </div>
              </div>
            </div>
          </template>

          <!-- COLETÂNEAS -->
          <template v-else-if="section === 'collections'">
            <div class="dc-section-title">{{ $t('components.download_center.nav_collections') }}</div>
            <div v-if="!isElectron" class="text-caption text-medium-emphasis mt-1 mb-1">
              {{ $t('components.download_center.no_browser') }}
            </div>

            <div class="lib">
              <!-- Categorias -->
              <aside class="lib-side">
                <button
                  class="lib-cat"
                  :class="{ 'lib-cat--on': catFilter === null }"
                  @click="catFilter = null"
                >
                  <v-icon size="18">mdi-file-document-outline</v-icon>
                  <span class="lib-cat-name">{{ $t('components.download_center.all_collections') }}</span>
                  <span class="lib-count">{{ allAlbumsCount }}</span>
                </button>
                <div class="lib-side-title">{{ $t('components.download_center.lib_categories') }}</div>
                <button
                  v-for="cat in categories"
                  :key="cat.id_category"
                  class="lib-cat"
                  :class="{ 'lib-cat--on': catFilter === cat.id_category }"
                  @click="catFilter = cat.id_category"
                >
                  <v-icon size="18">mdi-folder-outline</v-icon>
                  <span class="lib-cat-name">{{ cat.name }}</span>
                  <span class="lib-count">{{ (cat.albums || []).length }}</span>
                </button>
                <!-- Na Biblioteca a navegação das seções fica aqui: volta ao início das seções -->
                <button class="lib-cat lib-cat--back" @click="goTo('home')">
                  <v-icon size="18">mdi-arrow-left</v-icon>
                  <span class="lib-cat-name">{{ $t('components.download_center.nav_home') }}</span>
                </button>
              </aside>

              <!-- Lista -->
              <section class="lib-main">
                <div class="lib-toolbar">
                  <div class="lib-search">
                    <v-icon size="18">mdi-magnify</v-icon>
                    <input v-model="albumSearch" :placeholder="$t('components.download_center.lib_search')" />
                  </div>
                  <select v-model="albumStatus" class="lib-select">
                    <option value="all">{{ $t('components.download_center.lib_status_all') }}</option>
                    <option value="downloaded">{{ $t('components.download_center.lib_status_downloaded') }}</option>
                    <option value="pending">{{ $t('components.download_center.lib_status_pending') }}</option>
                  </select>
                  <select v-model="albumSort" class="lib-select">
                    <option value="recent">{{ $t('components.download_center.lib_sort_recent') }}</option>
                    <option value="name">{{ $t('components.download_center.lib_sort_name') }}</option>
                  </select>
                  <div class="lib-view">
                    <button :class="{ 'lib-view--on': albumView === 'grid' }" @click="albumView = 'grid'">
                      <v-icon size="18">mdi-view-grid-outline</v-icon>
                    </button>
                    <button :class="{ 'lib-view--on': albumView === 'list' }" @click="albumView = 'list'">
                      <v-icon size="18">mdi-view-list</v-icon>
                    </button>
                  </div>
                  <v-btn color="primary" variant="flat" size="small" prepend-icon="mdi-cloud-download-outline" :disabled="!isElectron || !libraryPending" @click="downloadAllLibrary">
                    {{ $t('components.download_center.lib_download_all') }}
                  </v-btn>
                </div>

                <div class="lib-list" :class="albumView === 'grid' ? 'lib-list--grid' : 'lib-list--rows'">
                  <div
                    v-for="album in libraryAlbums"
                    :key="album.id_album"
                    class="lib-row"
                    :class="{ 'lib-row--on': selectedAlbum && selectedAlbum.id_album === album.id_album }"
                    @click="selectedAlbumId = album.id_album"
                  >
                    <div class="lib-cover">
                      <img v-if="albumImageUrl(album)" :src="resolveUrl(albumImageUrl(album))" loading="lazy" />
                      <v-icon v-else size="26" color="grey-lighten-1">mdi-music-box</v-icon>
                    </div>
                    <div class="lib-info">
                      <div class="lib-name" :title="album.name">{{ album.name }}</div>
                      <div class="lib-sub">{{ albumSubtitle(album) }}</div>
                    </div>
                    <v-btn
                      size="small"
                      variant="outlined"
                      :color="isAlbumComplete(album) ? 'success' : 'primary'"
                      :disabled="!!albumProgress[album.id_album]"
                      @click.stop="downloadAlbumAny(album)"
                    >
                      <template v-if="albumProgress[album.id_album]">{{ albumProgress[album.id_album].percent }}%</template>
                      <template v-else>{{ isAlbumComplete(album) ? $t('components.download_center.lib_redownload') : $t('components.download_center.lib_download') }}</template>
                    </v-btn>
                    <div class="lib-size">{{ albumSizeLabel(album) }}</div>
                  </div>
                </div>
              </section>

              <!-- Detalhes do álbum selecionado -->
              <aside v-if="selectedAlbum" class="lib-detail">
                <div class="lib-detail-cover">
                  <img v-if="albumImageUrl(selectedAlbum)" :src="resolveUrl(albumImageUrl(selectedAlbum))" />
                  <v-icon v-else size="64" color="grey-lighten-1">mdi-music-box</v-icon>
                </div>
                <div class="lib-detail-name">{{ selectedAlbum.name }}</div>
                <div class="lib-detail-sub">{{ albumSubtitle(selectedAlbum) }}</div>
                <div class="lib-status" :class="{ 'lib-status--ok': isAlbumComplete(selectedAlbum) }">
                  <v-icon size="14">{{ isAlbumComplete(selectedAlbum) ? 'mdi-check-circle-outline' : 'mdi-cloud-outline' }}</v-icon>
                  {{ isAlbumComplete(selectedAlbum) ? $t('components.download_center.lib_downloaded') : $t('components.download_center.lib_not_downloaded') }}
                </div>
                <dl class="lib-facts">
                  <div><dt>{{ $t('components.download_center.lib_category') }}</dt><dd>{{ albumCategoryName(selectedAlbum) }}</dd></div>
                  <div><dt>{{ $t('components.download_center.lib_songs') }}</dt><dd>{{ albumSongCount(selectedAlbum) }}</dd></div>
                  <div><dt>{{ $t('components.download_center.lib_size') }}</dt><dd>{{ albumSizeLabel(selectedAlbum) || '—' }}</dd></div>
                </dl>
                <v-btn
                  block
                  color="primary"
                  variant="flat"
                  prepend-icon="mdi-download"
                  :disabled="!!albumProgress[selectedAlbum.id_album]"
                  @click="downloadAlbumAny(selectedAlbum)"
                >
                  {{ isAlbumComplete(selectedAlbum) ? $t('components.download_center.lib_redownload') : $t('components.download_center.lib_download') }}
                </v-btn>
              </aside>
            </div>
          </template>

          <!-- BÍBLIAS -->
          <template v-else-if="section === 'bibles'">
            <div class="dc-section-title">{{ $t('components.download_center.bibles') }}</div>
            <div class="dc-pkg-list mt-2">
              <div v-for="b in bibleItems" :key="b.id" class="dc-pkg-row">
                <v-icon size="32" :color="b.color" class="mr-3 flex-shrink-0">mdi-book-open-variant</v-icon>
                <div class="flex-grow-1 min-w-0">
                  <div class="text-body-1 font-weight-medium">{{ b.name }}</div>
                  <div class="text-caption text-medium-emphasis">{{ b.files.join(' + ') }}</div>
                </div>
                <div class="d-flex align-center ga-2 flex-shrink-0">
                  <v-icon v-if="allDownloaded(b.files)" color="success" size="18">mdi-check-circle</v-icon>
                  <v-btn
                    :color="allDownloaded(b.files) ? 'success' : 'primary'"
                    variant="tonal"
                    size="small"
                    :loading="downloading[b.id]"
                    :prepend-icon="allDownloaded(b.files) ? 'mdi-refresh' : 'mdi-download'"
                    @click="downloadMulti(b.id, b.files)"
                  >{{ allDownloaded(b.files) ? $t('components.download_center.update') : $t('components.download_center.download') }}</v-btn>
                </div>
              </div>
            </div>
          </template>

          <!-- CONFIGURAÇÕES -->
          <template v-else-if="section === 'settings'">
            <div class="dc-section-title">{{ $t('components.download_center.settings') }}</div>

            <div class="text-caption text-medium-emphasis mb-4">
              {{ userFiles.length }} {{ $t('components.download_center.files_downloaded') }} • {{ totalSize }}.
              <span v-html="$t('components.download_center.online_note')"></span>
            </div>

            <v-divider class="mb-4" />

            <!-- Pastas locais -->
            <div class="text-subtitle-2 mb-3">{{ $t('components.download_center.folders') }}</div>

            <div v-if="dbFolder" class="dc-folder-row mb-2">
              <v-icon size="16" class="mr-2" color="primary">mdi-database-outline</v-icon>
              <div class="dc-folder-info">
                <div class="text-caption font-weight-medium">{{ $t('components.download_center.folder_db') }}</div>
                <div class="dc-folder-path text-caption text-medium-emphasis" :title="dbFolder">{{ dbFolder }}</div>
              </div>
              <v-btn
                icon="mdi-folder-open-outline"
                variant="text"
                size="x-small"
                density="compact"
                class="ml-1"
                :title="$t('components.download_center.open_folder')"
                @click="$electron.shellOpenFolder(dbFolder)"
              />
            </div>

            <div v-if="configFolder" class="dc-folder-row mb-4">
              <v-icon size="16" class="mr-2" color="primary">mdi-folder-music-outline</v-icon>
              <div class="dc-folder-info">
                <div class="text-caption font-weight-medium">{{ $t('components.download_center.folder_media') }}</div>
                <div class="dc-folder-path text-caption text-medium-emphasis" :title="configFolder">{{ configFolder }}</div>
              </div>
              <v-btn
                icon="mdi-folder-open-outline"
                variant="text"
                size="x-small"
                density="compact"
                class="ml-1"
                :title="$t('components.download_center.open_folder')"
                @click="$electron.shellOpenFolder(configFolder)"
              />
            </div>

            <v-divider class="mb-4" />

            <!-- Verificação de arquivos -->
            <div class="text-subtitle-2 mb-3">{{ $t('components.download_center.verify_title') }}</div>
            <div class="text-caption text-medium-emphasis mb-3">
              {{ $t('components.download_center.verify_desc') }}
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
                <div class="text-body-2 font-weight-medium">{{ $t('components.download_center.all_present') }}</div>
                <div class="text-caption">{{ $t('components.download_center.none_missing') }}</div>
              </v-alert>
              <v-alert
                v-else
                type="warning"
                variant="tonal"
                density="compact"
                class="mb-3"
              >
                <div class="text-body-2 font-weight-medium mb-1">
                  {{ scanResult.total }} {{ $t('components.download_center.files_missing') }}
                </div>
                <div class="d-flex ga-3 flex-wrap mb-2">
                  <span v-if="scanResult.counts.cover" class="text-caption">
                    🖼 {{ scanResult.counts.cover }} {{ $t('components.download_center.covers_short') }}
                  </span>
                  <span v-if="scanResult.counts.image" class="text-caption">
                    🎨 {{ scanResult.counts.image }} {{ $t('components.download_center.images_short') }}
                  </span>
                  <span v-if="scanResult.counts.audio" class="text-caption">
                    🔊 {{ scanResult.counts.audio }} {{ $t('components.download_center.audio_short') }}
                  </span>
                </div>
                <div v-if="configFolder" class="text-caption text-medium-emphasis" style="word-break:break-all">
                  {{ $t('components.download_center.folder_checked') }} <span class="font-weight-medium" style="font-family:monospace">{{ configFolder }}</span>
                  <v-btn
                    variant="text"
                    size="x-small"
                    density="compact"
                    class="ml-1"
                    @click="$electron.shellOpenFolder(configFolder)"
                  >{{ $t('components.download_center.open') }}</v-btn>
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
            <div class="d-flex ga-2 mb-4 flex-wrap">
              <v-btn
                variant="tonal"
                color="primary"
                size="small"
                prepend-icon="mdi-magnify-scan"
                :loading="scanning"
                :disabled="downloadingMissing"
                @click="runScanMissing"
              >{{ $t('components.download_center.verify_btn') }}</v-btn>

              <v-btn
                v-if="scanResult && scanResult.total > 0 && !downloadingMissing"
                variant="tonal"
                color="warning"
                size="small"
                prepend-icon="mdi-download-multiple"
                @click="confirmDialog = true"
              >{{ $t('components.download_center.download_missing_btn') }} ({{ scanResult.total }})</v-btn>
            </div>

            <v-divider class="mb-4" />

            <!-- ── Modal de confirmação ─────────────────────────────────── -->
            <v-dialog v-model="confirmDialog" max-width="460" persistent>
              <v-card rounded="lg">
                <v-card-title class="pt-5 px-5 pb-2 d-flex align-center">
                  <v-icon color="warning" class="mr-2" size="22">mdi-download-circle</v-icon>
                  {{ $t('components.download_center.download_missing_title') }}
                </v-card-title>

                <v-card-text class="px-5">
                  <p class="text-body-2 mb-4">
                    {{ $t('components.download_center.found_label') }} <b>{{ scanResult && scanResult.total }}</b>
                    {{ $t('components.download_center.missing_question') }}
                  </p>

                  <div class="dc-missing-counts">
                    <div v-if="scanResult && scanResult.counts && scanResult.counts.cover" class="dc-missing-row">
                      <v-icon size="16" color="primary" class="mr-2">mdi-image-album</v-icon>
                      <span class="text-body-2 flex-grow-1">
                        {{ scanResult.counts.cover }} {{ $t('components.download_center.cover_album') }}
                      </span>
                    </div>
                    <div v-if="scanResult && scanResult.counts && scanResult.counts.image" class="dc-missing-row">
                      <v-icon size="16" color="primary" class="mr-2">mdi-image</v-icon>
                      <span class="text-body-2 flex-grow-1">
                        {{ scanResult.counts.image }} {{ $t('components.download_center.image_slides') }}
                      </span>
                    </div>
                    <div v-if="scanResult && scanResult.counts && scanResult.counts.audio" class="dc-missing-row">
                      <v-icon size="16" color="primary" class="mr-2">mdi-music-note</v-icon>
                      <span class="text-body-2 flex-grow-1">
                        {{ scanResult.counts.audio }} {{ $t('components.download_center.audio_files') }}
                      </span>
                    </div>
                  </div>

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
                  <v-btn
                    color="primary"
                    variant="flat"
                    size="small"
                    prepend-icon="mdi-download"
                    @click="startMissingDownload"
                  >{{ $t('components.download_center.download_now') }}</v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </template>

          <!-- MEUS DOWNLOADS -->
          <template v-else-if="section === 'downloads'">
            <div class="dc-section-title">
              {{ $t('components.download_center.downloads') }}
              <span class="text-caption text-medium-emphasis ml-2">({{ totalSize }})</span>
            </div>

            <div v-if="localFiles.length === 0" class="text-caption text-medium-emphasis mt-3">
              {{ $t('components.download_center.no_downloads') }}
            </div>

            <template v-else>
              <!-- Álbuns -->
              <template v-if="downloadedAlbums.length > 0">
                <div class="dc-dl-group-title mt-4">
                  <v-icon size="14" class="mr-1">mdi-music-box-multiple-outline</v-icon>
                  {{ $t('components.download_center.nav_collections') }}
                  <span class="dc-dl-group-count">{{ downloadedAlbums.length }}</span>
                </div>
                <div class="dc-albums-grid mt-2">
                  <div
                    v-for="album in downloadedAlbums"
                    :key="album.id_album"
                    class="dc-album-card"
                  >
                    <div class="dc-album-img-wrap">
                      <img
                        v-if="album.url_image"
                        :src="resolveUrl(album.url_image)"
                        class="dc-album-img dc-album-img--full"
                        loading="lazy"
                      />
                      <v-icon v-else size="42" color="grey-lighten-1">mdi-music-box</v-icon>
                      <div
                        class="dc-album-badge-ok"
                        :title="albumMissingCount(album.id_album) > 0 ? `${albumMissingCount(album.id_album)} ${$t('components.download_center.files_missing')}` : $t('components.download_center.complete')"
                      >
                        <v-icon size="16" :color="albumMissingCount(album.id_album) > 0 ? 'warning' : 'success'">
                          {{ albumMissingCount(album.id_album) > 0 ? 'mdi-alert' : 'mdi-check' }}
                        </v-icon>
                      </div>
                    </div>
                    <div class="dc-album-name" :title="album.name">{{ album.name }}</div>
                  </div>
                </div>
              </template>

              <!-- {{ $t('components.download_center.nav_hymnals') }} -->
              <template v-if="downloadedHymnals.length > 0">
                <div class="dc-dl-group-title mt-4">
                  <v-icon size="14" class="mr-1">mdi-music-note</v-icon>
                  {{ $t('components.download_center.nav_hymnals') }}
                  <span class="dc-dl-group-count">{{ downloadedHymnals.length }}</span>
                </div>
                <div class="dc-albums-grid mt-2">
                  <div
                    v-for="h in downloadedHymnals"
                    :key="h.name"
                    class="dc-album-card"
                  >
                    <div
                      class="dc-album-img-wrap"
                      :style="{ background: `linear-gradient(145deg, ${h.color}dd 0%, ${h.color}88 100%)` }"
                    >
                      <img
                        v-if="h.cover"
                        :src="h.cover"
                        class="dc-hymnal-icon dc-hymnal-icon--sm"
                        loading="lazy"
                      />
                      <v-icon v-else size="52" color="white" style="opacity:0.85">{{ h.icon }}</v-icon>
                      <div class="dc-album-badge-ok">
                        <v-icon size="16" color="success">mdi-check</v-icon>
                      </div>
                    </div>
                    <div class="dc-album-name" :title="h.label">{{ h.label }}</div>
                  </div>
                </div>
              </template>

              <!-- {{ $t('components.download_center.bibles') }} -->
              <template v-if="downloadedBibleSets.length > 0">
                <div class="dc-dl-group-title mt-4">
                  <v-icon size="14" class="mr-1">mdi-book-open-variant</v-icon>
                  {{ $t('components.download_center.bibles') }}
                  <span class="dc-dl-group-count">{{ downloadedBibleSets.length }}</span>
                </div>
                <div class="dc-pkg-list mt-2">
                  <div v-for="b in downloadedBibleSets" :key="b.id" class="dc-pkg-row">
                    <v-icon size="28" :color="b.color" class="mr-3 flex-shrink-0">mdi-book-open-variant</v-icon>
                    <div class="flex-grow-1 min-w-0">
                      <div class="text-body-2 font-weight-medium">{{ b.name }}</div>
                      <div class="text-caption text-medium-emphasis">{{ formatSize(b.totalSize) }}</div>
                    </div>
                    <v-icon size="16" color="success" class="mr-2">mdi-check-circle</v-icon>
                  </div>
                </div>
              </template>

              <!-- {{ $t('components.download_center.others') }} -->
              <template v-if="downloadedOthers.length > 0">
                <div class="dc-dl-group-title mt-4">
                  <v-icon size="14" class="mr-1">mdi-file-outline</v-icon>
                  {{ $t('components.download_center.others') }}
                  <span class="dc-dl-group-count">{{ downloadedOthers.length }}</span>
                </div>
                <div class="dc-local-list mt-2">
                  <div v-for="f in downloadedOthers" :key="f.name" class="dc-local-row">
                    <v-icon size="14" color="success" class="mr-2 flex-shrink-0">mdi-check-circle</v-icon>
                    <span class="text-body-2 flex-grow-1">{{ f.name }}</span>
                    <span class="text-caption text-medium-emphasis">{{ formatSize(f.size) }}</span>
                  </div>
                </div>
              </template>
            </template>
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
        <v-btn variant="text" size="small" @click="replaceDialog = false; replaceAlbumTarget = null">
          {{ $t('components.download_center.cancel') }}
        </v-btn>
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
    albumView:     'list',
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
      return bytes ? this.fmtBytes(bytes) : '';
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
/* Título centralizado de verdade — o botão de fechar tem um espaçador do
   mesmo tamanho do lado oposto, senão o v-spacer sozinho empurraria o
   título pra esquerda (só compensando o botão de um dos lados). */
.dc-header-spacer {
  width: 32px;
  flex-shrink: 0;
}
.dc-header-title {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
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
/* ── Biblioteca Local (layout de três colunas: categorias, lista e detalhes) ── */
.lib {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr) 220px;
  gap: 14px;
  height: 100%;
  min-height: 0;
}
.lib-subtitle { font-size: 13px; opacity: 0.7; margin: 0 0 10px; }
.lib-side, .lib-detail {
  background: rgba(255,255,255,0.03);
  border-radius: 10px;
  padding: 10px;
  overflow-y: auto;
}
.lib-side-title {
  margin: 14px 6px 6px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.55;
}
.lib-cat {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  text-align: left;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.lib-cat:hover { background: rgba(255,255,255,0.05); }
.lib-cat--on { background: rgba(var(--v-theme-primary), 0.18); outline: 1px solid rgba(var(--v-theme-primary), 0.5); }
.lib-cat-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lib-count {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 10px;
  background: rgba(255,255,255,0.08);
}
.lib-main { min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.lib-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lib-search {
  flex: 1 1 220px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.05);
}
.lib-search input { flex: 1; background: transparent; outline: none; color: inherit; font-size: 13px; }
.lib-select {
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.05);
  color: inherit;
  font-size: 13px;
}
.lib-view { display: flex; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,0.05); }
.lib-view button { padding: 6px 8px; }
.lib-view--on { background: rgba(var(--v-theme-primary), 0.25); }
.lib-list { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; min-height: 0; }
.lib-list--grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
.lib-row {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto 90px;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255,255,255,0.03);
  cursor: pointer;
  border: 1px solid transparent;
}
.lib-list--grid .lib-row { grid-template-columns: 1fr; text-align: center; }
.lib-row:hover { background: rgba(255,255,255,0.06); }
.lib-row--on { border-color: rgba(var(--v-theme-primary), 0.7); background: rgba(var(--v-theme-primary), 0.12); }
.lib-cover {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.06);
}
.lib-cover img { width: 100%; height: 100%; object-fit: cover; }
.lib-info { min-width: 0; }
.lib-name { font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lib-sub { font-size: 12px; opacity: 0.6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lib-size { font-size: 12px; text-align: right; opacity: 0.8; }
.lib-detail { display: flex; flex-direction: column; gap: 10px; }
.lib-detail-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.06);
}
.lib-detail-cover img { width: 100%; height: 100%; object-fit: cover; }
.lib-detail-name { font-size: 16px; font-weight: 700; }
.lib-detail-sub { font-size: 12px; opacity: 0.6; }
.lib-status {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 12px;
  font-size: 11px;
  background: rgba(255,255,255,0.08);
}
.lib-status--ok { color: rgb(var(--v-theme-success)); background: rgba(var(--v-theme-success), 0.15); }
.lib-facts { display: flex; flex-direction: column; gap: 8px; font-size: 12px; margin-top: 4px; }
.lib-facts div { display: flex; justify-content: space-between; gap: 8px; }
.lib-facts dt { opacity: 0.6; }
.lib-facts dd { margin: 0; font-weight: 600; text-align: right; }

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
.dc-section-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; text-align: center; }

/* ── Cards da tela inicial (estilo capa) ─────────────────────────── */
.dc-home-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
.dc-home-card {
  border-radius: 12px;
  border: 1px solid rgba(128,128,128,0.15);
  overflow: hidden;
  background: rgba(128,128,128,0.04);
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: box-shadow 0.15s;
}
.dc-home-card:hover { box-shadow: 0 4px 18px rgba(0,0,0,0.18); }
.dc-home-cover {
  width: 100%;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(128,128,128,0.08);
}
.dc-home-info {
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
}
.dc-home-label {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 4px;
}
.dc-home-desc {
  font-size: 12px;
  opacity: 0.55;
}

/* ── Grid de Hinários ───────────────────────────────────────────── */
.dc-hymnal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.dc-hymnal-card {
  border-radius: 12px;
  border: 1px solid rgba(128,128,128,0.15);
  overflow: hidden;
  background: rgba(128,128,128,0.04);
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.15s;
}
.dc-hymnal-card:hover { box-shadow: 0 4px 18px rgba(0,0,0,0.18); }
.dc-hymnal-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(128,128,128,0.08);
}
.dc-hymnal-info {
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
}
.dc-hymnal-name {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 4px;
}
.dc-hymnal-desc {
  font-size: 12px;
  opacity: 0.55;
}
/* Ícone do hinário (mesmo SVG do -louvorja), desenhado inline e pintado com a cor primária do tema. */
.dc-hymnal-icon--themed {
  width: 55%;
  margin: 0 auto;
}
.dc-hymnal-icon--themed :deep(svg) { width: 100%; height: auto; display: block; }
.dc-hymnal-icon--themed :deep(path) { fill: #009fe3 !important; }

/* Barra de espaço da biblioteca (uso e disco livre), logo abaixo do título. */
.dc-storage {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 6px 14px;
  font-size: 12px;
  opacity: 0.85;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

/* Cabeçalho no modelo do flute: identidade à esquerda, espaço e fechar à direita. */
.dc-header {
  justify-content: space-between;
  padding: 16px 22px;
  min-height: 84px;
}
.dc-header-title { display: flex; align-items: center; min-width: 0; }
.dc-header-name { font-size: 20px; font-weight: 700; line-height: 1.2; margin: 0; }
.dc-header-subtitle { font-size: 13px; opacity: 0.7; }
.dc-header-actions { display: flex; align-items: center; gap: 12px; }
.dc-storage-widget {
  display: flex;
  align-items: center;
  padding: 8px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
}
.dc-storage-text { display: flex; flex-direction: column; min-width: 180px; gap: 4px; font-size: 12px; font-weight: 600; }
.dc-storage-free { font-weight: 400; opacity: 0.7; }

/* Hinários em linhas (capa à esquerda, como a lista do flute) e demais seções no mesmo visual. */
.dc-root--library .dc-hymnal-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dc-root--library .dc-hymnal-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  padding: 12px;
}
.dc-root--library .dc-hymnal-cover {
  width: 120px;
  height: 120px;
  flex-shrink: 0;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dc-root--library .dc-hymnal-info { flex: 1; min-width: 0; }
.dc-root--library .dc-hymnal-info .v-btn { max-width: 220px; }
.dc-root--library .dc-folder-row,
.dc-root--library .dc-local-row,
.dc-root--library .dc-pkg-row {
  background: #101c2e;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 10px 14px;
}

/* Biblioteca no estilo escuro do flute: paleta própria só nesta seção. */
.dc-root--library {
  color-scheme: dark;
  background: #0b1420 !important;
  color: #e6edf6;
}
.dc-root--library .dc-header,
.dc-root--library .dc-storage {
  background: #0f1b2b;
  border-bottom-color: rgba(255,255,255,0.06);
}
.dc-root--library .dc-storage {
  display: inline-flex;
  align-self: flex-start;
  margin: 10px 14px;
  padding: 6px 14px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  background: #13213a;
  font-weight: 600;
  opacity: 1;
}
.dc-root--library .lib-side,
.dc-root--library .lib-detail {
  background: #101c2e;
  border: 1px solid rgba(255,255,255,0.05);
}
.dc-root--library .lib-search,
.dc-root--library .lib-select,
.dc-root--library .lib-view {
  background: #121f33;
  border: 1px solid rgba(255,255,255,0.06);
}
.dc-root--library .lib-row {
  background: #101c2e;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
}
.dc-root--library .lib-row:hover { background: #15243a; }
.dc-root--library .lib-row--on { border-color: #009fe3; background: #13243d; }
.dc-root--library .lib-cat { color: #d9e4f2; }
.dc-root--library .lib-cat--on { background: rgba(0,159,227,0.16); outline-color: rgba(0,159,227,0.55); }
.dc-root--library .lib-count { background: rgba(255,255,255,0.1); color: #d9e4f2; }
.dc-root--library .lib-status { background: rgba(255,255,255,0.06); }
.dc-root--library .lib-cover,
.dc-root--library .lib-detail-cover { background: #0a111c; }
.dc-root--library .dc-content,
.dc-root--library .dc-sidebar { background: #0b1420; color: #e6edf6; }
/* Só nas coletâneas a barra de categorias substitui a navegação lateral. */
.dc-root--collections .dc-section-title { display: none; }
.dc-root--collections .dc-sidebar { display: none; }

/* Cartões e listas das demais seções no mesmo visual escuro da Biblioteca. */
.dc-root--library .dc-home-card,
.dc-root--library .dc-hymnal-card,
.dc-root--library .dc-album-card,
.dc-root--library .dc-pkg-row,
.dc-root--library .dc-folder-row,
.dc-root--library .dc-local-row,
.dc-root--library .dc-missing-row,
.dc-root--library .dc-bible-card {
  background: #101c2e;
  border: 1px solid rgba(255,255,255,0.05);
  color: #e6edf6;
  border-radius: 12px;
}
.dc-root--library .dc-home-card:hover,
.dc-root--library .dc-hymnal-card:hover,
.dc-root--library .dc-album-card:hover { background: #15243a; }
.dc-root--library .dc-home-cover,
.dc-root--library .dc-album-img-wrap { background: #0a111c; border-radius: 10px; }
.dc-root--library .dc-section-title,
.dc-root--library .dc-hymnal-name,
.dc-root--library .dc-home-label,
.dc-root--library .dc-album-name,
.dc-root--library .dc-folder-path { color: #eef4fb; }
.dc-root--library .dc-hymnal-desc,
.dc-root--library .dc-home-desc,
.dc-root--library .dc-folder-info,
.dc-root--library .dc-dl-group-count { color: #8fa3bd; }
.dc-root--library .dc-sidebar .v-list-item { color: #d9e4f2; }
/* Contraste do texto no fundo escuro: subtítulos e rótulos secundários. */
.dc-root--library .text-medium-emphasis,
.dc-root--library .text-caption,
.dc-root--library .dc-header-title,
.dc-root--library .dc-section-title { color: #b6c6da !important; }
.dc-root--library .dc-header-title,
.dc-root--library .dc-section-title { color: #eef4fb !important; }
.dc-root--library .v-btn--disabled { opacity: 0.5; }
.dc-root--library .dc-sidebar .v-list-item--active { background: rgba(0,159,227,0.16); }
.dc-root--library .dc-body { gap: 0; }
.dc-root--library .lib-cat { border: 1px solid transparent; }
.dc-root--library .lib-search input { border: none; box-shadow: none; }
.dc-root--library .v-btn--variant-outlined { color: #33b5ea !important; border-color: rgba(74,168,255,0.55) !important; }
.dc-root--library .v-btn--variant-flat { color: #fff !important; }
.dc-root--library .v-btn--variant-tonal { color: #33b5ea !important; background: rgba(0,159,227,0.15) !important; }
.dc-root--library .lib-name { color: #eef4fb; }
.dc-root--library .lib-sub,
.dc-root--library .lib-size,
.dc-root--library .lib-facts dt { color: #8fa3bd; }
.dc-root--library .lib-facts dd,
.dc-root--library .lib-detail-name { color: #eef4fb; }

.dc-hymnal-icon {
  width: 55%;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35));
}
.dc-hymnal-icon--sm { width: 48%; }

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
.dc-album-img--full { filter: grayscale(0) !important; }
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
  background: rgba(255,255,255,0.92);
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
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

/* ── Pastas de armazenamento ─────────────────────────────────────── */
.dc-folder-row {
  display: flex;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(128,128,128,0.06);
  border: 1px solid rgba(128,128,128,0.12);
}
.dc-folder-info {
  flex: 1;
  min-width: 0;
}
.dc-folder-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
  font-size: 11px;
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
.dc-dl-group-title {
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  opacity: 0.55;
}
.dc-dl-group-count {
  margin-left: 5px;
  font-size: 10px;
  font-weight: 400;
}
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
