const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 800,
        backgroundColor: '#12141d', // Giúp giao diện mượt mà, không bị trắng khi load
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false 
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../ui/index.html'));
}

// ========================================================
// IPC HANDLERS - CHỈ CÒN NHỮNG GÌ THỰC SỰ CẦN THIẾT
// ========================================================

// Xử lý chọn thư mục (Duy nhất 1 handler, không lo lỗi "second handler")
ipcMain.handle('select-folder', async () => {
    return await dialog.showOpenDialog(mainWindow, { 
        properties: ['openDirectory', 'createDirectory'] 
    });
});

// ========================================================
// VÒNG ĐỜI ỨNG DỤNG
// ========================================================

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    // Thoát app hoàn toàn khi đóng cửa sổ (trên Windows/Linux)
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    // Trên Mac, tạo lại cửa sổ khi bấm vào icon ở Dock
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});