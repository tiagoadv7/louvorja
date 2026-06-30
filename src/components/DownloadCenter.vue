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
              <v-col v-for="item in navItems.filter(i => i.section !== 'home')" :key="item.section" cols="6">
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
            <div class="dc-hymnal-grid mt-3">
              <div v-for="h in hymnalItems" :key="h.file" class="dc-hymnal-card">
                <!-- Capa: imagem real ou gradiente como fallback -->
                <div
                  class="dc-hymnal-cover"
                  :style="h.cover ? {} : { background: `linear-gradient(145deg, ${h.color}ee 0%, ${h.color}99 100%)` }"
                >
                  <img
                    v-if="h.cover"
                    :src="resolveUrl(h.cover)"
                    class="dc-hymnal-img"
                    loading="lazy"
                  />
                  <v-icon v-else size="72" color="white" style="opacity:0.9">{{ h.icon }}</v-icon>
                  <div v-if="isDownloaded(h.file)" class="dc-album-badge-ok">
                    <v-icon size="18" color="success">mdi-check</v-icon>
                  </div>
                </div>

                <!-- Info + botão -->
                <div class="dc-hymnal-info">
                  <div class="dc-hymnal-name">{{ h.name }}</div>
                  <div class="dc-hymnal-desc">{{ h.description }}</div>
                  <v-btn
                    :color="isDownloaded(h.file) ? 'success' : 'primary'"
                    variant="tonal"
                    size="small"
                    block
                    class="mt-3"
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
                    <v-icon size="16" color="success">mdi-check</v-icon>
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
            <v-card
              variant="tonal"
              :color="localEnabled ? 'success' : 'primary'"
              class="mt-3 mb-3"
            >
              <v-card-text class="pa-4">
                <div class="d-flex align-center">
                  <v-icon class="mr-3" size="28">
                    {{ localEnabled ? 'mdi-wifi-off' : 'mdi-wifi' }}
                  </v-icon>
                  <div class="flex-grow-1">
                    <div class="text-body-2 font-weight-medium">
                      {{ localEnabled ? 'Modo Offline' : 'Modo Online' }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      {{ userFiles.length }} arquivo(s) baixado(s) • {{ totalSize }}
                    </div>
                  </div>
                  <v-switch
                    :model-value="localEnabled"
                    @update:modelValue="setOfflineMode"
                    :color="localEnabled ? 'success' : 'grey'"
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

            <!-- Pastas locais -->
            <div class="text-subtitle-2 mb-3">Pastas de armazenamento</div>

            <div v-if="dbFolder" class="dc-folder-row mb-2">
              <v-icon size="16" class="mr-2" color="primary">mdi-database-outline</v-icon>
              <div class="dc-folder-info">
                <div class="text-caption font-weight-medium">Banco de dados (JSON)</div>
                <div class="dc-folder-path text-caption text-medium-emphasis" :title="dbFolder">{{ dbFolder }}</div>
              </div>
              <v-btn
                icon="mdi-folder-open-outline"
                variant="text"
                size="x-small"
                density="compact"
                class="ml-1"
                title="Abrir pasta"
                @click="$electron.shellOpenFolder(dbFolder)"
              />
            </div>

            <div v-if="configFolder" class="dc-folder-row mb-4">
              <v-icon size="16" class="mr-2" color="primary">mdi-folder-music-outline</v-icon>
              <div class="dc-folder-info">
                <div class="text-caption font-weight-medium">Mídias (capas, áudios, imagens)</div>
                <div class="dc-folder-path text-caption text-medium-emphasis" :title="configFolder">{{ configFolder }}</div>
              </div>
              <v-btn
                icon="mdi-folder-open-outline"
                variant="text"
                size="x-small"
                density="compact"
                class="ml-1"
                title="Abrir pasta"
                @click="$electron.shellOpenFolder(configFolder)"
              />
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
                <div class="d-flex gap-3 flex-wrap mb-2">
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
                <div v-if="configFolder" class="text-caption text-medium-emphasis" style="word-break:break-all">
                  Pasta verificada: <span class="font-weight-medium" style="font-family:monospace">{{ configFolder }}</span>
                  <v-btn
                    variant="text"
                    size="x-small"
                    density="compact"
                    class="ml-1"
                    @click="$electron.shellOpenFolder(configFolder)"
                  >Abrir</v-btn>
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
                    </div>
                    <div v-if="scanResult && scanResult.counts && scanResult.counts.image" class="dc-missing-row">
                      <v-icon size="16" color="primary" class="mr-2">mdi-image</v-icon>
                      <span class="text-body-2 flex-grow-1">
                        {{ scanResult.counts.image }} imagem(ns) de slides
                      </span>
                    </div>
                    <div v-if="scanResult && scanResult.counts && scanResult.counts.audio" class="dc-missing-row">
                      <v-icon size="16" color="primary" class="mr-2">mdi-music-note</v-icon>
                      <span class="text-body-2 flex-grow-1">
                        {{ scanResult.counts.audio }} arquivo(s) de áudio
                      </span>
                    </div>
                  </div>

                  <v-alert type="info" variant="tonal" density="compact" class="mt-4">
                    <div class="text-caption">
                      Os arquivos serão salvos em subpastas de:
                      <span class="font-weight-medium" style="word-break:break-all">{{ configFolder || 'config/' }}</span>
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
              <span class="text-caption text-medium-emphasis ml-2">({{ totalSize }})</span>
            </div>

            <div v-if="localFiles.length === 0" class="text-caption text-medium-emphasis mt-3">
              Nenhum arquivo baixado ainda.
            </div>

            <template v-else>
              <!-- Álbuns -->
              <template v-if="downloadedAlbums.length > 0">
                <div class="dc-dl-group-title mt-4">
                  <v-icon size="14" class="mr-1">mdi-music-box-multiple-outline</v-icon>
                  Coletâneas
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
                      <div class="dc-album-badge-ok">
                        <v-icon size="16" color="success">mdi-check</v-icon>
                      </div>
                    </div>
                    <div class="dc-album-name" :title="album.name">{{ album.name }}</div>
                  </div>
                </div>
              </template>

              <!-- Hinários -->
              <template v-if="downloadedHymnals.length > 0">
                <div class="dc-dl-group-title mt-4">
                  <v-icon size="14" class="mr-1">mdi-music-note</v-icon>
                  Hinários
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
                      :style="h.cover ? {} : { background: `linear-gradient(145deg, ${h.color}dd 0%, ${h.color}88 100%)` }"
                    >
                      <img
                        v-if="h.cover"
                        :src="resolveUrl(h.cover)"
                        class="dc-album-img dc-album-img--full"
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

              <!-- Bíblias -->
              <template v-if="downloadedBibleSets.length > 0">
                <div class="dc-dl-group-title mt-4">
                  <v-icon size="14" class="mr-1">mdi-book-open-variant</v-icon>
                  Bíblias
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

              <!-- Outros -->
              <template v-if="downloadedOthers.length > 0">
                <div class="dc-dl-group-title mt-4">
                  <v-icon size="14" class="mr-1">mdi-file-outline</v-icon>
                  Outros
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
  { file: 'pt_hymnal',      name: 'Hinário 2022', description: 'Hinário moderno',           cover: '/covers/hasd.bmp', icon: 'mdi-music-note',        color: '#1565C0' },
  { file: 'pt_hymnal_1996', name: 'Hinário 1996', description: 'Hinário histórico de 1996', cover: '/covers/hasd.bmp', icon: 'mdi-music-note-outline', color: '#6A1B9A' },
];

