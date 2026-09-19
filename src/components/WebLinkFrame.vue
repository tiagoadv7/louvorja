<template>
  <div class="wl-root" :class="{ 'wl-root--active': videoId || url || loadError }">
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
const STEP = 5;

let ytApiPromise = null;
function loadYoutubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

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
    url() {
      // Compatibilidade: além do config novo, aceita o formato antigo
      // (só "modules.web_link.url", sem controles) caso algo ainda use.
      return this.config.url || this.$appdata.get('modules.web_link.url', '');
    },
  },

  watch: {
    videoId(id, oldId) {
      if (id === oldId) return;
      // Troca de vídeo com o anterior tocando: esmaece antes de trocar, em
      // vez de cortar o áudio na hora (mesmo cuidado do video_player).
      if (this.player && this._playerReady && oldId && this.config.isPlaying) {
        this._fadeTo(0, () => {
          this._teardownPlayer();
          if (id) this._setupPlayer(id);
        });
      } else {
        this._teardownPlayer();
        if (id) this._setupPlayer(id);
      }
    },
    'config.isPlaying'(playing) {
      if (!this.player || !this._playerReady) return;
      if (playing) this._fadeInAndPlay();
      else this._fadeOutAndPause();
    },
    'config.stopToken'() {
      if (!this.player || !this._playerReady) return;
      this._fadeOutAndStop();
    },
    // Volume ajustado pela barra do rodapé (Footer.vue → $webLink.setVolume) —
    // aplica na hora, igual ao vídeo (ver video_player/interface/Popup.vue
    // watch 'config.volume'). Ignorado durante um fade (_fadeInterval ativo)
    // pra não brigar com os passos do fade em andamento.
    'config.volume'(v) {
      if (!this.player || !this._playerReady || this._fadeInterval) return;
      this.player.setVolume(Math.max(0, Math.min(100, v ?? 100)));
    },
    // Seek pedido pela barra do rodapé (clique na barra de progresso ou
    // avançar/voltar 10s) — token em vez de observar current_time direto
    // porque current_time é escrito por este mesmo componente a cada poll
    // (ver _startProgressPolling), o que geraria um loop/eco sem sentido.
    'config.seekToken'() {
      if (!this.player || !this._playerReady) return;
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
            this.player.setVolume(0);
            this._disableCaptions();
            if (this.config.isPlaying) this._fadeInAndPlay();
            this._startProgressPolling();
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
            if (event.data === window.YT.PlayerState.PLAYING) this._disableCaptions();
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

    // O IFrame Player da API do YouTube não emite um evento de "timeupdate"
    // (ao contrário do <video> nativo usado pelo video_player) — só dá pra
    // saber o tempo atual perguntando (getCurrentTime), por isso o poll.
    // Alimenta modules.web_link.config.current_time/duration, que a barra do
    // rodapé (Player.vue, source="web_link") usa pra desenhar a barra de
    // progresso, igual ao vídeo/mídia do sistema.
    _startProgressPolling() {
      clearInterval(this._progressInterval);
      this._progressInterval = setInterval(() => {
        if (!this.player || !this._playerReady) return;
        this.$appdata.set('modules.web_link.config.current_time', this.player.getCurrentTime?.() || 0);
        this.$appdata.set('modules.web_link.config.duration', this.player.getDuration?.() || 0);
      }, 500);
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
          this.$appdata.set('modules.web_link.config.isFading', false);
          try { this.player.pauseVideo(); } catch { /* */ }
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
.wl-iframe-wrap :deep(iframe) {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
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
