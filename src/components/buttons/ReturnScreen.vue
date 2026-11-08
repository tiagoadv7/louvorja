<template>
  <v-btn-group v-if="is_desktop" variant="text" style="overflow: clip;">
    <v-tooltip location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn
          v-bind="props"
          :size="size"
          :active="is_selected || in_multiview"
          :color="is_selected || in_multiview ? 'success' : undefined"
          :icon="in_multiview && !is_selected ? 'mdi-view-grid-outline' : 'mdi-monitor-share'"
          @click="toggle()"
        />
      </template>
      {{ in_multiview && !is_selected ? $t("popup.return_multiview_on") : is_selected ? $t("popup.return_remove") : $t("popup.return_send") }}
    </v-tooltip>

    <!-- Multiviewer (helpers/Layers.js): este módulo aparece JUNTO com os
         outros no retorno (letra + relógio + Bíblia...), em mosaico. -->
    <v-menu location="bottom end">
      <template #activator="{ props }">
        <v-btn v-bind="props" :size="size" icon="mdi-chevron-down" density="compact" />
      </template>
      <v-list density="compact" min-width="260">
        <v-list-item @click="toggleMultiview()">
          <template #prepend>
            <v-icon :color="in_multiview ? 'success' : undefined">
              {{ in_multiview ? "mdi-checkbox-marked" : "mdi-checkbox-blank-outline" }}
            </v-icon>
          </template>
          <v-list-item-title>{{ $t("popup.return_multiview") }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t("popup.return_multiview_hint") }}</v-list-item-subtitle>
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
    return_popup_module() {
      return this.$appdata.get("return_popup_module");
    },
    is_selected() {
      return this.return_popup_module === this.module;
    },
    in_multiview() {
      return (this.$appdata.get("return_multiview") || []).includes(this.module);
    },
  },
  methods: {
    async toggle() {
      // No multiviewer: o clique principal tira ele de lá
      if (this.in_multiview && !this.is_selected) {
        $layers.removeFromMultiview(this.module);
        this.$electron.invalidateOutput();
        return;
      }
      if (this.is_selected) {
        this.$appdata.set("return_popup_module", "");
        this.$electron.invalidateOutput();
        return;
      }
      this.$appdata.set("return_popup_module", this.module);
      await this.ensureReturnOpen();
    },
    async toggleMultiview() {
      const adding = !this.in_multiview;
      $layers.toggleMultiview(this.module);
      if (adding) await this.ensureReturnOpen();
      else this.$electron.invalidateOutput();
    },
    async ensureReturnOpen() {
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
