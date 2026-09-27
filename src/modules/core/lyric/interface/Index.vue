<template>
  <Window
    v-model="module.show"
    :title="config?.title"
    :subtitle="
      config?.subtitle +
      (config?.track > 0 ? ' | ' + t('track') + ' ' + config.track : '')
    "
    :image="config?.image ? $path.file(config.image) : ''"
    closable
    size="small"
    @close="$media.closeLyric()"
  >
    <v-skeleton-loader v-if="module.loading" type="text@5" />
    <div v-else>
      <div v-for="line in lyric" :key="line.id_lyric">
        <b v-if="line.aux_lyric">{{ line.aux_lyric }}</b>
        {{ line.lyric }}&nbsp;
      </div>
    </div>
  </Window>
</template>

<script>
import manifest from "../manifest.json";

import Window from "@/components/Window.vue";

export default {
  name: "LyricModule",
  components: {
    Window,
  },
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
    config() {
      return this.module?.config;
    },
    lyric() {
      // A API online expõe o campo como `lyric`; o leitor SQLite offline expõe o
      // mesmo conteúdo como `slides` (mesmo fallback que Media.js::slides() já usa) —
      // sem isso, a janela "Letra" abre vazia sempre que os dados vêm do modo offline.
      const data = this.module?.data;
      const arr = Object.values(data?.lyric || data?.slides || {});
      return arr.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },
  },
  methods: {
    /* METHODS OBRIGATÓRIOS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      const key = `modules.${this.module_id}.${text}`;
      const result = this.$t(key);
      if (result === key) {
        if (text === 'title') return manifest.name || result;
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
        const storedManifest = this.$appdata.get(`modules.${this.module_id}.manifest`);
        const translations = storedManifest?.translations?.[locale] || storedManifest?.translations?.['pt'];
        if (translations) {
          const val = text.split('.').reduce((obj, k) => obj?.[k], translations);
          if (typeof val === 'string') return val;
        }
      }
      return result;
    },
    /* METHODS OBRIGATÓRIOS - FIM */
  },
};
</script>
