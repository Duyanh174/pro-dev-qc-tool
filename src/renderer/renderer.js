const { ipcRenderer } = require('electron');
const sass = require('sass');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

// --- HẰNG SỐ CẤU HÌNH ---
const MAX_LOGS = 5; // Đã chỉnh về 5 theo yêu cầu trước đó của bạn

const App = {
    watcher: null,
    inputDir: null,
    outputDir: null,
    currentMode: 'same', 
    wss: null,
    config: { native: true, web: true },

    init() {
        const saved = localStorage.getItem('dev_suite_cfg');
        if (saved) {
            this.config = JSON.parse(saved);
            this.syncUIConfig();
        }
        this.startSocket();
        UI.log("Hệ thống Dev-QC Pro đã sẵn sàng.", "warn");
    },

    syncUIConfig() {
        const nativeCb = document.getElementById('cfg-native');
        const webCb = document.getElementById('cfg-web');
        if(nativeCb) nativeCb.checked = this.config.native;
        if(webCb) webCb.checked = this.config.web;
    },

    startSocket() {
        try {
            this.wss = new WebSocket.Server({ port: 3000 });
        } catch (e) { console.error("WS Port 3000 occupied."); }
    }
};

const Compiler = {
    async run(file) {
        if (!file.endsWith('.scss') || path.basename(file).startsWith('_')) return;

        try {
            const target = this.getOutPath(file);
            const result = await sass.compileAsync(file, { 
                style: 'expanded', 
                sourceMap: true 
            });
            
            fs.writeFileSync(target, result.css);
            UI.log(`Biên dịch thành công: ${path.basename(target)}`, 'success');
            
            if (App.config.web) this.broadcast({ type: 'clear' });

        } catch (e) {
            this.handleError(file, e);
        }
    },

    getOutPath(file) {
        if (App.currentMode === 'custom' && App.outputDir) {
            const rel = path.relative(App.inputDir, file);
            const target = path.join(App.outputDir, rel.replace(/\.scss$/i, '.css'));
            if (!fs.existsSync(path.dirname(target))) {
                fs.mkdirSync(path.dirname(target), { recursive: true });
            }
            return target;
        }
        return file.replace(/\.scss$/i, '.css');
    },

    broadcast(data) {
        if (App.wss) {
            App.wss.clients.forEach(c => {
                if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(data));
            });
        }
    },

    handleError(file, e) {
        const line = e.span ? e.span.start.line + 1 : "??";
        // Bổ sung thông tin đường dẫn file vào nội dung log lỗi
        const msg = `${path.basename(file)} (Line ${line}): ${e.message}`;
        UI.log(`LỖI SASS: ${msg}`, 'error', file);

        if (App.config.web) this.broadcast({ type: 'error', message: msg });
        if (App.config.native) new Notification("Sass Compile Error", { body: msg });
    }
};

const Watcher = {
    start() {
        if (!App.inputDir) return;
        if (App.watcher) App.watcher.close();

        UI.log(`Đang theo dõi: ${path.basename(App.inputDir)}`, 'warn');

        App.watcher = chokidar.watch(App.inputDir, {
            ignored: [/(^|[\/\\])\../, '**/node_modules/**', '**/.git/**'],
            persistent: true,
            usePolling: true, 
            interval: 100,
            ignoreInitial: true,
            awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
        });

        App.watcher
            .on('add', f => Compiler.run(f))
            .on('change', f => Compiler.run(f))
            .on('unlink', f => {
                const t = Compiler.getOutPath(f);
                if(fs.existsSync(t)) {
                    fs.unlinkSync(t);
                    UI.log(`Đã gỡ bỏ: ${path.basename(t)}`, 'warn');
                }
            });

        UI.updateStatus('watching');
        UI.toggleBtn('stop');
    },

    stop() {
        if (App.watcher) {
            App.watcher.close();
            App.watcher = null;
            UI.updateStatus('stopped');
            UI.toggleBtn('resume');
            UI.log("Đã tạm dừng Engine.", "warn");
        }
    }
};

