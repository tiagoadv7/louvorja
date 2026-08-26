<template>
  <div
    ref="container"
    class="d-flex"
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
    <span v-if="!showEndMessage" class="text-right" :style="textStyle">
      {{ displayTime }}
    </span>
    <!-- Mensagem de fim de contagem (ex.: "Tempo Acabou!") — troca os dígitos
         quando o regressivo chega a zero, igual ao "Screen.vue" ser o mesmo
         componente usado na saída E no retorno (ver views/ReturnScreen.vue),
         então aparece nas duas telas automaticamente, sem lógica extra. -->
    <span v-else class="text-center" :style="endMessageStyle">
      {{ userdata.end_message }}
    </span>
  </div>
</template>

<script>
import manifest from "../manifest.json";

export default {
  name: "StopwatchPage",
  data: () => ({
    s_width: 0,
    s_height: 0,
    timer: null,
    elapsedTime: 0,
    now: null,
    // Modo "regressivo": timer local próprio (igual ao Cronômetro de Culto)
    // calculando o restante a partir de targetEndAt, em vez de depender de
    // atualizações contínuas vindas do painel do operador.
    countdownTimer: null,
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
      return this.userdata.background_color || "#000000";
    },
    font() {
      return this.userdata.font || "Arial, sans-serif";
    },
    fontColor() {
      return this.userdata.font_color || "#FFFFFF";
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
    image() {
      return this.userdata.image || "";
    },
    imageOpacity() {
      return (this.userdata.image_opacity || 100) / 100;
    },
    imageFit() {
      return this.userdata.image_fit || "cover";
    },
    timeFormat() {
      return this.userdata.time_format || "hh.mm.ss.ms";
    },
    alignClass() {
      const vertical = {
        start: "align-start",
        center: "align-center",
        end: "align-end",
      };
      const horizontal = {
        start: "justify-start",
        center: "justify-center",
        end: "justify-end",
      };
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
        // Modo regressivo passado do tempo (com "Desligar ao zerar tempo"
        // desmarcado): mesmo tratamento do Cronômetro de Culto, texto fica
        // vermelho em vez de mostrar sinal de negativo.
        color: this.isOvertime ? '#ff5252' : this.fontColor,
        zIndex: 1,
        fontSize: `${this.fontSizePc(this.fontSize)}px`,
        textAlign: `${this.horizontalAlign}`,
      };
    },

    mode() {
      return this.userdata.mode || 'normal';
    },

    startTime() {
      const value = this.appdata.start_time;
      if (!value) return null;
      return value instanceof Date ? value : new Date(value);
    },
    pausedTime() {
      const value = this.appdata.paused_time;
      if (!value) return null;
      return value instanceof Date ? value : new Date(value);
    },
    isRunning() {
      return this.appdata.is_running ?? null;
    },

    // Modo regressivo — mesmos campos do Cronômetro de Culto (ver
    // cronometro_culto/components/Screen.vue), só que sob o namespace deste
    // módulo (modules.stopwatch.*), sem colisão entre os dois.
    targetEndAt() {
      const value = this.appdata.target_end_at;
      if (!value) return null;
      return value instanceof Date ? value : new Date(value);
    },
    totalDurationMs() {
      return this.appdata.total_duration_ms || 0;
    },
    remainingMs() {
      if (!this.targetEndAt) return 0;
      return this.targetEndAt - this.countdownNow;
    },
    isOvertime() {
      return (
        this.mode === 'countdown' &&
        this.isRunning &&
        this.remainingMs < 0 &&
        !this.userdata.auto_stop_at_zero
      );
    },

    // Mostra a mensagem (em vez dos dígitos) a partir do instante em que o
    // regressivo chega a zero, contanto que haja mensagem digitada e o
    // horário de término ainda esteja configurado (Reset limpa targetEndAt,
    // fazendo a mensagem sumir junto). Independe de isRunning de propósito:
    // cobre tanto o caso "Desligar ao zerar tempo" (para sozinho, mensagem
    // fica) quanto "Continuar após zero" (segue passando do tempo, mensagem
    // aparece do mesmo jeito, no lugar do relógio em overtime).
    showEndMessage() {
      return (
        this.mode === 'countdown' &&
        !!this.targetEndAt &&
        this.remainingMs <= 0 &&
        !!(this.userdata.end_message && this.userdata.end_message.trim())
      );
    },
    endMessageStyle() {
      return {
        fontFamily: this.font,
        color: '#ff5252',
        zIndex: 1,
        fontSize: `${this.fontSizePc(this.fontSize * 0.6)}px`,
        textAlign: 'center',
        lineHeight: 1.2,
      };
    },

    formattedTime() {
      const elapsedTime = this.now
        ? this.now - (this.startTime ?? this.now)
        : 0;
      return this.formatMs(elapsedTime);
    },
    formattedRemaining() {
      return this.formatMs(Math.abs(this.remainingMs));
    },
    displayTime() {
      return this.mode === 'countdown' ? this.formattedRemaining : this.formattedTime;
    },
  },
  watch: {
    isRunning() {
      if (this.mode === 'countdown') {
        clearInterval(this.countdownTimer);
        if (this.isRunning) {
          this.countdownNow = new Date();
          this.countdownTimer = setInterval(() => {
            this.countdownNow = new Date();
          }, 250);
        }
        return;
      }
      if (this.isRunning) {
        this.timer = setInterval(() => {
          this.now = new Date();
        }, 10);
      } else {
        clearInterval(this.timer);
        this.now = this.pausedTime;
      }
    },
  },
  methods: {
    formatMs(totalMilliseconds) {
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

      return this.timeFormat.replace(/hh|mm|ss|ms/g, (match) => tokens[match]);
    },
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
          const self = this;
          setTimeout(function () {
            self.windowResize();
          }, 100);
        }
      }
    },
  },
  mounted() {
    this.windowResize();
    window.addEventListener("resize", this.windowResize);

    if (this.isRunning) {
      if (this.mode === 'countdown') {
        this.countdownNow = new Date();
        this.countdownTimer = setInterval(() => {
          this.countdownNow = new Date();
        }, 250);
      } else {
        this.timer = setInterval(() => {
          this.now = new Date();
        }, 10);
      }
    }
  },
  unmounted() {
    window.removeEventListener("resize", this.windowResize);
    clearInterval(this.timer);
    clearInterval(this.countdownTimer);
  },
};
</script>
