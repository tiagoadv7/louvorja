/**
 * Audita divergências entre a leitura OFFLINE (SQLite local, o que o app usa em
 * "Modo Offline") e a fonte ONLINE (API — a mesma que a versão web e o app em modo
 * normal usam) para cada música: álbuns vinculados e slides de letra.
 *
 * Sintomas que este script investiga:
 *   - "música tocando em álbum errado" (junção albums_musics do SQLite legado
 *     desatualizada/errada em relação à API)
 *   - "botão Letra retorna vazio no modo offline" (tabela lyrics ausente/incompleta
 *     no SQLite local para aquela música)
 *
 * Este script NÃO corrige nada automaticamente — apenas gera um CSV para revisão
 * manual antes de qualquer alteração nos dados reais.
 *
 * Uso:
 *   node scripts/auditar-integridade.js
 *
 * Configuração (variáveis de ambiente; lidas também de um .env/.env.production
 * na raiz do projeto, mesmas chaves usadas pelo app):
 *   LOUVORJA_DB_PATH       Caminho direto para o arquivo database.db (tem prioridade)
 *   LOUVORJA_INSTALL_DIR   Pasta de instalação (default: D:\Louvor JA\LouvorJA);
 *                          usada como <pasta>\config\database.db quando LOUVORJA_DB_PATH
 *                          não é informado
 *   VITE_URL_DATABASE      Base da API online (a mesma que Path.js/Media.js usam)
 *   VITE_API_TOKEN         Token de acesso à API (header Api-Token)
 *
 * Sem VITE_URL_DATABASE/VITE_API_TOKEN configurados, o script roda mesmo assim,
 * mas só reporta a leitura offline (sem comparar contra a API) — use nesse caso
 * para pelo menos inspecionar o que o SQLite local está retornando.
 */

const fs   = require('fs');
const path = require('path');

// ── Carrega .env/.env.production da raiz do projeto sem depender de pacote extra ──
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadDotEnv(path.join(__dirname, '..', '.env'));
loadDotEnv(path.join(__dirname, '..', '.env.production'));

const INSTALL_DIR = process.env.LOUVORJA_INSTALL_DIR || 'D:\\Louvor JA\\LouvorJA';
const DB_SQLITE    = process.env.LOUVORJA_DB_PATH || path.join(INSTALL_DIR, 'config', 'database.db');
const API_BASE      = process.env.VITE_URL_DATABASE || '';
const API_TOKEN      = process.env.VITE_API_TOKEN || '';
const OUT_CSV       = path.join(__dirname, '..', 'auditoria-resultado.csv');

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

let _remoteOk = 0;
let _remoteFail = 0;
let _firstFailReason = null;

async function fetchRemoteMusic(idMusic) {
  if (!API_BASE) return null;
  // Mesmo formato de Database.js/Path.js: sem extensão .json no path — o servidor
  // já responde JSON para "/music_{id}" (ver comentário no topo do arquivo).
  const url = `${API_BASE.replace(/\/$/, '')}/music_${idMusic}?${Date.now()}`;
  try {
    const res = await fetch(url, { headers: API_TOKEN ? { 'Api-Token': API_TOKEN } : {} });
    if (!res.ok) {
      _remoteFail++;
      if (!_firstFailReason) _firstFailReason = `HTTP ${res.status} em ${url}`;
      return null;
    }
    _remoteOk++;
    return await res.json();
  } catch (e) {
    _remoteFail++;
    if (!_firstFailReason) _firstFailReason = `${e.message} em ${url}`;
    return null;
  }
}

