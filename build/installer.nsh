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
; Página "Onde instalar" (cartões): R = bolinha, C = cartão, L = caminho, G = etiqueta
Var ljaR1
Var ljaR2
Var ljaR3
Var ljaR4
Var ljaR5
Var ljaR6
Var ljaC1
Var ljaC2
Var ljaC3
Var ljaC4
Var ljaC5
Var ljaC6
Var ljaL1
Var ljaL2
Var ljaL3
Var ljaL4
Var ljaL5
Var ljaL6
Var ljaG1
Var ljaG2
Var ljaG3
Var ljaG4
Var ljaG5
Var ljaG6
Var ljaROther
Var ljaCOther
Var ljaLOther
Var ljaGOther
Var ljaDirEdit
Var ljaDirBtn
Var ljaWhereErr
Var ljaPage
Var hFontWT
Var hFontItem
Var hFontSmall
; Erro de preparo da instalação, mostrado dentro da página (ver LjaShowInstallError)
Var ljaErr
Var ljaErrTitle
Var ljaErrText
Var lblErrBar
Var lblErrTitle
Var lblErrBody
Var lblErrHint
Var hFontErr
Var ljaPrevDir   ; pasta da instalação anterior do Louvor JA (registro)
Var ljaFinalDir  ; pasta escolhida, antes do ajuste automático do electron-builder
Var ljaKeepDir   ; 1 = a pasta escolhida já tem o Louvor JA: instala nela mesma
Var bkADir       ; backup da pasta de destino
Var bkAOrig
Var bkBDir       ; backup da instalação anterior, quando for outra pasta
Var bkBOrig
Var ljaSafeMerge ; 1 = RestoreLegacyMerge só devolve o que FALTA (nunca substitui)
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
      ; Recuperando sobra de backup antigo: nunca substitui o que já existe
      StrCmp $ljaSafeMerge "1" continue
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

; ── Página "Onde instalar": cartões no visual do app ───────────────────────
; Cores (RRGGBB) iguais às do app (tema darkblue / Centro de Download):
;   fundo 1B2A41 · cartão 243A5C · cartão marcado 1D5275 · destaque 7DD3FC
;   texto secundário 9FB7D3.
; Cada opção = cartão (fundo clicável) + bolinha + caminho + etiqueta à
; direita. Usam $3 (posição vertical, em u) e $5 (altura da linha, em u).
; Rótulo com fundo próprio (sem o WS_EX_TRANSPARENT do NSD_CreateLabel, que
; às vezes deixava o texto sem desenhar por cima do cartão/painel)
!define LJA_LABEL 'nsDialogs::CreateControl STATIC ${DEFAULT_STYLES}|${SS_NOTIFY} 0'

!macro LjaWhereCard C R L G PATH TAG
  IntOp $6 $5 - 3
  nsDialogs::CreateControl STATIC ${DEFAULT_STYLES}|${SS_NOTIFY} 0 5% $3u 90% $6u ""
  Pop ${C}
  ${NSD_OnClick} ${C} LjaWhereClick
  IntOp $7 $6 - 10
  IntOp $7 $7 / 2
  IntOp $7 $7 + $3
  ${NSD_CreateRadioButton} 7% $7u 4% 10u ""
  Pop ${R}
  ${NSD_OnClick} ${R} LjaWhereClick
  ${LJA_LABEL} 12% $7u 54% 10u "${PATH}"
  Pop ${L}
  ${NSD_AddStyle} ${L} ${SS_PATHELLIPSIS}
  SendMessage ${L} ${WM_SETFONT} $hFontItem 1
  ${NSD_OnClick} ${L} LjaWhereClick
  ${LJA_LABEL} 66% $7u 27% 10u "${TAG}"
  Pop ${G}
  ${NSD_AddStyle} ${G} ${SS_RIGHT}
  SendMessage ${G} ${WM_SETFONT} $hFontSmall 1
  ${NSD_OnClick} ${G} LjaWhereClick
  ; Cartão atrás da bolinha/textos (o fundo da página vai pro fundo no fim)
  System::Call 'user32::SetWindowPos(p ${C}, p 1, i 0, i 0, i 0, i 0, i 0x13)'
  IntOp $3 $3 + $5
