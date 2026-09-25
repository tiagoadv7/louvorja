/**
 * Gera banco de dados JSON a partir do SQLite do LouvorJA instalado.
 * Uso: node scripts/gerar-banco-json.js
 */

const fs   = require('fs');
const path = require('path');

// ── Caminhos ─────────────────────────────────────────────────────────────────
const INSTALL_DIR = 'D:\\Louvor JA\\LouvorJA';
const DB_SQLITE   = path.join(INSTALL_DIR, 'config', 'database.db');
const OUT_DIR     = path.join(INSTALL_DIR, 'db');       // onde gravar os JSONs
const CAPAS_DIR   = path.join(INSTALL_DIR, 'config', 'capas');
const MUSICAS_DIR = path.join(INSTALL_DIR, 'config', 'musicas');
const IMAGENS_DIR = path.join(INSTALL_DIR, 'config', 'imagens');

// Categorias de hinário: id_category → arquivo hymnal
// Ajuste conforme os IDs reais do seu banco
const HYMNAL_CATEGORY_MAP = {
  3: 'pt_hymnal',       // Hinário Adventista (2022)
  4: 'pt_hymnal_1996',  // Hinário Adventista 1996
};

const toFileUrl = (p) => `file:///${p.replace(/\\/g, '/')}`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function sanitizeDir(name) {
  return (name || 'Desconhecido')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 80) || 'Desconhecido';
}

// Procura arquivo por nome (sem extensão) em uma pasta, retornando a URL
function findFile(dir, baseName) {
  if (!fs.existsSync(dir)) return '';
  const lower = baseName.toLowerCase();
  try {
    const files = fs.readdirSync(dir);
    // 1. match exato
    const exact = files.find(f => f.toLowerCase() === lower);
    if (exact) return toFileUrl(path.join(dir, exact));
    // 2. match sem extensão
    const noExt = files.find(f => f.toLowerCase().replace(/\.[^.]+$/, '') === lower.replace(/\.[^.]+$/, ''));
    if (noExt) return toFileUrl(path.join(dir, noExt));
  } catch (_) {}
  return '';
}

