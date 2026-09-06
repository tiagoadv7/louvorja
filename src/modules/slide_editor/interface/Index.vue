<template>
  <l-window
    v-model="module.show"
    :title="songTitle"
    :icon="module.icon"
    closable
    minimizable
    eager
    :index="show ? 1 : 0"
    slot-left-style="width:300px"
    slot-right-style="width:260px"
    @close="close()"
    @minimize="onMinimize"
  >
    <template v-slot:system_buttons>
      <LScreenBtn module="slide_editor" />
    </template>

    <template v-slot:header>
      <div class="se-toolbar">
        <div class="se-toolbar-actions">
          <button class="se-btn-outline" @click="actNew">
            <v-icon size="15">mdi-file-plus-outline</v-icon> {{ t("actions.new") }}
          </button>
          <button class="se-btn-outline" @click="actOpen">
            <v-icon size="15">mdi-folder-open-outline</v-icon> {{ t("actions.open") }}
          </button>
          <button class="se-btn-outline" @click="actSave">
            <v-icon size="15">mdi-content-save-outline</v-icon> {{ t("actions.save") }}
          </button>
          <button class="se-btn-outline" @click="actSaveAs">
            <v-icon size="15">mdi-content-save-edit-outline</v-icon> {{ t("actions.save_as") }}
          </button>
          <button class="se-btn-outline" @click="actExport">
            <v-icon size="15">mdi-file-export-outline</v-icon> {{ t("actions.export") }}
          </button>
          <button class="se-btn-outline" @click="actImportTxt">
            <v-icon size="15">mdi-file-import-outline</v-icon> {{ t("actions.import_txt") }}
          </button>
        </div>
        <span class="se-toolbar-sep" />
        <button class="se-btn-icon" :title="t('labels.name')" @click="renameSong">
          <v-icon size="16">mdi-pencil-outline</v-icon>
        </button>
        <span class="se-title">{{ songTitle }}</span>
        <span v-if="dirty" class="se-dirty-dot" :title="t('actions.save')">●</span>

        <input ref="fileSlja" type="file" accept=".slja,.lja" hidden @change="onLoadSlja" />
        <input ref="fileTxt" type="file" accept=".txt" hidden @change="onImportTxt" />
      </div>
    </template>

    <!-- ── Coluna direita: lista de slides (mesmo lugar/estilo da lista
         numerada do player padrão — ver core/media/interface/Index.vue —
         só que aqui cada linha é editável direto, por ser um editor) ── -->
    <template v-slot:right>
      <div class="se-slide-list">
        <div class="se-slide-list-header">
          <span class="se-slide-list-title">{{ t("labels.slides") }}</span>
          <span class="se-slide-list-count">{{ slides.length }}</span>
        </div>
        <div class="se-slide-list-body">
          <draggable v-model="song.slides" item-key="id" handle=".se-thumb-grip" @end="onReorder">
            <template #item="{ element, index }">
              <div
                class="se-thumb"
                :class="{ 'is-active': index === current }"
                :style="thumbStyle(element)"
                @click="goSlide(index)"
              >
                <v-icon size="14" class="se-thumb-grip">mdi-drag-vertical</v-icon>
                <span class="se-thumb-num">{{ index + 1 }}</span>
                <span v-if="element.tempo_seconds > 0" class="se-thumb-time">
                  <v-icon size="9">mdi-clock-outline</v-icon>
                  {{ formatTime(element.tempo_seconds) }}
                </span>
                <textarea
                  class="se-thumb-text se-thumb-text-editable"
                  :style="{ color: element.cor_letra, textAlign: element.text_align || 'center' }"
                  :placeholder="`(${element.tipo})`"
                  v-model="element.letra"
                  rows="2"
                  @mousedown.stop
                  @click.stop="goSlide(index)"
                  @input="markDirty"
                />
              </div>
            </template>
          </draggable>
          <button class="se-slide-list-add" @click="actNewSlide">
            <v-icon size="16">mdi-plus-circle-outline</v-icon>
            <span>{{ t("actions.new_slide") }}</span>
          </button>
        </div>
        <div class="se-slide-list-actions">
          <v-btn icon="mdi-content-duplicate" size="x-small" variant="text" :title="t('actions.duplicate_slide')" @click="actDuplicateSlide" />
          <v-btn icon="mdi-image-remove-outline" size="x-small" variant="text" :title="t('actions.remove_slide')" @click="actRemoveSlide" />
          <v-btn icon="mdi-arrow-split-horizontal" size="x-small" variant="text" :title="t('actions.split_slide')" @click="actSplitSlide" />
          <v-btn icon="mdi-call-merge" size="x-small" variant="text" :title="t('actions.merge_next')" @click="actMergeNext" />
        </div>
      </div>
    </template>

    <!-- ── Centro: preview + player ──────────────────────────────────────── -->
    <div class="se-center">
      <div class="se-center-toolbar">
        <v-btn-toggle v-model="aspectRatio" density="compact" mandatory variant="outlined">
          <v-btn value="16-9" size="small">16:9</v-btn>
          <v-btn value="4-3" size="small">4:3</v-btn>
          <v-btn value="full" size="small">{{ t("actions.fullscreen_view") }}</v-btn>
        </v-btn-toggle>

        <div class="se-nav">
          <v-btn icon="mdi-skip-backward" size="small" variant="text" density="compact" @click="goSlide(0)" />
          <v-btn icon="mdi-arrow-left-bold" size="small" variant="text" density="compact" @click="goSlide(current - 1)" />
          <span class="se-nav-count">{{ current + 1 }}/{{ slides.length }}</span>
          <v-btn icon="mdi-arrow-right-bold" size="small" variant="text" density="compact" @click="goSlide(current + 1)" />
          <v-btn icon="mdi-skip-forward" size="small" variant="text" density="compact" @click="goSlide(slides.length - 1)" />
        </div>
      </div>

      <div class="se-preview-stage">
        <div class="se-preview-frame" :class="`is-${aspectRatio}`">
          <l-slide
            :slide_number="current"
            :cover="activeSlide.tipo === 'CAPA'"
            :text="activeSlide.letra"
            :aux_text="activeSlide.letra_aux"
            :image="activeImageUrl"
            :image_position="(activeSlide.imagem_posicao || 5) - 1"
            :color="activeSlide.cor_letra"
            :aux_color="activeSlide.cor_letra_aux"
            :font_size_pct="activeSlide.tamanho_letra"
            :aux_font_size_pct="activeSlide.tamanho_letra_aux"
            :background_color="activeSlide.cor_fundo"
            :text_bg_transparent="activeSlide.fundo_letra === false"
            :text_align="activeSlide.text_align"
          />
        </div>
      </div>

      <!-- Player de áudio persistente — só aparece com áudio anexado -->
      <div v-if="audioUrl" class="se-player">
        <button
          type="button"
          class="se-player-play"
          :class="{ 'is-playing': audioPlaying }"
          @click="togglePlay"
        >
          <v-icon size="20">{{ audioPlaying ? "mdi-pause" : "mdi-play" }}</v-icon>
        </button>
        <div class="se-player-time">
          <span>{{ formatTime(audioCurrentTime) }}</span>
          <span class="se-player-time-total">{{ formatTime(audioDuration) }}</span>
        </div>
        <div class="se-timeline" @click="onTimelineClick">
          <div class="se-timeline-fill" :style="{ width: `${timelineProgress}%` }" />
          <div
            v-for="s in slidesWithTime"
            :key="`m-${s.index}`"
            class="se-timeline-marker"
            :class="{ 'is-current': s.index === current }"
            :style="{ left: `${(s.time / audioDuration) * 100}%` }"
            :title="`Slide ${s.index + 1} — ${formatTime(s.time)}`"
            @click.stop="jumpToSlide(s.index)"
          />
          <div class="se-timeline-thumb" :style="{ left: `${timelineProgress}%` }" />
        </div>
      </div>

      <audio
        v-if="audioUrl"
        ref="audioEl"
        :src="audioUrl"
        hidden
        @play="onAudioPlay"
        @pause="onAudioPause"
        @ended="onAudioEnded"
        @timeupdate="onAudioTime"
        @loadedmetadata="onAudioLoad"
      />

      <div class="se-audio-actions">
        <v-btn size="small" variant="text" prepend-icon="mdi-music-note-plus" @click="actAttachAudio">{{ t("actions.audio_attach") }}</v-btn>
        <v-btn v-if="song.audio_name" size="small" variant="text" prepend-icon="mdi-music-note-off" @click="actAudioRemove">{{ t("actions.audio_remove") }}</v-btn>
        <input ref="fileAudio" type="file" accept="audio/*" hidden @change="onPickAudio" />

        <template v-if="audioUrl">
          <v-divider vertical class="mx-2" />
          <v-btn size="small" variant="text" prepend-icon="mdi-record-circle" @click="recordAdvance">{{ t("actions.record_advance") }}</v-btn>
          <v-btn size="small" variant="text" prepend-icon="mdi-skip-previous" @click="recordStart">{{ t("actions.record_start") }}</v-btn>
          <v-btn size="small" variant="text" prepend-icon="mdi-rewind" @click="recordRetroactive">{{ t("actions.record_retroactive") }}</v-btn>
          <v-btn size="small" variant="text" prepend-icon="mdi-eraser" @click="recordClear">{{ t("actions.record_clear") }}</v-btn>
        </template>
      </div>
    </div>

    <!-- ── Coluna esquerda: formatação do slide atual — sempre visível, sem
         precisar abrir/fechar pra achar cada opção. -->
    <template v-slot:left>
      <div class="se-props">
        <div class="se-props-section">
          <div class="se-props-title">{{ t("labels.main_text") }}</div>
          <div class="se-props-body">
            <v-textarea
              v-model="activeSlide.letra"
              :label="t('labels.main_text')"
              rows="3"
              density="compact"
              hide-details
              class="mb-2"
              @input="markDirty"
            />
            <v-textarea
              v-model="activeSlide.letra_aux"
              :label="t('labels.aux_text')"
              rows="2"
              density="compact"
              hide-details
              class="mb-2"
              @input="markDirty"
            />
            <div class="se-field-label">{{ t("labels.alignment") }}</div>
            <div class="se-align-group">
              <button
                v-for="opt in ['left', 'center', 'right']"
                :key="opt"
                type="button"
                class="se-btn-icon"
                :class="{ 'is-active': (activeSlide.text_align || 'center') === opt }"
                :title="t(`labels.align_${opt}`)"
                @click="setTextAlign(opt)"
              >
                <v-icon size="16">{{ `mdi-format-align-${opt}` }}</v-icon>
              </button>
            </div>
          </div>
        </div>

        <div class="se-props-section">
          <div class="se-props-title">{{ t("labels.color_typography") }}</div>
          <div class="se-props-body">
            <div class="se-row-inline">
              <label class="se-field-label">{{ t("labels.main_text") }}</label>
              <input type="color" v-model="activeSlide.cor_letra" class="se-color-input" @change="markDirty" />
              <input type="number" min="1" max="100" v-model.number="activeSlide.tamanho_letra" class="se-num-input" @change="markDirty" />
            </div>
            <div class="se-row-inline">
              <label class="se-field-label">{{ t("labels.aux_text") }}</label>
              <input type="color" v-model="activeSlide.cor_letra_aux" class="se-color-input" @change="markDirty" />
              <input type="number" min="1" max="100" v-model.number="activeSlide.tamanho_letra_aux" class="se-num-input" @change="markDirty" />
            </div>
            <v-checkbox
              v-model="transparentBg"
              :label="t('labels.transparent_bg')"
              density="compact"
              hide-details
              class="mt-1"
            />
          </div>
        </div>

        <div class="se-props-section">
          <div class="se-props-title">{{ t("labels.background_image") }}</div>
          <div class="se-props-body">
            <div v-if="activeImageUrl" class="se-img-preview-row">
              <div class="se-img-thumb" :style="{ backgroundImage: `url(${activeImageUrl})` }" />
              <div class="se-img-actions">
                <v-btn size="x-small" variant="tonal" prepend-icon="mdi-image-edit-outline" @click="actSetImage">{{ t("actions.image_set") }}</v-btn>
                <v-btn size="x-small" variant="tonal" prepend-icon="mdi-image-off-outline" @click="actRemoveImage">{{ t("actions.image_remove") }}</v-btn>
              </div>
            </div>
            <v-btn v-else block variant="tonal" prepend-icon="mdi-image-plus" @click="actSetImage">{{ t("actions.image_set") }}</v-btn>
            <input ref="fileImage" type="file" accept="image/*,.heic,.heif" hidden @change="onPickImage" />

            <v-select
              v-if="activeImageUrl"
              v-model.number="activeSlide.imagem_posicao"
              :label="t('labels.position')"
              :items="positionOptions"
              item-title="label"
              item-value="value"
              density="compact"
              hide-details
              class="mt-2"
              @update:model-value="markDirty"
            />
          </div>
        </div>

        <div class="se-props-section">
          <div class="se-props-title">{{ t("labels.replicate") }}</div>
          <div class="se-props-body">
            <div class="se-field-label">{{ t("labels.replicate_bg") }}</div>
            <div class="se-actions-row mb-2">
              <v-btn size="x-small" variant="tonal" @click="replicateBg('next')">{{ t("actions.replicate_bg_next") }}</v-btn>
              <v-btn size="x-small" variant="tonal" @click="replicateBg('after')">{{ t("actions.replicate_bg_after") }}</v-btn>
              <v-btn size="x-small" variant="tonal" @click="replicateBg('all')">{{ t("actions.replicate_bg_all") }}</v-btn>
            </div>
            <div class="se-field-label">{{ t("labels.replicate_text") }}</div>
            <div class="se-actions-row">
              <v-btn size="x-small" variant="tonal" @click="replicateText('next')">{{ t("actions.replicate_text_next") }}</v-btn>
              <v-btn size="x-small" variant="tonal" @click="replicateText('after')">{{ t("actions.replicate_text_after") }}</v-btn>
              <v-btn size="x-small" variant="tonal" @click="replicateText('all')">{{ t("actions.replicate_text_all") }}</v-btn>
            </div>
          </div>
        </div>
      </div>
    </template>
  </l-window>
