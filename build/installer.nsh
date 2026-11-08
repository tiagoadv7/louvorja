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
; Instalações encontradas nos discos (ver LjaScanDrives / página "Onde instalar")
Var ljaN
Var ljaD1
Var ljaD2
Var ljaD3
Var ljaD4
Var ljaD5
Var ljaD6
Var ljaD7
Var ljaD8
Var ljaR1
Var ljaR2
Var ljaR3
Var ljaR4
Var ljaR5
Var ljaR6
Var ljaR7
Var ljaR8
Var ljaROther
Var ljaPrevDir   ; pasta da instalação anterior do Louvor JA (registro)
Var ljaFinalDir  ; pasta escolhida, antes do ajuste automático do electron-builder
Var ljaKeepDir   ; 1 = a pasta escolhida já tem o Louvor JA: instala nela mesma
Var bkADir       ; backup da pasta de destino
Var bkAOrig
Var bkBDir       ; backup da instalação anterior, quando for outra pasta
Var bkBOrig
!endif

; Recursiva: move de volta tudo que está em "$legacyBackupDir<subcaminho>" pra
; dentro de "$legacyOrigDir<subcaminho>", mas só quando o destino ainda não
; existe — assim os arquivos que o Electron acabou de extrair (exe, dlls,
; locales/, resources/, capas padrão) nunca são sobrescritos por uma versão
; antiga; qualquer coisa exclusiva do backup (LouvorJA Delphi, músicas/capas/
; imagens baixadas pelo usuário, banco de dados antigo) volta pro lugar. Mesmo
; estilo das funções un.atomicRMDir/un.restoreFiles do uninstaller.nsh do
; electron-builder.
;
; Fica em nível de topo do arquivo (fora de qualquer macro) de propósito: uma
; Function não pode ser declarada NO MEIO de um Section (customInstall é
; inserida dentro da Section de instalação do próprio electron-builder) — só
; funciona declarada fora, sendo CHAMADA de dentro da Section via Call. Como
; só usa instruções nativas do NSIS (sem ${If}/LogicLib), processar isso já
; aqui em cima — antes do "!include MUI2.nsh" no topo do script gerado — é seguro.
!ifndef BUILD_UNINSTALLER
; Quando o arquivo do backup já existe no destino (recém-extraído):
;  - em \config\...  → vale o do BACKUP (dados do Delphi e do usuário: banco,
;    capas, músicas, imagens) — o recém-extraído é só o padrão de fábrica;
;  - em \db, \locales, \resources ou um arquivo do próprio Electron na raiz →
;    vale o NOVO (é o programa/catálogo atualizado); a cópia antiga é descartada;
;  - qualquer outro caso → nada é apagado: a cópia antiga fica no backup.
; Arquivos do LouvorJA Delphi (LouvorJA.exe, midas.dll, libeay32.dll,
; ssleay32.dll, unins000.*) não têm nome igual a nenhum arquivo do Electron,
; então sempre voltam para o lugar.
Function RestoreLegacyMerge
  Exch $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4

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
      IfFileExists "$legacyOrigDir$R0\$R2" collision 0
      Rename "$legacyBackupDir$R0\$R2" "$legacyOrigDir$R0\$R2"
      Goto continue

    collision:
      ; \config ou \config\... → o do backup substitui o recém-extraído
      StrCpy $R3 "$R0" 7
      StrCmp $R3 "\config" 0 notConfig
      StrCpy $R4 "$R0" 1 7
      StrCmp $R4 "" keepOld
      StrCmp $R4 "\" keepOld notConfig
    keepOld:
      Delete "$legacyOrigDir$R0\$R2"
      Rename "$legacyBackupDir$R0\$R2" "$legacyOrigDir$R0\$R2"
      Goto continue

    notConfig:
      Push "$R0"
      Push "$R2"
      Call LjaIsElectronPath
      Pop $R3
      StrCmp $R3 "1" 0 continue
      Delete "$legacyBackupDir$R0\$R2"

    continue:
      FindNext $R1 $R2
      Goto loop

  break:
    FindClose $R1

  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
FunctionEnd

!endif

