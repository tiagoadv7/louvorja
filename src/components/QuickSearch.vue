<template>
  <v-dialog
    v-model="dialog"
    max-width="640"
    @after-enter="focusInput"
    @keydown.esc.stop="dialog = false"
  >
    <v-card rounded="lg" style="overflow: hidden">
      <!-- Campo de busca -->
      <v-text-field
        ref="input"
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        :append-inner-icon="search ? 'mdi-close' : undefined"
        placeholder="Buscar música..."
        density="comfortable"
        variant="solo-filled"
        flat
        hide-details
        class="__qs-input"
        @click:append-inner="search = ''"
        @keydown.enter.prevent="openSelected"
        @keydown.down.prevent="moveSelection(1)"
        @keydown.up.prevent="moveSelection(-1)"
      />

      <v-divider />

      <!-- Carregando -->
      <div v-if="loading" class="pa-6 d-flex justify-center">
        <v-progress-circular indeterminate size="28" />
      </div>

      <!-- Resultados -->
      <v-list
        v-else-if="results.length"
        ref="list"
        density="compact"
        style="max-height: 380px; overflow-y: auto"
      >
        <v-list-item
          v-for="(item, idx) in results"
          :key="item.id_music"
          :active="selectedIdx === idx"
          :color="$theme.primary()"
          rounded="lg"
          class="__qs-item"
          @mouseenter="selectedIdx = idx"
          @click.stop="openItem(idx)"
        >
          <template v-slot:prepend>
            <v-icon size="16" class="me-1 opacity-60">mdi-music-note</v-icon>
          </template>

          <v-list-item-title class="font-weight-medium text-body-2">
            {{ item.name }}
          </v-list-item-title>
          <v-list-item-subtitle>
            <template v-if="item.albums?.length">
              <v-chip
                v-for="album in item.albums"
                :key="album.id_album"
                size="x-small"
                :color="$theme.primary()"
                variant="tonal"
                class="me-1"
              >
                {{ album.name }}
              </v-chip>
            </template>
            <span v-else class="text-disabled">—</span>
          </v-list-item-subtitle>

          <template v-slot:append>
            <div @click.stop>
              <MusicMenuTable
                :id_music="item.id_music"
                :has_instrumental_music="item.has_instrumental_music"
                @action="dialog = false"
              />
            </div>
          </template>
        </v-list-item>
      </v-list>

      <!-- Sem resultados -->
      <div v-else-if="search.trim() && !searchIsNumber" class="pa-6 text-center">
        <v-icon size="36" class="mb-2 text-disabled">mdi-music-note-off</v-icon>
        <div class="text-body-2 text-disabled">
          Nenhuma música encontrada para <strong>"{{ search }}"</strong>
        </div>
      </div>

      <!-- Estado inicial -->
      <div v-else-if="!searchIsNumber" class="pa-5 text-center text-disabled text-caption">
        <v-icon size="20" class="me-1">mdi-keyboard-outline</v-icon>
        Digite para buscar músicas
      </div>

      <!-- Resultados por número nos Hinários -- catálogos separados (mesmo
           número é uma música diferente em cada hinário), mostrados à parte
           dos resultados por nome/álbum acima (ver Músicas/interface/Index.vue,
           mesmo padrão). -->
      <template v-if="searchIsNumber">
        <v-divider v-if="results.length" />
        <div class="text-caption text-medium-emphasis px-3 pt-2 pb-1">
          Resultados por número nos Hinários
        </div>
        <div v-if="hymnalLoading" class="pa-4 d-flex justify-center">
          <v-progress-circular indeterminate size="20" />
        </div>
        <template v-else-if="hymnalMatches.length">
          <div v-for="h in hymnalMatches" :key="h.id" class="px-3 pb-2">
            <div class="text-caption font-weight-bold mb-1">{{ h.name }}</div>
            <v-list density="compact">
              <v-list-item
                v-for="s in h.songs"
                :key="s.id_music"
                :title="s.name"
                rounded="lg"
              >
                <template v-slot:prepend>
                  <v-chip size="small" class="mr-2" :color="$theme.primary()">{{ s.track }}</v-chip>
                </template>
                <template v-slot:append>
                  <div @click.stop>
                    <MusicMenuTable
                      :id_music="s.id_music"
                      :has_instrumental_music="s.has_instrumental_music"
                      @action="dialog = false"
                    />
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </div>
        </template>
        <div v-else class="text-caption text-medium-emphasis px-3 pb-3">
          Nenhum hino encontrado com o número <strong>"{{ search.trim() }}"</strong>
        </div>
      </template>

      <!-- Rodapé -->
      <template v-if="results.length">
        <v-divider />
        <div class="px-3 py-1 d-flex align-center justify-space-between">
          <span class="text-caption text-disabled">
            {{ results.length }} de {{ matchedResults.length }} resultados
          </span>
          <span class="text-caption text-disabled">
            ↑↓ navegar &nbsp;·&nbsp; Enter abrir &nbsp;·&nbsp; Esc fechar
          </span>
        </div>
      </template>
    </v-card>
  </v-dialog>