const UI = {
    log: (m, type = '', fullPath = '') => {
        const container = document.getElementById('logs');
        if (!container) return;

        const typeClass = type === 'success' ? 'log-success' : (type === 'error' ? 'log-error' : (type === 'warn' ? 'log-warn' : ''));
        const time = new Date().toLocaleTimeString([], { hour12: false });
        
        // Tạo HTML cho log entry
        let html = `
            <div class="log-entry ${typeClass}">
                <div style="display: flex; gap: 10px;">
                    <span class="log-time">${time}</span>
                    <span class="log-msg">${m}</span>
                </div>
        `;

        // Nếu có đường dẫn file lỗi, hiển thị thêm một dòng nhỏ bên dưới
        if (fullPath && type === 'error') {
            html += `<div style="font-size: 10px; opacity: 0.6; margin-left: 58px; margin-top: 4px; word-break: break-all;">Source: ${fullPath}</div>`;
        }

        html += `</div>`;
        
        container.insertAdjacentHTML('beforeend', html);

        // --- FIX LỖI MAX LOGS: Sử dụng while để dọn dẹp triệt để ---
        while (container.children.length > MAX_LOGS) {
            container.removeChild(container.firstElementChild);
        }

        container.scrollTop = container.scrollHeight;
    },

    updateStatus: (status) => {
        const text = document.getElementById('status');
        const dot = document.getElementById('status-dot');
        if (text) text.innerText = status.toUpperCase();
        if (dot) {
            dot.style.background = (status === 'watching') ? '#10b981' : '#ef4444';
            dot.style.boxShadow = (status === 'watching') ? '0 0 10px rgba(16,185,129,0.5)' : 'none';
        }
    },

    toggleBtn: (mode) => {
        const stopBtn = document.getElementById('btnStop');
        const resumeBtn = document.getElementById('btnResume');
        if (stopBtn) stopBtn.style.display = (mode === 'stop') ? 'block' : 'none';
        if (resumeBtn) resumeBtn.style.display = (mode === 'resume') ? 'block' : 'none';
    },

    initialScan: (dir) => {
        try {
            const files = fs.readdirSync(dir);
            files.forEach(f => {
                const fp = path.join(dir, f);
                const stat = fs.statSync(fp);
                if (stat.isDirectory()) {
                    if (f !== 'node_modules' && !f.startsWith('.')) UI.initialScan(fp);
                } else if (f.endsWith('.scss')) {
                    Compiler.run(fp);
                }
            });
        } catch(e) { console.error("Initial scan failed", e); }
    }
};

// --- EXPOSE FUNCTIONS ---
window.setMode = (m) => {
    App.currentMode = m;
    document.getElementById('modeSame').classList.toggle('active', m === 'same');
    document.getElementById('modeCustom').classList.toggle('active', m === 'custom');
    document.getElementById('outputCard').style.visibility = (m === 'custom') ? 'visible' : 'hidden';
    if (App.inputDir) UI.initialScan(App.inputDir);
};

window.showTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(`tab-${id}`).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`nav-${id}`).classList.add('active');
};

window.showModuleSettings = (id, event) => {
    document.querySelectorAll('.mod-settings-panel').forEach(p => p.style.display = 'none');
    const target = document.getElementById(`mod-settings-${id}`);
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('.mod-btn').forEach(b => b.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
};

window.saveCfg = () => {
    App.config.native = document.getElementById('cfg-native').checked;
    App.config.web = document.getElementById('cfg-web').checked;
    localStorage.setItem('dev_suite_cfg', JSON.stringify(App.config));
    UI.log("Đã cập nhật cấu hình hệ thống.", "success");
};

window.clearLogs = () => {
    const container = document.getElementById('logs');
    if (container) container.innerHTML = '';
};

// --- EVENTS ---
document.getElementById('btnIn').addEventListener('click', async () => {
    const res = await ipcRenderer.invoke('select-folder');
    if (!res.canceled) {
        App.inputDir = res.filePaths[0];
        document.getElementById('txtIn').innerText = App.inputDir;
        UI.initialScan(App.inputDir);
        Watcher.start();
    }
});

document.getElementById('btnOut').addEventListener('click', async () => {
    const res = await ipcRenderer.invoke('select-folder');
    if (!res.canceled) {
        App.outputDir = res.filePaths[0];
        document.getElementById('txtOut').innerText = App.outputDir;
    }
});

document.getElementById('btnStop').addEventListener('click', () => Watcher.stop());
document.getElementById('btnResume').addEventListener('click', () => Watcher.start());

// Start App
App.init();