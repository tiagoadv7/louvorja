import $appdata from "@/helpers/AppData";
import $popup from "@/helpers/Popup";
import $modules from "@/helpers/Modules";

// YouTube e Canva bloqueiam ser exibidos dentro de outra página (iframe) nos
// seus links "normais" (X-Frame-Options / Content-Security-Policy) — só
// funcionam nos formatos específicos de incorporação de cada um. Conferido
// na prática (ver conversa): youtube.com/watch é bloqueado, youtube.com/embed
// não; canva.com/.../view é bloqueado, canva.com/.../view?embed não (mesmo
// parâmetro que o botão "Compartilhar > Incorporar" do próprio Canva gera).
// Aqui a gente aceita o link "normal" que o usuário copia e converte sozinho,
// sem exigir que ele already saiba montar a URL de incorporação certa.
// Além de "www.", cobre os links que o app oficial do YouTube gera ao
// compartilhar no celular ("m.youtube.com") e o subdomínio do YouTube Music
// ("music.youtube.com") — sem isso, esses links caíam no fallback de
// iframe genérico (que o próprio youtube.com/watch bloqueia, ver comentário
// abaixo) e o vídeo não aparecia.
function normalizeHost(hostname) {
  return hostname.replace(/^(www|m|music)\./, "");
}

function toEmbeddableUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = normalizeHost(url.hostname);

    // youtube-nocookie.com é o domínio que o próprio botão "Compartilhar >
    // Incorporar > Ativar modo de privacidade" do YouTube gera — mesmo
    // formato de path, só troca o domínio.
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      const shortsMatch = url.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      // Link de transmissão em andamento/gravada (comum em cultos
      // retransmitidos) e o formato antigo "/v/ID" (pré-HTML5).
      const liveMatch = url.pathname.match(/^\/live\/([^/?]+)/);
      if (liveMatch) return `https://www.youtube.com/embed/${liveMatch[1]}`;
      const oldMatch = url.pathname.match(/^\/v\/([^/?]+)/);
      if (oldMatch) return `https://www.youtube.com/embed/${oldMatch[1]}`;
    }
    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\//, "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    // Anexado manualmente (não via searchParams.set, que geraria "?embed=")
    // pra bater exatamente com o parâmetro testado ("?embed", sem "=").
    if (host === "canva.com" && /^\/design\/[^/]+\/view$/.test(url.pathname)) {
      return url.search ? `${rawUrl}&embed` : `${rawUrl}?embed`;
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
}

// Extrai o ID do vídeo de uma URL do YouTube (já convertida ou não) — usado
// pra saber se o link tem controles de reprodução (play/pause/parar, com
// fade) ou é só um iframe estático (Canva, qualquer outro site).
function extractYoutubeVideoId(rawUrl) {
  try {
    const url = new URL(toEmbeddableUrl(rawUrl));
    const host = normalizeHost(url.hostname);
    if ((host === "youtube.com" || host === "youtube-nocookie.com") && url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/")[2] || null;
    }
    return null;
  } catch {
    return null;
  }
}

function emptyConfig() {
  return {
    url: "",
    videoId: null,
    isPlaying: false,
    volume: 100,
    stopToken: 0,
    isFading: false,
    // current_time/duration: reportados pelo WebLinkFrame.vue (janela de
    // saída, único lugar com acesso à instância real do YT.Player) — usados
    // pela barra do rodapé (Footer.vue) pra mostrar a mesma barra de
    // progresso do video_player/media. seekToken/seekTime: mesmo padrão do
    // stopToken, pra pedir um seek sem duplicar o tempo atual num campo só
    // (que colidiria com o current_time que a própria janela de saída escreve).
    current_time: 0,
    duration: 0,
    seekToken: 0,
    seekTime: 0,
    // Qual item da fila (playlist) está carregado agora — mesmo padrão de
    // "currentId" em helpers/VideoPlayer.js, usado pela UI pra destacar o
    // item ativo na lista.
    currentId: null,
  };
}

function toPlain(v) {
  return JSON.parse(JSON.stringify(v));
}

