/* Convertze calculators: currency-converter, unit converters (length, weight,
   temperature, area, speed, data size) and percentage, age, EMI, GST and BMI
   calculators. Currency rates come from the open.er-api.com public endpoint,
   cached locally for a day; everything else is pure local math. */
(function () {
  "use strict";
  var C = window.Convertze;
  var h = C.h;

  var RATES_URL = "https://open.er-api.com/v6/latest/USD";
  var CACHE_KEY = "convertze-fx-usd";
  var CACHE_MS = 24 * 60 * 60 * 1000;

  var POPULAR = ["USD", "EUR", "INR", "GBP", "JPY", "AUD", "CAD", "SGD", "AED", "CNY"];
  var NAMES = {
    USD: "US Dollar", EUR: "Euro", INR: "Indian Rupee", GBP: "British Pound", JPY: "Japanese Yen",
    AUD: "Australian Dollar", CAD: "Canadian Dollar", SGD: "Singapore Dollar", AED: "UAE Dirham",
    CNY: "Chinese Yuan", CHF: "Swiss Franc", HKD: "Hong Kong Dollar", NZD: "New Zealand Dollar",
    KRW: "South Korean Won", THB: "Thai Baht", MYR: "Malaysian Ringgit", IDR: "Indonesian Rupiah",
    PHP: "Philippine Peso", VND: "Vietnamese Dong", BDT: "Bangladeshi Taka", PKR: "Pakistani Rupee",
    LKR: "Sri Lankan Rupee", NPR: "Nepalese Rupee", SAR: "Saudi Riyal", QAR: "Qatari Riyal",
    KWD: "Kuwaiti Dinar", BHD: "Bahraini Dinar", OMR: "Omani Rial", ZAR: "South African Rand",
    NGN: "Nigerian Naira", KES: "Kenyan Shilling", EGP: "Egyptian Pound", TRY: "Turkish Lira",
    RUB: "Russian Ruble", UAH: "Ukrainian Hryvnia", PLN: "Polish Zloty", CZK: "Czech Koruna",
    SEK: "Swedish Krona", NOK: "Norwegian Krone", DKK: "Danish Krone", HUF: "Hungarian Forint",
    RON: "Romanian Leu", BRL: "Brazilian Real", MXN: "Mexican Peso", ARS: "Argentine Peso",
    CLP: "Chilean Peso", COP: "Colombian Peso", PEN: "Peruvian Sol", ILS: "Israeli Shekel",
    TWD: "Taiwan Dollar", FJD: "Fijian Dollar", MUR: "Mauritian Rupee", MAD: "Moroccan Dirham"
  };

  async function getRates() {
    try {
      var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.at < CACHE_MS) return cached;
    } catch (e) { /* fall through to fetch */ }
    var res = await fetch(RATES_URL);
    if (!res.ok) throw new Error("rates fetch failed");
    var json = await res.json();
    if (json.result !== "success" || !json.rates) throw new Error("rates response invalid");
    var entry = { at: Date.now(), updated: json.time_last_update_utc || "", rates: json.rates };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch (e) { /* cache is optional */ }
    return entry;
  }

  function staleRates() {
    try {
      var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && cached.rates) return cached;
    } catch (e) { /* no cache */ }
    return null;
  }

  C.register("calc/currency-converter", function (root) {
    var amount = h("input", { class: "single-input", type: "number", value: "100", min: "0", step: "any", "aria-label": "Amount", style: "max-width:220px" });
    var from = h("select", { "aria-label": "From currency" });
    var to = h("select", { "aria-label": "To currency" });
    var swap = h("button", { class: "mini", type: "button", text: "⇄ Swap", "aria-label": "Swap currencies" });
    var result = h("div", { class: "outbox", style: "font-family:Inter,ui-sans-serif,sans-serif;font-size:20px;font-weight:600;max-height:none" , text: "Loading exchange rates..." });
    var rateLine = h("p", { class: "kbd-hint", style: "margin:10px 0 0" });
    var err = h("div", { class: "ta-err", role: "alert" });

    root.appendChild(h("div", { class: "opts" }, [
      h("label", { class: "field" }, ["Amount ", amount]),
      h("label", { class: "field" }, ["From ", from]),
      h("label", { class: "field" }, ["To ", to]),
      swap
    ]));
    root.appendChild(h("div", { class: "ta-label", style: "margin-top:13px" }, [h("span", { text: "Converted" })]));
    root.appendChild(result);
    root.appendChild(rateLine);
    root.appendChild(err);

    var rates = null, updated = "";

    function fillSelects(codes) {
      var ordered = POPULAR.filter(function (c) { return codes.indexOf(c) !== -1; })
        .concat(codes.filter(function (c) { return POPULAR.indexOf(c) === -1; }).sort());
      [from, to].forEach(function (sel) {
        sel.innerHTML = "";
        ordered.forEach(function (code) {
          sel.appendChild(h("option", { value: code, text: code + (NAMES[code] ? " · " + NAMES[code] : "") }));
        });
      });
      from.value = "USD";
      to.value = "INR";
    }

    function run() {
      err.classList.remove("show");
      if (!rates) return;
      var amt = parseFloat(amount.value);
      if (!isFinite(amt)) { result.textContent = "-"; return; }
      var rFrom = rates[from.value], rTo = rates[to.value];
      if (!rFrom || !rTo) { result.textContent = "-"; return; }
      var value = amt * (rTo / rFrom);
      var digits = value >= 1000 ? 2 : value >= 1 ? 4 : 6;
      result.textContent = amt.toLocaleString(undefined, { maximumFractionDigits: 6 }) + " " + from.value +
        " = " + value.toLocaleString(undefined, { maximumFractionDigits: digits }) + " " + to.value;
      var unit = (rTo / rFrom);
      rateLine.textContent = "1 " + from.value + " = " + unit.toLocaleString(undefined, { maximumFractionDigits: 6 }) +
        " " + to.value + (updated ? " · rates updated " + updated.replace(/ \d\d:\d\d:\d\d.*$/, "") : "");
      C.hashState.save({ a: amount.value, f: from.value, t: to.value });
    }

    swap.addEventListener("click", function () {
      var f = from.value;
      from.value = to.value;
      to.value = f;
      run();
    });
    [amount, from, to].forEach(function (el) {
      el.addEventListener("input", run);
      el.addEventListener("change", run);
    });
    C.onRun(run);
    C.onClear(function () { amount.value = "100"; run(); });

    getRates().then(function (entry) {
      rates = entry.rates;
      updated = entry.updated;
      fillSelects(Object.keys(rates));
      var st = C.hashState.load();
      if (st) {
        if (st.a) amount.value = st.a;
        if (st.f && rates[st.f]) from.value = st.f;
        if (st.t && rates[st.t]) to.value = st.t;
      }
      run();
    }).catch(function () {
      var cached = staleRates();
      if (cached) {
        rates = cached.rates;
        updated = cached.updated + " (offline copy)";
        fillSelects(Object.keys(rates));
        run();
        return;
      }
      result.textContent = "-";
      err.textContent = "Couldn't load exchange rates. Check your connection and try again; rates are the one thing this site has to fetch.";
      err.classList.add("show");
    });
  });

  /* ---------- Generic unit converter engine ---------- */
  function fmt(v) {
    if (!isFinite(v)) return "-";
    var digits = Math.abs(v) >= 1000 ? 2 : Math.abs(v) >= 1 ? 4 : 6;
    return Number(v.toPrecision(10)).toLocaleString(undefined, { maximumFractionDigits: digits });
  }

  /* units: [{ code, name, f }] with factor to a base unit, or
     [{ code, name, toBase(v), fromBase(v) }] for non-linear scales. */
  function unitTool(slug, units, defFrom, defTo) {
    C.register(slug, function (root) {
      var amount = h("input", { class: "single-input", type: "number", value: "1", step: "any", "aria-label": "Amount", style: "max-width:200px" });
      function sel(label) {
        var s = h("select", { "aria-label": label }, units.map(function (u) {
          return h("option", { value: u.code, text: u.code + " · " + u.name });
        }));
        return s;
      }
      var from = sel("From unit"), to = sel("To unit");
      from.value = defFrom;
      to.value = defTo;
      var swap = h("button", { class: "mini", type: "button", text: "⇄ Swap" });
      var result = h("div", { class: "outbox", style: "font-family:Inter,ui-sans-serif,sans-serif;font-size:20px;font-weight:600;max-height:none", text: "-" });
      var rateLine = h("p", { class: "kbd-hint", style: "margin:10px 0 0" });

      root.appendChild(h("div", { class: "opts" }, [
        h("label", { class: "field" }, ["Amount ", amount]),
        h("label", { class: "field" }, ["From ", from]),
        h("label", { class: "field" }, ["To ", to]),
        swap
      ]));
      root.appendChild(h("div", { class: "ta-label", style: "margin-top:13px" }, [h("span", { text: "Converted" })]));
      root.appendChild(result);
      root.appendChild(rateLine);

      var byCode = {};
      units.forEach(function (u) { byCode[u.code] = u; });
      function toBase(u, v) { return u.toBase ? u.toBase(v) : v * u.f; }
      function fromBase(u, v) { return u.fromBase ? u.fromBase(v) : v / u.f; }
      function run() {
        var v = parseFloat(amount.value);
        var uf = byCode[from.value], ut = byCode[to.value];
        if (!isFinite(v)) { result.textContent = "-"; rateLine.textContent = ""; return; }
        var out = fromBase(ut, toBase(uf, v));
        result.textContent = fmt(v) + " " + from.value + " = " + fmt(out) + " " + to.value;
        var unit = fromBase(ut, toBase(uf, 1));
        rateLine.textContent = uf.toBase ? "" : "1 " + from.value + " = " + fmt(unit) + " " + to.value;
        C.hashState.save({ a: amount.value, f: from.value, t: to.value });
      }
      swap.addEventListener("click", function () {
        var f = from.value; from.value = to.value; to.value = f; run();
      });
      [amount, from, to].forEach(function (el) {
        el.addEventListener("input", run);
        el.addEventListener("change", run);
      });
      C.onRun(run);
      C.onClear(function () { amount.value = "1"; run(); });
      var st = C.hashState.load();
      if (st) {
        if (st.a) amount.value = st.a;
        if (st.f && byCode[st.f]) from.value = st.f;
        if (st.t && byCode[st.t]) to.value = st.t;
      }
      run();
    });
  }

  unitTool("calc/length-converter", [
    { code: "mm", name: "Millimetre", f: 0.001 },
    { code: "cm", name: "Centimetre", f: 0.01 },
    { code: "m", name: "Metre", f: 1 },
    { code: "km", name: "Kilometre", f: 1000 },
    { code: "in", name: "Inch", f: 0.0254 },
    { code: "ft", name: "Foot", f: 0.3048 },
    { code: "yd", name: "Yard", f: 0.9144 },
    { code: "mi", name: "Mile", f: 1609.344 }
  ], "cm", "in");

  unitTool("calc/weight-converter", [
    { code: "mg", name: "Milligram", f: 0.000001 },
    { code: "g", name: "Gram", f: 0.001 },
    { code: "kg", name: "Kilogram", f: 1 },
    { code: "t", name: "Tonne", f: 1000 },
    { code: "oz", name: "Ounce", f: 0.028349523125 },
    { code: "lb", name: "Pound", f: 0.45359237 }
  ], "kg", "lb");

  unitTool("calc/temperature-converter", [
    { code: "°C", name: "Celsius", toBase: function (v) { return v; }, fromBase: function (v) { return v; } },
    { code: "°F", name: "Fahrenheit", toBase: function (v) { return (v - 32) * 5 / 9; }, fromBase: function (v) { return v * 9 / 5 + 32; } },
    { code: "K", name: "Kelvin", toBase: function (v) { return v - 273.15; }, fromBase: function (v) { return v + 273.15; } }
  ], "°C", "°F");

  unitTool("calc/area-converter", [
    { code: "sq ft", name: "Square foot", f: 0.09290304 },
    { code: "sq yd", name: "Square yard", f: 0.83612736 },
    { code: "sq m", name: "Square metre", f: 1 },
    { code: "acre", name: "Acre", f: 4046.8564224 },
    { code: "ha", name: "Hectare", f: 10000 },
    { code: "sq km", name: "Square kilometre", f: 1000000 }
  ], "sq ft", "sq m");

  unitTool("calc/speed-converter", [
    { code: "km/h", name: "Kilometres per hour", f: 0.2777777778 },
    { code: "mph", name: "Miles per hour", f: 0.44704 },
    { code: "m/s", name: "Metres per second", f: 1 },
    { code: "knot", name: "Knot", f: 0.5144444444 },
    { code: "ft/s", name: "Feet per second", f: 0.3048 }
  ], "km/h", "mph");

  unitTool("calc/data-size-converter", [
    { code: "bit", name: "Bit", f: 0.125 },
    { code: "B", name: "Byte", f: 1 },
    { code: "KB", name: "Kilobyte (1000)", f: 1e3 },
    { code: "MB", name: "Megabyte", f: 1e6 },
    { code: "GB", name: "Gigabyte", f: 1e9 },
    { code: "TB", name: "Terabyte", f: 1e12 },
    { code: "KiB", name: "Kibibyte (1024)", f: 1024 },
    { code: "MiB", name: "Mebibyte", f: 1048576 },
    { code: "GiB", name: "Gibibyte", f: 1073741824 },
    { code: "TiB", name: "Tebibyte", f: 1099511627776 }
  ], "MB", "MiB");

  /* ---------- Percentage calculator ---------- */
  C.register("calc/percentage-calculator", function (root) {
    var mode = h("select", { "aria-label": "Calculation" }, [
      h("option", { value: "of", text: "What is X% of Y" }),
      h("option", { value: "is", text: "X is what percent of Y" }),
      h("option", { value: "change", text: "Percent change from X to Y" })
    ]);
    var x = h("input", { class: "single-input", type: "number", step: "any", value: "18", "aria-label": "X", style: "max-width:140px" });
    var y = h("input", { class: "single-input", type: "number", step: "any", value: "1200", "aria-label": "Y", style: "max-width:140px" });
    var xl = h("span", { text: "X %" }), yl = h("span", { text: "of Y" });
    var result = h("div", { class: "outbox", style: "font-family:Inter,ui-sans-serif,sans-serif;font-size:20px;font-weight:600;max-height:none", text: "-" });

    root.appendChild(h("div", { class: "opts" }, [
      h("label", { class: "field" }, [mode]),
      h("label", { class: "field" }, [xl, x]),
      h("label", { class: "field" }, [yl, y])
    ]));
    root.appendChild(h("div", { class: "ta-label", style: "margin-top:13px" }, [h("span", { text: "Result" })]));
    root.appendChild(result);

    function run() {
      var a = parseFloat(x.value), b = parseFloat(y.value);
      if (mode.value === "of") { xl.textContent = "X %"; yl.textContent = "of Y"; }
      else if (mode.value === "is") { xl.textContent = "X"; yl.textContent = "of Y"; }
      else { xl.textContent = "from X"; yl.textContent = "to Y"; }
      if (!isFinite(a) || !isFinite(b)) { result.textContent = "-"; return; }
      if (mode.value === "of") result.textContent = a + "% of " + fmt(b) + " = " + fmt(a / 100 * b);
      else if (mode.value === "is") result.textContent = b === 0 ? "-" : fmt(a) + " is " + fmt(a / b * 100) + "% of " + fmt(b);
      else result.textContent = a === 0 ? "-" : fmt(a) + " → " + fmt(b) + " is a " + fmt((b - a) / a * 100) + "% " + (b >= a ? "increase" : "change");
    }
    [mode, x, y].forEach(function (el) { el.addEventListener("input", run); el.addEventListener("change", run); });
    C.onRun(run);
    C.onClear(function () { x.value = ""; y.value = ""; run(); });
    run();
  });

  /* ---------- Age calculator ---------- */
  C.register("calc/age-calculator", function (root) {
    var dob = h("input", { class: "single-input", type: "date", "aria-label": "Date of birth", style: "max-width:190px" });
    var asOf = h("input", { class: "single-input", type: "date", "aria-label": "As of date", style: "max-width:190px" });
    asOf.value = new Date().toISOString().slice(0, 10);
    function row(label) {
      var td = h("td");
      return { tr: h("tr", null, [h("th", { text: label }), td]), set: function (v) { td.textContent = v; } };
    }
    var rows = { age: row("Age"), months: row("In months"), days: row("Total days"), next: row("Next birthday") };
    root.appendChild(h("div", { class: "opts" }, [
      h("label", { class: "field" }, ["Date of birth ", dob]),
      h("label", { class: "field" }, ["As of ", asOf])
    ]));
    root.appendChild(h("table", { class: "kv" }, Object.keys(rows).map(function (k) { return rows[k].tr; })));

    function run() {
      if (!dob.value || !asOf.value) return;
      var b = new Date(dob.value + "T00:00:00"), n = new Date(asOf.value + "T00:00:00");
      if (n < b) { rows.age.set("The as-of date is before the date of birth."); return; }
      var y = n.getFullYear() - b.getFullYear();
      var m = n.getMonth() - b.getMonth();
      var d = n.getDate() - b.getDate();
      if (d < 0) { m--; d += new Date(n.getFullYear(), n.getMonth(), 0).getDate(); }
      if (m < 0) { y--; m += 12; }
      var totalDays = Math.floor((n - b) / 86400000);
      var nb = new Date(n.getFullYear(), b.getMonth(), b.getDate());
      if (nb <= n) nb = new Date(n.getFullYear() + 1, b.getMonth(), b.getDate());
      var toNext = Math.ceil((nb - n) / 86400000);
      rows.age.set(y + " years, " + m + " months, " + d + " days");
      rows.months.set((y * 12 + m).toLocaleString() + " months, " + d + " days");
      rows.days.set(totalDays.toLocaleString() + " days");
      rows.next.set(toNext === 365 || toNext === 366 ? "Today. Happy birthday!" : "in " + toNext + " days");
    }
    [dob, asOf].forEach(function (el) { el.addEventListener("change", run); el.addEventListener("input", run); });
    C.onRun(run);
    C.onClear(function () { dob.value = ""; });
  });

  /* ---------- EMI calculator ---------- */
  C.register("calc/emi-calculator", function (root) {
    var principal = h("input", { class: "single-input", type: "number", value: "1000000", min: "0", step: "any", "aria-label": "Loan amount", style: "max-width:170px" });
    var rate = h("input", { class: "single-input", type: "number", value: "9", min: "0", step: "0.05", "aria-label": "Annual interest rate", style: "max-width:110px" });
    var tenure = h("input", { class: "single-input", type: "number", value: "20", min: "1", step: "1", "aria-label": "Tenure", style: "max-width:100px" });
    var unit = h("select", { "aria-label": "Tenure unit" }, [
      h("option", { value: "years", text: "years" }),
      h("option", { value: "months", text: "months" })
    ]);
    function row(label) {
      var td = h("td");
      return { tr: h("tr", null, [h("th", { text: label }), td]), set: function (v) { td.textContent = v; } };
    }
    var rows = { emi: row("Monthly EMI"), interest: row("Total interest"), total: row("Total payment") };
    root.appendChild(h("div", { class: "opts" }, [
      h("label", { class: "field" }, ["Loan amount ", principal]),
      h("label", { class: "field" }, ["Rate ", rate, " % p.a."]),
      h("label", { class: "field" }, ["Tenure ", tenure, unit])
    ]));
    root.appendChild(h("table", { class: "kv" }, [rows.emi.tr, rows.interest.tr, rows.total.tr]));
    root.appendChild(h("p", { class: "kbd-hint", style: "margin:10px 0 0", text: "Standard reducing-balance EMI. Banks may add processing fees and insurance on top." }));

    function inr(v) { return "₹ " + Math.round(v).toLocaleString("en-IN"); }
    function run() {
      var P = parseFloat(principal.value), R = parseFloat(rate.value), N = parseFloat(tenure.value);
      if (!isFinite(P) || !isFinite(R) || !isFinite(N) || P <= 0 || N <= 0) return;
      var n = unit.value === "years" ? N * 12 : N;
      var r = R / 12 / 100;
      var emi = r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
      rows.emi.set(inr(emi));
      rows.interest.set(inr(emi * n - P));
      rows.total.set(inr(emi * n));
    }
    [principal, rate, tenure, unit].forEach(function (el) { el.addEventListener("input", run); el.addEventListener("change", run); });
    C.onRun(run);
    C.onClear(function () { principal.value = "1000000"; rate.value = "9"; tenure.value = "20"; run(); });
    run();
  });

  /* ---------- GST calculator ---------- */
  C.register("calc/gst-calculator", function (root) {
    var amount = h("input", { class: "single-input", type: "number", value: "1000", min: "0", step: "any", "aria-label": "Amount", style: "max-width:160px" });
    var mode = h("select", { "aria-label": "GST mode" }, [
      h("option", { value: "add", text: "Add GST (amount is pre-tax)" }),
      h("option", { value: "remove", text: "Remove GST (amount includes tax)" })
    ]);
    var rate = h("input", { class: "single-input", type: "number", value: "18", min: "0", max: "100", step: "any", "aria-label": "GST rate", style: "max-width:90px" });
    var slabs = h("span", { class: "mini-btns" }, [5, 12, 18, 28].map(function (r) {
      var b = h("button", { class: "mini", type: "button", text: r + "%" });
      b.addEventListener("click", function () { rate.value = String(r); run(); });
      return b;
    }));
    function row(label) {
      var td = h("td");
      return { tr: h("tr", null, [h("th", { text: label }), td]), set: function (v) { td.textContent = v; } };
    }
    var rows = { base: row("Base amount"), gst: row("GST"), cgst: row("CGST + SGST"), total: row("Total") };
    root.appendChild(h("div", { class: "opts" }, [
      h("label", { class: "field" }, ["Amount ₹ ", amount]),
      h("label", { class: "field" }, [mode]),
      h("label", { class: "field" }, ["Rate ", rate, " %"]),
      slabs
    ]));
    root.appendChild(h("table", { class: "kv" }, Object.keys(rows).map(function (k) { return rows[k].tr; })));

    function inr(v) { return "₹ " + (Math.round(v * 100) / 100).toLocaleString("en-IN"); }
    function run() {
      var a = parseFloat(amount.value), r = parseFloat(rate.value);
      if (!isFinite(a) || !isFinite(r) || a < 0 || r < 0) return;
      var base = mode.value === "add" ? a : a / (1 + r / 100);
      var gst = base * r / 100;
      rows.base.set(inr(base));
      rows.gst.set(inr(gst) + " (" + r + "%)");
      rows.cgst.set(inr(gst / 2) + " + " + inr(gst / 2));
      rows.total.set(inr(base + gst));
    }
    [amount, mode, rate].forEach(function (el) { el.addEventListener("input", run); el.addEventListener("change", run); });
    C.onRun(run);
    C.onClear(function () { amount.value = "1000"; rate.value = "18"; run(); });
    run();
  });

  /* ---------- BMI calculator ---------- */
  C.register("calc/bmi-calculator", function (root) {
    var system = h("select", { "aria-label": "Units" }, [
      h("option", { value: "metric", text: "Metric (kg, cm)" }),
      h("option", { value: "imperial", text: "Imperial (lb, ft+in)" })
    ]);
    var weight = h("input", { class: "single-input", type: "number", value: "70", min: "1", step: "any", "aria-label": "Weight", style: "max-width:110px" });
    var height = h("input", { class: "single-input", type: "number", value: "175", min: "1", step: "any", "aria-label": "Height", style: "max-width:110px" });
    var inches = h("input", { class: "single-input", type: "number", value: "9", min: "0", max: "11", step: "1", "aria-label": "Inches", style: "max-width:80px;display:none" });
    var wl = h("span", { text: "Weight (kg) " }), hl = h("span", { text: "Height (cm) " });
    var result = h("div", { class: "outbox", style: "font-family:Inter,ui-sans-serif,sans-serif;font-size:20px;font-weight:600;max-height:none", text: "-" });
    var note = h("p", { class: "kbd-hint", style: "margin:10px 0 0", text: "WHO adult ranges: under 18.5 underweight · 18.5-24.9 healthy · 25-29.9 overweight · 30+ obese." });

    root.appendChild(h("div", { class: "opts" }, [
      h("label", { class: "field" }, [system]),
      h("label", { class: "field" }, [wl, weight]),
      h("label", { class: "field" }, [hl, height, inches])
    ]));
    root.appendChild(h("div", { class: "ta-label", style: "margin-top:13px" }, [h("span", { text: "Your BMI" })]));
    root.appendChild(result);
    root.appendChild(note);

    function category(bmi) {
      return bmi < 18.5 ? "underweight" : bmi < 25 ? "in the healthy range" : bmi < 30 ? "overweight" : "in the obese range";
    }
    function run() {
      var w = parseFloat(weight.value), hgt = parseFloat(height.value);
      var metric = system.value === "metric";
      wl.textContent = metric ? "Weight (kg) " : "Weight (lb) ";
      hl.textContent = metric ? "Height (cm) " : "Height (ft) ";
      inches.style.display = metric ? "none" : "";
      if (!isFinite(w) || !isFinite(hgt) || w <= 0 || hgt <= 0) { result.textContent = "-"; return; }
      var kg = metric ? w : w * 0.45359237;
      var meters = metric ? hgt / 100 : (hgt * 12 + (parseFloat(inches.value) || 0)) * 0.0254;
      var bmi = kg / (meters * meters);
      result.textContent = "BMI " + (Math.round(bmi * 10) / 10) + ", " + category(bmi);
    }
    [system, weight, height, inches].forEach(function (el) { el.addEventListener("input", run); el.addEventListener("change", run); });
    C.onRun(run);
    C.onClear(function () { weight.value = ""; result.textContent = "-"; });
    run();
  });

  C.boot();
})();
