# Resume (LaTeX)

`resume.tex` is the source of truth. It's a faithful port of the original Word
resume: same content, same one-page layout, same hyperlinks.

Requires **XeLaTeX** (not pdflatex) because it uses the system Calibri font,
which is what the original document used. MiKTeX is already installed at
`~/AppData/Local/Programs/MiKTeX/miktex/bin/x64/`.

## Build once

```powershell
cd resume
xelatex resume.tex
```

Output: `resume/resume.pdf`. One run is enough — this document has no
cross-references, bibliography, or table of contents, so there is nothing that
needs a second pass to resolve.

**Do not use `latexmk` unless you have read the Perl note below.** `latexmk` is
a Perl script and MiKTeX does not ship Perl, so it fails with
"MiKTeX could not find the script engine 'perl'". Plain `xelatex` needs no Perl.

## Live preview while editing

**1. VS Code + LaTeX Workshop (recommended)** — install the "LaTeX Workshop"
extension. Its default recipe calls `latexmk`, which will fail here, so add a
xelatex-only recipe to your VS Code `settings.json`:

```json
"latex-workshop.latex.tools": [
  {
    "name": "xelatex",
    "command": "xelatex",
    "args": ["-synctex=1", "-interaction=nonstopmode", "-file-line-error", "%DOC%"]
  }
],
"latex-workshop.latex.recipes": [
  { "name": "xelatex", "tools": ["xelatex"] }
]
```

Open `resume.tex`, press `Ctrl+Alt+V` for the side-by-side preview. It rebuilds
and refreshes on every save. `Ctrl+Alt+J` jumps from the cursor to the matching
spot in the PDF.

If the preview looks stale after a rebuild, close the PDF tab and reopen it with
`Ctrl+Alt+V` — the preview pane caches renders and its refresh button does not
always evict them.

**2. Terminal watch mode** — needs Perl; see below. Rebuilds on every save:

```powershell
latexmk -xelatex -pvc resume.tex
```

`-pvc` ("preview continuously") watches the file and recompiles on save. Keep
the PDF open in a viewer that auto-reloads (SumatraPDF does; Adobe Acrobat locks
the file, which makes the rebuild fail to overwrite it).

## Perl, if you want `latexmk`

Git for Windows already bundles Perl at `C:\Program Files\Git\usr\bin\perl.exe`,
it is just not on the PowerShell PATH. Prepend it for the current session only:

```powershell
$env:PATH += ";C:\Program Files\Git\usr\bin"
latexmk -xelatex resume.tex
```

Keep this session-scoped rather than making it permanent — that directory holds
Unix builds of `find`, `sort`, and friends that would shadow the Windows ones
system-wide. For a permanent setup, install
[Strawberry Perl](https://strawberryperl.com/) instead, which puts only Perl on
the PATH.

Or run the build from Git Bash, where Perl is already on the PATH and `latexmk`
works with no setup.

**3. Overleaf** — upload `resume.tex`, set Menu → Compiler to **XeLaTeX**.
Calibri won't exist on Overleaf's servers, so add `[BoldFont=..., ...]`
substitutes or swap `\setmainfont{Calibri}` for `\setmainfont{Carlito}`
(a metric-compatible clone that Overleaf has).

## Publishing to the site

`index.html` links to `Yixiong Hao - resume.pdf` in the repo root. After a
rebuild, copy the new PDF over it:

```bash
cp resume/resume.pdf "Yixiong Hao - resume.pdf"
```

## Editing notes

- Section content uses three macros defined at the top of `resume.tex`:
  `\role{title}{org}{url}{dates}`, `\paper{title}{url}{venue}`, and
  `\entry{left}{right}` for anything else with a right-aligned date.
- Bullets go inside `\begin{items} ... \end{items}`.
- If added content spills onto a second page, lower the `Scale=0.98` on the
  `\setmainfont` line, or `\linespread{0.94}`, in small steps.
