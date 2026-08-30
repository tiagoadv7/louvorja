<template>
  <transition name="sw-visibility">
  <div
    v-if="isActive"
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
    <!-- Mensagem de fim de contagem (ex.: "Tempo Acabou!") — troca os dígitos
         quando o regressivo chega a zero, igual ao "Screen.vue" ser o mesmo
         componente usado no painel do operador, na saída E no retorno (ver
         views/ReturnScreen.vue), então aparece nas três telas automaticamente,
         sem lógica extra. Pisca como um alerta, com ícone de informação — o
         tempo continua aparecendo (mesmo tamanho da tela normal), piscando
         junto. Fica visível por "Duração da mensagem" segundos (0 = pra
         sempre, até resetar); passado esse tempo, encerra com um fade suave
         e volta a mostrar só o tempo normal. Sem mensagem configurada, o
         próprio tempo pisca na cor de alerta nessa mesma janela (ver
         zeroBlinkActive), em vez de não dar nenhum aviso visual. -->
    <transition name="sw-fade" mode="out-in">
      <span
        v-if="!showEndMessage"
        key="time"
        class="text-right"
        :class="{ 'sw-blink': zeroBlinkActive }"
        :style="textStyle"
      >
        {{ displayTime }}
      </span>
      <div v-else key="alert" class="sw-end-alert" :style="endMessageStyle">
        <div class="sw-end-alert-row">
          <v-icon class="sw-end-alert-icon" :size="endMessageIconSize" :color="alertColor">mdi-information</v-icon>
          <span>{{ userdata.end_message }}</span>
        </div>
        <span class="sw-end-alert-time" :style="endMessageTimeStyle">{{ displayTime }}</span>
      </div>
    </transition>

    <!-- Controles de iniciar/parar/reiniciar/salvar próximos ao próprio
         tempo — só no painel do operador (is_popup falso), nunca na
         saída/retorno, onde quem assiste não deve poder mexer. Botões fixos
         lado a lado (Iniciar e Parar não alternam de ícone, só habilitam/
         desabilitam conforme o estado) — emite pro Index.vue, que já tem a
         lógica de start/pause/reset/save. -->
    <div v-if="showOperatorControls" class="sw-op-controls">
      <v-tooltip location="top">
        <template v-slot:activator="{ props }">
          <v-btn
            v-bind="props"
            icon="mdi-play"
            color="green"
            size="small"
            variant="flat"
            :disabled="!!isRunning"
            @click="$emit('start-run')"
          />
        </template>
        {{ t('start') }}
      </v-tooltip>
      <v-tooltip location="top">
        <template v-slot:activator="{ props }">
          <v-btn
            v-bind="props"
            icon="mdi-pause"
            color="orange"
            size="small"
            variant="flat"
            :disabled="!isRunning"
            @click="$emit('pause-run')"
          />
        </template>
        {{ t('pause') }}
      </v-tooltip>
      <v-tooltip location="top">
        <template v-slot:activator="{ props }">
          <v-btn
            v-bind="props"
            icon="mdi-refresh"
            color="red"
            size="small"
            variant="flat"
            @click="$emit('reset-run')"
          />
        </template>
        {{ t('reset') }}
      </v-tooltip>
      <v-tooltip v-if="mode !== 'countdown'" location="top">
        <template v-slot:activator="{ props }">
          <v-btn
            v-bind="props"
            icon="mdi-content-save"
            color="blue"
            size="small"
            variant="flat"
            @click="$emit('save-time')"
          />
        </template>
        {{ t('save') }}
      </v-tooltip>
    </div>
  </div>
  </transition>
</template>

<script>
import manifest from "../manifest.json";

