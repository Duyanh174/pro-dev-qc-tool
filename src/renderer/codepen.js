const CodePen = {
    isDraggingV: false,
    isDraggingH: false,
    startY: 0,
    startTranslateY: 0,
    // Lưu trữ các instance của Ace
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
            <div class="editor-section-bg" id="editor-section">
                <div class="editor-box" style="flex: 1;"><div class="editor-label">HTML</div><div id="html-code" class="ace-editor-container"></div></div>
                <div class="resizer-h horizontal-resizer"></div>
                <div class="editor-box" style="flex: 1;"><div class="editor-label">CSS</div><div id="css-code" class="ace-editor-container"></div></div>
                <div class="resizer-h horizontal-resizer"></div>
                <div class="editor-box" style="flex: 1;"><div class="editor-label">JS</div><div id="js-code" class="ace-editor-container"></div></div>
            </div>
            <div class="preview-sliding-overlay" id="preview-overlay-container">
                <div class="resizer-v-handle" id="main-vertical-resizer"><div class="handle-line"></div></div>
                <div class="preview-content-wrapper">
                    <div class="preview-actions">
                        <button class="action-btn btn-success" onclick="runCode()">▶ RUN PREVIEW</button>
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

        // Khởi tạo Ace Editor
        this.initAce();
        
        requestAnimationFrame(() => this.initResizers());
    },

    initAce() {
        const config = {
            theme: "ace/theme/monokai",
            fontSize: "13px",
            useSoftTabs: true,
            showPrintMargin: false,
            // --- HAI DÒNG QUAN TRỌNG NHẤT ---
            wrap: true,              // Bật tự động xuống dòng khi thiếu chiều rộng
            indentedSoftWrap: false, // Tối ưu: không thụt lề dòng mới giúp scroll và resize mượt hơn
            // -------------------------------
            useWorker: false,        // Tối ưu: tắt background worker nếu không cần kiểm tra lỗi cú pháp gắt gao
        };

        this.editors.html = ace.edit("html-code");
        this.editors.html.setOptions(config);
        this.editors.html.session.setMode("ace/mode/html");
        this.editors.html.setValue("<div>Hello World, kéo thử width của tôi để xem dòng này tự xuống hàng nhé!</div>", 1);
        this.editors.css = ace.edit("css-code");
        this.editors.css.setOptions(config);
        this.editors.css.session.setMode("ace/mode/css");
        this.editors.css.setValue("body { color: red; }", 1);

        this.editors.js = ace.edit("js-code");
        this.editors.js.setOptions(config);
        this.editors.js.session.setMode("ace/mode/javascript");
        this.editors.js.setValue("console.log('Hello CodePen');", 1);
    },

    // Hàm gọi resize cho tất cả editor
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
            
            // Cập nhật lại kích thước editor khi kéo drawer lên xuống
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
                    
                    // QUAN TRỌNG: Resize Ace ngay lập tức khi kéo ngang
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
        // Lấy giá trị từ Ace thay vì textarea
        const html = this.editors.html.getValue();
        const css = this.editors.css.getValue();
        const js = this.editors.js.getValue();
        
        const previewEl = document.getElementById('preview-window');
        if (!previewEl) return;

        const preview = previewEl.contentWindow.document;
        const content = `<!DOCTYPE html><html><head><style>body{margin:0;padding:15px;font-family:sans-serif;} ${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
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