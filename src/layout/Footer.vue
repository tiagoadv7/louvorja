<template>
  <v-footer id="footer-bar" class="pa-0" color="primary">
    <l-player v-if="$media.isMinimized()" location="footer" />
    <l-player v-else-if="videoActive" location="footer" source="video" />
    <l-player v-else-if="soundmasterActive" location="footer" source="soundmaster" />
    <l-player v-else-if="webLinkActive" location="footer" source="web_link" />
    <l-player v-else-if="slideEditorActive" location="footer" source="slide_editor" />
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
    // Módulo Vídeo minimizado com algo carregado → mostra na barra do rodapé
    // (mesmo lugar/estilo da barra do player de mídia), com o controle de
    // play/pause e o mini player flutuante (PIP) acessíveis sem reabrir o painel.
    videoActive() {
      return this.$videoPlayer.isMinimized() && !!this.$videoPlayer.getConfig().src;
    },
    // SoundMaster (coletânea) minimizado e tocando/pausado algo
    soundmasterActive() {
      return this.$soundMaster.isMinimized() && !!this.$soundMaster.nowPlaying().name;
    },
    // Link do YouTube (aberto pela Liturgia) com o painel dela escondido —
    // mesmo critério de "isMinimized" do vídeo/coletânea acima (ver
    // WebLink.js#isMinimized), só que baseado na visibilidade do painel da
    // Liturgia (quem abriu o link), já que "web_link" não é um módulo próprio.
    webLinkActive() {
      return this.$webLink.isMinimized();
    },
    // Editor de Músicas (slide_editor) minimizado com uma música carregada
    // (com áudio anexado) — mesmo critério do SoundMaster acima.
    slideEditorActive() {
      return this.$slideEditor.isMinimized() && !!this.$slideEditor.nowPlaying().title;
    },
  },
  methods: {
    async loadDBVersion() {
      this.db_version = await this.$electron.dbGetVersion().catch(() => 0);
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
