/**
 * CustomSongs.js — CRUD de músicas customizadas (Editor de Músicas) no disco.
 *
 * Diferente do violin-app (IndexedDB + biblioteca de áudio/imagem deduplicada
 * por hash), este projeto é um app desktop Electron com acesso real a
 * arquivo — cada música vira uma pasta própria em
 * `userData/custom_songs/<id>/`:
 *   song.json        — metadados + slides
 *   audio/<file>      — áudio anexado (no máximo um por música)
 *   images/<file>     — imagens de fundo dos slides (uma por imagem importada)
 *
 * Sem dedup entre músicas — trade-off aceito por simplicidade (ver plano).
 * Usa só os métodos genéricos de arquivo já expostos por $electron
 * (getPath/readDir/readFile/writeFile/deleteFile/fileExists) — nenhum IPC novo.
 *
 * @category helper-puro-ish — só toca $electron, sem acesso ao store Vuex.
 */
import $electron from "@/helpers/Electron";
import SljaConverter from "@/helpers/SljaConverter";

const ROOT_FOLDER = "custom_songs";
// Único arquivo (não uma pasta por item, como as músicas) — coletâneas não
// têm mídia anexada, só metadados + lista de ids.
const COLLECTIONS_FILE = "_collections.json";

function joinPath(...parts) {
  return parts
    .filter((p) => p !== undefined && p !== null && p !== "")
    .join("/")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/");
}

function extOf(name, fallback = "") {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name || "");
  return m ? m[1].toLowerCase() : fallback;
}

/** Converte um caminho absoluto do SO em URL file:// utilizável em <img>/<audio>. */
function toFileUrl(absPath) {
  return (
    "file:///" +
    absPath
      .replace(/\\/g, "/")
      .split("/")
      .map((seg) => encodeURIComponent(seg).replace(/%3A/g, ":"))
      .join("/")
  );
}

async function rootDir() {
  const userData = await $electron.getPath("userData");
  return joinPath(userData, ROOT_FOLDER);
}

async function songDir(id) {
  return joinPath(await rootDir(), id);
}

function newSlide(overrides = {}) {
  const isFirst = overrides.tipo === "CAPA";
  return {
    id: crypto.randomUUID(),
    tipo: "LETRA",
    letra: "",
    letra_aux: "",
    tamanho_letra: isFirst ? 18 : 14,
    tamanho_letra_aux: 10,
    cor_letra: isFirst ? "#efb400" : "#FFFFFF",
    cor_letra_aux: "#efb400",
    cor_fundo: "#000000",
    imagem: "",
    imagem_posicao: 5,
    fundo_letra: true,
    tempo_seconds: 0,
    text_align: "center",
    ...overrides,
  };
}

function newSong(nome = "Nova música") {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    nome,
    audio_name: "",
    slides: [newSlide({ tipo: "CAPA", letra: nome }), newSlide({ tipo: "LETRA" }), newSlide({ tipo: "LETRA" })],
    createdAt: now,
    updatedAt: now,
  };
}

