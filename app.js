(function () {
  const toast = document.getElementById("toast");
  const saveWeekBtn = document.getElementById("saveWeekBtn");

  const predictBtn = document.getElementById("predictBtn");
  const historyBtn = document.getElementById("historyBtn");

  const predictText = document.getElementById("predictText");
  const buyInput = document.getElementById("buy-price");

  const inputs = Array.from(document.querySelectorAll(".priceInput"));

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 1100);
  }

  function setActiveNavFromHash() {
    const hash = (window.location.hash || "#predict").toLowerCase();
    predictBtn.classList.toggle("isActive", hash === "#predict");
    historyBtn.classList.toggle("isActive", hash === "#history");
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

  function findBestSoFar() {
    let best = { id: null, value: -1 };

    inputs.forEach((el) => {
      const v = Number(el.value || 0);
      if (v > best.value) best = { id: el.id, value: v };
    });

    return best.value > 0 ? best : null;
  }

  function updatePrediction() {
    if (!predictText) return;

    const best = findBestSoFar();
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

  // Nav state
  window.addEventListener("hashchange", setActiveNavFromHash);
  setActiveNavFromHash();

  // Save week
  if (saveWeekBtn) {
    saveWeekBtn.addEventListener("click", saveWeekToHistory);
  }

  wireInputs();
  loadWeek();
})();