</template>

<script>
import MusicMenuTable from '@/components/MusicMenuTable.vue';

export default {
  name: 'QuickSearchComponent',
  components: { MusicMenuTable },

  props: {
    modelValue: Boolean,
  },
  emits: ['update:modelValue'],

  data: () => ({
    search: '',
    allData: [],
    loading: false,
    selectedIdx: 0,
    hymnalDatasets: [],
    hymnalDataLoaded: false,
    hymnalLoading: false,
  }),

  computed: {
    dialog: {
      get() { return this.modelValue; },
      set(v) { this.$emit('update:modelValue', v); },
    },
    // Todos os resultados que batem com a busca (sem limite) — usado pra
    // saber o total real de correspondências, não só quantos são exibidos.
    matchedResults() {
      const q = this.$string.clean(this.search.trim());
      if (!q) return [];
      return this.allData.filter(item => item._nc.includes(q) || item._ac.includes(q));
    },
    // Recorte exibido na lista (a lista já rola — ver max-height do v-list —
    // então não precisa ficar tão curto quanto antes; 10 escondia buscas com
    // muitas correspondências, ex. nomes comuns repetidos em vários álbuns).
    results() {
      return this.matchedResults.slice(0, 50);
    },
    searchIsNumber() {
      const s = this.search.trim();
      return s !== '' && !isNaN(s);
    },
    // Os dois hinários são catálogos SEPARADOS (mesmo número é uma música
    // diferente em cada um — ver sqlite-reader.js#_getHymnal) — carregados à
    // parte do catálogo geral (allData), sob demanda, só quando a busca
    // parece um número (ver Músicas/interface/Index.vue, mesmo padrão).
    hymnalMatches() {
      if (!this.searchIsNumber) return [];
      const num = Number(this.search.trim());
      return this.hymnalDatasets
        .map((h) => ({ ...h, songs: h.songs.filter((s) => Number(s.track) === num) }))
        .filter((h) => h.songs.length);
    },
  },

  watch: {
    async dialog(open) {
      if (open) {
        this.search = '';
        this.selectedIdx = 0;
        if (!this.allData.length) await this.loadData();
      } else {
        this.search = '';
      }
    },
    results() {
      this.selectedIdx = 0;
    },
    searchIsNumber(isNum) {
      if (isNum) this.loadHymnalData();
    },
  },

  methods: {
    async loadData() {
      this.loading = true;
      try {
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
        const raw = await this.$database.get(`${locale}_musics`) || [];
        raw.sort((a, b) => this.$string.sort(a.name, b.name));
        this.allData = raw.map(item => ({
          ...item,
          _nc: this.$string.clean(item.name),
          _ac: item.albums_names ? this.$string.clean(item.albums_names) : '',
        }));
      } finally {
        this.loading = false;
      }
    },

    async loadHymnalData() {
      if (this.hymnalDataLoaded) return;
      this.hymnalDataLoaded = true;
      this.hymnalLoading = true;
      try {
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
        const [hymnal, hymnal1996] = await Promise.all([
          this.$database.get(`${locale}_hymnal`),
          this.$database.get(`${locale}_hymnal_1996`),
        ]);
        const toArray = (d) => (Array.isArray(d) ? d : Object.values(d || {}));
        this.hymnalDatasets = [
          { id: 'hymnal', name: 'Hinário Adventista', songs: toArray(hymnal) },
          { id: 'hymnal_1996', name: 'Hinário Adventista - 1996', songs: toArray(hymnal1996) },
        ];
      } finally {
        this.hymnalLoading = false;
      }
    },

    focusInput() {
      this.$nextTick(() => this.$refs.input?.$el?.querySelector('input')?.focus());
    },

    moveSelection(dir) {
      const max = this.results.length - 1;
      this.selectedIdx = Math.max(0, Math.min(max, this.selectedIdx + dir));
    },

    openItem(idx) {
      this.selectedIdx = idx;
      this.openSelected();
    },

    openSelected() {
      const item = this.results[this.selectedIdx];
      if (!item) return;
      this.$media.open({ id_music: item.id_music, mode: 'audio' });
      this.dialog = false;
    },
  },
};
</script>

<style scoped>
.__qs-input :deep(input) {
  font-size: 16px;
  padding-top: 12px;
  padding-bottom: 12px;
}
.__qs-item {
  transition: background 0.1s;
}
</style>
