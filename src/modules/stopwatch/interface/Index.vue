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
      <LScreenBtn module="stopwatch" />
      <LReturnScreenBtn module="stopwatch" />
    </template>

    <template v-slot:header>
      <l-toolbar>
        <l-toolbar-item>
          <v-btn-toggle
            v-model="userdata.mode"
            density="compact"
            variant="outlined"
            color="primary"
            mandatory
            :disabled="isRunning"
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
            v-model="userdata.time_format"
            :items="timeFormatOptions"
            item-value="value"
            item-title="title"
            density="compact"
            hide-details
            style="max-width: 170px"
          />
        </l-toolbar-item>

        <template v-if="userdata.mode === 'countdown'">
          <l-toolbar-item>
            <v-divider vertical class="sw-sep" />
          </l-toolbar-item>

          <l-toolbar-item>
            <div class="text-caption text-medium-emphasis mb-1">{{ t("duration_minutes") }}</div>
            <input
              type="number"
              min="0"
              v-model.number="userdata.duration_minutes"
              class="sw-number-input"
              :disabled="isRunning"
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
              v-model="userdata.auto_stop_at_zero"
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
            <!-- Exibido nas telas de saída e retorno (Screen.vue é o mesmo
                 componente das duas, ver ReturnScreen.vue) quando o tempo
                 chega a zero — no lugar dos dígitos, igual ao aviso "Tempo
                 Acabou" do countdown de referência. -->
            <input
              type="text"
              v-model="userdata.end_message"
              class="sw-text-input"
              :placeholder="t('end_message_placeholder')"
            />
          </l-toolbar-item>
        </template>

        <v-spacer />
        <l-toolbar-item>
          <v-btn
            v-if="!isRunning"
            color="green"
            size="small"
            @click="startStopwatch"
            variant="tonal"
          >
            <v-icon left>mdi-play</v-icon>
            {{ t("start") }}
          </v-btn>

          <v-btn
            v-else
            color="orange"
            size="small"
            @click="pauseStopwatch"
            variant="tonal"
          >
            <v-icon left>mdi-pause</v-icon>
            {{ t("pause") }}
          </v-btn>

          <v-btn
            color="red"
            size="small"
            @click="resetStopwatch"
            style="margin-left: 8px"
            variant="tonal"
          >
            <v-icon left>mdi-refresh</v-icon>
            {{ t("reset") }}
          </v-btn>

          <v-btn
            v-if="userdata.mode !== 'countdown'"
            color="blue"
            size="small"
            @click="saveTime"
            style="margin-left: 8px"
            variant="tonal"
          >
            <v-icon left>mdi-content-save</v-icon>
            {{ t("save") }}
          </v-btn>
        </l-toolbar-item>

        <v-spacer />
      </l-toolbar>
    </template>

    <Screen ref="screen" />

    <template v-slot:right v-if="savedTimes.length > 0 && userdata.mode !== 'countdown'">
      <v-card
        flat
        class="pa-2 d-flex flex-column"
        style="width: 240px; height: 100%"
      >
        <v-card-title class="font-weight-light">
          <v-badge
            location="top right"
            color="warning"
            :content="savedTimes.length"
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
              v-for="(item, index) in savedTimes"
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
import LScreenBtn from "@/components/buttons/Screen.vue";
import LReturnScreenBtn from "@/components/buttons/ReturnScreen.vue";
import LSelect from "@/components/inputs/Select.vue";
import LCustomizationTools from "@/components/CustomizationTools.vue";
import LToolbar from "@/components/Toolbar.vue";
import LToolbarItem from "@/components/ToolbarItem.vue";

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
    width: 0,
    height: 0,
    isRunning: false,
    startTime: null,
    pausedTime: null,
    savedTimes: [],
    // Modo "regressivo": mesmo padrão do Cronômetro de Culto (targetEndAt +
    // totalDurationMs em vez de decrementar um contador) — o Screen.vue tem
    // seu próprio timer local calculando o restante a partir do horário de
    // término, então essas escritas não precisam de alta frequência.
    targetEndAt: null,
    totalDurationMs: 0,
    remainingAtPauseMs: null,
    countdownTicker: null,
    timeFormatOptions: [
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
  },

  watch: {
    startTime() {
      this.appdata.start_time = this.startTime;
    },
    pausedTime() {
      this.appdata.paused_time = this.pausedTime;
    },
    isRunning() {
      this.appdata.is_running = this.isRunning;
    },
    targetEndAt() {
      this.appdata.target_end_at = this.targetEndAt;
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

    resize(data) {
      this.width = data.container_width;
      this.height = data.container_height;
    },

    close() {
      this.pauseStopwatch();
      this.resetStopwatch();
      // Fechar o painel do operador nunca encerra a projeção — só o botão
      // "Fechar" da tela de saída (Screen.vue) faz isso.
      this.$modules.close(this.module_id);
    },

    startStopwatch() {
      if (this.userdata.mode === 'countdown') { this.startCountdown(); return; }
      if (!this.startTime) {
        this.startTime = new Date();
      }
      this.pausedTime = null;
      this.isRunning = true;
    },

    pauseStopwatch() {
      if (this.userdata.mode === 'countdown') { this.pauseCountdown(); return; }
      this.pausedTime = new Date();
      this.isRunning = false;
    },

    resetStopwatch() {
      if (this.userdata.mode === 'countdown') { this.resetCountdown(); return; }
      this.startTime = null;
      if (this.isRunning) {
        this.startStopwatch();
      }
      this.pausedTime = null;
    },

    // Início (ou retomada, se pausado) do modo regressivo — mesmo esquema do
    // Cronômetro de Culto: horário de término (targetEndAt) em vez de um
    // contador, pra não depender de setInterval sem deriva. Retomar recalcula
    // targetEndAt a partir do tempo restante congelado em pauseCountdown,
    // então o "pause" de fato pausa (ao contrário de simplesmente reiniciar).
    startCountdown() {
      const now = new Date();
      if (this.remainingAtPauseMs != null) {
        this.targetEndAt = new Date(now.getTime() + Math.max(0, this.remainingAtPauseMs));
        this.remainingAtPauseMs = null;
      } else {
        const minutes = Math.max(0, Number(this.userdata.duration_minutes) || 0);
        this.targetEndAt = new Date(now.getTime() + minutes * 60000);
        this.totalDurationMs = minutes * 60000;
      }
      this.isRunning = true;
      this.startCountdownTicker();
    },

    pauseCountdown() {
      if (this.targetEndAt) this.remainingAtPauseMs = this.targetEndAt - new Date();
      this.isRunning = false;
      this.stopCountdownTicker();
    },

    resetCountdown() {
      this.isRunning = false;
      this.stopCountdownTicker();
      this.targetEndAt = null;
      this.totalDurationMs = 0;
      this.remainingAtPauseMs = null;
    },

    // Ajuste rápido (+1/+5/+10 etc.): com o regressivo rodando ou pausado,
    // nudge no tempo já em andamento (igual ao "Adicionar/Subtrair Tempo" do
    // Cronômetro de Culto); parado, ajusta só a duração configurada.
    adjustCountdownDuration(minutes) {
      if (this.targetEndAt && this.isRunning) {
        this.targetEndAt = new Date(this.targetEndAt.getTime() + minutes * 60000);
        this.totalDurationMs += minutes * 60000;
        return;
      }
      if (this.remainingAtPauseMs != null) {
        this.remainingAtPauseMs = Math.max(0, this.remainingAtPauseMs + minutes * 60000);
        return;
      }
      this.userdata.duration_minutes = Math.max(0, (Number(this.userdata.duration_minutes) || 0) + minutes);
    },

    startCountdownTicker() {
      this.stopCountdownTicker();
      this.countdownTicker = setInterval(() => this.checkCountdownZero(), 500);
    },
    stopCountdownTicker() {
      clearInterval(this.countdownTicker);
      this.countdownTicker = null;
    },
    checkCountdownZero() {
      if (!this.targetEndAt) return;
      const remainingMs = this.targetEndAt - new Date();
      if (remainingMs <= 0 && this.userdata.auto_stop_at_zero) {
        this.isRunning = false;
        this.stopCountdownTicker();
      }
    },

    saveTime() {
      const now = this.isRunning ? new Date() : this.pausedTime;
      const elapsedTime = now ? now - (this.startTime ?? now) : 0;

      this.savedTimes.push(elapsedTime);
    },

    deleteSavedTime(index) {
      this.savedTimes.splice(index, 1);
    },

    clearSavedTimes() {
      this.savedTimes = [];
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

      return this.userdata.time_format.replace(
        /hh|mm|ss|ms/g,
        (match) => tokens[match],
      );
    },
  },

  mounted() {
    if (!this.userdata.mode) this.userdata.mode = 'normal';
    if (this.userdata.duration_minutes == null) this.userdata.duration_minutes = 5;
    if (this.userdata.auto_stop_at_zero == null) this.userdata.auto_stop_at_zero = true;
    if (this.userdata.end_message == null) this.userdata.end_message = '';

    const savedTarget = this.appdata.target_end_at;
    const savedRunning = this.appdata.is_running;
    if (savedTarget) this.targetEndAt = savedTarget instanceof Date ? savedTarget : new Date(savedTarget);
    if (this.userdata.mode === 'countdown' && savedRunning && this.targetEndAt) {
      this.isRunning = true;
      this.totalDurationMs = this.appdata.total_duration_ms || 0;
      this.startCountdownTicker();
    }
  },
  unmounted() {
    this.stopCountdownTicker();
  },
};
</script>

<style scoped>
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
