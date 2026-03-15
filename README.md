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

## Push to GitHub

1. Create a new repository on [GitHub](https://github.com/new). Do not add a README, .gitignore, or license (this project already has a README).
2. In the project folder, initialize Git and add the remote:

```bash
cd converter-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `REPO_NAME` with your GitHub username and repository name.

## Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub is recommended).
2. Click **Add New** then **Project** and import your GitHub repository.
3. Leave **Root Directory** as `.` and **Framework Preset** as **Other**. Build and output are not required; Vercel will serve the files as static.
4. Click **Deploy**. After it finishes, you get a URL like `your-project.vercel.app`.
5. To use your own domain (e.g. convertze.com): in the Vercel project go to **Settings > Domains**, add `convertze.com` (and optionally `www.convertze.com`). In your domain registrar’s DNS, add the records Vercel shows (usually an A record or CNAME). Wait for DNS to propagate.

## Project structure

- `index.html` – App UI and logic
- `404.html` – Custom 404 page
- `favicon.svg` – App icon
- `robots.txt` – Crawler rules
- `sitemap.xml` – Sitemap for search engines
- `vercel.json` – Vercel config (headers, clean URLs)

## License

MIT (or your chosen license).

Created by Agent Null.
