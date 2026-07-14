import $appdata from "@/helpers/AppData";
import $popup from "@/helpers/Popup";
import $modules from "@/helpers/Modules";

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

  // Carrega o item sem tocar (usado ao clicar num item da lista para selecioná-lo).
  selectPlaylistItem(item) {
    const image = item.mediaType === "image" || isImageFile(item.path);
    this.setConfig({
      src: item.src, path: item.path, name: item.name, currentId: item.id,
      mediaType: image ? "image" : "video",
      rotation: item.rotation || 0,
      flip: !!item.flip,
      isPlaying: false, currentTime: 0, duration: item.duration || 0,
    });
  },

  // Abre (adiciona se necessário) e já manda tocar — usado por outros módulos
  // (ex. Liturgia) para reproduzir um vídeo ou exibir uma imagem local direto
  // no player/projeção.
  open(fp, name) {
    if (!fp) return;
    const item = this.addToPlaylist(fp, name);
    // Sem isso, "modules.video_player.show" nunca vira true e o Popup.vue da
    // tela de saída nunca considera o módulo ativo (fica sem renderizar nada).
    $modules.open("video_player");
    this.ensureOutputShowing();
    const image = item.mediaType === "image";
    this.setConfig({
      src: item.src, path: item.path, name: item.name, currentId: item.id,
      mediaType: image ? "image" : "video",
      rotation: item.rotation || 0,
      flip: !!item.flip,
      isPlaying: !image, currentTime: 0,
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
