/**
 * Verifica quais arquivos (áudio, capas, imagens) existem localmente,
 * lendo o banco SQLite do LouvorJA OU os JSON locais já processados.
 *
 * Uso:
 *   node scripts/verificar-arquivos.js [opções]
 *
 * Opções (em qualquer ordem):
 *   --db=<caminho>       Caminho do SQLite (database.db)
 *   --dir=<caminho>      Pasta raiz de instalação (contém config/ e db/)
 *   --modo=sqlite        Força leitura do SQLite (padrão: auto)
 *   --modo=json          Força leitura dos JSON locais (album_*.json)
 *   --csv                Salva resultado em verificar-arquivos-resultado.csv
 *   --ausentes           Lista todos os arquivos ausentes no console
 *
 * Exemplos:
 *   node scripts/verificar-arquivos.js
 *   node scripts/verificar-arquivos.js --dir="C:\LouvorJA" --csv
 *   node scripts/verificar-arquivos.js --db="C:\LouvorJA\config\database.db" --csv --ausentes
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Argumentos ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const getArg = (key) => { const a = argv.find(a => a.startsWith(`--${key}=`)); return a ? a.slice(key.length + 3) : null; };
const hasFlag = (flag) => argv.includes(`--${flag}`);

const MODO_ARG = getArg('modo') || 'auto';     // 'auto' | 'sqlite' | 'json'
const SAVE_CSV = hasFlag('csv');
const LIST_ALL = hasFlag('ausentes');

// ── Caminhos ─────────────────────────────────────────────────────────────────
const ROAMING_DIR = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'LouvorJA')
  : path.join(os.homedir(), 'AppData', 'Roaming', 'LouvorJA');

// Diretório raiz: argumento > louvorja-store.json (db_local_folder customizado) > APPDATA\LouvorJA
function resolveInstallDir() {
  if (getArg('dir')) return getArg('dir');
  // Lê store para descobrir pasta customizada
  const storePath = path.join(ROAMING_DIR, 'louvorja-store.json');
  if (fs.existsSync(storePath)) {
    try {
      const s = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (s.db_local_folder && fs.existsSync(s.db_local_folder)) return path.dirname(s.db_local_folder);
    } catch (_) {}
  }
  return ROAMING_DIR;
}

const INSTALL_DIR = resolveInstallDir();
const DB_PATH     = getArg('db') || path.join(INSTALL_DIR, 'config', 'database.db');
const DB_DIR      = path.join(INSTALL_DIR, 'db');
const CONFIG_DIR  = path.join(INSTALL_DIR, 'config');
const OUT_CSV     = path.join(__dirname, 'verificar-arquivos-resultado.csv');

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const C = { reset:'\x1b[0m', green:'\x1b[32m', red:'\x1b[31m', yellow:'\x1b[33m', cyan:'\x1b[36m', bold:'\x1b[1m', dim:'\x1b[2m' };
const ok   = (s) => `${C.green}✓${C.reset} ${s}`;
const fail = (s) => `${C.red}✗${C.reset} ${s}`;
const info = (s) => `${C.cyan}[INFO]${C.reset} ${s}`;
const warn = (s) => `${C.yellow}[AVISO]${C.reset} ${s}`;

// ── Lógica de busca de arquivo ────────────────────────────────────────────────

/** Sanitiza nome de pasta como o Electron faz em ipc.js */
function sanitizeDir(name) {
  return (name || 'Desconhecido')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 80) || 'Desconhecido';
}

/** Extrai nome do arquivo de uma URL ou caminho */
function safeBasename(raw) {
  if (!raw) return '';
  try {
    const clean = raw.split('?')[0].split('#')[0];
    return path.basename(clean) || '';
  } catch (_) { return ''; }
}

/**
 * Procura um arquivo em múltiplos locais:
 *  1. Caminho completo relativo (com subpasta de álbum)
 *  2. Versão plana (apenas config/{tipo}/{fileName})
 *  3. Diretamente em config/ (arquivos adicionais)
 *  Retorna o primeiro caminho encontrado, ou null.
 */
