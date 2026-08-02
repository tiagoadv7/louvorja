<template>
  <l-window
    v-model="module.show"
    :title="t('title')"
    :icon="module.icon"
    closable
    minimizable
    @close="close()"
    @minimize="$modules.minimize(module_id)"
    :index="show ? 1 : 0"
  >
    <template v-slot:customize>
      <l-customization-tools
        :module="module"
        :items="[
          {
            name: t('customization.background'),
            items: [
              'background_color',
              ['image', 'image_opacity', 'image_fit'],
            ],
          },
          {
            name: t('customization.align'),
            items: [['horizontal_align', 'vertical_align']],
          },
          {
            name: t('customization.text'),
            items: [['font', 'font_size', 'font_color']],
          },
          { name: t('customization.window'), items: ['border_spacing'] },
        ]"
      />
    </template>

    <template v-slot:system_buttons>
      <LScreenBtn module="cronometro_culto" />
      <LReturnScreenBtn module="cronometro_culto" />
    </template>

    <template v-slot:header>
      <l-toolbar>
        <l-toolbar-item>
          <div class="d-flex align-center h-100">
            <v-tooltip location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn
                  v-bind="props"
                  :icon="isRunning ? 'mdi-stop' : 'mdi-play'"
                  :color="isRunning ? 'red' : 'green'"
                  size="small"
                  variant="tonal"
                  @click="toggleRunning"
                />
              </template>
              {{ isRunning ? t("off") : t("on") }}
            </v-tooltip>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-divider vertical class="cc-sep" />
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="d-flex flex-column justify-center h-100">
            <v-radio-group v-model="userdata.mode" density="compact" hide-details :disabled="isRunning">
              <div class="d-flex align-center cc-mode-row mb-2">
                <v-radio :label="t('end_time')" value="end_time" density="compact" hide-details />
                <input
                  type="time"
                  v-model="userdata.end_time_str"
                  class="cc-time-input"
                  :disabled="userdata.mode !== 'end_time' || isRunning"
                />
              </div>
              <div class="d-flex align-center cc-mode-row">
                <v-radio :label="t('duration')" value="duration" density="compact" hide-details />
                <input
                  type="number"
                  min="0"
                  v-model.number="userdata.duration_minutes"
                  class="cc-number-input"
                  :disabled="userdata.mode !== 'duration' || isRunning"
                />
              </div>
            </v-radio-group>
            <div class="cc-end-time-caption">
              <span class="text-caption text-medium-emphasis">{{ t("end_time_label") }}:</span>
              <span class="text-body-1 font-weight-medium ml-1">{{ endTimeLabel }}</span>
            </div>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-divider vertical class="cc-sep" />
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="text-caption text-medium-emphasis mb-2">{{ t("add_subtract_time") }}</div>
          <div class="d-flex cc-btn-row">
            <v-btn size="x-small" variant="tonal" @click="adjustTime(1)">+1</v-btn>
            <v-btn size="x-small" variant="tonal" @click="adjustTime(5)">+5</v-btn>
            <v-btn size="x-small" variant="tonal" @click="adjustTime(10)">+10</v-btn>
          </div>
          <div class="d-flex cc-btn-row mt-2">
            <v-btn size="x-small" variant="tonal" @click="adjustTime(-1)">-1</v-btn>
            <v-btn size="x-small" variant="tonal" @click="adjustTime(-5)">-5</v-btn>
            <v-btn size="x-small" variant="tonal" @click="adjustTime(-10)">-10</v-btn>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-divider vertical class="cc-sep" />
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="text-caption text-medium-emphasis mb-2">{{ t("audio_group") }}</div>
          <div class="cc-checkbox-col">
            <v-checkbox v-model="userdata.audio_abertura_enabled" :label="t('audio_opening')" density="compact" hide-details />
            <v-checkbox v-model="userdata.audio_5min_enabled" :label="t('audio_5min')" density="compact" hide-details />
            <v-checkbox v-model="userdata.audio_1min_enabled" :label="t('audio_1min')" density="compact" hide-details />
          </div>
          <div class="d-flex align-center mt-2" style="gap: 10px">
            <l-select
              v-model="previewCue"
              :items="cueOptions"
              item-value="value"
              item-title="title"
              density="compact"
              hide-details
              style="max-width: 150px"
            />
            <v-tooltip location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn
                  v-bind="props"
                  :icon="previewPlaying ? 'mdi-stop' : 'mdi-volume-high'"
                  :color="previewPlaying ? 'red' : undefined"
                  size="small"
                  variant="tonal"
                  @click="ouvir"
                />
              </template>
              {{ previewPlaying ? t("stop_listening") : t("listen") }}
            </v-tooltip>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-divider vertical class="cc-sep" />
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="text-caption text-medium-emphasis mb-2">{{ t("options") }}</div>
          <div class="cc-checkbox-col">
            <v-checkbox v-model="userdata.auto_stop_at_zero" :label="t('auto_stop_at_zero')" density="compact" hide-details />
          </div>
          <v-btn size="small" variant="tonal" class="mt-2" @click="toggleClockVisibility">
            <v-icon size="16" class="me-2">{{ showClock ? "mdi-clock-remove-outline" : "mdi-clock-outline" }}</v-icon>
            {{ showClock ? t("hide_clock") : t("show_clock") }}
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-divider vertical class="cc-sep" />
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="text-caption text-medium-emphasis mb-2">{{ t("format") }}</div>
          <l-select
            :label="t('hour_format')"
            v-model="userdata.hour_format"
            :items="hourFormatOptions"
            item-value="value"
            item-title="title"
            density="compact"
            hide-details
            style="max-width: 150px; margin-bottom: 8px"
          />
          <l-select
            :label="t('time_format')"
            v-model="userdata.time_format"
            :items="timeFormatOptions"
            item-value="value"
            item-title="title"
            density="compact"
            hide-details
            style="max-width: 150px"
          />
        </l-toolbar-item>
      </l-toolbar>
    </template>

    <Screen ref="screen" />
  </l-window>
