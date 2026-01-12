{
    const path = require('path');
    const fs = require('fs');

    window.FormatModule = {
        editors: { input: null, output: null },

        init() {
            const container = document.getElementById('format-container');
            if (!container) return;

            const htmlPath = path.join(__dirname, '../ui/features/format.html');
            if (fs.existsSync(htmlPath)) {
                container.innerHTML = fs.readFileSync(htmlPath, 'utf8');
                this.setupEditors();
            }
        },

        setupEditors() {
            const config = {
                theme: "ace/theme/one_dark",
                fontSize: "13px",
                useSoftTabs: true,
                tabSize: 2,
                wrap: true,
                showPrintMargin: false,
                useWorker: false
            };

            this.editors.input = ace.edit("format-input-editor");
            this.editors.input.setOptions(config);

            this.editors.output = ace.edit("format-output-editor");
            this.editors.output.setOptions({ ...config, readOnly: true });

            this.updateAceMode('json');
        },

        updateAceMode(parser) {
            let mode = "javascript";
            if (parser === 'html') mode = 'html';
            if (parser === 'css' || parser === 'postcss') mode = 'css';
            if (parser === 'json') mode = 'json';
            
            this.editors.input.session.setMode(`ace/mode/${mode}`);
            this.editors.output.session.setMode(`ace/mode/${mode}`);
        },

        // --- 1. CHỨC NĂNG BEAUTY (HIỆN TẠI) ---
        format() {
            const inputCode = this.editors.input.getValue();
            const parser = document.getElementById('format-lang-select').value;
            if (!inputCode.trim()) return;

            try {
                let formatted = "";
                if (parser === 'json') {
                    const obj = JSON.parse(inputCode);
                    formatted = JSON.stringify(obj, null, 2);
                } else {
                    formatted = prettier.format(inputCode, {
                        parser: parser,
                        plugins: prettierPlugins,
                        printWidth: 60,
                        tabWidth: 2,
                        semi: true,
                        singleQuote: false
                    });
                }
                this.editors.output.setValue(formatted, -1);
            } catch (error) {
                this.editors.output.setValue(`❌ LỖI CÚ PHÁP:\n\n${error.message}`, -1);
            }
        },

        // --- 2. CHỨC NĂNG MINIFY (MỚI) ---
        minify() {
            const inputCode = this.editors.input.getValue();
            const parser = document.getElementById('format-lang-select').value;
            if (!inputCode.trim()) return;

            try {
                let minified = "";
                if (parser === 'json') {
                    minified = JSON.stringify(JSON.parse(inputCode));
                } else {
                    // Nén cơ bản cho CSS/JS/HTML (Xóa xuống dòng và khoảng trắng thừa)
                    minified = inputCode
                        .replace(/\s+/g, ' ')
                        .replace(/\s*([\{\}\:\;\,\(\)])\s*/g, '$1')
                        .trim();
                }
                this.editors.output.setValue(minified, -1);
            } catch (error) {
                this.editors.output.setValue(`❌ LỖI KHI NÉN:\n\n${error.message}`, -1);
            }
        },

        // --- 3. CHỨC NĂNG SORT KEYS A-Z (MỚI) ---
        sortJSON() {
            const inputCode = this.editors.input.getValue();
            try {
                const obj = JSON.parse(inputCode);
                
                // Hàm đệ quy để sắp xếp key
                const sortObject = (unordered) => {
                    if (typeof unordered !== 'object' || unordered === null) return unordered;
                    if (Array.isArray(unordered)) return unordered.map(sortObject);
                    
                    return Object.keys(unordered).sort().reduce((obj, key) => {
                        obj[key] = sortObject(unordered[key]);
                        return obj;
                    }, {});
                };

                const sorted = sortObject(obj);
                this.editors.output.setValue(JSON.stringify(sorted, null, 2), -1);
            } catch (error) {
                this.editors.output.setValue(`❌ CHỈ HỖ TRỢ SORT CHO JSON:\n\n${error.message}`, -1);
            }
        },

        // --- 4. CHỨC NĂNG JSON TO CSV (MỚI) ---
        toCSV() {
            const inputCode = this.editors.input.getValue();
            try {
                let jsonData = JSON.parse(inputCode);
                if (!Array.isArray(jsonData)) jsonData = [jsonData];
        
                // 1. Hàm đệ quy làm phẳng Object (Giữ nguyên logic tốt)
                const flattenObject = (obj, prefix = '') => {
                    return Object.keys(obj).reduce((acc, k) => {
                        const pre = prefix.length ? prefix + '.' : '';
                        if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
                            Object.assign(acc, flattenObject(obj[k], pre + k));
                        } else if (Array.isArray(obj[k])) {
                            acc[pre + k] = obj[k].join(' | ');
                        } else {
                            acc[pre + k] = obj[k];
                        }
                        return acc;
                    }, {});
                };
        
                const flattenedData = jsonData.map(item => flattenObject(item));
                const allKeys = new Set();
                flattenedData.forEach(item => {
                    Object.keys(item).forEach(key => allKeys.add(key));
                });
                const headers = Array.from(allKeys);
        
                // 2. TẠO DỮ LIỆU DẠNG TAB-SEPARATED (TSV)
                const rows = [];
                
                // Header: Nối bằng dấu Tab (\t)
                rows.push(headers.join('\t'));
        
                // Data: Nối bằng dấu Tab (\t)
                flattenedData.forEach(row => {
                    const values = headers.map(header => {
                        const val = row[header] === undefined || row[header] === null ? '' : row[header];
                        // Khi dùng Tab để dán trực tiếp, ta KHÔNG cần bao bọc dấu ngoặc kép "" 
                        // Trừ khi trong nội dung có chứa dấu xuống dòng.
                        return ('' + val).replace(/\n/g, ' '); 
                    });
                    rows.push(values.join('\t'));
                });
        
                const finalContent = rows.join('\n');
                this.editors.output.setValue(finalContent, -1);
                
                // Thông báo cho người dùng
                console.log("Đã chuyển đổi sang định dạng Smart-Paste (Tabs)");
        
            } catch (error) {
                this.editors.output.setValue(`❌ LỖI: ${error.message}`, -1);
            }
        },

        copy() {
            const code = this.editors.output.getValue();
            if (code && !code.startsWith("❌")) {
                navigator.clipboard.writeText(code);
                alert("Copied to clipboard!");
            }
        },

        clear() {
            this.editors.input.setValue("", -1);
            this.editors.output.setValue("", -1);
            this.editors.input.focus();
        }
    };

    window.FormatModule.init();
}