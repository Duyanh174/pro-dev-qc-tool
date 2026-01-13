window.MoodFlow = {
    currentDate: new Date(),
    isYear: false,
    tempScore: 0,
    activeKey: null,
    mode: 'new', // new, reassess, add
    textMap: {
        1: "Có vẻ như bạn đang trải qua một giai đoạn khó khăn.",
        2: "Một chút trầm lắng, hãy dành thời gian cho bản thân nhé.",
        3: "Mọi thứ đang ở mức bình ổn.",
        4: "Năng lượng tích cực đang lan tỏa đến bạn.",
        5: "Tuyệt vời, một trạng thái thăng hoa đỉnh cao!"
    },

    // Hàm lấy key ngày theo giờ địa phương (Tránh lệch múi giờ)
    getTodayKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },

    renderDashboard(container) {
        const fs = require('fs');
        const path = require('path');
        container.innerHTML = fs.readFileSync(path.join(__dirname, '../ui/features/moodFlow.html'), 'utf8');
        this.renderCalendar();
        
        // Đóng tooltip khi click ra ngoài
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.px-box') && !e.target.closest('.mf-tooltip')) this.hideTooltips();
        });
    },

    openModal(mode, key = null) {
        this.mode = mode;
        this.activeKey = key || this.getTodayKey();
        document.getElementById('mf-modal').style.display = 'flex';
        document.getElementById('mf-note').value = '';
        this.showStep(1);
    },

    closeModal() { 
        document.getElementById('mf-modal').style.display = 'none'; 
        this.hideTooltips(); 
    },

    showStep(n) {
        document.querySelectorAll('.mf-step').forEach(s => s.style.display = 'none');
        document.getElementById(`mf-step-${n}`).style.display = 'block';
        document.getElementById('mf-step-info').innerText = `Bước ${n}/3`;
    },

    selectMood(score) {
        this.tempScore = score;
        document.getElementById('mf-feedback').innerText = this.textMap[score];
        this.showStep(2);
    },

    saveData() {
        const note = document.getElementById('mf-note').value;
        const key = this.activeKey;
        if (!window.Knotion.data.moods) window.Knotion.data.moods = {};

        let dayData = window.Knotion.data.moods[key];

        if (this.mode === 'reassess' || !dayData) {
            // Ghi đè hoặc Tạo mới hoàn toàn
            window.Knotion.data.moods[key] = { scores: [this.tempScore], notes: [note], avg: this.tempScore };
        } else if (this.mode === 'add') {
            // Thêm sự kiện & Tính trung bình cộng
            dayData.scores.push(this.tempScore);
            if (note) dayData.notes.push(note);
            const sum = dayData.scores.reduce((a, b) => a + b, 0);
            dayData.avg = Math.round(sum / dayData.scores.length);
        }

        window.Knotion.saveData();
        this.closeModal();
        this.renderCalendar();
    },

    renderCalendar() {
        const grid = document.getElementById('mf-grid');
        const label = document.getElementById('mf-label');
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        grid.innerHTML = '';

        if (!this.isYear) {
            grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
            label.innerText = `Tháng ${String(month + 1).padStart(2, '0')}/${year}`;
            
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const todayKey = this.getTodayKey();

            for (let d = 1; d <= daysInMonth; d++) {
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const px = document.createElement('div');
                px.className = 'px-box';
                
                const data = window.Knotion.data.moods?.[dateKey];

                if (data && data.avg) {
                    px.classList.add(`s${data.avg}`);
                    px.onclick = (e) => this.showTooltip(e, dateKey);
                } else if (dateKey === todayKey) {
                    px.classList.add('today-empty');
                    px.onclick = () => this.openModal('new', dateKey);
                }
                grid.appendChild(px);
            }
        } else {
            // Lịch năm rút gọn (Cơ bản)
            grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
            label.innerText = `Năm ${year}`;
            for (let m = 0; m < 12; m++) {
                const px = document.createElement('div');
                px.className = 'px-box';
                px.innerText = m + 1;
                px.style.display = 'flex'; px.style.alignItems = 'center'; px.style.justifyContent = 'center'; px.style.fontSize = '12px';
                grid.appendChild(px);
            }
        }
    },

    showTooltip(e, key) {
        e.stopPropagation();
        this.activeKey = key;
        const target = e.currentTarget;
        const tt = document.getElementById('mf-tooltip');
        
        // Định vị Tooltip dựa trên tọa độ của ô Pixel (Relative to container)
        tt.style.display = 'flex';
        tt.style.top = (target.offsetTop + target.offsetHeight + 5) + 'px';
        tt.style.left = target.offsetLeft + 'px';

        this.showUpdateOptions(false);
    },

    showUpdateOptions(show) {
        const sub = document.getElementById('mf-update-menu');
        const main = document.getElementById('mf-tooltip');
        sub.style.display = show ? 'flex' : 'none';
        if (show) {
            sub.style.top = main.style.top;
            sub.style.left = (parseInt(main.style.left) + main.offsetWidth + 5) + 'px';
        }
    },

    hideTooltips() {
        document.getElementById('mf-tooltip').style.display = 'none';
        document.getElementById('mf-update-menu').style.display = 'none';
    },

    deleteDay() {
        if (confirm("Xoá dữ liệu của ngày này?")) {
            delete window.Knotion.data.moods[this.activeKey];
            window.Knotion.saveData();
            this.renderCalendar();
            this.hideTooltips();
        }
    },

    deleteAll() {
        if (confirm("Xoá TOÀN BỘ lịch sử cảm xúc? Thao tác này không thể hoàn tác.")) {
            window.Knotion.data.moods = {};
            window.Knotion.saveData();
            this.renderCalendar();
        }
    },

    changeMonth(v) { this.currentDate.setMonth(this.currentDate.getMonth() + v); this.renderCalendar(); },
    toggleView() { this.isYear = !this.isYear; this.renderCalendar(); }
};