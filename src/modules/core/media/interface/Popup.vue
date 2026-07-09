<template>
  <l-slide
    v-if="slide"
    :slide_number="config.slide_index"
    :cover="slide.cover == true"
    :text="slide.lyric"
    :aux_text="slide.aux_lyric"
    :image="slide.url_image ? $path.file(slide.url_image) : null"
    :image_position="slide.image_position"
  />
</template>

<script>
import manifest from "../manifest.json";

import LSlide from "@/components/Slide.vue";

export default {
  name: "PopupMediaPage",
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
    config() {
      return this.$media.config();
    },
    slide_index() {
      return this.config.slide_index;
    },
    // Só projeta enquanto a música estiver realmente ativa (aberta ou minimizada).
    // close()/endSong() mantêm modules.media.data intacto de propósito, então sem
    // esse guard a projeção continuaria exibindo o último slide indefinidamente.
    isActive() {
      return !!this.$appdata.get("modules.media.show") || !!this.$appdata.get("modules.media.minimized");
    },
    slide() {
      return this.isActive ? this.$media.slide() : null;
    },
  },
};
</script>
