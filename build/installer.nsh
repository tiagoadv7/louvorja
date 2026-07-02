; ── Macro executada antes da inicialização do instalador ───────────────────
; Define o diretório padrão como C:\Program Files (x86)\Louvor JA
!macro preInit
  ; Verifica se já foi instalado antes (lê do registro)
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}_is1" "InstallLocation"
  ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}_is1" "InstallLocation"
  ${If} $0 != ""
    StrCpy $INSTDIR "$0"
  ${ElseIf} $1 != ""
    StrCpy $INSTDIR "$1"
  ${Else}
    ; Primeira instalação: força C:\Program Files (x86) mesmo no Windows 64-bit.
    ;
    ; Problema: electron-builder compila o instalador em modo NSIS x64 (SetRegView 64),
    ; o que faz $PROGRAMFILES32 resolver para C:\Program Files em alguns ambientes.
    ;
    ; Solução: lê "ProgramFilesDir (x86)" da visão 64-bit do registro, que SEMPRE
    ; aponta para C:\Program Files (x86) no Windows 64-bit (campo exclusivo do x64).
    ; No Windows 32-bit esse campo não existe, então cai no $PROGRAMFILES normal.
    ReadRegStr $2 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion" "ProgramFilesDir (x86)"
    ${If} $2 != ""
      ; Windows 64-bit: usa C:\Program Files (x86)
      StrCpy $INSTDIR "$2\Louvor JA"
    ${Else}
      ; Windows 32-bit: campo inexistente, usa Program Files padrão
      StrCpy $INSTDIR "$PROGRAMFILES\Louvor JA"
    ${EndIf}
  ${EndIf}
!macroend

; ── Macro executada após a instalação dos arquivos ──────────────────────────
!macro customInstall
  DetailPrint "Configurando estrutura de pastas..."

  ; Cria estrutura de pastas config/
  CreateDirectory "$INSTDIR\config"
  DetailPrint "  » Pasta config/ criada"

  CreateDirectory "$INSTDIR\config\capas"
  DetailPrint "  » Pasta config/capas/ criada"

  CreateDirectory "$INSTDIR\config\fontes"
  DetailPrint "  » Pasta config/fontes/ criada"

  CreateDirectory "$INSTDIR\config\ico"

  CreateDirectory "$INSTDIR\config\imagens"
  DetailPrint "  » Pasta config/imagens/ criada"

  CreateDirectory "$INSTDIR\config\musicas"
  DetailPrint "  » Pasta config/musicas/ criada"

  CreateDirectory "$INSTDIR\config\server"

  DetailPrint "Verificando banco de dados do usuário..."

  ; Se o usuário tiver um database.db customizado (baixado via app ou copiado
  ; manualmente) em AppData, preserva — não sobrescreve com o bundled.
  StrCpy $0 "$APPDATA\LouvorJA\config\database.db"
  ${If} ${FileExists} "$0"
    DetailPrint "  » Banco personalizado detectado — preservando versão do usuário"
    Rename "$INSTDIR\config\database.db" "$INSTDIR\config\database.db.bak"
    DetailPrint "  » Backup do banco padrão criado (database.db.bak)"
  ${Else}
    DetailPrint "  » Usando banco padrão da instalação"
  ${EndIf}

  DetailPrint "Configurando permissões de acesso..."

  ; Concede permissão total de leitura/escrita a todos os usuários
  ; (necessário para o app baixar arquivos sem precisar de admin)
  nsExec::ExecToLog 'icacls "$INSTDIR\config" /grant:r "*S-1-1-0":(OI)(CI)F /T /Q'
  DetailPrint "  » Permissões de escrita concedidas para todos os usuários"

  DetailPrint "Instalação concluída com sucesso!"
  DetailPrint "LouvorJA está pronto para uso em $INSTDIR"
!macroend

; ── Macro executada durante a desinstalação ─────────────────────────────────
!macro customUnInstall
  DetailPrint "Removendo atalhos e entradas do registro..."
  ; A pasta config/ é preservada para manter os dados do usuário (músicas, capas, banco).
  ; Para remover completamente, apague manualmente: $INSTDIR\config
  DetailPrint "  » Dados do usuário preservados em $INSTDIR\config"
  DetailPrint "Desinstalação concluída."
!macroend
