<template>
  <ModuleContainer
    ref="moduleContainer"
    :manifest="manifest"
    @show="show"
    @close="close"
  >
    <template v-slot:header>
      <v-toolbar color="transparent" v-if="compact">
        <template v-slot:prepend>
          <v-menu>
            <template v-slot:activator="{ props }">
              <v-btn icon="$menu" v-bind="props" />
            </template>
            <v-list :color="$theme.primary()" class="d-flex flex-column h-100">
              <v-list-item
                v-for="category in categories"
                :key="category.id_category"
                :title="category.name"
                rounded="lg"
                :active="id_category == category.id_category"
                @click="setCategory(category.id_category)"
              />

              <v-divider />

              <v-list-item
                class="mt-auto"
                :title="t('all_collections')"
                rounded="lg"
                :active="id_category == 0"
                @click="setCategory(0)"
              />
            </v-list>
          </v-menu>
        </template>

        <template v-if="viewingCollection">
          <v-btn icon="mdi-arrow-left" variant="text" @click="closeCustomCollection" />
          <v-toolbar-title class="text-h6" :text="viewingCollection.nome" />
        </template>
        <v-toolbar-title
          v-else-if="!id_category || id_category == 0"
          class="text-h6"
          :text="t('all_collections')"
        />
        <v-toolbar-title
          v-else
          class="text-h6"
          :text="categories.find((c) => c.id_category == id_category).name"
        />
      </v-toolbar>
    </template>

    <template v-slot:left>
      <v-list
        v-if="!compact"
        :color="$theme.primary()"
        :width="200"
        class="d-flex flex-column h-100"
      >
        <v-progress-linear
          :color="$theme.primary()"
          indeterminate
          v-if="loading"
        />
        <v-list-item
          v-for="category in categories"
          :key="category.id_category"
          :title="category.name"
          rounded="lg"
          :active="id_category == category.id_category"
          @click="setCategory(category.id_category)"
        />

        <v-list-item
          class="mt-auto"
          :title="t('all_collections')"
          rounded="lg"
          :active="id_category == 0"
          @click="setCategory(0)"
        />
      </v-list>
    </template>

    <v-alert
      v-if="error"
      type="error"
      :text="error"
      variant="tonal"
      border="start"
      class="ma-2"
    />

    <!-- Coletânea personalizada aberta (ver openAlbum/openCustomCollection)
         — mesma tabela/menu por música de um álbum oficial de verdade (ver
         modules/core/album/interface/Index.vue), pra não abrir uma tela
         totalmente diferente (o módulo custom_collections) só pra ver o que
         tem numa coletânea. Oficiais usam o MusicMenuTable de verdade
         (id_music real); próprias abrem o slide_editor em modo apresentação
         (ver "presentationMode" lá). -->
    <div v-if="viewingCollection" class="ccv-root">
      <div v-if="!compact" class="ccv-header">
        <v-btn icon="mdi-arrow-left" variant="text" density="compact" @click="closeCustomCollection" />
        <span class="text-h6">{{ viewingCollection.nome }}</span>
      </div>
      <v-progress-linear v-if="viewingCollectionLoading" indeterminate color="primary" />
      <v-table v-else fixed-header hover class="w-100" :style="{ backgroundColor: viewingCollection.cor, color: '#FFF' }">
        <thead>
          <tr>
            <th class="text-right" :style="{ backgroundColor: viewingCollection.cor, color: '#FFF' }">{{ t('table.track') }}</th>
            <th class="text-left" :style="{ backgroundColor: viewingCollection.cor, color: '#FFF' }">{{ t('table.music_name') }}</th>
            <th :style="{ backgroundColor: viewingCollection.cor, color: '#FFF', borderLeft: 'none' }">
              <div class="d-flex justify-end align-center pe-1">
                <v-btn
                  variant="text"
                  density="compact"
                  :color="playingCustomCollection ? 'error' : 'white'"
                  :prepend-icon="playingCustomCollection ? 'mdi-stop-circle-outline' : 'mdi-play-circle-outline'"
                  :disabled="!viewingCollectionItems.length"
                  @click="toggleCustomCollectionPlayAll"
                >
                  {{ playingCustomCollection ? t('actions.stop_all') : t('actions.play_all') }}
                </v-btn>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!viewingCollectionItems.length">
            <td colspan="3" class="text-center py-4" style="opacity:0.7">{{ t('data.empty_collection') }}</td>
          </tr>
          <tr v-for="(item, index) in viewingCollectionItems" :key="`${item.type}-${item.id}`">
            <td class="text-right">{{ index + 1 }}</td>
            <td>{{ item.name }}</td>
            <td>
              <div class="d-flex justify-end">
                <MusicMenuTable
                  v-if="item.type === 'official'"
                  color="#FFF"
                  :id_music="item.id_music"
                  :has_instrumental_music="item.has_instrumental_music"
                />
                <template v-else>
                  <v-btn icon="mdi-play-box-multiple" variant="text" color="#FFF" size="small" :title="t('actions.present')" @click="apresentarCustomSong(item)" />
                  <v-menu>
                    <template #activator="{ props }">
                      <v-btn icon="mdi-menu" variant="text" color="#FFF" size="small" v-bind="props" />
                    </template>
                    <v-list density="compact">
                      <v-list-item prepend-icon="mdi-pencil" :title="t('actions.edit_in_editor')" @click="editarCustomSong(item)" />
                    </v-list>
                  </v-menu>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </v-table>
    </div>

    <div v-else class="d-flex flex-wrap justify-center">
      <v-card
        :style="
          $vuetify.display.width > 350
            ? 'min-width: 300px; max-width: 300px'
            : 'width:100%'
        "
        theme="dark"
        v-for="album in albums"
        :key="album.id_album"
        width="320"
        class="ma-2"
        :color="album.color || '#385F73'"
        dark
        @click="openAlbum(album.id_album)"
      >
        <div class="d-flex flex-no-wrap justify-space-between align-center">
          <v-avatar
            class="ma-3"
            :size="$vuetify.display.width > 350 ? 125 : 75"
            tile
            rounded="0"
            :color="album.url_image ? undefined : 'rgba(255,255,255,0.12)'"
          >
            <v-img v-if="album.url_image" :src="$path.file(album.url_image)" />
            <v-icon v-else size="42" color="rgba(255,255,255,0.55)">mdi-music</v-icon>
          </v-avatar>
          <div class="flex-grow-1 d-flex flex-column">
            <div class="text-h6 pt-2" v-text="album.name" />

            <div class="h6" v-text="album.subtitle" />
          </div>
        </div>
      </v-card>
    </div>
  </ModuleContainer>
