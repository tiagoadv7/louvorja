<template>
  <transition name="dt-fade">
    <div v-if="isActive && data.text" class="dt-stage" :style="stageStyle">
      <img v-if="userdata.image" :src="userdata.image" class="dt-bg-image" :style="bgImageStyle" />
      <div class="dt-text" :style="textStyle">{{ data.text }}</div>
    </div>
  </transition>
</template>

<script>
import manifest from "../manifest.json";

export default {
  name: "PopupDynamicTextPage",
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
    // Popup.vue. Fechar o painel (show=false, minimized=false) deixa só a
    // janela transparente, sem precisar mexer em popup_module/$popup.
    isActive() {
      return !!this.$appdata.get(`modules.${this.module_id}.show`) || !!this.$appdata.get(`modules.${this.module_id}.minimized`);
    },
    // Fundo (cor/imagem/opacidade/ajuste) — mesmo mecanismo de customização
    // genérico dos outros módulos (ver CustomizationTools.vue), lido direto
    // de $userdata: não precisa de broadcast próprio, a janela de saída já
    // carrega o userdata inteiro ao montar (ver views/Popup.vue#initElectron).
    userdata() {
      const g = (key, ifnull = null) => this.$userdata.get(`modules.${this.module_id}.${key}`, ifnull);
      return {
        background_color: g("background_color", "#000000"),
        image: g("image", ""),
        image_opacity: g("image_opacity", 100),
        image_fit: g("image_fit", "cover"),
      };
    },
    data() {
      const p = (key) => this.$appdata.get(`modules.${this.module_id}.${key}`);
      return {
        text: p("text"),
        font: p("font") || "Arial, sans-serif",
        font_size: p("font_size") || 12,
        color: p("color") || "#FFFFFF",
        text_align: p("text_align") || "center",
      };
    },
    stageStyle() {
      const align = this.data.text_align;
      return {
        background: this.userdata.background_color,
        justifyContent: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
      };
    },
    bgImageStyle() {
      return {
        objectFit: this.userdata.image_fit,
        opacity: this.userdata.image_opacity / 100,
      };
    },
    textStyle() {
      return {
        fontFamily: this.data.font,
        fontSize: `clamp(24px, ${this.data.font_size}vh, 400px)`,
        color: this.data.color,
        textAlign: this.data.text_align,
      };
    },
  },
};
</script>

<style scoped>
.dt-stage {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 4vw;
  overflow: hidden;
}
.dt-bg-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.dt-text {
  position: relative;
  font-weight: 700;
  line-height: 1.2;
  max-width: 100%;
  text-shadow:
    0 2px 12px rgba(0, 0, 0, 0.9),
    0 0 40px rgba(0, 0, 0, 0.6);
}
.dt-fade-enter-active,
.dt-fade-leave-active {
  transition: opacity 0.4s ease;
}
.dt-fade-enter-from,
.dt-fade-leave-to {
  opacity: 0;
}
</style>
