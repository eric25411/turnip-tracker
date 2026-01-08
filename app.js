document.addEventListener("DOMContentLoaded", () => {
  const KEYS = {
    weeks: "turnipTracker_weeks_v2",
    current: "turnipTracker_current_v2"
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

  // History UI
  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");

  // Predictor UI
  const canvas = document.getElementById("chartCanvas");
  const buyPriceEl = document.getElementById("buyPriceVal");
  const bestSoFarEl = document.getElementById("bestSoFarVal");
  const bestTimeEl = document.getElementById("bestTimeVal");
  const profitVsBuyEl = document.getElementById("profitVsBuyVal");
  const patternTypeEl = document.getElementById("patternTypeVal");
  const patternNoteEl = document.getElementById("patternNoteVal");
  const forecastWindowEl = document.getElementById("forecastWindowVal");
  const forecastConfEl = document.getElementById("forecastConfVal");
  const watchNextEl = document.getElementById("watchNextVal");
  const rangeEl = document.getElementById("rangeVal");

  const IDS = [
    "buy-price",
    "mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm",
    "thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"
  ];

  const WEEK_IDS = [
    "mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm",
    "thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"
  ];

  const LABELS = [
    "Mon AM","Mon PM","Tue AM","Tue PM","Wed AM","Wed PM",
    "Thu AM","Thu PM","Fri AM","Fri PM","Sat AM","Sat PM"
  ];

  // Guard
  if (!entryView || !predictView || !historyView) return;
  if (!navEntry || !navPredict || !navHistory) return;
  if (!saveWeekBtn) return;

  function setActiveTab(tab){
    const isEntry = tab === "entry";
    const isPredict = tab === "predict";
    const isHistory = tab === "history";

    entryView.classList.toggle("hidden", !isEntry);
    predictView.classList.toggle("hidden", !isPredict);
    historyView.classList.toggle("hidden", !isHistory);

    navEntry.classList.toggle("active", isEntry);
    navPredict.classList.toggle("active", isPredict);
    navHistory.classList.toggle("active", isHistory);

    if (isPredict) renderPredictor();
    if (isHistory) renderHistory();
  }

  navEntry.addEventListener("click", () => setActiveTab("entry"));
  navPredict.addEventListener("click", () => setActiveTab("predict"));
  navHistory.addEventListener("click", () => setActiveTab("history"));
  if (goHomeBtn) goHomeBtn.addEventListener("click", () => setActiveTab("entry"));

  function getWeeks(){
    try { return JSON.parse(localStorage.getItem(KEYS.weeks) || "[]"); }
    catch { return []; }
  }

  function setWeeks(weeks){
    localStorage.setItem(KEYS.weeks, JSON.stringify(weeks));
  }

  function getCurrentWeekData(){
    const data = {};
    IDS.forEach(id => {
      const el = document.getElementById(id);
      data[id] = ((el && el.value) || "").trim();
    });
    return data;
  }

  function loadWeekData(data){
    Object.keys(data || {}).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = data[id] ?? "";
    });
  }

  function clearWeek(){
    IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    localStorage.removeItem(KEYS.current);
  }

  function saveCurrentDraft(){
    localStorage.setItem(KEYS.current, JSON.stringify(getCurrentWeekData()));
  }

  function loadCurrentDraft(){
    try{
      const raw = localStorage.getItem(KEYS.current);
      if (!raw) return;
      loadWeekData(JSON.parse(raw));
    } catch {}
  }

  document.querySelectorAll(".priceInput").forEach(inp => {
    inp.addEventListener("input", () => {
      saveCurrentDraft();
      if (!predictView.classList.contains("hidden")) renderPredictor();
    });
  });

  saveWeekBtn.addEventListener("click", () => {
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

  function renderHistory(){
    if (!historyList || !historyEmptyNote) return;

    const weeks = getWeeks();
    historyList.innerHTML = "";
    historyEmptyNote.style.display = weeks.length ? "none" : "block";

    weeks.forEach(w => {
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
        const next = getWeeks().filter(x => x.id !== w.id);
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

  if (exportBtn){
    exportBtn.addEventListener("click", () => {
      const payload = { exportedAt: new Date().toISOString(), weeks: getWeeks() };
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

  if (importFile){
    importFile.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      try{
        const text = await file.text();
        const parsed = JSON.parse(text);
        const weeks = Array.isArray(parsed.weeks) ? parsed.weeks : [];

        const existing = getWeeks();
        const map = new Map(existing.map(w => [w.id, w]));
        weeks.forEach(w => { if (w && w.id && w.data) map.set(w.id, w); });

        setWeeks(Array.from(map.values()).sort((a,b) => (b.savedAt || "").localeCompare(a.savedAt || "")));
        renderHistory();
      } catch {
        alert("Import failed. Make sure it is a valid exported JSON file.");
      } finally {
        e.target.value = "";
      }
    });
  }

  function parseVals(){
    const data = getCurrentWeekData();

    const buyRaw = (data["buy-price"] || "").trim();
    const buyNum = Number(buyRaw);
    const buy = Number.isFinite(buyNum) ? buyNum : null;

    const weekVals = WEEK_IDS.map(id => {
      const raw = (data[id] || "").trim();
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    });

    return { buy, weekVals };
  }

  function renderPredictor(){
    if (!canvas) return;

    const { buy, weekVals } = parseVals();

    const best = weekVals.reduce((m,v) => (v !== null && (m === null || v > m) ? v : m), null);
    let bestIdx = -1;
    weekVals.forEach((v,i) => { if (best !== null && v === best && bestIdx === -1) bestIdx = i; });
    const bestLabel = bestIdx >= 0 ? LABELS[bestIdx] : "-";

    if (buyPriceEl) buyPriceEl.textContent = buy === null ? "-" : String(buy);
    if (bestSoFarEl) bestSoFarEl.textContent = best === null ? "-" : String(best);
    if (bestTimeEl) bestTimeEl.textContent = best === null ? "-" : bestLabel;

    if (profitVsBuyEl){
      if (buy !== null && best !== null){
        const diff = best - buy;
        profitVsBuyEl.textContent = diff >= 0 ? `+${diff}` : `${diff}`;
      } else {
        profitVsBuyEl.textContent = "-";
      }
    }

    const knownCount = weekVals.filter(v => v !== null).length;

    if (knownCount < 4){
      if (patternTypeEl) patternTypeEl.textContent = "-";
      if (patternNoteEl) patternNoteEl.textContent = "Add more prices this week, and save more weeks so pattern detection can learn.";
      if (forecastWindowEl) forecastWindowEl.textContent = "-";
      if (forecastConfEl) forecastConfEl.textContent = "-";
      if (watchNextEl) watchNextEl.textContent = "-";
      if (rangeEl) rangeEl.textContent = "-";
    } else {
      const first = weekVals.find(v => v !== null);
      const last = [...weekVals].reverse().find(v => v !== null);

      let pattern = "Mixed";
      if (first !== null && last !== null && last > first) pattern = "Rising";
      if (first !== null && last !== null && last < first) pattern = "Falling";
      if (first !== null && last !== null && last === first) pattern = "Flat";

      if (patternTypeEl) patternTypeEl.textContent = pattern;
      if (patternNoteEl) patternNoteEl.textContent = "Early read only. More saved weeks will improve pattern detection.";

      let window = "Wed AM to Thu PM";
      let conf = 60;
      let watch = "If it keeps dropping, sell the first time you see profit over buy.";
      let minR = 90;
      let maxR = 170;

      if (first !== null && last !== null && last > first){
        window = "Mon PM to Tue PM";
        conf = 68;
        watch = "Early pop vibes. If you see profit, consider taking it.";
      }

      if (first !== null && last !== null && last < first){
        window = "Thu AM to Fri PM";
        conf = 62;
        watch = "Looks like a slower week. Watch mid to late week for a bounce.";
      }

      if (best !== null){
        maxR = Math.max(best + 10, 160);
        minR = Math.max(50, (buy !== null ? buy - 20 : 80));
      }

      if (forecastWindowEl) forecastWindowEl.textContent = window;
      if (forecastConfEl) forecastConfEl.textContent = `${conf}%`;
      if (watchNextEl) watchNextEl.textContent = watch;
      if (rangeEl) rangeEl.textContent = `${minR} to ${maxR}`;
    }

    drawChart(weekVals);
  }

  function drawChart(vals){
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0,0,w,h);

    // Grid
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    for (let i = 1; i <= 4; i++){
      const y = (h * i) / 5;
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(w - 20, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const known = vals.filter(v => v !== null);
    const minV = known.length ? Math.min(...known) : 0;
    const maxV = known.length ? Math.max(...known) : 100;

    const pad = 20;
    const xStep = (w - pad * 2) / (vals.length - 1 || 1);

    const yFor = (v) => {
      if (v === null) return null;
      if (maxV === minV) return h / 2;
      const t = (v - minV) / (maxV - minV);
      return (h - pad) - t * (h - pad * 2);
    };

    // Line
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    let started = false;
    vals.forEach((v, i) => {
      const y = yFor(v);
      if (y === null) return;
      const x = pad + i * xStep;
      if (!started){
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Points
    ctx.fillStyle = "#111";
    vals.forEach((v, i) => {
      const y = yFor(v);
      if (y === null) return;
      const x = pad + i * xStep;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function summarizeWeek(data){
    const get = (k) => (data && data[k] ? data[k] : "-");
    const buy = get("buy-price");
    return [
      `Buy ${buy}`,
      `Mon AM ${get("mon-am")}, Mon PM ${get("mon-pm")}`,
      `Tue AM ${get("tue-am")}, Tue PM ${get("tue-pm")}`,
      `Wed AM ${get("wed-am")}, Wed PM ${get("wed-pm")}`,
      `Thu AM ${get("thu-am")}, Thu PM ${get("thu-pm")}`,
      `Fri AM ${get("fri-am")}, Fri PM ${get("fri-pm")}`,
      `Sat AM ${get("sat-am")}, Sat PM ${get("sat-pm")}`
    ].join(" | ");
  }

  function formatWeekLabel(iso){
    try{
      const d = new Date(iso);
      return `Saved ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`;
    } catch {
      return "Saved week";
    }
  }

  function cryptoRandomId(){
    const rnd = Math.random().toString(16).slice(2);
    return `w_${Date.now()}_${rnd}`;
  }

  // Boot
  loadCurrentDraft();
  setActiveTab("entry");
});
