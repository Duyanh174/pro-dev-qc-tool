// --- THÔNG TIN SUPABASE (PHẢI THAY BẰNG KEY THẬT) ---
const SUPABASE_URL = "https://pzqwnosbwznoksyervxk.supabase.co";
const SUPABASE_KEY = "sb_publishable_HyyqMob18yaCwb-GPeakJA__XOO_YU3";
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dpn8hugjc/image/upload";
const CLOUDINARY_PRESET = "codepen_preset";

const CodePenStorage = {

  // --- PHẦN MỚI: KHỞI TẠO INDEXEDDB ---
  DB_NAME: "CodePenCloneDB",
  DB_VERSION: 1,
  STORE_NAME: "local_snippets",

  async getDB() {
      return new Promise((resolve, reject) => {
          const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
          request.onupgradeneeded = (e) => {
              const db = e.target.result;
              if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                  db.createObjectStore(this.STORE_NAME, { keyPath: "id" });
              }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject("Lỗi mở IndexedDB");
      });
  },

    // --- THÊM HÀM NÀY VÀO ĐẦU ---
    escapeHTML(str) {
      if (!str) return "";
      return str.replace(/[&<>"']/g, function(m) {
          return {
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#039;'
          }[m];
      });
  },

    handleAccessModeChange(mode) {
      const passInput = document.getElementById('password-input');
      if (mode === 'view') {
          passInput.placeholder = "Bắt buộc nhập pass để bảo vệ mode View...";
          passInput.style.borderColor = "#ff9800";
      } else {
          passInput.placeholder = "Để trống nếu công khai...";
          passInput.style.borderColor = "#444";
      }
  },

  // Hàm xử lý Mở khóa khi đang ở mode View
  unlockSnippet() {
    // Thay vì dùng prompt gây lỗi trên Electron, ta hiện Modal tự chế
    const modal = document.getElementById('unlock-modal-overlay');
    const input = document.getElementById('unlock-pass-input');
    if (modal) {
        modal.style.display = 'flex';
        input.value = ""; // Xóa trắng pass cũ
        input.focus();    // Tự động nhảy vào ô nhập
    }
},

verifyUnlock() {
  const input = document.getElementById('unlock-pass-input');
  const passwordEntered = input.value;

  if (!passwordEntered) {
      alert("Vui lòng nhập mật khẩu!");
      return;
  }

  // Tìm snippet hiện tại trong bộ nhớ (để lấy password đúng)
  const currentItem = this.libraryTab === 'local' 
      ? this.localSnippets.find(s => s.id === this.currentEditId)
      : this.currentSnippets.find(s => s.id === this.currentEditId);

  if (currentItem && passwordEntered === currentItem.password) {
      alert("✅ Mở khóa thành công! Bạn có thể sửa code.");
      this.setReadOnlyMode(false); // Mở khóa Editor
      document.getElementById('unlock-modal-overlay').style.display = 'none'; // Đóng modal
  } else {
      alert("❌ Sai mật khẩu!");
  }
},

    // Hàm phụ để bật/tắt trạng thái khóa của toàn bộ ứng dụng
    setReadOnlyMode(isReadOnly) {
      this.isLocked = isReadOnly; // <-- QUAN TRỌNG: Lưu lại trạng thái vào bộ nhớ
  
      // 1. Khóa/Mở các editor Ace
      Object.values(CodePen.editors).forEach(ed => {
          if (ed) {
              ed.setReadOnly(isReadOnly);
              ed.container.style.opacity = isReadOnly ? "0.6" : "1";
          }
      });
  
      // 2. Ẩn/Hiện Overlay ổ khóa
      const lockOverlay = document.getElementById('lock-overlay');
      if (lockOverlay) lockOverlay.style.display = isReadOnly ? 'flex' : 'none';
  
      // 3. Ẩn/Hiện nút Save
      const saveBtn = document.querySelector('[onclick="CodePenStorage.openSaveModal()"]');
      if (saveBtn) saveBtn.style.display = isReadOnly ? 'none' : 'inline-block';
  },

    localSnippets: [],  
    selectedImageFile: null,
    currentEditId: null,
    currentName: "Untitled",
    storageMode: "cloud", 
    libraryTab: "cloud",
    searchQuery: "",
    sortType: "newest",

    authCallback: null,
    pendingSnippet: null,
    LOCAL_KEY: "codepen_local_library",
    isLocked: false,

    // 1. QUẢN LÝ LOCAL
    async saveToLocalDB(item) {
      const db = await this.getDB();
      return new Promise((resolve) => {
          const transaction = db.transaction([this.STORE_NAME], "readwrite");
          const store = transaction.objectStore(this.STORE_NAME);
          
          if (!item.id || !String(item.id).startsWith("local_")) {
              item.id = "local_" + Date.now();
          }
          
          store.put(item);
          transaction.oncomplete = () => resolve(true);
      });
  },

  async loadLocalLibrary() {
      const db = await this.getDB();
      return new Promise((resolve) => {
          const transaction = db.transaction([this.STORE_NAME], "readonly");
          const store = transaction.objectStore(this.STORE_NAME);
          const request = store.getAll();
          request.onsuccess = () => {
              this.localSnippets = request.result;
              resolve(request.result);
          };
      });
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

    // FIX: Đồng bộ tên thông minh không gây mất focus
    updateNameUI(sourceId = null) {
        const headerInput = document.getElementById('active-snippet-name');
        const modalInput = document.getElementById('snippet-name-input');
        
        if (headerInput && sourceId !== 'active-snippet-name') headerInput.value = this.currentName;
        if (modalInput && sourceId !== 'snippet-name-input') modalInput.value = this.currentName;
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

    // 5. LOGIC CAPTURE
    startCaptureMode() {
        const overlay = document.getElementById('capture-overlay');
        const selection = document.getElementById('selection-box');
        const previewFrame = document.getElementById('preview-window');

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
                const rawBase64 = await modernScreenshot.domToJpeg(frameDoc.body, {
                    quality: 0.9, width: rect.width, height: rect.height,
                    style: { transform: `translate(-${startX}px, -${startY}px)`, width: frameDoc.body.scrollWidth + 'px', height: frameDoc.body.scrollHeight + 'px' }
                });
                this.selectedImageFile = await this.compressImage(rawBase64);
                document.getElementById('image-preview-element').src = this.selectedImageFile;
                document.getElementById('image-preview-element').style.display = 'block';
            } catch (e) { console.error(e); } finally { this.openSaveModal(); }
        };
    },

    // 6. MODAL LƯU
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

        if (this.currentEditId && updateBtn) {
            const isLocalId = String(this.currentEditId).startsWith("local_");
            if ((mode === 'cloud' && isLocalId) || (mode === 'local' && !isLocalId)) {
                updateBtn.style.display = 'none';
            } else { updateBtn.style.display = 'inline-block'; }
        }
        const accessSection = document.getElementById('access-mode-section');
        if (accessSection) {
            accessSection.style.display = (mode === 'local') ? 'none' : 'block';
        }
    },

    openSaveModal() {
        document.getElementById('save-modal-overlay').style.display = 'flex';
        this.updateNameUI();

        const editGroup = document.getElementById('edit-actions-group');
        const newGroup = document.getElementById('new-actions-group');
        const imgPrev = document.getElementById('image-preview-element');

        if (this.currentEditId) {
            const isLocalId = String(this.currentEditId).startsWith("local_");
            this.switchStorageMode(this.storageMode);
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
        const accessMode = document.getElementById('access-mode-input').value;
        const password = document.getElementById('password-input').value.trim();
        const activeButtons = document.querySelectorAll('.save-modal-actions .action-btn');
        
        if (accessMode === 'view' && !password) {
          alert("❌ Chế độ 'Chỉ xem' bắt buộc phải cài mật khẩu bảo vệ!");
          activeButtons.forEach(btn => { btn.disabled = false; btn.style.opacity = '1'; });
          return;
        }

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
                  id: forceUpdate ? this.currentEditId : null,
                  name: name,
                  author_name: author,
                  data: compressedData,
                  image_url: document.getElementById('image-preview-element').src,
                  created_at: new Date().toISOString(),
                  access_mode: 'edit'
              };
              await this.saveToLocalDB(item); // Đợi lưu vào DB xong mới chạy tiếp
              if (!forceUpdate) this.currentEditId = item.id;
              alert("✅ Đã lưu vào bộ nhớ IndexedDB (Private)!");
          } else {
                let password = document.getElementById('password-input').value.trim();
                let imageUrl = document.getElementById('image-preview-element').src;
                if (CodePenStorage.selectedImageFile) imageUrl = await this.uploadToCloudinary();

                const isPatch = forceUpdate && CodePenStorage.currentEditId;
                const method = isPatch ? 'PATCH' : 'POST';
                const url = isPatch ? `${SUPABASE_URL}/rest/v1/snippets?id=eq.${CodePenStorage.currentEditId}` : `${SUPABASE_URL}/rest/v1/snippets`;

                const response = await fetch(url, {
                    method: method,
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                    body: JSON.stringify({ name, data: compressedData, image_url: imageUrl, author_name: author, password: password || null, access_mode: accessMode })
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

    // --- 8. THƯ VIỆN (FIX LỖI GÕ CHỮ TRONG Ô TÌM KIẾM) ---
    async loadLibrary() {
      try {
          await this.loadLocalLibrary(); // Thêm await vào đây
          const res = await fetch(`${SUPABASE_URL}/rest/v1/snippets?select=*&order=created_at.desc`, {
              headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
          });
          this.currentSnippets = await res.json();
          this.renderLibraryUI();
      } catch (e) { this.renderLibraryUI(); }
  },

    // Hàm phụ để chỉ cập nhật danh sách, không vẽ lại ô input
    refreshLibraryList() {
        const listEl = document.getElementById('library-items-list');
        if (!listEl) return;

        let sourceData = this.libraryTab === 'local' ? this.localSnippets : this.currentSnippets;
        
        let filtered = sourceData.filter(item => {
            const query = this.searchQuery.toLowerCase();
            return item.name.toLowerCase().includes(query) || (item.author_name && item.author_name.toLowerCase().includes(query));
        });

        filtered.sort((a, b) => {
            if (this.sortType === 'name') return a.name.localeCompare(b.name);
            if (this.sortType === 'author') return (a.author_name || "").localeCompare(b.author_name || "");
            if (this.sortType === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
            return new Date(b.created_at) - new Date(a.created_at);
        });

        listEl.innerHTML = filtered.map(item => {
            const isLocal = String(item.id).startsWith("local_");
            const thumbUrl = item.image_url ? (isLocal ? item.image_url : item.image_url.replace('/upload/', '/upload/w_160,h_100,c_fill,q_auto,f_auto/')) : 'https://via.placeholder.com/80x50?text=No+Img';
            return `
                <div class="library-item" onclick="CodePenStorage.applySnippet('${item.id}')" style="border-left: 3px solid ${isLocal ? '#007acc' : '#28a745'}">
                    <img src="${thumbUrl}" class="snippet-thumb" style="width:80px; height:50px; object-fit:cover; border-radius:4px;">
                    <div class="library-item-info" style="flex:1; margin-left:10px;">
                      <span style="font-weight:bold">${CodePenStorage.escapeHTML(item.name)} ${item.password ? '🔒' : ''}</span><br>
                      <small class="author-tag" style="background:${isLocal ? '#007acc22' : '#28a74522'}">👤 ${CodePenStorage.escapeHTML(item.author_name || 'Duy Anh')}</small>
                    </div>
                    <div class="library-item-actions">
                        <span class="edit-btn" onclick="CodePenStorage.editSnippet('${item.id}', event)">✏️</span>
                        <span class="delete-btn-codepen" onclick="CodePenStorage.deleteSnippet('${item.id}', event)">🗑</span>
                    </div>
                </div>`;
        }).join('') || '<p style="text-align:center; color:#555; padding:20px;">Không tìm thấy kết quả...</p>';
    },

    renderLibraryUI() {
        let modal = document.querySelector('.library-modal-overlay');
        if (!modal) { 
            modal = document.createElement('div'); 
            modal.className = 'library-modal-overlay'; 
            document.body.appendChild(modal); 
        }
        
        // Vẽ khung Modal và Ô tìm kiếm (Chỉ vẽ 1 lần)
        modal.innerHTML = `
            <div class="library-modal" style="width: 450px;">
                <div class="library-tabs">
                    <div class="lib-tab ${this.libraryTab === 'cloud' ? 'active' : ''}" onclick="CodePenStorage.libraryTab='cloud'; CodePenStorage.renderLibraryUI()">☁️ Cloud</div>
                    <div class="lib-tab ${this.libraryTab === 'local' ? 'active' : ''}" onclick="CodePenStorage.libraryTab='local'; CodePenStorage.renderLibraryUI()">💻 Local</div>
                </div>

                <div class="library-search-filter">
                    <input type="text" class="lib-search-input" placeholder="Tìm tên hoặc tác giả..." value="${this.searchQuery}" 
                           oninput="CodePenStorage.searchQuery=this.value; CodePenStorage.refreshLibraryList()">
                    <select class="lib-sort-select" onchange="CodePenStorage.sortType=this.value; CodePenStorage.refreshLibraryList()">
                        <option value="newest" ${this.sortType==='newest'?'selected':''}>Mới nhất</option>
                        <option value="oldest" ${this.sortType==='oldest'?'selected':''}>Cũ nhất</option>
                        <option value="name" ${this.sortType==='name'?'selected':''}>Tên (A-Z)</option>
                        <option value="author" ${this.sortType==='author'?'selected':''}>Tác giả (A-Z)</option>
                    </select>
                </div>

                <div class="library-list" id="library-items-list" style="max-height:400px; overflow-y:auto;">
                    </div>
                <div style="text-align:right; margin-top:10px;"><button class="action-btn btn-secondary" onclick="this.closest('.library-modal-overlay').remove()">Close</button></div>
            </div>`;
        
        this.refreshLibraryList(); // Đổ dữ liệu vào list ngay sau khi vẽ khung
    },

    // --- CÁC HÀM BỊ THIẾU CẦN KHÔI PHỤC ---
    applySnippet(id) {
      const isLocal = String(id).startsWith("local_");
      const item = isLocal ? this.localSnippets.find(s => s.id === id) : this.currentSnippets.find(s => s.id === id);
      if (!item) return;
  
      this.requestAccess(item, () => {
          this.currentEditId = id; 
          this.currentName = item.name; 
          this.updateNameUI();
          try {
              const data = JSON.parse(LZString.decompressFromEncodedURIComponent(item.data));
              CodePen.editors.html.setValue(data.html || "", -1);
              CodePen.editors.css.setValue(data.css || "", -1);
              CodePen.editors.js.setValue(data.js || "", -1);
              CodePen.externalResources = data.resources || { css: [], js: [] };
              CodePen.run();
  
              // CHỈ CẦN DÒNG NÀY: Mọi việc khóa Editor, hiện ổ khóa, ẩn nút Save
              // đều đã được hàm setReadOnlyMode xử lý.
              const isLocked = (!isLocal && item.access_mode === 'view');
              this.setReadOnlyMode(isLocked);
  
              if (document.querySelector('.library-modal-overlay')) {
                  document.querySelector('.library-modal-overlay').remove();
              }
          } catch (e) { alert("Lỗi giải nén dữ liệu!"); }
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
            if (document.querySelector('.library-modal-overlay')) {
                document.querySelector('.library-modal-overlay').remove();
            }
        });
    },

    async deleteSnippet(id, event) {
        event.stopPropagation();
        const isLocal = String(id).startsWith("local_");
        const item = isLocal ? this.localSnippets.find(s => s.id === id) : this.currentSnippets.find(s => s.id === id);
        this.requestAccess(item, async () => {
            if (!confirm("Xóa vĩnh viễn snippet này?")) return;
            if (isLocal) {
              const db = await this.getDB();
              const transaction = db.transaction([this.STORE_NAME], "readwrite");
              transaction.objectStore(this.STORE_NAME).delete(id);
              transaction.oncomplete = () => this.loadLibrary(); // Load lại sau khi xóa xong
          } else {
                await fetch(`${SUPABASE_URL}/rest/v1/snippets?id=eq.${id}`, { 
                    method: 'DELETE', 
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } 
                });
            }
            this.loadLibrary();
        });
    },

    // --- PHỤ TRỢ ---
    async uploadToCloudinary() {
        if (!CodePenStorage.selectedImageFile) return null;
        const formData = new FormData();
        formData.append("file", CodePenStorage.selectedImageFile);
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
            CodePenStorage.selectedImageFile = await CodePenStorage.compressImage(event.target.result);
            document.getElementById('image-preview-element').src = CodePenStorage.selectedImageFile;
            document.getElementById('image-preview-element').style.display = 'block';
        };
        reader.readAsDataURL(file);
    },

    closeSaveModal() {
        document.getElementById('save-modal-overlay').style.display = 'none';
        document.getElementById('image-preview-element').style.display = 'none';
        CodePenStorage.selectedImageFile = null;
    },
    resetToNew() { 
      CodePenStorage.currentEditId = null; 
      CodePenStorage.currentName = "Untitled"; 
      CodePenStorage.updateNameUI(); 
      this.setReadOnlyMode(false);
      
      // MỞ KHÓA TẤT CẢ EDITOR
      Object.values(CodePen.editors).forEach(ed => {
          if (ed) {
              ed.setReadOnly(false);
              ed.container.style.opacity = "1";
          }
      });
      const saveBtn = document.querySelector('[onclick="CodePenStorage.openSaveModal()"]');
      if (saveBtn) saveBtn.style.display = 'inline-block';
    }
};

// ĐỒNG BỘ TÊN REAL-TIME KHÔNG MẤT FOCUS
document.addEventListener('input', (e) => {
    if (e.target.id === 'active-snippet-name' || e.target.id === 'snippet-name-input') {
        CodePenStorage.currentName = e.target.value;
        CodePenStorage.updateNameUI(e.target.id); // Truyền ID để không cập nhật lại chính nó
    }
});

// CÁC HÀM CỦA CODEPEN (BỔ SUNG ĐỒNG BỘ TÊN)
window.runCode = () => CodePen.run();
window.clearCode = () => {
    if (confirm("Clear?")) {
        Object.values(CodePen.editors).forEach(ed => ed && ed.setValue("", -1));
        CodePenStorage.resetToNew();
    }
};

// // ĐỒNG BỘ TÊN REAL-TIME
// document.addEventListener('input', (e) => {
//     if (e.target.id === 'active-snippet-name' || e.target.id === 'snippet-name-input') {
//         CodePenStorage.currentName = e.target.value;
//         CodePenStorage.updateNameUI();
//     }
// });

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
  autoRunEnabled: true,
  debounceTimer: null,
  STORAGE_KEY: "codepen_user_data",
  viewMode: "standard",
  activeTab: "html",

  editors: { html: null, css: null, js: null },
  externalResources: { css: [], js: [] },

  init() { 
    this.render(); 
    CodePenStorage.keepAlive(); 
    // Thêm dòng này để tự động chạy code ngay khi khởi tạo
    if (this.autoRunEnabled) {
        setTimeout(() => this.run(), 500); 
    }
  },

  render() {
    const container = document.getElementById("codepen-container");
    if (!container) return;

    const headerHtml = `
            <div class="preview-actions">
                <div class="brand-name">
            <input type="text" id="active-snippet-name" 
                   value="${CodePenStorage.escapeHTML(CodePenStorage.currentName)}"
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
                    <div id="lock-overlay">
                        <div class="lock-overlay-wrap">
                          <button class="action-btn btn-primary" id="btn-unlock-ui" onclick="CodePenStorage.unlockSnippet()">🔓 Nhập mã để Sửa</button>
                        </div>
                    </div>
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
                <div id="access-mode-section" style="margin-bottom:10px;">
                    <span style="display:block; font-size:10px; color:#ff9800; margin-bottom:4px; font-weight:bold;">CHẾ ĐỘ TRUY CẬP</span>
                    <select id="access-mode-input" style="width:100%; padding:10px; background:#252526; border:1px solid #444; color:white; border-radius:4px;">
                        <option value="edit">✏️ Cho phép Sửa (Công khai)</option>
                        <option value="view">👁️ Chỉ xem (Khóa Editor - Cần Pass)</option>
                    </select>
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
    <div class="save-modal-overlay" id="unlock-modal-overlay" style="display:none;">
    <div class="save-modal" style="width: 300px; border-top: 4px solid #ff9800;">
        <h4 style="margin:0 0 10px 0; color:#eee;">🔓 Mở khóa chỉnh sửa</h4>
        <p style="font-size: 11px; color: #aaa; margin-bottom: 15px;">Nhập mật khẩu của snippet này để mở quyền sửa.</p>
        
        <input type="password" id="unlock-pass-input" placeholder="Nhập mật khẩu..." 
               style="width:100%; padding:10px; background:#252526; border:1px solid #444; color:white; border-radius:4px; box-sizing:border-box; margin-bottom:15px;">
        
        <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button class="action-btn btn-secondary" onclick="document.getElementById('unlock-modal-overlay').style.display='none'">Hủy</button>
            <button class="action-btn" style="background:#ff9800; color:white;" onclick="CodePenStorage.verifyUnlock()">Xác nhận</button>
        </div>
    </div>
</div>
`);

    this.setupCommonEvents();
    this.initAce();
    this.initResizers();
    this.syncThemeColors();

    setTimeout(() => {
      const theme = document.getElementById("theme-selector").value;
      Object.values(this.editors).forEach(ed => {
        if (ed) {
            ed.setTheme(theme);
            ed.renderer.updateFull(); // Ép render lại toàn bộ giao diện editor
        }
      });
    }, 50);

    if (this.viewMode === "standard") {
      const overlay = document.getElementById("preview-overlay-container");
      const defaultY = window.innerHeight * 0.45;
      overlay.style.transform = `translateY(${defaultY}px)`;
      overlay.style.height = `calc(100vh - ${defaultY}px)`;
      this.updateScrollMargins(defaultY);
    }
    setTimeout(() => {
      CodePenStorage.setReadOnlyMode(CodePenStorage.isLocked);
  }, 10);
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
    
    // NÂNG CẤP: Thêm class dựa trên loại log
    logItem.className = `log-item log-${method}`; 
    
    // Thêm icon nhỏ phía trước để phân biệt
    let prefix = "";
    if (method === 'error') prefix = "❌ ";
    if (method === 'warn') prefix = "⚠️ ";
    if (method === 'info') prefix = "ℹ️ ";

    logItem.innerText = prefix + args
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
    const selectedTheme = document.getElementById("theme-selector")?.value || "ace/theme/monokai";

    const config = {
      theme: selectedTheme,
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
    const themeSelect = document.getElementById("theme-selector");
    if (!themeSelect) return;
    
    // Đợi 1 chút để Ace load xong CSS của theme rồi lấy màu background của nó
    setTimeout(() => {
        const editorEl = document.querySelector(".ace_editor");
        if (!editorEl) return;
        
        const style = window.getComputedStyle(editorEl);
        const bgColor = style.backgroundColor;
        const textColor = style.color;

        // Áp dụng màu này cho các thanh tiêu đề và gutter để trông đồng bộ
        document.querySelectorAll(".editor-label, .custom-line-numbers, .split-tabs-header").forEach(el => {
            el.style.backgroundColor = bgColor;
            el.style.color = textColor;
            el.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
        });
    }, 200);
  },

  // --- CHỖ CẦN SỬA: Hàm bảo vệ thông minh hơn ---
  protectJS(code, timeoutLimit) {
    const timeoutMs = (timeoutLimit || 5) * 1000;
    
    // Khởi tạo context bảo vệ
    const helper = `
      window._loopContext = { startTime: Date.now(), iterationCount: 0, timeoutLimit: ${timeoutMs} };
      window._checkLoop = function() {
        window._loopContext.iterationCount++;
        if (window._loopContext.iterationCount % 100 === 0) { // Kiểm tra dày hơn (mỗi 100 lần)
          if (Date.now() - window._loopContext.startTime > window._loopContext.timeoutLimit) {
            const msg = "⚠️ PHÁT HIỆN TREO MÁY: Code chạy quá " + (window._loopContext.timeoutLimit/1000) + " giây.\\n\\nBấm OK để chạy tiếp.\\nBấm Cancel để DỪNG code.";
            if (window.confirm(msg)) {
                window._loopContext.startTime = Date.now();
            } else {
                throw new Error("DỪNG VÒNG LẶP VÔ TẬN");
            }
          }
        }
      };
    `;

    // Regex "Pro": Tự động thêm dấu { } nếu người dùng viết vòng lặp viết tắt
    // Ví dụ: while(true) console.log(1); -> while(true) { _checkLoop(); console.log(1); }
    let protectedCode = code;
    
    // Bắt các vòng lặp: for, while, do...while
    const loopRegex = /\b(for|while|do)\b\s*(\(.*\))?\s*\{?/g;
    
    protectedCode = protectedCode.replace(loopRegex, (match) => {
        if (match.trim().endsWith('{')) {
            return `${match} _checkLoop();`;
        }
        // Nếu vòng lặp không có dấu {, ta phải bọc nó lại (phức tạp hơn)
        return `${match} { _checkLoop(); `; 
    });

    return helper + protectedCode;
},
  run() {
    const html = this.editors.html.getValue();
    const css = this.editors.css.getValue();
    // const js = this.editors.js.getValue();
    const rawJS = this.editors.js.getValue();
    
    // Đọc giá trị Timeout từ ô Input người dùng nhập
    const timeoutInput = document.getElementById('loop-timeout-limit');
    const userTimeout = timeoutInput ? parseInt(timeoutInput.value) : 5;

    // Truyền cả code và giới hạn thời gian vào protectJS
    const js = this.protectJS(rawJS, userTimeout);
    const previewEl = document.getElementById("preview-window");
    if (!previewEl) return;

    previewEl.srcdoc = "";

    const extCSS = this.externalResources.css.map((url) => `<link rel="stylesheet" href="${url}">`).join("\n");
    const extJS = this.externalResources.js.map((url) => `<script src="${url}"><\/script>`).join("\n");

    const content = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/splitting/dist/splitting.css" />
    ${extCSS}
    <style>body{margin:0;padding:15px;font-family:'Poppins',sans-serif;color:black;} ${css}</style>
    <script>
    (function(){
        let logCount = 0;
        let lastLogTime = Date.now();
        const MAX_LOGS = 500; 
        const RECOVERY_COUNT = 10; // Số lượng log gần nhất muốn giữ lại
        let logBuffer = []; // Bộ nhớ tạm lưu 10 log gần nhất

        ['log','warn','error','info'].forEach(m=>{
            const o = console[m];
            console[m] = function(...a){
                logCount++;

                // 1. Luôn cập nhật bộ nhớ tạm (Giữ 10 dòng mới nhất)
                logBuffer.push({ method: m, args: a });
                if (logBuffer.length > RECOVERY_COUNT) logBuffer.shift();

                // 2. Kiểm tra giới hạn
                if (logCount > MAX_LOGS) {
                    if (logCount === MAX_LOGS + 1) {
                        // Gửi cảnh báo chính
                        window.parent.postMessage({
                            type:'iframe-log',
                            method:'error',
                            arguments:["❌ PHÁT HIỆN SPAM: Đã dừng log để bảo vệ trình duyệt. Dưới đây là " + RECOVERY_COUNT + " dòng cuối cùng:"]
                        },'*');

                        // Gửi 10 dòng log "tử thần" trong bộ nhớ tạm ra máy mẹ
                        logBuffer.forEach(log => {
                            window.parent.postMessage({
                                type:'iframe-log',
                                method: log.method,
                                arguments: log.args
                            },'*');
                        });
                    }
                    return; 
                }

                // 3. Throttle: Chặn tốc độ gửi postMessage để tránh nghẽn (30ms)
                const now = Date.now();
                if (now - lastLogTime > 30) {
                    window.parent.postMessage({type:'iframe-log',method:m,arguments:a},'*');
                    lastLogTime = now;
                }

                o.apply(console,a);
            };
        });
        
        // Giữ nguyên logic window.onerror bên dưới...
        window.onerror = function(message, source, lineno, colno, error) {
            window.parent.postMessage({
                type: 'iframe-log',
                method: 'error',
                arguments: [message + " (Dòng: " + lineno + ")"]
            }, '*');
            return false;
        };
    })();
    <\/script>
</head>
<body>
    ${html}
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"><\/script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"><\/script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/Draggable.min.js"><\/script>
    <script src="https://unpkg.com/splitting/dist/splitting.min.js"><\/script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js"></script>
    ${extJS}
    
    <script type="module">
        // Tự động khởi tạo thư viện
        if(typeof Splitting!=='undefined') Splitting();
        if(typeof gsap!=='undefined') gsap.registerPlugin(ScrollTrigger,Draggable);

        // THỰC THI CODE NGƯỜI DÙNG (Không bọc try-catch để cho phép dùng 'import')
        ${js}
    <\/script>
</body>
</html>`;
    previewEl.srcdoc = content;
},
};

window.runCode = () => CodePen.run();
window.clearCode = () => CodePen.clear();
document.addEventListener("DOMContentLoaded", () => CodePen.init());
