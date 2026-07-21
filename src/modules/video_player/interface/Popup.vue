<template>
  <div v-if="shouldRender" class="vp-popup-root">
    <img
      v-if="config.mediaType === 'image'"
      :src="config.src"
      class="vp-image"
      :class="{ 'vp-image--fading': imageFading }"
      :style="imageStyle"
    />
    <video
      v-else
      ref="video"
      :src="config.src"
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
    // Versão "esticada"/debounced de isActive — usada no shouldRender do
    // template. Minimizar grava "minimized" e "show" em duas mensagens IPC
    // separadas (ver Modules.js); mesmo na ordem certa, ligar o v-if direto
    // no isActive bruto arriscava desmontar e remontar o <video> inteiro por
    // uma oscilação passageira entre as duas mensagens — o que recarrega o
    // arquivo do zero (perde o áudio/posição), bem mais grave que só um fade.
    // stickyActive só vira false depois de confirmar que isActive continua
    // false por um instante; nunca causa remount por conta própria.
    stickyActive:  true,
    _fadeInterval: null,
    _focusHandler: null,
    _closeDebounce: null,
    _lastProgressSent: null,
  }),

  computed: {
    /* ── obrigatórias ── */
    module_id() { return manifest.id; },
    module()    { return this.$modules.get(this.module_id); },

    isActive() {
      return !!this.$appdata.get('modules.video_player.show') ||
             !!this.$appdata.get('modules.video_player.minimized');
    },
    config() {
      return this.$appdata.get('modules.video_player.config', {}) || {};
    },
    shouldRender() {
      return (this.stickyActive || this.closingHold) && !!this.config.src;
    },
    imageStyle() {
      const rotation = this.config.rotation || 0;
      const flipScale = this.config.flip ? -1 : 1;
      return { transform: `rotate(${rotation}deg) scaleX(${flipScale})` };
    },
  },

  watch: {
    isActive(active) {
      clearTimeout(this._closeDebounce);
      if (active) {
        // Voltou a ficar ativo (ex.: minimizar termina de propagar) — garante
        // que o <video> nunca foi desmontado (stickyActive true) e, se um
        // fade de fechamento estava mesmo em andamento, cancela e restaura
        // volume/reprodução em vez de deixar ele terminar (mudo/pausado).
        this.stickyActive = true;
        this._cancelClose();
        return;
      }
      this._closeDebounce = setTimeout(() => {
        if (this.isActive) return; // voltou a ficar ativo nesse meio-tempo — falso alarme
        this.stickyActive = false;
        if (this.config.mediaType === 'image') this._closeImageWithFade();
        else this._closeWithFade();
      }, 80);
    },
    'config.isPlaying'(playing) {
      if (playing) this._play();
      else this._pauseWithFade();
    },
    'config.stopToken'() {
      if (this.config.mediaType === 'image') { this._closeImageWithFade(true); return; }
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
      this.$nextTick(() => this.$refs.video?.load());
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
    // Fechamento (ESC / fechar a tela de saída): o processo principal só
    // espera ~450ms depois do evento 'output-closing' antes de destruir a
    // janela de verdade (ver electron/main.js fadeOutAndClose), então aqui o
    // fade tem que caber num tempo fixo (não em passos de 0.05 como
    // pause/stop) para não ser cortado no meio.
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

    // Cancela um fade de fechamento em andamento (isActive voltou a true —
    // ex.: minimizar, não fechar de verdade) e restaura o estado normal:
    // volume de volta ao configurado e retoma o play se ainda devia estar
    // tocando. Sem isso, um fade que já tinha começado (por qualquer
    // oscilação) terminava sozinho mudo/pausado mesmo com o módulo ativo.
    _cancelClose() {
      if (!this.closingHold && !this.imageFading && !this._fadeInterval) return;
      clearInterval(this._fadeInterval);
      this._fadeInterval = null;
      this.closingHold = false;
      this.visualFading = false;
      this.imageFading = false;
      this.$appdata.set('modules.video_player.config.isFading', false);

      const el = this.$refs.video;
      if (el && this.config.mediaType !== 'image') {
        const target = this.config.talkover
          ? (this.config.talkoverLevel ?? 20) / 100
          : (this.config.volume ?? 100) / 100;
        el.volume = target;
        if (this.config.isPlaying && el.paused) el.play().catch(() => {});
      }
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
      else this._closeWithFade();
    });
    // ESC tem uma corrida com o fade genérico de src/views/Popup.vue: aquele
    // <transition> desmonta este componente quase na hora (v-if="visible"),
    // bem antes do evento 'output-closing' chegar — então o listener acima
    // nunca dispara nesse caso. Escutar o keydown direto aqui evita a corrida:
    // o fade de áudio começa no exato instante do ESC, junto com o resto.
    this._escHandler = (e) => {
      if (e.key !== 'Escape') return;
      if (this.config.mediaType === 'image') this._closeImageWithFade();
      else this._closeWithFade();
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
    clearTimeout(this._closeDebounce);
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
  background: #000;
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
</style>
