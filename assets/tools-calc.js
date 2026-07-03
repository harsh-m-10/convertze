/* Convertze calculators: currency-converter.
   Rates come from the open.er-api.com public endpoint, cached locally for a day.
   Only a generic rates table is downloaded; amounts never leave the device. */
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

  C.boot();
})();
