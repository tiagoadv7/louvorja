// Importa os álbuns em espanhol (pastas "N. JA AAAA - Nome" com arquivos .slja
// e uma subpasta "(audios) ...") pro catálogo local do app: es_categories,
// es_musics, album_<id> e music_<id>, espelhando o que já existe em português.
// IDs ficam numa faixa própria (álbuns 9xxx, músicas 9xxxxx) pra não colidir.
//
// Uso: node scripts/import-albuns-es.mjs <pasta com as pastas de álbuns> <pasta de dados do app>
// A pasta de dados do app é a que contém db/ e config/ (ex.: %APPDATA%\louvorja).

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { pathToFileURL, fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const { default: Slja } = await import(
  pathToFileURL(path.join(here, "..", "src", "helpers", "SljaConverter.js")).href
);

const [, , sourceDir, appDataDir] = process.argv;
if (!sourceDir || !appDataDir) {
  console.error("Uso: node scripts/import-albuns-es.mjs <pasta dos álbuns> <pasta de dados do app>");
  process.exit(1);
}

const DB_DIR = path.join(appDataDir, "db");
const MUSIC_DIR = path.join(appDataDir, "config", "musicas");
const IMG_DIR = path.join(appDataDir, "config", "imagens");
const CAPAS_DIR = path.join(appDataDir, "config", "capas");
const CATEGORY_ID = 90;
const CATEGORY_SLUG = "aym";
const ALBUM_COLORS = ["#1D1D1B", "#2c2c5e", "#C2442D", "#0D6E6E", "#7A3E9D", "#B5651D"];
const DEFAULT_LYRIC_IMAGE = "app-local://imagens/generico_116.jpg";

for (const dir of [DB_DIR, MUSIC_DIR, IMG_DIR]) fs.mkdirSync(dir, { recursive: true });

const normalize = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Os áudios destes álbuns ainda não estão publicados na API (o servidor responde 404
// nesses caminhos), então apontam pro arquivo local, igual aos álbuns em português.
const fileUrl = (p) =>
  "file:///" +
  p
    .replace(/\\/g, "/")
    .split("/")
    .map((seg, i) => (i === 0 && /^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg)))
    .join("/");

function nearestCover(yearLabel) {
  const first = Number(yearLabel.match(/\d{4}/)[0]);
  for (let y = first; y >= 1992; y--) {
    for (const ext of [".bmp", ".jpg"]) {
      if (fs.existsSync(path.join(CAPAS_DIR, `${y}${ext}`))) return `app-local://capas/${y}${ext}`;
    }
  }
  return "app-local://capas/2026.bmp";
}

function audioFilesFor(albumDir) {
  const sub = fs
    .readdirSync(albumDir, { withFileTypes: true })
    .find((e) => e.isDirectory() && e.name.startsWith("(audios)"));
  const map = new Map();
  if (!sub) return map;
  for (const f of fs.readdirSync(path.join(albumDir, sub.name))) {
    const m = f.match(/^(.*) \(audio-(cantado|pista)\)\.mp3$/i);
    if (!m) continue;
    const key = normalize(m[1]);
    const entry = map.get(key) || {};
    entry[m[2].toLowerCase()] = path.join(albumDir, sub.name, f);
    map.set(key, entry);
  }
  return map;
}

function copyIfMissing(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (!fs.existsSync(dst) || fs.statSync(dst).size !== fs.statSync(src).size) fs.copyFileSync(src, dst);
  return dst;
}

async function writeImage(blob, imgName) {
  const bytes = Buffer.from(await blob.arrayBuffer());
  const hash = crypto.createHash("sha1").update(bytes).digest("hex").slice(0, 12);
  const name = `es_${hash}${path.extname(imgName) || ".jpg"}`;
  const dst = path.join(IMG_DIR, name);
  if (!fs.existsSync(dst)) fs.writeFileSync(dst, bytes);
  return `app-local://imagens/${name}`;
}

const albumFolders = fs
  .readdirSync(sourceDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\d+\. JA /.test(e.name))
  .map((e) => {
    const m = e.name.match(/^(\d+)\. JA (\d{4}(?: y \d{4})?) - (.+)$/);
    return { dir: path.join(sourceDir, e.name), no: Number(m[1]), year: m[2], name: m[3].trim() };
  })
  .sort((a, b) => a.no - b.no);

const esCategory = { id_category: CATEGORY_ID, name: "CDs Oficiales/Año", slug: CATEGORY_SLUG, order: 10, albums: [] };
const esMusics = [];
const missingAudio = [];
let totalSongs = 0;

// Cor do álbum espanhol = cor do álbum português do mesmo ano mais recente
// ("2022 y 2023" -> 2023, que é o "2022-2023" do português).
const ptCategories = JSON.parse(fs.readFileSync(path.join(DB_DIR, "pt_categories.json"), "utf8"));
const ptColorByYear = new Map();
for (const category of ptCategories) {
  for (const a of category.albums || []) {
    const years = (a.subtitle || "").match(/\d{4}/g);
    if (years && a.color && !ptColorByYear.has(Number(years.at(-1)))) {
      ptColorByYear.set(Number(years.at(-1)), a.color);
    }
  }
}

// Só empresta playback que já está no disco (pastas portuguesas não baixadas viram link quebrado).
function existsLocal(u) {
  if (u.startsWith("file:")) return fs.existsSync(fileURLToPath(u));
  const match = u.match(/^app-local:\/\/musicas\/(.+)$/);
  return !!match && fs.existsSync(path.join(MUSIC_DIR, decodeURIComponent(match[1])));
}

// Playback (pista) em português por ano e número da faixa: quando o álbum espanhol
// não tem pista própria, usa a do álbum português do mesmo ano na mesma faixa.
const ptPlaybackByYear = new Map();
for (const category of ptCategories) {
  for (const a of category.albums || []) {
    const years = (a.subtitle || "").match(/\d{4}/g);
    if (!years) continue;
    const year = Number(years.at(-1));
    const albumPath = path.join(DB_DIR, `album_${a.id_album}.json`);
    if (ptPlaybackByYear.has(year) || !fs.existsSync(albumPath)) continue;
    const tracks = new Map();
    for (const m of JSON.parse(fs.readFileSync(albumPath, "utf8")).musics || []) {
      const musicPath = path.join(DB_DIR, `music_${m.id_music}.json`);
      if (!fs.existsSync(musicPath)) continue;
      const pb = JSON.parse(fs.readFileSync(musicPath, "utf8")).url_instrumental_music;
      if (pb && existsLocal(pb)) tracks.set(m.track, pb);
    }
    ptPlaybackByYear.set(year, tracks);
  }
}
let playbackFromPortuguese = 0;

for (const album of albumFolders) {
  const albumId = 9000 + album.no;
  const latestYear = Number(album.year.match(/\d{4}/g).pop());
  const albumFolder = `${album.year} - ${album.name}`;
  const albumMusicDir = path.join(MUSIC_DIR, "es", albumFolder);
  const legacyDir = path.join(MUSIC_DIR, albumFolder);
  if (fs.existsSync(legacyDir) && !fs.existsSync(albumMusicDir)) {
    fs.mkdirSync(path.dirname(albumMusicDir), { recursive: true });
    fs.renameSync(legacyDir, albumMusicDir);
  }
  const color = ptColorByYear.get(latestYear) || ALBUM_COLORS[album.no % ALBUM_COLORS.length];
  const cover = nearestCover(album.year);
  const audios = audioFilesFor(album.dir);
  const slijas = fs
    .readdirSync(album.dir)
    .filter((f) => f.toLowerCase().endsWith(".slja"))
    .sort((a, b) => a.localeCompare(b, "es"));

  const albumMusics = [];

  for (const [idx, file] of slijas.entries()) {
    const songName = file.replace(/\.slja$/i, "").trim();
    const track = idx + 1;
    const musicId = 900000 + album.no * 100 + track;
    const parsed = await Slja.loadSlja(fs.readFileSync(path.join(album.dir, file)));
    const slides = parsed.slides;

    const audio = audios.get(normalize(songName)) || {};
    const urlMusic = audio.cantado
      ? fileUrl(copyIfMissing(audio.cantado, path.join(albumMusicDir, `${songName}.mp3`)))
      : "";
    const ptPlayback = ptPlaybackByYear.get(latestYear)?.get(track);
    let urlInstrumental = "";
    if (audio.pista) {
      urlInstrumental = fileUrl(copyIfMissing(audio.pista, path.join(albumMusicDir, `${songName} - PB.mp3`)));
    } else if (ptPlayback) {
      urlInstrumental = ptPlayback;
      playbackFromPortuguese++;
    }
    if (!audio.cantado) missingAudio.push(`${album.year} - ${album.name}: ${songName}`);

    const lyric = [];
    for (const [i, slide] of slides.entries()) {
      const imgName = (slide.imagem || "").replace(/\\/g, "/").replace(/^imagens\//i, "");
      const blob = imgName ? parsed.images.get(imgName) : null;
      const time = Slja.secondsToHms(slide.tempo_seconds || 0);
      lyric.push({
        id_lyric: musicId * 100 + (i + 1),
        id_music: musicId,
        lyric: slide.letra || "",
        aux_lyric: slide.letra_aux || "",
        url_image: blob ? await writeImage(blob, imgName) : DEFAULT_LYRIC_IMAGE,
        image_position: null,
        time,
        instrumental_time: time,
        show_slide: 1,
        order: (i + 1) * 10,
      });
    }

    const lastSeconds = slides.length ? slides[slides.length - 1].tempo_seconds || 0 : 0;
    const duration = Slja.secondsToHms(lastSeconds);
    const hasInstrumental = urlInstrumental ? 1 : 0;

    fs.writeFileSync(
      path.join(DB_DIR, `music_${musicId}.json`),
      JSON.stringify({
        id_music: musicId,
        name: songName,
        duration,
        instrumental_duration: duration,
        url_image: DEFAULT_LYRIC_IMAGE,
        image_position: null,
        url_music: urlMusic,
        url_instrumental_music: urlInstrumental,
        lyric,
        albums: [{ id_album: albumId, name: album.name, track, url_image: cover, order: album.no * 10 }],
      }),
      "utf8",
    );

    const lyricText = lyric.map((l) => l.lyric).filter(Boolean).join("\r\n");
    esMusics.push({
      id_music: musicId,
      name: songName,
      has_instrumental_music: hasInstrumental,
      duration,
      lyric: lyricText,
      albums_names: album.name,
      albums: [
        {
          id_album: albumId,
          name: album.name,
          order: album.no * 10,
          type: "collection",
          pivot: { id_music: musicId, id_album: albumId, track },
        },
      ],
    });

    albumMusics.push({ id_music: musicId, name: songName, has_instrumental_music: hasInstrumental, duration, track });
    totalSongs++;
  }

  fs.writeFileSync(
    path.join(DB_DIR, `album_${albumId}.json`),
    JSON.stringify({
      id_album: albumId,
      name: album.name,
      folder_name: `es/${albumFolder}`,
      color,
      url_image: cover,
      categories: [`collection.${CATEGORY_SLUG}`],
      musics: albumMusics,
    }),
    "utf8",
  );
  // Ano mais recente do rótulo ("2022 y 2023" -> 2023). Ordem: do maior ano pro menor,
  // com 2026 sempre por último.
  const categoryOrder = latestYear >= 2026 ? 0 : (3000 - latestYear) * 100 + album.no;
  esCategory.albums.push({ id_album: albumId, name: album.name, color, url_image: cover, subtitle: album.year, order: categoryOrder });
  console.log(`${album.year} - ${album.name}: ${albumMusics.length} músicas`);
}

fs.writeFileSync(path.join(DB_DIR, "es_categories.json"), JSON.stringify([esCategory]), "utf8");
fs.writeFileSync(path.join(DB_DIR, "es_musics.json"), JSON.stringify(esMusics), "utf8");

console.log(`\nPronto: ${albumFolders.length} álbuns, ${totalSongs} músicas (${playbackFromPortuguese} com playback do português).`);
if (missingAudio.length) console.log(`Sem áudio cantado (${missingAudio.length}):\n  ${missingAudio.join("\n  ")}`);
