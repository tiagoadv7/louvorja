<template>
  <v-menu v-model="menu" :close-on-content-click="false" location="bottom start">
    <template v-slot:activator="{ props }">
      <button type="button" class="csw-trigger" v-bind="props" :title="modelValue || ''">
        <span class="csw-trigger__swatch" :style="{ background: modelValue || '#000000' }" />
      </button>
    </template>

    <!-- Fileira de cores pré-definidas + um círculo tracejado pra "mais
         cores" (abre o seletor completo abaixo, ver v-color-picker) — mesmo
         padrão do pianolouvorja/app (github.com/pianolouvorja/app), sem
         mudar o layout existente da barra: só o que aparece ao clicar é
         novo. -->
    <v-card class="csw-panel pa-2">
      <div class="csw-swatches">
        <button
          v-for="preset in presets"
          :key="preset"
          type="button"
          class="csw-swatch"
          :class="{ 'csw-swatch--active': isActive(preset) }"
          :style="{ '--swatch': preset }"
          :title="preset"
          @click="select(preset)"
        />
        <button
          type="button"
          class="csw-custom"
          :class="{ 'csw-custom--active': showCustom }"
          title="Mais cores"
          @click="showCustom = !showCustom"
        >
          <v-icon size="16">mdi-eyedropper-variant</v-icon>
        </button>
      </div>

      <!-- Seletor completo (canvas + slider de matiz + campos RGB/hex +
           conta-gotas) — substitui o <input type="color"> nativo de
           propósito: o seletor do próprio SO/Chromium não é estilizável (não
           é DOM da página), então os cantos dele nunca ficavam arredondados
           iguais ao resto do app por mais CSS que se tentasse. O
           v-color-picker do Vuetify já usa a mesma UI (canvas, matiz, RGB,
           conta-gotas via EyeDropper API), só que como componente de verdade
           — herda o "rounded" abaixo normalmente. -->
      <v-color-picker
        v-if="showCustom"
        :model-value="modelValue || '#000000'"
        @update:model-value="onCustomInput"
        class="csw-picker mt-2"
        rounded="lg"
        elevation="0"
        width="220"
        mode="hex"
        :modes="['hex']"
        hide-alpha
      />
    </v-card>
  </v-menu>
</template>

<script>
// Paleta genérica (a mesma barra serve pra cor de fundo, de texto, de borda
// etc. em muitos módulos diferentes) — branco/preto universais + tons já
// usados como default em algum lugar do app (dourado/amarelo da marca,
// azul do fundo animado) + variedade, no espírito das paletas com nome do
// pianolouvorja/app (lá são específicas de palco/projeção; aqui é uma só
// paleta genérica, já que este componente é compartilhado por todo tipo de
// campo de cor do CustomizationTools).
const DEFAULT_PRESETS = [
  "#FFFFFF", "#000000", "#F6C32A", "#FDE047",
  "#7AA0FF", "#4ECDC4", "#FF6B6B", "#96CEB4",
];

export default {
  name: "ColorSwatchPicker",
  props: {
    modelValue: { type: String, default: "" },
    presets: { type: Array, default: () => DEFAULT_PRESETS },
  },
  emits: ["update:modelValue"],
  data: () => ({ menu: false, showCustom: false }),
  watch: {
    // Fecha o seletor completo ao reabrir o menu do zero, senão ele ficava
    // "grudado" aberto (aumentando o popover) mesmo pra quem só queria
    // clicar numa das cores pré-definidas da próxima vez.
    menu(open) {
      if (!open) this.showCustom = false;
    },
  },
  methods: {
    isActive(preset) {
      return (this.modelValue || "").toLowerCase() === preset.toLowerCase();
    },
    select(preset) {
      this.$emit("update:modelValue", preset);
    },
    onCustomInput(value) {
      this.$emit("update:modelValue", value);
    },
  },
};
</script>

<style scoped>
.csw-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 4px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.csw-trigger:hover {
  border-color: rgb(var(--v-theme-primary));
}
.csw-trigger__swatch {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  border: 1px solid rgba(128, 128, 128, 0.35);
}

.csw-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 176px;
}
.csw-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid rgba(128, 128, 128, 0.25);
  background: var(--swatch);
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.csw-swatch:hover {
  transform: scale(1.08);
}
.csw-swatch--active {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.25);
}
.csw-custom {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px dashed rgba(128, 128, 128, 0.4);
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.8;
}
.csw-custom:hover {
  opacity: 1;
  border-color: rgb(var(--v-theme-primary));
}
.csw-custom--active {
  opacity: 1;
  border-style: solid;
  border-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
}

/* v-color-picker completo (canvas + matiz + RGB/hex + conta-gotas) — troca
   o seletor nativo do SO (sem cantos arredondados, sem como estilizar) por
   um de verdade no DOM da página, então "rounded" aqui realmente funciona. */
.csw-picker {
  width: 220px;
}
</style>