; ── Imagem no topo das páginas (Diretório, Modo de instalação, Progresso) ───
; BUILD_RESOURCES_DIR aponta para a pasta "public" (directories.buildResources)
!macro customHeader
  !define MUI_HEADERIMAGE
  !define MUI_HEADERIMAGE_BITMAP "${BUILD_RESOURCES_DIR}\installer-header.bmp"
!macroend

; Opções da página "Onde instalar" (usadas em LjaWherePageCreate/Leave)
  !macro LjaWhereRadio IDX
    ${If} $ljaN >= ${IDX}
      StrCpy $1 $ljaD${IDX}
      StrCpy $2 ""
      ${If} ${FileExists} "$1\LouvorJA.exe"
        StrCpy $2 "LouvorJA Delphi"
      ${EndIf}
      ${If} ${FileExists} "$1\${APP_EXECUTABLE_FILENAME}"
        ${If} $2 != ""
          StrCpy $2 "$2 + Louvor JA"
        ${Else}
          StrCpy $2 "Louvor JA"
        ${EndIf}
      ${EndIf}
      IntOp $3 $3 + 15
      ${NSD_CreateRadioButton} 4% $3u 92% 13u "$1   ($2)"
      Pop $ljaR${IDX}
      ${If} $1 == $INSTDIR
        ${NSD_Check} $ljaR${IDX}
        StrCpy $4 "1"
      ${EndIf}
    ${EndIf}
  !macroend

  !macro LjaWherePick IDX
    ${If} $ljaN >= ${IDX}
      ${NSD_GetState} $ljaR${IDX} $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $INSTDIR $ljaD${IDX}
      ${EndIf}
    ${EndIf}
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

  ; Funções do Louvor JA que usam defines do electron-builder (APP_EXECUTABLE_FILENAME...)
  ; e o LogicLib: ficam nesta macro, processada depois do common.nsh/MUI2.
; Entrada: pilha = subpasta (ex.: "\db\x"), nome do arquivo. Saída: "1" se o
; arquivo pertence ao Louvor JA (Electron) — pode ser trocado pela versão nova.
Function LjaIsElectronPath
  Exch $R6 ; nome do arquivo
  Exch
  Exch $R5 ; subpasta
  Push $R7
  Push $R8

  StrCpy $R8 "0"
  ; Pastas do Electron: \db, \locales, \resources (e o que houver dentro)
  StrCpy $R7 "$R5" 3
  StrCmp $R7 "\db" 0 +4
    StrCpy $R7 "$R5" 1 3
    StrCmp $R7 "" yes
    StrCmp $R7 "\" yes
  StrCpy $R7 "$R5" 8
  StrCmp $R7 "\locales" 0 +4
    StrCpy $R7 "$R5" 1 8
    StrCmp $R7 "" yes
    StrCmp $R7 "\" yes
  StrCpy $R7 "$R5" 10
  StrCmp $R7 "\resources" 0 +4
    StrCpy $R7 "$R5" 1 10
    StrCmp $R7 "" yes
    StrCmp $R7 "\" yes
  ; Arquivos do Electron na raiz
  StrCmp $R5 "" 0 done
  StrCmp $R6 "${APP_EXECUTABLE_FILENAME}" yes
  StrCmp $R6 "${UNINSTALL_FILENAME}" yes
  StrCmp $R6 "LICENSE.electron.txt" yes
  StrCmp $R6 "LICENSES.chromium.html" yes
  StrCmp $R6 "chrome_100_percent.pak" yes
  StrCmp $R6 "chrome_200_percent.pak" yes
  StrCmp $R6 "d3dcompiler_47.dll" yes
  StrCmp $R6 "dxcompiler.dll" yes
  StrCmp $R6 "dxil.dll" yes
  StrCmp $R6 "ffmpeg.dll" yes
  StrCmp $R6 "icudtl.dat" yes
  StrCmp $R6 "libEGL.dll" yes
  StrCmp $R6 "libGLESv2.dll" yes
  StrCmp $R6 "resources.pak" yes
  StrCmp $R6 "snapshot_blob.bin" yes
  StrCmp $R6 "v8_context_snapshot.bin" yes
  StrCmp $R6 "vk_swiftshader.dll" yes
  StrCmp $R6 "vk_swiftshader_icd.json" yes
  StrCmp $R6 "vulkan-1.dll" yes
  StrCmp $R6 "uninstallerIcon.ico" yes done
  yes:
    StrCpy $R8 "1"
  done:
  StrCpy $R6 $R8
  Pop $R8
  Pop $R7
  Pop $R5
  Exch $R6
