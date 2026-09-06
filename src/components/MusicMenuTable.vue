<template>
  <div class="d-flex flex-nowrap">
    <template v-if="!compact">
      <v-btn
        v-for="(btn, key) in buttons"
        :key="key"
        :disabled="btn.disabled ? btn.disabled : false"
        variant="text"
        :color="color ? color : $theme.primary()"
        :icon="btn.icon"
        density="compact"
        class="mx-1"
        @click="btn.click"
      />
    </template>

    <v-menu location="start">
      <template v-slot:activator="{ props }">
        <v-btn
          variant="text"
          :color="color ? color : $theme.primary()"
          icon="mdi-menu"
          density="compact"
          class="mx-1"
          v-bind="props"
        />
      </template>

      <v-list>
        <v-list-item v-if="compact" class="d-flex justify-center">
          <v-btn
            v-for="(btn, key) in buttons"
            :key="key"
            :disabled="btn.disabled ? btn.disabled : false"
            variant="text"
            :color="$theme.primary()"
            :icon="btn.icon"
            density="compact"
            class="mx-1"
            @click="btn.click"
          />
        </v-list-item>
        <v-divider v-if="compact" />

        <v-list-item
          v-for="(item, key) in menu"
          :key="key"
          class="cursor-pointer"
        >
          <template v-slot:prepend>
            <v-icon :icon="item.icon"></v-icon>
          </template>
          <template v-slot:append>
            <v-icon icon="mdi-menu-right" size="x-small"></v-icon>
          </template>
          <v-list-item-title>{{ item.title }}</v-list-item-title>

          <v-menu
            :open-on-focus="false"
            activator="parent"
            :open-on-hover="!is_mobile"
            submenu
          >
            <v-list>
              <template v-for="(subitem, subkey) in item.menu" :key="subkey">
                <v-divider v-if="subitem.title == '-'" />
                <v-list-item
                  v-else
                  :prepend-icon="subitem.icon"
                  :title="subitem.title"
                  @click="subitem.click"
                  :disabled="subitem.disabled ? subitem.disabled : false"
                />
              </template>
            </v-list>
          </v-menu>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script>
import CustomSongs from "@/helpers/CustomSongs";
import SljaConverter from "@/helpers/SljaConverter";

