const { Menu, shell, app } = require('electron');

function createMenu(mainWindow, isDev) {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Nova janela de saída',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => mainWindow.webContents.send('menu:open-output'),
        },
        {
          label: 'Fechar janela de saída',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => mainWindow.webContents.send('menu:close-output'),
        },
        { type: 'separator' },
        {
          label: 'Salvar dados',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu:save-data'),
        },
        { type: 'separator' },
        {
          label: 'Sair',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Visualizar',
      submenu: [
        {
          label: 'Recarregar',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow.reload(),
        },
        {
          label: 'Tela cheia',
          accelerator: 'F11',
          click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()),
        },
        {
          label: 'Aumentar zoom',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            const zoom = mainWindow.webContents.getZoomFactor();
            mainWindow.webContents.setZoomFactor(Math.min(zoom + 0.1, 3));
          },
        },
        {
          label: 'Diminuir zoom',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            const zoom = mainWindow.webContents.getZoomFactor();
            mainWindow.webContents.setZoomFactor(Math.max(zoom - 0.1, 0.3));
          },
        },
        {
          label: 'Zoom padrão',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow.webContents.setZoomFactor(1),
        },
        { type: 'separator' },
        ...(isDev
          ? [
              {
                label: 'Ferramentas do desenvolvedor',
                accelerator: 'F12',
                click: () => mainWindow.webContents.toggleDevTools(),
              },
            ]
          : []),
      ],
    },
    {
      label: 'Janela',
      submenu: [
        {
          label: 'Minimizar',
          accelerator: 'CmdOrCtrl+M',
          click: () => mainWindow.minimize(),
        },
        {
          label: 'Maximizar / Restaurar',
          click: () => {
            if (mainWindow.isMaximized()) mainWindow.unmaximize();
            else mainWindow.maximize();
          },
        },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Sobre o LouvorJA',
          click: () => mainWindow.webContents.send('menu:about'),
        },
        {
          label: 'Verificar atualizações',
          click: () => mainWindow.webContents.send('menu:check-updates'),
        },
        { type: 'separator' },
        {
          label: 'Reportar problema',
          click: () => shell.openExternal('https://github.com/louvorja/louvorja/issues'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

module.exports = { createMenu };
