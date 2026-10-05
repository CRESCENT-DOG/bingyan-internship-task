// sidebar.js —— 侧边栏宽度拖拽 / 收起 / 持久化
//
// 说明：这里用普通脚本 + 立即执行函数（IIFE）而不是 ES Module，
//       这样直接双击本地 HTML 文件打开时脚本也能正常执行。
//
// 规则（对齐 VS Code 的行为）：
// 1. 拖动分隔条可以自由调整侧边栏宽度；
// 2. 宽度不足「最小宽度」时，松手会吸附到最小宽度；
// 3. 宽度低于「收起阈值」时，松手直接收起侧边栏（分隔条一起隐藏）；
// 4. 双击分隔条恢复默认宽度；
// 5. 拖拽过程只改样式，不做多余计算，保证手感顺滑。

(function (global) {
  "use strict";

  var STORAGE_KEY = "browser-vscode.sidebar";

  // 从 CSS 变量里读取尺寸，避免 JS 与 CSS 出现两份互相打架的常量
  function readPx(name, fallback) {
    var raw = getComputedStyle(document.documentElement).getPropertyValue(name);
    var value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // 隐私模式、file:// 等场景下写入可能失败，忽略即可
    }
  }

  function initSidebar(options) {
    var app = options.app;
    var sidebar = options.sidebar;
    var sash = options.sash;

    var MIN_WIDTH = readPx("--w-sidebar-min", 170);
    var DEFAULT_WIDTH = readPx("--w-sidebar", 380);
    var COLLAPSE_THRESHOLD = readPx("--w-sidebar-collapse", 120);
    var ACTIVITY_BAR_WIDTH = readPx("--w-activity", 48);
    // 给编辑器预留的最小空间，避免把编辑区挤没
    var MIN_EDITOR_WIDTH = 260;

    var saved = loadState();
    var collapsed = !!(saved && saved.collapsed === true);
    var expandedWidth = clampWidth(saved && saved.width ? saved.width : DEFAULT_WIDTH);
    var dragging = false;
    var pointerId = null;

    function maxWidth() {
      return Math.max(MIN_WIDTH, window.innerWidth - ACTIVITY_BAR_WIDTH - MIN_EDITOR_WIDTH);
    }

    function clampWidth(width) {
      return Math.min(Math.max(width, MIN_WIDTH), maxWidth());
    }

    function applyWidth(width) {
      sidebar.style.width = width + "px";
    }

    function currentWidth() {
      return Number.parseFloat(sidebar.style.width) || expandedWidth;
    }

    function persist() {
      saveState({ width: Math.round(expandedWidth), collapsed: collapsed });
    }

    function setCollapsed(next) {
      collapsed = next;
      app.classList.toggle("is-sidebar-collapsed", collapsed);
      persist();
    }

    function collapse() {
      sidebar.classList.remove("is-will-close");
      setCollapsed(true);
    }

    function expand() {
      setCollapsed(false);
      applyWidth(expandedWidth);
    }

    function toggle() {
      if (collapsed) {
        expand();
      } else {
        collapse();
      }
    }

    function resetWidth() {
      setCollapsed(false);
      expandedWidth = clampWidth(DEFAULT_WIDTH);
      applyWidth(expandedWidth);
      persist();
    }

    // ---------------- 拖拽 ----------------

    function onPointerMove(event) {
      if (!dragging) return;
      var left = sidebar.getBoundingClientRect().left;
      var pending = Math.min(Math.max(event.clientX - left, 0), maxWidth());
      applyWidth(pending);
      // 已经进入「松手就会收起」的区间，给出视觉反馈
      sidebar.classList.toggle("is-will-close", pending < COLLAPSE_THRESHOLD);
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("is-resizing");
      sash.classList.remove("is-active");
      if (pointerId !== null && sash.releasePointerCapture) {
        sash.releasePointerCapture(pointerId);
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      var width = currentWidth();
      if (width < COLLAPSE_THRESHOLD) {
        collapse();
        return;
      }
      expandedWidth = clampWidth(Math.max(width, MIN_WIDTH));
      applyWidth(expandedWidth);
      sidebar.classList.remove("is-will-close");
      persist();
    }

    function onPointerDown(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      dragging = true;
      pointerId = event.pointerId;
      if (sash.setPointerCapture) sash.setPointerCapture(pointerId);
      sash.classList.add("is-active");
      document.body.classList.add("is-resizing");
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    }

    sash.addEventListener("pointerdown", onPointerDown);
    sash.addEventListener("dblclick", resetWidth);

    // 键盘可达性：方向键微调，Home 恢复默认，回车 / 空格切换收起
    sash.addEventListener("keydown", function (event) {
      var step = event.shiftKey ? 40 : 10;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        var base = collapsed ? 0 : currentWidth();
        var next = base + (event.key === "ArrowRight" ? step : -step);
        if (next < COLLAPSE_THRESHOLD) {
          collapse();
          return;
        }
        setCollapsed(false);
        expandedWidth = clampWidth(next);
        applyWidth(expandedWidth);
        persist();
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        resetWidth();
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    });

    // 窗口尺寸变化时，保证侧边栏与编辑区的比例仍然合理
    window.addEventListener("resize", function () {
      if (collapsed) return;
      var next = clampWidth(currentWidth());
      expandedWidth = next;
      applyWidth(next);
    });

    // ---------------- 初始化 ----------------
    app.classList.toggle("is-sidebar-collapsed", collapsed);
    applyWidth(collapsed ? expandedWidth : clampWidth(expandedWidth));

    return {
      expand: expand,
      collapse: collapse,
      toggle: toggle,
      isCollapsed: function () {
        return collapsed;
      },
    };
  }

  global.BrowserVSCode = global.BrowserVSCode || {};
  global.BrowserVSCode.initSidebar = initSidebar;
})(window);
