/**
 * Reconhece arquivos locais (MP3, capas, imagens) e gera/atualiza
 * o banco JSON em db/ com URLs file:// apontando para eles.
 *
 * Fontes de metadados (em ordem de prioridade):
 *   1. SQLite  (--db=<caminho>)        – banco original do LouvorJA
 *   2. JSON local (db/ não vazio)       – arquivos já gerados anteriormente
 *   3. API     (--api)                  – baixa da api.louvorja.com.br
 *
 * Uso:
 *   node scripts/reconhecer-arquivos.js
 *   node scripts/reconhecer-arquivos.js --db="D:\LouvorJA\config\database.db"
 *   node scripts/reconhecer-arquivos.js --api
 *   node scripts/reconhecer-arquivos.js --dir="C:\LouvorJA" --db=... --csv
 *
 * Flags:
 *   --db=<path>   Caminho do SQLite a importar
 *   --dir=<path>  Pasta raiz de instalação (contém config/ e db/)
 *   --api         Força download de metadados pela API
 *   --lang=pt     Idioma (padrão: pt)
 *   --token=<tk>  Api-Token (default: lê do .env)
 *   --csv         Salva reconhecer-arquivos-resultado.csv
 *   --dry-run     Mostra o que faria, sem salvar nada
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const http  = require('https');

// ── Args ──────────────────────────────────────────────────────────────────────
const argv    = process.argv.slice(2);
const getArg  = (k) => { const a = argv.find(a => a.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const hasFlag = (f) => argv.includes(`--${f}`);

const LANG     = getArg('lang') || 'pt';
const DRY_RUN  = hasFlag('dry-run');
const SAVE_CSV = hasFlag('csv');
const USE_API  = hasFlag('api');

// ── .env → token e URLs da API ────────────────────────────────────────────────
function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  const result = {};
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) result[m[1].trim()] = m[2].trim();
  });
  return result;
}
const ENV         = loadDotEnv();
const API_TOKEN   = getArg('token') || ENV.VITE_API_TOKEN || '';
const API_DB_URL  = (ENV.VITE_URL_DATABASE || 'https://api.louvorja.com.br/json_db').replace(/\/$/, '');
const API_FILE_URL = (ENV.VITE_URL_FILES  || 'https://api.louvorja.com.br/file').replace(/\/$/, '');

// ── Caminhos ─────────────────────────────────────────────────────────────────
const ROAMING_DIR = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'LouvorJA')
  : path.join(os.homedir(), 'AppData', 'Roaming', 'LouvorJA');

function resolveInstallDir() {
  // 1. Argumento explícito
  if (getArg('dir')) return getArg('dir');

  // 2. Derivado do --db: se o SQLite está em <root>/config/database.db, raiz = <root>
  const dbArg = getArg('db');
  if (dbArg) {
    const dbParent = path.dirname(dbArg);
    if (path.basename(dbParent).toLowerCase() === 'config') return path.dirname(dbParent);
    return dbParent;
  }

  // 3. Pastas de instalação — busca em todas as letras de drive (comportamento Delphi)
  const drives = ['C','D','E','F','G','H'];
  const candidates = [
    // Padrões comuns de instalação do LouvorJA Delphi
    ...drives.flatMap(d => [
      `${d}:\\Louvor JA\\LouvorJA`,
      `${d}:\\LouvorJA`,
      path.join(`${d}:\\Program Files (x86)`, 'LouvorJA'),
      path.join(`${d}:\\Program Files`,       'LouvorJA'),
      path.join(`${d}:\\Program Files (x86)`, 'Louvor JA', 'LouvorJA'),
      path.join(`${d}:\\Program Files`,       'Louvor JA', 'LouvorJA'),
    ]),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'config', 'database.db'))) return c;
  }

  // 4. louvorja-store.json no roaming (db_local_folder customizado)
  const storePath = path.join(ROAMING_DIR, 'louvorja-store.json');
  if (fs.existsSync(storePath)) {
    try {
      const s = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (s.db_local_folder && fs.existsSync(s.db_local_folder)) return path.dirname(s.db_local_folder);
    } catch (_) {}
  }

  // 5. Fallback: userData (modo dev/roaming)
  return ROAMING_DIR;
}

const INSTALL_DIR = resolveInstallDir();

// db/ de saída: sempre no roaming (userData), não dentro da pasta de instalação
// A app Electron lê de: getDbDir() = Store.get('db_local_folder') || path.join(getInstallDir(), 'db')
// Em produção instalada getInstallDir() = pasta do .exe, portanto db/ fica junto ao .exe.
// Para evitar escrever em Program Files (requer admin), usamos o roaming como fallback de saída.
function resolveDbOutDir() {
  if (getArg('dir')) return path.join(getArg('dir'), 'db');
  const storePath = path.join(ROAMING_DIR, 'louvorja-store.json');
  if (fs.existsSync(storePath)) {
    try {
      const s = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (s.db_local_folder) return s.db_local_folder;
    } catch (_) {}
  }
  // Se o install dir é gravável (ex: pasta de usuário ou portátil), usa db/ dentro dele
  try {
    const testPath = path.join(INSTALL_DIR, 'db', '.write-test');
    fs.mkdirSync(path.dirname(testPath), { recursive: true });
    fs.writeFileSync(testPath, '');
    fs.unlinkSync(testPath);
    return path.join(INSTALL_DIR, 'db');
  } catch (_) {}
  return path.join(ROAMING_DIR, 'db');
}

const DB_DIR      = resolveDbOutDir();
const CONFIG_DIR  = path.join(INSTALL_DIR, 'config');
const MUSICAS_DIR = path.join(CONFIG_DIR, 'musicas');
const CAPAS_DIR   = path.join(CONFIG_DIR, 'capas');
const IMAGENS_DIR = path.join(CONFIG_DIR, 'imagens');
const DB_SQLITE   = getArg('db') || path.join(INSTALL_DIR, 'config', 'database.db');
const OUT_CSV     = path.join(__dirname, 'reconhecer-arquivos-resultado.csv');

// ── ANSI ──────────────────────────────────────────────────────────────────────
const C = { r:'\x1b[0m', g:'\x1b[32m', red:'\x1b[31m', y:'\x1b[33m', c:'\x1b[36m', b:'\x1b[1m', d:'\x1b[2m' };
const ok   = (s) => `${C.g}✓${C.r} ${s}`;
const fail = (s) => `${C.red}✗${C.r} ${s}`;
const info = (s) => `${C.c}[INFO]${C.r} ${s}`;
const warn = (s) => `${C.y}[AVISO]${C.r} ${s}`;
const bold = (s) => `${C.b}${s}${C.r}`;

// ── Helpers gerais ────────────────────────────────────────────────────────────

function sanitizeDir(name) {
  return (name || 'Desconhecido')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 80) || 'Desconhecido';
}

function toFileUrl(absPath) {
  return `file:///${absPath.replace(/\\/g, '/')}`;
}

function safeBasename(raw) {
  if (!raw) return '';
  try { return path.basename(raw.split('?')[0].split('#')[0]) || ''; }
  catch (_) { return ''; }
}

// ── Índice de arquivos locais ─────────────────────────────────────────────────
// Mapeia: lowerCaseFileName → fullAbsPath  (para busca rápida O(1))

function buildIndex(dir) {
  const idx = {};
  if (!fs.existsSync(dir)) return idx;
  function scanDir(d) {
    try {
      fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
        if (e.isFile()) {
          const lower = e.name.toLowerCase();
          if (!idx[lower]) idx[lower] = path.join(d, e.name); // primeiro ganha
        } else if (e.isDirectory()) {
          scanDir(path.join(d, e.name));
        }
      });
    } catch (_) {}
  }
  scanDir(dir);
  return idx;
}

let indexMusicas, indexCapas, indexImagens;

function ensureIndexes() {
  if (!indexMusicas) {
    console.log(info('Indexando arquivos locais...'));
    indexMusicas = buildIndex(MUSICAS_DIR);
    indexCapas   = buildIndex(CAPAS_DIR);
    indexImagens = buildIndex(IMAGENS_DIR);
    const tm = Object.keys(indexMusicas).length;
    const tc = Object.keys(indexCapas).length;
    const ti = Object.keys(indexImagens).length;
    console.log(info(`  musicas: ${tm}, capas: ${tc}, imagens: ${ti}`));
    console.log('');
  }
}

/**
 * Procura um arquivo pelo nome em um índice.
 * Aceita buscas aproximadas: sem extensão, sem sufixo " - PB".
 */
