<template>
  <v-bottom-sheet class="ct-bottom-sheet">
    <template v-slot:activator="{ props: activatorProps }">
      <v-btn
        class="ms-2"
        icon="mdi-palette"
        variant="text"
        size="small"
        v-bind="activatorProps"
      />
    </template>

    <!-- elevation="0" tira a sombra do CARD, mas não bastava sozinho: o
         próprio v-bottom-sheet do Vuetify aplica UMA SOMBRA PRÓPRIA no seu
         wrapper (.v-bottom-sheet__content), que é sempre retangular
         (border-radius:0 fixo no CSS do Vuetify, sem herdar o "rounded"
         daqui) — removida no <style> não-scoped no fim do arquivo. Essa
         sombra reta "por trás" do canto arredondado do card é o que sobrava
         visível bem na ponta da curva, cortando reto onde devia acompanhar
         o arredondado. -->
    <v-card rounded="t-xl" elevation="0" class="overflow-hidden">
      <slot />
    </v-card>
  </v-bottom-sheet>
</template>

<script>
export default {
  name: "CustomizationBarComponent",
};
</script>

<style>
/* Sem "scoped" de propósito: o conteúdo do v-bottom-sheet é teleportado
   pelo Vuetify pra fora da árvore deste componente (pra .v-overlay-container
   no fim do body) — o atributo data-v-xxx do scoped CSS não chega nele
   (a classe "ct-bottom-sheet" chega via prop normalmente, mas sem o
   atributo de escopo o seletor :deep() nunca bate). Selector já é
   específico o bastante (classe própria) pra não vazar em outros
   v-bottom-sheet do app. */
.ct-bottom-sheet .v-overlay__content {
  box-shadow: none !important;
}
</style>
