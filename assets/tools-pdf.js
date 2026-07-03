/* Convertze PDF tools: merge, split, compress, images-to-pdf, pdf-to-images, pdf-to-text, html-to-pdf, markdown-to-pdf. */
(function () {
  "use strict";
  var C = window.Convertze;
  var h = C.h;

  if (typeof pdfjsLib !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  function needs(name, ok) {
    if (!ok) throw new Error(name + " library failed to load, check your connection and refresh the page.");
  }

  function isPdf(f) { return f.type === "application/pdf" || /\.pdf$/i.test(f.name); }

  /* Reorderable file list. */
  function orderedList(parent, state, onChange) {
    var ul = h("ul", { class: "file-list" });
    parent.appendChild(ul);
    function render() {
      ul.innerHTML = "";
      state.files.forEach(function (f, i) {
        ul.appendChild(h("li", null, [
          h("span", { class: "f-name", text: (i + 1) + ". " + f.name }),
          h("span", { class: "f-size", text: C.fmtKB(f.size) }),
          h("button", { type: "button", "aria-label": "Move up", text: "↑", onclick: function () {
            if (i > 0) { state.files.splice(i - 1, 0, state.files.splice(i, 1)[0]); render(); }
          } }),
          h("button", { type: "button", "aria-label": "Move down", text: "↓", onclick: function () {
            if (i < state.files.length - 1) { state.files.splice(i + 1, 0, state.files.splice(i, 1)[0]); render(); }
          } }),
          h("button", { type: "button", "aria-label": "Remove " + f.name, text: "✕", onclick: function () {
            state.files.splice(i, 1);
            render();
            onChange();
          } })
        ]));
      });
      ul.style.display = state.files.length ? "" : "none";
    }
    render();
    return render;
  }

  /* Shared scaffold: dropzone + (ordered) list + options + action + status. */
  function pdfTool(root, cfg) {
    var state = { files: [] };
    var status, renderList;
    C.dropzone(root, {
      accept: cfg.accept,
      multiple: cfg.multiple,
      label: cfg.label,
      sub: cfg.sub || (cfg.multiple ? "or click to browse, multiple files supported" : "or click to browse"),
      onFiles: function (files) {
        var ok = cfg.filter ? files.filter(cfg.filter) : files;
        if (!ok.length) { status.set("error", cfg.badFileMsg || "That file type isn't supported here."); return; }
        state.files = cfg.multiple ? state.files.concat(ok) : [ok[0]];
        renderList();
        status.set("done", state.files.length + " file" + (state.files.length > 1 ? "s" : "") + " ready.");
        btn.disabled = false;
      }
    });
    renderList = orderedList(root, state, function () {
      btn.disabled = !state.files.length;
      if (!state.files.length) status.set("idle", "Ready when you are.");
    });
    var optsRow = h("div", { class: "opts" });
    root.appendChild(optsRow);
    var getSettings = cfg.options ? cfg.options(optsRow) : function () { return {}; };
    var btn = h("button", { class: "btn", type: "button", disabled: true, text: cfg.cta });
    root.appendChild(h("div", { class: "actions-row" }, [btn]));
    status = C.makeStatus(root);
    var extra = h("div");
    root.appendChild(extra);

    async function run() {
      if (!state.files.length || btn.disabled) return;
      btn.disabled = true;
      try {
        await cfg.run(state.files, getSettings(), status, extra);
      } catch (err) {
        status.set("error", err && err.message ? err.message : "Something went wrong.");
      }
      btn.disabled = false;
    }
    btn.addEventListener("click", run);
    C.onRun(run);
    C.onClear(function () { state.files = []; renderList(); extra.innerHTML = ""; btn.disabled = true; status.set("idle", "Cleared."); });
    return { state: state, status: function () { return status; } };
  }

  function parsePageRange(rangeText, totalPages) {
    if (!rangeText || !rangeText.trim() || rangeText.trim().toLowerCase() === "all") {
      return Array.from({ length: totalPages }, function (_, i) { return i; });
    }
    var used = {}, out = [];
    rangeText.split(",").forEach(function (token) {
      token = token.trim();
      if (!token) return;
      var m = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        if (a > b) { var t = a; a = b; b = t; }
        for (var p = a; p <= b; p++) {
          if (p < 1 || p > totalPages) throw new Error("Page " + p + " is out of range (1-" + totalPages + ").");
          if (!used[p]) { used[p] = true; out.push(p - 1); }
        }
      } else {
        var n = parseInt(token, 10);
        if (!isFinite(n) || n < 1 || n > totalPages) throw new Error("'" + token + "' isn't a valid page (1-" + totalPages + ").");
        if (!used[n]) { used[n] = true; out.push(n - 1); }
      }
    });
    if (!out.length) throw new Error("No pages selected.");
    return out;
  }

  /* ---------- Merge ---------- */
  C.register("pdf/merge", function (root) {
    pdfTool(root, {
      accept: "application/pdf,.pdf",
      multiple: true,
      filter: isPdf,
      badFileMsg: "Please choose PDF files.",
      label: "Drop PDF files here",
      sub: "Add two or more, reorder with the arrows",
      cta: "Merge PDFs",
      run: async function (files, s, status) {
        needs("PDF", typeof PDFLib !== "undefined" && PDFLib.PDFDocument);
        if (files.length < 2) throw new Error("Add at least 2 PDF files to merge.");
        status.set("processing", "Merging " + files.length + " PDFs...");
        var merged = await PDFLib.PDFDocument.create();
        for (var i = 0; i < files.length; i++) {
          status.set("processing", "Adding " + files[i].name + " (" + (i + 1) + "/" + files.length + ")...");
          var src = await PDFLib.PDFDocument.load(await files[i].arrayBuffer(), { ignoreEncryption: true });
          var pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach(function (p) { merged.addPage(p); });
        }
        var out = await merged.save();
        var name = C.baseName(files[0].name) + "_merged.pdf";
        C.download(new Blob([out], { type: "application/pdf" }), name);
        status.set("done", "Merged " + files.length + " files → " + name);
        C.toast("ok", "Downloaded " + name);
      }
    });
  });

  /* ---------- Split ---------- */
  C.register("pdf/split", function (root) {
    pdfTool(root, {
      accept: "application/pdf,.pdf",
      multiple: false,
      filter: isPdf,
      badFileMsg: "Please choose a PDF file.",
      label: "Drop a PDF to split",
      cta: "Split & download",
      options: function (row) {
        var range = h("input", { type: "text", placeholder: "all or 1-3,5,8", style: "width:150px" });
        row.appendChild(h("label", { class: "field" }, ["Pages ", range]));
        return function () { return { range: range.value }; };
      },
      run: async function (files, s, status) {
        needs("PDF", typeof PDFLib !== "undefined" && PDFLib.PDFDocument);
        var base = C.baseName(files[0].name);
        status.set("processing", "Reading PDF...");
        var src = await PDFLib.PDFDocument.load(await files[0].arrayBuffer(), { ignoreEncryption: true });
        var pages = parsePageRange(s.range, src.getPageCount());
        var outputs = [];
        for (var i = 0; i < pages.length; i++) {
          status.set("processing", "Extracting page " + (pages[i] + 1) + " (" + (i + 1) + "/" + pages.length + ")...");
          var one = await PDFLib.PDFDocument.create();
          var copied = await one.copyPages(src, [pages[i]]);
          one.addPage(copied[0]);
          outputs.push({ name: base + "_page" + (pages[i] + 1) + ".pdf", data: await one.save() });
        }
        var delivered = await C.deliver(outputs, base + "_split.zip");
        status.set("done", pages.length + " page(s) → " + delivered);
        C.toast("ok", "Downloaded " + delivered);
      }
    });
  });

  /* ---------- Compress ---------- */
  C.register("pdf/compress", function (root) {
    pdfTool(root, {
      accept: "application/pdf,.pdf",
      multiple: false,
      filter: isPdf,
      badFileMsg: "Please choose a PDF file.",
      label: "Drop a PDF to compress",
      cta: "Compress & download",
      options: function (row) {
        var mode = h("select", { "aria-label": "Compression mode" }, [
          h("option", { value: "quality", text: "Pick a quality" }),
          h("option", { value: "target", text: "Hit a target size" })
        ]);
        var q = h("input", { type: "range", min: "20", max: "90", value: "60" });
        var qv = h("span", { text: "60" });
        q.addEventListener("input", function () { qv.textContent = q.value; });
        var qWrap = h("label", { class: "field" }, ["Quality ", q, qv, "%"]);
        var target = h("input", { type: "number", value: "200", min: "20", max: "20000", style: "width:80px" });
        var tWrap = h("label", { class: "field", style: "display:none" }, ["Target ", target, " KB"]);
        mode.addEventListener("change", function () {
          qWrap.style.display = mode.value === "quality" ? "" : "none";
          tWrap.style.display = mode.value === "target" ? "" : "none";
        });
        row.appendChild(h("label", { class: "field" }, ["Mode ", mode]));
        row.appendChild(qWrap);
        row.appendChild(tWrap);
        row.appendChild(h("span", { class: "kbd-hint", text: "Pages become images; text stops being selectable." }));
        return function () {
          return { mode: mode.value, quality: parseInt(q.value, 10) / 100, targetKB: parseInt(target.value, 10) || 200 };
        };
      },
      run: async function (files, s, status) {
        needs("PDF rendering", typeof pdfjsLib !== "undefined");
        needs("PDF writing", window.jspdf && window.jspdf.jsPDF);
        var file = files[0];
        var pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        var canvases = [];
        for (var p = 1; p <= pdf.numPages; p++) {
          status.set("processing", "Rendering page " + p + " of " + pdf.numPages + "...");
          var page = await pdf.getPage(p);
          var viewport = page.getViewport({ scale: 1.5 });
          var canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
          canvases.push(canvas);
        }
        function build(quality, downscale) {
          var doc = null;
          canvases.forEach(function (cv) {
            var src = cv;
            if (downscale && downscale < 1) {
              var small = document.createElement("canvas");
              small.width = Math.max(1, Math.round(cv.width * downscale));
              small.height = Math.max(1, Math.round(cv.height * downscale));
              small.getContext("2d").drawImage(cv, 0, 0, small.width, small.height);
              src = small;
            }
            var wPt = cv.width * 0.48, hPt = cv.height * 0.48; // back to ~72dpi points
            if (!doc) {
              doc = new window.jspdf.jsPDF({ unit: "pt", format: [wPt, hPt], orientation: wPt > hPt ? "l" : "p" });
            } else {
              doc.addPage([wPt, hPt], wPt > hPt ? "l" : "p");
            }
            doc.addImage(src.toDataURL("image/jpeg", quality), "JPEG", 0, 0, wPt, hPt);
          });
          return doc.output("blob");
        }
        var blob, note = "";
        if (s.mode === "target") {
          var limit = s.targetKB * 1024;
          var scales = [1, 0.72, 0.5];
          blob = null;
          for (var si = 0; si < scales.length && !blob; si++) {
            status.set("processing", "Searching for the best quality under " + s.targetKB + " KB...");
            var floor = build(0.15, scales[si]);
            if (floor.size > limit) continue; // even lowest quality too big at this scale
            var lo = 0.15, hi = 0.9, best = floor;
            for (var it = 0; it < 6; it++) {
              var mid = (lo + hi) / 2;
              var attempt = build(mid, scales[si]);
              if (attempt.size <= limit) { best = attempt; lo = mid; }
              else hi = mid;
            }
            blob = best;
            if (si > 0) note = " (dimensions reduced to fit)";
          }
          if (!blob) {
            blob = build(0.15, 0.5);
            note = " (couldn't reach " + s.targetKB + " KB, this is the smallest achievable)";
          }
        } else {
          status.set("processing", "Compressing " + canvases.length + " page(s)...");
          blob = build(s.quality, 1);
        }
        var name = C.baseName(file.name) + "_compressed.pdf";
        C.download(blob, name);
        var saved = Math.max(0, Math.round((1 - blob.size / file.size) * 100));
        status.set("done", C.fmtKB(file.size) + " → " + C.fmtKB(blob.size) + " (" + saved + "% smaller)" + note + ". Downloaded " + name);
        C.toast("ok", saved + "% smaller, downloaded");
      }
    });
  });

  /* ---------- Images to PDF ---------- */
  C.register("pdf/images-to-pdf", function (root) {
    pdfTool(root, {
      accept: "image/jpeg,image/png,image/webp",
      multiple: true,
      filter: function (f) { return /^image\//.test(f.type) && !/svg/.test(f.type); },
      badFileMsg: "Please choose JPG, PNG or WebP images.",
      label: "Drop images here",
      sub: "One image per A4 page, in list order",
      cta: "Create PDF",
      run: async function (files, s, status) {
        needs("PDF writing", window.jspdf && window.jspdf.jsPDF);
        var doc = new window.jspdf.jsPDF("p", "pt", "a4");
        var pageW = doc.internal.pageSize.getWidth();
        var pageH = doc.internal.pageSize.getHeight();
        var margin = 24;
        for (var i = 0; i < files.length; i++) {
          status.set("processing", "Adding image " + (i + 1) + " of " + files.length + "...");
          var loaded = await C.loadImage(files[i]);
          var img = loaded.img;
          // Re-encode through a canvas so WebP and exotic formats can't break jsPDF.
          var canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          loaded.revoke();
          var dataUrl = canvas.toDataURL("image/jpeg", 0.92);
          if (i > 0) doc.addPage();
          var maxW = pageW - margin * 2, maxH = pageH - margin * 2;
          var sc = Math.min(maxW / canvas.width, maxH / canvas.height);
          var w = canvas.width * sc, hgt = canvas.height * sc;
          doc.addImage(dataUrl, "JPEG", (pageW - w) / 2, (pageH - hgt) / 2, w, hgt);
        }
        var name = C.baseName(files[0].name) + (files.length > 1 ? "_combined.pdf" : ".pdf");
        C.download(doc.output("blob"), name);
        status.set("done", files.length + " image(s) → " + name);
        C.toast("ok", "Downloaded " + name);
      }
    });
  });

  /* ---------- PDF to images ---------- */
  C.register("pdf/pdf-to-images", function (root) {
    pdfTool(root, {
      accept: "application/pdf,.pdf",
      multiple: false,
      filter: isPdf,
      badFileMsg: "Please choose a PDF file.",
      label: "Drop a PDF here",
      cta: "Convert & download",
      options: function (row) {
        var fmt = h("select", { "aria-label": "Image format" }, [
          h("option", { value: "jpg", text: "JPG (smaller)" }),
          h("option", { value: "png", text: "PNG (lossless)" })
        ]);
        row.appendChild(h("label", { class: "field" }, ["Format ", fmt]));
        return function () { return { fmt: fmt.value }; };
      },
      run: async function (files, s, status) {
        needs("PDF rendering", typeof pdfjsLib !== "undefined");
        var base = C.baseName(files[0].name);
        var pdf = await pdfjsLib.getDocument({ data: await files[0].arrayBuffer() }).promise;
        var mime = s.fmt === "jpg" ? "image/jpeg" : "image/png";
        var outputs = [];
        for (var p = 1; p <= pdf.numPages; p++) {
          status.set("processing", "Rendering page " + p + " of " + pdf.numPages + "...");
          var page = await pdf.getPage(p);
          var viewport = page.getViewport({ scale: 2 });
          var canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          var ctx = canvas.getContext("2d");
          if (s.fmt === "jpg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;
          outputs.push({
            name: pdf.numPages > 1 ? base + "_page" + p + "." + s.fmt : base + "." + s.fmt,
            data: await C.canvasToBlob(canvas, mime, 0.92)
          });
        }
        var delivered = await C.deliver(outputs, base + "_" + s.fmt + ".zip");
        status.set("done", pdf.numPages + " page(s) → " + delivered);
        C.toast("ok", "Downloaded " + delivered);
      }
    });
  });

  /* ---------- PDF to text ---------- */
  C.register("pdf/pdf-to-text", function (root) {
    var tool = pdfTool(root, {
      accept: "application/pdf,.pdf",
      multiple: false,
      filter: isPdf,
      badFileMsg: "Please choose a PDF file.",
      label: "Drop a PDF here",
      cta: "Extract text",
      run: async function (files, s, status, extra) {
        needs("PDF rendering", typeof pdfjsLib !== "undefined");
        var base = C.baseName(files[0].name);
        var pdf = await pdfjsLib.getDocument({ data: await files[0].arrayBuffer() }).promise;
        var parts = [];
        for (var p = 1; p <= pdf.numPages; p++) {
          status.set("processing", "Extracting page " + p + " of " + pdf.numPages + "...");
          var content = await (await pdf.getPage(p)).getTextContent();
          parts.push(content.items.map(function (it) { return it.str; }).join(" "));
        }
        var text = parts.join("\n\n");
        extra.innerHTML = "";
        if (!text.trim()) {
          status.set("error", "No text layer found, this looks like a scanned PDF (it needs OCR).");
          return;
        }
        var pre = h("pre", { class: "outbox", text: text });
        extra.appendChild(h("div", { class: "ta-label", style: "margin-top:14px" }, [
          h("span", { text: "Extracted text (" + pdf.numPages + " pages)" }),
          h("span", { class: "mini-btns" }, [
            h("button", { class: "mini primary", type: "button", text: "Copy", onclick: function () { C.copyText(text); } }),
            h("button", { class: "mini", type: "button", text: "Download .txt", onclick: function () {
              C.download(new Blob([text], { type: "text/plain" }), base + ".txt");
            } })
          ])
        ]));
        extra.appendChild(pre);
        status.set("done", "Extracted text from " + pdf.numPages + " page(s).");
      }
    });
  });

  /* ---------- Shared HTML → paged PDF pipeline ---------- */
  async function renderHtmlToPdf(html, status, outName, styleText) {
    needs("HTML rendering", typeof html2canvas !== "undefined");
    needs("PDF writing", window.jspdf && window.jspdf.jsPDF);
    status.set("processing", "Rendering page...");
    var host = document.createElement("div");
    host.style.cssText = "position:absolute;left:-10000px;top:0;width:794px;background:#ffffff;color:#111827;padding:32px;font-family:Georgia,serif;font-size:14px;line-height:1.65;";
    if (styleText) {
      var st = document.createElement("style");
      st.textContent = styleText;
      host.appendChild(st);
    }
    var content = document.createElement("div");
    content.className = "cz-render";
    content.innerHTML = html;
    host.appendChild(content);
    document.body.appendChild(host);
    try {
      var canvas = await html2canvas(host, { scale: 2, backgroundColor: "#ffffff", windowWidth: 900, logging: false });
      var doc = new window.jspdf.jsPDF("p", "pt", "a4");
      var margin = 24;
      var innerW = doc.internal.pageSize.getWidth() - margin * 2;
      var innerH = doc.internal.pageSize.getHeight() - margin * 2;
      var sliceH = Math.floor(canvas.width * (innerH / innerW));
      var pages = Math.max(1, Math.ceil(canvas.height / sliceH));
      for (var i = 0; i < pages; i++) {
        status.set("processing", "Building PDF page " + (i + 1) + " of " + pages + "...");
        var slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = Math.min(sliceH, canvas.height - i * sliceH);
        var sctx = slice.getContext("2d");
        sctx.fillStyle = "#ffffff";
        sctx.fillRect(0, 0, slice.width, slice.height);
        sctx.drawImage(canvas, 0, i * sliceH, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        if (i > 0) doc.addPage();
        doc.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, innerW, innerW * (slice.height / slice.width));
      }
      C.download(doc.output("blob"), outName);
      status.set("done", pages + " page(s) → " + outName);
      C.toast("ok", "Downloaded " + outName);
    } finally {
      host.remove();
    }
  }

  var MD_STYLE = [
    ".cz-render h1,.cz-render h2,.cz-render h3{font-family:Arial,Helvetica,sans-serif;line-height:1.3;margin:1.1em 0 .45em}",
    ".cz-render h1{font-size:24px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}",
    ".cz-render h2{font-size:19px}.cz-render h3{font-size:16px}",
    ".cz-render p,.cz-render li{margin:.45em 0}",
    ".cz-render code{font-family:Consolas,monospace;font-size:12.5px;background:#f3f4f6;padding:1px 5px;border-radius:4px}",
    ".cz-render pre{background:#f3f4f6;padding:12px;border-radius:6px;overflow:hidden;white-space:pre-wrap}",
    ".cz-render pre code{background:none;padding:0}",
    ".cz-render blockquote{margin:.6em 0;padding:.1em 1em;border-left:3px solid #d1d5db;color:#4b5563}",
    ".cz-render table{border-collapse:collapse;margin:.6em 0}",
    ".cz-render th,.cz-render td{border:1px solid #d1d5db;padding:5px 10px;font-size:13px}",
    ".cz-render img{max-width:100%}"
  ].join("");

  /* ---------- HTML to PDF ---------- */
  C.register("pdf/html-to-pdf", function (root) {
    pdfTool(root, {
      accept: ".html,.htm,text/html",
      multiple: false,
      filter: function (f) { return f.type === "text/html" || /\.html?$/i.test(f.name); },
      badFileMsg: "Please choose an .html file.",
      label: "Drop an .html file here",
      cta: "Convert to PDF",
      run: async function (files, s, status) {
        var html = await C.readFile(files[0], "text");
        await renderHtmlToPdf(html, status, C.baseName(files[0].name) + ".pdf");
      }
    });
  });

  /* ---------- Markdown to PDF ---------- */
  C.register("pdf/markdown-to-pdf", function (root) {
    pdfTool(root, {
      accept: ".md,.markdown,.txt,text/plain",
      multiple: false,
      filter: function (f) { return /\.(md|markdown|txt)$/i.test(f.name) || (f.type && f.type.indexOf("text/") === 0); },
      badFileMsg: "Please choose a .md or .txt file.",
      label: "Drop a .md or .txt file here",
      cta: "Convert to PDF",
      run: async function (files, s, status) {
        needs("Markdown", typeof marked !== "undefined");
        var text = await C.readFile(files[0], "text");
        var html = /\.(md|markdown)$/i.test(files[0].name)
          ? marked.parse(text)
          : "<pre style='white-space:pre-wrap;font-family:Georgia,serif'>" +
            text.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</pre>";
        await renderHtmlToPdf(html, status, C.baseName(files[0].name) + ".pdf", MD_STYLE);
      }
    });
  });

  /* ---------- PDF to Markdown ---------- */
  C.register("pdf/pdf-to-markdown", function (root) {
    pdfTool(root, {
      accept: "application/pdf,.pdf",
      multiple: false,
      filter: isPdf,
      badFileMsg: "Please choose a PDF file.",
      label: "Drop a PDF here",
      sub: "Digital PDFs only, scans have no text to extract",
      cta: "Convert to Markdown",
      run: async function (files, s, status, extra) {
        needs("PDF rendering", typeof pdfjsLib !== "undefined");
        var base = C.baseName(files[0].name);
        var pdf = await pdfjsLib.getDocument({ data: await files[0].arrayBuffer() }).promise;
        var pages = [];
        for (var p = 1; p <= pdf.numPages; p++) {
          status.set("processing", "Reading page " + p + " of " + pdf.numPages + "...");
          var content = await (await pdf.getPage(p)).getTextContent();

          /* Group text items into visual lines by their y position. */
          var lines = [];
          content.items.forEach(function (it) {
            if (!it.str || !it.str.trim()) return;
            var y = it.transform[5];
            var hgt = it.height || Math.abs(it.transform[3]) || 10;
            var line = null;
            for (var li = 0; li < lines.length; li++) {
              if (Math.abs(lines[li].y - y) <= 2.5) { line = lines[li]; break; }
            }
            if (!line) { line = { y: y, h: hgt, parts: [] }; lines.push(line); }
            line.parts.push({ x: it.transform[4], str: it.str });
            if (hgt > line.h) line.h = hgt;
          });
          lines.sort(function (a, b) { return b.y - a.y; });
          lines.forEach(function (l) {
            l.parts.sort(function (a, b) { return a.x - b.x; });
            l.text = l.parts.map(function (pt) { return pt.str; }).join(" ").replace(/\s+/g, " ").trim();
          });

          /* Body text size = median line height; larger sizes become headings. */
          var hs = lines.map(function (l) { return l.h; }).sort(function (a, b) { return a - b; });
          var body = hs.length ? hs[Math.floor(hs.length / 2)] : 10;
          var headingSizes = [];
          lines.forEach(function (l) {
            var r = Math.round(l.h * 2) / 2;
            if (l.h > body * 1.25 && headingSizes.indexOf(r) === -1) headingSizes.push(r);
          });
          headingSizes.sort(function (a, b) { return b - a; });

          var out = [], prevY = null, prevH = body;
          lines.forEach(function (l) {
            if (!l.text) return;
            var tier = headingSizes.indexOf(Math.round(l.h * 2) / 2);
            var gap = prevY == null ? Infinity : prevY - l.y;
            if (tier !== -1 && l.text.length < 120) {
              out.push("");
              out.push("#".repeat(Math.min(3, tier + 1)) + " " + l.text);
              out.push("");
            } else if (/^[•·▪‣∙◦*]\s*/.test(l.text) || /^[-–]\s+/.test(l.text)) {
              out.push("- " + l.text.replace(/^[•·▪‣∙◦*\-–]\s*/, ""));
            } else if (/^\d{1,3}[.)]\s+/.test(l.text)) {
              out.push(l.text.replace(/^(\d{1,3})[.)]\s+/, "$1. "));
            } else {
              var last = out.length ? out[out.length - 1] : "";
              var newPara = gap > Math.max(l.h, prevH) * 1.7;
              if (!newPara && last && last !== "" && last.charAt(0) !== "#" && last.charAt(0) !== "-" && !/^\d{1,3}\. /.test(last)) {
                out[out.length - 1] = last + " " + l.text; // continue the paragraph
              } else {
                if (newPara && last !== "") out.push("");
                out.push(l.text);
              }
            }
            prevY = l.y;
            prevH = l.h || body;
          });
          pages.push(out.join("\n").replace(/\n{3,}/g, "\n\n").trim());
        }
        var md = pages.filter(Boolean).join("\n\n");
        extra.innerHTML = "";
        if (!md.trim()) {
          status.set("error", "No text layer found, this looks like a scanned PDF (it needs OCR).");
          return;
        }
        var pre = h("pre", { class: "outbox", text: md });
        extra.appendChild(h("div", { class: "ta-label", style: "margin-top:14px" }, [
          h("span", { text: "Markdown (" + pdf.numPages + " pages)" }),
          h("span", { class: "mini-btns" }, [
            h("button", { class: "mini primary", type: "button", text: "Copy", onclick: function () { C.copyText(md); } }),
            h("button", { class: "mini", type: "button", text: "Download .md", onclick: function () {
              C.download(new Blob([md], { type: "text/markdown" }), base + ".md");
            } })
          ])
        ]));
        extra.appendChild(pre);
        status.set("done", "Converted " + pdf.numPages + " page(s) to Markdown. Check headings and lists, structure is inferred.");
      }
    });
  });

  /* ---------- Rotate PDF ---------- */
  C.register("pdf/rotate", function (root) {
    pdfTool(root, {
      accept: "application/pdf,.pdf",
      multiple: false,
      filter: isPdf,
      badFileMsg: "Please choose a PDF file.",
      label: "Drop a PDF to rotate",
      cta: "Rotate & download",
      options: function (row) {
        var angle = h("select", { "aria-label": "Rotation angle" }, [
          h("option", { value: "90", text: "90° clockwise" }),
          h("option", { value: "180", text: "180°" }),
          h("option", { value: "270", text: "90° counter-clockwise" })
        ]);
        var range = h("input", { type: "text", placeholder: "all or 1-3,5", style: "width:130px" });
        row.appendChild(h("label", { class: "field" }, ["Rotate ", angle]));
        row.appendChild(h("label", { class: "field" }, ["Pages ", range]));
        return function () { return { angle: parseInt(angle.value, 10), range: range.value }; };
      },
      run: async function (files, s, status) {
        needs("PDF", typeof PDFLib !== "undefined" && PDFLib.PDFDocument);
        status.set("processing", "Reading PDF...");
        var doc = await PDFLib.PDFDocument.load(await files[0].arrayBuffer(), { ignoreEncryption: true });
        var pages = parsePageRange(s.range, doc.getPageCount());
        pages.forEach(function (idx) {
          var page = doc.getPage(idx);
          page.setRotation(PDFLib.degrees((page.getRotation().angle + s.angle) % 360));
        });
        var out = await doc.save();
        var name = C.baseName(files[0].name) + "_rotated.pdf";
        C.download(new Blob([out], { type: "application/pdf" }), name);
        status.set("done", pages.length + " page(s) rotated → " + name);
        C.toast("ok", "Downloaded " + name);
      }
    });
  });

  /* ---------- Watermark PDF ---------- */
  C.register("pdf/watermark", function (root) {
    pdfTool(root, {
      accept: "application/pdf,.pdf",
      multiple: false,
      filter: isPdf,
      badFileMsg: "Please choose a PDF file.",
      label: "Drop a PDF to watermark",
      cta: "Watermark & download",
      options: function (row) {
        var text = h("input", { type: "text", value: "CONFIDENTIAL", style: "width:170px", "aria-label": "Watermark text" });
        var opacity = h("input", { type: "range", min: "5", max: "60", value: "15" });
        var ov = h("span", { text: "15" });
        opacity.addEventListener("input", function () { ov.textContent = opacity.value; });
        var angle = h("select", { "aria-label": "Orientation" }, [
          h("option", { value: "diag", text: "Diagonal" }),
          h("option", { value: "flat", text: "Horizontal" })
        ]);
        var range = h("input", { type: "text", placeholder: "all or 1-3,5", style: "width:110px" });
        row.appendChild(h("label", { class: "field" }, ["Text ", text]));
        row.appendChild(h("label", { class: "field" }, ["Opacity ", opacity, ov, "%"]));
        row.appendChild(h("label", { class: "field" }, [angle]));
        row.appendChild(h("label", { class: "field" }, ["Pages ", range]));
        return function () {
          return { text: text.value || "CONFIDENTIAL", opacity: parseInt(opacity.value, 10) / 100, diag: angle.value === "diag", range: range.value };
        };
      },
      run: async function (files, s, status) {
        needs("PDF", typeof PDFLib !== "undefined" && PDFLib.PDFDocument);
        status.set("processing", "Reading PDF...");
        var doc = await PDFLib.PDFDocument.load(await files[0].arrayBuffer(), { ignoreEncryption: true });
        var font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        var pages = parsePageRange(s.range, doc.getPageCount());
        pages.forEach(function (idx) {
          var page = doc.getPage(idx);
          var pw = page.getWidth(), ph = page.getHeight();
          // Size the text to span most of the page diagonal or width.
          var span = s.diag ? Math.sqrt(pw * pw + ph * ph) * 0.7 : pw * 0.8;
          var size = span / Math.max(4, s.text.length * 0.55);
          var tw = font.widthOfTextAtSize(s.text, size);
          var angleDeg = s.diag ? Math.atan2(ph, pw) * 180 / Math.PI : 0;
          var rad = angleDeg * Math.PI / 180;
          // Center the rotated baseline on the page centre.
          var x = pw / 2 - (tw / 2) * Math.cos(rad);
          var y = ph / 2 - (tw / 2) * Math.sin(rad);
          page.drawText(s.text, {
            x: x, y: y, size: size, font: font,
            color: PDFLib.rgb(0.45, 0.45, 0.45),
            opacity: s.opacity,
            rotate: PDFLib.degrees(angleDeg)
          });
        });
        var out = await doc.save();
        var name = C.baseName(files[0].name) + "_watermarked.pdf";
        C.download(new Blob([out], { type: "application/pdf" }), name);
        status.set("done", pages.length + " page(s) watermarked → " + name);
        C.toast("ok", "Downloaded " + name);
      }
    });
  });

  /* ---------- Reorder / delete pages ---------- */
  C.register("pdf/reorder", function (root) {
    var state = { bytes: null, order: [], name: "" };
    var status;
    var grid = h("div", { class: "result-grid", style: "margin-top:14px" });
    var btn = h("button", { class: "btn", type: "button", disabled: true, text: "Rebuild & download" });

    C.dropzone(root, {
      accept: "application/pdf,.pdf",
      multiple: false,
      label: "Drop a PDF to reorder or delete pages",
      sub: "or click to browse",
      onFiles: async function (files) {
        var f = files.filter(isPdf)[0];
        if (!f) { status.set("error", "Please choose a PDF file."); return; }
        try {
          needs("PDF rendering", typeof pdfjsLib !== "undefined");
          state.name = f.name;
          state.bytes = await f.arrayBuffer();
          var pdf = await pdfjsLib.getDocument({ data: state.bytes.slice(0) }).promise;
          state.order = [];
          state.thumbs = [];
          for (var p = 1; p <= pdf.numPages; p++) {
            status.set("processing", "Rendering page " + p + " of " + pdf.numPages + "...");
            var page = await pdf.getPage(p);
            var vp1 = page.getViewport({ scale: 1 });
            var viewport = page.getViewport({ scale: 110 / vp1.width });
            var cv = document.createElement("canvas");
            cv.width = viewport.width;
            cv.height = viewport.height;
            var ctx = cv.getContext("2d");
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, cv.width, cv.height);
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            state.order.push(p - 1);
            state.thumbs.push(cv.toDataURL("image/jpeg", 0.7));
          }
          render();
          btn.disabled = false;
          status.set("done", pdf.numPages + " pages loaded. Reorder with the arrows, remove with ✕.");
        } catch (err) {
          status.set("error", err.message || "Could not read that PDF.");
        }
      }
    });
    root.appendChild(grid);
    root.appendChild(h("div", { class: "actions-row" }, [btn]));
    status = C.makeStatus(root);

    function render() {
      grid.innerHTML = "";
      state.order.forEach(function (pageIdx, pos) {
        grid.appendChild(h("div", { class: "result-item" }, [
          h("img", { src: state.thumbs[pageIdx], alt: "Page " + (pageIdx + 1) }),
          h("span", { class: "r-name", text: "Page " + (pageIdx + 1) }),
          h("span", { class: "mini-btns", style: "justify-content:center;margin-top:5px" }, [
            h("button", { class: "mini", type: "button", text: "←", "aria-label": "Move earlier", onclick: function () {
              if (pos > 0) { state.order.splice(pos - 1, 0, state.order.splice(pos, 1)[0]); render(); }
            } }),
            h("button", { class: "mini", type: "button", text: "→", "aria-label": "Move later", onclick: function () {
              if (pos < state.order.length - 1) { state.order.splice(pos + 1, 0, state.order.splice(pos, 1)[0]); render(); }
            } }),
            h("button", { class: "mini", type: "button", text: "✕", "aria-label": "Remove page", onclick: function () {
              state.order.splice(pos, 1);
              render();
              btn.disabled = !state.order.length;
            } })
          ])
        ]));
      });
      grid.style.display = state.order.length ? "" : "none";
    }

    btn.addEventListener("click", async function () {
      if (!state.order.length || btn.disabled) return;
      btn.disabled = true;
      try {
        needs("PDF", typeof PDFLib !== "undefined" && PDFLib.PDFDocument);
        status.set("processing", "Rebuilding PDF...");
        var src = await PDFLib.PDFDocument.load(state.bytes.slice(0), { ignoreEncryption: true });
        var out = await PDFLib.PDFDocument.create();
        var copied = await out.copyPages(src, state.order);
        copied.forEach(function (pg) { out.addPage(pg); });
        var bytes = await out.save();
        var name = C.baseName(state.name) + "_reordered.pdf";
        C.download(new Blob([bytes], { type: "application/pdf" }), name);
        status.set("done", state.order.length + " page(s) → " + name);
        C.toast("ok", "Downloaded " + name);
      } catch (err) {
        status.set("error", err.message || "Rebuild failed.");
      }
      btn.disabled = false;
    });
    C.onClear(function () { state.order = []; state.bytes = null; grid.innerHTML = ""; btn.disabled = true; status.set("idle", "Cleared."); });
  });

  /* ---------- Sign PDF ---------- */
  C.register("pdf/sign", function (root) {
    needsSignSetup(root);
  });

  function needsSignSetup(root) {
    var state = { pdfBytes: null, pdfDoc: null, pageCount: 0, pageIndex: 0, placed: null, fileName: "" };
    var status;

    /* Handwriting fonts for typed signatures, loaded only on this page. */
    if (!document.getElementById("sig-fonts")) {
      document.head.appendChild(h("link", {
        id: "sig-fonts", rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Great+Vibes&family=Dancing+Script:wght@600&family=Caveat:wght@600&display=swap"
      }));
    }

    /* Three signature sources: draw on a pad, type a name, or upload an image. */
    var sigMode = "draw";
    var typedCache = null, uploadCache = null, uploadFile = null;

    var pad = h("canvas", { class: "sig-pad", "aria-label": "Draw your signature here" });
    var drawSection = h("div", null, [pad]);

    var typedInput = h("input", { class: "single-input", type: "text", placeholder: "Type your name...", "aria-label": "Type your signature", style: "max-width:280px" });
    var fontSel = h("select", { "aria-label": "Signature style" }, [
      h("option", { value: "Great Vibes", text: "Elegant script" }),
      h("option", { value: "Dancing Script", text: "Flowing script" }),
      h("option", { value: "Caveat", text: "Handwritten" })
    ]);
    var typePreview = h("img", { class: "sig-preview", alt: "Typed signature preview", style: "display:none" });
    var typeSection = h("div", { style: "display:none" }, [
      h("div", { class: "opts", style: "margin:0 0 10px" }, [
        h("label", { class: "field" }, [typedInput]),
        h("label", { class: "field" }, ["Style ", fontSel])
      ]),
      typePreview
    ]);

    var uploadInput = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", hidden: true, "aria-label": "Upload signature image" });
    var whiteBox = h("input", { type: "checkbox" });
    whiteBox.checked = true;
    var uploadPreview = h("img", { class: "sig-preview", alt: "Uploaded signature preview", style: "display:none" });
    var uploadSection = h("div", { style: "display:none" }, [
      h("div", { class: "opts", style: "margin:0 0 10px" }, [
        h("button", { class: "mini primary", type: "button", text: "Choose image...", onclick: function () { uploadInput.click(); } }),
        h("label", { class: "field" }, [whiteBox, "Make white background transparent"])
      ]),
      uploadPreview,
      uploadInput
    ]);

    var modeBtns = {};
    var modeRow = h("span", { class: "mini-btns" }, ["draw", "type", "upload"].map(function (m) {
      var label = m === "draw" ? "Draw" : m === "type" ? "Type" : "Upload image";
      var b = h("button", { class: "mini" + (m === sigMode ? " on" : ""), type: "button", text: label });
      b.addEventListener("click", function () {
        sigMode = m;
        Object.keys(modeBtns).forEach(function (k) { modeBtns[k].classList.toggle("on", k === sigMode); });
        drawSection.style.display = m === "draw" ? "" : "none";
        typeSection.style.display = m === "type" ? "" : "none";
        uploadSection.style.display = m === "upload" ? "" : "none";
        syncPlacedImage();
      });
      modeBtns[m] = b;
      return b;
    }));

    var padWrap = h("div", null, [
      h("div", { class: "ta-label" }, [
        h("span", { text: "1. Your signature" }),
        h("span", { class: "mini-btns" }, [
          modeRow,
          h("button", { class: "mini", type: "button", text: "Clear", onclick: clearSignature })
        ])
      ]),
      drawSection,
      typeSection,
      uploadSection
    ]);

    async function renderTyped() {
      var text = typedInput.value.trim();
      if (!text) { typedCache = null; typePreview.style.display = "none"; syncPlacedImage(); return; }
      var fam = fontSel.value;
      try { await document.fonts.load('600 72px "' + fam + '"', text); } catch (e) { /* font falls back to cursive */ }
      var cv = document.createElement("canvas");
      var probe = cv.getContext("2d");
      probe.font = '600 72px "' + fam + '", cursive';
      cv.width = Math.max(60, Math.ceil(probe.measureText(text).width) + 48);
      cv.height = 130;
      var ctx = cv.getContext("2d");
      ctx.font = '600 72px "' + fam + '", cursive';
      ctx.fillStyle = "#1e293b";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 24, 68);
      typedCache = cv;
      typePreview.src = cv.toDataURL("image/png");
      typePreview.style.display = "";
      syncPlacedImage();
    }
    typedInput.addEventListener("input", debounceSig(renderTyped, 250));
    fontSel.addEventListener("change", renderTyped);
    function debounceSig(fn, ms) {
      var t;
      return function () { clearTimeout(t); t = setTimeout(fn, ms); };
    }

    async function processUpload() {
      if (!uploadFile) return;
      var loaded = await C.loadImage(uploadFile);
      var img = loaded.img;
      var sc = Math.min(1, 800 / img.naturalWidth);
      var cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(img.naturalWidth * sc));
      cv.height = Math.max(1, Math.round(img.naturalHeight * sc));
      var ctx = cv.getContext("2d");
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      loaded.revoke();
      if (whiteBox.checked) {
        var d = ctx.getImageData(0, 0, cv.width, cv.height);
        for (var i = 0; i < d.data.length; i += 4) {
          if (d.data[i] > 232 && d.data[i + 1] > 232 && d.data[i + 2] > 232) d.data[i + 3] = 0;
        }
        ctx.putImageData(d, 0, 0);
      }
      uploadCache = cv;
      uploadPreview.src = cv.toDataURL("image/png");
      uploadPreview.style.display = "";
      syncPlacedImage();
    }
    uploadInput.addEventListener("change", function () {
      if (uploadInput.files[0]) { uploadFile = uploadInput.files[0]; processUpload(); }
      uploadInput.value = "";
    });
    whiteBox.addEventListener("change", processUpload);

    function clearSignature() {
      if (sigMode === "draw") clearPad();
      else if (sigMode === "type") { typedInput.value = ""; typedCache = null; typePreview.style.display = "none"; }
      else { uploadFile = null; uploadCache = null; uploadPreview.style.display = "none"; }
      syncPlacedImage();
    }
    var padCtx, hasInk = false;
    function setupPad() {
      var dpr = window.devicePixelRatio || 1;
      var w = Math.min(440, root.clientWidth - 30) || 440;
      pad.style.width = w + "px";
      pad.style.height = "150px";
      pad.width = w * dpr;
      pad.height = 150 * dpr;
      padCtx = pad.getContext("2d");
      padCtx.scale(dpr, dpr);
      padCtx.lineWidth = 2.2;
      padCtx.lineCap = "round";
      padCtx.lineJoin = "round";
      padCtx.strokeStyle = "#1e293b";
      hasInk = false;
    }
    function clearPad() {
      padCtx.clearRect(0, 0, pad.width, pad.height);
      hasInk = false;
      syncPlacedImage();
    }
    var drawing = false, lastX = 0, lastY = 0;
    function padPos(e) {
      var r = pad.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    pad.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      try { pad.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events have no active pointer */ }
      drawing = true;
      var p = padPos(e);
      lastX = p[0]; lastY = p[1];
    });
    pad.addEventListener("pointermove", function (e) {
      if (!drawing) return;
      var p = padPos(e);
      padCtx.beginPath();
      padCtx.moveTo(lastX, lastY);
      padCtx.lineTo(p[0], p[1]);
      padCtx.stroke();
      lastX = p[0]; lastY = p[1];
      hasInk = true;
    });
    ["pointerup", "pointercancel"].forEach(function (ev) {
      pad.addEventListener(ev, function () { drawing = false; syncPlacedImage(); });
    });

    function signatureImage() {
      if (sigMode === "type") return typedCache;
      if (sigMode === "upload") return uploadCache;
      return padCrop();
    }

    /* Crop the pad to the inked bounding box so placement is tight. */
    function padCrop() {
      if (!hasInk) return null;
      var w = pad.width, hh = pad.height;
      var data = pad.getContext("2d").getImageData(0, 0, w, hh).data;
      var minX = w, minY = hh, maxX = 0, maxY = 0;
      for (var y = 0; y < hh; y++) {
        for (var x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 10) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX <= minX || maxY <= minY) return null;
      var pad2 = 6;
      minX = Math.max(0, minX - pad2); minY = Math.max(0, minY - pad2);
      maxX = Math.min(w, maxX + pad2); maxY = Math.min(hh, maxY + pad2);
      var out = document.createElement("canvas");
      out.width = maxX - minX;
      out.height = maxY - minY;
      out.getContext("2d").drawImage(pad, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
      return out;
    }

    /* Page stage: rendered page + draggable signature overlay. */
    var stage = h("div", { class: "pdf-stage", style: "display:none" });
    var pageCanvas = h("canvas");
    var sigImg = h("img", { class: "sig-overlay", draggable: "false", alt: "Signature placement" });
    stage.appendChild(pageCanvas);
    stage.appendChild(sigImg);
    var pageLabel = h("span", { text: "" });
    var sizeSlider = h("input", { type: "range", min: "10", max: "60", value: "28", "aria-label": "Signature size" });
    var controls = h("div", { class: "opts", style: "display:none;margin-top:13px" }, [
      h("button", { class: "mini", type: "button", text: "← Prev", onclick: function () { showPage(state.pageIndex - 1); } }),
      pageLabel,
      h("button", { class: "mini", type: "button", text: "Next →", onclick: function () { showPage(state.pageIndex + 1); } }),
      h("label", { class: "field", style: "margin-left:12px" }, ["Size ", sizeSlider]),
      h("button", { class: "mini primary", type: "button", text: "Place signature here", onclick: placeOnPage })
    ]);
    var applyBtn = h("button", { class: "btn", type: "button", disabled: true, text: "Sign & download" });

    C.dropzone(root, {
      accept: "application/pdf,.pdf",
      multiple: false,
      label: "Drop the PDF to sign",
      sub: "or click to browse",
      onFiles: async function (files) {
        var f = files.filter(isPdf)[0];
        if (!f) { status.set("error", "Please choose a PDF file."); return; }
        try {
          needs("PDF rendering", typeof pdfjsLib !== "undefined");
          state.fileName = f.name;
          state.pdfBytes = await f.arrayBuffer();
          state.pdfDoc = await pdfjsLib.getDocument({ data: state.pdfBytes.slice(0) }).promise;
          state.pageCount = state.pdfDoc.numPages;
          state.placed = null;
          stage.style.display = "";
          controls.style.display = "";
          await showPage(0);
          status.set("done", f.name + " loaded (" + state.pageCount + " pages). Draw a signature, pick a page, place it.");
        } catch (err) {
          status.set("error", err.message || "Could not read that PDF.");
        }
      }
    });
    root.appendChild(padWrap);
    root.appendChild(h("div", { class: "ta-label", style: "margin-top:15px" }, [h("span", { text: "2. Pick the page and position" })]));
    root.appendChild(controls);
    root.appendChild(stage);
    root.appendChild(h("div", { class: "actions-row" }, [applyBtn]));
    status = C.makeStatus(root);
    setupPad();

    async function showPage(idx) {
      if (!state.pdfDoc || idx < 0 || idx >= state.pageCount) return;
      state.pageIndex = idx;
      pageLabel.textContent = "Page " + (idx + 1) + " / " + state.pageCount;
      var page = await state.pdfDoc.getPage(idx + 1);
      var maxW = Math.min(680, root.clientWidth - 30);
      var vp1 = page.getViewport({ scale: 1 });
      var scale = maxW / vp1.width;
      var viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
      pageCanvas.width = viewport.width;
      pageCanvas.height = viewport.height;
      pageCanvas.style.width = Math.round(viewport.width / (window.devicePixelRatio || 1)) + "px";
      pageCanvas.style.height = Math.round(viewport.height / (window.devicePixelRatio || 1)) + "px";
      var ctx = pageCanvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      syncPlacedImage();
    }

    function placeOnPage() {
      var sig = signatureImage();
      if (!sig) {
        status.set("error", sigMode === "type" ? "Type your name first (box above)."
          : sigMode === "upload" ? "Choose a signature image first (box above)."
          : "Draw a signature first (box above).");
        return;
      }
      if (!state.pdfDoc) { status.set("error", "Drop a PDF first."); return; }
      state.placed = { page: state.pageIndex, xr: 0.55, yr: 0.75, wr: parseInt(sizeSlider.value, 10) / 100 };
      applyBtn.disabled = false;
      syncPlacedImage();
      status.set("done", "Signature placed, drag it into position.");
    }
    sizeSlider.addEventListener("input", function () {
      if (state.placed) { state.placed.wr = parseInt(sizeSlider.value, 10) / 100; syncPlacedImage(); }
    });

    function syncPlacedImage() {
      var sig = signatureImage();
      if (!state.placed || !sig || state.placed.page !== state.pageIndex) {
        sigImg.style.display = "none";
        return;
      }
      sigImg.src = sig.toDataURL("image/png");
      var cw = pageCanvas.clientWidth;
      var w = cw * state.placed.wr;
      sigImg.style.display = "";
      sigImg.style.width = w + "px";
      sigImg.style.left = (state.placed.xr * cw) + "px";
      sigImg.style.top = (state.placed.yr * pageCanvas.clientHeight) + "px";
    }

    var dragOff = null;
    sigImg.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      try { sigImg.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events have no active pointer */ }
      var r = sigImg.getBoundingClientRect();
      dragOff = [e.clientX - r.left, e.clientY - r.top];
    });
    sigImg.addEventListener("pointermove", function (e) {
      if (!dragOff || !state.placed) return;
      var sr = pageCanvas.getBoundingClientRect();
      var x = e.clientX - sr.left - dragOff[0];
      var y = e.clientY - sr.top - dragOff[1];
      x = Math.max(0, Math.min(x, sr.width - sigImg.clientWidth));
      y = Math.max(0, Math.min(y, sr.height - sigImg.clientHeight));
      state.placed.xr = x / sr.width;
      state.placed.yr = y / sr.height;
      sigImg.style.left = x + "px";
      sigImg.style.top = y + "px";
    });
    ["pointerup", "pointercancel"].forEach(function (ev) {
      sigImg.addEventListener(ev, function () { dragOff = null; });
    });

    applyBtn.addEventListener("click", async function () {
      if (!state.placed || !state.pdfBytes) return;
      var sig = signatureImage();
      if (!sig) { status.set("error", "The signature pad is empty."); return; }
      applyBtn.disabled = true;
      try {
        needs("PDF", typeof PDFLib !== "undefined" && PDFLib.PDFDocument);
        status.set("processing", "Embedding signature...");
        var doc = await PDFLib.PDFDocument.load(state.pdfBytes.slice(0), { ignoreEncryption: true });
        var page = doc.getPage(state.placed.page);
        var png = await doc.embedPng(sig.toDataURL("image/png"));
        var pw = page.getWidth(), ph = page.getHeight();
        var w = state.placed.wr * pw;
        var hgt = w * (sig.height / sig.width);
        var x = state.placed.xr * pw;
        var y = ph - state.placed.yr * ph - hgt; // PDF origin is bottom-left
        page.drawImage(png, { x: x, y: y, width: w, height: hgt });
        var out = await doc.save();
        var name = C.baseName(state.fileName) + "_signed.pdf";
        C.download(new Blob([out], { type: "application/pdf" }), name);
        status.set("done", "Signed page " + (state.placed.page + 1) + " → " + name);
        C.toast("ok", "Downloaded " + name);
      } catch (err) {
        status.set("error", err.message || "Signing failed.");
      }
      applyBtn.disabled = false;
    });

    C.onClear(function () {
      clearPad();
      typedInput.value = "";
      typedCache = null;
      typePreview.style.display = "none";
      uploadFile = null;
      uploadCache = null;
      uploadPreview.style.display = "none";
      state.placed = null;
      applyBtn.disabled = true;
      status.set("idle", "Cleared.");
    });
  }

  C.boot();
})();
