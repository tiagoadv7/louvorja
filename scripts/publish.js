/**
 * publish.js
 *
 * Roda o electron-builder --publish always carregando GH_TOKEN de um .env
 * local na raiz do projeto (arquivo já coberto pelo .gitignore, nunca vai
 * pro git/GitHub). Não depende do pacote "dotenv" — parsing simples o
 * suficiente pra essa única variável.
 *
 * Uso: crie um arquivo ".env" na raiz do projeto com:
 *   GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 * (token do GitHub com escopo "repo", gerado em
 * https://github.com/settings/tokens)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

if (!process.env.GH_TOKEN) {
  console.error('[publish] GH_TOKEN não encontrado.');
  console.error('[publish] Crie um arquivo .env na raiz do projeto com: GH_TOKEN=ghp_...');
  console.error('[publish] Gere o token em https://github.com/settings/tokens (escopo "repo").');
  process.exit(1);
}

const result = spawnSync('npx', ['electron-builder', '--publish', 'always'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
