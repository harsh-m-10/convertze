/* Convertze text tools: live counts, case changes, line cleanup, filler text, slugs.
   word-counter, case-converter, sort-lines, lorem-ipsum, slug-generator. */
(function () {
  "use strict";
  var C = window.Convertze;
  var h = C.h;

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function droppable(input, after) {
    ["dragover", "drop"].forEach(function (ev) {
      input.addEventListener(ev, async function (e) {
        e.preventDefault();
        if (ev === "drop" && e.dataTransfer.files[0]) {
          input.value = await C.readFile(e.dataTransfer.files[0], "text");
          after();
        }
      });
    });
  }

  /* ---------- Word counter ---------- */
  C.register("text/word-counter", function (root) {
    var input = h("textarea", { class: "ta", placeholder: "Paste or type your text here...", spellcheck: "false", style: "min-height:260px", "aria-label": "Text to count" });
    function row(label) {
      var td = h("td");
      var tr = h("tr", null, [h("th", { text: label }), td]);
      return { tr: tr, set: function (v) { td.textContent = v; } };
    }
    var rows = {
      words: row("Words"),
      chars: row("Characters"),
      charsNs: row("Characters (no spaces)"),
      sentences: row("Sentences"),
      paragraphs: row("Paragraphs"),
      reading: row("Reading time")
    };
    root.appendChild(h("div", { class: "ta-label" }, [h("span", { text: "Text" })]));
    root.appendChild(input);
    root.appendChild(h("table", { class: "kv" }, Object.keys(rows).map(function (k) { return rows[k].tr; })));

    function run() {
      var t = input.value;
      var trimmed = t.trim();
      var words = trimmed ? trimmed.split(/\s+/).length : 0;
      var sentences = trimmed ? (trimmed.match(/[.!?]+(?=\s|$)/g) || []).length || 1 : 0;
      var paragraphs = trimmed ? trimmed.split(/\n\s*\n+/).length : 0;
      var mins = words / 200;
      var reading = words === 0 ? "0 min" : mins < 1 ? "under 1 min" : Math.round(mins) + " min";
      rows.words.set(words.toLocaleString());
      rows.chars.set(t.length.toLocaleString());
      rows.charsNs.set(t.replace(/\s/g, "").length.toLocaleString());
      rows.sentences.set(sentences.toLocaleString());
      rows.paragraphs.set(paragraphs.toLocaleString());
      rows.reading.set(reading);
    }
    input.addEventListener("input", debounce(run, 100));
    droppable(input, run);
    C.onRun(run);
    C.onClear(function () { input.value = ""; run(); });
    run();
  });

  /* ---------- Case converter ---------- */
  C.register("text/case-converter", function (root) {
    var input = h("textarea", { class: "ta", placeholder: "Type or paste text to convert...", spellcheck: "false", "aria-label": "Text to convert" });
    var output = h("textarea", { class: "ta", readonly: "readonly", placeholder: "Converted text appears here...", "aria-label": "Converted text" });
    var copyBtn = h("button", { class: "mini primary", type: "button", text: "Copy" });
    var dlBtn = h("button", { class: "mini", type: "button", text: "Download" });

    function words(text) {
      // Split camelCase runs first so code identifiers convert cleanly.
      return text.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .split(/[^A-Za-z0-9]+/).filter(Boolean);
    }
    var MODES = {
      "UPPERCASE": function (t) { return t.toUpperCase(); },
      "lowercase": function (t) { return t.toLowerCase(); },
      "Title Case": function (t) {
        return t.toLowerCase().replace(/(^|\s|[-("'])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); });
      },
      "Sentence case": function (t) {
        return t.toLowerCase().replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, function (m) { return m.toUpperCase(); });
      },
      "camelCase": function (t) {
        return words(t).map(function (w, i) {
          w = w.toLowerCase();
          return i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1);
        }).join("");
      },
      "snake_case": function (t) { return words(t).map(function (w) { return w.toLowerCase(); }).join("_"); },
      "kebab-case": function (t) { return words(t).map(function (w) { return w.toLowerCase(); }).join("-"); }
    };
    var mode = "UPPERCASE";
    var btns = {};
    var bar = h("div", { class: "opts", style: "margin:0 0 13px" }, Object.keys(MODES).map(function (m) {
      var b = h("button", { class: "mini" + (m === mode ? " on" : ""), type: "button", text: m });
      b.addEventListener("click", function () {
        mode = m;
        Object.keys(btns).forEach(function (k) { btns[k].classList.toggle("on", k === mode); });
        run();
      });
      btns[m] = b;
      return b;
    }));

    root.appendChild(bar);
    root.appendChild(h("div", { class: "duo" }, [
      h("div", null, [h("div", { class: "ta-label" }, [h("span", { text: "Input" })]), input]),
      h("div", null, [h("div", { class: "ta-label" }, [h("span", { text: "Output" }), h("span", { class: "mini-btns" }, [copyBtn, dlBtn])]), output])
    ]));

    function run() { output.value = input.value ? MODES[mode](input.value) : ""; }
    input.addEventListener("input", debounce(run, 100));
    droppable(input, run);
    copyBtn.addEventListener("click", function () { if (output.value) C.copyText(output.value); });
    dlBtn.addEventListener("click", function () {
      if (output.value) C.download(new Blob([output.value], { type: "text/plain" }), "converted.txt");
    });
    C.onRun(run);
    C.onClear(function () { input.value = ""; run(); });
  });

  /* ---------- Sort & dedupe lines ---------- */
  C.register("text/sort-lines", function (root) {
    var input = h("textarea", { class: "ta", placeholder: "One item per line...", spellcheck: "false", "aria-label": "Lines to sort" });
    var output = h("textarea", { class: "ta", readonly: "readonly", placeholder: "Cleaned lines appear here...", "aria-label": "Sorted lines" });
    var copyBtn = h("button", { class: "mini primary", type: "button", text: "Copy" });
    var dlBtn = h("button", { class: "mini", type: "button", text: "Download" });
    var summary = h("span", { text: "Output" });

    var sortSel = h("select", { "aria-label": "Sort order" }, [
      h("option", { value: "az", text: "Sort A to Z" }),
      h("option", { value: "za", text: "Sort Z to A" }),
      h("option", { value: "none", text: "Keep order" })
    ]);
    function check(label, on) {
      var box = h("input", { type: "checkbox" });
      box.checked = on;
      var wrap = h("label", { class: "field" }, [box, label]);
      return { box: box, wrap: wrap };
    }
    var ci = check("Case-insensitive", true);
    var dedupe = check("Remove duplicates", true);
    var trim = check("Trim & drop empty lines", true);
    var rev = check("Reverse", false);

    root.appendChild(h("div", { class: "opts", style: "margin:0 0 13px" }, [
      h("span", { class: "field" }, [sortSel]), ci.wrap, dedupe.wrap, trim.wrap, rev.wrap
    ]));
    root.appendChild(h("div", { class: "duo" }, [
      h("div", null, [h("div", { class: "ta-label" }, [h("span", { text: "Input" })]), input]),
      h("div", null, [h("div", { class: "ta-label" }, [summary, h("span", { class: "mini-btns" }, [copyBtn, dlBtn])]), output])
    ]));

    function run() {
      if (!input.value) { output.value = ""; summary.textContent = "Output"; return; }
      var lines = input.value.split(/\r?\n/);
      var inCount = lines.length;
      if (trim.box.checked) lines = lines.map(function (l) { return l.trim(); }).filter(function (l) { return l.length; });
      var key = function (l) { return ci.box.checked ? l.toLowerCase() : l; };
      if (sortSel.value !== "none") {
        lines.sort(function (a, b) { return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0; });
        if (sortSel.value === "za") lines.reverse();
      }
      if (dedupe.box.checked) {
        var seen = {};
        lines = lines.filter(function (l) {
          var k = key(l);
          if (seen[k]) return false;
          seen[k] = true;
          return true;
        });
      }
      if (rev.box.checked) lines.reverse();
      output.value = lines.join("\n");
      summary.textContent = inCount + " lines in, " + lines.length + " out";
    }
    input.addEventListener("input", debounce(run, 120));
    droppable(input, run);
    [sortSel, ci.box, dedupe.box, trim.box, rev.box].forEach(function (el) {
      el.addEventListener("change", run);
    });
    copyBtn.addEventListener("click", function () { if (output.value) C.copyText(output.value); });
    dlBtn.addEventListener("click", function () {
      if (output.value) C.download(new Blob([output.value], { type: "text/plain" }), "lines.txt");
    });
    C.onRun(run);
    C.onClear(function () { input.value = ""; run(); });
  });

  /* ---------- Lorem ipsum ---------- */
  C.register("text/lorem-ipsum", function (root) {
    var WORDS = ("lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore " +
      "magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat " +
      "duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat " +
      "cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum").split(" ");
    var OPENER = "Lorem ipsum dolor sit amet, consectetur adipiscing elit";

    var count = h("input", { type: "number", value: "3", min: "1", max: "100", "aria-label": "How many" });
    var unit = h("select", { "aria-label": "Unit" }, [
      h("option", { value: "paragraphs", text: "paragraphs" }),
      h("option", { value: "sentences", text: "sentences" }),
      h("option", { value: "words", text: "words" })
    ]);
    var genBtn = h("button", { class: "mini primary", type: "button", text: "Generate" });
    var copyBtn = h("button", { class: "mini", type: "button", text: "Copy" });
    var dlBtn = h("button", { class: "mini", type: "button", text: "Download" });
    var output = h("textarea", { class: "ta", readonly: "readonly", style: "min-height:260px", "aria-label": "Generated text" });

    root.appendChild(h("div", { class: "opts", style: "margin:0 0 13px" }, [
      h("label", { class: "field" }, ["Generate ", count, unit]), genBtn
    ]));
    root.appendChild(h("div", { class: "ta-label" }, [h("span", { text: "Result" }), h("span", { class: "mini-btns" }, [copyBtn, dlBtn])]));
    root.appendChild(output);

    function rand(n) { return Math.floor(Math.random() * n); }
    function word() { return WORDS[rand(WORDS.length)]; }
    function sentence() {
      var n = 6 + rand(9), parts = [];
      for (var i = 0; i < n; i++) parts.push(word());
      var s = parts.join(" ");
      return s.charAt(0).toUpperCase() + s.slice(1) + ".";
    }
    function paragraph(first) {
      var n = 4 + rand(4), parts = first ? [OPENER + ", " + sentence().toLowerCase()] : [];
      for (var i = parts.length; i < n; i++) parts.push(sentence());
      return parts.join(" ");
    }
    function run() {
      var n = Math.max(1, Math.min(100, parseInt(count.value, 10) || 1));
      var out = [];
      if (unit.value === "paragraphs") {
        for (var i = 0; i < n; i++) out.push(paragraph(i === 0));
        output.value = out.join("\n\n");
      } else if (unit.value === "sentences") {
        for (var j = 0; j < n; j++) out.push(j === 0 ? OPENER + "." : sentence());
        output.value = out.join(" ");
      } else {
        out.push("lorem", "ipsum");
        while (out.length < n) out.push(word());
        output.value = out.slice(0, n).join(" ");
      }
    }
    genBtn.addEventListener("click", run);
    [count, unit].forEach(function (el) { el.addEventListener("change", run); });
    copyBtn.addEventListener("click", function () { if (output.value) C.copyText(output.value); });
    dlBtn.addEventListener("click", function () {
      if (output.value) C.download(new Blob([output.value], { type: "text/plain" }), "lorem-ipsum.txt");
    });
    C.onRun(run);
    C.onClear(function () { output.value = ""; });
    run();
  });

  /* ---------- Slug generator ---------- */
  C.register("text/slug-generator", function (root) {
    var input = h("input", { class: "single-input", type: "text", placeholder: "My Great Article: A How-To!", "aria-label": "Text to slugify" });
    var output = h("input", { class: "single-input", type: "text", readonly: "readonly", style: "font-family:var(--mono);margin-top:13px", placeholder: "my-great-article-a-how-to", "aria-label": "Slug" });
    var copyBtn = h("button", { class: "mini primary", type: "button", text: "Copy" });

    root.appendChild(h("div", { class: "ta-label" }, [h("span", { text: "Text" })]));
    root.appendChild(input);
    root.appendChild(h("div", { class: "ta-label", style: "margin-top:13px" }, [h("span", { text: "Slug" }), h("span", { class: "mini-btns" }, [copyBtn])]));
    root.appendChild(output);

    function slugify(t) {
      return t.normalize("NFKD")
        .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
    function run() {
      output.value = slugify(input.value);
      if (input.value) C.hashState.save({ i: input.value.length > 500 ? "" : input.value });
    }
    input.addEventListener("input", debounce(run, 80));
    copyBtn.addEventListener("click", function () { if (output.value) C.copyText(output.value); });
    C.onRun(run);
    C.onClear(function () { input.value = ""; output.value = ""; });
    var st = C.hashState.load();
    if (st && st.i) { input.value = st.i; run(); }
  });

  C.boot();
})();
