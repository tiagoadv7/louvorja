<template>
  <l-window
    v-model="module.show"
    :title="t('title')"
    :icon="module.icon"
    :index="module.show ? 1 : 0"
    width="900"
    height="620"
    closable
    minimizable
    compact
    @close="close()"
    @minimize="$modules.minimize(module_id)"
  >
    <template v-slot:header>
      <div class="cc-header">
        <v-tabs v-model="tab" density="compact" color="primary">
          <v-tab value="songs">{{ t('tabs.songs') }}</v-tab>
          <v-tab value="collections">{{ t('tabs.collections') }}</v-tab>
          <v-tab value="search">{{ t('tabs.search') }}</v-tab>
        </v-tabs>
        <v-spacer />
        <template v-if="tab === 'songs'">
          <button class="cc-btn" @click="actNewSong">
            <v-icon size="15">mdi-plus</v-icon> {{ t('actions.new_song') }}
          </button>
          <button class="cc-btn cc-btn-outline" @click="actImport">
            <v-icon size="15">mdi-import</v-icon> {{ t('actions.import') }}
          </button>
        </template>
        <template v-else-if="tab === 'collections'">
          <button class="cc-btn" @click="actNewCollection">
            <v-icon size="15">mdi-plus</v-icon> {{ t('actions.new_collection') }}
          </button>
        </template>
      </div>
    </template>

    <!-- ── Aba: Minhas Músicas ───────────────────────────────────────────── -->
    <div v-if="tab === 'songs'" class="cc-songs">
      <div v-if="!songs.length" class="cc-empty">{{ t('data.empty_songs') }}</div>
      <div v-else class="cc-song-grid">
        <div
          v-for="s in songs" :key="s.id"
          class="cc-song-card"
          :title="t('actions.present')"
          @click="apresentar(s)"
        >
          <div class="cc-song-preview" :style="songPreviewStyle(s)">
            <div class="cc-song-actions">
              <button class="cc-icon-btn" :title="t('actions.edit')" @click.stop="editar(s)">
                <v-icon size="14">mdi-pencil</v-icon>
              </button>
              <button class="cc-icon-btn" :title="t('actions.delete')" @click.stop="confirmDeleteSong(s)">
                <v-icon size="14">mdi-delete</v-icon>
              </button>
              <v-menu>
                <template #activator="{ props }">
                  <button class="cc-icon-btn" v-bind="props" @click.stop>
                    <v-icon size="14">mdi-dots-vertical</v-icon>
                  </button>
                </template>
                <v-list density="compact">
                  <v-list-item :title="t('actions.export')" prepend-icon="mdi-download" @click="exportSong(s)" />
                  <v-list-item :title="t('actions.rename')" prepend-icon="mdi-rename-box" @click="renameSong(s)" />
                </v-list>
              </v-menu>
            </div>
            <div class="cc-song-preview-text" :style="{ color: s.slides[0]?.cor_letra || '#fff' }">
              {{ truncate(s.slides[0]?.letra || s.nome, 70) }}
            </div>
          </div>
          <div class="cc-song-name" :title="s.nome">{{ s.nome }}</div>
          <div class="cc-song-sub">
            {{ s.slides.length }} {{ t('labels.slides') }}
            <span v-if="s.audio_name"> · {{ t('labels.audio') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Aba: Coletâneas ───────────────────────────────────────────────── -->
    <!-- Grade de cards (mesmo estilo/paridade visual da aba "Minhas Músicas"
         acima) em vez da antiga lista+detalhe lado a lado -- clicar num card
         abre a coletânea em tela cheia (ver "selectedCollection" abaixo),
         com seta de voltar pra grade; nenhuma ação (renomear/excluir/trocar
         capa/tocar tudo/arrastar) muda, só o layout de navegação. -->
    <div v-else-if="tab === 'collections'" class="cc-collections">
      <!-- GRADE: nenhuma coletânea aberta -->
      <div v-if="!selectedCollection" class="cc-collection-grid">
        <div v-if="!collections.length" class="cc-empty">{{ t('data.empty_collections') }}</div>
        <div
          v-for="c in collections" :key="c.id"
          class="cc-collection-card"
          :title="c.nome"
          @click="selectedCollectionId = c.id"
        >
          <div
            class="cc-collection-card-cover"
            :style="collectionCovers[c.id] ? { backgroundImage: `url(${collectionCovers[c.id]})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: c.cor }"
          >
            <div class="cc-collection-card-actions">
              <button class="cc-icon-btn" :title="t('actions.change_cover')" @click.stop="openCoverPickerFor(c)">
                <v-icon size="14">mdi-camera-outline</v-icon>
              </button>
              <button class="cc-icon-btn" :title="t('actions.rename')" @click.stop="renameCollection(c)">
                <v-icon size="14">mdi-rename-box</v-icon>
              </button>
              <button class="cc-icon-btn" :title="t('actions.delete')" @click.stop="confirmDeleteCollection(c)">
                <v-icon size="14">mdi-delete</v-icon>
              </button>
            </div>
            <v-icon v-if="!collectionCovers[c.id]" size="42" color="rgba(255,255,255,0.55)">mdi-music-box-multiple</v-icon>
          </div>
          <div class="cc-collection-card-name" :title="c.nome">{{ c.nome }}</div>
          <div class="cc-collection-card-sub">{{ c.items.length }} {{ t('labels.songs_count') }}</div>
        </div>
      </div>

      <!-- DETALHE: coletânea aberta -->
      <div v-else class="cc-collection-body">
        <div class="cc-collection-body-head">
          <button class="cc-icon-btn cc-icon-btn-static cc-collection-back" :title="t('actions.back_to_collections')" @click="selectedCollectionId = null">
            <v-icon size="16">mdi-arrow-left</v-icon>
          </button>
            <div
              class="cc-collection-cover"
              :style="collectionCovers[selectedCollection.id] ? { backgroundImage: `url(${collectionCovers[selectedCollection.id]})` } : { background: selectedCollection.cor }"
              :title="t('actions.change_cover')"
              @click="actSetCollectionCover"
            >
              <v-icon v-if="!collectionCovers[selectedCollection.id]" size="20" color="rgba(255,255,255,0.6)" class="cc-collection-cover-icon">mdi-music</v-icon>
              <div class="cc-collection-cover-overlay">
                <v-icon size="15">mdi-camera-outline</v-icon>
              </div>
              <button
                v-if="selectedCollection.capa"
                class="cc-icon-btn cc-collection-cover-remove"
                :title="t('actions.remove_cover')"
                @click.stop="actRemoveCollectionCover"
              >
                <v-icon size="12">mdi-close</v-icon>
              </button>
            </div>
            <h3 class="cc-collection-title" :title="selectedCollection.nome">{{ selectedCollection.nome }}</h3>
            <template v-if="playingCollection">
              <button class="cc-icon-btn cc-icon-btn-static" :title="t('actions.previous')" @click="queuePrev">
                <v-icon size="14">mdi-skip-previous</v-icon>
              </button>
              <button class="cc-icon-btn cc-icon-btn-static" :title="t('actions.next')" @click="queueNext">
                <v-icon size="14">mdi-skip-next</v-icon>
              </button>
            </template>
            <button
              class="cc-btn cc-btn-outline"
              :class="{ 'cc-btn-danger-outline': playingCollection }"
              :disabled="!selectedCollectionSongs.length"
              @click="togglePlayAll"
            >
              <v-icon size="15">{{ playingCollection ? 'mdi-stop' : 'mdi-play' }}</v-icon>
              {{ playingCollection ? t('actions.stop_all') : t('actions.play_all') }}
            </button>
            <button class="cc-btn cc-btn-outline" @click="openAddSongDialog">
              <v-icon size="15">mdi-plus</v-icon> {{ t('actions.add_to_collection') }}
            </button>
          </div>

          <div v-if="!selectedCollectionSongs.length" class="cc-empty">{{ t('data.empty_collection_songs') }}</div>
          <draggable
            v-else
            v-model="selectedCollectionSongs"
            item-key="id"
            handle=".cc-drag-handle"
            @end="persistCollectionOrder"
          >
            <template #item="{ element, index }">
              <div class="cc-collection-song-row" :class="{ 'is-playing': playingCollection && index === _queueIdx }">
                <v-icon size="16" class="cc-drag-handle">mdi-drag-vertical</v-icon>
                <v-icon
                  size="13"
                  class="cc-song-type-icon"
                  :title="element.type === 'official' ? t('labels.official_catalog') : t('labels.my_songs')"
                >
                  {{ element.type === 'official' ? 'mdi-cloud-outline' : 'mdi-account-music-outline' }}
                </v-icon>
                <div class="cc-collection-song-name" :title="element.nome">
                  {{ element.nome }}
                </div>

                <!-- Música do catálogo oficial: mesmo menu usado nos Álbuns (cantado/
                     playback/sem áudio/letra) — reaproveitado tal e qual. -->
                <MusicMenuTable
                  v-if="element.type === 'official'"
                  :id_music="element.id"
                  :has_instrumental_music="element.has_instrumental_music"
                />
                <!-- Música própria: mesmo estilo (botões rápidos + menu "...") mas
                     com as ações que fazem sentido pra ela. -->
                <div v-else class="d-flex flex-nowrap">
                  <v-btn variant="text" icon="mdi-play-box-multiple" density="compact" class="mx-1" :title="t('actions.present')" @click="apresentar(element)" />
                  <v-btn variant="text" icon="mdi-pencil" density="compact" class="mx-1" :title="t('actions.edit')" @click="editar(element)" />
                  <v-menu location="start">
                    <template #activator="{ props }">
                      <v-btn variant="text" icon="mdi-menu" density="compact" class="mx-1" v-bind="props" />
                    </template>
                    <v-list density="compact">
                      <v-list-item prepend-icon="mdi-rename-box" :title="t('actions.rename')" @click="renameSong(element)" />
                      <v-list-item prepend-icon="mdi-download" :title="t('actions.export')" @click="exportSong(element)" />
                      <v-divider />
                      <v-list-item prepend-icon="mdi-close" :title="t('actions.remove_from_collection')" base-color="error" @click="removeSongFromCollection(element)" />
                    </v-list>
                  </v-menu>
                </div>

                <button v-if="element.type === 'official'" class="cc-icon-btn" :title="t('actions.remove_from_collection')" @click="removeSongFromCollection(element)">
                  <v-icon size="14">mdi-close</v-icon>
                </button>
              </div>
            </template>
          </draggable>
      </div>
    </div>

    <!-- ── Aba: Buscar (todas as coletâneas de uma vez) ───────────────────── -->
    <div v-else class="cc-search">
      <div class="cc-search-bar">
        <input v-model="searchQuery" class="cc-input cc-search-input" :placeholder="t('actions.search_placeholder')" autofocus />
        <div class="cc-search-filters">
          <button
            class="cc-filter-chip"
            :class="{ 'is-active': searchFilters.includes('name') }"
            @click="toggleSearchFilter('name')"
          >
            <v-icon size="13">{{ searchFilters.includes('name') ? 'mdi-check-circle' : 'mdi-circle-outline' }}</v-icon>
            {{ t('labels.filter_collection_name') }}
          </button>
          <button
            class="cc-filter-chip"
            :class="{ 'is-active': searchFilters.includes('songs') }"
            @click="toggleSearchFilter('songs')"
          >
            <v-icon size="13">{{ searchFilters.includes('songs') ? 'mdi-check-circle' : 'mdi-circle-outline' }}</v-icon>
            {{ t('labels.filter_song_name') }}
          </button>
        </div>
      </div>

      <div v-if="!searchQuery.trim()" class="cc-empty">{{ t('data.search_hint') }}</div>
      <div v-else-if="!searchResults.length" class="cc-empty">{{ t('data.empty_search_results') }}</div>
      <div v-else class="cc-search-results">
        <div
          v-for="r in searchResults"
          :key="`${r.collection.id}-${r.item.type}-${r.item.id}`"
          class="cc-collection-song-row cc-search-result-row"
          @click="apresentar(r.item)"
        >
          <v-icon
            size="13"
            class="cc-song-type-icon"
            :title="r.item.type === 'official' ? t('labels.official_catalog') : t('labels.my_songs')"
          >
            {{ r.item.type === 'official' ? 'mdi-cloud-outline' : 'mdi-account-music-outline' }}
          </v-icon>
          <div class="cc-collection-song-name" :title="r.item.nome">
            {{ r.item.nome }}
            <span class="cc-search-result-collection">{{ r.collection.nome }}</span>
          </div>
          <div class="d-flex flex-nowrap" @click.stop>
            <MusicMenuTable
              v-if="r.item.type === 'official'"
              :id_music="r.item.id"
              :has_instrumental_music="r.item.has_instrumental_music"
            />
            <template v-else>
              <v-btn variant="text" icon="mdi-play-box-multiple" density="compact" class="mx-1" :title="t('actions.present')" @click="apresentar(r.item)" />
              <v-btn variant="text" icon="mdi-pencil" density="compact" class="mx-1" :title="t('actions.edit')" @click="editar(r.item)" />
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Diálogo: Adicionar música (própria ou do catálogo oficial) ────── -->
    <v-dialog v-model="addSongDialog" max-width="480" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center pa-3 text-body-1 font-weight-medium">
          <v-icon start size="18">mdi-music-note-plus</v-icon>
          {{ t('actions.add_to_collection') }}
          <v-spacer />
          <v-btn icon size="small" variant="text" @click="addSongDialog = false">
            <v-icon size="16">mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <input v-model="addSongSearch" class="cc-input" :placeholder="t('actions.search_placeholder')" autofocus />

          <button class="cc-btn cc-btn-outline" style="width:100%; justify-content:center; margin-bottom:14px" @click="actImportSljaToCollection">
            <v-icon size="15">mdi-import</v-icon> {{ t('actions.import') }}
          </button>

          <div class="cc-add-section-lbl">{{ t('labels.my_songs') }}</div>
          <div class="cc-add-list">
            <div
              v-for="s in addSongCustomResults" :key="`c-${s.id}`"
              class="cc-add-row"
              @click="addSongToCollection({ type: 'custom', id: s.id })"
            >
              <span class="cc-add-row-name">{{ s.nome }}</span>
            </div>
            <div v-if="!addSongCustomResults.length" class="cc-add-row-empty">{{ t('data.empty_search_results') }}</div>
          </div>

          <div class="cc-add-section-lbl">{{ t('labels.official_catalog') }}</div>
          <div class="cc-add-list">
            <div v-if="officialMusicsLoading" class="d-flex justify-center pa-4">
              <v-progress-circular indeterminate size="24" color="primary" />
            </div>
            <template v-else>
              <div
                v-for="m in addSongOfficialResults" :key="`o-${m.id_music}`"
                class="cc-add-row"
                @click="addSongToCollection({ type: 'official', id: m.id_music, nome: m.name })"
              >
                <span class="cc-add-row-name">{{ m.name }}</span>
                <span class="cc-add-row-sub">{{ m.albums_names }}</span>
              </div>
              <div v-if="!addSongOfficialResults.length" class="cc-add-row-empty">{{ t('data.empty_search_results') }}</div>
            </template>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <input ref="fileSlja" type="file" accept=".slja,.lja" multiple hidden @change="onImportSlja" />
    <input ref="fileCollectionCover" type="file" accept="image/*,.heic,.heif" hidden @change="onPickCollectionCover" />
    <input ref="fileCollectionSlja" type="file" accept=".slja,.lja" multiple hidden @change="onImportSljaToCollection" />
  </l-window>
</template>

<script>
import manifest from '../manifest.json';
import Draggable from 'vuedraggable';
import LWindow from '@/components/Window.vue';
import MusicMenuTable from '@/components/MusicMenuTable.vue';
import CustomSongs from '@/helpers/CustomSongs';
import SljaConverter from '@/helpers/SljaConverter';
import CustomSongsPlayback from '@/helpers/CustomSongsPlayback';
import ImageConvert from '@/helpers/ImageConvert';

export default {
  name: 'CustomCollectionsModule',
  components: { LWindow, Draggable, MusicMenuTable },

  data: () => ({
    tab: 'songs',
    songs: [],
    collections: [],
    selectedCollectionId: null,
    // Cache de URL (file://) da imagem do 1º slide de cada música — preview
    // do card em "Minhas Músicas".
    previewImages: {},
    // Catálogo oficial (paridade Delphi: coletânea pode misturar músicas
    // próprias com músicas do catálogo, não só as criadas no Editor).
    officialMusics: [],
    officialMusicsLoading: false,
    addSongDialog: false,
    addSongSearch: '',
    // Aba "Buscar" — busca por nome da coletânea e/ou nome da música em
    // todas as coletâneas de uma vez (ver computed "searchResults" abaixo).
    searchQuery: '',
    searchFilters: ['name', 'songs'],
    // Cache de URL (file://) da capa de cada coletânea (ver
    // resolveCollectionCovers) — mesmo padrão de "previewImages" acima.
    collectionCovers: {},
    // "Reproduzir tudo" — fila sequencial pela coletânea selecionada.
    playingCollection: false,
    _queueItems: [],
    _queueIdx: -1,
  }),

  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */

    show() {
      return this.module.show;
    },
    selectedCollection() {
      return this.collections.find((c) => c.id === this.selectedCollectionId) || null;
    },
    officialMusicsById() {
      return new Map(this.officialMusics.map((m) => [Number(m.id_music), m]));
    },
    // get/set pro v-model do <draggable> — reordenar já persiste a nova
    // ordem (ver @end="persistCollectionOrder" no template, redundante mas
    // inofensivo com esse set também salvando). Cada item pode ser uma
    // música própria ou do catálogo oficial (ver resolveCollectionItem).
    selectedCollectionSongs: {
      get() {
        if (!this.selectedCollection) return [];
        return this.selectedCollection.items
          .map((item) => this.resolveCollectionItem(item))
          .filter(Boolean);
      },
      set(val) {
        if (!this.selectedCollection) return;
        this.selectedCollection.items = val.map((s) => (
          s.type === 'official' ? { type: 'official', id: s.id, nome: s.nome } : { type: 'custom', id: s.id }
        ));
        CustomSongs.saveCollection(this.selectedCollection);
      },
    },
    addSongCustomResults() {
      const has = new Set((this.selectedCollection?.items || []).filter((i) => i.type === 'custom').map((i) => i.id));
      const q = this.$string.clean((this.addSongSearch || '').trim());
      return this.songs
        .filter((s) => !has.has(s.id))
        .filter((s) => !q || this.$string.clean(s.nome).includes(q));
    },
    addSongOfficialResults() {
      const has = new Set((this.selectedCollection?.items || []).filter((i) => i.type === 'official').map((i) => Number(i.id)));
      const q = this.$string.clean((this.addSongSearch || '').trim());
      return this.officialMusics
        .filter((m) => !has.has(Number(m.id_music)))
        .filter((m) => !q || (m._nc || '').includes(q) || (m._ac || '').includes(q))
        .slice(0, 60);
    },
    // Aba "Buscar" — mesma lógica de busca combinada (nome da coletânea e/ou
    // nome da música) usada no módulo de coletâneas oficiais do flute-app,
    // aqui varrendo todas as coletâneas próprias de uma vez em vez de precisar
    // abrir uma por uma na aba "Coletâneas".
    searchResults() {
      const q = this.$string.clean((this.searchQuery || '').trim());
      if (!q) return [];
      const results = [];
      const seen = new Set();
      for (const c of this.collections) {
        const collectionMatches = this.searchFilters.includes('name') && this.$string.clean(c.nome || '').includes(q);
        for (const rawItem of c.items) {
          const item = this.resolveCollectionItem(rawItem);
          if (!item) continue;
          const key = `${c.id}:${item.type}:${item.id}`;
          if (seen.has(key)) continue;
          const songMatches = this.searchFilters.includes('songs') && this.$string.clean(item.nome || '').includes(q);
          if (collectionMatches || songMatches) {
            seen.add(key);
            results.push({ item, collection: c });
          }
        }
      }
      return results;
    },
    // Mesmo padrão de modules/core/album/interface/Index.vue (playingAll) —
    // detecta o operador fechando manualmente o player (oficial ou próprio)
    // no meio de "Reproduzir tudo", pra encerrar a sequência em vez de
    // deixar "playingCollection" preso em true pra sempre.
    mediaShow() {
      return !!this.$appdata.get('modules.media.show');
    },
    mediaMinimized() {
      return !!this.$appdata.get('modules.media.minimized');
    },
    slideEditorShow() {
      return !!this.$appdata.get('modules.slide_editor.show');
    },
    slideEditorMinimized() {
      return !!this.$appdata.get('modules.slide_editor.minimized');
    },
  },

  watch: {
    show(open) {
      if (open) this.loadAll();
    },
    // Trocar de coletânea no meio de "Reproduzir tudo" pararia de fazer
    // sentido (a fila era da coletânea anterior) — encerra a sequência.
    selectedCollectionId() {
      if (this.playingCollection) this._stopPlayAllCollection();
    },
    // Player oficial ($media) fechado (não minimizado) com a sequência ativa
    // → operador encerrou manualmente, não deixa "playingCollection" preso.
    mediaShow(now, prev) {
      if (prev && !now && this.playingCollection && !this.mediaMinimized) this._stopPlayAllCollection();
    },
    mediaMinimized(now, prev) {
      if (prev && !now && this.playingCollection && !this.mediaShow) this._stopPlayAllCollection();
    },
    // Mesma ideia pro lado das músicas próprias (slide_editor).
    slideEditorShow(now, prev) {
      if (prev && !now && this.playingCollection && !this.slideEditorMinimized) this._stopPlayAllCollection();
    },
    slideEditorMinimized(now, prev) {
      if (prev && !now && this.playingCollection && !this.slideEditorShow) this._stopPlayAllCollection();
    },
  },

  methods: {
    /* METHODS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      const key = `modules.${this.module_id}.${text}`;
      const result = this.$t(key);
      if (result === key) {
        if (text === 'title') return manifest.name || result;
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
        const stored = this.$appdata.get(`modules.${this.module_id}.manifest`);
        const tr = stored?.translations?.[locale] || stored?.translations?.['pt'];
        if (tr) {
          const val = text.split('.').reduce((o, k) => o?.[k], tr);
          if (typeof val === 'string') return val;
        }
      }
      return result;
    },
    close() {
      this.$modules.close(this.module_id);
    },
    /* METHODS OBRIGATÓRIAS - FIM */

    truncate(text, max = 60) {
      if (!text) return '';
      return text.length > max ? text.slice(0, max - 1) + '…' : text;
    },

    songPreviewStyle(s) {
      const slide = s.slides?.[0] || {};
      const img = this.previewImages[s.id];
      return {
        background: slide.cor_fundo || '#000',
        ...(img ? { backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
      };
    },
    async resolvePreviewImages(list) {
      const map = {};
      for (const s of list) {
        const name = s.slides?.[0]?.imagem;
        if (!name) continue;
        const url = await CustomSongs.resolveImageUrl(s.id, name);
        if (url) map[s.id] = url;
      }
      this.previewImages = map;
    },

    async loadAll() {
      this.songs = await CustomSongs.listSongs();
      this.collections = await CustomSongs.listCollections();
      this.resolvePreviewImages(this.songs);
      this.resolveCollectionCovers(this.collections);
      if (!this.officialMusics.length) this.loadOfficialMusics();
      // Deep-link de fora (ver modules/core/collections/interface/Index.vue
      // #openAlbum) -- abrir este módulo já com uma coletânea específica em
      // vez de sempre cair na primeira. Consumido uma única vez (limpo logo
      // depois), senão reabrir o módulo manualmente depois voltaria sempre
      // pra essa mesma coletânea.
      const pendingId = this.$appdata.get('modules.custom_collections.open_collection_id');
      if (pendingId) {
        this.$appdata.set('modules.custom_collections.open_collection_id', null);
        if (this.collections.some((c) => c.id === pendingId)) {
          this.selectedCollectionId = pendingId;
          this.tab = 'collections';
        }
      }
      if (!this.selectedCollectionId && this.collections.length) {
        this.selectedCollectionId = this.collections[0].id;
      }
    },
    async resolveCollectionCovers(list) {
      const map = {};
      for (const c of list) {
        if (!c.capa) continue;
        const url = await CustomSongs.resolveCollectionCoverUrl(c.id, c.capa);
        if (url) map[c.id] = url;
      }
      this.collectionCovers = map;
    },

    // Resolve um item de coletânea { type, id, nome? } pro objeto exibido na
    // lista — próprias vêm de "songs" (nome sempre atual); oficiais resolvem
    // pelo catálogo carregado e caem pro nome salvo no item se o catálogo
    // ainda não carregou (ex.: sem internet na primeira abertura).
    resolveCollectionItem(item) {
      if (item.type === 'official') {
        const m = this.officialMusicsById.get(Number(item.id));
        return {
          type: 'official',
          id: Number(item.id),
          nome: m?.name || item.nome || '?',
          albums_names: m?.albums_names || '',
          has_instrumental_music: m?.has_instrumental_music || false,
        };
      }
      const s = this.songs.find((song) => song.id === item.id);
      return s ? { ...s, type: 'custom' } : null;
    },
    async loadOfficialMusics() {
      this.officialMusicsLoading = true;
      try {
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
        const data = await this.$database.get(`${locale}_musics`);
        const arr = Array.isArray(data) ? data : Object.values(data || {});
        arr.sort((a, b) => this.$string.sort(a.name, b.name));
        this.officialMusics = arr.map((m) => ({
          ...m,
          _nc: this.$string.clean(m.name),
          _ac: this.$string.clean(m.albums_names || ''),
        }));
      } catch {
        this.officialMusics = [];
      } finally {
        this.officialMusicsLoading = false;
      }
    },

    toggleSearchFilter(filter) {
      if (this.searchFilters.includes(filter)) {
        if (this.searchFilters.length > 1) {
          this.searchFilters = this.searchFilters.filter((f) => f !== filter);
        }
        return;
      }
      this.searchFilters = [...this.searchFilters, filter];
    },

    askName(title, defaultValue) {
      return new Promise((resolve) => {
        this.$alert.prompt({ title, translate: false, input_default: defaultValue }, (val) => resolve(val));
      });
    },
    confirmYesNo(text) {
      return new Promise((resolve) => {
        this.$alert.yesno({ text, translate: false }, (btn) => resolve(btn === 'yes'));
      });
    },

    // ===== Handoff pro Editor de Músicas (ver slide_editor/interface/
    // Index.vue — computed "pendingSongId" e watch homônimo) =====
    editar(song) {
      // Modo edição de verdade -- mostra a barra de ferramentas/painéis de
      // formatação do editor (ver "presentation_mode" em
      // slide_editor/interface/Index.vue).
      this.$appdata.set('modules.slide_editor.presentation_mode', false);
      this.$appdata.set('modules.slide_editor.pending_song_id', song.id);
      this.$modules.open('slide_editor');
    },
    // Mesmo clique já seleciona E projeta (sem estado intermediário) — mesmo
    // padrão do módulo oficial Álbum/MusicMenuTable.vue. Item pode ser uma
    // música própria (abre no slide_editor) ou do catálogo oficial (abre no
    // $media, igual a clicar numa música dentro de um Álbum).
    async apresentar(item) {
      if (item.type === 'official') {
        await this.$media.open({ id_music: item.id, mode: 'audio' });
        await this.$popup.open('media');
        return;
      }
      // "Apresentar" (tocar/projetar) não é "editar" -- abre o slide_editor
      // em modo apresentação (barra de ferramentas/painéis de formatação
      // escondidos, lista de slides só-leitura, ver "presentation_mode" em
      // slide_editor/interface/Index.vue), igual ao $media acima faz pra
      // uma música oficial.
      this.$appdata.set('modules.slide_editor.presentation_mode', true);
      this.$appdata.set('modules.slide_editor.pending_song_id', item.id);
      this.$appdata.set('modules.slide_editor.pending_autoplay', true);
      this.$modules.open('slide_editor');
      await this.$popup.open('slide_editor');
    },

    // ===== Músicas =====
    async actNewSong() {
      const nome = await this.askName(this.t('actions.new_song'), this.t('actions.new_song'));
      if (!nome) return;
      const s = CustomSongs.newSong(nome);
      await CustomSongs.saveSong(s);
      this.editar(s);
      await this.loadAll();
    },
    async renameSong(s) {
      const nome = await this.askName(this.t('actions.rename'), s.nome);
      if (!nome) return;
      s.nome = nome;
      await CustomSongs.saveSong(s);
      await this.loadAll();
    },
    async confirmDeleteSong(s) {
      const ok = await this.confirmYesNo(this.t('data.confirm_delete_song'));
      if (!ok) return;
      await CustomSongs.deleteSong(s.id);
      await this.loadAll();
    },
    async exportSong(s) {
      const slidesForExport = [];
      const imagesMap = new Map();
      for (const slide of s.slides) {
        const exp = { ...slide };
        if (slide.imagem) {
          const blob = await CustomSongs.getImageBlob(s.id, slide.imagem);
          if (blob) {
            const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
            const path = `imagens/${slide.id}.${ext}`;
            if (!imagesMap.has(path)) imagesMap.set(path, blob);
            exp.imagem = path;
          } else {
            exp.imagem = '';
          }
        }
        slidesForExport.push(exp);
      }
      const audioBlob = s.audio_name ? await CustomSongs.getAudioBlob(s.id) : null;
      const blob = await SljaConverter.writeSlja({
        slides: slidesForExport,
        audio: audioBlob,
        audioName: s.audio_name || 'audio.mp3',
        images: imagesMap,
        nome: s.nome || '',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(s.nome || 'musica').replace(/[\\/:*?"<>|]/g, '_')}.slja`;
      a.click();
      URL.revokeObjectURL(url);
    },

    actImport() {
      this.$refs.fileSlja?.click();
    },
    async onImportSlja(e) {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      if (!files.length) return;

      let ok = 0;
      let fail = 0;
      for (const f of files) {
        try {
          const song = await CustomSongs.parseSljaToSong(f);
          await CustomSongs.saveSong(song);
          ok++;
        } catch {
          fail++;
        }
      }
      await this.loadAll();
      this.$alert.info({ text: `${ok} importada(s)${fail ? `, ${fail} falha(s)` : ''}`, translate: false });
    },

    // ===== Coletâneas =====
    async actNewCollection() {
      const nome = await this.askName(this.t('actions.new_collection'), this.t('actions.new_collection'));
      if (!nome) return;
      const c = CustomSongs.newCollection(nome);
      await CustomSongs.saveCollection(c);
      await this.loadAll();
      this.selectedCollectionId = c.id;
    },
    async renameCollection(c) {
      const nome = await this.askName(this.t('actions.rename'), c.nome);
      if (!nome) return;
      c.nome = nome;
      await CustomSongs.saveCollection(c);
      await this.loadAll();
    },
    async confirmDeleteCollection(c) {
      const ok = await this.confirmYesNo(this.t('data.confirm_delete_collection'));
      if (!ok) return;
      await CustomSongs.deleteCollection(c.id);
      if (this.selectedCollectionId === c.id) this.selectedCollectionId = null;
      await this.loadAll();
    },
    actSetCollectionCover() {
      this.$refs.fileCollectionCover?.click();
    },
    // Atalho pro botão de câmera no card da grade (ver aba "Coletâneas" no
    // template) -- seleciona a coletânea do card clicado antes de abrir o
    // seletor de arquivo, sem precisar entrar no detalhe primeiro.
    openCoverPickerFor(c) {
      this.selectedCollectionId = c.id;
      this.actSetCollectionCover();
    },
    async onPickCollectionCover(e) {
      const file = e.target.files[0];
      e.target.value = '';
      const c = this.selectedCollection;
      if (!file || !c) return;
      try {
        const { blob, name } = await ImageConvert.ensureRenderableImage(file.name, file);
        const stored = await CustomSongs.importCollectionCover(c.id, blob, name);
        c.capa = stored;
        await CustomSongs.saveCollection(c);
        await this.loadAll();
      } catch (err) {
        this.$alert.error({ title: 'Erro ao adicionar capa', text: String(err?.message || err), translate: false });
      }
    },
    async actRemoveCollectionCover() {
      const c = this.selectedCollection;
      if (!c) return;
      await CustomSongs.removeCollectionCover(c.id);
      c.capa = '';
      await CustomSongs.saveCollection(c);
      await this.loadAll();
    },
    openAddSongDialog() {
      this.addSongSearch = '';
      this.addSongDialog = true;
      if (!this.officialMusics.length) this.loadOfficialMusics();
    },
    actImportSljaToCollection() {
      this.$refs.fileCollectionSlja?.click();
    },
    // Importa .slja direto pra dentro da coletânea (sem passar por "Minhas
    // Músicas" antes) — a música importada entra pra biblioteca (igual
    // onImportSlja) E já é adicionada na coletânea selecionada num só passo.
    async onImportSljaToCollection(e) {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      if (!files.length || !this.selectedCollection) return;

      let ok = 0;
      let fail = 0;
      for (const f of files) {
        try {
          const song = await CustomSongs.parseSljaToSong(f);
          await CustomSongs.saveSong(song);
          await this.addSongToCollection({ type: 'custom', id: song.id });
          ok++;
        } catch {
          fail++;
        }
      }
      this.$alert.info({ text: `${ok} importada(s)${fail ? `, ${fail} falha(s)` : ''}`, translate: false });
    },
    // entry: { type: 'custom', id } ou { type: 'official', id, nome }
    async addSongToCollection(entry) {
      const c = this.selectedCollection;
      if (!c) return;
      const exists = c.items.some((i) => i.type === entry.type && String(i.id) === String(entry.id));
      if (!exists) c.items.push(entry);
      await CustomSongs.saveCollection(c);
      await this.loadAll();
    },
    async removeSongFromCollection(item) {
      const c = this.selectedCollection;
      if (!c) return;
      c.items = c.items.filter((i) => !(i.type === item.type && String(i.id) === String(item.id)));
      await CustomSongs.saveCollection(c);
      await this.loadAll();
    },
    async persistCollectionOrder() {
      if (!this.selectedCollection) return;
      await CustomSongs.saveCollection(this.selectedCollection);
    },

    // ===== "Reproduzir tudo" — fila sequencial pela coletânea =====
    // Mistura músicas próprias (slide_editor) e do catálogo oficial ($media):
    // cada uma tem seu próprio mecanismo de "avançar automaticamente no fim"
    // (CustomSongsPlayback.autoAdvance / $media._autoCloseCallback) — aqui só
    // decide qual usar a cada passo e desliga o do lado que não está ativo.
    togglePlayAll() {
      if (this.playingCollection) this._stopPlayAllCollection();
      else this._startPlayAllCollection();
    },
    _startPlayAllCollection() {
      const items = this.selectedCollectionSongs;
      if (!items.length) return;
      this.playingCollection = true;
      this._queueItems = items;
      this._playQueueAt(0);
    },
    _playQueueAt(idx) {
      const items = this._queueItems;
      if (idx < 0) idx = 0;
      if (idx >= items.length) {
        // Fim da fila: encerra de verdade a apresentação da última música
        // tocada (mesmo padrão de modules/core/album/interface/Index.vue —
        // "self._stopPlayAll(); self.$media.endSong();"), senão a tela de
        // saída ficava presa mostrando o último slide/áudio pra sempre em
        // vez de encerrar a projeção sozinha.
        const lastItem = items[items.length - 1];
        if (lastItem?.type === 'official') {
          this.$media.endSong();
        } else {
          CustomSongsPlayback.stopAndClose?.();
        }
        this._stopPlayAllCollection();
        return;
      }
      this._queueIdx = idx;
      const item = items[idx];
      const advance = () => this._playQueueAt(idx + 1);

      if (item.type === 'official') {
        CustomSongsPlayback.autoAdvance = null;
        CustomSongsPlayback.stopCurrent?.();
        this.$media._autoCloseCallback = advance;
        this.$media.open({ id_music: item.id, mode: 'audio' });
        this.$popup.open('media');
      } else {
        this.$media._autoCloseCallback = null;
        // Troca vindo de uma música oficial tocando: silencia antes de trocar
        // pro slide_editor, senão o áudio oficial continuaria tocando por cima.
        if (this.$appdata.get('modules.media.show') || this.$appdata.get('modules.media.minimized')) {
          this.$media.endSong();
        }
        CustomSongsPlayback.autoAdvance = advance;
        this.$appdata.set('modules.slide_editor.pending_song_id', item.id);
        this.$appdata.set('modules.slide_editor.pending_autoplay', true);
        this.$modules.open('slide_editor');
        this.$popup.open('slide_editor');
      }
    },
    _stopPlayAllCollection() {
      this.playingCollection = false;
      this._queueIdx = -1;
      this._queueItems = [];
      if (this.$media) this.$media._autoCloseCallback = null;
      CustomSongsPlayback.autoAdvance = null;
    },
    queueNext() {
      if (this.playingCollection) this._playQueueAt(this._queueIdx + 1);
    },
    queuePrev() {
      if (this.playingCollection) this._playQueueAt(this._queueIdx - 1);
    },
  },

  mounted() {
    this.loadAll();
  },
  beforeUnmount() {
    if (this.playingCollection) this._stopPlayAllCollection();
  },
};
</script>

<style scoped>
.cc-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.cc-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: 8px;
  border: none;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: filter 0.15s;
}
.cc-btn:hover { filter: brightness(1.08); }
.cc-btn-outline {
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.cc-btn-outline:hover { background: rgba(var(--v-theme-on-surface), 0.06); }
.cc-btn:disabled { opacity: 0.5; cursor: default; pointer-events: none; }
.cc-btn-danger-outline {
  color: rgb(var(--v-theme-error));
  border-color: rgba(var(--v-theme-error), 0.5);
}
.cc-btn-danger-outline:hover { background: rgba(var(--v-theme-error), 0.08); }

.cc-icon-btn-static {
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgb(var(--v-theme-on-surface));
}
.cc-icon-btn-static:hover { background: rgba(var(--v-theme-on-surface), 0.16); }

.cc-icon-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s;
  flex-shrink: 0;
}
.cc-icon-btn:hover { background: rgba(0, 0, 0, 0.65); }

.cc-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.45);
}

/* ── Aba Músicas ─────────────────────────────────────────────────────── */
.cc-songs { padding: 12px 16px; }
.cc-song-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}
.cc-song-card {
  width: 210px;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(var(--v-theme-on-surface), 0.03);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  transition: box-shadow 0.15s, transform 0.1s;
}
.cc-song-card:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  transform: translateY(-1px);
}
.cc-song-preview {
  position: relative;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  overflow: hidden;
}
.cc-song-actions {
  position: absolute;
  top: 5px;
  right: 5px;
  display: flex;
  gap: 3px;
  z-index: 1;
}
.cc-song-preview-text {
  font-size: 11px;
  text-align: center;
  white-space: pre-line;
  width: 100%;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}
.cc-song-name {
  padding: 8px 10px 0;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-song-sub {
  padding: 2px 10px 8px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

/* ── Aba Coletâneas ──────────────────────────────────────────────────── */
.cc-collections {
  height: 100%;
  overflow-y: auto;
}
/* Grade de cards -- mesma paridade visual da grade de "Minhas Músicas"
   (.cc-song-grid/.cc-song-card acima) e do estilo do flute-app. */
.cc-collection-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 12px 16px;
}
.cc-collection-card {
  width: 170px;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(var(--v-theme-on-surface), 0.03);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  transition: box-shadow 0.15s, transform 0.1s;
}
.cc-collection-card:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  transform: translateY(-1px);
}
.cc-collection-card-cover {
  position: relative;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-size: cover;
  background-position: center;
  overflow: hidden;
}
.cc-collection-card-actions {
  position: absolute;
  top: 5px;
  right: 5px;
  display: flex;
  gap: 3px;
  z-index: 1;
  opacity: 0;
  transition: opacity 0.15s;
}
.cc-collection-card:hover .cc-collection-card-actions { opacity: 1; }
.cc-collection-card-name {
  padding: 8px 10px 0;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-collection-card-sub {
  padding: 2px 10px 8px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.cc-collection-back { flex-shrink: 0; }

.cc-collection-body {
  height: 100%;
  padding: 12px 16px;
  overflow-y: auto;
}
.cc-collection-body-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.cc-collection-cover {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  flex-shrink: 0;
  cursor: pointer;
  background-size: cover;
  background-position: center;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  overflow: hidden;
}
.cc-collection-cover-icon {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 20px;
  height: 20px;
}
.cc-collection-cover-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(0, 0, 0, 0.25);
  opacity: 0;
  transition: opacity 0.12s;
}
.cc-collection-cover:hover .cc-collection-cover-overlay { opacity: 1; }
.cc-collection-cover-remove {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
}
.cc-collection-title {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cc-collection-song-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
  border-bottom: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.4));
}
.cc-collection-song-row.is-playing {
  background: rgba(var(--v-theme-primary), 0.12);
  border-radius: 6px;
}
.cc-drag-handle {
  cursor: grab;
  opacity: 0.5;
  flex-shrink: 0;
}
.cc-song-type-icon {
  opacity: 0.55;
  flex-shrink: 0;
}
.cc-collection-song-name {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Aba Buscar ───────────────────────────────────────────────────────── */
.cc-search {
  padding: 12px 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cc-search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.cc-search-input {
  flex: 1;
  margin-bottom: 0;
}
.cc-search-filters {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.cc-filter-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: transparent;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.cc-filter-chip:hover { background: rgba(var(--v-theme-on-surface), 0.06); }
.cc-filter-chip.is-active {
  border-color: rgba(var(--v-theme-primary), 0.6);
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}
.cc-search-results {
  flex: 1;
  overflow-y: auto;
  margin-top: 8px;
}
.cc-search-result-row { cursor: pointer; }
.cc-search-result-collection {
  display: block;
  font-size: 11px;
  font-weight: 400;
  opacity: 0.55;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Diálogo: adicionar música ───────────────────────────────────────── */
.cc-input {
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: transparent;
  color: inherit;
  font-size: 13px;
  margin-bottom: 10px;
}
.cc-add-section-lbl {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
  font-weight: 600;
  margin: 14px 0 6px;
}
.cc-add-section-lbl:first-of-type { margin-top: 0; }
.cc-add-list {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.6));
  border-radius: 6px;
}
.cc-add-row {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 8px 10px;
  cursor: pointer;
  border-bottom: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.4));
}
.cc-add-row:last-child { border-bottom: none; }
.cc-add-row:hover { background: rgba(var(--v-theme-on-surface), 0.06); }
.cc-add-row-name { font-size: 13px; }
.cc-add-row-sub { font-size: 11px; opacity: 0.6; }
.cc-add-row-empty {
  padding: 14px 10px;
  text-align: center;
  font-size: 12px;
  opacity: 0.5;
}
</style>