!macroend

!macro LjaWhereRadio IDX
  ${If} $ljaN >= ${IDX}
    StrCpy $1 $ljaD${IDX}
    StrCpy $2 ""
    ${If} ${FileExists} "$1\LouvorJA.exe"
      StrCpy $2 "LouvorJA Delphi"
    ${EndIf}
    ${If} ${FileExists} "$1\${APP_EXECUTABLE_FILENAME}"
      ${If} $2 != ""
        StrCpy $2 "Delphi + Louvor JA"
      ${Else}
        StrCpy $2 "Louvor JA"
      ${EndIf}
    ${EndIf}
    !insertmacro LjaWhereCard $ljaC${IDX} $ljaR${IDX} $ljaL${IDX} $ljaG${IDX} "$1" "$2"
    ${If} $1 == $INSTDIR
      ${NSD_Check} $ljaR${IDX}
      StrCpy $4 "1"
    ${EndIf}
  ${EndIf}
!macroend

; Cor de um cartão conforme a bolinha dele está marcada ou não
; (SetCtlColors só aceita cores FIXAS — são lidas na compilação, uma variável
; vira preto — por isso um ramo para cada estado)
!macro LjaWhereTint C R L G
  ${NSD_GetState} ${R} $0
  ${If} $0 == ${BST_CHECKED}
    SetCtlColors ${C} 0x7DD3FC 0x1D5275
    SetCtlColors ${R} 0x7DD3FC 0x1D5275
    SetCtlColors ${L} 0x7DD3FC 0x1D5275
    SetCtlColors ${G} 0xBAE6FD 0x1D5275
  ${Else}
    SetCtlColors ${C} 0xFFFFFF 0x243A5C
    SetCtlColors ${R} 0xFFFFFF 0x243A5C
    SetCtlColors ${L} 0xFFFFFF 0x243A5C
    SetCtlColors ${G} 0x9FB7D3 0x243A5C
  ${EndIf}
!macroend

!macro LjaWhereTintIdx IDX
  ${If} $ljaN >= ${IDX}
    !insertmacro LjaWhereTint $ljaC${IDX} $ljaR${IDX} $ljaL${IDX} $ljaG${IDX}
  ${EndIf}
!macroend

; Clique em qualquer parte do cartão IDX ($0 = controle clicado) → $1 = IDX
!macro LjaWhereHit IDX
  ${If} $ljaN >= ${IDX}
    ${If} $0 == $ljaC${IDX}
    ${OrIf} $0 == $ljaR${IDX}
    ${OrIf} $0 == $ljaL${IDX}
    ${OrIf} $0 == $ljaG${IDX}
      StrCpy $1 ${IDX}
    ${EndIf}
  ${EndIf}
!macroend

!macro LjaWhereSel IDX
  ${If} $ljaN >= ${IDX}
    ${If} $1 == ${IDX}
      ${NSD_SetState} $ljaR${IDX} ${BST_CHECKED}
    ${Else}
      ${NSD_SetState} $ljaR${IDX} ${BST_UNCHECKED}
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
  Push $R2
  Push $R3
  StrCpy $R1 ""
  IfFileExists "$R0\*.*" 0 bdone
  ; Sobras de uma instalação/atualização interrompida (".update-backup" e
  ; ".update-backup-old" que ficaram para trás): antes travava aqui com
  ; "Existem cópias de segurança..." — e a atualização automática falhava
  ; em silêncio. Agora devolve para a pasta o que estiver FALTANDO nela
  ; (músicas, banco, arquivos do Delphi), sem substituir nada...
  Push "$R0.update-backup"
  Push $R0
  Call LjaSalvageBackup
  Push "$R0.update-backup-old"
  Push $R0
  Call LjaSalvageBackup
  StrCpy $R1 "$R0.update-backup"
  IfFileExists "$R1\*.*" 0 brename
    ; ...e o que sobrar (cópias repetidas) é guardado com o próximo nome
    ; livre (.update-backup-old, -old2, -old3...). Nada é apagado.
    StrCpy $R3 1
    StrCpy $R2 "$R0.update-backup-old"
    bfree:
    IfFileExists "$R2\*.*" 0 bmove
      IntOp $R3 $R3 + 1
      IntCmp $R3 30 0 0 bbusy
      StrCpy $R2 "$R0.update-backup-old$R3"
      Goto bfree
    bmove:
    ClearErrors
    Rename "$R1" "$R2"
    IfErrors 0 brename
      ClearErrors
      StrCpy $R1 "ERR"
      Goto bdone
    bbusy:
      StrCpy $R1 "BUSY"
      Goto bdone
  brename:
  ClearErrors
  Rename "$R0" "$R1"
  IfErrors 0 bdone
    ClearErrors
    StrCpy $R1 "ERR"
  bdone:
  StrCpy $R0 $R1
  Pop $R3
  Pop $R2
  Pop $R1
  Exch $R0
