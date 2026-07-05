/* Convertze image tools: convert, resize, compress, crop, rotate, favicon, svg-to-png. */
(function () {
  "use strict";
  var C = window.Convertze;
  var h = C.h;

  var MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

  function fillIfOpaque(ctx, fmt, w, hgt) {
    if (fmt === "jpg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, hgt);
    }
  }

  function formatSelect(initial, jpgWebpOnly) {
    var opts = jpgWebpOnly ? ["jpg", "webp"] : ["png", "jpg", "webp"];
    var sel = h("select", { "aria-label": "Output format" }, opts.map(function (f) {
      return h("option", { value: f, text: f.toUpperCase() });
    }));
    sel.value = initial;
    return sel;
  }

  function fileListUI(parent, state, onChange) {
    var ul = h("ul", { class: "file-list" });
    parent.appendChild(ul);
    function render() {
      ul.innerHTML = "";
      state.files.forEach(function (f, i) {
        ul.appendChild(h("li", null, [
          h("span", { class: "f-name", text: f.name }),
          h("span", { class: "f-size", text: C.fmtKB(f.size) }),
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

  function resultsUI(parent) {
    var grid = h("div", { class: "result-grid" });
    var box = h("div", { class: "results" }, [grid]);
    parent.appendChild(box);
    return {
      clear: function () { grid.innerHTML = ""; box.classList.remove("show"); },
      add: function (item) {
        var url = URL.createObjectURL(item.blob);
        grid.appendChild(h("div", { class: "result-item" }, [
          item.noPreview ? null : h("img", { src: url, alt: item.name }),
          h("span", { class: "r-name", text: item.name }),
          h("span", { class: "r-meta", text: C.fmtKB(item.blob.size) + (item.meta ? " · " + item.meta : "") }),
          h("a", { class: "btn ghost sm", href: url, download: item.name, text: "Download" })
        ]));
        box.classList.add("show");
      }
    };
  }

  /* Multi-file image tool scaffold. */
  function imageTool(root, cfg) {
    var state = { files: [] };
    var status, renderList;

    C.dropzone(root, {
      accept: cfg.accept,
      multiple: cfg.multiple,
      label: cfg.label,
      sub: cfg.sub || (cfg.multiple ? "or click to browse, multiple files supported" : "or click to browse"),
      onFiles: function (files) {
        var ok = cfg.fileFilter
          ? files.filter(cfg.fileFilter)
          : cfg.allowSvg
            ? files
            : files.filter(function (f) { return /^image\//.test(f.type) && !/svg/.test(f.type); });
        if (!ok.length) { status.set("error", cfg.badFileMsg || "Please choose image files (JPG, PNG or WebP)."); return; }
        state.files = cfg.multiple ? state.files.concat(ok) : [ok[0]];
        renderList();
        status.set("done", state.files.length + " file" + (state.files.length > 1 ? "s" : "") + " ready.");
        convertBtn.disabled = false;
        if (cfg.onFilesAdded) cfg.onFilesAdded(state.files);
      }
    });

    renderList = fileListUI(root, state, function () {
      convertBtn.disabled = !state.files.length;
      if (!state.files.length) status.set("idle", "Ready when you are.");
      else if (cfg.onFilesAdded) cfg.onFilesAdded(state.files);
    });

    var optsRow = h("div", { class: "opts" });
    root.appendChild(optsRow);
    var getSettings = cfg.options ? cfg.options(optsRow) : function () { return {}; };

    var convertBtn = h("button", { class: "btn", type: "button", disabled: true, text: cfg.cta || "Convert & download" });
    root.appendChild(h("div", { class: "actions-row" }, [convertBtn]));
    status = C.makeStatus(root);
    var results = resultsUI(root);

    async function run() {
      if (!state.files.length || convertBtn.disabled) return;
      convertBtn.disabled = true;
      status.set("processing", "Converting...");
      results.clear();
      try {
        var settings = getSettings();
        var outputs = [];
        for (var i = 0; i < state.files.length; i++) {
          var file = state.files[i];
          var out;
          if (cfg.raw) {
            out = await cfg.transform(null, file, settings);
          } else {
            var loaded = await C.loadImage(file);
            out = await cfg.transform(loaded.img, file, settings);
            loaded.revoke();
          }
          var parts = out.multi || [out];
          for (var j = 0; j < parts.length; j++) {
            var part = parts[j];
            var blob = part.blob || await C.canvasToBlob(part.canvas, MIME[part.fmt], part.quality != null ? part.quality : 0.92);
            var name = C.baseName(file.name) + (part.suffix || "") + "." + part.fmt;
            outputs.push({ name: name, data: blob });
            results.add({ name: name, blob: blob, meta: part.meta, noPreview: part.fmt === "zip" });
          }
        }
        var delivered = await C.deliver(outputs, cfg.zipName || "convertze_images.zip");
        status.set("done", "Done, downloaded " + delivered + ".");
        C.toast("ok", "Downloaded " + delivered);
      } catch (err) {
        status.set("error", err && err.message ? err.message : "Conversion failed.");
      }
      convertBtn.disabled = false;
    }
    convertBtn.addEventListener("click", run);
    C.onRun(run);
    C.onClear(function () {
      state.files = [];
      renderList();
      results.clear();
      convertBtn.disabled = true;
      status.set("idle", "Cleared.");
      if (cfg.onCleared) cfg.onCleared();
    });
  }

  /* ---------- Convert (PNG / JPG / WebP) ---------- */

  /* Sample an image at low resolution and report whether it uses transparency. */
  async function hasTransparency(file) {
    var loaded = await C.loadImage(file);
    var img = loaded.img;
    var w = Math.max(1, Math.min(64, img.naturalWidth));
    var hgt = Math.max(1, Math.round(w * (img.naturalHeight / img.naturalWidth))) || 1;
    var cv = document.createElement("canvas");
    cv.width = w;
    cv.height = hgt;
    var ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, w, hgt);
    loaded.revoke();
    var data = ctx.getImageData(0, 0, w, hgt).data;
    for (var i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true;
    }
    return false;
  }

  C.register("images/convert", function (root) {
    var fmt, hint, hintText, hintBtn, suggestedFmt = null;
    var ruleMB, ruleTouched = false;

    imageTool(root, {
      accept: "image/png,image/jpeg,image/webp",
      multiple: true,
      label: "Drop images here",
      options: function (row) {
        fmt = formatSelect("jpg");
        var q = h("input", { type: "range", min: "10", max: "100", value: "92" });
        var qv = h("span", { text: "92" });
        q.addEventListener("input", function () { qv.textContent = q.value; });
        var qField = h("label", { class: "field" }, ["Quality ", q, qv, "%"]);
        var fmtField = h("label", { class: "field" }, ["Convert to ", fmt]);
        fmt.addEventListener("change", function () { qField.style.display = fmt.value === "png" ? "none" : ""; });

        /* Conditional batch rule: route files by size to different formats. */
        var ruleBox = h("input", { type: "checkbox" });
        ruleMB = h("input", { type: "number", value: "5", min: "0.01", step: "any", style: "width:70px" });
        // Auto-suggested from the batch until the user edits it by hand (issue #1).
        ruleMB.addEventListener("input", function () { ruleTouched = true; });
        var bigSel = formatSelect("webp");
        var smallSel = formatSelect("png");
        var ruleDetail = h("span", { class: "field", style: "display:none" }, [
          "over ", ruleMB, " MB → ", bigSel, ", others → ", smallSel
        ]);
        ruleBox.addEventListener("change", function () {
          ruleDetail.style.display = ruleBox.checked ? "" : "none";
          fmtField.style.display = ruleBox.checked ? "none" : "";
          if (ruleBox.checked) qField.style.display = "";
        });
        row.appendChild(fmtField);
        row.appendChild(qField);
        row.appendChild(h("label", { class: "field" }, [ruleBox, "Split by size"]));
        row.appendChild(ruleDetail);
        return function () {
          return {
            fmt: fmt.value, quality: parseInt(q.value, 10) / 100,
            rule: ruleBox.checked, ruleBytes: (parseFloat(ruleMB.value) || 5) * 1048576,
            big: bigSel.value, small: smallSel.value
          };
        };
      },
      onFilesAdded: async function (files) {
        hint.style.display = "none";
        suggestedFmt = null;
        // Suggest a split threshold that actually divides this batch: the
        // midpoint between the smallest and largest file (issue #1).
        if (!ruleTouched && files.length) {
          var sizes = files.map(function (f) { return f.size; });
          var midMB = (Math.min.apply(null, sizes) + Math.max.apply(null, sizes)) / 2 / 1048576;
          ruleMB.value = midMB >= 1 ? midMB.toFixed(1) : Math.max(0.01, midMB).toFixed(2);
        }
        try {
          var sample = files.slice(0, 12);
          var opaquePng = 0, opaquePngBytes = 0, withAlpha = 0;
          for (var i = 0; i < sample.length; i++) {
            var f = sample[i];
            var alpha = await hasTransparency(f);
            if (alpha) withAlpha++;
            else if (/png/i.test(f.type)) { opaquePng++; opaquePngBytes += f.size; }
          }
          if (opaquePng && opaquePngBytes > 150 * 1024 && fmt.value !== "webp") {
            suggestedFmt = "webp";
            hintText.textContent = "Smart suggestion: " + opaquePng + " PNG" + (opaquePng > 1 ? "s" : "") +
              " (" + C.fmtKB(opaquePngBytes) + ") " + (opaquePng > 1 ? "use" : "uses") +
              " no transparency. WebP keeps them looking identical at a fraction of the size.";
            hintBtn.textContent = "Use WebP";
            hint.style.display = "";
          } else if (withAlpha && fmt.value === "jpg") {
            suggestedFmt = "webp";
            hintText.textContent = "Heads up: " + withAlpha + " image" + (withAlpha > 1 ? "s have" : " has") +
              " transparency that JPG will flatten to white. WebP keeps it.";
            hintBtn.textContent = "Use WebP";
            hint.style.display = "";
          }
        } catch (e) { /* suggestion is best-effort, never block the tool */ }
      },
      onCleared: function () { hint.style.display = "none"; },
      transform: function (img, file, s) {
        var outFmt = s.rule ? (file.size > s.ruleBytes ? s.big : s.small) : s.fmt;
        var canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        var ctx = canvas.getContext("2d");
        fillIfOpaque(ctx, outFmt, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        return { canvas: canvas, fmt: outFmt, quality: s.quality };
      }
    });

    hintText = h("span");
    hintBtn = h("button", { class: "mini primary", type: "button", onclick: function () {
      if (suggestedFmt) {
        fmt.value = suggestedFmt;
        fmt.dispatchEvent(new Event("change"));
        hint.style.display = "none";
      }
    } });
    hint = h("div", { class: "smart-hint", style: "display:none" }, [hintText, hintBtn]);
    var optsRow = root.querySelector(".opts");
    optsRow.parentNode.insertBefore(hint, optsRow);
  });

  /* ---------- Resize ---------- */
  C.register("images/resize", function (root) {
    imageTool(root, {
      accept: "image/png,image/jpeg,image/webp",
      multiple: true,
      label: "Drop images to resize",
      cta: "Resize & download",
      options: function (row) {
        var w = h("input", { type: "number", min: "1", max: "10000", placeholder: "auto" });
        var ht = h("input", { type: "number", min: "1", max: "10000", placeholder: "auto" });
        var keep = h("input", { type: "checkbox", checked: true });
        var fmt = formatSelect("png");
        row.appendChild(h("label", { class: "field" }, ["Width ", w, "px"]));
        row.appendChild(h("label", { class: "field" }, ["Height ", ht, "px"]));
        row.appendChild(h("label", { class: "field" }, [keep, " Keep aspect ratio"]));
        row.appendChild(h("label", { class: "field" }, ["Format ", fmt]));
        return function () {
          if (!parseInt(w.value, 10) && !parseInt(ht.value, 10)) throw new Error("Enter a width and/or height in pixels.");
          return { w: parseInt(w.value, 10) || null, h: parseInt(ht.value, 10) || null, keep: keep.checked, fmt: fmt.value };
        };
      },
      transform: function (img, file, s) {
        var iw = img.naturalWidth, ih = img.naturalHeight;
        var tw = s.w || Math.round(iw * (s.h / ih));
        var th = s.h || Math.round(ih * (s.w / iw));
        if (s.keep && s.w && s.h) {
          var sc = Math.min(s.w / iw, s.h / ih);
          tw = Math.max(1, Math.round(iw * sc));
          th = Math.max(1, Math.round(ih * sc));
        }
        var canvas = document.createElement("canvas");
        canvas.width = tw;
        canvas.height = th;
        var ctx = canvas.getContext("2d");
        fillIfOpaque(ctx, s.fmt, tw, th);
        ctx.drawImage(img, 0, 0, tw, th);
        return { canvas: canvas, fmt: s.fmt, suffix: "_" + tw + "x" + th, meta: tw + "×" + th };
      }
    });
  });

  /* ---------- Compress ---------- */
  C.register("images/compress", function (root) {
    imageTool(root, {
      accept: "image/png,image/jpeg,image/webp",
      multiple: true,
      label: "Drop images to compress",
      cta: "Compress & download",
      options: function (row) {
        var modeQ = h("input", { type: "radio", name: "cmode", checked: true });
        var modeT = h("input", { type: "radio", name: "cmode" });
        var q = h("input", { type: "range", min: "10", max: "100", value: "80" });
        var qv = h("span", { text: "80" });
        var target = h("input", { type: "number", min: "5", max: "10240", value: "200" });
        q.addEventListener("input", function () { qv.textContent = q.value; modeQ.checked = true; });
        target.addEventListener("input", function () { modeT.checked = true; });
        var fmt = formatSelect("jpg", true);
        row.appendChild(h("label", { class: "field" }, [modeQ, " Quality ", q, qv, "%"]));
        row.appendChild(h("label", { class: "field" }, [modeT, " Target size ", target, "KB"]));
        row.appendChild(h("label", { class: "field" }, ["Format ", fmt]));
        return function () {
          return {
            mode: modeT.checked ? "target" : "quality",
            quality: parseInt(q.value, 10) / 100,
            targetKB: Math.max(5, parseInt(target.value, 10) || 200),
            fmt: fmt.value
          };
        };
      },
      transform: async function (img, file, s) {
        var iw = img.naturalWidth, ih = img.naturalHeight;
        function draw(scale) {
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(iw * scale));
          canvas.height = Math.max(1, Math.round(ih * scale));
          var ctx = canvas.getContext("2d");
          fillIfOpaque(ctx, "jpg", canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          return canvas;
        }
        if (s.mode === "quality") {
          return { canvas: draw(1), fmt: s.fmt, quality: s.quality, suffix: "_compressed" };
        }
        var maxB = s.targetKB * 1024;
        var scale = Math.min(1, 2400 / Math.max(iw, ih));
        var canvas = draw(scale);
        var res = await C.encodeUnder(canvas, MIME[s.fmt], maxB);
        while (!res && Math.max(canvas.width, canvas.height) > 40) {
          scale *= 0.8;
          canvas = draw(scale);
          res = await C.encodeUnder(canvas, MIME[s.fmt], maxB);
        }
        if (!res) throw new Error("Couldn't reach " + s.targetKB + " KB for " + file.name + ".");
        return { blob: res.blob, fmt: s.fmt, suffix: "_" + s.targetKB + "kb", meta: "q " + Math.round(res.quality * 100) + "%" };
      }
    });
  });

  /* ---------- Bulk convert (one format + one size for a whole batch) ---------- */
  C.register("images/bulk-convert", function (root) {
    imageTool(root, {
      accept: "image/png,image/jpeg,image/webp",
      multiple: true,
      label: "Drop your whole batch here",
      sub: "or click to browse, 20 photos at once is the point",
      cta: "Convert batch & download",
      zipName: "convertze_bulk.zip",
      options: function (row) {
        var fmt = formatSelect("webp");
        var q = h("input", { type: "range", min: "10", max: "100", value: "82" });
        var qv = h("span", { text: "82" });
        q.addEventListener("input", function () { qv.textContent = q.value; });
        var qField = h("label", { class: "field" }, ["Quality ", q, qv, "%"]);
        fmt.addEventListener("change", function () { qField.style.display = fmt.value === "png" ? "none" : ""; });

        var mode = h("select", { "aria-label": "Resize mode" }, [
          h("option", { value: "none", text: "Keep original size" }),
          h("option", { value: "fit", text: "Fit inside box" }),
          h("option", { value: "width", text: "Exact width" }),
          h("option", { value: "height", text: "Exact height" })
        ]);
        var w = h("input", { type: "number", min: "1", max: "10000", value: "1600", style: "width:80px" });
        var ht = h("input", { type: "number", min: "1", max: "10000", value: "1600", style: "width:80px" });
        var noUp = h("input", { type: "checkbox", checked: true });
        var wField = h("label", { class: "field", style: "display:none" }, ["Width ", w, "px"]);
        var hField = h("label", { class: "field", style: "display:none" }, ["Height ", ht, "px"]);
        var upField = h("label", { class: "field", style: "display:none" }, [noUp, " Don't enlarge smaller images"]);
        mode.addEventListener("change", function () {
          var m = mode.value;
          wField.style.display = m === "fit" || m === "width" ? "" : "none";
          hField.style.display = m === "fit" || m === "height" ? "" : "none";
          upField.style.display = m === "none" ? "none" : "";
        });

        row.appendChild(h("label", { class: "field" }, ["Convert to ", fmt]));
        row.appendChild(qField);
        row.appendChild(h("label", { class: "field" }, ["Resize ", mode]));
        row.appendChild(wField);
        row.appendChild(hField);
        row.appendChild(upField);
        return function () {
          var m = mode.value;
          var wv = parseInt(w.value, 10), hv = parseInt(ht.value, 10);
          if ((m === "fit" || m === "width") && !(wv > 0)) throw new Error("Enter a width in pixels.");
          if ((m === "fit" || m === "height") && !(hv > 0)) throw new Error("Enter a height in pixels.");
          return {
            fmt: fmt.value, quality: parseInt(q.value, 10) / 100,
            mode: m, w: wv, h: hv, noUp: noUp.checked
          };
        };
      },
      transform: function (img, file, s) {
        var iw = img.naturalWidth, ih = img.naturalHeight;
        var scale = 1;
        if (s.mode === "fit") scale = Math.min(s.w / iw, s.h / ih);
        else if (s.mode === "width") scale = s.w / iw;
        else if (s.mode === "height") scale = s.h / ih;
        if (s.noUp && scale > 1) scale = 1;
        var tw = Math.max(1, Math.round(iw * scale));
        var th = Math.max(1, Math.round(ih * scale));
        var canvas = document.createElement("canvas");
        canvas.width = tw;
        canvas.height = th;
        var ctx = canvas.getContext("2d");
        fillIfOpaque(ctx, s.fmt, tw, th);
        ctx.drawImage(img, 0, 0, tw, th);
        return {
          canvas: canvas, fmt: s.fmt, quality: s.quality,
          suffix: s.mode === "none" || scale === 1 ? "" : "_" + tw + "x" + th,
          meta: tw + "×" + th
        };
      }
    });
  });

  /* ---------- Crop (center) ---------- */
  C.register("images/crop", function (root) {
    imageTool(root, {
      accept: "image/png,image/jpeg,image/webp",
      multiple: true,
      label: "Drop images to crop",
      cta: "Crop & download",
      options: function (row) {
        var w = h("input", { type: "number", min: "1", max: "10000", value: "500" });
        var ht = h("input", { type: "number", min: "1", max: "10000", value: "500" });
        var fmt = formatSelect("png");
        row.appendChild(h("label", { class: "field" }, ["Frame width ", w, "px"]));
        row.appendChild(h("label", { class: "field" }, ["Frame height ", ht, "px"]));
        row.appendChild(h("label", { class: "field" }, ["Format ", fmt]));
        return function () {
          return {
            w: Math.max(1, parseInt(w.value, 10) || 500),
            h: Math.max(1, parseInt(ht.value, 10) || 500),
            fmt: fmt.value
          };
        };
      },
      transform: function (img, file, s) {
        var iw = img.naturalWidth, ih = img.naturalHeight;
        var canvas = document.createElement("canvas");
        canvas.width = s.w;
        canvas.height = s.h;
        var ctx = canvas.getContext("2d");
        fillIfOpaque(ctx, s.fmt, s.w, s.h);
        var sc = Math.max(s.w / iw, s.h / ih);
        var sw = s.w / sc, sh = s.h / sc;
        ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, s.w, s.h);
        return { canvas: canvas, fmt: s.fmt, suffix: "_" + s.w + "x" + s.h, meta: s.w + "×" + s.h };
      }
    });
  });

  /* ---------- Rotate ---------- */
  C.register("images/rotate", function (root) {
    imageTool(root, {
      accept: "image/png,image/jpeg,image/webp",
      multiple: true,
      label: "Drop images to rotate",
      cta: "Rotate & download",
      options: function (row) {
        var angle = h("select", { "aria-label": "Rotation angle" }, [
          h("option", { value: "90", text: "90° clockwise" }),
          h("option", { value: "180", text: "180°" }),
          h("option", { value: "270", text: "90° counter-clockwise" })
        ]);
        var fmt = formatSelect("png");
        row.appendChild(h("label", { class: "field" }, ["Rotate ", angle]));
        row.appendChild(h("label", { class: "field" }, ["Format ", fmt]));
        return function () { return { angle: parseInt(angle.value, 10), fmt: fmt.value }; };
      },
      transform: function (img, file, s) {
        var iw = img.naturalWidth, ih = img.naturalHeight;
        var swap = s.angle === 90 || s.angle === 270;
        var canvas = document.createElement("canvas");
        canvas.width = swap ? ih : iw;
        canvas.height = swap ? iw : ih;
        var ctx = canvas.getContext("2d");
        fillIfOpaque(ctx, s.fmt, canvas.width, canvas.height);
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((s.angle * Math.PI) / 180);
        ctx.drawImage(img, -iw / 2, -ih / 2);
        return { canvas: canvas, fmt: s.fmt, suffix: "_rotated" + s.angle, meta: s.angle + "°" };
      }
    });
  });

  /* ---------- Favicon pack ---------- */
  C.register("images/favicon", function (root) {
    imageTool(root, {
      accept: "image/*",
      multiple: false,
      label: "Drop your logo or icon",
      cta: "Generate favicon pack",
      options: function (row) {
        var sizes = h("input", { type: "text", value: "16,32,48,180,192,512", style: "width:180px" });
        row.appendChild(h("label", { class: "field" }, ["Sizes (px) ", sizes]));
        return function () {
          var list = (sizes.value || "").split(",").map(function (x) { return parseInt(x.trim(), 10); })
            .filter(function (n) { return isFinite(n) && n > 0 && n <= 1024; });
          if (!list.length) throw new Error("Enter at least one valid size, e.g. 16,32,512.");
          return { sizes: list };
        };
      },
      transform: async function (img, file, s) {
        if (typeof JSZip === "undefined") throw new Error("Zip library failed to load, check your connection and refresh.");
        var zip = new JSZip();
        var iw = img.naturalWidth, ih = img.naturalHeight;
        var side = Math.min(iw, ih);
        for (var i = 0; i < s.sizes.length; i++) {
          var sz = s.sizes[i];
          var canvas = document.createElement("canvas");
          canvas.width = sz;
          canvas.height = sz;
          canvas.getContext("2d").drawImage(img, (iw - side) / 2, (ih - side) / 2, side, side, 0, 0, sz, sz);
          zip.file("favicon-" + sz + "x" + sz + ".png", await C.canvasToBlob(canvas, "image/png"));
        }
        var zblob = await zip.generateAsync({ type: "blob" });
        return { blob: zblob, fmt: "zip", suffix: "_favicons", meta: s.sizes.length + " sizes" };
      }
    });
  });

  /* ---------- SVG to PNG ---------- */
  C.register("images/svg-to-png", function (root) {
    imageTool(root, {
      accept: "image/svg+xml,.svg",
      multiple: false,
      allowSvg: true,
      label: "Drop an SVG file",
      options: function (row) {
        var scale = h("select", { "aria-label": "Scale" }, [1, 2, 4, 8].map(function (n) {
          return h("option", { value: String(n), text: n + "×" });
        }));
        scale.value = "2";
        row.appendChild(h("label", { class: "field" }, ["Scale ", scale]));
        return function () { return { scale: parseInt(scale.value, 10) }; };
      },
      transform: function (img, file, s) {
        var w = (img.naturalWidth || img.width || 400) * s.scale;
        var ht = (img.naturalHeight || img.height || 300) * s.scale;
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.min(8192, w));
        canvas.height = Math.max(1, Math.min(8192, ht));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        return { canvas: canvas, fmt: "png", suffix: "@" + s.scale + "x", meta: canvas.width + "×" + canvas.height };
      }
    });
  });

  /* ---------- HEIC to JPG ---------- */
  function isHeic(f) { return /\.(heic|heif)$/i.test(f.name) || /hei[cf]/.test(f.type); }
  C.register("images/heic-to-jpg", function (root) {
    imageTool(root, {
      accept: ".heic,.heif,image/heic,image/heif",
      multiple: true,
      raw: true,
      fileFilter: isHeic,
      badFileMsg: "Please choose .heic or .heif files (iPhone photos).",
      label: "Drop HEIC photos here",
      sub: "or click to browse, whole batches welcome",
      cta: "Convert to JPG",
      zipName: "convertze_heic_jpg.zip",
      options: function (row) {
        var q = h("input", { type: "range", min: "50", max: "100", value: "90" });
        var qv = h("span", { text: "90" });
        q.addEventListener("input", function () { qv.textContent = q.value; });
        row.appendChild(h("label", { class: "field" }, ["Quality ", q, qv, "%"]));
        return function () { return { quality: parseInt(q.value, 10) / 100 }; };
      },
      transform: async function (img, file, s) {
        if (typeof heic2any === "undefined") throw new Error("HEIC decoder failed to load, check your connection and refresh.");
        var res;
        try {
          res = await heic2any({ blob: file, toType: "image/jpeg", quality: s.quality });
        } catch (e) {
          throw new Error(file.name + " could not be decoded, is it really a HEIC file?");
        }
        if (Array.isArray(res)) {
          return { multi: res.map(function (b, i) { return { blob: b, fmt: "jpg", suffix: res.length > 1 ? "_" + (i + 1) : "" }; }) };
        }
        return { blob: res, fmt: "jpg" };
      }
    });
  });

  /* ---------- Image to text (OCR) ---------- */
  C.register("images/image-to-text", function (root) {
    var state = { file: null };
    var lang = h("select", { "aria-label": "Language" }, [
      h("option", { value: "eng", text: "English" }),
      h("option", { value: "hin", text: "Hindi" }),
      h("option", { value: "eng+hin", text: "English + Hindi" })
    ]);
    var btn = h("button", { class: "btn", type: "button", disabled: true, text: "Extract text" });
    var status, extra;

    C.dropzone(root, {
      accept: "image/*",
      multiple: false,
      label: "Drop an image or screenshot here",
      sub: "JPG, PNG or WebP with readable text",
      onFiles: function (files) {
        var f = files.filter(function (x) { return /^image\//.test(x.type); })[0];
        if (!f) { status.set("error", "Please choose an image file."); return; }
        state.file = f;
        status.set("done", f.name + " ready. The recognition model downloads on first use (a few MB).");
        btn.disabled = false;
      }
    });
    root.appendChild(h("div", { class: "opts" }, [h("label", { class: "field" }, ["Language ", lang])]));
    root.appendChild(h("div", { class: "actions-row" }, [btn]));
    status = C.makeStatus(root);
    extra = h("div");
    root.appendChild(extra);

    btn.addEventListener("click", async function () {
      if (!state.file || btn.disabled) return;
      if (typeof Tesseract === "undefined") { status.set("error", "OCR engine failed to load, check your connection and refresh."); return; }
      btn.disabled = true;
      extra.innerHTML = "";
      try {
        var result = await Tesseract.recognize(state.file, lang.value, {
          logger: function (m) {
            if (m.status && typeof m.progress === "number") {
              status.set("processing", m.status.charAt(0).toUpperCase() + m.status.slice(1) + "... " + Math.round(m.progress * 100) + "%");
            }
          }
        });
        var text = (result.data.text || "").trim();
        if (!text) { status.set("error", "No readable text found in that image."); btn.disabled = false; return; }
        var base = C.baseName(state.file.name);
        extra.appendChild(h("div", { class: "ta-label", style: "margin-top:14px" }, [
          h("span", { text: "Extracted text" }),
          h("span", { class: "mini-btns" }, [
            h("button", { class: "mini primary", type: "button", text: "Copy", onclick: function () { C.copyText(text); } }),
            h("button", { class: "mini", type: "button", text: "Download .txt", onclick: function () {
              C.download(new Blob([text], { type: "text/plain" }), base + ".txt");
            } })
          ])
        ]));
        extra.appendChild(h("pre", { class: "outbox", text: text }));
        status.set("done", "Done. OCR is never perfect, give it a quick read.");
      } catch (e) {
        status.set("error", e && e.message ? e.message : "Recognition failed.");
      }
      btn.disabled = false;
    });
    C.onRun(function () { btn.click(); });
    C.onClear(function () { state.file = null; btn.disabled = true; extra.innerHTML = ""; status.set("idle", "Cleared."); });
  });

  C.boot();
})();
