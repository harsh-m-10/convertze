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
        var q = h("input", { type: "range", min: "20", max: "90", value: "60" });
        var qv = h("span", { text: "60" });
        q.addEventListener("input", function () { qv.textContent = q.value; });
        row.appendChild(h("label", { class: "field" }, ["Quality ", q, qv, "%"]));
        row.appendChild(h("span", { class: "kbd-hint", text: "Lower quality = smaller file. Pages become images." }));
        return function () { return { quality: parseInt(q.value, 10) / 100 }; };
      },
      run: async function (files, s, status) {
        needs("PDF rendering", typeof pdfjsLib !== "undefined");
        needs("PDF writing", window.jspdf && window.jspdf.jsPDF);
        var file = files[0];
        var pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        var doc = null;
        for (var p = 1; p <= pdf.numPages; p++) {
          status.set("processing", "Compressing page " + p + " of " + pdf.numPages + "...");
          var page = await pdf.getPage(p);
          var viewport = page.getViewport({ scale: 1.5 });
          var canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
          var wPt = viewport.width * 0.48, hPt = viewport.height * 0.48; // back to ~72dpi points
          if (!doc) {
            doc = new window.jspdf.jsPDF({ unit: "pt", format: [wPt, hPt], orientation: wPt > hPt ? "l" : "p" });
          } else {
            doc.addPage([wPt, hPt], wPt > hPt ? "l" : "p");
          }
          doc.addImage(canvas.toDataURL("image/jpeg", s.quality), "JPEG", 0, 0, wPt, hPt);
        }
        var blob = doc.output("blob");
        var name = C.baseName(file.name) + "_compressed.pdf";
        C.download(blob, name);
        var saved = Math.max(0, Math.round((1 - blob.size / file.size) * 100));
        status.set("done", C.fmtKB(file.size) + " → " + C.fmtKB(blob.size) + " (" + saved + "% smaller). Downloaded " + name);
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

  C.boot();
})();
