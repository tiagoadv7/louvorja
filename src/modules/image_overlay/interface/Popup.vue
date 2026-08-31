<template>
  <transition name="io-fade">
    <div v-if="isActive && userdata.image" class="io-stage">
      <img :src="userdata.image" :style="imageStyle" />
    </div>
  </transition>
</template>

<script>
import manifest from "../manifest.json";

export default {
  name: "PopupImageOverlayPage",
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
    // Diferente dos outros módulos, este NÃO precisa ser o popup_module ativo
    // — ele é montado incondicionalmente por cima da projeção em
    // views/Popup.vue (ver ImageOverlayLayer ali) e só depende do painel do
    // operador estar aberto/minimizado, exatamente como um overlay do
    // FreeShow: sobrepõe o que já está sendo exibido, sem substituir.
    isActive() {
      return !!this.$appdata.get(`modules.${this.module_id}.show`) || !!this.$appdata.get(`modules.${this.module_id}.minimized`);
    },
    userdata() {
      const g = (key, ifnull = null) => this.$userdata.get(`modules.${this.module_id}.${key}`, ifnull);
      return {
        image: g("image", ""),
        image_opacity: g("image_opacity", 100),
        image_fit: g("image_fit", "contain"),
        pos_x: g("pos_x", 25),
        pos_y: g("pos_y", 25),
        pos_w: g("pos_w", 50),
        pos_h: g("pos_h", 50),
      };
    },
    imageStyle() {
      return {
        position: "absolute",
        left: `${this.userdata.pos_x}%`,
        top: `${this.userdata.pos_y}%`,
        width: `${this.userdata.pos_w}%`,
        height: `${this.userdata.pos_h}%`,
        objectFit: this.userdata.image_fit,
        opacity: this.userdata.image_opacity / 100,
      };
    },
  },
};
</script>

<style scoped>
/* pointer-events:none — camada puramente visual; nunca deve roubar cliques
   nem o foco de teclado (ESC etc.) do conteúdo que está por baixo dela em
   views/Popup.vue. */
.io-stage {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}
.io-fade-enter-active,
.io-fade-leave-active {
  transition: opacity 0.4s ease;
}
.io-fade-enter-from,
.io-fade-leave-to {
  opacity: 0;
}
</style>
