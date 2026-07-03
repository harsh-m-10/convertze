# Convertze

Free file, text & developer tools that run **entirely in your browser**. Your files never leave your device: no accounts, no backend.

**Live:** [convertze.com](https://convertze.com) · **Source & contribute:** [github.com/harsh-m-10/convertze](https://github.com/harsh-m-10/convertze)

---

## Tools

### Image tools (`/images`)
| Tool | URL |
|------|-----|
| Image Converter (PNG / JPG / WebP, batch + zip) | `/images/convert` |
| Image Resizer | `/images/resize` |
| Image Compressor (quality or target-KB mode) | `/images/compress` |
| Image Cropper (center) | `/images/crop` |
| Image Rotator | `/images/rotate` |
| Favicon Generator | `/images/favicon` |
| SVG to PNG | `/images/svg-to-png` |

### PDF tools (`/pdf`)
| Tool | URL |
|------|-----|
| Merge PDF (reorderable) | `/pdf/merge` |
| Split PDF (ranges, zip) | `/pdf/split` |
| Compress PDF | `/pdf/compress` |
| Images to PDF | `/pdf/images-to-pdf` |
| PDF to Images (JPG/PNG, zip) | `/pdf/pdf-to-images` |
| PDF to Text | `/pdf/pdf-to-text` |
| HTML to PDF | `/pdf/html-to-pdf` |
| Markdown to PDF | `/pdf/markdown-to-pdf` |

### Developer tools (`/dev`), textarea-first, live output
| Tool | URL |
|------|-----|
| JSON Formatter / Minifier | `/dev/json-formatter` |
| JSON to YAML | `/dev/json-yaml` |
| CSV to JSON | `/dev/csv-json` |
| Base64 (text + file) | `/dev/base64` |
| Hash (SHA-256, MD5; text + file) | `/dev/hash` |
| JWT Decoder | `/dev/jwt` |
| Timestamp Converter | `/dev/timestamp` |
| Text Diff | `/dev/diff` |
| Regex Tester | `/dev/regex` |
| Color Converter (HEX/RGB/HSL) | `/dev/color` |
| URL Encode / Decode | `/dev/url` |
| Markdown Preview | `/dev/markdown-preview` |

### UX
- Dark mode by default, light toggle (saved locally)
- Tool search in the header and on the homepage; "Recently used" on the homepage (localStorage)
- Dev tools: live output, copy-first actions, `Ctrl+Enter` to run, `Esc` to clear, shareable URL hash state
- Toast notifications, loading states, drag-and-drop everywhere
- Installable PWA with offline support (service worker + manifest)

---

## Structure

```
index.html                 # generated homepage
images|pdf|dev/            # generated hub + tool pages (<path>/index.html)
assets/site.css            # design system (dark default, light via html.light)
assets/app.js              # shell: theme, search, toasts, recent, shared helpers
assets/tools-image.js      # image tool implementations
assets/tools-pdf.js        # PDF tool implementations
assets/tools-dev.js        # dev tool implementations
data/tools.json            # single source of truth: metadata + SEO copy per tool
scripts/generate.js        # static page generator
sw.js, manifest.webmanifest, sitemap.xml, robots.txt, 404.html, vercel.json
```

**To add or edit a tool page:** edit `data/tools.json` (and the matching module in `assets/`), then:

```bash
node scripts/generate.js
```

Generated pages carry a marker comment, don't edit them by hand.

## Tech

Vanilla JS, no build step. Libraries from CDN, loaded only on pages that need them:
[jsPDF](https://github.com/parallax/jsPDF), [pdf.js](https://mozilla.github.io/pdf.js/), [pdf-lib](https://github.com/Hopding/pdf-lib), [JSZip](https://stuk.github.io/jszip/), [html2canvas](https://html2canvas.hertzen.com/), [js-yaml](https://github.com/nodeca/js-yaml), [marked](https://marked.js.org/), [spark-md5](https://github.com/satazor/js-spark-md5). Fonts: Inter + JetBrains Mono.

## Run locally

```bash
git clone https://github.com/harsh-m-10/convertze.git
cd convertze
npx serve .
```

## Contributing

Issues and pull requests welcome on [GitHub](https://github.com/harsh-m-10/convertze).