FunctionEnd

; Devolve de um backup antigo (pilha: backup, depois pasta no topo) só os
; arquivos que não existem na pasta e remove as subpastas que ficarem vazias.
Function LjaSalvageBackup
  Exch $R5 ; pasta de destino
  Exch
  Exch $R4 ; backup
  Push $R6
  Push $R7
  StrCpy $R6 $legacyBackupDir
  StrCpy $R7 $legacyOrigDir
  IfFileExists "$R4\*.*" 0 sdone
    DetailPrint "Recuperando arquivos de uma atualização anterior interrompida ($R4)..."
    StrCpy $legacyBackupDir $R4
    StrCpy $legacyOrigDir $R5
    StrCpy $ljaSafeMerge 1
    Push ""
    Call RestoreLegacyMerge
    StrCpy $ljaSafeMerge 0
    Push $R4
    Call LjaPruneEmpty
    ClearErrors
    RMDir $R4
    ClearErrors
  sdone:
  StrCpy $legacyBackupDir $R6
  StrCpy $legacyOrigDir $R7
  Pop $R7
  Pop $R6
  Pop $R4
  Pop $R5
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
    IntCmp $ljaN 6 adone 0 adone
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

  ; ── Página "Onde instalar" ────────────────────────────────────────────────
  ; Única tela de escolha da pasta (substitui a tela padrão do Windows — ver
  ; "allowToChangeInstallationDirectory": false no package.json), no visual
  ; do app: lista cada pasta com o Louvor JA (Delphi e/ou novo) encontrada em
  ; C:, D:, E:... como cartões, e "Outro local" com o campo da pasta e o botão
  ; Procurar logo abaixo. Sem nenhuma instalação encontrada, mostra só o campo.
  Page custom LjaWherePageCreate LjaWherePageLeave

  Function LjaWherePageCreate
    ; Atualização automática (sem perguntas) não mostra esta página
    ${If} ${isUpdated}
      Abort
    ${EndIf}
    Call LjaScanDrives

    ${If} $ljaN > 0
      !insertmacro MUI_HEADER_TEXT "Onde instalar" "O Louvor JA já está neste computador"
    ${Else}
      !insertmacro MUI_HEADER_TEXT "Onde instalar" "Escolha a pasta do Louvor JA"
    ${EndIf}

    nsDialogs::Create 1018
    Pop $ljaPage
    ${If} $ljaPage == error
      Abort
    ${EndIf}

    CreateFont $hFontWT "Segoe UI" "13" "700"
    CreateFont $hFontItem "Segoe UI" "9" "400"
    CreateFont $hFontSmall "Segoe UI" "8" "400"

    ; Fundo da página inteira (vai pro fundo da pilha no fim)
    nsDialogs::CreateControl STATIC ${DEFAULT_STYLES} 0 0 0 100% 100% ""
    Pop $9
    SetCtlColors $9 0xFFFFFF 0x1B2A41

    ${LJA_LABEL} 5% 6u 90% 14u "Onde instalar o Louvor JA?"
    Pop $0
    SetCtlColors $0 0xFFFFFF 0x1B2A41
    SendMessage $0 ${WM_SETFONT} $hFontWT 1

    ${If} $ljaN > 0
      StrCpy $1 "Encontramos o Louvor JA nas pastas abaixo. O LouvorJA Delphi e as suas músicas, capas e banco de dados são mantidos."
    ${Else}
      StrCpy $1 "Escolha a pasta de instalação. Se ela já tiver o LouvorJA Delphi, os arquivos dele e as suas músicas são mantidos."
    ${EndIf}
    ${LJA_LABEL} 5% 21u 90% 18u "$1"
    Pop $0
    SetCtlColors $0 0x9FB7D3 0x1B2A41
    SendMessage $0 ${WM_SETFONT} $hFontItem 1

    ; Altura das linhas: com muitas pastas encontradas, cartões mais baixos
    StrCpy $3 42
    StrCpy $5 20
    ${If} $ljaN > 3
      StrCpy $5 14
    ${EndIf}
    StrCpy $4 "0"  ; alguma opção já marcada?
    !insertmacro LjaWhereRadio 1
    !insertmacro LjaWhereRadio 2
    !insertmacro LjaWhereRadio 3
    !insertmacro LjaWhereRadio 4
    !insertmacro LjaWhereRadio 5
    !insertmacro LjaWhereRadio 6

    ${If} $ljaN > 0
      IntOp $3 $3 + 2
      !insertmacro LjaWhereCard $ljaCOther $ljaROther $ljaLOther $ljaGOther "Outro local" "escolher a pasta abaixo"
      ; Nada coincidiu com a pasta padrão: marca a primeira encontrada
      ${If} $4 == "0"
        ${NSD_Check} $ljaR1
      ${EndIf}
    ${EndIf}

    ; Campo da pasta + Procurar
    IntOp $3 $3 + 1
    ${NSD_CreateText} 5% $3u 68% 13u "$INSTDIR"
    Pop $ljaDirEdit
    SetCtlColors $ljaDirEdit 0xEEF4FF 0x10253E
    SendMessage $ljaDirEdit ${WM_SETFONT} $hFontItem 1
    ${NSD_CreateButton} 75% $3u 20% 13u "Procurar..."
    Pop $ljaDirBtn
    SendMessage $ljaDirBtn ${WM_SETFONT} $hFontItem 1
    ${NSD_OnClick} $ljaDirBtn LjaWhereBrowse

    ; Aviso (pasta vazia), escondido até precisar
    IntOp $3 $3 + 15
    ${LJA_LABEL} 5% $3u 90% 10u ""
    Pop $ljaWhereErr
    SetCtlColors $ljaWhereErr 0xFCA5A5 0x1B2A41
    SendMessage $ljaWhereErr ${WM_SETFONT} $hFontSmall 1

    System::Call 'user32::SetWindowPos(p $9, p 1, i 0, i 0, i 0, i 0, i 0x13)'
    Call LjaWhereRefresh
    nsDialogs::Show
  FunctionEnd

  ; Pinta os cartões (marcado em azul) e só libera o campo da pasta quando
  ; "Outro local" está marcado (ou quando não há nenhuma pasta encontrada).
  Function LjaWhereRefresh
    !insertmacro LjaWhereTintIdx 1
    !insertmacro LjaWhereTintIdx 2
    !insertmacro LjaWhereTintIdx 3
    !insertmacro LjaWhereTintIdx 4
    !insertmacro LjaWhereTintIdx 5
    !insertmacro LjaWhereTintIdx 6
    ${If} $ljaN > 0
      !insertmacro LjaWhereTint $ljaCOther $ljaROther $ljaLOther $ljaGOther
      ${NSD_GetState} $ljaROther $0
      ${If} $0 == ${BST_CHECKED}
        EnableWindow $ljaDirEdit 1
        EnableWindow $ljaDirBtn 1
      ${Else}
        EnableWindow $ljaDirEdit 0
        EnableWindow $ljaDirBtn 0
      ${EndIf}
    ${EndIf}
    ; RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN | RDW_UPDATENOW
    System::Call 'user32::RedrawWindow(p $ljaPage, p 0, p 0, i 0x185)'
  FunctionEnd

  ; Clique no cartão, na bolinha, no caminho ou na etiqueta → marca a opção
  Function LjaWhereClick
    Pop $0
    StrCpy $1 ""
    !insertmacro LjaWhereHit 1
    !insertmacro LjaWhereHit 2
    !insertmacro LjaWhereHit 3
    !insertmacro LjaWhereHit 4
    !insertmacro LjaWhereHit 5
    !insertmacro LjaWhereHit 6
    ${If} $ljaN > 0
      ${If} $0 == $ljaCOther
      ${OrIf} $0 == $ljaROther
      ${OrIf} $0 == $ljaLOther
      ${OrIf} $0 == $ljaGOther
        StrCpy $1 "O"
      ${EndIf}
    ${EndIf}
    ${If} $1 != ""
      !insertmacro LjaWhereSel 1
      !insertmacro LjaWhereSel 2
      !insertmacro LjaWhereSel 3
      !insertmacro LjaWhereSel 4
      !insertmacro LjaWhereSel 5
      !insertmacro LjaWhereSel 6
      ${If} $ljaN > 0
        ${If} $1 == "O"
          ${NSD_SetState} $ljaROther ${BST_CHECKED}
        ${Else}
          ${NSD_SetState} $ljaROther ${BST_UNCHECKED}
        ${EndIf}
      ${EndIf}
    ${EndIf}
    ${NSD_SetText} $ljaWhereErr ""
    Call LjaWhereRefresh
  FunctionEnd

  Function LjaWhereBrowse
    Pop $0
    ${NSD_GetText} $ljaDirEdit $1
    nsDialogs::SelectFolderDialog "Escolha a pasta onde instalar o Louvor JA" "$1"
    Pop $1
    ${If} $1 != error
    ${AndIf} $1 != ""
      ${NSD_SetText} $ljaDirEdit "$1"
      ${NSD_SetText} $ljaWhereErr ""
    ${EndIf}
  FunctionEnd

  Function LjaWherePageLeave
    !insertmacro LjaWherePick 1
    !insertmacro LjaWherePick 2
    !insertmacro LjaWherePick 3
    !insertmacro LjaWherePick 4
    !insertmacro LjaWherePick 5
    !insertmacro LjaWherePick 6
    StrCpy $0 ${BST_CHECKED}
    ${If} $ljaN > 0
      ${NSD_GetState} $ljaROther $0
    ${EndIf}
    ${If} $0 == ${BST_CHECKED}
      ${NSD_GetText} $ljaDirEdit $1
      ${If} $1 == ""
        ${NSD_SetText} $ljaWhereErr "Escolha a pasta onde o Louvor JA será instalado."
        Abort
      ${EndIf}
      StrCpy $INSTDIR $1
    ${EndIf}
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
  ; StrContains (usado em LjaDoBackups) só vem incluído pelo electron-builder
  ; junto da tela padrão de pasta — que está desligada (ver página "Onde instalar").
  !ifndef allowToChangeInstallationDirectory
    !include StrContains.nsh
  !endif

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

    ; Erro ao preparar a instalação (ver LjaShowInstallError): faixa vermelha
    ; à esquerda + título/texto/dica, no mesmo painel — escondidos até precisar,
    ; no lugar da caixa de mensagem padrão do Windows.
    ${LJA_LABEL} 0 0 1% 100% ""
    Pop $lblErrBar
    SetCtlColors $lblErrBar 0xEF4444 0xEF4444
    ${LJA_LABEL} 6% 8% 88% 14% ""
    Pop $lblErrTitle
    SetCtlColors $lblErrTitle 0xFCA5A5 0x1B2A41
    CreateFont $hFontErr "Segoe UI" "14" "700"
    SendMessage $lblErrTitle ${WM_SETFONT} $hFontErr 1
    ${LJA_LABEL} 6% 26% 88% 54% ""
    Pop $lblErrBody
    SetCtlColors $lblErrBody 0xE5ECF6 0x1B2A41
    CreateFont $hFontItem "Segoe UI" "10" "400"
    SendMessage $lblErrBody ${WM_SETFONT} $hFontItem 1
    ${LJA_LABEL} 6% 84% 88% 12% ""
    Pop $lblErrHint
    SetCtlColors $lblErrHint 0x7DD3FC 0x1B2A41
    SendMessage $lblErrHint ${WM_SETFONT} $hFontItem 1
    ShowWindow $lblErrBar ${SW_HIDE}
    ShowWindow $lblErrTitle ${SW_HIDE}
    ShowWindow $lblErrBody ${SW_HIDE}
    ShowWindow $lblErrHint ${SW_HIDE}

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
    ${If} $ljaErr == 1
      Call LjaShowInstallError
      Abort
    ${EndIf}
  FunctionEnd

  ; Mostra o erro dentro da própria página (no visual do instalador) em vez
  ; de uma caixa de mensagem do Windows; clicar em Instalar de novo tenta outra vez.
  Function LjaShowInstallError
    ShowWindow $lblTitleHwnd ${SW_HIDE}
    ShowWindow $lblFeatureHwnd ${SW_HIDE}
    ${NSD_SetText} $lblErrTitle "$ljaErrTitle"
    ${NSD_SetText} $lblErrBody "$ljaErrText"
    ${NSD_SetText} $lblErrHint "Depois disso, clique em Instalar para tentar de novo."
    ShowWindow $lblErrBar ${SW_SHOW}
    ShowWindow $lblErrTitle ${SW_SHOW}
    ShowWindow $lblErrBody ${SW_SHOW}
    ShowWindow $lblErrHint ${SW_SHOW}
    System::Call 'user32::RedrawWindow(p $HWNDPARENT, p 0, p 0, i 0x185)'
  FunctionEnd

  ; ── Backup das pastas antes de instalar ─────────────────────────────────
  ; A pasta de destino e a da instalação anterior (se for outra) saem do caminho
  ; (rename para "<pasta>.update-backup", instantâneo) antes do
  ; "uninstallOldVersion": o desinstalador ANTIGO gravado em disco é quem roda
  ; ali, e versões antigas faziam "RMDir /r" na pasta inteira — LouvorJA Delphi,
  ; músicas, capas e banco junto. Depois da extração, customInstall devolve tudo
  ; (LjaRestoreBackup). Nada do Delphi é apagado em nenhum momento.
  Function LjaDoBackups
    StrCpy $ljaErr 0
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
    !ifdef LJA_HARNESS_FAKE_ERR
      ; Só no instalador de teste visual (nunca no build real): simula arquivo
      ; em uso sem tocar em pasta nenhuma, pra fotografar a tela de erro.
      StrCpy $0 "ERR"
    !else
      Push $INSTDIR
      Call LjaBackupDir
      Pop $0
    !endif
    ${If} $0 == "BUSY"
      StrCpy $ljaErr 1
      StrCpy $ljaErrTitle "Há uma atualização anterior pela metade"
      StrCpy $ljaErrText "Existem cópias de segurança de uma atualização anterior em:$\r$\n$INSTDIR.update-backup$\r$\n$INSTDIR.update-backup-old$\r$\n$\r$\nNada foi apagado. Verifique essas pastas (músicas e capas podem estar nelas)."
      Return
    ${ElseIf} $0 == "ERR"
      StrCpy $ljaErr 1
      StrCpy $ljaErrTitle "Feche o Louvor JA para continuar"
      StrCpy $ljaErrText "Não foi possível preparar a instalação em:$\r$\n$INSTDIR$\r$\n$\r$\nAlgum arquivo está em uso. Feche o Louvor JA e o LouvorJA Delphi (e qualquer programa usando essa pasta). Nada foi apagado."
      Return
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
        StrCpy $ljaErr 1
        StrCpy $ljaErrTitle "Feche o Louvor JA para continuar"
        StrCpy $ljaErrText "Não foi possível preparar a pasta da instalação anterior:$\r$\n$ljaPrevDir$\r$\n$\r$\nFeche o Louvor JA e o LouvorJA Delphi. Nada foi apagado."
        Return
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
  StrCpy $ljaErr 0
  ${If} ${Silent}
    Call LjaDoBackups
    ${If} $ljaErr == 1
      MessageBox MB_OK|MB_ICONSTOP "$ljaErrTitle$\r$\n$\r$\n$ljaErrText" /SD IDOK
      Abort
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
