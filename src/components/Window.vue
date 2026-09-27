<template>
  <v-dialog
    v-model="dialogVisible"
    scrollable
    persistent
    :eager="eager"
    @click:outside="minimize"
    @keydown.esc="minimize"
    :width="w_width"
    :height="w_height"
    :theme="dark ? 'dark' : ''"
  >
    <v-card :color="color ? color : ''">
      <slot name="toolbar">
        <div
          class="d-flex flex-no-wrap align-stretch flex-row justify-space-between"
        >
          <div
            v-if="icon"
            class="d-flex align-center"
            style="margin-left: 20px"
          >
            <v-icon :icon="icon" size="22" color="primary" />
          </div>
          <v-avatar
            v-if="image && $vuetify.display.width > 500"
            class="ma-1"
            :size="imageSize ? imageSize : 65"
            rounded="0"
          >
            <v-img :src="image" />
          </v-avatar>
          <div
            class="flex-grow-1 d-flex flex-column justify-center text-truncate"
          >
            <v-card-title
              v-if="title"
              class="py-0 my-0"
              :class="titleClass ? titleClass : 'text-h5 font-weight-light'"
            >
              {{ title }}
            </v-card-title>
            <v-card-subtitle v-if="subtitle" class="pb-1">
              {{ subtitle }}
            </v-card-subtitle>
          </div>
          <div class="d-flex flex-row flex-nowrap align-start">
            <slot name="system_buttons" />

            <l-customization-bar v-if="$slots.customize">
              <slot name="customize" />
            </l-customization-bar>

            <v-divider
              v-if="$slots.customize || $slots.system_buttons"
              vertical
              class="ms-2"
            />

            <v-btn
              v-if="minimizable"
              class="ms-2"
              icon="mdi-minus"
              variant="text"
              size="small"
              @click="minimize()"
            />
            <v-btn
              v-if="closable"
              class="ms-2"
              icon="mdi-close"
              variant="text"
              size="small"
              @click="close()"
            />
          </div>
        </div>
      </slot>

      <v-card-title v-if="$slots.header">
        <slot name="header" />
      </v-card-title>
      <v-card-text
        ref="container"
        class="d-flex align-stretch overflow-hidden pa-0 ma-0"
      >
        <div
          v-if="$slots.left"
          :style="`height:${container_height}px;${slotLeftStyle};`"
          :class="slotLeftClass"
        >
          <slot name="left" />
        </div>
        <div
          ref="main_container"
          class="flex-grow-1 overflow-auto"
          :class="{ 'pa-5': !compact, 'pa-0': compact, 'ma-0': compact }"
          @scroll="scroll"
        >
          <slot />
        </div>
        <div
          v-if="$slots.right"
          :style="`height:${container_height}px;${slotRightStyle};`"
          :class="slotRightClass"
        >
          <slot name="right" />
        </div>
      </v-card-text>

      <v-card-actions
        v-if="$slots.footer"
        :class="{ 'pa-0': compact_footer, 'ma-0': compact_footer }"
      >
        <slot name="footer" />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import LCustomizationBar from "@/components/CustomizationBar.vue";