export default {
  name: "StopwatchPage",
  emits: ["start-run", "pause-run", "reset-run", "save-time"],
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
    // Controla por quanto tempo o alerta de fim de contagem (mensagem ou
    // pisca-pisca do tempo) fica visível (ver zeroReached/showEndMessage/
    // zeroBlinkActive) — setTimeout em tempo real, não ligado ao
    // countdownTimer, porque este último pode estar parado nesse momento
    // (ex.: "Desligar ao zerar tempo" já zerou isRunning).
    endMessageExpired: false,
    endMessageTimer: null,
  }),
  computed: {
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    // Fechar o painel do operador (show=false, minimized=false) esconde o
    // conteúdo na janela de saída — fica só a janela transparente, em vez de
    // continuar mostrando o cronômetro parado. Minimizar não afeta (minimized
    // continua true). No painel do próprio operador, embutido no Index.vue,
    // isso nunca é false enquanto o diálogo estiver visível.
    isActive() {
      return !!this.$appdata.get(`modules.${this.module_id}.show`) || !!this.$appdata.get(`modules.${this.module_id}.minimized`);
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
    alertColor() {
      return this.userdata.alert_color || "#ff5252";
    },
    showOperatorControls() {
      return !this.$appdata.get("is_popup");
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
        // vermelho em vez de mostrar sinal de negativo. zeroBlinkActive cobre
        // o instante em que zera sem mensagem configurada (ver template).
        color: (this.isOvertime || this.zeroBlinkActive) ? this.alertColor : this.fontColor,
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

    // Condição "crua" de zerado: a partir do instante em que o regressivo
    // chega a zero, contanto que o horário de término ainda esteja
    // configurado (Reset limpa targetEndAt, fazendo o alerta sumir junto).
    // Independe de isRunning de propósito: cobre tanto o caso "Desligar ao
    // zerar tempo" (para sozinho, alerta fica) quanto "Continuar após zero"
    // (segue passando do tempo, alerta aparece do mesmo jeito, no lugar do
    // relógio em overtime). Não decide sozinha o que é exibido — ver
    // showEndMessage/zeroBlinkActive, que somam o prazo configurado em
    // "Duração da mensagem" e se há texto configurado.
    zeroReached() {
      return (
        this.mode === 'countdown' &&
        !!this.targetEndAt &&
        this.remainingMs <= 0
      );
    },
    hasEndMessage() {
      return !!(this.userdata.end_message && this.userdata.end_message.trim());
    },
    endMessageDurationMs() {
      const secs = Number(this.userdata.end_message_duration);
      return secs > 0 ? secs * 1000 : 0;
    },
    // Mensagem visível = zerado, com texto configurado, e o prazo configurado
    // ainda não expirou (ver watch/endMessageExpired). Quando expira, volta
    // a mostrar só o tempo normal (mesmo bloco de sempre, com fade suave —
    // ver <transition> no template).
    showEndMessage() {
      return this.zeroReached && this.hasEndMessage && !this.endMessageExpired;
    },
    // Sem mensagem configurada: em vez de não dar nenhum aviso, o próprio
    // tempo pisca na cor de alerta durante a mesma janela de "Duração da
    // mensagem" (ver .sw-blink no template/CSS).
    zeroBlinkActive() {
      return this.zeroReached && !this.hasEndMessage && !this.endMessageExpired;
    },
    endMessageFontSize() {
      return this.fontSizePc(this.fontSize * 0.6);
    },
    endMessageIconSize() {
      return Math.round(this.endMessageFontSize * 1.15);
    },
    endMessageStyle() {
      return {
        fontFamily: this.font,
        color: this.alertColor,
        zIndex: 1,
        fontSize: `${this.endMessageFontSize}px`,
        textAlign: 'center',
        lineHeight: 1.2,
      };
    },
    // Mesmo tamanho do relógio normal (textStyle) — não reduzido — pra não
    // "encolher" o tempo só porque a mensagem está junto.
    endMessageTimeStyle() {
      return {
        fontFamily: this.font,
        color: this.alertColor,
        fontSize: `${this.fontSizePc(this.fontSize)}px`,
        textAlign: 'center',
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
        // Resincroniza countdownNow SEMPRE que isRunning muda, mesmo ao parar
        // — sem isso, quando o operador para o regressivo (auto_stop_at_zero)
        // o último valor congelado podia ser de ANTES de cruzar o zero (o
        // check do operador roda a cada 500ms, o timer local daqui a cada
        // 250ms — ambos podem "empatar" com o restante ainda em +Xms),
        // travando o mostrador acima de zero pra sempre e a mensagem nunca
        // aparecendo. Ler `new Date()` de novo aqui garante um instante igual
        // ou posterior ao que o operador já confirmou como zerado.
        this.countdownNow = new Date();
        clearInterval(this.countdownTimer);
        if (this.isRunning) {
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
    // Dispara o timer real (setTimeout, não o countdownTimer — que pode já
    // estar parado nesse momento) que esconde a mensagem/pisca depois da
    // duração configurada. Reinicia sempre que a condição crua liga/desliga
    // (ex.: um novo regressivo zera de novo depois de resetado).
    zeroReached(active) {
      this.syncEndMessageTimer(active);
    },
  },
  methods: {
    // Usado tanto pelo watch de zeroReached quanto pelo mounted() — uma
    // janela de saída/retorno pode montar já com o regressivo zerado (o
    // alerta já ativo), e o watch sozinho só reage a MUDANÇAS, não ao
    // estado inicial.
    syncEndMessageTimer(active) {
      clearTimeout(this.endMessageTimer);
      this.endMessageTimer = null;
      this.endMessageExpired = false;
      if (active && this.endMessageDurationMs > 0) {
        this.endMessageTimer = setTimeout(() => {
          this.endMessageExpired = true;
        }, this.endMessageDurationMs);
      }
    },
    t(text) {
      const key = `modules.${this.module_id}.${text}`;
      const result = this.$t(key);
      if (result === key) {
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
    this.syncEndMessageTimer(this.zeroReached);

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
    clearTimeout(this.endMessageTimer);
  },
};
</script>

<style scoped>
.sw-visibility-enter-active,
.sw-visibility-leave-active {
  transition: opacity 0.4s ease;
}
.sw-visibility-enter-from,
.sw-visibility-leave-to {
  opacity: 0;
}
.sw-fade-enter-active,
.sw-fade-leave-active {
  transition: opacity 0.6s ease;
}
.sw-fade-enter-from,
.sw-fade-leave-to {
  opacity: 0;
}
@keyframes sw-end-alert-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0.15; }
}
.sw-end-alert {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15em;
  width: 100%;
  animation: sw-end-alert-blink 1s steps(1, end) infinite;
}
/* Sem mensagem configurada, o próprio tempo pisca na cor de alerta (ver
   zeroBlinkActive) em vez de mostrar a mensagem. */
.sw-blink {
  animation: sw-end-alert-blink 1s steps(1, end) infinite;
}
/* Enquanto some (fade suave, ver .sw-fade-* acima), desliga o piscar — as
   duas animações mexem em opacity e a piscada (infinita) venceria a
   transição, fazendo o fade parecer travado/piscando em vez de sumir liso. */
.sw-fade-leave-active.sw-end-alert {
  animation: none;
}
.sw-end-alert-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35em;
}
.sw-end-alert-icon {
  flex-shrink: 0;
}
.sw-op-controls {
  position: absolute;
  left: 50%;
  bottom: 6%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  z-index: 2;
  /* Fundo escuro translúcido próprio, sempre presente — sem ele, imagem ou
     cor de fundo customizada deixa os botões difíceis de enxergar (e sobre o
     preto padrão o efeito é imperceptível, então não muda o visual atual). */
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
</style>
