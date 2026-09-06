<template>
  <l-window
    v-model="module.show"
    :title="t('title')"
    :icon="module.icon"
    closable
    minimizable
    @close="close()"
    @minimize="$modules.minimize(module_id)"
    @resize="resize"
    :index="show ? 1 : 0"
  >
    <template v-slot:customize>
      <!-- Cada aba tem seu próprio conjunto de opções de aparência, sob
           namespaces separados no userdata (ver computeds userdata/swUserdata
           abaixo) — trocar de aba troca também o painel de customização
           exibido, pra nunca editar por engano o estilo da outra aba. -->
      <l-customization-tools
        v-if="activeTab === 'culto'"
        :module="module"
        :items="[
          {
            name: t('customization.background'),
            items: ['background_color', ['image', 'image_opacity', 'image_fit']],
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
      <l-customization-tools
        v-else
        :module="module"
        :items="[
          {
            name: t('customization.background'),
            items: ['sw_background_color', ['sw_image', 'sw_image_opacity', 'sw_image_fit']],
          },
          {
            name: t('customization.align'),
            items: [['sw_horizontal_align', 'sw_vertical_align']],
          },
          {
            name: t('customization.text'),
            items: [['sw_font', 'sw_font_size', 'sw_font_color']],
          },
          {
            name: t('customization.alert'),
            items: ['sw_alert_color'],
          },
          { name: t('customization.window'), items: ['sw_border_spacing'] },
        ]"
      />
    </template>

    <template v-slot:system_buttons>
      <LScreenBtn module="cronometro_culto" />
      <LReturnScreenBtn module="cronometro_culto" />
    </template>

    <template v-slot:header>
      <!-- Abas: Culto (cronômetro regressivo com avisos sonoros) e Avulso
           (cronômetro normal ou regressivo) — cada uma com seu próprio ícone,
           mesma janela. Trocar de aba também troca o que é projetado (mesmo
           mecanismo do módulo Sorteio, ver activeTab abaixo). -->
      <v-tabs v-model="activeTab" density="compact">
        <v-tab value="culto">
          <v-icon start size="15">mdi-timer-alert-outline</v-icon>
          {{ t("tab_culto") }}
        </v-tab>
        <v-tab value="avulso">
          <v-icon start size="15">mdi-timer-outline</v-icon>
          {{ t("tab_avulso") }}
        </v-tab>
      </v-tabs>

      <!-- ═══════════════ Toolbar — aba CULTO ═══════════════ -->
      <l-toolbar v-show="activeTab === 'culto'">
        <l-toolbar-item>
          <div class="d-flex align-center h-100">
            <v-tooltip location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn
                  v-bind="props"
                  :icon="ccIsRunning ? 'mdi-stop' : 'mdi-play'"
                  :color="ccIsRunning ? 'red' : 'green'"
                  size="small"
                  variant="tonal"
                  @click="toggleRunning"
                />
              </template>
              {{ ccIsRunning ? t("off") : t("on") }}
            </v-tooltip>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-divider vertical class="cc-sep" />
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="d-flex flex-column justify-center h-100">
            <v-radio-group v-model="userdata.mode" density="compact" hide-details :disabled="ccIsRunning">
              <div class="d-flex align-center cc-mode-row mb-2">
                <v-radio :label="t('end_time')" value="end_time" density="compact" hide-details />
                <input
                  type="time"
                  v-model="userdata.end_time_str"
                  class="cc-time-input"
                  :disabled="userdata.mode !== 'end_time' || ccIsRunning"
                />
              </div>
              <div class="d-flex align-center cc-mode-row">
                <v-radio :label="t('duration')" value="duration" density="compact" hide-details />
                <input
                  type="number"
                  min="0"
                  v-model.number="userdata.duration_minutes"
                  class="cc-number-input"
                  :disabled="userdata.mode !== 'duration' || ccIsRunning"
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
              v-model="ccPreviewCue"
              :items="ccCueOptions"
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
                  :icon="ccPreviewPlaying ? 'mdi-stop' : 'mdi-volume-high'"
                  :color="ccPreviewPlaying ? 'red' : undefined"
                  size="small"
                  variant="tonal"
                  @click="ouvir"
                />
              </template>
              {{ ccPreviewPlaying ? t("stop_listening") : t("listen") }}
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
            :items="ccHourFormatOptions"
            item-value="value"
            item-title="title"
            density="compact"
            hide-details
            style="max-width: 150px; margin-bottom: 8px"
          />
          <l-select
            :label="t('time_format')"
            v-model="userdata.time_format"
            :items="ccTimeFormatOptions"
            item-value="value"
            item-title="title"
            density="compact"
            hide-details
            style="max-width: 150px"
          />
        </l-toolbar-item>
      </l-toolbar>

      <!-- ═══════════════ Toolbar — aba AVULSO ═══════════════ -->
      <l-toolbar v-show="activeTab === 'avulso'">
        <l-toolbar-item>
          <v-btn-toggle
            v-model="swUserdata.mode"
            density="compact"
            variant="outlined"
            color="primary"
            mandatory
            :disabled="swIsRunning"
          >
            <v-btn value="normal" size="small">
              <v-icon left size="16">mdi-timer-play-outline</v-icon>
              {{ t("mode_normal") }}
            </v-btn>
            <v-btn value="countdown" size="small">
              <v-icon left size="16">mdi-timer-sand</v-icon>
              {{ t("mode_countdown") }}
            </v-btn>
          </v-btn-toggle>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-divider vertical class="sw-sep" />
        </l-toolbar-item>

        <l-toolbar-item>
          <l-select
            :label="t('customization.time_format')"
            v-model="swUserdata.time_format"
            :items="swTimeFormatOptions"
            item-value="value"
            item-title="title"
            density="compact"
            hide-details
            style="max-width: 170px"
          />
        </l-toolbar-item>

        <template v-if="swUserdata.mode === 'countdown'">
          <l-toolbar-item>
            <v-divider vertical class="sw-sep" />
          </l-toolbar-item>

          <l-toolbar-item>
            <div class="text-caption text-medium-emphasis mb-1">{{ t("duration_minutes") }}</div>
            <input
              type="number"
              min="0"
              v-model.number="swUserdata.duration_minutes"
              class="sw-number-input"
              :disabled="swIsRunning"
            />
          </l-toolbar-item>

          <l-toolbar-item>
            <div class="text-caption text-medium-emphasis mb-1">{{ t("duration_seconds") }}</div>
            <input
              type="number"
              min="0"
              max="59"
              v-model.number="swUserdata.duration_seconds"
              class="sw-number-input"
              :disabled="swIsRunning"
            />
          </l-toolbar-item>

          <l-toolbar-item>
            <div class="text-caption text-medium-emphasis mb-1">{{ t("add_subtract_time") }}</div>
            <div class="d-flex sw-btn-row">
              <v-btn size="x-small" variant="tonal" @click="adjustCountdownDuration(1)">+1</v-btn>
              <v-btn size="x-small" variant="tonal" @click="adjustCountdownDuration(5)">+5</v-btn>
              <v-btn size="x-small" variant="tonal" @click="adjustCountdownDuration(10)">+10</v-btn>
            </div>
            <div class="d-flex sw-btn-row mt-1">
              <v-btn size="x-small" variant="tonal" @click="adjustCountdownDuration(-1)">-1</v-btn>
              <v-btn size="x-small" variant="tonal" @click="adjustCountdownDuration(-5)">-5</v-btn>
              <v-btn size="x-small" variant="tonal" @click="adjustCountdownDuration(-10)">-10</v-btn>
            </div>
          </l-toolbar-item>

          <l-toolbar-item>
            <v-checkbox
              v-model="swUserdata.auto_stop_at_zero"
              :label="t('auto_stop_at_zero')"
              density="compact"
              hide-details
            />
          </l-toolbar-item>

          <l-toolbar-item>
            <v-divider vertical class="sw-sep" />
          </l-toolbar-item>

          <l-toolbar-item>
            <div class="text-caption text-medium-emphasis mb-1">{{ t("end_message") }}</div>
            <!-- Exibido nas telas de saída e retorno (StopwatchScreen.vue é o
                 mesmo componente das duas, ver ReturnScreen.vue) quando o
                 tempo chega a zero — no lugar dos dígitos. -->
            <input
              type="text"
              v-model="swUserdata.end_message"
              class="sw-text-input"
              :placeholder="t('end_message_placeholder')"
            />
            <div class="text-caption text-medium-emphasis mb-1 mt-2">{{ t("end_message_duration") }}</div>
            <!-- 0 = mensagem fica até o operador resetar (comportamento antigo). -->
            <input
              type="number"
              min="0"
              v-model.number="swUserdata.end_message_duration"
              class="sw-number-input"
            />
          </l-toolbar-item>
        </template>
      </l-toolbar>
    </template>

    <!-- Ambas as telas ficam montadas o tempo todo (v-show, não v-if) — assim
         nenhum dos dois cronômetros perde seu estado/timer ao trocar de aba;
         só a visibilidade muda. Play/pausa/reiniciar/salvar do Avulso ficam
         junto ao próprio cronômetro (ver StopwatchScreen.vue), não duplicados
         na toolbar — igual ao módulo original. -->
    <!-- Cantos arredondados só aqui no preview do operador (não no Screen.vue/
         StopwatchScreen.vue em si, que também são a projeção real em tela
         cheia — Popup.vue usa os mesmos componentes sem essa moldura). -->
    <div class="cc-preview-frame">
      <Screen v-show="activeTab === 'culto'" ref="cultoScreen" />
      <StopwatchScreen
        v-show="activeTab === 'avulso'"
        ref="swScreen"
        @start-run="startStopwatch"
        @pause-run="pauseStopwatch"
        @reset-run="resetStopwatch"
        @save-time="saveTime"
      />
    </div>

    <template v-slot:right v-if="activeTab === 'avulso' && swSavedTimes.length > 0 && swUserdata.mode !== 'countdown'">
      <v-card
        flat
        class="pa-2 d-flex flex-column"
        style="width: 240px; height: 100%"
      >
        <v-card-title class="font-weight-light">
          <v-badge
            location="top right"
            color="warning"
            :content="swSavedTimes.length"
          >
            {{ t("saved_times") }} &nbsp;
          </v-badge>
        </v-card-title>
        <template v-slot:actions>
          <v-btn
            size="small"
            color="red"
            @click="clearSavedTimes"
            variant="tonal"
            block
          >
            {{ t("clear_all") }}
          </v-btn>
        </template>
        <v-card-text class="pa-0 ma-0">
          <v-list density="compact" class="bg-transparent">
            <v-list-item
              v-for="(item, index) in swSavedTimes"
              :key="index"
              class="px-0"
            >
              <template v-slot:prepend>
                <v-icon size="small">mdi-timer</v-icon>
              </template>
              <v-list-item-title>
                {{ formatted(item) }}
              </v-list-item-title>
              <template v-slot:append>
                <v-btn
                  icon
                  size="x-small"
                  variant="text"
                  color="red"
                  @click="deleteSavedTime(index)"
                >
                  <v-icon size="small">mdi-delete</v-icon>
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </template>
  </l-window>
