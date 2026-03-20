# Convertze

Free file converter that runs **entirely in your browser** — no uploads, no accounts, no backend.

**Live:** [convertze.com](https://convertze.com) · **Source & contribute:** [github.com/harsh-m-10/convertze](https://github.com/harsh-m-10/convertze)

---

## What it does

### Images

| Tool | Description |
|------|-------------|
| **PNG / JPG / WebP** | Convert between raster formats (single or **batch**). |
| **Resize** | Set width/height with optional aspect ratio (**batch** supported). |
| **Compress** | Adjust quality (**batch** supported). |
| **SVG → PNG** | Rasterize SVG to PNG. |

### PDF

| Tool | Description |
|------|-------------|
| **Text / Markdown → PDF** | Turn `.txt` / `.md` into a simple PDF. |
| **HTML → PDF** | Render `.html` to PDF. |
| **Images → PDF** | Combine multiple JPG/PNG/WebP into one PDF. |
| **Merge PDFs** | Combine two or more PDFs into one file. |
| **PDF → JPG / PNG** | Export pages as images. |
| **PDF → Text** | Extract text to `.txt`. |

### Developer & data

| Tool | Description |
|------|-------------|
| **JSON → YAML** | Convert JSON to YAML. |
| **YAML → JSON** | Convert YAML to JSON. |
| **CSV → JSON** | Parse CSV (header row) to a JSON array of objects. |
| **JSON → CSV** | Array of objects → CSV (first object defines columns). |
| **JSON pretty-print** | Format JSON with indentation. |
| **JSON minify** | Compact JSON. |
| **Base64 encode** | File → Base64 text (`.txt` download). |
| **Base64 decode** | Base64 text file → binary download. |
| **Timestamp converter** | `.txt` with Unix time (10/13 digits) or date string → human-readable summary. |
| **SHA-256 hash** | File → SHA-256 hex (`.txt` download). |

### UX

- Light / dark theme (saved in the browser).
- Drag-and-drop or file picker.

---

## Tech stack

Single `index.html` with vanilla JavaScript. Libraries loaded from CDN:

- [Tailwind CSS](https://tailwindcss.com)
- [jsPDF](https://github.com/parallax/jsPDF)
- [pdf.js](https://mozilla.github.io/pdf.js/)
- [js-yaml](https://github.com/nodeca/js-yaml)
- [pdf-lib](https://github.com/Hopding/pdf-lib) (PDF merge)

---

## Run locally

```bash
git clone https://github.com/harsh-m-10/convertze.git
cd convertze
npx serve .
```

Open the URL shown (e.g. `http://localhost:3000`). Use a static server so file APIs behave reliably.

---

## Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/harsh-m-10/convertze).
