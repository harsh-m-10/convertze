/* Convertze developer tools: textarea-first, live output, copy-first actions.
   json-formatter, json-yaml, csv-json, base64, hash, jwt, timestamp, diff, regex,
   color, url, markdown-preview, uuid, password, qr-code. */
(function () {
  "use strict";
  var C = window.Convertze;
  var h = C.h;

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function escHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function jsonParse(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      var msg = e.message || "";
      var where = "";
      var lc = /line (\d+) column (\d+)/.exec(msg);
      var pm = /position (\d+)/.exec(msg);
      var pos = null;
      if (!lc && pm) pos = parseInt(pm[1], 10);
      if (!lc && pos == null) {
        // Newer V8 gives a context snippet instead of a position; locate it in the source.
        var sn = /, (\.\.\.)?"([\s\S]*)" is not valid JSON/.exec(msg);
        if (sn) {
          var idx = text.indexOf(sn[2]);
          if (idx !== -1) pos = idx + (sn[1] ? 10 : 0); // V8 shows ~10 chars of context before the error
        }
      }
      if (lc) where = " at line " + lc[1] + ", column " + lc[2];
      else if (pos != null) {
        var before = text.slice(0, Math.min(pos, text.length)).split("\n");
        where = " near line " + before.length + ", column " + (before[before.length - 1].length + 1);
      }
      var clean = msg.replace(/\s*in JSON at position.*$/i, "").replace(/\s*\(line \d+ column \d+\)\s*$/, "");
      throw new Error("Invalid JSON" + where + ", " + clean);
    }
  }

  /* Robust CSV: quoted fields may contain commas, quotes and newlines. */
  function parseCsv(text) {
    var rows = [], row = [], cur = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else q = false;
        } else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (ch !== "\r") cur += ch;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    rows = rows.filter(function (r) { return r.length > 1 || (r[0] && r[0].trim()); });
    if (!rows.length) return [];
    var headers = rows[0];
    return rows.slice(1).map(function (r) {
      var obj = {};
      headers.forEach(function (hd, j) { obj[hd || ("col_" + (j + 1))] = r[j] != null ? r[j] : ""; });
      return obj;
    });
  }

  function toCsv(arr) {
    if (!Array.isArray(arr) || !arr.length || typeof arr[0] !== "object" || arr[0] === null) {
      throw new Error("Expected a JSON array of objects, e.g. [{\"a\":1},{\"a\":2}]");
    }
    var headers = Object.keys(arr[0]);
    function esc(v) {
      var s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var lines = [headers.map(esc).join(",")];
    arr.forEach(function (o) {
      lines.push(headers.map(function (k) { return esc(o[k]); }).join(","));
    });
    return lines.join("\n");
  }

  function b64encodeText(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64decodeBytes(input) {
    var safe = (input || "").replace(/[\s\r\n]/g, "").replace(/-/g, "+").replace(/_/g, "/");
    while (safe.length % 4) safe += "=";
    var bin;
    try { bin = atob(safe); } catch (e) { throw new Error("Not valid Base64, check for stray characters."); }
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  /* ---------- Shared textarea-tool scaffold ----------
     cfg: {inLabel, outLabel, placeholder, accept, live=true, hashKey,
           controls(bar, rerun) -> getSettings, transform(text, settings) -> string,
           downloadName(settings), output: "ta"|custom render(outArea, result)} */
  function duoTool(root, cfg) {
    var settingsBar = h("div", { class: "opts", style: "margin:0 0 13px" });
    if (cfg.controls) root.appendChild(settingsBar);

    var input = h("textarea", { class: "ta", placeholder: cfg.placeholder || "", spellcheck: "false", "aria-label": cfg.inLabel });
    var output = h("textarea", { class: "ta", readonly: true, spellcheck: "false", "aria-label": cfg.outLabel });
    var err = h("div", { class: "ta-err", role: "alert" });

    var loadBtn = h("button", { class: "mini", type: "button", text: "Load file..." });
    var fileInput = h("input", { type: "file", hidden: true });
    if (cfg.accept) fileInput.setAttribute("accept", cfg.accept);
    loadBtn.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", async function () {
      if (fileInput.files[0]) {
        input.value = await C.readFile(fileInput.files[0], "text");
        run();
      }
      fileInput.value = "";
    });

    var copyBtn = h("button", { class: "mini primary", type: "button", text: "Copy" });
    var dlBtn = h("button", { class: "mini", type: "button", text: "Download" });

    var inLab = h("div", { class: "ta-label" }, [
      h("span", { text: cfg.inLabel }),
      h("span", { class: "mini-btns" }, [loadBtn])
    ]);
    var outLab = h("div", { class: "ta-label" }, [
      h("span", { text: cfg.outLabel }),
      h("span", { class: "mini-btns" }, [copyBtn, dlBtn])
    ]);

    root.appendChild(h("div", { class: "duo" }, [
      h("div", null, [inLab, input]),
      h("div", null, [outLab, output])
    ]));
    root.appendChild(err);
    root.appendChild(fileInput);
    root.appendChild(h("p", { class: "kbd-hint", style: "margin:10px 0 0" }, [
      "Output updates live · ", h("kbd", { text: "Ctrl" }), " + ", h("kbd", { text: "Enter" }),
      " re-runs · ", h("kbd", { text: "Esc" }), " clears"
    ]));

    var getSettings = cfg.controls ? cfg.controls(settingsBar, function () { run(); }) : function () { return {}; };

    var lastResult = "";
    function run() {
      err.classList.remove("show");
      var text = input.value;
      if (!text.trim()) { output.value = ""; lastResult = ""; return; }
      try {
        var s = getSettings();
        lastResult = cfg.transform(text, s);
        output.value = lastResult;
        if (cfg.hashKey) C.hashState.save({ i: text.length > 3000 ? "" : text, s: s });
      } catch (e) {
        err.textContent = e.message || "Something went wrong.";
        err.classList.add("show");
      }
    }
    input.addEventListener("input", debounce(run, 180));
    ["dragover", "drop"].forEach(function (ev) {
      input.addEventListener(ev, async function (e) {
        e.preventDefault();
        if (ev === "drop" && e.dataTransfer.files[0]) {
          input.value = await C.readFile(e.dataTransfer.files[0], "text");
          run();
        }
      });
    });
    copyBtn.addEventListener("click", function () { if (output.value) C.copyText(output.value); });
    dlBtn.addEventListener("click", function () {
      if (!output.value) return;
      var name = typeof cfg.downloadName === "function" ? cfg.downloadName(getSettings()) : cfg.downloadName;
      C.download(new Blob([output.value], { type: "text/plain" }), name);
    });
    C.onRun(run);
    C.onClear(function () { input.value = ""; output.value = ""; err.classList.remove("show"); });

    var st = cfg.hashKey ? C.hashState.load() : null;
    if (st && st.i) {
      input.value = st.i;
      if (st.s && cfg.applyState) cfg.applyState(st.s);
      run();
    }
    return { input: input, output: output, run: run };
  }

  function modeToggle(bar, labels, initial, onChange) {
    var idx = initial || 0;
    var btns = labels.map(function (lab, i) {
      var b = h("button", { class: "mini" + (i === idx ? " on" : ""), type: "button", text: lab });
      b.addEventListener("click", function () {
        idx = i;
        btns.forEach(function (x, j) { x.classList.toggle("on", j === i); });
        onChange(i);
      });
      return b;
    });
    var box = h("span", { class: "mini-btns" }, btns);
    bar.appendChild(box);
    return {
      get: function () { return idx; },
      set: function (i) { idx = i; btns.forEach(function (x, j) { x.classList.toggle("on", j === i); }); }
    };
  }

  /* ---------- JSON formatter ---------- */
  C.register("dev/json-formatter", function (root) {
    var mode;
    var tool = duoTool(root, {
      inLabel: "JSON input",
      outLabel: "Result",
      placeholder: '{"paste":"your JSON here"}',
      accept: ".json,application/json,text/plain",
      hashKey: true,
      controls: function (bar, rerun) {
        bar.appendChild(h("span", { class: "field", text: "Mode:" }));
        mode = modeToggle(bar, ["Beautify", "Minify"], 0, rerun);
        return function () { return { m: mode.get() }; };
      },
      applyState: function (s) { if (mode && s.m != null) mode.set(s.m); },
      transform: function (text, s) {
        var obj = jsonParse(text);
        return s.m === 1 ? JSON.stringify(obj) : JSON.stringify(obj, null, 2);
      },
      downloadName: function (s) { return s.m === 1 ? "minified.json" : "formatted.json"; }
    });
  });

  /* ---------- JSON ⇄ YAML ---------- */
  C.register("dev/json-yaml", function (root) {
    var mode;
    duoTool(root, {
      inLabel: "Input",
      outLabel: "Output",
      placeholder: '{"convert": "me"}  ,   or YAML, after flipping direction',
      accept: ".json,.yml,.yaml,text/plain",
      hashKey: true,
      controls: function (bar, rerun) {
        bar.appendChild(h("span", { class: "field", text: "Direction:" }));
        mode = modeToggle(bar, ["JSON → YAML", "YAML → JSON"], 0, rerun);
        return function () { return { m: mode.get() }; };
      },
      applyState: function (s) { if (mode && s.m != null) mode.set(s.m); },
      transform: function (text, s) {
        if (typeof jsyaml === "undefined") throw new Error("YAML library failed to load, refresh the page.");
        if (s.m === 0) return jsyaml.dump(jsonParse(text));
        try {
          return JSON.stringify(jsyaml.load(text), null, 2);
        } catch (e) {
          throw new Error("Invalid YAML, " + (e.reason || e.message));
        }
      },
      downloadName: function (s) { return s.m === 0 ? "converted.yml" : "converted.json"; }
    });
  });

  /* ---------- CSV ⇄ JSON ---------- */
  C.register("dev/csv-json", function (root) {
    var mode;
    duoTool(root, {
      inLabel: "Input",
      outLabel: "Output",
      placeholder: "name,role\nAda,Engineer\nGrace,Admiral",
      accept: ".csv,.json,text/csv,application/json,text/plain",
      hashKey: true,
      controls: function (bar, rerun) {
        bar.appendChild(h("span", { class: "field", text: "Direction:" }));
        mode = modeToggle(bar, ["CSV → JSON", "JSON → CSV"], 0, rerun);
        return function () { return { m: mode.get() }; };
      },
      applyState: function (s) { if (mode && s.m != null) mode.set(s.m); },
      transform: function (text, s) {
        if (s.m === 0) {
          var rows = parseCsv(text);
          if (!rows.length) throw new Error("No data rows found, the first line is treated as the header row.");
          return JSON.stringify(rows, null, 2);
        }
        return toCsv(jsonParse(text));
      },
      downloadName: function (s) { return s.m === 0 ? "converted.json" : "converted.csv"; }
    });
  });

  /* ---------- URL encode/decode ---------- */
  C.register("dev/url", function (root) {
    var mode, full;
    duoTool(root, {
      inLabel: "Input",
      outLabel: "Output",
      placeholder: "https://example.com/?q=hello world&lang=हिंदी",
      hashKey: true,
      controls: function (bar, rerun) {
        mode = modeToggle(bar, ["Encode", "Decode"], 0, rerun);
        full = h("input", { type: "checkbox" });
        full.addEventListener("change", rerun);
        bar.appendChild(h("label", { class: "field" }, [full, " Preserve URL structure (:/?#&=)"]));
        return function () { return { m: mode.get(), f: full.checked }; };
      },
      applyState: function (s) { if (mode && s.m != null) mode.set(s.m); if (full && s.f != null) full.checked = s.f; },
      transform: function (text, s) {
        try {
          if (s.m === 0) return s.f ? encodeURI(text) : encodeURIComponent(text);
          return s.f ? decodeURI(text) : decodeURIComponent(text.replace(/\+/g, "%20"));
        } catch (e) {
          throw new Error("Malformed percent-encoding, " + e.message);
        }
      },
      downloadName: "url.txt"
    });
  });

  /* ---------- Base64 (text + file) ---------- */
  C.register("dev/base64", function (root) {
    var mode;
    var pendingBytes = null;
    var dlBinBtn = h("button", { class: "btn ghost sm", type: "button", text: "Download decoded file", style: "display:none" });

    var tool = duoTool(root, {
      inLabel: "Input",
      outLabel: "Output",
      placeholder: "Type text to encode, or paste Base64 and switch to Decode",
      accept: ".txt,text/plain",
      hashKey: true,
      controls: function (bar, rerun) {
        mode = modeToggle(bar, ["Encode", "Decode"], 0, rerun);
        return function () { return { m: mode.get() }; };
      },
      applyState: function (s) { if (mode && s.m != null) mode.set(s.m); },
      transform: function (text, s) {
        pendingBytes = null;
        dlBinBtn.style.display = "none";
        if (s.m === 0) return b64encodeText(text);
        var bytes = b64decodeBytes(text);
        try {
          return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch (e) {
          pendingBytes = bytes;
          dlBinBtn.style.display = "";
          return "[binary data, " + C.fmtKB(bytes.length) + ". Use 'Download decoded file' below.]";
        }
      },
      downloadName: function (s) { return s.m === 0 ? "encoded_base64.txt" : "decoded.txt"; }
    });

    dlBinBtn.addEventListener("click", function () {
      if (pendingBytes) C.download(new Blob([pendingBytes]), "decoded.bin");
    });

    /* File → Base64 */
    var filePanel = h("div", { style: "margin-top:16px" });
    filePanel.appendChild(h("div", { class: "ta-label" }, [h("span", { text: "Or encode an entire file" })]));
    root.appendChild(filePanel);
    var status = null;
    C.dropzone(filePanel, {
      multiple: false,
      label: "Drop any file to Base64-encode it",
      sub: "Result goes to the output box (truncated display for huge files)",
      onFiles: async function (files) {
        try {
          status.set("processing", "Encoding " + files[0].name + "...");
          var buf = await C.readFile(files[0], "buffer");
          var bytes = new Uint8Array(buf);
          var bin = "";
          var CHUNK = 0x8000;
          for (var i = 0; i < bytes.length; i += CHUNK) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
          }
          var b64 = btoa(bin);
          mode.set(0);
          tool.output.value = b64.length > 500000 ? b64.slice(0, 500000) + "\n...[truncated in view, use Download for the full string]" : b64;
          C.download(new Blob([b64], { type: "text/plain" }), C.baseName(files[0].name) + "_base64.txt");
          status.set("done", files[0].name + " encoded (" + C.fmtKB(b64.length) + " of Base64), downloaded.");
        } catch (e) {
          status.set("error", e.message || "Encoding failed.");
        }
      }
    });
    status = C.makeStatus(filePanel);
    root.appendChild(h("div", { class: "actions-row" }, [dlBinBtn]));
  });

  /* ---------- Hash (SHA-256 + MD5, text + file) ---------- */
  C.register("dev/hash", function (root) {
    async function sha256Hex(buf) {
      var d = await crypto.subtle.digest("SHA-256", buf);
      return Array.from(new Uint8Array(d)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    }
    function row(label) {
      var td = h("td");
      var copy = h("button", { class: "mini", type: "button", text: "Copy" });
      copy.addEventListener("click", function () { if (td.firstChild) C.copyText(td.firstChild.textContent); });
      var tr = h("tr", null, [h("th", { text: label }), td]);
      return { tr: tr, set: function (v) { td.innerHTML = ""; td.appendChild(document.createTextNode(v)); td.appendChild(copy); } };
    }
    var sha = row("SHA-256"), md5 = row("MD5");
    var input = h("textarea", { class: "ta", placeholder: "Type or paste text to hash...", spellcheck: "false", style: "min-height:120px", "aria-label": "Text to hash" });
    var table = h("table", { class: "kv" }, [sha.tr, md5.tr]);
    var subject = h("p", { class: "kbd-hint", style: "margin:10px 0 0", text: "Hashing: (nothing yet)" });

    root.appendChild(h("div", { class: "ta-label" }, [h("span", { text: "Text input" })]));
    root.appendChild(input);
    var fileBox = h("div", { style: "margin-top:14px" });
    root.appendChild(fileBox);
    var status;
    C.dropzone(fileBox, {
      multiple: false,
      label: "...or drop any file to hash it",
      onFiles: async function (files) {
        try {
          status.set("processing", "Hashing " + files[0].name + "...");
          var buf = await C.readFile(files[0], "buffer");
          sha.set(await sha256Hex(buf));
          md5.set(typeof SparkMD5 !== "undefined" ? SparkMD5.ArrayBuffer.hash(buf) : "MD5 library not loaded");
          subject.textContent = "Hashing: " + files[0].name + " (" + C.fmtKB(files[0].size) + ")";
          status.set("done", "Hashed " + files[0].name);
        } catch (e) {
          status.set("error", e.message || "Hashing failed.");
        }
      }
    });
    status = C.makeStatus(fileBox);
    root.appendChild(table);
    root.appendChild(subject);

    var runText = debounce(async function () {
      var text = input.value;
      if (!text) { return; }
      var buf = new TextEncoder().encode(text);
      sha.set(await sha256Hex(buf));
      md5.set(typeof SparkMD5 !== "undefined" ? SparkMD5.hash(text) : "MD5 library not loaded");
      subject.textContent = "Hashing: text input (" + buf.length + " bytes)";
    }, 180);
    input.addEventListener("input", runText);
    C.onClear(function () { input.value = ""; });
  });

  /* ---------- JWT decoder ---------- */
  C.register("dev/jwt", function (root) {
    var input = h("textarea", { class: "ta", placeholder: "Paste a JWT (eyJhbGciOi...)", spellcheck: "false", style: "min-height:96px", "aria-label": "JWT token" });
    var err = h("div", { class: "ta-err", role: "alert" });
    function pane(title) {
      var pre = h("pre", { class: "outbox", text: "-" });
      var copy = h("button", { class: "mini", type: "button", text: "Copy" });
      copy.addEventListener("click", function () { if (pre.textContent !== "-") C.copyText(pre.textContent); });
      var box = h("div", null, [
        h("div", { class: "ta-label" }, [h("span", { text: title }), h("span", { class: "mini-btns" }, [copy])]),
        pre
      ]);
      return { box: box, pre: pre };
    }
    var head = pane("Header"), pay = pane("Payload"), sig = pane("Signature");
    var note = h("p", { class: "kbd-hint", style: "margin:10px 0 0", text: "Signature is not verified, this tool is for inspection only." });

    root.appendChild(h("div", { class: "ta-label" }, [h("span", { text: "Token" })]));
    root.appendChild(input);
    root.appendChild(err);
    var grid = h("div", { class: "duo", style: "margin-top:13px" }, [head.box, pay.box]);
    root.appendChild(grid);
    root.appendChild(h("div", { style: "margin-top:13px" }, [sig.box]));
    root.appendChild(note);

    function fmtClaimTime(v) {
      var d = new Date(v * 1000);
      return v + "  (" + d.toISOString() + ")";
    }
    function run() {
      err.classList.remove("show");
      var token = input.value.trim().replace(/^Bearer\s+/i, "");
      if (!token) { head.pre.textContent = pay.pre.textContent = sig.pre.textContent = "-"; return; }
      try {
        var parts = token.split(".");
        if (parts.length < 2) throw new Error("A JWT has three dot-separated parts (header.payload.signature), this has " + parts.length + ".");
        var dec = new TextDecoder();
        var header = JSON.parse(dec.decode(b64decodeBytes(parts[0])));
        var payload = JSON.parse(dec.decode(b64decodeBytes(parts[1])));
        head.pre.textContent = JSON.stringify(header, null, 2);
        var notes = [];
        ["exp", "iat", "nbf"].forEach(function (k) {
          if (typeof payload[k] === "number") notes.push(k + ": " + fmtClaimTime(payload[k]));
        });
        var expMsg = "";
        if (typeof payload.exp === "number") {
          expMsg = payload.exp * 1000 < Date.now() ? "\n\n⚠ Token EXPIRED " : "\n\n✓ Token valid until ";
          expMsg += new Date(payload.exp * 1000).toLocaleString();
        }
        pay.pre.textContent = JSON.stringify(payload, null, 2) + (notes.length ? "\n\n- " + notes.join("\n- ") : "") + expMsg;
        sig.pre.textContent = parts[2] ? parts[2] + "\n\n(base64url, verify server-side with the signing key)" : "(no signature present, unsecured JWT)";
        C.hashState.save({ i: token });
      } catch (e) {
        err.textContent = e.message || "Could not decode token.";
        err.classList.add("show");
      }
    }
    input.addEventListener("input", debounce(run, 180));
    C.onRun(run);
    C.onClear(function () { input.value = ""; run(); });
    var st = C.hashState.load();
    if (st && st.i) { input.value = st.i; run(); }
  });

  /* ---------- Timestamp converter ---------- */
  C.register("dev/timestamp", function (root) {
    var input = h("input", { class: "single-input", type: "text", placeholder: "1718200000, 1718200000000, or 2026-06-12T10:00:00Z", "aria-label": "Timestamp or date" });
    var nowBtn = h("button", { class: "btn ghost sm", type: "button", text: "Now" });
    var err = h("div", { class: "ta-err", role: "alert" });
    function row(label) {
      var td = h("td");
      var copy = h("button", { class: "mini", type: "button", text: "Copy" });
      copy.addEventListener("click", function () { if (td.firstChild) C.copyText(td.firstChild.textContent); });
      var tr = h("tr", null, [h("th", { text: label }), td]);
      return { tr: tr, set: function (v) { td.innerHTML = ""; td.appendChild(document.createTextNode(v)); td.appendChild(copy); } };
    }
    var rows = {
      s: row("Unix (seconds)"), ms: row("Unix (milliseconds)"),
      iso: row("ISO 8601 (UTC)"), loc: row("Local time"), rel: row("Relative")
    };
    root.appendChild(h("div", { class: "opts", style: "margin-bottom:13px" }, [
      h("div", { style: "flex:1;min-width:220px" }, [input]), nowBtn
    ]));
    root.appendChild(err);
    root.appendChild(h("table", { class: "kv" }, [rows.s.tr, rows.ms.tr, rows.iso.tr, rows.loc.tr, rows.rel.tr]));

    function relative(ms) {
      var diff = ms - Date.now();
      var abs = Math.abs(diff);
      var units = [[31536000000, "year"], [2592000000, "month"], [86400000, "day"], [3600000, "hour"], [60000, "minute"], [1000, "second"]];
      for (var i = 0; i < units.length; i++) {
        if (abs >= units[i][0]) {
          var n = Math.round(abs / units[i][0]);
          return n + " " + units[i][1] + (n > 1 ? "s" : "") + (diff < 0 ? " ago" : " from now");
        }
      }
      return "now";
    }
    function run() {
      err.classList.remove("show");
      var raw = input.value.trim();
      if (!raw) return;
      var ms;
      if (/^\d{1,13}$/.test(raw)) ms = raw.length >= 12 ? parseInt(raw, 10) : parseInt(raw, 10) * 1000;
      else ms = Date.parse(raw);
      if (!isFinite(ms)) {
        err.textContent = "Couldn't parse '" + raw + "' as a Unix timestamp or date string.";
        err.classList.add("show");
        return;
      }
      var d = new Date(ms);
      rows.s.set(String(Math.floor(ms / 1000)));
      rows.ms.set(String(ms));
      rows.iso.set(d.toISOString());
      rows.loc.set(d.toLocaleString());
      rows.rel.set(relative(ms));
      C.hashState.save({ i: raw });
    }
    input.addEventListener("input", debounce(run, 150));
    nowBtn.addEventListener("click", function () { input.value = String(Date.now()); run(); });
    C.onRun(run);
    C.onClear(function () { input.value = ""; });
    var st = C.hashState.load();
    if (st && st.i) { input.value = st.i; }
    else input.value = String(Math.floor(Date.now() / 1000));
    run();
  });

  /* ---------- Text diff ---------- */
  C.register("dev/diff", function (root) {
    var left = h("textarea", { class: "ta", placeholder: "Original text...", spellcheck: "false", "aria-label": "Original text" });
    var right = h("textarea", { class: "ta", placeholder: "Changed text...", spellcheck: "false", "aria-label": "Changed text" });
    var out = h("pre", { class: "outbox", html: '<span class="ctx">Diff appears here as you type.</span>' });
    root.appendChild(h("div", { class: "duo" }, [
      h("div", null, [h("div", { class: "ta-label" }, [h("span", { text: "Original" })]), left]),
      h("div", null, [h("div", { class: "ta-label" }, [h("span", { text: "Changed" })]), right])
    ]));
    var summary = h("span", { text: "Diff" });
    root.appendChild(h("div", { class: "ta-label", style: "margin-top:13px" }, [summary]));
    root.appendChild(out);

    function diffLines(a, b) {
      if (a.length * b.length > 4000000) return null; // too big for O(n·m)
      var n = a.length, m = b.length;
      var dp = new Array(n + 1);
      for (var i = 0; i <= n; i++) dp[i] = new Int32Array(m + 1);
      for (i = n - 1; i >= 0; i--) {
        for (var j = m - 1; j >= 0; j--) {
          dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
      var ops = [];
      i = 0; var j2 = 0;
      while (i < n && j2 < m) {
        if (a[i] === b[j2]) { ops.push(["ctx", a[i]]); i++; j2++; }
        else if (dp[i + 1][j2] >= dp[i][j2 + 1]) { ops.push(["del", a[i]]); i++; }
        else { ops.push(["add", b[j2]]); j2++; }
      }
      while (i < n) { ops.push(["del", a[i++]]); }
      while (j2 < m) { ops.push(["add", b[j2++]]); }
      return ops;
    }
    function run() {
      var a = left.value.split("\n"), b = right.value.split("\n");
      if (!left.value && !right.value) { out.innerHTML = '<span class="ctx">Diff appears here as you type.</span>'; return; }
      var ops = diffLines(a, b);
      if (!ops) { out.innerHTML = '<span class="ctx">Inputs too large for in-browser diff (try under ~2000 lines each).</span>'; return; }
      var adds = 0, dels = 0;
      out.innerHTML = ops.map(function (op) {
        if (op[0] === "add") { adds++; return '<span class="add">+ ' + escHtml(op[1]) + "</span>"; }
        if (op[0] === "del") { dels++; return '<span class="del">- ' + escHtml(op[1]) + "</span>"; }
        return '<span class="ctx">  ' + escHtml(op[1]) + "</span>";
      }).join("");
      summary.textContent = "Diff, " + adds + " added, " + dels + " removed";
    }
    var d = debounce(run, 220);
    left.addEventListener("input", d);
    right.addEventListener("input", d);
    C.onRun(run);
    C.onClear(function () { left.value = right.value = ""; run(); });
  });

  /* ---------- Regex tester ---------- */
  C.register("dev/regex", function (root) {
    var pattern = h("input", { class: "single-input", type: "text", placeholder: "([A-Z])\\w+", "aria-label": "Regular expression" });
    var flagBoxes = {};
    var flagsRow = h("span", { class: "mini-btns" }, ["g", "i", "m", "s"].map(function (f) {
      var cb = h("input", { type: "checkbox" });
      if (f === "g") cb.checked = true;
      flagBoxes[f] = cb;
      return h("label", { class: "field" }, [cb, " " + f]);
    }));
    var test = h("textarea", { class: "ta", placeholder: "Test string...", spellcheck: "false", style: "min-height:150px", "aria-label": "Test string" });
    var out = h("pre", { class: "outbox" });
    var groupsOut = h("pre", { class: "outbox", style: "display:none" });
    var err = h("div", { class: "ta-err", role: "alert" });
    var count = h("span", { text: "Matches" });

    root.appendChild(h("div", { class: "opts", style: "margin-bottom:13px" }, [
      h("div", { style: "flex:1;min-width:220px" }, [pattern]), flagsRow
    ]));
    root.appendChild(h("div", { class: "ta-label" }, [h("span", { text: "Test string" })]));
    root.appendChild(test);
    root.appendChild(err);
    root.appendChild(h("div", { class: "ta-label", style: "margin-top:13px" }, [count]));
    root.appendChild(out);
    root.appendChild(groupsOut);

    function run() {
      err.classList.remove("show");
      var src = pattern.value;
      var text = test.value;
      if (!src || !text) { out.innerHTML = '<span class="ctx">Matches highlight here.</span>'; groupsOut.style.display = "none"; count.textContent = "Matches"; return; }
      var flags = Object.keys(flagBoxes).filter(function (f) { return flagBoxes[f].checked; }).join("");
      var re;
      try { re = new RegExp(src, flags); }
      catch (e) {
        err.textContent = "Invalid pattern, " + e.message;
        err.classList.add("show");
        return;
      }
      var matches = [];
      if (flags.indexOf("g") === -1) {
        var m1 = re.exec(text);
        if (m1) matches.push(m1);
      } else {
        var m, guard = 0;
        while ((m = re.exec(text)) && guard++ < 5000) {
          matches.push(m);
          if (m.index === re.lastIndex) re.lastIndex++; // zero-length match safety
        }
      }
      count.textContent = matches.length + " match" + (matches.length === 1 ? "" : "es");
      var html = "", pos = 0;
      matches.forEach(function (mm) {
        html += escHtml(text.slice(pos, mm.index));
        html += "<mark>" + escHtml(mm[0] === "" ? "∅" : mm[0]) + "</mark>";
        pos = mm.index + mm[0].length;
      });
      html += escHtml(text.slice(pos));
      out.innerHTML = html || '<span class="ctx">(empty)</span>';
      var withGroups = matches.filter(function (mm) { return mm.length > 1; }).slice(0, 25);
      if (withGroups.length) {
        groupsOut.style.display = "";
        groupsOut.textContent = withGroups.map(function (mm, i) {
          return "match " + (i + 1) + " @" + mm.index + ": " + mm.slice(1).map(function (g, gi) {
            return "$" + (gi + 1) + "=" + (g == null ? "∅" : JSON.stringify(g));
          }).join("  ");
        }).join("\n");
      } else groupsOut.style.display = "none";
      C.hashState.save({ p: src, f: flags, t: text.length > 2000 ? "" : text });
    }
    var d = debounce(run, 160);
    pattern.addEventListener("input", d);
    test.addEventListener("input", d);
    Object.keys(flagBoxes).forEach(function (f) { flagBoxes[f].addEventListener("change", run); });
    C.onRun(run);
    C.onClear(function () { pattern.value = ""; test.value = ""; run(); });
    var st = C.hashState.load();
    if (st && st.p) {
      pattern.value = st.p;
      if (st.t) test.value = st.t;
      if (st.f != null) Object.keys(flagBoxes).forEach(function (f) { flagBoxes[f].checked = st.f.indexOf(f) !== -1; });
      run();
    }
  });

  /* ---------- Color converter ---------- */
  C.register("dev/color", function (root) {
    var input = h("input", { class: "single-input", type: "text", placeholder: "#2563EB · rgb(37, 99, 235) · hsl(221, 83%, 53%) · rebeccapurple", "aria-label": "Color value" });
    var err = h("div", { class: "ta-err", role: "alert" });
    var swatch = h("div", { class: "swatch" });
    function row(label) {
      var td = h("td");
      var copy = h("button", { class: "mini", type: "button", text: "Copy" });
      copy.addEventListener("click", function () { if (td.firstChild) C.copyText(td.firstChild.textContent); });
      var tr = h("tr", null, [h("th", { text: label }), td]);
      return { tr: tr, set: function (v) { td.innerHTML = ""; td.appendChild(document.createTextNode(v)); td.appendChild(copy); } };
    }
    var rows = { hex: row("HEX"), rgb: row("RGB"), hsl: row("HSL") };
    root.appendChild(input);
    root.appendChild(err);
    root.appendChild(swatch);
    root.appendChild(h("table", { class: "kv" }, [rows.hex.tr, rows.rgb.tr, rows.hsl.tr]));

    var ctx = document.createElement("canvas").getContext("2d");
    function parseColor(str) {
      ctx.fillStyle = "#010203";
      ctx.fillStyle = str;
      var norm1 = ctx.fillStyle;
      ctx.fillStyle = "#030201";
      ctx.fillStyle = str;
      if (ctx.fillStyle !== norm1) return null; // invalid input left sentinel values
      var s = norm1;
      if (s[0] === "#") {
        return { r: parseInt(s.slice(1, 3), 16), g: parseInt(s.slice(3, 5), 16), b: parseInt(s.slice(5, 7), 16), a: 1 };
      }
      var m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
      return null;
    }
    function toHsl(c) {
      var r = c.r / 255, g = c.g / 255, b = c.b / 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var l = (max + min) / 2, d = max - min;
      var hh = 0, ss = 0;
      if (d) {
        ss = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) hh = ((g - b) / d + (g < b ? 6 : 0));
        else if (max === g) hh = (b - r) / d + 2;
        else hh = (r - g) / d + 4;
        hh *= 60;
      }
      return { h: Math.round(hh), s: Math.round(ss * 100), l: Math.round(l * 100) };
    }
    function hex2(n) { return Math.round(n).toString(16).padStart(2, "0"); }
    function run() {
      err.classList.remove("show");
      var v = input.value.trim();
      if (!v) return;
      var c = parseColor(v);
      if (!c) {
        err.textContent = "'" + v + "' isn't a recognised CSS color.";
        err.classList.add("show");
        return;
      }
      var hsl = toHsl(c);
      var alpha = c.a < 1 ? c.a : null;
      rows.hex.set("#" + hex2(c.r) + hex2(c.g) + hex2(c.b) + (alpha != null ? hex2(alpha * 255) : ""));
      rows.rgb.set(alpha != null
        ? "rgba(" + c.r + ", " + c.g + ", " + c.b + ", " + alpha + ")"
        : "rgb(" + c.r + ", " + c.g + ", " + c.b + ")");
      rows.hsl.set(alpha != null
        ? "hsla(" + hsl.h + ", " + hsl.s + "%, " + hsl.l + "%, " + alpha + ")"
        : "hsl(" + hsl.h + ", " + hsl.s + "%, " + hsl.l + "%)");
      swatch.style.background = v;
      C.hashState.save({ i: v });
    }
    input.addEventListener("input", debounce(run, 120));
    C.onRun(run);
    C.onClear(function () { input.value = ""; });
    var st = C.hashState.load();
    input.value = st && st.i ? st.i : "#2563EB";
    run();
  });

  /* ---------- Markdown preview ---------- */
  C.register("dev/markdown-preview", function (root) {
    var input = h("textarea", { class: "ta", placeholder: "# Hello\n\nType **Markdown** here...", spellcheck: "false", style: "min-height:320px", "aria-label": "Markdown input" });
    var preview = h("div", { class: "outbox md-preview", style: "max-height:72vh;min-height:320px;font-family:Inter,ui-sans-serif,sans-serif;font-size:14px" });
    var dlBtn = h("button", { class: "mini", type: "button", text: "Download HTML" });
    var copyBtn = h("button", { class: "mini primary", type: "button", text: "Copy HTML" });
    root.appendChild(h("div", { class: "duo" }, [
      h("div", null, [h("div", { class: "ta-label" }, [h("span", { text: "Markdown" })]), input]),
      h("div", null, [
        h("div", { class: "ta-label" }, [h("span", { text: "Preview" }), h("span", { class: "mini-btns" }, [copyBtn, dlBtn])]),
        preview
      ])
    ]));

    var lastHtml = "";
    function sanitize(container) {
      container.querySelectorAll("script,style,iframe,object,embed,link").forEach(function (n) { n.remove(); });
      container.querySelectorAll("*").forEach(function (n) {
        Array.prototype.slice.call(n.attributes).forEach(function (attr) {
          if (/^on/i.test(attr.name) || (attr.name === "href" && /^\s*javascript:/i.test(attr.value))) {
            n.removeAttribute(attr.name);
          }
        });
      });
    }
    function run() {
      if (typeof marked === "undefined") { preview.textContent = "Markdown library failed to load, refresh the page."; return; }
      lastHtml = marked.parse(input.value || "");
      preview.innerHTML = lastHtml;
      sanitize(preview);
    }
    input.addEventListener("input", debounce(run, 160));
    ["dragover", "drop"].forEach(function (ev) {
      input.addEventListener(ev, async function (e) {
        e.preventDefault();
        if (ev === "drop" && e.dataTransfer.files[0]) {
          input.value = await C.readFile(e.dataTransfer.files[0], "text");
          run();
        }
      });
    });
    copyBtn.addEventListener("click", function () { if (lastHtml) C.copyText(lastHtml); });
    dlBtn.addEventListener("click", function () {
      if (lastHtml) C.download(new Blob(["<!DOCTYPE html><meta charset='utf-8'>" + lastHtml], { type: "text/html" }), "rendered.html");
    });
    C.onRun(run);
    C.onClear(function () { input.value = ""; run(); });
    run();
  });

  /* ---------- SQL formatter ---------- */
  C.register("dev/sql-formatter", function (root) {
    duoTool(root, {
      inLabel: "SQL input",
      outLabel: "Formatted",
      placeholder: "select id, name from users where active = 1 order by name",
      accept: ".sql,text/plain",
      hashKey: "sql",
      downloadName: function () { return "formatted.sql"; },
      controls: function (bar, rerun) {
        var dialect = h("select", { "aria-label": "SQL dialect" }, [
          h("option", { value: "sql", text: "Standard SQL" }),
          h("option", { value: "mysql", text: "MySQL" },),
          h("option", { value: "postgresql", text: "PostgreSQL" }),
          h("option", { value: "sqlite", text: "SQLite" })
        ]);
        var kw = h("select", { "aria-label": "Keyword case" }, [
          h("option", { value: "upper", text: "KEYWORDS UPPER" }),
          h("option", { value: "preserve", text: "keep keyword case" })
        ]);
        [dialect, kw].forEach(function (el) { el.addEventListener("change", rerun); });
        bar.appendChild(h("label", { class: "field" }, ["Dialect ", dialect]));
        bar.appendChild(h("label", { class: "field" }, [kw]));
        return function () { return { dialect: dialect.value, kw: kw.value }; };
      },
      transform: function (text, s) {
        if (typeof sqlFormatter === "undefined") throw new Error("Formatter library failed to load, check your connection and refresh.");
        return sqlFormatter.format(text, { language: s.dialect, keywordCase: s.kw === "upper" ? "upper" : "preserve", tabWidth: 2 });
      }
    });
  });

  /* ---------- XML formatter ---------- */
  function parseXml(text) {
    var doc = new DOMParser().parseFromString(text, "application/xml");
    var errNode = doc.querySelector("parsererror");
    if (errNode) {
      var msg = (errNode.textContent || "Invalid XML").split("\n")[0].trim();
      throw new Error(msg.length > 160 ? msg.slice(0, 160) + "..." : msg);
    }
    return doc;
  }
  function serializeXml(node, indent, minify) {
    var pad = minify ? "" : "  ".repeat(indent);
    var nl = minify ? "" : "\n";
    if (node.nodeType === 3) { // text
      var t = node.textContent.trim();
      return t ? pad + t.replace(/&/g, "&amp;").replace(/</g, "&lt;") + nl : "";
    }
    if (node.nodeType === 4) return pad + "<![CDATA[" + node.textContent + "]]>" + nl; // cdata
    if (node.nodeType === 8) return pad + "<!--" + node.textContent + "-->" + nl; // comment
    if (node.nodeType !== 1) return "";
    var name = node.nodeName;
    var attrs = Array.prototype.map.call(node.attributes || [], function (a) {
      return " " + a.name + '="' + a.value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;") + '"';
    }).join("");
    var kids = Array.prototype.filter.call(node.childNodes, function (k) {
      return k.nodeType === 1 || k.nodeType === 4 || k.nodeType === 8 || (k.nodeType === 3 && k.textContent.trim());
    });
    if (!kids.length) return pad + "<" + name + attrs + "/>" + nl;
    if (kids.length === 1 && kids[0].nodeType === 3) {
      return pad + "<" + name + attrs + ">" + kids[0].textContent.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</" + name + ">" + nl;
    }
    var inner = kids.map(function (k) { return serializeXml(k, indent + 1, minify); }).join("");
    return pad + "<" + name + attrs + ">" + nl + inner + pad + "</" + name + ">" + nl;
  }
  C.register("dev/xml-formatter", function (root) {
    duoTool(root, {
      inLabel: "XML input",
      outLabel: "Result",
      placeholder: "<config><name>demo</name><flags a=\"1\"/></config>",
      accept: ".xml,text/xml,application/xml",
      hashKey: "xml",
      downloadName: function (s) { return s.mode === "minify" ? "minified.xml" : "formatted.xml"; },
      controls: function (bar, rerun) {
        var mode = h("select", { "aria-label": "Mode" }, [
          h("option", { value: "beautify", text: "Beautify" }),
          h("option", { value: "minify", text: "Minify" })
        ]);
        mode.addEventListener("change", rerun);
        bar.appendChild(h("label", { class: "field" }, ["Mode ", mode]));
        return function () { return { mode: mode.value }; };
      },
      transform: function (text, s) {
        var decl = /^\s*<\?xml[^?]*\?>/.exec(text);
        var doc = parseXml(text);
        var minify = s.mode === "minify";
        var body = Array.prototype.map.call(doc.childNodes, function (n) {
          return serializeXml(n, 0, minify);
        }).join("");
        return ((decl ? decl[0].trim() + (minify ? "" : "\n") : "") + body).trim();
      }
    });
  });

  /* ---------- Cron explainer ---------- */
  C.register("dev/cron", function (root) {
    var input = h("input", { class: "single-input", type: "text", value: "*/15 9-17 * * 1-5", spellcheck: "false", style: "font-family:var(--mono);max-width:320px", "aria-label": "Cron expression" });
    var err = h("div", { class: "ta-err", role: "alert" });
    var desc = h("div", { class: "outbox", style: "font-family:Inter,ui-sans-serif,sans-serif;font-size:16px;font-weight:600;max-height:none", text: "-" });
    var runsBox = h("pre", { class: "outbox", style: "margin-top:13px" });
    var presets = h("span", { class: "mini-btns" }, [
      ["0 0 * * *", "Daily midnight"],
      ["*/15 * * * *", "Every 15 min"],
      ["0 9 * * 1-5", "Weekdays 9am"],
      ["0 0 1 * *", "Monthly"]
    ].map(function (p) {
      var b = h("button", { class: "mini", type: "button", text: p[1] });
      b.addEventListener("click", function () { input.value = p[0]; run(); });
      return b;
    }));

    root.appendChild(h("div", { class: "opts" }, [h("label", { class: "field" }, ["Expression ", input]), presets]));
    root.appendChild(err);
    root.appendChild(h("div", { class: "ta-label", style: "margin-top:13px" }, [h("span", { text: "In plain English" })]));
    root.appendChild(desc);
    root.appendChild(h("div", { class: "ta-label", style: "margin-top:13px" }, [h("span", { text: "Next 5 runs (your local time)" })]));
    root.appendChild(runsBox);

    var MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    var DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    var DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    function parseField(field, min, max, names) {
      var set = {};
      var restricted = true;
      field.toLowerCase().split(",").forEach(function (token) {
        var step = 1;
        var stepM = token.match(/^(.+)\/(\d+)$/);
        if (stepM) { token = stepM[1]; step = parseInt(stepM[2], 10); if (!step) throw new Error("Step of 0 in '" + field + "'."); }
        var lo, hi;
        if (token === "*") { lo = min; hi = max; if (step === 1) restricted = false; }
        else {
          var rangeM = token.match(/^(.+)-(.+)$/);
          function val(x) {
            if (names) { var i = names.indexOf(x.slice(0, 3)); if (i !== -1) return i + (names === MONTHS ? 1 : 0); }
            var n = parseInt(x, 10);
            if (!isFinite(n)) throw new Error("'" + x + "' isn't valid in '" + field + "'.");
            return n;
          }
          if (rangeM) { lo = val(rangeM[1]); hi = val(rangeM[2]); }
          else { lo = hi = val(token); }
        }
        if (names === DAYS) { if (lo === 7) lo = 0; if (hi === 7) hi = 0; }
        if (lo < min || hi > max || lo > hi) throw new Error("'" + field + "' is out of range (" + min + "-" + max + ").");
        for (var v = lo; v <= hi; v += step) set[v] = true;
      });
      return { set: set, restricted: restricted, text: field };
    }

    function parseCron(expr) {
      var parts = expr.trim().split(/\s+/);
      if (parts.length !== 5) throw new Error("A cron expression has 5 fields (minute hour day month weekday), this has " + parts.length + ".");
      return {
        min: parseField(parts[0], 0, 59),
        hour: parseField(parts[1], 0, 23),
        dom: parseField(parts[2], 1, 31),
        mon: parseField(parts[3], 1, 12, MONTHS),
        dow: parseField(parts[4], 0, 7, DAYS)
      };
    }

    function listText(f, mapper) {
      var vals = Object.keys(f.set).map(Number).sort(function (a, b) { return a - b; });
      var shown = vals.slice(0, 6).map(mapper);
      return shown.join(", ") + (vals.length > 6 ? " and " + (vals.length - 6) + " more" : "");
    }

    function describe(c, expr) {
      var stepM = expr.trim().split(/\s+/)[0].match(/^\*\/(\d+)$/);
      var time;
      var mins = Object.keys(c.min.set), hrs = Object.keys(c.hour.set);
      if (stepM && !c.hour.restricted) time = "Every " + stepM[1] + " minutes";
      else if (stepM) time = "Every " + stepM[1] + " minutes between " + listText(c.hour, function (hh) { return hh + ":00"; });
      else if (mins.length === 1 && hrs.length === 1) time = "At " + String(hrs[0]).padStart(2, "0") + ":" + String(mins[0]).padStart(2, "0");
      else if (mins.length === 1 && !c.hour.restricted) time = "At minute " + mins[0] + " of every hour";
      else time = "At minute " + listText(c.min, String) + (c.hour.restricted ? " past hour " + listText(c.hour, String) : " of every hour");
      var when = [];
      if (c.dom.restricted) when.push("on day " + listText(c.dom, String) + " of the month");
      if (c.dow.restricted) when.push((c.dom.restricted ? "or " : "") + "on " + listText(c.dow, function (d) { return DAY_FULL[d]; }));
      if (c.mon.restricted) when.push("in " + listText(c.mon, function (m) { return MONTH_FULL[m - 1]; }));
      return time + (when.length ? ", " + when.join(", ") : ", every day") + ".";
    }

    function nextRuns(c, count) {
      var runs = [];
      var t = new Date();
      t.setSeconds(0, 0);
      t.setMinutes(t.getMinutes() + 1);
      var domAny = !c.dom.restricted, dowAny = !c.dow.restricted;
      for (var i = 0; i < 750000 && runs.length < count; i++) {
        var dayOk = (domAny && dowAny) ||
          (!domAny && !dowAny && (c.dom.set[t.getDate()] || c.dow.set[t.getDay()])) ||
          (!domAny && dowAny && c.dom.set[t.getDate()]) ||
          (domAny && !dowAny && c.dow.set[t.getDay()]);
        if (c.mon.set[t.getMonth() + 1] && dayOk && c.hour.set[t.getHours()] && c.min.set[t.getMinutes()]) {
          runs.push(new Date(t));
        }
        t.setMinutes(t.getMinutes() + 1);
      }
      return runs;
    }

    function run() {
      err.classList.remove("show");
      var expr = input.value.trim();
      if (!expr) { desc.textContent = "-"; runsBox.textContent = ""; return; }
      try {
        var c = parseCron(expr);
        desc.textContent = describe(c, expr);
        var runs = nextRuns(c, 5);
        runsBox.textContent = runs.length
          ? runs.map(function (d) { return d.toLocaleString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }).join("\n")
          : "No runs in the next year, check the expression.";
        C.hashState.save({ i: expr });
      } catch (e) {
        desc.textContent = "-";
        runsBox.textContent = "";
        err.textContent = e.message;
        err.classList.add("show");
      }
    }
    input.addEventListener("input", debounce(run, 200));
    C.onRun(run);
    C.onClear(function () { input.value = ""; run(); });
    var st = C.hashState.load();
    if (st && st.i) input.value = st.i;
    run();
  });

  /* ---------- UUID generator ---------- */
  C.register("dev/uuid", function (root) {
    var count = h("input", { type: "number", value: "1", min: "1", max: "1000", "aria-label": "How many UUIDs" });
    var genBtn = h("button", { class: "mini primary", type: "button", text: "Generate" });
    var copyBtn = h("button", { class: "mini", type: "button", text: "Copy" });
    var out = h("pre", { class: "outbox", style: "max-height:none" });

    root.appendChild(h("div", { class: "opts", style: "margin:0 0 13px" }, [
      h("label", { class: "field" }, ["Count ", count]), genBtn
    ]));
    root.appendChild(h("div", { class: "ta-label" }, [h("span", { text: "UUIDs" }), h("span", { class: "mini-btns" }, [copyBtn])]));
    root.appendChild(out);

    function uuid() {
      if (crypto.randomUUID) return crypto.randomUUID();
      var b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      var s = Array.prototype.map.call(b, function (x) { return x.toString(16).padStart(2, "0"); }).join("");
      return s.slice(0, 8) + "-" + s.slice(8, 12) + "-" + s.slice(12, 16) + "-" + s.slice(16, 20) + "-" + s.slice(20);
    }
    function run() {
      var n = Math.max(1, Math.min(1000, parseInt(count.value, 10) || 1));
      var list = [];
      for (var i = 0; i < n; i++) list.push(uuid());
      out.textContent = list.join("\n");
    }
    genBtn.addEventListener("click", run);
    count.addEventListener("change", run);
    copyBtn.addEventListener("click", function () { if (out.textContent) C.copyText(out.textContent); });
    C.onRun(run);
    C.onClear(function () { out.textContent = ""; });
    run();
  });

  /* ---------- Password generator ---------- */
  C.register("dev/password", function (root) {
    var length = h("input", { type: "range", min: "8", max: "64", value: "16", "aria-label": "Password length" });
    var lenLabel = h("b", { text: "16" });
    function check(label, on) {
      var box = h("input", { type: "checkbox" });
      box.checked = on;
      return { box: box, wrap: h("label", { class: "field" }, [box, label]) };
    }
    var upper = check("A-Z", true), lower = check("a-z", true), digits = check("0-9", true), symbols = check("!@#$", true);
    var genBtn = h("button", { class: "mini primary", type: "button", text: "Generate" });
    var copyBtn = h("button", { class: "mini", type: "button", text: "Copy" });
    var out = h("input", { class: "single-input", type: "text", readonly: "readonly", style: "font-family:var(--mono)", "aria-label": "Generated password" });
    var strength = h("p", { class: "kbd-hint", style: "margin:10px 0 0" });

    root.appendChild(h("div", { class: "opts", style: "margin:0 0 13px" }, [
      h("label", { class: "field" }, ["Length ", length, lenLabel]),
      upper.wrap, lower.wrap, digits.wrap, symbols.wrap, genBtn
    ]));
    root.appendChild(h("div", { class: "ta-label" }, [h("span", { text: "Password" }), h("span", { class: "mini-btns" }, [copyBtn])]));
    root.appendChild(out);
    root.appendChild(strength);

    var SETS = {
      upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      lower: "abcdefghijklmnopqrstuvwxyz",
      digits: "0123456789",
      symbols: "!@#$%^&*()-_=+[]{};:,.?/"
    };
    function run() {
      var chars = (upper.box.checked ? SETS.upper : "") + (lower.box.checked ? SETS.lower : "") +
        (digits.box.checked ? SETS.digits : "") + (symbols.box.checked ? SETS.symbols : "");
      lenLabel.textContent = length.value;
      if (!chars) { out.value = ""; strength.textContent = "Pick at least one character set."; return; }
      var n = parseInt(length.value, 10);
      // Rejection sampling keeps the draw uniform across the charset.
      var limit = Math.floor(4294967296 / chars.length) * chars.length;
      var pw = "", buf = new Uint32Array(1);
      while (pw.length < n) {
        crypto.getRandomValues(buf);
        if (buf[0] < limit) pw += chars[buf[0] % chars.length];
      }
      out.value = pw;
      var bits = Math.round(n * Math.log2(chars.length));
      strength.textContent = "About " + bits + " bits of entropy, " +
        (bits < 50 ? "weak, use more length or character sets." : bits < 80 ? "good for most accounts." : "strong.");
    }
    genBtn.addEventListener("click", run);
    length.addEventListener("input", run);
    [upper.box, lower.box, digits.box, symbols.box].forEach(function (b) { b.addEventListener("change", run); });
    copyBtn.addEventListener("click", function () { if (out.value) C.copyText(out.value); });
    C.onRun(run);
    C.onClear(function () { out.value = ""; strength.textContent = ""; });
    run();
  });

  /* ---------- QR code generator ---------- */
  C.register("dev/qr-code", function (root) {
    var input = h("textarea", { class: "ta", placeholder: "https://example.com or any text...", spellcheck: "false", style: "min-height:96px", "aria-label": "QR code content" });
    var size = h("select", { "aria-label": "QR size" }, [
      h("option", { value: "200", text: "200 px" }),
      h("option", { value: "300", text: "300 px" }),
      h("option", { value: "400", text: "400 px" }),
      h("option", { value: "600", text: "600 px (print)" })
    ]);
    size.value = "300";
    var dlBtn = h("button", { class: "mini primary", type: "button", text: "Download PNG" });
    var err = h("div", { class: "ta-err", role: "alert" });
    var box = h("div", { style: "display:none;background:#fff;padding:16px;border-radius:10px;margin-top:13px;width:fit-content" });

    root.appendChild(h("div", { class: "ta-label" }, [h("span", { text: "Content" })]));
    root.appendChild(input);
    root.appendChild(h("div", { class: "opts", style: "margin-top:13px" }, [
      h("label", { class: "field" }, ["Size ", size]), dlBtn
    ]));
    root.appendChild(err);
    root.appendChild(box);

    function run() {
      err.classList.remove("show");
      box.innerHTML = "";
      var text = input.value.trim();
      if (!text) { box.style.display = "none"; return; }
      if (typeof QRCode === "undefined") {
        err.textContent = "QR library failed to load, refresh the page.";
        err.classList.add("show");
        return;
      }
      try {
        var px = parseInt(size.value, 10);
        new QRCode(box, { text: text, width: px, height: px, correctLevel: QRCode.CorrectLevel.M });
        box.style.display = "";
      } catch (e) {
        box.style.display = "none";
        err.textContent = "That content is too long for a QR code, try shortening it.";
        err.classList.add("show");
      }
    }
    input.addEventListener("input", debounce(run, 200));
    size.addEventListener("change", run);
    dlBtn.addEventListener("click", function () {
      var canvas = box.querySelector("canvas");
      if (!canvas) return;
      // Re-draw with a white quiet zone so printed codes stay scannable.
      var margin = Math.round(canvas.width / 12);
      var big = document.createElement("canvas");
      big.width = canvas.width + margin * 2;
      big.height = canvas.height + margin * 2;
      var ctx = big.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, big.width, big.height);
      ctx.drawImage(canvas, margin, margin);
      big.toBlob(function (blob) { if (blob) C.download(blob, "qr-code.png"); }, "image/png");
    });
    C.onRun(run);
    C.onClear(function () { input.value = ""; run(); });
  });

  C.boot();
})();