async function main() {
  if (!fs.existsSync(DB_SQLITE)) {
    console.error(`[ERRO] Banco não encontrado: ${DB_SQLITE}`);
    console.error('       Ajuste a variável de ambiente LOUVORJA_INSTALL_DIR se a instalação estiver em outro caminho.');
    process.exit(1);
  }
  if (!API_BASE) {
    console.warn('[AVISO] VITE_URL_DATABASE não configurado — rodando só com a leitura offline, sem comparar contra a API.');
  }

  const initSqlJs = require(path.join(__dirname, '..', 'node_modules', 'sql.js'));
  const wasmPath   = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db  = new SQL.Database(new Uint8Array(fs.readFileSync(DB_SQLITE)));

  const query = (sql) => {
    const res = db.exec(sql);
    if (!res[0]) return [];
    const { columns, values } = res[0];
    return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
  };
  const hasTable = (name) => !!query(`SELECT name FROM sqlite_master WHERE type='table' AND LOWER(name) = LOWER('${name}')`).length;
  const cols     = (table) => { const r = db.exec(`PRAGMA table_info(${table})`); return r[0] ? r[0].values.map(v => v[1]) : []; };

  const hasAlbMusics = hasTable('albums_musics');
  const hasAlbums    = hasTable('albums');
  const hasLyrics    = hasTable('lyrics');
  const lCols        = hasLyrics ? cols('lyrics') : [];
  const lyricsIdCol  = lCols.includes('id_music') ? 'id_music' : null;

  console.log(`[INFO] Banco: ${DB_SQLITE}`);
  console.log(`[INFO] albums_musics: ${hasAlbMusics ? 'ok' : 'AUSENTE'} | albums: ${hasAlbums ? 'ok' : 'AUSENTE'} | lyrics: ${hasLyrics ? 'ok' : 'AUSENTE'}`);

  const musics = query('SELECT id_music, name FROM musics ORDER BY id_music');
  console.log(`[INFO] ${musics.length} músicas encontradas — auditando...`);

  const rows = [['id_music', 'name', 'problema', 'albuns_offline', 'albuns_online', 'slides_offline', 'slides_online']];
  let checked = 0;
  let flagged = 0;

  for (const m of musics) {
    checked++;
    if (checked % 200 === 0) process.stdout.write(`    → ${checked}/${musics.length}\r`);

    // Álbuns vinculados localmente (junção relacional albums_musics/albums)
    const localAlbums = hasAlbMusics
      ? query(`
          SELECT am.id_album, ${hasAlbums ? 'a.name' : 'NULL'} AS name
          FROM   albums_musics am
          ${hasAlbums ? 'LEFT JOIN albums a ON a.id_album = am.id_album' : ''}
          WHERE  am.id_music = ${m.id_music}
        `)
      : [];
    const localAlbumIds = new Set(localAlbums.map(a => a.id_album));

    // Slides de letra localmente
    const localSlideCount = (hasLyrics && lyricsIdCol)
      ? query(`SELECT COUNT(*) AS n FROM lyrics WHERE ${lyricsIdCol} = ${m.id_music}`)[0]?.n || 0
      : 0;

    const remote = await fetchRemoteMusic(m.id_music);
    const remoteAlbumIds = remote ? new Set((remote.albums || []).map(a => a.id_album)) : null;
    const remoteSlideCount = remote ? Object.values(remote.lyric || remote.slides || {}).length : null;

    const problems = [];

    if (remoteAlbumIds) {
      const sameSize = localAlbumIds.size === remoteAlbumIds.size;
      const sameSet  = sameSize && [...localAlbumIds].every(id => remoteAlbumIds.has(id));
      if (!sameSet) problems.push('albuns_divergentes');
    }

    if (remote && remoteSlideCount != null) {
      if (localSlideCount === 0 && remoteSlideCount > 0) problems.push('letra_vazia_offline');
    } else if (!hasLyrics) {
      problems.push('tabela_lyrics_ausente');
    }

    if (problems.length) {
      flagged++;
      rows.push([
        m.id_music,
        m.name,
        problems.join('|'),
        [...localAlbumIds].join(';'),
        remoteAlbumIds ? [...remoteAlbumIds].join(';') : 'n/d (sem API)',
        localSlideCount,
        remoteSlideCount ?? 'n/d (sem API)',
      ]);
    }
  }

  db.close();

  fs.writeFileSync(OUT_CSV, rows.map(r => r.map(csvEscape).join(',')).join('\n'), 'utf8');

  console.log('');
  console.log('════════════════════════════════════════');
  console.log(' Auditoria concluída');
  console.log(`   Músicas verificadas : ${checked}`);
  console.log(`   Comparações c/ API  : ${_remoteOk} ok, ${_remoteFail} falharam`);
  if (_remoteFail && _firstFailReason) console.log(`   Primeiro erro de API: ${_firstFailReason}`);
  if (API_BASE && _remoteOk === 0) {
    console.log('   [AVISO] Nenhuma comparação com a API funcionou — os resultados abaixo');
    console.log('           NÃO validam álbum/letra contra a fonte online, só a leitura local.');
  }
  console.log(`   Divergências        : ${flagged}`);
  console.log(`   Relatório           : ${OUT_CSV}`);
  console.log('════════════════════════════════════════');
  console.log(' Nenhuma correção foi aplicada — revise o CSV antes de mexer em');
  console.log(' albums_musics/lyrics no banco real.');
}

main().catch(e => { console.error('[ERRO FATAL]', e.message); process.exit(1); });
