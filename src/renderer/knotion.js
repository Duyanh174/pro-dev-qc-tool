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

        loadNote(id) {
            this.activeNoteId = id;
            const note = this.data.notes.find(n => n.id === id);
            if (!note) return;

            this.showWorkspace(true);
            const titleInp = document.getElementById('note-title');
            titleInp.value = note.title;
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