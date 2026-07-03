# Convertze launch kit

Everything here is a draft for Harsh to post personally. Nothing is published automatically.
General rules that apply everywhere: post from your own account, reply to every comment in
the first 2 hours (that is what algorithms reward), and never post the same text twice on
one platform.

Suggested order: directories first (quiet backlinks), then Reddit, then Show HN,
then Product Hunt (pick a Tuesday-Thursday), LinkedIn last and only if you are
comfortable with colleagues seeing it.

---

## 1. Directories (do these first, ~10 minutes each, pure backlinks)

- AlternativeTo: submit convertze.com as an alternative to iLovePDF, SmallPDF, TinyPNG
- free-for.dev: PR to their GitHub repo under "Tools for teams and collaboration" or "Miscellaneous"
- uneed.best, toolfolio.io, saashub.com, producthunt.com/products (listing, separate from launch)
- Privacy-focused lists: awesome-privacy on GitHub (PR), privacytools.io forum

---

## 2. Reddit

### r/SideProject / r/InternetIsBeautiful

**Title:** I built 49 free file/PDF/text tools that run 100% in your browser. Your files never touch a server.

**Body:**

Over the last month I turned a weekend converter into a full toolbox: 49 tools for
images (convert, compress to an exact KB target, crop), PDFs (merge, split, compress,
sign with a drawn/typed/uploaded signature, rotate), dev work (JSON, JWT, regex, diff,
QR codes) plus calculators (EMI, GST, currency, units).

The gimmick, if you can call it that: there is no backend. Everything runs in your
browser tab via canvas, pdf-lib and pdf.js. You can load a tool, go offline, and it
keeps working. No accounts, no watermarks, no file-size games.

It is open source too, so if you do not trust "we do not upload your files" claims
(you should not, generally), you can read the code or watch the network tab.

Site: https://convertze.com
Source: https://github.com/harsh-m-10/convertze

Happy to answer anything, and genuinely looking for tool requests. Half the tools
exist because someone asked.

### r/developersIndia

**Title:** Built a free alternative to iLovePDF/SmallPDF that never uploads your documents. 49 tools, open source.

**Body:**

Every time I had to compress a PDF under 1MB for a portal or resize a photo to 20KB,
the top Google results wanted my documents uploaded to their servers. For Aadhaar
scans and bank statements that always felt wrong.

So I built Convertze: 49 tools that run entirely in the browser. Compress PDF to an
exact KB target, sign PDFs (draw/type/upload signature), merge/split/rotate, image
compression to exact sizes, plus EMI, GST and currency calculators.

No uploads (verifiable in the network tab), no sign-up, no watermark, open source.

https://convertze.com

Would love feedback, especially on what is missing for Indian govt-portal use cases.

---

## 3. Show HN (Hacker News)

**Title:** Show HN: 49 file and dev tools that run entirely in the browser

**URL:** https://convertze.com

**First comment (post immediately after submitting):**

Hi HN. Convertze started as a single-page image converter and grew into 49 tools:
image conversion/compression (including compress-to-exact-KB via binary search on
quality), PDF merge/split/sign/rotate/compress, the usual dev utilities (JSON, JWT,
diff, regex), and calculators.

The architectural constraint is that there is no server: canvas for images, pdf.js +
pdf-lib for PDFs, everything else plain JS. The site is static files on a CDN. That
means no accounts, no file-size limits beyond your RAM, and the privacy claim is
verifiable rather than a policy promise: the network tab shows nothing leaving.

One honest exception: the currency converter fetches a public daily rates table.
Everything else works offline after first load (it is a PWA).

Stack: vanilla JS, a small static-site generator in Node, no framework. Source:
https://github.com/harsh-m-10/convertze

Things I would love opinions on: whether compress-to-target-size handles your PDFs
well, and what is missing from the dev tools.

---

## 4. Product Hunt

**Name:** Convertze
**Tagline:** 49 free file & dev tools. Nothing leaves your device.
**Topics:** Privacy, Productivity, Developer Tools, Web App

**Description:**

Convert, compress and sign PDFs, resize and compress images to exact KB targets,
format JSON, decode JWTs, generate QR codes, calculate EMI and GST, and 40 more
tools. Every tool runs entirely in your browser: no uploads, no accounts, no
watermarks. Open source and works offline.

**First comment (maker comment):**

Hey Product Hunt! I built Convertze because every "free online converter" wants
your files on their servers, and for contracts, ID scans and bank statements that
is exactly backwards.

Everything here runs in your browser tab. The site is static files; there is no
backend that could receive your documents even if I wanted one. You can check the
network tab or read the source on GitHub.

Favorite tools to try: Sign PDF (draw, type or upload your signature), Compress
PDF to an exact KB target, and the image converter that suggests better formats
when it spots opaque PNGs.

It is a side project and tool requests genuinely drive the roadmap. What is missing?

---

## 5. LinkedIn (optional — colleagues WILL see this, there is no way to hide it from them)

**Post:**

Side project update: over the past month I built Convertze, a collection of 49 free
file, PDF and developer tools that run entirely in the browser.

The interesting engineering constraint: there is no backend at all. PDF signing,
image compression to exact file sizes, format conversion, all of it happens on the
user's device with canvas, pdf.js and pdf-lib. The privacy claim ("your files never
leave your device") is architecturally guaranteed rather than promised in a policy.

A few things I learned building it:
- A static site generator + one JSON file scales surprisingly far (49 pages, zero frameworks)
- Binary search on JPEG quality is all you need to hit "compress to exactly 200KB"
- Users ask for the best features. Three tools exist because one friend sent requests on WhatsApp.

It is open source: github.com/harsh-m-10/convertze
Try it: convertze.com

Feedback and tool requests welcome.

---

## 6. Timing and expectations

- Directories: any time, zero risk, do all of them this week
- Reddit: one subreddit per day, not all at once (cross-posting the same link on
  the same day trips spam filters)
- Show HN: weekday morning US time (around 6-8 PM IST) for best visibility
- Product Hunt: launches reset at 12:01 AM Pacific; schedule for a Tue/Wed/Thu
- Expect: most posts do nothing, one in five lands. The backlinks help SEO
  permanently either way, which is the real prize.
