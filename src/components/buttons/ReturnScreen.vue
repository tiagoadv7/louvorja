<template>
  <v-tooltip v-if="is_desktop" location="bottom">
    <template v-slot:activator="{ props }">
      <v-btn
        v-bind="props"
        :size="size"
        :active="is_selected"
        :color="is_selected ? 'success' : undefined"
        icon="mdi-monitor-share"
        @click="toggle()"
      />
    </template>
    {{ is_selected ? "Remover do retorno" : "Enviar para o retorno" }}
  </v-tooltip>
</template>

<script>
export default {
  name: "ButtonReturnScreenComponent",
  props: {
    module: {
      type: String,
      required: true,
    },
    size: {
      type: String,
      default: "small",
    },
  },
  computed: {
    is_desktop() {
      return this.$appdata.get("is_desktop");
    },
    return_popup_module() {
      return this.$appdata.get("return_popup_module");
    },
    is_selected() {
      return this.return_popup_module === this.module;
    },
  },
  methods: {
    async toggle() {
      if (this.is_selected) {
        this.$appdata.set("return_popup_module", "");
        this.$electron.invalidateOutput();
        return;
      }
      this.$appdata.set("return_popup_module", this.module);
      if (!this.$electron.isElectron()) return;
      const isOpen = await this.$electron.isReturnScreenOpen();
      if (isOpen) {
        // Retorno já aberto: só o conteúdo dele muda (sem criar/mostrar
        // janela nenhuma) — mesmo assim isso pode disparar o bug de janela
        // transparente renderizando preto na saída principal (ver
        // preload.js#invalidateOutput). Sem isso, esse caminho específico
        // (retorno já ligado) nunca corrigia a saída sozinho.
        this.$electron.invalidateOutput();
        return;
      }
      const displayId = await this.$electron.storeGet("return_display_id");
      await this.$electron.openReturnScreen(displayId || undefined);
    },
  },
};
</script>
