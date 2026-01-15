window.MoodFlow = {
    currentDate: new Date(),
    viewMode: 'month',
    activeDate: null,
    activeIndex: 0,
    tempScore: 3,

    renderDashboard(container) {
        const fs = require('fs');
        const path = require('path');
        container.innerHTML = fs.readFileSync(path.join(__dirname, '../ui/features/moodFlow.html'), 'utf8');
        this.loadBirthday();
        this.renderCalendar();
    },

    autoFocus(el, nextId) {
        if (el.value.length === el.maxLength) {
            document.getElementById(nextId).focus();
        }
    },

    saveBirthday() {
        const d = document.getElementById('bd-day').value;
        const m = document.getElementById('bd-month').value;
        const y = document.getElementById('bd-year').value;
        if (!d || !m) return;
        window.Knotion.data.user_birthday = { day: parseInt(d), month: parseInt(m), year: parseInt(y) };
        window.Knotion.saveData();
        this.renderCalendar();
    },

    loadBirthday() {
        const bd = window.Knotion.data.user_birthday;
        if (bd) {
            document.getElementById('bd-day').value = bd.day;
            document.getElementById('bd-month').value = bd.month;
            document.getElementById('bd-year').value = bd.year || "";
        }
    },

    isBirthday(d) {
        const bd = window.Knotion.data.user_birthday;
        return bd && d.getDate() === bd.day && (d.getMonth() + 1) === bd.month;
    },

    setViewMode(mode) {
        this.viewMode = mode;
        document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`seg-${mode}`).classList.add('active');
        const glider = document.querySelector('.seg-glider');
        const pos = { 'year': '4px', 'month': '62px', 'week': '120px' };
        glider.style.left = pos[mode];
        this.renderCalendar();
    },

    renderCalendar() {
        const grid = document.getElementById('mf-grid');
        const label = document.getElementById('mf-label');
        grid.innerHTML = '';
        grid.className = `mf-grid ${this.viewMode}-view`;
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const today = new Date();
        today.setHours(0,0,0,0);

        if (this.viewMode === 'month') {
            label.innerText = `Tháng ${month + 1} ${year}`;
            this.renderMonth(year, month, grid, today);
        } else if (this.viewMode === 'week') {
            const start = new Date(this.currentDate);
            start.setDate(start.getDate() - start.getDay());
            label.innerText = `Tuần từ ${start.getDate()} thg ${start.getMonth() + 1}, ${year}`;
            this.renderWeek(start, grid, today);
        } else {
            label.innerText = `Năm ${year}`;
            this.renderYear(year, grid, today);
        }
        this.updateStats();
    },

    createPixel(d, today, label = "", sub = "") {
        const dateKey = this.formatDate(d);
        const px = document.createElement('div');
        px.className = 'px-box';
        
        const data = window.Knotion.data.moods[dateKey];
        const isBday = this.isBirthday(d);
        const isFuture = d > today;

        if (isBday) px.classList.add('birthday');
        
        if (data && data.entries?.length > 0) {
            const last = data.entries[data.entries.length - 1];
            px.classList.add(`s${last.score}`);
            if (this.viewMode === 'week') {
                px.innerHTML = `<div class="mood-emoji">${this.getEmoji(last.score)}</div><div class="day-sub">${sub}</div>`;
            } else if (this.viewMode === 'month') {
                px.innerText = label;
            }
        } else if (isFuture) {
            px.classList.add('future');
            px.innerText = label;
            px.onmouseenter = (e) => this.showTooltip(e, isBday ? "🎂 Chúc mừng sinh nhật!" : "✨ Đây sẽ là ngày tuyệt vời của bạn");
            px.onmouseleave = () => this.hideTooltip();
        } else {
            px.classList.add('past-empty');
            px.innerText = label;
            if (this.viewMode === 'week') {
                px.innerHTML = `<div class="day-sub">${sub}</div>`;
            }
            if (isBday) {
                px.onmouseenter = (e) => this.showTooltip(e, "🎂 Chúc mừng sinh nhật!");
                px.onmouseleave = () => this.hideTooltip();
            }
        }

        px.onclick = () => isFuture ? null : this.openModal(dateKey);
        return px;
    },

    renderMonth(y, m, grid, today) {
        const days = new Date(y, m + 1, 0).getDate();
        for (let i = 1; i <= days; i++) {
            grid.appendChild(this.createPixel(new Date(y, m, i), today, i));
        }
    },

    renderWeek(start, grid, today) {
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            grid.appendChild(this.createPixel(d, today, "", `${d.getDate()}/${d.getMonth()+1}`));
        }
    },

    renderYear(y, grid, today) {
        // Headers J F M...
        grid.appendChild(document.createElement('div')); // Corner
        ['J','F','M','A','M','J','J','A','S','O','N','D'].forEach(m => {
            const h = document.createElement('div'); h.className = 'year-header-col'; h.innerText = m;
            grid.appendChild(h);
        });
        // Rows 1-31
        for (let d = 1; d <= 31; d++) {
            const label = document.createElement('div'); label.className = 'year-row-label'; label.innerText = d;
            grid.appendChild(label);
            for (let m = 0; m < 12; m++) {
                const date = new Date(y, m, d);
                if (date.getMonth() === m) {
                    grid.appendChild(this.createPixel(date, today));
                } else {
                    grid.appendChild(document.createElement('div'));
                }
            }
        }
    },

    openModal(dateKey) {
        this.activeDate = dateKey;
        const data = window.Knotion.data.moods[dateKey];
        document.getElementById('modal-date-title').innerText = `Ngày ${dateKey}`;
        document.getElementById('mf-modal').style.display = 'flex';
        document.getElementById('modal-birthday-msg').style.display = this.isBirthday(new Date(dateKey)) ? 'block' : 'none';

        if (data && data.entries?.length > 0) {
            this.showDetail(data.entries.length - 1);
        } else {
            this.startFlow('new');
        }
    },

    showDetail(idx) {
        const data = window.Knotion.data.moods[this.activeDate];
        const entry = idx !== null ? data.entries[idx] : data.entries[data.entries.length - 1];
        
        document.getElementById('modal-view-state').style.display = 'block';
        document.getElementById('modal-history-state').style.display = 'none';
        document.getElementById('modal-entry-flow').style.display = 'none';

        document.getElementById('view-img').src = `../assets/alien0${entry.score}.png`;
        document.getElementById('view-time').innerText = `Lúc ${entry.time}`;
        document.getElementById('view-note').innerText = entry.note || 'Không có ghi chú.';
        document.getElementById('btn-show-history').style.display = data.entries.length > 1 ? 'block' : 'none';
    },

    showHistory() {
        const data = window.Knotion.data.moods[this.activeDate];
        const list = document.getElementById('history-items');
        list.innerHTML = '';
        [...data.entries].reverse().forEach((e, i) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `<img src="../assets/alien0${e.score}.png"><div><div class="h-time">${e.time}</div><div class="h-note">${e.note || '...'}</div></div>`;
            item.onclick = () => this.showDetail(data.entries.length - 1 - i);
            list.appendChild(item);
        });
        document.getElementById('modal-view-state').style.display = 'none';
        document.getElementById('modal-history-state').style.display = 'block';
    },

    finalize() {
        const note = document.getElementById('entry-note').value;
        const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        if (!window.Knotion.data.moods[this.activeDate]) window.Knotion.data.moods[this.activeDate] = { entries: [] };
        window.Knotion.data.moods[this.activeDate].entries.push({ score: this.tempScore, note, time });
        window.Knotion.saveData();
        this.openModal(this.activeDate);
        this.renderCalendar();
    },

    updateStats() {
        const stats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        Object.values(window.Knotion.data.moods).forEach(d => {
            if (d.entries?.length > 0) stats[d.entries[d.entries.length-1].score]++;
        });
        for (let i = 1; i <= 5; i++) document.getElementById(`stat-${i}`).innerText = stats[i];
    },

    showTooltip(e, text) {
        const tt = document.getElementById('mf-action-tooltip');
        tt.innerText = text; tt.style.display = 'block';
        tt.style.left = e.target.offsetLeft + (e.target.offsetWidth / 2) + 'px';
        tt.style.top = e.target.offsetTop + 'px';
    },

    getEmoji(s) { return { 5:'😆', 4:'😊', 3:'😐', 2:'😓', 1:'😡' }[s]; },
    formatDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },
    hideTooltip() { document.getElementById('mf-action-tooltip').style.display = 'none'; },
    changePage(v) { 
        if(this.viewMode === 'month') this.currentDate.setMonth(this.currentDate.getMonth() + v);
        else if(this.viewMode === 'week') this.currentDate.setDate(this.currentDate.getDate() + (v * 7));
        else this.currentDate.setFullYear(this.currentDate.getFullYear() + v);
        this.renderCalendar(); 
    },
    startFlow() { document.getElementById('modal-view-state').style.display='none'; document.getElementById('modal-history-state').style.display='none'; document.getElementById('modal-entry-flow').style.display='block'; this.showStep(1); },
    showStep(n) { document.getElementById('step-1').style.display = n === 1 ? 'block' : 'none'; document.getElementById('step-2').style.display = n === 2 ? 'block' : 'none'; },
    nextStep(s) { this.tempScore = s; this.showStep(2); },
    backToStep1() { this.showStep(1); },
    closeModal() { document.getElementById('mf-modal').style.display = 'none'; },
    deleteDayData() { if(confirm("Xóa toàn bộ dữ liệu ngày này?")) { delete window.Knotion.data.moods[this.activeDate]; window.Knotion.saveData(); this.closeModal(); this.renderCalendar(); } },
    getTodayKey() { return this.formatDate(new Date()); }
};