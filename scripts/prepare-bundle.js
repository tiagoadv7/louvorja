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
const DELPHI_CANDIDATES = [
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Louvor JA', 'config'),
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Louvor JA', 'config'),
  'C:\\Louvor JA\\config',
  'C:\\LouvorJA\\config',
];

// ── Pasta de destino para o build (extraFiles no electron-builder) ────────────
const BUNDLED_CONFIG = path.join(__dirname, '..', 'bundled', 'config');

// ── userData do Electron em dev ───────────────────────────────────────────────
// Em dev, Electron usa "%AppData%\<productName>" — ajuste se necessário
const ELECTRON_USERDATA = path.join(
  process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming'),
  'LouvorJA' // productName do package.json
);
const DEV_CONFIG = path.join(ELECTRON_USERDATA, 'config');

// ─────────────────────────────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const devOnly    = args.includes('--dev-only');
const bundleOnly = args.includes('--bundle-only');

function findDelphiConfig() {
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

if (!bundleOnly) {
  console.log('\n=== Destino DEV (userData) ===');
  deploy(DEV_CONFIG, 'dev');
}

if (!devOnly) {
  console.log('\n=== Destino BUNDLE (para o instalador) ===');
  deploy(BUNDLED_CONFIG, 'bundle');
}

console.log('\n[prepare-bundle] Concluido.');
if (!bundleOnly) {
  console.log('  → Teste: npm run electron:dev');
}
if (!devOnly) {
  console.log('  → Build: npm run electron:build');
}
