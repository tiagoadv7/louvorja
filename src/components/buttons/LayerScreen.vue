<template>
  <!-- Projetar JUNTO com o que já está na tela (helpers/Layers.js): o módulo
       entra por cima (Sobrepor) ou ao lado (Dividir a tela), sem trocar a
       música/slide que está projetado. -->
  <v-menu v-if="is_desktop" location="bottom end" :close-on-content-click="true">
    <template #activator="{ props: menuProps }">
      <v-tooltip location="bottom">
        <template #activator="{ props: tipProps }">
          <v-btn
            v-bind="{ ...menuProps, ...tipProps }"
            :size="size"
            :active="!!mode"
            :color="mode ? 'success' : undefined"
            :icon="mode === 'share' ? 'mdi-view-split-vertical' : 'mdi-layers-outline'"
          />
        </template>
        {{ mode ? $t(mode === "share" ? "popup.layer_on_share" : "popup.layer_on_overlay") : $t("popup.layer_title") }}
      </v-tooltip>
    </template>

    <v-list density="compact" class="lja-layer-menu" min-width="250">
      <v-list-subheader>{{ $t("popup.layer_title") }}</v-list-subheader>
      <v-list-item
        prepend-icon="mdi-layers-outline"
        :active="mode === 'overlay'"
        @click="choose('overlay')"
      >
        <v-list-item-title>{{ $t("popup.layer_overlay") }}</v-list-item-title>
        <v-list-item-subtitle>{{ $t("popup.layer_overlay_hint") }}</v-list-item-subtitle>
      </v-list-item>
      <v-list-item
        prepend-icon="mdi-view-split-vertical"
        :active="mode === 'share'"
        @click="choose('share')"
      >
        <v-list-item-title>{{ $t("popup.layer_share") }}</v-list-item-title>
        <v-list-item-subtitle>{{ $t("popup.layer_share_hint") }}</v-list-item-subtitle>
      </v-list-item>
      <v-list-item v-if="mode" prepend-icon="mdi-close" @click="choose(null)">
        <v-list-item-title>{{ $t("popup.layer_off") }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>
import $layers from "@/helpers/Layers";

export default {
  name: "ButtonLayerScreenComponent",
  props: {
    module: { type: String, required: true },
    size: { type: String, default: "small" },
  },
  computed: {
    is_desktop() {
      return this.$appdata.get("is_desktop");
    },
    mode() {
      return (this.$appdata.get("projection_layers") || {})[this.module] || null;
    },
  },
  methods: {
    async choose(mode) {
      if (!mode || mode === this.mode) {
        $layers.clearLayer(this.module);
        return;
      }
      const popupOpen = !!this.$appdata.get("popup");
      const popupModule = this.$appdata.get("popup_module");
      // Nada projetado ainda: não há "por cima" nem "ao lado" — projeta normal.
      if (!popupOpen || !popupModule) {
        $layers.clearLayer(this.module);
        await this.$popup.open(this.module);
        return;
      }
      // Já é o próprio principal: só vira camada se outra coisa for o principal
      if (popupModule === this.module) return;
      $layers.setLayer(this.module, mode);
    },
  },
};
</script>
