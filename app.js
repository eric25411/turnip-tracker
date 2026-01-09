document.addEventListener("DOMContentLoaded", () => {
  const KEYS = {
    weeks: "turnipTracker_weeks_v1",
    current: "turnipTracker_current_v1"
  };

  // Views
  const entryView = document.getElementById("predictView");   // Entry screen
  const predictorView = document.getElementById("historyView"); // Predictor screen

  // Bottom nav buttons (Entry + Predict)
  const navEntry = document.getElementById("navPredict");
  const navPredict = document.getElementById("navHistory");

  // Buttons
  const saveWeekBtn = document.getElementById("saveWeekBtn");
  const goHomeBtn = document.getElementById("goHomeBtn");

  // Buy price
  const buyPriceInput = document.getElementById("buy-price");
  const buySubLabel = document.getElementById("buySubLabel");

  // Predictor UI
  const canvas = document.getElementById("trendChart");
  const statBuy = document.getElementById("statBuy");
  const statBest = document.getElementById("statBest");
  const statBestTime = document.getElementById("statBestTime");
  const statProfit = document.getElementById("statProfit");
  const statPattern = document.getElementById("statPattern");
  const statNote = document.getElementById("statNote");

  // History UI
  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");

  if (!entryView || !predictorView || !navEntry || !navPredict || !saveWeekBtn) {
    console.log("Missing required elements. Check ids in index.html.");
    return;
  }

  // --- Cozy Sunday label that matches device locale, refreshes when opened ---
  function getMostRecentSunday(date = new Date()) {
    // Sunday = 0
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function updateSundayLabel() {
    if (!buySubLabel) return;
    const sunday = getMostRecentSunday(new Date());
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" });
    buySubLabel.textContent = `Daisy Mae, ${fmt.format(sunday)}`;
  }

  // --- View switching ---
  function setActiveTab(tab) {
    const isEntry = tab === "entry";

    entryView.classList.toggle("hidden", !isEntry);
    predictorView.classList.toggle("hidden", isEntry);

    navEntry.classList.toggle("active", isEntry);
    navPredict.classList.toggle("active", !isEntry);

    if (!isEntry) {
      renderPredictor();
      renderHistory();
    }
  }

  navEntry.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveTab("entry");
  });

  navPredict.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveTab("predictor");
  });

  if (goHomeBtn) {
    goHomeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      setActiveTab("entry");
    });
  }

  // --- Storage helpers ---
  function getWeeks() {
    try { return JSON.parse(localStorage.getItem(KEYS.weeks) || "[]"); }
    catch { return []; }
  }

  function setWeeks(weeks) {
    localStorage.setItem(KEYS.weeks, JSON.stringify(weeks));
  }

  function getCurrentWeekData() {
    const ids = [
      "buy-price",
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
    setActiveTab("predictor");
  });

  // --- History rendering ---
  function renderHistory() {
    const weeks = getWeeks();
    if (!historyList || !historyEmptyNote) return;

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

  // --- Export / Import ---
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

  // --- Predictor ---
  function parseNumber(v) {
    const n = Number(String(v || "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function getSlotsFromCurrent() {
    const order = [
      "mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm",
      "thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"
    ];
    const data = getCurrentWeekData();
    return order.map((id) => parseNumber(data[id]));
  }

  function drawPostcardChart(values) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background grid (light)
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = 24 + i * 34;
      ctx.beginPath();
      ctx.moveTo(18, y);
      ctx.lineTo(W - 18, y);
      ctx.strokeStyle = "#000";
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Find min/max
    const nums = values.filter(v => typeof v === "number");
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 120;

    const padX = 26;
    const padY = 34;
    const plotW = W - padX * 2;
    const plotH = H - padY * 2;

    function xAt(i) {
      return padX + (plotW * (i / 11));
    }
    function yAt(v) {
      if (!nums.length) return padY + plotH * 0.70;
      const t = (v - min) / (max - min || 1);
      return padY + plotH * (1 - t);
    }

    // Line
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#2d2d2d";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    let started = false;
    ctx.beginPath();
    values.forEach((v, i) => {
      if (typeof v !== "number") return;
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

    // Dots: AM = sun, PM = moon
    values.forEach((v, i) => {
      const x = xAt(i);
      const y = typeof v === "number" ? yAt(v) : yAt(min);

      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#1f1f1f";
      ctx.fill();

      // emoji overlay
      ctx.font = "18px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const isAM = i % 2 === 0;
      ctx.fillText(isAM ? "🌞" : "🌙", x, y - 18);
    });

    // Day labels along bottom (Mon..Sat)
    const dayXs = [0,2,4,6,8,10].map(i => xAt(i));
    const days = ["Mon","Tue","Wed","Thu","Fri","Sat"];
    ctx.font = "16px system-ui";
    ctx.fillStyle = "rgba(18,18,18,.55)";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    dayXs.forEach((x, idx) => {
      ctx.fillText(days[idx], x, H - 10);
    });
  }

  function renderPredictor() {
    const data = getCurrentWeekData();
    const buy = parseNumber(data["buy-price"]);

    const slots = getSlotsFromCurrent();
    drawPostcardChart(slots);

    const seen = slots.filter(v => typeof v === "number");
    const best = seen.length ? Math.max(...seen) : null;
    const bestIdx = best == null ? -1 : slots.findIndex(v => v === best);

    const labelAt = (idx) => {
      const map = [
        "Mon AM","Mon PM","Tue AM","Tue PM","Wed AM","Wed PM",
        "Thu AM","Thu PM","Fri AM","Fri PM","Sat AM","Sat PM"
      ];
      return map[idx] || "-";
    };

    if (statBuy) statBuy.textContent = buy == null ? "-" : String(buy);
    if (statBest) statBest.textContent = best == null ? "-" : String(best);
    if (statBestTime) statBestTime.textContent = bestIdx < 0 ? "-" : labelAt(bestIdx);

    if (statProfit) {
      if (buy == null || best == null) statProfit.textContent = "-";
      else {
        const diff = best - buy;
        statProfit.textContent = diff >= 0 ? `+${diff}` : String(diff);
      }
    }

    // Simple placeholder “pattern” until you expand it later
    if (statPattern) statPattern.textContent = seen.length >= 4 ? "Mixed" : "-";
    if (statNote) {
      statNote.textContent = seen.length >= 4
        ? "Keep logging, patterns get clearer as the week fills in."
        : "Add a few more prices and the postcard starts to feel smarter.";
    }
  }

  function summarizeWeek(data) {
    const get = (k) => (data && data[k] ? data[k] : "-");
    return [
      `Buy ${get("buy-price")}`,
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
  updateSundayLabel();
  loadCurrentDraft();
  setActiveTab("entry");
});
