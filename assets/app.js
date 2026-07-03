/* Convertze shared shell: theme, search, toasts, recent tools, and helpers for tool modules. */
(function () {
  "use strict";

  /* ---------- Theme (dark default; html.light for light mode) ---------- */
  var toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var light = document.documentElement.classList.toggle("light");
      try { localStorage.setItem("convertze-theme", light ? "light" : "dark"); } catch (e) {}
    });
  }

  /* ---------- Toasts ---------- */
  var toastStack = null;
  function toast(type, msg) {
    if (!toastStack) {
      toastStack = document.createElement("div");
      toastStack.className = "toast-stack";
      document.body.appendChild(toastStack);
    }
    var t = document.createElement("div");
    t.className = "toast " + (type === "error" ? "err" : "ok");
    t.innerHTML = '<span class="t-dot"></span>';
    t.appendChild(document.createTextNode(msg));
    toastStack.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  /* ---------- Tool search (header + homepage + 404) ---------- */
  var INDEX = window.TOOL_INDEX || [];
  function wireSearch(input, pop) {
    var sel = -1;
    function close() { pop.classList.remove("open"); sel = -1; }
    function render() {
      var q = input.value.trim().toLowerCase();
      if (!q) { close(); return; }
      var hits = INDEX.filter(function (t) {
        return (t.n + " " + t.s).toLowerCase().indexOf(q) !== -1;
      }).slice(0, 8);
      pop.innerHTML = "";
      if (!hits.length) {
        var none = document.createElement("div");
        none.className = "none";
        none.textContent = "No tools match '" + input.value.trim() + "'";
        pop.appendChild(none);
      } else {
        hits.forEach(function (t) {
          var a = document.createElement("a");
          a.href = "/" + t.p;
          a.innerHTML = "<b></b><small></small>";
          a.querySelector("b").textContent = t.n;
          a.querySelector("small").textContent = t.s;
          pop.appendChild(a);
        });
      }
      sel = -1;
      pop.classList.add("open");
    }
    input.addEventListener("input", render);
    input.addEventListener("focus", render);
    input.addEventListener("keydown", function (e) {
      var links = pop.querySelectorAll("a");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!links.length) return;
        sel = e.key === "ArrowDown" ? (sel + 1) % links.length : (sel - 1 + links.length) % links.length;
        links.forEach(function (l, i) { l.classList.toggle("sel", i === sel); });
      } else if (e.key === "Enter" && sel >= 0 && links[sel]) {
        window.location.href = links[sel].href;
      } else if (e.key === "Escape") {
        input.value = "";
        close();
      }
    });
    document.addEventListener("click", function (e) {
      if (!pop.contains(e.target) && e.target !== input) close();
    });
  }
  document.querySelectorAll("[data-tool-search]").forEach(function (box) {
    var input = box.querySelector("input");
    var pop = box.querySelector(".search-pop");
    if (input && pop) wireSearch(input, pop);
  });

  /* ---------- Homepage grid filter ---------- */
  var gridSearch = document.getElementById("grid-search");
  if (gridSearch) {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".tool-card[data-name]"));
    var sections = Array.prototype.slice.call(document.querySelectorAll(".cat-section"));
    var empty = document.querySelector(".no-results");
    gridSearch.addEventListener("input", function () {
      var q = gridSearch.value.trim().toLowerCase();
      var any = false;
      cards.forEach(function (c) {
        var hit = !q || c.getAttribute("data-name").indexOf(q) !== -1;
        c.style.display = hit ? "" : "none";
        if (hit) any = true;
      });
      sections.forEach(function (s) {
        var vis = s.querySelector('.tool-card[data-name]:not([style*="none"])');
        s.style.display = vis ? "" : "none";
      });
      if (empty) empty.style.display = any ? "none" : "block";
    });
  }

  /* ---------- Recently used tools ---------- */
  function getRecent() {
    try { return JSON.parse(localStorage.getItem("convertze-recent") || "[]"); } catch (e) { return []; }
  }
  function pushRecent(path) {
    try {
      var list = getRecent().filter(function (p) { return p !== path; });
      list.unshift(path);
      localStorage.setItem("convertze-recent", JSON.stringify(list.slice(0, 5)));
    } catch (e) {}
  }
  var recentBox = document.getElementById("recent-tools");
  if (recentBox) {
    var recent = getRecent()
      .map(function (p) { return INDEX.filter(function (t) { return t.p === p; })[0]; })
      .filter(Boolean);
    if (recent.length) {
      recentBox.style.display = "";
      var grid = recentBox.querySelector(".grid");
      var CAT_ICON = {
        images: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
        pdf: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        dev: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
        text: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
        calc: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>'
      };
      recent.forEach(function (t) {
        var cat = t.p.split("/")[0];
        var a = document.createElement("a");
        a.className = "tool-card";
        a.href = "/" + t.p;
        a.innerHTML = '<span class="t-icon c-' + cat + '">' + (CAT_ICON[cat] || CAT_ICON.images) +
          '</span><span class="t-text"><b></b><span></span></span>';
        a.querySelector("b").textContent = t.n;
        a.querySelector(".t-text span").textContent = t.s;
        grid.appendChild(a);
      });
    }
  }

  /* ---------- Service worker ---------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }

  /* ---------- Shared helpers for tool modules ---------- */
  var registry = {};

  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k.indexOf("on") === 0) node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] === true) node.setAttribute(k, "");
        else if (attrs[k] !== false && attrs[k] != null) node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function fmtKB(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + " MB";
    return (bytes / 1024).toFixed(1) + " KB";
  }

  function baseName(name) {
    return (name || "file").replace(/\.[^/.]+$/, "") || "file";
  }

  function download(blobOrUrl, filename) {
    var url = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof blobOrUrl !== "string") setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* files: [{name, data: Blob|Uint8Array|string}], single file directly, several as a zip. */
  async function deliver(files, zipName) {
    if (files.length === 1) {
      var only = files[0];
      download(only.data instanceof Blob ? only.data : new Blob([only.data]), only.name);
      return only.name;
    }
    if (typeof JSZip === "undefined") {
      files.forEach(function (f, i) {
        setTimeout(function () { download(f.data instanceof Blob ? f.data : new Blob([f.data]), f.name); }, i * 350);
      });
      return files.length + " files";
    }
    var zip = new JSZip();
    files.forEach(function (f) { zip.file(f.name, f.data); });
    var blob = await zip.generateAsync({ type: "blob" });
    download(blob, zipName);
    return zipName;
  }

  function readFile(file, as) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error("Could not read " + file.name)); };
      if (as === "text") r.readAsText(file);
      else if (as === "buffer") r.readAsArrayBuffer(file);
      else r.readAsDataURL(file);
    });
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, revoke: function () { URL.revokeObjectURL(url); } }); };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Could not load " + file.name + " as an image."));
      };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) {
        if (b) resolve(b);
        else reject(new Error("Export failed, the image may be too large."));
      }, mime, quality);
    });
  }

  /* Highest quality that fits under maxBytes; null if impossible at this canvas size. */
  async function encodeUnder(canvas, mime, maxBytes) {
    var hi = 0.95, lo = 0.05;
    var blob = await canvasToBlob(canvas, mime, hi);
    if (blob.size <= maxBytes) return { blob: blob, quality: hi };
    blob = await canvasToBlob(canvas, mime, lo);
    if (blob.size > maxBytes) return null;
    var best = { blob: blob, quality: lo };
    for (var i = 0; i < 8; i++) {
      var mid = (lo + hi) / 2;
      var b = await canvasToBlob(canvas, mime, mid);
      if (b.size <= maxBytes) { best = { blob: b, quality: mid }; lo = mid; }
      else hi = mid;
    }
    return best;
  }

  var ICONS = {
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
  };

  function dropzone(parent, opts) {
    var input = h("input", { type: "file", hidden: true, "aria-label": "Choose file" });
    if (opts.accept) input.setAttribute("accept", opts.accept);
    if (opts.multiple) input.setAttribute("multiple", "");
    var dz = h("div", { class: "dz", role: "button", tabindex: "0", "aria-label": opts.label || "Choose file" }, [
      h("div", { class: "dz-icon", html: ICONS.upload }),
      h("b", { text: opts.label || "Drop your file here" }),
      h("p", { text: opts.sub || "or click to browse" })
    ]);
    function emit(list) {
      var files = Array.prototype.slice.call(list || []);
      if (!files.length) return;
      opts.onFiles(opts.multiple ? files : [files[0]]);
    }
    dz.addEventListener("click", function () { input.click(); });
    dz.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
    });
    input.addEventListener("change", function () { emit(input.files); input.value = ""; });
    ["dragenter", "dragover", "dragleave", "drop"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.toggle("active", ev === "dragenter" || ev === "dragover");
        if (ev === "drop") emit(e.dataTransfer.files);
      });
    });
    parent.appendChild(dz);
    parent.appendChild(input);
    return { dz: dz, input: input };
  }

  function makeStatus(parent) {
    var dot = h("span", { class: "s-dot" });
    var spin = h("span", { class: "spinner" });
    var txt = h("span", { text: "Ready when you are." });
    var node = h("div", { class: "status" }, [dot, spin, txt]);
    parent.appendChild(node);
    return {
      node: node,
      set: function (state, msg) {
        node.className = "status " + state;
        txt.textContent = msg;
        if (state === "error") toast("error", msg);
      }
    };
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("ok", "Copied to clipboard");
    } catch (e) {
      toast("error", "Copy failed, select and copy manually.");
    }
  }

  /* ---------- URL hash state (shareable dev-tool inputs) ---------- */
  var hashState = {
    save: function (obj) {
      try {
        var json = JSON.stringify(obj);
        if (json.length > 4000) return;
        var b64 = btoa(unescape(encodeURIComponent(json)))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        history.replaceState(null, "", "#" + b64);
      } catch (e) {}
    },
    load: function () {
      var hsh = location.hash.replace(/^#/, "");
      if (!hsh) return null;
      try {
        var safe = hsh.replace(/-/g, "+").replace(/_/g, "/");
        while (safe.length % 4) safe += "=";
        return JSON.parse(decodeURIComponent(escape(atob(safe))));
      } catch (e) { return null; }
    }
  };

  /* ---------- Keyboard: Ctrl+Enter runs, Escape clears ---------- */
  var runHandler = null, clearHandler = null;
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && runHandler) {
      e.preventDefault();
      runHandler();
    } else if (e.key === "Escape" && clearHandler && document.activeElement && document.activeElement.tagName !== "INPUT") {
      clearHandler();
    }
  });

  window.Convertze = {
    register: function (slug, fn) { registry[slug] = fn; },
    boot: function () {
      var root = document.getElementById("tool-root");
      if (!root) return;
      var slug = root.getAttribute("data-tool");
      if (registry[slug]) {
        root.innerHTML = "";
        registry[slug](root);
        pushRecent(slug);
      }
    },
    h: h,
    fmtKB: fmtKB,
    baseName: baseName,
    download: download,
    deliver: deliver,
    readFile: readFile,
    loadImage: loadImage,
    canvasToBlob: canvasToBlob,
    encodeUnder: encodeUnder,
    dropzone: dropzone,
    makeStatus: makeStatus,
    toast: toast,
    copyText: copyText,
    hashState: hashState,
    onRun: function (fn) { runHandler = fn; },
    onClear: function (fn) { clearHandler = fn; }
  };
})();
