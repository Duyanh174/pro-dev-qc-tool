/**
 * CLIPBOARD MANAGER - FIXED UNIVERSAL PATH
 */
window.ClipboardFlow = {
    data: { recent: [], pinned: [] },
    lastContent: { text: '', image: '' },
    isWatcherStarted: false,

    init() {
        if (this.isWatcherStarted) return;
        const { clipboard } = require('electron');
        
        // Load data
        if (window.Knotion && window.Knotion.data && window.Knotion.data.clipboard) {
            this.data = window.Knotion.data.clipboard;
        } else {
            const saved = localStorage.getItem('knotion_clipboard');
            if (saved) this.data = JSON.parse(saved);
        }

        // Watcher loop
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

        this.isWatcherStarted = true;
        this.render();
    },

    addEntry(entry) {
        if (this.data.recent.length > 0 && this.data.recent[0].content === entry.content) return;
        if (this.data.pinned.some(i => i.content === entry.content)) return;

        entry.id = Date.now();
        entry.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.data.recent.unshift(entry);
        if (this.data.recent.length > 15) this.data.recent.pop();
        this.saveAndRefresh();
    },

    saveAndRefresh() {
        if (window.Knotion) {
            if (!window.Knotion.data) window.Knotion.data = {};
            window.Knotion.data.clipboard = this.data;
            window.Knotion.saveData();
        }
        localStorage.setItem('knotion_clipboard', JSON.stringify(this.data));
        this.updateUI();
    },

    // --- HÀM RENDER ĐÃ FIX LỖI ĐƯỜNG DẪN ---
    render() {
        const container = document.getElementById('clipboard-container');
        if (!container) return;

        const fs = require('fs');
        const path = require('path');
        
        // Mảng các đường dẫn khả thi (Thử từng cái một)
        const possiblePaths = [
            path.join(__dirname, 'features', 'clipboard.html'), // Nếu chạy từ standalone
            path.join(__dirname, '..', 'ui', 'features', 'clipboard.html'), // Nếu chạy từ renderer/
            path.join(__dirname, 'ui', 'features', 'clipboard.html'), // Nếu gốc là src/
            '/Users/anh.bui/Documents/pro-dev-qc-tool/src/ui/features/clipboard.html' // Tuyệt đối (chỉ để debug)
        ];

        let uiPath = "";
        for (let p of possiblePaths) {
            if (fs.existsSync(p)) {
                uiPath = p;
                break;
            }
        }

        if (container.innerHTML.trim() === "") {
            if (uiPath) {
                try {
                    container.innerHTML = fs.readFileSync(uiPath, 'utf8');
                    console.log("Clipboard UI loaded from:", uiPath);
                } catch (err) {
                    console.error("Lỗi đọc file UI:", err);
                }
            } else {
                console.error("KHÔNG TÌM THẤY FILE clipboard.html ở bất kỳ đâu!");
                // Hiển thị thông báo lỗi lên giao diện để người dùng biết
                container.innerHTML = `<div style="color:red; padding:20px;">Error: UI file not found. Checked: ${possiblePaths.join('<br>')}</div>`;
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

    renderListItems(id, items, type) {
        const container = document.getElementById(id);
        if (items.length === 0) {
            container.innerHTML = `<div class="cb-empty">Trống</div>`;
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="cb-item">
                <div class="cb-item-body" onclick="ClipboardFlow.copyToSystem(this.parentElement, '${item.type}')">
                    ${item.type === 'text' 
                        ? `<span class="cb-text">${item.content.replace(/</g, "&lt;")}</span>` 
                        : `<img src="${item.content}" class="cb-img">`}
                </div>
                <div class="cb-item-actions">
                    <button class="cb-btn-icon cb-btn-copy" onclick="ClipboardFlow.copyToSystem(this.parentElement.parentElement, '${item.type}')">
                        COPY
                    </button>
                    <button class="cb-btn-icon" onclick="event.stopPropagation(); ClipboardFlow.${type === 'recent' ? 'pinItem' : 'unpinItem'}(${item.id})">
                        ${type === 'recent' ? '📌' : '📍'}
                    </button>
                    <button class="cb-btn-icon" onclick="event.stopPropagation(); ClipboardFlow.deleteItem(${item.id}, '${type}')">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    },

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
            item.style.display = item.innerText.toLowerCase().includes(q) ? 'flex' : 'none';
        });
    },

    toggleFloatingMode(checked) {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('toggle-clipboard-window', checked);
    }
};

// Khởi chạy
ClipboardFlow.init();

// Hook vào hàm showTab có sẵn
const originalShowTabCb = window.showTab;
window.showTab = function(tabName) {
    if (typeof originalShowTabCb === 'function') originalShowTabCb(tabName);
    if (tabName === 'clipboard') {
        setTimeout(() => ClipboardFlow.render(), 10);
    }
};