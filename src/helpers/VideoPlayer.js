import $appdata from "@/helpers/AppData";
import $popup from "@/helpers/Popup";
import $modules from "@/helpers/Modules";
import $audioBus from "@/helpers/AudioBus";

// Lógica compartilhada do módulo Vídeo (fila/playlist + config de reprodução),
// para que outros módulos (ex. Liturgia) possam adicionar/tocar vídeos no
// mesmo player e na mesma tela de projeção sem duplicar essa lógica.

function toFileUrl(fp) {
  if (!fp) return null;
  const p = fp.replace(/\\/g, "/");
  // Codifica cada segmento (espaços, acentos etc.) sem tocar na letra da
  // unidade do Windows ("C:") nem nas barras — sem isso, qualquer caminho com
  // espaço (ex.: pasta do usuário "Tiago Neves") falha ao carregar (ERR_FILE_NOT_FOUND).
  const driveMatch = p.match(/^([A-Za-z]:)(\/.*)$/);
  if (driveMatch) {
    const [, drive, rest] = driveMatch;
    return `file:///${drive}${rest.split("/").map(encodeURIComponent).join("/")}`;
  }
  const encoded = p.split("/").map(encodeURIComponent).join("/");
  return p.startsWith("/") ? `file://${encoded}` : `file:///${encoded}`;
}

function toPlain(v) {
  return JSON.parse(JSON.stringify(v));
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp"]);
function isImageFile(fp) {
  const ext = (fp || "").split(".").pop()?.toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function isPdfFile(fp) {
  return (fp || "").split(".").pop()?.toLowerCase() === "pdf";
}

// Cria um <video> descartável só para ler a duração do arquivo.
function probeDuration(src) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const finish = (val) => { v.src = ""; resolve(val); };
    v.addEventListener("loadedmetadata", () => finish(v.duration || 0), { once: true });
    v.addEventListener("error", () => finish(0), { once: true });
    setTimeout(() => finish(0), 8000);
    v.src = src;
  });
}

function emptyConfig() {
  return {
    src: "", path: "", name: "", currentId: null,
    isPlaying: false, loop: false,
    volume: 100, talkover: false, talkoverLevel: 20,
    currentTime: 0, duration: 0, isFading: false,
    stopToken: 0,
    // "video" (padrão), "image" ou "pdf" — imagem/pdf não usam
    // play/pause/volume/talkover; imagem só rotation/flip, pdf só
    // pdfPage/pdfPageCount (navegação de página, igual ao FreeShow).
    mediaType: "video",
    rotation: 0,
    flip: false,
    pdfPage: 1,
    pdfPageCount: 0,
  };
}

// "video" (padrão), "image" ou "pdf" — usado em todo lugar que decide o
// mediaType a partir só do caminho do arquivo.
function resolveMediaType(fp) {
  if (isImageFile(fp)) return "image";
  if (isPdfFile(fp)) return "pdf";
  return "video";
}

