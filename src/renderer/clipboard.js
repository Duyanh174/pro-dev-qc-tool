/**
 * CLIPBOARD MANAGER - UNIVERSAL SYNC & RENDER (EXPANDABLE ITEMS)
 */
window.ClipboardFlow = {
    data: { recent: [], pinned: [] },
    lastContent: { text: '', image: '' },
    isWatcherStarted: false,

    // 1. KHỞI TẠO THEO DÕI
    init() {
        if (this.isWatcherStarted) return;
        const { clipboard, ipcRenderer } = require('electron');
        
        this.loadData();

        // Theo dõi clipboard hệ thống (Cmd+C)
        setInterval(() => {
            const text = clipboard.readText();
            const image = clipboard.readImage();
            const imageHtml = image.isEmpty() ? '' : image.toDataURL();

            if (text && text !== this.lastContent.text) {
                this.lastContent.text = text;
                this.addEntry({ type: 'text', content: text });
            } else if (imageHtml && imageHtml !== this.lastContent.image) {
                this.lastContent.image = imageHtml;
                this.addEntry({ type: 'image', content: imageHtml });
            }
        }, 1000);

        // SYNC: Xoá/Ghim đồng bộ giữa các cửa sổ
        window.addEventListener('storage', (e) => {
            if (e.key === 'knotion_clipboard') {
                this.loadData();
                this.updateUI();
            }
        });

        // SYNC: Gạt Switch Toggle ở app chính khi đóng/mở window
        ipcRenderer.on('clipboard-window-status', (event, isActive) => {
            const toggle = document.getElementById('cb-mode-switch');
            if (toggle) toggle.checked = isActive;
        });

        this.isWatcherStarted = true;
        this.render();
    },

    loadData() {
        const saved = localStorage.getItem('knotion_clipboard');
        if (saved) {
            this.data = JSON.parse(saved);
            if (window.Knotion && window.Knotion.data) {
                window.Knotion.data.clipboard = this.data;
            }
        } else if (window.Knotion && window.Knotion.data && window.Knotion.data.clipboard) {
            this.data = window.Knotion.data.clipboard;
        }
    },

    // 2. XỬ LÝ DỮ LIỆU
    addEntry(entry) {
        if (this.data.recent.length > 0 && this.data.recent[0].content === entry.content) return;
        if (this.data.pinned.some(i => i.content === entry.content)) return;

        entry.id = Date.now();
        this.data.recent.unshift(entry);
        if (this.data.recent.length > 15) this.data.recent.pop();
        this.saveAndRefresh();
    },

    saveAndRefresh() {
        localStorage.setItem('knotion_clipboard', JSON.stringify(this.data));
        if (window.Knotion) {
            if (!window.Knotion.data) window.Knotion.data = {};
            window.Knotion.data.clipboard = this.data;
            window.Knotion.saveData();
        }
        this.updateUI();
    },

    // 3. RENDER UI
    render() {
        const container = document.getElementById('clipboard-container');
        if (!container) return;

        const fs = require('fs');
        const path = require('path');
        
        const pathFromMain = path.resolve(__dirname, '..', 'ui', 'features', 'clipboard.html');
        const pathStandalone = path.join(__dirname, 'clipboard.html');
        const pathStandaloneAlt = path.resolve(__dirname, 'features', 'clipboard.html');

        let uiPath = "";
        if (fs.existsSync(pathFromMain)) uiPath = pathFromMain;
        else if (fs.existsSync(pathStandalone)) uiPath = pathStandalone;
        else if (fs.existsSync(pathStandaloneAlt)) uiPath = pathStandaloneAlt;

        if (container.innerHTML.trim() === "") {
            if (uiPath) {
                try {
                    container.innerHTML = fs.readFileSync(uiPath, 'utf8');
                } catch (err) { console.error("Read UI Error:", err); }
            } else {
                container.innerHTML = `<div style="color:red; padding:20px; font-size:12px;">UI file not found.</div>`;
            }
        }
        this.updateUI();
    },

    updateUI() {
        const rList = document.getElementById('cb-recent-list');
        const pList = document.getElementById('cb-pinned-list');
        if (!rList || !pList) return;

        this.renderListItems('cb-recent-list', this.data.recent, 'recent');
        this.renderListItems('cb-pinned-list', this.data.pinned, 'pinned');
        
        const rc = document.getElementById('recent-count');
        const pc = document.getElementById('pin-count');
        if (rc) rc.innerText = this.data.recent.length;
        if (pc) pc.innerText = this.data.pinned.length;
    },

    // SỬA ĐỔI TẠI ĐÂY: onclick gọi toggleExpand thay vì copyToSystem trực tiếp
    renderListItems(id, items, type) {
        const container = document.getElementById(id);
        if (items.length === 0) {
            container.innerHTML = `<div class="cb-empty">Trống</div>`;
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="cb-item">
                <div class="cb-item-body" onclick="ClipboardFlow.toggleExpand(this)">
                    ${item.type === 'text' 
                        ? `<span class="cb-text">${item.content.replace(/</g, "&lt;")}</span>` 
                        : `<img src="${item.content}" class="cb-img">`}
                </div>
                <div class="cb-item-actions">
                    <button class="cb-btn-copy" onclick="ClipboardFlow.copyToSystem(this.parentElement.parentElement, '${item.type}')">
                        COPY
                    </button>
                    <button class="cb-btn-icon" onclick="event.stopPropagation(); ClipboardFlow.${type === 'recent' ? 'pinItem' : 'unpinItem'}(${item.id})">
                        ${type === 'recent' ? '📌' : '📍'}
                    </button>
                    <button class="cb-btn-icon delete" onclick="event.stopPropagation(); ClipboardFlow.deleteItem(${item.id}, '${type}')">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    },

    // THÊM MỚI: Logic hiển thị toàn bộ nội dung
    toggleExpand(el) {
        const textEl = el.querySelector('.cb-text');
        if (textEl) {
            // Toggle class 'expanded'
            const isExpanded = textEl.classList.toggle('is-expanded');
            // Inline style fallback if CSS is not loaded
            textEl.style.whiteSpace = isExpanded ? 'normal' : 'nowrap';
            textEl.style.webkitLineClamp = isExpanded ? 'unset' : '1';
        }
    },

    // 4. THAO TÁC HỆ THỐNG
    copyToSystem(el, type) {
        const { clipboard, nativeImage } = require('electron');
        try {
            if (type === 'text') {
                const text = el.querySelector('.cb-text').innerText;
                clipboard.writeText(text);
            } else {
                const imgData = el.querySelector('.cb-img').src;
                clipboard.writeImage(nativeImage.createFromDataURL(imgData));
            }
            el.style.borderColor = "#34c759";
            setTimeout(() => el.style.borderColor = "#f2f2f7", 500);
        } catch (e) { console.error(e); }
    },

    pinItem(id) {
        const idx = this.data.recent.findIndex(i => i.id === id);
        if (idx > -1) {
            const item = this.data.recent.splice(idx, 1)[0];
            this.data.pinned.unshift(item);
            this.saveAndRefresh();
        }
    },

    unpinItem(id) {
        const idx = this.data.pinned.findIndex(i => i.id === id);
        if (idx > -1) {
            const item = this.data.pinned.splice(idx, 1)[0];
            this.data.recent.unshift(item);
            this.saveAndRefresh();
        }
    },

    deleteItem(id, listType) {
        this.data[listType] = this.data[listType].filter(i => i.id !== id);
        this.saveAndRefresh();
    },

    clearRecent() {
        if (this.data.recent.length > 0 && confirm("Xoá sạch Gần đây?")) {
            this.data.recent = [];
            this.saveAndRefresh();
        }
    },

    performSearch() {
        const q = document.getElementById('cb-search').value.toLowerCase();
        document.querySelectorAll('.cb-item').forEach(item => {
            const isMatch = item.innerText.toLowerCase().includes(q);
            item.style.display = isMatch ? 'flex' : 'none';
        });
    },

    toggleFloatingMode(checked) {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('toggle-clipboard-window', checked);
    }
};

// Khởi chạy
ClipboardFlow.init();

// Hook vào hàm chuyển tab của ứng dụng chính
const originalShowTabBase = window.showTab;
window.showTab = function(tabName) {
    if (typeof originalShowTabBase === 'function') originalShowTabBase(tabName);
    if (tabName === 'clipboard') {
        setTimeout(() => ClipboardFlow.render(), 10);
    }
};