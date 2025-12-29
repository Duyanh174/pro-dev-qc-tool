const CodePen = {
    isDraggingV: false,
    isDraggingH: false,
    
    // Vertical states
    startY: 0,
    startTranslateY: 0,
    
    init() {
        const container = document.getElementById('codepen-container');
        if (!container) return;

        container.innerHTML = `
        <div class="codepen-container-main">
            <div class="editor-section-bg" id="editor-section">
                <div class="editor-box" style="flex: 1;"><div class="editor-label">HTML</div><textarea id="html-code" spellcheck="false" placeholder="<div>Hello</div>"></textarea></div>
                <div class="resizer-h horizontal-resizer"></div>
                <div class="editor-box" style="flex: 1;"><div class="editor-label">CSS</div><textarea id="css-code" spellcheck="false" placeholder="body{}"></textarea></div>
                <div class="resizer-h horizontal-resizer"></div>
                <div class="editor-box" style="flex: 1;"><div class="editor-label">JS</div><textarea id="js-code" spellcheck="false" placeholder="console.log()"></textarea></div>
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

        requestAnimationFrame(() => this.initResizers());
    },

    initResizers() {
        const vHandle = document.getElementById('main-vertical-resizer');
        const overlay = document.getElementById('preview-overlay-container');
        const blocker = document.getElementById('drag-blocker');
        const mainContainer = document.querySelector('.codepen-container-main');

        if (!vHandle || !overlay) return;

        // --- 1. KÉO DỌC (PREVIEW DRAWER) ---
        const moveV = (e) => {
            if (!this.isDraggingV) return;
            const deltaY = e.clientY - this.startY;
            let newY = this.startTranslateY + deltaY;

            // Giới hạn biên
            const minBound = 40;
            const maxBound = window.innerHeight - 60;
            if (newY < minBound) newY = minBound;
            if (newY > maxBound) newY = maxBound;

            overlay.style.transform = `translateY(${newY}px)`;
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

        // --- 2. KÉO NGANG (EDITORS WIDTH) - Tối ưu 1:1 ---
        const hResizers = document.querySelectorAll('.horizontal-resizer');
        hResizers.forEach(resizer => {
            let startX, startLWidth, startRWidth, leftBox, rightBox;

            const moveH = (ev) => {
                if (!this.isDraggingH) return;
                const deltaX = ev.clientX - startX;
                
                // Cập nhật trực tiếp bằng Flex-basis để đạt tốc độ 1:1
                const newLWidth = startLWidth + deltaX;
                const newRWidth = startRWidth - deltaX;

                if (newLWidth > 50 && newRWidth > 50) {
                    leftBox.style.flex = `0 0 ${newLWidth}px`;
                    rightBox.style.flex = `0 0 ${newRWidth}px`;
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
        const html = document.getElementById('html-code').value;
        const css = document.getElementById('css-code').value;
        const js = document.getElementById('js-code').value;
        const previewEl = document.getElementById('preview-window');
        if (!previewEl) return;

        const preview = previewEl.contentWindow.document;
        const content = `<!DOCTYPE html><html><head><style>body{margin:0;padding:15px;font-family:sans-serif;} ${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
        preview.open();
        preview.write(content);
        preview.close();
    },

    clear() {
        ['html-code', 'css-code', 'js-code'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        this.run();
    }
};

window.runCode = () => CodePen.run();
window.clearCode = () => CodePen.clear();

document.addEventListener('DOMContentLoaded', () => CodePen.init());