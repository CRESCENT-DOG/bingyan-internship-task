// main.js —— 应用入口：把各个模块组装起来
//
// 三个脚本都用普通 <script defer> 引入，按顺序执行，
// 所以这里可以直接用 window.BrowserVSCode 上的方法。

(function (global) {
  "use strict";

  var ns = global.BrowserVSCode || {};

  function boot() {
    var app = document.getElementById("app");
    var sidebar = document.getElementById("sidebar");
    var sash = document.getElementById("sash");
    var activityBar = document.getElementById("activityBar");
    var sidebarTitle = document.getElementById("sidebarTitle");
    var panels = Array.prototype.slice.call(document.querySelectorAll(".panel[data-panel]"));

    if (!app || !sidebar || !sash || !activityBar) return;

    var sidebarController = ns.initSidebar({
      app: app,
      sidebar: sidebar,
      sash: sash,
    });

    ns.initActivityBar({
      activityBar: activityBar,
      sidebarController: sidebarController,
      panels: panels,
      titleEl: sidebarTitle,
      defaultView: "explorer",
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
