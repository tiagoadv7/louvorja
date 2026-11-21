<template>
  <!-- Modo "combinado" (módulos com Abrir em janela — ver components/Window.vue
       prop projectModule): UM botão só, o de abrir em janela, com um menu
       Projetar / Abrir em janela — em vez de dois botões parecidos lado a lado. -->
  <v-menu v-if="combined && !is_mobile" location="bottom end">
    <template #activator="{ props: menuProps }">
      <v-tooltip location="bottom">
        <template #activator="{ props: tipProps }">
          <v-btn
            v-bind="{ ...menuProps, ...tipProps }"
            :class="btnClass"
            :icon="layer_mode === 'share' ? 'mdi-view-split-vertical' : 'mdi-open-in-new'"
            variant="text"
            size="small"
            :active="is_selected"
            :color="is_selected ? 'success' : undefined"
          />
        </template>
        {{ layer_mode ? $t(layer_mode === "share" ? "popup.layer_on_share" : "popup.layer_on_overlay") : is_selected ? $t("popup.project_on") : $t("popup.project_or_window") }}
      </v-tooltip>
    </template>
    <v-list density="compact" min-width="240">
      <v-list-item
        :prepend-icon="is_selected ? 'mdi-close-box-outline' : 'mdi-open-in-new'"
        @click="popup()"
      >
        <v-list-item-title>{{ is_selected ? $t("popup.project_stop") : $t("popup.project") }}</v-list-item-title>
        <v-list-item-subtitle>{{ other_projected && !is_selected ? $t("popup.layer_overlay_hint") : $t("popup.project_hint") }}</v-list-item-subtitle>
      </v-list-item>
      <!-- Outra coisa já projetada: também dá para dividir a tela com ela -->
      <v-list-item
        v-if="other_projected && layer_mode !== 'share'"
        prepend-icon="mdi-view-split-vertical"
        @click="setLayer('share')"
      >
        <v-list-item-title>{{ $t("popup.layer_share") }}</v-list-item-title>
        <v-list-item-subtitle>{{ $t("popup.layer_share_hint") }}</v-list-item-subtitle>
      </v-list-item>
      <v-list-item prepend-icon="mdi-layers-outline" @click="$emit('open-window')">
        <v-list-item-title>{{ $t("components.window.open_in_window") }}</v-list-item-title>
        <v-list-item-subtitle>{{ $t("popup.window_hint") }}</v-list-item-subtitle>
      </v-list-item>
      <v-list-item v-if="is_popup_opened" prepend-icon="mdi-close" @click="close">
        <v-list-item-title>{{ $t("popup.close") }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>

  <v-btn-group
    v-else-if="!is_mobile"
    :variant="variant"
    style="overflow: clip;"
  >
    <!-- Padrão de sempre (Slides, Coletâneas, Bíblia, Vídeo...): ícone ↗ que
         gira quando está projetando. Os módulos que também têm "Abrir em
         janela" usam o modo combinado acima, então não fica duplicado. -->
    <v-tooltip location="bottom">
      <template #activator="{ props: tipProps }">
        <v-btn
          v-bind="tipProps"
          :size="size"
          :active="is_selected"
          icon="mdi-open-in-new"
          :class="{ 'rotate-icon': is_selected }"
          @click="popup()"
        />
      </template>
      {{ is_selected ? $t("popup.project_stop") : $t("popup.project") }}
    </v-tooltip>

    <v-menu v-if="is_popup_opened" location="bottom">
      <template #activator="{ props }">
        <v-btn v-bind="props" :size="size" icon="mdi-chevron-down" density="compact" />
      </template>

      <v-list density="compact">
        <v-list-item @click="close">
          <v-list-item-title>{{ $t("popup.close") }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-btn-group>
</template>

<script>
import $layers from "@/helpers/Layers";

// Módulos auxiliares (não são conteúdo principal do culto) — com outra coisa
// já projetada (ex.: uma música), eles entram por cima como camada em vez de
// substituir (antes perguntava "Substituir...?"). Vídeo fica de fora: é
// conteúdo trocado com frequência durante o culto.
const OVERLAY_INSTEAD_OF_REPLACE = ["bible", "clock", "sorteio", "cronometro_culto", "dynamic_text", "interactive_text"];

export default {
  name: "ButtonScreenComponent",
  props: {
    module: {
      type: String,
      required: true,
    },
    size: {
      type: String,
      default: "small",
    },
    variant: {
      type: String,
      default: "text",
    },
    // Um botão só (abrir em janela + projetar) — ver template
    combined: Boolean,
    btnClass: { type: [String, Array, Object], default: "" },
  },
  emits: ["open-window"],
  computed: {
    is_mobile() {
      return this.$appdata.get("is_mobile");
    },
    is_popup_opened() {
      return !!this.$appdata.get("popup");
    },
    popup_module() {
      return this.$appdata.get("popup_module");
    },
    // Projetado como principal OU como camada por cima/ao lado
    is_selected() {
      return (this.is_popup_opened && this.popup_module == this.module) || !!this.layer_mode;
    },
    layer_mode() {
      return (this.$appdata.get("projection_layers") || {})[this.module] || null;
    },
    other_projected() {
      return this.is_popup_opened && !!this.popup_module && this.popup_module !== this.module;
    },
  },
  methods: {
    // Vídeo e o link do YouTube (Online) têm fade próprio de áudio+visual
    // (ver stop() em helpers/VideoPlayer.js e helpers/WebLink.js) — sem
    // chamar isso ANTES do $popup.close() abaixo, o áudio continuava tocando
    // em volume cheio por baixo do crossfade visual da janela de saída
    // (~1s, ver views/Popup.vue) e cortava de repente só quando o elemento
    // era desmontado, em vez de esmaecer junto com a imagem. Outros módulos
    // (Bíblia, Relógio, Sorteio...) não têm áudio próprio — não precisam
    // disso.
    // Vídeo local e link do YouTube NÃO param ao sair da projeção: seguem
    // tocando na janela principal (VideoLocalPlayer.vue / WebLinkLocalPlayer.vue)
    // e no miniplayer, e a projeção esmaece sozinha (Popup.vue / WebLinkFrame.vue).
    popup() {
      // Está como camada: clicar de novo tira só a camada (o principal fica)
      if (this.layer_mode) {
        $layers.clearLayer(this.module);
        return;
      }
      if (this.is_selected) {
        if (this.module === "video_player") this.$videoPlayer.detachFromOutput();
        this.$popup.close();
        return;
      }
      if (this.module === "video_player") this.$videoPlayer.attachToOutput();
      // Já tem outra coisa projetada e este é um módulo auxiliar: em vez de
      // perguntar se quer substituir, entra POR CIMA como camada (Sobrepor) —
      // o que estava projetado continua por baixo e volta ao tirar a camada.
      if (this.other_projected && OVERLAY_INSTEAD_OF_REPLACE.includes(this.module)) {
        $layers.setLayer(this.module, "overlay");
        return;
      }
      this.$popup.open(this.module);
    },
    async setLayer(mode) {
      if (!this.other_projected) {
        await this.$popup.open(this.module);
        return;
      }
      $layers.setLayer(this.module, mode);
    },
    // Item "Fechar" do menu — diferente do clique no ícone (desligamento
    // suave, mantém a janela viva), aqui é uma ação explícita de encerrar a
    // janela de saída de vez.
    close() {
      this.$popup.shutdown();
    },
  },
};
</script>

<style scoped>
.rotate-icon {
  transform: rotate(180deg);
  transition: transform 0.3s ease;
}
</style>
