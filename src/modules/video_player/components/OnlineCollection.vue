<template>
  <!-- Coletâneas online — réplica do módulo online_collection do flute:
       Coletâneas (canais) → Playlists → Vídeos, em grade ou lista, com busca
       geral (coletâneas + todos os vídeos) na primeira tela. O vídeo escolhido
       toca pelo mesmo player do YouTube do app ($webLink): projeção, miniplayer
       e barra do rodapé. -->
  <div class="oc-root">
    <!-- Cabeçalho -->
    <div class="oc-header">
      <button v-if="view !== 'channels'" type="button" class="oc-icon-btn" title="Voltar" @click="goBack">
        <v-icon size="20">mdi-arrow-left</v-icon>
      </button>
      <div class="oc-head-art">
        <img v-if="headerImage" :src="headerImage" alt="" />
        <v-icon v-else size="20">mdi-web</v-icon>
      </div>
      <div class="oc-head-text">
        <div class="oc-head-title">{{ headerTitle }}</div>
        <div class="oc-head-sub">{{ headerSubtitle }}</div>
      </div>

      <div class="oc-search">
        <v-icon size="17" class="oc-search-icon">mdi-magnify</v-icon>
        <input v-model="search" :placeholder="searchPlaceholder" />
        <button v-if="search" type="button" class="oc-search-clear" title="Limpar pesquisa" @click="search = ''">
          <v-icon size="15">mdi-close</v-icon>
        </button>
      </div>

      <div v-if="view !== 'videos' && !isGlobalSearch" class="oc-toggle">
        <button type="button" :class="{ active: viewMode === 'list' }" title="Lista" @click="setViewMode('list')">
          <v-icon size="17">mdi-format-list-bulleted</v-icon>
        </button>
        <button type="button" :class="{ active: viewMode === 'grid' }" title="Grade" @click="setViewMode('grid')">
          <v-icon size="17">mdi-view-grid</v-icon>
        </button>
      </div>
    </div>

    <div class="oc-content">
      <!-- Busca geral (na tela de coletâneas) -->
      <template v-if="isGlobalSearch">
        <div v-if="searchLoading && !searchResults.length && !filteredGlobalChannels.length" class="oc-state">
          <v-progress-circular indeterminate color="primary" size="40" />
          <span>Buscando em todas as coletâneas…</span>
        </div>
        <div v-else-if="!filteredGlobalChannels.length && !searchResults.length" class="oc-state">
          <v-icon size="48" class="oc-state-icon">mdi-magnify</v-icon>
          <span>Nenhum resultado encontrado para essa busca.</span>
          <v-btn variant="text" color="primary" class="text-none" @click="search = ''">Limpar pesquisa</v-btn>
        </div>
        <template v-else>
          <template v-if="filteredGlobalChannels.length">
            <div class="oc-section">Coletâneas</div>
            <div :class="viewMode === 'grid' ? 'oc-grid' : 'oc-list'">
              <template v-for="item in filteredGlobalChannels" :key="item.id">
                <div v-if="viewMode === 'grid'" class="oc-card" @click="selectChannel(item)">
                  <div class="oc-card-cover">
                    <img v-if="item.image" :src="item.image" loading="lazy" alt="" />
                    <v-icon v-else size="40">mdi-play-circle-outline</v-icon>
                    <div class="oc-card-overlay"><span class="oc-play-circle"><v-icon size="22">mdi-play</v-icon></span></div>
                  </div>
                  <div class="oc-card-info">
                    <div class="oc-card-title">{{ item.name }}</div>
                    <div class="oc-card-sub">Coletânea</div>
                  </div>
                </div>
                <div v-else class="oc-row" @click="selectChannel(item)">
                  <div class="oc-row-thumb">
                    <img v-if="item.image" :src="item.image" loading="lazy" alt="" />
                    <v-icon v-else size="22">mdi-play-circle-outline</v-icon>
                  </div>
                  <div class="oc-row-text">
                    <div class="oc-row-title">{{ item.name }}</div>
                    <div class="oc-row-sub">Coletânea</div>
                  </div>
                  <v-icon size="20" class="oc-row-arrow">mdi-chevron-right</v-icon>
                </div>
              </template>
            </div>
          </template>
          <template v-if="searchResults.length">
            <div class="oc-section">{{ searchResults.length }} vídeos</div>
            <div class="oc-list">
              <div
                v-for="(video, index) in searchResults"
                :key="video.playlistId + video.id"
                class="oc-video"
                :class="{ 'oc-video--on': playingId === video.id }"
                @click="playVideo(video)"
              >
                <div class="oc-video-index">
                  <v-icon v-if="playingId === video.id" size="16" color="primary">mdi-volume-high</v-icon>
                  <span v-else>{{ index + 1 }}</span>
                </div>
                <div class="oc-row-thumb">
                  <img v-if="video.image" :src="video.image" loading="lazy" alt="" />
                  <v-icon v-else size="22">mdi-video</v-icon>
                  <div class="oc-row-overlay"><v-icon size="20">mdi-play</v-icon></div>
                </div>
                <div class="oc-row-text">
                  <div class="oc-row-title" :class="{ 'text-primary': playingId === video.id }">{{ video.name }}</div>
                  <div class="oc-row-sub">{{ videoSubtitle(video) }}</div>
                </div>
              </div>
            </div>
          </template>
        </template>
      </template>

      <!-- Navegação normal -->
      <template v-else>
        <!-- Carregando: esqueletos -->
        <div v-if="loading && !currentItemsCount">
          <div v-if="viewMode === 'grid' && view !== 'videos'" class="oc-grid">
            <div v-for="n in 8" :key="n" class="oc-card oc-skel">
              <div class="oc-card-cover oc-pulse" />
              <div class="oc-card-info">
                <div class="oc-skel-line oc-pulse" style="width: 80%" />
                <div class="oc-skel-line oc-skel-line--sm oc-pulse" style="width: 45%" />
              </div>
            </div>
          </div>
          <div v-else class="oc-list">
            <div v-for="n in 8" :key="n" class="oc-row oc-skel">
              <div class="oc-row-thumb oc-pulse" />
              <div class="oc-row-text">
                <div class="oc-skel-line oc-pulse" style="width: 60%" />
                <div class="oc-skel-line oc-skel-line--sm oc-pulse" style="width: 35%" />
              </div>
            </div>
          </div>
        </div>

        <!-- Erro de conexão -->
        <div v-else-if="error && !currentItemsCount" class="oc-state">
          <v-icon size="48" color="error">mdi-alert-circle-outline</v-icon>
          <span>{{ error }}</span>
          <v-btn color="primary" variant="tonal" rounded="lg" class="text-none" prepend-icon="mdi-refresh" @click="reload">
            Tentar novamente
          </v-btn>
        </div>

        <!-- Vazio -->
        <div v-else-if="!currentItemsCount" class="oc-state">
          <v-icon size="56" class="oc-state-icon">mdi-youtube</v-icon>
          <span>{{ emptyText }}</span>
        </div>

        <!-- Vídeos da playlist -->
        <div v-else-if="view === 'videos'" class="oc-list">
          <div
            v-for="(video, index) in filteredVideos"
            :key="video.id"
            class="oc-video"
            :class="{ 'oc-video--on': playingId === video.id }"
            @click="playVideo(video)"
          >
            <div class="oc-video-index">
              <v-icon v-if="playingId === video.id" size="16" color="primary">mdi-volume-high</v-icon>
              <span v-else>{{ index + 1 }}</span>
            </div>
            <div class="oc-row-thumb">
              <img v-if="video.image" :src="video.image" loading="lazy" alt="" />
              <v-icon v-else size="22">mdi-video</v-icon>
              <div class="oc-row-overlay"><v-icon size="20">mdi-play</v-icon></div>
            </div>
            <div class="oc-row-text">
              <div class="oc-row-title" :class="{ 'text-primary': playingId === video.id }">{{ video.name }}</div>
              <div class="oc-row-sub">{{ selectedPlaylist?.name }}{{ selectedChannel ? ' | ' + selectedChannel.name : '' }}</div>
            </div>
          </div>
        </div>

        <!-- Coletâneas ou playlists (grade/lista) -->
        <div v-else :class="viewMode === 'grid' ? 'oc-grid' : 'oc-list'">
          <template v-for="item in currentItems" :key="item.id">
            <div v-if="viewMode === 'grid'" class="oc-card" @click="openItem(item)">
              <div class="oc-card-cover">
                <img v-if="item.image" :src="item.image" loading="lazy" alt="" />
                <v-icon v-else size="40">mdi-play-circle-outline</v-icon>
                <div class="oc-card-overlay"><span class="oc-play-circle"><v-icon size="22">mdi-play</v-icon></span></div>
              </div>
              <div class="oc-card-info">
                <div class="oc-card-title">{{ item.name }}</div>
                <div class="oc-card-sub">{{ itemSubtitle }}</div>
              </div>
            </div>
            <div v-else class="oc-row" @click="openItem(item)">
              <div class="oc-row-thumb">
                <img v-if="item.image" :src="item.image" loading="lazy" alt="" />
                <v-icon v-else size="22">mdi-play-circle-outline</v-icon>
                <div class="oc-row-overlay"><v-icon size="20">mdi-play</v-icon></div>
              </div>
              <div class="oc-row-text">
                <div class="oc-row-title">{{ item.name }}</div>
                <div class="oc-row-sub">{{ itemSubtitle }}</div>
              </div>
              <v-icon size="20" class="oc-row-arrow">mdi-chevron-right</v-icon>
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import OnlineCollections from "@/helpers/OnlineCollections";

