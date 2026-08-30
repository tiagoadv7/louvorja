<template>
  <transition name="it-popup-fade">
    <div v-if="isActive && html" class="it-stage" :style="stageStyle">
      <img v-if="userdata.image" :src="userdata.image" class="it-bg-image" :style="bgImageStyle" />
      <div class="it-content" v-html="html" />
    </div>
  </transition>
</template>

<script>
import manifest from "../manifest.json";

export default {
  name: "PopupInteractiveTextPage",
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
    html() {
      return this.$appdata.get(`modules.${this.module_id}.html`);
    },
    // Fundo (cor/imagem/opacidade/ajuste) — mesmo mecanismo de customização
    // genérico dos outros módulos, lido direto de $userdata (ver
    // dynamic_text/interface/Popup.vue para a mesma explicação).
    userdata() {
      const g = (key, ifnull = null) => this.$userdata.get(`modules.${this.module_id}.${key}`, ifnull);
      return {
        background_color: g("background_color", "#000000"),
        image: g("image", ""),
        image_opacity: g("image_opacity", 100),
        image_fit: g("image_fit", "cover"),
      };
    },
    stageStyle() {
      return { background: this.userdata.background_color };
    },
    bgImageStyle() {
      return {
        objectFit: this.userdata.image_fit,
        opacity: this.userdata.image_opacity / 100,
      };
    },
  },
};
</script>

<style scoped>
.it-stage {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vw;
  overflow: hidden;
}
.it-bg-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.it-content {
  position: relative;
  color: #fff;
  font-family: Tahoma, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  max-width: 100%;
  max-height: 100%;
  overflow: hidden;
  text-shadow:
    0 2px 12px rgba(0, 0, 0, 0.9),
    0 0 40px rgba(0, 0, 0, 0.6);
}
.it-popup-fade-enter-active,
.it-popup-fade-leave-active {
  transition: opacity 0.4s ease;
}
.it-popup-fade-enter-from,
.it-popup-fade-leave-to {
  opacity: 0;
}
</style>
