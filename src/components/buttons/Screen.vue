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
            icon="mdi-open-in-new"
            variant="text"
            size="small"
            :active="is_selected"
            :color="is_selected ? 'success' : undefined"
          />
        </template>
        {{ is_selected ? $t("popup.project_on") : $t("popup.project_or_window") }}
      </v-tooltip>
    </template>
    <v-list density="compact" min-width="240">
      <v-list-item
        :prepend-icon="is_selected ? 'mdi-projector-screen-off-outline' : 'mdi-projector-screen-outline'"
        @click="popup()"
      >
        <v-list-item-title>{{ is_selected ? $t("popup.project_stop") : $t("popup.project") }}</v-list-item-title>
        <v-list-item-subtitle>{{ $t("popup.project_hint") }}</v-list-item-subtitle>
      </v-list-item>
      <v-list-item prepend-icon="mdi-open-in-new" @click="$emit('open-window')">
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
// Módulos auxiliares (não são conteúdo principal do culto) — trocar pra eles
// na tela de projeção precisa de confirmação, pra não substituir o que já
// está sendo exibido (ex.: uma música) só por um clique sem querer. Vídeo
// fica de fora mesmo compartilhando a categoria "utilities" no manifest,
// porque é conteúdo trocado com frequência durante o culto.
const CONFIRM_BEFORE_REPLACE = ["bible", "clock", "sorteio", "cronometro_culto"];

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
    is_selected() {
      return this.is_popup_opened && this.popup_module == this.module;
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
      if (this.is_selected) {
        if (this.module === "video_player") this.$videoPlayer.detachFromOutput();
        this.$popup.close();
        return;
      }
      if (this.module === "video_player") this.$videoPlayer.attachToOutput();
      // Já tem outra coisa sendo exibida na projeção e o módulo pra onde
      // estamos indo é auxiliar (Bíblia/Relógio/Cronômetro/Sorteio) — confirma
      // antes de substituir, em vez de trocar na hora sem aviso.
      const isReplacingActiveProjection =
        this.is_popup_opened && this.popup_module && this.popup_module !== this.module;
      if (isReplacingActiveProjection && CONFIRM_BEFORE_REPLACE.includes(this.module)) {
        this.$alert.yesno(
          { text: "Substituir o que está sendo exibido na tela de projeção agora?", translate: false },
          (btn) => { if (btn === "yes") this.$popup.open(this.module); }
        );
        return;
      }
      this.$popup.open(this.module);
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
