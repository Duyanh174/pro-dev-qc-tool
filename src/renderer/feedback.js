/**
 * FEEDBACK MODULE - PRO DEV-QC TOOL
 * Tích hợp Google Forms & Đồng bộ hệ thống Tab
 */
window.FeedbackFlow = {
    // 1. RENDER GIAO DIỆN (Sử dụng cấu trúc HTML hiện đại bạn đã gửi)
    render() {
        const container = document.getElementById('feedback-container');
        if (!container) return;

        container.innerHTML = `
            <div class="feedback-wrapper">
                <div class="fb-ios-container">
                    <header class="fb-header">
                        <h1>Phản hồi & Góp ý</h1>
                        <p>Mọi ý kiến của anh/chị đều giúp công cụ Dev-QC hoàn thiện hơn mỗi ngày.</p>
                    </header>

                    <div class="fb-card">
                        <div class="fb-group">
                            <label>cho em xin tên anh/chị nha</label>
                            <input type="text" id="fb-name" placeholder="cho em xin tên anh/chị nha">
                        </div>

                        <div class="fb-group">
                            <label>Điểm cần cải thiện</label>
                            <textarea id="fb-improve" placeholder="Giao diện chưa mượt, compiler còn chậm..."></textarea>
                        </div>

                        <div class="fb-group">
                            <label>Chức năng mong muốn (nếu có)</label>
                            <textarea id="fb-feature" placeholder="anh/chị có muốn thêm tính năng nào không ạ?"></textarea>
                        </div>

                        <div class="fb-group">
                            <label>Đánh giá trải nghiệm</label>
                            <div class="fb-rating-wrapper">
                                <div class="fb-rating">
                                    <input type="radio" name="rating" value="5" id="r5"><label for="r5">⭐️</label>
                                    <input type="radio" name="rating" value="4" id="r4"><label for="r4">⭐️</label>
                                    <input type="radio" name="rating" value="3" id="r3"><label for="r3">⭐️</label>
                                    <input type="radio" name="rating" value="2" id="r2"><label for="r2">⭐️</label>
                                    <input type="radio" name="rating" value="1" id="r1"><label for="r1">⭐️</label>
                                </div>
                                <span class="rating-hint">Chọn sao để đánh giá</span>
                            </div>
                        </div>

                        <button class="fb-submit-btn" onclick="FeedbackFlow.submitForm()">
                            Gửi Phản Hồi Ngay
                        </button>
                    </div>

                    <div class="fb-footer-tip">
                        <span class="tip-icon">💡</span> 
                        <p>Mẹo: Bạn có thể nhấn <b>Ctrl + Cmd + V</b> để mở nhanh Clipboard khi đang viết feedback.</p>
                    </div>
                </div>
            </div>
        `;
    },

    // 2. GỬI DỮ LIỆU LÊN GOOGLE FORMS
    async submitForm() {
        const name = document.getElementById('fb-name').value;
        const improve = document.getElementById('fb-improve').value;
        const feature = document.getElementById('fb-feature').value;
        const rating = document.querySelector('input[name="rating"]:checked')?.value || "0";
        
        if (!name || !improve) {
            alert("Vui lòng nhập tên và điểm cần cải thiện!");
            return;
        }

        const btn = document.querySelector('.fb-submit-btn');
        const originalText = btn.innerText;

        // URL FormResponse chuẩn từ ID của bạn
        const baseURL = "https://docs.google.com/forms/d/e/1FAIpQLScvTYD1nZCUSbbJueLuD3sMyRVU15hDfnQLPeC7WN0HIR_HHw/formResponse";

        const formData = new URLSearchParams();
        formData.append('entry.1133775691', name);    // ID Tên
        formData.append('entry.65626487', improve);   // ID Cải thiện
        formData.append('entry.1345957314', feature); // ID Chức năng
        formData.append('entry.1586793472', rating);  // ID Đánh giá

        try {
            btn.innerText = "Đang gửi...";
            btn.disabled = true;

            await fetch(baseURL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString()
            });

            alert("Cảm ơn anh/chị! Phản hồi đã được gửi thành công.");
            this.clearForm();
        } catch (error) {
            console.error("Feedback Error:", error);
            alert("Có lỗi xảy ra. Vui lòng thử lại sau!");
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    },

    // 3. XÓA TRỐNG FORM (ĐÃ FIX LỖI NULL)
    clearForm() {
        // Sử dụng optional chaining (?.) hoặc kiểm tra ID trước khi gán
        const fields = ['fb-name', 'fb-improve', 'fb-feature'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });

        const checkedRating = document.querySelector('input[name="rating"]:checked');
        if (checkedRating) checkedRating.checked = false;

        // Xóa thông báo file nếu có (Phòng hờ nếu sau này bạn thêm lại)
        const fileLabel = document.getElementById('file-name');
        if (fileLabel) fileLabel.innerText = "Nhấn để chọn ảnh hoặc kéo thả vào đây";
    }
};

// 4. TÍCH HỢP VÀO HỆ THỐNG TAB CỦA APP
const originalShowTabFb = window.showTab;
window.showTab = function(tabName) {
    if (typeof originalShowTabFb === 'function') originalShowTabFb(tabName);
    if (tabName === 'feedback') {
        FeedbackFlow.render();
    }
};