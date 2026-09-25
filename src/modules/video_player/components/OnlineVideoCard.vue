<template>
  <div class="ovc-card" :class="{ 'ovc-card--active': active }" @click="$emit('select')">
    <div class="ovc-thumb">
      <img
        v-if="thumbSrc"
        :src="thumbSrc"
        alt=""
        loading="lazy"
        @load="onThumbLoad"
        @error="onThumbError"
      />
      <div v-else class="ovc-thumb-fallback">
        <v-icon size="30" color="#e53935">{{ variant === 'playlist' ? 'mdi-playlist-play' : 'mdi-youtube' }}</v-icon>
      </div>
      <button
        v-if="playAll"
        class="ovc-play-all"
        title="Reproduzir todos"
        @click.stop="$emit('play-all')"
      >
        <v-icon size="18" color="#fff">mdi-play</v-icon>
      </button>
      <div v-if="variant === 'video'" class="ovc-play">
        <v-icon size="26" color="#fff">mdi-play</v-icon>
      </div>
    </div>
    <div class="ovc-body">
      <div class="ovc-title" :title="entity.title">{{ entity.title }}</div>
      <div v-if="subtitle" class="ovc-sub">{{ subtitle }}</div>
    </div>
  </div>
</template>

<script>
// Card de canal/playlist/vídeo do catálogo online (aba "Online" > "Catálogo",
// ver video_player/interface/Index.vue) — mesma cadeia de fallback de
// thumbnail do violin-app (louvorja/violin-app, módulo online_videos), que
// consome o mesmo catálogo (API /collections/online): maxres → sd → hq →
// base64 vindo da API pra vídeo/playlist; avatar ampliado → original → base64
// pra canal. O YouTube responde 404 de thumbs inexistentes COM UMA IMAGEM
// (placeholder cinza 120×90) em vez de erro — por isso a detecção de "essa
// thumb não existe" é pela largura carregada (onThumbLoad), não só pelo
// evento @error.
export default {
  name: "OnlineVideoCard",
  props: {
    entity: { type: Object, required: true },
    variant: { type: String, default: "video" }, // 'channel' | 'playlist' | 'video'
    active: { type: Boolean, default: false },
    playAll: { type: Boolean, default: false },
    subtitle: { type: String, default: "" },
    // Capa da playlist deriva deste vídeo (1º por sequência) quando a própria
    // playlist não traz uma thumbnail utilizável.
    firstVideoId: { type: String, default: "" },
  },
  emits: ["select", "play-all"],
  data: () => ({
    step: 0,
  }),
  computed: {
    thumbSrc() {
      const chain = this.thumbChain();
      return this.step < chain.length ? chain[this.step] : "";
    },
  },
  watch: {
    "entity.video_id"() { this.step = 0; },
    "entity.playlist_id"() { this.step = 0; },
    "entity.channel_id"() { this.step = 0; },
  },
  methods: {
    normalizeDataUri(uri) {
      if (!uri) return "";
      // A API declara PNG mas o payload às vezes é JPEG — corrige o MIME
      // pra imagem não ficar quebrada.
      return /^data:image\/png;base64,\/9j\//.test(uri)
        ? uri.replace("data:image/png;base64,", "data:image/jpeg;base64,")
        : uri;
    },
    upgradeAvatarUrl(url) {
      if (!url) return "";
      return url.replace(/=s\d+/, "=s512");
    },
    videoIdFromThumbUrl(url) {
      const m = url && url.match(/\/vi\/([\w-]{11})\//);
      return m ? m[1] : null;
    },
    thumbChain() {
      const e = this.entity;
      const b64 = this.normalizeDataUri(e.default_image_base64 || "");
      if (this.variant === "channel") {
        return [this.upgradeAvatarUrl(e.default_image), e.default_image, b64].filter(Boolean);
      }
      const vid = e.video_id || this.firstVideoId || this.videoIdFromThumbUrl(e.default_image) || "";
      return [
        vid ? `https://i.ytimg.com/vi/${vid}/maxresdefault.jpg` : "",
        vid ? `https://i.ytimg.com/vi/${vid}/sddefault.jpg` : "",
        vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : "",
        b64 || e.default_image,
      ].filter(Boolean);
    },
    advance(img) {
      const chain = this.thumbChain();
      const next = this.step + 1;
      if (next < chain.length && chain[next] && chain[next] !== img.src) {
        this.step = next;
        img.src = chain[next];
      } else {
        this.step = chain.length; // esgota a cadeia → thumbSrc "" → ícone
      }
    },
    onThumbError(e) {
      this.advance(e.target);
    },
    onThumbLoad(e) {
      const img = e.target;
      const chain = this.thumbChain();
      const src = chain[Math.min(this.step, chain.length - 1)] || "";
      if (!src.startsWith("https://i.ytimg.com/")) return; // data URI / avatar: ok
      if (img.naturalWidth > 0 && img.naturalWidth <= 130) this.advance(img);
    },
  },
};
</script>

<style scoped>
.ovc-card {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.04);
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.12s;
}
.ovc-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}
.ovc-card--active {
  outline: 2px solid #e53935;
}
.ovc-thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.ovc-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ovc-thumb-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
}
.ovc-play-all {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.ovc-play-all:hover { background: rgba(229, 57, 53, 0.85); }
.ovc-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.12s;
  background: rgba(0, 0, 0, 0.35);
}
.ovc-card:hover .ovc-play { opacity: 1; }
.ovc-body { min-width: 0; padding: 6px 8px 8px; }
.ovc-title {
  font-size: 12px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ovc-sub {
  font-size: 10.5px;
  margin-top: 2px;
  color: rgba(var(--v-theme-on-surface), 0.55);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
