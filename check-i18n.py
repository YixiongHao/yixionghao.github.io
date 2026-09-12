#!/usr/bin/env python3
"""Bilingual parity check for the site's HTML pages.

Convention (see CLAUDE.md > Bilingual content): inside <main>, every element
tagged lang="en" must be immediately followed by a sibling of the same tag
tagged lang="zh", and every lang="zh" element must be immediately preceded by
its lang="en" twin. Elements without a lang attribute are shared.

Two kinds of problem are reported:
  1. structural  - an en/zh pair is missing, mis-ordered, nested, or mistagged
  2. stale       - the English text of a block changed since its Chinese twin
                   was last confirmed (fingerprints live in i18n-state.json)

Usage:
  python check-i18n.py            check every page (exit 1 on any problem)
  python check-i18n.py --accept   after updating the Chinese: re-record the
                                  fingerprints of all English blocks as confirmed
  python check-i18n.py --hook     Claude Code PostToolUse mode (reads the tool
                                  call JSON on stdin; exit 2 + stderr on failure)
"""
import glob
import hashlib
import json
import os
import re
import sys
from html.parser import HTMLParser

# Windows consoles/pipes default to a legacy code page; report in UTF-8 so
# Chinese snippets and punctuation never raise UnicodeEncodeError.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}
HERE = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(HERE, "i18n-state.json")


class Node:
    __slots__ = ("tag", "attrs", "children", "line", "parent", "text")

    def __init__(self, tag, attrs, line, parent):
        self.tag = tag
        self.attrs = dict(attrs)
        self.children = []
        self.line = line
        self.parent = parent
        self.text = []


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__()
        self.root = Node("#root", [], 0, None)
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.getpos()[0], self.cur)
        self.cur.children.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.getpos()[0], self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not None and n.tag != tag:
            n = n.parent
        if n is not None and n.parent is not None:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.text.append(data)


def find(node, tag):
    if node.tag == tag:
        return node
    for c in node.children:
        r = find(c, tag)
        if r:
            return r
    return None


def walk(node):
    yield node
    for c in node.children:
        yield from walk(c)


def text_of(node):
    """Visible text of a block, whitespace-collapsed (markup/hrefs ignored)."""
    parts = []
    for n in walk(node):
        parts.extend(n.text)
    return re.sub(r"\s+", " ", "".join(parts)).strip()


def fingerprint(node):
    return hashlib.sha1(text_of(node).encode("utf-8")).hexdigest()[:16]


def page_files():
    files = sorted(glob.glob(os.path.join(HERE, "**", "index.html"), recursive=True))
    return [f for f in files if "resume" not in f.replace("\\", "/").split("/")]


def rel(path):
    return os.path.relpath(path, HERE).replace("\\", "/")


def load_state():
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def parse(path):
    with open(path, encoding="utf-8") as f:
        src = f.read()
    tb = TreeBuilder()
    tb.feed(src)
    return src, tb.root


def en_blocks(main):
    return [n for n in walk(main) if n.attrs.get("lang") == "en"]


