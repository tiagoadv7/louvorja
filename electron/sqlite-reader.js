/**
 * sqlite-reader.js — Leitura direta do banco SQLite do LouvorJA.
 *
 * Usa sql.js (já instalado, WASM-based, sem compilação nativa) para consultar
 * o SQLite e retornar os dados no mesmo formato JSON que os arquivos db/*.json.
 * Não modifica nada no disco.
 *
 * Prioridade de resolução de mídia:
 *   1. Arquivo local (capas/, musicas/, imagens/ junto ao banco)
 *   2. URL app-local:// para acesso via protocolo registrado
 */

const path = require('path');
const fs   = require('fs');

// ── Helpers de resolução de arquivo ────────────────────────────────────────

/**
 * Busca recursiva de fileName dentro de dir (até maxDepth níveis).
 * Retorna o caminho absoluto do arquivo ou null.
 */
function findInTree(dir, lowerName, depth = 0, maxDepth = 3) {
  if (!dir || !fs.existsSync(dir)) return null;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile()) {
        if (entry.name.toLowerCase() === lowerName) return path.join(dir, entry.name);
        // Permite match sem extensão (ex: "Eu Vou" encontra "Eu Vou.mp3")
        const noExt = entry.name.toLowerCase().replace(/\.[^.]+$/, '');
        const targetNoExt = lowerName.replace(/\.[^.]+$/, '');
        if (noExt === targetNoExt) return path.join(dir, entry.name);
      } else if (entry.isDirectory() && depth < maxDepth) {
        const found = findInTree(path.join(dir, entry.name), lowerName, depth + 1, maxDepth);
        if (found) return found;
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Procura fileName em uma lista de diretórios, retornando file:// URL ou ''.
 * Estratégia em dois passos:
 *   1. Busca flat em cada dir (rápida — cobre o caso comum albumDir/fileName)
 *   2. Busca recursiva em cada dir como fallback (cobre pastas com nome diferente do esperado)
 *
 * options.recursive=false desliga o passo 2 — usar quando `dirs` é uma pasta-base
 * ampla (várias músicas de vários álbuns dentro), onde uma busca recursiva correria
 * o risco de encontrar o arquivo de OUTRO álbum com o mesmo nome (ex.: "Maranata.mp3"
 * existe em pelo menos 4 álbuns diferentes no catálogo) antes do arquivo certo.
 */
function findLocalFile(dirs, fileName, { recursive = true } = {}) {
  if (!fileName) return '';
  const lower = fileName.toLowerCase();

  // Passo 1: busca flat (prioridade — mais rápida)
  for (const dir of dirs) {
    if (!dir) continue;
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter(f => {
        try { return fs.statSync(path.join(dir, f)).isFile(); } catch (_) { return false; }
      });
      const found = files.find(f => f.toLowerCase() === lower)
                 || files.find(f => f.toLowerCase().replace(/\.[^.]+$/, '')
                                  === lower.replace(/\.[^.]+$/, ''));
      if (found) return 'file:///' + path.join(dir, found).replace(/\\/g, '/');
    } catch (_) {}
  }

  if (!recursive) return '';

  // Passo 2: busca recursiva como fallback (ex: arquivo em subpasta com nome diferente)
  for (const dir of dirs) {
    if (!dir) continue;
    const found = findInTree(dir, lower);
    if (found) return 'file:///' + found.replace(/\\/g, '/');
  }

  return '';
}

// ── SQLiteReader ─────────────────────────────────────────────────────────────

// Normaliza um valor de dir para array deduplicado (aceita string ou array)
function normalizeDirs(val) {
  if (!val) return [];
  const arr = Array.isArray(val) ? val : [val];
  return [...new Set(arr.filter(Boolean))];
}

class SQLiteReader {
  constructor() {
    this._db          = null; // instância sql.js Database
    this._dbPath      = null;
    this._capasDirs   = []; // array de dirs onde buscar capas
    this._musicasDirs = []; // array de dirs onde buscar músicas
    this._imagensDirs = []; // array de dirs onde buscar imagens
    this._schema      = null; // cache de schema detectado
    this._SQL         = null; // módulo sql.js carregado
  }

  isAvailable() {
    // sql.js já está como dependência — sempre disponível
    return true;
  }

  isOpen() {
    return !!(this._db);
  }

  getPath() {
    return this._dbPath;
  }

