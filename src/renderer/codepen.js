const CodePen = {
    isDraggingV: false,
    isDraggingH: false,
    isDraggingC: false,
    startY: 0,
    startTranslateY: 0,
    startConsoleHeight: 0,
    autoRunEnabled: false, 
    debounceTimer: null,
    STORAGE_KEY: "codepen_user_data",
    
    editors: { html: null, css: null, js: null },
    // Dữ liệu CDN
    externalResources: { css: [], js: [] },

    init() {
        const container = document.getElementById('codepen-container');
        if (!container) return;

        container.innerHTML = `
        <div class="codepen-container-main">
            <div class="preview-actions">
                <div class="brand-name">PRO EDITOR</div>
                <button class="action-btn btn-success" onclick="runCode()">▶ RUN</button>
                <label class="toggle-control">
                    <input type="checkbox" id="auto-run-toggle">
                    <span class="control"></span>
                    <span class="label">Auto Run</span>
                </label>
                <div style="flex:1"></div>
                <select id="theme-selector" class="theme-select">
                    <option value="ace/theme/monokai">Monokai</option>
                    <option value="ace/theme/dracula">Dracula</option>
                    <option value="ace/theme/github">GitHub</option>
                    <option value="ace/theme/twilight">Twilight</option>
                    <option value="ace/theme/nord_dark">Nord Dark</option>
                </select>
                <button class="action-btn btn-secondary" onclick="CodePen.openCDNModal()">🌐 CDN</button>
                <button class="action-btn btn-secondary" onclick="CodePen.toggleConsole()">📟 Console</button>
                <button class="action-btn btn-secondary" onclick="clearCode()">🗑 Clear</button>
            </div>

            <div class="editor-section-bg" id="editor-section">
                <div class="editor-box" style="flex: 1;"><div class="editor-label"><span>HTML</span><button class="format-btn" onclick="CodePen.formatCode('html')">Format</button></div><div class="editor-content-wrapper"><div id="html-gutter" class="custom-line-numbers"></div><div id="html-code" class="ace-editor-container"></div></div></div>
                <div class="resizer-h horizontal-resizer"></div>
                <div class="editor-box" style="flex: 1;"><div class="editor-label"><span>CSS</span><button class="format-btn" onclick="CodePen.formatCode('css')">Format</button></div><div class="editor-content-wrapper"><div id="css-gutter" class="custom-line-numbers"></div><div id="css-code" class="ace-editor-container"></div></div></div>
                <div class="resizer-h horizontal-resizer"></div>
                <div class="editor-box" style="flex: 1;"><div class="editor-label"><span>JS</span><button class="format-btn" onclick="CodePen.formatCode('js')">Format</button></div><div class="editor-content-wrapper"><div id="js-gutter" class="custom-line-numbers"></div><div id="js-code" class="ace-editor-container"></div></div></div>
            </div>
            
            <div class="preview-sliding-overlay" id="preview-overlay-container">
                <div class="resizer-v-handle" id="main-vertical-resizer"><div class="handle-line"></div></div>
                <div class="preview-content-wrapper">
                    <div class="preview-frame-container">
                        <div id="drag-blocker"></div>
                        <iframe id="preview-window" allow="accelerometer; camera; gyroscope; microphone; display-capture; midi; clipboard-read; clipboard-write; web-share" allowfullscreen="true"></iframe>
                    </div>
                    
                    <div class="console-panel" id="console-panel">
                        <div class="resizer-console" id="console-resizer"></div>
                        <div class="console-header">
                            <span class="console-title">Console</span>
                            <div class="console-actions">
                                <button class="format-btn" onclick="CodePen.clearConsole()">Clear</button>
                                <button class="format-btn" onclick="CodePen.toggleConsole()">Close</button>
                            </div>
                        </div>
                        <div class="console-body" id="console-body">
                            <div class="console-logs" id="console-logs"></div>
                            <div class="console-input-area">
                                <input type="text" class="console-input" id="console-command" placeholder="Type JS command...">
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="cdn-modal-overlay" id="cdn-modal-overlay">
                <div class="cdn-modal">
                    <div class="cdn-modal-header">
                        <h3 style="margin:0; font-size: 16px; color: #fff;">External Resources</h3>
                        <button class="format-btn" onclick="CodePen.closeCDNModal()">✕</button>
                    </div>
                    <div style="font-size: 11px; color: #858585; margin-bottom: 10px;">Add External CSS or JS via URL</div>
                    <div class="cdn-input-group">
                        <input type="text" id="cdn-url" placeholder="https://cdnjs.cloudflare.com/... ">
                        <button class="action-btn btn-success" onclick="CodePen.addResource()">Add</button>
                    </div>
                    <div class="cdn-list" id="cdn-list"></div>
                    <div style="text-align: right;">
                        <button class="action-btn btn-secondary" onclick="CodePen.closeCDNModal()">Done</button>
                    </div>
                </div>
            </div>
        </div>`;

        this.setupConsoleEvents();
        const overlay = document.getElementById('preview-overlay-container');
        const defaultY = window.innerHeight * 0.45;
        overlay.style.transform = `translateY(${defaultY}px)`;
        overlay.style.height = `calc(100vh - ${defaultY}px)`;

        const toggleBtn = document.getElementById('auto-run-toggle');
        if(toggleBtn) {
            toggleBtn.addEventListener('change', (e) => {
                this.autoRunEnabled = e.target.checked;
                if (this.autoRunEnabled) this.run();
            });
        }

        const themeSelector = document.getElementById('theme-selector');
        if(themeSelector) {
            themeSelector.addEventListener('change', (e) => {
                const theme = e.target.value;
                Object.values(this.editors).forEach(ed => ed && ed.setTheme(theme));
                setTimeout(() => this.syncThemeColors(), 150);
            });
        }

        this.initAce();
        this.updateScrollMargins(defaultY);
        requestAnimationFrame(() => { this.initResizers(); this.syncThemeColors(); });
    },

    // --- CDN MANAGER LOGIC ---
    openCDNModal() {
        document.getElementById('cdn-modal-overlay').style.display = 'flex';
        this.renderCDNList();
    },

    closeCDNModal() {
        document.getElementById('cdn-modal-overlay').style.display = 'none';
        this.saveToStorage();
        this.run(); // Reload preview để nạp tài nguyên mới
    },

    addResource() {
        const url = document.getElementById('cdn-url').value.trim();
        if (!url) return;

        if (url.endsWith('.css') || url.includes('fonts.googleapis.com')) {
            this.externalResources.css.push(url);
        } else {
            this.externalResources.js.push(url);
        }

        document.getElementById('cdn-url').value = '';
        this.renderCDNList();
    },

    removeResource(type, index) {
        this.externalResources[type].splice(index, 1);
        this.renderCDNList();
    },

    renderCDNList() {
        const listEl = document.getElementById('cdn-list');
        let html = '';
        
        ['css', 'js'].forEach(type => {
            this.externalResources[type].forEach((url, index) => {
                html += `
                <div class="cdn-item">
                    <span title="${url}">[${type.toUpperCase()}] ${url}</span>
                    <span class="cdn-remove" onclick="CodePen.removeResource('${type}', ${index})">✕</span>
                </div>`;
            });
        });

        listEl.innerHTML = html || '<div style="color:#555; font-size: 11px;">No external resources added.</div>';
    },

    // --- CONSOLE LOGIC ---
    setupConsoleEvents() {
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'iframe-log') {
                this.appendLog(event.data.method, event.data.arguments);
            }
        });
        const input = document.getElementById('console-command');
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = input.value;
                if (!cmd) return;
                this.appendLog('info', [`> ${cmd}`]);
                this.executeConsoleCommand(cmd);
                input.value = '';
            }
        });
    },

    toggleConsole() {
        const panel = document.getElementById('console-panel');
        if (panel.style.display === 'flex') {
            panel.style.display = 'none';
        } else {
            panel.style.display = 'flex';
            panel.style.height = '180px';
            document.getElementById('console-body').style.display = 'flex';
        }
    },

    clearConsole() { document.getElementById('console-logs').innerHTML = ''; },

    appendLog(method, args) {
        const logContainer = document.getElementById('console-logs');
        if (!logContainer) return;
        const logItem = document.createElement('div');
        logItem.className = `log-item log-${method === 'log' ? 'info' : method}`;
        logItem.innerText = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
        logContainer.appendChild(logItem);
        logContainer.scrollTop = logContainer.scrollHeight;
    },

    executeConsoleCommand(cmd) {
        const iframe = document.getElementById('preview-window');
        iframe.contentWindow.postMessage({ type: 'exec-command', command: cmd }, '*');
    },

    // --- PERSISTENCE ---
    saveToStorage() {
        const data = { 
            html: this.editors.html.getValue(), 
            css: this.editors.css.getValue(), 
            js: this.editors.js.getValue(),
            resources: this.externalResources // Lưu CDN
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    },

    loadFromStorage() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        const data = saved ? JSON.parse(saved) : null;
        if (data && data.resources) this.externalResources = data.resources; // Tải CDN
        return data;
    },

  

    formatCode(type) {
        const editor = this.editors[type];
        if (!editor || typeof prettier === 'undefined') return;
        try {
            const formatted = prettier.format(editor.getValue(), { parser: type === "js" ? "babel" : (type === "css" ? "css" : "html"), plugins: prettierPlugins, tabWidth: 2 });
            editor.setValue(formatted, 1);
        } catch (err) { console.warn("Format error:", err); }
    },

    initAce() {
        const savedData = this.loadFromStorage();
        const config = { theme: "ace/theme/monokai", fontSize: "13px", useSoftTabs: true, showPrintMargin: false, showGutter: false, wrap: true, indentedSoftWrap: false, useWorker: false, animatedScroll: false, scrollbarHandler: "native", scrollPastEnd: 0, minLines: 50, maxLines: Infinity, showFoldWidgets: true };
        const setupEditor = (id, gutterId, mode, defaultValue) => {
            const editor = ace.edit(id);
            const gutterEl = document.getElementById(gutterId);
            editor.setOptions(config);
            editor.session.setMode(`ace/mode/${mode}`);
            const initialValue = (savedData && savedData[mode === "javascript" ? "js" : mode]) || defaultValue;
            editor.setValue(initialValue, 1);
            const updateLineNumbers = () => {
                const session = editor.session;
                const lineCount = session.getLength();
                let numbersHtml = "";
                const lineHeight = editor.renderer.lineHeight || 19;
                for (let i = 0; i < lineCount; i++) {
                    const multiplier = session.getRowLength(i);
                    if (multiplier > 0) {
                        const rowHeight = lineHeight * multiplier;
                        const foldWidget = session.getFoldWidget(i);
                        let foldBtn = "";
                        if (foldWidget === "start") {
                            const isFolded = session.isRowFolded(i);
                            foldBtn = `<span class="fold-icon ${isFolded ? 'is-folded' : ''}" data-row="${i}"></span>`;
                        }
                        numbersHtml += `<div class="line-number-row" style="height: ${rowHeight}px; line-height: ${lineHeight}px;">${foldBtn}<span class="num-text">${i + 1}</span></div>`;
                    }
                }
                gutterEl.innerHTML = numbersHtml;
            };
            gutterEl.onclick = (e) => { if (e.target.classList.contains('fold-icon')) { editor.session.toggleFold(parseInt(e.target.getAttribute('data-row'))); } };
            editor.renderer.on('afterRender', () => { gutterEl.style.transform = `translateY(${-editor.renderer.getScrollTop()}px)`; });
            editor.session.on('change', () => { updateLineNumbers(); this.triggerAutoRun(); });
            editor.session.on('changeWrapLimit', updateLineNumbers);
            editor.session.on('changeFold', updateLineNumbers);
            setTimeout(updateLineNumbers, 100);
            return editor;
        };
        this.editors.html = setupEditor("html-code", "html-gutter", "html", "<div>\n  <h1>Hello</h1>\n</div>");
        this.editors.css = setupEditor("css-code", "css-gutter", "css", "body {\n  color: cyan;\n}");
        this.editors.js = setupEditor("js-code", "js-gutter", "javascript", "console.log('Ready');");
    },

    updateScrollMargins(currentTranslateY) {
        const bottomReservedSpace = window.innerHeight - currentTranslateY;
        Object.values(this.editors).forEach(editor => { if (editor) editor.renderer.setScrollMargin(10, bottomReservedSpace + 20, 10, 10); });
    },

    triggerAutoRun() {
        this.saveToStorage();
        if (!this.autoRunEnabled) return;
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.run(), 800);
    },

    resizeEditors() { Object.values(this.editors).forEach(editor => { if (editor) editor.resize(); }); },

    initResizers() {
        const vHandle = document.getElementById('main-vertical-resizer');
        const overlay = document.getElementById('preview-overlay-container');
        const blocker = document.getElementById('drag-blocker');
        const mainContainer = document.querySelector('.codepen-container-main');
        const cResizer = document.getElementById('console-resizer');
        const cPanel = document.getElementById('console-panel');
        const cBody = document.getElementById('console-body');

        if (!vHandle || !overlay) return;

        const move = (e) => {
            if (this.isDraggingV) {
                const deltaY = e.clientY - this.startY;
                let newY = this.startTranslateY + deltaY;
                const minBound = 60; const maxBound = window.innerHeight - 60;
                if (newY < minBound) newY = minBound; if (newY > maxBound) newY = maxBound;
                overlay.style.transform = `translateY(${newY}px)`;
                overlay.style.height = `calc(100vh - ${newY}px)`;
                this.updateScrollMargins(newY);
                this.resizeEditors();
            } else if (this.isDraggingC) {
                const deltaY = this.startY - e.clientY;
                let newHeight = this.startConsoleHeight + deltaY;
                const minH = 35;
                if (newHeight < minH) newHeight = minH;
                cPanel.style.height = `${newHeight}px`;
                cBody.style.display = (newHeight <= 45) ? 'none' : 'flex';
            }
        };

        const up = () => {
            this.isDraggingV = false; this.isDraggingC = false;
            blocker.style.display = 'none';
            mainContainer.classList.remove('is-dragging-global');
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };

        vHandle.addEventListener('pointerdown', (e) => {
            this.isDraggingV = true; this.startY = e.clientY;
            const matrix = new WebKitCSSMatrix(window.getComputedStyle(overlay).transform);
            this.startTranslateY = matrix.m42;
            blocker.style.display = 'block'; mainContainer.classList.add('is-dragging-global');
            window.addEventListener('pointermove', move, { passive: true });
            window.addEventListener('pointerup', up);
        });

        cResizer.addEventListener('pointerdown', (e) => {
            this.isDraggingC = true; this.startY = e.clientY;
            this.startConsoleHeight = cPanel.offsetHeight;
            blocker.style.display = 'block'; mainContainer.classList.add('is-dragging-global');
            window.addEventListener('pointermove', move, { passive: true });
            window.addEventListener('pointerup', up);
        });
        
        const hResizers = document.querySelectorAll('.horizontal-resizer');
        hResizers.forEach((resizer, index) => {
            let startX, startLWidth, startRWidth, leftBox, rightBox, jsBox;
            const moveH = (ev) => {
                if (!this.isDraggingH) return;
                const deltaX = ev.clientX - startX;
                const newLWidth = startLWidth + deltaX;
                const newRWidth = startRWidth - deltaX;
                if (newLWidth > 50 && (index === 0 ? newRWidth > 50 : true)) {
                    leftBox.style.flex = `0 0 ${newLWidth}px`;
                    if (index === 0) { rightBox.style.flex = `0 0 ${newRWidth}px`; }
                    this.resizeEditors();
                }
            };
            const upH = (ev) => { this.isDraggingH = false; blocker.style.display = 'none'; mainContainer.classList.remove('is-dragging-global'); resizer.releasePointerCapture(ev.pointerId); window.removeEventListener('pointermove', moveH); window.removeEventListener('pointerup', upH); };
            resizer.addEventListener('pointerdown', (e) => {
                this.isDraggingH = true;
                leftBox = resizer.previousElementSibling; rightBox = resizer.nextElementSibling;
                jsBox = document.querySelectorAll('.editor-box')[2];
                startX = e.clientX; startLWidth = leftBox.offsetWidth; startRWidth = rightBox.offsetWidth;
                const allBoxes = document.querySelectorAll('.editor-box');
                for(let i = 0; i <= index; i++) { allBoxes[i].style.flex = `0 0 ${allBoxes[i].offsetWidth}px`; }
                if (index === 0) { jsBox.style.flex = `0 0 ${jsBox.offsetWidth}px`; } else { jsBox.style.flex = "1"; }
                blocker.style.display = 'block'; mainContainer.classList.add('is-dragging-global');
                resizer.setPointerCapture(e.pointerId); window.addEventListener('pointermove', moveH, { passive: true }); window.addEventListener('pointerup', upH);
            });
        });
    },

    // --- HÀM RUN CẬP NHẬT ĐỂ NHÚNG CDN ---
    run() {
        const html = this.editors.html.getValue();
        const css = this.editors.css.getValue();
        const js = this.editors.js.getValue();
        const previewEl = document.getElementById('preview-window');
        if (!previewEl) return;

        // Chuyển mảng CDN thành thẻ link và script
        const externalCSS = this.externalResources.css.map(url => `<link rel="stylesheet" href="${url}">`).join('\n');
        const externalJS = this.externalResources.js.map(url => `<script src="${url}"><\/script>`).join('\n');

        const content = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;800&family=Geist:wght@100..900&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://unpkg.com/splitting/dist/splitting.css" />
            
            ${externalCSS}

            <style>body{margin:0;padding:15px;font-family: 'Poppins', sans-serif; color:white;} ${css}</style>
            <script>
                (function() {
                    ['log', 'warn', 'error', 'info'].forEach(method => {
                        const original = console[method];
                        console[method] = function(...args) {
                            window.parent.postMessage({ type: 'iframe-log', method, arguments: args }, '*');
                            original.apply(console, args);
                        };
                    });
                    window.addEventListener('message', (e) => {
                        if (e.data.type === 'exec-command') {
                            try {
                                const result = eval(e.data.command);
                                if (result !== undefined) console.log(result);
                            } catch (err) { console.error(err); }
                        }
                    });
                })();
            <\/script>
        </head>
        <body>
            ${html}
            
            <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"><\/script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"><\/script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/Draggable.min.js"><\/script>
            <script src="https://unpkg.com/splitting/dist/splitting.min.js"><\/script>

            ${externalJS}

            <script type="module">
                if (typeof Splitting !== 'undefined') Splitting();
                if (typeof gsap !== 'undefined') gsap.registerPlugin(ScrollTrigger, Draggable);
                ${js}
            <\/script>
        </body>
        </html>`;

        previewEl.srcdoc = content; 
    },

    clear() {
        Object.values(this.editors).forEach(ed => ed && ed.setValue("", 1));
        this.externalResources = { css: [], js: [] }; // Clear luôn CDN
        localStorage.removeItem(this.STORAGE_KEY);
        this.run();
    }
};

window.runCode = () => CodePen.run();
window.clearCode = () => CodePen.clear();
document.addEventListener('DOMContentLoaded', () => CodePen.init());