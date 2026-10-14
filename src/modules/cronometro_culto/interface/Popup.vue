<template>
  <StopwatchScreen v-if="activeTab === 'avulso'" />
  <Screen v-else />
</template>

<script>
import manifest from "../manifest.json";

import Screen from "../components/Screen.vue";
import StopwatchScreen from "../components/StopwatchScreen.vue";

export default {
  name: "PopupScreenPage",
  components: {
    Screen,
    StopwatchScreen,
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
    // Qual das duas abas projetar — mesma aba selecionada no painel do
    // operador (ver Index.vue#activeTab), sincronizada via appdata como no
    // módulo Sorteio (modules/sorteio/interface/Popup.vue#isRoulette).
    activeTab() {
      return this.$appdata.get(`modules.${this.module_id}.active_tab`) || "culto";
    },
  },
};
</script>
