document.addEventListener("DOMContentLoaded", () => {
  const KEYS = {
    weeks: "turnipTracker_weeks_v1",
    current: "turnipTracker_current_v1"
  };

  // Views
  const entryView = document.getElementById("entryView");
  const insightsView = document.getElementById("insightsView");
  const settingsView = document.getElementById("settingsView");

  // Nav
  const navEntry = document.getElementById("navEntry");
  const navInsights = document.getElementById("navInsights");
  const navSettings = document.getElementById("navSettings");

  // Entry
  const saveWeekBtn = document.getElementById("saveWeekBtn");
  const buyPriceInput = document.getElementById("buy-price");
  const sundayLabel = document.getElementById("sundayLabel");

  // Insights chart + stats
  const chartCanvas = document.getElementById("chartCanvas");
  const statBuy = document.getElementById("statBuy");
  const statBest = document.getElementById("statBest");
  const statBestTime = document.getElementById("statBestTime");
  const statProfit = document.getElementById("statProfit");
  const statPattern = document.getElementById("statPattern");

  // History UI
  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");

  // Settings
  const clearAllBtn = document.getElementById("clearAllBtn");

  if (!entryView || !insightsView || !settingsView) {
    console.log("Missing a view container in HTML.");
    return;
  }

  // ---------- Helpers ----------
  const IDS = [
    "buy-price",
    "mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm",
    "thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"
  ];

  const SLOT_LABELS = [
    "Mon AM","Mon PM","Tue AM","Tue PM","Wed AM","Wed PM",
    "Thu AM","Thu PM","Fri AM","Fri PM","Sat AM","Sat PM"
  ];

  function setActiveTab(tab) {
    const isEntry = tab === "entry";
    const isInsights = tab === "insights";

    entryView.classList.toggle("hidden", !isEntry);
    insightsView.classList.toggle("hidden", !isInsights);
    settingsView.classList.toggle("hidden", tab !== "settings");

    navEntry.classList.toggle("active", isEntry);
    navInsights.classList.toggle("active", isInsights);
    navSettings.classList.toggle("active", tab === "settings");

    if (isInsights) {
      renderInsights();
      renderHistory();
    }
  }

  function getWeeks() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.weeks) || "[]");
    } catch {
      return [];
    }
  }

  function setWeeks(weeks) {
    localStorage.setItem(KEYS.weeks, JSON.stringify(weeks));
  }

  function getCurrentData() {
    const data = {};
    IDS.forEach((id) => {
      const el = document.getElementById(id);
      data[id] = ((el && el.value) || "").trim();
    });
    return data;
  }

  function loadData(data) {
    Object.keys(data || {}).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = data[id] ?? "";
    });
  }

  function clearEntry() {
    document.querySelectorAll(".priceInput").forEach((i) => (i.value = ""));
    localStorage.removeItem(KEYS.current);
  }

  function saveDraft() {
    localStorage.setItem(KEYS.current, JSON.stringify(getCurrentData()));
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(KEYS.current);
      if (!raw) return;
      loadData(JSON.parse(raw));
    } catch {}
  }

  function parseNum(x) {
    const n = Number(String(x || "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function lastSundayLocal() {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = d.getDay(); // 0 = Sun
    const diff = day; // days since Sunday
    d.setDate(d.getDate() - diff);
    return d;
  }

  function formatMonthDay(d) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function updateSundayLabel() {
    if (!sundayLabel) return;
    sundayLabel.textContent = formatMonthDay(lastSundayLocal());
  }

  // ---------- Nav events ----------
  navEntry.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveTab("entry");
  });

  navInsights.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveTab("insights");
  });

  navSettings.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveTab("settings");
  });

  // Auto-save draft
  document.querySelectorAll(".priceInput").forEach((inp) => {
    inp.addEventListener("input", () => {
      // keep draft clean (no weird spaces)
      inp.value = inp.value.replace(/[^\d]/g, "");
      saveDraft();
    });
  });

  // Save week
  saveWeekBtn.addEventListener("click", (e) => {
    e.preventDefault();

    const week = {
      id: cryptoRandomId(),
      savedAt: new Date().toISOString(),
      data: getCurrentData()
    };

    const weeks = getWeeks();
    weeks.unshift(week);
    setWeeks(weeks);

    clearEntry();
    setActiveTab("insights");
  });

  // Export / Import
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

        setWeeks(
          Array.from(map.values()).sort((a, b) =>
            (b.savedAt || "").localeCompare(a.savedAt || "")
          )
        );

        renderHistory();
        renderInsights();
      } catch {
        alert("Import failed. Make sure it is a valid exported JSON file.");
      } finally {
        e.target.value = "";
      }
    });
  }

  // Settings: Clear all
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => {
      const ok = confirm("Clear all Turnip Tracker data? This cannot be undone.");
      if (!ok) return;
      localStorage.removeItem(KEYS.weeks);
      localStorage.removeItem(KEYS.current);
      clearEntry();
      renderHistory();
      renderInsights();
      alert("All data cleared.");
    });
  }

  // ---------- History ----------
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
      toggleBtn.textContent = "Expand";
      toggleBtn.addEventListener("click", () => {
        const expanded = row.classList.toggle("expanded");
        toggleBtn.textContent = expanded ? "Collapse" : "Expand";
      });

      const loadBtn = document.createElement("button");
      loadBtn.className = "smallBtn";
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", () => {
        loadData(w.data);
        saveDraft();
        setActiveTab("entry");
        window.scrollTo({ top: 0, behavior: "smooth" });
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

  function summarizeWeek(data) {
    const get = (k) => (data && data[k] ? data[k] : "-");
    return [
      `Buy ${get("buy-price")}`,
      `Mon AM ${get("mon-am")} , Mon PM ${get("mon-pm")}`,
      `Tue AM ${get("tue-am")} , Tue PM ${get("tue-pm")}`,
      `Wed AM ${get("wed-am")} , Wed PM ${get("wed-pm")}`,
      `Thu AM ${get("thu-am")} , Thu PM ${get("thu-pm")}`,
      `Fri AM ${get("fri-am")} , Fri PM ${get("fri-pm")}`,
      `Sat AM ${get("sat-am")} , Sat PM ${get("sat-pm")}`
    ].join(" | ");
  }

  function formatWeekLabel(iso) {
    try {
      const d = new Date(iso);
      return `Saved ${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })}`;
    } catch {
      return "Saved week";
    }
  }

  // ---------- Insights ----------
  function renderInsights() {
    const data = getCurrentData();

    const buy = parseNum(data["buy-price"]);
    const series = [
      parseNum(data["mon-am"]), parseNum(data["mon-pm"]),
      parseNum(data["tue-am"]), parseNum(data["tue-pm"]),
      parseNum(data["wed-am"]), parseNum(data["wed-pm"]),
      parseNum(data["thu-am"]), parseNum(data["thu-pm"]),
      parseNum(data["fri-am"]), parseNum(data["fri-pm"]),
      parseNum(data["sat-am"]), parseNum(data["sat-pm"])
    ];

    // Best
    let best = null;
    let bestIdx = -1;
    series.forEach((v, i) => {
      if (v == null) return;
      if (best == null || v > best) {
        best = v;
        bestIdx = i;
      }
    });

    // Profit
    let profit = null;
    if (buy != null && best != null) profit = best - buy;

    // Super light “pattern”
    const pattern = guessPattern(series);

    statBuy.textContent = buy == null ? "-" : String(buy);
    statBest.textContent = best == null ? "-" : String(best);
    statBestTime.textContent = bestIdx === -1 ? "-" : SLOT_LABELS[bestIdx];
    statProfit.textContent = profit == null ? "-" : (profit >= 0 ? `+${profit}` : String(profit));
    statPattern.textContent = pattern;

    drawChart(series);
  }

  function guessPattern(series) {
    const vals = series.filter((v) => v != null);
    if (vals.length < 3) return "-";

    // naive: mostly falling?
    let down = 0;
    let up = 0;
    for (let i = 1; i < series.length; i++) {
      if (series[i-1] == null || series[i] == null) continue;
      if (series[i] > series[i-1]) up++;
      if (series[i] < series[i-1]) down++;
    }
    if (down > up + 2) return "Falling";
    if (up > down + 2) return "Rising";
    return "Mixed";
  }

  function drawChart(series) {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext("2d");
    const W = chartCanvas.width;
    const H = chartCanvas.height;

    ctx.clearRect(0, 0, W, H);

    // padding inside canvas
    const padL = 60;
    const padR = 30;
    const padT = 24;
    const padB = 55;

    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // pick min/max for scale
    const vals = series.filter((v) => v != null);
    const minV = vals.length ? Math.min(...vals) : 0;
    const maxV = vals.length ? Math.max(...vals) : 100;

    const range = Math.max(10, maxV - minV);
    const yMin = minV - Math.ceil(range * 0.15);
    const yMax = maxV + Math.ceil(range * 0.15);

    function xAt(i) {
      return padL + (plotW * (i / (series.length - 1)));
    }
    function yAt(v) {
      const t = (v - yMin) / (yMax - yMin);
      return padT + (plotH * (1 - t));
    }

    // soft grid lines
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000";
    for (let g = 0; g < 4; g++) {
      const y = padT + (plotH * (g / 3));
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // axis labels (days only)
    const dayLabels = ["Mon","Tue","Wed","Thu","Fri","Sat"];
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "900 22px system-ui";
    dayLabels.forEach((d, dayIdx) => {
      const i = dayIdx * 2; // Mon AM, Tue AM...
      const x = xAt(i);
      ctx.textAlign = "center";
      ctx.fillText(d, x, H - 18);
    });

    // line
    let started = false;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    series.forEach((v, i) => {
      if (v == null) return;
      const x = xAt(i);
      const y = yAt(v);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    if (started) ctx.stroke();

    // dots: AM = sun, PM = moon (cozy key)
    series.forEach((v, i) => {
      const x = xAt(i);
      const isPM = (i % 2 === 1);

      // draw dot even if missing value, keep the “postcard” feel
      const y = v == null ? (padT + plotH * 0.78) : yAt(v);

      ctx.beginPath();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();

      // emoji overlay (simple + cute)
      ctx.font = "22px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#000";
      ctx.fillText(isPM ? "🌙" : "🌞", x, y - 22);
    });
  }

  function cryptoRandomId() {
    const rnd = Math.random().toString(16).slice(2);
    return `w_${Date.now()}_${rnd}`;
  }

  // ---------- Boot ----------
  updateSundayLabel();
  loadDraft();
  setActiveTab("entry");
});
