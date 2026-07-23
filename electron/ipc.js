const { ipcMain, dialog, shell, app, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('./store');
const sqliteReader = require('./sqlite-reader');

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

  // ── Sistema ───────────────────────────────────────────────────────────────
  ipcMain.handle('app:hostname', () => {
    return require('os').hostname().split('.')[0];
  });

  // ── Telas / displays ───────────────────────────────────────────────────────
  ipcMain.handle('screen:get-all', () => {
    const primary = screen.getPrimaryDisplay();
    let nonPrimaryIdx = 0;
    return screen.getAllDisplays().map((d) => {
      const isPrimary = d.id === primary.id;
      const label = isPrimary ? 'Principal' : `Monitor ${++nonPrimaryIdx}`;
      return {
        id: d.id,
        label,
        bounds: d.bounds,
        workArea: d.workArea,
        scaleFactor: d.scaleFactor,
        primary: isPrimary,
      };
    });
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

    // Tamanho base da janela em pixels físicos (referência: 1920×1080)
    const BASE_W_PHYS = 220;
    const BASE_H_PHYS = 140;

    let nonPrimaryIdx = 0;
    const wins = allDisplays.map((display) => {
      const { x, y, width, height } = display.bounds;
      const scale = display.scaleFactor || 1;

      // Escala proporcional à resolução física do display (referência 1920px de largura)
      // Clampado entre 1× (monitores pequenos) e 3× (painéis LED/TV 4K+)
      const physW = width * scale;
      const sizeFactor = Math.max(1, Math.min(3, physW / 1920));

      const wPhys = Math.round(BASE_W_PHYS * sizeFactor);
      const hPhys = Math.round(BASE_H_PHYS * sizeFactor);

      // Converte pixels físicos para DIP do monitor atual
      const winW = Math.round(wPhys * primaryScale / scale);
      const winH = Math.round(hPhys * primaryScale / scale);

      const cx = x + Math.floor(width  / 2) - Math.floor(winW / 2);
      const cy = y + Math.floor(height / 2) - Math.floor(winH / 2);

      const isPrimary = display.id === primary.id;
      const label = isPrimary ? 'Principal' : `Monitor ${++nonPrimaryIdx}`;
      const num   = isPrimary ? 0 : nonPrimaryIdx;
      const zoom  = primaryScale / scale;

      // Fontes escaladas proporcionalmente ao display
      const fsNum   = Math.round(52  * sizeFactor);
      const fsLabel = Math.round(13  * sizeFactor);
      const fsRes   = Math.round(11  * sizeFactor);
      const border  = Math.max(2, Math.round(2.5 * sizeFactor));
      const radius  = Math.round(14  * sizeFactor);

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
    border:${border}px solid rgba(255,255,255,0.75);
    border-radius:${radius}px;
    box-shadow:0 0 0 1px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.08);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="font-size:${fsNum}px;font-weight:700;line-height:1;letter-spacing:-1px">${num}</div>
    <div style="font-size:${fsLabel}px;margin-top:${Math.round(8*sizeFactor)}px;opacity:0.85;font-weight:500">${label}</div>
    <div style="font-size:${fsRes}px;opacity:0.45;margin-top:${Math.round(4*sizeFactor)}px;letter-spacing:0.3px">${width}×${height}</div>
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

  // Localização de LEITURA: onde estão os arquivos originais do LouvorJA
  //   Dev       → userData
  //   Portátil  → PORTABLE_EXECUTABLE_DIR
  //   Instalado → pasta do .exe  (pode ser Program Files — read-only)
  const getInstallDir = () => {
    if (!app.isPackaged) return app.getPath('userData');
    if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
    return path.dirname(app.getPath('exe'));
  };

  // Base GRAVÁVEL — como o LouvorJA Delphi: usa a pasta do exe quando gravável.
  //   Dev       → userData
  //   Portátil  → PORTABLE_EXECUTABLE_DIR
  //   Instalado em qualquer local → pasta do exe (testa gravação em config/, não na raiz)
  //     O instalador NSIS concede acesso total a config/ mesmo em Program Files via icacls,
  //     então o teste correto é em exeDir/config/, não em exeDir/ diretamente.
  // Lazy singleton: calculado na primeira chamada, cacheado para evitar I/O repetido.
  // Pode ser limpo via ipc handler 'app:refresh-writable-base' se permissões mudarem.
  let _writableBaseCached = null;
  const getWritableBase = () => {
    if (_writableBaseCached) return _writableBaseCached;
    if (!app.isPackaged) return (_writableBaseCached = app.getPath('userData'));
    if (process.env.PORTABLE_EXECUTABLE_DIR) return (_writableBaseCached = process.env.PORTABLE_EXECUTABLE_DIR);
    const exeDir = path.dirname(app.getPath('exe'));
    try {
      // Testa escrita em exeDir/config/ — o NSIS concede acesso total a esta subpasta
      // mesmo quando exeDir é Program Files (onde a raiz é read-only para não-admins).
      const configDir = path.join(exeDir, 'config');
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      const testFile = path.join(configDir, '.louvorja-write-test');
      fs.writeFileSync(testFile, '1');
      fs.unlinkSync(testFile);
      _writableBaseCached = exeDir;
    } catch (_) {
      _writableBaseCached = app.getPath('userData');
    }
    return _writableBaseCached;
  };

  ipcMain.handle('app:refresh-writable-base', () => {
    _writableBaseCached = null; // força reavaliação na próxima chamada
    return getWritableBase();
  });

  // Pasta de JSONs: sempre gravável (ou pasta customizada pelo usuário)
  const getDbDir = () => Store.get('db_local_folder') || path.join(getWritableBase(), 'db');

  // Busca e cacheia o JSON de uma música quando ele ainda não existe em disco.
  // Usado pela verificação de arquivos (files:scan-*): sem isso, uma música cujo
  // music_<id>.json nunca foi salvo localmente (comum com o Modo Offline ativo,
  // que só lê do disco e nunca busca/cacheia dados novos) é silenciosamente
  // ignorada pelo scan — os áudios/imagens dela nunca são reportados como
  // faltando. Aqui tentamos buscar da API (se houver dbBaseUrl/conexão); se
  // falhar, mantém o comportamento anterior de pular a música.
  const ensureMusicJsonCached = async (dbDir, dbBaseUrl, token, musicId) => {
    const mFile = path.join(dbDir, `music_${musicId}.json`);
    if (fs.existsSync(mFile)) {
      try { return JSON.parse(fs.readFileSync(mFile, 'utf8')); }
      catch (_) { /* cai para nova busca abaixo */ }
    }
    if (!dbBaseUrl) return null;
    try {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const resp = await net.fetch(`${dbBaseUrl}/music_${musicId}?${date}`, {
        headers: token ? { 'Api-Token': token } : {},
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
      fs.writeFileSync(mFile, JSON.stringify(data), 'utf8');
      return data;
    } catch (_) {
      return null;
    }
  };

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
    // SQLite aberto tem precedência sobre os JSON em disco
    if (sqliteReader.isOpen()) {
      const data = sqliteReader.get(filename);
      if (data !== null) return true;
    }
    return fs.existsSync(path.join(getDbDir(), `${filename}.json`));
  });

  ipcMain.handle('db:local-get', (_, filename) => {
    // 1. Leitura direta do SQLite — fonte primária quando config/database.db está aberto
    if (sqliteReader.isOpen()) {
      try {
        const data = sqliteReader.get(filename);
        if (data !== null) return data;
      } catch (e) {
        console.warn('[IPC] db:local-get SQLite falhou para', filename, '—', e.message, '— tentando JSON');
      }
    }

    // 2. Fallback: arquivo JSON em disco (db/ — downloads da API ou importação manual)
    try {
      const fp = path.join(getDbDir(), `${filename}.json`);
      if (!fs.existsSync(fp)) return null;
      return JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch (e) {
      console.error('[IPC] db:local-get JSON error:', e.message);
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
  const CONFIG_SUBFOLDERS = ['capas', 'fontes', 'ico', 'imagens', 'musicas', 'server'];

  // config/ para LEITURA: instalação original (pode ser Program Files)
  const getConfigDir = () => path.join(getInstallDir(), 'config');

  // config/ para GRAVAÇÃO: sempre gravável (userData ou portátil)
  const getWritableConfigDir = () => path.join(getWritableBase(), 'config');

  // Sanitiza o nome do álbum para uso como nome de pasta no Windows
  const sanitizeDir = (name) =>
    (name || 'Desconhecido')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 80) || 'Desconhecido';

  // Músicas ficam em subpastas por álbum; capas e imagens são flat (estrutura LouvorJA Delphi)
  // writable=true → aponta para pasta gravável (userData); false → instalação original
  const getAutoMediaDir  = (albumName, writable = false) => {
    const base = writable ? getWritableConfigDir() : getConfigDir();
    return albumName ? path.join(base, 'musicas', sanitizeDir(albumName)) : path.join(base, 'musicas');
  };
  const getAutoImagesDir = (writable = false) => path.join(writable ? getWritableConfigDir() : getConfigDir(), 'imagens');
  const getAutoCapasDir  = (writable = false) => path.join(writable ? getWritableConfigDir() : getConfigDir(), 'capas');

  // Verifica existência num ou mais diretórios (para encontrar arquivos tanto na instalação quanto no userData)
  const fileExistsIn = (filename, ...dirs) =>
    dirs.some(d => d && fs.existsSync(path.join(d, filename)));

  // Cria as subpastas base no diretório GRAVÁVEL (nunca Program Files)
  const initConfigFolders = () => {
    const configDir = getWritableConfigDir();
    for (const sub of CONFIG_SUBFOLDERS) {
      const p = path.join(configDir, sub);
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    }
  };
  initConfigFolders();

  // ── Helpers de mídia para SQLiteReader ────────────────────────────────────
  // Retorna a pasta config/ do banco Delphi aberto (ex: C:\LouvorJA\config).
  // É o parent do database.db que o usuário selecionou.
  const getSqliteConfigDir = () => {
    const p = sqliteReader.getPath();
    return p ? path.dirname(p) : null;
  };

  // Monta o objeto mediaDirs como arrays de diretórios por tipo, incluindo:
  //   • pasta gravável do app (downloads feitos pelo app)
  //   • pasta de instalação do app (fallback build anterior)
  //   • pasta config/ da instalação Delphi (config\capas, config\musicas, config\imagens)
  const buildSqliteMediaDirs = (dbPath) => {
    const configDir = dbPath ? path.dirname(dbPath) : getSqliteConfigDir();
    const delphiCapas   = configDir ? path.join(configDir, 'capas')   : null;
    const delphiMusicas = configDir ? path.join(configDir, 'musicas') : null;
    const delphiImagens = configDir ? path.join(configDir, 'imagens') : null;
    return {
      capasDirs:   [getAutoCapasDir(true),        getAutoCapasDir(false),        delphiCapas].filter(Boolean),
      musicasDirs: [getAutoMediaDir(null, true),   getAutoMediaDir(null, false),  delphiMusicas].filter(Boolean),
      imagensDirs: [getAutoImagesDir(true),        getAutoImagesDir(false),       delphiImagens].filter(Boolean),
    };
  };

  // Tenta abrir o SQLite configurado (persiste entre sessões via Store).
  // Na primeira execução sem caminho salvo, auto-detecta config/database.db do LouvorJA Delphi.
  // sql.js é assíncrono (carrega WASM) — dispara em background sem bloquear o IPC.
  const trySqliteAutoOpen = async () => {
    // 1. Caminho salvo em sessão anterior
    const saved = Store.get('sqlite_db_path');
    if (saved && fs.existsSync(saved)) {
      try {
        await sqliteReader.open(saved, buildSqliteMediaDirs(saved));
        console.log('[IPC] SQLite auto-aberto:', saved);
        return;
      } catch (e) {
        console.warn('[IPC] Falha ao auto-abrir SQLite salvo:', e.message);
      }
    }

    // 2. Primeira execução: detecta config/database.db do LouvorJA Delphi
    const autoCandidates = [
      path.join(getInstallDir(),   'config', 'database.db'),
      path.join(getWritableBase(), 'config', 'database.db'),
    ];
    for (const p of autoCandidates) {
      if (fs.existsSync(p)) {
        try {
          await sqliteReader.open(p, buildSqliteMediaDirs(p));
          Store.set('sqlite_db_path', p);
          console.log('[IPC] SQLite auto-detectado na inicialização:', p);
          return;
        } catch (e) {
          console.warn('[IPC] Falha ao auto-detectar SQLite em', p, ':', e.message);
        }
      }
    }
  };
  trySqliteAutoOpen().catch(() => {});

  // ── Handlers SQLite direto ────────────────────────────────────────────────

  /** Abre um arquivo .db SQLite como fonte primária de dados. */
  ipcMain.handle('sqlite:open-path', async (_, dbPath) => {
    if (!dbPath || !fs.existsSync(dbPath)) {
      return { success: false, error: 'Arquivo não encontrado: ' + dbPath };
    }
    try {
      await sqliteReader.open(dbPath, buildSqliteMediaDirs(dbPath));
      Store.set('sqlite_db_path', dbPath);
      return { success: true, path: dbPath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  /** Fecha o SQLite e remove da configuração. */
  ipcMain.handle('sqlite:unload', () => {
    sqliteReader.close();
    Store.remove('sqlite_db_path');
    return true;
  });

  /** Retorna estado atual do SQLiteReader. */
  ipcMain.handle('sqlite:status', () => ({
    available:    sqliteReader.isAvailable(),
    open:         sqliteReader.isOpen(),
    path:         sqliteReader.getPath(),
  }));

  /**
   * Auto-detecta um database.db em locais padrão do LouvorJA:
   *   1. config/database.db junto ao exe (instalação Delphi)
   *   2. database.db na pasta gravável
   *   3. userData/database.db
   */
  ipcMain.handle('sqlite:auto-detect', async () => {
    const candidates = [
      path.join(getInstallDir(),         'config', 'database.db'),
      path.join(getWritableBase(),       'config', 'database.db'),
      path.join(getWritableBase(),       'database.db'),
      path.join(app.getPath('userData'), 'database.db'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          await sqliteReader.open(p, buildSqliteMediaDirs());
          Store.set('sqlite_db_path', p);
          console.log('[IPC] sqlite:auto-detect encontrou:', p);
          return { found: true, path: p };
        } catch (e) {
          console.warn('[IPC] sqlite:auto-detect falha em', p, ':', e.message);
        }
      }
    }
    return { found: false, reason: 'Nenhum database.db encontrado.' };
  });

  // Strip query params, decodifica URL encoding e sanitiza para caminho local.
  // Ex: "/musics/pt/2017%20-%20Eu%20Creio/Arquivo.mp3" → "Arquivo.mp3"
  const safeBasename = (raw) => {
    if (!raw) return '';
    let clean = raw.replace(/\\/g, '/').split('?')[0].split('#')[0];
    try { clean = decodeURIComponent(clean); } catch (_) { /* mantém original se decode falhar */ }
    return path.basename(clean).trim();
  };

  // Converte caminho absoluto para URL file:// com encoding de caracteres especiais
  const toLocalFileUrl = (absPath) => {
    return 'file:///' + absPath
      .replace(/\\/g, '/')
      .split('/')
      .map(seg => encodeURIComponent(seg).replace(/%3A/g, ':')) // preserva C: em Windows
      .join('/');
  };

  // Busca recursiva por nome de arquivo em uma árvore de diretórios.
  // Usado para musicas que ficam em subpastas com nomes do SQLite
  // (ex: config/musicas/1992 - Brilha Jesus/) que podem diferir do nome do álbum no JSON.
  const findFileInTree = (dir, filename) => {
    if (!filename || !dir || !fs.existsSync(dir)) return null;
    const lower = filename.toLowerCase();
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      // 1. Busca flat primeiro (mais rápido)
      for (const e of entries) {
        if (e.isFile() && e.name.toLowerCase() === lower) return path.join(dir, e.name);
      }
      // 2. Busca nas subpastas (ex: musicas/Hinário Adventista/)
      for (const e of entries) {
        if (e.isDirectory()) {
          const found = findFileInTree(path.join(dir, e.name), filename);
          if (found) return found;
        }
      }
    } catch (_) {}
    return null;
  };

  // Encontra arquivo por nome:
  // - Flat em writableDir (capas, imagens, ou musicas já baixadas)
  // - Recursivo em readOnlyTree (musicas da instalação original com subpastas do SQLite)
  const findLocalFile = (filename, writableDir, readOnlyDir, recursive = false) => {
    if (!filename) return null;
    // 1. Flat na pasta gravável
    const w = path.join(writableDir, filename);
    if (fs.existsSync(w)) return w;
    if (!readOnlyDir) return null;
    // 2. Flat ou recursivo na instalação original
    if (!recursive) {
      const r = path.join(readOnlyDir, filename);
      return fs.existsSync(r) ? r : null;
    }
    return findFileInTree(readOnlyDir, filename);
  };

  // ── Protocolo app-local:// ────────────────────────────────────────────────
  // Serve arquivos de config/ da instalação (capas, imagens, musicas) de forma
  // independente do caminho de instalação (E:\, C:\Program Files\, etc.)
  // Exemplo: app-local://capas/2026.bmp → config/capas/2026.bmp na instalação
  (() => {
    const { protocol: _p } = require('electron');
    const IMG_MIME = { '.bmp':'image/bmp','.jpg':'image/jpeg','.jpeg':'image/jpeg',
                       '.png':'image/png','.gif':'image/gif','.webp':'image/webp' };
    const AUD_MIME = { '.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.aac':'audio/aac' };

    _p.handle('app-local', async (request) => {
      try {
        const url      = new URL(request.url);
        const folder   = url.hostname;                                    // 'capas', 'imagens', 'musicas'
        const filename = decodeURIComponent(url.pathname.replace(/^\//, '')); // '2026.bmp'
        const subpath  = path.join(folder, filename);
        const ext      = path.extname(filename).toLowerCase();
        const mime     = IMG_MIME[ext] || AUD_MIME[ext] || 'application/octet-stream';

        // 1. Arquivo local: pasta gravável (userData) ou instalação original.
        //    Inclui app.getPath('userData') como fallback para imagens baixadas em dev
        //    ou quando o exe foi movido para outro diretório após o download.
        //    Para musicas, usa busca recursiva pois ficam em subpastas (ANO - ALBUM).
        const userDataConfigDir = path.join(app.getPath('userData'), 'config');
        const delphiConfigDir   = getSqliteConfigDir(); // pasta config/ da instalação Delphi
        const baseDirs = [getWritableConfigDir(), userDataConfigDir, getConfigDir()];
        if (delphiConfigDir) baseDirs.push(delphiConfigDir);
        if (folder === 'musicas') {
          // 1. Caminho exato primeiro (com a subpasta do álbum, ex: "2024 - Maranata/Maranata.mp3")
          //    — mesma lógica usada abaixo pras outras pastas (capas/imagens).
          for (const base of baseDirs) {
            const p = path.join(base, subpath);
            if (fs.existsSync(p)) {
              return new Response(fs.readFileSync(p), { headers: { 'Content-Type': mime } });
            }
          }

          // 2. Fallback: a subpasta do álbum no disco pode divergir da do banco —
          //    busca recursiva, mas RESTRITA à própria subpasta do álbum esperada.
          //    Nunca varre a raiz de "musicas" inteira por nome de arquivo: títulos
          //    genéricos ("Maranata.mp3", "Prefixo de Louvor.mp3" etc.) se repetem em
          //    dezenas de álbuns diferentes no catálogo — uma busca ampla encontraria
          //    a primeira ocorrência de QUALQUER álbum, tocando a gravação errada
          //    (era exatamente isso que fazia o álbum "2024 - Maranata" tocar a
          //    "Maranata" de outro álbum).
          const albumFolder = path.dirname(filename);
          const baseName    = path.basename(filename);
          for (const base of baseDirs) {
            const musicasRoot = path.join(base, 'musicas');
            const scopedDir   = albumFolder && albumFolder !== '.' ? path.join(musicasRoot, albumFolder) : musicasRoot;
            const found = findFileInTree(scopedDir, baseName);
            if (found) {
              return new Response(fs.readFileSync(found), { headers: { 'Content-Type': mime } });
            }
          }
        } else {
          for (const base of baseDirs) {
            const p = path.join(base, subpath);
            if (fs.existsSync(p)) {
              return new Response(fs.readFileSync(p), { headers: { 'Content-Type': mime } });
            }
          }
        }

        // 2. Não encontrado localmente → busca na API.
        //    Mapeamento: capas→covers | imagens→images | musicas→musics/pt
        {
          const apiFolder = folder === 'capas'   ? 'covers'   :
                            folder === 'imagens' ? 'images'   :
                            folder === 'musicas' ? 'musics/pt' : folder;
          // filename pode ter subpasta: "2017 - Eu Creio/Arquivo.mp3"
          const encodedPath = filename.split('/').map(encodeURIComponent).join('/');
          const filesBase   = (process.env.VITE_URL_FILES || 'https://api.louvorja.com.br/file').replace(/\/$/, '');
          const apiUrl      = `${filesBase}/${apiFolder}/${encodedPath}`;
          const resp = await net.fetch(apiUrl).catch(() => null);
          if (resp?.ok) return resp;
        }
      } catch (_) {}
      return new Response('Not Found', { status: 404 });
    });
  })();

  // Verifica se uma URL local (file:// ou app-local://) aponta para arquivo válido
  const fileUrlExists = (url) => {
    if (!url) return false;
    if (url.startsWith('app-local://')) {
      try {
        const rel = url.slice('app-local://'.length).split('?')[0].split('#')[0];
        const slash = rel.indexOf('/');
        if (slash < 0) return false;
        const folder = rel.slice(0, slash);
        const name = path.basename(decodeURIComponent(rel.slice(slash + 1)));
        if (!name) return false;
        const userDataConfigDir2 = path.join(app.getPath('userData'), 'config');
        const delphiConfigDir2   = getSqliteConfigDir();
        const baseDirs2 = [getWritableConfigDir(), userDataConfigDir2, getConfigDir()];
        if (delphiConfigDir2) baseDirs2.push(delphiConfigDir2);
        if (folder === 'imagens' || folder === 'capas') {
          for (const base of baseDirs2) {
            if (fs.existsSync(path.join(base, folder, name))) return true;
          }
          return false;
        }
        if (folder === 'musicas') {
          // Pasta customizada do usuário (mesma prioridade do media:resolve-file)
          const userMediaFolder = Store.get('media_base_folder');
          if (userMediaFolder && findFileInTree(userMediaFolder, name)) return true;
          // Para áudio: busca recursiva em todas as raízes de musicas
          for (const base of baseDirs2) {
            if (findFileInTree(path.join(base, 'musicas'), name)) return true;
          }
          return false;
        }
        return false;
      } catch (_) { return false; }
    }
    if (!url.startsWith('file:///')) return false;
    try {
      const p = decodeURIComponent(url.slice(8)).replace(/\//g, path.sep);
      return fs.existsSync(p);
    } catch (_) { return false; }
  };

  // Extrai a subpasta do álbum (ANO - ALBUM) do URL de uma música.
  // Ex: "https://api.louvorja.com.br/file/musics/pt/2017 - Eu Creio/Arquivo.mp3"
  //     → "2017 - Eu Creio"
  const extractFolderFromMusicUrl = (url) => {
    if (!url) return null;
    const norm = url.replace(/\\/g, '/');
    const m = norm.match(/\/musics?(?:\/[a-z]{2})?\/([^/?#]+)\//i);
    return m ? decodeURIComponent(m[1]) : null;
  };

  // Após downloads, re-escaneia e atualiza URLs file:// nos JSONs do db/.
  // Capas e imagens → flat em config/capas/ e config/imagens/
  // Músicas → busca recursiva em config/musicas/ (subpastas com nomes do SQLite Delphi,
  //           ex: "1992 - Brilha Jesus/", "Hinário Adventista/", "Adoradores 2/")
  async function syncLocalFileUrls(dbDir) {
    if (!fs.existsSync(dbDir)) return;

    const capasW  = getAutoCapasDir(true);             // writable flat (userData)
    const capasR  = getAutoCapasDir();                  // read-only flat (install)
    const imgsW   = getAutoImagesDir(true);             // writable flat
    const imgsR   = getAutoImagesDir();                 // read-only flat
    const musicasW = getAutoMediaDir(null, true);       // writable musicas root
    const musicasR = getAutoMediaDir();                 // read-only musicas root (Delphi structure)

    const albumFiles = fs.readdirSync(dbDir).filter(f => f.startsWith('album_') && f.endsWith('.json'));
    for (const af of albumFiles) {
      const afPath = path.join(dbDir, af);
      let albumData;
      try { albumData = JSON.parse(fs.readFileSync(afPath, 'utf8')); } catch (_) { continue; }

      let changed = false;

      // ── Capa do álbum: usa app-local:// para ser independente do caminho ──
      if (!fileUrlExists(albumData.url_image)) {
        const capaName = safeBasename(albumData.url_image);
        if (capaName) {
          albumData.url_image = `app-local://capas/${encodeURIComponent(capaName)}`;
          changed = true;
        }
      }

      // ── Músicas ────────────────────────────────────────────────────────────
      for (const m of (albumData.musics || [])) {
        const mPath = path.join(dbDir, `music_${m.id_music}.json`);
        if (!fs.existsSync(mPath)) continue;
        let md;
        try { md = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch (_) { continue; }
        let mChanged = false;

        // url_music — se encontrado localmente: file:// (acesso direto, mais rápido).
        // Se não encontrado: app-local://musicas/folder/nome — protocolo serve ou busca na API.
        const resolveAudioUrl = (rawUrl) => {
          if (!rawUrl || rawUrl.startsWith('app-local://musicas/') || fileUrlExists(rawUrl)) return rawUrl; // já é local
          const name = safeBasename(rawUrl);
          if (!name) return rawUrl;
          const folder = extractFolderFromMusicUrl(rawUrl);

          // 1. Tenta a subpasta do álbum específica primeiro — evita pegar por engano
          //    o arquivo de mesmo nome de OUTRO álbum (títulos genéricos como
          //    "Maranata.mp3"/"Prefixo de Louvor.mp3" se repetem em dezenas de álbuns
          //    diferentes no catálogo).
          if (folder) {
            const scopedW = path.join(musicasW, folder, name);
            const scopedR = path.join(musicasR, folder, name);
            if (fs.existsSync(scopedW)) return toLocalFileUrl(scopedW);
            if (fs.existsSync(scopedR)) return toLocalFileUrl(scopedR);
          }

          // 2. Fallback: busca recursiva ampla — só quando a subpasta esperada não
          //    bateu (pode ter sido reorganizada no disco). Ainda arrisca pegar o
          //    arquivo errado nesse caso raro, mas é estritamente melhor que nunca
          //    tentar o caminho certo primeiro.
          const found = findFileInTree(musicasW, name) || findFileInTree(musicasR, name);
          if (found) return toLocalFileUrl(found);

          // 3. Não encontrado localmente — app-local:// com a subpasta conhecida
          if (folder) return `app-local://musicas/${encodeURIComponent(folder)}/${encodeURIComponent(name)}`;
          return rawUrl; // mantém API URL
        };

        if (md.url_music !== resolveAudioUrl(md.url_music)) {
          md.url_music = resolveAudioUrl(md.url_music); mChanged = true;
        }
        if (md.url_instrumental_music !== resolveAudioUrl(md.url_instrumental_music)) {
          md.url_instrumental_music = resolveAudioUrl(md.url_instrumental_music); mChanged = true;
        }

        // url_image do topo da música (imagem padrão usada quando slide não tem imagem própria)
        if (md.url_image && !fileUrlExists(md.url_image)) {
          const imgName = safeBasename(md.url_image);
          if (imgName) {
            md.url_image = `app-local://imagens/${encodeURIComponent(imgName)}`;
            mChanged = true;
          }
        }

        // url_image dos slides/letras: suporta AMBAS as estruturas da API:
        //   • md.slides  → formato interno (gerado pelo sqlite-reader / gerar-banco-json)
        //   • md.lyric   → formato direto da API (array com {url_image, lyric, time, ...})
        // app-local:// → protocolo serve do disco ou busca na API (transparente).
        const slideItems = Array.isArray(md.slides) ? md.slides
                         : Array.isArray(md.lyric)  ? md.lyric
                         : (md.lyric && typeof md.lyric === 'object' ? Object.values(md.lyric) : []);

        for (const s of slideItems) {
          if (s?.url_image && !fileUrlExists(s.url_image)) {
            const imgName = safeBasename(s.url_image);
            if (imgName) {
              s.url_image = `app-local://imagens/${encodeURIComponent(imgName)}`;
              mChanged = true;
            }
          }
        }

        if (mChanged) {
          try { fs.writeFileSync(mPath, JSON.stringify(md), 'utf8'); } catch (_) {}
        }
      }

      if (changed) {
        try { fs.writeFileSync(afPath, JSON.stringify(albumData), 'utf8'); } catch (_) {}
      }
    }

    // ── Atualiza pt_categories.json: substitui URLs relativas (/covers/...) ──
    // por file:// locais quando o arquivo existe (para funcionar em modo offline)
    const catFile = path.join(dbDir, 'pt_categories.json');
    if (fs.existsSync(catFile)) {
      try {
        const cats = JSON.parse(fs.readFileSync(catFile, 'utf8'));
        let catChanged = false;
        cats.forEach(cat => {
          (cat.albums || []).forEach(album => {
            if (!fileUrlExists(album.url_image)) {
              const coverName = safeBasename(album.url_image);
              // Converte para app-local:// → independente do caminho de instalação
              if (coverName) {
                album.url_image = `app-local://capas/${encodeURIComponent(coverName)}`;
                catChanged = true;
              }
            }
          });
        });
        if (catChanged) fs.writeFileSync(catFile, JSON.stringify(cats), 'utf8');
      } catch (_) {}
    }
  }

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
    if (cleanRaw.startsWith('http://') || cleanRaw.startsWith('https://')) return cleanRaw;

    const base = (filesBaseUrl || '').replace(/\/$/, '');

    // Mapeamento de pastas locais → pastas da API (FileController.php do servidor)
    // capas   → covers  |  imagens → images  |  musicas → musics/pt
    const mapFolder = (f) => {
      if (f === 'capas')   return 'covers';
      if (f === 'imagens') return 'images';
      if (f === 'musicas') return 'musics/pt';
      return f;
    };

    // app-local://folder/filename → ${filesBaseUrl}/apiFolder/filename
    if (cleanRaw.startsWith('app-local://')) {
      const rel = cleanRaw.slice('app-local://'.length);
      const slash = rel.indexOf('/');
      if (slash >= 0) {
        const folder = rel.slice(0, slash);
        const file   = rel.slice(slash + 1);
        return `${base}/${mapFolder(folder)}/${file}`;
      }
      return `${base}/${rel}`;
    }

    // file:// caminho local → extrai config/pasta/... → mapeia pasta → monta URL da API
    if (cleanRaw.startsWith('file:')) {
      try {
        const noProto = cleanRaw.replace(/^file:\/+/i, '');
        const m = noProto.match(/\/config\/([^/?#]+)\/(.+)$/i);
        if (m) return `${base}/${mapFolder(m[1])}/${m[2]}`;
      } catch (_) {}
      return null;
    }

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

    // Helper que identifica o tipo de pasta destino para busca local
    const detectFileType = (destDir) => {
      const d = destDir.replace(/\\/g, '/').toLowerCase();
      if (d.includes('/capas'))   return 'cover';
      if (d.includes('/imagens')) return 'image';
      if (d.includes('/musicas')) return 'audio';
      return 'other';
    };

    const dl = async (raw, destDir) => {
      const name = safeBasename(raw);
      if (!name) return 'skip-noname';

      const destPath = path.join(destDir, name);

      // 1. Já existe no destino gravável → pula
      if (!overwrite && fs.existsSync(destPath)) return 'skipped';

      // 2. Já existe na instalação original (config/ do Delphi) → pula
      //    Evita re-baixar arquivos que já estão localmente em outra pasta.
      if (!overwrite) {
        const type = detectFileType(destDir);
        let foundLocal = false;
        if (type === 'audio') {
          // Busca recursiva em musicas/ gravável e somente-leitura
          foundLocal = !!findFileInTree(getAutoMediaDir(null, true), name)
                    || !!findFileInTree(getAutoMediaDir(), name);
        } else if (type === 'cover') {
          foundLocal = fs.existsSync(path.join(getAutoCapasDir(), name))
                    || fs.existsSync(path.join(getAutoCapasDir(true), name));
        } else if (type === 'image') {
          foundLocal = fs.existsSync(path.join(getAutoImagesDir(), name))
                    || fs.existsSync(path.join(getAutoImagesDir(true), name));
        }
        if (foundLocal) return 'skipped';
      }

      const url = resolveFileUrl(raw, filesBaseUrl);
      if (!url) return false;
      return downloadBinary(url, destPath, headers, overwrite);
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

      // Tenta extrair "ANO - ALBUM" do URL da primeira música (campo url_music ou similar)
      // Formato típico: "/musics/pt/2017 - Eu Creio/Arquivo.mp3"
      const extractFolderFromUrl = (url) => {
        if (!url) return null;
        const norm = url.replace(/\\/g, '/');
        const m = norm.match(/\/musics?(?:\/[a-z]{2})?\/([^/]+)\//i);
        return m ? decodeURIComponent(m[1]) : null;
      };

      // Determina folderName: prioridade folder_name da API > extrai do URL > albumName
      let folderName = albumData.folder_name || albumName;
      // Se folderName parece não ter ano (não começa com 4 dígitos), tenta extrair da URL
      if (!/^\d{4}\s*-/.test(folderName) && albumData.musics?.length) {
        // Verifica nos url_music das músicas (se já tiver no album JSON)
        for (const m of albumData.musics) {
          const extracted = extractFolderFromUrl(m.url_music || m.url);
          if (extracted && /^\d{4}\s*-/.test(extracted)) { folderName = extracted; break; }
        }
      }
      // Destinos sempre graváveis (userData/config/..., nunca Program Files)
      const capasDir  = getAutoCapasDir(true);               // flat, writable
      let   audioDir  = getAutoMediaDir(folderName, true);   // subpasta "ANO - ALBUM" (atualizada na 1ª música)
      const imagesDir = getAutoImagesDir(true);              // flat, writable

      const musics     = albumData.musics || [];
      const hasCover   = !!albumData.url_image;
      const grandTotal = 1 + (hasCover ? 1 : 0) + musics.length;
      let done = 1;

      send(done, grandTotal, hasCover ? 'Baixando capa do álbum...' : `Baixando ${musics.length} músicas...`);

      // 2. Capa do álbum → config/capas/ (flat, writable)
      if (albumData.url_image) {
        const r = await dl(albumData.url_image, capasDir);
        if (r === true)       stats.images++;
        else if (r === 'skipped') stats.skipped++;
        else {
          // 'skip-noname' (URL sem basename) ou false (erro HTTP/rede)
          console.warn('[IPC] album:download-full capa falhou:', albumData.url_image, '| result:', r);
          stats.errors++;
        }
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

        // Na 1ª música: detecta a pasta real (ANO - ALBUM) a partir de url_music.
        // O álbum JSON só tem {id,track,name} — o url_music está no music JSON individual.
        // Ex: "https://api.louvorja.com.br/file/musics/pt/2017 - Eu Creio/Arquivo.mp3"
        if (i === 0 && md.url_music) {
          const detected = extractFolderFromUrl(md.url_music);
          if (detected && detected !== folderName) {
            folderName = detected;
            audioDir   = getAutoMediaDir(folderName, true);
            console.log(`[IPC] album:download-full pasta corrigida para "${folderName}"`);
          }
        }

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

      const resumo = `${stats.json} json, ${stats.images} imagens, ${stats.audio} áudios, ${stats.skipped} ignorados, ${stats.errors} erros`;
      send(grandTotal, grandTotal, `Concluído! (${resumo})`, 'done');

      // Converte URLs HTTP nos JSONs para app-local:// após o download,
      // garantindo acesso offline independente do caminho de instalação.
      try { await syncLocalFileUrls(dbDir); } catch (_) {}

      return { success: true, stats, albumName: folderName };
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

    // Se já chegou um file:// resolvido (ex: sqlite-reader.js já achou o arquivo
    // certo, dentro da subpasta certa do álbum) e ele realmente existe, usa direto
    // — sem isso, a busca por basename abaixo (que ignora de qual álbum é o
    // arquivo) podia SOBRESCREVER um resultado já correto com o arquivo de mesmo
    // nome de OUTRO álbum. Era exatamente isso que fazia o álbum "2024 - Maranata"
    // tocar a "Maranata" de outro álbum mesmo com sqlite-reader.js já certo.
    if (filename.startsWith('file://')) {
      return fileUrlExists(filename) ? filename : null;
    }

    const name = safeBasename(filename);
    if (!name) return null;
    // Pasta do álbum, se dá pra extrair da URL (ex: API .../musics/pt/2017 - Eu Creio/...)
    // — usada pra priorizar a busca na subpasta certa antes de cair pra busca ampla.
    const folder = extractFolderFromMusicUrl(filename);

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

    // Busca com prioridade: primeiro na subpasta do álbum esperada (se conhecida)
    // — evita pegar o arquivo de mesmo nome de OUTRO álbum (títulos genéricos como
    // "Maranata.mp3"/"Prefixo de Louvor.mp3" se repetem em dezenas de álbuns
    // diferentes no catálogo). Só cai pra busca ampla se não achar na subpasta certa.
    const searchScoped = (baseDir) => {
      if (!baseDir) return null;
      if (folder) {
        const scoped = path.join(baseDir, folder, name);
        if (fs.existsSync(scoped)) return scoped;
      }
      return search(baseDir, 0);
    };

    // 1. Pasta configurada pelo usuário
    const userFolder = Store.get('media_base_folder');
    if (userFolder) {
      const found = searchScoped(userFolder);
      if (found) return toFileUrl(found);
    }

    // 2. Pasta gravável (getWritableBase()/config/musicas/) — downloads do app
    const writableFound = searchScoped(getAutoMediaDir(null, true));
    if (writableFound) return toFileUrl(writableFound);

    // 3. userData/config/musicas/ — fallback para downloads feitos em dev ou build anterior
    const userDataMusicDir = path.join(app.getPath('userData'), 'config', 'musicas');
    if (userDataMusicDir !== getAutoMediaDir(null, true)) {
      const userDataFound = searchScoped(userDataMusicDir);
      if (userDataFound) return toFileUrl(userDataFound);
    }

    // 4. Pasta da instalação original (config/musicas/ com subpastas do Delphi)
    const installFound = searchScoped(getAutoMediaDir());
    if (installFound) return toFileUrl(installFound);

    // 5. Pasta config/ da instalação Delphi (config\musicas\ com subpastas por álbum)
    const delphiCfg = getSqliteConfigDir();
    if (delphiCfg) {
      const delphiFound = searchScoped(path.join(delphiCfg, 'musicas'));
      if (delphiFound) return toFileUrl(delphiFound);
    }

    return null;
  });

  // Baixa um único arquivo de música (áudio/instrumental) sob demanda — usado pelo
  // prompt "Baixar Música" no modo online, sem precisar escanear o álbum inteiro.
  // Reaproveita resolveFileUrl/downloadBinary (mesmas usadas em files:download-missing)
  // e a mesma convenção de pasta (getAutoMediaDir com fallback para o nome do álbum).
  ipcMain.handle('media:download-file', async (_, { url, albumName, filesBaseUrl, token } = {}) => {
    if (!url) return null;
    const name = safeBasename(url);
    if (!name) return null;
    try {
      const resolvedUrl = resolveFileUrl(url, filesBaseUrl);
      if (!resolvedUrl) return null;
      const dest = path.join(getAutoMediaDir(albumName || null, true), name);
      const hdrs = token ? { 'Api-Token': token } : {};
      const ok = await downloadBinary(resolvedUrl, dest, hdrs, false);
      if (!ok) return null;
      try { await syncLocalFileUrls(getDbDir()); } catch (_) {}
      return toFileUrl(dest);
    } catch (e) {
      console.error('[IPC] media:download-file error:', e.message);
      return null;
    }
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

    // Retorna app-local:// em vez de file:// para evitar bloqueios do webSecurity
    // em produção. O protocolo app-local:// é privilegiado e acessa disco diretamente.
    const asAppLocal = (folder) => `app-local://${folder}/${encodeURIComponent(name)}`;

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

    // Inclui userData como fallback para imagens baixadas em dev ou em build anterior.
    const userDataImgsDir  = path.join(app.getPath('userData'), 'config', 'imagens');
    const userDataCapasDir = path.join(app.getPath('userData'), 'config', 'capas');
    const delphiCfgImg    = getSqliteConfigDir();
    const delphiImgsDir   = delphiCfgImg ? path.join(delphiCfgImg, 'imagens') : null;
    const delphiCapasDir  = delphiCfgImg ? path.join(delphiCfgImg, 'capas')   : null;

    // Caminhos diretos O(1): imagens primeiro, depois capas
    const imgsDirs  = [getAutoImagesDir(true), userDataImgsDir, getAutoImagesDir(), delphiImgsDir].filter(Boolean);
    const capasDirs = [getAutoCapasDir(true),  userDataCapasDir, getAutoCapasDir(),  delphiCapasDir].filter(Boolean);
    for (const dir of imgsDirs) {
      if (fs.existsSync(path.join(dir, name))) return asAppLocal('imagens');
    }
    for (const dir of capasDirs) {
      if (fs.existsSync(path.join(dir, name))) return asAppLocal('capas');
    }

    // Pastas configuradas pelo usuário
    const imagesFolder = Store.get('media_images_folder');
    if (imagesFolder && searchDir(imagesFolder, 0)) return asAppLocal('imagens');

    const mediaFolder = Store.get('media_base_folder');
    if (mediaFolder && searchDir(mediaFolder, 0)) return asAppLocal('imagens');

    // Scan recursivo: imagens depois capas
    for (const dir of imgsDirs) {
      if (searchDir(dir, 0)) return asAppLocal('imagens');
    }
    for (const dir of capasDirs) {
      if (searchDir(dir, 0)) return asAppLocal('capas');
    }

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

      // Pastas de saída (sempre graváveis — nunca Program Files)
      const dbDir    = getDbDir();
      const capasDir = getAutoCapasDir(true);    // writable flat
      const imgsDir  = getAutoImagesDir(true);   // writable flat
      const musicDir = getAutoMediaDir(null, true); // writable base (sem álbum)
      for (const d of [dbDir, capasDir, imgsDir, musicDir]) {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
      }

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

      // albumMap: id_album → { id_album, name, url_image, order } para gerar album_{id}.json depois
      const albumMap = {};
      const catMap = {};
      cats.forEach(r => {
        if (!catMap[r.id_category]) {
          catMap[r.id_category] = { id_category: r.id_category, name: r.name, order: r.cat_order || 0, slug: r.slug || '', albums: [] };
        }
        if (r.id_album) {
          const imgFile  = r.img_name || '';
          // Procura a capa na pasta gravável (userData) E na instalação original
          const imgFullW = imgFile ? path.join(capasDir, imgFile) : '';           // writable
          const imgFullR = imgFile ? path.join(getAutoCapasDir(), imgFile) : '';  // read-only
          // Usa app-local:// → independente do caminho de instalação
          // O protocolo handler resolve config/capas/{imgFile} na pasta correta em tempo real
          const imgUrl = imgFile ? `app-local://capas/${encodeURIComponent(imgFile)}` : '';

          const albumEntry = {
            id_album:  r.id_album,
            name:      r.a_name || r.ca_name,
            subtitle:  r.ca_name || '',
            color:     r.color || '#555555',
            url_image: imgUrl,
            order:     r.album_order || 0,
          };
          catMap[r.id_category].albums.push(albumEntry);

          if (!albumMap[r.id_album]) {
            albumMap[r.id_album] = { id_album: r.id_album, name: albumEntry.name, url_image: imgUrl, musics: [] };
          }
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
               ${hasFilesT && hasMFileMu           ? ', f.file_name AS aud_name'   : ", NULL AS aud_name"}
               ${hasFilesT && hasMFileMu && hasFDir ? ', f.dir AS aud_dir'          : ", NULL AS aud_dir"}
               ${hasFilesT && hasMInstr            ? ', fi.file_name AS instr_name' : ", NULL AS instr_name"}
               ${hasFilesT && hasMInstr && hasFDir  ? ', fi.dir AS instr_dir'        : ", NULL AS instr_dir"}
        FROM musics m
        ${hasAlbumsMusicT ? 'LEFT JOIN albums_musics am ON am.id_music = m.id_music' : ''}
        ${hasAlbumsT ? `LEFT JOIN albums a ON a.id_album = ${hasAlbumsMusicT ? 'am.id_album' : '0'} ${aCols.includes('id_language') ? "AND a.id_language = 'pt'" : ''}` : ''}
        ${hasFilesT && hasMFileMu ? 'LEFT JOIN files f ON f.id_file = m.id_file_music' : ''}
        ${hasFilesT && hasMInstr  ? 'LEFT JOIN files fi ON fi.id_file = m.id_file_instrumental_music' : ''}
        ${hasMuLang ? "WHERE m.id_language = 'pt'" : ''}
        ORDER BY m.id_music
      `);

      // Extrai o nome de pasta do álbum a partir do campo files.dir.
      // Suporta formato Delphi (config\musicas\2010 - Geração Esperança\)
      // e formato API (/musics/pt/2010 - Geração Esperança).
      const getAudioFolder = (audDir) => {
        if (!audDir) return null;
        const last = audDir.replace(/[/\\]+$/, '').split(/[/\\]/).pop();
        if (!last || /^(pt|en|es|musics|musicas|config)$/i.test(last)) return null;
        return last;
      };

      // Monta URL file:// usando config/musicas/{folder}/{file} na instalação.
      // folder vem do último segmento de files.dir: "2010 - Geração Esperança"
      const buildAudioUrl = (audDir, audName) => {
        if (!audName) return '';
        const folder = getAudioFolder(audDir);
        const full   = folder
          ? path.join(getAutoMediaDir(folder, false), audName)
          : path.join(musicDir, audName);
        return toLocalFileUrl(full);
      };

      const musicMap = {};
      mRows.forEach(r => {
        if (!musicMap[r.id_music]) {
          musicMap[r.id_music] = {
            id_music:               r.id_music,
            name:                   r.name,
            has_instrumental_music: !!r.id_file_instrumental_music,
            lyric:                  '',
            albums_names:           '',
            albums:                 [],
            url_music:              buildAudioUrl(r.aud_dir,   r.aud_name),
            url_instrumental_music: buildAudioUrl(r.instr_dir, r.instr_name),
          };
        }
        if (r.id_album && !musicMap[r.id_music].albums.find(a => a.id_album === r.id_album)) {
          musicMap[r.id_music].albums.push({ id_album: r.id_album, name: r.a_name, pivot: { track: r.track || 0 } });
          // Adiciona música na lista do álbum
          if (albumMap[r.id_album] && !albumMap[r.id_album].musics.find(m => m.id_music === r.id_music)) {
            albumMap[r.id_album].musics.push({ id_music: r.id_music, name: r.name, track: r.track || 0 });
            // Registra nome de pasta correto: "2010 - Geração Esperança" do files.dir
            if (!albumMap[r.id_album].folder_name) {
              const fn = getAudioFolder(r.aud_dir);
              if (fn) albumMap[r.id_album].folder_name = fn;
            }
          }
        }
      });
      Object.values(musicMap).forEach(m => {
        m.albums_names = m.albums.map(a => a.name).join(', ');
      });
      fs.writeFileSync(path.join(dbDir, 'pt_musics.json'), JSON.stringify(Object.values(musicMap)), 'utf8');
      results.musics = Object.keys(musicMap).length;

      // Atualiza subtítulo dos álbuns em pt_categories.json usando o ano do folder_name.
      // A API serve subtitle="1992" mas o SQLite exportado tem ca_name="" para álbuns clássicos.
      // Extrai o ano do início de folder_name: "1992 - Brilha Jesus" → "1992"
      let categoriesUpdated = false;
      Object.values(catMap).forEach(cat => {
        cat.albums.forEach(album => {
          if (!album.subtitle) {
            const fn = albumMap[album.id_album]?.folder_name || '';
            const m = fn.match(/^(\d{4})\s*[-–]/);
            if (m) { album.subtitle = m[1]; categoriesUpdated = true; }
          }
        });
      });
      if (categoriesUpdated) {
        fs.writeFileSync(path.join(dbDir, 'pt_categories.json'), JSON.stringify(Object.values(catMap)), 'utf8');
      }

      // ── 3. Letras por música (slides) ────────────────────────────────────
      const hasLFileImg    = lCols.includes('id_file_image');
      const hasLImgPos     = lCols.includes('image_position');
      const hasLAuxLyric   = lCols.includes('aux_lyric');
      const hasLShowSlide  = lCols.includes('show_slide');
      const hasLOrder      = lCols.includes('order');
      const hasLLang       = lCols.includes('id_language');
      const hasLTime       = lCols.includes('time');
      const hasLInstrTime  = lCols.includes('instrumental_time');

      const lyricRows = query(`
        SELECT l.id_music, l.lyric,
               ${hasLAuxLyric  ? 'l.aux_lyric'         : "'' AS aux_lyric"},
               ${hasLOrder     ? 'l."order"'            : '0 AS "order"'},
               ${hasLShowSlide ? 'l.show_slide'         : '1 AS show_slide'},
               ${hasLTime      ? 'l.time'               : "'00:00' AS time"},
               ${hasLInstrTime ? 'l.instrumental_time'  : "'00:00' AS instrumental_time"}
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
        let imgUrl = '';
        if (r.img_name) {
          const imgFull = path.join(imgsDir, r.img_name);
          imgUrl = toLocalFileUrl(imgFull);
        }
        slidesMap[r.id_music].push({
          cover:             r.order === 0 || r.order === null,
          lyric:             r.lyric              || '',
          aux_lyric:         r.aux_lyric          || '',
          url_image:         imgUrl,
          image_position:    r.image_position     || 'center',
          time:              r.time               || '00:00',
          instrumental_time: r.instrumental_time  || '00:00',
        });
      });

      let lCount = 0;
      const totalL = Object.keys(slidesMap).length;
      for (const [id_music, slides] of Object.entries(slidesMap)) {
        const musicInfo = musicMap[id_music] || {};
        fs.writeFileSync(
          path.join(dbDir, `music_${id_music}.json`),
          JSON.stringify({
            id_music:               parseInt(id_music),
            name:                   musicInfo.name || '',
            has_instrumental_music: musicInfo.has_instrumental_music || false,
            url_music:              musicInfo.url_music || '',
            url_instrumental_music: musicInfo.url_instrumental_music || '',
            slides,
          }),
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

      // ── Gera album_{id}.json para cada álbum ─────────────────────────────
      event.sender.send('sqlite:progress', { percent: 87, message: 'Salvando dados dos álbuns...' });
      let albumCount = 0;
      for (const [id_album, album] of Object.entries(albumMap)) {
        fs.writeFileSync(
          path.join(dbDir, `album_${id_album}.json`),
          JSON.stringify(album),
          'utf8'
        );
        albumCount++;
      }
      results.albums = albumCount;

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
        date:       new Date().toISOString(),
        dbPath,
        capasPath,
        categories: results.categories,
        albums:     results.albums || 0,
        musics:     results.musics,
      });

      // Sincroniza URLs locais: capas/músicas já presentes ganham file:// correto
      event.sender.send('sqlite:progress', { percent: 98, message: 'Sincronizando arquivos locais...' });
      try { await syncLocalFileUrls(dbDir); } catch (_) {}

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

  // Verifica se o auto-import do SQLite local é necessário:
  // database.db presente + db/ sem pt_categories.json (banco vazio)
  ipcMain.handle('sqlite:check-auto-import', () => {
    const dbPath = path.join(getConfigDir(), 'database.db');
    const catFile = path.join(getDbDir(), 'pt_categories.json');
    const available = fs.existsSync(dbPath) && fs.statSync(dbPath).size > 100;
    const needed    = available && !fs.existsSync(catFile);
    return { needed, available, dbPath };
  });

  ipcMain.handle('sqlite:clear', () => {
    Store.remove('sqlite_import');
    return true;
  });

  // Verifica e baixa atualização do banco SQLite da API
  // Compara ETag/Last-Modified com o armazenado. Se diferente, baixa e salva.
  ipcMain.handle('sqlite:check-update', async (_, { dbBaseUrl, token }) => {
    try {
      if (!dbBaseUrl) return { updated: false, reason: 'no-url' };
      const dbUrl = dbBaseUrl.replace(/\/$/, '') + '/database.db';

      // HEAD para verificar versão via ETag ou Last-Modified
      const headResp = await net.fetch(dbUrl, {
        method: 'HEAD',
        headers: token ? { 'Api-Token': token } : {},
      }).catch(() => null);

      if (!headResp || !headResp.ok) return { updated: false, reason: 'api-unavailable' };

      const version = headResp.headers.get('etag') || headResp.headers.get('last-modified') || '';
      const storedVersion = Store.get('sqlite_db_version', '');

      if (version && version === storedVersion) return { updated: false, reason: 'up-to-date' };

      // Download do novo database.db
      const resp = await net.fetch(dbUrl, {
        headers: token ? { 'Api-Token': token } : {},
      }).catch(() => null);

      if (!resp || !resp.ok) return { updated: false, reason: 'download-failed' };

      const buffer = Buffer.from(await resp.arrayBuffer());
      if (!buffer.length) return { updated: false, reason: 'empty-response' };

      const configDir = getWritableConfigDir();
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

      const dbPath = path.join(configDir, 'database.db');
      fs.writeFileSync(dbPath, buffer);

      if (version) Store.set('sqlite_db_version', version);

      return { updated: true, dbPath };
    } catch (e) {
      console.warn('[IPC] sqlite:check-update error:', e.message);
      return { updated: false, reason: e.message };
    }
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
  // Retorna a pasta GRAVÁVEL (userData ou portátil) — é para lá que vão os downloads.
  // getConfigDir() (pasta do exe / instalação original) é usada internamente
  // apenas para localizar arquivos existentes do LouvorJA Delphi.
  ipcMain.handle('config:get-dir', () => getWritableConfigDir());

  // Retorna o caminho real usado para os arquivos JSON (default ou customizado)
  ipcMain.handle('db:get-actual-dir', () => getDbDir());

  // Abre uma pasta no Explorer (shell.openPath)
  ipcMain.handle('shell:open-folder', (_, folderPath) => {
    const { shell } = require('electron');
    return shell.openPath(folderPath);
  });

  // ── Verificação e download de arquivos em falta ───────────────────────────
  ipcMain.handle('files:scan-missing', async (_event, dbBaseUrl, token) => {
    try {
      const dbDir = getDbDir();
      if (!fs.existsSync(dbDir)) return { total: 0, missing: [], counts: {} };

      const missing = [];
      const seen    = new Set();

      // Pastas raiz para busca de áudio — recursiva na instalação Delphi
      const musicasW = getAutoMediaDir(null, true);   // gravável (userData/config/musicas/)
      const musicasR = getAutoMediaDir();              // instalação (config/musicas/ com subpastas)
      const capasW   = getAutoCapasDir(true);          const capasR  = getAutoCapasDir();
      const imgsW    = getAutoImagesDir(true);         const imgsR   = getAutoImagesDir();

      // Verifica existência: já tem URL válida, ou está em alguma pasta (recursiva p/ áudio)
      const fileExists = (rawUrl, destWritable, type) => {
        if (fileUrlExists(rawUrl)) return true;
        const name = safeBasename(rawUrl);
        if (!name) return false;
        if (fs.existsSync(path.join(destWritable, name))) return true;
        // Áudio: busca recursiva nas subpastas do Delphi (config/musicas/1992 - Brilha Jesus/ etc.)
        if (type === 'audio') return !!findFileInTree(musicasR, name);
        // Capas e imagens: flat na instalação original
        if (type === 'cover') return fs.existsSync(path.join(capasR, name));
        if (type === 'image') return fs.existsSync(path.join(imgsR, name));
        return false;
      };

      const addMissing = (rawUrl, destWritable, type) => {
        if (!rawUrl) return;
        const name = safeBasename(rawUrl);
        if (!name) return;
        const dest = path.join(destWritable, name);
        if (seen.has(dest)) return;
        seen.add(dest);
        if (!fileExists(rawUrl, destWritable, type)) missing.push({ url: rawUrl, dest, type, name });
      };

      const albumFiles = fs.readdirSync(dbDir).filter(f => f.startsWith('album_') && f.endsWith('.json'));

      for (const albumFile of albumFiles) {
        let albumData;
        try { albumData = JSON.parse(fs.readFileSync(path.join(dbDir, albumFile), 'utf8')); }
        catch (_) { continue; }

        const albumName = albumData.name || albumFile.replace('.json', '');
        // Usa folder_name (ex: "2010 - Geração Esperança") quando disponível,
        // pois é o nome real da subpasta em config/musicas/
        const audioW = getAutoMediaDir(albumData.folder_name || albumName, true);

        addMissing(albumData.url_image, capasW, 'cover');

        for (const music of (albumData.musics || [])) {
          const md = await ensureMusicJsonCached(dbDir, dbBaseUrl, token, music.id_music);
          if (!md) continue;

          addMissing(md.url_music, audioW, 'audio');
          addMissing(md.url_instrumental_music, audioW, 'audio');
          addMissing(md.url_image, imgsW, 'image');

          const slideList = Array.isArray(md.slides)
            ? md.slides
            : (md.lyric && typeof md.lyric === 'object' ? Object.values(md.lyric) : []);
          for (const slide of slideList) addMissing(slide?.url_image, imgsW, 'image');
        }
      }

      const counts = missing.reduce((acc, m) => { acc[m.type] = (acc[m.type] || 0) + 1; return acc; }, {});
      return { total: missing.length, missing, counts };
    } catch (e) {
      console.error('[IPC] files:scan-missing error:', e.message);
      return { total: 0, missing: [], counts: {}, error: e.message };
    }
  });

  // Retorna álbuns com arquivos faltando + lista flat de todos os itens.
  // Igual ao ARQUIVOS_SISTEMA do LouvorJA Delphi: Arquivo | Diretório | Status
  ipcMain.handle('files:scan-albums', async (event, dbBaseUrl, token) => {
    const emptyStats = () => ({ audio: { found: 0, missing: 0 }, cover: { found: 0, missing: 0 }, image: { found: 0, missing: 0 } });
    const emptyResult = () => ({ total: 0, totalFiles: 0, foundFiles: 0, albums: [], allAlbums: [], allMissing: [], stats: emptyStats() });

    // ── Emite progresso e cede controle ────────────────────────────────────
    const sendProgress = async (current, total, albumName) => {
      try {
        if (!event.sender.isDestroyed())
          event.sender.send('files:scan-progress', { current, total, albumName });
      } catch (_) {}
      await new Promise(resolve => setImmediate(resolve));
    };

    // ── Scan via ARQUIVOS_SISTEMA (fonte Delphi — contagem idêntica ao Delphi) ──
    if (sqliteReader.isOpen() && sqliteReader.hasArquivosSistema()) {
      try {
        const rows = sqliteReader.getArquivosSistema();
        if (rows.length > 0) {
          const configDir    = getSqliteConfigDir();
          const installRoot  = configDir ? path.dirname(configDir) : null;
          const writableRoot = getWritableBase();
          const userMedia    = Store.get('media_base_folder') || null;

          // Mapeia TIPO Delphi → tipo interno
          const tipoMap = {
            MUSICA: 'audio', MUSICA_PB: 'audio',
            IMAGEM_ALBUM: 'cover',
            IMAGEM_FUNDO: 'image', IMAGEM_FUNDO_CAPA: 'image',
          };

          // Pré-conta álbuns de áudio únicos para barra de progresso
          const uniqueAudioAlbums = new Set();
          for (const r of rows) {
            if (r.TIPO === 'MUSICA' || r.TIPO === 'MUSICA_PB') {
              const chave = (r.CHAVE || '').replace(/\\/g, '/');
              const slash = chave.indexOf('/');
              if (slash > 0) uniqueAudioAlbums.add(chave.slice(0, slash));
            }
          }
          const totalAlbums = uniqueAudioAlbums.size;

          const typeStats   = emptyStats();
          const albumMap    = new Map(); // key → { name, totalFiles, foundFiles, items[] }
          const seen        = new Set();
          let totalFiles    = 0;
          let foundFiles    = 0;
          let currentAlbum  = '';
          let albumProgress = 0;
          let delphiYield   = 0;

          // Pré-constrói índices de nomes de arquivo em disco (uma varredura por diretório)
          // em vez de chamar findFileInTree (busca recursiva síncrona) para cada linha do
          // ARQUIVOS_SISTEMA — em coletâneas grandes isso travava o processo main inteiro.
          const buildDirIndex = (dirs, maxDepth = 4) => {
            const index = new Set();
            const addDir = (dir, depth = 0) => {
              if (!dir || !fs.existsSync(dir)) return;
              try {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                  if (entry.isFile()) index.add(entry.name.toLowerCase());
                  else if (entry.isDirectory() && depth < maxDepth) addDir(path.join(dir, entry.name), depth + 1);
                }
              } catch (_) {}
            };
            for (const d of dirs) addDir(d);
            return index;
          };
          const audioIndex = buildDirIndex([userMedia, getAutoMediaDir(null, true), getAutoMediaDir()]);
          const coverIndex = buildDirIndex([getAutoCapasDir(), getAutoCapasDir(true)]);
          const imageIndex = buildDirIndex([getAutoImagesDir(), getAutoImagesDir(true)]);

          const getGroup = (key, name) => {
            if (!albumMap.has(key)) albumMap.set(key, { name, totalFiles: 0, foundFiles: 0, items: [] });
            return albumMap.get(key);
          };

          for (const row of rows) {
            const type = tipoMap[row.TIPO];
            if (!type) continue; // ignora ARQUIVOS_ADICIONAIS

            const urlNorm = (row.URL || '').replace(/\\/g, path.sep);
            const dedupKey = urlNorm.toLowerCase();
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);

            totalFiles++;
            typeStats[type]; // acesso para garantir init (já feito no emptyStats)

            // Determina grupo
            let groupKey, groupName;
            if (type === 'audio') {
              const chave = (row.CHAVE || '').replace(/\\/g, '/');
              const slash = chave.indexOf('/');
              groupKey  = slash > 0 ? chave.slice(0, slash) : 'Sem álbum';
              groupName = groupKey;
              // Emite progresso ao mudar de álbum
              if (groupKey !== currentAlbum) {
                currentAlbum = groupKey;
                albumProgress++;
                await sendProgress(albumProgress, totalAlbums, groupName);
              }
            } else if (type === 'cover') {
              groupKey = '__capas__'; groupName = 'Capas de álbuns';
            } else {
              groupKey = '__imagens__'; groupName = 'Imagens de fundo';
            }

            // Verifica existência do arquivo (índices pré-construídos — sem busca recursiva por linha)
            let exists = false;
            const fileName = row.ARQUIVO || path.basename(urlNorm);
            const fileNameLower = fileName.toLowerCase();
            if (installRoot)  exists = fs.existsSync(path.join(installRoot, urlNorm));
            if (!exists)      exists = fs.existsSync(path.join(writableRoot, urlNorm));
            if (!exists && type === 'audio')  exists = audioIndex.has(fileNameLower);
            if (!exists && type === 'cover')  exists = coverIndex.has(fileNameLower);
            if (!exists && type === 'image')  exists = imageIndex.has(fileNameLower);

            // Cede o event loop a cada 10 entradas para não travar a UI
            if (++delphiYield % 10 === 0) await new Promise(resolve => setImmediate(resolve));

            const group = getGroup(groupKey, groupName);
            group.totalFiles++;
            if (exists) {
              foundFiles++;
              typeStats[type].found++;
              group.foundFiles++;
            } else {
              typeStats[type].missing++;
              // URL para download (formato app-local:// compatível com files:download-missing)
              let dlUrl = '';
              const chaveNorm = (row.CHAVE || '').replace(/\\/g, '/');
              const slash = chaveNorm.indexOf('/');
              if (type === 'audio' && slash > 0) {
                dlUrl = `app-local://musicas/${encodeURIComponent(chaveNorm.slice(0, slash))}/${encodeURIComponent(fileName)}`;
              } else if (type === 'audio') {
                dlUrl = `app-local://musicas/${encodeURIComponent(fileName)}`;
              } else if (type === 'cover') {
                dlUrl = `app-local://capas/${encodeURIComponent(fileName)}`;
              } else {
                dlUrl = `app-local://imagens/${encodeURIComponent(fileName)}`;
              }
              group.items.push({
                url:     dlUrl,
                dest:    path.join(writableRoot, urlNorm),
                type,
                name:    fileName,
                relPath: row.URL || urlNorm,
              });
            }
          }

          // Monta allAlbums (álbuns reais primeiro, grupos virtuais por último)
          const isVirtual = (k) => k === '__capas__' || k === '__imagens__';
          const allAlbums   = [];
          const withMissing = [];
          for (const [key, grp] of albumMap) {
            const entry = {
              id_album:   null,
              name:       isVirtual(key) ? grp.name : key,
              url_image:  '',
              totalFiles: grp.totalFiles,
              foundFiles: grp.foundFiles,
              missing:    grp.items.length,
              items:      grp.items,
            };
            allAlbums.push(entry);
            if (grp.items.length > 0) withMissing.push(entry);
          }
          withMissing.sort((a, b) => {
            const av = a.name === 'Capas de álbuns' || a.name === 'Imagens de fundo';
            const bv = b.name === 'Capas de álbuns' || b.name === 'Imagens de fundo';
            if (av !== bv) return av ? 1 : -1;
            return b.missing - a.missing || a.name.localeCompare(b.name);
          });
          const allMissing = withMissing.flatMap(a => a.items)
            .sort((a, b) => a.name.localeCompare(b.name));

          return {
            total:      uniqueAudioAlbums.size,  // álbuns de áudio únicos (igual ao Delphi)
            totalFiles,
            foundFiles,
            albums:     withMissing,
            allAlbums,
            allMissing,
            stats:      typeStats,
            source:     'delphi',
          };
        }
      } catch (e) {
        console.error('[IPC] files:scan-albums (delphi) error:', e.message);
        // cai no scan JSON abaixo
      }
    }

    // ── Scan via JSON (fallback quando banco Delphi não está disponível) ────
    try {
      const dbDir = getDbDir();
      if (!fs.existsSync(dbDir)) return emptyResult();

      const albumFiles = fs.readdirSync(dbDir).filter(f => f.startsWith('album_') && f.endsWith('.json'));
      if (!albumFiles.length) return emptyResult();

      const seen        = new Set();
      const withMissing = [];
      const allAlbums   = [];
      const typeStats   = emptyStats();
      let totalFiles = 0;
      let foundFiles = 0;

      const toRelPath = (destAbs) => {
        for (const base of [getWritableBase(), getInstallDir()]) {
          if (destAbs.toLowerCase().startsWith(base.toLowerCase() + path.sep) ||
              destAbs.toLowerCase().startsWith(base.toLowerCase() + '/')) {
            return destAbs.slice(base.length + 1);
          }
        }
        const idx = destAbs.search(/config[/\\]/i);
        return idx >= 0 ? destAbs.slice(idx) : path.basename(destAbs);
      };

      // Pré-constrói índice de nomes de arquivos de áudio em todos os diretórios conhecidos.
      // Evita chamar findFileInTree (busca recursiva lenta) para cada arquivo individualmente.
      const buildAudioIndex = () => {
        const index = new Set();
        const delphiCfg = getSqliteConfigDir();
        const dirs = [
          Store.get('media_base_folder'),
          getAutoMediaDir(null, true),
          getAutoMediaDir(),
          delphiCfg ? path.join(delphiCfg, 'musicas') : null,
        ].filter(Boolean);
        const addDir = (dir, depth = 0) => {
          if (!dir || !fs.existsSync(dir)) return;
          try {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              if (entry.isFile()) {
                const lower = entry.name.toLowerCase();
                index.add(lower);
                index.add(lower.replace(/\.[^.]+$/, ''));
              } else if (entry.isDirectory() && depth < 3) {
                addDir(path.join(dir, entry.name), depth + 1);
              }
            }
          } catch (_) {}
        };
        for (const d of dirs) addDir(d);
        return index;
      };
      const audioIndex = buildAudioIndex();

      const delphiCfgAlbum = getSqliteConfigDir();
      const capasR         = getAutoCapasDir();
      const imgsR          = getAutoImagesDir();
      const delphiCapasR   = delphiCfgAlbum ? path.join(delphiCfgAlbum, 'capas')   : null;
      const delphiImgsR    = delphiCfgAlbum ? path.join(delphiCfgAlbum, 'imagens') : null;

      for (let i = 0; i < albumFiles.length; i++) {
        const af = albumFiles[i];
        let albumData;
        try { albumData = JSON.parse(fs.readFileSync(path.join(dbDir, af), 'utf8')); }
        catch (_) { continue; }

        const albumName = albumData.name || af.replace(/\.json$/, '');
        await sendProgress(i + 1, albumFiles.length, albumName);

        const capasW   = getAutoCapasDir(true);
        const audioW   = getAutoMediaDir(albumData.folder_name || albumName, true);
        const imgsW    = getAutoImagesDir(true);

        const missingItems    = [];
        const albumStartTotal = totalFiles;
        const albumStartFound = foundFiles;

        const chk = (rawUrl, destW, type) => {
          if (!rawUrl) return;
          const name = safeBasename(rawUrl);
          if (!name) return;
          const dest = path.join(destW, name);
          if (seen.has(dest)) return;
          seen.add(dest);
          totalFiles++;
          let exists = fileUrlExists(rawUrl) || fs.existsSync(dest);
          if (!exists) {
            if (type === 'audio') {
              const lower = name.toLowerCase();
              exists = audioIndex.has(lower) || audioIndex.has(lower.replace(/\.[^.]+$/, ''));
            } else if (type === 'cover') {
              exists = fs.existsSync(path.join(capasR, name))
                    || !!(delphiCapasR && fs.existsSync(path.join(delphiCapasR, name)));
            } else if (type === 'image') {
              exists = fs.existsSync(path.join(imgsR, name))
                    || !!(delphiImgsR && fs.existsSync(path.join(delphiImgsR, name)));
            }
          }
          if (exists) {
            foundFiles++;
            typeStats[type].found++;
          } else {
            typeStats[type].missing++;
            missingItems.push({ url: rawUrl, dest, type, name, relPath: toRelPath(dest) });
          }
        };

        chk(albumData.url_image, capasW, 'cover');
        let musicIdx = 0;
        for (const music of (albumData.musics || [])) {
          const md = await ensureMusicJsonCached(dbDir, dbBaseUrl, token, music.id_music);
          if (!md) continue;
          chk(md.url_music, audioW, 'audio');
          chk(md.url_instrumental_music, audioW, 'audio');
          chk(md.url_image, imgsW, 'image');
          const slides = Array.isArray(md.slides) ? md.slides : [];
          for (const s of slides) chk(s?.url_image, imgsW, 'image');
          // Cede o event loop a cada 5 músicas para manter a UI responsiva
          if (++musicIdx % 5 === 0) await new Promise(resolve => setImmediate(resolve));
        }

        const albumTotal = totalFiles - albumStartTotal;
        const albumFound = foundFiles - albumStartFound;
        allAlbums.push({
          id_album: albumData.id_album, name: albumName, url_image: albumData.url_image || '',
          totalFiles: albumTotal, foundFiles: albumFound, missing: missingItems.length, items: missingItems,
        });
        if (missingItems.length > 0) {
          withMissing.push({
            id_album: albumData.id_album, name: albumName, url_image: albumData.url_image || '',
            missing: missingItems.length, items: missingItems,
          });
        }
      }

      withMissing.sort((a, b) => b.missing - a.missing || a.name.localeCompare(b.name));
      const allMissing = withMissing.flatMap(a => a.items).sort((a, b) => a.name.localeCompare(b.name));

      return {
        total: albumFiles.length, totalFiles, foundFiles,
        albums: withMissing, allAlbums, allMissing, stats: typeStats, source: 'json',
      };
    } catch (e) {
      console.error('[IPC] files:scan-albums error:', e.message);
      return { ...emptyResult(), error: e.message };
    }
  });

  // Verifica completude de álbuns específicos baixados via album_<id>.json (fluxo
  // "Baixar álbum completo" do Centro de Downloads). Diferente de files:scan-albums,
  // sempre lê os JSONs diretamente por id — não usa o ARQUIVOS_SISTEMA do SQLite
  // Delphi, cujas entradas têm id_album nulo e não dá pra casar com os ids pedidos
  // (era por isso que "Meus Downloads" nunca marcava nenhum álbum como completo).
  ipcMain.handle('files:check-albums-complete', async (_event, albumIds, dbBaseUrl, token) => {
    const result = {};
    if (!Array.isArray(albumIds) || !albumIds.length) return result;

    const dbDir = getDbDir();
    if (!fs.existsSync(dbDir)) return result;

    const capasR = getAutoCapasDir();
    const capasW = getAutoCapasDir(true);
    const imgsR  = getAutoImagesDir();
    const imgsW  = getAutoImagesDir(true);

    for (const id of albumIds) {
      const albumFile = path.join(dbDir, `album_${id}.json`);
      if (!fs.existsSync(albumFile)) continue;

      let albumData;
      try { albumData = JSON.parse(fs.readFileSync(albumFile, 'utf8')); }
      catch (_) { continue; }

      const albumName = albumData.name || `album_${id}`;
      const audioW = getAutoMediaDir(albumData.folder_name || albumName, true);
      const audioR = getAutoMediaDir(albumData.folder_name || albumName, false);

      let totalFiles = 0, foundFiles = 0, missing = 0;

      const check = (rawUrl, dirW, dirR, type) => {
        if (!rawUrl) return;
        totalFiles++;
        if (fileUrlExists(rawUrl)) { foundFiles++; return; }
        const name = safeBasename(rawUrl);
        if (!name) { missing++; return; }
        let exists = fs.existsSync(path.join(dirW, name));
        if (!exists && dirR) exists = fs.existsSync(path.join(dirR, name));
        if (!exists && type === 'audio') exists = !!findFileInTree(audioR, name) || !!findFileInTree(audioW, name);
        if (exists) foundFiles++; else missing++;
      };

      check(albumData.url_image, capasW, capasR, 'cover');

      for (const music of (albumData.musics || [])) {
        const md = await ensureMusicJsonCached(dbDir, dbBaseUrl, token, music.id_music);
        if (!md) { missing++; totalFiles++; continue; }
        check(md.url_music, audioW, audioR, 'audio');
        check(md.url_instrumental_music, audioW, audioR, 'audio');
        check(md.url_image, imgsW, imgsR, 'image');
        const slideList = Array.isArray(md.slides) ? md.slides
          : (md.lyric && typeof md.lyric === 'object' ? Object.values(md.lyric) : []);
        for (const s of slideList) check(s?.url_image, imgsW, imgsR, 'image');
      }

      result[String(id)] = { missing, totalFiles, foundFiles };
    }

    return result;
  });

  ipcMain.handle('files:download-missing', async (event, missingList, filesBaseUrl, token) => {
    try {
      const hdrs  = token ? { 'Api-Token': token } : {};
      const total = missingList.length;
      let downloaded = 0, errors = 0;
      let totalBytesDownloaded = 0;
      const startTime = Date.now();

      const formatSize = (bytes) => {
        if (!bytes || bytes <= 0) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };

      const send = (current, message, fileSize = 0, fileBytes = 0) => {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed   = elapsed > 0 ? totalBytesDownloaded / elapsed : 0; // bytes/s
        const speedStr = speed > 0 ? `${formatSize(speed)}/s` : '';
        try {
          event.sender.send('files:download-progress', {
            current, total, message,
            fileSize:  formatSize(fileSize),
            speed:     speedStr,
          });
        } catch (_) {}
      };

      // Versão de downloadBinary que retorna o tamanho do arquivo baixado
      const downloadBinaryWithSize = async (url, destPath) => {
        try {
          if (fs.existsSync(destPath)) {
            const existing = fs.statSync(destPath).size;
            return { ok: true, size: existing, skipped: true };
          }
          const resp = await net.fetch(url, Object.keys(hdrs).length ? { headers: hdrs } : {});
          if (!resp.ok) return { ok: false, size: 0 };
          const contentLength = parseInt(resp.headers.get('content-length') || '0', 10);
          const buffer = Buffer.from(await resp.arrayBuffer());
          if (!buffer.length) return { ok: false, size: 0 };
          const dir = path.dirname(destPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(destPath, buffer);
          return { ok: true, size: buffer.length || contentLength };
        } catch (e) {
          console.error('[IPC] downloadBinaryWithSize error:', e.message, '| url:', url);
          return { ok: false, size: 0 };
        }
      };

      for (let i = 0; i < missingList.length; i++) {
        const item = missingList[i];
        if (!item || !item.dest) {
          console.warn('[IPC] files:download-missing item inválido no índice', i, item);
          errors++;
          continue;
        }

        send(i, `[${i + 1}/${total}] ${item.name || path.basename(item.dest)}`);
        const url = resolveFileUrl(item.url, filesBaseUrl);
        if (!url) {
          console.warn('[IPC] files:download-missing URL não resolvida:', item.url);
          errors++;
          continue;
        }

        const { ok, size } = await downloadBinaryWithSize(url, item.dest);
        if (ok) {
          downloaded++;
          totalBytesDownloaded += size;
          send(i + 1, `[${i + 1}/${total}] ${item.name}`, size);
        } else {
          errors++;
          console.warn('[IPC] files:download-missing falhou:', item.url);
          send(i + 1, `[${i + 1}/${total}] Erro: ${item.name}`);
        }
      }

      send(total, `Concluído! ${downloaded} baixado(s), ${errors} erro(s).`);

      // Após os downloads, sincroniza os JSONs locais com os novos file:// URLs
      try { await syncLocalFileUrls(getDbDir()); } catch (_) {}

      return { success: true, downloaded, errors };
    } catch (e) {
      console.error('[IPC] files:download-missing error:', e.message);
      return { success: false, error: e.message };
    }
  });

  console.log('[IPC] Handlers registrados com sucesso');
}

module.exports = { setupIpc };
