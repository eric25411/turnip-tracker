(function () {
  const toast = document.getElementById("toast");

  const saveWeekBtn = document.getElementById("saveWeekBtn");
  const saveChangesBtn = document.getElementById("saveChangesBtn");
  const newWeekBtn = document.getElementById("newWeekBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");

  const editBanner = document.getElementById("editBanner");

  const predictBtn = document.getElementById("predictBtn");
  const historyBtn = document.getElementById("historyBtn");

  const viewPredict = document.getElementById("viewPredict");
  const viewHistory = document.getElementById("viewHistory");
  const historyList = document.getElementById("historyList");
  const historyHomeBtn = document.getElementById("historyHomeBtn");

  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");

  const predictText = document.getElementById("predictText");
  const buyInput = document.getElementById("buy-price");

  const inputs = Array.from(document.querySelectorAll(".priceInput"));
  const satPmInput = document.getElementById("sat-pm");

  const SLOT_ORDER = [
    ["mon-am", "Monday AM"],
    ["mon-pm", "Monday PM"],
    ["tue-am", "Tuesday AM"],
    ["tue-pm", "Tuesday PM"],
    ["wed-am", "Wednesday AM"],
    ["wed-pm", "Wednesday PM"],
    ["thu-am", "Thursday AM"],
    ["thu-pm", "Thursday PM"],
    ["fri-am", "Friday AM"],
    ["fri-pm", "Friday PM"],
    ["sat-am", "Saturday AM"],
    ["sat-pm", "Saturday PM"],
  ];

  const SLOT_NAME = Object.fromEntries(SLOT_ORDER);

  // Edit mode state
  let editingIndex = null; // number or null

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 1200);
  }

  function keyFor(id) {
    return `tt_${id}`;
  }

  function getHistory() {
    return JSON.parse(localStorage.getItem("tt_history") || "[]");
  }

  function setHistory(arr) {
    localStorage.setItem("tt_history", JSON.stringify(arr));
  }

  function num(v) {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function median(arr) {
    const a = arr.filter((x) => Number.isFinite(x)).slice().sort((x, y) => x - y);
    if (!a.length) return 0;
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  function findBestFromInputs() {
    let best = { id: null, value: -1 };
    inputs.forEach((el) => {
      const v = num(el.value);
      if (v > best.value) best = { id: el.id, value: v };
    });
    return best.value > 0 ? best : null;
  }

  function clearBestHighlight() {
    inputs.forEach((el) => el.classList.remove("bestNow"));
  }

  function applyBestHighlight() {
    clearBestHighlight();
    const best = findBestFromInputs();
    if (!best) return;
    const el = document.getElementById(best.id);
    if (el) el.classList.add("bestNow");
  }

  function setEditingUI(on) {
    if (!editBanner || !saveWeekBtn || !saveChangesBtn || !cancelEditBtn) return;

    if (on) {
      editBanner.classList.remove("viewHidden");
      saveWeekBtn.classList.add("viewHidden");
      saveChangesBtn.classList.remove("viewHidden");
      cancelEditBtn.classList.remove("viewHidden");
    } else {
      editBanner.classList.add("viewHidden");
      saveWeekBtn.classList.remove("viewHidden");
      saveChangesBtn.classList.add("viewHidden");
      cancelEditBtn.classList.add("viewHidden");
    }
  }

  function loadWeek() {
    if (buyInput) {
      const savedBuy = localStorage.getItem(keyFor("buy-price"));
      if (savedBuy !== null) buyInput.value = savedBuy;
    }

    inputs.forEach((el) => {
      const saved = localStorage.getItem(keyFor(el.id));
      if (saved !== null) el.value = saved;
    });

    updatePrediction();
  }

  function clearCurrentWeek() {
    if (buyInput) {
      buyInput.value = "";
      localStorage.removeItem(keyFor("buy-price"));
    }

    inputs.forEach((el) => {
      el.value = "";
      localStorage.removeItem(keyFor(el.id));
    });

    localStorage.removeItem("tt_autosaved_this_week");
    updatePrediction();
  }

  function getCurrentWeekObject() {
    const week = {
      savedAt: new Date().toISOString(),
      buy: buyInput ? num(buyInput.value) : 0,
      prices: {}
    };
    inputs.forEach((el) => {
      week.prices[el.id] = num(el.value);
    });
    return week;
  }

  function saveWeekToHistory(auto) {
    const week = getCurrentWeekObject();

    const history = getHistory();
    history.unshift(week);
    setHistory(history);

    localStorage.setItem("tt_last_saved_at", week.savedAt);

    showToast(auto ? "Week auto saved" : "Saved to History");
    renderHistory(true);
    updatePrediction();
  }

  function saveChangesToHistory() {
    if (editingIndex === null) return;

    const history = getHistory();
    const original = history[editingIndex];
    if (!original) {
      showToast("Edit failed");
      return;
    }

    const updated = {
      ...original,
      buy: buyInput ? num(buyInput.value) : 0,
      prices: {}
    };
    inputs.forEach((el) => {
      updated.prices[el.id] = num(el.value);
    });

    history[editingIndex] = updated;
    setHistory(history);

    showToast("Changes saved");
    renderHistory(false);
    updatePrediction();
  }

  function bestSellInWeek(week) {
    let best = { id: null, value: -1 };
    const prices = week?.prices || {};
    for (const [slotId] of SLOT_ORDER) {
      const v = num(prices[slotId]);
      if (v > best.value) best = { id: slotId, value: v };
    }
    return best.value > 0 ? best : null;
  }

  function weekSeries(week) {
    const prices = week?.prices || {};
    return SLOT_ORDER.map(([slotId]) => num(prices[slotId]));
  }

  function countNonZero(series) {
    return series.reduce((acc, v) => acc + (v > 0 ? 1 : 0), 0);
  }

  function classifyPattern(series, buy) {
    const nz = series.filter((v) => v > 0);
    if (nz.length < 4 || buy <= 0) return "unknown";

    let inc = 0;
    let dec = 0;
    for (let i = 1; i < nz.length; i++) {
      if (nz[i] > nz[i - 1]) inc++;
      if (nz[i] < nz[i - 1]) dec++;
    }

    const maxV = Math.max(...nz);
    const ratio = maxV / buy;

    if (ratio <= 1.02 && dec >= inc) return "decreasing";
    if (ratio >= 1.8) return "big spike";
    if (ratio >= 1.4) return "small spike";

    if (inc >= 3 && dec >= 3) return "random";
    if (inc <= 2 && dec >= 3) return "decreasing";

    return "random";
  }

  function recencyWeight(index, halfLifeWeeks) {
    const hl = Math.max(1, Number(halfLifeWeeks) || 8);
    return Math.pow(0.5, index / hl);
  }

  function weightedTopSlotAndStats(weeksWithIndex) {
    const peakWeightBySlot = {};
    const peakPrices = [];
    const peakProfits = [];

    for (const item of weeksWithIndex) {
      const w = item.week;
      const idx = item.idx;

      const buy = num(w.buy);
      const best = bestSellInWeek(w);
      if (!best) continue;

      const wt = recencyWeight(idx, 8);
      peakWeightBySlot[best.id] = (peakWeightBySlot[best.id] || 0) + wt;

      peakPrices.push(best.value);
      peakProfits.push(best.value - buy);
    }

    let topSlot = null;
    let topW = 0;
    let totalW = 0;

    for (const slotId of Object.keys(peakWeightBySlot)) {
      const w = peakWeightBySlot[slotId];
      totalW += w;
      if (w > topW) {
        topW = w;
        topSlot = slotId;
      }
    }

    const pct = totalW > 0 ? Math.round((topW / totalW) * 100) : 0;

    return {
      n: weeksWithIndex.length,
      topSlot,
      topSlotPct: pct,
      medPeak: Math.round(median(peakPrices)),
      medProfit: Math.round(median(peakProfits)),
    };
  }

  function buildHistoryStatsWeighted() {
    const history = getHistory();

    const usable = history
      .map((week, idx) => ({ week, idx }))
      .filter((x) => num(x.week?.buy) > 0)
      .filter((x) => countNonZero(weekSeries(x.week)) >= 8);

    const byPattern = {
      "decreasing": [],
      "small spike": [],
      "big spike": [],
      "random": [],
    };

    for (const item of usable) {
      const buy = num(item.week.buy);
      const series = weekSeries(item.week);
      const pat = classifyPattern(series, buy);
      if (!byPattern[pat]) continue;
      byPattern[pat].push(item);
    }

    function summarize(items) {
      if (!items.length) return null;
      return weightedTopSlotAndStats(items);
    }

    return {
      all: summarize(usable),
      patterns: {
        "decreasing": summarize(byPattern["decreasing"]),
        "small spike": summarize(byPattern["small spike"]),
        "big spike": summarize(byPattern["big spike"]),
        "random": summarize(byPattern["random"]),
      }
    };
  }

  function updatePrediction() {
    if (!predictText) return;

    applyBestHighlight();

    const best = findBestFromInputs();
    const buy = buyInput ? num(buyInput.value) : 0;

    if (!best) {
      predictText.textContent = "Enter prices to get a best sell window.";
      return;
    }

    const slotName = SLOT_NAME[best.id] || best.id;
    const profit = buy > 0 ? (best.value - buy) : null;

    let line1 = "";
    if (profit === null) {
      line1 = `Best sell time so far is ${slotName}, at ${best.value}.`;
    } else if (profit <= 0) {
      line1 = `Best sell time so far is ${slotName}, at ${best.value}. That is ${Math.abs(profit)} below your buy price.`;
    } else {
      line1 = `Best sell time so far is ${slotName}, at ${best.value}. That is ${profit} profit per turnip vs your buy price.`;
    }

    const currentWeek = getCurrentWeekObject();
    const pat = classifyPattern(weekSeries(currentWeek), buy);

    const stats = buildHistoryStatsWeighted();
    const patStats = stats?.patterns?.[pat] || null;
    const allStats = stats?.all || null;
    const useStats = patStats || allStats;

    if (!useStats || !useStats.topSlot) {
      predictText.textContent = line1 + " Save a few weeks to unlock history based predictions.";
      return;
    }

    const recSlotName = SLOT_NAME[useStats.topSlot] || useStats.topSlot;
    const conf = useStats.topSlotPct;
    const n = useStats.n;

    let line2 = "";
    if (patStats) {
      line2 = `Weighted toward your recent weeks with a similar pattern, peaks most often hit ${recSlotName}. About ${conf}% across ${n} saved weeks.`;
    } else {
      line2 = `Weighted toward your recent weeks, peaks most often hit ${recSlotName}. About ${conf}% across ${n} saved weeks.`;
    }

    let line3 = "";
    if (useStats.medPeak > 0) {
      if (buy > 0) line3 = `Your median peak is around ${useStats.medPeak}, and median profit is around ${useStats.medProfit}.`;
      else line3 = `Your median peak is around ${useStats.medPeak}.`;
    }

    let line4 = "";
    if (pat !== "unknown") line4 = `Current week pattern guess is ${pat}.`;

    const editLine = editingIndex !== null ? "You are editing a saved week." : "";

    predictText.textContent = [line1, editLine, line4, line2, line3].filter(Boolean).join(" ");
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  }

  function renderHistory() {
    if (!historyList) return;

    const history = getHistory();

    if (history.length === 0) {
      historyList.innerHTML = `
        <div class="weekCard">
          <div class="weekTitle">No saved weeks yet</div>
          <div class="weekMeta">Fill the week, then it auto saves on Saturday PM, or hit Save week.</div>
        </div>
      `;
      return;
    }

    const dayOrder = [
      ["Monday", "mon-am", "mon-pm"],
      ["Tuesday", "tue-am", "tue-pm"],
      ["Wednesday", "wed-am", "wed-pm"],
      ["Thursday", "thu-am", "thu-pm"],
      ["Friday", "fri-am", "fri-pm"],
      ["Saturday", "sat-am", "sat-pm"],
    ];

    historyList.innerHTML = history.map((week, idx) => {
      const best = bestSellInWeek(week);
      const buy = num(week.buy);

      return `
        <div class="weekCard" data-idx="${idx}">
          <div class="weekTop">
            <div class="weekTitle">${formatDate(week.savedAt)}</div>
            <div class="weekMeta">
              Buy: ${buy || "-"}<br/>
              Best: ${best ? best.value : "-"}
            </div>
          </div>

          <div class="weekActionRow">
            <button class="smallBtn loadBtn" type="button">Load</button>
            <button class="smallBtn danger deleteBtn" type="button">Delete</button>
          </div>

          <button class="weekExpandBtn" type="button">
            ${best ? `Best sell: ${(SLOT_NAME[best.id] || best.id)} at ${best.value}` : "Expand week"}
          </button>

          <div class="weekDetails">
            <div class="miniGrid">
              ${dayOrder.map(([dayName, amId, pmId]) => {
                const am = num(week.prices?.[amId]) || "-";
                const pm = num(week.prices?.[pmId]) || "-";
                return `
                  <div class="miniCell">
                    <div class="miniLabel">${dayName} AM</div>
                    <div class="miniVal">${am}</div>
                  </div>
                  <div class="miniCell">
                    <div class="miniLabel">${dayName} PM</div>
                    <div class="miniVal">${pm}</div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        </div>
      `;
    }).join("");

    historyList.querySelectorAll(".weekCard").forEach((card) => {
      const expand = card.querySelector(".weekExpandBtn");
      const load = card.querySelector(".loadBtn");
      const del = card.querySelector(".deleteBtn");

      expand.addEventListener("click", () => card.classList.toggle("isOpen"));

      load.addEventListener("click", () => {
        const idx = Number(card.getAttribute("data-idx"));
        loadWeekFromHistoryIndex(idx);
      });

      del.addEventListener("click", () => {
        const idx = Number(card.getAttribute("data-idx"));
        deleteWeek(idx);
      });
    });
  }

  function wireInputs() {
    if (buyInput) {
      buyInput.addEventListener("input", () => {
        buyInput.value = buyInput.value.replace(/[^\d]/g, "");
        localStorage.setItem(keyFor("buy-price"), buyInput.value);
        updatePrediction();
      });
    }

    inputs.forEach((el) => {
      el.addEventListener("input", () => {
        el.value = el.value.replace(/[^\d]/g, "");
        localStorage.setItem(keyFor(el.id), el.value);
        updatePrediction();
      });
    });

    // Auto save Saturday PM only when not editing
    if (satPmInput) {
      satPmInput.addEventListener("input", () => {
        if (editingIndex !== null) return;

        const v = num(satPmInput.value);
        if (v <= 0) return;

        const already = localStorage.getItem("tt_autosaved_this_week");
        if (already === "yes") return;

        localStorage.setItem("tt_autosaved_this_week", "yes");
        saveWeekToHistory(true);
        clearCurrentWeek();
      });
    }
  }

  function showView(which) {
    if (!viewPredict || !viewHistory) return;

    if (which === "history") {
      viewPredict.classList.add("viewHidden");
      viewHistory.classList.remove("viewHidden");
    } else {
      viewHistory.classList.add("viewHidden");
      viewPredict.classList.remove("viewHidden");
    }
  }

  function setActiveNav(which) {
    predictBtn.classList.toggle("isActive", which === "predict");
    historyBtn.classList.toggle("isActive", which === "history");
  }

  function handleRoute() {
    const hash = (window.location.hash || "#predict").toLowerCase();
    if (hash === "#history") {
      showView("history");
      setActiveNav("history");
      renderHistory();
    } else {
      showView("predict");
      setActiveNav("predict");
    }
  }

  function loadWeekFromHistoryIndex(idx) {
    const history = getHistory();
    const week = history[idx];
    if (!week) return;

    editingIndex = idx;
    setEditingUI(true);

    if (buyInput) {
      buyInput.value = week.buy ? String(num(week.buy)) : "";
      localStorage.setItem(keyFor("buy-price"), buyInput.value);
    }

    inputs.forEach((el) => {
      const v = num(week.prices?.[el.id]);
      el.value = v > 0 ? String(v) : "";
      localStorage.setItem(keyFor(el.id), el.value);
    });

    showToast("Editing loaded week");
    updatePrediction();
    window.location.hash = "#predict";
  }

  function exitEditMode(clearInputs) {
    editingIndex = null;
    setEditingUI(false);
    if (clearInputs) clearCurrentWeek();
    updatePrediction();
  }

  function deleteWeek(idx) {
    const history = getHistory();
    const week = history[idx];
    if (!week) return;

    const ok = window.confirm("Delete this saved week?");
    if (!ok) return;

    history.splice(idx, 1);
    setHistory(history);

    // If you delete a week before the one you are editing, shift index
    if (editingIndex !== null) {
      if (idx === editingIndex) {
        exitEditMode(false);
      } else if (idx < editingIndex) {
        editingIndex = editingIndex - 1;
      }
    }

    showToast("Week deleted");
    renderHistory();
    updatePrediction();
  }

  function exportHistory() {
    const history = getHistory();
    const payload = {
      app: "Turnip Tracker",
      version: 1,
      exportedAt: new Date().toISOString(),
      history
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `turnip-tracker-history-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
    showToast("Exported");
  }

  function importHistoryFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const parsed = JSON.parse(text);

        const incoming = Array.isArray(parsed?.history)
          ? parsed.history
          : (Array.isArray(parsed) ? parsed : null);

        if (!incoming) {
          showToast("Import failed");
          return;
        }

        const current = getHistory();
        const merged = [...incoming, ...current];

        const seen = new Set();
        const cleaned = [];
        for (const w of merged) {
          if (!w || !w.savedAt) continue;
          if (seen.has(w.savedAt)) continue;
          seen.add(w.savedAt);
          cleaned.push(w);
        }

        cleaned.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
        setHistory(cleaned);

        showToast("Imported");
        renderHistory();
        updatePrediction();
      } catch {
        showToast("Import failed");
      }
    };
    reader.readAsText(file);
  }

  // Buttons
  if (saveWeekBtn) saveWeekBtn.addEventListener("click", () => saveWeekToHistory(false));
  if (saveChangesBtn) saveChangesBtn.addEventListener("click", saveChangesToHistory);

  if (newWeekBtn) {
    newWeekBtn.addEventListener("click", () => {
      exitEditMode(true);
      showToast("New week started");
    });
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
      exitEditMode(false);
      showToast("Edit cancelled");
    });
  }

  if (historyHomeBtn) historyHomeBtn.addEventListener("click", () => (window.location.hash = "#predict"));
  if (exportBtn) exportBtn.addEventListener("click", exportHistory);

  if (importFile) {
    importFile.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      importHistoryFromFile(file);
      importFile.value = "";
    });
  }

  window.addEventListener("hashchange", handleRoute);

  // Init
  setEditingUI(false);
  wireInputs();
  loadWeek();
  handleRoute();
})();
