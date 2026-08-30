<template>
  <v-btn-group
    v-if="!is_mobile"
    :variant="variant"
    style="overflow: clip;"
  >
    <v-btn
      :size="size"
      :active="is_selected"
      icon="mdi-open-in-new"
      :class="{ 'rotate-icon': is_selected }"
      @click="popup()"
    />

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
const CONFIRM_BEFORE_REPLACE = ["bible", "clock", "stopwatch", "sorteio", "cronometro_culto"];

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
  },
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
    popup() {
      if (this.is_selected) {
        this.$popup.close();
        return;
      }
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
