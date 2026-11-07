<template>
  <div class="wl-root" :class="{ 'wl-root--active': ((videoId || url) && !isFading) || loadError }">
    <!-- YouTube: precisa de um elemento próprio pro YT.Player assumir (ele
         substitui esse div por um <iframe> PRÓPRIO dele, sem herdar a classe
         "wl-iframe" nem o tamanho 100%/100% dela — por isso o vídeo aparecia
         pequeno, no tamanho padrão do embed (640x390), num canto da tela.
         Por isso o id fica num wrapper à parte: o wrapper continua sendo
         controlado pelo Vue (tamanho/fade), o YT.Player só troca o filho. -->
    <div
      v-if="videoId"
      class="wl-iframe-wrap"
      :class="{ 'wl-iframe--fading': isFading }"
    >
      <div id="wl-yt-player" />
      <div class="wl-shield" />
    </div>
    <!-- onError do YT.Player (vídeo removido/privado ou com incorporação
         desativada pelo dono — comum em vídeos oficiais de louvor): sem isso
         a projeção ficava com tela preta parada, sem nenhum aviso pro
         operador nem pra quem está assistindo. -->
    <div v-if="loadError" class="wl-error">
      <v-icon icon="mdi-alert-circle-outline" size="40" class="mb-2" />
      <div>{{ loadError }}</div>
    </div>
    <!-- Qualquer outro link (Canva, etc.) — sem controle de reprodução,
         só exibição. -->
    <iframe
      v-else-if="url"
      :src="url"
      class="wl-iframe"
      allow="autoplay; fullscreen; encrypted-media"
      allowfullscreen
      frameborder="0"
    />
  </div>
</template>

<script>
// Mesma cadência de fade do video_player (ver interface/Popup.vue): degraus
// de 5% (equivalente ao STEP=0.05 de lá, só que na escala 0-100 do
// player.setVolume do YouTube), 100ms/passo ao entrar, 50ms/passo ao sair.
import { loadYoutubeApi } from '@/helpers/YoutubeApi';

const STEP = 5;

export default {
  name: 'WebLinkFrame',

  data: () => ({
    player: null,
    isFading: false,
    _fadeInterval: null,
    _playerReady: false,
    _progressInterval: null,
    loadError: null,
  }),

  computed: {
    config() {
      return this.$appdata.get('modules.web_link.config', {}) || {};
    },
    videoId() {
      return this.config.videoId || null;
    },
    // Falso quando o operador tira o link da projeção (popup_module muda): o
    // vídeo segue tocando na janela principal (WebLinkLocalPlayer.vue)
    projecting() {
      return this.$appdata.get('popup_module') === 'web_link';
    },
    url() {
      // Compatibilidade: além do config novo, aceita o formato antigo
      // (só "modules.web_link.url", sem controles) caso algo ainda use.
      return this.config.url || this.$appdata.get('modules.web_link.url', '');
    },
  },

  watch: {
    projecting(on) {
      if (!on) this._leaveProjection();
    },
    videoId(id, oldId) {
      // Não avisa mais a janela principal: ela é quem decide o vídeo (e o som).
      // Antes, ao fechar a projeção, o "vídeo vazio" daqui era repassado para lá
      // e podia cortar o áudio que devia continuar no miniplayer.
      if (this._left || id === oldId) return;
      // Projeção é muda: troca a imagem direto (o fade de áudio é da principal)
      this._teardownPlayer();
      if (id) this._setupPlayer(id);
    },
    // A projeção só mostra a imagem (muda): o som é do player da janela
    // principal (WebLinkLocalPlayer.vue), que é quem manda no play/pausa e no tempo.
    'config.isPlaying'(playing) {
      if (this._left || !this.player || !this._playerReady) return;
      try {
        if (playing) {
          this.isFading = false;
          this.player.playVideo();
        } else {
          this.player.pauseVideo();
        }
      } catch { /* */ }
    },
    // Segue o tempo do player da janela principal (informado a cada 0,25 s).
    // Só a imagem é reposicionada — o som nunca pula.
    'config.current_time'(t) {
      if (this._left || !this.player || !this._playerReady || !this.config.isPlaying) return;
      if (Date.now() < (this._followUntil || 0)) return;
      try {
        const now = this.player.getCurrentTime?.() || 0;
        if (Math.abs(now - t) > 0.35) {
          // Um pouco à frente: o seek do YouTube leva um instante para voltar a tocar
          this.player.seekTo(t + 0.2, true);
          this._followUntil = Date.now() + 1500;
        }
      } catch { /* */ }
    },
    'config.stopToken'() {
      if (this._left || !this.player || !this._playerReady) return;
      this._fadeOutAndStop();
    },
    // Volume ajustado pela barra do rodapé (Footer.vue → $webLink.setVolume) —
    // aplica na hora, igual ao vídeo (ver video_player/interface/Popup.vue
    // Volume não se aplica aqui: a projeção é sempre muda (ver 'config.isPlaying').
    // Seek pedido pela barra do rodapé (clique na barra ou ±10 s) — a imagem
    // vai junto na hora, sem esperar o acompanhamento de 'config.current_time'.
    'config.seekToken'() {
      if (this._left || !this.player || !this._playerReady) return;
      try { this.player.seekTo(this.config.seekTime || 0, true); } catch { /* */ }
    },
  },

  methods: {
    async _setupPlayer(id) {
      await loadYoutubeApi();
      // O componente pode ter desmontado (ou trocado de vídeo de novo)
      // enquanto a API carregava.
      if (this.videoId !== id) return;
      this._playerReady = false;
      this.player = new window.YT.Player('wl-yt-player', {
        // Sem isso, o iframe que a API cria vem no tamanho padrão do embed
        // (640x390) — o CSS (:deep(iframe) 100%/100%) cobre o caso do
        // wrapper não ter dimensão ainda no primeiro paint, mas passar aqui
        // também evita esse vídeo "pequeno no canto" caso a API renderize
        // antes do CSS aplicar.
        width: '100%',
        height: '100%',
        videoId: id,
        playerVars: {
          autoplay: 0,
          controls: 0,
          rel: 0,
          playsinline: 1,
          // Remove legendas automáticas e os "cards"/anotações que o YouTube
          // sobrepõe no vídeo (sugestões, links, etc.) — projeção deve
          // mostrar só o vídeo, sem nenhuma sobreposição da plataforma.
          cc_load_policy: 0,
          iv_load_policy: 3,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            this._playerReady = true;
            // Sempre mudo: o único áudio é o da janela principal
            this.player.mute();
            this._disableCaptions();
            // Começa no ponto em que o áudio está (um pouco à frente, pelo tempo de carregar)
            const resumeAt = this.config.current_time || 0;
            if (resumeAt > 0.5) { try { this.player.seekTo(resumeAt + (this.config.isPlaying ? 0.3 : 0), true); } catch { /* */ } }
            if (this.config.isPlaying) {
              this.isFading = true;
              requestAnimationFrame(() => { requestAnimationFrame(() => { this.isFading = false; }); });
              this.player.playVideo();
            }
          },
          // Vídeo chegou ao fim sozinho (sem clique em "Parar"): sem isso, o
          // iframe do YouTube mostra a própria tela de fim (sugestões de
          // outros vídeos, botão de replay) indefinidamente por cima da
          // projeção — ver capturas do usuário. Reaproveita o mesmo
          // encerramento suave (fade de vídeo+áudio) do botão "Parar".
          //
          // PLAYING também dispara aqui: o módulo de legendas às vezes
          // recarrega sozinho bem no início da reprodução mesmo depois de
          // desligado em onReady (unloadModule feito cedo demais não gruda) —
          // reforça a desativação nesse momento.
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.ENDED) this._fadeOutAndStop();
            if (event.data === window.YT.PlayerState.PLAYING) {
              this._disableCaptions();
              try { this.player.mute(); } catch { /* */ }
            }
          },
          onError: (event) => this._handlePlayerError(event.data),
        },
      });
    },

    // Códigos oficiais da IFrame Player API (developers.google.com/youtube/
    // iframe_api_reference#onError). 101/150 (dono desativou incorporação) e
    // 100 (removido/privado) são os mais comuns na prática — vídeo oficial
    // de louvor com "reprodução em outros sites" desligada, por exemplo. Sem
    // tratar isso, a projeção ficava com tela preta indefinidamente (o
    // player nem chega a disparar onReady em vários desses casos), sem
    // nenhum aviso.
    _handlePlayerError(code) {
      const MESSAGES = {
        2: "Link do vídeo inválido.",
        5: "Não foi possível reproduzir este vídeo.",
        100: "Vídeo não encontrado ou privado.",
        101: "O dono do vídeo desativou a reprodução em outros sites.",
        150: "O dono do vídeo desativou a reprodução em outros sites.",
      };
      this.loadError = MESSAGES[code] || "Não foi possível carregar o vídeo.";
      // Mensagem também na janela principal (a projeção não mostra alertas)
      this.$electron.sendWebLinkProgress({ error: this.loadError });
      // Mesma limpeza de estado do fim natural do vídeo (_fadeOutAndStop),
      // sem fade — nesses erros normalmente não há áudio tocando ainda.
      this.$appdata.set('modules.web_link.config.isPlaying', false);
      this.$appdata.set('modules.web_link.config.url', '');
      this.$appdata.set('modules.web_link.config.videoId', null);
      this.$appdata.set('modules.web_link.config.current_time', 0);
      this.$appdata.set('modules.web_link.config.duration', 0);
      clearTimeout(this._errorClearTimer);
      this._errorClearTimer = setTimeout(() => { this.loadError = null; }, 6000);
    },

    // cc_load_policy:0 (playerVars) nem sempre é suficiente — se o espectador
    // já ativou legendas em QUALQUER vídeo do YouTube nesse navegador antes
    // (ou está com uma conta Google logada com "Sempre mostrar legendas"
    // ativado), essa preferência salva no domínio youtube.com sobrepõe o
    // parâmetro do embed. Combina duas chamadas da API pra forçar mesmo
    // assim: unloadModule tira o módulo de legendas por completo; setOption
    // com track vazio garante que, se o módulo recarregar sozinho (acontece
    // às vezes bem no início da reprodução — por isso chamado de novo no
    // PLAYING), não haja nenhuma faixa selecionada pra exibir.
    _disableCaptions() {
      if (!this.player) return;
      try { this.player.unloadModule('captions'); } catch { /* */ }
      try { this.player.setOption('captions', 'track', {}); } catch { /* */ }
    },

    _teardownPlayer() {
      clearInterval(this._fadeInterval);
      this._fadeInterval = null;
      clearInterval(this._progressInterval);
      this._progressInterval = null;
      this._playerReady = false;
      this.isFading = false;
      try { this.player?.destroy?.(); } catch { /* já destruído */ }
      this.player = null;
    },

    // goingUp=true → 100ms/passo (fade-in); goingUp=false → 50ms/passo
    // (fade-out) — mesma convenção do video_player.
    _fadeVolume(from, to, goingUp, done) {
      clearInterval(this._fadeInterval);
      let v = from;
      this.player.setVolume(Math.max(0, Math.min(100, Math.round(v))));
      this.$appdata.set('modules.web_link.config.isFading', true);
      this._fadeInterval = setInterval(() => {
        v = goingUp ? Math.min(v + STEP, to) : Math.max(v - STEP, to);
        this.player.setVolume(Math.max(0, Math.min(100, Math.round(v))));
        if ((goingUp && v >= to) || (!goingUp && v <= to)) {
          clearInterval(this._fadeInterval);
          this._fadeInterval = null;
          this.$appdata.set('modules.web_link.config.isFading', false);
          done?.();
        }
      }, goingUp ? 100 : 50);
    },

    _fadeTo(target, done) {
      const current = this.player.getVolume?.() ?? 0;
      this._fadeVolume(current, target, target > current, done);
    },

    _fadeInAndPlay() {
      this.isFading = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { this.isFading = false; });
      });
      this.player.playVideo();
      const target = this.config.volume ?? 100;
      this._fadeVolume(this.player.getVolume?.() ?? 0, target, true);
    },

    _fadeOutAndPause() {
      this._fadeVolume(this.player.getVolume?.() ?? 100, 0, false, () => {
        this.player.pauseVideo();
      });
    },

    _fadeOutAndStop() {
      this.isFading = true;
      this._fadeVolume(this.player.getVolume?.() ?? 100, 0, false, () => {
        this.player.pauseVideo();
        try { this.player.seekTo(0, true); } catch { /* */ }
        this.$appdata.set('modules.web_link.config.isPlaying', false);
        this.$appdata.set('modules.web_link.config.url', '');
        this.$appdata.set('modules.web_link.config.videoId', null);
        this.$appdata.set('modules.web_link.config.current_time', 0);
        this.$appdata.set('modules.web_link.config.duration', 0);
      });
    },

    // Link tirado da projeção (botão de tela): esmaece áudio e imagem e pausa,
    // SEM limpar o estado — o vídeo continua na janela principal a partir do
    // current_time que este player reportou por último. Para de reportar o
    // progresso já, para não brigar com o player local durante o crossfade.
    _leaveProjection() {
      this._left = true;
      clearInterval(this._progressInterval);
      this._progressInterval = null;
      if (!this.player || !this._playerReady) return;
      this.isFading = true;
      clearInterval(this._fadeInterval);
      let v = this.player.getVolume?.() ?? 0;
      this._fadeInterval = setInterval(() => {
        v = Math.max(0, v - 10);
        try { this.player.setVolume(v); } catch { /* */ }
        if (v <= 0) {
          clearInterval(this._fadeInterval);
          this._fadeInterval = null;
          try { this.player.pauseVideo(); } catch { /* */ }
        }
      }, 40);
    },

    // Fechamento real da janela de saída — o processo principal manda
    // 'output-closing' e já destrói a janela ~450ms depois (FADE_DURATION_MS,
    // ver electron/main.js fadeOutAndClose), sem esperar nada além disso. O
    // ESC com um link do YouTube projetado chega aqui por esse MESMO caminho
    // (o teclado com foco dentro do iframe de outra origem não propaga
    // keydown pro documento — é interceptado antes, no 'before-input-event'
    // do processo principal, que trata web_link como fechamento direto).
    // Sem isso, o áudio do link cortava seco no instante em que a janela era
    // destruída, em vez de esmaecer — por isso o fade aqui é rápido e cabe no
    // prazo fixo (mesmo padrão do video_player), não os ~1s de _fadeVolume.
    _closeWithFade() {
      if (!this.player || !this._playerReady) return;
      clearInterval(this._fadeInterval);
      // "isFading" (LOCAL, não o de appdata abaixo) é o que de fato dispara o
      // fade visual — liga a classe "wl-iframe--fading" no template (ver
      // :class logo no topo). Sem isso, só o volume esmaecia; a tela cortava
      // seca no instante em que a janela era destruída 400ms depois.
      this.isFading = true;
      const DURATION = 400;
      const INTERVAL = 40;
      const steps = Math.max(1, Math.round(DURATION / INTERVAL));
      const startVol = this.player.getVolume?.() ?? 0;
      const dec = startVol / steps;
      let n = 0;
      this.$appdata.set('modules.web_link.config.isFading', true);
      this._fadeInterval = setInterval(() => {
        n++;
        try { this.player.setVolume(Math.max(0, Math.round(startVol - dec * n))); } catch { /* */ }
        if (n >= steps) {
          clearInterval(this._fadeInterval);
          this._fadeInterval = null;
          try { this.player.pauseVideo(); } catch { /* */ }
          // Mesma limpeza de estado de _fadeOutAndStop() -- sem isso, a barra
          // minimizada do rodapé (Player.vue) continuava lendo um videoId
          // "tocando" que não existe mais (a janela já foi destruída),
          // ficando presa mostrando os controles de um vídeo encerrado.
          this.$appdata.set('modules.web_link.config.isFading', false);
          this.$appdata.set('modules.web_link.config.isPlaying', false);
          this.$appdata.set('modules.web_link.config.url', '');
          this.$appdata.set('modules.web_link.config.videoId', null);
          this.$appdata.set('modules.web_link.config.current_time', 0);
          this.$appdata.set('modules.web_link.config.duration', 0);
        }
      }, INTERVAL);
    },
  },

  mounted() {
    if (this.videoId) this._setupPlayer(this.videoId);
    this._closingHandler = this.$electron.on('output-closing', () => this._closeWithFade());
  },

  beforeUnmount() {
    this._teardownPlayer();
    clearTimeout(this._errorClearTimer);
    this.$electron.off('output-closing', this._closingHandler);
  },
};
</script>

