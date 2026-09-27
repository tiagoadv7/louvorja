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
import { defineAsyncComponent, markRaw } from "vue";

export default {
  name: "ModulesLayout",
  created() {
    // Cache de componentes assíncronos por module.id — ver loadModuleComponent.
    // Fica FORA de data() (não reativo) de propósito: um objeto guardado em
    // data() vira um Proxy reativo do Vue ao ser lido de volta, e o :is="..."
    // do template compara o "type" resolvido por IDENTIDADE — se a leitura
    // devolvesse um Proxy diferente do que foi guardado, o cache não
    // resolveria o bug (ver loadModuleComponent).
    this._componentCache = {};
  },
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
    // Memoizado por module.id: cada chamada a defineAsyncComponent() cria um
    // objeto de definição NOVO, e o :is="..." do template compara por
    // IDENTIDADE — sem cache, qualquer alteração em modules (ex.: abrir ou
    // minimizar QUALQUER módulo, já que "modules" acima lê o objeto inteiro)
    // recomputa este método pra cada item do v-for, trocando o "is" de TODOS
    // os módulos por uma referência nova e forçando o Vue a desmontar e
    // remontar TODOS eles — mesmo os que não têm nada a ver com a mudança.
    // Isso já causava um bug real: minimizar um módulo qualquer (ex.
    // Liturgia) enquanto outro que tem áudio/vídeo próprio no componente
    // (ex. SoundMaster, dentro de video_player) está tocando fazia esse
    // outro remontar e cortar a reprodução na hora (beforeUnmount chamando
    // stopAllImmediate), mesmo sem esse módulo ter sido tocado.
    loadModuleComponent(module) {
      if (this._componentCache[module.id]) return this._componentCache[module.id];
      const component = defineAsyncComponent(() => {
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
      this._componentCache[module.id] = markRaw(component);
      return this._componentCache[module.id];
    },
  },
};
</script>
