<template>
  <Window
    v-model="module.show"
    :title="config?.title"
    :subtitle="
      config?.subtitle +
      (config?.track > 0 ? ' | ' + t('general.track') + ' ' + config.track : '')
    "
    :image="config?.image ? $path.file(config.image) : ''"
    title-class="text-h4 font-weight-light"
    closable
    minimizable
    compact
    compact_footer
    @close="$media.close()"
    @minimize="$media.minimize()"
    @resize="resize"
    size="large"
    :scrollPos="scrollPos"
    dark
  >
    <template v-slot:system_buttons>
      <!-- Tela de Retorno: menu com seleção de monitor -->
      <v-menu
        v-if="$appdata.get('is_desktop')"
        v-model="returnMenu"
        location="bottom"
        :close-on-content-click="false"
        @update:model-value="onReturnMenuToggle"
      >
        <template v-slot:activator="{ props: menuProps }">
          <v-tooltip location="bottom">
            <template v-slot:activator="{ props: tipProps }">
              <v-btn
                v-bind="{ ...menuProps, ...tipProps }"
                icon
                variant="text"
                size="small"
                :color="returnScreenOpen ? 'warning' : 'white'"
                class="me-1"
              >
                <v-icon size="20">mdi-monitor-account</v-icon>
              </v-btn>
            </template>
            {{ returnScreenOpen ? 'Tela de Retorno aberta' : 'Tela de Retorno' }}
          </v-tooltip>
        </template>

        <v-list density="compact" min-width="260">
          <v-list-subheader>Tela de Retorno</v-list-subheader>

          <v-progress-linear v-if="returnMenuLoading" indeterminate height="2" class="mb-1" />

          <v-list-item
            v-for="s in returnScreens"
            :key="s.id"
            :prepend-icon="s.primary ? 'mdi-monitor-star' : 'mdi-monitor'"
            :active="returnDisplayId === s.id"
            color="warning"
            rounded="lg"
            @click="lockReturnDisplay(s.id)"
          >
            <v-list-item-title>{{ s.label }}</v-list-item-title>
            <v-list-item-subtitle>{{ s.bounds.width }}×{{ s.bounds.height }}</v-list-item-subtitle>
            <template v-slot:append>
              <v-icon
                :color="returnDisplayId === s.id ? 'warning' : undefined"
                :style="returnDisplayId !== s.id ? 'opacity: 0.25' : ''"
                size="18"
              >
                {{ returnDisplayId === s.id ? 'mdi-lock' : 'mdi-lock-open-outline' }}
              </v-icon>
            </template>
          </v-list-item>

          <v-list-item
            v-if="!returnMenuLoading && returnScreens.length === 0"
            prepend-icon="mdi-monitor-off"
            title="Nenhum monitor encontrado"
            disabled
          />

          <v-divider class="my-1" />

          <v-list-item
            :prepend-icon="returnScreenOpen ? 'mdi-monitor-off' : 'mdi-monitor-account'"
            :title="returnScreenOpen ? 'Fechar Tela de Retorno' : 'Abrir Tela de Retorno'"
            :base-color="returnScreenOpen ? 'error' : 'warning'"
            rounded="lg"
            @click="toggleReturnScreen"
          />

          <v-list-item
            prepend-icon="mdi-monitor-multiple"
            rounded="lg"
            @click="identifyReturnScreens"
          >
            <v-list-item-title>Identificar monitores</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
      <v-menu v-if="is_online">
        <template v-slot:activator="{ props }">
          <v-btn
            v-bind="props"
            class="ms-2"
            icon="mdi-menu"
            variant="text"
            size="small"
          />
        </template>
        <v-card>
          <v-card-text>
            <v-tooltip location="bottom">
              <template v-slot:activator="{ props }">
                <v-switch
                  color="blue"
                  v-bind="props"
                  v-model="lazy_load"
                  :label="t('inputs.lazy_load')"
                />
              </template>
              {{ t('inputs.lazy_load_tooltip') }}
            </v-tooltip>
            <v-tooltip location="bottom">
              <template v-slot:activator="{ props }">
                <v-switch
                  color="blue"
                  v-bind="props"
                  v-model="fade_audio"
                  :label="t('inputs.fade_audio')"
                />
              </template>
              {{ t('inputs.fade_audio_tooltip') }}
            </v-tooltip>
          </v-card-text>
        </v-card>
      </v-menu>
    </template>

    <div
      class="d-flex flex-no-wrap align-stretch flex-row justify-space-between"
    >
      <div class="w-100">
        <fullscreen
          v-model="fullscreen"
          class="position-sticky w-100"
          :style="`top: 0; height:${preview_height}px; overflow: hidden;`"
        >
          <l-slide
            v-if="slide"
            :slide_number="config.slide_index"
            :cover="slide.cover == true"
            :text="slide.lyric"
            :aux_text="slide.aux_lyric"
            :image="slide.url_image ? $path.file(slide.url_image) : null"
            :image_position="slide.image_position"
          />
          <l-fullscreen-player v-if="fullscreen" />
        </fullscreen>
      </div>
      <div v-if="$vuetify.display.width > 600">
        <v-list class="overflow h-100 ma-0 pa-0" bg-color="black" :width="250">
          <v-list-item
            @click="$media.goToSlide(index)"
            v-for="(item, index) in slides"
            :key="index"
            link
            :active="config.slide_index === index"
            ref="slideItem"
            variant="tonal"
            :height="58"
          >
            <template v-slot:prepend>
              <v-chip class="mr-2">{{ index + 1 }}</v-chip>
            </template>

            <v-list-item-title v-if="item.cover">
              {{ item.lyric }}
            </v-list-item-title>
            <div
              class="text-caption text-truncate"
              v-else
              v-html="item.lyric"
            />
            <v-progress-linear
              v-if="config.audio != '' && config.slide_index == index"
              v-model="config.slide_progress"
              :indeterminate="loading"
              :height="5"
              :color="config.is_paused ? 'orange' : 'white'"
            />

            <img
              v-if="item.url_image"
              :src="$path.file(item.url_image)"
              style="display: none"
            />
          </v-list-item>
        </v-list>
      </div>
    </div>

    <template v-slot:footer>
      <l-player location="window" />
    </template>
  </Window>
