// editorTabs.js —— 编辑器区域：标签页 + 文件内容预览
//
// Level 1 的「获取文件内容」到这里落地：资源管理器点名要打开哪个文件，
// 这里负责读（交给 workspace.js）、开标签页、把内容显示出来。
// 修改内容属于 Level 3，所以现在明确是只读预览。

(function (global) {
  "use strict";

  var WELCOME_ID = "__welcome__";

  function initEditorTabs(options) {
    var ws = global.BrowserVSCode.workspace;
    var tabListEl = options.tabListEl;
    var welcomeEl = options.welcomeEl;
    var codeViewEl = options.codeViewEl;
    var codeBodyEl = options.codeBodyEl;
    var codePathEl = options.codePathEl;
    var codeNoteEl = options.codeNoteEl;
    var statusLanguageEl = options.statusLanguageEl;
    var statusLinesEl = options.statusLinesEl;

    var tabs = [
      { id: WELCOME_ID, name: "欢迎", kind: "welcome", state: "ready" },
    ];
    var activeId = WELCOME_ID;

    function activeTab() {
      return tabs.filter(function (tab) {
        return tab.id === activeId;
      })[0];
    }

    function tabIconId(tab) {
      if (tab.kind === "welcome") return "#i-vscode";
      return "#i-file";
    }

    function tabIconClass(tab) {
      if (tab.kind === "welcome") return "tab__icon tab__icon--vscode";
      var language = ws.detectLanguage(tab.name);
      return "tab__icon tab__icon--" + language.icon;
    }

    // ---------------- 渲染 ----------------

    function renderTabs() {
      tabListEl.textContent = "";

      tabs.forEach(function (tab) {
        var el = document.createElement("div");
        el.className = "tab" + (tab.id === activeId ? " is-active" : "");
        el.setAttribute("role", "tab");
        el.setAttribute("aria-selected", String(tab.id === activeId));
        el.setAttribute("tabindex", tab.id === activeId ? "0" : "-1");
        el.dataset.tabId = tab.id;
        el.title = tab.path || tab.name;

        var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("class", tabIconClass(tab));
        icon.setAttribute("aria-hidden", "true");
        var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
        use.setAttribute("href", tabIconId(tab));
        icon.appendChild(use);
        el.appendChild(icon);

        var label = document.createElement("span");
        label.className = "tab__label";
        label.textContent = tab.name;
        el.appendChild(label);

        var close = document.createElement("button");
        close.className = "tab__close";
        close.type = "button";
        close.dataset.closeId = tab.id;
        close.setAttribute("aria-label", "关闭 " + tab.name);
        close.title = "关闭";
        var closeIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        closeIcon.setAttribute("class", "icon");
        closeIcon.setAttribute("aria-hidden", "true");
        var closeUse = document.createElementNS("http://www.w3.org/2000/svg", "use");
        closeUse.setAttribute("href", "#i-close");
        closeIcon.appendChild(closeUse);
        close.appendChild(closeIcon);
        el.appendChild(close);

        tabListEl.appendChild(el);
      });
    }

    function renderBody() {
      var tab = activeTab();
      var showWelcome = !tab || tab.kind === "welcome";
      welcomeEl.hidden = !showWelcome;
      codeViewEl.hidden = showWelcome;
      if (showWelcome) {
        setStatus("欢迎", "");
        return;
      }

      codePathEl.textContent = tab.path;
      codeBodyEl.textContent = "";

      if (tab.state === "loading") {
        codeNoteEl.textContent = "正在读取文件…";
        return;
      }

      if (tab.state === "error") {
        codeNoteEl.textContent = tab.message;
        setStatus("—", "");
        return;
      }

      codeNoteEl.textContent = "只读预览 · " + tab.language.label;
      var fragment = document.createDocumentFragment();
      tab.lines.forEach(function (line, index) {
        var row = document.createElement("div");
        row.className = "code-line";
        var number = document.createElement("span");
        number.className = "code-line__number";
        number.textContent = String(index + 1);
        var text = document.createElement("span");
        text.className = "code-line__text";
        text.textContent = line;
        row.appendChild(number);
        row.appendChild(text);
        fragment.appendChild(row);
      });
      codeBodyEl.appendChild(fragment);

      setStatus(tab.language.label, String(tab.lines.length) + " 行");
    }

    function setStatus(language, lines) {
      if (statusLanguageEl) statusLanguageEl.textContent = language;
      if (statusLinesEl) statusLinesEl.textContent = lines;
    }

    function render() {
      renderTabs();
      renderBody();
    }

    // ---------------- 行为 ----------------

    function activate(id) {
      if (!tabs.some(function (tab) { return tab.id === id; })) return;
      activeId = id;
      render();
    }

    function close(id) {
      var index = tabs.findIndex(function (tab) {
        return tab.id === id;
      });
      if (index === -1) return;
      tabs.splice(index, 1);
      if (!tabs.length) {
        tabs.push({ id: WELCOME_ID, name: "欢迎", kind: "welcome", state: "ready" });
        activeId = WELCOME_ID;
      } else if (activeId === id) {
        activeId = tabs[Math.min(index, tabs.length - 1)].id;
      }
      render();
    }

    function describeError(error, name) {
      if (error && error.code === ws.errors.BINARY) {
        return "「" + name + "」看起来是二进制文件，Level 1 只做文本内容预览";
      }
      if (error && error.code === ws.errors.TOO_BIG) {
        var kb = Math.round((error.size || 0) / 1024);
        return "「" + name + "」有 " + kb + " KB，超过预览上限（512 KB），已跳过读取";
      }
      return "读取「" + name + "」失败";
    }

    function openFile(node) {
      var existing = tabs.filter(function (tab) {
        return tab.id === node.path;
      })[0];
      if (existing) {
        activate(existing.id);
        return;
      }

      var language = ws.detectLanguage(node.name);
      var tab = {
        id: node.path,
        name: node.name,
        path: node.path,
        kind: "file",
        language: language,
        state: "loading",
        lines: [],
      };
      tabs.push(tab);
      activeId = tab.id;
      render();

      ws.readFile(node)
        .then(function (text) {
          tab.lines = text.replace(/\r\n/g, "\n").split("\n");
          tab.state = "ready";
          render();
        })
        .catch(function (error) {
          tab.state = "error";
          tab.message = describeError(error, node.name);
          render();
        });
    }

    // ---------------- 事件 ----------------

    tabListEl.addEventListener("click", function (event) {
      var closeButton = event.target.closest
        ? event.target.closest("[data-close-id]")
        : null;
      if (closeButton) {
        event.stopPropagation();
        close(closeButton.dataset.closeId);
        return;
      }
      var tabEl = event.target.closest ? event.target.closest("[data-tab-id]") : null;
      if (tabEl) activate(tabEl.dataset.tabId);
    });

    // 鼠标中键关标签，和浏览器 / VS Code 的习惯一致
    tabListEl.addEventListener("auxclick", function (event) {
      if (event.button !== 1) return;
      var tabEl = event.target.closest ? event.target.closest("[data-tab-id]") : null;
      if (tabEl) {
        event.preventDefault();
        close(tabEl.dataset.tabId);
      }
    });

    document.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === "w") {
        if (activeId === WELCOME_ID && tabs.length === 1) return;
        event.preventDefault();
        close(activeId);
      }
    });

    render();

    return {
      openFile: openFile,
      close: close,
      activate: activate,
      getActiveId: function () {
        return activeId;
      },
    };
  }

  global.BrowserVSCode = global.BrowserVSCode || {};
  global.BrowserVSCode.initEditorTabs = initEditorTabs;
})(window);
