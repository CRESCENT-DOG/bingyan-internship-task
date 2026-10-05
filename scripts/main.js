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

    // ---- Level 1：文件树 + 文件内容读取 ----
    // 编辑器先建好，资源管理器打开文件时把节点交给它
    var editorTabs = ns.initEditorTabs({
      tabListEl: document.getElementById("tabList"),
      welcomeEl: document.getElementById("welcomeView"),
      codeViewEl: document.getElementById("codeView"),
      codeBodyEl: document.getElementById("codeBody"),
      codePathEl: document.getElementById("codePath"),
      codeNoteEl: document.getElementById("codeNote"),
      statusLanguageEl: document.getElementById("statusLanguage"),
      statusLinesEl: document.getElementById("statusLines"),
    });

    var explorer = ns.initExplorer({
      treeEl: document.getElementById("fileTree"),
      emptyEl: document.getElementById("explorerEmpty"),
      hintEl: document.getElementById("explorerHint"),
      openFolderButton: document.getElementById("openFolderButton"),
      welcomeOpenFolder: document.getElementById("welcomeOpenFolder"),
      refreshButton: document.getElementById("refreshExplorer"),
      collapseButton: document.getElementById("collapseExplorer"),
      onOpenFile: editorTabs.openFile,
    });

    // 默认先给一个内置示例工作区：双击 HTML 打开时也有东西可点
    explorer.loadWorkspace(ns.workspace.createDemoWorkspace());
    explorer.setHint("示例工作区（内置）");

    // 欢迎页里的「打开文件夹...」也接到同一个入口
    Array.prototype.slice
      .call(document.querySelectorAll('[data-action="open-folder"]'))
      .forEach(function (element) {
        element.addEventListener("click", function (event) {
          event.preventDefault();
          explorer.openFolder();
        });
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
