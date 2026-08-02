<template>
  <v-table fixed-header hover loading density="compact" class="__table-data">
    <template v-slot:bottom>
      <v-progress-linear
        v-if="loading"
        :color="$theme.primary()"
        indeterminate
      />
      <v-alert
        v-if="error"
        type="error"
        :text="error"
        variant="tonal"
        border="start"
        class="ma-2"
      />
    </template>
    <slot />
  </v-table>
</template>

<script>
export default {
  name: "DataTableComponent",
  props: {
    modelValue: Object,
    file: String,
    search: String,
    scroll: { type: Object, default: () => ({}) },
    has_scroll: Boolean,
    searchable_fields: Object,
    filter: Object,
    letter: String,
    sort_by: String,
  },
  data: () => ({
    all_data: [],
    filter_data: [],
    data: [],
    limit: 0,
    error: null,
    last_filter: {},
    loading: true,
    // WeakMap item -> { [field]: cleanedValue } — evita rodar $string.clean()
    // (normalize + regex, caro pra campos grandes como "lyric") de novo a cada
    // tecla digitada pra TODO item da lista; calculado uma vez por item/campo
    // e reaproveitado enquanto o item continuar o mesmo objeto (recarregar os
    // dados troca os objetos e o cache antigo vira lixo sozinho).
    clean_cache: new WeakMap(),
  }),
  watch: {
    async file() {
      await this.loadData();
    },
    search() {
      // Debounce: sem isso, cada tecla digitada refiltra a lista inteira na
      // hora — com listas grandes (milhares de músicas) e "lyric" habilitado
      // na busca, digitar rápido travava a UI por rodar o filtro várias vezes
      // em sequência antes mesmo do usuário terminar de digitar a palavra.
      clearTimeout(this._searchDebounce);
      this._searchDebounce = setTimeout(() => this.filterData(), 200);
    },
    searchable_fields() {
      this.compareFilterData();
    },
    filter() {
      this.compareFilterData();
    },
    letter() {
      this.compareFilterData();
    },
    async data() {
      this.$emit("update:modelValue", {
        total_count: this.all_data.length,
        filter_count: this.filter_data.length,
        count: this.data.length,
        data: this.data,
      });
    },
    async scroll() {
      if (
        this.scroll.scroll_bottom <= 50 &&
        this.data.length < this.filter_data.length
      ) {
        this.paginateData();
      }
    },
  },
  methods: {
    async loadData() {
      this.all_data = [];
      this.filter_data = [];
      this.data = [];
      this.loading = true;
      this.clean_cache = new WeakMap();

      this.all_data = await this.$database.get(this.file);

      if (this.all_data == null) {
        this.error = this.$t("components.datatable.alerts.not_found");
      }

      if (this.sort_by) {
        this.all_data.sort((a, b) =>
          this.$string.sort(a[this.sort_by], b[this.sort_by]),
        );
      }
      this.filterData();
    },
    filterData() {
      this.limit = 0;
      const value = this.$string.clean(this.search);

      let searchable = this.searchable_fields
        ? Object.keys(this.searchable_fields).filter(
            (key) => this.searchable_fields[key] === true,
          )
        : [];
      let filter = this.filter
        ? Object.keys(this.filter).filter((key) => this.filter[key] === true)
        : [];
      this.filter_data = this.all_data
        .filter((item) => {
          const searchableCondition =
            searchable.length === 0 ||
            value == "" ||
            searchable.some((key) => {
              if (key === "track" && item.albums) {
                return item.albums.some((album) => {
                  const isHymnal = album.name && album.type == "hymnal";
                  return (
                    isHymnal &&
                    album.pivot &&
                    Number(album.pivot.track) === Number(value)
                  );
                });
              }

              if (!isNaN(item[key]) && !isNaN(value)) {
                return Number(item[key]) === Number(value);
              } else if (isNaN(item[key])) {
                return this.getClean(item, key).includes(value);
              } else {
                return false;
              }
            });

          const filterCondition =
            filter.length === 0 ||
            filter.some((key) => item[key] === true || item[key] === 1);

          const initialLetter =
            this.letter === "" ||
            (this.letter === "#"
              ? /^[^a-zA-Z]/.test(
                  item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
                )
              : item.name
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .startsWith(this.letter));

          return searchableCondition && filterCondition && initialLetter;
        })
        .slice();

      this.paginateData();
    },

    // Cacheia $string.clean(item[key]) por item+campo — item/campo nunca mudam
    // entre buscas (só o texto digitado muda), então só vale a pena limpar uma
    // vez por item, na primeira vez que aquele campo é efetivamente buscado.
    getClean(item, key) {
      let entry = this.clean_cache.get(item);
      if (!entry) {
        entry = {};
        this.clean_cache.set(item, entry);
      }
      if (!(key in entry)) {
        entry[key] = this.$string.clean(item[key]);
      }
      return entry[key];
    },

    paginateData() {
      this.limit += 10;
      this.data = this.filter_data.slice(0, this.limit);
      this.loading = false;

      const self = this;
      setTimeout(() => {
        if (!self.has_scroll && self.data.length < self.filter_data.length) {
          self.paginateData();
        }
      }, 100);
    },

    compareFilterData() {
      let filter = {
        searchable_fields: this.searchable_fields,
        filter: this.filter,
        letter: this.letter,
      };

      if (JSON.stringify(filter) === JSON.stringify(this.last_filter)) {
        return;
      }

      this.last_filter = filter;

      this.filterData();
    },
  },
  async mounted() {
    await this.loadData();
  },
};
</script>

<style>
.__table-data .v-table__wrapper {
  overflow: initial !important;
}
</style>