function lookupInIndex(idx, fileName) {
  if (!fileName || !idx) return null;
  const lower = fileName.toLowerCase();
  // 1. Match exato
  if (idx[lower]) return idx[lower];
  // 2. Troca extensão
  const withoutExt = lower.replace(/\.[^.]+$/, '');
  for (const [k, v] of Object.entries(idx)) {
    if (k.replace(/\.[^.]+$/, '') === withoutExt) return v;
  }
  return null;
}

function findAudio(fileName)  { return lookupInIndex(indexMusicas, fileName); }
function findCover(fileName)  { return lookupInIndex(indexCapas,   fileName); }
function findImage(fileName)  { return lookupInIndex(indexImagens, fileName); }

// ── Busca a partir de uma URL da API ou file:// ──────────────────────────────
function findFromUrl(raw, findFn) {
  if (!raw) return null;
  const name = safeBasename(raw);
  if (!name) return null;
  // Se já é file:// local e existe → retorna
  if (raw.startsWith('file:///')) {
    const p = raw.slice(8).replace(/\//g, path.sep);
    if (fs.existsSync(p)) return p;
  }
  return findFn(name);
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function fetchJson(url, token) {
  return new Promise((resolve, reject) => {
    const headers = { 'Accept': 'application/json', 'User-Agent': 'LouvorJA-Reconhecer/1.0' };
    if (token) headers['Api-Token'] = token;
    http.get(url, { headers }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJson(res.headers.location, token).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON inválido em ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

// ── Salvar JSON ───────────────────────────────────────────────────────────────
function saveJson(filePath, data) {
  if (DRY_RUN) return;
  if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
}

// ── MODO 1: SQLite ─────────────────────────────────────────────────────────────
async function processFromSqlite(dbPath) {
  if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size < 100) return null;

  console.log(info(`Lendo banco SQLite: ${dbPath}`));

  const initSqlJs = require(path.join(__dirname, '..', 'node_modules', 'sql.js'));
  const wasmPath  = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db  = new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)));

  const q       = (sql) => { const r = db.exec(sql); if (!r[0]) return []; const { columns, values } = r[0]; return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]]))); };
  const cOf     = (t)   => { const r = db.exec(`PRAGMA table_info(${t})`); return r[0] ? r[0].values.map(v => v[1]) : []; };
  const hasT    = (t)   => { const r = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${t}'`); return !!(r[0]?.values.length); };

  for (const t of ['categories', 'musics', 'lyrics']) {
    if (!hasT(t)) { console.error(fail(`Tabela '${t}' não encontrada.`)); return null; }
  }

  const hasCatAlbums = hasT('categories_albums');
  const hasAlbums    = hasT('albums');
  const hasAlbMus    = hasT('albums_musics');
  const hasFiles     = hasT('files');

  const cCols  = cOf('categories');
  const caCols = hasCatAlbums ? cOf('categories_albums') : [];
  const aCols  = hasAlbums    ? cOf('albums')            : [];
  const mCols  = cOf('musics');
  const amCols = hasAlbMus    ? cOf('albums_musics')     : [];
  const fCols  = hasFiles     ? cOf('files')             : [];
  const lCols  = cOf('lyrics');

  const hasCatLang  = cCols.includes('id_language');
  const hasCatOrder = cCols.includes('order');
  const hasCatSlug  = cCols.includes('slug');
  const hasCaOrder  = caCols.includes('order');
  const hasAColor   = aCols.includes('color');
  const hasAFileImg = aCols.includes('id_file_image');
  const hasMInstr   = mCols.includes('id_file_instrumental_music');
  const hasMFileMu  = mCols.includes('id_file_music');
  const hasAmTrack  = amCols.includes('track');
  const hasFDir     = fCols.includes('dir');
  const hasMuLang   = mCols.includes('id_language');
  const hasLFileImg = lCols.includes('id_file_image');
  const hasLImgPos  = lCols.includes('image_position');
  const hasLAuxLyric= lCols.includes('aux_lyric');
  const hasLShowSlide=lCols.includes('show_slide');
  const hasLOrder   = lCols.includes('order');
  const hasLLang    = lCols.includes('id_language');

  // ── Helper: busca arquivo pelo caminho exato do SQLite primeiro, depois pelo índice ──
  const findByDir = (dir, fileName, fallbackFn) => {
    if (dir && fileName) {
      const exactPath = path.join(INSTALL_DIR, dir, fileName);
      if (fs.existsSync(exactPath)) return exactPath;
    }
    return fileName ? fallbackFn(fileName) : null;
  };

  // ── Categorias + Álbuns ────────────────────────────────────────────────────
  const cats = q(`
    SELECT c.id_category, c.name,
           ${hasCatOrder ? 'c."order"' : '0'} AS cat_order,
           ${hasCatSlug  ? 'c.slug'    : "NULL"} AS slug,
           ${hasCatAlbums ? 'ca.id_album, ca.name AS ca_name' : 'NULL AS id_album, NULL AS ca_name'},
           ${hasCatAlbums && hasCaOrder ? 'ca."order"' : '0'} AS album_order,
           ${hasAlbums ? 'a.name AS a_name' : "NULL AS a_name"},
           ${hasAlbums && hasAColor ? 'a.color' : "NULL"} AS color
           ${hasFiles && hasAlbums && hasAFileImg ? ', f.file_name AS img_name' : ', NULL AS img_name'}
           ${hasFiles && hasAlbums && hasAFileImg && hasFDir ? ', f.dir AS img_dir' : ', NULL AS img_dir'}
    FROM   categories c
    ${hasCatAlbums ? `LEFT JOIN categories_albums ca ON ca.id_category = c.id_category ${hasCatLang ? "AND ca.id_language = 'pt'" : ''}` : ''}
    ${hasAlbums    ? `LEFT JOIN albums a ON a.id_album = ${hasCatAlbums ? 'ca.id_album' : '0'} ${aCols.includes('id_language') ? "AND a.id_language = 'pt'" : ''}` : ''}
    ${hasFiles && hasAlbums && hasAFileImg ? 'LEFT JOIN files f ON f.id_file = a.id_file_image' : ''}
    ${hasCatLang ? "WHERE c.id_language = 'pt'" : ''}
    ORDER BY cat_order, album_order
  `);

  const albumMap = {};
  const catMap   = {};
  cats.forEach(r => {
    if (!catMap[r.id_category]) {
      catMap[r.id_category] = { id_category: r.id_category, name: r.name, order: r.cat_order || 0, slug: r.slug || '', albums: [] };
    }
    if (r.id_album) {
      // Usa dir exato do SQLite (ex: config\capas\) antes de buscar no índice
      const localCover = findByDir(r.img_dir, r.img_name, findCover);
      const albumEntry = {
        id_album:  r.id_album,
        name:      r.ca_name || r.a_name,
        subtitle:  r.a_name,
        color:     r.color || '#555555',
        url_image: localCover ? toFileUrl(localCover) : '',
        order:     r.album_order || 0,
      };
      catMap[r.id_category].albums.push(albumEntry);
      if (!albumMap[r.id_album]) {
        albumMap[r.id_album] = {
          id_album:  r.id_album,
          name:      albumEntry.name,
          url_image: albumEntry.url_image,
          categories: [],
          musics:    [],
        };
      }
    }
  });

  // ── Músicas ────────────────────────────────────────────────────────────────
  const mRows = q(`
    SELECT m.id_music, m.name,
           ${hasMInstr  ? 'm.id_file_instrumental_music' : '0 AS id_file_instrumental_music'},
           ${hasAlbMus  ? 'am.id_album' : 'NULL AS id_album'},
           ${hasAlbMus && hasAmTrack ? 'am.track' : '0 AS track'},
           ${hasAlbums  ? 'a.name AS a_name' : "NULL AS a_name"}
           ${hasFiles && hasMFileMu           ? ', f.file_name AS aud_name'   : ', NULL AS aud_name'}
           ${hasFiles && hasMFileMu && hasFDir ? ', f.dir AS aud_dir'          : ', NULL AS aud_dir'}
           ${hasMInstr  && hasFiles           ? ', fi.file_name AS instr_name' : ', NULL AS instr_name'}
           ${hasMInstr  && hasFiles && hasFDir ? ', fi.dir AS instr_dir'        : ', NULL AS instr_dir'}
    FROM musics m
    ${hasAlbMus ? 'LEFT JOIN albums_musics am ON am.id_music = m.id_music' : ''}
    ${hasAlbums ? `LEFT JOIN albums a ON a.id_album = ${hasAlbMus ? 'am.id_album' : '0'} ${aCols.includes('id_language') ? "AND a.id_language = 'pt'" : ''}` : ''}
    ${hasFiles && hasMFileMu ? 'LEFT JOIN files f ON f.id_file = m.id_file_music' : ''}
    ${hasMInstr && hasFiles  ? 'LEFT JOIN files fi ON fi.id_file = m.id_file_instrumental_music' : ''}
    ${hasMuLang ? "WHERE m.id_language = 'pt'" : ''}
    ORDER BY m.id_music
  `);

  const musicMap = {};
  mRows.forEach(r => {
    if (!musicMap[r.id_music]) {
      // Usa dir exato do SQLite (ex: config\musicas\Hinário Adventista\) → fallback índice
      const localAud   = findByDir(r.aud_dir,   r.aud_name   || '', findAudio);
      const localInstr = findByDir(r.instr_dir, r.instr_name || '', findAudio);
      musicMap[r.id_music] = {
        id_music:               r.id_music,
        name:                   r.name,
        has_instrumental_music: !!r.id_file_instrumental_music,
        url_music:              localAud   ? toFileUrl(localAud)   : '',
        url_instrumental_music: localInstr ? toFileUrl(localInstr) : '',
        url_image:              '',
        albums:                 [],
        slides:                 [],
      };
    }
    if (r.id_album && albumMap[r.id_album]) {
      const mm = musicMap[r.id_music];
      if (!mm.albums.find(a => a.id_album === r.id_album)) {
        mm.albums.push({ id_album: r.id_album, name: r.a_name, pivot: { track: r.track || 0 } });
        albumMap[r.id_album].musics.push({ id_music: r.id_music, name: r.name, track: r.track || 0 });
      }
    }
  });

  // ── Letras / slides ────────────────────────────────────────────────────────
  const lyricRows = q(`
    SELECT l.id_music, l.lyric,
           ${hasLAuxLyric  ? 'l.aux_lyric'     : "'' AS aux_lyric"},
           ${hasLOrder     ? 'l."order"'        : '0 AS "order"'},
           ${hasLShowSlide ? 'l.show_slide'     : '1 AS show_slide'}
           ${hasFiles && hasLFileImg           ? ', f.file_name AS img_name' : ', NULL AS img_name'}
           ${hasFiles && hasLFileImg && hasFDir ? ', f.dir AS img_dir'        : ', NULL AS img_dir'}
           ${hasLImgPos    ? ', l.image_position' : ", 'center' AS image_position"}
    FROM lyrics l
    ${hasFiles && hasLFileImg ? 'LEFT JOIN files f ON f.id_file = l.id_file_image' : ''}
    ${hasLLang ? "WHERE l.id_language = 'pt'" : ''}
    ORDER BY l.id_music ${hasLOrder ? ', l."order"' : ''}
  `);

  const slidesMap = {};
  lyricRows.forEach(r => {
    if (!slidesMap[r.id_music]) slidesMap[r.id_music] = [];
    // Usa dir exato do SQLite (ex: config\imagens\) → fallback índice
    const localImg = findByDir(r.img_dir, r.img_name || '', findImage);
    slidesMap[r.id_music].push({
      cover:          !r.order,
      lyric:          r.lyric || '',
      aux_lyric:      r.aux_lyric || '',
      url_image:      localImg ? toFileUrl(localImg) : '',
      image_position: r.image_position || 'center',
      show_slide:     r.show_slide !== 0,
    });
  });

  // Anexa slides às músicas
  Object.values(musicMap).forEach(m => {
    m.slides = slidesMap[m.id_music] || [];
    delete m._aud_name;
    delete m._instr_name;
  });

  db.close();
  return { catMap, albumMap, musicMap };
}

