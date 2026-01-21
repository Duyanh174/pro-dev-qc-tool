const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');

let mainWindow;
let clipboardWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 800,
        backgroundColor: '#12141d',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false 
        }
    });
    mainWindow.loadFile(path.join(__dirname, '../ui/index.html'));
}

// ========================================================
// LOGIC CLIPBOARD WINDOW (STANDALONE)
// ========================================================

function createClipboardWindow() {
    if (clipboardWindow) {
        clipboardWindow.focus();
        return;
    }

    clipboardWindow = new BrowserWindow({
        width: 380,
        height: 600,
        frame: true,         // BẬT THANH ĐIỀU HƯỚNG MẶC ĐỊNH
        alwaysOnTop: true,   // Luôn nổi trên các ứng dụng khác
        title: "Clipboard Manager",
        backgroundColor: '#ffffff',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false 
        }
    });

    const startUrl = url.format({
        pathname: path.join(__dirname, '../ui/features/clipboard-standalone.html'),
        protocol: 'file:',
        slashes: true
    });

    clipboardWindow.loadURL(startUrl);

    clipboardWindow.on('closed', () => {
        clipboardWindow = null;
    });
}

// Lắng nghe sự kiện từ Renderer
ipcMain.on('toggle-clipboard-window', (event, isWindow) => {
    if (isWindow) {
        createClipboardWindow();
    } else {
        if (clipboardWindow) clipboardWindow.close();
    }
});

ipcMain.on('close-clipboard-ui', () => {
    if (clipboardWindow) clipboardWindow.close();
});

// ========================================================
// IPC HANDLERS - GIỮ NGUYÊN BASE CŨ
// ========================================================
ipcMain.handle('select-folder', async () => {
    return await dialog.showOpenDialog(mainWindow, { 
        properties: ['openDirectory', 'createDirectory'] 
    });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});