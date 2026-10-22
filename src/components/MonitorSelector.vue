<template>
  <v-tooltip v-if="is_desktop" location="bottom">
    <template v-slot:activator="{ props }">
      <v-btn v-bind="props" icon="mdi-monitor-multiple" @click="dialogOpen = true" />
    </template>
    Tela de Projeção
  </v-tooltip>

  <!-- Clicar no botão já abre a Tela de Projeção direto -- antes passava por
       um v-menu intermediário (cards de saída/retorno + os itens "Tela de
       Projeção"/"Identificar monitores"), que virou tudo isso agora junto
       dentro do próprio diálogo (ver MonitorArrangementDialog.vue). Uma
       janela só, em vez de menu + diálogo separados. -->
  <MonitorArrangementDialog v-if="is_desktop" v-model="dialogOpen" />
</template>

<script>
import MonitorArrangementDialog from "@/components/MonitorArrangementDialog.vue";

export default {
  name: 'MonitorSelectorComponent',
  components: { MonitorArrangementDialog },
  data: () => ({
    dialogOpen: false,
  }),
  computed: {
    is_desktop() {
      return this.$appdata.get('is_desktop');
    },
  },
};
</script>