const BIBLE_ITEMS = [
  { id: 'bible_pt', name: 'Bíblia Português', files: ['pt_bible_book', 'pt_bible_version'], color: 'green' },
  { id: 'bible_es', name: 'Biblia Español',   files: ['es_bible_book', 'es_bible_version'], color: 'orange' },
];

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
    // Infos dos álbuns baixados (id_album -> {name, url_image})
    downloadedAlbumInfos:  {},
    // Caminhos das pastas locais
    dbFolder:     '',
    configFolder: '',
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
      const map = Object.fromEntries(HYMNAL_ITEMS.map(h => [h.file, h]));
      return this.localFiles
        .filter(f => map[f.name])
        .map(f => ({ ...f, label: map[f.name].name, icon: map[f.name].icon, color: map[f.name].color, cover: map[f.name].cover || '' }));
    },

    downloadedBibleSets() {
      const sizeMap = Object.fromEntries(this.localFiles.map(f => [f.name, f.size || 0]));
      const downloaded = new Set(this.localFiles.map(f => f.name));
      return BIBLE_ITEMS
        .filter(b => b.files.some(f => downloaded.has(f)))
        .map(b => ({ ...b, totalSize: b.files.reduce((s, f) => s + (sizeMap[f] || 0), 0) }));
    },

    downloadedOthers() {
      const known = new Set([
        ...HYMNAL_ITEMS.map(h => h.file),
        ...BIBLE_ITEMS.flatMap(b => b.files),
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
        this.localEnabled = $storage.get('db_local_enabled', false) === true;
        this.init();
        this.subscribeProgress();
      } else {
        this.section = 'home';
        this.unsubscribeProgress();
        this.unsubscribeMissingProgress();
      }
    },

    setOfflineMode(val) {
      this.localEnabled = val;
      $storage.set('db_local_enabled', val);

      // Limpa o cache de sessão da API (db:*) para que o próximo acesso
      // use o modo correto (local ou API) sem servir dados em cache
      $storage.removeAll('db', 'session');

      // Recarrega os dados do álbum/categorias com o novo modo
      this.init();
    },

    async init() {
      await this.loadLocalFiles();
      if (this.section === 'collections') await this.loadCategories();
      if (this.section === 'downloads') await this.loadDownloadedAlbumInfos();
      if (this.section === 'settings') await this.loadFolderPaths();
    },

    async goTo(s) {
      this.section = s;
      if (s === 'collections' && this.categories.length === 0) await this.loadCategories();
      if (s === 'downloads') {
        await this.loadLocalFiles();
        await this.loadDownloadedAlbumInfos();
      }
      if (s === 'settings') {
        await this.loadLocalFiles();
        await this.loadFolderPaths();
      }
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

    async loadFolderPaths() {
      if (!this.isElectron) return;
      this.dbFolder     = await this.$electron.dbGetActualDir() || '';
      this.configFolder = await this.$electron.configGetDir()   || '';
    },

    async loadDownloadedAlbumInfos() {
      const albumFiles = this.localFiles.filter(f => f.name.startsWith('album_'));
      if (!albumFiles.length) { this.downloadedAlbumInfos = {}; return; }

      // Garante que as categories estão carregadas para buscar nome e capa
      if (!this.categories.length) await this.loadCategories();

      const infos = {};
      for (const f of albumFiles) {
        const id = f.name.replace('album_', '');
        let found = null;

        // Busca nas categories (fonte mais completa — tem nome e url_image)
        for (const cat of this.categories) {
          const album = (cat.albums || []).find(a => String(a.id_album) === String(id));
          if (album) { found = { name: album.name, url_image: album.url_image || '' }; break; }
        }

        // Fallback: lê do banco local
        if (!found) {
          try {
            const data = await this.$electron.dbLocalGet(f.name);
            found = { name: data?.name || f.name, url_image: data?.url_image || '' };
          } catch {
            found = { name: f.name, url_image: '' };
          }
        }

        infos[id] = found || { name: f.name, url_image: '' };
      }
      this.downloadedAlbumInfos = infos;
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
        if (!ok) this.$alert?.error?.({ text: `Falha ao baixar: ${filename}. Verifique sua conexão.`, translate: false });
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
        if (failed.length) this.$alert?.error?.({ text: `Falha ao baixar: ${failed.join(', ')}. Verifique sua conexão.`, translate: false });
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
          // Recarrega categorias para que as capas com URL app-local:// sejam exibidas
          await this.loadCategories();
          if ((s.skipped || 0) > 0 && !overwrite) {
            this.$alert?.info?.({
              text: `${s.skipped} arquivo(s) já existiam e foram ignorados. Use "Substituir" para forçar o re-download.`,
              translate: false,
            });
          }
        } else {
          this.$alert?.error?.({
            text: `Falha ao baixar álbum "${album.name}": ${result.error || 'erro desconhecido'}`,
            translate: false,
          });
        }
        await this.loadLocalFiles();
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
          this.$alert?.error?.({ text: result.error || 'Erro ao baixar arquivos.', translate: false });
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
.dc-hymnal-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

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
