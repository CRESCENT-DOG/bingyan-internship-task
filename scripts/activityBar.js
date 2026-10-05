// activityBar.js —— 活动栏（功能选择区）与侧边栏（功能展示区）的联动
//
// 1. 点击图标切换右侧展示的面板；
// 2. 点击当前已激活的图标，收起 / 展开侧边栏；
// 3. 侧边栏处于收起状态时点击任意图标，先展开再切换。

(function (global) {
  "use strict";

  var VIEW_TITLES = {
    explorer: "资源管理器",
    search: "搜索",
    "source-control": "源代码管理",
    run: "运行和调试",
    remote: "远程资源管理器",
    extensions: "扩展",
    account: "账户",
    settings: "管理",
  };

  function initActivityBar(options) {
    var activityBar = options.activityBar;
    var sidebarController = options.sidebarController;
    var panels = options.panels;
    var titleEl = options.titleEl;
    var items = Array.prototype.slice.call(
      activityBar.querySelectorAll(".activity-item[data-view]")
    );
    var activeView = options.defaultView || "explorer";

    function render() {
      items.forEach(function (item) {
        var isActive = item.dataset.view === activeView;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-pressed", String(isActive));
      });
      panels.forEach(function (panel) {
        panel.classList.toggle("is-active", panel.dataset.panel === activeView);
      });
      if (titleEl) titleEl.textContent = VIEW_TITLES[activeView] || "";
    }

    items.forEach(function (item) {
      item.addEventListener("click", function () {
        var view = item.dataset.view;
        if (view === activeView) {
          // 再次点击当前视图：折叠 / 展开侧边栏
          sidebarController.toggle();
          return;
        }
        activeView = view;
        sidebarController.expand();
        render();
      });
    });

    render();

    return {
      getView: function () {
        return activeView;
      },
      setView: function (view) {
        if (!VIEW_TITLES[view]) return;
        activeView = view;
        sidebarController.expand();
        render();
      },
    };
  }

  global.BrowserVSCode = global.BrowserVSCode || {};
  global.BrowserVSCode.initActivityBar = initActivityBar;
})(window);
