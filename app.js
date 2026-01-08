(function () {
  const toast = document.getElementById("toast");
  const saveWeekBtn = document.getElementById("saveWeekBtn");

  const predictBtn = document.getElementById("predictBtn");
  const historyBtn = document.getElementById("historyBtn");

  const viewPredict = document.getElementById("viewPredict");
  const viewHistory = document.getElementById("viewHistory");
  const historyList = document.getElementById("historyList");
  const historyHomeBtn = document.getElementById("historyHomeBtn");

  const predictText = document.getElementById("predictText");
  const buyInput = document.getElementById("buy-price");

  const inputs = Array.from(document.querySelectorAll(".priceInput"));

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 1100);
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

  function findBestSoFarFromInputs() {
    let best = { id: null, value: -1 };
    inputs.forEach((el) => {
      const v = Number(el.value || 0);
      if (v > best.value) best = { id: el.id, value: v };
    });
    return best.value > 0 ? best : null;
  }

  function updatePrediction() {
    if (!predictText) return;

    const best = findBestSoFarFromInputs();
    const buy = buyInput ? Number(buyInput.value || 0) : 0;

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

  function saveWeekToHistory() {
    const week = {
      savedAt: new Date().toISOString(),
      buy: buyInput ? Number(buyInput.value || 0) : 0,
      prices: {}
    };

    inputs.forEach((el) => {
      week.prices[el.id] = Number(el.value || 0);
    });

    const history = JSON.parse(localStorage.getItem("tt_history") || "[]");
    history.unshift(week);
    localStorage.setItem("tt_history", JSON.stringify(history));

    showToast("Saved to History");
    renderHistory();
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

  function renderHistory() {
    if (!historyList) return;

    const history = JSON.parse(localStorage.getItem("tt_history") || "[]");

    if (history.length === 0) {
      historyList.innerHTML = `
        <div class="weekCard">
          <div class="weekTitle">No saved weeks yet</div>
          <div class="weekMeta">Hit “Save week to History” on the home screen.</div>
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

      return `
        <div class="weekCard" data-idx="${idx}">
          <div class="weekTop">
            <div class="weekTitle">${formatDate(week.savedAt)}</div>
            <div class="weekMeta">
              Buy: ${buy || "-"}<br/>
              Best: ${best ? best.value : "-"}
            </div>
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

    // Expand/collapse
    historyList.querySelectorAll(".weekCard").forEach((card) => {
      const btn = card.querySelector(".weekExpandBtn");
      btn.addEventListener("click", () => {
        card.classList.toggle("isOpen");
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

  // Save week
  if (saveWeekBtn) saveWeekBtn.addEventListener("click", saveWeekToHistory);

  // Home button in history
  if (historyHomeBtn) {
    historyHomeBtn.addEventListener("click", () => {
      window.location.hash = "#predict";
    });
  }

  // Routing
  window.addEventListener("hashchange", handleRoute);

  wireInputs();
  loadWeek();
  handleRoute();
})();
