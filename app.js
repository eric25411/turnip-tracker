document.addEventListener("DOMContentLoaded", () => {
  const KEYS = {
    weeks: "turnipTracker_weeks_v1",
    current: "turnipTracker_current_v1",
    alertSeen: "turnipTracker_alertSeen_v1"
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

  const forecastWindowEl = document.getElementById("forecastWindow");
  const forecastConfidenceEl = document.getElementById("forecastConfidence");
  const watchNextEl = document.getElementById("watchNext");

  const expectedRangeEl = document.getElementById("expectedRange");

  const sellAlertBadge = document.getElementById("sellAlertBadge");

  // Chart
  const priceChart = document.getElementById("priceChart");

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

  // Auto save draft on input, also update predictor bits quietly
  document.querySelectorAll(".priceInput").forEach((inp) => {
    inp.addEventListener("input", () => {
      saveCurrentDraft();
      // live update sell alert badge even while in entry view
      maybeShowSellAlert();
    });
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

    // Reset sell alert seen for next week
    localStorage.removeItem(KEYS.alertSeen);

    clearWeek();
    setActiveTab("history");
  });

  // ---------- Pattern detection (saved weeks) ----------
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

    const baseline = buy !== null ? buy : min;
    const peakOverBuy = max - baseline;

    let downMoves = 0;
    let totalMoves = 0;
    for (let i = 1; i < series.length; i++) {
      totalMoves += 1;
      if (series[i].v <= series[i - 1].v) downMoves += 1;
    }
    const downRatio = downMoves / totalMoves;

    let peakIdx = 0;
    for (let i = 1; i < series.length; i++) {
      if (series[i].v > series[peakIdx].v) peakIdx = i;
    }
    const peak = series[peakIdx].v;
    const before = series[Math.max(0, peakIdx - 1)].v;
    const after = series[Math.min(series.length - 1, peakIdx + 1)].v;

    const jump = peak - before;
    const drop = peak - after;

    if (range < 15) {
      return { type: "Random", note: "Small movement, looks flat or random." };
    }

    if (downRatio >= 0.75 && peakIdx <= 2 && peakOverBuy < 30) {
      return { type: "Decreasing", note: "Mostly downhill. If you see profit early, take it." };
    }

    if (peakOverBuy >= 80 && jump >= 60 && drop >= 40 && peakIdx >= 4) {
      return { type: "Big Spike", note: "Huge peak then drop. Watch Thu to Sat closely." };
    }

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

  // ---------- Learning ----------
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
    IfNoWeeks: {
      // label block to keep things simple
    }
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

    const peaks = [];
    const peakOverBuy = [];

    weeks.forEach(w => {
      const d = w && w.data ? w.data : null;
      if (!d) return;

      const res = computeBestSellSlotFromData(d);
      if (res.bestVal === null) return;

      countedWeeks += 1;
      sumPeak += res.bestVal;
      peaks.push(res.bestVal);

      const buy = parseNum(d["sun-buy"]);
      if (buy !== null) peakOverBuy.push(res.bestVal - buy);

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
      pattern,
      peaks,
      peakOverBuy
    };
  }

  // ---------- Expected max range ----------
  function quantile(arr, q) {
    if (!arr.length) return null;
    const a = arr.slice().sort((x,y) => x - y);
    const pos = (a.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (a[base + 1] === undefined) return a[base];
    return a[base] + rest * (a[base + 1] - a[base]);
  }

  function expectedMaxRangeText(buy, learn) {
    // If we have history with buy prices, estimate peakOverBuy 25th to 75th and convert to absolute
    if (buy !== null && learn.peakOverBuy && learn.peakOverBuy.length >= 4) {
      const q25 = quantile(learn.peakOverBuy, 0.25);
      const q75 = quantile(learn.peakOverBuy, 0.75);
      if (q25 !== null && q75 !== null) {
        const lo = Math.max(0, Math.round(buy + q25));
        const hi = Math.max(0, Math.round(buy + q75));
        return `${lo} to ${hi}`;
      }
    }

    // If we only have peak absolute history, show a range from that
    if (learn.peaks && learn.peaks.length >= 4) {
      const q25 = quantile(learn.peaks, 0.25);
      const q75 = quantile(learn.peaks, 0.75);
      if (q25 !== null && q75 !== null) {
        return `${Math.round(q25)} to ${Math.round(q75)}`;
      }
    }

    // Fallback if no history
    if (buy !== null) {
      // conservative starter range
      const lo = Math.round(buy * 1.2);
      const hi = Math.round(buy * 1.8);
      return `${lo} to ${hi}`;
    }

    return "-";
  }

  // ---------- Tiny chart ----------
  function drawTinyChart(currentData, learn) {
    if (!priceChart) return;
    const ctx = priceChart.getContext("2d");
    if (!ctx) return;

    const W = priceChart.width;
    const H = priceChart.height;

    ctx.clearRect(0, 0, W, H);

    const points = [];
    SELL_SLOTS.forEach(([label, key], i) => {
      const v = parseNum(currentData ? currentData[key] : null);
      if (v !== null) points.push({ i, v });
    });

    // background
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,0.03)";
    ctx.fillRect(0, 0, W, H);

    // grid lines
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.lineWidth = 1;
    for (let g = 1; g <= 3; g++) {
      const y = (H * g) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    if (!points.length) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.font = "12px system-ui";
      ctx.fillText("Enter prices to see chart", 10, 20);
      return;
    }

    // figure min max
    let minV = points[0].v;
    let maxV = points[0].v;
    points.forEach(p => {
      if (p.v < minV) minV = p.v;
      if (p.v > maxV) maxV = p.v;
    });

    // Add headroom
    const pad = Math.max(10, Math.round((maxV - minV) * 0.15));
    minV -= pad;
    maxV += pad;

    function xFor(i) {
      const left = 10;
      const right = 10;
      const usable = W - left - right;
      return left + (i / (SELL_SLOTS.length - 1)) * usable;
    }

    function yFor(v) {
      const top = 10;
      const bottom = 16;
      const usable = H - top - bottom;
      if (maxV === minV) return top + usable / 2;
      const t = (v - minV) / (maxV - minV);
      return top + (1 - t) * usable;
    }

    // draw learned target line (avgPeak) if available
    if (learn && learn.avgPeak !== null && Number.isFinite(learn.avgPeak)) {
      const y = yFor(learn.avgPeak);
      ctx.strokeStyle = "rgba(45,125,100,0.55)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // line
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = xFor(p.i);
      const y = yFor(p.v);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // dots
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    points.forEach(p => {
      const x = xFor(p.i);
      const y = yFor(p.v);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // min max labels
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "11px system-ui";
    ctx.fillText(String(Math.round(maxV)), 10, 10);
    ctx.fillText(String(Math.round(minV)), 10, H - 4);
  }

  // ---------- Forecast current week ----------
  function getEnteredSellSlots(currentData) {
    const entered = [];
    SELL_SLOTS.forEach(([label, key]) => {
      const v = parseNum(currentData ? currentData[key] : null);
      if (v !== null) entered.push({ label, key, v });
    });
    return entered;
  }

  function slotIndexByKey(key) {
    for (let i = 0; i < SELL_SLOTS.length; i++) {
      if (SELL_SLOTS[i][1] === key) return i;
    }
    return -1;
  }

  function forecastCurrentWeek(currentData, learnedPatternType) {
    const buy = parseNum(currentData ? currentData["sun-buy"] : null);
    const entered = getEnteredSellSlots(currentData);

    if (entered.length === 0) {
      return {
        window: "-",
        confidence: "-",
        watchNext: "Enter at least one sell price, Mon AM is a good start."
      };
    }

    const first = entered[0].v;
    const last = entered[entered.length - 1].v;
    const change = last - first;

    let best = entered[0];
    for (let i = 1; i < entered.length; i++) {
      if (entered[i].v > best.v) best = entered[i];
    }

    const bestIdx = slotIndexByKey(best.key);
    const lastIdx = slotIndexByKey(entered[entered.length - 1].key);

    const profit = (buy !== null) ? (best.v - buy) : null;

    let candidate = learnedPatternType || "Unknown";

    if (!learnedPatternType || learnedPatternType === "Unknown") {
      if (change < -20 && (profit === null || profit < 20)) candidate = "Decreasing";
      else if (buy !== null && best.v >= buy + 80 && bestIdx >= 4) candidate = "Big Spike";
      else if (buy !== null && best.v >= buy + 50 && bestIdx >= 3) candidate = "Small Spike";
      else candidate = "Random";
    }

    let windowStart = "Thu AM";
    let windowEnd = "Fri PM";
    let watchNext = "Keep entering prices, next slot helps confirm the pattern.";
    let confidence = 35;

    if (candidate === "Decreasing") {
      windowStart = "Mon AM";
      windowEnd = "Tue PM";
      confidence = 45;
      watchNext = "If Wed keeps dropping, sell the first time you see profit over buy.";
    }

    if (candidate === "Random") {
      windowStart = "Wed AM";
      windowEnd = "Sat PM";
      confidence = 30;
      watchNext = maybeBuyText(buy, "Random weeks need more data. Watch for any sudden jump, especially Thu and Fri.");
    }

    if (candidate === "Small Spike") {
      windowStart = "Wed AM";
      windowEnd = "Fri PM";
      confidence = 55;
      watchNext = "If you see a jump of 30 or more between two slots, that is your spike forming.";
    }

    if (candidate === "Big Spike") {
      windowStart = "Thu AM";
      windowEnd = "Sat AM";
      confidence = 65;
      watchNext = "Big spike usually appears fast. If Thu AM shoots up hard, be ready to sell same day.";
    }

    confidence += Math.min(entered.length * 4, 20);

    if (bestIdx >= 6) confidence += 5;
    if (profit !== null && profit >= 80) confidence += 10;

    if (lastIdx >= 6 && last >= best.v) {
      windowStart = "Fri AM";
      windowEnd = "Sat PM";
      watchNext = "You are late week and still rising, watch every slot closely.";
      confidence = Math.min(confidence + 5, 90);
    }

    confidence = Math.max(10, Math.min(confidence, 90));

    return {
      window: `${windowStart} to ${windowEnd}`,
      confidence: `${confidence}%`,
      watchNext
    };
  }

  function maybeBuyText(buy, text) {
    if (buy === null) return text;
    return text;
  }

  // ---------- Sell alert ----------
  function maybeShowSellAlert() {
    if (!sellAlertBadge) return;

    const weeks = getWeeks();
    const learn = learnFromSavedWeeks(weeks);
    const current = getCurrentWeekData();

    const buy = parseNum(current["sun-buy"]);
    const curBest = computeBestSellSlotFromData(current);

    // If no best, hide
    if (curBest.bestVal === null) {
      sellAlertBadge.classList.add("hidden");
      return;
    }

    // Determine trigger level:
    // 1) If we have avgPeak from history, trigger when best meets or beats avgPeak
    // 2) Else if we have buy price, trigger when profit reaches +50
    // 3) Else no alert
    let trigger = null;
    let reason = "";

    if (learn.avgPeak !== null && ensureFinite(learn.avgPeak)) {
      trigger = Math.round(learn.avgPeak);
      reason = `Hit learned target ${trigger}`;
    } else if (buy !== null) {
      trigger = buy + 50;
      reason = "Profit is +50 or more";
    }

    if (trigger === null) {
      sellAlertBadge.classList.add("hidden");
      return;
    }

    const alreadyShown = localStorage.getItem(KEYS.alertSeen) === "1";

    if (curBest.bestVal >= trigger) {
      sellAlertBadge.textContent = "Sell alert";
      sellAlertBadge.classList.remove("hidden");

      // One time popup per week, optional
      if (!alreadyShown) {
        localStorage.setItem(KEYS.alertSeen, "1");
        alert(`Sell alert, best so far is ${curBest.bestVal}. ${reason}.`);
      }
    } else {
      sellAlertBadge.classList.add("hidden");
    }
  }

  function ensureFinite(x) {
    return typeof x === "number" && Number.isFinite(x);
  }

  // ---------- Predictor update ----------
  function updatePredictSummary() {
    const weeks = getWeeks();
    const learn = learnFromSavedWeeks(weeks);

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
        if (buy !== null && curBest.bestVal !== null) {
          const diff = curBest.bestVal - buy;
          if (diff >= 50) recommendationEl.textContent = "Solid profit. If you are happy with it, selling now is reasonable.";
          else recommendationEl.textContent = "Not much profit yet. Keep watching, especially mid to late week.";
        } else {
          recommendationEl.textContent = "Need more data. Save weeks to improve.";
        }
      } else {
        const avgPeakRounded = Math.round(learn.avgPeak);
        if (curBest.bestVal >= avgPeakRounded) {
          recommendationEl.textContent = `Sell now. This week’s best (${curBest.bestVal}) is at or above your avg peak (~${avgPeakRounded}).`;
        } else {
          recommendationEl.textContent = `Hold. This week’s best (${curBest.bestVal}) is below your avg peak (~${avgPeakRounded}).`;
        }
      }
    }

    // Learned pattern from saved weeks
    let learnedType = null;
    if (likelyPatternEl && patternNoteEl) {
      const p = learn.pattern;
      if (!p.bestType) {
        likelyPatternEl.textContent = "-";
        patternNoteEl.textContent = "Save more weeks so pattern detection can learn your style.";
      } else {
        learnedType = p.bestType;
        likelyPatternEl.textContent = `${p.bestType} (${p.bestCount}/${p.counted})`;
        patternNoteEl.textContent =
          p.bestType === "Big Spike" ? "Peaks tend to hit Thu to Sat, check often." :
          p.bestType === "Small Spike" ? "Peaks usually show Wed to Fri, stay alert." :
          p.bestType === "Decreasing" ? "Often downhill, take profit early if you see it." :
          "Bouncy weeks, watch for any surprise jump.";
      }
    }

    const fc = forecastCurrentWeek(current, learnedType);
    if (forecastWindowEl) forecastWindowEl.textContent = fc.window;
    if (forecastConfidenceEl) forecastConfidenceEl.textContent = fc.confidence;
    if (watchNextEl) watchNextEl.textContent = fc.watchNext;

    // Expected max range
    if (expectedRangeEl) expectedRangeEl.textContent = expectedMaxRangeText(buy, learn);

    // Tiny chart
    drawTinyChart(current, learn);

    // Sell alert badge
    maybeShowSellAlert();

    if (predictSummaryEl) {
      if (learn.countedWeeks === 0) {
        predictSummaryEl.textContent =
          "No saved weeks yet. Forecast and expected range are based on this week’s partial data.";
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
      alert("Predictor updated.");
    });
  }

  // ---- History render ----
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
  // Also compute alert state on load
  maybeShowSellAlert();
});