def check_file(path, state=None):
    src, root = parse(path)
    problems = []

    if 'lang.js"' not in src:
        problems.append('missing <script src="…lang.js"> in <head>')
    if 'class="lang-rail"' not in src:
        problems.append('missing the language toggle (<div class="lang-rail">)')

    main = find(root, "main")
    if main is None:
        problems.append("no <main> element")
        return problems

    for node in walk(main):
        kids = node.children
        for i, k in enumerate(kids):
            lang = k.attrs.get("lang")
            if lang is None:
                continue
            if lang not in ("en", "zh"):
                problems.append(f'line {k.line}: <{k.tag}> has lang="{lang}" (expected en or zh)')
                continue
            if lang == "en":
                nxt = kids[i + 1] if i + 1 < len(kids) else None
                if nxt is None or nxt.tag != k.tag or nxt.attrs.get("lang") != "zh":
                    problems.append(
                        f'line {k.line}: <{k.tag} lang="en"> has no matching '
                        f'<{k.tag} lang="zh"> immediately after it (Chinese translation missing?)')
            else:
                prv = kids[i - 1] if i > 0 else None
                if prv is None or prv.tag != k.tag or prv.attrs.get("lang") != "en":
                    problems.append(
                        f'line {k.line}: <{k.tag} lang="zh"> has no matching '
                        f'<{k.tag} lang="en"> immediately before it (stale translation?)')
            for inner in walk(k):
                if inner is not k and inner.attrs.get("lang"):
                    problems.append(
                        f'line {inner.line}: <{inner.tag} lang="{inner.attrs["lang"]}"> is nested '
                        f'inside <{k.tag} lang="{lang}"> (line {k.line}); pairs must not nest')

    # Stale check: English text changed since its Chinese twin was confirmed.
    if state is not None:
        accepted = set(state.get(rel(path), []))
        if accepted:
            for k in en_blocks(main):
                if fingerprint(k) not in accepted:
                    snippet = text_of(k)
                    if len(snippet) > 70:
                        snippet = snippet[:67] + "..."
                    problems.append(
                        f'line {k.line}: English text changed since its Chinese twin was confirmed: '
                        f'"{snippet}" - update the lang="zh" block below it, then run '
                        f'`python check-i18n.py --accept`')
    return problems


def run_all(files, state):
    """Returns {relpath: [problems]} for files with problems."""
    out = {}
    for f in files:
        p = check_file(f, state)
        if p:
            out[rel(f)] = p
    return out


def accept():
    files = page_files()
    structural = run_all(files, None)
    if structural:
        print("[i18n] Cannot accept: fix structural problems first.")
        for f, ps in structural.items():
            print(f"  {f}:")
            for p in ps:
                print(f"    - {p}")
        return 1
    state = {}
    for f in files:
        _, root = parse(f)
        main = find(root, "main")
        state[rel(f)] = sorted({fingerprint(k) for k in en_blocks(main)})
    with open(STATE_FILE, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(state, fh, indent=2)
        fh.write("\n")
    total = sum(len(v) for v in state.values())
    print(f"[i18n] Recorded {total} confirmed English blocks across {len(state)} pages -> {os.path.basename(STATE_FILE)}")
    return 0


def hook_mode():
    """Claude Code PostToolUse hook: reads the tool call JSON on stdin. Runs
    the full check only when an .html file was written; on failure prints the
    problems to stderr and exits 2 so they are fed back to Claude."""
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    f = (payload.get("tool_input") or {}).get("file_path") or \
        (payload.get("tool_response") or {}).get("filePath") or ""
    if not f.lower().endswith(".html"):
        return 0
    results = run_all(page_files(), load_state())
    if results:
        sys.stderr.write("[i18n] Bilingual parity check FAILED. Every translatable block needs an "
                         "adjacent lang=\"en\" / lang=\"zh\" pair, and a changed English block needs "
                         "its Chinese updated + `python check-i18n.py --accept` "
                         "(see CLAUDE.md > Bilingual content).\n")
        for file, ps in results.items():
            sys.stderr.write(f"{file}:\n")
            for p in ps:
                sys.stderr.write(f"  - {p}\n")
        return 2
    return 0


def main():
    args = sys.argv[1:]
    if "--hook" in args:
        sys.exit(hook_mode())
    if "--accept" in args:
        sys.exit(accept())
    files = [a for a in args if a.lower().endswith(".html")] or page_files()
    state = load_state()
    failed = False
    for f in files:
        problems = check_file(f, state)
        if problems:
            failed = True
            print(f"[i18n] {rel(f)}: {len(problems)} problem(s)")
            for p in problems:
                print(f"  - {p}")
        else:
            print(f"[i18n] {rel(f)}: ok")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
