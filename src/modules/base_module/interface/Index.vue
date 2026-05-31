<template>
  <ModuleContainer ref="moduleContainer" :manifest="manifest">
    Módulo Base
  </ModuleContainer>
</template>

<script setup>
/* ########################################################### */
/* ####### INSTALAÇÃO DO MODULO ############################## */
/* ########################################################### */
import { ref, computed } from "vue";
import manifest from "../manifest.json";
import ModuleContainer from "@/components/ModuleContainer.vue";
const moduleContainer = ref(null);
const t = (key) => {
  if (!moduleContainer.value) {
    const tr = manifest.translations?.['pt'];
    if (tr) {
      const val = key.split('.').reduce((obj, k) => obj?.[k], tr);
      if (typeof val === 'string') return val;
    }
    return key;
  }
  const result = moduleContainer.value.t(key);
  return (result && result !== `modules.${manifest.id}.${key}`) ? result : key;
};
const userdata = computed(() => {
  return moduleContainer.value?.userdata;
});
const appdata = computed(() => {
  return moduleContainer.value?.appdata;
});
/* ########################################################### */
/* ########################################################### */
/* ########################################################### */
</script>