export default {
  toFileUrl,
  isImageFile,
  isPdfFile,

  getConfig() {
    return { ...emptyConfig(), ...($appdata.get("modules.video_player.config") || {}) };
  },
  // Grava CADA campo individualmente (nunca substitui o objeto config inteiro).
  // Popup.vue (janela de saída) atualiza currentTime/duration/isFading com
  // $appdata.set em campos individuais, e por ser a própria janela de saída
  // (is_popup=true) essas escritas nunca voltam por IPC para a janela
  // principal — a cópia local daqui fica desatualizada nesses campos. Se
  // setConfig substituísse o objeto config inteiro, mandaria esses valores
  // desatualizados (ex. currentTime parado no que era antes) de volta para a
  // janela de saída, fazendo o vídeo "pular" para trás sempre que o operador
  // clicasse em play/pause/volume/etc.
  setConfig(patch) {
    Object.entries(toPlain(patch)).forEach(([key, value]) => {
      $appdata.set(`modules.video_player.config.${key}`, value);
    });
  },

  getPlaylist() {
    return $appdata.get("modules.video_player.playlist") || [];
  },
  setPlaylist(list) {
    $appdata.set("modules.video_player.playlist", toPlain(list));
  },

  // Adiciona um arquivo à fila (sem duplicar por caminho) e retorna o item.
  // Vídeo: a duração é preenchida de forma assíncrona (fica null até então).
  // Imagem: sem duração; guarda rotation/flip próprios para lembrar a correção
  // de orientação da próxima vez que essa mesma imagem for selecionada.
  addToPlaylist(fp, name) {
    if (!fp) return null;
    const existing = this.getPlaylist().find((p) => p.path === fp);
    if (existing) return existing;

    const id = Date.now() + Math.random();
    const src = toFileUrl(fp);
    const mediaType = resolveMediaType(fp);
    const item = {
      id, path: fp, src, name: name || fp.split(/[\\/]/).pop(),
      duration: mediaType === "video" ? null : 0,
      mediaType,
      rotation: 0,
      flip: false,
    };
    this.setPlaylist([...this.getPlaylist(), item]);

    if (mediaType === "video") {
      probeDuration(src).then((duration) => {
        this.setPlaylist(this.getPlaylist().map((p) => (p.id === id ? { ...p, duration } : p)));
      });
    } else if (mediaType === "pdf") {
      // Igual à duração do vídeo acima: descobre a contagem de páginas de
      // forma assíncrona e completa o item na fila depois — sem isso,
      // selectPlaylistItem() nunca saberia até onde ir (pdfPageCount ficaria
      // sempre 0, travando os botões de próxima/anterior página).
      import("@/helpers/PdfRenderer").then(({ default: PdfRenderer }) =>
        PdfRenderer.getPageCount(fp).then((pdfPageCount) => {
          this.setPlaylist(this.getPlaylist().map((p) => (p.id === id ? { ...p, pdfPageCount } : p)));
        })
      ).catch((e) => console.error("[VideoPlayer] Falha ao contar páginas do PDF:", e));
    }

    return item;
  },

  ensureOutputShowing() {
    const alreadyOpen = $appdata.get("popup") && $appdata.get("popup_module") === "video_player";
    if (!alreadyOpen) $popup.open("video_player");
  },

  isMinimized() {
    return $appdata.get("modules.video_player.minimized", false);
  },
  maximize() {
    $modules.open("video_player");
  },

  // Centralizados aqui (em vez de só no Index.vue) para a barra do rodapé
  // poder reutilizar exatamente a mesma lógica de play/pause/parar.
  togglePlay() {
    if (!this.getConfig().src) return;
    const playing = !this.getConfig().isPlaying;
    if (playing) this.ensureOutputShowing();
    this.setConfig({ isPlaying: playing });
  },
  stop() {
    const config = this.getConfig();
    if (!config.src) return;
    const stoppedSrc = config.src;
    const stopToken = (config.stopToken || 0) + 1;
    this.setConfig({ isPlaying: false, stopToken });
    // Popup.vue (janela de saída) já limpa o próprio src localmente após o
    // fade — mas escritas feitas por ela (is_popup=true) nunca voltam pra
    // esta janela (ver AppData.js). Sem limpar também por aqui, o painel e a
    // barra do rodapé nunca sabiam que o vídeo parou e continuavam
    // mostrando-o como "ativo" para sempre. Espera o mesmo tempo do fade
    // visual (1s) e só limpa se nada mais recente aconteceu nesse meio-tempo
    // (mesmo src e mesmo stopToken que acabamos de gravar) — evita apagar o
    // src de um vídeo novo, caso o operador já tenha selecionado outro.
    setTimeout(() => {
      const current = this.getConfig();
      if (current.src === stoppedSrc && current.stopToken === stopToken) {
        this.setConfig({ src: '' });
      }
    }, 1100);
  },
  setVolume(vol) {
    this.setConfig({ volume: Math.max(0, Math.min(100, vol)) });
  },
  // currentTime já é observado por Popup.vue (seek externo) — ver watch
  // 'config.currentTime' lá; aqui só validamos os limites antes de gravar.
  seekTo(time) {
    const config = this.getConfig();
    this.setConfig({ currentTime: Math.max(0, Math.min(config.duration || 0, time)) });
  },
  seekBy(delta) {
    this.seekTo((this.getConfig().currentTime || 0) + delta);
  },

  // Carrega o item da lista (usado ao clicar num item pra selecioná-lo).
  // loop:false — o "Repetir" é por sessão de reprodução, não deve vazar de um
  // vídeo para o próximo só porque ficou marcado em algum item anterior.
  //
  // Se a projeção já estiver selecionada neste módulo (mesma checagem do
  // botão de tela — ver Screen.vue "is_selected"), o item aparece/toca direto
  // na saída ao ser selecionado, sem precisar clicar no botão de novo. Imagem
  // já aparece sozinha (Popup.vue não depende de isPlaying pra exibi-la); aqui
  // só falta o vídeo também tocar automaticamente pra ter o mesmo comportamento.
  selectPlaylistItem(item) {
    const mediaType = item.mediaType || resolveMediaType(item.path);
    const isProjecting = $appdata.get("popup") && $appdata.get("popup_module") === "video_player";
    this.setConfig({
      src: item.src, path: item.path, name: item.name, currentId: item.id,
      mediaType,
      rotation: item.rotation || 0,
      flip: !!item.flip,
      isPlaying: isProjecting && mediaType === "video", currentTime: 0, duration: item.duration || 0,
      loop: false,
      pdfPage: 1,
      pdfPageCount: mediaType === "pdf" ? (item.pdfPageCount || 0) : 0,
    });
  },

  // Monta um item "avulso" (mesmo formato de addToPlaylist) sem gravar na fila
  // persistida — usado por open({ addToPlaylist: false }) para tocar um vídeo
  // sem que ele apareça na playlist do módulo Vídeo.
  _buildTransientItem(fp, name) {
    const src = toFileUrl(fp);
    return {
      id: Date.now() + Math.random(),
      path: fp, src, name: name || fp.split(/[\\/]/).pop(),
      mediaType: resolveMediaType(fp),
      rotation: 0,
      flip: false,
    };
  },

  // Abre (adiciona se necessário) e já manda tocar — usado por outros módulos
  // (ex. Liturgia) para reproduzir um vídeo, exibir uma imagem ou projetar um
  // PDF (página a página, igual ao FreeShow) local direto no player/projeção.
  // addToPlaylist:false (padrão true) toca sem gravar o arquivo na fila do
  // módulo Vídeo — reprodução avulsa, ex. item da Liturgia.
  async open(fp, name, { addToPlaylist = true } = {}) {
    if (!fp) return;
    const item = addToPlaylist ? this.addToPlaylist(fp, name) : this._buildTransientItem(fp, name);
    // Sem isso, "modules.video_player.show" nunca vira true e o Popup.vue da
    // tela de saída nunca considera o módulo ativo (fica sem renderizar nada).
    $modules.open("video_player");
    this.ensureOutputShowing();
    const isVideo = item.mediaType === "video";
    // Avisa media/soundmaster JÁ AQUI (não só quando o <video> da janela de
    // saída montar) — sem isso, se a janela de saída ainda não estava aberta,
    // o pedido de foco só chegava depois que ela terminasse de carregar, e a
    // música do álbum continuava tocando por cima durante esse intervalo.
    // Imagem e PDF não têm áudio próprio — não fazem sentido disputar foco.
    if (isVideo) $audioBus.requestFocus("video_player");

    // PDF precisa saber o total de páginas ANTES de abrir (senão os botões de
    // próxima/anterior não sabem até onde ir) — o helper já mantém o
    // documento em cache, então isso não recarrega o arquivo de novo quando
    // Popup.vue/a prévia do operador forem renderizar a primeira página.
    let pdfPageCount = 0;
    if (item.mediaType === "pdf") {
      try {
        const PdfRenderer = (await import("@/helpers/PdfRenderer")).default;
        pdfPageCount = await PdfRenderer.getPageCount(item.path);
      } catch (e) {
        console.error("[VideoPlayer] Falha ao abrir PDF:", e);
        return;
      }
    }

    this.setConfig({
      src: item.src, path: item.path, name: item.name, currentId: item.id,
      mediaType: item.mediaType,
      rotation: item.rotation || 0,
      flip: !!item.flip,
      isPlaying: isVideo, currentTime: 0,
      loop: false,
      pdfPage: 1,
      pdfPageCount,
    });
  },

  // Navegação de página do PDF — igual ao botão de próxima/anterior slide do
  // FreeShow. Sem áudio/tempo pra falar, só o número da página em si.
  setPdfPage(page) {
    const config = this.getConfig();
    if (config.mediaType !== "pdf" || !config.pdfPageCount) return;
    this.setConfig({ pdfPage: Math.max(1, Math.min(page, config.pdfPageCount)) });
  },
  nextPdfPage() {
    const config = this.getConfig();
    this.setPdfPage((config.pdfPage || 1) + 1);
  },
  prevPdfPage() {
    const config = this.getConfig();
    this.setPdfPage((config.pdfPage || 1) - 1);
  },

  // Gira a imagem atual em incrementos de 90° (normalizado para 0-270) e
  // lembra a correção no item da playlist, para não se perder ao trocar de
  // imagem e voltar depois.
  rotateBy(delta) {
    const current = this.getConfig().rotation || 0;
    const rotation = ((current + delta) % 360 + 360) % 360;
    this.setConfig({ rotation });
    this._persistToCurrentItem({ rotation });
  },

  toggleFlip() {
    const flip = !this.getConfig().flip;
    this.setConfig({ flip });
    this._persistToCurrentItem({ flip });
  },

  _persistToCurrentItem(patch) {
    const currentId = this.getConfig().currentId;
    if (currentId == null) return;
    this.setPlaylist(this.getPlaylist().map((p) => (p.id === currentId ? { ...p, ...patch } : p)));
  },
};
