// Verifica/baixa atualizações do app publicadas via links compartilhados do
// Dropbox, usados como fonte primária de updates (GitHub Releases é o
// fallback, ver main.js). Usa links em vez de caminhos de pasta porque nem
// toda pasta visível na conta pelo navegador aparece via files/list_folder
// (ex.: pastas de outro namespace/app) — um link compartilhado sempre funciona.
//
// Setup único (fora do código):
//   1. https://www.dropbox.com/developers/apps → Create app → Scoped access → Full Dropbox.
//   2. Aba Permissions: habilitar files.metadata.read, files.content.read e
//      sharing.read → Submit.
//   3. Autorizar uma vez no navegador:
//      https://www.dropbox.com/oauth2/authorize?client_id=<APP_KEY>&token_access_type=offline&response_type=code
//      → copiar o "code" retornado.
//   4. Trocar o code por um refresh token (uma única vez):
//      curl https://api.dropboxapi.com/oauth2/token \
//        -d code=<CODE> -d grant_type=authorization_code \
//        -d client_id=<APP_KEY> -d client_secret=<APP_SECRET>
//      → guardar o "refresh_token" da resposta.
//   5. Preencher electron/dropbox.env (copiado de .env.dropbox.example) com
//      DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN e
//      DROPBOX_VERSION_JSON_LINK (link "Copiar link" do arquivo version.json).
//   6. A cada novo build: subir o instalador no Dropbox, pegar o link dele
//      ("Copiar link"), e sobrescrever version.json (sempre no mesmo
//      arquivo/pasta, para que DROPBOX_VERSION_JSON_LINK continue válido) com:
//      { "version": "1.5.0", "installer_link": "<link do instalador>",
//        "file": "Louvor JA Setup 1.5.0.exe", "notes": "..." }

const { net, app } = require('electron');
const fs   = require('fs');
const path = require('path');
const { Readable } = require('stream');

let credsCache;

function loadCredentials() {
  if (credsCache !== undefined) return credsCache;
  try {
    require('dotenv').config({ path: path.join(__dirname, 'dropbox.env') });
  } catch (_) {}

  const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN, DROPBOX_VERSION_JSON_LINK } = process.env;
  if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET || !DROPBOX_REFRESH_TOKEN || !DROPBOX_VERSION_JSON_LINK) {
    credsCache = null;
    return null;
  }
  credsCache = {
    appKey:          DROPBOX_APP_KEY,
    appSecret:       DROPBOX_APP_SECRET,
    refreshToken:    DROPBOX_REFRESH_TOKEN,
    versionJsonLink: DROPBOX_VERSION_JSON_LINK,
  };
  return credsCache;
}

async function getAccessToken(c) {
  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: c.refreshToken,
    client_id:     c.appKey,
    client_secret: c.appSecret,
  });
  const resp = await net.fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!resp.ok) throw new Error(`dropbox-auth-${resp.status}`);
  const json = await resp.json();
  return json.access_token;
}

// Baixa o conteúdo de um arquivo a partir do seu link compartilhado do
// Dropbox — funciona independente de o arquivo estar "montado" no namespace
// próprio da conta autenticada (ao contrário de files/download por path).
function fetchSharedLinkFile(token, url) {
  return net.fetch('https://content.dropboxapi.com/2/sharing/get_shared_link_file', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ url }),
    },
  });
}

async function fetchVersionManifest(token, versionJsonLink) {
  const resp = await fetchSharedLinkFile(token, versionJsonLink);
  if (!resp.ok) throw new Error(`dropbox-manifest-${resp.status}`);
  return JSON.parse(await resp.text());
}