</template>

<script>
import Draggable from "vuedraggable";
import manifest from "../manifest.json";
import LWindow from "@/components/Window.vue";
import LScreenBtn from "@/components/buttons/Screen.vue";
import LSlide from "@/components/Slide.vue";
import CustomSongs from "@/helpers/CustomSongs";
import SljaConverter from "@/helpers/SljaConverter";
import ImageConvert from "@/helpers/ImageConvert";
import CustomSongsPlayback from "@/helpers/CustomSongsPlayback";

export default {
  name: "SlideEditorModule",
  components: {
    LWindow,
    LScreenBtn,
    LSlide,
    Draggable,
  },
  data: () => ({
    song: CustomSongs.newSong(),
    current: 0,
    dirty: false,
    _restoringFromMinimize: false,
    aspectRatio: "16-9",
    audioUrl: "",
    audioPlaying: false,
    audioCurrentTime: 0,
    audioDuration: 0,
    resolvedImages: {},
    _projTimer: null,
    _fadeTimer: null,
    _keyHandler: null,
    _openFileHandler: null,
    _lastSyncTime: -1,
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
    /* COMPUTEDS OBRIGATÓRIAS - FIM */

    show() {
      return this.module.show;
    },
    // Handoff vindo de Coletâneas Personalizadas (ver watch abaixo) — id de
    // uma música salva pra carregar em vez de abrir em branco.
    pendingSongId() {
      return this.$appdata.get(`modules.${this.module_id}.pending_song_id`, "");
    },
    // Caminho de um .slja recebido por fora (duplo clique no arquivo, com o
    // SO abrindo/entregando pro app — ver electron/main.js#openSljaFile e o
    // listener 'open-slja-file' registrado em mounted() abaixo). Mesma ideia
    // do pendingSongId acima, só que pra um arquivo cru em vez de uma música
    // já salva.
    pendingSljaPath() {
      return this.$appdata.get(`modules.${this.module_id}.pending_slja_path`, "");
    },
    // Comandos vindos do mini-player do rodapé (play/pause, avançar/voltar,
    // buscar tempo, volume, encerrar) — ver watch abaixo e helpers/
    // SlideEditorPlayer.js#_command (mesmo padrão do SoundMaster).
    footerCommand() {
      return this.$appdata.get(`modules.${this.module_id}.footer_command`);
    },
    slides() {
      return this.song.slides;
    },
    activeSlide() {
      return this.slides[this.current] || {};
    },
    songTitle() {
      return this.song?.nome || this.t("data.untitled");
    },
    activeImageUrl() {
      const name = this.activeSlide?.imagem;
      if (!name) return "";
      return this.resolvedImages[name] || "";
    },
    transparentBg: {
      get() {
        return this.activeSlide.fundo_letra === false;
      },
      set(v) {
        this.activeSlide.fundo_letra = !v;
        this.markDirty();
      },
    },
    timelineProgress() {
      if (!this.audioDuration) return 0;
      return Math.min(100, (this.audioCurrentTime / this.audioDuration) * 100);
    },
    slidesWithTime() {
      return this.slides.map((s, index) => ({ index, time: s.tempo_seconds })).filter((s) => s.time > 0);
    },
    positionOptions() {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: n, label: this.t(`positions.${n}`) }));
    },
  },
  watch: {
    // O painel some/reaparece via v-dialog (o componente continua montado o
    // tempo todo), então sem isso reabrir o editor mostraria a música da vez
    // anterior — a cada abertura, começa em branco de novo. Exceções:
    // 1) handoff pendente de Coletâneas Personalizadas (ver watch
    //    "pendingSongId" abaixo) ou de um .slja externo (ver "pendingSljaPath"
    //    abaixo) — quem carrega a música certa é aquele watcher, não este reset;
    // 2) reabrindo depois de MINIMIZAR (ver onMinimize/_restoringFromMinimize
    //    abaixo) — minimizar só esconde a janela (o áudio continua tocando,
    //    ver eager no <l-window>), então "reabrir" aqui é o mesmo "show"
    //    disparando de novo; sem essa exceção, a música que estava tocando
    //    desaparecia da tela (voltava pra "Nova música" em branco) assim que
    //    o operador clicava no item minimizado pra voltar a ver o editor.
    show(open) {
      if (open && this._restoringFromMinimize) {
        this._restoringFromMinimize = false;
        return;
      }
      if (open && !this.pendingSongId && !this.pendingSljaPath) this.resetToBlank();
    },
    // Cobre o caso do editor JÁ estar aberto quando Coletâneas Personalizadas
    // pede pra abrir outra música — "show" não dispara de novo (já é true),
    // então esse handoff precisa do próprio watcher.
    pendingSongId(id) {
      if (!id) return;
      this.$appdata.set(`modules.${this.module_id}.pending_song_id`, "");
      this.loadSongById(id);
    },
    // Mesma ideia do watch acima, pra um .slja recebido de fora (duplo clique
    // no arquivo — ver mounted() abaixo e electron/main.js#openSljaFile).
    pendingSljaPath(path) {
      if (!path) return;
      this.$appdata.set(`modules.${this.module_id}.pending_slja_path`, "");
      this.loadSljaFromPath(path);
    },
    footerCommand(cmd) {
      if (!cmd) return;
      if (cmd.action === "toggle") this.togglePlay();
      else if (cmd.action === "stop") this.close();
      else if (cmd.action === "seek_by") this.onSeek(this.audioCurrentTime + (cmd.delta || 0));
      else if (cmd.action === "seek_to") this.onSeek(cmd.time);
      else if (cmd.action === "volume") {
        const el = this.$refs.audioEl;
        if (el) el.volume = Math.max(0, Math.min(100, cmd.value)) / 100;
        this.syncNowPlaying();
      }
    },
    "song.slides.length"(n) {
      if (n === 0) {
        this.song.slides = [CustomSongs.newSlide({ tipo: "LETRA" })];
        this.current = 0;
      } else if (this.current > n - 1) {
        this.current = n - 1;
      }
    },
    "song.audio_name": "rebuildAudioUrl",
    activeSlide: {
      handler: "scheduleProjectionBroadcast",
      deep: true,
    },
    current: "scheduleProjectionBroadcast",
  },
  methods: {
    /* METHODS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      const key = `modules.${this.module_id}.${text}`;
      const result = this.$t(key);
      if (result === key) {
        if (text === "title") return manifest.name || result;
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || "pt";
        const storedManifest = this.$appdata.get(`modules.${this.module_id}.manifest`);
        const translations = storedManifest?.translations?.[locale] || storedManifest?.translations?.["pt"];
        if (translations) {
          const val = text.split(".").reduce((obj, k) => obj?.[k], translations);
          if (typeof val === "string") return val;
        }
      }
      return result;
    },
    close() {
      // Fechar só o painel do operador — igual aos outros módulos (ex.:
      // cronômetro), a projeção continua até o operador clicar de novo no
      // botão de tela pra encerrá-la explicitamente. O áudio, porém, é
      // encerrado suavemente aqui (fade, mesmo padrão do resto do sistema —
      // ver Media.js#stopAudio): sem isso, fechar o painel deixava a música
      // tocando escondida pra sempre, sem nenhum controle visível pra pará-la.
      // Zera a flag do minimizar: se o operador minimizou e fechou de vez
      // (sem restaurar antes), uma futura abertura "do zero" não pode ficar
      // marcada como "restaurando", senão ficaria presa na música antiga.
      this._restoringFromMinimize = false;
      this.stopAudioSmooth();
      this.$modules.close(this.module_id);
    },
    // Minimizar só esconde a janela — o componente continua montado (eager,
    // ver <l-window> acima) e o áudio segue tocando. Marca a flag ANTES de
    // avisar o Modules.js, pra o watch "show" (que dispara quando o operador
    // reabre) saber que não é uma abertura nova e pular o reset pra "Nova
    // música" (ver comentário lá).
    onMinimize() {
      this._restoringFromMinimize = true;
      this.$modules.minimize(this.module_id);
    },
    /* METHODS OBRIGATÓRIAS - FIM */

    markDirty() {
      this.dirty = true;
    },
    setTextAlign(opt) {
      this.activeSlide.text_align = opt;
      this.markDirty();
    },

    resetToBlank() {
      this.song = CustomSongs.newSong(this.t("data.untitled"));
      this.current = 0;
      this.dirty = false;
      this.rebuildAudioUrl();
      this.resolvedImages = {};
    },

    // Carrega uma música já salva (handoff de Coletâneas Personalizadas —
    // ver watch "pendingSongId"). "pending_autoplay" (appdata, setado só
    // pela ação "Apresentar" de lá) já deixa tocando com áudio sincronizado,
    // sem o operador precisar clicar em play de novo.
    async loadSongById(id) {
      const song = await CustomSongs.getSong(id);
      if (!song) return;
      this.song = song;
      this.current = 0;
      this.dirty = false;
      this.resolvedImages = {};
      await this.rebuildAudioUrl();
      await this.ensureAllImagesResolved();
      // Reenvia pro output DEPOIS de resolver as imagens — trocar "song"
      // acima já agenda um broadcast (watch "activeSlide", debounce de
      // 120ms, ver scheduleProjectionBroadcast), mas ensureAllImagesResolved
      // (IPC fileExists + leitura em disco) pode não terminar a tempo,
      // principalmente na primeira vez que as imagens da música são
      // tocadas. Isso mandava o broadcast com "image" ainda vazio — a
      // projeção ficava com fundo preto até o operador trocar de slide
      // (o que dispara um novo broadcast, aí sim já com a imagem pronta).
      this.broadcastCurrentSlide();

      const autoplay = this.$appdata.get(`modules.${this.module_id}.pending_autoplay`, false);
      if (autoplay) {
        this.$appdata.set(`modules.${this.module_id}.pending_autoplay`, false);
        // audioUrl acabou de mudar — o <audio> (v-if="audioUrl") só existe
        // na árvore depois que o DOM atualizar.
        this.$nextTick(() => this.togglePlay());
      }
    },

    // Duplo clique num .slja no Windows (ou "Abrir com" > Louvor JA) — mesmo
    // parse de onLoadSlja(), só que a partir de um caminho no disco em vez de
    // um <input type=file>. $electron.readFile(path, null) devolve os bytes
    // crus (mesmo padrão de CustomSongs.js#getAudioBlob/getImageBlob), que
    // viram um File de verdade (JSZip/parseSljaToSong aceitam Blob/File).
    async loadSljaFromPath(filePath) {
      try {
        const data = await this.$electron.readFile(filePath, null);
        if (!data) throw new Error("Arquivo não encontrado");
        const fileName = filePath.split(/[\\/]/).pop();
        const file = new File([data], fileName);
        const newSong = await CustomSongs.parseSljaToSong(file);
        this.song = newSong;
        this.current = 0;
        this.dirty = false;
        this.resolvedImages = {};
        await this.rebuildAudioUrl();
        await this.ensureAllImagesResolved();
        this.broadcastCurrentSlide(); // ver comentário em loadSongById()

        // Mesmo gatilho de autoplay de loadSongById() — setado só pelo
        // handler "open-slja-file" (duplo clique/"Abrir com" no SO, ver
        // mounted()), pra abrir já tocando, igual ao LouvorJA Delphi original.
        const autoplay = this.$appdata.get(`modules.${this.module_id}.pending_autoplay`, false);
        if (autoplay) {
          this.$appdata.set(`modules.${this.module_id}.pending_autoplay`, false);
          this.$nextTick(() => this.togglePlay());
        }
      } catch (err) {
        this.$alert.error({ title: this.t("data.invalid_file"), text: String(err?.message || err), translate: false });
      }
    },

    formatTime(s) {
      return SljaConverter.secondsToHms(s || 0);
    },

    thumbStyle(slide) {
      const url = this.resolvedImages[slide.imagem];
      const style = { background: slide.cor_fundo };
      if (url) {
        style.backgroundImage = `linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.5)), url(${url})`;
        style.backgroundSize = "cover";
        style.backgroundPosition = "center";
      }
      return style;
    },

    async ensureImageResolved(name) {
      if (!name || this.resolvedImages[name]) return;
      const url = await CustomSongs.resolveImageUrl(this.song.id, name);
      if (url) this.resolvedImages = { ...this.resolvedImages, [name]: url };
    },
    async ensureAllImagesResolved() {
      const names = this.slides.map((s) => s.imagem).filter(Boolean);
      for (const name of names) await this.ensureImageResolved(name);
    },
    // Encerra suavemente o áudio da música atual (se estiver tocando) antes de
    // trocar/limpar "audioUrl" — mesmo padrão de fade usado pelo resto do
    // sistema (ver Media.js#stopAudio/fadeOutAudio) ao fechar ou trocar de
    // música. Sem isso, trocar de música (ou fechar/limpar o áudio) cortava o
    // som na hora: o <audio> é o MESMO elemento (só troca de "src"), então a
    // troca de "audioUrl" cortava a reprodução em andamento sem fade nenhum.
    stopAudioSmooth() {
      return new Promise((resolve) => {
        const el = this.$refs.audioEl;
        if (!el || el.paused) {
          resolve();
          return;
        }
        const savedVolume = el.volume;
        this.fadeVolume(el, savedVolume, 0, 250, () => {
          el.pause();
          el.volume = savedVolume;
          this.audioPlaying = false;
          resolve();
        });
      });
    },
    async rebuildAudioUrl() {
      await this.stopAudioSmooth();
      if (!this.song.audio_name) {
        this.audioUrl = "";
        this.audioCurrentTime = 0;
        this.audioDuration = 0;
        this.syncNowPlaying();
        return;
      }
      this.audioUrl = (await CustomSongs.resolveAudioUrl(this.song.id, this.song.audio_name)) || "";
      this.syncNowPlaying();
    },

    // Debounce pra não inundar o IPC de sincronização a cada tecla digitada —
    // o estado local do editor atualiza normalmente a cada tecla, só o envio
    // pra janela de saída é que espera uma pausa curta.
    scheduleProjectionBroadcast() {
      clearTimeout(this._projTimer);
      this._projTimer = setTimeout(() => this.broadcastCurrentSlide(), 120);
    },
    broadcastCurrentSlide() {
      const s = this.activeSlide;
      const base = `modules.${this.module_id}`;
      // next.letra: mesma ideia de "Próxima letra" da tela de retorno pro
      // slide de música (ver ReturnScreen.vue#nextText) — sem isso, o
      // espelho do retorno pra músicas do Editor não tinha como mostrar a
      // próxima linha, só a atual.
      const next = this.slides[this.current + 1] || {};
      this.$appdata.setMultiple([
        [`${base}.text`, s.letra || ""],
        [`${base}.aux_text`, s.letra_aux || ""],
        [`${base}.cover`, s.tipo === "CAPA"],
        [`${base}.image`, this.activeImageUrl || ""],
        [`${base}.image_position`, (s.imagem_posicao || 5) - 1],
        [`${base}.color`, s.cor_letra || ""],
        [`${base}.aux_color`, s.cor_letra_aux || ""],
        [`${base}.font_size_pct`, s.tamanho_letra || null],
        [`${base}.aux_font_size_pct`, s.tamanho_letra_aux || null],
        [`${base}.background_color`, s.cor_fundo || ""],
        [`${base}.text_bg_transparent`, s.fundo_letra === false],
        [`${base}.text_align`, s.text_align || ""],
        [`${base}.slide_number`, this.current],
        [`${base}.slide_count`, this.slides.length],
        [`${base}.next_text`, next.letra || ""],
      ]);
    },

    // ===== Navegação =====
    goSlide(idx) {
      if (!this.slides.length) return;
      const clamped = Math.max(0, Math.min(this.slides.length - 1, idx));
      this.current = clamped;
      const audioEl = this.$refs.audioEl;
      if (!audioEl) return;
      // Paridade Delphi: primeiro slide sempre faz seek pra 0; os demais só
      // fazem seek se têm tempo gravado.
      const ts = this.slides[clamped]?.tempo_seconds || 0;
      if (clamped === 0) {
        audioEl.currentTime = 0;
        this.audioCurrentTime = 0;
      } else if (ts > 0) {
        audioEl.currentTime = ts;
        this.audioCurrentTime = ts;
      }
    },
    onReorder() {
      this.markDirty();
    },

    // ===== Diálogos auxiliares =====
    promptText(title, defaultValue) {
      return new Promise((resolve) => {
        this.$alert.prompt({ title, input_default: defaultValue, translate: false }, (val) => resolve(val));
      });
    },
    confirmDiscard() {
      return new Promise((resolve) => {
        this.$alert.yesno({ title: this.t("data.discard_changes"), translate: false }, (resp) => resolve(resp === "yes"));
      });
    },
    async renameSong() {
      const name = await this.promptText(this.t("labels.name"), this.song.nome || "");
      if (name && name !== this.song.nome) {
        this.song.nome = name;
        this.markDirty();
      }
    },

    // ===== Arquivo =====
    async actNew() {
      if (this.dirty) {
        const ok = await this.confirmDiscard();
        if (!ok) return;
      }
      this.resetToBlank();
    },
    actOpen() {
      this.$refs.fileSlja?.click();
    },
    async onLoadSlja(e) {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        // Parse + import de áudio/imagens compartilhado com Coletâneas
        // Personalizadas (ver CustomSongs.js#parseSljaToSong) — mas SEM
        // salvar em disco aqui: igual ao comportamento de sempre, o
        // resultado fica só na memória até o operador clicar "Salvar".
        const newSong = await CustomSongs.parseSljaToSong(file);
        this.song = newSong;
        this.current = 0;
        this.dirty = false;
        this.resolvedImages = {};
        await this.rebuildAudioUrl();
        await this.ensureAllImagesResolved();
        this.broadcastCurrentSlide(); // ver comentário em loadSongById()
      } catch (err) {
        this.$alert.error({ title: this.t("data.invalid_file"), text: String(err?.message || err), translate: false });
      }
    },
    async actSave() {
      try {
        const saved = await CustomSongs.saveSong(this.song);
        this.song = saved;
        this.dirty = false;
        this.$alert.info({ title: this.t("actions.save"), text: this.songTitle, translate: false });
      } catch (err) {
        this.$alert.error({ title: this.t("data.save_error"), text: String(err?.message || err), translate: false });
      }
    },
    async actSaveAs() {
      const name = await this.promptText(this.t("actions.save_as"), this.song.nome || this.t("data.untitled"));
      if (!name) return;
      try {
        const newId = crypto.randomUUID();
        await CustomSongs.duplicateMedia(this.song.id, newId);
        const now = new Date().toISOString();
        const saved = await CustomSongs.saveSong({ ...this.song, id: newId, nome: name, createdAt: now, updatedAt: now });
        this.song = saved;
        this.dirty = false;
        this.$alert.info({ title: this.t("actions.save_as"), text: name, translate: false });
      } catch (err) {
        this.$alert.error({ title: this.t("data.save_error"), text: String(err?.message || err), translate: false });
      }
    },
    async buildExportSlja() {
      const imagesMap = new Map();
      const slidesForExport = [];
      for (const s of this.song.slides) {
        const exportSlide = { ...s };
        if (s.imagem) {
          const blob = await CustomSongs.getImageBlob(this.song.id, s.imagem);
          if (blob) {
            imagesMap.set(s.imagem, blob);
            exportSlide.imagem = s.imagem;
          } else {
            exportSlide.imagem = "";
          }
        }
        slidesForExport.push(exportSlide);
      }
      const audioBlob = this.song.audio_name ? await CustomSongs.getAudioBlob(this.song.id) : null;
      return SljaConverter.writeSlja({
        slides: slidesForExport,
        audio: audioBlob,
        audioName: this.song.audio_name || "audio.mp3",
        images: imagesMap,
        nome: this.song.nome || "",
      });
    },
    async actExport() {
      try {
        const blob = await this.buildExportSlja();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${this.songTitle.replace(/[\\/:*?"<>|]/g, "_")}.slja`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        this.$alert.error({ title: this.t("data.invalid_file"), text: String(err?.message || err), translate: false });
      }
    },
    actImportTxt() {
      this.$refs.fileTxt?.click();
    },
    async readTxtWithEncoding(file) {
      const buf = await file.arrayBuffer();
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch {
        return new TextDecoder("windows-1252").decode(buf);
      }
    },
    async onImportTxt(e) {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      const text = await this.readTxtWithEncoding(file);
      const idx = this.current;
      const newSlide = CustomSongs.newSlide({ ...this.slides[idx], id: crypto.randomUUID(), letra: text, tempo_seconds: 0 });
      this.song.slides.splice(idx + 1, 0, newSlide);
      this.current = idx + 1;
      this.splitSlideAt(this.current);
      this.markDirty();
    },
    splitSlideAt(idx) {
      const s = this.slides[idx];
      if (!s) return;
      const parts = (s.letra || "").split(/\r?\n/);
      if (parts.length <= 1) return;
      const fragments = parts.map((line, i) => {
        const letra = line.replace(/\|/g, "\n");
        if (i === 0) return { ...s, letra };
        return { ...s, id: crypto.randomUUID(), letra, tempo_seconds: 0 };
      });
      this.song.slides.splice(idx, 1, ...fragments);
    },
    actSplitSlide() {
      this.splitSlideAt(this.current);
      this.markDirty();
    },
    actMergeNext() {
      const i = this.current;
      if (i >= this.slides.length - 1) return;
      const cur = this.slides[i];
      const next = this.slides[i + 1];
      cur.letra = `${cur.letra || ""}\n${next.letra || ""}`.trim();
      this.song.slides.splice(i + 1, 1);
      this.markDirty();
    },

    // ===== Slides =====
    actNewSlide() {
      const cur = this.slides[this.current];
      const tipo = this.slides.length === 0 ? "CAPA" : "LETRA";
      const ns = CustomSongs.newSlide({
        tipo,
        cor_fundo: cur?.cor_fundo,
        cor_letra: cur?.cor_letra,
        cor_letra_aux: cur?.cor_letra_aux,
        tamanho_letra: cur?.tamanho_letra,
        tamanho_letra_aux: cur?.tamanho_letra_aux,
        fundo_letra: cur?.fundo_letra ?? true,
        imagem: cur?.imagem,
        imagem_posicao: cur?.imagem_posicao,
      });
      this.song.slides.splice(this.current + 1, 0, ns);
      this.current = Math.min(this.current + 1, this.slides.length - 1);
      this.markDirty();
    },
    actDuplicateSlide() {
      const s = this.slides[this.current];
      if (!s) return;
      this.song.slides.splice(this.current + 1, 0, { ...s, id: crypto.randomUUID() });
      this.current += 1;
      this.markDirty();
    },
    actRemoveSlide() {
      if (this.slides.length <= 1) {
        this.song.slides.splice(0, 1, CustomSongs.newSlide({ tipo: "LETRA" }));
        this.current = 0;
      } else {
        this.song.slides.splice(this.current, 1);
        this.current = Math.max(0, this.current - 1);
      }
      this.markDirty();
    },

    // ===== Imagem de fundo =====
    actSetImage() {
      this.$refs.fileImage?.click();
    },
    async onPickImage(e) {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const { blob, name } = await ImageConvert.ensureRenderableImage(file.name, file);
        const stored = await CustomSongs.importImage(this.song.id, blob, name);
        this.activeSlide.imagem = stored;
        await this.ensureImageResolved(stored);
        this.markDirty();
      } catch (err) {
        this.$alert.error({ title: "Erro ao adicionar imagem", text: String(err?.message || err), translate: false });
      }
    },
    async actRemoveImage() {
      if (!this.slides.length) return;
      const name = this.activeSlide.imagem;
      this.activeSlide.imagem = "";
      this.markDirty();
      if (name) await CustomSongs.removeImage(this.song.id, name);
    },

    // ===== Replicar =====
    copyVisualFields(src, dst, mode) {
      if (mode === "bg") {
        dst.cor_fundo = src.cor_fundo;
        dst.imagem = src.imagem;
        dst.imagem_posicao = src.imagem_posicao;
      } else if (mode === "text") {
        dst.tamanho_letra = src.tamanho_letra;
        dst.tamanho_letra_aux = src.tamanho_letra_aux;
        dst.cor_letra = src.cor_letra;
        dst.cor_letra_aux = src.cor_letra_aux;
        dst.fundo_letra = src.fundo_letra;
        dst.text_align = src.text_align;
      }
    },
    applyReplicate(scope, mode) {
      const src = this.activeSlide;
      if (scope === "next") {
        const tgt = this.slides[this.current + 1];
        if (tgt) this.copyVisualFields(src, tgt, mode);
      } else if (scope === "after") {
        for (let i = this.current + 1; i < this.slides.length; i++) this.copyVisualFields(src, this.slides[i], mode);
      } else if (scope === "all") {
        for (let i = 0; i < this.slides.length; i++) if (i !== this.current) this.copyVisualFields(src, this.slides[i], mode);
      }
      this.markDirty();
    },
    replicateBg(scope) {
      this.applyReplicate(scope, "bg");
    },
    replicateText(scope) {
      this.applyReplicate(scope, "text");
    },

    // ===== Áudio =====
    actAttachAudio() {
      this.$refs.fileAudio?.click();
    },
    async onPickAudio(e) {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      const name = await CustomSongs.importAudio(this.song.id, file, file.name);
      this.song.audio_name = name;
      this.markDirty();
    },
    async actAudioRemove() {
      await CustomSongs.removeAudio(this.song.id);
      // Não zera "audioUrl"/"audioPlaying" na mão aqui — o watcher de
      // "song.audio_name" já chama rebuildAudioUrl(), que agora encerra o
      // áudio suavemente antes de limpar (ver stopAudioSmooth).
      this.song.audio_name = "";
      this.markDirty();
    },
    onAudioPlay() {
      this.audioPlaying = true;
      this._lastSyncTime = this.$refs.audioEl?.currentTime ?? -1;
      this.syncNowPlaying();
    },
    onAudioPause() {
      this.audioPlaying = false;
      this.syncNowPlaying();
    },
    // Fim natural do áudio: além de soltar o botão de play, avisa quem
    // estiver tocando uma fila de várias músicas (ver custom_collections
    // "Reproduzir tudo") pra avançar pra próxima — mesmo papel do
    // "_autoCloseCallback" do $media, só que pro lado das músicas próprias.
    onAudioEnded() {
      this.audioPlaying = false;
      this.syncNowPlaying();
      CustomSongsPlayback.autoAdvance?.();
    },
    onAudioTime() {
      const el = this.$refs.audioEl;
      if (!el) return;
      this.audioCurrentTime = el.currentTime;
      if (this.audioPlaying) this.syncSlideFromAudio();
      this.syncNowPlaying();
    },
    // Auto-sync apenas em playback contínuo: avança o slide quando o tempo
    // cruza um marker gravado. Saltos (seek/navegação manual) são ignorados.
    syncSlideFromAudio() {
      const t = this.audioCurrentTime;
      const last = this._lastSyncTime;
      this._lastSyncTime = t;
      if (last < 0) return;
      if (Math.abs(t - last) > 1.5) return;
      for (let i = 0; i < this.slides.length; i++) {
        const ts = this.slides[i].tempo_seconds;
        if (ts > 0 && ts > last && ts <= t && i !== this.current) {
          this.current = i;
          break;
        }
      }
    },
    onAudioLoad() {
      const el = this.$refs.audioEl;
      if (el) this.audioDuration = el.duration || 0;
      this.syncNowPlaying();
    },
    // Espelha o essencial (título/tocando/tempo) em $appdata — o mini-player
    // do rodapé (Footer.vue/Player.vue, ver $slideEditor em
    // helpers/SlideEditorPlayer.js) é um componente totalmente separado e não
    // tem acesso à instância do editor, mesmo padrão já usado por
    // SoundMasterPanel.vue com SoundMaster.js.
    syncNowPlaying() {
      const el = this.$refs.audioEl;
      this.$appdata.set(`modules.${this.module_id}.now_playing`, this.audioUrl ? {
        title: this.songTitle,
        playing: this.audioPlaying,
        current_time: this.audioCurrentTime,
        duration: this.audioDuration,
        progress: this.audioDuration ? Math.min(100, (this.audioCurrentTime / this.audioDuration) * 100) : 0,
        volume: el ? Math.round((el.volume ?? 1) * 100) : 100,
      } : { title: "", playing: false, current_time: 0, duration: 0, progress: 0, volume: 100 });
    },
    onSeek(seconds) {
      const el = this.$refs.audioEl;
      if (!el) return;
      const v = Number(seconds);
      if (Number.isFinite(v)) {
        el.currentTime = v;
        this.audioCurrentTime = v;
      }
    },
    onTimelineClick(ev) {
      const el = this.$refs.audioEl;
      if (!el || !this.audioDuration) return;
      const rect = ev.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      this.onSeek(ratio * this.audioDuration);
    },
    jumpToSlide(idx) {
      this.goSlide(idx);
    },
    // Fade linear de volume (mesmo padrão do SoundMaster — setInterval a cada
    // 40ms) — evita o corte seco de um play/pause instantâneo.
    fadeVolume(audio, from, to, ms, done) {
      clearInterval(this._fadeTimer);
      if (ms <= 0) {
        audio.volume = to;
        done?.();
        return;
      }
      const steps = Math.max(1, Math.round(ms / 40));
      const delta = (to - from) / steps;
      let n = 0;
      this._fadeTimer = setInterval(() => {
        n++;
        audio.volume = Math.max(0, Math.min(1, from + delta * n));
        if (n >= steps) {
          clearInterval(this._fadeTimer);
          done?.();
        }
      }, 40);
    },
    togglePlay() {
      const el = this.$refs.audioEl;
      if (!el) return;
      const FADE_MS = 250;
      if (!el.paused) {
        const savedVolume = el.volume;
        this.fadeVolume(el, savedVolume, 0, FADE_MS, () => {
          el.pause();
          el.volume = savedVolume;
        });
        return;
      }
      // Seek pro tempo do slide atual antes de iniciar (paridade Delphi).
      const slide = this.activeSlide;
      if (slide && slide.tempo_seconds > 0) el.currentTime = slide.tempo_seconds;
      const targetVolume = el.volume || 1;
      el.volume = 0;
      el.play()
        .then(() => this.fadeVolume(el, 0, targetVolume, FADE_MS))
        .catch(() => {});
    },
    recordAdvance() {
      const el = this.$refs.audioEl;
      if (!el || !this.slides.length) return;
      // Paridade Delphi: avança PRIMEIRO, depois grava o tempo atual no slide
      // novo — "este tempo é o início do próximo slide".
      if (this.current >= this.slides.length - 1) return;
      const t = Math.round(el.currentTime);
      this.current += 1;
      this.activeSlide.tempo_seconds = t;
      this.markDirty();
    },
    recordStart() {
      const el = this.$refs.audioEl;
      if (!el || !this.slides.length) return;
      this.activeSlide.tempo_seconds = Math.round(el.currentTime);
      this.markDirty();
    },
    recordRetroactive() {
      const el = this.$refs.audioEl;
      if (!el || !this.slides.length) return;
      if (this.current === 0) {
        el.currentTime = 0;
        this.audioCurrentTime = 0;
        return;
      }
      const cur = this.activeSlide.tempo_seconds || Math.round(el.currentTime);
      const newTime = Math.max(0, cur - 1);
      el.currentTime = newTime;
      this.audioCurrentTime = newTime;
      this.activeSlide.tempo_seconds = newTime;
      this.markDirty();
    },
    recordClear() {
      for (const s of this.slides) s.tempo_seconds = 0;
      this.markDirty();
    },
  },

  async mounted() {
    await this.rebuildAudioUrl();
    await this.ensureAllImagesResolved();
    this.broadcastCurrentSlide();

    // Permite que quem estiver tocando uma fila (custom_collections) pause o
    // áudio da música própria em andamento antes de trocar pra uma música do
    // catálogo oficial — sem fade, é só uma troca de contexto, não um "parar".
    CustomSongsPlayback.stopCurrent = () => {
      const el = this.$refs.audioEl;
      if (el && !el.paused) el.pause();
    };

    // Atalhos de teclado: seta direita avança o slide, seta esquerda volta,
    // espaço toca/pausa o áudio. Os botões de gravação (recordAdvance/Start/
    // Retroactive/Clear) ficam só nos botões do editor mesmo, sem atalho.
    this._keyHandler = (e) => {
      if (!this.module?.show) return;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(e.target?.tagName)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        this.goSlide(this.current + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.goSlide(this.current - 1);
      } else if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        this.togglePlay();
      }
    };
    window.addEventListener("keydown", this._keyHandler);

    // Duplo clique num .slja no SO (ou "Abrir com") — ver electron/main.js
    // #openSljaFile. Abre a janela do editor e marca o handoff (watch
    // "pendingSljaPath" acima) pra carregar o arquivo assim que "show" virar
    // true, em vez de resetar pra "Nova música". Mesma paridade Delphi do
    // botão "Apresentar" de Coletâneas Personalizadas (ver
    // custom_collections/interface/Index.vue#apresentar): já projeta na
    // tela principal E toca sozinho, sem o operador precisar clicar em Tela
    // + Play depois de abrir — o Delphi original já abria "executando".
    this._openFileHandler = this.$electron.on("open-slja-file", (filePath) => {
      this.$appdata.set(`modules.${this.module_id}.pending_slja_path`, filePath);
      this.$appdata.set(`modules.${this.module_id}.pending_autoplay`, true);
      this.$modules.open(this.module_id);
      this.$popup.open(this.module_id);
    });
  },
  beforeUnmount() {
    clearTimeout(this._projTimer);
    clearInterval(this._fadeTimer);
    if (this._keyHandler) window.removeEventListener("keydown", this._keyHandler);
    if (this._openFileHandler) this.$electron.off("open-slja-file", this._openFileHandler);
  },
};
</script>

