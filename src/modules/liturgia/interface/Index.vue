<template>
  <Window
    v-model="module.show"
    :title="t('title')"
    :icon="module.icon"
    closable
    compact
    @close="close()"
    @minimize="close()"
  >
    <!-- Botões de sistema -->
    <template v-slot:system_buttons>
      <v-btn
        variant="tonal"
        size="small"
        color="white"
        prepend-icon="mdi-plus"
        class="me-2"
        @click="openAddDialog"
      >
        {{ t('buttons.add') }}
      </v-btn>
      <v-btn
        v-if="liturgyList.length > 0"
        icon
        variant="text"
        size="small"
        color="white"
        @click="clearAll"
      >
        <v-icon size="20">mdi-playlist-remove</v-icon>
        <v-tooltip activator="parent" location="bottom">{{ t('buttons.clear') }}</v-tooltip>
      </v-btn>
    </template>

    <!-- Lista vazia -->
    <div
      v-if="liturgyList.length === 0"
      class="d-flex flex-column align-center justify-center pa-8 text-center"
      style="min-height: 200px; opacity: 0.6"
    >
      <v-icon size="48" class="mb-3">mdi-playlist-music</v-icon>
      <p class="text-body-2">{{ t('empty') }}</p>
    </div>

    <!-- Lista de músicas -->
    <v-table v-else hover fixed-header class="w-100">
      <thead>
        <tr>
          <th style="width: 44px">#</th>
          <th>{{ t('table.name') }}</th>
          <th class="text-right" style="width: 70px">{{ t('table.duration') }}</th>
          <th style="width: 140px" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, idx) in liturgyList" :key="item.id_music">
          <td class="text-center text-caption text-medium-emphasis">{{ idx + 1 }}</td>
          <td>
            <div class="font-weight-medium text-body-2">{{ item.name }}</div>
            <div v-if="item.albums_names" class="text-caption text-medium-emphasis">{{ item.albums_names }}</div>
          </td>
          <td class="text-right text-caption text-medium-emphasis">{{ $datetime.shortTime(item.duration) }}</td>
          <td>
            <div class="d-flex justify-end align-center" style="gap: 2px">
              <!-- Mover para cima -->
              <v-btn
                icon
                variant="text"
                size="x-small"
                density="compact"
                :disabled="idx === 0"
                @click="moveUp(idx)"
              >
                <v-icon size="16">mdi-chevron-up</v-icon>
              </v-btn>
              <!-- Mover para baixo -->
              <v-btn
                icon
                variant="text"
                size="x-small"
                density="compact"
                :disabled="idx === liturgyList.length - 1"
                @click="moveDown(idx)"
              >
                <v-icon size="16">mdi-chevron-down</v-icon>
              </v-btn>
              <!-- Executar -->
              <v-btn
                icon
                variant="text"
                size="x-small"
                density="compact"
                color="primary"
                @click="playItem(item)"
              >
                <v-icon size="16">mdi-play-circle-outline</v-icon>
                <v-tooltip activator="parent" location="top">Executar com áudio</v-tooltip>
              </v-btn>
              <!-- Executar sem áudio -->
              <v-btn
                icon
                variant="text"
                size="x-small"
                density="compact"
                @click="playItemNoAudio(item)"
              >
                <v-icon size="16">mdi-checkbox-multiple-blank-outline</v-icon>
                <v-tooltip activator="parent" location="top">Executar sem áudio</v-tooltip>
              </v-btn>
              <!-- Remover -->
              <v-btn
                icon
                variant="text"
                size="x-small"
                density="compact"
                color="error"
                @click="removeItem(idx)"
              >
                <v-icon size="16">mdi-close</v-icon>
              </v-btn>
            </div>
          </td>
        </tr>
      </tbody>
    </v-table>

    <!-- Diálogo: adicionar música -->
    <v-dialog v-model="addDialog" max-width="640" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center pa-4">
          <v-icon start>mdi-music-note-plus</v-icon>
          {{ t('dialog.title') }}
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" @click="addDialog = false" />
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-3" style="min-height: 360px; max-height: 480px">
          <v-text-field
            v-model="searchQuery"
            :label="t('dialog.search')"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            clearable
            autofocus
            hide-details
            class="mb-3"
          />

          <div v-if="searchLoading" class="d-flex justify-center pa-6">
            <v-progress-circular indeterminate color="primary" />
          </div>

          <div v-else-if="filteredMusics.length === 0 && searchQuery" class="text-center pa-6 text-medium-emphasis">
            {{ t('dialog.no_results') }}
          </div>

          <v-list v-else density="compact" class="pa-0">
            <v-list-item
              v-for="music in filteredMusics"
              :key="music.id_music"
              :title="music.name"
              :subtitle="music.albums_names || ''"
              @click="addMusicToList(music)"
              link
            >
              <template v-slot:append>
                <span class="text-caption text-medium-emphasis me-2">{{ $datetime.shortTime(music.duration) }}</span>
                <v-icon size="18" color="primary">mdi-plus-circle-outline</v-icon>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-divider />
        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn variant="text" @click="addDialog = false">{{ t('dialog.cancel') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </Window>
</template>

<script>
import manifest from "../manifest.json";
import Window from "@/components/Window.vue";

export default {
  name: "LiturgiaModule",
  components: { Window },

  data: () => ({
    addDialog: false,
    searchQuery: '',
    searchLoading: false,
    allMusics: [],
  }),

  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() { return manifest.id; },
    module() { return this.$modules.get(this.module_id) || {}; },
    userdata() {
      const id = this.module_id;
      return new Proxy({}, {
        get: (_, key) => this.$userdata.get(`modules.${id}.${key}`, null),
        set: (_, key, value) => { this.$userdata.set(`modules.${id}.${key}`, value); return true; },
      });
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */

    liturgyList: {
      get() {
        return this.$userdata.get('modules.liturgia.list', null) || [];
      },
      set(val) {
        this.$userdata.set('modules.liturgia.list', val);
      },
    },

    filteredMusics() {
      const q = (this.searchQuery || '').trim().toLowerCase();
      if (!q) return this.allMusics.slice(0, 80);
      return this.allMusics
        .filter(m => (m.name || '').toLowerCase().includes(q) || (m.albums_names || '').toLowerCase().includes(q))
        .slice(0, 80);
    },
  },

  watch: {
    addDialog(val) {
      if (val && this.allMusics.length === 0) {
        this.loadMusics();
      }
      if (!val) {
        this.searchQuery = '';
      }
    },
  },

  methods: {
    /* METHODS OBRIGATÓRIOS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      const key = `modules.${this.module_id}.${text}`;
      const result = this.$t(key);
      if (result === key) {
        if (text === 'title') return manifest.name || result;
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
        const storedManifest = this.$appdata.get(`modules.${this.module_id}.manifest`);
        const translations = storedManifest?.translations?.[locale] || storedManifest?.translations?.['pt'];
        if (translations) {
          const val = text.split('.').reduce((obj, k) => obj?.[k], translations);
          if (typeof val === 'string') return val;
        }
      }
      return result;
    },
    /* METHODS OBRIGATÓRIOS - FIM */

    close() { this.$modules.close(this.module_id); },

    async loadMusics() {
      this.searchLoading = true;
      try {
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
        const file = `${locale}_musics`;
        const data = await this.$database.get(file);
        if (data && Array.isArray(data)) {
          this.allMusics = data;
        } else if (data && typeof data === 'object') {
          this.allMusics = Object.values(data);
        }
      } catch (_) {
        this.allMusics = [];
      } finally {
        this.searchLoading = false;
      }
    },

    openAddDialog() {
      this.addDialog = true;
    },

    addMusicToList(music) {
      const already = this.liturgyList.find(m => m.id_music === music.id_music);
      if (already) return;
      const list = [...this.liturgyList, {
        id_music: music.id_music,
        name: music.name,
        duration: music.duration,
        albums_names: music.albums_names || '',
        has_instrumental_music: music.has_instrumental_music,
      }];
      this.liturgyList = list;
    },

    removeItem(idx) {
      const list = [...this.liturgyList];
      list.splice(idx, 1);
      this.liturgyList = list;
    },

    moveUp(idx) {
      if (idx === 0) return;
      const list = [...this.liturgyList];
      [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
      this.liturgyList = list;
    },

    moveDown(idx) {
      const list = [...this.liturgyList];
      if (idx >= list.length - 1) return;
      [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
      this.liturgyList = list;
    },

    playItem(item) {
      this.$media.open({ id_music: item.id_music, mode: 'audio' });
    },

    playItemNoAudio(item) {
      this.$media.open(item.id_music);
    },

    clearAll() {
      this.liturgyList = [];
    },
  },
};
</script>
