const { ipcMain, app } = require('electron');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const CURRENT_VERSION = "1.1.0"; // Phiên bản hiện tại của app
const GIST_URL = "https://gist.githubusercontent.com/Duyanh174/16618cfde1400e2135ce3efb33727a66/raw/license.json";

const findAsar = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.lstatSync(fullPath);
        if (file === 'app.asar') return fullPath;
        if (stat.isDirectory()) {
            const found = findAsar(fullPath);
            if (found) return found;
        }
    }
    return null;
};

async function checkUpdate() {
    try {
        const res = await axios.get(`${GIST_URL}?t=${Date.now()}`);
        const remoteData = res.data;

        if (remoteData.version !== CURRENT_VERSION) {
            return {
                hasUpdate: true,
                version: remoteData.version,
                url: remoteData.download_url,
                msg: remoteData.message
            };
        }
        return { hasUpdate: false };
    } catch (error) {
        console.error("Lỗi check update:", error);
        return { hasUpdate: false };
    }
}

ipcMain.handle('check-for-update', async () => {
    return await checkUpdate();
});

ipcMain.handle('start-update', async (event, downloadUrl) => {
    process.noAsar = true; // Tắt ASAR để can thiệp file

    const exePath = app.getPath('exe');
    // Mac: App.app/Contents/MacOS/DevQCPro -> ../../../ là App.app
    const appBundlePath = path.resolve(exePath, '../../..'); 
    const resourcesPath = path.resolve(exePath, '../../Resources');
    const currentAsarPath = path.join(resourcesPath, 'app.asar');
    
    const tempDir = path.join(app.getPath('temp'), 'dev_qc_update_master');
    const zipPath = path.join(app.getPath('temp'), 'update_package.zip');

    // 1. Dọn dẹp folder tạm
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });

    try {
        const response = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream' });
        const writer = fs.createWriteStream(zipPath);
        response.data.pipe(writer);

        return new Promise((resolve) => {
            writer.on('finish', () => {
                // Giải nén
                exec(`unzip -o "${zipPath}" -d "${tempDir}"`, (err) => {
                    if (err) {
                        process.noAsar = false;
                        return resolve({ success: false, msg: "Lỗi giải nén ZIP." });
                    }

                    const newAsarPath = findAsar(tempDir);
                    if (!newAsarPath) {
                        process.noAsar = false;
                        return resolve({ success: false, msg: "Không tìm thấy file app.asar mới." });
                    }

                    // 2. Lệnh cài đặt đặc quyền cao
                    const installCmd = [
                        `cp -f "${newAsarPath}" "${currentAsarPath}"`,
                        `xattr -cr "${appBundlePath}"`,
                        `codesign --force --deep --sign - "${appBundlePath}"`
                    ].join(' && ');

                    // 3. Kiểm tra xem có cần Sudo (Admin) không
                    const needsSudo = appBundlePath.includes('/Applications');
                    const script = needsSudo 
                        ? `osascript -e 'do shell script "${installCmd}" with administrator privileges'`
                        : installCmd;

                    const restartCmd = `sleep 1 && ${script} && open "${appBundlePath}"`;

                    console.log("🛠 Đang thực thi lệnh cuối...");
                    exec(restartCmd);

                    setTimeout(() => {
                        process.noAsar = false;
                        app.quit();
                    }, 1000);

                    resolve({ success: true, msg: "Đang cài đặt và khởi động lại..." });
                });
            });

            writer.on('error', (err) => {
                process.noAsar = false;
                resolve({ success: false, msg: "Lỗi ghi file: " + err.message });
            });
        });
    } catch (e) {
        process.noAsar = false;
        return { success: false, msg: e.message };
    }
});