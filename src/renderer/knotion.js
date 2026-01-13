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

            // 1. Quản lý đường dẫn lưu trữ
            const savedPath = localStorage.getItem('knotion_custom_path');
            this.saveDir = savedPath || path.join(os.homedir(), 'Documents', 'KnotionData');
            this.saveFile = path.join(this.saveDir, 'data.json');

            if (!fs.existsSync(this.saveDir)) fs.mkdirSync(this.saveDir, { recursive: true });

            // 2. Render UI
            const htmlPath = path.join(__dirname, '../ui/features/knotion.html');
            if (fs.existsSync(htmlPath)) {
                container.innerHTML = fs.readFileSync(htmlPath, 'utf8');
                document.getElementById('current-path-display').innerText = this.saveDir;
                
                this.loadData();
                this.renderNoteList();
                
                // Khởi tạo trạng thái ban đầu
                if (this.data.notes.length > 0) {
                    this.loadNote(this.data.notes[0].id);
                } else {
                    this.showWorkspace(false);
                }
            }
            this.fixAceOptions();
        },

        fixAceOptions() {
            if (window.ace) ace.config.set('basePath', 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.7/');
            // Fix CodePen crash
            if (window.CodePenStorage && !CodePenStorage.keepAlive) {
                CodePenStorage.keepAlive = () => true;
            }
        },

        async changeStoragePath() {
            const res = await ipcRenderer.invoke('select-folder');
            if (!res.canceled) {
                const newPath = res.filePaths[0];
                if (confirm(`Move data to: ${newPath}?`)) {
                    const newFile = path.join(newPath, 'data.json');
                    if (fs.existsSync(this.saveFile)) fs.copyFileSync(this.saveFile, newFile);
                    localStorage.setItem('knotion_custom_path', newPath);
                    this.init();
                }
            }
        },

        showWorkspace(visible) {
            document.getElementById('editor-workspace').style.display = visible ? 'block' : 'none';
            document.getElementById('empty-state').style.display = visible ? 'none' : 'flex';
        },

        loadData() {
            if (fs.existsSync(this.saveFile)) {
                try {
                    this.data = JSON.parse(fs.readFileSync(this.saveFile, 'utf8'));
                } catch(e) { this.data = { notes: [], moods: {} }; }
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

        initEditor(initialData) {
            if (this.editor && typeof this.editor.destroy === 'function') this.editor.destroy();

            // Đăng ký Plugin an toàn
            const tools = {};
            if (window.Header) tools.header = Header;
            if (window.List) tools.list = List;
            if (window.Checklist) tools.checklist = Checklist;
            if (window.Quote) tools.quote = Quote;
            if (window.Code) tools.code = Code;
            if (window.Table) tools.table = Table;
            if (window.Warning) tools.warning = Warning;
            if (window.Marker) tools.marker = Marker;
            if (window.InlineCode) tools.inlineCode = InlineCode;

            this.editor = new EditorJS({
                holder: 'editorjs',
                data: initialData || { blocks: [] },
                placeholder: 'Type "/" for commands...',
                tools: tools,
                onChange: async () => {
                    if (this.activeNoteId) {
                        const content = await this.editor.save();
                        this.updateActiveNote(content);
                    }
                }
            });
        },

        createNote() {
            const newNote = {
                id: 'k_' + Date.now(),
                title: '',
                content: { blocks: [] },
                isPinned: false,
                time: new Date().getTime()
            };
            this.data.notes.unshift(newNote);
            this.saveData();
            this.loadNote(newNote.id);
        },

        openMoodFlow(tabName = 'emotions') {
            // 1. Cập nhật trạng thái ID
            this.activeNoteId = 'mood_flow_system';
        
            // 2. Xử lý UI Highlight ở Sidebar
            // Xóa class 'active' khỏi tất cả các Note
            document.querySelectorAll('.knot-item').forEach(el => el.classList.remove('active'));
            // Thêm class 'active' vào mục Mood Flow
            const mfItem = document.getElementById('mf-sidebar-item');
            if (mfItem) mfItem.classList.add('active');
        
            // 3. Chuyển đổi vùng hiển thị bên phải
            document.getElementById('editor-workspace').style.display = 'none';
            document.getElementById('empty-state').style.display = 'none';
            
            let mfWorkspace = document.getElementById('moodflow-workspace');
            if (!mfWorkspace) {
                mfWorkspace = document.createElement('div');
                mfWorkspace.id = 'moodflow-workspace';
                mfWorkspace.className = 'editor-scroll-container';
                document.querySelector('.knotion-editor-area').appendChild(mfWorkspace);
            }
            mfWorkspace.style.display = 'block';
        
            // 4. Gọi MoodFlow render nội dung
            if (window.MoodFlow) {
                window.MoodFlow.renderDashboard(mfWorkspace, tabName);
            }
            
            // Ẩn chấm đỏ thông báo sau khi người dùng đã vào xem
            const dot = document.getElementById('mood-notif-dot');
            if (dot) dot.style.display = 'none';
        },
        
        
        loadNote(id) {
            // 1. XỬ LÝ GIAO DIỆN (UI SWITCH)
            // Ẩn vùng làm việc của Mood Flow nếu đang mở
            const mfWorkspace = document.getElementById('moodflow-workspace');
            if (mfWorkspace) {
                mfWorkspace.style.display = 'none';
            }
        
            // Xóa Highlight của Mood Flow ở Sidebar để người dùng biết đã thoát chức năng này
            const mfSidebarItem = document.getElementById('mf-sidebar-item');
            if (mfSidebarItem) {
                mfSidebarItem.classList.remove('active');
            }
        
            // Hiện vùng Editor và ẩn trạng thái trống
            document.getElementById('editor-workspace').style.display = 'block';
            document.getElementById('empty-state').style.display = 'none';
        
            // 2. GIỮ NGUYÊN LOGIC CŨ CỦA BẠN
            this.activeNoteId = id;
            const note = this.data.notes.find(n => n.id === id);
            if (!note) return;
        
            this.showWorkspace(true);
            const titleInp = document.getElementById('note-title');
            titleInp.value = note.title;
            
            // Logic lưu tiêu đề khi nhập liệu
            titleInp.oninput = () => {
                note.title = titleInp.value;
                this.renderNoteList();
                this.saveData();
            };
        
            // Khởi tạo Editor và cập nhật danh sách Sidebar (đã bao gồm highlight note đang chọn)
            this.initEditor(note.content);
            this.renderNoteList();
        },

        updateActiveNote(content) {
            const note = this.data.notes.find(n => n.id === this.activeNoteId);
            if (note) { note.content = content; this.saveData(); }
        },

        togglePin(id, e) {
            e.stopPropagation();
            const note = this.data.notes.find(n => n.id === id);
            if (note) { note.isPinned = !note.isPinned; this.saveData(); this.renderNoteList(); }
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

        filterNotes() {
            const query = document.getElementById('knot-search').value.toLowerCase();
            this.renderNoteList(query);
        },

        renderNoteList(filter = '') {
            const allList = document.getElementById('knot-list');
            const pinnedList = document.getElementById('pinned-list');
            const pinnedSection = document.getElementById('pinned-section');
            if (!allList) return;

            const filtered = this.data.notes.filter(n => n.title.toLowerCase().includes(filter));
            const pinned = filtered.filter(n => n.isPinned);
            const others = filtered.filter(n => !n.isPinned);

            pinnedSection.style.display = pinned.length > 0 ? 'block' : 'none';

            const itemHtml = (notes) => notes.map(n => `
                <div class="knot-item ${this.activeNoteId === n.id ? 'active' : ''}" onclick="Knotion.loadNote('${n.id}')">
                    <span class="knot-icon">📄</span>
                    <span class="knot-name">${n.title || 'Untitled'}</span>
                    <div class="knot-actions">
                        <button class="knot-pin ${n.isPinned ? 'active' : ''}" onclick="Knotion.togglePin('${n.id}', event)">📌</button>
                        <button class="knot-del" onclick="Knotion.deleteNote('${n.id}', event)">×</button>
                    </div>
                </div>
            `).join('');

            pinnedList.innerHTML = itemHtml(pinned);
            allList.innerHTML = itemHtml(others);
        },

        toggleSidebar() {
            document.getElementById('knotion-sidebar').classList.toggle('collapsed');
        }
    };

    Knotion.init();
}