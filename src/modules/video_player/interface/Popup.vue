<template>
  <div v-if="shouldRender" class="vp-popup-root">
    <img
      v-if="config.mediaType === 'image'"
      :src="config.src"
      class="vp-image"
      :class="{ 'vp-image--fading': imageFading }"
      :style="imageStyle"
    />
    <canvas
      v-else-if="config.mediaType === 'pdf'"
      ref="pdfCanvas"
      class="vp-pdf"
      :class="{ 'vp-pdf--fading': pdfFading }"
    />
    <video
      v-else
      ref="video"
      :src="renderedSrc"
      :loop="config.loop"
      class="vp-video"
      :class="{ 'vp-video--fading': visualFading }"
      @loadedmetadata="onLoadedMetadata"
      @timeupdate="onTimeUpdate"
      @ended="onEnded"
    />
  </div>
</template>

<script>
import manifest from '../manifest.json';
import $audioBus from '@/helpers/AudioBus';
import $pdfRenderer from '@/helpers/PdfRenderer';

// Mesmos números do player de referência (github.com/tiagoadv7/Player-Video):
// fade-in em passos de 0.05 a cada 100ms, fade-out em passos de 0.05 a cada 50ms,
// fade visual (opacidade) de 1s ao fechar — ver .vp-video no <style> abaixo.
const STEP = 0.05;

