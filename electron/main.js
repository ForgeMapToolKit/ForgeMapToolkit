const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    frame: true,
    titleBarStyle: 'default',
    icon: path.join(__dirname, '../assets/icon.png')
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers for file operations
ipcMain.handle('save-blueprint', async (event, content) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Save Blueprint',
    defaultPath: 'map_blueprint.lua',
    filters: [
      { name: 'Lua Files', extensions: ['lua'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (filePath) {
    fs.writeFileSync(filePath, content);
    return { success: true, path: filePath };
  }
  return { success: false };
});

ipcMain.handle('load-image', async (event) => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Select Map Preview Image',
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
    ],
    properties: ['openFile']
  });

  if (filePaths && filePaths.length > 0) {
    const imagePath = filePaths[0];
    const imageData = fs.readFileSync(imagePath);
    const base64 = imageData.toString('base64');
    const ext = path.extname(imagePath).slice(1);
    return { success: true, data: `data:image/${ext};base64,${base64}` };
  }
  return { success: false };
});

ipcMain.handle('save-config', async (event, config) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Save Configuration',
    defaultPath: 'map_config.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (filePath) {
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    return { success: true, path: filePath };
  }
  return { success: false };
});

ipcMain.handle('load-config', async (event) => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Load Configuration',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (filePaths && filePaths.length > 0) {
    const configPath = filePaths[0];
    const configData = fs.readFileSync(configPath, 'utf8');
    return { success: true, data: JSON.parse(configData) };
  }
  return { success: false };
});
