const { ipcRenderer } = require('electron');
const sass = require('sass');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

const MAX_LOGS = 50;

const App = {
    projects: [],
    activeProjectId: null,
    watchers: new Map(),
    wss: null,
    config: { native: true, web: true },

    init() {
        const savedCfg = localStorage.getItem('dev_suite_cfg');
        if (savedCfg) this.config = JSON.parse(savedCfg);
        this.syncUIConfig();

        const savedProjects = localStorage.getItem('dev_projects');
        if (savedProjects) {
            this.projects = JSON.parse(savedProjects);
            // Kích hoạt watching SONG SONG cho tất cả dự án có folder hợp lệ
            this.projects.forEach(p => {
                if (p.inputDir && fs.existsSync(p.inputDir)) {
                    Watcher.start(p.id);
                }
            });
        }

        this.startSocket();
        UI.renderProjectList();

        if (this.projects.length > 0) {
            this.switchProject(this.projects[0].id);
        }
        UI.logSystem("Hệ thống Dev-QC Pro đã sẵn sàng.");
    },

    save() {
        localStorage.setItem('dev_projects', JSON.stringify(this.projects));
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
    },

    createNewProject(name) {
        const newId = 'pj_' + Date.now();
        const finalName = name.trim() || `Project ${this.projects.length + 1}`;
        
        const newProject = {
            id: newId,
            name: finalName,
            inputDir: null,
            outputDir: null,
            mode: 'same',
            logs: []
        };

        this.projects.push(newProject);
        this.save();
        UI.renderProjectList();
        this.switchProject(newId);
        
        UI.log(newId, `Dự án "${finalName}" đã sẵn sàng.`, 'warn');
    },

    // TÍNH NĂNG XÓA DỰ ÁN
    deleteProject(id, event) {
        event.stopPropagation(); // Ngăn chặn sự kiện click chọn dự án
        
        const project = this.projects.find(p => p.id === id);
        if (!project) return;

        if (confirm(`Bạn có chắc chắn muốn xóa dự án "${project.name}"?`)) {
            // 1. Dừng watcher nếu đang chạy
            Watcher.stop(id);
            
            // 2. Xóa khỏi danh sách
            this.projects = this.projects.filter(p => p.id !== id);
            this.save();
            
            // 3. Xử lý UI sau khi xóa
            if (this.activeProjectId === id) {
                if (this.projects.length > 0) {
                    this.switchProject(this.projects[0].id);
                } else {
                    this.resetWorkspace();
                }
            }
            UI.renderProjectList();
        }
    },

    resetWorkspace() {
        this.activeProjectId = null;
        document.getElementById('active-project-name').innerText = "Select a Project";
        document.getElementById('active-project-path').innerText = "No directory selected";
        document.getElementById('txtIn').innerText = "Waiting for input...";
        UI.renderLogs([]);
        UI.updateStatus('stopped');
    },

    switchProject(id) {
        this.activeProjectId = id;
        const project = this.projects.find(p => p.id === id);
        if (!project) return;

        document.getElementById('active-project-name').innerText = project.name;
        document.getElementById('active-project-path').innerText = project.inputDir || "No directory selected";
        document.getElementById('txtIn').innerText = project.inputDir || "Waiting for input...";
        document.getElementById('txtOut').innerText = project.outputDir || "Same as source";
        
        window.setMode(project.mode);
        UI.renderLogs(project.logs);
        
        const isWatching = this.watchers.has(id);
        UI.updateStatus(isWatching ? 'watching' : 'stopped');
        UI.toggleBtn(isWatching ? 'stop' : 'resume');

        UI.renderProjectList();
    },

    getActiveProject() {
        return this.projects.find(p => p.id === this.activeProjectId);
    }
};

