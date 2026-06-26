#!/usr/bin/env python3
"""Render a Markdown doc to a styled PDF.

The repo has no markdown->PDF toolchain (PDFs were hand-rendered from HTML), so
this is a small, dependency-light generator for the docs/*.md files.

Deps (pure-Python, no system libraries needed):
    pip install markdown xhtml2pdf

Usage:
    python3 scripts/render_doc_pdf.py docs/copilot-command-guide.md docs/copilot-command-guide.pdf

xhtml2pdf (pisa) is used rather than weasyprint because weasyprint needs system
libs (pango/cairo) that are not installed here; xhtml2pdf is pure Python and
renders tables + code blocks acceptably with the CSS below.
"""
import sys
import markdown
from xhtml2pdf import pisa

# xhtml2pdf understands a conservative CSS subset — keep styling simple + explicit.
CSS = """
@page { size: A4; margin: 1.8cm 1.6cm; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; line-height: 1.45; }
h1 { font-size: 20pt; color: #0b1f3a; border-bottom: 2px solid #4DA2FF; padding-bottom: 4px; margin-top: 4px; }
h2 { font-size: 15pt; color: #0b1f3a; border-bottom: 1px solid #d0d7de; padding-bottom: 3px; margin-top: 18px; }
h3 { font-size: 12.5pt; color: #243b53; margin-top: 14px; }
h4 { font-size: 11pt; color: #243b53; }
p, li { font-size: 10.5pt; }
a { color: #2563eb; text-decoration: none; }
code { font-family: Courier, monospace; font-size: 9pt; background: #f0f3f7; padding: 1px 3px; }
pre { background: #f6f8fa; border: 1px solid #e1e4e8; padding: 8px; font-family: Courier, monospace; font-size: 8.5pt; }
pre code { background: transparent; padding: 0; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; }
th { background: #eef2f7; border: 1px solid #cbd5e1; padding: 5px 7px; font-size: 8.8pt; text-align: left; }
td { border: 1px solid #cbd5e1; padding: 5px 7px; font-size: 8.8pt; vertical-align: top; }
blockquote { color: #475569; border-left: 3px solid #cbd5e1; padding-left: 10px; margin-left: 0; }
hr { border: none; border-top: 1px solid #d0d7de; }
"""

HTML_TEMPLATE = """<!doctype html><html><head><meta charset="utf-8">
<style>{css}</style></head><body>{body}</body></html>"""

# xhtml2pdf's built-in fonts are Latin-1 only — arrows/emoji/math glyphs render as
# wrong glyphs or boxes. Replace the ones our docs use with ASCII-safe equivalents.
GLYPH_SUBS = {
    "→": "->", "⇒": "=>", "➜": "->", "↔": "<->", "⇆": "<->",
    "≥": ">=", "≤": "<=", "≠": "!=", "×": "x",
    "•": "-", "·": "-", "—": "-", "–": "-",
    "✅": "[OK] ", "✔": "[OK] ", "☑": "[x] ",
    "⚠️": "[!] ", "⚠": "[!] ", "\U0001f512": "[gate] ",
    "✓": "[OK] ", "✗": "[x] ", "️": "",
    "≈": "~", "∞": "inf",
    # Box-drawing (ASCII flow/tree diagrams) — the core fonts render these as boxes.
    "─": "-", "│": "|", "┌": "+", "┐": "+", "└": "+", "┘": "+",
    "├": "+", "┤": "+", "┬": "+", "┴": "+", "┼": "+",
}

# Vietnamese diacritics → base letters. The core PDF fonts are Latin-1, so accented VN
# vowels render as boxes; docs are English with occasional VN connectors ("rồi", "tiếp theo")
# — transliterate them so the PDF stays readable (the markdown keeps the real diacritics).
_VN = {
    "àáảãạăằắẳẵặâầấẩẫậ": "a", "èéẻẽẹêềếểễệ": "e", "ìíỉĩị": "i",
    "òóỏõọôồốổỗộơờớởỡợ": "o", "ùúủũụưừứửữự": "u", "ỳýỷỹỵ": "y", "đ": "d",
}
for _src, _dst in _VN.items():
    for _c in _src:
        GLYPH_SUBS[_c] = _dst
        GLYPH_SUBS[_c.upper()] = _dst.upper()
# Strip remaining decorative emoji (anything outside the BMP / common pictograph blocks).
def _sanitize(text: str) -> str:
    for k, v in GLYPH_SUBS.items():
        text = text.replace(k, v)
    out = []
    for ch in text:
        o = ord(ch)
        # Drop emoji / pictographs / symbols that the core fonts can't render.
        if 0x1F000 <= o <= 0x1FAFF or 0x2600 <= o <= 0x27BF or 0x1F1E6 <= o <= 0x1F1FF:
            continue
        out.append(ch)
    return "".join(out)


def render(md_path: str, pdf_path: str) -> None:
    with open(md_path, "r", encoding="utf-8") as f:
        md_text = _sanitize(f.read())
    body = markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "toc", "sane_lists"],
    )
    html = HTML_TEMPLATE.format(css=CSS, body=body)
    with open(pdf_path, "wb") as out:
        result = pisa.CreatePDF(html, dest=out, encoding="utf-8")
    if result.err:
        raise SystemExit(f"PDF render failed for {md_path} ({result.err} errors)")
    print(f"  wrote {pdf_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: render_doc_pdf.py <input.md> <output.pdf>")
    render(sys.argv[1], sys.argv[2])