export default {
  name: "MusicMenuTableComponent",
  emits: ['action'],
  props: {
    id_music: Number,
    has_instrumental_music: [Boolean, Number],
    color: String,
  },
  methods: {
    _run(fn) {
      this.$emit('action');
      fn();
    },

    // Mesma cadeia de resolução usada por Media.js#open() pro <audio> real
    // (local baixado → stream remoto → app-local:// convertido) — sem ela,
    // um app-local://… (banco local/SQLite legado) não é buscável via fetch
    // (não é http(s), dá CORS/ERR_FAILED).
    async _resolveAudioUrl(rawUrl) {
      if (!rawUrl) return null;
      const localUrl = await this.$electron.mediaResolveFile(rawUrl);
      if (localUrl) return localUrl;
      const streamUrl = await this.$electron.mediaResolveRemoteUrl(rawUrl, import.meta.env.VITE_URL_FILES);
      return streamUrl || this.$path.file(rawUrl);
    },

    async _resolveImageUrl(rawUrl) {
      if (!rawUrl) return null;
      const localUrl = await this.$electron.mediaResolveImage(rawUrl);
      return localUrl || this.$path.file(rawUrl);
    },

    async _fetchBlob(url) {
      if (!url) return null;
      try {
        const res = await fetch(url);
        return res.ok ? await res.blob() : null;
      } catch {
        return null;
      }
    },

    // Exporta a música do catálogo oficial como .slja — mesmo pacote (zip com
    // slides.lja + áudio/imagens) que o Editor de Músicas já sabe abrir (ver
    // slide_editor/interface/Index.vue#onLoadSlja e loadSljaFromPath), assim
    // dá pra editar/levar essa música como se fosse uma própria. mode:
    // "audio" | "instrumental" | "no_audio" — mesmos três modos de Executar.
    async exportSlja(mode) {
      try {
        const data = await this.$database.get(`music_${this.id_music}`);
        if (!data) throw new Error("Música não encontrada");

        const mediaSlides = this.$media.slides(data);
        const imagesMap = new Map();
        const keyByUrl = new Map();
        let imgCount = 0;

        const slides = [];
        for (const s of mediaSlides) {
          let imgKey = "";
          if (s.url_image) {
            if (!keyByUrl.has(s.url_image)) {
              const resolved = await this._resolveImageUrl(s.url_image);
              const blob = await this._fetchBlob(resolved);
              if (blob) {
                imgCount++;
                const key = `capa_${imgCount}.jpg`;
                imagesMap.set(key, blob);
                keyByUrl.set(s.url_image, key);
              }
            }
            imgKey = keyByUrl.get(s.url_image) || "";
          }
          slides.push(CustomSongs.newSlide({
            tipo: s.cover ? "CAPA" : "LETRA",
            // Media.js#slides() troca \n por <br> pra exibição — desfaz aqui,
            // já que o editor guarda a letra como texto puro (\n).
            letra: (s.lyric || "").replace(/<br\s*\/?>/gi, "\n"),
            letra_aux: (s.aux_lyric || "").replace(/<br\s*\/?>/gi, "\n"),
            imagem: imgKey,
            imagem_posicao: s.image_position ?? 5,
            tempo_seconds: this.$datetime.toNumber(
              mode === "instrumental" ? s.instrumental_time : s.time
            ) || 0,
          }));
        }

        let audioBlob = null;
        let audioName = "audio.mp3";
        if (mode !== "no_audio") {
          const rawUrl = mode === "instrumental" ? data.url_instrumental_music : data.url_music;
          const resolved = await this._resolveAudioUrl(rawUrl);
          audioBlob = await this._fetchBlob(resolved);
          if (!audioBlob) {
            throw new Error(mode === "instrumental" ? "Playback não disponível" : "Áudio não disponível");
          }
          audioName = (rawUrl?.split(/[\\/]/).pop() || "audio.mp3").split("?")[0] || "audio.mp3";
        }

        const blob = await SljaConverter.writeSlja({
          slides,
          audio: audioBlob,
          audioName,
          images: imagesMap,
          nome: data.name || "",
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(data.name || "musica").replace(/[\\/:*?"<>|]/g, "_")}.slja`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        this.$alert.error({ title: "Erro ao exportar", text: String(err?.message || err), translate: false });
      }
    },

    // "Arquivo Cantado"/"Arquivo Playback" do menu Exportar: salva o arquivo
    // de áudio original, sem empacotar em .slja — mesma ideia de "Arquivo
    // Cantado"/"Arquivo Playback" do menu Executar (openAudio), só que salva
    // em vez de abrir.
    async exportAudioFile(mode) {
      try {
        const data = await this.$database.get(`music_${this.id_music}`);
        if (!data) throw new Error("Música não encontrada");
        const rawUrl = mode === "instrumental" ? data.url_instrumental_music : data.url_music;
        if (!rawUrl) throw new Error(mode === "instrumental" ? "Playback não disponível" : "Áudio não disponível");
        const resolved = await this._resolveAudioUrl(rawUrl);
        const blob = await this._fetchBlob(resolved);
        if (!blob) throw new Error("Não foi possível carregar o arquivo");

        const ext = (rawUrl.split(".").pop() || "mp3").split("?")[0];
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(data.name || "musica").replace(/[\\/:*?"<>|]/g, "_")}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        this.$alert.error({ title: "Erro ao exportar", text: String(err?.message || err), translate: false });
      }
    },
  },
  computed: {
    buttons() {
      return [
        {
          disabled: false,
          icon: "mdi-play-box-multiple",
          click: () => this._run(() => this.$media.open({ id_music: this.id_music, mode: "audio" })),
        },
        {
          disabled: !this.has_instrumental_music,
          icon: "mdi-play-box-multiple-outline",
          click: () => this._run(() => this.$media.open({ id_music: this.id_music, mode: "instrumental" })),
        },
        {
          disabled: false,
          icon: "mdi-checkbox-multiple-blank-outline",
          click: () => this._run(() => this.$media.open(this.id_music)),
        },
        {
          disabled: false,
          icon: "mdi-text-box-outline",
          click: () => this._run(() => this.$media.openLyric(this.id_music)),
        },
      ];
    },
    menu() {
      return [
        /* {
          title: "Adicionar em",
          icon: "mdi-plus",
          menu: [
            {
              title: "Favritos",
              icon: "mdi-star",
              click: () => null,
            },
            {
              title: "Liturgia",
              icon: "mdi-view-list",
              click: () => null,
            },
            {
              title: "Lista de Reprodução",
              icon: "mdi-playlist-music",
              click: () => null,
            },
          ],
        },*/
        {
          title: "Executar",
          icon: "mdi-play",
          menu: [
            {
              title: "Cantado",
              icon: "mdi-play-box-multiple",
              click: () => this._run(() => this.$media.open({ id_music: this.id_music, mode: "audio" })),
            },
            {
              title: "Playback",
              icon: "mdi-play-box-multiple-outline",
              click: () => this._run(() => this.$media.open({ id_music: this.id_music, mode: "instrumental" })),
              disabled: !this.has_instrumental_music,
            },
            {
              title: "Sem Áudio",
              icon: "mdi-checkbox-multiple-blank-outline",
              click: () => this._run(() => this.$media.open(this.id_music)),
            },
            {
              title: "Letra",
              icon: "mdi-text-box-outline",
              click: () => this._run(() => this.$media.openLyric(this.id_music)),
            },
            {
              title: "-",
            },
            {
              title: "Arquivo Cantado",
              icon: "mdi-file-music",
              click: () => this._run(() => this.$media.openAudio(this.id_music)),
            },
            {
              title: "Arquivo Playback",
              icon: "mdi-file-music-outline",
              click: () => this._run(() => this.$media.openAudio({ id_music: this.id_music, mode: "instrumental" })),
              disabled: !this.has_instrumental_music,
            },
          ],
        },
        {
          title: "Exportar",
          icon: "mdi-export",
          menu: [
            {
              title: "Cantado",
              icon: "mdi-play-box-multiple",
              click: () => this._run(() => this.exportSlja("audio")),
            },
            {
              title: "Playback",
              icon: "mdi-play-box-multiple-outline",
              disabled: !this.has_instrumental_music,
              click: () => this._run(() => this.exportSlja("instrumental")),
            },
            {
              title: "Sem Áudio",
              icon: "mdi-checkbox-multiple-blank-outline",
              click: () => this._run(() => this.exportSlja("no_audio")),
            },
            {
              title: "-",
            },
            {
              title: "Arquivo Cantado",
              icon: "mdi-file-music",
              click: () => this._run(() => this.exportAudioFile("audio")),
            },
            {
              title: "Arquivo Playback",
              icon: "mdi-file-music-outline",
              click: () => this._run(() => this.exportAudioFile("instrumental")),
              disabled: !this.has_instrumental_music,
            },
          ],
        },
      ];
    },
    compact: function () {
      return this.$vuetify.display.width <= 550;
    },
    is_mobile: function () {
      return this.$appdata.get("is_mobile");
    },
  },
};
</script>