const Compiler = {
    async run(file, projectId) {
        if (!file.endsWith('.scss') || path.basename(file).startsWith('_')) return;
        const project = App.projects.find(p => p.id === projectId);
        if (!project || !project.inputDir) return;

        try {
            const target = this.getOutPath(file, project);
            const result = await sass.compileAsync(file, { style: 'expanded', sourceMap: true });
            fs.writeFileSync(target, result.css);
            
            UI.log(projectId, `Biên dịch thành công: ${path.basename(target)}`, 'success');
            if (App.config.web) this.broadcast({ type: 'clear' });
        } catch (e) {
            this.handleError(projectId, file, e);
        }
    },

    getOutPath(file, project) {
        if (project.mode === 'custom' && project.outputDir) {
            const rel = path.relative(project.inputDir, file);
            const target = path.join(project.outputDir, rel.replace(/\.scss$/i, '.css'));
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

    handleError(projectId, file, e) {
        const line = e.span ? e.span.start.line + 1 : "??";
        const msg = `${path.basename(file)} (Line ${line}): ${e.message}`;
        UI.log(projectId, `LỖI SASS: ${msg}`, 'error', file);
        if (App.config.web) this.broadcast({ type: 'error', message: msg });
        if (App.config.native) new Notification("Sass Compile Error", { body: msg });
    }
};

const Watcher = {
    start(projectId) {
        const project = App.projects.find(p => p.id === projectId);
        if (!project || !project.inputDir) return;

        if (App.watchers.has(projectId)) App.watchers.get(projectId).close();

        const w = chokidar.watch(project.inputDir, {
            ignored: [/(^|[\/\\])\../, '**/node_modules/**', '**/.git/**'],
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
        });

        w.on('add', f => Compiler.run(f, projectId))
         .on('change', f => Compiler.run(f, projectId))
         .on('unlink', f => {
            const t = Compiler.getOutPath(f, project);
            if(fs.existsSync(t)) {
                fs.unlinkSync(t);
                UI.log(projectId, `Đã gỡ bỏ: ${path.basename(t)}`, 'warn');
            }
         });

        App.watchers.set(projectId, w);
        if (App.activeProjectId === projectId) {
            UI.updateStatus('watching');
            UI.toggleBtn('stop');
        }
    },

    stop(projectId) {
        if (App.watchers.has(projectId)) {
            App.watchers.get(projectId).close();
            App.watchers.delete(projectId);
            if (App.activeProjectId === projectId) {
                UI.updateStatus('stopped');
                UI.toggleBtn('resume');
                UI.log(projectId, "Đã tạm dừng Engine.", "warn");
            }
        }
    }
};

const UI = {
    log: (projectId, m, type = '', fullPath = '') => {
        const project = App.projects.find(p => p.id === projectId);
        if (!project) return;

        const logEntry = {
            time: new Date().toLocaleTimeString([], { hour12: false }),
            msg: m,
            type: type,
            fullPath: fullPath
        };

        project.logs.push(logEntry);
        if (project.logs.length > MAX_LOGS) project.logs.shift();

        if (App.activeProjectId === projectId) UI.appendLogToDOM(logEntry);
        App.save();
    },

    logSystem: (m) => {
        if (App.activeProjectId) UI.log(App.activeProjectId, m, 'warn');
    },

    appendLogToDOM: (entry) => {
        const container = document.getElementById('logs');
        if (!container) return;

        const typeClass = entry.type === 'success' ? 'log-success' : (entry.type === 'error' ? 'log-error' : 'log-warn');
        const div = document.createElement('div');
        div.className = `log-entry ${typeClass}`;
        let html = `
            <div style="display: flex; gap: 12px;">
                <span class="log-time">${entry.time}</span>
                <span class="log-msg">${entry.msg}</span>
            </div>
        `;
        if (entry.fullPath && entry.type === 'error') {
            html += `<div style="font-size: 10px; opacity: 0.6; margin-left: 72px; margin-top: 4px; word-break: break-all;">Source: ${entry.fullPath}</div>`;
        }
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    renderLogs: (logs) => {
        const container = document.getElementById('logs');
        container.innerHTML = '';
        logs.forEach(log => UI.appendLogToDOM(log));
    },

    renderProjectList: () => {
        const container = document.getElementById('project-list');
        if(!container) return;
        container.innerHTML = '';
        App.projects.forEach(p => {
            const item = document.createElement('div');
            item.className = `project-item ${App.activeProjectId === p.id ? 'active' : ''}`;
            
            // Thêm nút xóa (x) vào bên phải
            item.innerHTML = `
                <div class="avatar">${p.name.substring(0, 2).toUpperCase()}</div>
                <div class="name-box">
                    <div class="name">${p.name}</div>
                    <div class="dir-hint">${p.inputDir ? path.basename(p.inputDir) : 'No folder'}</div>
                </div>
                <div class="delete-btn" onclick="App.deleteProject('${p.id}', event)">×</div>
            `;
            item.onclick = () => App.switchProject(p.id);
            container.appendChild(item);
        });
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

    initialScan: (dir, projectId) => {
        try {
            const files = fs.readdirSync(dir);
            files.forEach(f => {
                const fp = path.join(dir, f);
                const stat = fs.statSync(fp);
                if (stat.isDirectory()) {
                    if (f !== 'node_modules' && !f.startsWith('.')) UI.initialScan(fp, projectId);
                } else if (f.endsWith('.scss')) Compiler.run(fp, projectId);
            });
        } catch(e) {}
    },

    showProjectModal: () => {
        const modal = document.getElementById('project-modal');
        const input = document.getElementById('new-project-name');
        const warning = document.getElementById('ram-warning');
        
        modal.style.display = 'flex';
        input.value = `Project ${App.projects.length + 1}`;
        
        // CẢNH BÁO RAM NẾU DỰ ÁN >= 4
        if (App.projects.length >= 4) {
            warning.style.display = 'block';
        } else {
            warning.style.display = 'none';
        }

        input.focus();
        input.select();
    },

    hideProjectModal: () => {
        document.getElementById('project-modal').style.display = 'none';
    }
};

// --- EVENTS ---
window.setMode = (m) => {
    const project = App.getActiveProject();
    if (project) {
        project.mode = m;
        App.save();
    }
    document.getElementById('modeSame').classList.toggle('active', m === 'same');
    document.getElementById('modeCustom').classList.toggle('active', m === 'custom');
    document.getElementById('outputCard').style.visibility = (m === 'custom') ? 'visible' : 'hidden';
};

window.showTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(`tab-${id}`).style.display = 'flex';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`nav-${id}`).classList.add('active');
};

document.getElementById('btnIn').addEventListener('click', async () => {
    if (App.projects.length === 0) {
        UI.showProjectModal();
        return;
    }
    const project = App.getActiveProject();
    if (!project) return;

    const res = await ipcRenderer.invoke('select-folder');
    if (!res.canceled) {
        project.inputDir = res.filePaths[0];
        document.getElementById('txtIn').innerText = project.inputDir;
        document.getElementById('active-project-path').innerText = project.inputDir;
        App.save();
        UI.renderProjectList();
        UI.log(project.id, "Bắt đầu quét thư mục...", 'warn');
        UI.initialScan(project.inputDir, project.id);
        Watcher.start(project.id);
    }
});

document.getElementById('btnOut').addEventListener('click', async () => {
    const project = App.getActiveProject();
    if (!project) return;
    const res = await ipcRenderer.invoke('select-folder');
    if (!res.canceled) {
        project.outputDir = res.filePaths[0];
        document.getElementById('txtOut').innerText = project.outputDir;
        App.save();
        UI.log(project.id, `Đã đổi folder đích.`, 'success');
    }
});

document.getElementById('confirm-project-btn').addEventListener('click', () => {
    const name = document.getElementById('new-project-name').value;
    UI.hideProjectModal();
    App.createNewProject(name);
});

document.getElementById('btnStop').addEventListener('click', () => Watcher.stop(App.activeProjectId));
document.getElementById('btnResume').addEventListener('click', () => Watcher.start(App.activeProjectId));
window.clearLogs = () => {
    const project = App.getActiveProject();
    if (project) {
        project.logs = [];
        App.save();
        UI.renderLogs([]);
    }
};
window.saveCfg = () => {
    App.config.native = document.getElementById('cfg-native').checked;
    App.config.web = document.getElementById('cfg-web').checked;
    localStorage.setItem('dev_suite_cfg', JSON.stringify(App.config));
};

App.init();