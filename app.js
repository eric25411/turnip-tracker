document.addEventListener("DOMContentLoaded", () => {
  const KEYS = {
    weeks: "turnipTracker_weeks_v1",
    current: "turnipTracker_current_v1",
    buy: "turnipTracker_buy_v1"
  };

  // Views
  const entryView = document.getElementById("entryView");
  const predictView = document.getElementById("predictView");

  // Nav
  const navEntry = document.getElementById("navEntry");
  const navPredict = document.getElementById("navPredict");
  const navHistory = document.getElementById("navHistory"); // goes to predictView, scrolls history section

  // Inputs
  const buyInput = document.getElementById("buy-price");
  const priceInputs = Array.from(document.querySelectorAll(".priceInput"));

  // Save
  const saveWeekBtn = document.getElementById("saveWeekBtn");

  // Predict UI
  const chartPath = document.getElementById("chartPath");
  const chartPoints = document.getElementById("chartPoints");

  const statBuy = document.getElementById("statBuy");
  const statBest = document.getElementById("statBest");
  const statBestTime = document.getElementById("statBestTime");
  const statProfit = document.getElementById("statProfit");
  const statPattern = document.getElementById("statPattern");

  // History UI inside Predict
  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");

  // Buy sub label
  const buySub = document.getElementById("buySub");

  // Safety checks
  if (!entryView || !predictView || !navEntry || !navPredict || !navHistory) {
    console.log("Missing core view or nav elements.");
    return;
  }

  // Helpers
  function setActiveTab(tab) {
    const isEntry = tab === "entry";
    entryView.classList.toggle("hidden", !isEntry);
    predictView.classList.toggle("hidden", isEntry);

    navEntry.classList.toggle("active", isEntry);
    navPredict.classList.toggle("active", !isEntry);
    navHistory.classList.toggle("active", false);

    if (!isEntry) {
      renderPredict();
    }
  }

  // Nav handlers
  navEntry.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveTab("entry");
  });

  navPredict.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveTab("predict");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  navHistory.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveTab("predict");
    // Scroll to history section inside predict view
    setTimeout(() => {
      const el = document.querySelector(".historyCard");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  });

  // Local storage
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

  function getBuyPrice() {
    try {
      const raw = localStorage.getItem(KEYS.buy);
      return raw ? (JSON.parse(raw).value ?? "") : "";
    } catch {
      return "";
    }
  }

  function setBuyPrice(value) {
    localStorage.setItem(KEYS.buy, JSON.stringify({ value: String(value || "").trim() }));
  }

  function getCurrentWeekData() {
    const ids = [
      "mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm",
      "thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"
    ];

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
    priceInputs.forEach((i) => (i.value = ""));
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
  priceInputs.forEach((inp) => inp.addEventListener("input", saveCurrentDraft));

  if (buyInput) {
    buyInput.addEventListener("input", () => {
      setBuyPrice(buyInput.value);
      renderPredict();
    });
  }

  // Save week
  if (saveWeekBtn) {
    saveWeekBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const week = {
        id: cryptoRandomId(),
        savedAt: new Date().toISOString(),
        buy: getBuyPrice().trim(),
        data: getCurrentWeekData()
      };

      const weeks = getWeeks();
      weeks.unshift(week);
      setWeeks(weeks);

      clearWeek();
      setActiveTab("predict");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // History rendering
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
        if (buyInput) {
          buyInput.value = (w.buy ?? "").toString();
          setBuyPrice(buyInput.value);
        }
        setActiveTab("entry");
        window.scrollTo({ top: 0, behavior: "smooth" });
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
      details.textContent = summarizeWeek(w.data, w.buy);

      row.appendChild(top);
      row.appendChild(details);
      historyList.appendChild(row);
    });
  }

  // Export, Import
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
      } catch {
        alert("Import failed. Make sure it is a valid exported JSON file.");
      } finally {
        e.target.value = "";
      }
    });
  }

  // Predict rendering
  function renderPredict() {
    // Update stats
    const buy = parseNum(getBuyPrice());
    const series = buildSeriesFromInputs();
    const best = Math.max(...series.map((x) => (x.value ?? -Infinity)).filter((v) => isFinite(v)), -Infinity);

    const bestPoint = series.reduce((acc, cur) => {
      if (!isFinite(cur.value)) return acc;
      if (!acc) return cur;
      return cur.value > acc.value ? cur : acc;
    }, null);

    statBuy.textContent = isFinite(buy) ? String(buy) : "-";
    statBest.textContent = isFinite(best) && best !== -Infinity ? String(best) : "-";
    statBestTime.textContent = bestPoint ? bestPoint.label : "-";

    if (isFinite(buy) && bestPoint && isFinite(bestPoint.value)) {
      const diff = bestPoint.value - buy;
      statProfit.textContent = diff >= 0 ? `+${diff}` : `${diff}`;
    } else {
      statProfit.textContent = "-";
    }

    // Pattern: simple cozy placeholder for now
    statPattern.textContent = "Mixed";

    // Draw chart
    drawChart(series);

    // History
    renderHistory();
  }

  function drawChart(series) {
    if (!chartPath || !chartPoints) return;

    // SVG chart inner area
    const left = 16;
    const right = 304;
    const top = 16;
    const bottom = 112;

    // x positions (12 points)
    const xs = Array.from({ length: 12 }, (_, i) => left + (i * (right - left)) / 11);

    // y scaling
    const values = series.map((p) => p.value).filter((v) => isFinite(v));
    const minV = values.length ? Math.min(...values) : 0;
    const maxV = values.length ? Math.max(...values) : 100;

    const pad = 8;
    const lo = minV - pad;
    const hi = maxV + pad;

    function yFor(v) {
      if (!isFinite(v)) return bottom;
      if (hi === lo) return (top + bottom) / 2;
      const t = (v - lo) / (hi - lo);
      return bottom - t * (bottom - top);
    }

    // Path only connects known points, but keeps spacing
    let d = "";
    series.forEach((p, i) => {
      const x = xs[i];
      const y = yFor(p.value);
      if (i === 0) d += `M ${x} ${y}`;
      else d += ` L ${x} ${y}`;
    });

    chartPath.setAttribute("d", d);

    // Points
    chartPoints.innerHTML = "";
    series.forEach((p, i) => {
      const x = xs[i];
      const y = yFor(p.value);

      // Bell dot marker
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", x);
      c.setAttribute("cy", y);
      c.setAttribute("r", "3.6");
      c.setAttribute("fill", "rgba(0,0,0,0.75)");
      chartPoints.appendChild(c);

      // Subtle outer glow
      const g = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      g.setAttribute("cx", x);
      g.setAttribute("cy", y);
      g.setAttribute("r", "7");
      g.setAttribute("fill", "rgba(0,0,0,0.05)");
      chartPoints.appendChild(g);
    });
  }

  function buildSeriesFromInputs() {
    // 12 slots, labels match cozy postcard idea
    const order = [
      { id: "mon-am", label: "Mon AM" }, { id: "mon-pm", label: "Mon PM" },
      { id: "tue-am", label: "Tue AM" }, { id: "tue-pm", label: "Tue PM" },
      { id: "wed-am", label: "Wed AM" }, { id: "wed-pm", label: "Wed PM" },
      { id: "thu-am", label: "Thu AM" }, { id: "thu-pm", label: "Thu PM" },
      { id: "fri-am", label: "Fri AM" }, { id: "fri-pm", label: "Fri PM" },
      { id: "sat-am", label: "Sat AM" }, { id: "sat-pm", label: "Sat PM" }
    ];

    return order.map((o) => {
      const el = document.getElementById(o.id);
      const v = el ? parseNum(el.value) : NaN;
      return { id: o.id, label: o.label, value: v };
    });
  }

  // Sunday label under buy section
  function updateBuySubLabel() {
    if (!buySub) return;
    const sunday = getMostRecentSunday(new Date());
    const month = sunday.toLocaleDateString(undefined, { month: "short" });
    const day = sunday.getDate();
    buySub.textContent = `Daisy Mae, Sunday ${month} ${day}`;
  }

  function getMostRecentSunday(d) {
    const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = copy.getDay(); // 0 Sunday
    copy.setDate(copy.getDate() - dow);
    return copy;
  }

  function parseNum(s) {
    const n = parseInt(String(s || "").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : NaN;
  }

  function summarizeWeek(data, buy) {
    const get = (k) => (data && data[k] ? data[k] : "-");
    const buyTxt = buy ? `Buy ${buy}` : "Buy -";
    return [
      buyTxt,
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
  updateBuySubLabel();

  // Load buy price
  if (buyInput) buyInput.value = getBuyPrice();

  // Load draft
  loadCurrentDraft();

  // Default to Entry
  setActiveTab("entry");

  // Also refresh the buy label when the tab becomes visible again
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateBuySubLabel();
  });
});
