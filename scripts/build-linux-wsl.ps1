# Compila o target Linux (AppImage) do Louvor JA dentro do WSL, a partir do Windows.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\build-linux-wsl.ps1 [-Distro Ubuntu]

param(
    [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"

function Fail($msg) {
    Write-Host $msg -ForegroundColor Red
    exit 1
}

# 1. WSL instalado?
$wslInstalled = $true
try {
    wsl.exe --status *> $null
    if ($LASTEXITCODE -ne 0) { $wslInstalled = $false }
} catch {
    $wslInstalled = $false
}

if (-not $wslInstalled) {
    Fail @"
WSL nao esta instalado.

Rode em um PowerShell como Administrador:
    wsl --install

Depois reinicie o computador, complete a configuracao inicial do Ubuntu
(usuario/senha) e rode este script de novo.
"@
}

# 2. Distro presente?
$distros = (wsl.exe -l -q) -replace "`0", "" | Where-Object { $_.Trim() -ne "" }
if (-not ($distros -contains $Distro)) {
    Write-Host "Distro '$Distro' nao encontrada. Instalando..." -ForegroundColor Yellow
    wsl.exe --install -d $Distro
    Fail @"
A distro '$Distro' acabou de ser instalada e precisa de configuracao inicial
(usuario/senha) na primeira execucao.

Abra o WSL uma vez (menu Iniciar > $Distro) para concluir esse setup e depois
rode este script novamente.
"@
}

# 3. Node/npm dentro da distro?
wsl.exe -d $Distro -- bash -lc "command -v node && command -v npm" *> $null
if ($LASTEXITCODE -ne 0) {
    Fail @"
Node.js nao foi encontrado dentro do WSL ($Distro).

Instale o Node dentro do WSL (ex: via nvm) e rode este script novamente:
    wsl -d $Distro
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    (feche e reabra o terminal WSL)
    nvm install --lts
"@
}

# 4. Traduz o caminho do projeto (Windows -> WSL) e roda o build
$projectPath = (Resolve-Path "$PSScriptRoot\..").Path
$wslPath = (wsl.exe wslpath -a "$projectPath").Trim()

Write-Host "Projeto: $projectPath" -ForegroundColor Cyan
Write-Host "Caminho no WSL: $wslPath" -ForegroundColor Cyan
Write-Host "Instalando dependencias e gerando o AppImage dentro do WSL ($Distro)..." -ForegroundColor Cyan

wsl.exe -d $Distro -- bash -lc "cd '$wslPath' && npm install && npm run electron:build:linux"

if ($LASTEXITCODE -ne 0) {
    Fail "Build Linux falhou. Veja o log acima."
}

Write-Host "Build Linux concluido. Verifique a pasta 'release/'." -ForegroundColor Green
