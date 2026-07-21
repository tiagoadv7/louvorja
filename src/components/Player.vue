<template>
  <v-card theme="dark" class="w-100 pa-0 ma-0 d-flex align-center" :rounded="0">
    <div
      v-if="location == 'footer' && $vuetify.display.width > 800"
      class="d-flex align-center"
      :style="
        media.config.image && $vuetify.display.width > 900
          ? 'max-width: 350px;padding-right:50px;'
          : 'max-width: 300px'
      "
    >
      <v-avatar
        v-if="media.config.image && $vuetify.display.width > 900"
        class="ma-1"
        size="65"
        rounded="0"
      >
        <v-img :src="$path.file(media.config.image)" />
      </v-avatar>
      <div class="d-flex flex-column flex-grow-1 w-100">
        <v-card-title class="py-0">
          {{ media.config.title }}
        </v-card-title>
        <v-card-subtitle v-if="media.config.subtitle" class="py-0">
          {{ media.config.subtitle }}
          <span v-if="media.config.track > 0">
            | {{ $t("modules.media.general.track") }}
            {{ media.config.track }}</span
          >
        </v-card-subtitle>
      </div>
    </div>

    <div class="d-flex flex-column flex-grow-1">
      <div class="d-flex align-center justify-center py-1 flex-grow-1">
        <v-btn
          v-for="(button, key) in buttons"
          :key="key"
          v-show="
            button.show &&
            (compact === false || (compact === true && !button.compact))
          "
          :disabled="media.loading || button.disabled"
          :icon="button.icon"
          :color="button.highlight ? 'white' : ''"
          @click="button.click"
          @shortkey="button.click"
          v-shortkey="button.shortkey"
          :variant="button.highlight ? 'flat' : 'text'"
          class="ma-1"
          size="small"
        />
      </div>
      <div
        v-if="media.config.audio"
        class="d-flex align-center justify-center py-1 px-3"
      >
        <div class="text-right text-caption">
          {{ $datetime.shortTime(media.config.current_time) }}
        </div>
        <div class="flex-grow-1 px-2">
          <v-progress-linear
            v-model="media.config.progress"
            rounded
            clickable
            :indeterminate="media.loading"
            :height="10"
            :stream="!media.loading"
            :buffer-value="media.config.buffered"
            :color="
              media.config.is_paused
                ? 'warning'
                : media.config.volume <= 0
                ? 'red'
                : 'info'
            "
            @click="changeProgress"
          />
        </div>
        <div class="text-left text-caption">
          {{ $datetime.shortTime(media.config.duration) }}
        </div>
      </div>
      <div
        v-if="!media.config.audio && location == 'footer' && source === 'media'"
        class="d-flex align-center justify-center py-1 px-3"
      >
        <small class="text-center">
          {{ slide_text }}
        </small>
      </div>
      <div
        v-else-if="!media.config.audio && location == 'footer' && source === 'video'"
        class="d-flex align-center justify-center py-1 px-3"
      >
        <small class="text-center">Imagem exibida na tela de projeção</small>
      </div>
    </div>
    <div class="d-flex flex-column">
      <div class="d-flex align-center justify-end pa-1 flex-grow-1">
        <v-menu
          v-if="source === 'media' && location !== 'fullscreen' && $vuetify.display.width > 350"
        >
          <template v-slot:activator="{ props }">
            <v-btn
              variant="text"
              size="small"
              :color="mode.color"
              v-bind="props"
              :icon="mode.tray_icon"
            />
          </template>

          <v-list>
            <template v-for="(mode, key) in menu_modes" :key="key">
              <v-divider v-if="mode.title == '-'" />
              <v-list-item
                v-else
                :active="mode.active"
                :disabled="mode.disabled"
                @click="mode.click"
              >
                <template v-slot:prepend>
                  <v-icon :icon="mode.icon"></v-icon>
                </template>
                {{ mode.title }}
              </v-list-item>
            </template>
          </v-list>
        </v-menu>

        <!-- Vídeo: sem modo cantado/instrumental — botão dedicado pro mini
             player flutuante (PIP) no mesmo lugar do menu de modos do media -->
        <v-btn
          v-if="source === 'video' && $electron.isElectron()"
          variant="text"
          size="small"
          :color="pipOpen ? 'primary' : ''"
          icon="mdi-picture-in-picture-bottom-right"
          title="Mini player flutuante"
          @click="togglePip"
        />

        <v-menu v-if="source === 'media' && this.media.minimized && !compact">
          <template v-slot:activator="{ props }">
            <v-btn variant="flat" size="x-small" color="white" v-bind="props">
              {{ this.media.config.slide_index + 1 }}
            </v-btn>
          </template>

          <v-list>
            <v-list-item
              v-for="(item, index) in slides"
              :key="index"
              :active="media.config.slide_index == index"
              @click="$media.goToSlide(index)"
            >
              <template v-slot:prepend>
                <v-chip size="small" class="mr-2">{{ index + 1 }}</v-chip>
              </template>

              <v-list-item-title v-if="item.cover">
                {{ item.lyric }}
              </v-list-item-title>
              <div
                class="text-caption text-truncate"
                v-else
                v-html="item.lyric"
              />
            </v-list-item>
          </v-list>
        </v-menu>

        <v-btn
          v-if="this.media.minimized"
          variant="text"
          size="small"
          icon="mdi-open-in-app"
          @click="maximize()"
        />
        <v-btn
          v-if="location == 'fullscreen'"
          variant="text"
          size="small"
          icon="mdi-fullscreen-exit"
          @click="fullscreen(false)"
        />
        <v-btn
          v-else-if="location == 'window'"
          variant="text"
          size="small"
          icon="mdi-fullscreen"
          @click="fullscreen()"
        />
        <LScreenBtn
          v-if="location !== 'fullscreen' && source !== 'soundmaster'"
          :module="source === 'video' ? 'video_player' : 'media'"
        />

        <v-menu v-if="location !== 'fullscreen' && compact">
          <template v-slot:activator="{ props }">
            <v-btn
              icon="mdi-menu"
              variant="text"
              size="small"
              v-bind="props"
            ></v-btn>
          </template>

          <v-list>
            <v-list-item
              v-for="(button, key) in buttons.filter(
                (item) => item.compact == true
              )"
              :key="key"
              :disabled="media.loading || button.disabled"
              @click="button.click"
              @shortkey="button.click"
              v-shortkey="button.shortkey"
            >
              <v-icon :icon="button.icon" />
            </v-list-item>

            <template v-if="source === 'media'">
              <v-divider v-if="$vuetify.display.width <= 350" />
              <template v-for="(mode, key) in menu_modes" :key="key">
                <v-divider
                  v-if="mode.title == '-' && $vuetify.display.width <= 350"
                />
                <v-list-item
                  v-else-if="$vuetify.display.width <= 350"
                  :active="mode.active"
                  :disabled="mode.disabled"
                  @click="mode.click"
                >
                  <v-icon :icon="mode.icon" />
                </v-list-item>
              </template>
            </template>
          </v-list>
        </v-menu>

        <v-btn
          v-if="this.media.minimized"
          variant="text"
          size="small"
          icon="mdi-close"
          @click="close()"
        />
      </div>
      <div
        v-if="media.config.audio"
        class="d-flex align-center justify-center pa-1"
      >
        <div>
          <v-btn
            :disabled="media.loading"
            :icon="volume_icon"
            size="x-small"
            @click="toogleVolume"
            variant="text"
          />
        </div>
        <div class="flex-grow-1 px-2" style="min-width: 100px">
          <v-progress-linear
            v-model="media.config.volume"
            rounded
            clickable
            :height="10"
            color="white"
            @click="changeVolume"
          />
        </div>
      </div>
    </div>
  </v-card>
