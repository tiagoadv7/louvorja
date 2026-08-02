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
function toEmbeddableUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtube.com") {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      const shortsMatch = url.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
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
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtube.com" && url.pathname.startsWith("/embed/")) {
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
  };
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

  open(rawUrl) {
    if (!rawUrl) return;
    const url = toEmbeddableUrl(rawUrl);
    const videoId = extractYoutubeVideoId(url);
    this.setConfig({
      url,
      videoId,
      // Sem controle de reprodução pra outros sites (Canva etc.) — só liga
      // o vídeo já tocando quando for de fato um YouTube reconhecido.
      isPlaying: !!videoId,
    });
    $popup.open("web_link");
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
