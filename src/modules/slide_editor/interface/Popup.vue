<template>
  <transition name="se-popup-fade">
    <l-slide
      v-if="isActive && (data.text || data.aux_text || data.image)"
      :slide_number="data.slide_number"
      :cover="data.cover"
      :text="data.text"
      :aux_text="data.aux_text"
      :image="data.image"
      :image_position="data.image_position"
      :color="data.color"
      :aux_color="data.aux_color"
      :font_size_pct="data.font_size_pct"
      :aux_font_size_pct="data.aux_font_size_pct"
      :background_color="data.background_color"
      :text_bg_transparent="data.text_bg_transparent"
      :text_align="data.text_align"
    />
  </transition>
</template>

<script>
import manifest from "../manifest.json";
import LSlide from "@/components/Slide.vue";

export default {
  name: "PopupSlideEditorPage",
  components: {
    LSlide,
  },
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
    // Só projeta enquanto o painel do operador estiver realmente ativo
    // (aberto ou minimizado) — mesmo padrão de modules/core/media/interface/
    // Popup.vue. Fechar o painel deixa só a janela transparente.
    isActive() {
      return !!this.$appdata.get(`modules.${this.module_id}.show`) || !!this.$appdata.get(`modules.${this.module_id}.minimized`);
    },
    data() {
      const p = (key) => this.$appdata.get(`modules.${this.module_id}.${key}`);
      return {
        text: p("text"),
        aux_text: p("aux_text"),
        cover: p("cover"),
        image: p("image"),
        image_position: p("image_position"),
        color: p("color"),
        aux_color: p("aux_color"),
        font_size_pct: p("font_size_pct"),
        aux_font_size_pct: p("aux_font_size_pct"),
        background_color: p("background_color"),
        text_bg_transparent: p("text_bg_transparent"),
        text_align: p("text_align"),
        slide_number: p("slide_number"),
      };
    },
  },
};
</script>

<style scoped>
.se-popup-fade-enter-active,
.se-popup-fade-leave-active {
  transition: opacity 0.4s ease;
}
.se-popup-fade-enter-from,
.se-popup-fade-leave-to {
  opacity: 0;
}
</style>
