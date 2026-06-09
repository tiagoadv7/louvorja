<template>
  <v-menu
    v-if="is_desktop"
    v-model="menu"
    location="bottom"
    :close-on-content-click="false"
    @update:model-value="onToggle"
  >
    <template v-slot:activator="{ props }">
      <v-tooltip location="bottom">
        <template v-slot:activator="{ props: tip }">
          <v-btn v-bind="{ ...props, ...tip }" icon="mdi-monitor-multiple" />
        </template>
        {{ tooltipText }}
      </v-tooltip>
    </template>

    <v-list density="compact" min-width="280">
      <v-list-subheader>Monitor de saída</v-list-subheader>

      <v-progress-linear v-if="loading" indeterminate height="2" class="mb-1" />

      <v-list-item
        v-for="(s, i) in screens"
        :key="s.id"
        :prepend-icon="s.primary ? 'mdi-monitor-star' : 'mdi-monitor'"
        :active="selectedId === s.id"
        color="primary"
        rounded="lg"
        @click="lock(s.id)"
      >
        <v-list-item-title>{{ s.label }}</v-list-item-title>
        <v-list-item-subtitle>
          {{ s.bounds.width }}×{{ s.bounds.height }}
        </v-list-item-subtitle>
        <template v-slot:append>
          <v-icon
            :color="selectedId === s.id ? 'primary' : undefined"
            :style="selectedId !== s.id ? 'opacity: 0.25' : ''"
            size="18"
          >
            {{ selectedId === s.id ? 'mdi-lock' : 'mdi-lock-open-outline' }}
          </v-icon>
        </template>
      </v-list-item>

      <v-list-item
        v-if="!loading && screens.length === 0"
        prepend-icon="mdi-monitor-off"
        title="Nenhum monitor encontrado"
        disabled
      />

      <v-divider class="my-1" />

      <v-list-item
        prepend-icon="mdi-monitor-multiple"
        rounded="lg"
        @click="identify"
      >
        <v-list-item-title>Identificar monitores</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>
export default {
  name: 'MonitorSelectorComponent',
  data: () => ({
    menu: false,
    loading: false,
    screens: [],
    selectedId: null,
  }),
  computed: {
    is_desktop() {
      return this.$appdata.get('is_desktop');
    },
    tooltipText() {
      if (!this.selectedId || !this.screens.length) return 'Monitor de saída';
      const idx = this.screens.findIndex(s => s.id === this.selectedId);
      const s = this.screens[idx];
      if (!s) return 'Monitor de saída';
      return `Saída: ${s.label}`;
    },
  },
  async mounted() {
    if (!this.$electron.isElectron()) return;
    const saved = await this.$electron.storeGet('output_display_id');
    if (saved) this.selectedId = saved;
  },
  methods: {
    async onToggle(open) {
      if (!open) return;
      this.loading = true;
      try {
        this.screens = (await this.$electron.getScreens()) || [];
        if (!this.selectedId && this.screens.length) {
          const ext = this.screens.find(s => !s.primary);
          this.selectedId = (ext ?? this.screens[0]).id;
        }
      } finally {
        this.loading = false;
      }
    },
    async lock(id) {
      if (this.selectedId === id) return;
      this.selectedId = id;
      await this.$electron.storeSet('output_display_id', id);
      this.$userdata.set('modules.theme.output_display_id', id);
    },
    async identify() {
      this.menu = false;
      await this.$electron.identifyScreens();
    },
  },
};
</script>
