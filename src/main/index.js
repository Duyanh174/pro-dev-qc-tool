const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
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
    if (clipboardWindow && !clipboardWindow.isDestroyed()) {
        clipboardWindow.focus();
        return;
    }

    clipboardWindow = new BrowserWindow({
        width: 380,
        height: 600,
        frame: true,         // Thanh điều hướng mặc định
        alwaysOnTop: true,
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
        // FIX LỖI 2: Kiểm tra mainWindow còn sống không trước khi send
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('clipboard-window-status', false);
        }
        clipboardWindow = null;
    });
}

// Lắng nghe sự kiện toggle từ Renderer
ipcMain.on('toggle-clipboard-window', (event, isWindow) => {
    if (isWindow) {
        createClipboardWindow();
    } else {
        if (clipboardWindow && !clipboardWindow.isDestroyed()) {
            clipboardWindow.close();
        }
    }
});

ipcMain.on('close-clipboard-ui', () => {
    if (clipboardWindow && !clipboardWindow.isDestroyed()) {
        clipboardWindow.close();
    }
});

// ========================================================
// IPC HANDLERS & GLOBAL SHORTCUT
// ========================================================

ipcMain.handle('select-folder', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    return await dialog.showOpenDialog(mainWindow, { 
        properties: ['openDirectory', 'createDirectory'] 
    });
});

app.whenReady().then(() => {
    createWindow();

    // FIX LỖI 1: Phím tắt Control + Command + V
    globalShortcut.register('CommandOrControl+Control+V', () => {
        createClipboardWindow();
        
        // Kiểm tra an toàn trước khi cập nhật Switch ở mainWindow
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('clipboard-window-status', true);
        }
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});