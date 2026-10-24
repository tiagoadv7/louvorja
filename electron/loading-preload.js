// Preload minúsculo só pra janela de loading avisar o HTML quando a janela
// de verdade apareceu na tela (ver electron/main.js#createLoadingWindow e
// public/loading.html) -- sem isso, as animações CSS (delay/keyframes)
// começavam a contar a partir do carregamento da página (BrowserWindow
// criada com show:false), não de quando o usuário realmente via a janela.
// Num boot mais lento (antivírus escaneando o .exe recém-instalado, disco
// ocupado, etc.), esse intervalo escondido podia ser grande o bastante pra
// a entrada animada (cascata de letras, barra crescendo) já ter acabado de
// rodar por baixo dos panos antes da janela aparecer -- o usuário só via o
// resultado final parado, achando que não tinha animação nenhuma.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('loadingBridge', {
  onShown: (cb) => ipcRenderer.on('loading-window-shown', cb),
});