// ── MODO 2: JSON local (db/ existente) ────────────────────────────────────────
function processFromLocalJson() {
  if (!fs.existsSync(DB_DIR)) return null;
  const albumFiles = fs.readdirSync(DB_DIR).filter(f => f.startsWith('album_') && f.endsWith('.json'));
  if (!albumFiles.length) return null;

  console.log(info(`Atualizando ${albumFiles.length} álbuns do db/ local...`));

  const albumMap = {};
  const musicMap = {};

  for (const af of albumFiles) {
    let albumData;
    try { albumData = JSON.parse(fs.readFileSync(path.join(DB_DIR, af), 'utf8')); }
    catch (_) { continue; }

    // Atualiza url_image da capa
    const coverName = safeBasename(albumData.url_image);
    if (coverName) {
      const local = findCover(coverName);
      if (local) albumData.url_image = toFileUrl(local);
    }

    albumMap[albumData.id_album] = albumData;

    for (const music of (albumData.musics || [])) {
      const mFile = path.join(DB_DIR, `music_${music.id_music}.json`);
      if (!fs.existsSync(mFile)) continue;
      let md;
      try { md = JSON.parse(fs.readFileSync(mFile, 'utf8')); }
      catch (_) { continue; }

      let changed = false;

      // url_music
      const audName = safeBasename(md.url_music);
      if (audName) {
        const local = findAudio(audName);
        if (local && md.url_music !== toFileUrl(local)) { md.url_music = toFileUrl(local); changed = true; }
      }

      // url_instrumental_music
      const instrName = safeBasename(md.url_instrumental_music);
      if (instrName) {
        const local = findAudio(instrName);
        if (local && md.url_instrumental_music !== toFileUrl(local)) { md.url_instrumental_music = toFileUrl(local); changed = true; }
      }

      // Slides
      for (const s of (md.slides || [])) {
        const imgName = safeBasename(s.url_image);
        if (imgName) {
          const local = findImage(imgName);
          if (local && s.url_image !== toFileUrl(local)) { s.url_image = toFileUrl(local); changed = true; }
        }
      }

      if (changed) musicMap[md.id_music] = md;
      else musicMap[md.id_music] = null; // marca como inalterado
    }
  }

  return { catMap: null, albumMap, musicMap };
}

