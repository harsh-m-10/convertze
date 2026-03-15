# Convertze

Free, in-browser file converter. Convert images, PDFs, and developer files without uploading; everything runs locally in your browser.

**Live site:** [convertze.com](https://convertze.com)

## Features

- **Images:** Format conversion (PNG, JPG, WebP), resize, compress, SVG to PNG
- **PDF:** Text/Markdown/HTML to PDF, images to PDF, PDF to JPG/PNG/text
- **Dev:** JSON to YAML, YAML to JSON, JSON pretty-print/minify, Base64 encode/decode

No server uploads, no accounts, no build step. Light and dark mode with preference saved in the browser.

## Tech stack

- Single HTML file with vanilla JavaScript
- [Tailwind CSS](https://tailwindcss.com) (CDN)
- [jsPDF](https://github.com/parallax/jsPDF), [pdf.js](https://mozilla.github.io/pdf.js/), [js-yaml](https://github.com/nodeca/js-yaml) via CDN

## Run locally

1. Clone the repo and open the project folder.
2. Serve the folder with any static server (e.g. `npx serve .` or open `index.html` in a browser).

```bash
git clone https://github.com/YOUR_USERNAME/converter-app.git
cd converter-app
npx serve .
```

Then open the URL shown (e.g. `http://localhost:3000`).
