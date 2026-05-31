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
    <!-- Botão de download local no cabeçalho -->
    <template v-slot:system_buttons>
      <v-tooltip location="bottom" :text="downloadTooltip">
        <template v-slot:activator="{ props }">
          <div v-bind="props" class="alb-dl-btn-wrap ms-1">
            <!-- Progresso circular enquanto baixa -->
            <v-progress-circular
              v-if="downloading"
              :model-value="dlPercent"
              color="white"
              size="28"
              width="2"
              class="alb-dl-progress"
            >
              <span style="font-size:8px">{{ dlPercent }}%</span>
            </v-progress-circular>

            <!-- Botão normal -->
            <v-btn
              v-else
              icon
              variant="text"
              size="small"
              :color="downloaded ? 'success' : 'white'"
              @click="downloadAlbum"
            >
              <v-icon size="20">
                {{ downloaded ? 'mdi-check-circle' : 'mdi-download-circle-outline' }}
              </v-icon>
            </v-btn>
          </div>
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
    downloading:      false,
    downloaded:       false,
    dlPercent:        0,
    dlMessage:        '',
    dlStats:          null,
    _progressHandler: null,
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

    downloadTooltip() {
      if (this.downloading) return this.dlMessage || 'Baixando...';
      if (this.downloaded) {
        if (this.dlStats) return `Disponível offline · ${this.dlStats.json} letras · ${this.dlStats.audio} áudios · ${this.dlStats.images} imagens`;
        return 'Disponível offline — clique para atualizar';
      }
      return 'Baixar álbum completo para uso offline';
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

    async downloadAlbum() {
      const id = this.albumId;
      if (!id || this.downloading) return;

      this.downloading = true;
      this.dlPercent  = 0;
      this.dlMessage  = 'Iniciando...';

      this._progressHandler = this.$electron.on('album:download-progress', (data) => {
        if (data.albumId !== id) return;
        if (data.step === 'done') return;
        this.dlPercent = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
        this.dlMessage = data.message || '';
      });

      try {
        const result = await this.$electron.albumDownloadFull(
          id,
          import.meta.env.VITE_URL_DATABASE,
          import.meta.env.VITE_URL_FILES,
          import.meta.env.VITE_API_TOKEN,
        );

        if (result?.success) {
          this.downloaded = true;
          this.dlStats    = result.stats;
        } else {
          this.$alert?.error?.({
            text: `Falha ao baixar álbum: ${result?.error || 'erro desconhecido'}`,
          });
        }
      } catch (e) {
        this.$alert?.error?.({ text: String(e) });
      } finally {
        this.downloading = false;
        this.dlPercent   = 0;
        if (this._progressHandler) {
          this.$electron.off('album:download-progress', this._progressHandler);
          this._progressHandler = null;
        }
      }
    },

    onClose() {
      if (this._progressHandler) {
        this.$electron.off('album:download-progress', this._progressHandler);
        this._progressHandler = null;
      }
      this.$media.closeAlbum();
    },
  },

  beforeUnmount() {
    if (this._progressHandler) {
      this.$electron.off('album:download-progress', this._progressHandler);
      this._progressHandler = null;
    }
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
