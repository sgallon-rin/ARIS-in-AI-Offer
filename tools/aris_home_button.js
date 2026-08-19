(function () {
  "use strict";

  var sourceMeta = document.querySelector('meta[name="aris:source-path"]');
  if (!sourceMeta || !document.querySelector("main")) return;
  if (document.querySelector(".aris-home-button")) return;

  var lang = (document.documentElement.lang || "zh").toLowerCase();
  var label = lang.indexOf("zh") === 0 ? "首页" : "Home";

  function homeHref() {
    var path = location.pathname;
    var markers = ["/tutorials/", "/blogs/"];
    for (var i = 0; i < markers.length; i++) {
      var idx = path.indexOf(markers[i]);
      if (idx >= 0) return location.origin + path.slice(0, idx + 1);
    }
    var slash = path.lastIndexOf("/");
    return location.origin + (slash >= 0 ? path.slice(0, slash + 1) : "/");
  }

  var style = document.createElement("style");
  style.id = "aris-home-button-style";
  style.textContent = [
    ".aris-home-button{position:fixed;right:16px;top:16px;z-index:1200;display:inline-flex;align-items:center;gap:5px;border:1px solid var(--border,#d6d0c0);background:var(--bg,#fdfcf7);color:var(--ink-soft,#4a4a4a);border-radius:18px;padding:6px 11px;text-decoration:none;font:13px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.06)}",
    ".aris-home-button:hover{color:var(--primary,#1a4a8c);border-color:var(--primary,#1a4a8c);text-decoration:none}",
    ".aris-home-button:focus-visible{outline:2px solid var(--primary,#1a4a8c);outline-offset:2px}",
    "@media(max-width:900px){.aris-home-button{top:12px;right:12px;padding:7px 10px}.aris-home-button .aris-home-label{display:none}}",
    "@media print{.aris-home-button{display:none!important}}"
  ].join("\n");
  document.head.appendChild(style);

  var link = document.createElement("a");
  link.className = "aris-home-button";
  link.href = homeHref();
  link.setAttribute("aria-label", label);
  link.title = label;
  link.innerHTML = '<span aria-hidden="true">⌂</span><span class="aris-home-label">' + label + '</span>';
  document.body.appendChild(link);
})();
