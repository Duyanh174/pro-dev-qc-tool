const CodePen = {
    isDraggingV: false,
    isDraggingH: false,
    startY: 0,
    startTranslateY: 0,
    
    // Biến quản lý Auto Run
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

        // Render HTML Structure
        container.innerHTML = `
        <div class="codepen-container-main">
            <div class="editor-section-bg" id="editor-section">
                <div class="editor-box" style="flex: 1;">
                    <div class="editor-label">HTML</div>
                    <div id="html-code" class="ace-editor-container"></div>
                </div>
                <div class="resizer-h horizontal-resizer"></div>
                <div class="editor-box" style="flex: 1;">
                    <div class="editor-label">CSS</div>
                    <div id="css-code" class="ace-editor-container"></div>
                </div>
                <div class="resizer-h horizontal-resizer"></div>
                <div class="editor-box" style="flex: 1;">
                    <div class="editor-label">JS</div>
                    <div id="js-code" class="ace-editor-container"></div>
                </div>
            </div>
            <div class="preview-sliding-overlay" id="preview-overlay-container">
                <div class="resizer-v-handle" id="main-vertical-resizer"><div class="handle-line"></div></div>
                <div class="preview-content-wrapper">
                    <div class="preview-actions">
                        <button class="action-btn btn-success" onclick="runCode()">▶ RUN</button>
                        
                        <label class="toggle-control">
                            <input type="checkbox" id="auto-run-toggle">
                            <span class="control"></span>
                            <span class="label">Auto Run</span>
                        </label>

                        <div style="flex:1"></div>

                        <button class="action-btn btn-secondary" onclick="clearCode()">🗑 Clear</button>
                    </div>
                    <div class="preview-frame-container">
                        <div id="drag-blocker"></div>
                        <iframe id="preview-window"></iframe>
                    </div>
                </div>
            </div>
        </div>`;

        const overlay = document.getElementById('preview-overlay-container');
        overlay.style.transform = `translateY(45vh)`;

        // Sự kiện Toggle Auto Run
        const toggleBtn = document.getElementById('auto-run-toggle');
        if(toggleBtn) {
            toggleBtn.addEventListener('change', (e) => {
                this.autoRunEnabled = e.target.checked;
                if (this.autoRunEnabled) this.run();
            });
        }

        this.initAce();
        
        requestAnimationFrame(() => this.initResizers());
    },

    initAce() {
        // --- CẤU HÌNH TỐI ƯU SCROLL ---
        const config = {
            theme: "ace/theme/monokai",
            fontSize: "13px",
            useSoftTabs: true,
            showPrintMargin: false,
            wrap: true,              
            indentedSoftWrap: false, 
            useWorker: false,
            
            // [FIX] Scroll Mượt & Không bị che code
            animatedScroll: true,    // Giúp hiệu ứng cuộn mượt hơn
            scrollPastEnd: 0.9,      // [QUAN TRỌNG] Cho phép cuộn quá dòng cuối 90% chiều cao view.
                                     // Giúp đẩy code lên trên khỏi vùng bị Preview che.
            vScrollBarAlwaysVisible: false, // Ẩn thanh cuộn khi không cần thiết cho gọn
        };

        const setupEditor = (id, mode, initialValue) => {
            const editor = ace.edit(id);
            editor.setOptions(config);
            editor.session.setMode(`ace/mode/${mode}`);
            editor.setValue(initialValue, 1);
            
            // Xử lý Auto Run
            editor.session.on('change', () => {
                this.triggerAutoRun();
            });
            
            // Tối ưu render khi cuộn
            editor.renderer.setScrollMargin(10, 10); // Thêm padding trên/dưới cho vùng scroll

            return editor;
        };

        this.editors.html = setupEditor("html-code", "html", "<div>\n  <h1>Hello World</h1>\n  <p>Thử cuộn xuống dưới cùng xem!</p>\n  <p>Dòng code cuối sẽ không bị che nữa.</p>\n</div>");
        this.editors.css = setupEditor("css-code", "css", "body {\n  color: #00bcd4;\n  font-family: sans-serif;\n  padding: 20px;\n  line-height: 1.6;\n}");
        this.editors.js = setupEditor("js-code", "javascript", "console.log('CodePen Ready');\n\n// Viết thêm nhiều dòng để test scroll\n// ...\n// ...\nconsole.log('End');");
    },

    triggerAutoRun() {
        if (!this.autoRunEnabled) return;
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.run();
        }, 800);
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
        const content = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>body{margin:0;padding:15px;font-family:sans-serif;} ${css}</style>
            </head>
            <body>
                ${html}
                <script>
                    try { ${js} } catch (err) {
                        console.error(err);
                        document.body.innerHTML += '<div style="color:red; margin-top:20px; border-top:1px solid #ddd; padding-top:10px;">JS Error: ' + err.message + '</div>';
                    }
                <\/script>
            </body>
            </html>`;
            
        preview.open();
        preview.write(content);
        preview.close();
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