const VIEW_MODE_KEY = "louvorja_online_view_mode";
const LOAD_ERROR = "Não foi possível carregar. Verifique sua conexão com a internet.";

export default {
  name: "OnlineCollection",

  props: {
    // Só carrega quando a aba está de fato visível (a janela Mídia fica montada sempre)
    visible: { type: Boolean, default: false },
  },

  data() {
    let viewMode = "grid";
    try { if (localStorage.getItem(VIEW_MODE_KEY) === "list") viewMode = "list"; } catch { /* */ }
    return {
      view: "channels", // channels | playlists | videos
      viewMode,
      channels: [],
      playlists: [],
      videos: [],
      selectedChannel: null,
      selectedPlaylist: null,
      loading: false,
      error: "",
      search: "",
      allVideos: [],
      allVideosLoaded: false,
      searchLoading: false,
      loadedLang: "",
    };
  },

  computed: {
    lang() {
      const l = this.$i18n?.locale?.value || this.$i18n?.locale || "pt";
      return String(l).slice(0, 2);
    },
    playingId() {
      return this.$webLink.getConfig().videoId || "";
    },
    query() {
      return (this.search || "").trim().toLowerCase();
    },
    headerTitle() {
      if (this.view === "playlists") return this.selectedChannel?.name || "Vídeos Online";
      if (this.view === "videos") return this.selectedPlaylist?.name || "Vídeos Online";
      return "Vídeos Online";
    },
    headerSubtitle() {
      if (this.view === "playlists") return `${this.filteredPlaylists.length} playlists`;
      if (this.view === "videos") return `${this.filteredVideos.length} vídeos${this.selectedChannel ? " • " + this.selectedChannel.name : ""}`;
      return "Coletâneas, hinários e outros conteúdos direto no programa";
    },
    headerImage() {
      if (this.view === "playlists") return this.selectedChannel?.image || "";
      if (this.view === "videos") return this.selectedPlaylist?.image || "";
      return "";
    },
    searchPlaceholder() {
      if (this.view === "playlists") return "Buscar playlist...";
      if (this.view === "videos") return "Buscar neste especial...";
      return "Buscar coletânea ou vídeo...";
    },
    isGlobalSearch() {
      return this.view === "channels" && this.query.length > 0;
    },
    filteredChannels() {
      return this.channels;
    },
    filteredGlobalChannels() {
      if (!this.query) return [];
      return this.channels.filter((c) => c.name.toLowerCase().includes(this.query));
    },
    filteredPlaylists() {
      if (this.query && this.view === "playlists") {
        return this.playlists.filter((p) => p.name.toLowerCase().includes(this.query));
      }
      return this.playlists;
    },
    filteredVideos() {
      let list = this.videos.slice();
      if (this.query && this.view === "videos") list = list.filter((v) => v.name.toLowerCase().includes(this.query));
      return list.sort((a, b) => a.position - b.position);
    },
    searchResults() {
      if (!this.query) return [];
      return this.allVideos.filter((v) =>
        v.name.toLowerCase().includes(this.query) ||
        (v.channelName && v.channelName.toLowerCase().includes(this.query)),
      );
    },
    currentItems() {
      return this.view === "playlists" ? this.filteredPlaylists : this.filteredChannels;
    },
    currentItemsCount() {
      if (this.view === "videos") return this.filteredVideos.length;
      return this.currentItems.length;
    },
    itemSubtitle() {
      return this.view === "playlists" ? (this.selectedChannel?.name || "") : "Coletânea";
    },
    emptyText() {
      if (this.view === "playlists") return "Nenhuma playlist encontrada nessa coletânea.";
      if (this.view === "videos") return "Nenhum vídeo encontrado nessa playlist.";
      return "Nenhuma coletânea disponível no momento.";
    },
  },

  watch: {
    visible: {
      handler(v) { if (v) this.ensureLoaded(); },
      immediate: true,
    },
    lang() {
      if (!this.loadedLang) return;
      // Outro idioma: volta para o início com as coletâneas do idioma novo
      this.view = "channels";
      this.selectedChannel = null;
      this.selectedPlaylist = null;
      this.allVideos = [];
      this.allVideosLoaded = false;
      this.loadChannels();
    },
    search() {
      if (this.isGlobalSearch && !this.allVideosLoaded && !this.searchLoading) this.loadAllVideosForSearch();
    },
  },

  methods: {
    ensureLoaded() {
      if (!this.channels.length || this.loadedLang !== this.lang) this.loadChannels();
    },
    setViewMode(mode) {
      this.viewMode = mode;
      try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* */ }
    },
    videoSubtitle(video) {
      if (video.channelName && video.playlistName) return `${video.playlistName} • ${video.channelName}`;
      return video.channelName || video.playlistName || "";
    },

    // Cópia local primeiro (aparece na hora), depois a rede atualiza
    async loadList(target, cached, fetcher) {
      this.error = "";
      if (cached) this[target] = cached;
      this.loading = true;
      try {
        const list = await fetcher();
        // O operador pode ter navegado para outra tela enquanto carregava
        return list;
      } catch {
        if (!cached) this.error = LOAD_ERROR;
        return null;
      } finally {
        this.loading = false;
      }
    },
    async loadChannels() {
      const lang = this.lang;
      this.loadedLang = lang;
      const list = await this.loadList("channels", OnlineCollections.cachedChannels(lang), () => OnlineCollections.getChannels(lang));
      if (list && this.lang === lang) this.channels = list;
    },
    async loadPlaylists(channel) {
      this.playlists = [];
      const list = await this.loadList("playlists", OnlineCollections.cachedPlaylists(channel.id, this.lang), () => OnlineCollections.getPlaylists(channel.id, this.lang));
      if (list && this.selectedChannel?.id === channel.id) this.playlists = list;
    },
    async loadVideos(playlist) {
      this.videos = [];
      const list = await this.loadList("videos", OnlineCollections.cachedVideos(playlist.id, this.lang), () => OnlineCollections.getVideos(playlist.id, this.lang));
      if (list && this.selectedPlaylist?.id === playlist.id) this.videos = list;
    },
    async loadAllVideosForSearch() {
      this.searchLoading = true;
      try {
        this.allVideos = await OnlineCollections.getAllVideos(this.lang);
        this.allVideosLoaded = true;
      } catch { /* busca geral é opcional */ } finally {
        this.searchLoading = false;
      }
    },

    openItem(item) {
      if (this.view === "playlists") this.selectPlaylist(item);
      else this.selectChannel(item);
    },
    selectChannel(channel) {
      this.selectedChannel = channel;
      this.view = "playlists";
      this.search = "";
      this.loadPlaylists(channel);
    },
    selectPlaylist(playlist) {
      this.selectedPlaylist = playlist;
      this.view = "videos";
      this.search = "";
      this.loadVideos(playlist);
    },
    goBack() {
      this.search = "";
      this.error = "";
      if (this.view === "videos") {
        this.view = "playlists";
        this.videos = [];
        this.selectedPlaylist = null;
      } else if (this.view === "playlists") {
        this.view = "channels";
        this.playlists = [];
        this.selectedChannel = null;
      }
    },
    reload() {
      if (this.view === "channels") this.loadChannels();
      else if (this.view === "playlists" && this.selectedChannel) this.loadPlaylists(this.selectedChannel);
      else if (this.view === "videos" && this.selectedPlaylist) this.loadVideos(this.selectedPlaylist);
    },

    // Toca no player do YouTube do app (projeção + miniplayer + rodapé), sem
    // entrar na fila de "Meus Links"
    playVideo(video) {
      this.$webLink.open(`https://www.youtube.com/watch?v=${video.id}`, video.name, { addToPlaylist: false });
    },
  },
};
</script>

