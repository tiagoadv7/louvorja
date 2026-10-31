<template>
  <v-card theme="dark" class="w-100 pa-0 ma-0 d-flex align-center player-root" :class="{ 'player-root--footer': location == 'footer' }" :rounded="0">
    <!-- Miniplayer minimizado (estilo picture-in-picture): flutua acima da barra e mostra
         o slide como vai para a projeção; clicar nele volta para a tela principal.
         Sem slide (vídeo, link online, slides), mostra só o título do conteúdo. -->
    <div
      v-if="location == 'footer' && mini_slide"
      class="mini-pip"
      title="Abrir"
      @click="maximize"
    >
      <LSlide
        :slide_number="media.config.slide_index"
        :cover="mini_slide.cover == true"
        :text="mini_slide.lyric"
        :aux_text="mini_slide.aux_lyric"
        :image="mini_slide.url_image ? $path.file(mini_slide.url_image) : null"
        :image_position="mini_slide.image_position"
      />
    </div>
    <!-- Vídeo em reprodução e link online: o mesmo quadro, espelhando o que está na projeção -->
    <div
      v-else-if="location == 'footer' && mini_media"
      class="mini-pip"
      title="Abrir"
      @click="maximize"
    >
      <img
        v-if="mini_media.kind === 'image'"
        :src="mini_media.src"
        class="mini-pip-media"
        alt=""
      />
      <video
        v-else-if="mini_media.kind === 'video'"
        ref="miniVideo"
        :src="mini_media.src"
        class="mini-pip-media"
        muted
        playsinline
        @loadedmetadata="syncMiniVideo"
      />
      <iframe
        v-else
        :src="mini_media.src"
        class="mini-pip-media"
        allow="autoplay; encrypted-media"
        frameborder="0"
      />
    </div>
    <div
      v-else-if="location == 'footer' && mini_text"
      class="mini-lyric"
    >
      <div class="mini-lyric-text">{{ mini_text }}</div>
    </div>
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
        <!-- Repetir a faixa atual (coletâneas): liga/desliga, ver Media.js#_onSongFinished -->
        <v-btn
          v-if="source === 'media' && media.config.audio"
          variant="text"
          size="small"
          class="ma-1"
          :color="media.config.repeat ? 'primary' : ''"
          :icon="media.config.repeat ? 'mdi-repeat-once' : 'mdi-repeat'"
          @click="toggleRepeat"
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
              rounded="lg"
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
          v-if="location !== 'fullscreen' && source !== 'soundmaster' && source !== 'web_link'"
          :module="source === 'video' ? 'video_player' : source === 'slide_editor' ? 'slide_editor' : 'media'"
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
import LSlide from "@/components/Slide.vue";