<style scoped>
.se-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.se-toolbar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.se-toolbar-sep {
  width: 1px;
  align-self: stretch;
  background: rgba(var(--v-border-color), var(--v-border-opacity));
  margin: 0 2px;
}
.se-btn-outline,
.se-btn-icon {
  display: flex;
  align-items: center;
  gap: 5px;
  border-radius: 6px;
  font-size: 12.5px;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  transition: background 0.15s;
  white-space: nowrap;
}
.se-btn-outline {
  padding: 6px 12px;
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}
.se-btn-outline:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.se-btn-icon {
  padding: 6px;
  width: 28px;
  height: 28px;
  justify-content: center;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.se-btn-icon:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.se-btn-icon.is-active {
  color: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}
.se-align-group {
  display: flex;
  gap: 4px;
}
.se-title {
  font-weight: 600;
  font-size: 14px;
}
.se-dirty-dot {
  color: rgb(var(--v-theme-warning));
  font-size: 14px;
}

.se-slide-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.se-slide-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
  font-weight: 600;
}
.se-slide-list-count {
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
}
.se-slide-list-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}
.se-slide-list-actions {
  display: flex;
  justify-content: space-around;
  padding: 4px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.se-thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 6px;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  border: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  transition: border-color 0.15s;
}
.se-thumb.is-active {
  border-color: rgb(var(--v-theme-primary));
}
.se-thumb-num {
  position: absolute;
  top: 4px;
  left: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  padding: 1px 5px;
  border-radius: 8px;
}
.se-thumb-grip {
  position: absolute;
  top: 4px;
  right: 6px;
  color: rgba(255, 255, 255, 0.55);
  cursor: grab;
  z-index: 1;
}
.se-thumb-grip:active { cursor: grabbing; }
.se-thumb-time {
  position: absolute;
  bottom: 4px;
  right: 6px;
  font-size: 9px;
  color: #a5d6a7;
  background: rgba(0, 0, 0, 0.55);
  padding: 1px 5px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.se-thumb-text {
  font-size: 9px;
  text-align: center;
  overflow: hidden;
  max-height: 100%;
  white-space: pre-line;
  line-height: 1.1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  color: #fff;
}
.se-thumb-text-editable {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-family: inherit;
  cursor: text;
  padding: 16px 4px 4px;
}
.se-thumb-text-editable::placeholder {
  color: rgba(255, 255, 255, 0.55);
}
.se-slide-list-add {
  width: 100%;
  padding: 8px;
  background: transparent;
  border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  margin-top: 4px;
}

.se-center {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
}
.se-center-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.se-nav {
  display: flex;
  align-items: center;
  gap: 2px;
}
.se-nav-count {
  font-size: 12px;
  font-family: monospace;
  min-width: 46px;
  text-align: center;
}
.se-preview-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  background: rgba(var(--v-border-color), 0.04);
  border-radius: 8px;
  padding: 12px;
}
.se-preview-frame {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  container-type: size;
  position: relative;
  box-shadow: 0 0 0 1px rgba(var(--v-border-color), 0.2);
  border-radius: 4px;
  overflow: hidden;
}
.se-preview-frame.is-16-9 {
  aspect-ratio: 16 / 9;
  width: auto;
  height: 100%;
}
.se-preview-frame.is-4-3 {
  aspect-ratio: 4 / 3;
  width: auto;
  height: 100%;
}
.se-preview-frame.is-full {
  width: 100%;
  height: 100%;
}

