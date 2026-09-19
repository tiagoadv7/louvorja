/**
 * Corrige todos os album_*.json adicionando:
 *  - color (fundo do módulo — sem ele o texto branco fica invisível)
 *  - has_instrumental_music, duration, url_music em cada música
 */

const fs   = require('fs');
const path = require('path');
const DB   = 'D:\\Louvor JA\\LouvorJA\\db';

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const saveJson = (f, d) => fs.writeFileSync(f, JSON.stringify(d), 'utf8');

// ── 1. Mapa id_album → color (extraído do pt_categories) ─────────────────────
const cats = readJson(path.join(DB, 'pt_categories.json')) || [];
const colorMap = {};
for (const cat of cats) {
  for (const a of (cat.albums || [])) {
    if (a.id_album && a.color) colorMap[a.id_album] = a.color;
  }
}
console.log(`[1/2] ${Object.keys(colorMap).length} cores carregadas do pt_categories.json`);

// ── 2. Atualiza cada album_*.json ─────────────────────────────────────────────
console.log('[2/2] Atualizando album_*.json...');
const albumFiles = fs.readdirSync(DB).filter(f => /^album_\d+\.json$/.test(f));
let updated = 0;

for (const fname of albumFiles) {
  const fpath  = path.join(DB, fname);
  const album  = readJson(fpath);
  if (!album) continue;

  const id = album.id_album;

  // Cor: usa a do categories; fallback neutro escuro
  album.color = colorMap[id] || '#1a1a2e';

  // Completa cada música com dados do music_*.json
  const musics = album.musics || [];
  for (let i = 0; i < musics.length; i++) {
    const m    = musics[i];
    const mPath = path.join(DB, `music_${m.id_music}.json`);
    const md   = readJson(mPath);

    musics[i] = {
      id_music:              m.id_music,
      name:                  m.name  || (md?.name || ''),
      track:                 m.track || 0,
      duration:              md?.duration || 0,
      has_instrumental_music: md?.has_instrumental_music || false,
      url_music:             md?.url_music || '',
      url_instrumental_music: md?.url_instrumental_music || '',
    };
  }
  album.musics = musics;

  saveJson(fpath, album);
  updated++;
}

console.log(`    → ${updated} álbuns atualizados`);
console.log('');
console.log('════════════════════════════════════════');
console.log(' Patch concluído! Campos adicionados:');
console.log('   ✓ color             (fundo visível no módulo)');
console.log('   ✓ duration          (duração das músicas)');
console.log('   ✓ has_instrumental_music');
console.log('   ✓ url_music / url_instrumental_music');
console.log('════════════════════════════════════════');
