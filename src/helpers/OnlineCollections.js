// Coletâneas online (canais/playlists/vídeos do YouTube) — mesmo cliente do
// flute (flute-app-main/src/helpers/services/OnlineCollections.ts). O endpoint
// /onlinevideos é o mesmo usado pelo LouvorJA Delphi e retorna comandos SQL
// separados por "|"; aqui só se extraem os campos dos INSERTs.
//
// Cada lista fica guardada no localStorage: a tela mostra a cópia local na
// hora e atualiza com a rede em seguida (e continua funcionando sem internet
// para o que já foi aberto antes).

const API_TOKEN = "02@v2nFB2Dc";

const API_ORIGIN = (() => {
  try {
    const dbUrl = import.meta.env.VITE_URL_DATABASE;
    if (dbUrl) return new URL(dbUrl).origin;
  } catch { /* */ }
  return "https://api.louvorja.com.br";
})();

// Tupla "VALUES (...)" respeitando aspas simples e o escape '' — vírgulas
// dentro de um título não podem quebrar os campos.
function parseSqlValues(raw) {
  const values = [];
  let i = 0;
  const len = raw.length;
  while (i < len) {
    while (i < len && (raw[i] === " " || raw[i] === ",")) i++;
    if (i >= len) break;
    if (raw[i] === "'") {
      i++;
      let value = "";
      while (i < len) {
        if (raw[i] === "'" && raw[i + 1] === "'") { value += "'"; i += 2; }
        else if (raw[i] === "'") { i++; break; }
        else { value += raw[i]; i++; }
      }
      values.push(value);
    } else {
      const start = i;
      while (i < len && raw[i] !== ",") i++;
      values.push(raw.slice(start, i).trim());
    }
  }
  return values;
}

function parseInsertRows(text) {
  const rows = [];
  for (const statement of text.split("|")) {
    const match = statement.trim().match(/^INSERT INTO \w+\s*\(([^)]+)\)\s*VALUES\s*\((.+)\)$/i);
    if (!match) continue;
    const columns = match[1].split(",").map((c) => c.trim());
    const values = parseSqlValues(match[2]);
    const row = {};
    columns.forEach((col, idx) => { row[col] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

async function fetchRows(tipo, id, lang) {
  const url = `${API_ORIGIN}/onlinevideos?tipo=${tipo}&id=${encodeURIComponent(id)}&atualiza_playlist=1&lang=${lang}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { headers: { "Api-Token": API_TOKEN }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseInsertRows(await response.text());
  } finally {
    clearTimeout(timer);
  }
}

function readCache(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(parsed?.data) && parsed.data.length ? parsed.data : null;
  } catch {
    return null;
  }
}
function writeCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ time: Date.now(), data })); } catch { /* cheio */ }
}

const KEYS = {
  channels: (lang) => `online_channels_cache_${lang}`,
  playlists: (lang, id) => `online_playlists_cache_${lang}_${id}`,
  videos: (lang, id) => `online_videos_cache_playlist_${lang}_${id}`,
  all: (lang) => `online_videos_cache_${lang}`,
};

const mappers = {
  channels: (rows) => rows.filter((r) => r.CANAL_ID).map((r) => ({ id: r.CANAL_ID, name: r.NOME, image: r.IMAGEM })),
  playlists: (rows) => rows.filter((r) => r.PLAYLIST_ID).map((r) => ({ id: r.PLAYLIST_ID, channelId: r.CANAL_ID, name: r.NOME, image: r.IMAGEM })),
  videos: (rows) => rows
    .filter((r) => r.VIDEO_ID)
    .map((r) => ({ id: r.VIDEO_ID, playlistId: r.PLAYLIST_ID, name: r.NOME, position: parseInt(r.POSICAO, 10) || 0, image: r.IMAGEM }))
    .sort((a, b) => a.position - b.position),
};

// Rede primeiro; se falhar, a cópia local; sem nenhuma das duas, erro.
async function load(kind, id, lang) {
  const key = kind === "channels" ? KEYS.channels(lang) : KEYS[kind](lang, id);
  try {
    const list = mappers[kind](await fetchRows(kind === "channels" ? "canais" : kind, id, lang));
    if (list.length) { writeCache(key, list); return list; }
  } catch (err) {
    const cached = readCache(key);
    if (cached) return cached;
    throw err;
  }
  return readCache(key) || [];
}

let memoryAll = {};

export default {
  // Cópia local (instantânea) — null se nunca foi carregada
  cachedChannels: (lang = "pt") => readCache(KEYS.channels(lang)),
  cachedPlaylists: (channelId, lang = "pt") => readCache(KEYS.playlists(lang, channelId)),
  cachedVideos: (playlistId, lang = "pt") => readCache(KEYS.videos(lang, playlistId)),

  getChannels: (lang = "pt") => load("channels", "", lang),
  getPlaylists: (channelId, lang = "pt") => load("playlists", channelId, lang),
  getVideos: (playlistId, lang = "pt") => load("videos", playlistId, lang),

  // Índice de todos os vídeos (com nome do canal e da playlist) para a busca
  // geral — 1 h em memória, 24 h no localStorage, igual ao flute.
  async getAllVideos(lang = "pt") {
    const mem = memoryAll[lang];
    if (mem && Date.now() - mem.time < 3600000) return mem.data;
    try {
      const stored = JSON.parse(localStorage.getItem(KEYS.all(lang)) || "null");
      if (stored?.time && Date.now() - stored.time < 86400000 && stored.data?.length) {
        memoryAll[lang] = stored;
        return stored.data;
      }
    } catch { /* */ }

    const channels = await this.getChannels(lang);
    const playlists = (await Promise.all(channels.map(async (ch) => {
      try { return (await this.getPlaylists(ch.id, lang)).map((p) => ({ ...p, channelName: ch.name })); }
      catch { return []; }
    }))).flat();
    const videos = (await Promise.all(playlists.map(async (pl) => {
      try { return (await this.getVideos(pl.id, lang)).map((v) => ({ ...v, channelName: pl.channelName, playlistName: pl.name })); }
      catch { return []; }
    }))).flat();

    if (videos.length) {
      memoryAll[lang] = { time: Date.now(), data: videos };
      writeCache(KEYS.all(lang), videos);
    }
    return videos;
  },
};
