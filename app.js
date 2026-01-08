(function () {
  const toast = document.getElementById("toast");

  const saveWeekBtn = document.getElementById("saveWeekBtn");
  const newWeekBtn = document.getElementById("newWeekBtn");

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

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 1200);
  }

  function keyFor(id) {
    return `tt_${id}`;
  }

  function prettySlot(id) {
    const [d, t] = id.split("-");
    const dayMap = {
      mon: "Monday",
      tue: "Tuesday",
      wed: "Wednesday",
      thu: "Thursday",
      fri: "Friday",
      sat: "Saturday",
    };
    const timeMap = { am: "AM", pm: "PM" };
    return `${dayMap[d] || d} ${timeMap[t] || t}`;
  }

  function getHistory() {
    return JSON.parse(localStorage.getItem("tt_history") || "[]");
  }

  function setHistory(arr) {
    localStorage.setItem("tt_history", JSON.stringify(arr));
  }

  function findBestFromInputs() {
    let best = { id: null, value: -1 };
    inputs.forEach((el) => {
      const v = Number(el.value || 0);
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

  function updatePrediction() {
    if (!predictText) return;

    const best = findBestFromInputs();
    const buy = buyInput ? Number(buyInput.value || 0) : 0;

    applyBestHighlight();

    if (!best) {
      predictText.textContent = "Enter prices to get a best sell window.";
      return;
    }

    const slot = prettySlot(best.id);
    const profit = buy > 0 ? best.value - buy : null;

    if (profit === null) {
      predictText.textContent = `Best sell time so far is ${slot}, at ${best.value}.`;
      return;
    }

    if (profit <= 0) {
      predictText.textContent =
        `Best sell time so far is ${slot}, at ${best.value}. ` +
        `That is ${Math.abs(profit)} below your buy price, so you may want to wait if you can.`;
      return;
    }

    predictText.textContent =
      `Best sell time so far is ${slot}, at ${best.value}. ` +
      `That is ${profit} profit per turnip vs your buy price.`;
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

  function saveWeekToHistory(auto) {
    const week = {
      savedAt: new Date().toISOString(),
      buy: buyInput ? Number(buyInput.value || 0) : 0,
      prices: {}
    };

    inputs.forEach((el) => {
      week.prices[el.id] = Number(el.value || 0);
    });

    const history = getHistory();
    history.unshift(week);
    setHistory(history);

    localStorage.setItem("tt_last_saved_at", week.savedAt);

    showToast(auto ? "Week auto saved" : "Saved to History");
    renderHistory(true);
  }

  function bestSellInWeek(week) {
    let best = { id: null, value: -1 };
    Object.keys(week.prices || {}).forEach((k) => {
      const v = Number(week.prices[k] || 0);
      if (v > best.value) best = { id: k, value: v };
    });
    return best.value > 0 ? best : null;
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  }

  function renderHistory(tryHighlight) {
    if (!historyList) return;

    const history = getHistory();
    const lastSavedAt = localStorage.getItem("tt_last_saved_at") || "";

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
      const bestText = best ? `${prettySlot(best.id)} at ${best.value}` : "No prices saved";
      const buy = Number(week.buy || 0);

      const isNew = lastSavedAt && week.savedAt === lastSavedAt;

      return `
        <div class="weekCard ${isNew ? "isNew" : ""}" data-idx="${idx}">
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
            ${best ? `Best sell: ${bestText}` : "Expand week"}
          </button>

          <div class="weekDetails">
            <div class="miniGrid">
              ${dayOrder.map(([dayName, amId, pmId]) => {
                const am = Number(week.prices?.[amId] || 0) || "-";
                const pm = Number(week.prices?.[pmId] || 0) || "-";
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

      expand.addEventListener("click", () => {
        card.classList.toggle("isOpen");
      });

      load.addEventListener("click", () => {
        const idx = Number(card.getAttribute("data-idx"));
        loadWeekFromHistoryIndex(idx);
      });

      del.addEventListener("click", () => {
        const idx = Number(card.getAttribute("data-idx"));
        deleteWeek(idx);
      });
    });

    if (tryHighlight) {
      const newCard = historyList.querySelector(".weekCard.isNew");
      if (newCard) {
        newCard.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => {
          newCard.classList.remove("isNew");
        }, 4500);
      }
    }
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

    if (satPmInput) {
      satPmInput.addEventListener("input", () => {
        const v = Number(satPmInput.value || 0);
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
      renderHistory(false);
    } else {
      showView("predict");
      setActiveNav("predict");
    }
  }

  function loadWeekFromHistoryIndex(idx) {
    const history = getHistory();
    const week = history[idx];
    if (!week) return;

    if (buyInput) {
      buyInput.value = week.buy ? String(week.buy) : "";
      localStorage.setItem(keyFor("buy-price"), buyInput.value);
    }

    inputs.forEach((el) => {
      const v = Number(week.prices?.[el.id] || 0);
      el.value = v > 0 ? String(v) : "";
      localStorage.setItem(keyFor(el.id), el.value);
    });

    localStorage.removeItem("tt_autosaved_this_week");
    showToast("Week loaded");
    updatePrediction();

    window.location.hash = "#predict";
  }

  function deleteWeek(idx) {
    const history = getHistory();
    const week = history[idx];
    if (!week) return;

    const ok = window.confirm("Delete this saved week?");
    if (!ok) return;

    history.splice(idx, 1);
    setHistory(history);

    showToast("Week deleted");
    renderHistory(false);
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

        const incoming = Array.isArray(parsed?.history) ? parsed.history : (Array.isArray(parsed) ? parsed : null);
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
        renderHistory(true);
      } catch {
        showToast("Import failed");
      }
    };
    reader.readAsText(file);
  }

  if (saveWeekBtn) saveWeekBtn.addEventListener("click", () => saveWeekToHistory(false));

  if (newWeekBtn) {
    newWeekBtn.addEventListener("click", () => {
      clearCurrentWeek();
      showToast("New week started");
    });
  }

  if (historyHomeBtn) {
    historyHomeBtn.addEventListener("click", () => {
      window.location.hash = "#predict";
    });
  }

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

  wireInputs();
  loadWeek();
  handleRoute();
})();
