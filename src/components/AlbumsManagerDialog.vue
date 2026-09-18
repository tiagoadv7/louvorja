<template>
  <v-dialog v-model="dialog" max-width="640" scrollable>
    <v-card rounded="lg" elevation="12" style="overflow:hidden">
      <div class="alb-header">
        <v-avatar size="44" color="primary" variant="tonal" class="flex-shrink-0">
          <v-icon size="22">mdi-album</v-icon>
        </v-avatar>
        <div class="flex-grow-1 min-w-0">
          <div class="text-subtitle-1 font-weight-bold">Gerenciar Álbuns</div>
          <div class="text-caption text-medium-emphasis">
            Desative álbuns pra tirá-los da lista de Músicas — sem apagar nada
          </div>
        </div>
        <v-btn icon="mdi-close" size="small" variant="text" density="comfortable" @click="dialog = false" />
      </div>
      <v-divider />

      <div class="pa-4 pb-2">
        <v-text-field
          v-model="search"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          prepend-inner-icon="mdi-magnify"
          placeholder="Buscar álbum..."
        />
      </div>

      <div class="alb-toolbar d-flex align-center px-4 pb-2" style="gap: 12px">
        <span class="text-caption text-medium-emphasis">Selecionar:</span>
        <v-btn size="small" variant="outlined" class="px-3" prepend-icon="mdi-check-all" @click="enableAll">Todos</v-btn>
        <v-btn size="small" variant="outlined" class="px-3" prepend-icon="mdi-checkbox-blank-outline" @click="disableAll">Nenhum</v-btn>
        <v-spacer />
        <v-chip size="small" color="primary" variant="tonal" prepend-icon="mdi-check">
          {{ enabledCount }} / {{ totalCount }} ativo(s)
        </v-chip>
      </div>
      <v-divider />

      <v-card-text class="pa-0" style="max-height: 420px; overflow-y: auto">
        <v-progress-linear v-if="loading" indeterminate color="primary" height="3" />
        <div v-if="error" class="pa-4 text-body-2 text-error">{{ error }}</div>

        <div v-if="!loading && filteredCategories.length === 0" class="pa-6 text-center text-body-2 text-medium-emphasis">
          Nenhum álbum encontrado
        </div>

        <v-expansion-panels v-model="expanded" multiple flat>
          <v-expansion-panel
            v-for="cat in filteredCategories"
            :key="cat.id_category"
            :value="cat.id_category"
            rounded="0"
          >
            <v-expansion-panel-title hide-actions class="alb-cat-header">
              <template #default="{ isOpen }">
                <v-icon size="16" class="me-2 flex-shrink-0">{{ isOpen ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                <v-checkbox
                  :model-value="categoryState(cat)"
                  density="compact"
                  hide-details
                  color="primary"
                  class="flex-shrink-0 me-1"
                  @click.stop="toggleCategory(cat)"
                />
                <span class="text-body-2 font-weight-medium text-truncate flex-grow-1">{{ cat.name }}</span>
                <span class="text-caption text-medium-emphasis flex-shrink-0">
                  {{ enabledInCategory(cat) }}/{{ cat.albums.length }}
                </span>
              </template>
            </v-expansion-panel-title>
            <v-expansion-panel-text class="pa-0">
              <div
                v-for="album in cat.albums"
                :key="album.id_album"
                class="alb-row"
                @click="toggleAlbum(album.id_album)"
              >
                <v-checkbox
                  :model-value="!isDisabled(album.id_album)"
                  density="compact"
                  hide-details
                  color="primary"
                  class="flex-shrink-0"
                  @click.stop="toggleAlbum(album.id_album)"
                />
                <v-avatar size="32" rounded="sm" class="flex-shrink-0 mx-2" :color="album.color || 'grey-darken-2'">
                  <v-img v-if="album.url_image" :src="album.url_image" cover />
                </v-avatar>
                <span class="text-body-2 text-truncate flex-grow-1" :class="{ 'text-medium-emphasis': isDisabled(album.id_album) }">
                  {{ album.name }}
                </span>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>

      <v-divider />
      <v-card-actions class="px-5 py-3 justify-end">
        <v-btn color="primary" variant="flat" class="px-5" @click="dialog = false">Fechar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
// Gerenciar Álbuns — mesma ideia do menu "Álbuns" do violin-app
// (src/layout/shell/AppMenuAlbums.vue): desativar um álbum some com ele (e as
// músicas que só pertencem a ele) da listagem de Músicas, sem apagar nada —
// só uma lista de ids em options.disabled_albums (ver DataTable.vue#filterData
// e modules/core/musics/interface/Index.vue). Catálogo (categorias+álbuns)
// vem do mesmo endpoint já usado pelo resto do app (ver helpers/Database.js).
export default {
  name: "AlbumsManagerDialog",
  props: {
    modelValue: Boolean,
  },
  emits: ["update:modelValue"],
  data: () => ({
    loading: false,
    error: "",
    categories: [],
    search: "",
    expanded: [],
    _loadedLocale: "",
  }),
  computed: {
    dialog: {
      get() { return this.modelValue; },
      set(v) { this.$emit("update:modelValue", v); },
    },
    locale() {
      return this.$i18n?.locale?.value || this.$i18n?.locale || "pt";
    },
    disabledAlbums() {
      return this.$userdata.get("options.disabled_albums", []);
    },
    filteredCategories() {
      const q = this.$string.clean(this.search || "");
      if (!q) return this.categories;
      return this.categories
        .map((cat) => ({ ...cat, albums: cat.albums.filter((a) => this.$string.clean(a.name).includes(q)) }))
        .filter((cat) => cat.albums.length > 0);
    },
    allAlbumIds() {
      return this.categories.flatMap((cat) => cat.albums.map((a) => a.id_album));
    },
    totalCount() {
      return this.allAlbumIds.length;
    },
    enabledCount() {
      const disabled = new Set(this.disabledAlbums);
      return this.allAlbumIds.filter((id) => !disabled.has(id)).length;
    },
  },
  watch: {
    dialog(open) {
      if (open) this.loadCategories();
    },
  },
  methods: {
    isDisabled(id) {
      return this.disabledAlbums.includes(Number(id));
    },
    toggleAlbum(id) {
      const n = Number(id);
      const list = this.disabledAlbums.slice();
      const idx = list.indexOf(n);
      if (idx === -1) list.push(n);
      else list.splice(idx, 1);
      this.$userdata.set("options.disabled_albums", list);
    },
    enabledInCategory(cat) {
      const disabled = new Set(this.disabledAlbums);
      return cat.albums.filter((a) => !disabled.has(Number(a.id_album))).length;
    },
    // true = todos ativos, false = todos desativados, null = indeterminado
    // (v-checkbox aceita null como estado indeterminado nativamente).
    categoryState(cat) {
      const enabled = this.enabledInCategory(cat);
      if (enabled === cat.albums.length) return true;
      if (enabled === 0) return false;
      return null;
    },
    toggleCategory(cat) {
      const state = this.categoryState(cat);
      const disabled = new Set(this.disabledAlbums);
      const ids = cat.albums.map((a) => Number(a.id_album));
      if (state === true) {
        // Todos ativos → desativa todos.
        ids.forEach((id) => disabled.add(id));
      } else {
        // Todos desativados OU indeterminado → ativa todos.
        ids.forEach((id) => disabled.delete(id));
      }
      this.$userdata.set("options.disabled_albums", [...disabled]);
    },
    enableAll() {
      this.$userdata.set("options.disabled_albums", []);
    },
    disableAll() {
      this.$userdata.set("options.disabled_albums", this.allAlbumIds.slice());
    },
    async loadCategories() {
      if (this._loadedLocale === this.locale && this.categories.length) return;
      this.loading = true;
      this.error = "";
      try {
        const data = await this.$database.get(`${this.locale}_categories`);
        if (!data) {
          this.error = "Não foi possível carregar os álbuns.";
          return;
        }
        this.categories = data;
        this._loadedLocale = this.locale;
        this.expanded = data.map((c) => c.id_category);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.alb-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
}
.alb-cat-header {
  display: flex;
  align-items: center;
}
.alb-row {
  display: flex;
  align-items: center;
  padding: 4px 16px 4px 40px;
  cursor: pointer;
  transition: background 0.1s;
}
.alb-row:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}
</style>
