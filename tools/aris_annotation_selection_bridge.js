(function () {
  "use strict";

  var main = document.querySelector("main");
  if (!main) return;

  var STYLE_ID = "aris-annotation-selection-bridge-style";
  var BRIDGE_CLASS = "aris-selection-bridge";
  var adjusting = false;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "main mjx-container[data-aris-tex]{-webkit-user-select:text!important;user-select:text!important}",
      "main mjx-container." + BRIDGE_CLASS + "{background:rgba(51,103,209,.24)!important;outline:1px solid rgba(51,103,209,.22);outline-offset:2px;border-radius:4px}",
      "main mjx-container[display=\"true\"]." + BRIDGE_CLASS + "{box-shadow:0 0 0 5px rgba(51,103,209,.08)}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function closestMath(node) {
    var el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el) return null;
    var math = el.closest('mjx-container[data-aris-tex]');
    return math && main.contains(math) ? math : null;
  }

  function clearPreview() {
    main.querySelectorAll("mjx-container." + BRIDGE_CLASS).forEach(function (math) {
      math.classList.remove(BRIDGE_CLASS);
    });
  }

  function previewRange(range) {
    clearPreview();
    if (!range || range.collapsed) return;
    main.querySelectorAll('mjx-container[data-aris-tex]').forEach(function (math) {
      try {
        if (range.intersectsNode(math)) math.classList.add(BRIDGE_CLASS);
      } catch (_) {}
    });
  }

  function snapRangeToWholeMath(range) {
    var startMath = closestMath(range.startContainer);
    var endMath = closestMath(range.endContainer);
    var changed = false;

    try {
      if (startMath) {
        range.setStartBefore(startMath);
        changed = true;
      }
      if (endMath) {
        range.setEndAfter(endMath);
        changed = true;
      }
    } catch (_) {
      return false;
    }
    return changed;
  }

  function normalizeSelection() {
    if (adjusting) return;
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      clearPreview();
      return;
    }

    var range = sel.getRangeAt(0).cloneRange();
    var common = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (!common || !main.contains(common)) {
      clearPreview();
      return;
    }

    var changed = snapRangeToWholeMath(range);
    if (changed) {
      adjusting = true;
      try {
        sel.removeAllRanges();
        sel.addRange(range);
      } finally {
        setTimeout(function () { adjusting = false; }, 0);
      }
    }
    previewRange(range);
  }

  document.addEventListener("selectionchange", function () {
    requestAnimationFrame(normalizeSelection);
  });
  document.addEventListener("pointerup", function () {
    requestAnimationFrame(normalizeSelection);
  }, true);
  window.addEventListener("blur", clearPreview);

  injectStyle();
})();
