/**
 * prepare-bundle.js
 *
 * Copia o banco SQLite (database.db) e as capas dos álbuns da instalação
 * do LouvorJA Delphi para dois destinos:
 *
 *   1. bundled/config/  → incluído no instalador via extraFiles (electron-builder)
 *   2. userData/config/ → usado para testes em modo dev (electron:dev)
 *
 * Uso:
 *   node scripts/prepare-bundle.js [--dev-only] [--bundle-only]
 *
 *   --dev-only    : copia apenas para userData (teste local, sem gerar bundled/)
 *   --bundle-only : copia apenas para bundled/ (para CI/build sem Electron instalado)
 */

const fs   = require('fs');
const path = require('path');

// ── Localização do LouvorJA Delphi instalado ──────────────────────────────────
// O Delphi é um app legado exclusivo do Windows — em qualquer outra plataforma
// (ex: build do AppImage rodando dentro do WSL) essa busca nunca vai encontrar
// nada, então nem tentamos: usamos o que já estiver em bundled/config (gerado
// antes, no Windows) ou pulamos a etapa (ver deploy()).
const DELPHI_CANDIDATES = process.platform === 'win32' ? [
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Louvor JA', 'config'),
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Louvor JA', 'config'),
  'C:\\Louvor JA\\config',
  'C:\\LouvorJA\\config',
] : [];

// ── Pasta de destino para o build (extraFiles no electron-builder) ────────────
const BUNDLED_CONFIG = path.join(__dirname, '..', 'bundled', 'config');

// ── userData do Electron em dev ───────────────────────────────────────────────
// Segue a convenção do próprio Electron por plataforma (app.getPath('userData')).
const os = require('os');
const ELECTRON_USERDATA = path.join(
  process.platform === 'win32'
    ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
    : process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : (process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')),
  'LouvorJA' // productName do package.json
);
const DEV_CONFIG = path.join(ELECTRON_USERDATA, 'config');

// ─────────────────────────────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const devOnly    = args.includes('--dev-only');
const bundleOnly = args.includes('--bundle-only');

// Sem LouvorJA instalado, a origem é a pasta de dados em Documentos (ou a indicada
// em LOUVORJA_DATA_DIR): database.db e capas/ direto nela.
const DATA_DOCS = process.env.LOUVORJA_DATA_DIR || path.join(os.homedir(), 'Documents', 'LouvorJA-dados');

function findDelphiConfig() {
  const docsDb = path.join(DATA_DOCS, 'database.db');
  if (fs.existsSync(docsDb) && fs.statSync(docsDb).size > 1024) {
    console.log(`[prepare-bundle] usando dados de ${DATA_DOCS}`);
    return DATA_DOCS;
  }
  for (const dir of DELPHI_CANDIDATES) {
    const db = path.join(dir, 'database.db');
    if (fs.existsSync(db) && fs.statSync(db).size > 1024) {
      console.log(`[prepare-bundle] Delphi encontrado: ${dir}`);
      return dir;
    }
  }
  return null;
}

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return 0;
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  let count = 0;
  for (const file of fs.readdirSync(srcDir)) {
    const src  = path.join(srcDir, file);
    const dest = path.join(destDir, file);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, dest);
      count++;
    }
  }
  return count;
}

function sizeMB(filePath) {
  try { return (fs.statSync(filePath).size / 1024 / 1024).toFixed(1) + ' MB'; }
  catch (_) { return '? MB'; }
}

