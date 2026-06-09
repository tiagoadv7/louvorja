<template>
  <v-footer id="footer-bar" class="pa-0" color="primary">
    <l-player v-if="$media.isMinimized()" location="footer" />
    <v-row v-else class="ma-0 pa-0 align-center">
      <span class="text-caption pa-1">Versão {{ version }}</span>
      <v-spacer />
      <div class="d-flex align-center me-3" style="gap: 3px">
        <v-icon size="12">mdi-desktop-classic</v-icon>
        <span class="text-caption">{{ hostname }}</span>
      </div>
      <div class="d-flex align-center pa-1" style="gap: 3px">
        <v-icon size="12">mdi-clock-outline</v-icon>
        <span class="text-caption">{{ datetime }}</span>
      </div>
    </v-row>
  </v-footer>
</template>

<script>
import packageJson from "../../package.json";

import LPlayer from "@/components/Player.vue";

export default {
  name: "FooterLayout",
  components: {
    LPlayer,
  },
  data: () => ({
    db_version: 0,
    hostname: '',
    datetime: '',
    _clockTimer: null,
  }),
  computed: {
    version() {
      return packageJson.version + "." + this.db_version;
    },
  },
  methods: {
    async loadDBVersion() {
      const config = await this.$database.get("config");
      this.db_version = config.version_number;
    },
    updateClock() {
      const now = new Date();
      const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      this.datetime = `${date} ${time}`;
    },
  },
  async mounted() {
    await this.loadDBVersion();
    this.hostname = await this.$electron.getHostname().catch(() => '');
    this.updateClock();
    this._clockTimer = setInterval(this.updateClock, 1000);
  },
  beforeUnmount() {
    clearInterval(this._clockTimer);
  },
};
</script>

<style scoped>
#footer-bar {
  flex: 0 !important;
}
</style>
