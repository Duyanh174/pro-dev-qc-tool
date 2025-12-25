const { ipcRenderer } = require('electron');
const sass = require('sass');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

const MAX_LOGS = 5; 

const App = {
    watcher: null,
    inputDir: null,
    outputDir: null,
    currentMode: 'same', 
    wss: null,
    config: { native: true, web: true },

    init() {
        // 1. Tải cấu hình hệ thống
        const savedCfg = localStorage.getItem('dev_suite_cfg');
        if (savedCfg) {
            this.config = JSON.parse(savedCfg);
            this.syncUIConfig();
        }

        // 2. KHÔI PHỤC THƯ MỤC CŨ (Tính năng bạn cần)
        const savedPath = localStorage.getItem('last_input_dir');
        if (savedPath && fs.existsSync(savedPath)) {
            this.inputDir = savedPath;
            document.getElementById('txtIn').innerText = this.inputDir;
            UI.log(`Đã khôi phục thư mục: ${path.basename(this.inputDir)}`, 'warn');
            Watcher.start(); // Tự động theo dõi luôn
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
            const result = await sass.compileAsync(file, { style: 'expanded', sourceMap: true });
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
            if (!fs.existsSync(path.dirname(target))) fs.mkdirSync(path.dirname(target), { recursive: true });
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

        App.watcher = chokidar.watch(App.inputDir, {
            ignored: [/(^|[\/\\])\../, '**/node_modules/**', '**/.git/**'],
            persistent: true,
            usePolling: false, // Tối ưu CPU cho Mac
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

        const typeClass = type === 'success' ? 'log-success' : (type === 'error' ? 'log-error' : 'log-warn');
        const time = new Date().toLocaleTimeString([], { hour12: false });
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${typeClass}`;
        let html = `
            <div style="display: flex; gap: 10px;">
                <span class="log-time">${time}</span>
                <span class="log-msg">${m}</span>
            </div>
        `;
        if (fullPath && type === 'error') {
            html += `<div style="font-size: 10px; opacity: 0.6; margin-left: 58px; margin-top: 4px; word-break: break-all;">Source: ${fullPath}</div>`;
        }
        entry.innerHTML = html;
        container.appendChild(entry);

        while (container.children.length > MAX_LOGS) {
            container.removeChild(container.firstElementChild);
        }
        container.scrollTop = container.scrollHeight;
    },

    updateStatus: (s) => {
        const text = document.getElementById('status');
        const dot = document.getElementById('status-dot');
        if (text) text.innerText = s.toUpperCase();
        if (dot) dot.style.background = (s === 'watching') ? '#10b981' : '#ef4444';
    },

    toggleBtn: (m) => {
        const s = document.getElementById('btnStop');
        const r = document.getElementById('btnResume');
        if (s) s.style.display = (m === 'stop') ? 'block' : 'none';
        if (r) r.style.display = (m === 'resume') ? 'block' : 'none';
    },

    initialScan: (dir) => {
        try {
            const files = fs.readdirSync(dir);
            files.forEach(f => {
                const fp = path.join(dir, f);
                const stat = fs.statSync(fp);
                if (stat.isDirectory()) {
                    if (f !== 'node_modules' && !f.startsWith('.')) UI.initialScan(fp);
                } else if (f.endsWith('.scss')) Compiler.run(fp);
            });
        } catch(e) {}
    }
};

// --- EVENTS ---
window.setMode = (m) => {
    App.currentMode = m;
    document.getElementById('modeSame').classList.toggle('active', m === 'same');
    document.getElementById('modeCustom').classList.toggle('active', m === 'custom');
    document.getElementById('outputCard').style.visibility = (m === 'custom') ? 'visible' : 'hidden';
};

window.showTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(`tab-${id}`).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`nav-${id}`).classList.add('active');
};

document.getElementById('btnIn').addEventListener('click', async () => {
    const res = await ipcRenderer.invoke('select-folder');
    if (!res.canceled) {
        App.inputDir = res.filePaths[0];
        document.getElementById('txtIn').innerText = App.inputDir;
        
        // --- LƯU LẠI ĐƯỜNG DẪN VÀO BỘ NHỚ ---
        localStorage.setItem('last_input_dir', App.inputDir);
        
        UI.initialScan(App.inputDir);
        Watcher.start();
    }
});

document.getElementById('btnStop').addEventListener('click', () => Watcher.stop());
document.getElementById('btnResume').addEventListener('click', () => Watcher.start());
window.clearLogs = () => document.getElementById('logs').innerHTML = '';

// Khởi chạy
App.init();