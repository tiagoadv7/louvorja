<template>
  <!-- position:relative para z-index funcionar entre os filhos absolute.
       O container é sempre transparent — os divs de fundo internos (absolute, z-index 1/2)
       cobrem o container o tempo todo, inclusive durante o bg-crossfade. -->
  <div ref="container" class="w-100 h-100" style="position:relative;overflow:hidden;background:transparent">
    <!-- ── Camada de fundo (separada do texto) ─────────────────────────────
         Transição bg-crossfade: novo fundo aparece por cima (z-index:2) enquanto
         o antigo se desfaz por baixo (z-index:1). Ambos animam opacidade de
         verdade, então imagem/vídeo terminam com fade out suave e transparente
         (ex.: ao voltar para "Sem Fundo") em vez de um corte abrupto. -->
    <transition name="bg-crossfade">
      <div
        :key="bgKey"
        class="position-absolute top-0 left-0 w-100 h-100"
        :style="bgStyle"
      >
        <video
          v-if="globalBg && globalBg.type === 'video' && globalBg.url"
          :src="globalBg.url"
          :poster="transparentPixel"
          autoplay loop muted playsinline
          class="position-absolute top-0 left-0 w-100 h-100"
          :style="{ objectFit: globalBg.fit || 'cover', opacity: (globalBg.opacity ?? 100) / 100, background: 'transparent' }"
        />
      </div>
    </transition>

    <!-- ── Camada de texto (fade independente do fundo) ────────────────── -->
    <transition
      name="fade"
      v-for="(slide, index) in slides.slice().reverse()"
      :key="'txt-' + index"
    >
      <div
        v-if="!slide.destroy"
        v-show="slide.active"
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
    </transition>
  </div>
</template>