function findFile(fileName, relDir, tipo) {
  const candidates = new Set();

  // 1. Caminho original do SQLite (ex: config\musicas\Hinário Adventista\)
  if (relDir) candidates.add(path.join(INSTALL_DIR, relDir, fileName));

  // 2. Plano por tipo (sem subpasta de álbum)
  if (tipo === 'MUSICA' || tipo === 'MUSICA_PB') {
    candidates.add(path.join(CONFIG_DIR, 'musicas', fileName));
    // Sem o sufixo " - PB" para busca aproximada
    if (tipo === 'MUSICA_PB') {
      const base = fileName.replace(/\s*-\s*PB(\.[^.]+)$/i, '$1');
      candidates.add(path.join(CONFIG_DIR, 'musicas', base));
    }
  } else if (tipo === 'IMAGEM_ALBUM') {
    candidates.add(path.join(CONFIG_DIR, 'capas', fileName));
  } else if (tipo === 'IMAGEM_FUNDO_CAPA') {
    candidates.add(path.join(CONFIG_DIR, 'imagens', fileName));
  } else {
    // ARQUIVOS_ADICIONAIS e outros
    candidates.add(path.join(CONFIG_DIR, fileName));
    candidates.add(path.join(INSTALL_DIR, fileName));
  }

  // 3. Também tenta em ROAMING caso install dir seja diferente
  if (INSTALL_DIR !== ROAMING_DIR) {
    if (relDir) candidates.add(path.join(ROAMING_DIR, relDir, fileName));
    candidates.add(path.join(ROAMING_DIR, 'config', 'musicas', fileName));
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ── Modo JSON: lê album_*.json e music_*.json ─────────────────────────────────

function scanFromJson() {
  if (!fs.existsSync(DB_DIR)) return null;
  const albumFiles = fs.readdirSync(DB_DIR).filter(f => f.startsWith('album_') && f.endsWith('.json'));
  if (!albumFiles.length) return null;

  const results = [];
  const seen    = new Set();

  const addFile = (rawUrl, albumName, tipo) => {
    if (!rawUrl) return;
    const name = safeBasename(rawUrl);
    if (!name || seen.has(`${tipo}:${name}`)) return;
    seen.add(`${tipo}:${name}`);

    // Monta diretório relativo esperado (como o app cria)
    let relDir = '';
    if (tipo === 'audio') {
      relDir = path.join('config', 'musicas', sanitizeDir(albumName));
    } else if (tipo === 'cover') {
      relDir = path.join('config', 'capas', sanitizeDir(albumName));
    } else if (tipo === 'image') {
      relDir = path.join('config', 'imagens', sanitizeDir(albumName));
    }

    const tipoSqlite = tipo === 'audio' ? 'MUSICA' : tipo === 'cover' ? 'IMAGEM_ALBUM' : 'IMAGEM_FUNDO_CAPA';
    const foundAt    = findFile(name, relDir, tipoSqlite);
    results.push({ tipo: tipoSqlite, fileName: name, relPath: path.join(relDir, name), tamanho: 0, foundAt });
  };

  for (const albumFile of albumFiles) {
    let albumData;
    try { albumData = JSON.parse(fs.readFileSync(path.join(DB_DIR, albumFile), 'utf8')); }
    catch (_) { continue; }

    const albumName = albumData.name || albumFile.replace(/\.json$/, '');
    addFile(albumData.url_image, albumName, 'cover');

    for (const music of (albumData.musics || [])) {
      const mFile = path.join(DB_DIR, `music_${music.id_music}.json`);
      if (!fs.existsSync(mFile)) continue;
      let md;
      try { md = JSON.parse(fs.readFileSync(mFile, 'utf8')); }
      catch (_) { continue; }

      addFile(md.url_music, albumName, 'audio');
      addFile(md.url_instrumental_music, albumName, 'audio');
      addFile(md.url_image, albumName, 'image');

      const slides = Array.isArray(md.slides)
        ? md.slides
        : (md.lyric && typeof md.lyric === 'object' ? Object.values(md.lyric) : []);
      for (const s of slides) addFile(s?.url_image, albumName, 'image');
    }
  }

  return results.length ? results : null;
}

// ── Modo SQLite ───────────────────────────────────────────────────────────────

async function scanFromSqlite() {
  if (!fs.existsSync(DB_PATH)) return null;

  const initSqlJs = require(path.join(__dirname, '..', 'node_modules', 'sql.js'));
  const wasmPath  = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL  = await initSqlJs({ locateFile: () => wasmPath });
  const buf  = fs.readFileSync(DB_PATH);

  if (buf.length < 100) return null; // arquivo vazio ou inválido

  const db   = new SQL.Database(new Uint8Array(buf));
  const query = (sql) => { const r = db.exec(sql); if (!r[0]) return []; const { columns, values } = r[0]; return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]]))); };
  const hasTable = (t) => { const r = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${t}'`); return !!(r[0] && r[0].values.length); };
  const colsOf   = (t) => { const r = db.exec(`PRAGMA table_info(${t})`); return r[0] ? r[0].values.map(v => v[1]) : []; };

  if (!hasTable('files')) { db.close(); return null; }

  const fCols   = colsOf('files');
  const hasDir  = fCols.includes('dir');
  const tipoCol = fCols.includes('tipo') ? 'tipo' : fCols.includes('type') ? '"type"' : null;
  const sizeCol = fCols.includes('tamanho') ? 'tamanho' : fCols.includes('size') ? 'size AS tamanho' : '0 AS tamanho';

  const selectCols = ['id_file', 'file_name', hasDir ? 'dir' : "'' AS dir", tipoCol ? tipoCol : "'' AS tipo", sizeCol].join(', ');
  const rows = query(`SELECT ${selectCols} FROM files ORDER BY ${tipoCol || '1'}, dir, file_name`);

  console.log(info(`Colunas da tabela files: ${fCols.join(', ')}`));
  console.log('');

  const results = [];
  for (const row of rows) {
    const tipo     = (row.tipo || 'OUTRO').trim();
    const fileName = (row.file_name || '').trim();
    const dir      = (row.dir || '').trim();
    const tamanho  = Number(row.tamanho) || 0;
    if (!fileName) continue;

    const relPath = dir ? path.join(dir, fileName) : fileName;
    const foundAt = findFile(fileName, dir, tipo);
    results.push({ tipo, fileName, relPath, tamanho, foundAt });
  }

  db.close();
  return results;
}

