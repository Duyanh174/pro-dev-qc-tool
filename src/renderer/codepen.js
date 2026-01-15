// --- THÔNG TIN SUPABASE (PHẢI THAY BẰNG KEY THẬT) ---
const SUPABASE_URL = "https://pzqwnosbwznoksyervxk.supabase.co";
const SUPABASE_KEY = "sb_publishable_HyyqMob18yaCwb-GPeakJA__XOO_YU3";
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dpn8hugjc/image/upload";
const CLOUDINARY_PRESET = "codepen_preset";

const CodePenStorage = {
    currentSnippets: [],
    localSnippets: [],
    selectedImageFile: null,
    currentEditId: null,
    currentName: "Untitled",
    storageMode: "cloud", 
    libraryTab: "cloud",

    authCallback: null,
    pendingSnippet: null,
    LOCAL_KEY: "codepen_local_library",

    // 1. QUẢN LÝ LOCAL
    saveToLocalStorage(item) {
        let localData = JSON.parse(localStorage.getItem(this.LOCAL_KEY) || "[]");
        if (item.id && localData.find(i => i.id === item.id)) {
            localData = localData.map(i => i.id === item.id ? item : i);
        } else {
            item.id = "local_" + Date.now();
            localData.unshift(item);
        }
        localStorage.setItem(this.LOCAL_KEY, JSON.stringify(localData));
        this.loadLocalLibrary();
    },

    loadLocalLibrary() {
        this.localSnippets = JSON.parse(localStorage.getItem(this.LOCAL_KEY) || "[]");
    },

    // 2. HEARTBEAT
    async keepAlive() {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/snippets?select=id&limit=1`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
        } catch (e) { console.warn("Cloud disconnected"); }
    },

    // 3. NÉN ẢNH
    async compressImage(base64Str, maxWidth = 800, quality = 0.7) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width; let height = img.height;
                if (width > maxWidth) { height = (maxWidth / width) * height; width = maxWidth; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        });
    },

    // ĐỒNG BỘ TÊN Ở MỌI NƠI
    updateNameUI() {
        const headerInput = document.getElementById('active-snippet-name');
        const modalInput = document.getElementById('snippet-name-input');
        if (headerInput) headerInput.value = this.currentName;
        if (modalInput) modalInput.value = this.currentName;
    },

    // 4. XÁC THỰC
    requestAccess(snippet, callback) {
        if (String(snippet.id).startsWith("local_") || !snippet.password || snippet.password.trim() === "") {
            return callback();
        }
        this.pendingSnippet = snippet;
        this.authCallback = callback;
        const overlay = document.getElementById('auth-modal-overlay');
        document.getElementById('auth-msg').innerText = `Snippet của ${snippet.author_name || 'Admin'}`;
        document.getElementById('auth-pass-input').value = "";
        overlay.style.display = 'flex';
        document.getElementById('auth-pass-input').focus();
    },

    verifyAuth() {
        const input = document.getElementById('auth-pass-input').value;
        if (input === CodePenStorage.pendingSnippet.password) {
            document.getElementById('auth-modal-overlay').style.display = 'none';
            if (CodePenStorage.authCallback) CodePenStorage.authCallback();
        } else { alert("Sai mật khẩu!"); }
    },

    showForgotPass() { alert("Nhắn tin hoặc gặp Duy Anh để lấy lại pass =)))"); },

    // 5. LOGIC CAPTURE (SỬA LỖI RESET VÀ LỆCH VÙNG)
    startCaptureMode() {
        const overlay = document.getElementById('capture-overlay');
        const selection = document.getElementById('selection-box');
        const previewFrame = document.getElementById('preview-window');

        // Ghi nhớ trạng thái trước khi ẩn
        this.currentName = document.getElementById('snippet-name-input').value;
        const authorVal = document.getElementById('author-name-input').value;
        if (authorVal) localStorage.setItem('last_author', authorVal);

        document.getElementById('save-modal-overlay').style.display = 'none'; 
        overlay.style.display = 'block';

        let startX, startY, isDragging = false;
        overlay.onmousedown = (e) => {
            isDragging = true; startX = e.offsetX; startY = e.offsetY;
            selection.style.left = startX + 'px'; selection.style.top = startY + 'px';
            selection.style.width = '0'; selection.style.height = '0'; selection.style.display = 'block';
        };
        overlay.onmousemove = (e) => {
            if (!isDragging) return;
            selection.style.width = Math.abs(e.offsetX - startX) + 'px';
            selection.style.height = Math.abs(e.offsetY - startY) + 'px';
            selection.style.left = Math.min(startX, e.offsetX) + 'px';
            selection.style.top = Math.min(startY, e.offsetY) + 'px';
        };
        overlay.onmouseup = async () => {
            isDragging = false;
            const rect = selection.getBoundingClientRect();
            overlay.style.display = 'none'; selection.style.display = 'none';
            if (rect.width < 5) { this.openSaveModal(); return; }

            try {
                const frameDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
                // Fix độ lệch bằng cách tính toán chính xác scroll
                const rawBase64 = await modernScreenshot.domToJpeg(frameDoc.body, {
                    quality: 0.9,
                    width: rect.width,
                    height: rect.height,
                    style: {
                        transform: `translate(-${startX}px, -${startY}px)`,
                        width: frameDoc.body.scrollWidth + 'px',
                        height: frameDoc.body.scrollHeight + 'px'
                    }
                });
                this.selectedImageFile = await this.compressImage(rawBase64);
                document.getElementById('image-preview-element').src = this.selectedImageFile;
                document.getElementById('image-preview-element').style.display = 'block';
            } catch (e) { console.error(e); } finally { this.openSaveModal(); }
        };
    },

    // 6. MODAL LƯU (PHÂN BIỆT SITE)
    switchStorageMode(mode) {
        this.storageMode = mode;
        const passSection = document.getElementById('password-section');
        const cloudBtn = document.getElementById('mode-cloud-btn');
        const localBtn = document.getElementById('mode-local-btn');
        const modalWrap = document.querySelector('.save-modal');
        const updateBtn = document.querySelector('.btn-update-existing');

        if (mode === 'local') {
            passSection.style.display = 'none';
            localBtn.classList.add('active'); cloudBtn.classList.remove('active');
            modalWrap.style.borderTopColor = '#007acc';
        } else {
            passSection.style.display = 'block';
            cloudBtn.classList.add('active'); localBtn.classList.remove('active');
            modalWrap.style.borderTopColor = '#28a745';
        }

        // Logic ẩn nút Cập nhật nếu site lưu trữ không khớp site nguồn
        if (this.currentEditId && updateBtn) {
            const isLocalId = String(this.currentEditId).startsWith("local_");
            if ((mode === 'cloud' && isLocalId) || (mode === 'local' && !isLocalId)) {
                updateBtn.style.display = 'none';
            } else {
                updateBtn.style.display = 'inline-block';
            }
        }
    },

    openSaveModal() {
        document.getElementById('save-modal-overlay').style.display = 'flex';
        this.updateNameUI(); // Đảm bảo tên đồng bộ khi mở

        const editGroup = document.getElementById('edit-actions-group');
        const newGroup = document.getElementById('new-actions-group');
        const imgPrev = document.getElementById('image-preview-element');

        if (this.currentEditId) {
            const isLocalId = String(this.currentEditId).startsWith("local_");
            this.switchStorageMode(this.storageMode); // Dùng mode hiện tại đang chọn
            editGroup.style.display = 'flex'; newGroup.style.display = 'none';
            
            const item = isLocalId ? this.localSnippets.find(s => s.id === this.currentEditId) : this.currentSnippets.find(s => s.id === this.currentEditId);
            if (item && item.image_url && !this.selectedImageFile) {
                imgPrev.src = item.image_url; imgPrev.style.display = 'block';
            }
        } else {
            editGroup.style.display = 'none'; newGroup.style.display = 'block';
            this.switchStorageMode(this.storageMode || 'cloud');
        }
    },

    // --- 7. XÁC NHẬN LƯU ---
    async confirmSave(forceUpdate = false) {
        const name = document.getElementById('snippet-name-input').value.trim() || "Untitled";
        const author = document.getElementById('author-name-input').value.trim();
        const activeButtons = document.querySelectorAll('.save-modal-actions .action-btn');
        
        if (!author) { alert("Vui lòng nhập Tên người dùng!"); return; }
        localStorage.setItem('last_author', author);
        activeButtons.forEach(btn => { btn.disabled = true; btn.style.opacity = '0.5'; });

        try {
            const rawData = {
                html: CodePen.editors.html.getValue(), css: CodePen.editors.css.getValue(),
                js: CodePen.editors.js.getValue(), resources: CodePen.externalResources
            };
            const compressedData = LZString.compressToEncodedURIComponent(JSON.stringify(rawData));

            if (this.storageMode === 'local') {
                const item = {
                    id: forceUpdate ? this.currentEditId : "local_" + Date.now(),
                    name: name, author_name: author, data: compressedData,
                    image_url: document.getElementById('image-preview-element').src,
                    created_at: new Date().toISOString()
                };
                this.saveToLocalStorage(item);
                if (!forceUpdate) this.currentEditId = item.id;
                alert("✅ Đã lưu vào Private Library!");
            } else {
                let password = document.getElementById('password-input').value.trim();
                let imageUrl = document.getElementById('image-preview-element').src;
                if (this.selectedImageFile) imageUrl = await this.uploadToCloudinary();

                const isPatch = forceUpdate && this.currentEditId;
                const method = isPatch ? 'PATCH' : 'POST';
                const url = isPatch ? `${SUPABASE_URL}/rest/v1/snippets?id=eq.${this.currentEditId}` : `${SUPABASE_URL}/rest/v1/snippets`;

                const response = await fetch(url, {
                    method: method,
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                    body: JSON.stringify({ name, data: compressedData, image_url: imageUrl, author_name: author, password: password || null })
                });

                if (response.ok) {
                    const result = await response.json();
                    if (!isPatch && result.length > 0) this.currentEditId = result[0].id;
                    alert("🚀 Đã chia sẻ lên Cloud!");
                } else throw new Error();
            }

            this.currentName = name;
            this.updateNameUI();
            this.closeSaveModal();
            this.loadLibrary();
        } catch (e) { alert("Lỗi hệ thống!"); } 
        finally { activeButtons.forEach(btn => { btn.disabled = false; btn.style.opacity = '1'; }); }
    },

    // 8. THƯ VIỆN & CORE
    async loadLibrary() {
        try {
            this.loadLocalLibrary();
            const res = await fetch(`${SUPABASE_URL}/rest/v1/snippets?select=*&order=created_at.desc`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            this.currentSnippets = await res.json();
            this.renderLibraryUI();
        } catch (e) { this.renderLibraryUI(); }
    },

    renderLibraryUI() {
        const renderList = (snippets, isLocal) => {
            return snippets.map(item => {
                const thumbUrl = item.image_url ? (isLocal ? item.image_url : item.image_url.replace('/upload/', '/upload/w_160,h_100,c_fill,q_auto,f_auto/')) : 'https://via.placeholder.com/80x50?text=No+Img';
                return `
                    <div class="library-item" onclick="CodePenStorage.applySnippet('${item.id}')" style="border-left: 3px solid ${isLocal ? '#007acc' : '#28a745'}">
                        <img src="${thumbUrl}" class="snippet-thumb" style="width:80px; height:50px; object-fit:cover; border-radius:4px;">
                        <div class="library-item-info" style="flex:1; margin-left:10px;">
                            <span style="font-weight:bold">${item.name} ${item.password ? '🔒' : ''}</span><br>
                            <small class="author-tag" style="background:${isLocal ? '#007acc22' : '#28a74522'}">👤 ${item.author_name || 'Duy Anh'}</small>
                        </div>
                        <div class="library-item-actions">
                            <span class="edit-btn" onclick="CodePenStorage.editSnippet('${item.id}', event)">✏️</span>
                            <span class="delete-btn-codepen" onclick="CodePenStorage.deleteSnippet('${item.id}', event)">🗑</span>
                        </div>
                    </div>`;
            }).join('');
        };

        let modal = document.querySelector('.library-modal-overlay');
        if (!modal) { modal = document.createElement('div'); modal.className = 'library-modal-overlay'; document.body.appendChild(modal); }
        modal.innerHTML = `
            <div class="library-modal">
                <div class="library-tabs">
                    <div class="lib-tab ${this.libraryTab === 'cloud' ? 'active' : ''}" onclick="CodePenStorage.libraryTab='cloud'; CodePenStorage.renderLibraryUI()">☁️ Cloud</div>
                    <div class="lib-tab ${this.libraryTab === 'local' ? 'active' : ''}" onclick="CodePenStorage.libraryTab='local'; CodePenStorage.renderLibraryUI()">💻 Local</div>
                </div>
                <div class="library-list" style="max-height:400px; overflow-y:auto;">
                    ${this.libraryTab === 'local' ? renderList(this.localSnippets, true) : renderList(this.currentSnippets, false)}
                </div>
                <div style="text-align:right; margin-top:10px;"><button class="action-btn btn-secondary" onclick="this.closest('.library-modal-overlay').remove()">Close</button></div>
            </div>`;
    },

    applySnippet(id) {
        const isLocal = String(id).startsWith("local_");
        const item = isLocal ? this.localSnippets.find(s => s.id === id) : this.currentSnippets.find(s => s.id === id);
        if (!item) return;
        this.requestAccess(item, () => {
            this.currentEditId = id; this.currentName = item.name; this.updateNameUI();
            try {
                const data = JSON.parse(LZString.decompressFromEncodedURIComponent(item.data));
                CodePen.editors.html.setValue(data.html || "", -1);
                CodePen.editors.css.setValue(data.css || "", -1);
                CodePen.editors.js.setValue(data.js || "", -1);
                CodePen.externalResources = data.resources || { css: [], js: [] };
                CodePen.run();
                document.querySelector('.library-modal-overlay').remove();
            } catch (e) { alert("Lỗi!"); }
        });
    },

    editSnippet(id, event) {
        event.stopPropagation();
        const isLocal = String(id).startsWith("local_");
        const item = isLocal ? this.localSnippets.find(s => s.id === id) : this.currentSnippets.find(s => s.id === id);
        if (!item) return;
        this.requestAccess(item, () => {
            this.currentEditId = id; this.currentName = item.name; this.updateNameUI();
            this.openSaveModal();
            if (item.image_url) {
                const img = document.getElementById('image-preview-element');
                img.src = item.image_url; img.style.display = 'block';
            }
            if (document.querySelector('.library-modal-overlay')) document.querySelector('.library-modal-overlay').remove();
        });
    },

    async deleteSnippet(id, event) {
        event.stopPropagation();
        const isLocal = String(id).startsWith("local_");
        const item = isLocal ? this.localSnippets.find(s => s.id === id) : this.currentSnippets.find(s => s.id === id);
        this.requestAccess(item, async () => {
            if (!confirm("Xóa?")) return;
            if (isLocal) {
                let localData = JSON.parse(localStorage.getItem(this.LOCAL_KEY) || "[]");
                localStorage.setItem(this.LOCAL_KEY, JSON.stringify(localData.filter(i => i.id !== id)));
            } else {
                await fetch(`${SUPABASE_URL}/rest/v1/snippets?id=eq.${id}`, { method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
            }
            this.loadLibrary();
        });
    },

    async uploadToCloudinary() {
        if (!this.selectedImageFile) return null;
        const formData = new FormData();
        formData.append("file", this.selectedImageFile);
        formData.append("upload_preset", CLOUDINARY_PRESET);
        const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        const data = await res.json();
        return data.secure_url;
    },

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            this.selectedImageFile = await this.compressImage(event.target.result);
            document.getElementById('image-preview-element').src = this.selectedImageFile;
            document.getElementById('image-preview-element').style.display = 'block';
        };
        reader.readAsDataURL(file);
    },

    closeSaveModal() {
        document.getElementById('save-modal-overlay').style.display = 'none';
        document.getElementById('image-preview-element').style.display = 'none';
        this.selectedImageFile = null;
    },
    resetToNew() { this.currentEditId = null; this.currentName = "Untitled"; this.updateNameUI(); }
};

// CÁC HÀM CỦA CODEPEN (BỔ SUNG ĐỒNG BỘ TÊN)
window.runCode = () => CodePen.run();
window.clearCode = () => {
    if (confirm("Clear?")) {
        Object.values(CodePen.editors).forEach(ed => ed && ed.setValue("", -1));
        CodePenStorage.resetToNew();
    }
};

// ĐỒNG BỘ TÊN REAL-TIME
document.addEventListener('input', (e) => {
    if (e.target.id === 'active-snippet-name' || e.target.id === 'snippet-name-input') {
        CodePenStorage.currentName = e.target.value;
        CodePenStorage.updateNameUI();
    }
});

const CodePen = {
  isDraggingV: false,
  isDraggingH: false,
  isDraggingC: false,
  isDraggingSplit: false,
  startY: 0,
  startX: 0,
  startTranslateY: 0,
  startConsoleHeight: 0,
  startLeftWidth: 0,
  autoRunEnabled: false,
  debounceTimer: null,
  STORAGE_KEY: "codepen_user_data",
  viewMode: "standard",
  activeTab: "html",

  editors: { html: null, css: null, js: null },
  externalResources: { css: [], js: [] },

  init() {
    this.render();
    CodePenStorage.keepAlive();
  },

  render() {
    const container = document.getElementById("codepen-container");
    if (!container) return;

    const headerHtml = `
            <div class="preview-actions">
                <div class="brand-name">
            <input type="text" id="active-snippet-name" 
                   value="${CodePenStorage.currentName}" 
                   placeholder="Untitled"
                   title="Click để đổi tên snippet">
        </div>
                <button class="action-btn btn-success" onclick="runCode()">▶ RUN</button>
                <label class="toggle-control">
                    <input type="checkbox" id="auto-run-toggle" ${
                      this.autoRunEnabled ? "checked" : ""
                    }>
                    <span class="control"></span>
                    <span class="label">Auto Run</span>
                </label>
                <div style="flex:1"></div>
                
                <button class="action-btn btn-secondary" onclick="CodePen.toggleViewMode()" style="background:#007acc; color:white">
                    ${
                      this.viewMode === "standard"
                        ? "🔲 Split View"
                        : "🔳 Standard View"
                    }
                </button>

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
            <div class="save-data-wrap">
                <button class="action-btn btn-secondary" onclick="CodePenStorage.openSaveModal()">☁️ Save Cloud</button>
                <button class="action-btn btn-secondary" onclick="CodePenStorage.loadLibrary()">📚 Library</button>
            </div>`;
                    
    if (this.viewMode === "standard") {
      container.innerHTML = `
            <div class="codepen-container-main mode-standard">
                ${headerHtml}
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
                        <div id="capture-overlay" style="display:none; position:absolute; inset:0; background:rgba(0,0,0,0.3); z-index:10000; cursor:crosshair;">
        <div id="selection-box" style="display:none; position:absolute; border:2px dashed #007acc; background:rgba(0,122,204,0.1); pointer-events:none; z-index:10001;"></div>
    </div>
                            <div id="drag-blocker"></div><iframe id="preview-window"></iframe></div>
                        <div class="console-panel" id="console-panel">
                            <div class="resizer-console" id="console-resizer"></div>
                            <div class="console-header"><span class="console-title">Console</span><div class="console-actions"><button class="format-btn" onclick="CodePen.clearConsole()">Clear</button><button class="format-btn" onclick="CodePen.toggleConsole()">Close</button></div></div>
                            <div class="console-body" id="console-body"><div class="console-logs" id="console-logs"></div><div class="console-input-area"><input type="text" class="console-input" id="console-command" placeholder="Type JS command..."></div></div>
                        </div>
                    </div>
                </div>
            </div>`;
    } else {
      container.innerHTML = `
            <div class="codepen-container-main mode-split">
                ${headerHtml}
                <div class="split-layout-body">
                    <div class="split-editor-side" style="flex: 0 0 50%;" id="split-editor-side">
                        <div class="split-tabs-header">
                            <button class="tab-btn-codepen ${
                              this.activeTab === "html" ? "active" : ""
                            }" onclick="CodePen.switchTab('html', this)">HTML</button>
                            <button class="tab-btn-codepen ${
                              this.activeTab === "css" ? "active" : ""
                            }" onclick="CodePen.switchTab('css', this)">CSS</button>
                            <button class="tab-btn-codepen ${
                              this.activeTab === "js" ? "active" : ""
                            }" onclick="CodePen.switchTab('js', this)">JavaScript</button>
                        </div>
                        <div class="split-editor-container">
                            <div class="editor-box html-box ${
                              this.activeTab === "html" ? "active" : ""
                            }"><div class="editor-label"><span>HTML</span><button class="format-btn" onclick="CodePen.formatCode('html')">Format</button></div><div class="editor-content-wrapper"><div id="html-gutter" class="custom-line-numbers"></div><div id="html-code" class="ace-editor-container"></div></div></div>
                            <div class="editor-box css-box ${
                              this.activeTab === "css" ? "active" : ""
                            }"><div class="editor-label"><span>CSS</span><button class="format-btn" onclick="CodePen.formatCode('css')">Format</button></div><div class="editor-content-wrapper"><div id="css-gutter" class="custom-line-numbers"></div><div id="css-code" class="ace-editor-container"></div></div></div>
                            <div class="editor-box js-box ${
                              this.activeTab === "js" ? "active" : ""
                            }"><div class="editor-label"><span>JS</span><button class="format-btn" onclick="CodePen.formatCode('js')">Format</button></div><div class="editor-content-wrapper"><div id="js-gutter" class="custom-line-numbers"></div><div id="js-code" class="ace-editor-container"></div></div></div>
                        </div>
                    </div>
                    <div class="main-split-resizer" id="main-split-resizer"></div>
                    <div class="split-preview-side">
                        <div class="preview-frame-container"><div id="drag-blocker"></div><iframe id="preview-window"></iframe></div>
                        <div class="console-panel" id="console-panel" style="height: 180px; display: flex;">
                            <div class="resizer-console" id="console-resizer"></div>
                            <div class="console-header"><span class="console-title">Console</span><div class="console-actions"><button class="format-btn" onclick="CodePen.clearConsole()">Clear</button><button class="format-btn" onclick="CodePen.toggleConsole()">Close</button></div></div>
                            <div class="console-body" id="console-body"><div class="console-logs" id="console-logs"></div><div class="console-input-area"><input type="text" class="console-input" id="console-command" placeholder="Type JS command..."></div></div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

   // Gộp cả CDN Modal và Save Modal vào cùng một lần nhúng
   // Gộp cả Auth Modal, Save Modal và CDN Modal vào cùng một lần nhúng
   container.insertAdjacentHTML('beforeend', `
        <div class="save-modal-overlay" id="cdn-modal-overlay" style="display:none;">
        <div class="save-modal" style="width: 400px; border-top: 4px solid #007acc;">
            <h3 style="margin-top:0; color:#eee;">🌐 External Resources (CDN)</h3>
            <p style="font-size: 11px; color: #888; margin-bottom: 15px;">Thêm link CSS hoặc JS từ bên ngoài (Google Fonts, FontAwesome, v.v.)</p>
            
            <div style="margin-bottom: 15px;">
                <span style="display:block; font-size:11px; color:#aaa; margin-bottom:5px; font-weight:bold; text-transform:uppercase;">Link URL</span>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="cdn-url" placeholder="https://cdnjs.cloudflare.com/ajax/libs/..." 
                           style="flex:1; padding:10px; background:#252526; border:1px solid #444; color:white; border-radius:4px;">
                    <button class="action-btn btn-success" onclick="CodePen.addResource()">Add</button>
                </div>
            </div>

            <span style="display:block; font-size:11px; color:#aaa; margin-bottom:5px; font-weight:bold; text-transform:uppercase;">Danh sách tài nguyên đã thêm</span>
            <div id="cdn-list" style="max-height: 150px; overflow-y: auto; background: #1a1a1a; border-radius: 4px; padding: 5px; border: 1px solid #333;">
                </div>

            <div class="save-modal-actions" style="margin-top:20px; text-align:right;">
                <button class="action-btn btn-secondary" onclick="CodePen.closeCDNModal()">Close & Sync</button>
            </div>
        </div>
    </div>
    <div class="auth-modal-overlay" id="auth-modal-overlay">
        <div class="auth-modal">
            <h4 style="margin:0 0 10px 0; color:#007acc;">🔒 Xác thực mật khẩu</h4>
            <small id="auth-msg" style="color:#888; display:block; margin-bottom:10px;"></small>
            <input type="password" id="auth-pass-input" placeholder="Nhập mật khẩu..." 
                   style="width:100%; padding:8px; background:#252526; border:1px solid #444; color:white; margin-bottom:15px; box-sizing:border-box;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:10px; color:#555; cursor:pointer; text-decoration:underline;" onclick="CodePenStorage.showForgotPass()">Quên pass?</span>
                <div>
                    <button class="action-btn btn-secondary" onclick="document.getElementById('auth-modal-overlay').style.display='none'">Hủy</button>
                    <button class="action-btn btn-success" onclick="CodePenStorage.verifyAuth()">Xác nhận</button>
                </div>
            </div>
        </div>
    </div>

    <div class="save-modal-overlay" id="save-modal-overlay">
        <div class="save-modal" style="width: 360px; border-top: 4px solid #28a745;">
            <h3 id="modal-title" style="margin-top:0; margin-bottom:15px;">Asset Storage</h3>
            
            <div class="mode-switch-container">
                <button id="mode-cloud-btn" class="mode-btn cloud active" onclick="CodePenStorage.switchStorageMode('cloud')">☁️ PUBLIC CLOUD</button>
                <button id="mode-local-btn" class="mode-btn local" onclick="CodePenStorage.switchStorageMode('local')">💻 MY LOCAL</button>
            </div>

            <div class="image-upload-section" style="border:1px dashed #444; padding:10px; margin-bottom:15px; text-align:center; border-radius:8px;">
                <span style="display:block; font-size:10px; color:#888; margin-bottom:5px; font-weight:bold;">ẢNH ĐẠI DIỆN</span>
                <img id="image-preview-element" style="width:100%; max-height:120px; object-fit:cover; display:none; border-radius:4px; margin-bottom:10px;">
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button class="action-btn btn-capture" onclick="CodePenStorage.startCaptureMode()" style="font-size:11px;">📸 Capture</button>
                    <input type="file" id="file-input" style="display:none" onchange="CodePenStorage.handleFileSelect(event)">
                    <button class="action-btn" onclick="document.getElementById('file-input').click()" style="font-size:11px;">📁 Upload</button>
                </div>
            </div>
            
            <div style="margin-bottom:10px;">
                <span style="display:block; font-size:10px; color:#007acc; margin-bottom:4px; font-weight:bold;">TÊN ĐOẠN CODE</span>
                <input type="text" id="snippet-name-input" placeholder="Tên đoạn code..." 
                       style="width:100%; padding:10px; background:#252526; border:1px solid #444; color:white; border-radius:4px; box-sizing:border-box;">
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr; gap:10px;">
                <div>
                    <span style="display:block; font-size:10px; color:#888; margin-bottom:4px; font-weight:bold;">TÁC GIẢ</span>
                    <input type="text" id="author-name-input" placeholder="Tên của bạn..." 
                           style="width:100%; padding:10px; background:#252526; border:1px solid #444; color:white; border-radius:4px; box-sizing:border-box;">
                </div>

                <div id="password-section">
                    <span style="display:block; font-size:10px; color:#888; margin-bottom:4px; font-weight:bold;">MẬT KHẨU (CHỈ CLOUD)</span>
                    <div id="password-wrapper">
                        <input type="password" id="password-input" placeholder="Để trống nếu công khai..." 
                               style="width:100%; padding:10px; background:#252526; border:1px solid #444; color:white; border-radius:4px; box-sizing:border-box;">
                    </div>
                    <div id="change-pass-btn" onclick="CodePenStorage.toggleChangePass()" style="display:none; font-size:11px; color:#007acc; cursor:pointer; text-align:center; border:1px solid #333; padding:5px; border-radius:4px; margin-top:5px;">🔄 Thay đổi mật khẩu</div>
                </div>
            </div>

            <div class="save-modal-actions" style="margin-top:15px; display:flex; justify-content:flex-end; gap:8px;">
                <button class="action-btn btn-secondary" onclick="CodePenStorage.closeSaveModal()">Hủy</button>
                <div id="edit-actions-group" style="display:none; gap:8px;">
                    <button class="action-btn btn-primary" onclick="CodePenStorage.confirmSave(false)">Lưu bản mới</button>
                    <button class="action-btn btn-success btn-update-existing" onclick="CodePenStorage.confirmSave(true)">Cập nhật bản cũ</button>
                </div>
                <div id="new-actions-group" style="display:block;">
                    <button class="action-btn btn-success" onclick="CodePenStorage.confirmSave(false)">Xác nhận lưu</button>
                </div>
            </div>
        </div>
    </div>
`);

    this.setupCommonEvents();
    this.initAce();
    this.initResizers();
    this.syncThemeColors();

    if (this.viewMode === "standard") {
      const overlay = document.getElementById("preview-overlay-container");
      const defaultY = window.innerHeight * 0.45;
      overlay.style.transform = `translateY(${defaultY}px)`;
      overlay.style.height = `calc(100vh - ${defaultY}px)`;
      this.updateScrollMargins(defaultY);
    }
  },

  toggleViewMode() {
    this.viewMode = this.viewMode === "standard" ? "split" : "standard";
    this.render();
    this.run();
  },

  switchTab(tab, btn) {
    this.activeTab = tab;
    document
      .querySelectorAll(".tab-btn-codepen")
      .forEach((b) => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    document
      .querySelectorAll(".split-editor-container .editor-box")
      .forEach((box) =>
        box.classList.toggle("active", box.classList.contains(`${tab}-box`))
      );
    this.resizeEditors();
  },

  // --- FIX CONSOLE LOGIC & REPL ---
  setupCommonEvents() {
    window.removeEventListener("message", this.handleIframeMessage);
    window.addEventListener("message", this.handleIframeMessage.bind(this));

    const input = document.getElementById("console-command");
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && input.value) {
          const cmd = input.value;
          this.appendLog("info", [`> ${cmd}`]);
          // FIX: Đảm bảo type gửi đi khớp với listener trong Iframe
          document
            .getElementById("preview-window")
            .contentWindow.postMessage(
              { type: "exec-console", command: cmd },
              "*"
            );
          input.value = "";
        }
      });
    }

    document
      .getElementById("auto-run-toggle")
      .addEventListener("change", (e) => {
        this.autoRunEnabled = e.target.checked;
        if (this.autoRunEnabled) this.run();
      });

    document
      .getElementById("theme-selector")
      .addEventListener("change", (e) => {
        Object.values(this.editors).forEach(
          (ed) => ed && ed.setTheme(e.target.value)
        );
        setTimeout(() => this.syncThemeColors(), 150);
      });
  },

  handleIframeMessage(event) {
    if (event.data && event.data.type === "iframe-log") {
      this.appendLog(event.data.method, event.data.arguments);
    }
  },

  clear() {
    if (confirm("Xóa toàn bộ Code và Console?")) {
      Object.values(this.editors).forEach((ed) => ed && ed.setValue("", -1));
      this.externalResources = { css: [], js: [] };
      localStorage.removeItem(this.STORAGE_KEY);
      this.clearConsole();
      if (typeof CodePenStorage !== 'undefined') {
        CodePenStorage.resetToNew();
    }
      this.run();
    }
  },

  clearConsole() {
    const logs = document.getElementById("console-logs");
    if (logs) logs.innerHTML = "";
  },
  toggleConsole() {
    const panel = document.getElementById("console-panel");
    if (panel) {
      const isH = panel.style.display === "none" || panel.style.display === "";
      panel.style.display = isH ? "flex" : "none";
      if (isH) panel.style.height = "180px";
    }
  },

  appendLog(method, args) {
    const logContainer = document.getElementById("console-logs");
    if (!logContainer) return;
    const logItem = document.createElement("div");
    logItem.className = `log-item log-${method === "log" ? "info" : method}`;
    logItem.innerText = args
      .map((arg) => {
        try {
          return typeof arg === "object"
            ? JSON.stringify(arg, null, 2)
            : String(arg);
        } catch (e) {
          return String(arg);
        }
      })
      .join(" ");
    logContainer.appendChild(logItem);
    logContainer.scrollTop = logContainer.scrollHeight;
  },

  // --- LINE NUMBER WRAP LOGIC ---
  initAce() {
    const savedData = this.loadFromStorage();
    const config = {
      theme: "ace/theme/monokai",
      fontSize: "13px",
      useSoftTabs: true,
      showPrintMargin: false,
      showGutter: false,
      wrap: true,
      indentedSoftWrap: false,
      useWorker: false,
      animatedScroll: false,
      scrollpastend: 0,
      minLines: 50,
      maxLines: Infinity,
      showFoldWidgets: true,
    };
    const setupEditor = (id, gutterId, mode, defaultValue) => {
      const editor = ace.edit(id);
      const gutterEl = document.getElementById(gutterId);
      editor.setOptions(config);
      editor.session.setMode(`ace/mode/${mode}`);
      const initialValue =
        (savedData &&
          (mode === "javascript" ? savedData.js : savedData[mode])) ||
        defaultValue;
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
            let foldBtn =
              foldWidget === "start"
                ? `<span class="fold-icon ${
                    session.isRowFolded(i) ? "is-folded" : ""
                  }" data-row="${i}"></span>`
                : "";
            numbersHtml += `<div class="line-number-row" style="height: ${rowHeight}px; line-height: ${lineHeight}px;">${foldBtn}<span class="num-text">${
              i + 1
            }</span></div>`;
          }
        }
        gutterEl.innerHTML = numbersHtml;
      };

      gutterEl.onclick = (e) => {
        if (e.target.classList.contains("fold-icon"))
          editor.session.toggleFold(
            parseInt(e.target.getAttribute("data-row"))
          );
      };
      editor.renderer.on("afterRender", () => {
        gutterEl.style.transform = `translateY(${-editor.renderer.getScrollTop()}px)`;
      });
      editor.session.on("change", () => {
        updateLineNumbers();
        this.triggerAutoRun();
      });
      editor.session.on("changeWrapLimit", updateLineNumbers);
      editor.session.on("changeFold", updateLineNumbers);
      setTimeout(updateLineNumbers, 100);
      return editor;
    };
    this.editors.html = setupEditor(
      "html-code",
      "html-gutter",
      "html",
      "<div>\n  <h1>Hello</h1>\n</div>"
    );
    this.editors.css = setupEditor(
      "css-code",
      "css-gutter",
      "css",
      "body {\n  color: cyan;\n}"
    );
    this.editors.js = setupEditor(
      "js-code",
      "js-gutter",
      "javascript",
      "console.log('REPL Active');"
    );
  },

  // --- CÁC HÀM CƠ BẢN (RESIZER, STORAGE, RUN) ---
  initResizers() {
    const blocker = document.getElementById("drag-blocker");
    const overlay = document.getElementById("preview-overlay-container");
    const cPanel = document.getElementById("console-panel");
    const move = (e) => {
      if (this.isDraggingV && this.viewMode === "standard") {
        const deltaY = e.clientY - this.startY;
        let newY = this.startTranslateY + deltaY;
        overlay.style.transform = `translateY(${newY}px)`;
        overlay.style.height = `calc(100vh - ${newY}px)`;
        this.updateScrollMargins(newY);
        this.resizeEditors();
      } else if (this.isDraggingC) {
        const deltaY = this.startY - e.clientY;
        let newH = this.startConsoleHeight + deltaY;
        if (newH < 35) newH = 35;
        cPanel.style.height = `${newH}px`;
      } else if (this.isDraggingSplit) {
        const deltaX = e.clientX - this.startX;
        let newW = this.startLeftWidth + deltaX;
        if (newW > 150 && newW < window.innerWidth - 150) {
          document.getElementById(
            "split-editor-side"
          ).style.flex = `0 0 ${newW}px`;
          this.resizeEditors();
        }
      }
    };
    const up = () => {
      this.isDraggingV =
        this.isDraggingH =
        this.isDraggingC =
        this.isDraggingSplit =
          false;
      if (blocker) blocker.style.display = "none";
      document
        .querySelector(".codepen-container-main")
        .classList.remove("is-dragging-global");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    const vH = document.getElementById("main-vertical-resizer");
    if (vH)
      vH.addEventListener("pointerdown", (e) => {
        if (this.viewMode !== "standard") return;
        this.isDraggingV = true;
        this.startY = e.clientY;
        this.startTranslateY = new WebKitCSSMatrix(
          window.getComputedStyle(overlay).transform
        ).m42;
        blocker.style.display = "block";
        document
          .querySelector(".codepen-container-main")
          .classList.add("is-dragging-global");
        window.addEventListener("pointermove", move, { passive: true });
        window.addEventListener("pointerup", up);
      });

    const cH = document.getElementById("console-resizer");
    if (cH)
      cH.addEventListener("pointerdown", (e) => {
        this.isDraggingC = true;
        this.startY = e.clientY;
        this.startConsoleHeight = cPanel.offsetHeight;
        blocker.style.display = "block";
        document
          .querySelector(".codepen-container-main")
          .classList.add("is-dragging-global");
        window.addEventListener("pointermove", move, { passive: true });
        window.addEventListener("pointerup", up);
      });

    const sH = document.getElementById("main-split-resizer");
    if (sH)
      sH.addEventListener("pointerdown", (e) => {
        this.isDraggingSplit = true;
        this.startX = e.clientX;
        this.startLeftWidth =
          document.getElementById("split-editor-side").offsetWidth;
        blocker.style.display = "block";
        document
          .querySelector(".codepen-container-main")
          .classList.add("is-dragging-global");
        window.addEventListener("pointermove", move, { passive: true });
        window.addEventListener("pointerup", up);
      });

      if (this.viewMode === "standard") {
        document.querySelectorAll(".horizontal-resizer").forEach((resizer, index) => {
          let startX_H, startLWidth_H, leftBox;
          const moveH = (ev) => {
            if (!this.isDraggingH) return;
            leftBox.style.flex = `0 0 ${startLWidth_H + (ev.clientX - startX_H)}px`;
            this.resizeEditors();
          };
          const upH = () => {
            this.isDraggingH = false;
            if (blocker) blocker.style.display = "none";
            document.querySelector(".codepen-container-main").classList.remove("is-dragging-global");
            window.removeEventListener("pointermove", moveH);
            window.removeEventListener("pointerup", upH);
          };
          resizer.addEventListener("pointerdown", (e) => {
            this.isDraggingH = true;
            leftBox = resizer.previousElementSibling;
            startX_H = e.clientX;
            startLWidth_H = leftBox.offsetWidth;
            
            const all = document.querySelectorAll(".editor-box");
      
            // Khóa cứng chiều rộng hiện tại của tất cả các box bằng pixel
            all.forEach(box => {
              box.style.flex = `0 0 ${box.offsetWidth}px`;
            });
      
            // LOGIC MỚI:
            if (index === 0) {
              // Nếu kéo thanh giữa HTML và CSS: 
              // Giữ cứng HTML (đang kéo) và JS (box cuối), cho CSS (box giữa) tự co dãn (flex: 1)
              all[1].style.flex = "1";
            } else {
              // Nếu kéo thanh giữa CSS và JS:
              // Giữ cứng HTML và CSS, cho JS tự co dãn (flex: 1)
              all[2].style.flex = "1";
            }
      
            blocker.style.display = "block";
            document.querySelector(".codepen-container-main").classList.add("is-dragging-global");
            window.addEventListener("pointermove", moveH, { passive: true });
            window.addEventListener("pointerup", upH);
          });
        });
      }
  },

  updateScrollMargins(currentTranslateY) {
    if (this.viewMode === "split") {
      Object.values(this.editors).forEach(
        (ed) => ed && ed.renderer.setScrollMargin(10, 10, 10, 10)
      );
      return;
    }
    const bottom = window.innerHeight - currentTranslateY;
    Object.values(this.editors).forEach((ed) => {
      if (ed) ed.renderer.setScrollMargin(10, bottom + 20, 10, 10);
    });
  },
  triggerAutoRun() {
    this.saveToStorage();
    if (!this.autoRunEnabled) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.run(), 800);
  },
  resizeEditors() {
    Object.values(this.editors).forEach((ed) => ed && ed.resize());
  },
  saveToStorage() {
    localStorage.setItem(
      this.STORAGE_KEY,
      JSON.stringify({
        html: this.editors.html.getValue(),
        css: this.editors.css.getValue(),
        js: this.editors.js.getValue(),
        resources: this.externalResources,
      })
    );
  },
  loadFromStorage() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    const data = saved ? JSON.parse(saved) : null;
    if (data && data.resources) this.externalResources = data.resources;
    return data;
  },
  openCDNModal() {
    document.getElementById("cdn-modal-overlay").style.display = "flex";
    this.renderCDNList();
  },
  closeCDNModal() {
    document.getElementById("cdn-modal-overlay").style.display = "none";
    this.saveToStorage();
    this.run();
  },
  addResource() {
    const url = document.getElementById("cdn-url").value.trim();
    if (!url) return;
    if (url.endsWith(".css") || url.includes("fonts.googleapis.com"))
      this.externalResources.css.push(url);
    else this.externalResources.js.push(url);
    document.getElementById("cdn-url").value = "";
    this.renderCDNList();
  },
  removeResource(type, index) {
    this.externalResources[type].splice(index, 1);
    this.renderCDNList();
  },
  renderCDNList() {
    const listEl = document.getElementById("cdn-list");
    let html = "";
    ["css", "js"].forEach((type) => {
      this.externalResources[type].forEach((url, index) => {
        html += `<div class="cdn-item"><span title="${url}">[${type.toUpperCase()}] ${url}</span><span class="cdn-remove" onclick="CodePen.removeResource('${type}', ${index})">✕</span></div>`;
      });
    });
    listEl.innerHTML =
      html ||
      '<div style="color:#555; font-size: 11px;">No external resources.</div>';
  },
  syncThemeColors() {
    const style = window.getComputedStyle(
      document.querySelector(".ace_editor")
    );
    document
      .querySelectorAll(".editor-box, .console-panel, .tab-btn-codepen")
      .forEach((el) => {
        // el.style.backgroundColor = style.backgroundColor;
        // el.style.color = style.color;
      });
    document
      .querySelectorAll(".custom-line-numbers, .console-logs")
      .forEach((el) => {
        // el.style.backgroundColor = style.backgroundColor;
        // el.style.color = style.color;
        // el.style.opacity = "0.5";
      });
    document
      .querySelectorAll(".editor-label, .console-header")
      .forEach((el) => (el.style.filter = "brightness(1.1)"));
  },
  run() {
    const html = this.editors.html.getValue();
    const css = this.editors.css.getValue();
    const js = this.editors.js.getValue();
    const previewEl = document.getElementById("preview-window");
    if (!previewEl) return;
    const extCSS = this.externalResources.css
      .map((url) => `<link rel="stylesheet" href="${url}">`)
      .join("\n");
    const extJS = this.externalResources.js
      .map((url) => `<script src="${url}"><\/script>`)
      .join("\n");
    const content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://unpkg.com/splitting/dist/splitting.css" />${extCSS}<style>body{margin:0;padding:15px;font-family:'Poppins',sans-serif;color:white;} ${css}</style><script>(function(){['log','warn','error','info'].forEach(m=>{const o=console[m];console[m]=function(...a){window.parent.postMessage({type:'iframe-log',method:m,arguments:a},'*');o.apply(console,a);};});window.addEventListener('message',e=>{if(e.data.type==='exec-console'){try{const r=eval(e.data.command);if(r!==undefined)console.log(r);}catch(err){console.error(err);}}});})();<\/script></head><body>${html}<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"><\/script><script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"><\/script><script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/Draggable.min.js"><\/script><script src="https://unpkg.com/splitting/dist/splitting.min.js"><\/script><script src="https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js"></script>${extJS}<script type="module">if(typeof Splitting!=='undefined')Splitting();if(typeof gsap!=='undefined')gsap.registerPlugin(ScrollTrigger,Draggable);${js}<\/script></body></html>`;
    previewEl.srcdoc = content;
  },
};

window.runCode = () => CodePen.run();
window.clearCode = () => CodePen.clear();
document.addEventListener("DOMContentLoaded", () => CodePen.init());
