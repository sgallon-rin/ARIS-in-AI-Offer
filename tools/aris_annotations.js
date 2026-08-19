(function () {
  "use strict";

  var sourceMeta = document.querySelector('meta[name="aris:source-path"]');
  if (!sourceMeta || !document.querySelector("main")) return;

  var SOURCE_PATH = sourceMeta.getAttribute("content") || location.pathname;
  var hashMeta = document.querySelector('meta[name="aris:source-sha256"]');
  var SOURCE_HASH = hashMeta ? (hashMeta.getAttribute("content") || "") : "";
  var main = document.querySelector("main");
  var lang = (document.documentElement.lang || "zh").toLowerCase();
  var isZh = lang.indexOf("zh") === 0;

  var T = isZh ? {
    highlight: "高亮", note: "添加笔记", notes: "笔记", save: "保存", cancel: "取消",
    edit: "编辑", remove: "删除", export: "导出 JSON", import: "导入 JSON", clearPage: "清空本页",
    empty: "本页还没有笔记。选中文字即可添加高亮或笔记。", notePlaceholder: "写下你的笔记…",
    oldRevision: "旧版本", unresolved: "未定位", importDone: "已导入笔记", importBad: "无法读取该笔记文件",
    clearConfirm: "删除本页全部高亮和笔记？", selectionBad: "请在同一段落/列表项/表格单元中选择文字。",
    overlap: "所选文字与已有高亮重叠。", storageError: "浏览器无法保存笔记。", exportEmpty: "没有可导出的笔记。",
    close: "关闭"
  } : {
    highlight: "Highlight", note: "Add note", notes: "Notes", save: "Save", cancel: "Cancel",
    edit: "Edit", remove: "Delete", export: "Export JSON", import: "Import JSON", clearPage: "Clear page",
    empty: "No notes on this page yet. Select text to add a highlight or note.", notePlaceholder: "Write a note…",
    oldRevision: "Old revision", unresolved: "Unresolved", importDone: "Notes imported", importBad: "Could not read that notes file",
    clearConfirm: "Delete all highlights and notes on this page?",
    selectionBad: "Select text within one paragraph, list item, heading, or table cell.", overlap: "This selection overlaps an existing highlight.",
    storageError: "The browser could not save notes.", exportEmpty: "There are no notes to export.", close: "Close"
  };

  var STYLE_ID = "aris-annotations-style";
  var TOOLBAR_ID = "aris-annotation-toolbar";
  var PANEL_ID = "aris-annotation-panel";
  var EDITOR_ID = "aris-annotation-editor";
  var DB_NAME = "aris-annotations";
  var DB_VERSION = 1;
  var STORE = "annotations";
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
      "@media print{#" + TOOLBAR_ID + ",#" + PANEL_ID + ",#" + EDITOR_ID + ",.aris-notes-toggle,.aris-toast{display:none!important}.aris-annotation-highlight{background:transparent!important;border-bottom:1px dotted #999!important}}"
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
        req.onsuccess = function () { resolve((req.result || []).sort(function (a, b) { return (a.createdAt || "").localeCompare(b.createdAt || ""); })); };
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
    var el = document.createElement("div"); el.className = "aris-toast"; el.textContent = msg; document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1700);
  }

  function allowedBlock(node) {
    var el = node && (node.nodeType === 1 ? node : node.parentElement);
    return el ? el.closest("p,li,td,th,blockquote,h2,h3,h4,summary,figcaption") : null;
  }

  function rangeIsUsable(range) {
    if (!range || range.collapsed) return false;
    var startBlock = allowedBlock(range.startContainer), endBlock = allowedBlock(range.endContainer);
    if (!startBlock || startBlock !== endBlock || !main.contains(startBlock)) return false;
    if (startBlock.closest("pre,code,mjx-container")) return false;
    if (startBlock.closest("#" + PANEL_ID + ",#" + EDITOR_ID + ",#" + TOOLBAR_ID)) return false;
    return range.toString().trim().length > 0;
  }

  function nearestSectionId(block) {
    var headings = [].slice.call(main.querySelectorAll("h2[id],h3[id]")), last = "";
    headings.forEach(function (h) {
      if (h === block || (h.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING)) last = h.id;
    });
    return last;
  }

  function textNodes(block) {
    var out = [], walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || p.closest("script,style,#" + PANEL_ID + ",#" + EDITOR_ID + ",#" + TOOLBAR_ID)) return NodeFilter.FILTER_REJECT;
        return n.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }), n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function blockText(block) { return textNodes(block).map(function (n) { return n.nodeValue; }).join(""); }

  function offsetWithinBlock(block, container, offset) {
    var nodes = textNodes(block), total = 0;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n === container) return total + offset;
      if (container.nodeType === 1 && container.contains(n)) {
        var r = document.createRange(); r.setStart(block, 0); r.setEnd(container, Math.min(offset, container.childNodes.length)); return r.toString().length;
      }
      total += n.nodeValue.length;
    }
    return -1;
  }

  function anchorFromRange(range) {
    var block = allowedBlock(range.startContainer), full = blockText(block);
    var start = offsetWithinBlock(block, range.startContainer, range.startOffset), end = offsetWithinBlock(block, range.endContainer, range.endOffset);
    if (start < 0 || end <= start) return null;
    var exact = full.slice(start, end); if (!exact.trim()) return null;
    return { exact: exact, prefix: full.slice(Math.max(0, start - 48), start), suffix: full.slice(end, Math.min(full.length, end + 48)), blockHint: full.slice(0, 120), sectionId: nearestSectionId(block), blockTag: block.tagName.toLowerCase() };
  }

  function candidateBlocks(a) {
    if (a.sectionId) {
      var h = document.getElementById(a.sectionId);
      if (h && main.contains(h)) {
        var found = [], cur = h, stopAtH3 = h.tagName === "H3";
        while (cur) {
          if (cur !== h && (cur.tagName === "H2" || (stopAtH3 && cur.tagName === "H3"))) break;
          if (cur.matches && cur.matches("p,li,td,th,blockquote,h2,h3,h4,summary,figcaption")) found.push(cur);
          if (cur.querySelectorAll) found = found.concat([].slice.call(cur.querySelectorAll("p,li,td,th,blockquote,h2,h3,h4,summary,figcaption")));
          cur = cur.nextElementSibling;
        }
        if (found.length) return found;
      }
    }
    return [].slice.call(main.querySelectorAll("p,li,td,th,blockquote,h2,h3,h4,summary,figcaption"));
  }

  function scoreCandidate(text, idx, a) {
    var score = 0;
    if (a.prefix) { var before = text.slice(Math.max(0, idx - a.prefix.length), idx), p = a.prefix.slice(-Math.min(a.prefix.length, before.length)); if (before.slice(-p.length) === p) score += 4; }
    if (a.suffix) { var after = text.slice(idx + a.exact.length, idx + a.exact.length + a.suffix.length), s = a.suffix.slice(0, Math.min(a.suffix.length, after.length)); if (after.slice(0, s.length) === s) score += 4; }
    if (a.blockHint && text.indexOf(a.blockHint.slice(0, 40)) === 0) score += 2;
    return score;
  }

  function findAnchor(a) {
    var blocks = candidateBlocks(a), best = null;
    blocks.forEach(function (block) {
      var text = blockText(block), from = 0;
      while (from <= text.length) {
        var idx = text.indexOf(a.exact, from); if (idx < 0) break;
        var score = scoreCandidate(text, idx, a);
        if (!best || score > best.score) best = { block: block, start: idx, end: idx + a.exact.length, score: score };
        from = idx + Math.max(1, a.exact.length);
      }
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
    var r = document.createRange(); r.setStart(startNode, startOffset); r.setEnd(endNode, endOffset); return r;
  }

  function overlapsExisting(range) {
    var marks = main.querySelectorAll("mark.aris-annotation-highlight");
    for (var i = 0; i < marks.length; i++) { try { if (range.intersectsNode(marks[i])) return true; } catch (_) {} }
    return false;
  }

  function wrapRange(range, a) {
    if (!range || range.collapsed || overlapsExisting(range)) return null;
    var mark = document.createElement("mark"); mark.className = "aris-annotation-highlight"; mark.dataset.annotationId = a.id; mark.dataset.hasNote = a.note ? "true" : "false";
    try { var frag = range.extractContents(); mark.appendChild(frag); range.insertNode(mark); return mark; } catch (_) { return null; }
  }

  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(String(s));
    return String(s).replace(/[^a-zA-Z0-9_-]/g, function (c) { return "\\" + c.charCodeAt(0).toString(16) + " "; });
  }

  function unwrapMark(id) {
    var mark = main.querySelector('mark.aris-annotation-highlight[data-annotation-id="' + cssEscape(id) + '"]');
    if (!mark) return;
    var parent = mark.parentNode; while (mark.firstChild) parent.insertBefore(mark.firstChild, mark); parent.removeChild(mark); parent.normalize();
  }

  function restoreOne(a) {
    if (main.querySelector('mark.aris-annotation-highlight[data-annotation-id="' + cssEscape(a.id) + '"]')) { restoreStatus.set(a.id, "ok"); return true; }
    var hit = findAnchor(a); if (!hit) { restoreStatus.set(a.id, "unresolved"); return false; }
    var r = rangeFromOffsets(hit.block, hit.start, hit.end); if (!r || overlapsExisting(r)) { restoreStatus.set(a.id, "unresolved"); return false; }
    var mark = wrapRange(r, a); restoreStatus.set(a.id, mark ? "ok" : "unresolved"); return !!mark;
  }

  function restoreAll() {
    return getPageAnnotations().then(function (items) { restoreStatus.clear(); items.forEach(restoreOne); updateCount(items.length); if (panelOpen) renderPanel(items); return items; })
      .catch(function () { toast(T.storageError); return []; });
  }

  function selectionToolbar() {
    var bar = document.createElement("div"); bar.id = TOOLBAR_ID; bar.hidden = true;
    bar.innerHTML = '<button type="button" data-action="highlight">🟨 ' + T.highlight + '</button><button type="button" data-action="note">✎ ' + T.note + '</button>';
    document.body.appendChild(bar); bar.addEventListener("mousedown", function (e) { e.preventDefault(); });
    bar.addEventListener("click", function (e) { var btn = e.target.closest("button[data-action]"); if (!btn || !currentRange) return; if (btn.dataset.action === "highlight") createFromCurrent(""); else openEditorForSelection(); });
    return bar;
  }

  var toolbar = selectionToolbar();
  function hideToolbar() { toolbar.hidden = true; }

  function updateToolbarFromSelection() {
    var sel = window.getSelection(); if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { hideToolbar(); return; }
    var r = sel.getRangeAt(0); if (!rangeIsUsable(r)) { hideToolbar(); return; }
    currentRange = r.cloneRange(); var rect = r.getBoundingClientRect(); toolbar.hidden = false;
    var w = toolbar.offsetWidth || 160, h = toolbar.offsetHeight || 36;
    var left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left + rect.width / 2 - w / 2));
    var top = rect.top - h - 8; if (top < 8) top = Math.min(window.innerHeight - h - 8, rect.bottom + 8);
    toolbar.style.left = left + "px"; toolbar.style.top = top + "px";
  }

  document.addEventListener("selectionchange", function () { setTimeout(updateToolbarFromSelection, 0); });
  window.addEventListener("scroll", hideToolbar, { passive: true });

  function annotationFromRange(range, note) {
    var anchor = anchorFromRange(range); if (!anchor) return null;
    return { id: uuid(), sourcePath: SOURCE_PATH, sourceHash: SOURCE_HASH, exact: anchor.exact, prefix: anchor.prefix, suffix: anchor.suffix, blockHint: anchor.blockHint, sectionId: anchor.sectionId, blockTag: anchor.blockTag, note: note || "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }

  function createFromCurrent(note) {
    var r = currentRange && currentRange.cloneRange(); hideToolbar();
    if (!rangeIsUsable(r)) { toast(T.selectionBad); return; }
    if (overlapsExisting(r)) { toast(T.overlap); return; }
    var a = annotationFromRange(r, note); if (!a) { toast(T.selectionBad); return; }
    putAnnotation(a).then(function () { wrapRange(r, a); currentRange = null; var sel = window.getSelection(); if (sel) sel.removeAllRanges(); return refreshPanel(); })
      .catch(function () { toast(T.storageError); });
  }

  function editorHost() {
    var editor = document.createElement("div"); editor.id = EDITOR_ID; editor.hidden = true;
    editor.innerHTML = '<textarea placeholder="' + T.notePlaceholder.replace(/"/g, "&quot;") + '"></textarea><div class="aris-editor-actions"><button type="button" data-action="cancel">' + T.cancel + '</button><button type="button" class="primary" data-action="save">' + T.save + '</button></div>';
    document.body.appendChild(editor); return editor;
  }

  var editor = editorHost(), editorMode = null, editorAnnotationId = null;

  function placeEditor(rect) {
    editor.hidden = false; var w = editor.offsetWidth || 400, h = editor.offsetHeight || 160;
    var left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left)), top = rect.bottom + 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 8);
    editor.style.left = left + "px"; editor.style.top = top + "px";
  }

  function openEditorForSelection() {
    var r = currentRange && currentRange.cloneRange(); hideToolbar();
    if (!rangeIsUsable(r)) { toast(T.selectionBad); return; }
    if (overlapsExisting(r)) { toast(T.overlap); return; }
    editorMode = "create"; editorAnnotationId = null; editor.querySelector("textarea").value = ""; placeEditor(r.getBoundingClientRect());
    setTimeout(function () { editor.querySelector("textarea").focus(); }, 0);
  }

  function openEditorForExisting(a, mark) {
    editorMode = "edit"; editorAnnotationId = a.id; editor.querySelector("textarea").value = a.note || ""; placeEditor(mark.getBoundingClientRect());
    setTimeout(function () { editor.querySelector("textarea").focus(); }, 0);
  }

  function closeEditor() { editor.hidden = true; editorMode = null; editorAnnotationId = null; }

  editor.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-action]"); if (!btn) return;
    if (btn.dataset.action === "cancel") { closeEditor(); return; }
    var value = editor.querySelector("textarea").value.trim();
    if (editorMode === "create") { closeEditor(); createFromCurrent(value); }
    else if (editorMode === "edit" && editorAnnotationId) {
      var id = editorAnnotationId;
      getPageAnnotations().then(function (items) {
        var a = items.find(function (x) { return x.id === id; }); if (!a) return;
        a.note = value; a.updatedAt = new Date().toISOString();
        return putAnnotation(a).then(function () { var mark = main.querySelector('mark.aris-annotation-highlight[data-annotation-id="' + cssEscape(id) + '"]'); if (mark) mark.dataset.hasNote = value ? "true" : "false"; closeEditor(); return refreshPanel(); });
      }).catch(function () { toast(T.storageError); });
    }
  });

  function panelHost() {
    var toggle = document.createElement("button"); toggle.className = "aris-notes-toggle"; toggle.type = "button"; toggle.textContent = "📝 0"; toggle.setAttribute("aria-label", T.notes); document.body.appendChild(toggle);
    var panel = document.createElement("aside"); panel.id = PANEL_ID; panel.hidden = true;
    panel.innerHTML = '<div class="aris-notes-head"><strong>' + T.notes + '</strong><button class="aris-notes-close" type="button" aria-label="' + T.close + '">×</button></div><div class="aris-notes-list"></div><div class="aris-notes-tools"><button type="button" data-action="export">' + T.export + '</button><button type="button" data-action="import">' + T.import + '</button><button type="button" data-action="clear">' + T.clearPage + '</button><input type="file" accept="application/json,.json" hidden></div>';
    document.body.appendChild(panel);
    toggle.addEventListener("click", function () { panelOpen = !panelOpen; panel.hidden = !panelOpen; toggle.classList.toggle("aris-panel-open", panelOpen); if (panelOpen) refreshPanel(); });
    panel.querySelector(".aris-notes-close").addEventListener("click", function () { panelOpen = false; panel.hidden = true; toggle.classList.remove("aris-panel-open"); });
    return { toggle: toggle, panel: panel };
  }

  var panelUi = panelHost();
  function updateCount(n) { panelUi.toggle.textContent = "📝 " + n; }
  function formatDate(s) { if (!s) return ""; try { return new Date(s).toLocaleDateString(); } catch (_) { return ""; } }
  function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]; }); }

  function renderPanel(items) {
    updateCount(items.length); var list = panelUi.panel.querySelector(".aris-notes-list");
    if (!items.length) { list.innerHTML = '<div class="aris-notes-empty">' + T.empty + '</div>'; return; }
    list.innerHTML = items.map(function (a) {
      var old = SOURCE_HASH && a.sourceHash && a.sourceHash !== SOURCE_HASH, unresolved = restoreStatus.get(a.id) === "unresolved";
      return '<div class="aris-note-card" data-id="' + escapeHtml(a.id) + '"><div class="aris-note-quote" title="' + escapeHtml(a.exact) + '">“' + escapeHtml(a.exact) + '”</div>' +
        (a.note ? '<div class="aris-note-text">' + escapeHtml(a.note) + '</div>' : '') + '<div class="aris-note-meta">' +
        (formatDate(a.updatedAt || a.createdAt) ? '<span>' + escapeHtml(formatDate(a.updatedAt || a.createdAt)) + '</span>' : '') +
        (old ? '<span class="aris-badge">' + T.oldRevision + '</span>' : '') + (unresolved ? '<span class="aris-badge">' + T.unresolved + '</span>' : '') +
        '</div><div class="aris-note-actions"><button type="button" data-action="edit">' + T.edit + '</button><button type="button" data-action="delete">' + T.remove + '</button></div></div>';
    }).join("");
  }

  function refreshPanel() { return getPageAnnotations().then(function (items) { renderPanel(items); return items; }); }

  function scrollToAnnotation(id) {
    var mark = main.querySelector('mark.aris-annotation-highlight[data-annotation-id="' + cssEscape(id) + '"]'); if (!mark) return;
    mark.scrollIntoView({ behavior: "smooth", block: "center" }); var old = mark.style.outline; mark.style.outline = "2px solid var(--accent,#b8390e)";
    setTimeout(function () { mark.style.outline = old; }, 1000);
  }

  panelUi.panel.addEventListener("click", function (e) {
    var card = e.target.closest(".aris-note-card"); if (card && e.target.closest(".aris-note-quote")) { scrollToAnnotation(card.dataset.id); return; }
    var btn = e.target.closest("button[data-action]"); if (!btn) return; var action = btn.dataset.action;
    if (action === "export") { exportJson(); return; }
    if (action === "import") { panelUi.panel.querySelector('input[type="file"]').click(); return; }
    if (action === "clear") {
      if (!window.confirm(T.clearConfirm)) return;
      clearPageAnnotations().then(function () {
        [].slice.call(main.querySelectorAll("mark.aris-annotation-highlight")).forEach(function (m) { var p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize(); });
        restoreStatus.clear(); return refreshPanel();
      });
      return;
    }
    if (!card) return; var id = card.dataset.id;
    if (action === "delete") deleteAnnotation(id).then(function () { unwrapMark(id); restoreStatus.delete(id); return refreshPanel(); });
    else if (action === "edit") getPageAnnotations().then(function (items) { var a = items.find(function (x) { return x.id === id; }); if (!a) return; var mark = main.querySelector('mark.aris-annotation-highlight[data-annotation-id="' + cssEscape(id) + '"]'); if (mark) openEditorForExisting(a, mark); });
  });

  main.addEventListener("click", function (e) {
    var mark = e.target.closest("mark.aris-annotation-highlight"); if (!mark) return; var id = mark.dataset.annotationId;
    getPageAnnotations().then(function (items) { var a = items.find(function (x) { return x.id === id; }); if (!a) return; if (a.note) openEditorForExisting(a, mark); else { panelOpen = true; panelUi.panel.hidden = false; panelUi.toggle.classList.add("aris-panel-open"); renderPanel(items); } });
  });

  function exportJson() {
    getAllAnnotations().then(function (items) {
      if (!items.length) { toast(T.exportEmpty); return; }
      var payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), annotations: items }, null, 2), blob = new Blob([payload], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a"), day = new Date().toISOString().slice(0, 10);
      a.href = url; a.download = "aris-notes-" + day + ".json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    });
  }

  panelUi.panel.querySelector('input[type="file"]').addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0]; if (!file) return; var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result || "")), items = Array.isArray(data) ? data : data.annotations; if (!Array.isArray(items)) throw new Error("bad format");
        var valid = items.filter(function (a) { return a && a.id && a.sourcePath && typeof a.exact === "string"; });
        tx("readwrite", function (s) { valid.forEach(function (a) { s.put(a); }); }).then(function () { toast(T.importDone); location.reload(); });
      } catch (_) { toast(T.importBad); }
      e.target.value = "";
    };
    reader.onerror = function () { toast(T.importBad); }; reader.readAsText(file);
  });

  injectStyles();
  restoreAll();
})();
