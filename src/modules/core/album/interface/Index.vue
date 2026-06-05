<template>
  <Window
    v-model="module.show"
    :title="module?.data?.name"
    :image="module?.data?.url_image ? $path.file(module.data.url_image) : ''"
    closable
    compact
    title-class="text-h4 font-weight-light"
    :image-size="125"
    :color="module?.data?.color"
    @close="onClose()"
    slot-left-class="w-100"
  >
    <!-- Botão de download: abre o Centro de Downloads na seção Coletâneas -->
    <template v-slot:system_buttons>
      <v-tooltip location="bottom" :text="downloaded ? 'Disponível offline — ir ao Centro de Downloads' : 'Baixar álbum — Centro de Downloads'">
        <template v-slot:activator="{ props }">
          <v-btn
            v-bind="props"
            icon
            variant="text"
            size="small"
            :color="downloaded ? 'success' : 'white'"
            class="ms-1"
            @click="openDownloadCenter"
          >
            <v-icon size="20">
              {{ downloaded ? 'mdi-check-circle' : 'mdi-download-circle-outline' }}
            </v-icon>
          </v-btn>
        </template>
      </v-tooltip>
    </template>

    <template v-slot:left>
      <v-table
        v-if="!loading"
        fixed-header
        hover
        class="w-100 h-100"
        :style="{ backgroundColor: module.data.color, color: '#FFF' }"
      >
        <thead>
          <tr>
            <th
              class="text-right"
              :style="{ backgroundColor: module.data.color, color: '#FFF' }"
            >
              {{ t("table.track") }}
            </th>
            <th
              class="text-left"
              :style="{ backgroundColor: module.data.color, color: '#FFF' }"
            >
              {{ t("table.music_name") }}
            </th>
            <th
              class="text-right"
              :style="{ backgroundColor: module.data.color, color: '#FFF' }"
            >
              {{ t("table.duration") }}
            </th>
            <th
              :style="{ backgroundColor: module.data.color, color: '#FFF' }"
            />
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in module.data.musics" :key="item.id_music">
            <td class="text-right">
              {{ item.track }}
            </td>
            <td>{{ item.name }}</td>
            <td class="text-right">{{ $datetime.shortTime(item.duration) }}</td>
            <td>
              <div class="d-flex justify-end">
                <MusicMenuTable
                  color="#FFF"
                  :id_music="item.id_music"
                  :has_instrumental_music="item.has_instrumental_music"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </v-table>

      <v-progress-linear v-if="loading" color="white" indeterminate />
    </template>
  </Window>
</template>

<script>
import manifest from "../manifest.json";

import Window from "@/components/Window.vue";
import MusicMenuTable from "@/components/MusicMenuTable.vue";

export default {
  name: "AlbumModule",
  components: {
    Window,
    MusicMenuTable,
  },

  data: () => ({
    downloaded: false,
  }),

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

    loading() {
      return this.$appdata.get("modules.album.loading");
    },

    albumId() {
      return this.$appdata.get("modules.album.id_album");
    },
  },

  watch: {
    albumId: {
      immediate: true,
      handler(id) {
        if (id) this.checkDownloaded(id);
      },
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

    async checkDownloaded(id) {
      if (!id || !this.$electron.isElectron()) return;
      this.downloaded = await this.$electron.dbLocalExists(`album_${id}`);
    },

    openDownloadCenter() {
      // Abre o Centro de Downloads na seção Coletâneas
      window.dispatchEvent(new CustomEvent('open-download-center', { detail: { section: 'collections' } }));
    },

    onClose() {
      this.$media.closeAlbum();
    },
  },
};
</script>

<style scoped>
.alb-dl-btn-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
}
</style>