// ── Inicialização ─────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(DB_SQLITE)) {
    console.error(`[ERRO] Banco não encontrado: ${DB_SQLITE}`);
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`[INFO] Lendo: ${DB_SQLITE}`);
  console.log(`[INFO] Saída: ${OUT_DIR}`);

  const initSqlJs = require(path.join(__dirname, '..', 'node_modules', 'sql.js'));
  const wasmPath  = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const buf = fs.readFileSync(DB_SQLITE);
  const db  = new SQL.Database(new Uint8Array(buf));

  const query = (sql) => {
    const res = db.exec(sql);
    if (!res[0]) return [];
    const { columns, values } = res[0];
    return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
  };
  const cols     = (table) => { const r = db.exec(`PRAGMA table_info(${table})`); return r[0] ? r[0].values.map(v => v[1]) : []; };
  const hasTable = (table) => { const r = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`); return !!(r[0] && r[0].values.length); };

  // Tabelas obrigatórias
  for (const t of ['categories', 'musics', 'lyrics']) {
    if (!hasTable(t)) { console.error(`[ERRO] Tabela '${t}' não encontrada.`); process.exit(1); }
  }

  const hasCatAlbumsT   = hasTable('categories_albums');
  const hasAlbumsT      = hasTable('albums');
  const hasAlbumsMusicT = hasTable('albums_musics');
  const hasFilesT       = hasTable('files');

  const cCols  = cols('categories');
  const caCols = hasCatAlbumsT   ? cols('categories_albums') : [];
  const aCols  = hasAlbumsT      ? cols('albums')            : [];
  const mCols  = cols('musics');
  const amCols = hasAlbumsMusicT ? cols('albums_musics')     : [];
  const fCols  = hasFilesT       ? cols('files')             : [];
  const lCols  = cols('lyrics');

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

  // ── 1. Categorias + Álbuns ───────────────────────────────────────────────
  console.log('[1/4] Lendo categorias e álbuns...');
  const cats = query(`
    SELECT c.id_category, c.name,
           ${hasCatOrder ? 'c."order"' : '0'} AS cat_order,
           ${hasCatSlug  ? 'c.slug'    : "NULL"} AS slug,
           ${hasCatAlbumsT ? 'ca.id_album, ca.name AS ca_name' : 'NULL AS id_album, NULL AS ca_name'},
           ${hasCatAlbumsT && hasCaOrder ? 'ca."order"' : '0'} AS album_order,
           ${hasAlbumsT ? 'a.name AS a_name' : "NULL AS a_name"},
           ${hasAlbumsT && hasAColor ? 'a.color' : "NULL"} AS color
           ${hasFilesT && hasAlbumsT && hasAFileImg ? ', f.file_name AS img_name' : ", NULL AS img_name"}
    FROM   categories c
    ${hasCatAlbumsT ? `LEFT JOIN categories_albums ca ON ca.id_category = c.id_category ${hasCatLang ? "AND ca.id_language = 'pt'" : ''}` : ''}
    ${hasAlbumsT    ? `LEFT JOIN albums a ON a.id_album = ${hasCatAlbumsT ? 'ca.id_album' : '0'} ${aCols.includes('id_language') ? "AND a.id_language = 'pt'" : ''}` : ''}
    ${hasFilesT && hasAlbumsT && hasAFileImg ? 'LEFT JOIN files f ON f.id_file = a.id_file_image' : ''}
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
      const imgName = r.img_name || '';
      const imgUrl  = imgName ? findFile(CAPAS_DIR, imgName) : '';
      const albumEntry = {
        id_album:  r.id_album,
        name:      r.ca_name || r.a_name,
        subtitle:  r.a_name,
        color:     r.color || '#555555',
        url_image: imgUrl,
        order:     r.album_order || 0,
      };
      catMap[r.id_category].albums.push(albumEntry);
      if (!albumMap[r.id_album]) {
        const hymnalFile = HYMNAL_CATEGORY_MAP[r.id_category];
        const categories = hymnalFile ? [`hymnal.${hymnalFile}`] : [];
        albumMap[r.id_album] = { id_album: r.id_album, name: albumEntry.name, url_image: imgUrl, categories, musics: [] };
      }
    }
  });
  fs.writeFileSync(path.join(OUT_DIR, 'pt_categories.json'), JSON.stringify(Object.values(catMap)), 'utf8');
  console.log(`    → ${Object.keys(catMap).length} categorias, ${Object.keys(albumMap).length} álbuns`);

  // ── 2. Músicas ───────────────────────────────────────────────────────────
  console.log('[2/4] Lendo músicas...');
  const mRows = query(`
    SELECT m.id_music, m.name,
           ${hasMInstr ? 'm.id_file_instrumental_music' : '0 AS id_file_instrumental_music'},
           ${hasAlbumsMusicT ? 'am.id_album' : 'NULL AS id_album'},
           ${hasAlbumsMusicT && hasAmTrack ? 'am.track' : '0 AS track'},
           ${hasAlbumsT ? 'a.name AS a_name' : "NULL AS a_name"}
           ${hasFilesT && hasMFileMu ? ', f.file_name AS aud_name' : ", NULL AS aud_name"}
           ${hasFilesT && hasMFileMu && hasFDir ? ', f.dir AS aud_dir' : ", NULL AS aud_dir"}
    FROM musics m
    ${hasAlbumsMusicT ? 'LEFT JOIN albums_musics am ON am.id_music = m.id_music' : ''}
    ${hasAlbumsT ? `LEFT JOIN albums a ON a.id_album = ${hasAlbumsMusicT ? 'am.id_album' : '0'} ${aCols.includes('id_language') ? "AND a.id_language = 'pt'" : ''}` : ''}
    ${hasFilesT && hasMFileMu ? 'LEFT JOIN files f ON f.id_file = m.id_file_music' : ''}
    ${hasMuLang ? "WHERE m.id_language = 'pt'" : ''}
    ORDER BY m.id_music
  `);

  const musicMap = {};
  mRows.forEach(r => {
    if (!musicMap[r.id_music]) {
      const audName = r.aud_name || '';
      const urlMusic = audName ? findFile(MUSICAS_DIR, audName) : '';
      musicMap[r.id_music] = {
        id_music: r.id_music,
        name: r.name,
        has_instrumental_music: !!r.id_file_instrumental_music,
        lyric: '',
        albums_names: '',
        albums: [],
        url_music: urlMusic,
      };
    }
    if (r.id_album && !musicMap[r.id_music].albums.find(a => a.id_album === r.id_album)) {
      musicMap[r.id_music].albums.push({ id_album: r.id_album, name: r.a_name, pivot: { track: r.track || 0 } });
      if (albumMap[r.id_album] && !albumMap[r.id_album].musics.find(m => m.id_music === r.id_music)) {
        albumMap[r.id_album].musics.push({ id_music: r.id_music, name: r.name, track: r.track || 0 });
      }
    }
  });
  Object.values(musicMap).forEach(m => { m.albums_names = m.albums.map(a => a.name).join(', '); });
  fs.writeFileSync(path.join(OUT_DIR, 'pt_musics.json'), JSON.stringify(Object.values(musicMap)), 'utf8');
  console.log(`    → ${Object.keys(musicMap).length} músicas`);

  // ── 3. Letras (slides) ────────────────────────────────────────────────────
  console.log('[3/4] Lendo letras e slides...');
  const lyricRows = query(`
    SELECT l.id_music, l.lyric,
           ${hasLAuxLyric   ? 'l.aux_lyric'     : "'' AS aux_lyric"},
           ${hasLOrder      ? 'l."order"'        : '0 AS "order"'},
           ${hasLShowSlide  ? 'l.show_slide'     : '1 AS show_slide'}
           ${hasFilesT && hasLFileImg ? ', f.file_name AS img_name' : ", NULL AS img_name"}
           ${hasLImgPos     ? ', l.image_position' : ", 4 AS image_position"}
    FROM lyrics l
    ${hasFilesT && hasLFileImg ? 'LEFT JOIN files f ON f.id_file = l.id_file_image' : ''}
    ${hasLLang ? "WHERE l.id_language = 'pt'" : ''}
    ORDER BY l.id_music ${hasLOrder ? ', l."order"' : ''}
  `);

  const slidesMap = {};
  lyricRows.forEach(r => {
    if (!slidesMap[r.id_music]) slidesMap[r.id_music] = [];
    const imgName = r.img_name || '';
    const imgUrl  = imgName ? findFile(IMAGENS_DIR, imgName) : '';
    slidesMap[r.id_music].push({
      cover:          r.order === 0 || r.order === null,
      lyric:          r.lyric || '',
      aux_lyric:      r.aux_lyric || '',
      url_image:      imgUrl,
      // ?? (não ||): 0 é "topo-esquerda", posição válida — com ||, uma linha
      // configurada de propósito pra 0 caía no fallback por 0 ser falsy em JS.
      image_position: r.image_position ?? 4,
    });
  });

  let lCount = 0;
  for (const [id_music, slides] of Object.entries(slidesMap)) {
    const m = musicMap[id_music] || {};
    if (musicMap[id_music]) {
      const cover = slides.find(s => s.cover);
      musicMap[id_music].lyric = cover ? cover.lyric : (slides[0]?.lyric || '');
    }
    fs.writeFileSync(
      path.join(OUT_DIR, `music_${id_music}.json`),
      JSON.stringify({ id_music: parseInt(id_music), name: m.name || '', url_music: m.url_music || '', slides }),
      'utf8'
    );
    lCount++;
    if (lCount % 500 === 0) process.stdout.write(`    → ${lCount} músicas com letra...\r`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'pt_musics.json'), JSON.stringify(Object.values(musicMap)), 'utf8');
  console.log(`    → ${lCount} arquivos music_*.json gerados`);

  // ── 4. Album JSONs + Hinários ────────────────────────────────────────────
  console.log('[4/5] Gerando album_*.json...');
  let aCount = 0;
  const hymnalMusics = {}; // hymnalFile → array de músicas
  for (const [id_album, album] of Object.entries(albumMap)) {
    fs.writeFileSync(
      path.join(OUT_DIR, `album_${id_album}.json`),
      JSON.stringify(album),
      'utf8'
    );
    // Coleta músicas dos álbuns de hinário
    for (const cat of (album.categories || [])) {
      if (cat.startsWith('hymnal.')) {
        const hf = cat.split('.')[1];
        if (!hymnalMusics[hf]) hymnalMusics[hf] = [];
        for (const m of (album.musics || [])) {
          const mData = musicMap[m.id_music] || {};
          hymnalMusics[hf].push({
            id_music:              m.id_music,
            track:                 m.track || 0,
            name:                  m.name  || '',
            duration:              0,
            has_instrumental_music: !!mData.has_instrumental_music,
            url_music:             mData.url_music || '',
          });
        }
      }
    }
    aCount++;
  }
  console.log(`    → ${aCount} arquivos album_*.json gerados`);

  // ── 5. Hinários ───────────────────────────────────────────────────────────
  console.log('[5/5] Gerando arquivos de hinário...');
  for (const [hymnalFile, musics] of Object.entries(hymnalMusics)) {
    musics.sort((a, b) => (a.track || 0) - (b.track || 0));
    fs.writeFileSync(path.join(OUT_DIR, `${hymnalFile}.json`), JSON.stringify(musics), 'utf8');
    console.log(`    → ${hymnalFile}.json (${musics.length} hinos)`);
  }

  db.close();

  // ── Resumo ────────────────────────────────────────────────────────────────
  const total = fs.readdirSync(OUT_DIR).length;
  console.log('');
  console.log('════════════════════════════════════════');
  console.log(' Banco JSON gerado com sucesso!');
  console.log(`   Categorias : ${Object.keys(catMap).length}`);
  console.log(`   Álbuns     : ${aCount}`);
  console.log(`   Músicas    : ${Object.keys(musicMap).length}`);
  console.log(`   Letras     : ${lCount}`);
  console.log(`   Total JSON : ${total} arquivos em ${OUT_DIR}`);
  console.log(`   Hinários   : ${Object.keys(hymnalMusics).join(', ') || 'nenhum'}`);
  console.log('════════════════════════════════════════');
}

main().catch(e => { console.error('[ERRO FATAL]', e.message); process.exit(1); });
