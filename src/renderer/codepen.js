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
  },

  render() {
    const container = document.getElementById("codepen-container");
    if (!container) return;

    const headerHtml = `
            <div class="preview-actions">
                <div class="brand-name">PRO EDITOR</div>
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
                        <div class="preview-frame-container"><div id="drag-blocker"></div><iframe id="preview-window"></iframe></div>
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

    container.insertAdjacentHTML(
      "beforeend",
      `<div class="cdn-modal-overlay" id="cdn-modal-overlay"><div class="cdn-modal"><div class="cdn-modal-header"><h3>External Resources</h3><button class="format-btn" onclick="CodePen.closeCDNModal()">✕</button></div><div class="cdn-input-group"><input type="text" id="cdn-url" placeholder="URL..."><button class="action-btn btn-success" onclick="CodePen.addResource()">Add</button></div><div class="cdn-list" id="cdn-list"></div><div style="text-align: right;"><button class="action-btn btn-secondary" onclick="CodePen.closeCDNModal()">Done</button></div></div></div>`
    );

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
      document
        .querySelectorAll(".horizontal-resizer")
        .forEach((resizer, index) => {
          let startX_H, startLWidth_H, leftBox;
          const moveH = (ev) => {
            if (!this.isDraggingH) return;
            leftBox.style.flex = `0 0 ${
              startLWidth_H + (ev.clientX - startX_H)
            }px`;
            this.resizeEditors();
          };
          const upH = () => {
            this.isDraggingH = false;
            if (blocker) blocker.style.display = "none";
            document
              .querySelector(".codepen-container-main")
              .classList.remove("is-dragging-global");
            window.removeEventListener("pointermove", moveH);
            window.removeEventListener("pointerup", upH);
          };
          resizer.addEventListener("pointerdown", (e) => {
            this.isDraggingH = true;
            leftBox = resizer.previousElementSibling;
            startX_H = e.clientX;
            startLWidth_H = leftBox.offsetWidth;
            const all = document.querySelectorAll(".editor-box");
            for (let i = 0; i <= index; i++)
              all[i].style.flex = `0 0 ${all[i].offsetWidth}px`;
            if (index === 0) all[2].style.flex = "1";
            blocker.style.display = "block";
            document
              .querySelector(".codepen-container-main")
              .classList.add("is-dragging-global");
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
    const content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://unpkg.com/splitting/dist/splitting.css" />${extCSS}<style>body{margin:0;padding:15px;font-family:'Poppins',sans-serif;color:white;} ${css}</style><script>(function(){['log','warn','error','info'].forEach(m=>{const o=console[m];console[m]=function(...a){window.parent.postMessage({type:'iframe-log',method:m,arguments:a},'*');o.apply(console,a);};});window.addEventListener('message',e=>{if(e.data.type==='exec-console'){try{const r=eval(e.data.command);if(r!==undefined)console.log(r);}catch(err){console.error(err);}}});})();<\/script></head><body>${html}<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"><\/script><script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"><\/script><script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/Draggable.min.js"><\/script><script src="https://unpkg.com/splitting/dist/splitting.min.js"><\/script>${extJS}<script type="module">if(typeof Splitting!=='undefined')Splitting();if(typeof gsap!=='undefined')gsap.registerPlugin(ScrollTrigger,Draggable);${js}<\/script></body></html>`;
    previewEl.srcdoc = content;
  },
};

window.runCode = () => CodePen.run();
window.clearCode = () => CodePen.clear();
document.addEventListener("DOMContentLoaded", () => CodePen.init());
