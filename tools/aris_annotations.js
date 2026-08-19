(function () {
  "use strict";

  var sourceMeta = document.querySelector('meta[name="aris:source-path"]');
  var main = document.querySelector("main");
  if (!sourceMeta || !main) return;

  var SOURCE_PATH = sourceMeta.getAttribute("content") || location.pathname;
  var hashMeta = document.querySelector('meta[name="aris:source-sha256"]');
  var SOURCE_HASH = hashMeta ? (hashMeta.getAttribute("content") || "") : "";
  var lang = (document.documentElement.lang || "zh").toLowerCase();
  var isZh = lang.indexOf("zh") === 0;

  var T = isZh ? {
    highlight: "高亮", note: "添加笔记", notes: "笔记", save: "保存", cancel: "取消",
    edit: "编辑", remove: "删除", export: "导出 JSON", import: "导入 JSON", clearPage: "清空本页",
    empty: "本页还没有笔记。选中文字、公式，或连续的文字 + 公式即可添加高亮或笔记。",
    notePlaceholder: "写下你的笔记…", oldRevision: "旧版本", unresolved: "未完全定位",
    importDone: "已导入笔记", importBad: "无法读取该笔记文件", clearConfirm: "删除本页全部高亮和笔记？",
    selectionBad: "请选择连续正文；可包含公式，但不要跨越不同大章节或过多内容块。",
    overlap: "所选内容与已有高亮重叠。", storageError: "浏览器无法保存笔记。",
    exportEmpty: "没有可导出的笔记。", close: "关闭", mixed: "文字 + 公式", math: "公式"
  } : {
    highlight: "Highlight", note: "Add note", notes: "Notes", save: "Save", cancel: "Cancel",
    edit: "Edit", remove: "Delete", export: "Export JSON", import: "Import JSON", clearPage: "Clear page",
    empty: "No notes on this page yet. Select text, math, or a continuous text + math passage to annotate it.",
    notePlaceholder: "Write a note…", oldRevision: "Old revision", unresolved: "Partially unresolved",
    importDone: "Notes imported", importBad: "Could not read that notes file", clearConfirm: "Delete all highlights and notes on this page?",
    selectionBad: "Select a continuous passage. Math is allowed, but do not cross major sections or too many content blocks.",
    overlap: "This selection overlaps an existing highlight.", storageError: "The browser could not save notes.",
    exportEmpty: "There are no notes to export.", close: "Close", mixed: "Text + math", math: "Math"
  };

  var STYLE_ID = "aris-annotations-style";
  var TOOLBAR_ID = "aris-annotation-toolbar";
  var PANEL_ID = "aris-annotation-panel";
  var EDITOR_ID = "aris-annotation-editor";
  var DB_NAME = "aris-annotations";
  var DB_VERSION = 1;
  var STORE = "annotations";
  var REGULAR_BLOCK_SELECTOR = "p,li,td,th,blockquote,h2,h3,h4,summary,figcaption";
  var MAX_BLOCKS = 8;

  var currentRange = null;
  var panelOpen = false;
  var dbPromise = null;
  var restoreStatus = new Map();

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".aris-annotation-highlight{background:rgba(250,204,21,.35);border-radius:2px;box-decoration-break:clone;-webkit-box-decoration-break:clone;cursor:pointer;padding:0 .02em}",
      ".aris-annotation-highlight[data-has-note=\"true\"]{background:rgba(250,204,21,.48);border-bottom:1px solid rgba(180,83,9,.55)}",
      "mjx-container.aris-annotation-math{background:rgba(250,204,21,.28);outline:1px solid rgba(180,83,9,.28);outline-offset:2px;border-radius:4px;cursor:pointer}",
      "mjx-container.aris-annotation-math[data-has-note=\"true\"]{background:rgba(250,204,21,.42);outline-color:rgba(180,83,9,.52)}",
      "main mjx-container.MathJax{-webkit-user-select:text!important;user-select:text!important}",
      "main details summary{-webkit-user-select:text!important;user-select:text!important}",
      "#" + TOOLBAR_ID + "{position:fixed;z-index:1300;display:flex;gap:4px;padding:5px;background:#fff;border:1px solid var(--border,#d6d0c0);border-radius:7px;box-shadow:0 8px 24px rgba(0,0,0,.14);font:13px/1.2 system-ui,-apple-system,sans-serif}",
      "#" + TOOLBAR_ID + "[hidden]{display:none}",
      "#" + TOOLBAR_ID + " button{border:0;background:transparent;color:var(--ink,#1a1a1a);padding:6px 9px;border-radius:5px;cursor:pointer;font:inherit}",
      "#" + TOOLBAR_ID + " button:hover{background:var(--bg-soft,#f4f1ea);color:var(--primary,#1a4a8c)}",
      ".aris-notes-toggle{position:fixed;right:16px;top:58px;z-index:1200;border:1px solid var(--border,#d6d0c0);background:var(--bg,#fdfcf7);color:var(--ink-soft,#4a4a4a);border-radius:18px;padding:6px 11px;cursor:pointer;font:13px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.06)}",
      ".aris-notes-toggle:hover{color:var(--primary,#1a4a8c)}",
      "#" + PANEL_ID + "{position:fixed;z-index:1250;right:16px;top:96px;width:min(380px,calc(100vw - 32px));max-height:calc(100vh - 116px);overflow:auto;background:var(--bg,#fdfcf7);color:var(--ink,#1a1a1a);border:1px solid var(--border,#d6d0c0);border-radius:9px;box-shadow:0 12px 34px rgba(0,0,0,.16);font:14px/1.45 system-ui,-apple-system,sans-serif}",
      "#" + PANEL_ID + "[hidden]{display:none}",
      ".aris-notes-head{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:var(--bg,#fdfcf7);border-bottom:1px solid var(--border-soft,#e8e3d5);z-index:1}",
      ".aris-notes-head strong{color:var(--ink,#1a1a1a)}",
      ".aris-notes-close{border:0;background:transparent;cursor:pointer;font-size:18px;color:var(--ink-muted,#6b6b6b)}",
      ".aris-notes-list{padding:8px 12px}",
      ".aris-note-card{padding:10px 4px 12px;border-bottom:1px solid var(--border-soft,#e8e3d5)}",
      ".aris-note-card:last-child{border-bottom:0}",
      ".aris-note-quote{font-family:Georgia,serif;color:var(--ink-soft,#4a4a4a);font-size:13px;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer}",
      ".aris-note-text{white-space:pre-wrap;margin:6px 0 8px;color:var(--ink,#1a1a1a)}",
      ".aris-note-meta{display:flex;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--ink-muted,#6b6b6b)}",
      ".aris-badge{display:inline-block;border:1px solid var(--border-soft,#e8e3d5);border-radius:10px;padding:1px 6px}",
      ".aris-note-actions{display:flex;gap:8px;margin-top:8px}",
      ".aris-note-actions button,.aris-notes-tools button{border:1px solid var(--border,#d6d0c0);background:transparent;color:var(--ink-soft,#4a4a4a);border-radius:5px;padding:4px 7px;cursor:pointer;font:12px system-ui,-apple-system,sans-serif}",
      ".aris-note-actions button:hover,.aris-notes-tools button:hover{color:var(--primary,#1a4a8c);border-color:var(--primary,#1a4a8c)}",
      ".aris-notes-empty{padding:22px 8px;color:var(--ink-muted,#6b6b6b)}",
      ".aris-notes-tools{position:sticky;bottom:0;display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;background:var(--bg,#fdfcf7);border-top:1px solid var(--border-soft,#e8e3d5)}",
      "#" + EDITOR_ID + "{position:fixed;z-index:1400;width:min(420px,calc(100vw - 32px));background:var(--bg,#fdfcf7);border:1px solid var(--border,#d6d0c0);border-radius:9px;box-shadow:0 12px 36px rgba(0,0,0,.2);padding:12px;font:14px/1.4 system-ui,-apple-system,sans-serif}",
      "#" + EDITOR_ID + "[hidden]{display:none}",
      "#" + EDITOR_ID + " textarea{width:100%;min-height:96px;resize:vertical;border:1px solid var(--border,#d6d0c0);border-radius:6px;padding:9px;background:#fff;color:#1a1a1a;font:14px/1.45 system-ui,-apple-system,sans-serif}",
      ".aris-editor-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:8px}",
      ".aris-editor-actions button{border:1px solid var(--border,#d6d0c0);background:transparent;border-radius:5px;padding:5px 9px;cursor:pointer}",
      ".aris-editor-actions .primary{background:var(--primary,#1a4a8c);border-color:var(--primary,#1a4a8c);color:white}",
      ".aris-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1500;background:rgba(0,0,0,.82);color:#fff;padding:7px 12px;border-radius:6px;font:12px system-ui,-apple-system,sans-serif;pointer-events:none}",
      "@media(max-width:900px){.aris-notes-toggle{top:auto;bottom:16px}.aris-notes-toggle.aris-panel-open{bottom:auto;top:58px}#" + PANEL_ID + "{right:8px;top:52px;width:calc(100vw - 16px);max-height:calc(100vh - 64px)}}",
      "@media print{#" + TOOLBAR_ID + ",#" + PANEL_ID + ",#" + EDITOR_ID + ",.aris-notes-toggle,.aris-toast{display:none!important}.aris-annotation-highlight{background:transparent!important;border-bottom:1px dotted #999!important}mjx-container.aris-annotation-math{background:transparent!important;outline:1px dotted #999!important}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function openDb() {
    if (!window.indexedDB) return Promise.reject(new Error("IndexedDB unavailable"));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        var store;
        if (!db.objectStoreNames.contains(STORE)) store = db.createObjectStore(STORE, { keyPath: "id" });
        else store = req.transaction.objectStore(STORE);
        if (!store.indexNames.contains("sourcePath")) store.createIndex("sourcePath", "sourcePath", { unique: false });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode), s = t.objectStore(STORE), result;
        try { result = fn(s, t); } catch (e) { reject(e); return; }
        t.oncomplete = function () { resolve(result); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error("transaction aborted")); };
      });
    });
  }

  function putAnnotation(a) { return tx("readwrite", function (s) { s.put(a); }); }
  function deleteAnnotation(id) { return tx("readwrite", function (s) { s.delete(id); }); }

  function getPageAnnotations() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, "readonly");
        var req = t.objectStore(STORE).index("sourcePath").getAll(IDBKeyRange.only(SOURCE_PATH));
        req.onsuccess = function () {
          resolve((req.result || []).sort(function (a, b) { return (a.createdAt || "").localeCompare(b.createdAt || ""); }));
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function getAllAnnotations() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, "readonly"), req = t.objectStore(STORE).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function clearPageAnnotations() {
    return getPageAnnotations().then(function (items) {
      return tx("readwrite", function (s) { items.forEach(function (a) { s.delete(a.id); }); });
    });
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "ann-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function toast(msg) {
    var el = document.createElement("div");
    el.className = "aris-toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1700);
  }

  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(String(s));
    return String(s).replace(/[^a-zA-Z0-9_-]/g, function (c) { return "\\" + c.charCodeAt(0).toString(16) + " "; });
  }

  function annotationBlock(node) {
    var el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el) return null;
    var regular = el.closest(REGULAR_BLOCK_SELECTOR);
    if (regular && main.contains(regular)) return regular;
    var math = el.closest('mjx-container[data-aris-tex]');
    return math && main.contains(math) ? math : null;
  }

  function nearestSectionId(block) {
    if (!block) return "";
    if (block.matches && (block.matches("h2[id]") || block.matches("h3[id]"))) return block.id;
    var headings = [].slice.call(main.querySelectorAll("h2[id],h3[id]"));
    var last = "";
    headings.forEach(function (h) {
      if (h.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING) last = h.id;
    });
    return last;
  }

  function nearestMajorSectionId(block) {
    if (!block) return "";
    if (block.matches && block.matches("h2[id]")) return block.id;
    var headings = [].slice.call(main.querySelectorAll("h2[id]"));
    var last = "";
    headings.forEach(function (h) {
      if (h.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING) last = h.id;
    });
    return last;
  }

  function textNodes(block) {
    var out = [];
    if (!block) return out;
    var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || p.closest("script,style,#" + PANEL_ID + ",#" + EDITOR_ID + ",#" + TOOLBAR_ID)) return NodeFilter.FILTER_REJECT;
        if (p.closest("mjx-container")) return NodeFilter.FILTER_REJECT;
        return n.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }), n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function blockText(block) {
    return textNodes(block).map(function (n) { return n.nodeValue; }).join("");
  }

  function offsetWithinBlock(block, container, offset) {
    var nodes = textNodes(block), total = 0;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n === container) return total + offset;
      total += n.nodeValue.length;
    }
    return -1;
  }

  function blockAnchor(block) {
    var tag = block.matches && block.matches('mjx-container[data-aris-tex]') ? "math" : block.tagName.toLowerCase();
    var scope = candidateBlocks({ sectionId: nearestSectionId(block) });
    var sameTag = scope.filter(function (b) {
      var bt = b.matches && b.matches('mjx-container[data-aris-tex]') ? "math" : b.tagName.toLowerCase();
      return bt === tag;
    });
    return {
      sectionId: nearestSectionId(block),
      blockTag: tag,
      blockHint: blockText(block).slice(0, 120),
      blockOrdinal: Math.max(0, sameTag.indexOf(block))
    };
  }

  function allAnnotationBlocks() {
    var blocks = [].slice.call(main.querySelectorAll(REGULAR_BLOCK_SELECTOR));
    main.querySelectorAll('mjx-container[data-aris-tex]').forEach(function (m) {
      if (!m.closest(REGULAR_BLOCK_SELECTOR)) blocks.push(m);
    });
    return blocks;
  }

  function candidateBlocks(anchor) {
    var blocks = allAnnotationBlocks();
    if (anchor && anchor.sectionId) {
      var h = document.getElementById(anchor.sectionId);
      if (h && main.contains(h)) {
        var level = h.tagName === "H2" ? 2 : 3;
        blocks = blocks.filter(function (b) {
          if (b === h) return true;
          if (!(h.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
          var nextHeads = [].slice.call(main.querySelectorAll(level === 2 ? "h2[id]" : "h2[id],h3[id]"));
          var next = nextHeads.find(function (x) {
            return x !== h && (h.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
          });
          return !next || (!(next.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) && next !== b);
        });
      }
    }
    return blocks;
  }

  function blockScore(block, anchor) {
    var score = 0;
    if (!anchor) return score;
    var tag = block.matches && block.matches('mjx-container[data-aris-tex]') ? "math" : block.tagName.toLowerCase();
    if (anchor.blockTag && tag === anchor.blockTag) score += 3;
    var text = blockText(block);
    if (anchor.blockHint && text.indexOf(anchor.blockHint.slice(0, 40)) === 0) score += 4;
    var scope = candidateBlocks(anchor).filter(function (b) {
      var bt = b.matches && b.matches('mjx-container[data-aris-tex]') ? "math" : b.tagName.toLowerCase();
      return !anchor.blockTag || bt === anchor.blockTag;
    });
    if (typeof anchor.blockOrdinal === "number" && scope[anchor.blockOrdinal] === block) score += 2;
    return score;
  }

  function pointOffsetInTextNode(range, node, isStart) {
    var len = node.nodeValue.length;
    if (!len) return 0;
    if (node === range.startContainer && isStart) return range.startOffset;
    if (node === range.endContainer && !isStart) return range.endOffset;

    var target = isStart ? -1 : 1;
    var atEdge = range.comparePoint(node, isStart ? 0 : len);
    if (atEdge !== target) return isStart ? 0 : len;

    var lo = 0, hi = len;
    while (lo < hi) {
      var mid = isStart ? Math.floor((lo + hi) / 2) : Math.ceil((lo + hi) / 2);
      var cmp = range.comparePoint(node, mid);
      if (isStart) {
        if (cmp < 0) lo = mid + 1; else hi = mid;
      } else {
        if (cmp > 0) hi = mid - 1; else lo = mid;
      }
    }
    return lo;
  }

  function selectedTextSlice(range, node) {
    try {
      if (!range.intersectsNode(node)) return null;
      var start = pointOffsetInTextNode(range, node, true);
      var end = pointOffsetInTextNode(range, node, false);
      if (end <= start) return null;
      return { start: start, end: end, text: node.nodeValue.slice(start, end) };
    } catch (_) {
      return null;
    }
  }

  function compareDom(a, b) {
    if (a.node === b.node) return 0;
    var pos = a.node.compareDocumentPosition(b.node);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  }

  function mathItemsInBlock(block) {
    if (block.matches && block.matches('mjx-container[data-aris-tex]')) return [block];
    return [].slice.call(block.querySelectorAll('mjx-container[data-aris-tex]'));
  }

  function segmentsFromRange(range) {
    var entries = [];
    var walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || p.closest("script,style,pre,code,#" + PANEL_ID + ",#" + EDITOR_ID + ",#" + TOOLBAR_ID)) return NodeFilter.FILTER_REJECT;
        if (p.closest("mjx-container")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }), n;
    while ((n = walker.nextNode())) {
      var slice = selectedTextSlice(range, n);
      if (!slice || !slice.text) continue;
      var block = annotationBlock(n);
      if (block) entries.push({ kind: "text", node: n, block: block, start: slice.start, end: slice.end, text: slice.text });
    }

    main.querySelectorAll('mjx-container[data-aris-tex]').forEach(function (math) {
      try {
        if (!range.intersectsNode(math)) return;
      } catch (_) { return; }
      var block = annotationBlock(math);
      if (block) entries.push({ kind: "math", node: math, block: block, math: math });
    });

    entries.sort(compareDom);
    var segments = [];
    var textGroup = null;

    function flushTextGroup() {
      if (!textGroup) return;
      var block = textGroup.block;
      var start = offsetWithinBlock(block, textGroup.first.node, textGroup.first.start);
      var end = offsetWithinBlock(block, textGroup.last.node, textGroup.last.end);
      if (start >= 0 && end > start) {
        var full = blockText(block), exact = full.slice(start, end), ba = blockAnchor(block);
        if (exact.trim()) {
          segments.push({
            kind: "text", exact: exact,
            prefix: full.slice(Math.max(0, start - 48), start),
            suffix: full.slice(end, Math.min(full.length, end + 48)),
            sectionId: ba.sectionId, blockTag: ba.blockTag, blockHint: ba.blockHint, blockOrdinal: ba.blockOrdinal
          });
        }
      }
      textGroup = null;
    }

    entries.forEach(function (entry) {
      if (entry.kind === "math") {
        flushTextGroup();
        var ba = blockAnchor(entry.block), maths = mathItemsInBlock(entry.block);
        segments.push({
          kind: "math", tex: entry.math.dataset.arisTex || "",
          display: entry.math.dataset.arisMathDisplay === "block",
          mathOrdinal: Math.max(0, maths.indexOf(entry.math)),
          sectionId: ba.sectionId, blockTag: ba.blockTag, blockHint: ba.blockHint, blockOrdinal: ba.blockOrdinal
        });
        return;
      }
      if (!textGroup || textGroup.block !== entry.block) {
        flushTextGroup();
        textGroup = { block: entry.block, first: entry, last: entry };
      } else {
        textGroup.last = entry;
      }
    });
    flushTextGroup();
    return segments;
  }

  function uniqueBlocksForSegments(segments) {
    var keys = [];
    segments.forEach(function (s) {
      var key = [s.sectionId || "", s.blockTag || "", s.blockOrdinal == null ? "" : s.blockOrdinal, s.blockHint || ""].join("|");
      if (keys.indexOf(key) < 0) keys.push(key);
    });
    return keys;
  }

  function rangeIsUsable(range) {
    if (!range || range.collapsed || !main.contains(range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)) return false;
    var startEl = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    var endEl = range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement;
    if (!startEl || !endEl || startEl.closest("pre,code") || endEl.closest("pre,code")) return false;
    if (startEl.closest("#" + PANEL_ID + ",#" + EDITOR_ID + ",#" + TOOLBAR_ID) || endEl.closest("#" + PANEL_ID + ",#" + EDITOR_ID + ",#" + TOOLBAR_ID)) return false;
    var segments = segmentsFromRange(range);
    if (!segments.length) return false;
    if (uniqueBlocksForSegments(segments).length > MAX_BLOCKS) return false;
    var majors = [];
    segments.forEach(function (s) {
      var blocks = candidateBlocks(s);
      var b = blocks.find(function (x) {
        var tag = x.matches && x.matches('mjx-container[data-aris-tex]') ? "math" : x.tagName.toLowerCase();
        return (!s.blockTag || tag === s.blockTag) && (!s.blockHint || blockText(x).indexOf(s.blockHint.slice(0, 40)) === 0);
      });
      var major = b ? nearestMajorSectionId(b) : "";
      if (majors.indexOf(major) < 0) majors.push(major);
    });
    return majors.length <= 1;
  }

  function scoreTextCandidate(text, idx, anchor) {
    var score = 0;
    if (anchor.prefix) {
      var before = text.slice(Math.max(0, idx - anchor.prefix.length), idx);
      var p = anchor.prefix.slice(-Math.min(anchor.prefix.length, before.length));
      if (before.slice(-p.length) === p) score += 5;
    }
    if (anchor.suffix) {
      var after = text.slice(idx + anchor.exact.length, idx + anchor.exact.length + anchor.suffix.length);
      var s = anchor.suffix.slice(0, Math.min(anchor.suffix.length, after.length));
      if (after.slice(0, s.length) === s) score += 5;
    }
    return score;
  }

  function findTextAnchor(anchor) {
    var best = null;
    candidateBlocks(anchor).forEach(function (block) {
      if (anchor.blockTag) {
        var tag = block.matches && block.matches('mjx-container[data-aris-tex]') ? "math" : block.tagName.toLowerCase();
        if (tag !== anchor.blockTag) return;
      }
      var text = blockText(block), from = 0;
      while (from <= text.length) {
        var idx = text.indexOf(anchor.exact, from);
        if (idx < 0) break;
        var score = blockScore(block, anchor) + scoreTextCandidate(text, idx, anchor);
        if (!best || score > best.score) best = { block: block, start: idx, end: idx + anchor.exact.length, score: score };
        from = idx + Math.max(1, anchor.exact.length);
      }
    });
    return best;
  }

  function findMathAnchor(anchor) {
    var best = null;
    candidateBlocks(anchor).forEach(function (block) {
      if (anchor.blockTag) {
        var tag = block.matches && block.matches('mjx-container[data-aris-tex]') ? "math" : block.tagName.toLowerCase();
        if (tag !== anchor.blockTag) return;
      }
      var maths = mathItemsInBlock(block);
      maths.forEach(function (math, idx) {
        if ((math.dataset.arisTex || "") !== anchor.tex) return;
        var score = blockScore(block, anchor);
        if (typeof anchor.mathOrdinal === "number" && idx === anchor.mathOrdinal) score += 5;
        if (!best || score > best.score) best = { math: math, score: score };
      });
    });
    return best;
  }

  function rangeFromOffsets(block, start, end) {
    var nodes = textNodes(block), pos = 0, startNode = null, startOffset = 0, endNode = null, endOffset = 0;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i], next = pos + n.nodeValue.length;
      if (!startNode && start >= pos && start <= next) { startNode = n; startOffset = start - pos; }
      if (!endNode && end >= pos && end <= next) { endNode = n; endOffset = end - pos; break; }
      pos = next;
    }
    if (!startNode || !endNode) return null;
    var r = document.createRange();
    r.setStart(startNode, startOffset);
    r.setEnd(endNode, endOffset);
    return r;
  }

  function overlapsExisting(range) {
    var decorated = main.querySelectorAll("mark.aris-annotation-highlight,mjx-container.aris-annotation-math");
    for (var i = 0; i < decorated.length; i++) {
      try { if (range.intersectsNode(decorated[i])) return true; } catch (_) {}
    }
    return false;
  }

  function wrapTextRange(range, a) {
    if (!range || range.collapsed) return null;
    var mark = document.createElement("mark");
    mark.className = "aris-annotation-highlight";
    mark.dataset.annotationId = a.id;
    mark.dataset.hasNote = a.note ? "true" : "false";
    try {
      var frag = range.extractContents();
      mark.appendChild(frag);
      range.insertNode(mark);
      return mark;
    } catch (_) {
      return null;
    }
  }

  function decorateMathNode(math, a) {
    if (!math || (math.dataset.annotationId && math.dataset.annotationId !== a.id)) return null;
    math.classList.add("aris-annotation-math");
    math.dataset.annotationId = a.id;
    math.dataset.hasNote = a.note ? "true" : "false";
    return math;
  }

  function annotationNodes(id) {
    return [].slice.call(main.querySelectorAll('[data-annotation-id="' + cssEscape(id) + '"]'));
  }

  function clearAnnotationDecorations(id) {
    annotationNodes(id).forEach(function (node) {
      if (node.matches("mark.aris-annotation-highlight")) {
        var parent = node.parentNode;
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
        parent.normalize();
      } else if (node.matches("mjx-container.aris-annotation-math")) {
        node.classList.remove("aris-annotation-math");
        delete node.dataset.annotationId;
        delete node.dataset.hasNote;
      }
    });
  }

  function restoreSegment(segment, a) {
    if (segment.kind === "math") {
      var mhit = findMathAnchor(segment);
      return !!(mhit && decorateMathNode(mhit.math, a));
    }
    var hit = findTextAnchor(segment);
    if (!hit) return false;
    var r = rangeFromOffsets(hit.block, hit.start, hit.end);
    if (!r) return false;
    var existing = main.querySelectorAll("mark.aris-annotation-highlight");
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].dataset.annotationId === a.id) continue;
      try { if (r.intersectsNode(existing[i])) return false; } catch (_) {}
    }
    return !!wrapTextRange(r, a);
  }

  function restoreLegacy(a) {
    var hit = findTextAnchor(a);
    if (!hit) return false;
    var r = rangeFromOffsets(hit.block, hit.start, hit.end);
    if (!r) return false;
    return !!wrapTextRange(r, a);
  }

  function restoreOne(a) {
    if (annotationNodes(a.id).length) return true;
    var ok = true;
    if (Array.isArray(a.segments) && a.segments.length) {
      a.segments.forEach(function (segment) { if (!restoreSegment(segment, a)) ok = false; });
    } else {
      ok = restoreLegacy(a);
    }
    restoreStatus.set(a.id, ok ? "ok" : "unresolved");
    return ok;
  }

  function restoreAll() {
    return getPageAnnotations().then(function (items) {
      restoreStatus.clear();
      items.forEach(restoreOne);
      updateCount(items.length);
      if (panelOpen) renderPanel(items);
      return items;
    }).catch(function () {
      toast(T.storageError);
      return [];
    });
  }

  function previewForSegments(segments) {
    return segments.map(function (s) {
      return s.kind === "math" ? (s.display ? "$$" + s.tex + "$$" : "$" + s.tex + "$") : s.exact;
    }).join(" ").replace(/\s+/g, " ").trim();
  }

  function annotationFromRange(range, note) {
    var segments = segmentsFromRange(range);
    if (!segments.length) return null;
    var hasMath = segments.some(function (s) { return s.kind === "math"; });
    var hasText = segments.some(function (s) { return s.kind === "text"; });
    var preview = previewForSegments(segments);
    return {
      id: uuid(), schemaVersion: 2,
      type: hasMath ? (hasText ? "mixed" : "math") : "text",
      sourcePath: SOURCE_PATH, sourceHash: SOURCE_HASH,
      exact: preview, segments: segments, note: note || "",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
  }

  function selectionToolbar() {
    var bar = document.createElement("div");
    bar.id = TOOLBAR_ID;
    bar.hidden = true;
    bar.innerHTML = '<button type="button" data-action="highlight">🟨 ' + T.highlight + '</button><button type="button" data-action="note">✎ ' + T.note + '</button>';
    document.body.appendChild(bar);
    bar.addEventListener("mousedown", function (e) { e.preventDefault(); });
    bar.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-action]");
      if (!btn || !currentRange) return;
      if (btn.dataset.action === "highlight") createFromCurrent("");
      else openEditorForSelection();
    });
    return bar;
  }

  var toolbar = selectionToolbar();
  function hideToolbar() { toolbar.hidden = true; }

  function updateToolbarFromSelection() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { hideToolbar(); return; }
    var r = sel.getRangeAt(0);
    if (!rangeIsUsable(r)) { hideToolbar(); return; }
    currentRange = r.cloneRange();
    var rect = r.getBoundingClientRect();
    toolbar.hidden = false;
    var w = toolbar.offsetWidth || 160, h = toolbar.offsetHeight || 36;
    var left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left + rect.width / 2 - w / 2));
    var top = rect.top - h - 8;
    if (top < 8) top = Math.min(window.innerHeight - h - 8, rect.bottom + 8);
    toolbar.style.left = left + "px";
    toolbar.style.top = top + "px";
  }

  document.addEventListener("selectionchange", function () { setTimeout(updateToolbarFromSelection, 0); });
  window.addEventListener("scroll", hideToolbar, { passive: true });

  function createFromCurrent(note) {
    var r = currentRange && currentRange.cloneRange();
    hideToolbar();
    if (!rangeIsUsable(r)) { toast(T.selectionBad); return; }
    if (overlapsExisting(r)) { toast(T.overlap); return; }
    var a = annotationFromRange(r, note);
    if (!a) { toast(T.selectionBad); return; }
    putAnnotation(a).then(function () {
      currentRange = null;
      var sel = window.getSelection();
      if (sel) sel.removeAllRanges();
      restoreOne(a);
      return refreshPanel();
    }).catch(function () { toast(T.storageError); });
  }

  function editorHost() {
    var editor = document.createElement("div");
    editor.id = EDITOR_ID;
    editor.hidden = true;
    editor.innerHTML = '<textarea placeholder="' + T.notePlaceholder.replace(/"/g, "&quot;") + '"></textarea><div class="aris-editor-actions"><button type="button" data-action="cancel">' + T.cancel + '</button><button type="button" class="primary" data-action="save">' + T.save + '</button></div>';
    document.body.appendChild(editor);
    return editor;
  }

  var editor = editorHost(), editorMode = null, editorAnnotationId = null;

  function placeEditor(rect) {
    editor.hidden = false;
    var w = editor.offsetWidth || 400, h = editor.offsetHeight || 160;
    var left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left)), top = rect.bottom + 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 8);
    editor.style.left = left + "px";
    editor.style.top = top + "px";
  }

  function openEditorForSelection() {
    var r = currentRange && currentRange.cloneRange();
    hideToolbar();
    if (!rangeIsUsable(r)) { toast(T.selectionBad); return; }
    if (overlapsExisting(r)) { toast(T.overlap); return; }
    editorMode = "create";
    editorAnnotationId = null;
    editor.querySelector("textarea").value = "";
    placeEditor(r.getBoundingClientRect());
    setTimeout(function () { editor.querySelector("textarea").focus(); }, 0);
  }

  function openEditorForExisting(a, node) {
    editorMode = "edit";
    editorAnnotationId = a.id;
    editor.querySelector("textarea").value = a.note || "";
    placeEditor(node.getBoundingClientRect());
    setTimeout(function () { editor.querySelector("textarea").focus(); }, 0);
  }

  function closeEditor() {
    editor.hidden = true;
    editorMode = null;
    editorAnnotationId = null;
  }

  function setDecorationNoteState(id, hasNote) {
    annotationNodes(id).forEach(function (node) { node.dataset.hasNote = hasNote ? "true" : "false"; });
  }

  editor.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "cancel") { closeEditor(); return; }
    var value = editor.querySelector("textarea").value.trim();
    if (editorMode === "create") {
      closeEditor();
      createFromCurrent(value);
    } else if (editorMode === "edit" && editorAnnotationId) {
      var id = editorAnnotationId;
      getPageAnnotations().then(function (items) {
        var a = items.find(function (x) { return x.id === id; });
        if (!a) return;
        a.note = value;
        a.updatedAt = new Date().toISOString();
        return putAnnotation(a).then(function () {
          setDecorationNoteState(id, !!value);
          closeEditor();
          return refreshPanel();
        });
      }).catch(function () { toast(T.storageError); });
    }
  });

  function panelHost() {
    var toggle = document.createElement("button");
    toggle.className = "aris-notes-toggle";
    toggle.type = "button";
    toggle.textContent = "📝 0";
    toggle.setAttribute("aria-label", T.notes);
    document.body.appendChild(toggle);

    var panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.hidden = true;
    panel.innerHTML = '<div class="aris-notes-head"><strong>' + T.notes + '</strong><button class="aris-notes-close" type="button" aria-label="' + T.close + '">×</button></div><div class="aris-notes-list"></div><div class="aris-notes-tools"><button type="button" data-action="export">' + T.export + '</button><button type="button" data-action="import">' + T.import + '</button><button type="button" data-action="clear">' + T.clearPage + '</button><input type="file" accept="application/json,.json" hidden></div>';
    document.body.appendChild(panel);

    toggle.addEventListener("click", function () {
      panelOpen = !panelOpen;
      panel.hidden = !panelOpen;
      toggle.classList.toggle("aris-panel-open", panelOpen);
      if (panelOpen) refreshPanel();
    });
    panel.querySelector(".aris-notes-close").addEventListener("click", function () {
      panelOpen = false;
      panel.hidden = true;
      toggle.classList.remove("aris-panel-open");
    });
    return { toggle: toggle, panel: panel };
  }

  var panelUi = panelHost();
  function updateCount(n) { panelUi.toggle.textContent = "📝 " + n; }
  function formatDate(s) { if (!s) return ""; try { return new Date(s).toLocaleDateString(); } catch (_) { return ""; } }
  function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]; }); }

  function annotationLabel(a) {
    if (a.type === "mixed") return T.mixed;
    if (a.type === "math") return T.math;
    return "";
  }

  function renderPanel(items) {
    updateCount(items.length);
    var list = panelUi.panel.querySelector(".aris-notes-list");
    if (!items.length) { list.innerHTML = '<div class="aris-notes-empty">' + T.empty + '</div>'; return; }
    list.innerHTML = items.map(function (a) {
      var old = SOURCE_HASH && a.sourceHash && a.sourceHash !== SOURCE_HASH;
      var unresolved = restoreStatus.get(a.id) === "unresolved";
      var label = annotationLabel(a);
      return '<div class="aris-note-card" data-id="' + escapeHtml(a.id) + '"><div class="aris-note-quote" title="' + escapeHtml(a.exact || "") + '">“' + escapeHtml(a.exact || "") + '”</div>' +
        (a.note ? '<div class="aris-note-text">' + escapeHtml(a.note) + '</div>' : '') + '<div class="aris-note-meta">' +
        (formatDate(a.updatedAt || a.createdAt) ? '<span>' + escapeHtml(formatDate(a.updatedAt || a.createdAt)) + '</span>' : '') +
        (label ? '<span class="aris-badge">' + escapeHtml(label) + '</span>' : '') +
        (old ? '<span class="aris-badge">' + T.oldRevision + '</span>' : '') +
        (unresolved ? '<span class="aris-badge">' + T.unresolved + '</span>' : '') +
        '</div><div class="aris-note-actions"><button type="button" data-action="edit">' + T.edit + '</button><button type="button" data-action="delete">' + T.remove + '</button></div></div>';
    }).join("");
  }

  function refreshPanel() {
    return getPageAnnotations().then(function (items) { renderPanel(items); return items; });
  }

  function scrollToAnnotation(id) {
    var nodes = annotationNodes(id);
    if (!nodes.length) return;
    var node = nodes[0];
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    var old = node.style.outline;
    node.style.outline = "2px solid var(--accent,#b8390e)";
    setTimeout(function () { node.style.outline = old; }, 1000);
  }

  panelUi.panel.addEventListener("click", function (e) {
    var card = e.target.closest(".aris-note-card");
    if (card && e.target.closest(".aris-note-quote")) { scrollToAnnotation(card.dataset.id); return; }
    var btn = e.target.closest("button[data-action]");
    if (!btn) return;
    var action = btn.dataset.action;
    if (action === "export") { exportJson(); return; }
    if (action === "import") { panelUi.panel.querySelector('input[type="file"]').click(); return; }
    if (action === "clear") {
      if (!window.confirm(T.clearConfirm)) return;
      clearPageAnnotations().then(function () {
        [].slice.call(main.querySelectorAll("mark.aris-annotation-highlight")).forEach(function (m) {
          var p = m.parentNode;
          while (m.firstChild) p.insertBefore(m.firstChild, m);
          p.removeChild(m);
          p.normalize();
        });
        [].slice.call(main.querySelectorAll("mjx-container.aris-annotation-math")).forEach(function (m) {
          m.classList.remove("aris-annotation-math"); delete m.dataset.annotationId; delete m.dataset.hasNote;
        });
        restoreStatus.clear();
        return refreshPanel();
      });
      return;
    }
    if (!card) return;
    var id = card.dataset.id;
    if (action === "delete") {
      deleteAnnotation(id).then(function () { clearAnnotationDecorations(id); restoreStatus.delete(id); return refreshPanel(); });
    } else if (action === "edit") {
      getPageAnnotations().then(function (items) {
        var a = items.find(function (x) { return x.id === id; });
        var nodes = annotationNodes(id);
        if (a && nodes.length) openEditorForExisting(a, nodes[0]);
      });
    }
  });

  main.addEventListener("click", function (e) {
    var decorated = e.target.closest("mark.aris-annotation-highlight,mjx-container.aris-annotation-math");
    if (!decorated) return;
    var id = decorated.dataset.annotationId;
    getPageAnnotations().then(function (items) {
      var a = items.find(function (x) { return x.id === id; });
      if (!a) return;
      if (a.note) openEditorForExisting(a, decorated);
      else {
        panelOpen = true;
        panelUi.panel.hidden = false;
        panelUi.toggle.classList.add("aris-panel-open");
        renderPanel(items);
      }
    });
  });

  // A drag-selection on <summary> should select text, not toggle the disclosure.
  main.addEventListener("click", function (e) {
    var summary = e.target.closest("summary");
    if (!summary) return;
    var sel = window.getSelection();
    if (sel && !sel.isCollapsed && summary.contains(sel.anchorNode) && summary.contains(sel.focusNode)) e.preventDefault();
  }, true);

  function exportJson() {
    getAllAnnotations().then(function (items) {
      if (!items.length) { toast(T.exportEmpty); return; }
      var payload = JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), annotations: items }, null, 2);
      var blob = new Blob([payload], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a");
      var day = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = "aris-notes-" + day + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    });
  }

  panelUi.panel.querySelector('input[type="file"]').addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result || ""));
        var items = Array.isArray(data) ? data : data.annotations;
        if (!Array.isArray(items)) throw new Error("bad format");
        var valid = items.filter(function (a) {
          return a && a.id && a.sourcePath && (typeof a.exact === "string" || (Array.isArray(a.segments) && a.segments.length));
        });
        tx("readwrite", function (s) { valid.forEach(function (a) { s.put(a); }); })
          .then(function () { toast(T.importDone); location.reload(); });
      } catch (_) { toast(T.importBad); }
      e.target.value = "";
    };
    reader.onerror = function () { toast(T.importBad); };
    reader.readAsText(file);
  });

  function tagMathFromMathJax() {
    try {
      if (!window.MathJax || !MathJax.startup || !MathJax.startup.document) return;
      var doc = MathJax.startup.document;
      if (typeof doc.getMathItemsWithin !== "function") return;
      doc.getMathItemsWithin(main).forEach(function (item) {
        var root = item.typesetRoot;
        if (!root) return;
        root.dataset.arisTex = item.math || "";
        root.dataset.arisMathDisplay = item.display ? "block" : "inline";
      });
    } catch (_) {}
  }

  function mathReady() {
    return new Promise(function (resolve) {
      var tries = 0;
      function waitForStartup() {
        tries += 1;
        if (window.MathJax && MathJax.startup && MathJax.startup.promise && typeof MathJax.startup.promise.then === "function") {
          MathJax.startup.promise.then(function () { tagMathFromMathJax(); resolve(); }).catch(function () { resolve(); });
          return;
        }
        if (tries >= 60) { tagMathFromMathJax(); resolve(); return; }
        setTimeout(waitForStartup, 50);
      }
      waitForStartup();
    });
  }

  injectStyles();
  mathReady().then(restoreAll);
})();
