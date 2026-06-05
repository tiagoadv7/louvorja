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

// ── 1. Indexa todos os MP3 recursivamente ─────────────────────────────────────
console.log('[1/3] Escaneando config/musicas/**/*.mp3...');

// Mapas: nome_lowercase → caminho_completo
// Guarda apenas o primeiro encontrado para cada nome
const byName    = new Map(); // "santo, santo, santo!.mp3" → fullPath
const byNamePB  = new Map(); // "santo, santo, santo! - pb.mp3" → fullPath

function scanDir(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (_) { return; }

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      scanDir(full);
    } else if (/\.mp3$/i.test(e.name)) {
      const key = e.name.toLowerCase();
      // PB = playback/instrumental (sufixo " - pb")
      if (key.endsWith(' - pb.mp3')) {
        if (!byNamePB.has(key)) byNamePB.set(key, full);
      } else {
        if (!byName.has(key)) byName.set(key, full);
      }
    }
  }
}

scanDir(MUSICAS_DIR);
console.log(`    → ${byName.size} MP3 normais, ${byNamePB.size} MP3 PB (instrumental)`);

// ── Helper: busca MP3 pelo nome da música ─────────────────────────────────────
function findMp3(musicName) {
  const key = `${musicName.toLowerCase()}.mp3`;
  return byName.get(key) || null;
}

function findMp3PB(musicName) {
  const key = `${musicName.toLowerCase()} - pb.mp3`;
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

  const mp3     = findMp3(data.name || '');
  const mp3pb   = findMp3PB(data.name || '');

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
    const mp3   = findMp3(h.name || '');
    const mp3pb = findMp3PB(h.name || '');

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
