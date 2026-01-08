document.addEventListener("DOMContentLoaded", () => {
  const KEYS = {
    weeks: "turnipTracker_weeks_v1",
    current: "turnipTracker_current_v1"
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
  const goEntryBtn = document.getElementById("goEntryBtn");
  const runPredictBtn = document.getElementById("runPredictBtn");

  // Predictor UI
  const buyPriceEl = document.getElementById("buyPrice");
  const bestSoFarEl = document.getElementById("bestSoFar");
  const bestWhenEl = document.getElementById("bestWhen");
  const profitVsBuyEl = document.getElementById("profitVsBuy");

  const weeksCountEl = document.getElementById("weeksCount");
  const predictSummaryEl = document.getElementById("predictSummary");

  const bestDayAvgEl = document.getElementById("bestDayAvg");
  const recommendationEl = document.getElementById("recommendation");
  const topPeaksEl = document.getElementById("topPeaks");

  const likelyPatternEl = document.getElementById("likelyPattern");
  const patternNoteEl = document.getElementById("patternNote");

  // History UI
  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");

  // Safety checks
  if (!entryView || !predictView || !historyView) return;
  if (!navEntry || !navPredict || !navHistory) return;
  if (!saveWeekBtn) return;

  function setActiveTab(tab) {
    const isEntry = tab === "entry";
    const isPredict = tab === "predict";
    const isHistory = tab === "history";

    entryView.style.display = isEntry ? "block" : "none";
    predictView.style.display = isPredict ? "block" : "none";
    historyView.style.display = isHistory ? "block" : "none";

    entryView.classList.toggle("hidden", !isEntry);
    predictView.classList.toggle("hidden", !isPredict);
    historyView.classList.toggle("hidden", !isHistory);

    navEntry.classList.toggle("active", isEntry);
    navPredict.classList.toggle("active", isPredict);
    navHistory.classList.toggle("active", isHistory);

    if (isHistory) renderHistory();
    if (isPredict) updatePredictSummary();
  }

  // Nav handlers
  navEntry.addEventListener("click", (e) => { e.preventDefault(); setActiveTab("entry"); });
  navPredict.addEventListener("click", (e) => { e.preventDefault(); setActiveTab("predict"); });
  navHistory.addEventListener("click", (e) => { e.preventDefault(); setActiveTab("history"); });

  if (goHomeBtn) goHomeBtn.addEventListener("click", (e) => { e.preventDefault(); setActiveTab("entry"); });
  if (goEntryBtn) goEntryBtn.addEventListener("click", (e) => { e.preventDefault(); setActiveTab("entry"); });

  // Storage helpers
  function getWeeks() {
    try { return JSON.parse(localStorage.getItem(KEYS.weeks) || "[]"); }
    catch { return []; }
  }

  function setWeeks(weeks) {
    localStorage.setItem(KEYS.weeks, JSON.stringify(weeks));
  }

  const SLOT_LIST = [
    ["Sun Buy","sun-buy"],
    ["Mon AM","mon-am"], ["Mon PM","mon-pm"],
    ["Tue AM","tue-am"], ["Tue PM","tue-pm"],
    ["Wed AM","wed-am"], ["Wed PM","wed-pm"],
    ["Thu AM","thu-am"], ["Thu PM","thu-pm"],
    ["Fri AM","fri-am"], ["Fri PM","fri-pm"],
    ["Sat AM","sat-am"], ["Sat PM","sat-pm"]
  ];

  const SELL_SLOTS = [
    ["Mon AM","mon-am"], ["Mon PM","mon-pm"],
    ["Tue AM","tue-am"], ["Tue PM","tue-pm"],
    ["Wed AM","wed-am"], ["Wed PM","wed-pm"],
    ["Thu AM","thu-am"], ["Thu PM","thu-pm"],
    ["Fri AM","fri-am"], ["Fri PM","fri-pm"],
    ["Sat AM","sat-am"], ["Sat PM","sat-pm"]
  ];

  const DAY_KEYS = [
    ["Monday", "mon-am", "mon-pm"],
    ["Tuesday", "tue-am", "tue-pm"],
    ["Wednesday", "wed-am", "wed-pm"],
    ["Thursday", "thu-am", "thu-pm"],
    ["Friday", "fri-am", "fri-pm"],
    ["Saturday", "sat-am", "sat-pm"]
  ];

  function parseNum(x) {
    const n = Number(String(x || "").trim());
    return Number.isFinite(n) ? n : null;
  }

  function getCurrentWeekData() {
    const ids = SLOT_LIST.map(x => x[1]);
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
    inp.addEventListener("input", saveCurrentDraft);
  });

  // Save week
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

  // ---------- Pattern detection (uses buy price baseline) ----------

  function sellSeriesFromData(dataObj) {
    const series = [];
    SELL_SLOTS.forEach(([label, key]) => {
      const v = parseNum(dataObj ? dataObj[key] : null);
      if (v !== null) series.push({ label, key, v });
    });
    return series;
  }

  function detectPattern(dataObj) {
    const buy = parseNum(dataObj ? dataObj["sun-buy"] : null);
    const series = sellSeriesFromData(dataObj);

    if (series.length < 4) return { type: "Unknown", note: "Not enough data yet." };

    const values = series.map(x => x.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    // Baseline adjusted range
    const baseline = buy !== null ? buy : min;
    const peakOverBuy = max - baseline;

    // Mostly decreasing?
    let downMoves = 0;
    let totalMoves = 0;
    for (let i = 1; i < series.length; i++) {
      totalMoves += 1;
      if (series[i].v <= series[i - 1].v) downMoves += 1;
    }
    const downRatio = downMoves / totalMoves;

    // Find peak index
    let peakIdx = 0;
    for (let i = 1; i < series.length; i++) {
      if (series[i].v > series[peakIdx].v) peakIdx = i;
    }
    const peak = series[peakIdx].v;
    const before = series[Math.max(0, peakIdx - 1)].v;
    const after = series[Math.min(series.length - 1, peakIdx + 1)].v;

    const jump = peak - before;
    const drop = peak - after;

    // If range tiny
    if (range < 15) {
      return { type: "Random", note: "Small movement, looks flat or random." };
    }

    if (downRatio >= 0.75 && peakIdx <= 2 && peakOverBuy < 30) {
      return { type: "Decreasing", note: "Mostly downhill. If you see profit early, take it." };
    }

    // Big spike: peak far above buy, large jump, large drop, later in week
    if (peakOverBuy >= 80 && jump >= 60 && drop >= 40 && peakIdx >= 4) {
      return { type: "Big Spike", note: "Huge peak then drop. Watch Thu to Sat closely." };
    }

    // Small spike: moderate peak, noticeable jump and drop
    if (peakOverBuy >= 50 && jump >= 35 && drop >= 20 && peakIdx >= 3) {
      return { type: "Small Spike", note: "Moderate peak. Watch Wed to Fri." };
    }

    return { type: "Random", note: "Bouncy week. Watch for surprise jumps." };
  }

  function mostCommonPattern(weeks) {
    const freq = new Map();
    let counted = 0;

    weeks.forEach(w => {
      const res = detectPattern(w && w.data ? w.data : null);
      if (!res.type || res.type === "Unknown") return;
      counted += 1;
      freq.set(res.type, (freq.get(res.type) || 0) + 1);
    });

    let bestType = null;
    let bestCount = 0;
    for (const [t, c] of freq.entries()) {
      if (c > bestCount) { bestCount = c; bestType = t; }
    }

    return { bestType, bestCount, counted };
  }

  // ---------- Predictor learning ----------

  function computeBestSellSlotFromData(dataObj) {
    let bestVal = null;
    let bestLabel = null;

    SELL_SLOTS.forEach(([label, key]) => {
      const v = parseNum(dataObj ? dataObj[key] : null);
      if (v === null) return;
      if (bestVal === null || v > bestVal) {
        bestVal = v;
        bestLabel = label;
      }
    });

    return { bestVal, bestLabel };
  }

  function computeBestDayAvgFromWeeks(weeks) {
    const daySums = new Map();
    const dayCounts = new Map();

    weeks.forEach(w => {
      const d = w && w.data ? w.data : null;
      if (!d) return;

      DAY_KEYS.forEach(([dayName, amKey, pmKey]) => {
        const am = parseNum(d[amKey]);
        const pm = parseNum(d[pmKey]);

        const vals = [am, pm].filter(v => v !== null);
        if (!vals.length) return;

        const dayAvg = vals.reduce((a,b) => a + b, 0) / vals.length;

        daySums.set(dayName, (daySums.get(dayName) || 0) + dayAvg);
        dayCounts.set(dayName, (dayCounts.get(dayName) || 0) + 1);
      });
    });

    let bestDay = null;
    let bestAvg = null;

    for (const [day, sum] of daySums.entries()) {
      const c = dayCounts.get(day) || 0;
      if (!c) continue;
      const avg = sum / c;
      if (bestAvg === null || avg > bestAvg) {
        bestAvg = avg;
        bestDay = day;
      }
    }

    return { bestDay, bestAvg };
  }

  function learnFromSavedWeeks(weeks) {
    const freq = new Map();
    let sumPeak = 0;
    let countedWeeks = 0;

    weeks.forEach(w => {
      const res = computeBestSellSlotFromData(w && w.data ? w.data : null);
      if (res.bestVal === null) return;

      countedWeeks += 1;
      sumPeak += res.bestVal;

      const label = res.bestLabel || "Unknown";
      freq.set(label, (freq.get(label) || 0) + 1);
    });

    const top3 = Array.from(freq.entries())
      .sort((a,b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, c]) => `${label} (${c})`);

    const avgPeak = countedWeeks ? (sumPeak / countedWeeks) : null;
    const dayAvg = computeBestDayAvgFromWeeks(weeks);
    const pattern = mostCommonPattern(weeks);

    let mostCommonBestLabel = null;
    let mostCommonCount = 0;
    for (const [label, c] of freq.entries()) {
      if (c > mostCommonCount) {
        mostCommonCount = c;
        mostCommonBestLabel = label;
      }
    }

    return {
      mostCommonBestLabel,
      mostCommonCount,
      avgPeak,
      countedWeeks,
      top3,
      bestDay: dayAvg.bestDay,
      bestDayAvg: dayAvg.bestAvg,
      pattern
    };
  }

  function updatePredictSummary() {
    const weeks = getWeeks();
    if (weeksCountEl) weeksCountEl.textContent = String(weeks.length);

    const current = getCurrentWeekData();
    const buy = parseNum(current["sun-buy"]);
    const curBest = computeBestSellSlotFromData(current);

    if (buyPriceEl) buyPriceEl.textContent = buy === null ? "-" : String(buy);

    if (curBest.bestVal === null) {
      if (bestSoFarEl) bestSoFarEl.textContent = "-";
      if (bestWhenEl) bestWhenEl.textContent = "-";
    } else {
      if (bestSoFarEl) bestSoFarEl.textContent = String(curBest.bestVal);
      if (bestWhenEl) bestWhenEl.textContent = curBest.bestLabel;
    }

    if (profitVsBuyEl) {
      if (buy === null || curBest.bestVal === null) profitVsBuyEl.textContent = "-";
      else {
        const diff = curBest.bestVal - buy;
        const sign = diff >= 0 ? "+" : "";
        profitVsBuyEl.textContent = `${sign}${diff}`;
      }
    }

    const learn = learnFromSavedWeeks(weeks);

    if (bestDayAvgEl) {
      if (!learn.bestDay) bestDayAvgEl.textContent = "-";
      else {
        const avgTxt = learn.bestDayAvg === null ? "-" : String(Math.round(learn.bestDayAvg));
        bestDayAvgEl.textContent = `${learn.bestDay} (~${avgTxt})`;
      }
    }

    if (topPeaksEl) {
      topPeaksEl.textContent = learn.top3 && learn.top3.length ? learn.top3.join(", ") : "-";
    }

    if (recommendationEl) {
      if (learn.countedWeeks === 0 || learn.avgPeak === null || curBest.bestVal === null) {
        recommendationEl.textContent = "Need more data. Save weeks to improve.";
      } else {
        const avgPeakRounded = Math.round(learn.avgPeak);
        if (curBest.bestVal >= avgPeakRounded) {
          recommendationEl.textContent = `Sell now. This week’s best (${curBest.bestVal}) is at or above your avg peak (~${avgPeakRounded}).`;
        } else {
          recommendationEl.textContent = `Hold. This week’s best (${curBest.bestVal}) is below your avg peak (~${avgPeakRounded}).`;
        }
      }
    }

    if (likelyPatternEl && patternNoteEl) {
      const p = learn.pattern;
      if (!p.bestType) {
        likelyPatternEl.textContent = "-";
        patternNoteEl.textContent = "Save more weeks so pattern detection can learn your style.";
      } else {
        likelyPatternEl.textContent = `${p.bestType} (${p.bestCount}/${p.counted})`;
        patternNoteEl.textContent =
          p.bestType === "Big Spike" ? "Peaks tend to hit Thu to Sat, check often." :
          p.bestType === "Small Spike" ? "Peaks usually show Wed to Fri, stay alert." :
          p.bestType === "Decreasing" ? "Often downhill, take profit early if you see it." :
          "Bouncy weeks, watch for any surprise jump.";
      }
    }

    if (predictSummaryEl) {
      if (learn.countedWeeks === 0) {
        predictSummaryEl.textContent =
          "No saved weeks with prices yet. Save a week or two and I will start learning your best sell windows.";
      } else {
        const avgTxt = learn.avgPeak === null ? "-" : String(Math.round(learn.avgPeak));
        const commonTxt = learn.mostCommonBestLabel || "-";
        const confTxt = `${learn.countedWeeks} week${learn.countedWeeks === 1 ? "" : "s"} learned`;
        predictSummaryEl.textContent =
          `Most common peak slot: ${commonTxt}. Average weekly peak: ~${avgTxt}. Confidence: ${confTxt}.`;
      }
    }
  }

  if (runPredictBtn) {
    runPredictBtn.addEventListener("click", (e) => {
      e.preventDefault();
      updatePredictSummary();
      alert("Updated. Pattern detection now uses your Sunday buy price baseline.");
    });
  }

  // ---- History render (includes buy and pattern) ----
  function renderHistory() {
    const weeks = getWeeks();
    historyList.innerHTML = "";

    if (historyEmptyNote) {
      historyEmptyNote.style.display = weeks.length ? "none" : "block";
    }

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

      const det = detectPattern(w.data);
      const buy = parseNum(w.data && w.data["sun-buy"]);

      const details = document.createElement("div");
      details.className = "weekDetails";
      details.textContent =
        `Buy: ${buy === null ? "-" : buy}. Pattern: ${det.type}. ${det.note}  |  ${summarizeWeek(w.data)}`;

      row.appendChild(top);
      row.appendChild(details);
      historyList.appendChild(row);
    });
  }

  // Export
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

  // Import
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
        weeks.forEach((w) => { if (w && w.id && w.data) map.set(w.id, w); });

        setWeeks(Array.from(map.values()).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || "")));
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
    return [
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
