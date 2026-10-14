// Lança o Electron com ELECTRON_RUN_AS_NODE removido do ambiente.
// cross-env ELECTRON_RUN_AS_NODE= apenas seta string vazia no Windows,
// mas Electron ainda detecta a variável como presente. Deletar explicitamente resolve.
const { spawn } = require('child_process');
const electronBinary = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
// Em builds com ELECTRON_BUILD=true (electron:preview) o modo dev é false
env.ELECTRON_DEV = env.ELECTRON_BUILD === 'true' ? 'false' : 'true';

const child = spawn(electronBinary, ['.'], {
  env,
  stdio: 'inherit',
  cwd: process.cwd(),
});

child.on('exit', (code) => process.exit(code ?? 0));