// ── MODO 3: API ───────────────────────────────────────────────────────────────
async function processFromApi() {
  console.log(info(`Baixando metadados da API: ${API_DB_URL}`));
  const catUrl = `${API_DB_URL}/pt_categories`;
  let cats;
  try {
    cats = await fetchJson(catUrl, API_TOKEN);
    console.log(ok(`Categorias: ${cats.length}`));
  } catch (e) {
    console.error(fail(`Erro ao buscar categorias: ${e.message}`));
    return null;
  }

  const albumMap = {};
  const musicMap = {};
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  // Salva categorias
  if (!DRY_RUN) saveJson(path.join(DB_DIR, 'pt_categories.json'), cats);

  // Coleta IDs de álbuns de todas as categorias
  const albumIds = new Set();
  cats.forEach(c => (c.albums || []).forEach(a => albumIds.add(a.id_album)));
  console.log(info(`Álbuns a processar: ${albumIds.size}`));

  for (const albumId of albumIds) {
    let albumData;
    try {
      albumData = await fetchJson(`${API_DB_URL}/album_${albumId}?${date}`, API_TOKEN);
    } catch (e) {
      console.log(warn(`  album_${albumId}: ${e.message}`));
      continue;
    }

    // Resolve capa local
    const coverName = safeBasename(albumData.url_image);
    const localCover = coverName ? findCover(coverName) : null;
    if (localCover) albumData.url_image = toFileUrl(localCover);

    albumMap[albumId] = albumData;
    process.stdout.write(`  ${ok('album_'+albumId)} ${albumData.name}\n`);

    for (const music of (albumData.musics || [])) {
      if (musicMap[music.id_music] !== undefined) continue;
      let md;
      try {
        md = await fetchJson(`${API_DB_URL}/music_${music.id_music}?${date}`, API_TOKEN);
      } catch (e) {
        console.log(warn(`    music_${music.id_music}: ${e.message}`));
        musicMap[music.id_music] = null;
        continue;
      }

      // Resolve áudio
      const audName   = safeBasename(md.url_music);
      const instrName = safeBasename(md.url_instrumental_music);
      const localAud   = audName   ? findAudio(audName)   : null;
      const localInstr = instrName ? findAudio(instrName) : null;
      if (localAud)   md.url_music               = toFileUrl(localAud);
      if (localInstr) md.url_instrumental_music   = toFileUrl(localInstr);

      // Resolve slides
      for (const s of (md.slides || [])) {
        const imgName  = safeBasename(s.url_image);
        const localImg = imgName ? findImage(imgName) : null;
        if (localImg) s.url_image = toFileUrl(localImg);
      }

      musicMap[music.id_music] = md;
    }
  }

  return { catMap: null, albumMap, musicMap };
}

