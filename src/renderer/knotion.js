{
    const path = require('path');
    const fs = require('fs');
    const os = require('os');
    const { ipcRenderer } = require('electron');

    window.Knotion = {
        data: { notes: [], moods: {} },
        activeNoteId: null,
        editor: null,
        saveDir: '',
        saveFile: '',

        init() {
            const container = document.getElementById('knotion-container');
            if (!container) return;

            // 1. Xác định thư mục lưu trữ (Ưu tiên cấu hình người dùng)
            const savedPath = localStorage.getItem('knotion_custom_path');
            this.saveDir = savedPath || path.join(os.homedir(), 'Documents', 'KnotionData');
            this.saveFile = path.join(this.saveDir, 'data.json');

            if (!fs.existsSync(this.saveDir)) {
                fs.mkdirSync(this.saveDir, { recursive: true });
            }

            // 2. Nạp HTML giao diện
            const htmlPath = path.join(__dirname, '../ui/features/knotion.html');
            if (fs.existsSync(htmlPath)) {
                container.innerHTML = fs.readFileSync(htmlPath, 'utf8');
                
                // Hiển thị đường dẫn ở footer sidebar
                const pathDisp = document.getElementById('current-path-display');
                if (pathDisp) pathDisp.innerText = this.saveDir;

                this.loadData();
                this.renderNoteList();
                
                // Trạng thái ban đầu: Nếu có note thì load cái đầu tiên, không thì hiện Empty
                if (this.data.notes.length > 0) {
                    this.loadNote(this.data.notes[0].id);
                } else {
                    this.showWorkspace(false);
                }
            }
            this.fixAceOptions();
        },

        fixAceOptions() {
            if (window.ace) {
                ace.config.set('basePath', 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.7/');
            }
        },

        // --- HÀM CẤU HÌNH ĐƯỜNG DẪN ---
        async changeStoragePath() {
            const res = await ipcRenderer.invoke('select-folder');
            if (!res.canceled) {
                const newPath = res.filePaths[0];
                if (confirm(`Chuyển dữ liệu sang: ${newPath}?`)) {
                    const newFile = path.join(newPath, 'data.json');
                    if (fs.existsSync(this.saveFile)) {
                        fs.copyFileSync(this.saveFile, newFile);
                    }
                    localStorage.setItem('knotion_custom_path', newPath);
                    this.init(); // Khởi động lại
                }
            }
        },

        showWorkspace(visible) {
            const workspace = document.getElementById('editor-workspace');
            const empty = document.getElementById('empty-state');
            if (workspace) workspace.style.display = visible ? 'block' : 'none';
            if (empty) empty.style.display = visible ? 'none' : 'flex';
        },

        loadData() {
            if (fs.existsSync(this.saveFile)) {
                try {
                    this.data = JSON.parse(fs.readFileSync(this.saveFile, 'utf8'));
                } catch(e) { console.error("Data corrupt"); }
            }
        },

        saveData() {
            fs.writeFileSync(this.saveFile, JSON.stringify(this.data, null, 2));
            const status = document.getElementById('save-status');
            if (status) {
                status.innerText = '● Auto-saved';
                setTimeout(() => status.innerText = '', 1000);
            }
        },

        // --- FIX LỖI EDITOR: Kiểm tra kỹ plugin ---
        initEditor(initialData) {
            if (this.editor && typeof this.editor.destroy === 'function') {
                this.editor.destroy();
            }

            const tools = {};
            // Chỉ thêm vào tools nếu class Plugin đó thực sự tồn tại (đã load xong từ CDN)
            if (window.Header) tools.header = Header;
            if (window.List) tools.list = List;
            if (window.Checklist) tools.checklist = Checklist;
            if (window.Quote) tools.quote = Quote;
            if (window.Code) tools.code = Code;
            if (window.Table) tools.table = Table;

            this.editor = new EditorJS({
                holder: 'editorjs',
                data: initialData || { blocks: [] },
                placeholder: 'Gõ "/" để chọn lệnh...',
                tools: tools,
                onChange: async () => {
                    if (this.activeNoteId) {
                        const savedContent = await this.editor.save();
                        this.updateActiveNote(savedContent);
                    }
                }
            });
        },

        createNote() {
            const newNote = {
                id: 'k_' + Date.now(),
                title: '',
                content: { blocks: [] },
                time: new Date().getTime()
            };
            this.data.notes.unshift(newNote);
            this.saveData();
            this.loadNote(newNote.id);
        },

        loadNote(id) {
            this.activeNoteId = id;
            const note = this.data.notes.find(n => n.id === id);
            if (!note) return;

            this.showWorkspace(true);
            const titleInp = document.getElementById('note-title');
            titleInp.value = note.title;
            
            // Logic cập nhật title trực tiếp
            titleInp.oninput = () => {
                note.title = titleInp.value;
                this.renderNoteList();
                this.saveData();
            };

            this.initEditor(note.content);
            this.renderNoteList();
        },

        updateActiveNote(content) {
            const note = this.data.notes.find(n => n.id === this.activeNoteId);
            if (note) {
                note.content = content;
                this.saveData();
            }
        },

        deleteNote(id, e) {
            e.stopPropagation();
            if (confirm("Xóa vĩnh viễn ghi chú này?")) {
                this.data.notes = this.data.notes.filter(n => n.id !== id);
                this.saveData();
                if (this.activeNoteId === id) {
                    this.activeNoteId = null;
                    this.showWorkspace(false);
                }
                this.renderNoteList();
            }
        },

        renderNoteList() {
            const list = document.getElementById('knot-list');
            if (!list) return;
            list.innerHTML = this.data.notes.map(n => `
                <div class="knot-item ${this.activeNoteId === n.id ? 'active' : ''}" onclick="Knotion.loadNote('${n.id}')">
                    <span class="knot-icon">📄</span>
                    <span class="knot-name">${n.title || 'Untitled'}</span>
                    <button class="knot-del" onclick="Knotion.deleteNote('${n.id}', event)">×</button>
                </div>
            `).join('');
        },

        toggleSidebar() {
            const sidebar = document.getElementById('knotion-sidebar');
            if (sidebar) sidebar.classList.toggle('collapsed');
        }
    };

    Knotion.init();
}