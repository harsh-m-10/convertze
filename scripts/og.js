#!/usr/bin/env node
/* Renders 1200x630 Open Graph share images for every tool page plus a
 * site-wide default, from data/tools.json, into assets/og/*.png.
 * Run after adding tools: node scripts/og.js  (one-time setup: npm i sharp)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "assets", "og");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "tools.json"), "utf8"));

const CAT_GRADIENT = {
  images: ["#0ea5e9", "#2563eb"],
  pdf: ["#8b5cf6", "#6366f1"],
  dev: ["#10b981", "#0d9488"],
  text: ["#f59e0b", "#ea580c"],
  calc: ["#ec4899", "#be185d"]
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function svg({ title, sub, grad }) {
  const [g1, g2] = grad;
  // Wrap the subtitle at ~46 chars into at most two lines.
  const words = sub.split(" ");
  const lines = [""];
  for (const w of words) {
    if ((lines[lines.length - 1] + " " + w).trim().length > 46 && lines.length < 2) lines.push("");
    lines[lines.length - 1] = (lines[lines.length - 1] + " " + w).trim();
  }
  const titleSize = title.length > 24 ? 64 : 76;
  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#131c30"/>
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${g1}"/>
      <stop offset="1" stop-color="${g2}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1050" cy="80" r="260" fill="${g1}" opacity="0.10"/>
  <circle cx="120" cy="580" r="200" fill="${g2}" opacity="0.10"/>
  <rect x="80" y="80" width="72" height="72" rx="18" fill="url(#mark)"/>
  <text x="116" y="131" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="700" fill="#ffffff" text-anchor="middle">C</text>
  <text x="172" y="128" font-family="Segoe UI, Arial, sans-serif" font-size="38" font-weight="700" fill="#e2e8f0">Convertze</text>
  <text x="80" y="330" font-family="Segoe UI, Arial, sans-serif" font-size="${titleSize}" font-weight="800" fill="#f8fafc">${esc(title)}</text>
  ${lines.map((l, i) => `<text x="80" y="${400 + i * 46}" font-family="Segoe UI, Arial, sans-serif" font-size="32" fill="#94a3b8">${esc(l)}</text>`).join("\n  ")}
  <text x="80" y="560" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#64748b">Free · Private · Files stay on your device</text>
</svg>`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const jobs = DATA.tools.map((t) => ({
    file: t.path.replace("/", "-") + ".png",
    title: t.name,
    sub: t.short,
    grad: CAT_GRADIENT[t.cat] || CAT_GRADIENT.images
  }));
  jobs.push({
    file: "default.png",
    title: "Free in-browser tools",
    sub: DATA.tools.length + " file, text and developer tools. Nothing leaves your device.",
    grad: ["#3b82f6", "#8b5cf6"]
  });
  for (const j of jobs) {
    await sharp(Buffer.from(svg(j))).png().toFile(path.join(OUT, j.file));
  }
  console.log("wrote " + jobs.length + " OG images to assets/og/");
}

main().catch((e) => { console.error(e); process.exit(1); });