export default {
  name: 'PopupVideoPlayerPage',

  data: () => ({
    closingHold:   false, // mantém o <video> montado durante o fade de fechamento
    visualFading:  true,  // começa transparente — só fica visível ao dar play (fade-in)
    imageFading:   true,  // idem, para o modo imagem (sem áudio pra sincronizar)
    pdfFading:     true,  // idem, para o modo PDF (mesma lógica da imagem, uma página por vez)
    // Src de fato ligado no <video> (ver watch de "config.src" abaixo) — não é
    // um alias direto de config.src porque, ao trocar de vídeo com áudio
    // tocando, precisamos esmaecer o volume do vídeo ANTIGO antes de soltar o
    // elemento pro vídeo novo; se o <video> estivesse ligado direto em
    // config.src, a troca (e o load() logo em seguida) já teria cortado o
    // áudio no mesmo instante, sem tempo de rodar fade nenhum.
    renderedSrc:   '',
    _fadeInterval: null,
    _focusHandler: null,
    _lastProgressSent: null,
  }),

  computed: {
    /* ── obrigatórias ── */
    module_id() { return manifest.id; },
    module()    { return this.$modules.get(this.module_id); },

    config() {
      return this.$appdata.get('modules.video_player.config', {}) || {};
    },
    // Minimizar o painel do operador (Index.vue) nunca encerra a projeção —
    // só "Fechar" (que chama stop() antes, ver Index.vue#close), o botão
    // "Fechar" da tela de saída (Screen.vue), ou os controles do próprio
    // player (Parar/ESC). Por isso não depende de
    // "modules.video_player.show"/"minimized" — só de haver algo pra mostrar
    // (fechar derruba isso indiretamente, limpando config.src via stop()).
    shouldRender() {
      return this.closingHold || !!this.config.src;
    },
    imageStyle() {
      const rotation = this.config.rotation || 0;
      const flipScale = this.config.flip ? -1 : 1;
      return { transform: `rotate(${rotation}deg) scaleX(${flipScale})` };
    },
  },

  watch: {
    'config.isPlaying'(playing) {
      if (playing) this._play();
      else this._pauseWithFade();
    },
    'config.stopToken'() {
      if (this.config.mediaType === 'image') { this._closeImageWithFade(true); return; }
      if (this.config.mediaType === 'pdf') { this._closePdfWithFade(true); return; }
      this._stopWithFade();
    },
    'config.volume'(v) {
      const el = this.$refs.video;
      // Enquanto o talkover estiver ativo, o volume "normal" só fica valendo
      // de novo quando o talkover for desligado (ver _applyTalkover).
      if (el && !this._fadeInterval && !this.config.talkover) el.volume = (v ?? 100) / 100;
    },
    'config.talkover'(active) {
      this._applyTalkover(active);
    },
    'config.talkoverLevel'(level) {
      if (this.config.talkover) this._applyTalkover(true, level);
    },
    'config.src'(src) {
      if (this.config.mediaType === 'image') {
        if (src) this._fadeImageIn();
        return;
      }
      if (this.config.mediaType === 'pdf') {
        if (src) this._fadePdfIn();
        return;
      }
      const el = this.$refs.video;
      // Troca de vídeo com áudio tocando (ex.: próximo item da playlist) —
      // esmaece o volume do vídeo atual antes de soltar o elemento pro
      // próximo, em vez de cortar o áudio na hora. Sem áudio tocando (pausado,
      // mudo, ou primeiro vídeo carregando) não tem o que esmaecer — troca na
      // hora, igual antes.
      if (el && this.renderedSrc && !el.paused && el.volume > 0) {
        this._fadeVolume(el.volume, 0, false, () => {
          this.renderedSrc = src;
          this.$nextTick(() => this.$refs.video?.load());
        });
      } else {
        this.renderedSrc = src;
        this.$nextTick(() => this.$refs.video?.load());
      }
    },
    // Botão de próxima/anterior página (Index.vue) — só re-renderiza a
    // página nova no MESMO canvas, sem fade nenhum (troca de página dentro
    // do mesmo PDF é instantânea, igual a virar slide no FreeShow; o fade só
    // acontece ao abrir um PDF novo ou encerrar, ver config.src/stopToken).
    'config.pdfPage'() {
      if (this.config.mediaType === 'pdf' && this.config.src) this._renderPdfPage();
    },
    'config.currentTime'(t) {
      // Seek vindo do controle remoto (Index.vue) — só aplica se a diferença for
      // grande o bastante para não entrar em loop com o próprio timeupdate.
      const el = this.$refs.video;
      if (el && Math.abs(el.currentTime - t) > 0.75) el.currentTime = t;
    },
  },

  methods: {
    onLoadedMetadata() {
      const el = this.$refs.video;
      if (!el) return;
      this.$appdata.set('modules.video_player.config.duration', el.duration || 0);
      el.volume = (this.config.volume ?? 100) / 100;
      if (this.config.isPlaying) this._play();
      this._lastProgressSent = Date.now();
      this.$electron.sendVideoProgress({ currentTime: el.currentTime || 0, duration: el.duration || 0 });
    },
    onTimeUpdate() {
      const el = this.$refs.video;
      if (!el) return;
      this.$appdata.set('modules.video_player.config.currentTime', el.currentTime || 0);
      // Escritas feitas por esta janela (is_popup=true) nunca voltam pra
      // janela principal (ver AppData.js) — sem isso, o painel/barra do
      // rodapé nunca sabiam o tempo real de reprodução e ficavam parados em
      // 0:00. Canal dedicado, throttle de 1s (timeupdate dispara bem mais
      // vezes por segundo — não precisa desse detalhe pra atualizar uma
      // barra de progresso).
      const now = Date.now();
      if (!this._lastProgressSent || now - this._lastProgressSent >= 1000) {
        this._lastProgressSent = now;
        this.$electron.sendVideoProgress({
          currentTime: el.currentTime || 0,
          duration: el.duration || 0,
        });
      }
    },
    onEnded() {
      if (this.config.loop) return;
      this._stopWithFade();
    },

    _play() {
      const el = this.$refs.video;
      if (!el) return;
      // Avisa media/soundmaster para encerrarem qualquer áudio ativo.
      $audioBus.requestFocus('video_player');
      el.play().catch(() => {});
      const target = this.config.talkover
        ? (this.config.talkoverLevel ?? 20) / 100
        : (this.config.volume ?? 100) / 100;
      this._fadeVolume(0, target, true);
      this._fadeVisualIn();
    },
    _pauseWithFade() {
      const el = this.$refs.video;
      if (!el || el.paused) return;
      this._fadeVolume(el.volume, 0, false, () => el.pause());
    },
    _stopWithFade() {
      const el = this.$refs.video;
      if (!el) return;
      this.visualFading = true; // sai da projeção junto com o fade de áudio
      this._fadeVolume(el.volume, 0, false, () => {
        el.pause();
        el.currentTime = 0;
        this.$appdata.set('modules.video_player.config.isPlaying', false);
        this.$appdata.set('modules.video_player.config.currentTime', 0);
        // Limpa o src assim que o fade termina — sem isso, shouldRender
        // continua true (src não fica vazio) e o .vp-popup-root (fundo preto)
        // fica cobrindo a projeção, só com o vídeo pausado e invisível por
        // cima. O fade de áudio (_fadeVolume) já leva ~1s, o mesmo tempo da
        // transição visual (.vp-video), então os dois terminam juntos — uma
        // espera extra aqui só prolongava a tela preta sem motivo.
        this.$appdata.set('modules.video_player.config.src', '');
      });
    },

    // Garante que o navegador registre a opacidade 0 antes de ir para 1 —
    // sem isso, a transição CSS não dispara (mudança de estado no mesmo frame
    // de montagem do elemento não é "observável" para efeito de transition).
    _fadeVisualIn() {
      this.visualFading = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { this.visualFading = false; });
      });
    },

    // Imagem não tem áudio pra sincronizar — só o fade visual (opacidade),
    // mesma técnica de duplo requestAnimationFrame do vídeo.
    _fadeImageIn() {
      this.imageFading = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { this.imageFading = false; });
      });
    },
    // PDF: renderiza a primeira página e só então esmaece pra dentro — sem
    // isso, o fade rodaria sobre o canvas ainda em branco (renderPage é
    // assíncrono) e a página apareceria de repente já com opacidade 1.
    async _fadePdfIn() {
      this.pdfFading = true;
      await this._renderPdfPage();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { this.pdfFading = false; });
      });
    },
    // clearSrc=true (usado pelo botão "Parar exibição"/stopToken): depois do
    // fade, limpa o src para a imagem não reaparecer sozinha se o módulo for
    // reaberto. clearSrc=false (módulo fechado/minimizado): só sai da tela,
    // mantém o src — reabrir mostra a mesma imagem de novo, sem precisar
    // selecioná-la de novo na playlist.
    _closeImageWithFade(clearSrc = false) {
      this.closingHold = true;
      this.imageFading = true;
      setTimeout(() => {
        this.closingHold = false;
        if (clearSrc) this.$appdata.set('modules.video_player.config.src', '');
      }, 1000);
    },

    // Renderiza a página atual do PDF no canvas — pdfjs-dist mantém o
    // documento em cache (ver helpers/PdfRenderer), então trocar de página
    // não relê o arquivo do disco de novo, só a página em si.
    async _renderPdfPage() {
      const canvas = this.$refs.pdfCanvas;
      if (!canvas || !this.config.path) return;
      try {
        await $pdfRenderer.renderPage(this.config.path, this.config.pdfPage || 1, canvas);
      } catch (e) {
        console.error('[video_player] Falha ao renderizar PDF:', e);
      }
    },
    // Mesma lógica de _closeImageWithFade — PDF também não tem áudio pra
    // sincronizar, só o fade visual do canvas.
    _closePdfWithFade(clearSrc = false) {
      this.closingHold = true;
      this.pdfFading = true;
      setTimeout(() => {
        this.closingHold = false;
        if (clearSrc) this.$appdata.set('modules.video_player.config.src', '');
      }, 1000);
    },
    // Fechamento real da janela de saída (botão "Fechar" em Screen.vue, ou
    // qualquer outro caminho que chame closeOutput() direto): o processo
    // principal manda 'output-closing' e já destrói a janela ~450ms depois
    // (FADE_DURATION_MS, ver electron/main.js fadeOutAndClose) — sem espera
    // extra antes disso, ao contrário do ESC (ver _escHandler, que agora só
    // para o vídeo/imagem, igual o botão "Parar", sem fechar a janela). Por
    // isso o fade aqui tem que caber num tempo fixo curto (não nos passos de
    // 0.05 de _fadeVolume) pra não ser cortado no meio pela destruição real.
    _closeWithFade() {
      const el = this.$refs.video;
      if (!el || el.paused) { this.closingHold = false; this.visualFading = false; return; }
      this.closingHold = true;
      this.visualFading = true;
      clearInterval(this._fadeInterval);
      const DURATION = 400;
      const INTERVAL = 40;
      const steps = Math.max(1, Math.round(DURATION / INTERVAL));
      const startVol = el.volume;
      const dec = startVol / steps;
      let n = 0;
      this.$appdata.set('modules.video_player.config.isFading', true);
      this._fadeInterval = setInterval(() => {
        n++;
        el.volume = Math.max(0, startVol - dec * n);
        if (n >= steps) {
          clearInterval(this._fadeInterval);
          this._fadeInterval = null;
          this.$appdata.set('modules.video_player.config.isFading', false);
          el.pause();
          setTimeout(() => { this.closingHold = false; this.visualFading = false; }, 1000);
        }
      }, INTERVAL);
    },

    // Talkover: reduz (ou restaura) o volume do vídeo gradualmente, sem
    // pausar — usado para o operador falar por cima do áudio do vídeo.
    _applyTalkover(active, levelOverride) {
      const el = this.$refs.video;
      if (!el || el.paused) return;
      const target = active
        ? (levelOverride ?? this.config.talkoverLevel ?? 20) / 100
        : (this.config.volume ?? 100) / 100;
      const goingUp = target > el.volume;
      this._fadeVolume(el.volume, target, goingUp);
    },

    // goingUp=true → fade-in (100ms/passo); goingUp=false → fade-out (50ms/passo)
    _fadeVolume(from, to, goingUp, done) {
      const el = this.$refs.video;
      if (!el) return;
      clearInterval(this._fadeInterval);
      let v = from;
      el.volume = Math.max(0, Math.min(1, v));
      this.$appdata.set('modules.video_player.config.isFading', true);
      this._fadeInterval = setInterval(() => {
        v = goingUp ? Math.min(v + STEP, to) : Math.max(v - STEP, to);
        el.volume = Math.max(0, Math.min(1, v));
        if ((goingUp && v >= to) || (!goingUp && v <= to)) {
          clearInterval(this._fadeInterval);
          this._fadeInterval = null;
          this.$appdata.set('modules.video_player.config.isFading', false);
          done?.();
        }
      }, goingUp ? 100 : 50);
    },
  },

  mounted() {
    if (this.config.mediaType === 'image' && this.config.src) this._fadeImageIn();
    if (this.config.mediaType === 'pdf' && this.config.src) this._fadePdfIn();
    // Primeira montagem: nada tocando ainda pra esmaecer — liga direto.
    if (this.config.mediaType !== 'image' && this.config.mediaType !== 'pdf' && this.config.src) this.renderedSrc = this.config.src;

    // Outro dono (ex: SoundMaster tocando uma música da coletânea, ou o Media)
    // pediu foco — para de verdade (não só pausa): o vídeo some da projeção
    // com fade, igual ao botão "Parar", em vez de ficar congelado num quadro
    // pausado por cima da nova música que passou a tocar. O mini player (PIP)
    // também encerra — ele não faz sentido continuar aberto/ativo mostrando
    // um vídeo que não está mais na projeção.
    this._focusHandler = $audioBus.listen('video_player', () => {
      if (this.config.isPlaying) {
        this.$appdata.set('modules.video_player.config.isPlaying', false);
        this.$appdata.set('modules.video_player.config.stopToken', (this.config.stopToken || 0) + 1);
      }
      this.$electron.pipClose();
    });
    // Fechar pelo menu do botão de tela (Screen.vue → $popup.close()) chama
    // closeOutput() direto, sem mexer em "visible" antes — aqui dá tempo de
    // sobra pro fade (a janela só é destruída ~450ms depois deste evento).
    this._closingHandler = this.$electron.on('output-closing', () => {
      if (this.config.mediaType === 'image') this._closeImageWithFade();
      else if (this.config.mediaType === 'pdf') this._closePdfWithFade();
      else this._closeWithFade();
    });
    // ESC aqui tem o MESMO efeito do botão "Parar" (fade completo, sem prazo
    // apertado) — só para o vídeo/imagem, sem fechar a janela de saída
    // inteira. O handler genérico de src/views/Popup.vue já sabe ignorar o
    // ESC quando o módulo ativo é "video_player" (ver handleKeyDown lá), pra
    // não fechar a janela de verdade e cortar esse fade no meio.
    this._escHandler = (e) => {
      if (e.key !== 'Escape') return;
      if (this.config.mediaType === 'image') this._closeImageWithFade(true);
      else if (this.config.mediaType === 'pdf') this._closePdfWithFade(true);
      else this._stopWithFade();
    };
    document.addEventListener('keydown', this._escHandler);
  },
  unmounted() {
    // Se um fade de fechamento estiver em andamento (closingHold), deixa ele
    // terminar sozinho — o componente pode desmontar antes (o <transition>
    // de src/views/Popup.vue não espera o CSS terminar), mas o elemento
    // <video> capturado no closure do setInterval continua tocando e
    // aceitando mudanças de volume mesmo fora da árvore do Vue; limpar o
    // intervalo aqui cortaria o áudio na hora, sem fade nenhum.
    if (!this.closingHold) clearInterval(this._fadeInterval);
    $audioBus.unlisten(this._focusHandler);
    this.$electron.off('output-closing', this._closingHandler);
    document.removeEventListener('keydown', this._escHandler);
  },
};
</script>

<style scoped>
.vp-popup-root {
  position: fixed;
  inset: 0;
  /* Transparente (igual ao resto da janela de saída, ver views/Popup.vue) —
     antes era preto sólido, então a área fora do vídeo/imagem (barras do
     object-fit: contain) e o fade do ESC ficavam pretos em vez de deixar
     ver o que está atrás da projeção. */
  background: transparent;
}
.vp-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 1;
  transition: opacity 1s ease-out;
}
.vp-video--fading { opacity: 0; }

.vp-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 1;
  transition: opacity 1s ease-out, transform 0.25s ease;
}
.vp-image--fading { opacity: 0; }

.vp-pdf {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 1;
  transition: opacity 1s ease-out;
}
.vp-pdf--fading { opacity: 0; }
</style>