</template>

<script>
import manifest from "../manifest.json";
import LWindow from "@/components/Window.vue";
import Screen from "../components/Screen.vue";
import StopwatchScreen from "../components/StopwatchScreen.vue";
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
    StopwatchScreen,
    LScreenBtn,
    LReturnScreenBtn,
    LSelect,
    LCustomizationTools,
    LToolbar,
    LToolbarItem,
  },
  data: () => ({
    width: 0,
    height: 0,

    // ── Aba "Culto" (cc*) ──────────────────────────────────────────────────
    ccIsRunning: false,
    ccTargetEndAt: null,
    ccTotalDurationMs: 0,
    ccFiredAbertura: false,
    ccFired5min: false,
    ccFired1min: false,
    ccPreviewCue: "abertura",
    ccPreviewPlaying: false,
    ccPreviewAudio: null,
    ccPreviewFadeInterval: null,
    ccCueOptions: [
      { title: "Abertura", value: "abertura" },
      { title: "5 minutos", value: "5min" },
      { title: "1 minuto", value: "1min" },
    ],
    ccHourFormatOptions: [
      { title: "hh:mm:ss", value: "hh:mm:ss" },
      { title: "hh:mm", value: "hh:mm" },
    ],
    ccTimeFormatOptions: [
      { title: "hh:mm:ss", value: "hh:mm:ss" },
      { title: "mm:ss", value: "mm:ss" },
    ],
    ccTicker: null,

    // ── Aba "Avulso" (sw*) ─────────────────────────────────────────────────
    swIsRunning: false,
    swStartTime: null,
    swPausedTime: null,
    swSavedTimes: [],
    // Modo "regressivo": mesmo padrão do Cronômetro de Culto (targetEndAt +
    // totalDurationMs em vez de decrementar um contador).
    swTargetEndAt: null,
    swTotalDurationMs: 0,
    swRemainingAtPauseMs: null,
    swCountdownTicker: null,
    swTimeFormatOptions: [
      { title: "hh:mm:ss.ms", value: "hh:mm:ss.ms" },
      { title: "hh:mm:ss", value: "hh:mm:ss" },
      { title: "mm:ss.ms", value: "mm:ss.ms" },
      { title: "mm:ss", value: "mm:ss" },
    ],
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
    // Aba "Culto" — namespace original do módulo (modules.cronometro_culto.*,
    // sem prefixo), preservando os dados já salvos de quem já usava só o
    // Cronômetro de Culto antes desta junção com o Avulso.
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

    // Aba "Avulso" (ex-módulo stopwatch) — sub-namespace "sw_" dentro do
    // mesmo módulo mesclado, pra não colidir com os campos da aba Culto (ver
    // StopwatchScreen.vue, que usa o mesmo esquema de prefixo).
    swUserdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => this.$userdata.get(`modules.${this.module.id}.sw_${key}`, null),
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.sw_${key}`, value);
            return true;
          },
        },
      );
    },
    swAppdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => this.$appdata.get(`modules.${this.module.id}.sw_${key}`, null),
          set: (_, key, value) => {
            this.$appdata.set(`modules.${this.module.id}.sw_${key}`, value);
            return true;
          },
        },
      );
    },

    show() {
      return this.module.show;
    },

    // Aba selecionada — persistida em appdata (não em userdata: é estado de
    // sessão/uso, não preferência) pra chegar até a janela de saída via IPC e
    // decidir lá qual das duas telas projetar (ver interface/Popup.vue e
    // views/ReturnScreen.vue) — mesmo mecanismo do módulo Sorteio.
    activeTab: {
      get() {
        return this.appdata.active_tab || "culto";
      },
      set(v) {
        this.appdata.active_tab = v;
      },
    },

    endTimeLabel() {
      if (!this.ccTargetEndAt) return "00:00";
      const pad = (v) => String(v).padStart(2, "0");
      return `${pad(this.ccTargetEndAt.getHours())}:${pad(this.ccTargetEndAt.getMinutes())}`;
    },

    showClock() {
      return this.userdata.show_clock !== false;
    },
  },

  watch: {
    ccTargetEndAt() {
      this.appdata.target_end_at = this.ccTargetEndAt;
    },
    ccIsRunning() {
      this.appdata.is_running = this.ccIsRunning;
    },
    ccTotalDurationMs() {
      this.appdata.total_duration_ms = this.ccTotalDurationMs;
    },

    swStartTime() {
      this.swAppdata.start_time = this.swStartTime;
    },
    swPausedTime() {
      this.swAppdata.paused_time = this.swPausedTime;
    },
    swIsRunning() {
      this.swAppdata.is_running = this.swIsRunning;
    },
    swTargetEndAt() {
      this.swAppdata.target_end_at = this.swTargetEndAt;
    },
    swTotalDurationMs() {
      this.swAppdata.total_duration_ms = this.swTotalDurationMs;
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

    resize(data) {
      this.width = data.container_width;
      this.height = data.container_height;
    },

    close() {
      // Fechar o painel do operador nunca encerra a projeção — só o botão
      // "Fechar" da tela de saída (Screen.vue/StopwatchScreen.vue) faz isso.
      // Encerra os dois cronômetros (não só o da aba visível no momento),
      // já que ambos podem estar rodando independentemente um do outro.
      this.stopTicker();
      this.stopPreview(true);
      this.pauseStopwatch();
      this.resetStopwatch();
      this.$modules.close(this.module_id);
    },

    // ═══════════════════════ Aba "Culto" ═══════════════════════════════════
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
      if (this.ccIsRunning) {
        this.ccIsRunning = false;
        this.stopTicker();
        // Parar zera o tempo exibido em vez de congelar no valor restante —
        // limpando target_end_at, o remainingMs do Screen.vue volta a 0.
        this.ccTargetEndAt = null;
        this.ccTotalDurationMs = 0;
        return;
      }
      this.ccTargetEndAt = this.computeTargetEndAt();
      this.ccTotalDurationMs = this.ccTargetEndAt - new Date();
      this.ccFiredAbertura = false;
      this.ccFired5min = false;
      this.ccFired1min = false;
      this.ccIsRunning = true;
      if (this.userdata.audio_abertura_enabled) this.playCueFile('abertura');
      this.startTicker();
    },

    adjustTime(minutes) {
      if (this.ccTargetEndAt && this.ccIsRunning) {
        this.ccTargetEndAt = new Date(this.ccTargetEndAt.getTime() + minutes * 60000);
        this.ccTotalDurationMs += minutes * 60000;
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
      this.ccTicker = setInterval(() => this.checkThresholds(), 500);
    },
    stopTicker() {
      clearInterval(this.ccTicker);
      this.ccTicker = null;
    },
    checkThresholds() {
      if (!this.ccTargetEndAt) return;
      const remainingMs = this.ccTargetEndAt - new Date();

      // Dispara 10s antes das marcas de 5 minutos e 1 minuto, não em cima delas.
      if (remainingMs <= 310000 && !this.ccFired5min && this.userdata.audio_5min_enabled) {
        this.playCueFile('5min');
        this.ccFired5min = true;
      }
      if (remainingMs <= 70000 && !this.ccFired1min && this.userdata.audio_1min_enabled) {
        this.playCueFile('1min');
        this.ccFired1min = true;
      }
      if (remainingMs <= 0 && this.userdata.auto_stop_at_zero) {
        this.ccIsRunning = false;
        this.stopTicker();
      }
    },

    // Botão "Ouvir": alterna entre tocar e parar — parar corta com um fade
    // suave (~400ms) em vez de cortar o áudio na hora.
    ouvir() {
      if (this.ccPreviewPlaying) {
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
      const url = await this.resolveCueUrl(this.ccPreviewCue);
      if (!url) return;
      const audio = new Audio(url);
      this.ccPreviewAudio = audio;
      this.ccPreviewPlaying = true;
      audio.addEventListener('ended', () => {
        if (this.ccPreviewAudio === audio) this.resetPreviewState();
      });
      audio.play().catch(() => this.resetPreviewState());
    },

    stopPreview(immediate = false) {
      clearInterval(this.ccPreviewFadeInterval);
      this.ccPreviewFadeInterval = null;
      const audio = this.ccPreviewAudio;
      if (!audio) return;
      if (immediate) {
        audio.pause();
        this.resetPreviewState();
        return;
      }
      const stepMs = 30;
      const decrement = audio.volume / (400 / stepMs);
      this.ccPreviewFadeInterval = setInterval(() => {
        audio.volume = Math.max(0, audio.volume - decrement);
        if (audio.volume <= 0) {
          audio.pause();
          this.resetPreviewState();
        }
      }, stepMs);
    },

    resetPreviewState() {
      clearInterval(this.ccPreviewFadeInterval);
      this.ccPreviewFadeInterval = null;
      this.ccPreviewAudio = null;
      this.ccPreviewPlaying = false;
    },

    toggleClockVisibility() {
      this.userdata.show_clock = this.showClock ? false : true;
    },

    async playCueFile(cue) {
      const url = await this.resolveCueUrl(cue);
      if (!url) return;
      new Audio(url).play().catch(() => {});
    },

    // ═══════════════════════ Aba "Avulso" ══════════════════════════════════
    startStopwatch() {
      if (this.swUserdata.mode === 'countdown') { this.startCountdown(); return; }
      if (!this.swStartTime) {
        this.swStartTime = new Date();
      }
      this.swPausedTime = null;
      this.swIsRunning = true;
    },

    pauseStopwatch() {
      if (this.swUserdata.mode === 'countdown') { this.pauseCountdown(); return; }
      this.swPausedTime = new Date();
      this.swIsRunning = false;
    },

    resetStopwatch() {
      if (this.swUserdata.mode === 'countdown') { this.resetCountdown(); return; }
      this.swStartTime = null;
      if (this.swIsRunning) {
        this.startStopwatch();
      }
      this.swPausedTime = null;
    },

    // Início (ou retomada, se pausado) do modo regressivo — mesmo esquema do
    // Cronômetro de Culto: horário de término (swTargetEndAt) em vez de um
    // contador, pra não depender de setInterval sem deriva. Retomar recalcula
    // swTargetEndAt a partir do tempo restante congelado em pauseCountdown,
    // então o "pause" de fato pausa (ao contrário de simplesmente reiniciar).
    startCountdown() {
      const now = new Date();
      if (this.swRemainingAtPauseMs != null) {
        this.swTargetEndAt = new Date(now.getTime() + Math.max(0, this.swRemainingAtPauseMs));
        this.swRemainingAtPauseMs = null;
      } else {
        const minutes = Math.max(0, Number(this.swUserdata.duration_minutes) || 0);
        const seconds = Math.max(0, Math.min(59, Number(this.swUserdata.duration_seconds) || 0));
        const durationMs = minutes * 60000 + seconds * 1000;
        this.swTargetEndAt = new Date(now.getTime() + durationMs);
        this.swTotalDurationMs = durationMs;
      }
      this.swIsRunning = true;
      this.startCountdownTicker();
    },

    pauseCountdown() {
      if (this.swTargetEndAt) this.swRemainingAtPauseMs = this.swTargetEndAt - new Date();
      this.swIsRunning = false;
      this.stopCountdownTicker();
    },

    resetCountdown() {
      this.swIsRunning = false;
      this.stopCountdownTicker();
      this.swTargetEndAt = null;
      this.swTotalDurationMs = 0;
      this.swRemainingAtPauseMs = null;
    },

    // Ajuste rápido (+1/+5/+10 etc.): com o regressivo rodando ou pausado,
    // nudge no tempo já em andamento (igual ao "Adicionar/Subtrair Tempo" do
    // Cronômetro de Culto); parado, ajusta só a duração configurada.
    adjustCountdownDuration(minutes) {
      if (this.swTargetEndAt && this.swIsRunning) {
        this.swTargetEndAt = new Date(this.swTargetEndAt.getTime() + minutes * 60000);
        this.swTotalDurationMs += minutes * 60000;
        return;
      }
      if (this.swRemainingAtPauseMs != null) {
        this.swRemainingAtPauseMs = Math.max(0, this.swRemainingAtPauseMs + minutes * 60000);
        return;
      }
      this.swUserdata.duration_minutes = Math.max(0, (Number(this.swUserdata.duration_minutes) || 0) + minutes);
    },

    startCountdownTicker() {
      this.stopCountdownTicker();
      this.swCountdownTicker = setInterval(() => this.checkCountdownZero(), 500);
    },
    stopCountdownTicker() {
      clearInterval(this.swCountdownTicker);
      this.swCountdownTicker = null;
    },
    checkCountdownZero() {
      if (!this.swTargetEndAt) return;
      const remainingMs = this.swTargetEndAt - new Date();
      if (remainingMs <= 0 && this.swUserdata.auto_stop_at_zero) {
        this.swIsRunning = false;
        this.stopCountdownTicker();
      }
    },

    saveTime() {
      const now = this.swIsRunning ? new Date() : this.swPausedTime;
      const elapsedTime = now ? now - (this.swStartTime ?? now) : 0;

      this.swSavedTimes.push(elapsedTime);
    },

    deleteSavedTime(index) {
      this.swSavedTimes.splice(index, 1);
    },

    clearSavedTimes() {
      this.swSavedTimes = [];
    },

    formatted(time) {
      const totalMilliseconds = time;
      const hours = Math.floor(totalMilliseconds / 3600000);
      const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
      const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
      const milliseconds = Math.floor((totalMilliseconds % 1000) / 10);

      const pad = (v) => String(v).padStart(2, "0");

      const tokens = {
        hh: pad(hours),
        mm: pad(minutes),
        ss: pad(seconds),
        ms: pad(milliseconds),
      };

      return this.swUserdata.time_format.replace(
        /hh|mm|ss|ms/g,
        (match) => tokens[match],
      );
    },

    // Migra as configurações de aparência de quem já usava o módulo
    // "Cronômetro" avulso separado (modules.stopwatch.*) antes desta junção
    // com o Cronômetro de Culto — copiadas uma única vez pro namespace "sw_"
    // deste módulo mesclado, pra não obrigar o operador a reconfigurar cor/
    // fonte/imagem do zero. Guardado por uma flag própria (sw_migrated) pra
    // nunca sobrescrever ajustes já feitos aqui depois da migração.
    migrateStopwatchData() {
      if (this.swUserdata.migrated) return;
      const legacy = this.$userdata.get('modules.stopwatch');
      if (legacy && typeof legacy === 'object') {
        Object.entries(legacy).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            this.$userdata.set(`modules.${this.module_id}.sw_${key}`, value);
          }
        });
      }
      this.swUserdata.migrated = true;
    },
  },

  mounted() {
    this.migrateStopwatchData();

    // Defaults — aba Culto
    if (!this.userdata.mode) this.userdata.mode = 'duration';
    if (this.userdata.duration_minutes == null) this.userdata.duration_minutes = 40;
    if (!this.userdata.end_time_str) this.userdata.end_time_str = '10:00';
    if (this.userdata.audio_abertura_enabled == null) this.userdata.audio_abertura_enabled = true;
    if (this.userdata.audio_5min_enabled == null) this.userdata.audio_5min_enabled = true;
    if (this.userdata.audio_1min_enabled == null) this.userdata.audio_1min_enabled = true;
    if (!this.userdata.hour_format) this.userdata.hour_format = 'hh:mm:ss';
    if (!this.userdata.time_format) this.userdata.time_format = 'hh:mm:ss';

    const ccSavedTarget = this.appdata.target_end_at;
    const ccSavedRunning = this.appdata.is_running;
    if (ccSavedTarget) this.ccTargetEndAt = ccSavedTarget instanceof Date ? ccSavedTarget : new Date(ccSavedTarget);
    if (ccSavedRunning && this.ccTargetEndAt) {
      this.ccIsRunning = true;
      this.ccTotalDurationMs = this.appdata.total_duration_ms || 0;
      this.startTicker();
    }

    // Defaults — aba Avulso
    if (!this.swUserdata.mode) this.swUserdata.mode = 'normal';
    if (this.swUserdata.duration_minutes == null) this.swUserdata.duration_minutes = 5;
    if (this.swUserdata.duration_seconds == null) this.swUserdata.duration_seconds = 0;
    if (this.swUserdata.auto_stop_at_zero == null) this.swUserdata.auto_stop_at_zero = true;
    if (!this.swUserdata.end_message) this.swUserdata.end_message = this.t('end_message_placeholder');
    if (this.swUserdata.end_message_duration == null) this.swUserdata.end_message_duration = 5;
    if (!this.swUserdata.time_format) this.swUserdata.time_format = 'hh:mm:ss.ms';

    const swSavedTarget = this.swAppdata.target_end_at;
    const swSavedRunning = this.swAppdata.is_running;
    if (swSavedTarget) this.swTargetEndAt = swSavedTarget instanceof Date ? swSavedTarget : new Date(swSavedTarget);
    if (this.swUserdata.mode === 'countdown' && swSavedRunning && this.swTargetEndAt) {
      this.swIsRunning = true;
      this.swTotalDurationMs = this.swAppdata.total_duration_ms || 0;
      this.startCountdownTicker();
    }
  },
  unmounted() {
    this.stopTicker();
    this.stopPreview(true);
    this.stopCountdownTicker();
  },
};
</script>

<style scoped>
.cc-preview-frame {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
}
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
.sw-number-input {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 13px;
  background: transparent;
  color: inherit;
  width: 70px;
}
.sw-text-input {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 13px;
  background: transparent;
  color: inherit;
  width: 180px;
}
.sw-btn-row {
  gap: 6px;
}
.sw-sep {
  height: 100%;
  min-height: 44px;
}
</style>