</template>

<script>
import LScreenBtn from "@/components/buttons/Screen.vue";

export default {
  name: "PlayerComponent",
  props: {
    location: String,
    // 'media' (padrão, comportamento original) | 'video' | 'soundmaster' —
    // mesma barra/layout, só troca de onde os dados/comandos vêm. Assim a
    // Liturgia/módulo de Vídeo/SoundMaster não precisam de uma barra própria.
    source: { type: String, default: "media" },
  },
  components: {
    LScreenBtn,
  },
  data: () => ({
    pipOpen: false,
    _volumeFadeInterval: null,
  }),
  computed: {
    // Formato compatível com $modules.get("media") — só o necessário pro
    // resto do componente (template/botões) funcionar sem saber a origem.
    media() {
      if (this.source === "video") {
        const cfg = this.$videoPlayer.getConfig();
        const isImage = cfg.mediaType === "image";
        return {
          minimized: this.$videoPlayer.isMinimized(),
          loading: false,
          data: {},
          config: {
            title: cfg.name || "",
            subtitle: "",
            track: 0,
            image: "",
            audio: !isImage ? (cfg.src || "") : "",
            current_time: cfg.currentTime || 0,
            duration: cfg.duration || 0,
            progress: cfg.duration > 0 ? (cfg.currentTime / cfg.duration) * 100 : 0,
            buffered: 100,
            is_paused: !cfg.isPlaying,
            is_fading: false,
            volume: cfg.volume ?? 100,
          },
        };
      }
      if (this.source === "soundmaster") {
        const np = this.$soundMaster.nowPlaying();
        return {
          minimized: this.$soundMaster.isMinimized(),
          loading: false,
          data: {},
          config: {
            title: np.name || "",
            subtitle: "",
            track: 0,
            image: "",
            audio: np.name ? "x" : "",
            current_time: np.current_time || 0,
            duration: np.duration || 0,
            progress: np.progress || 0,
            buffered: 100,
            is_paused: !np.playing,
            is_fading: false,
            volume: np.volume ?? 100,
          },
        };
      }
      return this.$modules.get("media");
    },
    slides() {
      return this.$media.slides();
    },
    has_instrumental_music() {
      return this.media.data.url_instrumental_music ? true : false;
    },
    buttons() {
      return [
        {
          show: this.media.config.audio,
          compact: true,
          disabled: false,
          highlight: false,
          icon: "mdi-rewind-10",
          click: () => this.rewind(),
          shortkey: {
            left: ["ctrl", "arrowleft"],
            up: ["ctrl", "arrowup"],
            pgup: ["ctrl", "pageup"],
          },
        },
        {
          show: this.source === 'media',
          compact: true,
          disabled: this.media.config.slide_index <= 0,
          highlight: false,
          icon: "mdi-page-first",
          click: () => this.first(),
          shortkey: ["home"],
        },
        {
          show: this.source === 'media',
          compact: false,
          disabled: this.media.config.slide_index <= 0,
          highlight: false,
          icon: "mdi-chevron-left",
          click: () => this.prev(),
          shortkey: {
            left: ["arrowleft"],
            up: ["arrowup"],
            pgup: ["pageup"],
          },
        },
        {
          show: this.media.config.audio,
          compact: false,
          disabled: this.media.config.is_fading,
          highlight: true,
          icon: this.media.config.is_paused ? "mdi-play" : "mdi-pause",
          click: () => this.play(),
          shortkey: ["space"],
        },
        {
          show: this.source === 'media',
          compact: false,
          disabled:
            this.media.config.slide_index >= this.media.config.last_slide - 1,
          highlight: false,
          icon: "mdi-chevron-right",
          click: () => this.next(),
          shortkey: {
            right: ["arrowright"],
            down: ["arrowdown"],
            pgdn: ["pagedown"],
          },
        },
        {
          show: this.source === 'media',
          compact: true,
          disabled:
            this.media.config.slide_index >= this.media.config.last_slide - 1,
          highlight: false,
          icon: "mdi-page-last",
          click: () => this.last(),
          shortkey: ["end"],
        },
        {
          show: this.media.config.audio,
          compact: true,
          disabled: false,
          highlight: false,
          icon: "mdi-fast-forward-10",
          click: () => this.forward(),
          shortkey: {
            right: ["ctrl", "arrowright"],
            down: ["ctrl", "arrowdown"],
            pgdn: ["ctrl", "pagedown"],
          },
        },
      ];
    },
    menu_modes() {
      return [
        {
          mode: "audio",
          title: this.$t("modules.media.general.sung"),
          color: "info",
          active: this.media.config.mode == "audio",
          icon: "mdi-play-box-multiple",
          tray_icon: "mdi-account-voice",
          click: () =>
            this.open({
              id_music: this.media.id_music,
              mode: "audio",
              minimized: this.media.minimized,
            }),
        },
        {
          mode: "instrumental",
          title: this.$t("modules.media.general.instrumental"),
          color: "success",
          active: this.media.config.mode == "instrumental",
          disabled: !this.has_instrumental_music,
          icon: "mdi-play-box-multiple-outline",
          tray_icon: "mdi-music-note",
          click: () =>
            this.open({
              id_music: this.media.id_music,
              mode: "instrumental",
              minimized: this.media.minimized,
            }),
        },
        {
          mode: "no_audio",
          title: this.$t("modules.media.general.no_audio"),
          color: "error",
          active: this.media.config.mode == "no_audio",
          icon: "mdi-checkbox-multiple-blank-outline",
          tray_icon: "mdi-music-off",
          click: () =>
            this.open({
              id_music: this.media.id_music,
              minimized: this.media.minimized,
            }),
        },
        { title: "-" },
        {
          title: this.$t("modules.media.general.lyric"),
          color: "error",
          icon: "mdi-text-box-outline",
          click: () => this.openLyric(),
        },
      ];
    },
    mode() {
      return this.menu_modes.filter(
        (item) => item.mode == this.media.config.mode
      )[0];
    },
    volume_icon: function () {
      switch (true) {
        case this.media.config.volume <= 0:
          return "mdi-volume-mute";
        case this.media.config.volume <= 20:
          return "mdi-volume-low";
        case this.media.config.volume <= 70:
          return "mdi-volume-medium";
        default:
          return "mdi-volume-high";
      }
    },
    slide_text: function () {
      if (!this.slides[this.media.config.slide_index]) return "";
      if (!this.slides[this.media.config.slide_index].lyric) return "";

      let text = this.slides[this.media.config.slide_index].lyric;
      text = text.replace(/<br>/gi, " / ").toUpperCase();
      return text;
    },
    is_mobile: function () {
      return this.$appdata.get("is_mobile");
    },
    compact: function () {
      return this.$vuetify.display.width <= 500;
    },
  },
  methods: {
    play() {
      if (this.source === 'video') { this.$videoPlayer.togglePlay(); return; }
      if (this.source === 'soundmaster') { this.$soundMaster.togglePlay(); return; }
      if (this.media.config.is_paused) {
        this.$media.play();
      } else {
        this.$media.pause();
      }
    },
    rewind: function () {
      if (this.source === 'video') { this.$videoPlayer.seekBy(-10); return; }
      if (this.source === 'soundmaster') { this.$soundMaster.seekBy(-10); return; }
      this.$media.advanceTime(-10);
    },
    first() {
      this.$media.firstSlide();
    },
    prev() {
      this.$media.prevSlide();
    },
    next() {
      this.$media.nextSlide();
    },
    last() {
      this.$media.lastSlide();
    },
    forward: function () {
      if (this.source === 'video') { this.$videoPlayer.seekBy(10); return; }
      if (this.source === 'soundmaster') { this.$soundMaster.seekBy(10); return; }
      this.$media.advanceTime(+10);
    },
    open: function (data) {
      this.$media.open(data);
    },
    openLyric: function () {
      this.$media.openLyric();
    },
    maximize: function () {
      if (this.source === 'video') { this.$videoPlayer.maximize(); return; }
      if (this.source === 'soundmaster') { this.$soundMaster.maximize(); return; }
      this.$media.maximize();
    },
    close: function () {
      if (this.source === 'video') { this.$videoPlayer.stop(); return; }
      if (this.source === 'soundmaster') { this.$soundMaster.stop(); return; }
      this.$media.close();
    },
    changeProgress() {
      const time =
        (this.media.config.duration * this.media.config.progress) / 100;
      if (this.source === 'video') { this.$videoPlayer.seekTo(time); return; }
      if (this.source === 'soundmaster') { this.$soundMaster.seekTo(time); return; }
      this.$media.goToTime(time);
    },
    fullscreen(value = true) {
      this.$media.fullscreen(value);
    },
    toogleVolume() {
      const from = this.media.config.volume;
      const target = from < 100 ? 100 : 0;
      this._fadeVolumeTo(from, target);
    },
    // Mute/unmute suave (em passos, ~280ms) em vez de saltar direto pro
    // volume final — vale pra media, vídeo e coletânea (mesmo botão aqui na
    // barra, incluindo quando ela está minimizada mostrando o rodapé).
    _fadeVolumeTo(from, target) {
      clearInterval(this._volumeFadeInterval);
      const STEPS = 10;
      const INTERVAL = 28;
      const delta = (target - from) / STEPS;
      const setStep = (v) => {
        const vol = Math.round(Math.max(0, Math.min(100, v)));
        if (this.source === 'video') this.$videoPlayer.setVolume(vol);
        else if (this.source === 'soundmaster') this.$soundMaster.setVolume(vol);
        else this.$media.setVolume(vol);
      };
      let n = 0;
      this._volumeFadeInterval = setInterval(() => {
        n++;
        setStep(n >= STEPS ? target : from + delta * n);
        if (n >= STEPS) {
          clearInterval(this._volumeFadeInterval);
          this._volumeFadeInterval = null;
        }
      }, INTERVAL);
    },
    changeVolume() {
      if (this.source === 'video') { this.$videoPlayer.setVolume(this.media.config.volume); return; }
      if (this.source === 'soundmaster') { this.$soundMaster.setVolume(this.media.config.volume); return; }
      this.$media.setVolume(this.media.config.volume);
    },
    async togglePip() {
      if (this.pipOpen) { await this.$electron.pipClose(); this.pipOpen = false; }
      else { await this.$electron.pipOpen(); this.pipOpen = true; }
    },
  },
  async mounted() {
    if (this.source !== 'video' || !this.$electron.isElectron()) return;
    this.pipOpen = await this.$electron.pipIsOpen();
    this._pipClosedHandler = this.$electron.on('video-pip:closed', () => { this.pipOpen = false; });
  },
  beforeUnmount() {
    if (this._pipClosedHandler) this.$electron.off('video-pip:closed', this._pipClosedHandler);
    clearInterval(this._volumeFadeInterval);
  },
};
</script>
