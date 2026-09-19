<template>
  <v-menu v-model="menu" :close-on-content-click="false" location="bottom start">
    <template v-slot:activator="{ props }">
      <button type="button" class="abg-picker-trigger" v-bind="props">
        <span class="abg-picker-trigger__thumb">
          <AnimatedBackground v-if="modelValue !== 'none'" :variant="modelValue" :color="color" />
          <v-icon v-else size="14" style="opacity: 0.4">mdi-block-helper</v-icon>
        </span>
        <span class="abg-picker-trigger__label">{{ currentLabel }}</span>
        <v-icon size="18" class="abg-picker-trigger__chevron">mdi-menu-down</v-icon>
      </button>
    </template>

    <!-- Galeria com prévia ao vivo de cada efeito — poder VER como fica antes
         de escolher, em vez de um <select> só com nomes de texto (inspirado
         na página de coleção de efeitos do Slider Revolution, referenciada
         pelo usuário). -->
    <v-card class="abg-picker-grid pa-2">
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="abg-picker-card"
        :class="{ 'abg-picker-card--active': modelValue === opt.value }"
        @click="select(opt.value)"
      >
        <span class="abg-picker-card__thumb">
          <AnimatedBackground v-if="opt.value !== 'none'" :variant="opt.value" :color="color" />
          <v-icon v-else size="22" style="opacity: 0.35">mdi-block-helper</v-icon>
        </span>
        <span class="abg-picker-card__label">{{ opt.label }}</span>
      </button>
    </v-card>
  </v-menu>
</template>

<script>
import AnimatedBackground from "@/components/AnimatedBackground.vue";

export default {
  name: "AnimatedBgPicker",
  components: { AnimatedBackground },
  props: {
    modelValue: { type: String, default: "none" },
    // Cor atual do efeito (campo "Cor do Fundo Animado" irmão) — usada só
    // pra tingir as prévias ao vivo, igual ao que vai aparecer de verdade.
    color: { type: String, default: "#7aa0ff" },
    options: { type: Array, required: true }, // [{ label, value }]
  },
  emits: ["update:modelValue"],
  data: () => ({ menu: false }),
  computed: {
    currentLabel() {
      return this.options.find((o) => o.value === this.modelValue)?.label || "";
    },
  },
  methods: {
    select(value) {
      this.$emit("update:modelValue", value);
      this.menu = false;
    },
  },
};
</script>

<style scoped>
.abg-picker-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 40px;
  padding: 0 10px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.abg-picker-trigger:hover {
  border-color: rgb(var(--v-theme-primary));
}
.abg-picker-trigger__thumb {
  position: relative;
  flex: 0 0 auto;
  width: 26px;
  height: 20px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(128, 128, 128, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}
.abg-picker-trigger__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  font-size: 13px;
}
.abg-picker-trigger__chevron {
  flex: 0 0 auto;
  opacity: 0.6;
}

.abg-picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: 264px;
}
.abg-picker-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border: 2px solid transparent;
  border-radius: 8px;
  background: rgba(128, 128, 128, 0.06);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.abg-picker-card:hover {
  background: rgba(128, 128, 128, 0.14);
}
.abg-picker-card--active {
  border-color: rgb(var(--v-theme-primary));
}
.abg-picker-card__thumb {
  position: relative;
  width: 100%;
  height: 46px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(128, 128, 128, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}
.abg-picker-card__label {
  font-size: 10px;
  text-align: center;
  line-height: 1.2;
  opacity: 0.85;
}
</style>
