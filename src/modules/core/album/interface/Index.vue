<template>
  <Window
    v-model="module.show"
    :title="module?.data?.name"
    :image="module?.data?.url_image ? $path.file(module.data.url_image) : ''"
    closable
    minimizable
    compact
    title-class="text-h4 font-weight-light"
    :image-size="125"
    :color="module?.data?.color"
    @close="onClose()"
    @minimize="onMinimize()"
    slot-left-class="w-100"
  >
    <!-- Botões de sistema: Download (só exibe quando online e não baixado) -->
    <template v-slot:system_buttons>
      <v-tooltip v-if="!downloaded && is_online" location="bottom" text="Baixar álbum — Centro de Downloads">
        <template v-slot:activator="{ props }">
          <v-btn
            v-bind="props"
            icon
            variant="text"
            size="small"
            color="white"
            class="ms-1"
            @click="openDownloadCenter"
          >
            <v-icon size="20">mdi-download-circle-outline</v-icon>
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
            <th :style="{ backgroundColor: module.data.color, color: '#FFF', borderLeft: 'none' }">
              <div class="d-flex justify-end align-center pe-1">
                <v-btn
                  variant="text"
                  density="compact"
                  :color="playingAll ? 'error' : 'white'"
                  :prepend-icon="playingAll ? 'mdi-stop-circle-outline' : 'mdi-play-circle-outline'"
                  @click="togglePlayAll"
                >
                  {{ playingAll ? 'Parar' : 'Reproduzir todos' }}
                </v-btn>
              </div>
            </th>
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
    playingAll: false,
    _playAllIdx: -1,
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

    albumMusics() {
      return this.module?.data?.musics || [];
    },

    is_online() {
      return !!this.$appdata.get("is_online");
    },

    mediaShow() {
      return !!this.$appdata.get("modules.media.show");
    },
  },

  watch: {
    albumId: {
      immediate: true,
      handler(id) {
        if (id) this.checkDownloaded(id);
      },
    },
    mediaShow(now, prev) {
      // Fecha manual do player enquanto playAll está ativo → para a sequência
      if (prev && !now && this.playingAll) {
        const isMinimized = !!this.$appdata.get('modules.media.minimized');
        if (!isMinimized) this._stopPlayAll();
      }
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
      if (this.playingAll) {
        // Fechar durante reprodução contínua: oculta a janela e minimiza o player
        // para que a sequência continue na barra inferior sem interrupção.
        this.$modules.close(this.module_id);
        if (!this.$appdata.get('modules.media.minimized')) {
          this.$media.minimize();
        }
        return;
      }
      this._stopPlayAll();
      this.$media.closeAlbum();
    },

    onMinimize() {
      // Apenas oculta a janela do álbum sem interromper a reprodução contínua
      this.$modules.close(this.module_id);
    },

    togglePlayAll() {
      if (this.playingAll) {
        this._stopPlayAll();
      } else {
        this._startPlayAll();
      }
    },

    _startPlayAll() {
      if (!this.albumMusics.length) return;
      this.playingAll = true;

      // Captura snapshot para que a sequência sobreviva a qualquer
      // mudança de estado reativo do componente entre faixas.
      const musics = [...this.albumMusics];
      const albumId = this.albumId;
      const self = this;
      let idx = 0;

      const playNext = () => {
        if (idx >= musics.length) {
          self._stopPlayAll();
          self.$media.endSong();
          return;
        }
        const music = musics[idx];
        const keepMinimized = !!self.$appdata.get('modules.media.minimized');
        self._playAllIdx = idx;
        idx++;
        self.$media.open({
          id_music: music.id_music,
          mode: 'audio',
          id_album: albumId,
          ...(keepMinimized ? { minimized: true } : {}),
        });
      };

      // A própria presença do callback é o "está tocando" — anulá-lo em
      // _stopPlayAll() é o suficiente para interromper a sequência.
      this.$media._autoCloseCallback = playNext;
      playNext();
    },

    _stopPlayAll() {
      this.playingAll = false;
      this._playAllIdx = -1;
      if (this.$media) this.$media._autoCloseCallback = null;
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
