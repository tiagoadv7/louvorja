/**
 * Patch dos JSONs gerados:
 *  1. Adiciona "categories: []" em todos os album_*.json (sem quebra o openAlbum)
 *  2. Marca álbuns de hinário com "categories: ['hymnal.pt_hymnal']"
 *  3. Gera pt_hymnal.json e pt_hymnal_1996.json para o módulo de hinário
 */

const fs   = require('fs');
const path = require('path');

const DB_DIR = 'D:\\Louvor JA\\LouvorJA\\db';

// Mapeamento: id_album → arquivo hymnal que deve gerar
const HYMNAL_MAP = {
  712: 'pt_hymnal',       // Hinário Adventista (2022)
  629: 'pt_hymnal_1996',  // Hinário Adventista 1996
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (_) { return null; }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
}

// ── 1. Patch categories em todos os album_*.json ──────────────────────────────
console.log('[1/3] Adicionando campo "categories" nos álbuns...');

const albumFiles = fs.readdirSync(DB_DIR).filter(f => f.startsWith('album_') && f.endsWith('.json'));
let patched = 0;

for (const fname of albumFiles) {
  const fpath = path.join(DB_DIR, fname);
  const data  = readJson(fpath);
  if (!data) continue;

  const id = parseInt(fname.replace('album_', '').replace('.json', ''));

  // Define categories: hinários recebem tag especial
  const hymnalFile = HYMNAL_MAP[id];
  data.categories = hymnalFile ? [`hymnal.${hymnalFile}`] : [];

  writeJson(fpath, data);
  patched++;
}
console.log(`    → ${patched} álbuns corrigidos`);

// ── 2. Gera pt_hymnal.json e pt_hymnal_1996.json ──────────────────────────────
console.log('[2/3] Gerando arquivos de hinário...');

for (const [id_album_str, hymnalFile] of Object.entries(HYMNAL_MAP)) {
  const id_album  = parseInt(id_album_str);
  const albumPath = path.join(DB_DIR, `album_${id_album}.json`);
  const album     = readJson(albumPath);

  if (!album) {
    console.warn(`    [AVISO] album_${id_album}.json não encontrado — pulando ${hymnalFile}`);
    continue;
  }

  const musics = album.musics || [];
  const hymnalData = [];

  for (const m of musics) {
    const mPath = path.join(DB_DIR, `music_${m.id_music}.json`);
    const mData = readJson(mPath);

    hymnalData.push({
      id_music:              m.id_music,
      track:                 m.track || 0,
      name:                  m.name  || '',
      duration:              mData?.duration || 0,
      has_instrumental_music: mData?.has_instrumental_music || false,
      url_music:             mData?.url_music || '',
    });
  }

  // Ordena por track
  hymnalData.sort((a, b) => (a.track || 0) - (b.track || 0));

  const outPath = path.join(DB_DIR, `${hymnalFile}.json`);
  writeJson(outPath, hymnalData);
  console.log(`    → ${outPath} (${hymnalData.length} hinos)`);
}

// ── 3. Verifica music_{id}.json: adiciona has_instrumental_music se ausente ──
console.log('[3/3] Verificando campos de música...');
const musicFiles = fs.readdirSync(DB_DIR).filter(f => f.startsWith('music_') && f.endsWith('.json'));
let mPatched = 0;

for (const fname of musicFiles) {
  const fpath = path.join(DB_DIR, fname);
  const data  = readJson(fpath);
  if (!data) continue;

  let changed = false;
  if (data.has_instrumental_music === undefined) {
    data.has_instrumental_music = false;
    changed = true;
  }
  // Garante que slides é array
  if (!Array.isArray(data.slides)) {
    data.slides = [];
    changed = true;
  }
  if (changed) { writeJson(fpath, data); mPatched++; }
}
console.log(`    → ${mPatched} músicas atualizadas`);

// ── Resumo ────────────────────────────────────────────────────────────────────
console.log('');
console.log('════════════════════════════════════════');
console.log(' Patch concluído!');
console.log(`   Álbuns corrigidos : ${patched}`);
console.log(`   Hinários gerados  : ${Object.keys(HYMNAL_MAP).length}`);
console.log(`   Músicas atualizadas: ${mPatched}`);
console.log('');
console.log(' Álbuns com hinário:');
for (const [id, file] of Object.entries(HYMNAL_MAP)) {
  console.log(`   album_${id}.json → categories: ["hymnal.${file}"]`);
  console.log(`   ${file}.json gerado no db/`);
}
console.log('════════════════════════════════════════');
