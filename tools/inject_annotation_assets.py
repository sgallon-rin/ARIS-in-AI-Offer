#!/usr/bin/env python3
"""Inject ARIS local annotation support into a Pages artifact tree.

This intentionally mutates only the deployment copy of rendered HTML. The
canonical Markdown and committed generated HTML remain unchanged. The injected
script is inline so each deployed tutorial is still self-contained and can be
saved as a single HTML file.
"""
from __future__ import annotations

import argparse
from pathlib import Path

MARKER = "<!-- ARIS local annotations -->"


def inject(html: str, script: str) -> tuple[str, bool]:
    if MARKER in html:
        return html, False
    payload = f"\n{MARKER}\n<script>\n{script.rstrip()}\n</script>\n"
    idx = html.lower().rfind("</body>")
    if idx >= 0:
        return html[:idx] + payload + html[idx:], True
    return html + payload, True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path, help="Pages artifact root, usually docs/")
    parser.add_argument("--script", type=Path, required=True, help="annotation JavaScript source")
    args = parser.parse_args()

    script = args.script.read_text(encoding="utf-8")
    changed = 0
    scanned = 0
    for path in sorted(args.root.rglob("*.html")):
        if path.name.endswith(".bak"):
            continue
        scanned += 1
        original = path.read_text(encoding="utf-8")
        updated, did_change = inject(original, script)
        if did_change:
            path.write_text(updated, encoding="utf-8")
            changed += 1

    print(f"ARIS annotations: injected {changed}/{scanned} HTML files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