// ── Salvar resultados ─────────────────────────────────────────────────────────
function saveResults(data, modo) {
  const { catMap, albumMap, musicMap } = data;
  let savedAlbums = 0, savedMusics = 0, recognizedAudios = 0, recognizedCovers = 0, recognizedImages = 0;
  const csvRows = ['tipo,id,nome,arquivo_local,url_gerada'];

  if (!fs.existsSync(DB_DIR) && !DRY_RUN) fs.mkdirSync(DB_DIR, { recursive: true });

  // Salva categorias (somente em modo SQLite que gerou catMap)
  if (catMap) {
    saveJson(path.join(DB_DIR, 'pt_categories.json'), Object.values(catMap));
  }

  // Álbuns
  for (const album of Object.values(albumMap)) {
    if (!album) continue;
    saveJson(path.join(DB_DIR, `album_${album.id_album}.json`), album);
    savedAlbums++;
    if (album.url_image && album.url_image.startsWith('file:///')) {
      recognizedCovers++;
      if (SAVE_CSV) csvRows.push(['CAPA', album.id_album, csvEsc(album.name), csvEsc(album.url_image.slice(8)), csvEsc(album.url_image)].join(','));
    }
  }

  // Músicas
  for (const music of Object.values(musicMap)) {
    if (!music) continue; // null = não mudou (modo json)
    saveJson(path.join(DB_DIR, `music_${music.id_music}.json`), music);
    savedMusics++;
    if (music.url_music && music.url_music.startsWith('file:///')) {
      recognizedAudios++;
      if (SAVE_CSV) csvRows.push(['AUDIO', music.id_music, csvEsc(music.name), csvEsc(music.url_music.slice(8)), csvEsc(music.url_music)].join(','));
    }
    if (music.url_instrumental_music && music.url_instrumental_music.startsWith('file:///')) {
      recognizedAudios++;
      if (SAVE_CSV) csvRows.push(['AUDIO_PB', music.id_music, csvEsc(music.name), csvEsc(music.url_instrumental_music.slice(8)), csvEsc(music.url_instrumental_music)].join(','));
    }
    for (const s of (music.slides || [])) {
      if (s.url_image && s.url_image.startsWith('file:///')) recognizedImages++;
    }
  }

  if (SAVE_CSV) {
    fs.writeFileSync(OUT_CSV, csvRows.join('\r\n'), 'utf8');
    console.log(ok(`CSV salvo: ${OUT_CSV}`));
  }

  return { savedAlbums, savedMusics, recognizedAudios, recognizedCovers, recognizedImages };
}