// Projeta um link (Canva, YouTube, etc.) em tela cheia na janela de saída,
// dentro de um iframe — reaproveita a mesma janela/infra de fade e fechamento
// (ESC, botão "Fechar") já usada pelos outros módulos via $popup.open().
// Para YouTube especificamente, mantém um estado de reprodução (play/pause/
// parar, com fade) igual ao video_player — ver WebLinkFrame.vue, que usa a
// API oficial do player do YouTube (postMessage) pra controlar isso, já que
// o <video> real fica dentro de um iframe de outra origem, inacessível
// diretamente por JS.
export default {
  isYoutube(url) {
    return !!extractYoutubeVideoId(url);
  },
  extractVideoId(url) {
    return extractYoutubeVideoId(url);
  },

  getConfig() {
    return { ...emptyConfig(), ...$appdata.get("modules.web_link.config") };
  },
  setConfig(patch) {
    Object.entries(patch).forEach(([key, value]) => {
      $appdata.set(`modules.web_link.config.${key}`, value);
    });
  },

  // ── Fila de links (Online: YouTube/Canva) ──────────────────────────────
  // Mesmo padrão de fila do módulo Vídeo (ver helpers/VideoPlayer.js): a
  // lista fica persistida em appdata, e cada item guarda a URL ORIGINAL
  // (rawUrl, exatamente como o usuário colou) separada da URL convertida
  // pro embed (url) — renomear um item (editar só o "name") nunca toca em
  // nenhuma das duas, então o link em si nunca se perde ao renomear.
  getPlaylist() {
    return $appdata.get("modules.web_link.playlist") || [];
  },
  setPlaylist(list) {
    $appdata.set("modules.web_link.playlist", toPlain(list));
  },

  // Adiciona um link à fila (sem duplicar por URL original) e retorna o item.
  addToPlaylist(rawUrl, name) {
    if (!rawUrl) return null;
    const existing = this.getPlaylist().find((p) => p.rawUrl === rawUrl);
    if (existing) return existing;

    const url = toEmbeddableUrl(rawUrl);
    const videoId = extractYoutubeVideoId(url);
    const item = {
      id: Date.now() + Math.random(),
      rawUrl, url, videoId,
      name: name || rawUrl,
    };
    this.setPlaylist([...this.getPlaylist(), item]);
    return item;
  },

  // Remove um item da fila (botão de excluir) — se for o item carregado
  // agora, encerra a projeção junto (com fade, quando for YouTube) em vez de
  // deixar um link tocando "órfão", sem mais nenhum item correspondente na
  // lista.
  removeFromPlaylist(id) {
    this.setPlaylist(this.getPlaylist().filter((p) => p.id !== id));
    const cfg = this.getConfig();
    if (cfg.currentId !== id) return;
    if (cfg.videoId) this.stop();
    else this.setConfig({ url: "", videoId: null, currentId: null });
  },

  // Renomeia um item da fila SEM recarregar/alterar a URL — o item some da
  // tela só se o operador clicar nele de novo (selectPlaylistItem), então dá
  // pra editar o nome com o link já carregado na saída sem interromper nada.
  renamePlaylistItem(id, name) {
    this.setPlaylist(this.getPlaylist().map((p) => (p.id === id ? { ...p, name } : p)));
  },

  // Abre a projeção PRINCIPAL, a menos que o operador já tenha marcado
  // "Retorno" pra este link ANTES de dar play sem também marcar a Principal
  // (ver components/buttons/ReturnScreen.vue e Screen.vue) — isso sinaliza
  // que a intenção é mandar só pro monitor de palco, não pra tela principal.
  // O espelho do retorno (WebLinkScreen.vue) lê direto de
  // modules.web_link.config, então funciona sem precisar da janela de saída
  // principal aberta — só NÃO chamar $popup.open aqui já basta pra não abrir
  // a principal. Pra mandar pros dois, o operador clica o botão de Tela
  // também (helpers/Popup.js#open), a qualquer momento.
  _ensureMainShowing() {
    const alreadyOpen = $appdata.get("popup") && $appdata.get("popup_module") === "web_link";
    if (alreadyOpen) return;
    if ($appdata.get("return_popup_module") === "web_link") return;
    $popup.open("web_link");
  },

  // Carrega um item já existente da fila (clique na lista) — mesmo formato
  // de $videoPlayer.selectPlaylistItem, sem duplicar/readicionar o item.
  selectPlaylistItem(item) {
    this.setConfig({
      url: item.url,
      videoId: item.videoId,
      currentId: item.id,
      isPlaying: !!item.videoId,
    });
    this._ensureMainShowing();
  },

  // addToPlaylist:false (padrão true) carrega o link sem gravá-lo na fila —
  // usado por quem só quer tocar um link avulso (ex.: item "link" da
  // Liturgia, que já tem seu próprio nome/URL persistidos ali).
  open(rawUrl, name, { addToPlaylist = true } = {}) {
    if (!rawUrl) return;
    const item = addToPlaylist
      ? this.addToPlaylist(rawUrl, name)
      : { id: null, url: toEmbeddableUrl(rawUrl), videoId: extractYoutubeVideoId(toEmbeddableUrl(rawUrl)) };
    this.setConfig({
      url: item.url,
      videoId: item.videoId,
      currentId: item.id,
      // Sem controle de reprodução pra outros sites (Canva etc.) — só liga
      // o vídeo já tocando quando for de fato um YouTube reconhecido.
      isPlaying: !!item.videoId,
    });
    this._ensureMainShowing();
  },

  togglePlay() {
    const cfg = this.getConfig();
    if (!cfg.videoId) return;
    this.setConfig({ isPlaying: !cfg.isPlaying });
  },

  // Igual a $videoPlayer.isMinimized() (ver VideoPlayer.js) — mas "web_link"
  // não é um módulo registrado (sem "modules.web_link.minimized" próprio, ver
  // Modules.vue), então usa a visibilidade do painel da Liturgia (quem abriu o
  // link) como equivalente: painel escondido/minimizado + vídeo carregado ⇒
  // mostra a barra do rodapé com os controles, senão eles ficam invisíveis.
  isMinimized() {
    return !$appdata.get("modules.liturgia.show", false) && !!this.getConfig().videoId;
  },
  maximize() {
    $modules.open("liturgia");
  },

  setVolume(vol) {
    this.setConfig({ volume: Math.max(0, Math.min(100, vol)) });
  },
  // current_time já é reportado por WebLinkFrame.vue (poll do YT.Player) —
  // aqui só valida os limites e pede o seek via seekToken (ver watch lá),
  // igual ao padrão de stopToken (não dá pra reaproveitar current_time direto
  // porque a própria janela de saída escreve nele a cada poll).
  seekTo(time) {
    const cfg = this.getConfig();
    const seekTime = Math.max(0, Math.min(cfg.duration || 0, time));
    this.setConfig({ seekTime, seekToken: (cfg.seekToken || 0) + 1 });
  },
  seekBy(delta) {
    this.seekTo((this.getConfig().current_time || 0) + delta);
  },

  // Encerra suavemente (fade) e limpa o vídeo atual — a janela de saída
  // continua aberta (igual ao "Parar" do video_player), só o conteúdo some.
  stop() {
    const cfg = this.getConfig();
    if (!cfg.videoId) return;
    const stoppedVideoId = cfg.videoId;
    const stopToken = (cfg.stopToken || 0) + 1;
    this.setConfig({ isPlaying: false, stopToken });
    // Mesmo motivo do video_player (ver VideoPlayer.js#stop): quem realmente
    // limpa videoId/url é a janela de saída (WebLinkFrame.vue), DEPOIS do
    // fade (~1s) — mas por ser is_popup=true lá, essa escrita nunca volta por
    // IPC pra esta janela (ver AppData.js). Sem repetir a limpeza aqui, o
    // painel da Liturgia e a barra do rodapé nunca ficavam sabendo que o
    // vídeo parou (isYoutubeItemActive/isMinimized liam o videoId antigo pra
    // sempre) e continuavam mostrando o item/controles como "tocando" mesmo
    // com a projeção já parada. Só limpa se nada mais recente aconteceu nesse
    // meio-tempo (mesmo videoId e mesmo stopToken que acabamos de gravar).
    setTimeout(() => {
      const current = this.getConfig();
      if (current.videoId === stoppedVideoId && current.stopToken === stopToken) {
        this.setConfig({ videoId: null, url: "", current_time: 0, duration: 0 });
      }
    }, 1100);
  },
};
