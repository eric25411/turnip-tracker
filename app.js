document.addEventListener("DOMContentLoaded", () => {
  const KEYS = {
    weeks: "turnipTracker_weeks_v1",
    current: "turnipTracker_current_v2" // bumped because buyPrice is now part of draft
  };

  // Views
  const entryView = document.getElementById("entryView");
  const predictView = document.getElementById("predictView");
  const historyView = document.getElementById("historyView");

  // Bottom nav
  const navEntry = document.getElementById("navEntry");
  const navPredict = document.getElementById("navPredict");
  const navHistory = document.getElementById("navHistory");

  // Buttons
  const saveWeekBtn = document.getElementById("saveWeekBtn");
  const goHomeBtn = document.getElementById("goHomeBtn");

  // Entry inputs
  const buyPriceEl = document.getElementById("buyPrice");

  // Predict UI
  const chartCanvas = document.getElementById("priceChart");
  const predictStats = document.getElementById("predictStats");

  // History UI
  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");

  // Safety checks
  if (!entryView || !predictView || !historyView) return;
  if (!navEntry || !navPredict || !navHistory) return;
  if (!saveWeekBtn) return;

  const IDS = [
    "mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm",
    "thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"
  ];

  const LABELS = [
    "Mon AM","Mon PM","Tue AM","Tue PM","Wed AM","Wed PM",
    "Thu AM","Thu PM","Fri AM","Fri PM","Sat AM","Sat PM"
  ];

  function setActiveTab(tab) {
    const isEntry = tab === "entry";
    const isPredict = tab === "predict";
    const isHistory = tab === "history";

    entryView.classList.toggle("hidden", !isEntry);
    predictView.classList.toggle("hidden", !isPredict);
    historyView.classList.toggle("hidden", !isHistory);

    navEntry.classList.toggle("active", isEntry);
    navPredict.classList.toggle("active", isPredict);
    navHistory.classList.toggle("active", isHistory);

    // ✅ Option 1: Predict always refreshes immediately when tapped
    if (isPredict) renderPredict();
    if (isHistory) renderHistory();
  }

  // Nav click handlers
  navEntry.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveTab("entry");
  });

  navPredict.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveTab("predict");
  });

  navHistory.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveTab("history");
  });

  if (goHomeBtn) {
    goHomeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      setActiveTab("entry");
    });
  }

  function getWeeks() {
    try { return JSON.parse(localStorage.getItem(KEYS.weeks) || "[]"); }
    catch { return []; }
  }

  function setWeeks(weeks) {
    localStorage.setItem(KEYS.weeks, JSON.stringify(weeks));
  }

  function getCurrentWeekData() {
    const data = {};
    data.buyPrice = ((buyPriceEl && buyPriceEl.value) || "").trim();

    IDS.forEach((id) => {
      const el = document.getElementById(id);
      data[id] = ((el && el.value) || "").trim();
    });

    return data;
  }

  function loadWeekData(data) {
    if (!data) return;

    if (buyPriceEl) buyPriceEl.value = data.buyPrice ?? "";

    IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = data[id] ?? "";
    });
  }

  function clearWeek() {
    if (buyPriceEl) buyPriceEl.value = "";
    document.querySelectorAll(".priceInput").forEach((i) => (i.value = ""));
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

  // Auto save draft on input
  document.querySelectorAll(".priceInput").forEach((inp) => {
    inp.addEventListener("input", () => {
      saveCurrentDraft();
      // if user is currently on Predict, keep it live-updating
      if (!predictView.classList.contains("hidden")) renderPredict();
    });
  });

  if (buyPriceEl) {
    buyPriceEl.addEventListener("input", () => {
      saveCurrentDraft();
      if (!predictView.classList.contains("hidden")) renderPredict();
    });
  }

  saveWeekBtn.addEventListener("click", (e) => {
    e.preventDefault();

    const week = {
      id: cryptoRandomId(),
      savedAt: new Date().toISOString(),
      data: getCurrentWeekData()
    };

    const weeks = getWeeks();
    weeks.unshift(week);
    setWeeks(weeks);

    clearWeek();
    setActiveTab("history");
  });

  function parseNum(v) {
    const n = Number(String(v || "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function getSeriesFromDraft() {
    const draft = getCurrentWeekData();
    const series = IDS.map((id) => parseNum(draft[id]));
    const buy = parseNum(draft.buyPrice);
    return { series, buy };
  }

  function detectPattern(series, buy) {
    const vals = series.filter((x) => typeof x === "number");
    if (vals.length < 3) return { name: "-", note: "Add more prices to detect a pattern." };

    // Very simple starter classifier
    const diffs = [];
    for (let i = 1; i < series.length; i++) {
      if (series[i] != null && series[i - 1] != null) diffs.push(series[i] - series[i - 1]);
    }

    const ups = diffs.filter(d => d > 0).length;
    const downs = diffs.filter(d => d < 0).length;

    const max = Math.max(...vals);
    const min = Math.min(...vals);

    if (ups === 0 && downs > 0) {
      return { name: "Decreasing", note: "If it keeps dropping, sell the first time you see profit over buy." };
    }

    if (downs === 0 && ups > 0) {
      return { name: "Increasing", note: "Watch for the first big peak, then sell. Do not get greedy." };
    }

    if (buy != null && max >= buy + 60) {
      return { name: "Spike", note: "You likely have a spike week. If you see a big jump, sell asap." };
    }

    if (max - min <= 20) {
      return { name: "Flat", note: "Prices look stable. Hold until you see profit, then sell." };
    }

    return { name: "Random", note: "Mixed movement so far. Save more weeks so it can learn your style." };
  }

  function bestSoFar(series) {
    let best = null;
    let bestIdx = -1;
    series.forEach((v, i) => {
      if (v == null) return;
      if (best == null || v > best) {
        best = v;
        bestIdx = i;
      }
    });
    return { best, bestIdx };
  }

  function drawChart(series) {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext("2d");
    const w = chartCanvas.width;
    const h = chartCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000";
    for (let i = 1; i <= 4; i++) {
      const y = (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const vals = series.filter(v => v != null);
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 100;

    const pad = 18;
    const x0 = pad;
    const y0 = pad;
    const x1 = w - pad;
    const y1 = h - pad;

    const span = Math.max(1, max - min);
    const nx = series.length - 1;

    function xFor(i){ return x0 + (i / nx) * (x1 - x0); }
    function yFor(v){
      const t = (v - min) / span;
      return y1 - t * (y1 - y0);
    }

    // line
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#111";

    let started = false;
    ctx.beginPath();
    series.forEach((v, i) => {
      if (v == null) return;
      const x = xFor(i);
      const y = yFor(v);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    });
    if (started) ctx.stroke();

    // points
    ctx.fillStyle = "#111";
    series.forEach((v, i) => {
      const x = xFor(i);
      const y = (v == null) ? (h * 0.70) : yFor(v);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function renderPredict() {
    const { series, buy } = getSeriesFromDraft();

    drawChart(series);

    const { best, bestIdx } = bestSoFar(series);
    const bestLabel = bestIdx >= 0 ? LABELS[bestIdx] : "-";

    const profit = (buy != null && best != null) ? (best - buy) : null;
    const profitText = profit == null ? "-" : (profit >= 0 ? `+${profit}` : `${profit}`);

    const pattern = detectPattern(series, buy);

    // Light “peak window” guess: earliest time you hit the best so far (or early week if unknown)
    const peakWindow = bestIdx >= 0
      ? `${LABELS[Math.max(0, bestIdx - 1)]} to ${LABELS[Math.min(LABELS.length - 1, bestIdx + 1)]}`
      : "Mon AM to Tue PM";

    const confidence = Math.min(95, 45 + (series.filter(v => v != null).length * 4));

    if (predictStats) {
      predictStats.innerHTML = `
        <div>Buy price: <span class="muted">${buy == null ? "-" : buy}</span></div>
        <div>Best so far this week: <span class="muted">${best == null ? "-" : best}</span></div>
        <div>Best day time: <span class="muted">${bestLabel}</span></div>
        <div>Profit vs buy: <span class="muted">${profitText}</span></div>
        <div>Likely pattern: <span class="muted">${pattern.name}</span></div>
        <div class="muted">Pattern note: ${pattern.note}</div>
        <div>Forecast peak window: <span class="muted">${peakWindow}</span></div>
        <div>Forecast confidence: <span class="muted">${confidence}%</span></div>
      `;
    }
  }

  function renderHistory() {
    if (!historyList || !historyEmptyNote) return;

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
      toggleBtn.textContent = "Expand";
      toggleBtn.addEventListener("click", () => {
        const expanded = row.classList.toggle("expanded");
        toggleBtn.textContent = expanded ? "Collapse" : "Expand";
      });

      const loadBtn = document.createElement("button");
      loadBtn.className = "smallBtn";
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", () => {
        loadWeekData(w.data);
        saveCurrentDraft();
        setActiveTab("entry");
      });

      const delBtn = document.createElement("button");
      delBtn.className = "smallBtn";
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
      details.textContent = summarizeWeek(w.data);

      row.appendChild(top);
      row.appendChild(details);
      historyList.appendChild(row);
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const payload = { exportedAt: new Date().toISOString(), weeks: getWeeks() };

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

        setWeeks(
          Array.from(map.values()).sort((a, b) =>
            (b.savedAt || "").localeCompare(a.savedAt || "")
          )
        );

        renderHistory();
      } catch {
        alert("Import failed. Make sure it is a valid exported JSON file.");
      } finally {
        e.target.value = "";
      }
    });
  }

  function summarizeWeek(data) {
    const get = (k) => (data && data[k] ? data[k] : "-");
    const buy = (data && data.buyPrice) ? data.buyPrice : "-";
    return [
      `Buy ${buy}`,
      `Mon AM ${get("mon-am")}, Mon PM ${get("mon-pm")}`,
      `Tue AM ${get("tue-am")}, Tue PM ${get("tue-pm")}`,
      `Wed AM ${get("wed-am")}, Wed PM ${get("wed-pm")}`,
      `Thu AM ${get("thu-am")}, Thu PM ${get("thu-pm")}`,
      `Fri AM ${get("fri-am")}, Fri PM ${get("fri-pm")}`,
      `Sat AM ${get("sat-am")}, Sat PM ${get("sat-pm")}`
    ].join(" | ");
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

  // Boot
  loadCurrentDraft();
  setActiveTab("entry");
});
