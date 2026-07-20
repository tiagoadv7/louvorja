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
    // "video" (padrão) ou "image" — imagem não usa play/pause/volume/talkover,
    // só rotation/flip para corrigir orientação na tela de projeção.
    mediaType: "video",
    rotation: 0,
    flip: false,
  };
}

export default {
  toFileUrl,
  isImageFile,

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
    const image = isImageFile(fp);
    const item = {
      id, path: fp, src, name: name || fp.split(/[\\/]/).pop(),
      duration: image ? 0 : null,
      mediaType: image ? "image" : "video",
      rotation: 0,
      flip: false,
    };
    this.setPlaylist([...this.getPlaylist(), item]);

    if (!image) {
      probeDuration(src).then((duration) => {
        this.setPlaylist(this.getPlaylist().map((p) => (p.id === id ? { ...p, duration } : p)));
      });
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
    const image = item.mediaType === "image" || isImageFile(item.path);
    const isProjecting = $appdata.get("popup") && $appdata.get("popup_module") === "video_player";
    this.setConfig({
      src: item.src, path: item.path, name: item.name, currentId: item.id,
      mediaType: image ? "image" : "video",
      rotation: item.rotation || 0,
      flip: !!item.flip,
      isPlaying: isProjecting && !image, currentTime: 0, duration: item.duration || 0,
      loop: false,
    });
  },

  // Monta um item "avulso" (mesmo formato de addToPlaylist) sem gravar na fila
  // persistida — usado por open({ addToPlaylist: false }) para tocar um vídeo
  // sem que ele apareça na playlist do módulo Vídeo.
  _buildTransientItem(fp, name) {
    const src = toFileUrl(fp);
    const image = isImageFile(fp);
    return {
      id: Date.now() + Math.random(),
      path: fp, src, name: name || fp.split(/[\\/]/).pop(),
      mediaType: image ? "image" : "video",
      rotation: 0,
      flip: false,
    };
  },

  // Abre (adiciona se necessário) e já manda tocar — usado por outros módulos
  // (ex. Liturgia) para reproduzir um vídeo ou exibir uma imagem local direto
  // no player/projeção. addToPlaylist:false (padrão true) toca sem gravar o
  // arquivo na fila do módulo Vídeo — reprodução avulsa, ex. item da Liturgia.
  open(fp, name, { addToPlaylist = true } = {}) {
    if (!fp) return;
    const item = addToPlaylist ? this.addToPlaylist(fp, name) : this._buildTransientItem(fp, name);
    // Sem isso, "modules.video_player.show" nunca vira true e o Popup.vue da
    // tela de saída nunca considera o módulo ativo (fica sem renderizar nada).
    $modules.open("video_player");
    this.ensureOutputShowing();
    const image = item.mediaType === "image";
    // Avisa media/soundmaster JÁ AQUI (não só quando o <video> da janela de
    // saída montar) — sem isso, se a janela de saída ainda não estava aberta,
    // o pedido de foco só chegava depois que ela terminasse de carregar, e a
    // música do álbum continuava tocando por cima durante esse intervalo.
    if (!image) $audioBus.requestFocus("video_player");
    this.setConfig({
      src: item.src, path: item.path, name: item.name, currentId: item.id,
      mediaType: image ? "image" : "video",
      rotation: item.rotation || 0,
      flip: !!item.flip,
      isPlaying: !image, currentTime: 0,
      loop: false,
    });
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
