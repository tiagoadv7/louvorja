<template>
  <v-menu v-model="menu" :close-on-content-click="false" location="bottom start">
    <template v-slot:activator="{ props }">
      <button type="button" class="csw-trigger" v-bind="props" :title="modelValue || ''">
        <span class="csw-trigger__swatch" :style="{ background: modelValue || '#000000' }" />
      </button>
    </template>

    <!-- Fileira de cores pré-definidas + um círculo tracejado pra "mais
         cores" (abre o seletor nativo do SO) — mesmo padrão do
         pianolouvorja/app (github.com/pianolouvorja/app), sem mudar o
         layout existente da barra: só o que aparece ao clicar é novo. -->
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
        <label class="csw-custom" title="Mais cores">
          <v-icon size="16">mdi-eyedropper-variant</v-icon>
          <input type="color" :value="modelValue || '#000000'" @input="onCustomInput" />
        </label>
      </div>
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
  data: () => ({ menu: false }),
  methods: {
    isActive(preset) {
      return (this.modelValue || "").toLowerCase() === preset.toLowerCase();
    },
    select(preset) {
      this.$emit("update:modelValue", preset);
    },
    onCustomInput(event) {
      this.$emit("update:modelValue", event.target.value);
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
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px dashed rgba(128, 128, 128, 0.4);
  cursor: pointer;
  opacity: 0.8;
}
.csw-custom:hover {
  opacity: 1;
  border-color: rgb(var(--v-theme-primary));
}
.csw-custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