function deploy(destConfig, label) {
  const delphiConfig = findDelphiConfig();
  if (!delphiConfig) {
    // Já existe um database.db válido no destino (ex: copiado antes, no Windows,
    // e reaproveitado agora numa build Linux via WSL) — nada a fazer.
    const destDb = path.join(destConfig, 'database.db');
    if (fs.existsSync(destDb) && fs.statSync(destDb).size > 1024) {
      console.log(`[${label}] LouvorJA Delphi nao encontrado nesta plataforma — mantendo database.db existente (${sizeMB(destDb)})`);
      return;
    }

    if (process.platform !== 'win32') {
      // Sem Delphi (nunca existe fora do Windows) e sem database.db herdado —
      // segue sem banco embutido: o app funciona normalmente buscando álbuns,
      // músicas e capas da API (fluxo já usado por instalações novas, sem o
      // legado Delphi). Cria a pasta vazia pra "extraFiles" do electron-builder
      // não falhar por falta de bundled/config.
      if (!fs.existsSync(destConfig)) fs.mkdirSync(destConfig, { recursive: true });
      console.log(`[${label}] Nenhum database.db local (normal fora do Windows) — app vai buscar tudo da API em runtime.`);
      return;
    }

    console.error('[prepare-bundle] ERRO: LouvorJA Delphi nao encontrado.');
    console.error('  Procurado em:', DELPHI_CANDIDATES.join('\n               '));
    process.exit(1);
  }

  // database.db — copia somente se destino não existir ou for mais antigo
  const srcDb  = path.join(delphiConfig, 'database.db');
  const destDb = path.join(destConfig, 'database.db');
  const skip   = fs.existsSync(destDb) &&
                 fs.statSync(destDb).mtimeMs >= fs.statSync(srcDb).mtimeMs;
  if (skip) {
    console.log(`[${label}] database.db já atualizado (${sizeMB(destDb)}) — pulando`);
  } else {
    process.stdout.write(`[${label}] Copiando database.db (${sizeMB(srcDb)})... `);
    copyFile(srcDb, destDb);
    console.log('ok');
  }

  // capas/ — copia todos os arquivos de imagem
  const srcCapas  = path.join(delphiConfig, 'capas');
  const destCapas = path.join(destConfig, 'capas');
  const n = copyDir(srcCapas, destCapas);
  console.log(`[${label}] capas/ copiadas: ${n} arquivos`);

  console.log(`[${label}] Destino: ${destConfig}`);
}

// ── Catálogo em espanhol para o instalador ───────────────────────────────────
// Sem isso o app instalado não tem coletâneas, hinário e bíblia em espanhol
// offline (esses arquivos só existem no disco de dev, ver scripts/import-*-es).
// Vão pra db/ ao lado do executável (mesma pasta que o app já usa pro catálogo).
// Áudios não entram (são grandes); ficam em config/musicas/es.
const ES_DB_SRC = fs.existsSync(path.join(DATA_DOCS, 'db'))
  ? path.join(DATA_DOCS, 'db')
  : path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'louvorja', 'db');
const BUNDLED_DB = path.join(__dirname, '..', 'bundled', 'db');
// Hinário, bíblia e catálogo das coleções em espanhol (JSON, sem os áudios): o
// áudio das coleções fica na pasta do usuário (config/musicas/es), não no instalador.
const ES_FILE = /^(es_hymnal\.json$|es_bible_|bible_10\d\d_|es_categories\.json$|es_musics\.json$|album_9\d{3,4}\.json$|music_9\d{5,6}\.json$)/;

function deployEsCatalog() {
  if (!fs.existsSync(ES_DB_SRC)) {
    console.log('[bundle-db] catálogo espanhol não encontrado — pulando');
    return;
  }
  fs.rmSync(BUNDLED_DB, { recursive: true, force: true });
  fs.mkdirSync(BUNDLED_DB, { recursive: true });
  const hymnIds = new Set(
    JSON.parse(fs.readFileSync(path.join(ES_DB_SRC, 'es_hymnal.json'), 'utf8')).map((h) => `music_${h.id_music}.json`)
  );
  let n = 0;
  for (const f of fs.readdirSync(ES_DB_SRC)) {
    if (ES_FILE.test(f) || hymnIds.has(f)) {
      fs.copyFileSync(path.join(ES_DB_SRC, f), path.join(BUNDLED_DB, f));
      n++;
    }
  }
  console.log(`[bundle-db] catálogo espanhol: ${n} arquivos em ${BUNDLED_DB}`);
}

if (!bundleOnly) {
  console.log('\n=== Destino DEV (userData) ===');
  deploy(DEV_CONFIG, 'dev');
}

if (!devOnly) {
  console.log('\n=== Destino BUNDLE (para o instalador) ===');
  deploy(BUNDLED_CONFIG, 'bundle');
  deployEsCatalog();
}

console.log('\n[prepare-bundle] Concluido.');
if (!bundleOnly) {
  console.log('  → Teste: npm run electron:dev');
}
if (!devOnly) {
  console.log('  → Build: npm run electron:build');
}