FunctionEnd

; Remove só as subpastas que ficaram VAZIAS no backup (RMDir sem /r nunca
; apaga pasta com arquivo dentro). Entrada: pilha = pasta.
Function LjaPruneEmpty
  Exch $R0
  Push $R1
  Push $R2
  FindFirst $R1 $R2 "$R0\*.*"
  ploop:
    StrCmp $R2 "" pdone
    StrCmp $R2 "." pnext
    StrCmp $R2 ".." pnext
    IfFileExists "$R0\$R2\*.*" 0 pnext
      Push "$R0\$R2"
      Call LjaPruneEmpty
      RMDir "$R0\$R2"
    pnext:
    FindNext $R1 $R2
    Goto ploop
  pdone:
  FindClose $R1
  Pop $R2
  Pop $R1
  Pop $R0
FunctionEnd

; Tira a pasta do caminho (renomeia para "<pasta>.update-backup") antes de
; instalar — ver comentário em customInit sobre o desinstalador antigo.
; Entrada: pilha = pasta. Saída: caminho do backup, "" (nada a guardar),
; "BUSY" (já existem dois backups antigos) ou "ERR" (arquivo em uso).
Function LjaBackupDir
  Exch $R0
  Push $R1
  StrCpy $R1 ""
  IfFileExists "$R0\*.*" 0 bdone
  StrCpy $R1 "$R0.update-backup"
  IfFileExists "$R1\*.*" 0 brename
    IfFileExists "$R0.update-backup-old\*.*" 0 +3
      StrCpy $R1 "BUSY"
      Goto bdone
    Rename "$R1" "$R0.update-backup-old"
  brename:
  ClearErrors
  Rename "$R0" "$R1"
  IfErrors 0 bdone
    ClearErrors
    StrCpy $R1 "ERR"
  bdone:
  StrCpy $R0 $R1
  Pop $R1
  Exch $R0
FunctionEnd

; Devolve um backup para o lugar (merge) e limpa o que sobrar vazio.
; Usa $legacyBackupDir/$legacyOrigDir.
Function LjaRestoreBackup
  CreateDirectory "$legacyOrigDir"
  Push ""
  Call RestoreLegacyMerge
  Push "$legacyBackupDir"
  Call LjaPruneEmpty
  ClearErrors
  RMDir "$legacyBackupDir"
  ClearErrors
  ${If} ${FileExists} "$legacyBackupDir\*.*"
    DetailPrint "  » Alguns arquivos antigos foram mantidos em $legacyBackupDir"
  ${Else}
    DetailPrint "  » Arquivos de $legacyOrigDir restaurados (LouvorJA Delphi e dados preservados)"
  ${EndIf}
FunctionEnd

; Procura o Louvor JA (Delphi: LouvorJA.exe / novo: "Louvor JA.exe") em todos
; os discos (fixos, removíveis e de rede — sem CD/DVD, que travaria pedindo disco).
Function LjaAddIfInstalled
  Exch $R0
  Push $R1
  IfFileExists "$R0\LouvorJA.exe" found 0
  IfFileExists "$R0\${APP_EXECUTABLE_FILENAME}" found adone
  found:
    ; Sem repetir o mesmo caminho
    StrCmp $R0 $ljaD1 adone
    StrCmp $R0 $ljaD2 adone
    StrCmp $R0 $ljaD3 adone
    StrCmp $R0 $ljaD4 adone
    StrCmp $R0 $ljaD5 adone
    StrCmp $R0 $ljaD6 adone
    StrCmp $R0 $ljaD7 adone
    StrCmp $R0 $ljaD8 adone
    IntCmp $ljaN 8 adone 0 adone
    IntOp $ljaN $ljaN + 1
    StrCmp $ljaN 1 0 +2
      StrCpy $ljaD1 $R0
    StrCmp $ljaN 2 0 +2
      StrCpy $ljaD2 $R0
    StrCmp $ljaN 3 0 +2
      StrCpy $ljaD3 $R0
    StrCmp $ljaN 4 0 +2
      StrCpy $ljaD4 $R0
    StrCmp $ljaN 5 0 +2
      StrCpy $ljaD5 $R0
    StrCmp $ljaN 6 0 +2
      StrCpy $ljaD6 $R0
    StrCmp $ljaN 7 0 +2
      StrCpy $ljaD7 $R0
    StrCmp $ljaN 8 0 +2
      StrCpy $ljaD8 $R0
  adone:
  Pop $R1
  Pop $R0