</template>

<script>
import manifest from "../manifest.json";

import Window from "@/components/Window.vue";

import LSlide from "@/components/Slide.vue";
import LPlayer from "@/components/Player.vue";
import LFullscreenPlayer from "@/components/FullscreenPlayer.vue";

export default {
  name: "MediaComponent",
  components: {
    Window,
    LSlide,
    LPlayer,
    LFullscreenPlayer,
  },
  data: () => ({
    preview_height: 0,
    scrollPos: 0,
    returnScreenOpen: false,
    returnOpenHandler: null,
    returnCloseHandler: null,
    returnMenu: false,
    returnMenuLoading: false,
    returnScreens: [],
    returnDisplayId: null,
  }),
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
    is_online() {
      return this.$appdata.get("is_online");
    },
    loading() {
      return this.module.loading;
    },
    config() {
      return this.$media.config();
    },
    slide_index() {
      return this.config?.slide_index;
    },
    slides() {
      return this.$media.slides();
    },
    slide() {
      return this.$media.slide();
    },
    fullscreen: {
      get() {
        return this.module.config.fullscreen;
      },
      set(value) {
        this.$media.fullscreen(value);
      },
    },
    lazy_load: {
      get() {
        return this.$userdata.get("modules.media.lazy_load");
      },
      set(value) {
        this.$userdata.set("modules.media.lazy_load", value);
      },
    },
    fade_audio: {
      get() {
        return this.$userdata.get("modules.media.fade_audio");
      },
      set(value) {
        this.$userdata.set("modules.media.fade_audio", value);
      },
    },
  },
  watch: {
    slide_index() {
      if (!this.module.show) {
        return;
      }

      if (this.$refs?.slideItem && this.$refs?.slideItem[0]?.$el) {
        let self = this;
        let height = this.$refs.slideItem[0].$el.offsetHeight;
        setTimeout(function () {
          self.scrollPos = self.slide_index * height - height;
        }, 100);
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
    resize(data) {
      this.preview_height = data.container_height;
    },

    async toggleReturnScreen() {
      if (this.returnScreenOpen) {
        await this.$electron.closeReturnScreen();
      } else {
        await this.$electron.openReturnScreen(this.returnDisplayId || undefined);
      }
      this.returnMenu = false;
    },

    async onReturnMenuToggle(open) {
      if (!open) return;
      this.returnMenuLoading = true;
      try {
        this.returnScreens = (await this.$electron.getScreens()) || [];
        if (!this.returnDisplayId && this.returnScreens.length) {
          const ext = this.returnScreens.find(s => !s.primary);
          this.returnDisplayId = (ext ?? this.returnScreens[0]).id;
        }
      } finally {
        this.returnMenuLoading = false;
      }
    },

    async lockReturnDisplay(id) {
      if (this.returnDisplayId === id) return;
      this.returnDisplayId = id;
      await this.$electron.storeSet('return_display_id', id);
      if (this.returnScreenOpen) {
        await this.$electron.closeReturnScreen();
        await this.$electron.openReturnScreen(id);
      }
    },

    async identifyReturnScreens() {
      this.returnMenu = false;
      await this.$electron.identifyScreens();
    },
  },

  mounted() {
    this.returnOpenHandler = this.$electron.on('return-window-opened', () => { this.returnScreenOpen = true; });
    this.returnCloseHandler = this.$electron.on('return-window-closed', () => { this.returnScreenOpen = false; });
    if (this.$electron.isElectron()) {
      this.$electron.storeGet('return_display_id')
        .then(id => { if (id) this.returnDisplayId = id; })
        .catch(() => {});
      this.$electron.isReturnScreenOpen()
        .then(v => { this.returnScreenOpen = !!v; })
        .catch(() => {});
    }
  },

  beforeUnmount() {
    if (this.returnOpenHandler) this.$electron.off('return-window-opened', this.returnOpenHandler);
    if (this.returnCloseHandler) this.$electron.off('return-window-closed', this.returnCloseHandler);
  },
};
</script>
