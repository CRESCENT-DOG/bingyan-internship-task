// workspace.js —— 工作区（文件系统）抽象层
//
// Level 1 要解决的是「文件内容从哪来」，这件事和「文件树怎么画」是两回事，
// 所以这里只负责数据，不碰任何 DOM：
//
//   1. 内置示例工作区：纯 JS 对象。双击 HTML 直接打开（file://）也能用，
//      不需要服务器、不需要 fetch；
//   2. 本地文件夹：浏览器原生的 File System Access API（showDirectoryPicker），
//      目录与文件内容都按需读取，同样不需要后端。
//
// 两种数据源对外是同一套接口：
//
//   createDemoWorkspace()  -> 根节点（示例工作区，内容已在内存里）
//   createLocalWorkspace() -> Promise<根节点>（用户选完文件夹后）
//   listChildren(node)     -> Promise<子节点数组>（真实目录按需读取）
//   readFile(node)         -> Promise<string>（真实文件按需读取）
//   detectLanguage(name)   -> { id, label, icon }，给状态栏和文件图标用

(function (global) {
  "use strict";

  var ERR_BINARY = "ERR_BINARY";
  var ERR_TOO_BIG = "ERR_TOO_BIG";
  var ERR_UNSUPPORTED = "ERR_UNSUPPORTED";
  // 纯文本预览的上限，超过就不读进内存，避免一个大文件把页面卡死
  var MAX_TEXT_SIZE = 512 * 1024;

  // ---------------- 节点构造 ----------------

  function folder(name, children) {
    var node = { kind: "folder", name: name, children: [] };
    (children || []).forEach(function (child) {
      child.parent = node;
      node.children.push(child);
    });
    return node;
  }

  function file(name, content) {
    return { kind: "file", name: name, content: content };
  }

  // 统一补齐 path / id / depth，省得每个用到的地方都自己算一遍
  function index(node, path, depth) {
    node.path = path;
    node.id = path;
    node.depth = depth;
    if (typeof node.expanded !== "boolean") node.expanded = false;
    if (node.kind === "folder" && node.children) {
      node.children.forEach(function (child) {
        child.parent = node;
        index(child, path + "/" + child.name, depth + 1);
      });
    }
    return node;
  }

  // ---------------- 内置示例工作区 ----------------
  // 内容写得简短，但都是能直接读的完整片段，点开就能看到「文件内容」。

  function createDemoWorkspace() {
    var root = folder("browser-vscode-demo", [
      file(
        "README.md",
        [
          "# browser-vscode-demo",
          "",
          "示例工作区：用来演示资源管理器的文件树与文件内容读取。",
          "",
          "- `src/` 业务代码",
          "- `styles/` 样式",
          "- `package.json` 项目描述",
          "",
          "> 想看真实磁盘上的文件，点侧边栏的「打开文件夹」选一个目录。",
        ].join("\n")
      ),
      file(
        "package.json",
        [
          "{",
          '  "name": "browser-vscode-demo",',
          '  "version": "1.0.0",',
          '  "private": true,',
          '  "description": "T4 Level 1 的示例工作区",',
          '  "scripts": {',
          '    "dev": "python -m http.server 8000"',
          "  }",
          "}",
        ].join("\n")
      ),
      folder("src", [
        file(
          "app.js",
          [
            "// 入口：把各个模块组装起来",
            'import { createTree } from "./tree.js";',
            'import { readFile } from "./reader.js";',
            "",
            "const tree = createTree({ root: window.workspace });",
            "",
            "tree.onOpen((node) => {",
            "  readFile(node).then((text) => {",
            "    document.querySelector(\".code-view\").textContent = text;",
            "  });",
            "});",
            "",
            "tree.mount(document.getElementById(\"fileTree\"));",
          ].join("\n")
        ),
        file(
          "tree.js",
          [
            "// 文件树：折叠 / 展开 + 选中",
            "export function createTree(options) {",
            "  const root = options.root;",
            "  const listeners = [];",
            "",
            "  function walk(node, visit) {",
            "    visit(node);",
            "    if (node.kind === \"folder\" && node.expanded) {",
            "      node.children.forEach((child) => walk(child, visit));",
            "    }",
            "  }",
            "",
            "  return {",
            "    onOpen(fn) { listeners.push(fn); },",
            "    mount(container) {",
            "      container.replaceChildren();",
            "      walk(root, (node) => container.append(renderRow(node)));",
            "    },",
            "  };",
            "}",
          ].join("\n")
        ),
        file(
          "reader.js",
          [
            "// 读取文件内容：真实磁盘用 File System Access API",
            "export async function readFile(node) {",
            "  if (typeof node.content === \"string\") return node.content;",
            "  const handle = await node.handle.getFile();",
            "  return handle.text();",
            "}",
          ].join("\n")
        ),
        folder("components", [
          file(
            "button.js",
            [
              "export function createButton(label, onClick) {",
              "  const button = document.createElement(\"button\");",
              '  button.className = "btn";',
              "  button.textContent = label;",
              "  button.addEventListener(\"click\", onClick);",
              "  return button;",
              "}",
            ].join("\n")
          ),
          file(
            "card.css",
            [
              ".card {",
              "  background: #2b2b2b;",
              "  border-radius: 6px;",
              "  padding: 12px;",
              "}",
              "",
              ".card__title {",
              "  font-size: 13px;",
              "  font-weight: 600;",
              "}",
            ].join("\n")
          ),
        ]),
      ]),
      folder("styles", [
        file(
          "theme.css",
          [
            ":root {",
            "  --bg-editor: #1f1f1f;",
            "  --bg-panel: #181818;",
            "  --accent: #0078d4;",
            "}",
          ].join("\n")
        ),
        file(
          "main.css",
          [
            "body {",
            "  margin: 0;",
            "  background: var(--bg-editor);",
            "  color: #cccccc;",
            "  font-family: \"Segoe UI\", sans-serif;",
            "}",
          ].join("\n")
        ),
      ]),
      file(
        "index.html",
        [
          "<!DOCTYPE html>",
          '<html lang="zh-CN">',
          "  <head>",
          '    <meta charset="UTF-8" />',
          "    <title>示例工作区</title>",
          '    <link rel="stylesheet" href="styles/theme.css" />',
          "  </head>",
          "  <body>",
          '    <div id="fileTree"></div>',
          '    <script type="module" src="src/app.js"></script>',
          "  </body>",
          "</html>",
        ].join("\n")
      ),
    ]);
    return index(root, root.name, 0);
  }

  // ---------------- 本地文件夹（真实文件系统） ----------------

  function createLocalWorkspace() {
    if (typeof global.showDirectoryPicker !== "function") {
      return Promise.reject({ code: ERR_UNSUPPORTED });
    }
    return global
      .showDirectoryPicker({ mode: "read" })
      .then(function (handle) {
        var root = {
          kind: "folder",
          name: handle.name,
          handle: handle,
          children: null,
          expanded: true,
        };
        return index(root, handle.name, 0);
      });
  }

  function listChildren(node) {
    if (node.kind !== "folder") return Promise.resolve([]);
    if (node.children) return Promise.resolve(node.children);
    if (!node.handle || typeof node.handle.values !== "function") {
      return Promise.resolve([]);
    }

    var items = [];
    var iterator = node.handle.values();

    // 递归 next()，避免依赖 for await（老一点的浏览器也能跑）
    function step() {
      return iterator.next().then(function (result) {
        if (result.done) {
          items.sort(compareNodes);
          items.forEach(function (child) {
            child.parent = node;
            index(child, node.path + "/" + child.name, node.depth + 1);
          });
          node.children = items;
          return items;
        }
        items.push(makeEntryNode(result.value));
        return step();
      });
    }

    return step();
  }

  function makeEntryNode(entry) {
    if (entry.kind === "directory") {
      return {
        kind: "folder",
        name: entry.name,
        handle: entry,
        children: null,
        expanded: false,
      };
    }
    return { kind: "file", name: entry.name, handle: entry, content: null };
  }

  // 文件夹在前、同类按名称排序，和 VS Code 的资源管理器一致
  function compareNodes(a, b) {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-Hans-CN", {
      numeric: true,
      sensitivity: "base",
    });
  }

  function looksBinary(text) {
    var sample = text.slice(0, 2000);
    return sample.indexOf("\u0000") !== -1;
  }

  function readFile(node) {
    if (node.kind !== "file") return Promise.reject({ code: "ERR_NOT_FILE" });
    if (typeof node.content === "string") return Promise.resolve(node.content);
    if (!node.handle) return Promise.reject({ code: "ERR_NO_HANDLE" });

    return node.handle.getFile().then(function (file) {
      if (file.size > MAX_TEXT_SIZE) {
        return Promise.reject({ code: ERR_TOO_BIG, size: file.size });
      }
      return file.text().then(function (text) {
        if (looksBinary(text)) {
          return Promise.reject({ code: ERR_BINARY, size: file.size });
        }
        return text;
      });
    });
  }

  // ---------------- 语言识别（状态栏文案 + 文件图标配色） ----------------

  var LANGUAGES = [
    { exts: ["js", "mjs", "cjs", "jsx"], id: "javascript", label: "JavaScript", icon: "js" },
    { exts: ["ts", "tsx"], id: "typescript", label: "TypeScript", icon: "ts" },
    { exts: ["json"], id: "json", label: "JSON", icon: "json" },
    { exts: ["css"], id: "css", label: "CSS", icon: "css" },
    { exts: ["html", "htm"], id: "html", label: "HTML", icon: "html" },
    { exts: ["md", "markdown"], id: "markdown", label: "Markdown", icon: "md" },
    { exts: ["svg"], id: "xml", label: "SVG", icon: "svg" },
    { exts: ["txt", "log", ""], id: "plaintext", label: "纯文本", icon: "file" },
  ];

  function extensionOf(name) {
    var index = name.lastIndexOf(".");
    if (index <= 0) return "";
    return name.slice(index + 1).toLowerCase();
  }

  function detectLanguage(name) {
    var ext = extensionOf(name);
    for (var i = 0; i < LANGUAGES.length; i += 1) {
      if (LANGUAGES[i].exts.indexOf(ext) !== -1) return LANGUAGES[i];
    }
    return { id: "plaintext", label: "纯文本", icon: "file" };
  }

  global.BrowserVSCode = global.BrowserVSCode || {};
  global.BrowserVSCode.workspace = {
    createDemoWorkspace: createDemoWorkspace,
    createLocalWorkspace: createLocalWorkspace,
    listChildren: listChildren,
    readFile: readFile,
    detectLanguage: detectLanguage,
    compareNodes: compareNodes,
    errors: {
      BINARY: ERR_BINARY,
      TOO_BIG: ERR_TOO_BIG,
      UNSUPPORTED: ERR_UNSUPPORTED,
    },
  };
})(window);
