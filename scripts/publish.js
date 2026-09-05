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
 *
 * Depois que o electron-builder cria a release (só com tag/nome — a lib
 * "electron-publish" nunca manda "body", ver node_modules/electron-publish/
 * out/gitHubPublisher.js#createRelease), este script PATCHa a descrição da
 * release com um changelog gerado a partir das mensagens de commit entre a
 * release anterior e o HEAD atual (ver updateReleaseDescription abaixo) — é
 * essa descrição que aparece no modal "Novidades desta versão" (ver
 * src/components/ReleaseNotesDialog.vue e electron/updater.js#
 * getCurrentReleaseNotes).
 *
 * Antes de publicar, também garante que a tag "v<versão>" já existe no
 * GitHub apontando pro commit certo (ver ensureTagPushed). Sem isso: se o
 * electron-builder cria a release ANTES de existir uma tag remota com esse
 * nome, o GitHub cria a tag sozinho apontando pra HEAD do branch padrão do
 * repositório (main) — não pro commit que foi de fato compilado. Foi o que
 * aconteceu com a tag v1.28.7 (release publicada a partir desta branch,
 * mas a tag ficou apontando pro "main", que está muito atrás) — confirmado
 * comparando "git rev-parse main" com o SHA da tag remota via
 * "git ls-remote --tags origin".
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync, execFileSync } = require('child_process');

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

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = pkg.version;
const tag = `v${version}`;