async function listSongs() {
  const root = await rootDir();
  const entries = (await $electron.readDir(root)) || [];
  const songs = [];
  for (const entry of entries) {
    if (!entry.isDirectory) continue;
    const song = await getSong(entry.name);
    if (song) songs.push(song);
  }
  return songs.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

async function getSong(id) {
  if (!id) return null;
  const jsonPath = joinPath(await songDir(id), "song.json");
  if (!(await $electron.fileExists(jsonPath))) return null;
  const raw = await $electron.readFile(jsonPath, "utf8");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveSong(song) {
  const id = song.id || crypto.randomUUID();
  const updated = { ...song, id, updatedAt: new Date().toISOString() };
  const jsonPath = joinPath(await songDir(id), "song.json");
  await $electron.writeFile(jsonPath, JSON.stringify(updated), "utf8");
  return updated;
}

async function deleteSong(id) {
  const dir = await songDir(id);
  const entries = (await $electron.readDir(dir)) || [];
  for (const entry of entries) {
    if (entry.isDirectory) {
      const sub = (await $electron.readDir(entry.path)) || [];
      for (const file of sub) {
        if (!file.isDirectory) await $electron.deleteFile(file.path);
      }
    } else {
      await $electron.deleteFile(entry.path);
    }
  }
  // Pastas vazias remanescentes não são removidas (sem IPC de rmdir) — cosmético, sem custo real.
}

/** Anexa um áudio à música: apaga um áudio anterior (se houver) e grava o novo. */
async function importAudio(songId, file, fileName) {
  const dir = joinPath(await songDir(songId), "audio");
  const existing = (await $electron.readDir(dir)) || [];
  for (const entry of existing) {
    if (!entry.isDirectory) await $electron.deleteFile(entry.path);
  }
  const name = fileName || file.name || "audio.mp3";
  const buffer = new Uint8Array(await file.arrayBuffer());
  const destPath = joinPath(dir, name);
  await $electron.writeFile(destPath, buffer, null);
  return name;
}

async function removeAudio(songId) {
  const dir = joinPath(await songDir(songId), "audio");
  const entries = (await $electron.readDir(dir)) || [];
  for (const entry of entries) {
    if (!entry.isDirectory) await $electron.deleteFile(entry.path);
  }
}

/** Importa uma imagem de fundo (blob já convertido, ver ImageConvert.ensureRenderableImage). */
async function importImage(songId, blob, fileName) {
  const dir = joinPath(await songDir(songId), "images");
  const ext = extOf(fileName, "png");
  const name = `${crypto.randomUUID()}.${ext}`;
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const destPath = joinPath(dir, name);
  await $electron.writeFile(destPath, buffer, null);
  return name;
}

async function removeImage(songId, imageName) {
  if (!imageName) return;
  const filePath = joinPath(await songDir(songId), "images", imageName);
  await $electron.deleteFile(filePath);
}

async function copyFile(srcPath, destPath) {
  if (!(await $electron.fileExists(srcPath))) return false;
  const data = await $electron.readFile(srcPath, null);
  if (!data) return false;
  await $electron.writeFile(destPath, data, null);
  return true;
}

/** Copia áudio + imagens de uma música pra outra pasta — usado por "Salvar como". */
async function duplicateMedia(oldId, newId) {
  const oldDir = await songDir(oldId);
  const newDir = await songDir(newId);
  for (const sub of ["audio", "images"]) {
    const entries = (await $electron.readDir(joinPath(oldDir, sub))) || [];
    for (const entry of entries) {
      if (!entry.isDirectory) {
        await copyFile(entry.path, joinPath(newDir, sub, entry.name));
      }
    }
  }
}

async function getAudioBlob(songId) {
  const song = await getSong(songId);
  if (!song?.audio_name) return null;
  const filePath = joinPath(await songDir(songId), "audio", song.audio_name);
  if (!(await $electron.fileExists(filePath))) return null;
  const data = await $electron.readFile(filePath, null);
  return data ? new Blob([data]) : null;
}

async function getImageBlob(songId, imageName) {
  if (!imageName) return null;
  const filePath = joinPath(await songDir(songId), "images", imageName);
  if (!(await $electron.fileExists(filePath))) return null;
  const data = await $electron.readFile(filePath, null);
  return data ? new Blob([data]) : null;
}

async function resolveAudioUrl(songId, audioName) {
  if (!audioName) return "";
  const filePath = joinPath(await songDir(songId), "audio", audioName);
  if (!(await $electron.fileExists(filePath))) return "";
  return toFileUrl(filePath);
}

async function resolveImageUrl(songId, imageName) {
  if (!imageName) return "";
  const filePath = joinPath(await songDir(songId), "images", imageName);
  if (!(await $electron.fileExists(filePath))) return "";
  return toFileUrl(filePath);
}

// ── Coletâneas personalizadas ────────────────────────────────────────────
// Agrupam músicas (por id) numa ordem própria — CRUD simples, tudo num único
// JSON (mesma pasta raiz das músicas), sem IPC novo.

function newCollection(nome = "Nova coletânea") {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    nome,
    cor: "#385F73",
    song_ids: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function collectionsFilePath() {
  return joinPath(await rootDir(), COLLECTIONS_FILE);
}

async function listCollections() {
  const path = await collectionsFilePath();
  if (!(await $electron.fileExists(path))) return [];
  const raw = await $electron.readFile(path, "utf8");
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function saveCollectionsList(list) {
  await $electron.writeFile(await collectionsFilePath(), JSON.stringify(list), "utf8");
}

async function saveCollection(collection) {
  const list = await listCollections();
  const idx = list.findIndex((c) => c.id === collection.id);
  const updated = { ...collection, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = updated;
  else list.push(updated);
  await saveCollectionsList(list);
  return updated;
}

async function deleteCollection(id) {
  const list = await listCollections();
  await saveCollectionsList(list.filter((c) => c.id !== id));
}

// ── Import de .slja → objeto "song" ──────────────────────────────────────
// Compartilhado entre slide_editor (abrir um .slja — NÃO persiste, fica só
// em memória até o operador clicar "Salvar", igual sempre foi) e
// custom_collections (importação em lote — chama saveSong() logo depois,
// já que não existe uma sessão de edição pra adiar isso).
async function parseSljaToSong(file) {
  const data = await SljaConverter.loadSlja(file);
  SljaConverter.fillMissingImages(data.slides);

  const id = crypto.randomUUID();
  let audioNameStored = "";
  if (data.audio) {
    audioNameStored = await importAudio(id, data.audio, data.audioName || "audio.mp3");
  }
  const imgNameByOriginal = new Map();
  for (const [path, blob] of (data.images || new Map()).entries()) {
    const name = path.replace(/^(imagens|images)\//, "");
    const stored = await importImage(id, blob, name);
    imgNameByOriginal.set(name, stored);
    imgNameByOriginal.set(path, stored);
  }

  return {
    id,
    nome: SljaConverter.resolveSongName(data, file.name) || "Nova música",
    audio_name: audioNameStored,
    slides: data.slides.map((s) => {
      const imgName = s.imagem ? s.imagem.split(/[\\/]/).pop() : "";
      const stored = imgName ? imgNameByOriginal.get(s.imagem) || imgNameByOriginal.get(imgName) || "" : "";
      return {
        id: crypto.randomUUID(),
        tipo: s.tipo,
        letra: s.letra,
        letra_aux: s.letra_aux,
        tamanho_letra: s.tamanho_letra,
        tamanho_letra_aux: s.tamanho_letra_aux,
        cor_letra: s.cor_letra,
        cor_letra_aux: s.cor_letra_aux,
        cor_fundo: s.cor_fundo,
        imagem: stored,
        imagem_posicao: s.imagem_posicao,
        fundo_letra: s.fundo_letra,
        tempo_seconds: s.tempo_seconds,
        text_align: s.text_align || "center",
      };
    }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default {
  newSlide,
  newSong,
  listSongs,
  getSong,
  saveSong,
  deleteSong,
  importAudio,
  removeAudio,
  importImage,
  removeImage,
  duplicateMedia,
  getAudioBlob,
  getImageBlob,
  resolveAudioUrl,
  resolveImageUrl,
  newCollection,
  listCollections,
  saveCollection,
  deleteCollection,
  parseSljaToSong,
};
