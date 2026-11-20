<template>
  <!-- Retorno (monitor de palco): as mesmas opções da projeção principal
       (components/buttons/LayerScreen.vue) — Sobrepor (tela inteira no
       retorno, por cima do que ele espelharia) ou Dividir (entra no mosaico
       do multiviewer junto com a letra, o relógio, a Bíblia...). Estado em
       helpers/Layers.js (return_popup_module / return_multiview). -->
  <v-btn-group v-if="is_desktop" variant="text" style="overflow: clip;">
    <v-tooltip location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn
          v-bind="props"
          :size="size"
          :active="!!mode"
          :color="mode ? 'success' : undefined"
          :icon="mode === 'share' ? 'mdi-view-grid-outline' : 'mdi-monitor-share'"
          @click="toggle()"
        />
      </template>
      {{ mode === "share" ? $t("popup.return_on_share") : mode === "overlay" ? $t("popup.return_on_overlay") : $t("popup.return_send") }}
    </v-tooltip>

    <v-menu location="bottom end">
      <template #activator="{ props }">
        <v-btn v-bind="props" :size="size" icon="mdi-chevron-down" density="compact" />
      </template>
      <v-list density="compact" min-width="260">
        <v-list-subheader>{{ $t("popup.return_title") }}</v-list-subheader>
        <v-list-item prepend-icon="mdi-layers-outline" :active="mode === 'overlay'" @click="choose('overlay')">
          <v-list-item-title>{{ $t("popup.layer_overlay") }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t("popup.return_overlay_hint") }}</v-list-item-subtitle>
        </v-list-item>
        <v-list-item prepend-icon="mdi-view-grid-outline" :active="mode === 'share'" @click="choose('share')">
          <v-list-item-title>{{ $t("popup.layer_share") }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t("popup.return_share_hint") }}</v-list-item-subtitle>
        </v-list-item>
        <v-list-item v-if="mode" prepend-icon="mdi-close" @click="choose(null)">
          <v-list-item-title>{{ $t("popup.return_remove") }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-btn-group>
</template>

<script>
import $layers from "@/helpers/Layers";

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
    // Lido direto do appdata (reativo) — mesma regra de $layers.returnMode
    mode() {
      if (this.$appdata.get("return_popup_module") === this.module) return "overlay";
      if ((this.$appdata.get("return_multiview") || []).includes(this.module)) return "share";
      return null;
    },
  },
  methods: {
    // Clique no ícone: liga em "Sobrepor" (o jeito de sempre) ou desliga
    toggle() {
      return this.choose(this.mode ? null : "overlay");
    },
    async choose(mode) {
      if (mode === this.mode) mode = null;
      $layers.setReturnMode(this.module, mode);
      if (mode) await this.ensureReturnOpen();
      else this.$electron.invalidateOutput();
    },
    async ensureReturnOpen() {
      if (!this.$electron.isElectron()) return;
      const isOpen = await this.$electron.isReturnScreenOpen();
      if (isOpen) {
        // Retorno já aberto: só o conteúdo dele muda (sem criar/mostrar
        // janela nenhuma) — mesmo assim isso pode disparar o bug de janela
        // transparente renderizando preto na saída principal (ver
        // preload.js#invalidateOutput).
        this.$electron.invalidateOutput();
        return;
      }
      const displayId = await this.$electron.storeGet("return_display_id");
      await this.$electron.openReturnScreen(displayId || undefined);
    },
  },
};
</script>
