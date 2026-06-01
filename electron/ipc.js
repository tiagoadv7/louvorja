const { ipcMain, dialog, shell, app, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('./store');

// Resolve o arquivo WASM do sql.js tanto em dev quanto no app empacotado.
// electron-builder desempacota sql.js para app.asar.unpacked via asarUnpack.
function resolveSqlWasm() {
  const appPath = app.getAppPath();
  const unpackedPath = appPath.replace(/app\.asar$/, 'app.asar.unpacked');
  const wasmInUnpacked = path.join(unpackedPath, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  if (fs.existsSync(wasmInUnpacked)) return wasmInUnpacked;
  // Fallback para modo dev (sem ASAR)
  return path.join(appPath, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
}

function setupIpc(mainWindow) {
  // ── Armazenamento persistente ──────────────────────────────────────────────
  ipcMain.handle('store:get', (_, key, defaultValue = null) => {
    return Store.get(key, defaultValue);
  });

  ipcMain.handle('store:set', (_, key, value) => {
    Store.set(key, value);
    return true;
  });

  ipcMain.handle('store:remove', (_, key) => {
    Store.remove(key);
    return true;
  });

  ipcMain.handle('store:clear', () => {
    Store.clear();
    return true;
  });

  // ── Informações do sistema ─────────────────────────────────────────────────
  ipcMain.handle('app:get-version', () => app.getVersion());

  ipcMain.handle('app:get-os', () => process.platform);

  ipcMain.handle('app:get-user-data-path', () => app.getPath('userData'));

  ipcMain.handle('app:open-external', (_, url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      shell.openExternal(url);
    }
  });

  ipcMain.handle('app:show-item-in-folder', (_, filePath) => {
    shell.showItemInFolder(filePath);
  });

  // ── Telas / displays ───────────────────────────────────────────────────────
  ipcMain.handle('screen:get-all', () => {
    const primary = screen.getPrimaryDisplay();
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: d.label || `Display ${d.id}`,
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
      primary: d.id === primary.id,
    }));
  });

  // ── Operações de arquivo ───────────────────────────────────────────────────
  ipcMain.handle('fs:select-file', async (_, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: options.title || 'Selecionar arquivo',
      filters: options.filters || [{ name: 'Todos os arquivos', extensions: ['*'] }],
      properties: options.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    });
    if (result.canceled) return null;
    return options.multiple ? result.filePaths : result.filePaths[0];
  });

  ipcMain.handle('fs:select-folder', async (_, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: options.title || 'Selecionar pasta',
      properties: ['openDirectory'],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('fs:save-dialog', async (_, options = {}) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: options.title || 'Salvar arquivo',
      defaultPath: options.defaultPath,
      filters: options.filters || [{ name: 'Todos os arquivos', extensions: ['*'] }],
    });
    if (result.canceled) return null;
    return result.filePath;
  });

  ipcMain.handle('fs:read-file', (_, filePath, encoding = 'utf8') => {
    try {
      return fs.readFileSync(filePath, encoding);
    } catch (e) {
      console.error('[IPC] read-file error:', e.message);
      return null;
    }
  });

  ipcMain.handle('fs:write-file', (_, filePath, data) => {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, data, 'utf8');
      return true;
    } catch (e) {
      console.error('[IPC] write-file error:', e.message);
      return false;
    }
  });

  ipcMain.handle('fs:delete-file', (_, filePath) => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return true;
    } catch (e) {
      console.error('[IPC] delete-file error:', e.message);
      return false;
    }
  });

  ipcMain.handle('fs:read-dir', (_, dirPath) => {
    try {
      if (!fs.existsSync(dirPath)) return [];
      return fs.readdirSync(dirPath).map((name) => {
        const full = path.join(dirPath, name);
        const stat = fs.statSync(full);
        return { name, path: full, isDirectory: stat.isDirectory(), size: stat.size };
      });
    } catch (e) {
      console.error('[IPC] read-dir error:', e.message);
      return [];
    }
  });

  ipcMain.handle('fs:exists', (_, filePath) => {
    return fs.existsSync(filePath);
  });

  ipcMain.handle('fs:get-path', (_, name) => {
    const allowed = ['home', 'appData', 'userData', 'temp', 'downloads', 'documents', 'pictures', 'music', 'videos'];
    if (allowed.includes(name)) return app.getPath(name);
    return null;
  });

  // ── Identificação de monitores ────────────────────────────────────────────
  ipcMain.handle('screen:identify', () => {
    const { BrowserWindow: BW } = require('electron');
    const allDisplays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    const primaryScale = primary.scaleFactor || 1;

    // Tamanho base da janela em pixels físicos (referência: monitor primário)
    const BASE_W_PHYS = 220;
    const BASE_H_PHYS = 140;

    const wins = allDisplays.map((display, index) => {
      const { x, y, width, height } = display.bounds;
      const scale = display.scaleFactor || 1;

      // Converte pixels físicos para DIP do monitor atual
      // para que o tamanho físico final seja sempre igual ao do monitor primário
      const winW = Math.round(BASE_W_PHYS * primaryScale / scale);
      const winH = Math.round(BASE_H_PHYS * primaryScale / scale);

      const cx = x + Math.floor(width  / 2) - Math.floor(winW / 2);
      const cy = y + Math.floor(height / 2) - Math.floor(winH / 2);

      const label = display.id === primary.id ? 'Principal' : `Monitor ${index + 1}`;
      const num   = index + 1;
      // Ajusta zoom do HTML para compensar DPI diferente do monitor primário
      const zoom  = primaryScale / scale;

      const win = new BW({
        x: cx, y: cy, width: winW, height: winH,
        frame: false, alwaysOnTop: true, skipTaskbar: true,
        transparent: true, backgroundColor: '#00000000',
        hasShadow: false, focusable: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      const html = `<!DOCTYPE html>
<html style="margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;">
<body style="margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;
  display:flex;align-items:center;justify-content:center;">
  <div style="
    width:100%;height:100%;box-sizing:border-box;
    background:rgba(12,12,14,0.92);
    border:2.5px solid rgba(255,255,255,0.75);
    border-radius:14px;
    box-shadow:0 0 0 1px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.08);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="font-size:52px;font-weight:700;line-height:1;letter-spacing:-1px">${num}</div>
    <div style="font-size:13px;margin-top:8px;opacity:0.85;font-weight:500">${label}</div>
    <div style="font-size:11px;opacity:0.45;margin-top:4px;letter-spacing:0.3px">${width}×${height}</div>
  </div>
</body></html>`;

      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      // Aplica zoom para que o conteúdo HTML fique no tamanho correto
      win.webContents.on('did-finish-load', () => {
        if (!win.isDestroyed()) win.webContents.setZoomFactor(zoom);
      });

      return win;
    });

    setTimeout(() => {
      wins.forEach((w) => { if (!w.isDestroyed()) w.close(); });
    }, 3000);

    return true;
  });

  // ── Banco de dados local ───────────────────────────────────────────────────
  const { net } = require('electron');

  const getDbDir = () => Store.get('db_local_folder') || path.join(app.getPath('userData'), 'db');

  ipcMain.handle('db:get-local-folder', () => Store.get('db_local_folder', null));

  ipcMain.handle('db:set-local-folder', (_, folderPath) => {
    if (folderPath) {
      Store.set('db_local_folder', folderPath);
    } else {
      Store.remove('db_local_folder');
    }
    return true;
  });

  ipcMain.handle('db:local-exists', (_, filename) => {
    return fs.existsSync(path.join(getDbDir(), `${filename}.json`));
  });

  ipcMain.handle('db:local-get', (_, filename) => {
    try {
      const fp = path.join(getDbDir(), `${filename}.json`);
      if (!fs.existsSync(fp)) return null;
      return JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch (e) {
      console.error('[IPC] db:local-get error:', e.message);
      return null;
    }
  });

  ipcMain.handle('db:local-save', (_, filename, data) => {
    try {
      const dir = getDbDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${filename}.json`), JSON.stringify(data), 'utf8');
      return true;
    } catch (e) {
      console.error('[IPC] db:local-save error:', e.message);
      return false;
    }
  });

  ipcMain.handle('db:local-list', () => {
    try {
      const dir = getDbDir();
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const fp = path.join(dir, f);
          return { name: f.replace('.json', ''), size: fs.statSync(fp).size };
        });
    } catch (e) {
      return [];
    }
  });

  ipcMain.handle('db:local-delete', (_, filename) => {
    try {
      const fp = path.join(getDbDir(), `${filename}.json`);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      return true;
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('db:local-clear', () => {
    try {
      const dir = getDbDir();
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(f => {
          try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
        });
      }
      return true;
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('db:local-download', async (_, filename, url, token) => {
    try {
      const response = await net.fetch(url, {
        headers: token ? { 'Api-Token': token } : {},
      });
      if (!response.ok) {
        console.error(`[IPC] db:local-download HTTP ${response.status} para ${filename}`);
        return false;
      }
      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        console.error(`[IPC] db:local-download resposta inválida (não-JSON) para ${filename}:`, parseErr.message);
        return false;
      }
      const dir = getDbDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${filename}.json`), JSON.stringify(data), 'utf8');
      return true;
    } catch (e) {
      console.error('[IPC] db:local-download error:', e.message);
      return false;
    }
  });

  // ── Estrutura de pastas config/ ───────────────────────────────────────────
  //
  // Regras de localização (em ordem de prioridade):
  //   1. Dev   → userData/config  (não polui a árvore de fontes)
  //   2. Portátil → PORTABLE_EXECUTABLE_DIR/config  (junto ao .exe portátil)
  //   3. Instalado → {dir do exe}/config  (junto ao LouvorJA.exe instalado)
  //
  const getInstallDir = () => {
    if (!app.isPackaged) return app.getPath('userData');
    if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
    return path.dirname(app.getPath('exe'));
  };

  const CONFIG_SUBFOLDERS = ['capas', 'fontes', 'help', 'ico', 'imagens', 'imagens_dxl', 'imagens_hlp', 'imagens_onl', 'musicas'];
  const getConfigDir = () => path.join(getInstallDir(), 'config');

  // Sanitiza o nome do álbum para uso como nome de pasta no Windows
  const sanitizeDir = (name) =>
    (name || 'Desconhecido')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 80) || 'Desconhecido';

  // albumName opcional → com album: subpasta por álbum; sem: pasta base (para buscas)
  const getAutoMediaDir  = (albumName) => albumName
    ? path.join(getConfigDir(), 'musicas', sanitizeDir(albumName))
    : path.join(getConfigDir(), 'musicas');
  const getAutoImagesDir = (albumName) => albumName
    ? path.join(getConfigDir(), 'imagens', sanitizeDir(albumName))
    : path.join(getConfigDir(), 'imagens');
  const getAutoCapasDir  = (albumName) => albumName
    ? path.join(getConfigDir(), 'capas', sanitizeDir(albumName))
    : path.join(getConfigDir(), 'capas');

  // Cria as subpastas base na inicialização
  const initConfigFolders = () => {
    const configDir = getConfigDir();
    for (const sub of CONFIG_SUBFOLDERS) {
      const p = path.join(configDir, sub);
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    }
  };
  initConfigFolders();

  // Strip query params and sanitize filename for local storage
  const safeBasename = (raw) => {
    if (!raw) return '';
    const clean = raw.replace(/\\/g, '/').split('?')[0].split('#')[0];
    return path.basename(clean).trim();
  };

  // overwrite=false → skip existing files (returns 'skipped'); overwrite=true → always write
  const downloadBinary = async (url, destPath, hdrs = {}, overwrite = false) => {
    try {
      if (!overwrite && fs.existsSync(destPath)) return 'skipped';
      const resp = await net.fetch(url, Object.keys(hdrs).length ? { headers: hdrs } : {});
      if (!resp.ok) { console.warn('[IPC] downloadBinary HTTP', resp.status, url); return false; }
      const buffer = Buffer.from(await resp.arrayBuffer());
      if (!buffer.length) { console.warn('[IPC] downloadBinary empty body:', url); return false; }
      const dir = path.dirname(destPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(destPath, buffer);
      return true;
    } catch (e) {
      console.error('[IPC] downloadBinary error:', e.message, '| url:', url);
      return false;
    }
  };

  const resolveFileUrl = (raw, filesBaseUrl) => {
    if (!raw) return null;
    const cleanRaw = raw.split('?')[0].split('#')[0];
    if (cleanRaw.startsWith('http://') || cleanRaw.startsWith('https://') || cleanRaw.startsWith('file://')) return cleanRaw;
    const base = filesBaseUrl.replace(/\/$/, '');
    return base + (cleanRaw.startsWith('/') ? '' : '/') + cleanRaw;
  };

  // overwrite=true → replace existing binary files; overwrite=false → skip them
  ipcMain.handle('album:download-full', async (event, albumId, dbBaseUrl, filesBaseUrl, token, overwrite = false) => {
    const headers = token ? { 'Api-Token': token } : {};
    const dbDir   = getDbDir();
    const date    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const stats   = { json: 0, audio: 0, images: 0, skipped: 0, errors: 0 };

    const send = (current, total, message, step = 'progress') => {
      try { event.sender.send('album:download-progress', { albumId, step, total, current, message }); } catch (_) {}
    };

    const dl = async (raw, destDir) => {
      const name = safeBasename(raw);
      if (!name) return 'skip-noname';
      const url = resolveFileUrl(raw, filesBaseUrl);
      if (!url) return false;
      return downloadBinary(url, path.join(destDir, name), headers, overwrite);
    };

    try {
      // 1. Album JSON
      const albumResp = await net.fetch(`${dbBaseUrl}/album_${albumId}?${date}`, { headers });
      if (!albumResp.ok) return { success: false, error: `HTTP ${albumResp.status}` };
      const albumData = await albumResp.json();
      if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
      fs.writeFileSync(path.join(dbDir, `album_${albumId}.json`), JSON.stringify(albumData), 'utf8');
      stats.json++;

      // Pastas específicas por álbum
      const albumName = albumData.name || `album_${albumId}`;
      const capasDir  = getAutoCapasDir(albumName);
      const audioDir  = getAutoMediaDir(albumName);
      const imagesDir = getAutoImagesDir(albumName);

      const musics     = albumData.musics || [];
      const hasCover   = !!albumData.url_image;
      const grandTotal = 1 + (hasCover ? 1 : 0) + musics.length;
      let done = 1;

      send(done, grandTotal, hasCover ? 'Baixando capa do álbum...' : `Baixando ${musics.length} músicas...`);

      // 2. Capa → config/capas/{albumName}/
      if (albumData.url_image) {
        const r = await dl(albumData.url_image, capasDir);
        if (r === true) stats.images++;
        else if (r === 'skipped') stats.skipped++;
        done++;
        send(done, grandTotal, `Baixando ${musics.length} músicas...`);
      }

      // 3. Músicas → config/musicas/{albumName}/ e config/imagens/{albumName}/
      const total = musics.length;
      for (let i = 0; i < total; i++) {
        const m = musics[i];
        send(done, grandTotal, `[${i + 1}/${total}] ${m.name || `Música ${m.id_music}`}`);

        const musicResp = await net.fetch(`${dbBaseUrl}/music_${m.id_music}?${date}`, { headers });
        if (!musicResp.ok) { stats.errors++; done++; continue; }

        const md = await musicResp.json();
        fs.writeFileSync(path.join(dbDir, `music_${m.id_music}.json`), JSON.stringify(md), 'utf8');
        stats.json++;

        // Áudio
        for (const key of ['url_music', 'url_instrumental_music']) {
          if (!md[key]) continue;
          const r = await dl(md[key], audioDir);
          if (r === true) stats.audio++;
          else if (r === 'skipped') stats.skipped++;
          else if (r === false) stats.errors++;
        }

        // Imagens de slide (suporta 'slides' array e 'lyric' objeto)
        const slideList = Array.isArray(md.slides)
          ? md.slides
          : (md.lyric && typeof md.lyric === 'object' ? Object.values(md.lyric) : []);
        const allImages = [md.url_image, ...slideList.map(s => s?.url_image)].filter(Boolean);
        for (const raw of allImages) {
          const r = await dl(raw, imagesDir);
          if (r === true) stats.images++;
          else if (r === 'skipped') stats.skipped++;
          else if (r === false) stats.errors++;
        }

        done++;
      }

      send(grandTotal, grandTotal, 'Concluído!', 'done');
      return { success: true, stats, albumName };
    } catch (e) {
      console.error('[IPC] album:download-full error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // ── Diálogos ───────────────────────────────────────────────────────────────
  ipcMain.handle('dialog:message', async (_, options) => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: options.type || 'info',
      title: options.title || 'LouvorJA',
      message: options.message || '',
      detail: options.detail || '',
      buttons: options.buttons || ['OK'],
      defaultId: 0,
      cancelId: options.buttons ? options.buttons.length - 1 : 0,
    });
    return result.response;
  });

  // ── Arquivos de mídia locais ──────────────────────────────────────────────
  const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.aac', '.m4a', '.flac', '.wma'];

  function scanMediaFolder(dir, maxDepth = 2, depth = 0) {
    let results = [];
    try {
      for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory() && depth < maxDepth) {
          results = results.concat(scanMediaFolder(full, maxDepth, depth + 1));
        } else if (AUDIO_EXTS.includes(path.extname(item).toLowerCase())) {
          results.push(item);
        }
      }
    } catch (_) {}
    return results;
  }

  ipcMain.handle('media:get-base-folder', () => Store.get('media_base_folder', null));

  ipcMain.handle('media:set-base-folder', (_, folderPath) => {
    Store.set('media_base_folder', folderPath || null);
    return true;
  });

  ipcMain.handle('media:scan-folder', (_, folderPath) => {
    if (!folderPath || !fs.existsSync(folderPath)) return { count: 0 };
    const files = scanMediaFolder(folderPath);
    return { count: files.length };
  });

  // Converte path absoluto em file:// URL.
  // encodeURI preserva ':', '/' e outros separadores, mas codifica espaços e caracteres especiais.
  const toFileUrl = (absPath) => {
    return 'file:///' + encodeURI(absPath.replace(/\\/g, '/'));
  };

  ipcMain.handle('media:resolve-file', (_, filename) => {
    if (!filename) return null;
    const name = safeBasename(filename);
    if (!name) return null;

    const search = (dir, depth) => {
      if (!dir || !fs.existsSync(dir)) return null;
      try {
        for (const item of fs.readdirSync(dir)) {
          const full = path.join(dir, item);
          const stat = fs.statSync(full);
          if (stat.isDirectory() && depth < 2) {
            const r = search(full, depth + 1);
            if (r) return r;
          } else if (item.toLowerCase() === name.toLowerCase()) {
            return full;
          }
        }
      } catch (_) {}
      return null;
    };

    // 1. Pasta configurada pelo usuário
    const userFolder = Store.get('media_base_folder');
    if (userFolder) {
      const found = search(userFolder, 0);
      if (found) return toFileUrl(found);
    }

    // 2. Direto na pasta de auto-download (mais rápido que scan)
    const direct = path.join(getAutoMediaDir(), name);
    if (fs.existsSync(direct)) return toFileUrl(direct);

    // 3. Scan na pasta de auto-download
    const autoFound = search(getAutoMediaDir(), 0);
    if (autoFound) return toFileUrl(autoFound);

    return null;
  });

  // ── Pasta de imagens locais ───────────────────────────────────────────────
  ipcMain.handle('media:get-images-folder', () => Store.get('media_images_folder', null));

  ipcMain.handle('media:set-images-folder', (_, folderPath) => {
    Store.set('media_images_folder', folderPath || null);
    return true;
  });

  ipcMain.handle('media:resolve-image', (_, filename) => {
    if (!filename) return null;
    const name = safeBasename(filename);
    if (!name) return null;

    function searchDir(dir, depth) {
      if (!dir || !fs.existsSync(dir)) return null;
      try {
        for (const item of fs.readdirSync(dir)) {
          const full = path.join(dir, item);
          const stat = fs.statSync(full);
          if (stat.isDirectory() && depth < 3) {
            const r = searchDir(full, depth + 1);
            if (r) return r;
          } else if (item.toLowerCase() === name.toLowerCase()) {
            return full;
          }
        }
      } catch (_) {}
      return null;
    }

    // Caminhos diretos (O(1), mais rápido que scan recursivo)
    for (const dir of [getAutoImagesDir(), getAutoCapasDir()]) {
      const direct = path.join(dir, name);
      if (fs.existsSync(direct)) return toFileUrl(direct);
    }

    // 1. Pasta de imagens configurada pelo usuário
    const imagesFolder = Store.get('media_images_folder');
    if (imagesFolder) {
      const found = searchDir(imagesFolder, 0);
      if (found) return toFileUrl(found);
    }

    // 2. Pasta de mídia configurada pelo usuário
    const mediaFolder = Store.get('media_base_folder');
    if (mediaFolder) {
      const found = searchDir(mediaFolder, 0);
      if (found) return toFileUrl(found);
    }

    // 3. Scan completo em config/imagens e config/capas
    const foundInAuto = searchDir(getAutoImagesDir(), 0);
    if (foundInAuto) return toFileUrl(foundInAuto);

    const foundInCapas = searchDir(getAutoCapasDir(), 0);
    if (foundInCapas) return toFileUrl(foundInCapas);

    return null;
  });

  // ── Importação SQLite ─────────────────────────────────────────────────────
  ipcMain.handle('sqlite:import', async (event, { dbPath, capasPath }) => {
    const results = { categories: 0, musics: 0, lyrics: 0, images: 0, errors: [] };
    try {
      // ── Inicializa sql.js ────────────────────────────────────────────────
      const initSqlJs = require('sql.js');
      const SQL = await initSqlJs({ locateFile: () => resolveSqlWasm() });

      const buffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(new Uint8Array(buffer));

      // Respeita pasta customizada configurada pelo usuário
      const dbDir    = getDbDir();
      const capasDir = getAutoCapasDir();
      if (!fs.existsSync(dbDir))    fs.mkdirSync(dbDir,    { recursive: true });
      if (!fs.existsSync(capasDir)) fs.mkdirSync(capasDir, { recursive: true });

      const userData = app.getPath('userData');

      // helper: convert query to array of objects
      const query = (sql) => {
        const res = db.exec(sql);
        if (!res[0]) return [];
        const { columns, values } = res[0];
        return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
      };

      // helper: get column names of a table
      const cols = (table) => {
        const res = db.exec(`PRAGMA table_info(${table})`);
        return res[0] ? res[0].values.map(r => r[1]) : [];
      };

      // helper: check if a table exists
      const hasTable = (table) => {
        const res = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`);
        return !!(res[0] && res[0].values.length);
      };

      // ── Valida tabelas obrigatórias ──────────────────────────────────────
      for (const t of ['categories', 'musics', 'lyrics']) {
        if (!hasTable(t)) throw new Error(`Banco inválido: tabela '${t}' não encontrada.`);
      }

      const hasCatAlbumsT   = hasTable('categories_albums');
      const hasAlbumsT      = hasTable('albums');
      const hasAlbumsMusicT = hasTable('albums_musics');

      const cCols  = cols('categories');
      const caCols = hasCatAlbumsT   ? cols('categories_albums') : [];
      const aCols  = hasAlbumsT      ? cols('albums')            : [];
      const mCols  = cols('musics');
      const amCols = hasAlbumsMusicT ? cols('albums_musics')     : [];
      const fCols  = cols('files');
      const lCols  = cols('lyrics');

      // ── 1. Categorias + Álbuns ───────────────────────────────────────────
      event.sender.send('sqlite:progress', { percent: 5, message: 'Lendo categorias e coletâneas...' });

      const hasCatLang  = cCols.includes('id_language');
      const hasCatOrder = cCols.includes('order');
      const hasCatSlug  = cCols.includes('slug');
      const hasCaOrder  = caCols.includes('order');
      const hasAColor   = aCols.includes('color');
      const hasAFileImg = aCols.includes('id_file_image');
      const hasFilesT   = hasTable('files');

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

      const catMap = {};
      cats.forEach(r => {
        if (!catMap[r.id_category]) {
          catMap[r.id_category] = { id_category: r.id_category, name: r.name, order: r.cat_order || 0, slug: r.slug || '', albums: [] };
        }
        if (r.id_album) {
          const imgPath = r.img_name
            ? path.join(userData, 'files', 'capas', r.img_name).replace(/\\/g, '/')
            : '';
          catMap[r.id_category].albums.push({
            id_album: r.id_album,
            name: r.ca_name || r.a_name,
            subtitle: r.a_name,
            color: r.color || '#555555',
            url_image: imgPath ? `file:///${imgPath}` : '',
            order: r.album_order || 0,
          });
        }
      });
      fs.writeFileSync(path.join(dbDir, 'pt_categories.json'), JSON.stringify(Object.values(catMap)), 'utf8');
      results.categories = Object.keys(catMap).length;

      // ── 2. Músicas ───────────────────────────────────────────────────────
      event.sender.send('sqlite:progress', { percent: 25, message: 'Lendo músicas...' });

      const hasMInstr  = mCols.includes('id_file_instrumental_music');
      const hasMFileMu = mCols.includes('id_file_music');
      const hasAmTrack = amCols.includes('track');
      const hasFDir    = fCols.includes('dir');
      const hasMuLang  = mCols.includes('id_language');

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
          const audPath = r.aud_name
            ? path.join(r.aud_dir || '', r.aud_name).replace(/\\/g, '/')
            : '';
          musicMap[r.id_music] = {
            id_music: r.id_music,
            name: r.name,
            has_instrumental_music: !!r.id_file_instrumental_music,
            lyric: '',
            albums_names: '',
            albums: [],
            url_audio: audPath,
          };
        }
        if (r.id_album && !musicMap[r.id_music].albums.find(a => a.id_album === r.id_album)) {
          musicMap[r.id_music].albums.push({ id_album: r.id_album, name: r.a_name, pivot: { track: r.track || 0 } });
        }
      });
      Object.values(musicMap).forEach(m => {
        m.albums_names = m.albums.map(a => a.name).join(', ');
      });
      fs.writeFileSync(path.join(dbDir, 'pt_musics.json'), JSON.stringify(Object.values(musicMap)), 'utf8');
      results.musics = Object.keys(musicMap).length;

      // ── 3. Letras por música (slides) ────────────────────────────────────
      const hasLFileImg    = lCols.includes('id_file_image');
      const hasLImgPos     = lCols.includes('image_position');
      const hasLAuxLyric   = lCols.includes('aux_lyric');
      const hasLShowSlide  = lCols.includes('show_slide');
      const hasLOrder      = lCols.includes('order');
      const hasLLang       = lCols.includes('id_language');

      const lyricRows = query(`
        SELECT l.id_music, l.lyric,
               ${hasLAuxLyric  ? 'l.aux_lyric'    : "'' AS aux_lyric"},
               ${hasLOrder     ? 'l."order"'       : '0 AS "order"'},
               ${hasLShowSlide ? 'l.show_slide'    : '1 AS show_slide'}
               ${hasFilesT && hasLFileImg ? ', f.file_name AS img_name' : ", NULL AS img_name"}
               ${hasLImgPos    ? ', l.image_position' : ", 'center' AS image_position"}
        FROM lyrics l
        ${hasFilesT && hasLFileImg ? 'LEFT JOIN files f ON f.id_file = l.id_file_image' : ''}
        ${hasLLang ? "WHERE l.id_language = 'pt'" : ''}
        ORDER BY l.id_music ${hasLOrder ? ', l."order"' : ''}
      `);

      const slidesMap = {};
      lyricRows.forEach(r => {
        if (!slidesMap[r.id_music]) slidesMap[r.id_music] = [];
        const imgPath = r.img_name
          ? path.join(userData, 'files', 'images', r.img_name).replace(/\\/g, '/')
          : '';
        slidesMap[r.id_music].push({
          cover: r.order === 0 || r.order === null,
          lyric: r.lyric || '',
          aux_lyric: r.aux_lyric || '',
          url_image: imgPath ? `file:///${imgPath}` : '',
          image_position: r.image_position || 'center',
        });
      });

      let lCount = 0;
      const totalL = Object.keys(slidesMap).length;
      for (const [id_music, slides] of Object.entries(slidesMap)) {
        const musicInfo = musicMap[id_music] || {};
        fs.writeFileSync(
          path.join(dbDir, `music_${id_music}.json`),
          JSON.stringify({ id_music: parseInt(id_music), name: musicInfo.name || '', slides }),
          'utf8'
        );
        lCount++;
        if (lCount % 200 === 0) {
          const pct = totalL > 0 ? Math.round(40 + (lCount / totalL) * 45) : 85;
          event.sender.send('sqlite:progress', { percent: pct, message: `Salvando letras... ${lCount}/${totalL}` });
        }
      }
      results.lyrics = lCount;

      // Atualiza o lyric da capa em pt_musics
      Object.entries(slidesMap).forEach(([id_music, slides]) => {
        if (musicMap[id_music]) {
          const cover = slides.find(s => s.cover);
          musicMap[id_music].lyric = cover ? cover.lyric : (slides[0]?.lyric || '');
        }
      });
      fs.writeFileSync(path.join(dbDir, 'pt_musics.json'), JSON.stringify(Object.values(musicMap)), 'utf8');

      db.close();

      // ── 4. Imagens das capas ─────────────────────────────────────────────
      if (capasPath && fs.existsSync(capasPath)) {
        event.sender.send('sqlite:progress', { percent: 88, message: 'Copiando imagens de capas...' });
        const imgs = fs.readdirSync(capasPath).filter(f => /\.(jpg|jpeg|png|bmp)$/i.test(f));
        for (const img of imgs) {
          try {
            fs.copyFileSync(path.join(capasPath, img), path.join(capasDir, img));
            results.images++;
          } catch (_) {}
        }
      }

      // ── 5. Salva metadados da importação ─────────────────────────────────
      Store.set('sqlite_import', {
        date: new Date().toISOString(),
        dbPath,
        capasPath,
        categories: results.categories,
        musics: results.musics,
      });

      event.sender.send('sqlite:progress', { percent: 100, message: 'Importação concluída!' });
      return { success: true, ...results };
    } catch (e) {
      console.error('[IPC] sqlite:import error:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('sqlite:get-import-info', () => {
    return Store.get('sqlite_import', null);
  });

  ipcMain.handle('sqlite:clear', () => {
    Store.remove('sqlite_import');
    return true;
  });

  // ── Servidor de registro (QR Code) ────────────────────────────────────────
  let regServer    = null;
  let regPort      = 0;
  let regLocalIp   = '127.0.0.1';
  let registrations = [];
  let regFwRule    = null;

  function getLocalIps() {
    const os = require('os');
    const nets = os.networkInterfaces();
    // Adapters that are clearly virtual/VPN — will be deprioritized but still included
    const VIRTUAL_RE = /vmware|vmnet|virtualbox|vethernet|docker|hamachi|zerotier|nordlynx|mullvad|wireguard|tap\d|tun\d|vbox|pseudo/i;
    // Adapters typically used for real network connections
    const REAL_RE    = /wi.?fi|wlan|ethernet|local area connection|eth\d|en\d/i;
    const seen = new Set();
    const p1 = [], p2 = [], p3 = [];

    for (const [name, addrs] of Object.entries(nets)) {
      for (const addr of addrs) {
        if (addr.family !== 'IPv4' || addr.internal || seen.has(addr.address)) continue;
        seen.add(addr.address);
        const isLan = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(addr.address);
        if (REAL_RE.test(name) && isLan)       p1.push(addr.address); // Wi-Fi/Ethernet, LAN → best
        else if (!VIRTUAL_RE.test(name) && isLan) p2.push(addr.address); // unknown adapter, LAN
        else if (!VIRTUAL_RE.test(name))          p2.push(addr.address); // unknown, non-LAN
        else                                      p3.push(addr.address); // virtual/VPN → last resort
      }
    }
    return [...p1, ...p2, ...p3];
  }

  ipcMain.handle('regserver:start', async (event) => {
    if (regServer) return { port: regPort, ip: regLocalIp, ips: getLocalIps() };
    const http = require('http');
    const allIps = getLocalIps();
    regLocalIp    = allIps[0] || '127.0.0.1';
    registrations = [];

    const form = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Inscrição</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  background:linear-gradient(135deg,#1b2a41 0%,#0d1b2a 100%);
  min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);
  border-radius:22px;padding:40px 32px;width:100%;max-width:380px;text-align:center}
.icon{font-size:52px;margin-bottom:12px}
h1{color:#fff;font-size:22px;margin-bottom:6px}
p{color:rgba(255,255,255,0.55);font-size:13px;margin-bottom:28px}
input{width:100%;padding:14px 16px;
  background:rgba(255,255,255,0.09);border:1px solid rgba(255,255,255,0.18);
  border-radius:12px;color:#fff;font-size:16px;margin-bottom:14px;outline:none;
  transition:border-color .2s,background .2s}
input::placeholder{color:rgba(255,255,255,0.35)}
input:focus{border-color:rgba(255,255,255,0.45);background:rgba(255,255,255,0.13)}
button{width:100%;padding:14px;
  background:linear-gradient(90deg,#3498db,#2980b9);border:none;
  border-radius:12px;color:#fff;font-size:16px;font-weight:700;cursor:pointer;
  transition:opacity .2s,transform .1s}
button:active{transform:scale(0.98)}
button:disabled{opacity:.5;cursor:not-allowed}
.ok{display:none;margin-top:20px}
.ok-icon{font-size:48px;animation:pop .5s cubic-bezier(.34,1.56,.64,1)}
@keyframes pop{from{transform:scale(0)}to{transform:scale(1)}}
.ok p{color:#2ecc71;font-size:17px;font-weight:600;margin-top:8px}
</style>
</head>
<body>
<div class="card">
  <div class="icon">🎲</div>
  <h1>Participar do Sorteio</h1>
  <p>Digite seu nome para entrar na roleta</p>
  <form id="f">
    <input id="name" type="text" placeholder="Seu nome completo" maxlength="80" required autocomplete="off"/>
    <button type="submit" id="btn">Participar</button>
  </form>
  <div class="ok" id="ok">
    <div class="ok-icon">✅</div>
    <p>Inscrito com sucesso!</p>
  </div>
</div>
<script>
document.getElementById('f').onsubmit=async(e)=>{
  e.preventDefault();
  const n=document.getElementById('name').value.trim();
  if(!n)return;
  const btn=document.getElementById('btn');
  btn.disabled=true;btn.textContent='Enviando...';
  try{
    const r=await fetch('/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n})});
    if(r.ok){document.getElementById('f').style.display='none';document.getElementById('ok').style.display='block';}
  }catch{btn.disabled=false;btn.textContent='Participar';}
};
<\/script>
</body>
</html>`;

    regServer = require('http').createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

      if (req.method === 'POST' && req.url === '/register') {
        let body = '';
        req.on('data', c => body += c.toString());
        req.on('end', () => {
          try {
            const { name } = JSON.parse(body);
            const clean = String(name || '').trim().slice(0, 80);
            if (clean) {
              registrations.push(clean);
              try { event.sender.send('regserver:registration', clean); } catch (_) {}
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch (_) { res.writeHead(400); res.end(); }
        });
        return;
      }

      if (req.method === 'GET' && req.url === '/list') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(registrations));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(form);
    });

    await new Promise((resolve, reject) => {
      regServer.listen(0, '0.0.0.0', () => { regPort = regServer.address().port; resolve(); });
      regServer.on('error', reject);
    });

    // Attempt to open the port in Windows Firewall (requires elevation; fails silently otherwise)
    if (process.platform === 'win32') {
      regFwRule = `LouvorJA-Sorteio-${regPort}`;
      require('child_process').exec(
        `netsh advfirewall firewall add rule name="${regFwRule}" dir=in action=allow protocol=TCP localport=${regPort} profile=any`,
        { windowsHide: true },
        () => {}
      );
    }

    return { port: regPort, ip: regLocalIp, ips: getLocalIps() };
  });

  ipcMain.handle('regserver:stop', () => {
    if (regServer) { regServer.close(); regServer = null; regPort = 0; }
    registrations = [];
    if (process.platform === 'win32' && regFwRule) {
      const rule = regFwRule;
      regFwRule = null;
      require('child_process').exec(
        `netsh advfirewall firewall delete rule name="${rule}"`,
        { windowsHide: true },
        () => {}
      );
    }
    return true;
  });

  ipcMain.handle('regserver:get-list', () => registrations);

  ipcMain.handle('regserver:clear', () => { registrations = []; return true; });

  // ── Geração de QR Code ────────────────────────────────────────────────────
  ipcMain.handle('qrcode:generate', async (_, text, opts = {}) => {
    try {
      const QRCode = require('qrcode');
      return await QRCode.toDataURL(text, {
        width:  opts.width  || 240,
        margin: opts.margin || 2,
        color: {
          dark:  opts.dark  || '#000000',
          light: opts.light || '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });
    } catch (e) {
      console.error('[IPC] qrcode:generate error:', e.message);
      return null;
    }
  });

  // ── Pasta config/ ─────────────────────────────────────────────────────────
  ipcMain.handle('config:get-dir', () => getConfigDir());

  // ── Verificação e download de arquivos em falta ───────────────────────────
  ipcMain.handle('files:scan-missing', async () => {
    try {
      const dbDir = getDbDir();
      if (!fs.existsSync(dbDir)) return { total: 0, missing: [], counts: {} };

      const missing = [];
      const seen    = new Set();

      // destDir já é a pasta do álbum; verifica e registra se o arquivo não existe
      const addMissing = (rawUrl, destDir, type) => {
        if (!rawUrl) return;
        const name = safeBasename(rawUrl);
        if (!name) return;
        const dest = path.join(destDir, name);
        if (seen.has(dest)) return;
        seen.add(dest);
        if (!fs.existsSync(dest)) missing.push({ url: rawUrl, dest, type, name });
      };

      const albumFiles = fs.readdirSync(dbDir).filter(f => f.startsWith('album_') && f.endsWith('.json'));

      for (const albumFile of albumFiles) {
        let albumData;
        try { albumData = JSON.parse(fs.readFileSync(path.join(dbDir, albumFile), 'utf8')); }
        catch (_) { continue; }

        // Pastas específicas por álbum
        const albumName  = albumData.name || albumFile.replace('.json', '');
        const capasDir   = getAutoCapasDir(albumName);
        const audioDir   = getAutoMediaDir(albumName);
        const imagesDir  = getAutoImagesDir(albumName);

        addMissing(albumData.url_image, capasDir, 'cover');

        for (const music of (albumData.musics || [])) {
          const mFile = path.join(dbDir, `music_${music.id_music}.json`);
          if (!fs.existsSync(mFile)) continue;

          let md;
          try { md = JSON.parse(fs.readFileSync(mFile, 'utf8')); }
          catch (_) { continue; }

          addMissing(md.url_music, audioDir, 'audio');
          addMissing(md.url_instrumental_music, audioDir, 'audio');
          addMissing(md.url_image, imagesDir, 'image');

          const slideList = Array.isArray(md.slides)
            ? md.slides
            : (md.lyric && typeof md.lyric === 'object' ? Object.values(md.lyric) : []);
          for (const slide of slideList) addMissing(slide?.url_image, imagesDir, 'image');
        }
      }

      const counts = missing.reduce((acc, m) => { acc[m.type] = (acc[m.type] || 0) + 1; return acc; }, {});
      return { total: missing.length, missing, counts };
    } catch (e) {
      console.error('[IPC] files:scan-missing error:', e.message);
      return { total: 0, missing: [], counts: {}, error: e.message };
    }
  });

  ipcMain.handle('files:download-missing', async (event, missingList, filesBaseUrl, token) => {
    try {
      const hdrs  = token ? { 'Api-Token': token } : {};
      const total = missingList.length;
      let downloaded = 0, errors = 0;

      const send = (current, message) => {
        try { event.sender.send('files:download-progress', { current, total, message }); } catch (_) {}
      };

      for (let i = 0; i < missingList.length; i++) {
        const item = missingList[i];
        send(i, `[${i + 1}/${total}] ${item.name}`);
        const url = resolveFileUrl(item.url, filesBaseUrl);
        const result = url ? await downloadBinary(url, item.dest, hdrs, true) : false;
        if (result === true) {
          downloaded++;
        } else {
          errors++;
          console.warn('[IPC] files:download-missing falhou:', item.url, '| result:', result);
        }
      }

      send(total, `Concluído! ${downloaded} baixado(s), ${errors} erro(s).`);
      return { success: true, downloaded, errors };
    } catch (e) {
      console.error('[IPC] files:download-missing error:', e.message);
      return { success: false, error: e.message };
    }
  });

  console.log('[IPC] Handlers registrados com sucesso');
}

module.exports = { setupIpc };
