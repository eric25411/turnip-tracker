document.addEventListener("DOMContentLoaded", () => {
  const KEYS = {
    weeks: "turnipTracker_weeks_v1",
    current: "turnipTracker_current_v1"
  };

  // Views
  const entryView = document.getElementById("entryView");
  const insightsView = document.getElementById("insightsView");
  const settingsView = document.getElementById("settingsView");

  // Nav buttons
  const navEntry = document.getElementById("navEntry");
  const navInsights = document.getElementById("navInsights");
  const navSettings = document.getElementById("navSettings");

  // Entry
  const saveWeekBtn = document.getElementById("saveWeekBtn");
  const buyPriceInput = document.getElementById("buy-price");
  const buySundayLabel = document.getElementById("buySundayLabel");
  const isabelleIcon = document.getElementById("isabelleIcon");

  // Insights
  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const statsList = document.getElementById("statsList");
  const chartCanvas = document.getElementById("chartCanvas");

  // Settings
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");
  const resetDraftBtn = document.getElementById("resetDraftBtn");

  // Basic checks
  if (!entryView || !insightsView || !settingsView) return;
  if (!navEntry || !navInsights || !navSettings) return;

  function setActiveTab(tab) {
    const isEntry = tab === "entry";
    const isInsights = tab === "insights";
    const isSettings = tab === "settings";

    entryView.classList.toggle("hidden", !isEntry);
    insightsView.classList.toggle("hidden", !isInsights);
    settingsView.classList.toggle("hidden", !isSettings);

    navEntry.classList.toggle("active", isEntry);
    navInsights.classList.toggle("active", isInsights);
    navSettings.classList.toggle("active", isSettings);

    if (isInsights) {
      renderHistory();
      renderStatsAndChart();
    }
  }

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

  // Sunday label: most recent Sunday, displayed as "Jan 4"
  function getMostRecentSunday(d = new Date()) {
    const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = copy.getDay(); // 0 Sunday
    copy.setDate(copy.getDate() - day);
    return copy;
  }

  function formatMonthDay(dateObj) {
    try {
      return dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "Sunday";
    }
  }

  function updateSundayLabel() {
    const sun = getMostRecentSunday(new Date());
    if (buySundayLabel) buySundayLabel.textContent = formatMonthDay(sun);

    // If Isabelle image fails both names, fall back to emoji by hiding img
    if (isabelleIcon) {
      isabelleIcon.addEventListener("error", () => {
        // If it fails again after swapping to .PNG, hide it
        if (isabelleIcon.src.includes(".PNG")) {
          isabelleIcon.style.display = "none";
        }
      });
    }
  }

  // Local storage helpers
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
    document.querySelectorAll(".priceInput, .buyInput").forEach((i) => (i.value = ""));
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

  // Auto save on input
  document.querySelectorAll(".priceInput, .buyInput").forEach((inp) => {
    inp.addEventListener("input", saveCurrentDraft);
  });

  // Save week
  if (saveWeekBtn) {
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
      setActiveTab("insights");
    });
  }

  // History rendering
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
        renderStatsAndChart();
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
        renderStatsAndChart();
      } catch {
        alert("Import failed. Make sure it is a valid exported JSON file.");
      } finally {
        e.target.value = "";
      }
    });
  }

  if (resetDraftBtn) {
    resetDraftBtn.addEventListener("click", (e) => {
      e.preventDefault();
      clearWeek();
      loadCurrentDraft();
      alert("Entry draft cleared.");
    });
  }

  // Stats + simple cozy chart
  function renderStatsAndChart() {
    if (!statsList) return;

    const d = getCurrentWeekData();
    const buy = toNum(d["buy-price"]);

    const points = [
      toNum(d["mon-am"]), toNum(d["mon-pm"]),
      toNum(d["tue-am"]), toNum(d["tue-pm"]),
      toNum(d["wed-am"]), toNum(d["wed-pm"]),
      toNum(d["thu-am"]), toNum(d["thu-pm"]),
      toNum(d["fri-am"]), toNum(d["fri-pm"]),
      toNum(d["sat-am"]), toNum(d["sat-pm"])
    ];

    const filled = points.filter((n) => typeof n === "number");
    const best = filled.length ? Math.max(...filled) : null;
    const bestIdx = best !== null ? points.findIndex((n) => n === best) : -1;

    const labelForIndex = (i) => {
      const map = [
        "Mon AM","Mon PM","Tue AM","Tue PM","Wed AM","Wed PM",
        "Thu AM","Thu PM","Fri AM","Fri PM","Sat AM","Sat PM"
      ];
      return map[i] || "-";
    };

    const profit = (buy && best !== null) ? (best - buy) : null;

    const rows = [
      ["Daisy Mae buy price", buy ? String(buy) : "-"],
      ["Best price seen", best !== null ? String(best) : "-"],
      ["Best time so far", bestIdx >= 0 ? labelForIndex(bestIdx) : "-"],
      ["Profit vs buy", profit !== null ? (profit >= 0 ? `+${profit}` : `${profit}`) : "-"]
    ];

    statsList.innerHTML = "";
    rows.forEach(([k, v]) => {
      const r = document.createElement("div");
      r.className = "statRow";
      const left = document.createElement("div");
      left.textContent = k;
      const right = document.createElement("div");
      right.textContent = v;
      r.appendChild(left);
      r.appendChild(right);
      statsList.appendChild(r);
    });

    drawCozyChart(points);
  }

  function drawCozyChart(points) {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext("2d");
    if (!ctx) return;

    const w = chartCanvas.width;
    const h = chartCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // background lines
    ctx.globalAlpha = 0.20;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000";
    for (let i = 1; i <= 4; i++) {
      const y = (h * i) / 5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const nums = points.filter((n) => typeof n === "number");
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 100;
    const span = Math.max(1, max - min);

    const padX = 14;
    const padY = 18;

    const xFor = (i) => padX + (i * (w - padX * 2)) / (points.length - 1);
    const yFor = (val) => {
      const t = (val - min) / span;
      return (h - padY) - t * (h - padY * 2);
    };

    // line
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#1f7a57";
    ctx.beginPath();

    let started = false;
    points.forEach((val, i) => {
      if (typeof val !== "number") return;
      const x = xFor(i);
      const y = yFor(val);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // dots, bell for AM, bell for PM
    points.forEach((val, i) => {
      if (typeof val !== "number") return;
      const x = xFor(i);
      const y = yFor(val);

      ctx.fillStyle = "#1f7a57";
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // small emoji marker near dot
      ctx.font = "12px system-ui";
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      const isAM = i % 2 === 0;
      ctx.fillText(isAM ? "🔔" : "🔔", x - 5, y - 10);
    });

    // bottom day labels
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    ctx.font = "11px system-ui";
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    dayLabels.forEach((d, idx) => {
      const i = idx * 2; // use AM positions
      const x = xFor(i);
      ctx.fillText(d, x - 10, h - 4);
    });
  }

  function toNum(v) {
    const s = String(v || "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
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