// Pasta gravável para o instalador baixado: "config/setup" dentro da própria
// instalação do Louvor JA — mesmo padrão usado em electron/ipc.js
// (getWritableBase/getWritableConfigDir), já que o instalador NSIS concede
// acesso total a "config/" via icacls mesmo em Program Files (ver
// build/installer.nsh, customInstall). Cai para userData/config/setup se a
// pasta de instalação não estiver gravável por algum motivo (ex. portátil
// bloqueado, ACL não aplicada).
function getSetupDir() {
  if (!app.isPackaged) return path.join(app.getPath('userData'), 'config', 'setup');
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'config', 'setup');
  }
  const exeDir    = path.dirname(app.getPath('exe'));
  const configDir = path.join(exeDir, 'config');
  try {
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    const testFile = path.join(configDir, '.louvorja-write-test');
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    return path.join(configDir, 'setup');
  } catch (_) {
    return path.join(app.getPath('userData'), 'config', 'setup');
  }
}

// Comparador simples de versões "1.2.3" — evita depender do pacote semver
// apenas para este único uso.
function isNewerVersion(remote, local) {
  const parse = v => String(v || '0').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const a = parse(remote), b = parse(local);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

async function checkForDropboxUpdate(currentVersion) {
  const c = loadCredentials();
  if (!c) return { available: false, reason: 'not-configured' };

  const token    = await getAccessToken(c);
  const manifest = await fetchVersionManifest(token, c.versionJsonLink);
  if (!manifest || !manifest.version || !manifest.installer_link) {
    return { available: false, reason: 'invalid-manifest' };
  }
  if (!isNewerVersion(manifest.version, currentVersion)) {
    return { available: false, reason: 'up-to-date' };
  }
  return {
    available:     true,
    version:        manifest.version,
    installerLink:  manifest.installer_link,
    file:           manifest.file || `LouvorJA-Setup-${manifest.version}.exe`,
    notes:          manifest.notes || '',
  };
}

async function downloadDropboxUpdate(installerLink, fileName, onProgress) {
  const c = loadCredentials();
  if (!c) throw new Error('dropbox-not-configured');

  const token = await getAccessToken(c);
  const resp  = await fetchSharedLinkFile(token, installerLink);
  if (!resp.ok || !resp.body) throw new Error(`dropbox-download-${resp.status}`);

  const total = parseInt(resp.headers.get('content-length') || '0', 10);
  const dir = getSetupDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const destPath = path.join(dir, fileName);
  // Baixa com extensão .download em vez do nome final .exe — evita que o
  // antivírus trave o arquivo em tempo real por scan durante a escrita (mais
  // comum em executáveis) e evita que uma queda no meio do download deixe um
  // "instalador" corrompido com o nome final, como se estivesse pronto pra usar.
  const tempPath = `${destPath}.download`;

  // Remove um instalador/temp de tentativa anterior (parcial ou já usado)
  // antes de escrever — createWriteStream sozinho já sobrescreve, mas um
  // arquivo travado por antivírus/indexação após um download anterior pode
  // impedir a escrita; apagar antes evita esse conflito.
  for (const p of [destPath, tempPath]) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (_) {
      // Não crítico — segue e deixa createWriteStream tentar sobrescrever
    }
  }

  let transferred = 0;
  const startTime = Date.now();
  const writeStream = fs.createWriteStream(tempPath);
  const nodeStream   = Readable.fromWeb(resp.body);

  await new Promise((resolve, reject) => {
    nodeStream.on('data', (chunk) => {
      transferred += chunk.length;
      if (onProgress) {
        const elapsed = (Date.now() - startTime) / 1000;
        onProgress({
          transferred,
          total,
          percent:        total > 0 ? Math.round((transferred / total) * 100) : 0,
          bytesPerSecond: elapsed > 0 ? transferred / elapsed : 0,
        });
      }
    });
    nodeStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
    nodeStream.pipe(writeStream);
  });

  // Só vira o instalador "de verdade" depois que o download inteiro confirmou
  // sucesso — renomear é atômico no mesmo volume, sem a janela de risco de
  // gravar direto por cima do nome final.
  fs.renameSync(tempPath, destPath);

  return destPath;
}

module.exports = { checkForDropboxUpdate, downloadDropboxUpdate, isNewerVersion };