  /**
   * Abre o SQLite. mediaDirs = { capasDir, musicasDir, imagensDir }.
   * Retorna Promise pois sql.js usa carregamento assíncrono do WASM.
   */
  async open(dbPath, mediaDirs = {}) {
    this.close();

    if (!this._SQL) {
      const { app } = require('electron');
      const appPath    = app.getAppPath();
      const unpacked   = appPath.replace(/app\.asar$/, 'app.asar.unpacked');
      const wasmInAsar = path.join(unpacked, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
      const wasmInDev  = path.join(appPath,  'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
      const wasmPath   = fs.existsSync(wasmInAsar) ? wasmInAsar : wasmInDev;

      const initSqlJs = require('sql.js');
      try {
        this._SQL = await initSqlJs({ locateFile: () => wasmPath });
      } catch (e) {
        this._SQL = null; // garante retry na próxima chamada
        throw e;
      }
    }

    const buf    = fs.readFileSync(dbPath);
    this._db     = new this._SQL.Database(new Uint8Array(buf));
    this._dbPath = dbPath;

    this._capasDirs   = normalizeDirs(mediaDirs.capasDir   || mediaDirs.capasDirs);
    this._musicasDirs = normalizeDirs(mediaDirs.musicasDir || mediaDirs.musicasDirs);
    this._imagensDirs = normalizeDirs(mediaDirs.imagensDir || mediaDirs.imagensDirs);
    this._schema      = null;

    console.log('[SQLiteReader] Aberto:', dbPath);
  }

  close() {
    if (this._db) {
      try { this._db.close(); } catch (_) {}
      this._db     = null;
      this._dbPath = null;
      this._schema = null;
    }
  }

  // ── Helpers internos de schema ─────────────────────────────────────────

  _query(sql, params = []) {
    const res = this._db.exec(sql);
    if (!res[0]) return [];
    const { columns, values } = res[0];
    return values.map(row =>
      Object.fromEntries(columns.map((c, i) => [c, row[i]]))
    );
  }

  _queryOne(sql, params = []) {
    const rows = this._query(sql);
    return rows[0] || null;
  }

  // Comparação por LOWER(): alguns bancos (schema legado do editor de Bíblia,
  // ex: LIVRO/VERSAO_BIBLICA/BIBLIA) guardam nomes de tabela em maiúsculas,
  // enquanto outras partes do schema (categories/albums/musics) usam minúsculas.
  // Uma igualdade direta (name='X') é sensível a maiúsculas/minúsculas e faz o
  // gate falhar silenciosamente mesmo quando a tabela existe (a query real com
  // identificador sem aspas, tipo "FROM LIVRO", resolveria certinho contra uma
  // tabela "livro" — só esse check manual que não resolvia).
  _hasTable(name) {
    const r = this._db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND LOWER(name) = LOWER('${name}')`
    );
    return !!(r[0] && r[0].values.length);
  }

  _hasCols(table, ...cols) {
    try {
      const r = this._db.exec(`PRAGMA table_info(${table})`);
      const existing = (r[0] || { values: [] }).values.map(v => String(v[1]).toLowerCase());
      return Object.fromEntries(cols.map(c => [c, existing.includes(c.toLowerCase())]));
    } catch {
      return Object.fromEntries(cols.map(c => [c, false]));
    }
  }

  _getSchema() {
    if (this._schema) return this._schema;

    const hCat = this._hasCols('categories',   'id_language', 'order', 'slug', 'type');
    const hAlb = this._hasTable('albums')           ? this._hasCols('albums',          'color', 'id_file_image', 'id_language') : {};
    const hCa  = this._hasTable('categories_albums')? this._hasCols('categories_albums','order', 'id_language') : {};
    const hAm  = this._hasTable('albums_musics')    ? this._hasCols('albums_musics',    'track') : {};
    const hMu  = this._hasCols('musics',    'id_file_music', 'id_file_instrumental_music', 'has_instrumental_music', 'id_language', 'duration', 'id_file_image');
    // lyrics: _hasCols() não falha se a tabela não existir (PRAGMA table_info de uma
    // tabela inexistente só retorna 0 linhas, todas as colunas viram false) — por isso
    // guardamos hasLyrics separado, senão "letra vazia" fica indistinguível de "tabela
    // lyrics não existe neste banco" (ver uso em _getMusic()).
    const hasLyrics = this._hasTable('lyrics');
    const hLy  = hasLyrics ? this._hasCols('lyrics', 'id_lyric', 'id_file_image', 'image_position', 'aux_lyric', 'show_slide', 'order', 'id_language', 'instrumental_time', 'time') : {};
    const hFi  = this._hasTable('files')            ? this._hasCols('files',           'dir', 'file_name', 'duration') : {};

    this._schema = {
      hasCatAlbums: this._hasTable('categories_albums'),
      hasAlbums:    this._hasTable('albums'),
      hasAlbMusics: this._hasTable('albums_musics'),
      hasFiles:     this._hasTable('files'),
      hasLyrics,
      cat: hCat, alb: hAlb, ca: hCa, am: hAm, mu: hMu, ly: hLy, fi: hFi,
    };
    return this._schema;
  }

  // ── Helpers de resolução ──────────────────────────────────────────────

  /**
   * Extrai o nome da pasta do álbum a partir do campo files.dir do SQLite.
   * Suporta tanto o formato local (Delphi) quanto o formato de URL da API:
   *   "config\\musicas\\2017 - Eu Creio\\"   → "2017 - Eu Creio"
   *   "config/musicas/1992 - Brilha Jesus/"  → "1992 - Brilha Jesus"
   *   "/musics/pt/2022 - Eu Vou"             → "2022 - Eu Vou"
   *   "/musics/pt/2026 - Meu Lugar no Mundo" → "2026 - Meu Lugar no Mundo"
   *   "/musics/pt/Adoradores 5"              → "Adoradores 5"
   */
  _extractAlbumFromDir(dir) {
    if (!dir) return null;
    const norm = dir.replace(/\\/g, '/').replace(/\/$/, '');
    const parts = norm.split('/');
    // Localiza "musicas" (path local Delphi) ou "musics" (URL da API)
    const idx = parts.findIndex(p => p.toLowerCase() === 'musicas' || p.toLowerCase() === 'musics');
    if (idx >= 0) {
      let next = idx + 1;
      // Pula o código de idioma de 2 letras (pt, en, es, …) que aparece após "musics" no formato API
      if (next < parts.length && /^[a-z]{2}$/i.test(parts[next])) next++;
      if (next < parts.length) {
        const folder = parts[next].trim();
        return folder || null;
      }
    }
    return null;
  }

  // ── Resolução de URLs de mídia ─────────────────────────────────────────

  _resolveCapa(fileName) {
    if (!fileName) return '';
    const local = findLocalFile([...this._capasDirs, ...this._imagensDirs], fileName);
    return local || `app-local://capas/${encodeURIComponent(fileName)}`;
  }

  /**
   * Resolve URL de áudio incluindo a subpasta do álbum (ANO - ALBUM).
   * O URL fallback app-local:// usa o formato correto com a subpasta
   * para que o protocolo handler encontre o arquivo em disco.
   *
   * Importante: a busca recursiva NUNCA varre a pasta-base de músicas inteira.
   * Vários títulos genéricos ("Maranata.mp3", "Prefixo de Louvor.mp3" etc.) se
   * repetem em dezenas de álbuns diferentes no catálogo — uma busca recursiva
   * ampla encontraria o primeiro arquivo de mesmo nome que aparecesse na
   * varredura (de QUALQUER álbum), não necessariamente o do álbum certo,
   * fazendo o app tocar a gravação errada. A recursão fica restrita à própria
   * subpasta do álbum; na pasta-base só é permitida busca direta (sem entrar
   * em subpastas de outros álbuns).
   */
  _resolveAudio(fileName, albumFolder) {
    if (!fileName) return '';
    // Expande cada musicasDir com a subpasta do álbum
    const albumDirs = albumFolder
      ? this._musicasDirs.map(d => path.join(d, albumFolder))
      : [];

    if (albumDirs.length) {
      const local = findLocalFile(albumDirs, fileName);
      if (local) return local;
    }

    // Fallback: arquivo solto direto na pasta-base (sem subpasta) — só busca
    // direta, nunca recursiva (ver aviso acima).
    const flatBase = findLocalFile(this._musicasDirs, fileName, { recursive: false });
    if (flatBase) return flatBase;

    // URL com subpasta: app-local://musicas/2017 - Eu Creio/Arquivo.mp3
    if (albumFolder) {
      return `app-local://musicas/${encodeURIComponent(albumFolder)}/${encodeURIComponent(fileName)}`;
    }
    return `app-local://musicas/${encodeURIComponent(fileName)}`;
  }

  _resolveImage(fileName) {
    if (!fileName) return '';
    const local = findLocalFile([...this._imagensDirs, ...this._capasDirs], fileName);
    return local || `app-local://imagens/${encodeURIComponent(fileName)}`;
  }

  // ── API pública ────────────────────────────────────────────────────────

  /** Verifica se a tabela ARQUIVOS_SISTEMA (catálogo Delphi) existe no banco. */
  hasArquivosSistema() {
    if (!this.isOpen()) return false;
    return this._hasTable('ARQUIVOS_SISTEMA');
  }

  /**
   * Retorna todas as linhas da tabela ARQUIVOS_SISTEMA como array de objetos.
   * Campos: TIPO, ARQUIVO, URL, CHAVE
   * Ordenado por TIPO desc (MUSICA primeiro) e depois CHAVE para agrupar por álbum.
   */
  getArquivosSistema() {
    if (!this.isOpen()) return [];
    try {
      return this._query(
        "SELECT TIPO, ARQUIVO, URL, CHAVE FROM ARQUIVOS_SISTEMA ORDER BY TIPO, CHAVE"
      );
    } catch (_) {
      return [];
    }
  }

  /** Retorna dados para o "filename" lógico (ex: "pt_categories", "album_5", "music_23"). */
  get(filename) {
    if (!this.isOpen()) return null;
    try {
      if (filename === 'pt_categories')  return this._getCategories('pt');
      if (filename === 'en_categories')  return this._getCategories('en');
      if (filename === 'pt_musics')      return this._getMusics('pt');
      if (filename === 'en_musics')      return this._getMusics('en');
      if (filename === 'pt_hymnal')      return this._getHymnal('hymnal');
      if (filename === 'pt_hymnal_1996') return this._getHymnal('hymnal_1996');
      if (filename.startsWith('album_')) return this._getAlbum(Number(filename.slice(6)));
      if (filename.startsWith('music_')) return this._getMusic(Number(filename.slice(6)));
      if (filename.endsWith('_bible_book'))    return this._getBibleBooks();
      if (filename.endsWith('_bible_version')) return this._getBibleVersions();
      const bibleVerseMatch = filename.match(/^bible_(\d+)_(\d+)_(\d+)$/);
      if (bibleVerseMatch) return this._getBibleVerses(bibleVerseMatch[1], bibleVerseMatch[2], bibleVerseMatch[3]);
      return null;
    } catch (e) {
      console.error('[SQLiteReader] Erro em get(', filename, '):', e.message);
      return null;
    }
  }

  // ── Consultas internas ─────────────────────────────────────────────────

  _getCategories(lang = 'pt') {
    const s = this._getSchema();

    const catOrd   = s.cat.order       ? `c."order"` : '0';
    const caOrd    = s.ca.order        ? `ca."order"` : '0';
    const colorSel = s.alb.color       ? 'a.color' : 'NULL AS color';
    const imgSel   = (s.hasFiles && s.alb.id_file_image) ? 'f.file_name AS img_name' : 'NULL AS img_name';

    // Filtra somente coletâneas (type = 'collection'). Sem type, filtra por idioma.
    const conditions = [];
    if (s.cat.type)        conditions.push(`c.type = 'collection'`);
    else if (s.cat.id_language) conditions.push(`c.id_language = '${lang}'`);
    const catWhere = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Pré-constrói mapa albumId → folderName (ex: "2026 - Meu Lugar no Mundo")
    // via files.dir, que é a fonte mais confiável e inclui o ano + nome da pasta.
    const albumFolderMap = new Map();
    if (s.hasAlbMusics && s.hasFiles && s.fi.dir && s.mu.id_file_music) {
      const dirRows = this._query(`
        SELECT am.id_album, MIN(f.dir) AS dir
        FROM   files f
        JOIN   musics m  ON m.id_file_music  = f.id_file
        JOIN   albums_musics am ON am.id_music = m.id_music
        WHERE  f.dir IS NOT NULL AND f.dir != ''
        GROUP  BY am.id_album
      `);
      for (const dr of dirRows) {
        const fn = this._extractAlbumFromDir(dr.dir);
        if (fn) albumFolderMap.set(dr.id_album, fn);
      }
    }

    const rows = this._query(`
      SELECT c.id_category, c.name,
             ${catOrd} AS cat_order,
             ${s.hasCatAlbums ? 'ca.id_album'        : 'NULL AS id_album'},
             ${s.hasCatAlbums ? 'ca.name AS ca_name' : 'NULL AS ca_name'},
             ${caOrd} AS album_order,
             ${s.hasAlbums    ? 'a.name AS a_name'   : 'NULL AS a_name'},
             ${colorSel},
             ${imgSel}
      FROM   categories c
      ${s.hasCatAlbums ? 'LEFT JOIN categories_albums ca ON ca.id_category = c.id_category' : ''}
      ${s.hasAlbums    ? `LEFT JOIN albums a ON a.id_album = ${s.hasCatAlbums ? 'ca.id_album' : '0'}` : ''}
      ${(s.hasFiles && s.alb.id_file_image) ? 'LEFT JOIN files f ON f.id_file = a.id_file_image' : ''}
      ${catWhere}
      ORDER BY cat_order, album_order
    `);

    const catMap = new Map();
    for (const r of rows) {
      if (!catMap.has(r.id_category)) {
        catMap.set(r.id_category, {
          id_category: r.id_category,
          name:        r.name,
          order:       r.cat_order || 0,
          albums:      [],
        });
      }
      if (r.id_album) {
        // Prioridade: files.dir (mais confiável, inclui ano) → albums.name → categories_albums.name
        const folderName = albumFolderMap.get(r.id_album) || null;
        catMap.get(r.id_category).albums.push({
          id_album:  r.id_album,
          name:      folderName || r.a_name || r.ca_name || `Álbum ${r.id_album}`,
          subtitle:  r.ca_name || '',
          color:     r.color   || '#555555',
          url_image: this._resolveCapa(r.img_name),
          order:     r.album_order || 0,
        });
      }
    }
    return [...catMap.values()].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  _getAlbum(idAlbum) {
    const s = this._getSchema();
    if (!s.hasAlbums) return null;

    const aRows = this._query(`SELECT * FROM albums WHERE id_album = ${idAlbum}`);
    if (!aRows.length) return null;
    const aRow = aRows[0];

    let urlImage = '';
    if (s.hasFiles && s.alb.id_file_image && aRow.id_file_image) {
      const fRows = this._query(`SELECT file_name FROM files WHERE id_file = ${aRow.id_file_image}`);
      urlImage = this._resolveCapa(fRows[0]?.file_name);
    }

    // folder_name: nome com ANO incluído, ex: "2017 - Eu Creio"
    // Fonte primária: files.dir (campo exato do banco Delphi com a pasta completa)
    //   ex: "config\musicas\2017 - Eu Creio\"  → extrai "2017 - Eu Creio"
    // Fallback: categories_albums.name (segundo campo mais confiável)
    let folderName = null;

    // 1. Extrai de files.dir da primeira música com áudio deste álbum
    if (s.hasFiles && s.fi.dir && s.hasAlbMusics && s.mu.id_file_music) {
      const audioFile = this._query(`
        SELECT f.dir FROM files f
        JOIN   musics m ON m.id_file_music = f.id_file
        JOIN   albums_musics am ON am.id_music = m.id_music
        WHERE  am.id_album = ${idAlbum}
          AND  f.dir IS NOT NULL AND f.dir != ''
        LIMIT  1
      `)[0];
      if (audioFile?.dir) folderName = this._extractAlbumFromDir(audioFile.dir);
    }

    const categories = [];
    if (s.hasCatAlbums) {
      const catRows = this._query(`
        SELECT ca.name AS ca_name, c.id_category, c.name AS cat_name, c.slug
        FROM   categories_albums ca
        JOIN   categories c ON c.id_category = ca.id_category
        WHERE  ca.id_album = ${idAlbum}
      `);
      for (const cr of catRows) {
        // 2. Fallback: categories_albums.name (pode ter o ano)
        if (!folderName && cr.ca_name) folderName = cr.ca_name;
        categories.push(cr.cat_name);
        if (cr.slug && (cr.slug.includes('hymnal') || cr.slug.includes('hinario'))) {
          categories.push(`hymnal.${cr.slug}`);
        }
      }
    }

    let musics = [];
    if (s.hasAlbMusics) {
      const trackCol  = s.am.track             ? 'am.track'                  : '1 AS track';
      const instrCol  = s.mu.has_instrumental_music
        ? 'm.has_instrumental_music'
        : (s.mu.id_file_instrumental_music
          ? '(CASE WHEN m.id_file_instrumental_music IS NOT NULL AND m.id_file_instrumental_music > 0 THEN 1 ELSE 0 END) AS has_instrumental_music'
          : '0 AS has_instrumental_music');
      const hasDurFile = s.hasFiles && s.fi.duration && s.mu.id_file_music;
      const durCol    = hasDurFile ? 'f_mus.duration AS duration' : '0 AS duration';
      const durJoin   = hasDurFile ? 'LEFT JOIN files f_mus ON f_mus.id_file = m.id_file_music' : '';
      musics = this._query(`
        SELECT m.id_music, m.name, ${durCol}, ${instrCol}, ${trackCol}
        FROM   albums_musics am
        JOIN   musics m ON m.id_music = am.id_music
        ${durJoin}
        WHERE  am.id_album = ${idAlbum}
        ORDER BY track
      `).map(r => ({
        id_music:              r.id_music,
        name:                  r.name || '',
        duration:              r.duration || 0,
        track:                 r.track || 0,
        has_instrumental_music: !!(r.has_instrumental_music),
      }));
    }

    const displayName = folderName || aRow.name || `Álbum ${idAlbum}`;
    return {
      id_album:    idAlbum,
      name:        displayName,
      folder_name: displayName,   // "ANO - ALBUM" para criação de pasta correta
      color:       (s.alb.color ? aRow.color : null) || '#555555',
      url_image:   urlImage,
      categories,
      musics,
    };
  }

  _getMusic(idMusic) {
    const s = this._getSchema();

    const mRows = this._query(`SELECT * FROM musics WHERE id_music = ${idMusic}`);
    if (!mRows.length) return null;
    const mRow = mRows[0];

    // ── 1. Coleta info dos arquivos de áudio (nome + dir + duration) e imagem de fundo ──
    let audName = '', audDir = null, audDuration = '', instrName = '', instrDir = null, urlImage = '';
    if (s.hasFiles) {
      const durSel = s.fi.duration ? ', duration' : '';
      if (s.mu.id_file_music && mRow.id_file_music) {
        const f = this._query(`SELECT file_name, dir${durSel} FROM files WHERE id_file = ${mRow.id_file_music}`)[0];
        if (f) { audName = f.file_name || ''; audDir = f.dir || null; audDuration = f.duration || ''; }
      }
      if (s.mu.id_file_instrumental_music && mRow.id_file_instrumental_music) {
        const f = this._query(`SELECT file_name, dir FROM files WHERE id_file = ${mRow.id_file_instrumental_music}`)[0];
        if (f) { instrName = f.file_name || ''; instrDir = f.dir || null; }
      }
      // Imagem de fundo padrão da música (usada no slide capa e como fallback dos slides sem imagem própria)
      if (s.mu.id_file_image && mRow.id_file_image) {
        const f = this._query(`SELECT file_name FROM files WHERE id_file = ${mRow.id_file_image}`)[0];
        urlImage = this._resolveImage(f?.file_name || '');
      }
    }

    // ── 2. Resolve albumFolder antes de construir URLs ─────────────────────────
    // Prioridade: files.dir (exato, Delphi) → categories_albums.name → albums.name
    let albumFolder = null;
    if (s.fi && s.fi.dir) {
      albumFolder = this._extractAlbumFromDir(audDir) || this._extractAlbumFromDir(instrDir);
    }
    if (!albumFolder && s.hasAlbMusics) {
      if (s.hasCatAlbums) {
        const caRow = this._query(`
          SELECT ca.name FROM categories_albums ca
          JOIN   albums_musics am ON am.id_album = ca.id_album
          WHERE  am.id_music = ${idMusic} AND ca.name IS NOT NULL AND ca.name != ''
          LIMIT  1
        `)[0];
        albumFolder = caRow?.name || null;
      }
      if (!albumFolder && s.hasAlbums) {
        const aRow = this._query(`
          SELECT a.name FROM albums a
          JOIN   albums_musics am ON am.id_album = a.id_album
          WHERE  am.id_music = ${idMusic} LIMIT 1
        `)[0];
        albumFolder = aRow?.name || null;
      }
    }

    // ── 3. Resolve URLs com albumFolder já conhecido ───────────────────────────
    const instrFolder = (s.fi && s.fi.dir && instrDir)
      ? (this._extractAlbumFromDir(instrDir) || albumFolder)
      : albumFolder;
    const urlMusic        = this._resolveAudio(audName, albumFolder);
    const urlInstrumental = this._resolveAudio(instrName, instrFolder);

    let lRows = [];
    if (!s.hasLyrics) {
      // Sem isso, "letra vazia" e "tabela lyrics não existe neste banco" ficam
      // indistinguíveis no app — só aparece como slides:[] sem pista nenhuma.
      console.warn(`[SQLiteReader] Tabela "lyrics" não encontrada neste banco — música ${idMusic} ficará sem slides de letra.`);
    } else {
      const orderCol   = s.ly.order             ? '"order"'          : 'rowid';
      const showSlCol  = s.ly.show_slide        ? 'show_slide'       : '1 AS show_slide';
      const auxCol     = s.ly.aux_lyric         ? 'aux_lyric'        : 'NULL AS aux_lyric';
      const imgIdCol   = s.ly.id_file_image     ? 'id_file_image'    : 'NULL AS id_file_image';
      const imgPosCol  = s.ly.image_position    ? 'image_position'   : '4 AS image_position';
      const timeCol    = s.ly.time              ? 'time'             : "'00:00' AS time";
      const instrTCol  = s.ly.instrumental_time ? 'instrumental_time': "'00:00' AS instrumental_time";
      // id_lyric: mesmo campo que a API expõe, usado pelo componente "Letra completa"
      // (`:key="line.id_lyric"`) — sem ele o Vue trata todas as linhas como a mesma key.
      const idLyricCol = s.ly.id_lyric           ? 'id_lyric'         : 'rowid AS id_lyric';

      try {
        lRows = this._query(`
          SELECT ${idLyricCol}, lyric, ${auxCol}, ${timeCol}, ${instrTCol},
                 ${showSlCol}, ${imgIdCol}, ${imgPosCol},
                 ${orderCol} AS sort_order
          FROM   lyrics
          WHERE  id_music = ${idMusic}
          ORDER BY sort_order
        `);
      } catch (e) {
        // Erro real de schema (coluna/tipo inesperado) — sem o try/catch isso derrubava
        // a leitura da música inteira (áudio incluso) por causa só da letra.
        console.warn(`[SQLiteReader] Falha ao ler "lyrics" da música ${idMusic}:`, e.message || e);
        lRows = [];
      }
    }

    const slides = lRows.map(l => {
      let slideImg = '';
      if (s.hasFiles && s.ly.id_file_image && l.id_file_image) {
        const f = this._query(`SELECT file_name FROM files WHERE id_file = ${l.id_file_image}`);
        slideImg = this._resolveImage(f[0]?.file_name);
      }
      return {
        id_lyric:          l.id_lyric,
        id_music:          idMusic,
        order:             l.sort_order,
        lyric:             l.lyric              || '',
        aux_lyric:         l.aux_lyric          || '',
        time:              l.time               || '00:00',
        instrumental_time: l.instrumental_time  || '00:00',
        show_slide:        l.show_slide !== 0,
        url_image:         slideImg,
        image_position:    l.image_position ?? 4,
      };
    });

    // ── 4. Lista de álbuns (necessária para setAlbumInfo em Media.js) ───────────
    let albums = [];
    if (s.hasAlbMusics) {
      const trackSel  = s.am.track           ? 'am.track'                  : '0 AS track';
      const nameSel   = s.hasAlbums          ? 'a.name AS album_name'      : 'NULL AS album_name';
      const nameJoin  = s.hasAlbums          ? 'LEFT JOIN albums a ON a.id_album = am.id_album' : '';
      const hasImgCol = s.hasAlbums && s.hasFiles && s.alb.id_file_image;
      const imgSel    = hasImgCol            ? 'f.file_name AS img_name'   : 'NULL AS img_name';
      const imgJoin   = hasImgCol            ? 'LEFT JOIN files f ON f.id_file = a.id_file_image' : '';
      const albumRows = this._query(`
        SELECT DISTINCT am.id_album, ${trackSel}, ${nameSel}, ${imgSel}
        FROM   albums_musics am ${nameJoin} ${imgJoin}
        WHERE  am.id_music = ${idMusic}
        ORDER BY am.track
      `);
      albums = albumRows.map(r => ({
        id_album:  r.id_album,
        name:      r.album_name || `Álbum ${r.id_album}`,
        track:     r.track || 0,
        order:     0,
        url_image: this._resolveCapa(r.img_name),
      }));
    }

    return {
      id_music:               idMusic,
      name:                   mRow.name || '',
      duration:               audDuration || 0,
      url_image:              urlImage,
      url_music:              urlMusic,
      url_instrumental_music: urlInstrumental,
      has_instrumental_music: !!(s.mu.has_instrumental_music
                                 ? mRow.has_instrumental_music
                                 : urlInstrumental),
      albums,
      slides,
    };
  }

  _getHymnal(slug) {
    const s   = this._getSchema();
    if (!s.hasCatAlbums || !s.hasAlbMusics) return [];

    // Tenta resolver categoria pelo slug
    let categoryId = null;
    if (s.cat.slug) {
      const catRow = this._query(`SELECT id_category FROM categories WHERE slug = '${slug}'`);
      categoryId = catRow[0]?.id_category ?? null;
    }
    if (!categoryId) {
      const fallback = {
        'hymnal': 3, 'hymnal_1996': 4,          // slugs reais no DB
        'pt_hymnal': 3, 'pt_hymnal_1996': 4,    // nomes legados
      };
      categoryId = fallback[slug] || null;
    }
    if (!categoryId) return [];

    const trackCol  = s.am.track                  ? 'am.track'                  : '1 AS track';
    const instrCol  = s.mu.has_instrumental_music
      ? 'm.has_instrumental_music'
      : (s.mu.id_file_instrumental_music
        ? '(CASE WHEN m.id_file_instrumental_music IS NOT NULL AND m.id_file_instrumental_music > 0 THEN 1 ELSE 0 END) AS has_instrumental_music'
        : '0 AS has_instrumental_music');
    const hasDurFile = s.hasFiles && s.fi.duration && s.mu.id_file_music;
    const durCol    = hasDurFile ? 'f_mus.duration AS duration' : '0 AS duration';
    const durJoin   = hasDurFile ? 'LEFT JOIN files f_mus ON f_mus.id_file = m.id_file_music' : '';

    return this._query(`
      SELECT m.id_music, m.name, ${durCol}, ${instrCol}, ${trackCol}
      FROM   categories_albums ca
      JOIN   albums_musics am ON am.id_album = ca.id_album
      JOIN   musics m ON m.id_music = am.id_music
      ${durJoin}
      WHERE  ca.id_category = ${categoryId}
      ORDER BY track
    `).map(r => ({
      id_music:              r.id_music,
      name:                  r.name || '',
      duration:              r.duration || 0,
      track:                 r.track || 0,
      has_instrumental_music: !!(r.has_instrumental_music),
    }));
  }

  _getMusics(lang = 'pt') {
    const s = this._getSchema();

    const langFilter = s.mu.id_language ? `WHERE m.id_language = '${lang}'` : '';
    const instrCol   = s.mu.has_instrumental_music
      ? 'm.has_instrumental_music'
      : (s.mu.id_file_instrumental_music
        ? '(CASE WHEN m.id_file_instrumental_music IS NOT NULL AND m.id_file_instrumental_music > 0 THEN 1 ELSE 0 END) AS has_instrumental_music'
        : '0 AS has_instrumental_music');
    const hasDurFile = s.hasFiles && s.fi.duration && s.mu.id_file_music;
    const durCol     = hasDurFile ? 'f_mus.duration AS duration' : '0 AS duration';
    const durJoin    = hasDurFile ? 'LEFT JOIN files f_mus ON f_mus.id_file = m.id_file_music' : '';

    const rows = this._query(`
      SELECT m.id_music, m.name, ${durCol}, ${instrCol}
      FROM   musics m
      ${durJoin}
      ${langFilter}
      ORDER BY m.name
    `);

    const albumsPerMusic = {};
    if (s.hasAlbMusics && s.hasAlbums) {
      for (const r of this._query(`
        SELECT am.id_music, a.id_album, a.name AS album_name
        FROM   albums_musics am
        JOIN   albums a ON a.id_album = am.id_album
      `)) {
        if (!albumsPerMusic[r.id_music]) albumsPerMusic[r.id_music] = [];
        albumsPerMusic[r.id_music].push({ id_album: r.id_album, name: r.album_name || '' });
      }
    }

    return rows.map(r => ({
      id_music:              r.id_music,
      name:                  r.name || '',
      duration:              r.duration || 0,
      has_instrumental_music: !!(r.has_instrumental_music),
      albums:                albumsPerMusic[r.id_music] || [],
      albums_names:          (albumsPerMusic[r.id_music] || []).map(a => a.name).join(' '),
    }));
  }

  // ── Bíblia ──────────────────────────────────────────────────────────────
  // Suporta dois schemas possíveis dentro do mesmo database.db:
  //   1. Moderno (bible_book/bible_version/bible_verse) — mesmas tabelas e
  //      nomes de coluna usados pela API online; é o que aparece quando o
  //      banco vem de uma exportação recente do sistema.
  //   2. Legado Delphi (LIVRO/VERSAO_BIBLICA/BIBLIA) — schema do editor de
  //      Bíblia do app antigo, com nomes de tabela/coluna em português.
  // Tenta o schema moderno primeiro; cai para o legado se as tabelas não existirem.

  // Nota importante: para uma coluna sem "AS alias", o sql.js/SQLite rotula o
  // resultado com o nome EXATAMENTE como está gravado no schema (ex: "id",
  // mesmo se a query escrever "ID") — não com a grafia usada na query. Como não
  // sabemos a priori se o banco real usa maiúsculas ou minúsculas, toda coluna
  // aqui usa "AS alias_fixo" para garantir uma chave previsível no JS.
  _getBibleBooks() {
    if (this._hasTable('bible_book')) {
      return this._query(`
        SELECT id_bible_book, name, abbreviation, chapters, color
        FROM   bible_book
        ORDER BY book_number
      `).map(r => ({
        id_bible_book: r.id_bible_book,
        name:          r.name || '',
        abbreviation:  r.abbreviation || (r.name || '').slice(0, 3).toUpperCase(),
        chapters:      r.chapters || 1,
        color:         r.color || null,
      }));
    }
    if (!this._hasTable('LIVRO')) return [];
    const cols = this._hasCols('LIVRO', 'ABREVIACAO', 'ABREV', 'COR', 'CAPITULOS');
    const abbrevCol = cols.ABREVIACAO ? 'ABREVIACAO' : (cols.ABREV ? 'ABREV' : null);
    const colorCol  = cols.COR ? 'COR' : null;
    const rows = this._query(`
      SELECT ID AS id_bible_book, LIVRO AS book_name,
             ${abbrevCol ? abbrevCol : 'NULL'} AS abbrev,
             ${cols.CAPITULOS ? 'CAPITULOS' : '1'} AS chapters,
             ${colorCol ? colorCol : 'NULL'} AS color
      FROM   LIVRO
      ORDER BY ID
    `);
    return rows.map(r => ({
      id_bible_book: r.id_bible_book,
      name:          r.book_name || '',
      abbreviation:  r.abbrev || (r.book_name || '').slice(0, 3).toUpperCase(),
      chapters:      r.chapters || 1,
      color:         r.color || null,
    }));
  }

  _getBibleVersions() {
    if (this._hasTable('bible_version')) {
      return this._query(`
        SELECT id_bible_version, name, abbreviation
        FROM   bible_version
        ORDER BY name
      `).map(r => ({
        id_bible_version: r.id_bible_version,
        abbreviation:      r.abbreviation || '',
        name:              r.name || '',
      }));
    }
    if (!this._hasTable('VERSAO_BIBLICA')) return [];
    // rowid vira o id numérico usado pelo app — BIBLIA.VERSAO referencia a
    // sigla (texto), não um id, então _getBibleVerses resolve de volta via rowid.
    return this._query(`SELECT rowid AS id_bible_version, SIGLA AS sigla, VERSAO AS versao_nome FROM VERSAO_BIBLICA ORDER BY VERSAO`)
      .map(r => ({
        id_bible_version: r.id_bible_version,
        abbreviation:      r.sigla || '',
        name:              r.versao_nome || '',
      }));
  }

  _getBibleVerses(idVersion, idBook, chapter) {
    if (this._hasTable('bible_verse')) {
      const rows = this._query(`
        SELECT verse AS num, text AS txt FROM bible_verse
        WHERE  id_bible_book = ${Number(idBook)}
          AND  id_bible_version = ${Number(idVersion)}
          AND  chapter = ${Number(chapter)}
        ORDER BY verse
      `);
      const map = {};
      for (const r of rows) map[r.num] = r.txt || '';
      return map;
    }
    if (!this._hasTable('BIBLIA') || !this._hasTable('VERSAO_BIBLICA')) return {};
    const versionRow = this._queryOne(`SELECT SIGLA AS sigla FROM VERSAO_BIBLICA WHERE rowid = ${Number(idVersion)}`);
    if (!versionRow) return {};
    const sigla = String(versionRow.sigla).replace(/'/g, "''");
    const rows = this._query(`
      SELECT VERSICULO AS num, PASSAGEM AS txt FROM BIBLIA
      WHERE  LIVRO = ${Number(idBook)} AND VERSAO = '${sigla}' AND CAPITULO = ${Number(chapter)}
      ORDER BY VERSICULO
    `);
    const map = {};
    for (const r of rows) map[r.num] = r.txt || '';
    return map;
  }
}

// Singleton — um único leitor por processo principal
module.exports = new SQLiteReader();
