<template>
  <div
    ref="container"
    class="d-flex flex-column"
    :class="alignClass"
    :style="containerStyle"
  >
    <img
      v-if="userdata.image"
      :src="userdata.image"
      :style="{
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        position: 'absolute',
        objectFit: userdata.image_fit,
        opacity: userdata.image_opacity / 100,
      }"
    />

    <span class="cc-remaining" :style="textStyle">{{ formattedRemaining }}</span>
    <span v-if="showClock" class="cc-clock" :style="clockStyle">{{ formattedClock }}</span>

    <div class="cc-gauge">
      <div class="cc-gauge-fill" :style="{ width: `${progressPct}%` }" />
    </div>
  </div>
</template>

<script>
import manifest from "../manifest.json";

export default {
  name: "CronometroCultoScreen",
  data: () => ({
    s_width: 0,
    s_height: 0,
    wallTimer: null,
    countdownTimer: null,
    wallNow: new Date(),
    countdownNow: new Date(),
  }),
  computed: {
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

    backgroundColor() {
      return this.userdata.background_color || "#FFFFFF";
    },
    font() {
      return this.userdata.font || "Arial, sans-serif";
    },
    fontColor() {
      return this.userdata.font_color || "#000000";
    },
    fontSize() {
      return this.userdata.font_size || 30;
    },
    borderSpacing() {
      return this.userdata.border_spacing || 10;
    },
    verticalAlign() {
      return this.userdata.vertical_align || "center";
    },
    horizontalAlign() {
      return this.userdata.horizontal_align || "center";
    },
    imageOpacity() {
      return (this.userdata.image_opacity || 100) / 100;
    },
    hourFormat() {
      return this.userdata.hour_format || "hh:mm:ss";
    },
    timeFormat() {
      return this.userdata.time_format || "hh:mm:ss";
    },
    showClock() {
      return this.userdata.show_clock !== false;
    },
    alignClass() {
      const vertical = { start: "align-start", center: "align-center", end: "align-end" };
      const horizontal = { start: "justify-start", center: "justify-center", end: "justify-end" };
      return `${vertical[this.verticalAlign]} ${horizontal[this.horizontalAlign]}`;
    },
    containerStyle() {
      return {
        background: this.backgroundColor,
        width: "100%",
        height: "100%",
        position: "relative",
        color: this.fontColor,
        padding: `${this.borderSpacing}px`,
      };
    },
    textStyle() {
      return {
        fontFamily: this.font,
        // "Desligar ao zerar tempo" desmarcado: o cronômetro continua contando
        // depois de zero — em vez do sinal de negativo, o texto fica vermelho.
        color: this.isOvertime ? '#ff5252' : this.fontColor,
        zIndex: 1,
        fontSize: `${this.fontSizePc(this.fontSize)}px`,
        textAlign: this.horizontalAlign,
      };
    },
    clockStyle() {
      return {
        fontFamily: this.font,
        color: "rgb(var(--v-theme-primary))",
        zIndex: 1,
        fontSize: `${this.fontSizePc(this.fontSize * 0.6)}px`,
        textAlign: this.horizontalAlign,
      };
    },

    isRunning() {
      return !!this.appdata.is_running;
    },
    targetEndAt() {
      const value = this.appdata.target_end_at;
      if (!value) return null;
      return value instanceof Date ? value : new Date(value);
    },
    totalDurationMs() {
      const value = this.appdata.total_duration_ms;
      return value || 0;
    },
    remainingMs() {
      if (!this.targetEndAt) return 0;
      return this.targetEndAt - this.countdownNow;
    },
    isOvertime() {
      return this.isRunning && this.remainingMs < 0 && !this.userdata.auto_stop_at_zero;
    },
    progressPct() {
      if (!this.totalDurationMs) return 0;
      const elapsed = this.totalDurationMs - this.remainingMs;
      return Math.min(100, Math.max(0, (elapsed / this.totalDurationMs) * 100));
    },
    formattedRemaining() {
      return this.formatDuration(this.remainingMs, this.timeFormat);
    },
    formattedClock() {
      return this.formatClock(this.wallNow, this.hourFormat);
    },
  },
  watch: {
    isRunning() {
      clearInterval(this.countdownTimer);
      if (this.isRunning) {
        this.countdownNow = new Date();
        this.countdownTimer = setInterval(() => {
          this.countdownNow = new Date();
        }, 250);
      }
    },
  },
  methods: {
    fontSizePc(pc) {
      const v = Math.min(this.s_width, this.s_height);
      return (pc * v) / 100 / 2;
    },
    windowResize() {
      const container = this.$refs.container;
      if (container) {
        this.s_width = container.offsetWidth;
        this.s_height = container.offsetHeight;
        if (this.s_width <= 0 || this.s_height <= 0) {
          setTimeout(() => this.windowResize(), 100);
        }
      }
    },
    pad(v) {
      return String(Math.abs(v)).padStart(2, "0");
    },
    formatDuration(ms, format) {
      // Sem sinal de negativo — quando "Desligar ao zerar tempo" está
      // desmarcado e o cronômetro passa de zero, o vermelho (isOvertime)
      // já indica isso; o texto mostra o tempo excedido normalmente.
      const totalSeconds = Math.floor(Math.abs(ms) / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const tokens = { hh: this.pad(hours), mm: this.pad(minutes), ss: this.pad(seconds) };
      return format.replace(/hh|mm|ss/g, (match) => tokens[match]);
    },
    formatClock(date, format) {
      const tokens = {
        hh: this.pad(date.getHours()),
        mm: this.pad(date.getMinutes()),
        ss: this.pad(date.getSeconds()),
      };
      return format.replace(/hh|mm|ss/g, (match) => tokens[match]);
    },
  },
  mounted() {
    this.windowResize();
    window.addEventListener("resize", this.windowResize);

    this.wallTimer = setInterval(() => {
      this.wallNow = new Date();
    }, 1000);

    if (this.isRunning) {
      this.countdownTimer = setInterval(() => {
        this.countdownNow = new Date();
      }, 250);
    }
  },
  unmounted() {
    window.removeEventListener("resize", this.windowResize);
    clearInterval(this.wallTimer);
    clearInterval(this.countdownTimer);
  },
};
</script>

<style scoped>
.cc-remaining {
  font-weight: 700;
  line-height: 1;
}
.cc-clock {
  font-weight: 700;
  line-height: 1;
  margin-top: 0.3em;
}
.cc-gauge {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 6px;
  background: rgba(var(--v-theme-on-surface), 0.15);
}
.cc-gauge-fill {
  height: 100%;
  background: rgb(var(--v-theme-success));
  transition: width 0.25s linear;
}
</style>