export default {
  name: "WindowComponent",
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    scrollPos: Number,
    title: String,
    subtitle: String,
    icon: String,
    image: String,
    compact: Boolean,
    compact_footer: Boolean,
    closable: Boolean,
    minimizable: Boolean,
    titleClass: String,
    dark: Boolean,
    index: [Boolean, Number, String],
    // Vuetify (VOverlay/useLazy) destrói o CONTEÚDO do v-dialog de novo toda
    // vez que ele fecha (inclusive ao minimizar — Window.vue usa
    // v-model="module.show" direto, e minimizar também vira show:false),
    // não só antes da primeira abertura — ver node_modules/vuetify/lib/
    // composables/lazy.js#onAfterLeave. Isso corta na hora qualquer estado
    // que more DENTRO do componente (ex.: o <audio> do SoundMasterPanel,
    // dentro da janela "Mídia"), mesmo com minimizar não devendo interromper
    // nada — ao contrário de mídia/coletâneas, cujo áudio real vive fora
    // dessa janela. eager=true mantém o conteúdo sempre montado (como os
    // álbuns/coletâneas do sistema), em vez de recriar do zero a cada
    // reabertura — só deve ser usado pelos poucos módulos que realmente
    // guardam estado de reprodução dentro do próprio componente.
    eager: Boolean,
    size: String,
    width: [String, Number],
    height: [String, Number],
    imageSize: Number,
    color: String,
    slotLeftClass: String,
    slotRightClass: String,
    slotLeftStyle: [String, Object],
    slotRightStyle: [String, Object],
  },
  components: {
    LCustomizationBar,
  },

  data: () => ({
    container_height: 0,
    // Só usados quando eager=true — ver dialogVisible/watch("visible")
    // abaixo. eager mantém o conteúdo montado pra sempre (ver comentário na
    // prop "eager"), e isso faz o dialog-transition padrão do Vuetify (v-show
    // + <Transition> reaproveitando a MESMA instância entre aberturas) parar
    // de tocar o fade de saída de forma confiável — confirmado amostrando
    // frames: ora a opacidade ia suavemente até a metade e voltava pra 1 de
    // repente (um re-render do Vue no meio do caminho reiniciava uma
    // animação via classe CSS), ora cortava direto pra display:none sem
    // nenhuma animação. internalVisible atrasa o fechamento de verdade do
    // v-dialog; o fade em si roda via Web Animations API (element.animate,
    // ver watch("visible") abaixo) em vez de uma classe CSS — uma animação
    // já iniciada assim roda isolada no compositor, imune a um re-render do
    // Vue tocar em qualquer outro atributo do mesmo elemento no meio do
    // caminho.
    internalVisible: false,
    _fadeAnimation: null,
  }),
  computed: {
    visible: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit("update:modelValue", value);
      },
    },
    // v-model real do <v-dialog> — pra módulos eager, atrasa a transição pra
    // "fechado" até o fade manual (eagerClosing) terminar; pros demais, é
    // exatamente "visible" (comportamento padrão, inalterado).
    dialogVisible: {
      get() {
        return this.eager ? this.internalVisible : this.visible;
      },
      set(value) {
        this.visible = value;
      },
    },
    compact_screen: function () {
      return this.$vuetify.display.width <= 600;
    },
    compact_height: function () {
      return this.$vuetify.display.height <= 600;
    },
    w_width() {
      if (this.compact_screen) return "100%";
      if (this.width) return typeof this.width == "number" ? `${this.width}px` : this.width;
      return this.size == "small"
        ? "500px"
        : this.size == "large"
          ? "95%"
          : "90%";
    },
    w_height() {
      if (this.compact_screen || this.compact_height) return "100%";
      if (this.height) return typeof this.height == "number" ? `${this.height}px` : this.height;
      return this.size == "small"
        ? "550px"
        : "90%";
    },
  },
  watch: {
    visible(value) {
      this.listenerResize(this.visible);

      if (!this.eager) return;

      // Sempre cancela uma animação pendente primeiro — evita reiniciar o
      // fade do zero se "visible" disparar mais de uma vez seguida pro
      // mesmo fechamento.
      if (this._fadeAnimation) {
        this._fadeAnimation.cancel();
        this._fadeAnimation = null;
      }

      if (value) {
        this.internalVisible = true;
        return;
      }
      if (!this.internalVisible) return; // já estava fechado

      // Web Animations API em vez de uma classe CSS: uma vez iniciada, essa
      // animação roda isolada no compositor do navegador — nenhum re-render
      // do Vue nesse meio-tempo (ex.: o watch("index") logo abaixo, disparado
      // pelo mesmo fechamento) consegue reiniciá-la ou interrompê-la. Espera
      // a Promise "finished" da PRÓPRIA animação (em vez de um setTimeout
      // com a mesma duração cruzando os dedos) pra só então deixar o
      // v-dialog fechar de vez — imune a qualquer atraso entre o watcher
      // disparar e a animação realmente começar a rodar no compositor.
      const contentEl = this.$el?.closest?.(".v-overlay__content");
      if (!contentEl?.animate) {
        this.internalVisible = false;
        return;
      }
      this._fadeAnimation = contentEl.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 220, easing: "ease", fill: "forwards" }
      );
      this._fadeAnimation.finished
        .then(() => {
          this.internalVisible = false;
          this._fadeAnimation = null;
        })
        .catch(() => {}); // cancelada (reabriu no meio do fade) — nada a fazer
    },
    index() {
      this.checkScroll();
      this.windowResizeDeferred();
    },
    scrollPos(value) {
      const container = this.$refs.main_container;
      if (container) {
        container.scrollTo({
          top: value,
          behavior: "smooth",
        });
      }
    },
  },
  methods: {
    close() {
      this.$emit("close");
    },
    minimize() {
      this.$emit("minimize");
    },
    scroll() {
      let data = {};
      data.scroll_top = this.$refs.main_container.scrollTop;
      data.client_height = this.$refs.main_container.clientHeight;
      data.scroll_height = this.$refs.main_container.scrollHeight;
      data.scroll_bottom =
        data.scroll_height - data.scroll_top - data.client_height;
      this.$emit("scroll", data);
    },
    checkScroll() {
      if (this.$refs.main_container) {
        const div = this.$refs.main_container;
        const hasScroll = div.scrollHeight > div.clientHeight;
        this.$emit("hasScroll", hasScroll);
      } else {
        this.$emit("hasScroll", false);
      }
    },
    windowResize() {
      let el = this.$refs?.container?.$el;
      if (!el) {
        return;
      }

      let data = {
        container_width: el.clientWidth,
        container_height: el.clientHeight,
      };
      this.container_height = el.clientHeight;
      this.$emit("resize", data);
    },
    // O diálogo pode aparecer (visible/index mudando) antes do navegador
    // terminar o layout dele — medir clientHeight nesse exato instante às
    // vezes pega 0 (mesmo com o container já no DOM), e nada mais dispara
    // uma remedida depois, deixando slot-left/slot-right com altura 0 pra
    // sempre (conteúdo existe mas fica cortado/invisível). nextTick +
    // requestAnimationFrame garante que o layout já assentou antes de medir.
    windowResizeDeferred() {
      this.$nextTick(() => requestAnimationFrame(() => this.windowResize()));
    },

    listenerResize(active) {
      if (active && this.visible) {
        if (this.$refs.container) {
          this.resizeObserver.observe(this.$refs.container.$el);
          window.addEventListener("resize", this.windowResize);
          this.windowResizeDeferred();
        } else {
          const self = this;
          setTimeout(function () {
            self.listenerResize(active);
            self.checkScroll();
          }, 10);
        }
      } else {
        this.resizeObserver.disconnect();
        window.removeEventListener("resize", this.windowResize);
      }
    },
  },
  created() {
    // Estado inicial de dialogVisible (ver watch("visible") acima) — evita
    // um primeiro render com internalVisible desalinhado de "visible" (ex.:
    // módulo já abre com show:true, restaurado de uma sessão anterior).
    this.internalVisible = this.visible;
  },
  mounted() {
    this.resizeObserver = new ResizeObserver(() => {
      this.checkScroll();
    });

    if (this.visible) {
      this.listenerResize(this.visible);
    }
  },
  beforeUnmount() {
    if (this._fadeAnimation) this._fadeAnimation.cancel();
  },
};
</script>