<style scoped>
.wl-root {
  position: fixed;
  inset: 0;
  /* Transparente por padrão (deixa ver o que estiver atrás na projeção, igual
     ao restante da janela de saída — ver views/Popup.vue) — só fica preto
     quando há de fato um link carregado/tocando (clique no item da Liturgia).
     Sem isso, a janela de saída ficava com um fundo preto sólido mesmo sem
     nenhum vídeo/link selecionado ainda. */
  background: transparent;
  transition: background-color 0.4s ease;
}
.wl-root--active {
  background: #000;
}
.wl-iframe {
  width: 100%;
  height: 100%;
  border: none;
  opacity: 1;
  transition: opacity 1s ease-out;
}
.wl-iframe-wrap {
  width: 100%;
  height: 100%;
  opacity: 1;
  transition: opacity 1s ease-out;
}
/* :deep() pq o <iframe> real é criado pela API do YouTube fora do Vue (troca
   a div#wl-yt-player por ele), então não recebe o atributo do scoped CSS. */
/* Esconde o título/canal (topo), o botão compartilhar e o "Mais vídeos"/logo
   (base) que o YouTube desenha DENTRO do iframe — não dá para alcançá-los por
   CSS nem desligá-los por parâmetro. Eles ficam presos às bordas de cima e de
   baixo do player: com o player mais alto que a tela, o vídeo continua do
   mesmo tamanho (cabe pela largura, em tela 16:9) e ganha faixas pretas em
   cima/embaixo, onde esses elementos passam a ser desenhados, fora da tela. */
.wl-iframe-wrap {
  position: relative;
  overflow: hidden;
}
.wl-iframe-wrap :deep(iframe) {
  position: absolute;
  left: 0;
  top: calc(-1 * max(10%, 90px));
  width: 100%;
  height: calc(100% + 2 * max(10%, 90px));
  border: none;
  display: block;
}
/* Camada transparente por cima: o mouse sobre a projeção não faz o YouTube
   mostrar os controles/título de novo */
.wl-shield {
  position: absolute;
  inset: 0;
  z-index: 1;
}
.wl-iframe--fading { opacity: 0; }
.wl-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  text-align: center;
  padding: 0 24px;
  font-size: 1.1rem;
}
</style>
