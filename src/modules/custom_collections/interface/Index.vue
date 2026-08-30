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
        <template v-else>
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
    <div v-else class="cc-collections">
      <div class="cc-collections-list">
        <div v-if="!collections.length" class="cc-empty">{{ t('data.empty_collections') }}</div>
        <div
          v-for="c in collections" :key="c.id"
          class="cc-collection-item"
          :class="{ 'is-active': selectedCollectionId === c.id }"
          @click="selectedCollectionId = c.id"
        >
          <span class="cc-color-dot" :style="{ background: c.cor }" />
          <div class="cc-collection-info">
            <div class="cc-collection-name" :title="c.nome">{{ c.nome }}</div>
            <div class="cc-collection-count">{{ c.song_ids.length }} {{ t('labels.songs_count') }}</div>
          </div>
          <v-menu>
            <template #activator="{ props }">
              <button class="cc-icon-btn" v-bind="props" @click.stop>
                <v-icon size="14">mdi-dots-vertical</v-icon>
              </button>
            </template>
            <v-list density="compact">
              <v-list-item :title="t('actions.rename')" prepend-icon="mdi-rename-box" @click="renameCollection(c)" />
              <v-list-item :title="t('actions.delete')" prepend-icon="mdi-delete" base-color="error" @click="confirmDeleteCollection(c)" />
            </v-list>
          </v-menu>
        </div>
      </div>

      <div class="cc-collection-body">
        <div v-if="!selectedCollection" class="cc-empty">{{ t('data.select_collection') }}</div>
        <template v-else>
          <div class="cc-collection-body-head">
            <h3 class="cc-collection-title" :title="selectedCollection.nome">{{ selectedCollection.nome }}</h3>
            <v-menu>
              <template #activator="{ props }">
                <button class="cc-btn cc-btn-outline" v-bind="props">
                  <v-icon size="15">mdi-plus</v-icon> {{ t('actions.add_to_collection') }}
                </button>
              </template>
              <v-list density="compact" max-height="360" style="overflow-y:auto">
                <v-list-item v-for="s in songsNotInSelected" :key="s.id" :title="s.nome" @click="addSongToCollection(s.id)" />
                <v-list-item v-if="!songsNotInSelected.length" :title="t('data.empty_songs')" disabled />
              </v-list>
            </v-menu>
          </div>

          <div v-if="!selectedCollectionSongs.length" class="cc-empty">{{ t('data.empty_collection_songs') }}</div>
          <draggable
            v-else
            v-model="selectedCollectionSongs"
            item-key="id"
            handle=".cc-drag-handle"
            @end="persistCollectionOrder"
          >
            <template #item="{ element }">
              <div class="cc-collection-song-row">
                <v-icon size="16" class="cc-drag-handle">mdi-drag-vertical</v-icon>
                <div class="cc-collection-song-name" :title="t('actions.present')" @click="apresentar(element)">
                  {{ element.nome }}
                </div>
                <button class="cc-icon-btn" :title="t('actions.edit')" @click="editar(element)">
                  <v-icon size="14">mdi-pencil</v-icon>
                </button>
                <button class="cc-icon-btn" :title="t('actions.remove_from_collection')" @click="removeSongFromCollection(element.id)">
                  <v-icon size="14">mdi-close</v-icon>
                </button>
              </div>
            </template>
          </draggable>
        </template>
      </div>
    </div>

    <input ref="fileSlja" type="file" accept=".slja,.lja" multiple hidden @change="onImportSlja" />
  </l-window>
</template>

<script>
import manifest from '../manifest.json';
import Draggable from 'vuedraggable';
import LWindow from '@/components/Window.vue';
import CustomSongs from '@/helpers/CustomSongs';
import SljaConverter from '@/helpers/SljaConverter';

export default {
  name: 'CustomCollectionsModule',
  components: { LWindow, Draggable },

  data: () => ({
    tab: 'songs',
    songs: [],
    collections: [],
    selectedCollectionId: null,
    // Cache de URL (file://) da imagem do 1º slide de cada música — preview
    // do card em "Minhas Músicas".
    previewImages: {},
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
    // get/set pro v-model do <draggable> — reordenar já persiste a nova
    // ordem (ver @end="persistCollectionOrder" no template, redundante mas
    // inofensivo com esse set também salvando).
    selectedCollectionSongs: {
      get() {
        if (!this.selectedCollection) return [];
        return this.selectedCollection.song_ids
          .map((id) => this.songs.find((s) => s.id === id))
          .filter(Boolean);
      },
      set(val) {
        if (!this.selectedCollection) return;
        this.selectedCollection.song_ids = val.map((s) => s.id);
        CustomSongs.saveCollection(this.selectedCollection);
      },
    },
    songsNotInSelected() {
      if (!this.selectedCollection) return this.songs;
      const has = new Set(this.selectedCollection.song_ids);
      return this.songs.filter((s) => !has.has(s.id));
    },
  },

  watch: {
    show(open) {
      if (open) this.loadAll();
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
      if (!this.selectedCollectionId && this.collections.length) {
        this.selectedCollectionId = this.collections[0].id;
      }
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
      this.$appdata.set('modules.slide_editor.pending_song_id', song.id);
      this.$modules.open('slide_editor');
    },
    // Mesmo clique já seleciona E projeta (sem estado intermediário) — mesmo
    // padrão do módulo oficial Álbum/MusicMenuTable.vue.
    async apresentar(song) {
      this.$appdata.set('modules.slide_editor.pending_song_id', song.id);
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
    async addSongToCollection(songId) {
      const c = this.selectedCollection;
      if (!c) return;
      if (!c.song_ids.includes(songId)) c.song_ids.push(songId);
      await CustomSongs.saveCollection(c);
      await this.loadAll();
    },
    async removeSongFromCollection(songId) {
      const c = this.selectedCollection;
      if (!c) return;
      c.song_ids = c.song_ids.filter((id) => id !== songId);
      await CustomSongs.saveCollection(c);
      await this.loadAll();
    },
    async persistCollectionOrder() {
      if (!this.selectedCollection) return;
      await CustomSongs.saveCollection(this.selectedCollection);
    },
  },

  mounted() {
    this.loadAll();
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
  display: flex;
  height: 100%;
}
.cc-collections-list {
  width: 240px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.cc-collection-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.5));
  transition: background 0.1s;
}
.cc-collection-item:hover { background: rgba(var(--v-theme-on-surface), 0.05); }
.cc-collection-item.is-active { background: rgba(var(--v-theme-primary), 0.12); }
.cc-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.15);
}
.cc-collection-info { flex: 1; min-width: 0; }
.cc-collection-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-collection-count {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.cc-collection-body {
  flex: 1;
  min-width: 0;
  padding: 12px 16px;
  overflow-y: auto;
}
.cc-collection-body-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
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
.cc-drag-handle {
  cursor: grab;
  opacity: 0.5;
  flex-shrink: 0;
}
.cc-collection-song-name {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-collection-song-name:hover { text-decoration: underline; }
</style>