/** Extrai "owner/repo" do campo "repository" do package.json (mesma fonte que o electron-builder usa quando build.publish não define owner/repo explicitamente). */
function repoFromPackageJson() {
  const repoField = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const match = String(repoField || '').match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/** Requisição simples à API do GitHub autenticada com GH_TOKEN. */
function githubRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      `https://api.github.com${urlPath}`,
      {
        method,
        headers: {
          'User-Agent': 'louvorja-publish-script',
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${process.env.GH_TOKEN}`,
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const status = res.statusCode || 0;
          const raw = Buffer.concat(chunks).toString('utf8');
          if (status < 200 || status >= 300) return reject(new Error(`HTTP ${status}: ${raw.slice(0, 300)}`));
          try { resolve(raw ? JSON.parse(raw) : null); } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Timeout ao acessar a API do GitHub')));
    if (payload) req.write(payload);
    req.end();
  });
}

/** Compara versões semver básicas (a.b.c). Retorna >0 se a>b. */
function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

/**
 * Garante que a tag "v<versão>" exista no GitHub apontando pro commit atual
 * (HEAD) ANTES do electron-builder criar a release — ver nota no topo do
 * arquivo sobre por que a ordem importa. "-f" é seguro aqui: mesmo que a
 * tag já exista remotamente (ex.: criada errada pelo GitHub numa tentativa
 * anterior), sobrescrever pra apontar pro commit certo é o objetivo.
 */
function ensureTagPushed() {
  try {
    execFileSync('git', ['tag', '-a', '-f', tag, '-m', `Versão ${version}`], { stdio: 'inherit' });
    execFileSync('git', ['push', 'origin', '-f', tag], { stdio: 'inherit' });
  } catch (e) {
    console.error(`[publish] Falha ao criar/enviar a tag ${tag}:`, e.message);
    process.exit(1);
  }
}

// Mapeia o prefixo de conventional commit (feat:, fix:, ...) pro título de
// seção com emoji — mesmo padrão da seção "Changelog" das releases do
// louvorja/violin-app (fork mais avançado deste app), usada aqui como
// modelo. Ordem da lista = ordem de exibição; commits sem prefixo reconhecido
// (ex.: "Ajuste mensagem", sem conventional commit) caem em CATCH_ALL, sempre
// por último.
const COMMIT_TYPE_SECTIONS = [
  ['feat', '✨ Novidades'],
  ['fix', '🐛 Correções'],
  ['perf', '⚡ Performance'],
  ['refactor', '🔧 Melhorias'],
  ['style', '💄 Ajustes visuais'],
  ['docs', '📝 Documentação'],
  ['test', '🧪 Testes'],
  ['build', '📦 Infraestrutura'],
  ['ci', '📦 Infraestrutura'],
  ['chore', '📦 Tarefas internas'],
];
const CATCH_ALL_SECTION = '🔧 Outras alterações';

/**
 * Monta o changelog da versão via API do GitHub: pega a release publicada
 * imediatamente anterior (por número de versão) e compara seu commit com o
 * HEAD atual (git rev-parse — sempre correto, é o commit local que está
 * sendo publicado agora). Evita usar tags locais pra achar a "anterior": o
 * repositório tem tags de um remote "upstream" (fork com numeração própria)
 * que podem aparecer como "alcançáveis"/ordenadas junto das tags reais deste
 * repo e confundir a escolha (ver nota no topo do arquivo).
 *
 * Agrupa os commits por tipo (feat/fix/...) sob títulos com emoji, igual à
 * seção "Changelog" automática das releases do louvorja/violin-app — cada
 * item linka pro commit no GitHub, mesmo padrão de lá.
 */
async function buildChangelog(repoInfo) {
  let releases;
  try {
    releases = await githubRequest('GET', `/repos/${repoInfo.owner}/${repoInfo.repo}/releases?per_page=30`);
  } catch (e) {
    console.warn('[publish] Não foi possível listar releases para montar o changelog:', e.message);
    return null;
  }

  const previous = releases
    .filter((r) => r && !r.draft && /^v\d+\.\d+\.\d+$/.test(r.tag_name) && r.tag_name !== tag)
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0];
  if (!previous) {
    console.warn('[publish] Nenhuma release anterior encontrada — changelog não gerado.');
    return null;
  }

  let headSha;
  try {
    headSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch (e) {
    console.warn('[publish] Não foi possível obter o commit atual:', e.message);
    return null;
  }

  let compare;
  try {
    compare = await githubRequest('GET', `/repos/${repoInfo.owner}/${repoInfo.repo}/compare/${previous.tag_name}...${headSha}`);
  } catch (e) {
    console.warn(`[publish] Não foi possível comparar ${previous.tag_name}...HEAD para montar o changelog:`, e.message);
    return null;
  }

  const commits = (compare.commits || [])
    .filter((c) => (c.parents || []).length <= 1) // ignora merges
    .map((c) => ({ sha: c.sha, subject: String(c.commit?.message || '').split('\n')[0].trim() }))
    .filter((c) => c.subject)
    .filter((c) => !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(c.subject)); // remove o próprio commit de bump de versão

  if (commits.length === 0) return null;

  const sections = new Map(); // título → linhas
  for (const { sha, subject } of commits) {
    const match = subject.match(/^(\w+)(\([^)]*\))?:\s*(.+)$/);
    const type = match ? match[1].toLowerCase() : null;
    const cleanSubject = match ? match[3] : subject;
    const title = (COMMIT_TYPE_SECTIONS.find(([t]) => t === type) || [null, CATCH_ALL_SECTION])[1];
    if (!sections.has(title)) sections.set(title, []);
    const commitUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/commit/${sha}`;
    sections.get(title).push(`- ${cleanSubject} ([ver commit](${commitUrl}))`);
  }

  const orderedTitles = [...COMMIT_TYPE_SECTIONS.map(([, title]) => title), CATCH_ALL_SECTION]
    .filter((title, i, arr) => arr.indexOf(title) === i) // dedup (build/ci compartilham título)
    .filter((title) => sections.has(title));

  return orderedTitles.map((title) => `## ${title}\n${sections.get(title).join('\n')}`).join('\n\n');
}

/** Busca a release recém-publicada pela tag e atualiza sua descrição (body). */
async function updateReleaseDescription() {
  const repoInfo = repoFromPackageJson();
  if (!repoInfo) {
    console.warn('[publish] Não foi possível identificar owner/repo do GitHub — descrição da release não atualizada.');
    return;
  }

  const changelog = await buildChangelog(repoInfo);
  if (!changelog) return;

  try {
    const release = await githubRequest('GET', `/repos/${repoInfo.owner}/${repoInfo.repo}/releases/tags/${tag}`);
    await githubRequest('PATCH', `/repos/${repoInfo.owner}/${repoInfo.repo}/releases/${release.id}`, { body: changelog });
    console.log(`[publish] Descrição da release ${tag} atualizada com o changelog.`);
  } catch (e) {
    console.warn(`[publish] Falha ao atualizar a descrição da release ${tag}:`, e.message);
  }
}

ensureTagPushed();

const result = spawnSync('npx', ['electron-builder', '--publish', 'always'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

updateReleaseDescription().finally(() => process.exit(0));