<script>
// PNG 1x1 transparente — usado como poster do <video> de fundo para que o
// navegador exiba transparência (em vez do preto padrão de "sem frame ainda")
// enquanto o vídeo carrega o primeiro quadro.
const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

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
  data() {
    // Inicializa slides[1] com os props já recebidos para evitar que bgKey mude
    // no primeiro setSlide() (mounted) e dispare a transição bg-crossfade sobre preto.
    return {
      slides: [
        {},
        {
          slide_number:   this.slide_number,
          cover:          this.cover,
          text:           this.text,
          aux_text:       this.aux_text,
          image:          this.image,
          image_position: this.image_position,
          active:         true,
        },
      ],
      repeat:         false,
      width:          0,
      height:         0,
      // Lido de forma síncrona aqui (não em mounted()) — do contrário o primeiro
      // render usaria globalBg=null (mostrando a capa da música) e só corrigiria
      // para o fundo transparente/personalizado depois, causando um flash visível
      // toda vez que este componente remonta (ex.: troca de música).
      globalBg:       this._readGlobalBg(),
      _bgListener:    null,
      _ipcBgListener: null,
    };
  },
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

    transparentPixel() {
      return TRANSPARENT_PIXEL;
    },

    // Slide ativo corrente (para estilo do fundo estático)
    activeSlide() {
      return this.slides.find(s => s.active) || this.slides[1] || {};
    },

    // Chave única do fundo — muda SOMENTE quando a imagem/tipo realmente muda,
    // evitando que a transição dispare ao trocar apenas o texto.
    bgKey() {
      const bg = this.globalBg;
      // type='default': texto personalizado sem fundo próprio — o fundo continua
      // sendo a imagem de cada slide, então a key precisa acompanhá-la também.
      if (bg && bg.type && bg.type !== 'default') return `bg-${bg.type}-${bg.url || ''}-${bg.opacity ?? 100}`;
      return `bg-default-${this.activeSlide.image || ''}-${this.image_position ?? 5}`;
    },

    // Estilo do fundo calculado a partir do slide ativo (sem depender do slide em transição)
    bgStyle() {
      return this.style_bg(this.activeSlide);
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

      // Estilo padrão do slide (usado quando não há fundo personalizado ativo)
      const slideDefault = {
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

      // ── Fundo personalizado configurado ──────────────────────────────
      if (bg) {
        // type='none': transparente — letras aparecem sem imagem de fundo
        if (bg.type === 'none') {
          return { overflow: "hidden", backgroundColor: "transparent" };
        }

        // type='image': imagem personalizada escolhida pelo usuário.
        // backgroundColor cai para transparente (não preto) — sem isso a área
        // aparecia preta antes da imagem carregar e "vazava" preto durante o
        // fade de saída do bg-crossfade, mesmo com o crossfade correto.
        if (bg.type === 'image' && bg.url) {
          return {
            overflow:           "hidden",
            backgroundColor:    bg.background_color || "transparent",
            backgroundImage:    `url(${bg.url})`,
            backgroundRepeat:   "no-repeat",
            backgroundPosition: "center center",
            backgroundSize:     bg.fit || "cover",
          };
        }

        // type='video': idem — transparente até o primeiro frame do vídeo
        // (elemento filho) renderizar, e sem preto residual ao sair.
        if (bg.type === 'video') {
          return {
            overflow:        "hidden",
            backgroundColor: bg.background_color || "transparent",
          };
        }

        // type='default' (ou fundo sem url): texto personalizado sozinho —
        // mantém a imagem padrão de cada slide.
      }

      // ── Sem fundo personalizado (globalBg=null): imagem padrão do slide ──
      return slideDefault;
    },

    style_aux_text() {
      const bg     = this.globalBg;
      const family = bg?.font           || 'DINCondensedBold';
      const size   = bg?.panel_font_size ?? 10;
      const border = bg?.border_spacing  ?? 5;
      return {
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        fontSize:        `${this.fontSizePc(size)}px`,
        color:           bg?.panel_font_color || "rgb(246, 195, 42)",
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
          // Tamanho próprio do título — não cai para o tamanho do texto normal
          // (customSize), senão o título fica preso ao mesmo valor do Texto.
          fontSize: `${this.fontSizePc(bg?.cover_font_size ?? 25)}px`,
          color:    bg?.cover_font_color || customColor || "rgb(246, 195, 42)",
        };
      }
      if (this.repeat) {
        return {
          ...base,
          // Tamanho igual ao do texto normal (customSize) — só a cor é própria.
          fontSize: `${this.fontSizePc(customSize ?? 20)}px`,
          color:    bg?.repeat_font_color || customColor || "rgb(246, 195, 42)",
        };
      }
      return {
        ...base,
        fontSize: `${this.fontSizePc(customSize ?? 20)}px`,
        color:    customColor || "rgb(255, 255, 255)",
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

    // Sincronização em tempo real via IPC (janela de saída Electron):
    // recebe state-update com param='slide_global_bg' enviado pelo Fundo Personalizado
    if (window.electron) {
      this._ipcBgListener = window.electron.on('state-update', ({ param, value }) => {
        if (param === 'slide_global_bg') {
          this.globalBg = value ?? this._readGlobalBg();
        }
      });
    }

    this.setSlide();
    this.windowResize();
    window.addEventListener("resize", this.windowResize);
  },
  unmounted() {
    window.removeEventListener("resize", this.windowResize);
    if (this._bgListener)    window.removeEventListener('slide-bg-changed', this._bgListener);
    if (this._ipcBgListener) window.electron?.off?.('state-update', this._ipcBgListener);
  },
};
</script>

<style scoped>
/* ── Transição de texto (fade normal) ────────────────────────────────
   Texto antigo sai enquanto novo entra — crossfade simples. */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Transição de fundo (bg-crossfade) ──────────────────────────────
   Novo fundo entra por cima (z-index:2) enquanto o antigo (z-index:1)
   se desfaz por baixo — ambos animam opacidade de verdade, então trocar
   para "sem fundo" (transparente) produz um fade out suave em vez de um
   corte abrupto no final da transição. */
.bg-crossfade-enter-active,
.bg-crossfade-leave-active {
  transition: opacity 0.5s ease;
}
.bg-crossfade-enter-active { z-index: 2; }
.bg-crossfade-leave-active { z-index: 1; }
.bg-crossfade-enter-from { opacity: 0; }
.bg-crossfade-leave-to   { opacity: 0; }
</style>