</template>

<script>
import manifest from "../manifest.json";
import LWindow from "@/components/Window.vue";
import Screen from "../components/Screen.vue";
import LScreenBtn from "@/components/buttons/Screen.vue";
import LReturnScreenBtn from "@/components/buttons/ReturnScreen.vue";
import LSelect from "@/components/inputs/Select.vue";
import LCustomizationTools from "@/components/CustomizationTools.vue";
import LToolbar from "@/components/Toolbar.vue";
import LToolbarItem from "@/components/ToolbarItem.vue";

const CUE_FILES = {
  abertura: "abertura_escsb.mp3",
  "5min": "5minutos_escsb.mp3",
  "1min": "1minuto_escsb.mp3",
};

function toFileUrl(fp) {
  if (!fp) return null;
  const p = fp.replace(/\\/g, "/");
  const driveMatch = p.match(/^([A-Za-z]:)(\/.*)$/);
  if (driveMatch) {
    const [, drive, rest] = driveMatch;
    return `file:///${drive}${rest.split("/").map(encodeURIComponent).join("/")}`;
  }
  const encoded = p.split("/").map(encodeURIComponent).join("/");
  return p.startsWith("/") ? `file://${encoded}` : `file:///${encoded}`;
}

export default {
  name: manifest.id,
  components: {
    LWindow,
    Screen,
    LScreenBtn,
    LReturnScreenBtn,
    LSelect,
    LCustomizationTools,
    LToolbar,
    LToolbarItem,
  },
  data: () => ({
    isRunning: false,
    targetEndAt: null,
    totalDurationMs: 0,
    firedAbertura: false,
    fired5min: false,
    fired1min: false,
    previewCue: "abertura",
    previewPlaying: false,
    previewAudio: null,
    previewFadeInterval: null,
    cueOptions: [
      { title: "Abertura", value: "abertura" },
      { title: "5 minutos", value: "5min" },
      { title: "1 minuto", value: "1min" },
    ],
    hourFormatOptions: [
      { title: "hh:mm:ss", value: "hh:mm:ss" },
      { title: "hh:mm", value: "hh:mm" },
    ],
    timeFormatOptions: [
      { title: "hh:mm:ss", value: "hh:mm:ss" },
      { title: "mm:ss", value: "mm:ss" },
    ],
    ticker: null,
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
    appdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$appdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$appdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */

    show() {
      return this.module.show;
    },

    endTimeLabel() {
      if (!this.targetEndAt) return "00:00";
      const pad = (v) => String(v).padStart(2, "0");
      return `${pad(this.targetEndAt.getHours())}:${pad(this.targetEndAt.getMinutes())}`;
    },

    showClock() {
      return this.userdata.show_clock !== false;
    },
  },

  watch: {
    targetEndAt() {
      this.appdata.target_end_at = this.targetEndAt;
    },
    isRunning() {
      this.appdata.is_running = this.isRunning;
    },
    totalDurationMs() {
      this.appdata.total_duration_ms = this.totalDurationMs;
    },
  },

  methods: {
    /* METHODS OBRIGATÓRIAS - INÍCIO */
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
    /* METHODS OBRIGATÓRIAS - FIM */

    close() {
      this.stopTicker();
      // Fechar o painel do operador nunca encerra a projeção — só o botão
      // "Fechar" da tela de saída (Screen.vue) faz isso.
      this.$modules.close(this.module_id);
    },

    computeTargetEndAt() {
      const now = new Date();
      if (this.userdata.mode === 'duration') {
        const minutes = Number(this.userdata.duration_minutes) || 0;
        return new Date(now.getTime() + minutes * 60000);
      }
      const [h, m] = (this.userdata.end_time_str || '00:00').split(':').map(Number);
      const target = new Date(now);
      target.setHours(h || 0, m || 0, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      return target;
    },

    toggleRunning() {
      if (this.isRunning) {
        this.isRunning = false;
        this.stopTicker();
        // Parar zera o tempo exibido em vez de congelar no valor restante —
        // limpando target_end_at, o remainingMs do Screen.vue volta a 0.
        this.targetEndAt = null;
        this.totalDurationMs = 0;
        return;
      }
      this.targetEndAt = this.computeTargetEndAt();
      this.totalDurationMs = this.targetEndAt - new Date();
      this.firedAbertura = false;
      this.fired5min = false;
      this.fired1min = false;
      this.isRunning = true;
      if (this.userdata.audio_abertura_enabled) this.playCueFile('abertura');
      this.startTicker();
    },

    adjustTime(minutes) {
      if (this.targetEndAt && this.isRunning) {
        this.targetEndAt = new Date(this.targetEndAt.getTime() + minutes * 60000);
        this.totalDurationMs += minutes * 60000;
        return;
      }
      if (this.userdata.mode === 'duration') {
        this.userdata.duration_minutes = Math.max(0, (Number(this.userdata.duration_minutes) || 0) + minutes);
        return;
      }
      const [h, m] = (this.userdata.end_time_str || '00:00').split(':').map(Number);
      const d = new Date();
      d.setHours(h || 0, m || 0, 0, 0);
      d.setTime(d.getTime() + minutes * 60000);
      const pad = (v) => String(v).padStart(2, '0');
      this.userdata.end_time_str = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    startTicker() {
      this.stopTicker();
      this.ticker = setInterval(() => this.checkThresholds(), 500);
    },
    stopTicker() {
      clearInterval(this.ticker);
      this.ticker = null;
    },
    checkThresholds() {
      if (!this.targetEndAt) return;
      const remainingMs = this.targetEndAt - new Date();

      // Dispara 10s antes das marcas de 5 minutos e 1 minuto, não em cima delas.
      if (remainingMs <= 310000 && !this.fired5min && this.userdata.audio_5min_enabled) {
        this.playCueFile('5min');
        this.fired5min = true;
      }
      if (remainingMs <= 70000 && !this.fired1min && this.userdata.audio_1min_enabled) {
        this.playCueFile('1min');
        this.fired1min = true;
      }
      if (remainingMs <= 0 && this.userdata.auto_stop_at_zero) {
        this.isRunning = false;
        this.stopTicker();
      }
    },

    // Botão "Ouvir": alterna entre tocar e parar — parar corta com um fade
    // suave (~400ms) em vez de cortar o áudio na hora.
    ouvir() {
      if (this.previewPlaying) {
        this.stopPreview();
        return;
      }
      this.playPreview();
    },

    async resolveCueUrl(cue) {
      const dir = await this.$electron.configGetDir();
      if (!dir) return null;
      const fileName = CUE_FILES[cue];
      if (!fileName) return null;
      const separator = dir.endsWith('/') || dir.endsWith('\\') ? '' : '/';
      return toFileUrl(`${dir}${separator}${fileName}`);
    },

    async playPreview() {
      this.stopPreview(true);
      const url = await this.resolveCueUrl(this.previewCue);
      if (!url) return;
      const audio = new Audio(url);
      this.previewAudio = audio;
      this.previewPlaying = true;
      audio.addEventListener('ended', () => {
        if (this.previewAudio === audio) this.resetPreviewState();
      });
      audio.play().catch(() => this.resetPreviewState());
    },

    stopPreview(immediate = false) {
      clearInterval(this.previewFadeInterval);
      this.previewFadeInterval = null;
      const audio = this.previewAudio;
      if (!audio) return;
      if (immediate) {
        audio.pause();
        this.resetPreviewState();
        return;
      }
      const stepMs = 30;
      const decrement = audio.volume / (400 / stepMs);
      this.previewFadeInterval = setInterval(() => {
        audio.volume = Math.max(0, audio.volume - decrement);
        if (audio.volume <= 0) {
          audio.pause();
          this.resetPreviewState();
        }
      }, stepMs);
    },

    resetPreviewState() {
      clearInterval(this.previewFadeInterval);
      this.previewFadeInterval = null;
      this.previewAudio = null;
      this.previewPlaying = false;
    },

    toggleClockVisibility() {
      this.userdata.show_clock = this.showClock ? false : true;
    },

    async playCueFile(cue) {
      const url = await this.resolveCueUrl(cue);
      if (!url) return;
      new Audio(url).play().catch(() => {});
    },
  },

  mounted() {
    if (!this.userdata.mode) this.userdata.mode = 'duration';
    if (this.userdata.duration_minutes == null) this.userdata.duration_minutes = 40;
    if (!this.userdata.end_time_str) this.userdata.end_time_str = '10:00';
    if (this.userdata.audio_abertura_enabled == null) this.userdata.audio_abertura_enabled = true;
    if (this.userdata.audio_5min_enabled == null) this.userdata.audio_5min_enabled = true;
    if (this.userdata.audio_1min_enabled == null) this.userdata.audio_1min_enabled = true;
    if (!this.userdata.hour_format) this.userdata.hour_format = 'hh:mm:ss';
    if (!this.userdata.time_format) this.userdata.time_format = 'hh:mm:ss';

    const savedTarget = this.appdata.target_end_at;
    const savedRunning = this.appdata.is_running;
    if (savedTarget) this.targetEndAt = savedTarget instanceof Date ? savedTarget : new Date(savedTarget);
    if (savedRunning && this.targetEndAt) {
      this.isRunning = true;
      this.totalDurationMs = this.appdata.total_duration_ms || 0;
      this.startTicker();
    }
  },
  unmounted() {
    this.stopTicker();
    this.stopPreview(true);
  },
};
</script>

<style scoped>
.cc-time-input,
.cc-number-input {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 13px;
  background: transparent;
  color: inherit;
  width: 90px;
}
.cc-mode-row {
  gap: 10px;
}
.cc-btn-row {
  gap: 6px;
}
.cc-checkbox-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cc-sep {
  height: 100%;
  min-height: 44px;
}
.cc-end-time-caption {
  margin-top: 4px;
}
</style>
