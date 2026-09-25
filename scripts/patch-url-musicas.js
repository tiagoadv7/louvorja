/**
 * Escaneia config/musicas/** e atualiza url_music / url_instrumental_music
 * em todos os music_*.json com o caminho real dos arquivos MP3.
 */

const fs   = require('fs');
const path = require('path');

const INSTALL_DIR = 'D:\\Louvor JA\\LouvorJA';
const MUSICAS_DIR = path.join(INSTALL_DIR, 'config', 'musicas');
const DB_DIR      = path.join(INSTALL_DIR, 'db');

const toFileUrl = (p) => `file:///${p.replace(/\\/g, '/')}`;

// Extrai a subpasta do álbum (ANO - ALBUM) de uma URL de música (API ou file://
// já resolvido antes). Ex: ".../musics/pt/2017 - Eu Creio/Arquivo.mp3" → "2017 - Eu Creio"
function extractAlbumFolder(raw) {
  if (!raw) return null;
  const norm = raw.replace(/\\/g, '/');
  const m = norm.match(/\/(?:musics?(?:\/[a-z]{2})?|musicas)\/([^/?#]+)\//i);
  return m ? decodeURIComponent(m[1]) : null;
}

// ── 1. Indexa todos os MP3 recursivamente ─────────────────────────────────────
console.log('[1/3] Escaneando config/musicas/**/*.mp3...');

// Mapas GLOBAIS (fallback de último recurso, quando o álbum não pôde ser
// identificado): nome_lowercase → caminho_completo. Guardam apenas o primeiro
// encontrado para cada nome — por isso NUNCA devem ser a primeira tentativa:
// títulos genéricos ("Maranata.mp3", "Prefixo de Louvor.mp3" etc.) se repetem
// em dezenas de álbuns diferentes no catálogo, e usar só isso faz duas músicas
// de ids diferentes (álbuns diferentes) apontarem pro MESMO arquivo — foi
// exatamente esse bug que fez o app tocar o áudio errado quando duas músicas
// tinham o mesmo nome em álbuns diferentes.
const byName    = new Map(); // "santo, santo, santo!.mp3" → fullPath
const byNamePB  = new Map(); // "santo, santo, santo! - pb.mp3" → fullPath

// Índices ESCOPADOS por álbum: Map<albumFolderLower, Map<fileNameLower, fullPath>>
// — cada subpasta direta de MUSICAS_DIR (uma por álbum) tem seu próprio índice,
// isolado dos demais.
const byPathName   = new Map();
const byPathNamePB = new Map();
const duplicateNames = new Map(); // fileNameLower → Set<albumFolder>, só pra log

function scanDir(dir, albumFolder) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (_) { return; }

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Um nível abaixo de MUSICAS_DIR = pasta do álbum; mais fundo mantém o mesmo álbum.
      scanDir(full, albumFolder || e.name);
    } else if (/\.mp3$/i.test(e.name)) {
      const key  = e.name.toLowerCase();
      const isPB = key.endsWith(' - pb.mp3');
      const flatMap   = isPB ? byNamePB   : byName;
      const scopedMap = isPB ? byPathNamePB : byPathName;

      if (!flatMap.has(key)) flatMap.set(key, full);
      if (albumFolder) {
        if (!scopedMap.has(albumFolder.toLowerCase())) scopedMap.set(albumFolder.toLowerCase(), new Map());
        scopedMap.get(albumFolder.toLowerCase()).set(key, full);

        if (!duplicateNames.has(key)) duplicateNames.set(key, new Set());
        duplicateNames.get(key).add(albumFolder);
      }
    }
  }
}

scanDir(MUSICAS_DIR, null);
for (const [name, albums] of duplicateNames) if (albums.size < 2) duplicateNames.delete(name);
console.log(`    → ${byName.size} MP3 normais, ${byNamePB.size} MP3 PB (instrumental)`);
if (duplicateNames.size > 0) {
  console.log(`    ⚠ ${duplicateNames.size} nome(s) de arquivo duplicado(s) entre álbuns diferentes:`);
  for (const [name, albums] of duplicateNames) console.log(`      "${name}" em: ${[...albums].join(', ')}`);
}

