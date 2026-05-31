<template>
  <div ref="container" class="w-100 h-100">
    <transition
      name="fade"
      v-for="(slide, index) in slides.slice().reverse()"
      :key="index"
    >
      <div
        v-if="!slide.destroy"
        v-show="slide.active"
        class="position-absolute top-0 left-0 w-100 h-100"
        :style="style_bg(slide)"
      >
        <!-- Layer de vídeo global (apenas quando type='video') -->
        <video
          v-if="globalBg && globalBg.type === 'video' && globalBg.url"
          :src="globalBg.url"
          autoplay loop muted playsinline
          class="position-absolute top-0 left-0 w-100 h-100"
          :style="{ objectFit: globalBg.fit || 'cover', opacity: (globalBg.opacity ?? 100) / 100 }"
        />

        <div
          class="position-absolute top-0 left-0 w-100 h-100 d-flex justify-center align-center"
        >
          <div>
            <div
              v-if="slide.aux_text"
              v-html="slide.aux_text"
              :style="style_aux_text()"
            />
            <div
              v-if="slide.text"
              v-html="slide.text"
              :style="style_text(slide)"
            />
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  name: "SlideComponent",
  props: {
    slide_number: Number,
    cover: Boolean,
    text: String,
    aux_text: String,
    image: String,
    image_position: Number,
  },
  data: () => ({
    slides: [{}, {}],
    repeat: false,
    width: 0,
    height: 0,
    globalBg:    null,
    _bgListener: null,
  }),
  computed: {
    props_slide() {
      return {
        slide_number:   this.slide_number,
        cover:          this.cover,
        text:           this.text,
        aux_text:       this.aux_text,
        image:          this.image,
        image_position: this.image_position,
      };
    },
    screenSize() {
      return { width: this.width, height: this.height };
    },
  },
  watch: {
    props_slide() {
      this.setSlide();
    },
    screenSize() {
      const self = this;
      setTimeout(function () { self.windowResize(); }, 100);
    },
  },
  methods: {
    _readGlobalBg() {
      try {
        const raw = localStorage.getItem('slide_global_bg');
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    },

    setSlide() {
      if (
        this.$string.clean(this.slides[1].text)     == this.$string.clean(this.props_slide.text)     &&
        this.$string.clean(this.slides[1].aux_text) == this.$string.clean(this.props_slide.aux_text) &&
        this.slides[1].image == this.props_slide.image &&
        this.slides[1].cover == this.props_slide.cover
      ) {
        this.repeat = !this.repeat;
      } else {
        this.repeat = false;
      }

      this.slides.unshift({});

      // Marca o slide anterior como inativo → dispara a transição de saída
      // (sem isso o slide antigo fica visível indefinidamente, causando sobreposição).
      if (this.slides[2] && this.slides[2].active) {
        this.slides[2] = { ...this.slides[2], active: false };
      }

      this.slides[1] = { ...this.props_slide, active: true };

      if (this.slides.length > 3) {
        this.slides[3].destroy = true;
      }
    },

    style_bg(slide) {
      const bg = this.globalBg;

      // ── Fundo personalizado configurado ──────────────────────────────
      if (bg) {
        // type='none': transparente — apenas o quadro rgba das letras aparece.
        //   Usa transição 'fade-text' para evitar sobreposição.
        if (bg.type === 'none') {
          return { overflow: "hidden", backgroundColor: "transparent" };
        }

        // type='image': aplicado como backgroundImage no slide (igual ao original).
        //   O fundo preto sólido cobre o slide anterior durante a transição.
        if (bg.type === 'image' && bg.url) {
          return {
            overflow:           "hidden",
            backgroundColor:    bg.background_color || "rgb(0, 0, 0)",
            backgroundImage:    `url(${bg.url})`,
            backgroundRepeat:   "no-repeat",
            backgroundPosition: "center center",
            backgroundSize:     bg.fit || "cover",
          };
        }

        // type='video': fundo preto sólido — o vídeo é renderizado como elemento
        //   filho dentro do slide div (acima do preto, abaixo do texto).
        return {
          overflow:        "hidden",
          backgroundColor: bg.background_color || "rgb(0, 0, 0)",
        };
      }

      // ── Modo padrão: idêntico ao código original ──────────────────────
      return {
        overflow:           "hidden",
        backgroundColor:    "rgb(0, 0, 0)",
        backgroundImage:    `url(${slide.image})`,
        backgroundRepeat:   "no-repeat",
        backgroundPosition: [
          "top left",    "top center",    "top right",
          "center left", "center center", "center right",
          "bottom left", "bottom center", "bottom right",
        ][this.image_position || 5],
        backgroundSize: "cover",
      };
    },

    style_aux_text() {
      const bg     = this.globalBg;
      const family = bg?.font           || 'DINCondensedBold';
      const size   = bg?.panel_font_size ?? 10;
      const border = bg?.border_spacing  ?? 5;
      return {
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        fontSize:        `${this.fontSizePc(size)}px`,
        color:           "rgb(246, 195, 42)",
        padding:         `0px ${this.fontSizePc(border)}px`,
        fontFamily:      family,
        textTransform:   "uppercase",
      };
    },

    style_text(slide) {
      const bg          = this.globalBg;
      const family      = bg?.font          || 'DINCondensedBold';
      const customSize  = bg?.font_size      ?? null;
      const customColor = bg?.font_color     || null;
      const border      = bg?.border_spacing ?? 5;

      const base = {
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        padding:         `0px ${this.fontSizePc(border)}px`,
        textAlign:       "center",
        fontFamily:      family,
        textTransform:   "uppercase",
      };

      if (slide.cover) {
        return {
          ...base,
          fontSize: `${this.fontSizePc(customSize ?? 25)}px`,
          color:    customColor || "rgb(246, 195, 42)",
        };
      }
      return {
        ...base,
        fontSize: `${this.fontSizePc(customSize ?? 20)}px`,
        color:    customColor || (this.repeat ? "rgb(246, 195, 42)" : "rgb(255, 255, 255)"),
      };
    },

    fontSizePc(pc) {
      const v = Math.min(this.width, this.height);
      return (pc * v) / 100 / 2;
    },

    windowResize() {
      const container = this.$refs.container;
      if (container) {
        this.width  = container.offsetWidth;
        this.height = container.offsetHeight;
        if (this.width <= 0 || this.height <= 0) {
          const self = this;
          setTimeout(function () { self.windowResize(); }, 100);
        }
      }
    },
  },
  mounted() {
    this.globalBg    = this._readGlobalBg();
    this._bgListener = () => { this.globalBg = this._readGlobalBg(); };
    window.addEventListener('slide-bg-changed', this._bgListener);
    this.setSlide();
    this.windowResize();
    window.addEventListener("resize", this.windowResize);
  },
  unmounted() {
    window.removeEventListener("resize", this.windowResize);
    if (this._bgListener) window.removeEventListener('slide-bg-changed', this._bgListener);
  },
};
</script>

<style scoped>
/* ── Transição padrão — idêntica ao código original ──────────────────
   Enter e Leave com a MESMA duração (0.5s ease).
   O fundo preto sólido do novo slide cobre o conteúdo do slide anterior,
   impedindo sobreposição de textos durante o crossfade. */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

</style>
