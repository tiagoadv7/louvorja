// Baixa os áudios do Himnario Adventista (espanhol) e grava os music_<id>.json
// que o módulo de hinário usa pra tocar e mostrar a letra.
//
// A API é a fonte da verdade: cada hino tem em /db/music_<id> as URLs exatas do
// cantado (url_music, .opus) e do playback (url_instrumental_music, "- PB.mp3").
// Os nomes dos arquivos não são o título do hino (ñ, acentos e pontuação saem),
// então nada é adivinhado aqui. Nenhum áudio é baixado: o music_<id>.json guarda
// as URLs da API e o player toca direto do servidor (cantado e playback).
//
// Uso: node scripts/import-hinario-es.mjs <pasta de dados do app>

import fs from "fs";
import path from "path";

const [, , appDataDir] = process.argv;
if (!appDataDir) {
  console.error("Uso: node scripts/import-hinario-es.mjs <pasta de dados do app>");
  process.exit(1);
}

const API_DB = "https://api.louvorja.com.br/db";
const FOLDER = "Himnario Adventista";
const DB_DIR = path.join(appDataDir, "db");
const DEFAULT_LYRIC_IMAGE = "app-local://imagens/generico_116.jpg";
const CONCURRENCY = 10;

const hymnal = JSON.parse(fs.readFileSync(path.join(DB_DIR, "es_hymnal.json"), "utf8"));

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

// Registro do hino na API: URLs dos dois áudios e tempo do playback.
async function fetchMusic(id) {
  const r = await fetch(`${API_DB}/music_${id}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const { data } = await r.json();
  return data || null;
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

console.log(`Consultando a API para ${hymnal.length} hinos...`);
const records = await pool(hymnal, async (h) => {
  try {
    return await fetchMusic(h.id_music);
  } catch (err) {
    console.log(`  [${h.id_music}] ${h.name}: ${err.message}`);
    return null;
  }
}, CONCURRENCY);
const byId = new Map(hymnal.map((h, i) => [h.id_music, records[i]]));

const sungCount = records.filter((r) => r?.url_music).length;
const pbCount = records.filter((r) => r?.url_instrumental_music).length;
console.log(`Na API: ${sungCount} cantados e ${pbCount} playbacks de ${hymnal.length} hinos`);

for (const h of hymnal) {
  const remote = byId.get(h.id_music);
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
      url_music: remote?.url_music || "",
      url_instrumental_music: remote?.url_instrumental_music || "",
      lyric,
      albums: [],
    }),
    "utf8",
  );
}

// Álbum do hinário (id 9000, fora de categorias): é o que o verificador de arquivos
// lê pra conferir e baixar os áudios faltantes em config/musicas/<pasta do hinário>.
// Lista os dois arquivos de cada hino: cantado (.opus) e playback (- PB.mp3).
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
      has_instrumental_music: h.has_instrumental_music ?? 0,
      duration: h.duration || "00:00:00",
      track: i + 1,
    })),
  }),
  "utf8",
);

console.log(`Pronto: ${hymnal.length} music_<id>.json gravados em ${DB_DIR} (áudio direto da API)`);
