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

      <!-- ── Monitor de saída ─────────────────────────────────── -->
      <v-list-subheader>Monitor de saída</v-list-subheader>

      <v-progress-linear v-if="loading" indeterminate height="2" class="mb-1" />

      <v-list-item
        v-for="s in screens"
        :key="s.id"
        :prepend-icon="s.primary ? 'mdi-monitor-star' : 'mdi-monitor'"
        :active="selectedId === s.id"
        color="primary"
        rounded="lg"
        @click="lock(s.id)"
      >
        <v-list-item-title>{{ s.label }}</v-list-item-title>
        <v-list-item-subtitle>{{ s.bounds.width }}×{{ s.bounds.height }}</v-list-item-subtitle>
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

      <v-list-item prepend-icon="mdi-monitor-multiple" rounded="lg" @click="identify">
        <v-list-item-title>Identificar monitores</v-list-item-title>
      </v-list-item>

      <!-- ── Monitor de retorno (palco) ──────────────────────── -->
      <v-divider class="my-1" />

      <v-list-subheader>Monitor de retorno</v-list-subheader>

      <v-list-item
        :prepend-icon="returnOpen ? 'mdi-monitor-eye' : 'mdi-monitor-off'"
        :active="returnOpen"
        :color="returnOpen ? 'success' : undefined"
        rounded="lg"
        @click="toggleReturn"
      >
        <v-list-item-title>{{ returnOpen ? 'Retorno ativo' : 'Ativar retorno' }}</v-list-item-title>
      </v-list-item>

      <template v-if="returnOpen">
        <v-list-item
          v-for="s in screens"
          :key="'ret-' + s.id"
          :prepend-icon="s.primary ? 'mdi-monitor-star' : 'mdi-monitor'"
          :active="returnSelectedId === s.id"
          color="success"
          rounded="lg"
          @click="lockReturn(s.id)"
        >
          <v-list-item-title>{{ s.label }}</v-list-item-title>
          <v-list-item-subtitle>{{ s.bounds.width }}×{{ s.bounds.height }}</v-list-item-subtitle>
          <template v-slot:append>
            <v-icon
              :color="returnSelectedId === s.id ? 'success' : undefined"
              :style="returnSelectedId !== s.id ? 'opacity: 0.25' : ''"
              size="18"
            >
              {{ returnSelectedId === s.id ? 'mdi-lock' : 'mdi-lock-open-outline' }}
            </v-icon>
          </template>
        </v-list-item>
      </template>

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
    returnOpen: false,
    returnSelectedId: null,
    _returnOpenedHandler: null,
    _returnClosedHandler: null,
  }),
  computed: {
    is_desktop() {
      return this.$appdata.get('is_desktop');
    },
    tooltipText() {
      if (!this.selectedId || !this.screens.length) return 'Monitor de saída';
      const s = this.screens.find(s => s.id === this.selectedId);
      if (!s) return 'Monitor de saída';
      return `Saída: ${s.label}`;
    },
  },
  async mounted() {
    if (!this.$electron.isElectron()) return;

    const saved = await this.$electron.storeGet('output_display_id');
    if (saved) this.selectedId = saved;

    this.returnOpen = await this.$electron.isReturnScreenOpen();
    const savedReturn = await this.$electron.storeGet('return_display_id');
    if (savedReturn) this.returnSelectedId = savedReturn;

    this._returnOpenedHandler = this.$electron.on('return-window-opened', () => {
      this.returnOpen = true;
    });
    this._returnClosedHandler = this.$electron.on('return-window-closed', () => {
      this.returnOpen = false;
    });
  },
  beforeUnmount() {
    if (this._returnOpenedHandler)
      this.$electron.off('return-window-opened', this._returnOpenedHandler);
    if (this._returnClosedHandler)
      this.$electron.off('return-window-closed', this._returnClosedHandler);
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
        if (!this.returnSelectedId && this.screens.length) {
          const ext = this.screens.find(s => !s.primary);
          this.returnSelectedId = (ext ?? this.screens[0]).id;
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

    async toggleReturn() {
      if (this.returnOpen) {
        await this.$electron.closeReturnScreen();
        this.returnOpen = false;
      } else {
        await this.$electron.openReturnScreen(this.returnSelectedId || null);
        this.returnOpen = true;
      }
    },

    async lockReturn(id) {
      if (this.returnSelectedId === id) return;
      this.returnSelectedId = id;
      await this.$electron.storeSet('return_display_id', id);
      if (this.returnOpen) {
        await this.$electron.closeReturnScreen();
        await this.$electron.openReturnScreen(id);
      }
    },
  },
};
</script>
