<template>
  <v-navigation-drawer
    v-model="show"
    :location="$vuetify.display.width < 600 ? 'bottom' : undefined"
    temporary
  >
    <v-list :baseColor="$appdata.get('is_dark') ? undefined : $theme.primary()" nav>
      <template
        v-for="(module, module_key) in sortModules(menu_modules)"
        :key="module_key"
      >
        <v-list-item
          v-if="
            (module.language
              ? module.language == language
              : !module.development || (is_dev && module.development))
            && !(module.manifest?.onlineOnlyLanguages?.includes(language) && !is_online)
          "
          :prepend-icon="module.icon"
          @click="
            $appdata.toogle('menu.show');
            $modules.open(module_key);
          "
        >
          <v-list-item-title>{{ moduleTitle(module) }}</v-list-item-title>
        </v-list-item>
      </template>
      <v-divider class="my-1" />
      <v-list-item
        prepend-icon="mdi-album"
        @click="$appdata.toogle('menu.show'); openAlbumsManager()"
      >
        <v-list-item-title>Gerenciar Álbuns</v-list-item-title>
      </v-list-item>
      <v-list-item
        v-if="$electron.isElectron()"
        prepend-icon="mdi-folder-sync-outline"
        @click="$appdata.toogle('menu.show'); dispatchSyncFiles()"
      >
        <v-list-item-title>Sincronizar arquivos</v-list-item-title>
      </v-list-item>
      <v-list-item
        v-if="$electron.isElectron()"
        prepend-icon="mdi-update"
        @click="$appdata.toogle('menu.show'); dispatchCheckUpdates()"
      >
        <v-list-item-title>Verificar atualizações</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>

  <AlbumsManagerDialog v-model="albumsManagerOpen" />
</template>

<script>
import AlbumsManagerDialog from "@/components/AlbumsManagerDialog.vue";

export default {
  name: "MenuLayout",
  components: { AlbumsManagerDialog },
  emits: ['sync-files'],
  data: () => ({
    albumsManagerOpen: false,
  }),
  computed: {
    show: {
      get() {
        return this.$appdata.get("menu.show");
      },
      set(value) {
        if (!value) {
          this.$appdata.toogle("menu.show");
        }
      },
    },
    menu_modules() {
      return this.$modules.getMenu();
    },
    modules() {
      return this.$appdata.get("modules");
    },
    is_dev: {
      get() {
        return this.$appdata.get("is_dev");
      },
      set(value) {
        if (!value) {
          this.$appdata.set("is_dev", value);
        }
      },
    },
    language: {
      get() {
        return this.$userdata.get("language");
      },
      set(value) {
        if (!value) {
          this.$userdata.set("language", value);
        }
      },
    },
    // Alguns módulos (ex.: Hinário Adventista em espanhol) só têm dado real
    // via API remota — o SQLite/JSON local (modo offline) não tem conteúdo
    // pra esses idiomas, então ficam escondidos do menu até voltar a ficar
    // online (ver manifest "onlineOnlyLanguages").
    is_online() {
      return !this.$appdata.get("offline_mode");
    },
  },
  methods: {
    openAlbumsManager() {
      // Mesmo motivo do dispatchSyncFiles abaixo — espera o drawer terminar
      // de fechar antes de abrir o dialog, senão o scrim dele (ainda
      // fechando) bloqueia clique nos botões do dialog novo.
      setTimeout(() => { this.albumsManagerOpen = true; }, 300);
    },
    dispatchSyncFiles() {
      // Aguarda a transição de fechamento do drawer terminar antes de abrir o
      // diálogo — do contrário o scrim do drawer (ainda fechando) pode ficar
      // por cima do novo diálogo e bloquear cliques nos botões dele.
      setTimeout(() => window.dispatchEvent(new CustomEvent('sync-files')), 300);
    },
    dispatchCheckUpdates() {
      window.dispatchEvent(new CustomEvent('check-updates'));
    },
    moduleTitle(module) {
      if (!module.title) return module.manifest?.name || '';
      const translated = this.$t(module.title);
      if (translated !== module.title) return translated;
      if (module.manifest?.name) return module.manifest.name;
      const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
      const translations = module.manifest?.translations?.[locale] || module.manifest?.translations?.['pt'];
      return translations?.title || translated;
    },
    sortModules(modules) {
      return this.$modules.sort(modules, this.$t);
    },
  },
};
</script>