export default {
  name: "PlayerComponent",
  props: {
    location: String,
    // 'media' (padrão, comportamento original) | 'video' | 'soundmaster' |
    // 'web_link' — mesma barra/layout, só troca de onde os dados/comandos vêm.
    // Assim a Liturgia/módulo de Vídeo/SoundMaster não precisam de uma barra própria.
    source: { type: String, default: "media" },
  },
  components: {
    LScreenBtn,
    LSlide,
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
      if (this.source === "slide_editor") {
        const np = this.$slideEditor.nowPlaying();
        return {
          minimized: this.$slideEditor.isMinimized(),
          loading: false,
          data: {},
          config: {
            title: np.title || "",
            subtitle: "",
            track: 0,
            image: "",
            audio: np.title ? "x" : "",
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
      if (this.source === "web_link") {
        const cfg = this.$webLink.getConfig();
        return {
          minimized: this.$webLink.isMinimized(),
          loading: false,
          data: {},
          config: {
            title: "YouTube",
            subtitle: "",
            track: 0,
            image: "",
            // "audio" aqui é só o flag genérico de "tem mídia carregada" que o
            // resto do componente usa pra mostrar play/pause/progresso (mesmo
            // uso overloadado do source="video" acima) — não tem relação com
            // áudio de fato.
            audio: cfg.videoId ? "x" : "",
            current_time: cfg.current_time || 0,
            duration: cfg.duration || 0,
            progress: cfg.duration > 0 ? (cfg.current_time / cfg.duration) * 100 : 0,
            buffered: 100,
            is_paused: !cfg.isPlaying,
            is_fading: !!cfg.isFading,
            volume: cfg.volume ?? 100,
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
    // Slide que está indo para a projeção (só música); o mesmo dado que o media/Index.vue usa
    mini_slide: function () {
      if (this.source !== "media") return null;
      return this.slides[this.media.config.slide_index] || null;
    },
    // Vídeo local (video_player) ou link online (YouTube com videoId ou outro link) em reprodução
    mini_media: function () {
      if (this.source === "video") {
        const cfg = this.$videoPlayer.getConfig();
        if (!cfg.src) return null;
        // Imagem da mídia: mostrada como figura (um <video> com imagem fica preto)
        if (cfg.mediaType === "image") return { kind: "image", src: cfg.src };
        return { kind: "video", src: cfg.src, time: cfg.currentTime || 0, playing: !!cfg.isPlaying };
      }
      if (this.source === "web_link") {
        const cfg = this.$webLink.getConfig();
        if (cfg.videoId) {
          return { kind: "youtube", src: `https://www.youtube.com/embed/${cfg.videoId}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1` };
        }
        if (cfg.url) return { kind: "iframe", src: cfg.url };
      }
      return null;
    },
    // Texto do miniplayer: letra do slide quando é música; nos outros casos, o título do conteúdo
    mini_text: function () {
      // Sem letra no slide atual (ex.: música tocando sem apresentação), mostra o nome da música
      if (this.source === "media") return this.slide_text || this.media.config?.title || "";
      return this.media.config?.title || "";
    },
    slide_text: function () {
      const slide = this.slides[this.media.config.slide_index];
      if (!slide || !slide.lyric) return "";

      let text = slide.lyric;
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
  watch: {
    // Espelha o vídeo local do quadro: play/pause e posição acompanham a projeção
    "mini_media.playing"(playing) {
      const el = this.$refs.miniVideo;
      if (!el) return;
      if (playing) el.play().catch(() => {});
      else el.pause();
    },
    "mini_media.time"(time) {
      const el = this.$refs.miniVideo;
      if (el && Math.abs(el.currentTime - time) > 0.8) el.currentTime = time;
    },
  },
  methods: {
    // Ao carregar o quadro, posiciona no tempo atual da projeção e segue o estado de reprodução
    syncMiniVideo() {
      const el = this.$refs.miniVideo;
      const m = this.mini_media;
      if (!el || !m) return;
      el.currentTime = m.time;
      if (m.playing) el.play().catch(() => {});
    },
    toggleRepeat() {
      this.$appdata.set("modules.media.config.repeat", !this.media.config.repeat);
    },
    play() {
      if (this.source === 'video') { this.$videoPlayer.togglePlay(); return; }
      if (this.source === 'soundmaster') { this.$soundMaster.togglePlay(); return; }
      if (this.source === 'web_link') { this.$webLink.togglePlay(); return; }
      if (this.source === 'slide_editor') { this.$slideEditor.togglePlay(); return; }
      if (this.media.config.is_paused) {
        this.$media.play();
      } else {
        this.$media.pause();
      }
    },
    rewind: function () {
      if (this.source === 'video') { this.$videoPlayer.seekBy(-10); return; }
      if (this.source === 'soundmaster') { this.$soundMaster.seekBy(-10); return; }
      if (this.source === 'web_link') { this.$webLink.seekBy(-10); return; }
      if (this.source === 'slide_editor') { this.$slideEditor.seekBy(-10); return; }
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
      if (this.source === 'web_link') { this.$webLink.seekBy(10); return; }
      if (this.source === 'slide_editor') { this.$slideEditor.seekBy(10); return; }
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
      if (this.source === 'web_link') { this.$webLink.maximize(); return; }
      if (this.source === 'slide_editor') { this.$slideEditor.maximize(); return; }
      this.$media.maximize();
    },
    close: function () {
      if (this.source === 'video') { this.$videoPlayer.stop(); return; }
      if (this.source === 'soundmaster') { this.$soundMaster.stop(); return; }
      if (this.source === 'web_link') { this.$webLink.stop(); return; }
      if (this.source === 'slide_editor') { this.$slideEditor.stop(); return; }
      this.$media.close();
    },
    changeProgress() {
      const time =
        (this.media.config.duration * this.media.config.progress) / 100;
      if (this.source === 'video') { this.$videoPlayer.seekTo(time); return; }
      if (this.source === 'soundmaster') { this.$soundMaster.seekTo(time); return; }
      if (this.source === 'web_link') { this.$webLink.seekTo(time); return; }
      if (this.source === 'slide_editor') { this.$slideEditor.seekTo(time); return; }
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
        else if (this.source === 'web_link') this.$webLink.setVolume(vol);
        else if (this.source === 'slide_editor') this.$slideEditor.setVolume(vol);
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
      if (this.source === 'web_link') { this.$webLink.setVolume(this.media.config.volume); return; }
      if (this.source === 'slide_editor') { this.$slideEditor.setVolume(this.media.config.volume); return; }
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

<style scoped>
/* Letra do slide flutuando acima da barra no miniplayer minimizado (mesmo espírito
   da miniatura do mini player de vídeo, mas com o texto da música no lugar da capa). */
/* Vídeo/link dentro do quadro: preenche o quadro e não recebe cliques (o quadro abre a tela principal) */
.mini-pip-media {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  object-fit: contain;
  pointer-events: none;
}
/* O cartão do rodapé não pode cortar o que flutua acima dele (miniplayer). */
.player-root--footer {
  overflow: visible !important;
}
/* Picture-in-picture do slide: 16:9, cantos arredondados e sombra, flutuando sobre a barra */
.mini-pip {
  position: absolute;
  left: 16px;
  bottom: 100%;
  width: 320px;
  max-width: calc(100vw - 32px);
  aspect-ratio: 16 / 9;
  margin-bottom: 8px;
  border-radius: 10px;
  overflow: hidden;
  background: #000;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  cursor: pointer;
  z-index: 50;
}
.mini-lyric {
  position: absolute;
  left: 16px;
  bottom: 100%;
  width: 420px;
  max-width: calc(100vw - 32px);
  max-height: 190px;
  margin-bottom: 8px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #000;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  z-index: 50;
}
.mini-lyric-text {
  color: #f6c32a;
  font-weight: 700;
  font-size: 18px;
  line-height: 1.35;
  text-align: center;
  text-transform: uppercase;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
}
</style>
