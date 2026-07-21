!include "nsDialogs.nsh"

; ── Título da página final ──────────────────────────────────────────────────
; Define de nível de arquivo (fora de macro): este .nsh é incluído bem no topo
; do script gerado pelo electron-builder, antes do "!include MUI2.nsh" — logo
; esse !define já existe quando MUI_PAGE_FINISH (inserido bem depois, dentro de
; assistedInstaller.nsh) checa o !ifndef padrão e usa o texto default do NSIS
; ("Completando a instalação do ${PRODUCT_NAME}"). Só no instalador — o
; desinstalador usa MUI_UNPAGE_FINISH/MUI_UNFINISHPAGE_TITLE, uma define
; diferente, então isso aqui não teria efeito nele mesmo sem o guard.
!ifndef BUILD_UNINSTALLER
!define MUI_FINISHPAGE_TITLE "Concluindo a instalação do Louvor JA"
!endif

; Só declaradas na build do instalador — no desinstalador ficariam sem uso
; e o warning "variable never set" é tratado como erro pelo electron-builder.
!ifndef BUILD_UNINSTALLER
Var picFeatureHwnd
Var lblFeatureHwnd
Var featureSlideIndex
!endif

; ── Imagem no topo das páginas (Diretório, Modo de instalação, Progresso) ───
; BUILD_RESOURCES_DIR aponta para a pasta "public" (directories.buildResources)
!macro customHeader
  !define MUI_HEADERIMAGE
  !define MUI_HEADERIMAGE_BITMAP "${BUILD_RESOURCES_DIR}\installer-header.bmp"
!macroend

; ── Página de boas-vindas com banner lateral (capas + recursos) ────────────
; O mesmo bitmap é reaproveitado automaticamente na página final (Finish),
; já que MUI_WELCOMEFINISHPAGE_BITMAP vale para as duas páginas.
; Tamanho ideal do bitmap: 164x314px, 24-bit BMP (sem canal alpha).
!macro customWelcomePage
  ; electron-builder já define MUI_WELCOMEFINISHPAGE_BITMAP por padrão (bitmap
  ; genérico do NSIS) via linha de comando — precisa de /redef para sobrescrever.
  !define /redef MUI_WELCOMEFINISHPAGE_BITMAP "${BUILD_RESOURCES_DIR}\installer-sidebar.bmp"
  !define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao instalador do Louvor JA"
  !define MUI_WELCOMEPAGE_TEXT "Este assistente vai instalar o Louvor JA no seu computador.$\r$\n$\r$\nOrganize hinários, coletâneas e apresente louvores em tela com facilidade."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; ── Página com slideshow dos recursos do app (antes de copiar os arquivos) ──
; Sem imagens/bitmaps (evita depender de artes/screenshots pra manter) — só
; um painel de cor sólida (marca do app, ver src/plugins/vuetify.js tema
; "darkblue") com o texto do recurso, trocado a cada 3.5s via timer do
; nsDialogs enquanto o usuário aguarda.
; As Functions ficam dentro da macro (em vez de soltas no arquivo) porque
; o installer.nsh é incluído bem no topo do script gerado pelo electron-builder,
; antes do "!include MUI2.nsh" — !insertmacro MUI_HEADER_TEXT só existe depois
; disso. Corpos de macro só são processados no ponto onde são inseridos
; (aqui, dentro de assistedInstaller.nsh, já com o MUI2 carregado).
!macro customPageAfterChangeDir
  Page custom FeatureSlidesPageCreate FeatureSlidesPageLeave

  Function FeatureSlidesPageCreate
    !insertmacro MUI_HEADER_TEXT "Conheça o Louvor JA" "Veja alguns recursos enquanto preparamos a instalação"

    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ; Painel de cor sólida (fundo) — o "recurso" fica só no texto, sem imagem
    ${NSD_CreateLabel} 0 0 100% 76% ""
    Pop $picFeatureHwnd
    SetCtlColors $picFeatureHwnd 0xFFFFFF 0x1B2A41

    ${NSD_CreateLabel} 5% 78% 90% 22% ""
    Pop $lblFeatureHwnd

    StrCpy $featureSlideIndex -1
    Call FeatureSlidesAdvance
    ${NSD_CreateTimer} FeatureSlidesAdvance 3500

    nsDialogs::Show
  FunctionEnd

  Function FeatureSlidesAdvance
    IntOp $featureSlideIndex $featureSlideIndex + 1
    IntOp $featureSlideIndex $featureSlideIndex % 2

    ${If} $featureSlideIndex == 0
      ${NSD_SetText} $picFeatureHwnd "$\r$\n$\r$\nMúsicas para projeção."
      ${NSD_SetText} $lblFeatureHwnd "Projete músicas para sua igreja, evento ou pequeno grupo.$\r$\nUtilize as músicas do programa, ou crie suas próprias músicas."
    ${Else}
      ${NSD_SetText} $picFeatureHwnd "$\r$\n$\r$\nTotalmente Grátis."
      ${NSD_SetText} $lblFeatureHwnd "A utilização do programa é totalmente grátis. Mas sinta-se a vontade para enviar uma doação para ajudar nos custos de operação."
    ${EndIf}
  FunctionEnd

  Function FeatureSlidesPageLeave
    ${NSD_KillTimer} FeatureSlidesAdvance
  FunctionEnd
!macroend

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

; ── Corrige o $INSTDIR de volta para (x86) após o initMultiUser ────────────
; O preInit acima já força (x86), mas o multiUser.nsh do próprio electron-builder
; roda DEPOIS (dentro do mesmo .onInit) e recalcula $INSTDIR usando
; $PROGRAMFILES64 quando não encontra uma instalação anterior na chave
; "Software\${APP_GUID}" — isso sobrescrevia o ajuste do preInit e fazia a
; primeira instalação sempre cair em "C:\Program Files" (64-bit).
; customInit roda depois desse recálculo, então corrige de novo aqui —
; só quando a pasta ainda não existe (instalação nova); uma instalação já
; detectada (upgrade ou caminho customizado) é preservada como está.
!macro customInit
  ${IfNot} ${FileExists} "$INSTDIR\*.*"
    ReadRegStr $2 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion" "ProgramFilesDir (x86)"
    ${If} $2 != ""
      StrCpy $INSTDIR "$2\Louvor JA"
    ${Else}
      StrCpy $INSTDIR "$PROGRAMFILES\Louvor JA"
    ${EndIf}
  ${EndIf}
!macroend

; ── Macro executada após a instalação dos arquivos ──────────────────────────
; O template installSection.nsh do próprio electron-builder (node_modules/
; app-builder-lib/templates/nsis/installSection.nsh) chama "SetDetailsPrint none"
; antes de extrair os arquivos e NUNCA restaura — sem ligar de volta aqui, todo
; DetailPrint abaixo (e a tela "Instalando" inteira) ficava com a caixa de
; detalhes em branco, sem mostrar nada do que estava sendo feito.
!macro customInstall
  SetDetailsPrint both

  DetailPrint "Arquivos do Louvor JA copiados com sucesso."
  DetailPrint "Configurando estrutura de pastas..."

  ; Cria estrutura de pastas config/
  CreateDirectory "$INSTDIR\config"
  DetailPrint "  » Pasta config/ criada"

  DetailPrint "Copiando capas das coletâneas para a pasta de configuração..."
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