.se-player {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(var(--v-border-color), 0.06);
  border-radius: 8px;
}
.se-player-play {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.se-player-time {
  display: flex;
  flex-direction: column;
  font-size: 10px;
  font-family: monospace;
  opacity: 0.8;
  min-width: 40px;
}
.se-timeline {
  position: relative;
  flex: 1;
  height: 8px;
  background: rgba(var(--v-border-color), 0.2);
  border-radius: 4px;
  cursor: pointer;
}
.se-timeline-fill {
  position: absolute;
  inset: 0;
  border-radius: 4px;
  background: rgba(var(--v-theme-primary), 0.4);
}
.se-timeline-marker {
  position: absolute;
  top: -2px;
  width: 2px;
  height: 12px;
  background: rgb(var(--v-theme-success));
  cursor: pointer;
}
.se-timeline-marker.is-current {
  background: rgb(var(--v-theme-warning));
}
.se-timeline-thumb {
  position: absolute;
  top: -3px;
  width: 10px;
  height: 14px;
  margin-left: -5px;
  border-radius: 3px;
  background: rgb(var(--v-theme-primary));
  pointer-events: none;
}

.se-audio-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.se-props {
  height: 100%;
  overflow-y: auto;
  border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.se-props-section {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 10px 12px;
}
.se-props-section:last-child { border-bottom: none; }
.se-props-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
  margin-bottom: 8px;
}

.se-field-label {
  display: block;
  font-size: 11px;
  opacity: 0.65;
  margin-bottom: 4px;
}
.se-row-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.se-color-input {
  width: 34px;
  height: 28px;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}
.se-num-input {
  width: 60px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  padding: 3px 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
}
.se-img-preview-row {
  display: flex;
  gap: 10px;
  align-items: center;
}
.se-img-thumb {
  width: 64px;
  height: 42px;
  border-radius: 4px;
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
}
.se-img-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.se-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
