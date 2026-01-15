window.MoodFlow = {
    currentDate: new Date(),
    viewMode: 'month', // Các chế độ: 'week', 'month', 'year'
    activeDate: null,
    activeIndex: 0,
    tempScore: 3,

    /**
     * Nạp giao diện và khởi tạo lịch
     */
    renderDashboard(container) {
        const fs = require('fs');
        const path = require('path');
        // Đảm bảo đường dẫn này trỏ đúng đến file HTML của bạn
        container.innerHTML = fs.readFileSync(path.join(__dirname, '../ui/features/moodFlow.html'), 'utf8');
        this.renderCalendar();
    },

    /**
     * Logic Xoá tất cả: Reset hoàn toàn object moods trong Knotion
     */
    deleteAll() {
        if (confirm("Bạn có chắc chắn muốn xoá sạch toàn bộ dữ liệu cảm xúc? Hành động này không thể hoàn tác.")) {
            window.Knotion.data.moods = {}; 
            window.Knotion.saveData();      
            this.renderCalendar();          
            alert("Đã xoá sạch dữ liệu.");
        }
    },

    /**
     * Mở Modal: Ưu tiên hiển thị bản ghi mới nhất của ngày đó
     */
    openModal(dateKey) {
        this.activeDate = dateKey;
        const data = window.Knotion.data.moods[dateKey];
        document.getElementById('modal-date-title').innerText = `Ngày ${dateKey}`;
        document.getElementById('mf-modal').style.display = 'flex';

        if (data && data.entries && data.entries.length > 0) {
            // Hiển thị bản ghi cuối cùng, 'false' để kích hoạt kiểm tra hiện nút "Xem lịch sử"
            this.showDetail(data.entries.length - 1, false); 
        } else {
            this.startFlow('new');
        }
    },

    /**
     * Hiển thị chi tiết một lần đánh giá
     * @param {number} idx - Vị trí của entry trong mảng
     * @param {boolean} fromHistory - Nếu true, hiện nút "Quay lại", nếu false, hiện nút "Xem lịch sử"
     */
    showDetail(idx, fromHistory = true) {
        this.activeIndex = idx;
        const data = window.Knotion.data.moods[this.activeDate];
        const entry = data.entries[idx];
        
        document.getElementById('modal-step-tag').innerText = "Mood Detail";
        document.getElementById('modal-history-state').style.display = 'none';
        document.getElementById('modal-view-state').style.display = 'block';
        document.getElementById('modal-entry-flow').style.display = 'none';

        document.getElementById('view-img').src = `../assets/alien0${entry.score}.png`;
        document.getElementById('view-time').innerText = `Ghi nhận lúc ${entry.time}`;
        document.getElementById('view-note').innerText = entry.note || 'Lặng yên không ghi chú.';

        const btnHistory = document.getElementById('btn-view-history');
        const btnBack = document.getElementById('btn-back-to-history');

        if (fromHistory) {
            btnHistory.style.display = 'none';
            btnBack.style.display = 'block';
        } else {
            // SỬA: Kiểm tra data.entries tồn tại và có từ 2 bản ghi trở lên
            btnHistory.style.display = (data && data.entries && data.entries.length > 1) ? 'block' : 'none';
            btnBack.style.display = 'none';
        }
    },

    /**
     * Hiển thị danh sách lịch sử đánh giá trong ngày (Mới nhất lên đầu)
     */
    showHistory() {
        document.getElementById('modal-step-tag').innerText = "Mood History";
        document.getElementById('modal-history-state').style.display = 'block';
        document.getElementById('modal-view-state').style.display = 'none';
        document.getElementById('modal-entry-flow').style.display = 'none';

        const data = window.Knotion.data.moods[this.activeDate];
        const list = document.getElementById('history-items');
        list.innerHTML = '';

        // Đảo ngược mảng để hiện cái mới nhất lên trên
        [...data.entries].reverse().forEach((entry, reverseIdx) => {
            const originalIdx = data.entries.length - 1 - reverseIdx;
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <img src="../assets/alien0${entry.score}.png">
                <div>
                    <div class="time">${entry.time}</div>
                    <div class="note-snippet">${entry.note || 'Không có ghi chú'}</div>
                </div>
            `;
            item.onclick = () => this.showDetail(originalIdx, true);
            list.appendChild(item);
        });
    },

    /**
     * Bắt đầu luồng nhập liệu cảm xúc
     */
    startFlow(mode) {
        document.getElementById('modal-step-tag').innerText = mode === 'edit' ? "Updating Mood" : "New Mood";
        document.getElementById('modal-history-state').style.display = 'none';
        document.getElementById('modal-view-state').style.display = 'none';
        document.getElementById('modal-entry-flow').style.display = 'block';

        if (mode === 'edit') {
            const entry = window.Knotion.data.moods[this.activeDate].entries[this.activeIndex];
            this.tempScore = entry.score;
            document.getElementById('entry-note').value = entry.note;
        } else {
            this.tempScore = 3;
            document.getElementById('entry-note').value = '';
            const data = window.Knotion.data.moods[this.activeDate];
            this.activeIndex = data ? data.entries.length : 0;
        }
        this.showStep(1);
    },

    /**
     * Lưu dữ liệu cảm xúc
     */
    finalize() {
        const note = document.getElementById('entry-note').value;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (!window.Knotion.data.moods[this.activeDate]) {
            window.Knotion.data.moods[this.activeDate] = { entries: [] };
        }
        
        const dayData = window.Knotion.data.moods[this.activeDate];
        const entryObj = { score: this.tempScore, note, time };

        // SỬA: Luôn sử dụng .push() để thêm bản ghi mới vào mảng thay vì gán theo index
        // Điều này đảm bảo mỗi lần "Cập nhật" sẽ tạo ra một dòng mới trong lịch sử
        dayData.entries.push(entryObj);
        
        // Trỏ activeIndex vào bản ghi cuối cùng vừa được thêm
        this.activeIndex = dayData.entries.length - 1;

        window.Knotion.saveData();
        // Sau khi lưu, hiển thị chi tiết bản ghi mới nhất
        this.showDetail(this.activeIndex, false); 
        this.renderCalendar();
    },

    /**
     * Vẽ lưới Pixel dựa trên ViewMode (Tuần/Tháng/Năm)
     */
    renderCalendar() {
        const grid = document.getElementById('mf-grid');
        const label = document.getElementById('mf-label');
        grid.innerHTML = '';
        grid.className = `mf-grid ${this.viewMode}-view`;

        const todayKey = this.getTodayKey();
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        let startDate, endDate;
        if (this.viewMode === 'month') {
            label.innerText = `Tháng ${String(month + 1).padStart(2, '0')}/${year}`;
            startDate = new Date(year, month, 1);
            endDate = new Date(year, month + 1, 0);
        } else if (this.viewMode === 'week') {
            const current = new Date(this.currentDate);
            const first = current.getDate() - current.getDay();
            startDate = new Date(current.setDate(first));
            endDate = new Date(current.setDate(first + 6));
            label.innerText = `Tuần: ${startDate.toLocaleDateString('vi-VN')}`;
        } else {
            label.innerText = `Năm ${year}`;
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31);
        }

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const px = document.createElement('div');
            px.className = 'px-box';
            px.innerText = d.getDate();

            const data = window.Knotion.data.moods[dateKey];
            const isFuture = d > new Date();
            const isToday = dateKey === todayKey;

            if (isFuture) {
                px.classList.add('future');
            } else if (data && data.entries?.length > 0) {
                const lastScore = data.entries[data.entries.length - 1].score;
                px.classList.add(`s${lastScore}`);
                px.onclick = () => this.openModal(dateKey);
            } else if (isToday) {
                px.classList.add('today-empty');
                px.onclick = () => this.openModal(dateKey);
            } else {
                // Ngày quá khứ chưa chấm mặc định màu xanh biển (skipped)
                px.classList.add('skipped'); 
                px.onclick = () => this.openModal(dateKey);
            }
            grid.appendChild(px);
        }
    },

    /**
     * Xoá lần ghi nhận đang xem
     */
    deleteActiveEntry() {
        if (!confirm("Xoá lần ghi nhận này?")) return;
        const dayData = window.Knotion.data.moods[this.activeDate];
        dayData.entries.splice(this.activeIndex, 1);
        
        if (dayData.entries.length === 0) {
            delete window.Knotion.data.moods[this.activeDate];
            this.closeModal();
        } else {
            window.Knotion.saveData();
            this.showHistory(); // Quay lại danh sách lịch sử sau khi xoá 1 item
        }
        
        window.Knotion.saveData();
        this.renderCalendar();
    },

    // --- CÁC HÀM TIỆN ÍCH ---
    setViewMode(mode) { this.viewMode = mode; this.renderCalendar(); },
    showStep(n) {
        document.getElementById('step-1').style.display = n === 1 ? 'block' : 'none';
        document.getElementById('step-2').style.display = n === 2 ? 'block' : 'none';
    },
    getTodayKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },
    nextStep(score) { this.tempScore = score; this.showStep(2); },
    backToStep1() { this.showStep(1); },
    closeModal() { document.getElementById('mf-modal').style.display = 'none'; },
    changeMonth(v) { this.currentDate.setMonth(this.currentDate.getMonth() + v); this.renderCalendar(); },
    goToToday() { this.currentDate = new Date(); this.renderCalendar(); }
};