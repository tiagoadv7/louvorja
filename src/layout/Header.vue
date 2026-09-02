<template>
  <v-app-bar id="header-bar" tile flat color="primary">
    <template v-slot:prepend>
      <v-app-bar-nav-icon @click="$appdata.toogle('menu.show')" />
    </template>
    <v-app-bar-title v-if="!$appdata.get('is_desktop')">{{ $t("app.name") }}</v-app-bar-title>
    <v-spacer />

    <v-bottom-sheet v-if="remote">
      <template v-slot:activator="{ props: activatorProps }">
        <v-btn v-bind="activatorProps" icon="mdi-keyboard-close" />
      </template>

      <v-card>
        <v-card-actions>
          <v-btn icon="mdi-keyboard-esc" size="x-large" @click="sendKey(27)" />
        </v-card-actions>
        <v-card-actions>
          <v-spacer />
          <v-btn icon="mdi-page-first" size="x-large" @click="sendKey(36)" />
          <v-btn icon="mdi-chevron-left" size="x-large" @click="sendKey(37)" />
          <v-btn icon="mdi-play-pause" size="x-large" @click="sendKey(32)" />
          <v-btn icon="mdi-chevron-right" size="x-large" @click="sendKey(39)" />
          <v-btn icon="mdi-page-last" size="x-large" @click="sendKey(35)" />
          <v-spacer />
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>

    <v-tooltip v-if="remote" location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn v-bind="props" icon="mdi-remote" @click="openRemote()" />
      </template>
      {{ remote_url }}
    </v-tooltip>

    <v-divider v-if="remote" vertical />

    <v-tooltip location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn v-bind="props" icon="mdi-magnify" @click="quickSearchOpen = true" />
      </template>
      Busca rápida (Ctrl+F)
    </v-tooltip>
    <QuickSearch v-model="quickSearchOpen" />

    <v-btn
      :icon="layout == 'apps' ? 'mdi-tab' : 'mdi-apps'"
      @click="changeLayout()"
    />

    <v-tooltip location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn
          v-bind="props"
          :icon="offlineModeEnabled ? 'mdi-wifi-off' : 'mdi-wifi'"
          :color="offlineModeEnabled ? 'grey' : 'green'"
          @click="toggleOfflineMode()"
        />
      </template>
      {{ offlineModeEnabled ? "Modo Offline" : "Modo Online" }}
    </v-tooltip>

    <v-tooltip v-if="isOnline" location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn v-bind="props" icon="mdi-cloud-download-outline" @click="openDownload()" />
      </template>
      Centro de Downloads
    </v-tooltip>
    <DownloadCenter v-if="isOnline" v-model="downloadDialog" :initial-section="downloadSection" />

    <MonitorSelector />

    <AboutDialog />

    <LanguageSelector />
  </v-app-bar>
</template>

<script>
import LanguageSelector from "@/components/LanguageSelector.vue";
import MonitorSelector from "@/components/MonitorSelector.vue";
import AboutDialog from "@/components/AboutDialog.vue";
import DownloadCenter from "@/components/DownloadCenter.vue";
import QuickSearch from "@/components/QuickSearch.vue";
import $storage from "@/helpers/Storage";

export default {
  name: "HeaderLayout",
  components: {
    LanguageSelector,
    MonitorSelector,
    AboutDialog,
    DownloadCenter,
    QuickSearch,
  },
  data: () => ({
    downloadDialog: false,
    downloadSection: 'home',
    quickSearchOpen: false,
    isOnline: navigator.onLine,
    offlineModeEnabled: $storage.get("db_local_enabled", false) === true,
    _downloadHandler: null,
    _quickSearchHandler: null,
    _onlineHandler: null,
    _offlineHandler: null,
  }),
  computed: {
    layout() {
      return this.$userdata.get("layout");
    },
    is_desktop() {
      return this.$appdata.get("is_desktop");
    },
    remote() {
      return this.$userdata.get("remote.is_connected");
    },
    remote_url() {
      return this.$userdata.get("remote.url");
    },
  },
  mounted() {
    this._downloadHandler = (e) => {
      this.downloadSection = e.detail?.section || 'home';
      this.downloadDialog = true;
    };
    window.addEventListener('open-download-center', this._downloadHandler);

    this._quickSearchHandler = (e) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        this.quickSearchOpen = !this.quickSearchOpen;
      }
    };
    window.addEventListener('keydown', this._quickSearchHandler);

    this._onlineHandler  = () => { this.isOnline = true; };
    this._offlineHandler = () => { this.isOnline = false; };
    window.addEventListener('online',  this._onlineHandler);
    window.addEventListener('offline', this._offlineHandler);
  },

  beforeUnmount() {
    window.removeEventListener('open-download-center', this._downloadHandler);
    window.removeEventListener('keydown', this._quickSearchHandler);
    window.removeEventListener('online',  this._onlineHandler);
    window.removeEventListener('offline', this._offlineHandler);
  },

  methods: {
    openDownload(section = 'home') {
      this.downloadSection = section;
      this.downloadDialog = true;
    },

    toggleOfflineMode() {
      this.offlineModeEnabled = !this.offlineModeEnabled;
      $storage.set("db_local_enabled", this.offlineModeEnabled);
      // Espelha em $appdata (reativo) — $storage é só localStorage/electron-
      // store puro, sem reatividade Vue, então outros componentes (ex.:
      // layout/Menu.vue, que decide se mostra módulos só-online) não veriam
      // a mudança sem isso.
      this.$appdata.set("offline_mode", this.offlineModeEnabled);
      // Limpa o cache de sessão da API (db:*) pra próxima leitura já respeitar
      // o modo novo, em vez de servir dados em cache do modo anterior.
      $storage.removeAll("db", "session");
    },

    changeLayout() {
      if (this.layout == "apps") {
        this.$userdata.set("layout", "ribbon");
      } else {
        this.$userdata.set("layout", "apps");
      }
    },
    openRemote() {
      this.$modules.open("remote_control");
    },
    async sendKey(key) {
      const url =
        this.$userdata.get("remote.url") +
        "/api/keyboard?key=" +
        key +
        "&token=" +
        this.$userdata.get("remote.token");

      try {
        const response = await fetch(url, {
          method: "GET",
          mode: "cors",
        });

        const ret = await response.json();
        if (ret.status != "ok") {
          this.$alert.error({
            text:
              ret.code == "INVALID_TOKEN"
                ? "modules.remote_control.messages.invalid_token"
                : "modules.remote_control.messages.error",
            error: ret.code,
          });
        }
      } catch (error) {
        this.$alert.error({
          text: "modules.remote_control.messages.failed_to_connect",
          error: error,
        });
      }
    },
  },
};
</script>

<style scoped>
#header-bar {
  position: initial !important;
  flex: 0 !important;
}
</style>
