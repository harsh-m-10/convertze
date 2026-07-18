/* Pings IndexNow (Bing, DuckDuckGo, Yandex and friends) with every URL in the
 * sitemap. Run after a deploy that adds or changes pages:
 *   node scripts/indexnow.js
 * The key file <key>.txt at the site root proves ownership. */
const fs = require("fs");
const path = require("path");
const https = require("https");

const KEY = "fba8606502557282956b60aad60d65e0";
const HOST = "convertze.com";

const sitemap = fs.readFileSync(path.join(__dirname, "..", "sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urls.length) {
  console.error("no URLs found in sitemap.xml");
  process.exit(1);
}

const body = JSON.stringify({
  host: HOST,
  key: KEY,
  keyLocation: `https://${HOST}/${KEY}.txt`,
  urlList: urls
});

const req = https.request(
  {
    hostname: "api.indexnow.org",
    path: "/indexnow",
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) }
  },
  (res) => {
    console.log(`IndexNow: HTTP ${res.statusCode} for ${urls.length} URLs`);
    res.resume();
  }
);
req.on("error", (e) => { console.error("IndexNow ping failed:", e.message); process.exit(1); });
req.write(body);
req.end();
