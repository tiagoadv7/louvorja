// Baixa o áudio do Himnario Adventista (espanhol) da API e grava os music_<id>.json
// que o módulo de hinário usa pra tocar e mostrar a letra.
//
// Os nomes dos arquivos no servidor nem sempre batem com o título do hino
// (acentos, ñ, maiúsculas, ¡ ¿), então cada hino testa algumas variantes até achar
// uma que responda 200. Sem áudio no servidor, o music_<id>.json é gravado mesmo
// assim (só com a letra), pra o hino continuar abrindo.
//
// Uso: node scripts/import-hinario-es.mjs <pasta de dados do app>

import fs from "fs";
import path from "path";

const [, , appDataDir] = process.argv;
if (!appDataDir) {
  console.error("Uso: node scripts/import-hinario-es.mjs <pasta de dados do app>");
  process.exit(1);
}

const API_BASE = "https://files.louvorja.com.br/musics/es/Himnario%20Adventista/";
const FOLDER = "Himnario Adventista";
const DB_DIR = path.join(appDataDir, "db");
const AUDIO_DIR = path.join(appDataDir, "config", "musicas", FOLDER);
const DEFAULT_LYRIC_IMAGE = "app-local://imagens/generico_116.jpg";
const CONCURRENCY = 10;

const hymnal = JSON.parse(fs.readFileSync(path.join(DB_DIR, "es_hymnal.json"), "utf8"));
fs.mkdirSync(AUDIO_DIR, { recursive: true });

const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const sentenceCase = (s) => s.toLowerCase().replace(/^(\S)/, (c) => c.toUpperCase());

function candidates(title) {
  const out = new Set();
  for (const base of new Set([title, title.replace(/[¡¿]/g, "").trim()])) {
    for (const v of [base, strip(base), base.replace(/[ñ]/g, "n").replace(/[Ñ]/g, "N")]) {
      out.add(v);
      out.add(sentenceCase(v));
    }
  }
  return [...out];
}

async function exists(name) {
  const url = API_BASE + encodeURIComponent(name) + ".opus";
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok ? url : null;
  } catch {
    return null;
  }
}

async function findRemote(title) {
  for (const name of candidates(title)) {
    const url = await exists(name);
    if (url) return { name, url };
  }
  return null;
}

async function pool(items, worker, size) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await worker(items[i], i);
      }
    }),
  );
  return results;
}

function hmsToSeconds(hms) {
  const [h = 0, m = 0, s = 0] = String(hms || "").split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

function secondsToHms(total) {
  const t = Math.max(0, Math.floor(total));
  return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

// Estrofes: separadas por linha em branco ou por dois espaços (padrão do hinário).
function stanzas(text) {
  const parts = (text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n|\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [""];
}

console.log(`Procurando áudio de ${hymnal.length} hinos...`);
const found = await pool(hymnal, (h) => findRemote(h.name), CONCURRENCY);
const withAudio = hymnal.map((h, i) => ({ h, remote: found[i] })).filter((x) => x.remote);
console.log(`Encontrados no servidor: ${withAudio.length} de ${hymnal.length}`);

console.log("Baixando áudios...");
const failed = [];
async function download({ remote }) {
  const dst = path.join(AUDIO_DIR, `${remote.name}.opus`);
  if (fs.existsSync(dst)) return;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(remote.url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      fs.writeFileSync(dst, Buffer.from(await r.arrayBuffer()));
      return;
    } catch (err) {
      if (attempt === 3) failed.push(`${remote.name}: ${err.message}`);
    }
  }
}
await pool(withAudio, download, CONCURRENCY);
if (failed.length) console.log(`Falhas no download (${failed.length}):\n  ${failed.join("\n  ")}`);

const audioById = new Map(withAudio.map(({ h, remote }) => [h.id_music, remote]));

for (const h of hymnal) {
  const remote = audioById.get(h.id_music);
  const parts = stanzas(h.lyric);
  const duration = h.duration || "00:00:00";
  const total = hmsToSeconds(duration);
  const lyric = parts.map((text, i) => {
    const time = secondsToHms((total * i) / parts.length);
    return {
      id_lyric: h.id_music * 100 + (i + 1),
      id_music: h.id_music,
      lyric: text,
      aux_lyric: "",
      url_image: DEFAULT_LYRIC_IMAGE,
      image_position: null,
      time,
      instrumental_time: time,
      show_slide: 1,
      order: (i + 1) * 10,
    };
  });

  fs.writeFileSync(
    path.join(DB_DIR, `music_${h.id_music}.json`),
    JSON.stringify({
      id_music: h.id_music,
      name: h.name,
      duration,
      instrumental_duration: duration,
      url_image: DEFAULT_LYRIC_IMAGE,
      image_position: null,
      url_music: remote ? remote.url : "",
      url_instrumental_music: "",
      lyric,
      albums: [],
    }),
    "utf8",
  );
}

// Álbum do hinário (id 9000, fora de categorias): é o que o verificador de arquivos
// lê pra conferir e baixar os áudios faltantes em config/musicas/es/Himnario Adventista.
fs.writeFileSync(
  path.join(DB_DIR, "album_9000.json"),
  JSON.stringify({
    id_album: 9000,
    name: "Himnario Adventista",
    folder_name: FOLDER,
    color: "#1565C0",
    url_image: "app-local://imagens/generico_116.jpg",
    categories: [],
    musics: hymnal.map((h, i) => ({
      id_music: h.id_music,
      name: h.name,
      has_instrumental_music: 0,
      duration: h.duration || "00:00:00",
      track: i + 1,
    })),
  }),
  "utf8",
);

console.log(`Pronto: ${hymnal.length} music_<id>.json gravados, ${withAudio.length} com áudio em ${AUDIO_DIR}`);
