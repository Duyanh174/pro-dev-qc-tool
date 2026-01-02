const CodePen = {
    isDraggingV: false,
    isDraggingH: false,
    startY: 0,
    startTranslateY: 0,
    autoRunEnabled: false, 
    debounceTimer: null,

    editors: {
        html: null,
        css: null,
        js: null
    },

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
        
        <button class="action-btn btn-secondary" onclick="clearCode()">🗑 Clear</button>
    </div>
            <div class="editor-section-bg" id="editor-section">
                <div class="editor-box" style="flex: 1;">
                    <div class="editor-label">
                        <span>HTML</span>
                        <button class="format-btn" onclick="CodePen.formatCode('html')">Format</button>
                    </div>
                    <div class="editor-content-wrapper">
                        <div id="html-gutter" class="custom-line-numbers"></div>
                        <div id="html-code" class="ace-editor-container"></div>
                    </div>
                </div>
                <div class="resizer-h horizontal-resizer"></div>

                <div class="editor-box" style="flex: 1;">
                    <div class="editor-label">
                        <span>CSS</span>
                        <button class="format-btn" onclick="CodePen.formatCode('css')">Format</button>
                    </div>
                    <div class="editor-content-wrapper">
                        <div id="css-gutter" class="custom-line-numbers"></div>
                        <div id="css-code" class="ace-editor-container"></div>
                    </div>
                </div>
                <div class="resizer-h horizontal-resizer"></div>

                <div class="editor-box" style="flex: 1;">
                    <div class="editor-label">
                        <span>JS</span>
                        <button class="format-btn" onclick="CodePen.formatCode('js')">Format</button>
                    </div>
                    <div class="editor-content-wrapper">
                        <div id="js-gutter" class="custom-line-numbers"></div>
                        <div id="js-code" class="ace-editor-container"></div>
                    </div>
                </div>
            </div>
            
            <div class="preview-sliding-overlay" id="preview-overlay-container">
                <div class="resizer-v-handle" id="main-vertical-resizer"><div class="handle-line"></div></div>
                <div class="preview-content-wrapper">
                    <div class="preview-frame-container">
                        <div id="drag-blocker"></div>
                        <iframe id="preview-window"></iframe>
                    </div>
                </div>
            </div>
        </div>`;

        const overlay = document.getElementById('preview-overlay-container');
        const defaultY = window.innerHeight * 0.45;
        overlay.style.transform = `translateY(${defaultY}px)`;

        const toggleBtn = document.getElementById('auto-run-toggle');
        if(toggleBtn) {
            toggleBtn.addEventListener('change', (e) => {
                this.autoRunEnabled = e.target.checked;
                if (this.autoRunEnabled) this.run();
            });
        }

        this.initAce();
        this.updateScrollMargins(defaultY);
        requestAnimationFrame(() => this.initResizers());
    },

    // --- HÀM FORMAT CODE MỚI ---
    formatCode(type) {
        const editor = this.editors[type];
        if (!editor || typeof prettier === 'undefined') return;

        const rawCode = editor.getValue();
        let formatted = "";

        try {
            const options = {
                parser: type === "js" ? "babel" : (type === "css" ? "css" : "html"),
                plugins: prettierPlugins,
                printWidth: 80,
                tabWidth: 2,
                semi: true,
                singleQuote: false,
            };

            formatted = prettier.format(rawCode, options);
            editor.setValue(formatted, 1); // 1: đưa con trỏ về đầu
        } catch (err) {
            console.error("Format error:", err);
            alert("Mã nguồn hiện tại có lỗi, không thể định dạng!");
        }
    },

    initAce() {
        const config = {
            theme: "ace/theme/monokai",
            fontSize: "13px",
            useSoftTabs: true,
            showPrintMargin: false,
            showGutter: false,
            wrap: true,              
            indentedSoftWrap: false, 
            useWorker: false,
            animatedScroll: true,    
            scrollbarHandler: "native",
            scrollPastEnd: 0,
            minLines: 50,
            maxLines: Infinity,
            showFoldWidgets: true
        };

        const themeSelector = document.getElementById('theme-selector');
if(themeSelector) {
    themeSelector.addEventListener('change', (e) => {
        const theme = e.target.value;
        Object.values(this.editors).forEach(editor => {
            if (editor) editor.setTheme(theme);
        });
    });
}

        const setupEditor = (id, gutterId, mode, initialValue) => {
            const editor = ace.edit(id);
            const gutterEl = document.getElementById(gutterId);
            
            editor.setOptions(config);
            editor.session.setMode(`ace/mode/${mode}`);
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

                        numbersHtml += `<div class="line-number-row" style="height: ${rowHeight}px; line-height: ${lineHeight}px;">
                            ${foldBtn}<span class="num-text">${i + 1}</span>
                        </div>`;
                    }
                }
                gutterEl.innerHTML = numbersHtml;
            };

            gutterEl.onclick = (e) => {
                if (e.target.classList.contains('fold-icon')) {
                    const row = parseInt(e.target.getAttribute('data-row'));
                    editor.session.toggleFold(row);
                }
            };

            editor.renderer.on('afterRender', () => {
                const scrollTop = editor.renderer.getScrollTop();
                gutterEl.style.transform = `translateY(${-scrollTop}px)`;
            });

            editor.session.on('change', () => {
                updateLineNumbers();
                this.triggerAutoRun();
            });

            editor.session.on('changeWrapLimit', updateLineNumbers);
            editor.session.on('changeFold', updateLineNumbers);

            setTimeout(updateLineNumbers, 100);
            return editor;
        };

        this.editors.html = setupEditor("html-code", "html-gutter", "html", "<div>\n<h1>Hello</h1>\n</div>");
        this.editors.css = setupEditor("css-code", "css-gutter", "css", "body{color:cyan;}");
        this.editors.js = setupEditor("js-code", "js-gutter", "javascript", "function test(){console.log('ready')}");
    },

    updateScrollMargins(currentTranslateY) {
        const bottomReservedSpace = window.innerHeight - currentTranslateY;
        Object.values(this.editors).forEach(editor => {
            if (editor) {
                editor.renderer.setScrollMargin(10, bottomReservedSpace + 20, 10, 10);
            }
        });
    },

    triggerAutoRun() {
        if (!this.autoRunEnabled) return;
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.run(), 800);
    },

    resizeEditors() {
        Object.values(this.editors).forEach(editor => {
            if (editor) editor.resize();
        });
    },

    initResizers() {
        const vHandle = document.getElementById('main-vertical-resizer');
        const overlay = document.getElementById('preview-overlay-container');
        const blocker = document.getElementById('drag-blocker');
        const mainContainer = document.querySelector('.codepen-container-main');

        if (!vHandle || !overlay) return;

        const moveV = (e) => {
            if (!this.isDraggingV) return;
            const deltaY = e.clientY - this.startY;
            let newY = this.startTranslateY + deltaY;
            const minBound = 40;
            const maxBound = window.innerHeight - 60;
            if (newY < minBound) newY = minBound;
            if (newY > maxBound) newY = maxBound;
            overlay.style.transform = `translateY(${newY}px)`;
            this.updateScrollMargins(newY);
            this.resizeEditors();
        };

        const upV = (e) => {
            this.isDraggingV = false;
            blocker.style.display = 'none';
            mainContainer.classList.remove('is-dragging-global');
            vHandle.releasePointerCapture(e.pointerId);
            window.removeEventListener('pointermove', moveV);
            window.removeEventListener('pointerup', upV);
        };

        vHandle.addEventListener('pointerdown', (e) => {
            this.isDraggingV = true;
            this.startY = e.clientY;
            const style = window.getComputedStyle(overlay);
            const matrix = new WebKitCSSMatrix(style.transform);
            this.startTranslateY = matrix.m42;
            blocker.style.display = 'block';
            mainContainer.classList.add('is-dragging-global');
            vHandle.setPointerCapture(e.pointerId);
            window.addEventListener('pointermove', moveV, { passive: true });
            window.addEventListener('pointerup', upV);
        });

        const hResizers = document.querySelectorAll('.horizontal-resizer');
        hResizers.forEach(resizer => {
            let startX, startLWidth, startRWidth, leftBox, rightBox;
            const moveH = (ev) => {
                if (!this.isDraggingH) return;
                const deltaX = ev.clientX - startX;
                const newLWidth = startLWidth + deltaX;
                const newRWidth = startRWidth - deltaX;
                if (newLWidth > 50 && newRWidth > 50) {
                    leftBox.style.flex = `0 0 ${newLWidth}px`;
                    rightBox.style.flex = `0 0 ${newRWidth}px`;
                    this.resizeEditors();
                }
            };
            const upH = (ev) => {
                this.isDraggingH = false;
                blocker.style.display = 'none';
                mainContainer.classList.remove('is-dragging-global');
                resizer.releasePointerCapture(ev.pointerId);
                window.removeEventListener('pointermove', moveH);
                window.removeEventListener('pointerup', upH);
            };
            resizer.addEventListener('pointerdown', (e) => {
                this.isDraggingH = true;
                leftBox = resizer.previousElementSibling;
                rightBox = resizer.nextElementSibling;
                startX = e.clientX;
                startLWidth = leftBox.offsetWidth;
                startRWidth = rightBox.offsetWidth;
                blocker.style.display = 'block';
                mainContainer.classList.add('is-dragging-global');
                resizer.setPointerCapture(e.pointerId);
                window.addEventListener('pointermove', moveH, { passive: true });
                window.addEventListener('pointerup', upH);
            });
        });
    },

    run() {
        const html = this.editors.html.getValue();
        const css = this.editors.css.getValue();
        const js = this.editors.js.getValue();
        const previewEl = document.getElementById('preview-window');
        if (!previewEl) return;
        const preview = previewEl.contentWindow.document;
        const content = `<!DOCTYPE html><html><head><style>body{margin:0;padding:15px;font-family:sans-serif;} ${css}</style></head><body>${html}<script>try { ${js} } catch (err) { console.error(err); }<\/script></body></html>`;
        preview.open(); preview.write(content); preview.close();
    },

    clear() {
        this.editors.html.setValue("");
        this.editors.css.setValue("");
        this.editors.js.setValue("");
        this.run();
    }
};

window.runCode = () => CodePen.run();
window.clearCode = () => CodePen.clear();
document.addEventListener('DOMContentLoaded', () => CodePen.init());