</template>

<script>
import CustomSongs from "@/helpers/CustomSongs";
import CustomSongsPlayback from "@/helpers/CustomSongsPlayback";
import MusicMenuTable from "@/components/MusicMenuTable.vue";

// Id sintético (não-numérico, propositalmente incompatível com id_category
// real do catálogo) da categoria "Coletâneas Personalizadas" — ver
// refreshCustomCollectionsCategory()/openAlbum() abaixo.
const CUSTOM_COLLECTIONS_CATEGORY_ID = "custom_collections";

export default {
  name: manifest.id,
  components: { MusicMenuTable },
  data: () => ({
    categories: [],
    lang: null,
    id_category: null,
    loading: false,
    error: null,
    // Visualização de uma coletânea personalizada aberta (ver openAlbum/
    // openCustomCollection/closeCustomCollection) -- substitui a grade de
    // álbuns por uma tabela de músicas, igual um álbum oficial de verdade.
    viewingCollection: null,
    viewingCollectionItems: [],
    viewingCollectionLoading: false,
    officialMusicsCache: null,
    // "Reproduzir tudo" da coletânea aberta aqui -- mesmo mecanismo de
    // custom_collections/interface/Index.vue (fila sequencial, mistura
    // músicas próprias e oficiais), próprio pra esta tela não depender de
    // abrir o outro módulo só pra tocar tudo.
    playingCustomCollection: false,
    _customQueueItems: [],
    _customQueueIdx: -1,
  }),
  computed: {
    /*show() {
      let module = this.$modules.get(manifest.id);
      return module.show;
    },*/
    albums() {
      if (!this.categories) {
        return [];
      }
      if (!this.id_category) {
        return [
          ...new Map(
            this.categories
              .reduce((acc, category) => acc.concat(category.albums), [])
              .map((album) => [album.id_album, { ...album, subtitle: null }]),
          ).values(),
        ].sort((a, b) => this.$string.sort(a.name, b.name));
      }

      return this.categories
        .filter((item) => item.id_category == this.id_category)[0]
        ?.albums.sort((a, b) => a.order - b.order);
    },
    compact: function () {
      return this.$vuetify.display.width <= 600;
    },
    // Ver watchers abaixo — mesmo padrão de auto-stop do "Reproduzir tudo"
    // de custom_collections/interface/Index.vue.
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
    mediaShow(now, prev) {
      if (prev && !now && this.playingCustomCollection && !this.mediaMinimized) this._stopCustomQueue();
    },
    mediaMinimized(now, prev) {
      if (prev && !now && this.playingCustomCollection && !this.mediaShow) this._stopCustomQueue();
    },
    slideEditorShow(now, prev) {
      if (prev && !now && this.playingCustomCollection && !this.slideEditorMinimized) this._stopCustomQueue();
    },
    slideEditorMinimized(now, prev) {
      if (prev && !now && this.playingCustomCollection && !this.slideEditorShow) this._stopCustomQueue();
    },
  },
  methods: {
    async loadData() {
      this.id_category = null;
      this.categories = [];
      this.loading = true;

      this.categories = await this.$database.get(
        `${this.$i18n.locale}_categories`,
      );

      if (this.categories == null) {
        this.$modules.close(this.module_id);
        return;
      }

      for (const category of this.categories) {
        for (const album of (category.albums || [])) {
          if (album.url_image) {
            const local = await this.$electron.mediaResolveImage(album.url_image);
            if (local) album.url_image = local;
          }
        }
      }

      if (this.categories.length > 0) {
        this.categories.sort((a, b) => a.order - b.order);
        this.id_category = this.categories[0].id_category;
      } else {
        this.id_category = 0;
      }

      // Depois de escolher a categoria padrão acima (nunca a sintética).
      await this.refreshCustomCollectionsCategory();

      this.lang = this.$i18n.locale.value;
      this.loading = false;
    },
    // "Coletâneas Personalizadas" (módulo custom_collections, sem álbuns/
    // categorias de verdade no catálogo) aparece aqui como mais uma
    // categoria, logo abaixo de "Diversas" — mesmo menu/grade de álbuns das
    // coletâneas do sistema, só que cada "álbum" é uma coletânea do usuário
    // (ver openAlbum abaixo pra abrir ela de verdade). Refeita a cada
    // abertura da janela (não só quando o idioma muda) pra refletir
    // coletâneas criadas/apagadas enquanto este módulo estava fechado.
    async refreshCustomCollectionsCategory() {
      const list = await CustomSongs.listCollections();
      const albums = await Promise.all(
        list.map(async (c, idx) => ({
          id_album: `custom:${c.id}`,
          name: c.nome,
          color: c.cor || "#385F73",
          url_image: c.capa
            ? await CustomSongs.resolveCollectionCoverUrl(c.id, c.capa).catch(() => "")
            : "",
          order: idx,
          subtitle: null,
        })),
      );
      const category = {
        id_category: CUSTOM_COLLECTIONS_CATEGORY_ID,
        name: this.$t("modules.collections.custom_collections_category"),
        order: 0,
        albums,
      };

      const existingIdx = this.categories.findIndex((c) => c.id_category === CUSTOM_COLLECTIONS_CATEGORY_ID);
      if (existingIdx !== -1) {
        this.categories.splice(existingIdx, 1, category);
        return;
      }
      const diversasIdx = this.categories.findIndex(
        (c) => this.$string.clean(c.name || "") === this.$string.clean("Diversas"),
      );
      const insertAt = diversasIdx !== -1 ? diversasIdx + 1 : this.categories.length;
      this.categories.splice(insertAt, 0, category);
    },
    setCategory(id = null) {
      this.id_category = id;
    },
    openAlbum(id_album) {
      // "Álbuns" da categoria sintética (ver refreshCustomCollectionsCategory)
      // não existem no catálogo — mostra a tabela de músicas da coletânea
      // aqui mesmo (ver openCustomCollection), igual um álbum oficial de
      // verdade, em vez de pular pro módulo custom_collections.
      if (typeof id_album === "string" && id_album.startsWith("custom:")) {
        this.openCustomCollection(id_album.slice("custom:".length));
        return;
      }
      this.$media.openAlbum(id_album);
    },
    // ===== Visualização de coletânea personalizada (ver template acima) =====
    async openCustomCollection(collectionId) {
      this.viewingCollectionLoading = true;
      this.viewingCollection = null;
      this.viewingCollectionItems = [];
      try {
        const [collections, songs] = await Promise.all([
          CustomSongs.listCollections(),
          CustomSongs.listSongs(),
        ]);
        const collection = collections.find((c) => c.id === collectionId);
        if (!collection) return;
        if (!this.officialMusicsCache) await this._loadOfficialMusicsCache();
        const officialById = new Map(this.officialMusicsCache.map((m) => [Number(m.id_music), m]));
        const songsById = new Map(songs.map((s) => [s.id, s]));
        this.viewingCollection = collection;
        this.viewingCollectionItems = (collection.items || [])
          .map((item) => {
            if (item.type === "official") {
              const m = officialById.get(Number(item.id));
              return {
                type: "official",
                id: Number(item.id),
                id_music: Number(item.id),
                name: m?.name || item.nome || "?",
                has_instrumental_music: m?.has_instrumental_music || false,
              };
            }
            const s = songsById.get(item.id);
            return s ? { type: "custom", id: s.id, name: s.nome, song: s } : null;
          })
          .filter(Boolean);
      } finally {
        this.viewingCollectionLoading = false;
      }
    },
    closeCustomCollection() {
      if (this.playingCustomCollection) this._stopCustomQueue();
      this.viewingCollection = null;
      this.viewingCollectionItems = [];
    },
    async _loadOfficialMusicsCache() {
      const locale = this.$i18n?.locale?.value || this.$i18n?.locale || "pt";
      const data = await this.$database.get(`${locale}_musics`);
      const arr = Array.isArray(data) ? data : Object.values(data || {});
      this.officialMusicsCache = arr;
    },
    // Igual apresentar()/editar() de custom_collections/interface/Index.vue —
    // "Apresentar" abre em modo apresentação (sem ferramentas de edição),
    // "Editar" (no menu) abre o editor de verdade.
    apresentarCustomSong(item) {
      this.$appdata.set("modules.slide_editor.presentation_mode", true);
      this.$appdata.set("modules.slide_editor.pending_song_id", item.id);
      this.$appdata.set("modules.slide_editor.pending_autoplay", true);
      this.$modules.open("slide_editor");
      this.$popup.open("slide_editor");
    },
    editarCustomSong(item) {
      this.$appdata.set("modules.slide_editor.presentation_mode", false);
      this.$appdata.set("modules.slide_editor.pending_song_id", item.id);
      this.$modules.open("slide_editor");
    },
    // ===== "Reproduzir tudo" da coletânea aberta aqui =====
    // Mesma lógica de custom_collections/interface/Index.vue (fila
    // sequencial, mistura oficiais/próprias, encerra de vez no fim da fila)
    // — ver comentário lá pra detalhes de cada mecanismo usado.
    toggleCustomCollectionPlayAll() {
      if (this.playingCustomCollection) this._stopCustomQueue();
      else this._startCustomQueue();
    },
    _startCustomQueue() {
      const items = this.viewingCollectionItems;
      if (!items.length) return;
      this.playingCustomCollection = true;
      this._customQueueItems = items;
      this._playCustomQueueAt(0);
    },
    _playCustomQueueAt(idx) {
      const items = this._customQueueItems;
      if (idx < 0) idx = 0;
      if (idx >= items.length) {
        const lastItem = items[items.length - 1];
        if (lastItem?.type === "official") this.$media.endSong();
        else CustomSongsPlayback.stopAndClose?.();
        this._stopCustomQueue();
        return;
      }
      this._customQueueIdx = idx;
      const item = items[idx];
      const advance = () => this._playCustomQueueAt(idx + 1);

      if (item.type === "official") {
        CustomSongsPlayback.autoAdvance = null;
        CustomSongsPlayback.stopCurrent?.();
        this.$media._autoCloseCallback = advance;
        this.$media.open({ id_music: item.id, mode: "audio" });
        this.$popup.open("media");
      } else {
        this.$media._autoCloseCallback = null;
        if (this.mediaShow || this.mediaMinimized) this.$media.endSong();
        CustomSongsPlayback.autoAdvance = advance;
        this.$appdata.set("modules.slide_editor.presentation_mode", true);
        this.$appdata.set("modules.slide_editor.pending_song_id", item.id);
        this.$appdata.set("modules.slide_editor.pending_autoplay", true);
        this.$modules.open("slide_editor");
        this.$popup.open("slide_editor");
      }
    },
    _stopCustomQueue() {
      this.playingCustomCollection = false;
      this._customQueueIdx = -1;
      this._customQueueItems = [];
      if (this.$media) this.$media._autoCloseCallback = null;
      CustomSongsPlayback.autoAdvance = null;
    },
    async show(value) {
      if (value && this.lang != this.$i18n.locale.value) {
        await this.loadData();
      } else if (value) {
        if (this.categories.length > 0 && this.id_category == null) {
          this.id_category = this.categories[0].id_category;
        }
        await this.refreshCustomCollectionsCategory();
      }
    },
    close() {
      //Se fechar a janela, não manter o histórico.
      this.id_category = null;
      if (this.playingCustomCollection) this._stopCustomQueue();
      this.viewingCollection = null;
      this.viewingCollectionItems = [];
    },
  },
  async mounted() {
    await this.loadData();
  },
};
</script>

<!-- ########################################################### -->
<!-- ####### SETUP OBRIGATÓRIA PARA INSTALAÇÃO DO MODULO ####### -->
<!-- ########################################################### -->
<script setup>
import manifest from "../manifest.json";
import ModuleContainer from "@/components/ModuleContainer.vue";
import { ref } from "vue";
const moduleContainer = ref(null);
const t = (key) => {
  if (!moduleContainer.value) {
    const tr = manifest.translations?.['pt'];
    if (tr) {
      const val = key.split('.').reduce((obj, k) => obj?.[k], tr);
      if (typeof val === 'string') return val;
    }
    return key;
  }
  const result = moduleContainer.value.t(key);
  return (result && result !== `modules.${manifest.id}.${key}`) ? result : key;
};
</script>
<!-- ########################################################### -->
<!-- ########################################################### -->
<!-- ########################################################### -->

<style scoped>
.ccv-root {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.ccv-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
}
</style>
