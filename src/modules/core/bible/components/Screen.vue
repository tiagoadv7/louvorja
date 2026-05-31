<template>
  <div
    ref="container"
    :style="{
      position: 'relative',
      overflow: 'hidden',
      background: userdata.background_color,
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
        objectFit: userdata.image_fit,
        opacity: userdata.image_opacity / 100,
      }"
    />

    <transition name="fade" mode="out-in">
      <div
        :key="layerKey"
        class="d-flex flex-column"
        :class="[
          `align-${userdata.vertical_align}`,
          `justify-${userdata.horizontal_align}`,
        ]"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          padding: `${fontSizePc(userdata.border_spacing)}px`,
        }"
      >
        <span
          v-if="bible && bible.text"
          :class="
            'text-' +
            (userdata.horizontal_align == 'start'
              ? 'left'
              : userdata.horizontal_align == 'end'
                ? 'right'
                : 'center')
          "
          :style="{
            zIndex: 1,
            color: userdata.font_color,
            fontSize: `${fontSizePc(userdata.font_size)}px`,
            fontFamily: userdata.font || 'Arial, sans-serif',
          }"
        >
          {{ bible.text }}
        </span>
        <span
          v-if="bible && bible.scriptural_reference"
          :class="
            'text-' + (userdata.horizontal_align == 'start' ? 'left' : 'right')
          "
          :style="{
            zIndex: 1,
            color: userdata.reference_font_color,
            fontSize: `${fontSizePc(userdata.reference_font_size)}px`,
            fontFamily: userdata.reference_font || 'Arial, sans-serif',
          }"
        >
          {{ bible.scriptural_reference }}
        </span>
      </div>
    </transition>
  </div>
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