// ── Relatório ─────────────────────────────────────────────────────────────────

function buildBar(pct, width) {
  const f = Math.round((pct / 100) * width);
  return `[${'█'.repeat(f)}${'░'.repeat(width - f)}]`;
}

function fmtMB(bytes) { return bytes > 0 ? `${(bytes / 1048576).toFixed(1)} MB` : '-'; }

function csvEsc(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function printReport(results, modo) {
  const stats   = {};
  const missing = [];

  for (const r of results) {
    if (!stats[r.tipo]) stats[r.tipo] = { total: 0, found: 0, missing: 0, size_missing: 0 };
    stats[r.tipo].total++;
    if (r.foundAt) {
      stats[r.tipo].found++;
    } else {
      stats[r.tipo].missing++;
      stats[r.tipo].size_missing += r.tamanho;
      missing.push(r);
    }
  }

  console.log(`${C.bold}Resultado por tipo: ${C.dim}(modo: ${modo})${C.reset}`);
  console.log('');

  const typeOrder = ['MUSICA', 'MUSICA_PB', 'IMAGEM_ALBUM', 'IMAGEM_FUNDO_CAPA', 'ARQUIVOS_ADICIONAIS'];
  const keys      = [...typeOrder.filter(k => stats[k]), ...Object.keys(stats).filter(k => !typeOrder.includes(k))];
  let totalAll    = { total: 0, found: 0, missing: 0, size_missing: 0 };

  for (const tipo of keys) {
    const s   = stats[tipo];
    totalAll.total        += s.total;
    totalAll.found        += s.found;
    totalAll.missing      += s.missing;
    totalAll.size_missing += s.size_missing;

    const pct  = s.total > 0 ? Math.round((s.found / s.total) * 100) : 0;
    const icon = s.missing === 0 ? C.green + '●' + C.reset : s.found === 0 ? C.red + '●' + C.reset : C.yellow + '●' + C.reset;
    const miss = s.missing > 0 ? ` ${C.red}faltam ${s.missing}${C.reset} ~${fmtMB(s.size_missing)}` : '';
    console.log(`  ${icon} ${C.bold}${tipo.padEnd(24)}${C.reset} ${buildBar(pct, 20)} ${String(s.found).padStart(5)}/${s.total} (${pct}%)${miss}`);
  }

  const totalPct = totalAll.total > 0 ? Math.round((totalAll.found / totalAll.total) * 100) : 0;
  console.log('');
  console.log(`  ${C.bold}TOTAL                    ${buildBar(totalPct, 20)} ${totalAll.found}/${totalAll.total} (${totalPct}%)${C.reset}`);
  if (totalAll.missing > 0) {
    console.log(`  ${C.red}${C.bold}Arquivos ausentes: ${totalAll.missing}${C.reset}${totalAll.size_missing > 0 ? ` (estimado: ~${fmtMB(totalAll.size_missing)})` : ''}`);
  } else {
    console.log(`  ${C.green}${C.bold}Todos os arquivos encontrados!${C.reset}`);
  }
  console.log('');

  // Lista ausentes no console
  if (LIST_ALL && missing.length > 0) {
    console.log(`${C.bold}Arquivos ausentes:${C.reset}`);
    for (const m of missing) {
      const sz = m.tamanho > 0 ? ` ${C.dim}(${fmtMB(m.tamanho)})${C.reset}` : '';
      console.log(`  ${C.red}✗${C.reset} [${m.tipo.padEnd(20)}] ${m.relPath}${sz}`);
    }
    console.log('');
  } else if (!LIST_ALL && missing.length > 0) {
    console.log(`  ${C.dim}Use --ausentes para listar os ${missing.length} arquivos ausentes no console.${C.reset}`);
    console.log('');
  }

  // CSV
  if (SAVE_CSV) {
    const lines = ['tipo,arquivo,caminho_relativo,tamanho_bytes,status,encontrado_em'];
    for (const r of results) {
      lines.push([csvEsc(r.tipo), csvEsc(r.fileName), csvEsc(r.relPath), r.tamanho, r.foundAt ? 'OK' : 'AUSENTE', csvEsc(r.foundAt || '')].join(','));
    }
    fs.writeFileSync(OUT_CSV, lines.join('\r\n'), 'utf8');
    console.log(ok(`CSV salvo em: ${OUT_CSV}`));
    console.log('');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log(`${C.bold}=== Verificador de Arquivos — LouvorJA ===${C.reset}`);
  console.log('');
  console.log(info(`Pasta raiz    : ${INSTALL_DIR}`));
  console.log(info(`Pasta config/ : ${CONFIG_DIR}`));
  console.log(info(`Pasta db/     : ${DB_DIR}`));
  console.log(info(`Banco SQLite  : ${DB_PATH}`));
  console.log(info(`Roaming       : ${ROAMING_DIR}`));
  console.log('');

  let results = null;
  let modoUsado = '';

  // Tenta SQLite primeiro (se explícito ou auto e o arquivo existe e não está vazio)
  if (MODO_ARG === 'sqlite' || (MODO_ARG === 'auto' && fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 100)) {
    console.log(info('Tentando ler do banco SQLite...'));
    results   = await scanFromSqlite();
    modoUsado = 'sqlite';
    if (!results) console.log(warn('SQLite inválido ou sem tabela "files". Tentando JSON local...'));
  }

  // Fallback: JSON locais
  if (!results && MODO_ARG !== 'sqlite') {
    console.log(info('Lendo dos JSON locais (album_*.json / music_*.json)...'));
    results   = scanFromJson();
    modoUsado = 'json';
  }

  if (!results || results.length === 0) {
    console.error(fail('Nenhum dado encontrado. Verifique os caminhos:'));
    console.error(`  SQLite : ${DB_PATH}`);
    console.error(`  JSON   : ${DB_DIR}`);
    console.error('');
    console.error('Opções:');
    console.error('  --db=<caminho>   Caminho do arquivo database.db');
    console.error('  --dir=<caminho>  Pasta raiz (com config/ e db/ dentro)');
    process.exit(1);
  }

  console.log(info(`Total de entradas: ${results.length}`));
  console.log('');
  printReport(results, modoUsado);
}

main().catch(err => { console.error(err); process.exit(1); });