function csvEsc(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log(bold('=== Reconhecedor de Arquivos — LouvorJA ==='));
  console.log('');
  const installIsSetup = INSTALL_DIR !== ROAMING_DIR;
  console.log(info(`Instalação : ${INSTALL_DIR}${installIsSetup ? ' (setup)' : ' (roaming/dev)'}`));
  console.log(info(`SQLite     : ${DB_SQLITE}${(fs.existsSync(DB_SQLITE) && fs.statSync(DB_SQLITE).size > 100) ? '' : ' (não encontrado)'}`));
  console.log(info(`config/    : ${CONFIG_DIR}`));
  console.log(info(`db/ saída  : ${DB_DIR}`));
  if (DRY_RUN) console.log(warn('Modo --dry-run: nenhum arquivo será salvo'));
  console.log('');

  ensureIndexes();

  let data = null;
  let modo = '';

  // 1. SQLite
  if (!USE_API && fs.existsSync(DB_SQLITE) && fs.statSync(DB_SQLITE).size > 100) {
    data = await processFromSqlite(DB_SQLITE);
    modo = 'sqlite';
  }

  // 2. JSON local
  if (!data && !USE_API) {
    data = processFromLocalJson();
    modo = 'json-local';
  }

  // 3. API
  if (!data || USE_API) {
    data = await processFromApi();
    modo = 'api';
  }

  if (!data) {
    console.error(fail('Não foi possível obter metadados. Use --db=<path> ou --api'));
    process.exit(1);
  }

  console.log('');
  console.log(info('Salvando banco JSON local...'));
  const stats = saveResults(data, modo);
  console.log('');

  // ── Resumo ─────────────────────────────────────────────────────────────────
  console.log(bold('Resumo:'));
  console.log(`  Álbuns gravados    : ${stats.savedAlbums}`);
  console.log(`  Músicas gravadas   : ${stats.savedMusics}`);
  console.log(`  ${C.g}Áudios reconhecidos: ${stats.recognizedAudios}${C.r}`);
  console.log(`  ${C.g}Capas reconhecidas : ${stats.recognizedCovers}${C.r}`);
  console.log(`  ${C.g}Imagens slides     : ${stats.recognizedImages}${C.r}`);

  if (DRY_RUN) {
    console.log('');
    console.log(warn('Dry-run: rode sem --dry-run para salvar os arquivos.'));
  } else {
    console.log('');
    console.log(ok(`Banco local em ${DB_DIR} atualizado com sucesso!`));
    console.log(info('Reinicie o app LouvorJA para carregar os arquivos locais.'));
  }
  console.log('');
}

main().catch(err => { console.error(err); process.exit(1); });
