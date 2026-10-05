// explorer.js —— 资源管理器：把工作区的文件树画进侧边栏
//
// 职责边界很清楚：
//   workspace.js 只回答「有哪些文件、内容是什么」；
//   这里只负责「怎么显示、怎么交互」，不直接碰文件系统 API。
//
// 交互对齐 VS Code：
//   * 点文件夹行 = 展开 / 收起；点文件行 = 在编辑器里打开；
//   * 真实文件夹的子项按需读取，展开时才会去读目录；
//   * 键盘：↑↓ 移动、←→ 收起 / 展开、Enter 打开、Home / End 跳到首尾；
//   * 展开状态写进 localStorage，刷新后还在。

(function (global) {
  "use strict";

  var STORAGE_KEY = "browser-vscode.explorer";

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && parsed.expanded ? parsed : { expanded: {} };
    } catch (error) {
      return { expanded: {} };
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // file:// 或隐私模式下写入可能失败，忽略即可
    }
  }

  function initExplorer(options) {
    var ws = global.BrowserVSCode.workspace;
    var treeEl = options.treeEl;
    var emptyEl = options.emptyEl;
    var hintEl = options.hintEl;
    var onOpenFile = options.onOpenFile || function () {};

    var root = null;
    var selectedId = null;
    var focusedId = null;
    var state = loadState();

    // ---------------- 工具 ----------------

    function setHint(text) {
      if (hintEl) hintEl.textContent = text || "";
    }

    function findNode(id) {
      var found = null;
      (function walk(node) {
        if (found) return;
        if (node.id === id) {
          found = node;
          return;
        }
        if (node.kind === "folder" && node.children) {
          node.children.forEach(walk);
        }
      })(root);
      return found;
    }

    function visibleRows() {
      var rows = [];
      if (!root) return rows;
      (function walk(node) {
        rows.push(node);
        if (node.kind === "folder" && node.expanded && node.children) {
          node.children.forEach(walk);
        }
      })(root);
      return rows;
    }

    function applySavedExpansion(node) {
      if (node.kind !== "folder") return;
      if (node.handle) {
        node.expanded = true; // 本地文件夹的根节点默认展开
      } else if (typeof state.expanded[node.path] === "boolean") {
        // 有记录就用记录（用户折叠过的目录下次还是折叠的）
        node.expanded = state.expanded[node.path];
      } else if (!node.parent) {
        node.expanded = true; // 首次打开示例工作区时展开根目录
      }
      if (node.children) node.children.forEach(applySavedExpansion);
    }

    function rememberExpansion() {
      var map = {};
      if (root) {
        (function walk(node) {
          if (node.kind === "folder" && !node.handle) {
            map[node.path] = !!node.expanded;
          }
          if (node.children) node.children.forEach(walk);
        })(root);
      }
      state.expanded = map;
      saveState(state);
    }

    // ---------------- 渲染 ----------------

    function iconClassFor(node) {
      if (node.kind === "folder") return "tree__icon--folder";
      return "tree__icon--" + ws.detectLanguage(node.name).icon;
    }

    function createRow(node) {
      var row = document.createElement("div");
      row.className = "tree__row tree__row--" + node.kind;
      row.dataset.path = node.path;
      row.dataset.kind = node.kind;
      row.dataset.depth = String(node.depth);
      row.setAttribute("role", "treeitem");
      row.setAttribute("aria-level", String(node.depth + 1));
      row.style.setProperty("--depth", String(node.depth));
      row.tabIndex = node.id === focusedId ? 0 : -1;
      if (node.id === selectedId) row.classList.add("is-selected");

      if (node.kind === "folder") {
        row.setAttribute("aria-expanded", String(!!node.expanded));
        var chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        chevron.setAttribute("class", "icon tree__chevron");
        chevron.setAttribute("aria-hidden", "true");
        var chevronUse = document.createElementNS("http://www.w3.org/2000/svg", "use");
        chevronUse.setAttribute(
          "href",
          node.expanded ? "#i-chevron-down" : "#i-chevron-right"
        );
        chevron.appendChild(chevronUse);
        row.appendChild(chevron);
      } else {
        var spacer = document.createElement("span");
        spacer.className = "tree__chevron tree__chevron--spacer";
        row.appendChild(spacer);
      }

      var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("class", "icon tree__icon " + iconClassFor(node));
      icon.setAttribute("aria-hidden", "true");
      var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", node.kind === "folder" ? "#i-folder" : "#i-file");
      icon.appendChild(use);
      row.appendChild(icon);

      var label = document.createElement("span");
      label.className = "tree__label";
      label.textContent = node.name;
      row.appendChild(label);

      return row;
    }

    function createMessageRow(text) {
      var row = document.createElement("div");
      row.className = "tree__row tree__row--message";
      row.style.setProperty("--depth", String((root ? root.depth : 0) + 1));
      var label = document.createElement("span");
      label.className = "tree__message";
      label.textContent = text;
      row.appendChild(label);
      return row;
    }

    function render() {
      treeEl.textContent = "";
      treeEl.setAttribute("role", "tree");

      if (!root) {
        if (emptyEl) emptyEl.hidden = false;
        return;
      }
      if (emptyEl) emptyEl.hidden = true;

      visibleRows().forEach(function (node) {
        treeEl.appendChild(createRow(node));
        // 真实文件夹正在读取时给一行「加载中…」，避免看起来没反应
        if (node.kind === "folder" && node.expanded && !node.children) {
          treeEl.appendChild(createMessageRow("正在读取目录…"));
        }
      });
    }

    // ---------------- 行为 ----------------

    function focusRow(node) {
      focusedId = node.id;
      var row = treeEl.querySelector('.tree__row[data-path="' + cssEscape(node.path) + '"]');
      if (row) row.focus();
    }

    function select(node) {
      selectedId = node.id;
      focusedId = node.id;
      render();
    }

    function openNode(node) {
      if (node.kind === "folder") {
        toggleFolder(node);
        return;
      }
      select(node);
      onOpenFile(node);
    }

    function toggleFolder(node) {
      if (node.expanded) {
        node.expanded = false;
        rememberExpansion();
        render();
        return;
      }

      node.expanded = true;
      if (node.children) {
        rememberExpansion();
        render();
        return;
      }

      // 真实文件夹：展开时才去读目录
      render();
      ws.listChildren(node)
        .then(function () {
          rememberExpansion();
          render();
        })
        .catch(function () {
          node.expanded = false;
          render();
          setHint("读取目录失败，可能是权限被撤销了");
        });
    }

    function collapseAll() {
      if (!root) return;
      (function walk(node) {
        if (node.kind === "folder" && !node.handle) node.expanded = false;
        if (node.children) node.children.forEach(walk);
      })(root);
      rememberExpansion();
      render();
    }

    function moveFocus(delta) {
      var rows = visibleRows();
      if (!rows.length) return;
      var index = rows.findIndex(function (node) {
        return node.id === focusedId;
      });
      if (index === -1) index = 0;
      var next = rows[Math.min(Math.max(index + delta, 0), rows.length - 1)];
      focusedId = next.id;
      render();
      focusRow(next);
    }

    // ---------------- 事件 ----------------

    treeEl.addEventListener("click", function (event) {
      var row = event.target.closest ? event.target.closest(".tree__row") : null;
      if (!row || !row.dataset.path) return;
      var node = findNode(row.dataset.path);
      if (!node) return;
      if (node.kind === "folder") select(node);
      openNode(node);
    });

    treeEl.addEventListener("dblclick", function (event) {
      var row = event.target.closest ? event.target.closest(".tree__row") : null;
      if (!row || !row.dataset.path) return;
      var node = findNode(row.dataset.path);
      if (node && node.kind === "folder") openNode(node);
    });

    treeEl.addEventListener("keydown", function (event) {
      var node = findNode(focusedId);
      if (!node) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          moveFocus(1);
          break;
        case "ArrowUp":
          event.preventDefault();
          moveFocus(-1);
          break;
        case "ArrowRight":
          event.preventDefault();
          if (node.kind === "folder" && !node.expanded) toggleFolder(node);
          else moveFocus(1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (node.kind === "folder" && node.expanded) toggleFolder(node);
          else if (node.parent) {
            focusedId = node.parent.id;
            render();
            focusRow(node.parent);
          }
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          openNode(node);
          break;
        case "Home":
          event.preventDefault();
          focusedId = visibleRows()[0].id;
          render();
          focusRow(findNode(focusedId));
          break;
        case "End":
          event.preventDefault();
          var rows = visibleRows();
          focusedId = rows[rows.length - 1].id;
          render();
          focusRow(findNode(focusedId));
          break;
        default:
          break;
      }
    });

    if (options.openFolderButton) {
      options.openFolderButton.addEventListener("click", openLocalFolder);
    }
    if (options.welcomeOpenFolder) {
      options.welcomeOpenFolder.addEventListener("click", openLocalFolder);
    }
    if (options.collapseButton) {
      options.collapseButton.addEventListener("click", collapseAll);
    }
    if (options.refreshButton) {
      options.refreshButton.addEventListener("click", function () {
        if (!root) return;
        // 真实文件夹：丢掉缓存重新读；示例工作区：直接重画
        (function clear(node) {
          if (node.kind === "folder" && node.handle && node !== root) {
            node.children = null;
            node.expanded = false;
            return;
          }
          if (node.children) node.children.forEach(clear);
        })(root);
        render();
        setHint("已刷新");
      });
    }

    function openLocalFolder() {
      ws.createLocalWorkspace()
        .then(function (node) {
          loadWorkspace(node);
          setHint("本地文件夹：" + node.name);
        })
        .catch(function (error) {
          if (error && error.code === ws.errors.UNSUPPORTED) {
            setHint("当前浏览器不支持直接打开本地文件夹，建议用 Chrome / Edge");
          } else if (error && error.name === "AbortError") {
            setHint("已取消选择文件夹");
          } else {
            setHint("打开文件夹失败");
          }
        });
    }

    // ---------------- 对外 ----------------

    function loadWorkspace(node) {
      root = node;
      selectedId = null;
      applySavedExpansion(root);
      focusedId = root.id;
      render();
    }

    function getRoot() {
      return root;
    }

    return {
      loadWorkspace: loadWorkspace,
      getRoot: getRoot,
      render: render,
      collapseAll: collapseAll,
      openFolder: openLocalFolder,
      setHint: setHint,
    };
  }

  // 兼容：有的浏览器里属性选择器会遇到特殊字符
  function cssEscape(value) {
    return String(value).replace(/["\\]/g, "\\$&");
  }

  global.BrowserVSCode = global.BrowserVSCode || {};
  global.BrowserVSCode.initExplorer = initExplorer;
})(window);
