<template>
  <transition name="bb-visibility">
  <div
    v-if="isActive"
    ref="container"
    :style="{
      position: 'relative',
      overflow: 'hidden',
      background: backgroundColor,
      width: '100%',
      height: height ? height + 'px' : '100%',
    }"
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
        objectFit: imageFit,
        opacity: imageOpacity,
      }"
    />

    <transition name="fade" mode="out-in">
      <div
        :key="layerKey"
        class="d-flex flex-column"
        :class="[
          `align-${verticalAlign}`,
          `justify-${horizontalAlign}`,
        ]"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          padding: `${fontSizePc(borderSpacing)}px`,
        }"
      >
        <span
          v-if="bible && bible.text"
          :class="
            'text-' +
            (horizontalAlign == 'start'
              ? 'left'
              : horizontalAlign == 'end'
                ? 'right'
                : 'center')
          "
          :style="{
            zIndex: 1,
            color: fontColor,
            fontSize: `${fontSizePc(fontSize)}px`,
            fontFamily: userdata.font || 'Arial, sans-serif',
          }"
        >
          {{ bible.text }}
        </span>
        <span
          v-if="bible && bible.scriptural_reference"
          :class="
            'text-' + (horizontalAlign == 'start' ? 'left' : 'right')
          "
          :style="{
            zIndex: 1,
            color: referenceFontColor,
            fontSize: `${fontSizePc(referenceFontSize)}px`,
            fontFamily: userdata.reference_font || 'Arial, sans-serif',
          }"
        >
          {{ bible.scriptural_reference }}
        </span>
      </div>
    </transition>
  </div>
  </transition>
</template>

<script>
import manifest from "../manifest.json";

export default {
  name: "ScreenBiblePage",
  props: {
    height: Number,
  },
  data: () => ({
    s_width: 0,
    s_height: 0,
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
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
    // Fechar o painel do operador esconde o conteúdo na janela de saída
    // (fica só a janela transparente), sem afetar o painel do próprio
    // operador nem o estado "minimizado".
    isActive() {
      return !!this.$appdata.get(`modules.${this.module_id}.show`) || !!this.$appdata.get(`modules.${this.module_id}.minimized`);
    },
    // Valores padrão — sem eles, userdata.xxx fica null até o operador
    // customizar a exibição pelo menos uma vez, e font_size null vira
    // fontSizePc(null) === 0 (texto montado no DOM com tamanho zero,
    // portanto invisível mesmo com bible.text preenchido corretamente).
    backgroundColor() { return this.userdata.background_color || "#000000"; },
    fontColor()       { return this.userdata.font_color || "#ffffff"; },
    fontSize()        { return this.userdata.font_size || 48; },
    referenceFontColor() { return this.userdata.reference_font_color || "#aaaaaa"; },
    referenceFontSize()  { return this.userdata.reference_font_size || 32; },
    borderSpacing()   { return this.userdata.border_spacing || 10; },
    verticalAlign()   { return this.userdata.vertical_align || "center"; },
    horizontalAlign() { return this.userdata.horizontal_align || "center"; },
    imageFit()        { return this.userdata.image_fit || "cover"; },
    imageOpacity()    { return (this.userdata.image_opacity || 100) / 100; },
    bible() {
      return this.$appdata.get("modules.bible.data");
    },
    layerKey() {
      return (this.bible?.text || "") + "||" + (this.bible?.scriptural_reference || "");
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
  },
  unmounted() {
    window.removeEventListener("resize", this.windowResize);
  },
};
</script>

<style scoped>
.bb-visibility-enter-active,
.bb-visibility-leave-active {
  transition: opacity 0.4s ease;
}
.bb-visibility-enter-from,
.bb-visibility-leave-to {
  opacity: 0;
}
.fade-enter-active {
  transition: opacity 0.4s ease-in-out;
  will-change: opacity;
}
.fade-leave-active {
  transition: opacity 0.25s ease-in-out;
  will-change: opacity;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
