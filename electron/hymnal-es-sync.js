// Mantém o hinário em espanhol atualizado a partir da API.
//
// O servidor é a fonte: /db/es_hymnal traz a lista de hinos e /db/music_<id> traz
// cada hino com as URLs do cantado e do playback. Se a lista mudou (hino novo,
// nome, duração ou letra), regrava es_hymnal.json, album_9000.json (usado pela
// verificação de arquivos) e os music_<id>.json dos hinos novos ou alterados.
// Não baixa áudio: a verificação de arquivos mostra o que falta, igual ao português.

const fs = require('fs');
const path = require('path');

const HYMNAL_ALBUM_ID = 9000;
const HYMNAL_FOLDER = 'Himnario Adventista';
const CONCURRENCY = 10;

// Assinatura do que importa pro app: se mudar, o hino é regravado.
const signature = (h) => JSON.stringify([h.id_music, h.name, h.track, h.has_instrumental_music, h.duration, h.lyric]);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

async function pool(items, worker, size) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await worker(items[i]);
      }
    }),
  );
}

/**
 * @param {object} opts
 * @param {string} opts.dbDir        pasta db/ do app (onde ficam es_hymnal.json, album_9000.json, music_<id>.json)
 * @param {string} opts.apiDbBase    base do endpoint /db da API, ex.: https://api.louvorja.com.br/db
 * @param {string} [opts.token]      token da API (cabeçalho Api-Token), se houver
 * @param {(url: string, init?: object) => Promise<Response>} opts.fetch
 * @returns {Promise<{ ok: boolean, changed: number, total?: number, error?: string }>}
 */
async function refreshHymnalEs({ dbDir, apiDbBase, token, fetch }) {
  const headers = token ? { 'Api-Token': token } : {};
  const getJson = async (url) => {
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} em ${url}`);
    return (await resp.json()).data;
  };

  // A API pagina (padrão 50 por página); pede uma página grande e, se ainda
  // faltar registro, segue paginando. Só usa a lista se bater com o total informado.
  let serverList;
  try {
    serverList = [];
    let page = 1;
    let total = Infinity;
    while (serverList.length < total) {
      const resp = await fetch(`${apiDbBase}/es_hymnal?page=${page}&per_page=1000`, { headers });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} em es_hymnal`);
      const body = await resp.json();
      const rows = Array.isArray(body.data) ? body.data : [];
      total = Number(body.meta?.total ?? rows.length);
      if (rows.length === 0) break;
      serverList.push(...rows);
      page++;
    }
    if (serverList.length !== total) throw new Error(`lista incompleta: ${serverList.length} de ${total}`);
  } catch (e) {
    return { ok: false, changed: 0, error: e.message };
  }
  if (serverList.length === 0) {
    return { ok: false, changed: 0, error: 'lista vazia na API' };
  }

  const localPath = path.join(dbDir, 'es_hymnal.json');
  const localList = readJson(localPath, []);
  const localSig = new Map(localList.map((h) => [h.id_music, signature(h)]));
  const changed = serverList.filter((h) => localSig.get(h.id_music) !== signature(h));
  const removed = localList.some((h) => !serverList.some((s) => s.id_music === h.id_music));
  if (changed.length === 0 && !removed) return { ok: true, changed: 0, total: serverList.length };

  // Hinos novos ou alterados: registro completo da API (mesmo formato do catálogo em português).
  const failed = [];
  await pool(changed, async (h) => {
    try {
      const music = await getJson(`${apiDbBase}/music_${h.id_music}`);
      if (!music) throw new Error('sem registro');
      fs.writeFileSync(path.join(dbDir, `music_${h.id_music}.json`), JSON.stringify(music), 'utf8');
    } catch (_) {
      failed.push(h.id_music);
    }
  }, CONCURRENCY);

  // Só grava a lista nova se todos os hinos alterados chegaram; senão a próxima
  // verificação tenta de novo os que faltaram (a lista antiga continua valendo).
  if (failed.length) return { ok: false, changed: changed.length - failed.length, error: `${failed.length} hino(s) falharam` };

  fs.writeFileSync(localPath, JSON.stringify(serverList), 'utf8');
  fs.writeFileSync(
    path.join(dbDir, `album_${HYMNAL_ALBUM_ID}.json`),
    JSON.stringify({
      id_album: HYMNAL_ALBUM_ID,
      name: 'Himnario Adventista',
      folder_name: HYMNAL_FOLDER,
      color: '#1565C0',
      url_image: 'app-local://imagens/generico_116.jpg',
      categories: [],
      musics: serverList.map((h, i) => ({
        id_music: h.id_music,
        name: h.name,
        has_instrumental_music: h.has_instrumental_music ?? 0,
        duration: h.duration || '00:00:00',
        track: i + 1,
      })),
    }),
    'utf8',
  );
  return { ok: true, changed: changed.length, total: serverList.length };
}

module.exports = { refreshHymnalEs, signature };