// ── Helper: busca MP3 pelo nome da música, restrito ao álbum quando conhecido ──
function findMp3(musicName, albumFolder) {
  const key = `${musicName.toLowerCase()}.mp3`;
  if (albumFolder) {
    const scoped = byPathName.get(albumFolder.toLowerCase())?.get(key);
    if (scoped) return scoped;
  }
  return byName.get(key) || null;
}

function findMp3PB(musicName, albumFolder) {
  const key = `${musicName.toLowerCase()} - pb.mp3`;
  if (albumFolder) {
    const scoped = byPathNamePB.get(albumFolder.toLowerCase())?.get(key);
    if (scoped) return scoped;
  }
  return byNamePB.get(key) || null;
}

// ── 2. Atualiza music_*.json ──────────────────────────────────────────────────
console.log('[2/3] Atualizando url_music em music_*.json...');

const musicFiles = fs.readdirSync(DB_DIR).filter(f => /^music_\d+\.json$/.test(f));
let updated = 0, notFound = 0;

for (const fname of musicFiles) {
  const fpath = path.join(DB_DIR, fname);
  let data;
  try { data = JSON.parse(fs.readFileSync(fpath, 'utf8')); }
  catch (_) { continue; }

  // Extrai o álbum da própria URL atual (API ou file:// já resolvido antes)
  // pra restringir a busca e não pegar a música de mesmo nome de OUTRO álbum.
  const albumFolder = extractAlbumFolder(data.url_music) || extractAlbumFolder(data.url_instrumental_music);
  const mp3     = findMp3(data.name || '', albumFolder);
  const mp3pb   = findMp3PB(data.name || '', albumFolder);

  let changed = false;

  const newUrl   = mp3   ? toFileUrl(mp3)   : '';
  const newUrlPB = mp3pb ? toFileUrl(mp3pb) : '';

  if (newUrl && data.url_music !== newUrl) {
    data.url_music = newUrl;
    changed = true;
  }
  if (newUrlPB && data.url_instrumental_music !== newUrlPB) {
    data.url_instrumental_music = newUrlPB;
    // Marca que tem instrumental
    data.has_instrumental_music = true;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(fpath, JSON.stringify(data), 'utf8');
    updated++;
  }
  if (!mp3) notFound++;
}

console.log(`    → ${updated} atualizados, ${notFound} sem MP3 encontrado`);

// ── 3. Atualiza pt_hymnal.json e pt_hymnal_1996.json ─────────────────────────
console.log('[3/3] Atualizando hinários...');

for (const hymnalFile of ['pt_hymnal.json', 'pt_hymnal_1996.json']) {
  const fpath = path.join(DB_DIR, hymnalFile);
  if (!fs.existsSync(fpath)) continue;

  const hymns = JSON.parse(fs.readFileSync(fpath, 'utf8'));
  let hUpdated = 0;

  for (const h of hymns) {
    const albumFolder = extractAlbumFolder(h.url_music) || extractAlbumFolder(h.url_instrumental_music);
    const mp3   = findMp3(h.name || '', albumFolder);
    const mp3pb = findMp3PB(h.name || '', albumFolder);

    if (mp3 && h.url_music !== toFileUrl(mp3)) {
      h.url_music = toFileUrl(mp3);
      hUpdated++;
    }
    if (mp3pb) {
      h.url_instrumental_music = toFileUrl(mp3pb);
      h.has_instrumental_music = true;
    }
  }

  fs.writeFileSync(fpath, JSON.stringify(hymns), 'utf8');
  console.log(`    → ${hymnalFile}: ${hUpdated} hinos com url_music atualizado`);
}

// ── Resumo ────────────────────────────────────────────────────────────────────
console.log('');
console.log('════════════════════════════════════════');
console.log(` Patch url_music concluído!`);
console.log(`   music_*.json atualizados: ${updated}`);
console.log(`   Sem MP3 encontrado:       ${notFound}`);
console.log('════════════════════════════════════════');