FunctionEnd

Function LjaScanDrives
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5
  Push $9
  StrCpy $ljaN 0
  ; Sem a caixa "não há disco na unidade" do Windows durante a busca
  System::Call 'kernel32::SetErrorMode(i 0x8001) i .r9'
  ; A instalação já registrada primeiro
  StrCmp $ljaPrevDir "" +3
    Push $ljaPrevDir
    Call LjaAddIfInstalled
  System::Call 'kernel32::GetLogicalDrives() i .r0'
  StrCpy $1 0
  sloop:
    IntCmp $1 26 sdone
    IntOp $2 1 << $1
    IntOp $2 $0 & $2
    IntCmp $2 0 snext
    IntOp $3 $1 + 65
    IntFmt $4 "%c" $3
    System::Call 'kernel32::GetDriveTypeW(w "$4:\") i .r5'
    IntCmp $5 2 scheck
    IntCmp $5 3 scheck
    IntCmp $5 4 scheck snext snext
    scheck:
      Push "$4:\Program Files (x86)\Louvor JA"
      Call LjaAddIfInstalled
      Push "$4:\Program Files\Louvor JA"
      Call LjaAddIfInstalled
      Push "$4:\Program Files (x86)\LouvorJA"
      Call LjaAddIfInstalled
      Push "$4:\Program Files\LouvorJA"
      Call LjaAddIfInstalled
      Push "$4:\Louvor JA"
      Call LjaAddIfInstalled
      Push "$4:\LouvorJA"
      Call LjaAddIfInstalled
    snext:
    IntOp $1 $1 + 1
    Goto sloop
  sdone:
  System::Call 'kernel32::SetErrorMode(i r9)'
  Pop $9
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

  ; ── Página "Onde instalar": instalações encontradas nos discos ────────────
  ; Lista cada pasta com o Louvor JA (Delphi e/ou novo) em C:, D:, E:, B:...
  ; e deixa escolher em qual instalar — ou "Outro local", que segue para a
  ; tela de pasta normal. Sem nada encontrado, a página nem aparece.
  Page custom LjaWherePageCreate LjaWherePageLeave


  Function LjaWherePageCreate
    ; Atualização automática (sem perguntas) não mostra esta página
    ${If} ${isUpdated}
      Abort
    ${EndIf}
    Call LjaScanDrives
    ${If} $ljaN == 0
      Abort
    ${EndIf}

    !insertmacro MUI_HEADER_TEXT "Onde instalar" "O Louvor JA já está neste computador"

    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 24u "Encontramos o Louvor JA nas pastas abaixo. Escolha onde instalar esta versão.$\r$\nOs arquivos do LouvorJA Delphi e as suas músicas, capas e banco de dados são mantidos."
    Pop $0

    StrCpy $3 14   ; posição vertical (u) da próxima opção
    StrCpy $4 "0"  ; alguma opção já marcada?
    !insertmacro LjaWhereRadio 1
    !insertmacro LjaWhereRadio 2
    !insertmacro LjaWhereRadio 3
    !insertmacro LjaWhereRadio 4
    !insertmacro LjaWhereRadio 5
    !insertmacro LjaWhereRadio 6
    !insertmacro LjaWhereRadio 7
    !insertmacro LjaWhereRadio 8

    IntOp $3 $3 + 19
    ${NSD_CreateRadioButton} 4% $3u 92% 13u "Outro local (escolher na próxima tela)"
    Pop $ljaROther

    ; Nada coincidiu com a pasta padrão: marca a primeira encontrada
    ${If} $4 == "0"
      ${NSD_Check} $ljaR1
    ${EndIf}

    nsDialogs::Show
  FunctionEnd

  Function LjaWherePageLeave
    !insertmacro LjaWherePick 1
    !insertmacro LjaWherePick 2
    !insertmacro LjaWherePick 3
    !insertmacro LjaWherePick 4
    !insertmacro LjaWherePick 5
    !insertmacro LjaWherePick 6
    !insertmacro LjaWherePick 7
    !insertmacro LjaWherePick 8
  FunctionEnd
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
    Call LjaDoBackups
  FunctionEnd

  ; ── Backup das pastas antes de instalar ─────────────────────────────────
  ; A pasta de destino e a da instalação anterior (se for outra) saem do caminho
  ; (rename para "<pasta>.update-backup", instantâneo) antes do
  ; "uninstallOldVersion": o desinstalador ANTIGO gravado em disco é quem roda
  ; ali, e versões antigas faziam "RMDir /r" na pasta inteira — LouvorJA Delphi,
  ; músicas, capas e banco junto. Depois da extração, customInstall devolve tudo
  ; (LjaRestoreBackup). Nada do Delphi é apagado em nenhum momento.
  Function LjaDoBackups
    ${If} $bkADir != ""
    ${OrIf} $bkBDir != ""
      Return ; já feito (voltou de página)
    ${EndIf}
    ; Pasta que já tem o Louvor JA (Delphi ou novo): instala nela mesma — sem
    ; o ajuste automático do electron-builder, que acrescentaria "\Louvor JA"
    ; a uma pasta "D:\LouvorJA" e instalaria numa subpasta
    StrCpy $ljaKeepDir 0
    ${If} ${FileExists} "$INSTDIR\LouvorJA.exe"
    ${OrIf} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
      StrCpy $ljaKeepDir 1
    ${Else}
      ${StrContains} $0 "${APP_FILENAME}" $INSTDIR
      ${If} $0 == ""
        StrCpy $INSTDIR "$INSTDIR\${APP_FILENAME}"
      ${EndIf}
    ${EndIf}
    StrCpy $ljaFinalDir $INSTDIR

    ; A) pasta de destino
    Push $INSTDIR
    Call LjaBackupDir
    Pop $0
    ${If} $0 == "BUSY"
      MessageBox MB_OK|MB_ICONSTOP "Existem cópias de segurança de uma atualização anterior em:$\r$\n$INSTDIR.update-backup$\r$\n$INSTDIR.update-backup-old$\r$\n$\r$\nNada foi apagado. Verifique essas pastas (músicas e capas podem estar nelas) e tente de novo."
      Abort
    ${ElseIf} $0 == "ERR"
      MessageBox MB_OK|MB_ICONSTOP "Não foi possível preparar a instalação em:$\r$\n$INSTDIR$\r$\n$\r$\nAlgum arquivo está em uso. Feche o Louvor JA e o LouvorJA Delphi (e qualquer programa usando essa pasta) e tente de novo. Nada foi apagado."
      Abort
    ${EndIf}
    StrCpy $bkADir $0
    StrCpy $bkAOrig $INSTDIR

    ; B) instalação anterior do Louvor JA em OUTRA pasta (outro disco, por ex.)
    ${If} $ljaPrevDir != ""
    ${AndIf} $ljaPrevDir != $INSTDIR
    ${AndIf} ${FileExists} "$ljaPrevDir\*.*"
      Push $ljaPrevDir
      Call LjaBackupDir
      Pop $0
      ${If} $0 == "BUSY"
      ${OrIf} $0 == "ERR"
        ; Desfaz o backup A antes de parar — nada fica fora do lugar
        ${If} $bkADir != ""
          Rename "$bkADir" "$bkAOrig"
          StrCpy $bkADir ""
        ${EndIf}
        MessageBox MB_OK|MB_ICONSTOP "Não foi possível preparar a pasta da instalação anterior:$\r$\n$ljaPrevDir$\r$\n$\r$\nFeche o Louvor JA e o LouvorJA Delphi e tente de novo. Nada foi apagado."
        Abort
      ${EndIf}
      StrCpy $bkBDir $0
      StrCpy $bkBOrig $ljaPrevDir
    ${EndIf}
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
    ${If} $ljaKeepDir == 1
    ${AndIf} $ljaFinalDir != ""
      StrCpy $INSTDIR $ljaFinalDir
    ${EndIf}
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

  !ifndef BUILD_UNINSTALLER
    ; Pasta da instalação anterior do Louvor JA — a mesma que o
    ; "uninstallOldVersion" do electron-builder lê para rodar o desinstalador
    ; antigo (que em versões antigas apagava a pasta inteira, Delphi junto).
    ReadRegStr $3 HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${If} $3 == ""
      ReadRegStr $3 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${EndIf}
    ${If} $3 == ""
      StrCpy $3 $0
    ${EndIf}
    ${If} $3 == ""
      StrCpy $3 $1
    ${EndIf}
    StrCpy $ljaPrevDir $3
  !endif
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

  ; ── Backup preventivo (ver LjaDoBackups) ──────────────────────────────────
  ; Com telas, o backup acontece só DEPOIS que a pasta é escolhida (saída da
  ; página de recursos, logo antes de copiar): cancelar o instalador não mexe
  ; em nada. Na atualização automática (silenciosa, sem telas) não há página,
  ; então é feito aqui mesmo.
  StrCpy $bkADir ""
  StrCpy $bkBDir ""
  StrCpy $ljaKeepDir 0
  ${If} ${Silent}
    Call LjaDoBackups
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

  ; ── Devolve os backups (ver LjaDoBackups) ─────────────────────────────────
  ; Arquivos do LouvorJA Delphi e dados do usuário (config\: banco, músicas,
  ; capas, imagens) voltam para o lugar e têm prioridade sobre os padrões de
  ; fábrica recém-extraídos. Só cópias antigas de arquivos do próprio Louvor JA
  ; (programa, db\ do catálogo) dão lugar às novas.
  ${If} $bkADir != ""
    DetailPrint "Restaurando LouvorJA Delphi e configurações existentes..."
    StrCpy $legacyBackupDir $bkADir
    StrCpy $legacyOrigDir $bkAOrig
    Call LjaRestoreBackup
  ${EndIf}
  ${If} $bkBDir != ""
    DetailPrint "Restaurando a pasta da instalação anterior ($bkBOrig)..."
    StrCpy $legacyBackupDir $bkBDir
    StrCpy $legacyOrigDir $bkBOrig
    Call LjaRestoreBackup
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

  ; db/ guarda os JSONs locais (getDbDir() em electron/ipc.js) — fica FORA de
  ; config/ por isso precisa do próprio icacls abaixo; sem essa pasta existir
  ; e sem a permissão, "db:local-save" falha com EPERM pra qualquer usuário
  ; sem privilégio de admin (a raiz de $INSTDIR em Program Files não herda a
  ; permissão de config/, só as pastas CRIADAS dentro dela).
  CreateDirectory "$INSTDIR\db"
  DetailPrint "  » Pasta db/ criada"

  DetailPrint "Verificando banco de dados do usuário..."

  ; Fallback só pro caso do RestoreLegacyMerge acima não ter tido nada pra
  ; restaurar (ex.: pasta compartilhada não existia ainda, ou o usuário mudou
  ; o caminho de instalação) — nesse caso ainda vale checar se existe um banco
  ; de verdade em %APPDATA% (getWritableBase() cai lá quando $INSTDIR/config
  ; não é gravável, ver electron/ipc.js#getWritableBase) e, se existir,
  ; afastar o padrão recém-extraído pra não competir com ele. Quando
  ; $legacyBackupDir já restaurou algo, o banco em $INSTDIR\config\database.db
  ; já É o de verdade — mexer aqui de novo só arriscaria apagá-lo por engano.
  ${If} $bkADir == ""
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
  nsExec::ExecToLog 'icacls "$INSTDIR\db" /grant:r "*S-1-1-0":(OI)(CI)F /T /Q'
  DetailPrint "  » Permissões de escrita concedidas para todos os usuários"

  DetailPrint "Instalação concluída com sucesso!"
  DetailPrint "LouvorJA está pronto para uso em $INSTDIR"
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

; ── Desinstalador: mesma identidade visual do instalador (tarja lateral e
; texto de boas-vindas). Usado pelo electron-builder via customUnWelcomePage.
!macro customUnWelcomePage
  !define /redef MUI_UNWELCOMEFINISHPAGE_BITMAP "${BUILD_RESOURCES_DIR}\installer-sidebar.bmp"
  !define MUI_UNWELCOMEPAGE_TITLE "Desinstalar o Louvor JA"
  !define MUI_UNWELCOMEPAGE_TEXT "Este assistente vai remover o Louvor JA do seu computador."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
