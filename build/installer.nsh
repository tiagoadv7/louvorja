!include "nsDialogs.nsh"
!include "WinMessages.nsh"

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
Var lblTitleHwnd
Var lblFeatureHwnd
Var featureSlideIndex
Var hFontTitle
Var legacyBackupDir
Var legacyOrigDir
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

    ; Painel de cor sólida cobrindo 100% da página (título e descrição ficam
    ; sobrepostos nele) — antes ia só até 76% de altura e sobrava uma faixa
    ; abaixo com a cor padrão do sistema, criando o "degrau"/margem visível
    ; na borda esquerda e cortando texto perto do limite do label.
    ${NSD_CreateLabel} 0 0 100% 100% ""
    Pop $picFeatureHwnd
    SetCtlColors $picFeatureHwnd 0xFFFFFF 0x1B2A41

    ; Título — label própria com fonte maior/negrito (antes vinha embutido
    ; junto do painel de fundo, empurrado por "$\r$\n" manuais na mesma label
    ; da descrição, com a fonte pequena padrão do sistema).
    ${NSD_CreateLabel} 6% 30% 88% 18% ""
    Pop $lblTitleHwnd
    SetCtlColors $lblTitleHwnd 0xFFFFFF 0x1B2A41
    CreateFont $hFontTitle "Segoe UI" "20" "700"
    SendMessage $lblTitleHwnd ${WM_SETFONT} $hFontTitle 1

    ${NSD_CreateLabel} 6% 50% 88% 32% ""
    Pop $lblFeatureHwnd
    SetCtlColors $lblFeatureHwnd 0xD8DEE9 0x1B2A41

    StrCpy $featureSlideIndex 0
    Call FeatureSlidesApplySlide
    ${NSD_CreateTimer} FeatureSlidesAdvance 3500

    nsDialogs::Show
  FunctionEnd

  ; Preenche o título/descrição do slide atual ($featureSlideIndex), sem
  ; nenhum efeito — usada tanto na primeira exibição quanto (já com a cor do
  ; texto esmaecida até o fundo) no meio da troca suave entre slides.
  Function FeatureSlidesApplySlide
    ${If} $featureSlideIndex == 0
      ${NSD_SetText} $lblTitleHwnd "Músicas para projeção"
      ${NSD_SetText} $lblFeatureHwnd "Projete músicas para sua igreja, evento ou pequeno grupo.$\r$\nUtilize as músicas do programa, ou crie suas próprias músicas."
    ${Else}
      ${NSD_SetText} $lblTitleHwnd "Totalmente Grátis"
      ${NSD_SetText} $lblFeatureHwnd "A utilização do programa é totalmente grátis. Mas sinta-se a vontade para enviar uma doação para ajudar nos custos de operação."
    ${EndIf}
  FunctionEnd

  ; Troca suave entre slides: esmaece o texto atual até se confundir com o
  ; fundo (0x1B2A41), troca o conteúdo enquanto está "invisível" e esmaece de
  ; volta pra cor normal — em vez de trocar o texto de uma vez (efeito de
  ; "corte seco"). nsDialogs não tem canal alpha, então o efeito é feito
  ; interpolando a cor do texto em poucos passos fixos (pré-calculados).
  Function FeatureSlidesAdvance
    Call FeatureSlidesFadeOut

    IntOp $featureSlideIndex $featureSlideIndex + 1
    IntOp $featureSlideIndex $featureSlideIndex % 2
    Call FeatureSlidesApplySlide

    Call FeatureSlidesFadeIn
  FunctionEnd

  Function FeatureSlidesFadeOut
    SetCtlColors $lblTitleHwnd 0xC6CAD0 0x1B2A41
    SetCtlColors $lblFeatureHwnd 0xA9B1BF 0x1B2A41
    Call FeatureSlidesRepaint
    Sleep 40

    SetCtlColors $lblTitleHwnd 0x8D95A0 0x1B2A41
    SetCtlColors $lblFeatureHwnd 0x7A8495 0x1B2A41
    Call FeatureSlidesRepaint
    Sleep 40

    SetCtlColors $lblTitleHwnd 0x545F71 0x1B2A41
    SetCtlColors $lblFeatureHwnd 0x4A576B 0x1B2A41
    Call FeatureSlidesRepaint
    Sleep 40

    SetCtlColors $lblTitleHwnd 0x1B2A41 0x1B2A41
    SetCtlColors $lblFeatureHwnd 0x1B2A41 0x1B2A41
    Call FeatureSlidesRepaint
    Sleep 40
  FunctionEnd

  Function FeatureSlidesFadeIn
    SetCtlColors $lblTitleHwnd 0x545F71 0x1B2A41
    SetCtlColors $lblFeatureHwnd 0x4A576B 0x1B2A41
    Call FeatureSlidesRepaint
    Sleep 40

    SetCtlColors $lblTitleHwnd 0x8D95A0 0x1B2A41
    SetCtlColors $lblFeatureHwnd 0x7A8495 0x1B2A41
    Call FeatureSlidesRepaint
    Sleep 40

    SetCtlColors $lblTitleHwnd 0xC6CAD0 0x1B2A41
    SetCtlColors $lblFeatureHwnd 0xA9B1BF 0x1B2A41
    Call FeatureSlidesRepaint
    Sleep 40

    SetCtlColors $lblTitleHwnd 0xFFFFFF 0x1B2A41
    SetCtlColors $lblFeatureHwnd 0xD8DEE9 0x1B2A41
    Call FeatureSlidesRepaint
    Sleep 40
  FunctionEnd

  ; SetCtlColors sozinho não força o redesenho do controle — sem isso, a cor
  ; só apareceria atualizada na próxima vez que o Windows repintasse a janela
  ; por conta própria, e o fade pareceria travado em vez de gradual.
  Function FeatureSlidesRepaint
    System::Call 'user32::InvalidateRect(p $lblTitleHwnd, i 0, i 1)'
    System::Call 'user32::UpdateWindow(p $lblTitleHwnd)'
    System::Call 'user32::InvalidateRect(p $lblFeatureHwnd, i 0, i 1)'
    System::Call 'user32::UpdateWindow(p $lblFeatureHwnd)'
  FunctionEnd

  Function FeatureSlidesPageLeave
    ${NSD_KillTimer} FeatureSlidesAdvance
  FunctionEnd

  ; ── Texto da página "Instalando" (a página seguinte, MUI_PAGE_INSTFILES) ──
  ; Troca o subtítulo padrão por um que menciona a extração/destino, já que a
  ; caixa de detalhes abaixo da barra de progresso fica em branco durante a
  ; cópia em si (o electron-builder desliga o log antes de extrair o pacote,
  ; e só reativa depois — não há gancho documentado antes disso). Sobrescreve
  ; o controle diretamente (SendMessage) em vez de redefinir a LangString
  ; embutida do MUI2 — redefinir gera o warning 6030 ("set multiple times"),
  ; que o electron-builder trata como erro fatal de build.
  ; "MUI_PAGE_CUSTOMFUNCTION_SHOW" só vale pro PRÓXIMO !insertmacro MUI_PAGE_*
  ; processado — como MUI_PAGE_INSTFILES é inserida logo em seguida (ver
  ; assistedInstaller.nsh do electron-builder), o define abaixo se aplica a ela.
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW InstFilesSubtitleShow

  Function InstFilesSubtitleShow
    FindWindow $0 "#32770" "" $HWNDPARENT
    GetDlgItem $1 $0 1006
    SendMessage $1 ${WM_SETTEXT} 0 "STR:Extraindo arquivos para $INSTDIR..."
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

  ; ── Backup preventivo de $INSTDIR antes do uninstallOldVersion ────────────
  ; $INSTDIR é compartilhado com o LouvorJA Delphi legado (ver preInit acima)
  ; e, numa instalação já existente, é TAMBÉM onde o config/ gravável do
  ; próprio Electron mora — getWritableBase() em electron/ipc.js resolve pra
  ; pasta do .exe (com fallback pra userData só se essa não for gravável), ou
  ; seja, banco de dados, músicas baixadas e capas do usuário ficam aqui.
  ;
  ; O installSection.nsh do electron-builder chama "uninstallOldVersion" ANTES
  ; de extrair os novos arquivos: ele copia e executa o DESINSTALADOR JÁ
  ; GRAVADO EM DISCO (o binário da versão anterior, com a lógica que ELA tinha
  ; na época). Builds publicados antes deste ajuste (customRemoveFiles logo
  ; abaixo) não têm esse guard e fazem "RMDir /r $INSTDIR" por padrão — apaga
  ; TUDO (Delphi + config/) mesmo só "instalando uma atualização". O
  ; customRemoveFiles deste MESMO installer.nsh não ajuda nessa transição
  ; específica, porque quem roda ali é o uninstaller ANTIGO, já gravado em
  ; disco antes desta correção existir.
  ;
  ; Solução: renomeia a pasta inteira pra uma pasta-irmã ANTES desse passo.
  ; Rename de pasta no mesmo volume é só troca de metadado (instantâneo, não
  ; copia nada — não importa o tamanho da biblioteca de músicas). Com
  ; $INSTDIR fora do caminho, "uninstallOldVersion" não encontra mais o
  ; uninstaller antigo ali e desiste silenciosamente (mesmo comportamento já
  ; previsto pelo template pra quando não existe versão anterior instalada).
  ; RestoreLegacyMerge (chamada em customInstall, depois da extração) devolve
  ; tudo pro lugar, exceto o que os arquivos novos do Electron já recriaram.
  StrCpy $legacyOrigDir "$INSTDIR"
  StrCpy $legacyBackupDir "$INSTDIR.update-backup"
  ${If} ${FileExists} "$INSTDIR\*.*"
    ClearErrors
    RMDir /r "$legacyBackupDir" ; restos de uma tentativa anterior que falhou no meio
    ClearErrors
    Rename "$INSTDIR" "$legacyBackupDir"
    ${If} ${Errors}
      ; Não foi possível renomear (raro — ex.: arquivo em uso). Segue sem
      ; backup: melhor arriscar o comportamento padrão do que abortar a
      ; instalação por causa de uma proteção extra.
      ClearErrors
      StrCpy $legacyBackupDir ""
    ${EndIf}
  ${Else}
    StrCpy $legacyBackupDir ""
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

  ; ── Restaura o backup preventivo (ver customInit) ─────────────────────────
  ; $legacyBackupDir só é != "" quando customInit encontrou algo em $INSTDIR e
  ; conseguiu tirá-lo do caminho antes da extração — inclui tanto os arquivos
  ; do LouvorJA Delphi quanto o config/ gravável de uma instalação Electron
  ; anterior (banco de dados, músicas baixadas, capas, etc.).
  ${If} $legacyBackupDir != ""
    DetailPrint "Restaurando LouvorJA Delphi e configurações existentes..."

    ; Só faz sentido quando o destino final não mudou (usuário não escolheu
    ; outra pasta na página de instalação): o banco recém-extraído
    ; (bundled/config/database.db, via "extraFiles" do package.json) é só um
    ; padrão de fábrica — se já existia um banco de verdade no backup, ele tem
    ; prioridade; removendo o novo primeiro, o merge abaixo ("só move se o
    ; destino ainda não existe") deixa o antigo assumir o lugar dele.
    ${If} $INSTDIR == $legacyOrigDir
    ${AndIf} ${FileExists} "$legacyBackupDir\config\database.db"
    ${AndIf} ${FileExists} "$INSTDIR\config\database.db"
      Delete "$INSTDIR\config\database.db"
    ${EndIf}

    Push ""
    Call RestoreLegacyMerge

    RMDir /r "$legacyBackupDir"
    DetailPrint "  » LouvorJA Delphi e configurações existentes restaurados"
  ${EndIf}

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

  ; Fallback só pro caso do RestoreLegacyMerge acima não ter tido nada pra
  ; restaurar (ex.: pasta compartilhada não existia ainda, ou o usuário mudou
  ; o caminho de instalação) — nesse caso ainda vale checar se existe um banco
  ; de verdade em %APPDATA% (getWritableBase() cai lá quando $INSTDIR/config
  ; não é gravável, ver electron/ipc.js#getWritableBase) e, se existir,
  ; afastar o padrão recém-extraído pra não competir com ele. Quando
  ; $legacyBackupDir já restaurou algo, o banco em $INSTDIR\config\database.db
  ; já É o de verdade — mexer aqui de novo só arriscaria apagá-lo por engano.
  ${If} $legacyBackupDir == ""
    StrCpy $0 "$APPDATA\LouvorJA\config\database.db"
    ${If} ${FileExists} "$0"
      DetailPrint "  » Banco personalizado detectado em AppData — preservando versão do usuário"
      Rename "$INSTDIR\config\database.db" "$INSTDIR\config\database.db.bak"
      DetailPrint "  » Backup do banco padrão criado (database.db.bak)"
    ${Else}
      DetailPrint "  » Usando banco padrão da instalação"
    ${EndIf}
  ${Else}
    DetailPrint "  » Banco do usuário já restaurado da pasta compartilhada"
  ${EndIf}

  DetailPrint "Configurando permissões de acesso..."

  ; Concede permissão total de leitura/escrita a todos os usuários
  ; (necessário para o app baixar arquivos sem precisar de admin)
  nsExec::ExecToLog 'icacls "$INSTDIR\config" /grant:r "*S-1-1-0":(OI)(CI)F /T /Q'
  DetailPrint "  » Permissões de escrita concedidas para todos os usuários"

  DetailPrint "Instalação concluída com sucesso!"
  DetailPrint "LouvorJA está pronto para uso em $INSTDIR"

  ; Recursiva: move de volta tudo que está em "$legacyBackupDir<subcaminho>"
  ; pra dentro de "$legacyOrigDir<subcaminho>", mas só quando o destino ainda
  ; não existe — assim os arquivos que o Electron acabou de extrair (exe,
  ; dlls, locales/, resources/, capas padrão) nunca são sobrescritos por uma
  ; versão antiga; qualquer coisa exclusiva do backup (LouvorJA Delphi,
  ; músicas/capas/imagens baixadas pelo usuário, banco de dados antigo — já
  ; afastado antes de chamar isso) volta pro lugar. Mesmo estilo das funções
  ; un.atomicRMDir/un.restoreFiles do próprio uninstaller.nsh do electron-builder.
  Function RestoreLegacyMerge
    Exch $R0
    Push $R1
    Push $R2

    FindFirst $R1 $R2 "$legacyBackupDir$R0\*.*"
    loop:
      StrCmp $R2 "" break
      StrCmp $R2 "." continue
      StrCmp $R2 ".." continue

      IfFileExists "$legacyBackupDir$R0\$R2\*.*" isDir isFile

      isDir:
        CreateDirectory "$legacyOrigDir$R0\$R2"
        Push "$R0\$R2"
        Call RestoreLegacyMerge
        Goto continue

      isFile:
        IfFileExists "$legacyOrigDir$R0\$R2" continue 0
        Rename "$legacyBackupDir$R0\$R2" "$legacyOrigDir$R0\$R2"

      continue:
        FindNext $R1 $R2
        Goto loop

    break:
      FindClose $R1

    Pop $R2
    Pop $R1
    Pop $R0
  FunctionEnd
!macroend

; ── Macro executada durante a desinstalação ─────────────────────────────────
!macro customUnInstall
  DetailPrint "Removendo atalhos e entradas do registro..."
  ; A pasta config/ é preservada para manter os dados do usuário (músicas, capas, banco).
  ; Para remover completamente, apague manualmente: $INSTDIR\config
  ; (a remoção de fato dos arquivos do programa é feita por "customRemoveFiles"
  ; logo abaixo — sem ele, essa preservação aqui seria só um DetailPrint sem
  ; efeito real, ver comentário dessa macro).
  DetailPrint "  » Dados do usuário preservados em $INSTDIR\config"
  DetailPrint "Desinstalação concluída."
!macroend

; ── Substitui a remoção padrão de arquivos da desinstalação ─────────────────
; O template uninstaller.nsh do electron-builder (node_modules/app-builder-lib/
; templates/nsis/uninstaller.nsh), quando "customRemoveFiles" não existe, roda
; "RMDir /r $INSTDIR" — apaga TUDO dentro da pasta de instalação, recursivo.
; Isso é um problema real aqui: $INSTDIR é a MESMA pasta onde o LouvorJA
; Delphi (legado) está instalado — ver preInit/customInit acima, que apontam
; de propósito pra essa pasta compartilhada — e ela já tem os arquivos de
; áudio/imagens do Delphi, além da nossa própria config/ (músicas, capas,
; banco). Desinstalar o Louvor JA (Electron) apagaria o Delphi inteiro junto.
;
; Em vez disso, apaga só os arquivos/pastas que o ELETRON de fato instala
; (mesma lista de "release/win-unpacked/" — conferida numa build real deste
; projeto), preservando qualquer outro arquivo na pasta (Delphi + config/).
!macro customRemoveFiles
  DetailPrint "Removendo arquivos do Louvor JA (mantendo config/ e arquivos do LouvorJA Delphi)..."

  Delete "$INSTDIR\LICENSE.electron.txt"
  Delete "$INSTDIR\LICENSES.chromium.html"
  Delete "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  Delete "$INSTDIR\chrome_100_percent.pak"
  Delete "$INSTDIR\chrome_200_percent.pak"
  Delete "$INSTDIR\d3dcompiler_47.dll"
  Delete "$INSTDIR\dxcompiler.dll"
  Delete "$INSTDIR\dxil.dll"
  Delete "$INSTDIR\ffmpeg.dll"
  Delete "$INSTDIR\icudtl.dat"
  Delete "$INSTDIR\libEGL.dll"
  Delete "$INSTDIR\libGLESv2.dll"
  Delete "$INSTDIR\resources.pak"
  Delete "$INSTDIR\snapshot_blob.bin"
  Delete "$INSTDIR\v8_context_snapshot.bin"
  Delete "$INSTDIR\vk_swiftshader.dll"
  Delete "$INSTDIR\vk_swiftshader_icd.json"
  Delete "$INSTDIR\vulkan-1.dll"
  Delete "$INSTDIR\uninstallerIcon.ico"
  Delete "$INSTDIR\${UNINSTALL_FILENAME}"

  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\resources"

  ; Não força remover $INSTDIR — só funciona (silenciosamente) se ele tiver
  ; ficado vazio (sem Delphi/config/ ali); do contrário permanece intacto.
  RMDir "$INSTDIR"

  DetailPrint "  » Arquivos do Louvor JA removidos."
!macroend
