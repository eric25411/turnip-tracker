document.addEventListener("DOMContentLoaded", () => {
  const KEYS = {
    weeks: "turnipTracker_weeks_v1",
    current: "turnipTracker_current_v1",
    buy: "turnipTracker_buyPrice_v1"
  };

  // Views
  const entryView = document.getElementById("predictView");       // entry inputs
  const predictorView = document.getElementById("predictorView"); // predictor screen
  const historyView = document.getElementById("historyView");

  // Bottom nav
  const navEntry = document.getElementById("navEntry");
  const navPredict = document.getElementById("navPredict");
  const navHistory = document.getElementById("navHistory");

  // Buttons
  const saveWeekBtn = document.getElementById("saveWeekBtn");
  const goHomeBtn = document.getElementById("goHomeBtn");

  // Buy price (now on Entry)
  const buyPriceEl = document.getElementById("buyPrice");
  const buyPriceReadout = document.getElementById("buyPriceReadout");

  // Predictor UI
  const metricsEl = document.getElementById("metrics");
  const canvas = document.getElementById("chartCanvas");
  const ctx = canvas ? canvas.getContext("2d") : null;

  // History UI
  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");

  function setActiveTab(tab) {
    const isEntry = tab === "entry";
    const isPredictor = tab === "predict";
    const isHistory = tab === "history";

    entryView.classList.toggle("hidden", !isEntry);
    predictorView.classList.toggle("hidden", !isPredictor);
    historyView.classList.toggle("hidden", !isHistory);

    navEntry.classList.toggle("active", isEntry);
    navPredict.classList.toggle("active", isPredictor);
    navHistory.classList.toggle("active", isHistory);

    if (isHistory) renderHistory();
    if (isPredictor) renderPredictor();
  }

  function getWeeks() {
    try { return JSON.parse(localStorage.getItem(KEYS.weeks) || "[]"); }
    catch { return []; }
  }

  function setWeeks(weeks) {
    localStorage.setItem(KEYS.weeks, JSON.stringify(weeks));
  }

  function getWeekIds() {
    return [
      "mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm",
      "thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"
    ];
  }

  function getCurrentWeekData() {
    const ids = getWeekIds();
    const data = {};
    ids.forEach((id) => {
      const el = document.getElementById(id);
      data[id] = ((el && el.value) || "").trim();
    });
    return data;
  }

  function loadWeekData(data) {
    Object.keys(data || {}).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = data[id] ?? "";
    });
  }

  function clearWeek() {
    document.querySelectorAll(".priceInput").forEach((i) => {
      if (i && i.id !== "buyPrice") i.value = "";
    });
    localStorage.removeItem(KEYS.current);
  }

  function saveCurrentDraft() {
    localStorage.setItem(KEYS.current, JSON.stringify(getCurrentWeekData()));
  }

  function loadCurrentDraft() {
    try {
      const raw = localStorage.getItem(KEYS.current);
      if (!raw) return;
      loadWeekData(JSON.parse(raw));
    } catch {}
  }

  function getBuyPrice() {
    return (localStorage.getItem(KEYS.buy) || "").trim();
  }

  function setBuyPrice(val) {
    localStorage.setItem(KEYS.buy, (val || "").trim());
  }

  function formatWeekLabel(iso) {
    try {
      const d = new Date(iso);
      return `Saved ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return "Saved week";
    }
  }

  function cryptoRandomId() {
    const rnd = Math.random().toString(16).slice(2);
    return `w_${Date.now()}_${rnd}`;
  }

  function summarizeWeek(data) {
    const get = (k) => (data && data[k] ? data[k] : "-");
    return [
      `Mon AM ${get("mon-am")}, Mon PM ${get("mon-pm")}`,
      `Tue AM ${get("tue-am")}, Tue PM ${get("tue-pm")}`,
      `Wed AM ${get("wed-am")}, Wed PM ${get("wed-pm")}`,
      `Thu AM ${get("thu-am")}, Thu PM ${get("thu-pm")}`,
      `Fri AM ${get("fri-am")}, Fri PM ${get("fri-pm")}`,
      `Sat AM ${get("sat-am")}, Sat PM ${get("sat-pm")}`
    ].join(" | ");
  }

  // Auto save draft on input
  document.querySelectorAll(".priceInput").forEach((inp) => {
    if (inp && inp.id !== "buyPrice") {
      inp.addEventListener("input", saveCurrentDraft);
    }
  });

  // Buy price autosave (entry chip)
  if (buyPriceEl) {
    buyPriceEl.value = getBuyPrice();
    buyPriceEl.addEventListener("input", () => {
      setBuyPrice(buyPriceEl.value);
      if (!predictorView.classList.contains("hidden")) renderPredictor();
    });
  }

  // Save week
  if (saveWeekBtn) {
    saveWeekBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const week = {
        id: cryptoRandomId(),
        savedAt: new Date().toISOString(),
        buyPrice: getBuyPrice(),
        data: getCurrentWeekData()
      };

      const weeks = getWeeks();
      weeks.unshift(week);
      setWeeks(weeks);

      clearWeek();
      setActiveTab("history");
    });
  }

  // History
  function renderHistory() {
    const weeks = getWeeks();
    historyList.innerHTML = "";
    historyEmptyNote.style.display = weeks.length ? "none" : "block";

    weeks.forEach((w) => {
      const row = document.createElement("div");
      row.className = "weekRow";

      const top = document.createElement("div");
      top.className = "weekRowTop";

      const label = document.createElement("div");
      label.className = "weekLabel";
      label.textContent = formatWeekLabel(w.savedAt);

      const btnWrap = document.createElement("div");
      btnWrap.className = "weekBtns";

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "smallBtn";
      toggleBtn.type = "button";
      toggleBtn.textContent = "Expand";
      toggleBtn.addEventListener("click", () => {
        const expanded = row.classList.toggle("expanded");
        toggleBtn.textContent = expanded ? "Collapse" : "Expand";
      });

      const loadBtn = document.createElement("button");
      loadBtn.className = "smallBtn";
      loadBtn.type = "button";
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", () => {
        loadWeekData(w.data);
        saveCurrentDraft();

        if (w.buyPrice != null && buyPriceEl) {
          buyPriceEl.value = w.buyPrice;
          setBuyPrice(w.buyPrice);
        }

        setActiveTab("entry");
      });

      const delBtn = document.createElement("button");
      delBtn.className = "smallBtn";
      delBtn.type = "button";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => {
        const next = getWeeks().filter((x) => x.id !== w.id);
        setWeeks(next);
        renderHistory();
      });

      btnWrap.appendChild(toggleBtn);
      btnWrap.appendChild(loadBtn);
      btnWrap.appendChild(delBtn);

      top.appendChild(label);
      top.appendChild(btnWrap);

      const details = document.createElement("div");
      details.className = "weekDetails";
      const buyLine = (w.buyPrice ? `Buy ${w.buyPrice} | ` : "");
      details.textContent = buyLine + summarizeWeek(w.data);

      row.appendChild(top);
      row.appendChild(details);
      historyList.appendChild(row);
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const payload = {
        exportedAt: new Date().toISOString(),
        weeks: getWeeks()
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "turnip-tracker-history.json";
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    });
  }

  if (importFile) {
    importFile.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const weeks = Array.isArray(parsed.weeks) ? parsed.weeks : [];

        const existing = getWeeks();
        const map = new Map(existing.map((w) => [w.id, w]));

        weeks.forEach((w) => {
          if (w && w.id && w.data) map.set(w.id, w);
        });

        setWeeks(Array.from(map.values()).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || "")));
        renderHistory();
      } catch {
        alert("Import failed. Make sure it is a valid exported JSON file.");
      } finally {
        e.target.value = "";
      }
    });
  }

  if (goHomeBtn) {
    goHomeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      setActiveTab("entry");
    });
  }

  // Predictor logic
  function parsePricesFromCurrent() {
    const ids = getWeekIds();
    const data = getCurrentWeekData();
    return ids.map((id) => {
      const n = Number(String(data[id] || "").replace(/[^\d.]/g, ""));
      return Number.isFinite(n) ? n : null;
    });
  }

  function bestSoFar(prices) {
    let best = null;
    let bestIdx = -1;
    prices.forEach((p, i) => {
      if (p == null) return;
      if (best == null || p > best) { best = p; bestIdx = i; }
    });
    return { best, bestIdx };
  }

  function idxToLabel(i) {
    const labels = [
      "Mon AM","Mon PM","Tue AM","Tue PM","Wed AM","Wed PM",
      "Thu AM","Thu PM","Fri AM","Fri PM","Sat AM","Sat PM"
    ];
    return labels[i] || "-";
  }

  function detectPattern(prices) {
    const nums = prices.filter((p) => p != null);
    if (nums.length < 4) return { name: "-", note: "Save more weeks so pattern detection can learn your style." };

    const first = nums[0], last = nums[nums.length - 1];
    if (last > first) return { name: "Uptrend", note: "Prices seem to be rising overall. Watch for a late-week peak." };
    if (last < first) return { name: "Downtrend", note: "Prices seem to be falling overall. If you see profit, consider selling sooner." };
    return { name: "Flat", note: "Not much movement yet. Keep entering prices to improve confidence." };
  }

  function forecast(prices, buy) {
    const best = bestSoFar(prices);
    const conf = Math.min(90, 40 + prices.filter(x => x != null).length * 4);

    let window = "Mon AM to Tue PM";
    let watch = "If Wed keeps dropping, sell the first time you see profit over buy.";

    if (buy && best.best != null && best.best > buy) {
      window = "Now to next higher reading";
      watch = "You are already above buy at least once. If it drops twice in a row, sell the next spike.";
    } else if (prices.filter(x=>x!=null).length >= 6) {
      window = "Wed AM to Thu PM";
      watch = "Mid-week is usually where peaks show up, keep watching especially Wed and Thu.";
    }

    const baseline = buy || (best.best || 100);
    const min = Math.max(10, Math.round(baseline * 1.20));
    const max = Math.max(min + 10, Math.round(baseline * 1.80));

    return { window, conf, watch, range: `${min} to ${max}` };
  }

  function drawChart(prices) {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pts = prices.map((p) => (p == null ? null : p));
    const nums = pts.filter((p) => p != null);

    if (!nums.length) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.font = "16px system-ui";
      ctx.fillText("Enter prices to see chart", 18, 34);
      return;
    }

    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const pad = 30;

    const x0 = pad;
    const y0 = pad;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;

    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(0,0,0,.6)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = y0 + (h * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + w, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "rgba(0,0,0,.65)";
    ctx.font = "14px system-ui";
    ctx.fillText(String(max), x0, y0 - 8);
    ctx.fillText(String(min), x0, y0 + h + 18);

    const span = Math.max(1, max - min);
    const xStep = w / (pts.length - 1);

    function yFor(v) {
      const t = (v - min) / span;
      return y0 + h - t * h;
    }

    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = "rgba(0,0,0,.70)";
    ctx.lineWidth = 3;
    ctx.beginPath();

    let started = false;
    pts.forEach((v, i) => {
      if (v == null) return;
      const x = x0 + xStep * i;
      const y = yFor(v);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,.75)";
    pts.forEach((v, i) => {
      if (v == null) return;
      const x = x0 + xStep * i;
      const y = yFor(v);
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function renderPredictor() {
    const prices = parsePricesFromCurrent();
    drawChart(prices);

    const buyRaw = getBuyPrice();
    const buy = Number(String(buyRaw || "").replace(/[^\d.]/g, ""));
    const buyNum = Number.isFinite(buy) ? buy : null;

    if (buyPriceReadout) buyPriceReadout.textContent = buyNum != null ? String(buyNum) : "-";

    const best = bestSoFar(prices);
    const bestLabel = best.bestIdx >= 0 ? idxToLabel(best.bestIdx) : "-";
    const profit = (buyNum != null && best.best != null) ? (best.best - buyNum) : null;

    const pat = detectPattern(prices);
    const fc = forecast(prices, buyNum);

    const lines = [];
    lines.push(metricLine("Buy price:", buyNum != null ? String(buyNum) : "-"));
    lines.push(metricLine("Best so far this week:", best.best != null ? String(best.best) : "-"));
    lines.push(metricLine("Best day time:", best.best != null ? bestLabel : "-"));
    lines.push(metricLine("Profit vs buy:", profit != null ? (profit >= 0 ? `+${profit}` : `${profit}`) : "-"));
    lines.push(metricLine("Likely pattern:", pat.name));
    lines.push(metricLine("Pattern note:", pat.note, true));
    lines.push(metricLine("Forecast peak window:", fc.window));
    lines.push(metricLine("Forecast confidence:", `${fc.conf}%`));
    lines.push(metricLine("What to watch next:", fc.watch, true));
    lines.push(metricLine("Expected max range:", fc.range));

    metricsEl.innerHTML = "";
    lines.forEach(el => metricsEl.appendChild(el));
  }

  function metricLine(k, v, small=false) {
    const div = document.createElement("div");
    div.className = "metric" + (small ? " small" : "");
    div.innerHTML = `<span class="k">${escapeHtml(k)}</span> <span class="v">${escapeHtml(v)}</span>`;
    return div;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  // Nav handlers
  navEntry.addEventListener("click", (e) => { e.preventDefault(); setActiveTab("entry"); });
  navPredict.addEventListener("click", (e) => { e.preventDefault(); setActiveTab("predict"); });
  navHistory.addEventListener("click", (e) => { e.preventDefault(); setActiveTab("history"); });

  // Boot
  loadCurrentDraft();
  setActiveTab("entry");
});