<style scoped>
.oc-root {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Cabeçalho ── */
.oc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.oc-icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s, color 0.2s;
}
.oc-icon-btn:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgb(var(--v-theme-on-surface));
}
.oc-head-art {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-primary), 0.18);
  color: rgb(var(--v-theme-primary));
}
.oc-head-art img { width: 100%; height: 100%; object-fit: cover; }
.oc-head-text { flex: 1 1 160px; min-width: 0; }
.oc-head-title {
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.oc-head-sub {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.oc-search {
  flex: 0 1 320px;
  min-width: 180px;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 10px 0 12px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.oc-search:focus-within { border-color: rgba(var(--v-theme-primary), 0.6); }
.oc-search-icon { opacity: 0.55; }
.oc-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
}
.oc-search-clear {
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.oc-search-clear:hover { color: rgb(var(--v-theme-on-surface)); }
.oc-toggle {
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  flex-shrink: 0;
}
.oc-toggle button {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.oc-toggle button:hover { background: rgba(var(--v-theme-on-surface), 0.06); color: rgb(var(--v-theme-on-surface)); }
.oc-toggle button.active {
  background: rgb(var(--v-theme-primary));
  color: #fff;
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.35);
}

/* ── Conteúdo ── */
.oc-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}
.oc-section {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin: 6px 4px 10px;
}
.oc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 16px;
  padding: 4px 4px 20px;
}
.oc-list { display: flex; flex-direction: column; width: 100%; padding-bottom: 12px; }
.oc-state {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.oc-state-icon { opacity: 0.45; }

/* Cartão (grade) */
.oc-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  cursor: pointer;
  border-radius: 14px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.25s, border-color 0.25s;
}
.oc-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3);
  border-color: rgba(var(--v-theme-primary), 0.5);
}
.oc-card-cover {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.45);
  background: linear-gradient(135deg, #101c2e 0%, #172a45 100%);
}
.oc-card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.35s ease;
}
.oc-card:hover .oc-card-cover img { transform: scale(1.05); }
.oc-card-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  opacity: 0;
  transition: opacity 0.25s;
}
.oc-card:hover .oc-card-overlay { opacity: 1; }
.oc-play-circle {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(var(--v-theme-primary), 0.92);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  transform: scale(0.85);
  transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);
}
.oc-card:hover .oc-play-circle { transform: scale(1); }
.oc-card-info { padding: 12px 14px 14px; }
.oc-card-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.oc-card-sub {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Linha (lista) e vídeo */
.oc-row,
.oc-video {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 9px 14px;
  border-radius: 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.05);
  transition: background 0.2s;
}
.oc-row:hover,
.oc-video:hover { background: rgba(var(--v-theme-on-surface), 0.05); }
.oc-video--on {
  background: rgba(var(--v-theme-primary), 0.12) !important;
  box-shadow: inset 3px 0 0 rgb(var(--v-theme-primary));
}
.oc-video-index {
  width: 30px;
  flex-shrink: 0;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgb(var(--v-theme-primary));
}
.oc-row-thumb {
  position: relative;
  width: 112px;
  aspect-ratio: 16 / 9;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.45);
  background: linear-gradient(135deg, #101c2e 0%, #172a45 100%);
}
.oc-row-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s ease;
}
.oc-row:hover .oc-row-thumb img,
.oc-video:hover .oc-row-thumb img { transform: scale(1.05); }
.oc-row-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.2s;
}
.oc-row:hover .oc-row-overlay,
.oc-video:hover .oc-row-overlay { opacity: 1; }
.oc-row-text { flex: 1; min-width: 0; }
.oc-row-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.oc-row-sub {
  margin-top: 3px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.oc-row-arrow {
  flex-shrink: 0;
  color: rgba(var(--v-theme-on-surface), 0.5);
  transition: transform 0.2s, color 0.2s;
}
.oc-row:hover .oc-row-arrow { color: rgb(var(--v-theme-primary)); transform: translateX(2px); }

/* Esqueletos */
.oc-skel { pointer-events: none; }
.oc-skel-line {
  height: 13px;
  border-radius: 4px;
  margin-bottom: 8px;
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.oc-skel-line--sm { height: 10px; background: rgba(var(--v-theme-on-surface), 0.05); }
.oc-pulse { animation: oc-pulse 1.6s ease-in-out infinite; }
@keyframes oc-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
</style>
