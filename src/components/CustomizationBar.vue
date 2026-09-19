<template>
  <v-bottom-sheet>
    <template v-slot:activator="{ props: activatorProps }">
      <v-btn
        class="ms-2"
        icon="mdi-palette"
        variant="text"
        size="small"
        v-bind="activatorProps"
      />
    </template>

    <!-- elevation="0": a sombra padrão do v-card (multi-camada, com spread)
         não acompanhava direito o border-radius grande dos cantos de cima
         (rounded="t-xl") — sobrava um resquício quadrado/duro bem na ponta
         do canto arredondado, em vez de ficar transparente/suave como o
         resto da curva. Sem sombra nenhuma, o canto fica limpo — a barra já
         fica visualmente separada do resto da tela pelo scrim do próprio
         v-bottom-sheet, não precisa de elevação extra pra isso. -->
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
