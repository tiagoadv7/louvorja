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
    ; Primeira instalação: padrão em Program Files (x86)
    StrCpy $INSTDIR "$PROGRAMFILES32\Louvor JA"
  ${EndIf}
!macroend

; ── Macro executada após a instalação dos arquivos ──────────────────────────
; Cria subpastas de config e concede permissão de escrita para todos os usuários
!macro customInstall
  ; Cria estrutura de pastas config/
  CreateDirectory "$INSTDIR\config"
  CreateDirectory "$INSTDIR\config\musicas"
  CreateDirectory "$INSTDIR\config\imagens"
  CreateDirectory "$INSTDIR\config\capas"
  CreateDirectory "$INSTDIR\config\fontes"
  CreateDirectory "$INSTDIR\config\ico"
  ; Concede permissão total de leitura/escrita a todos os usuários
  ; (necessário para o app baixar arquivos sem precisar de admin)
  nsExec::ExecToLog 'icacls "$INSTDIR\config" /grant:r "*S-1-1-0":(OI)(CI)F /T /Q'
!macroend

; ── Macro executada durante a desinstalação ─────────────────────────────────
!macro customUnInstall
  ; Remove a pasta config/ apenas se não houver arquivos do usuário
  ; (opcional — comentar as linhas abaixo para preservar os downloads)
  ; RMDir /r "$INSTDIR\config"
!macroend
