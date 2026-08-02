<template>
  <div v-if="import_modules">
    <component
      v-for="module in modules"
      :key="module.id"
      :is="loadModuleComponent(module)"
    />
  </div>
</template>

<script>
import { defineAsyncComponent } from "vue";

export default {
  name: "ModulesLayout",
  computed: {
    modules() {
      // Filtra entradas como "modules.web_link" (usada pelo WebLink.js só
      // como storage de config, sem passar pelo ModuleManager) — essas não
      // têm "id" e não correspondem a um diretório real em @/modules/*,
      // então tentar importá-las quebra o import dinâmico.
      return Object.fromEntries(
        Object.entries(this.$modules.get() || {}).filter(([, module]) => module?.id)
      );
    },
    import_modules() {
      return this.$appdata.get("import_modules");
    },
  },
  methods: {
    loadModuleComponent(module) {
      return defineAsyncComponent(() => {
        // Try to load from modules interface directory
        return import(`@/modules/core/${module.id}/interface/Index.vue`).catch(
          () => {
            // Try to load from CUSTOM module interface directory
            return import(`@/modules/${module.id}/interface/Index.vue`).catch((e) => {
              this.$alert.error({
                text: "messages.error_import_module",
                error: e,
              });

              return null
            });
          }
        );
      });
    },
  },
};
</script>
