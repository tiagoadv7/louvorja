const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

let tray = null;

function createTray(mainWindow) {
  let icon;
  try {
    icon = nativeImage.createFromPath(path.join(__dirname, '../public/ico/favicon-32x32.png'));
    if (icon.isEmpty()) {
      icon = nativeImage.createFromPath(path.join(__dirname, '../public/ico/favicon.png'));
    }
    icon = icon.resize({ width: 32, height: 32 });
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('LouvorJA');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir LouvorJA',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Janela de saída',
      submenu: [
        {
          label: 'Abrir',
          click: () => mainWindow.webContents.send('menu:open-output'),
        },
        {
          label: 'Fechar',
          click: () => mainWindow.webContents.send('menu:close-output'),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = { createTray, destroyTray };
