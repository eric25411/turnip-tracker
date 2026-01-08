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

  // History UI
  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");

  // Predictor UI
  const chartCanvas = document.getElementById("chartCanvas");
  const buyPriceEl = document.getElementById("buyPrice");
  const bestSoFarEl = document.getElementById("bestSoFar");
  const bestTimeEl = document.getElementById("bestTime");
  const profitVsBuyEl = document.getElementById("profitVsBuy");
  const patternTypeEl = document.getElementById("patternType");
  const patternNoteEl = document.getElementById("patternNote");

  const IDS = [
    "mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm",
    "thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"
  ];

  const LABELS = [
    "Mon AM","Mon PM","Tue AM","Tue PM","Wed AM","Wed PM",
    "Thu AM","Thu PM","Fri AM","Fri PM","Sat AM","Sat PM"
  ];

  function setActiveTab(tab) {
    const isEntry = tab === "entry";
    const isPredict = tab === "predict";
    const isHistory = tab === "history";

    entryView.classList.toggle("hidden", !isEntry);
    predictView.classList.toggle("hidden", !isPredict);
    historyView.classList.toggle("hidden", !isHistory);

    navEntry.classList.toggle("active", isEntry);
    navPredict.classList.toggle("active", isPredict);
    navHistory.classList.toggle("active", isHistory);

    if (isHistory) renderHistory();
    if (isPredict) renderPredictor();
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
    document.querySelectorAll(".priceInput").forEach(i => i.value = "");
    localStorage.removeItem(KEYS.current);
  }

  function saveCurrentDraft(){
    localStorage.setItem(KEYS.current, JSON.stringify(getCurrentWeekData()));
  }

  function loadCurrentDraft(){
    try {
      const raw = localStorage.getItem(KEYS.current);
      if (!raw) return;
      loadWeekData(JSON.parse(raw));
    } catch {}
  }

  document.querySelectorAll(".priceInput").forEach(inp => {
    inp.addEventListener("input", () => {
      saveCurrentDraft();
      // keep predictor fresh if user is already on it
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

  if (exportBtn) {
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

  if (importFile) {
    importFile.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      try {
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

  function summarizeWeek(data){
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

  function formatWeekLabel(iso){
    try{
      const d = new Date(iso);
      return `Saved ${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`;
    } catch {
      return "Saved week";
    }
  }

  function cryptoRandomId(){
    const rnd = Math.random().toString(16).slice(2);
    return `w_${Date.now()}_${rnd}`;
  }

  // Predictor basics
  function parseVals(){
    const data = getCurrentWeekData();
    return IDS.map(id => {
      const raw = data[id];
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    });
  }

  function renderPredictor(){
    const vals = parseVals();

    // buy price guess
    const buy = vals[0] ?? vals.find(v => v !== null) ?? null;

    const best = vals.reduce((m,v) => (v !== null && (m === null || v > m) ? v : m), null);
    let bestIdx = -1;
    vals.forEach((v,i) => { if (best !== null && v === best && bestIdx === -1) bestIdx = i; });

    const bestLabel = bestIdx >= 0 ? LABELS[bestIdx] : "-";

    buyPriceEl.textContent = buy === null ? "-" : String(buy);
    bestSoFarEl.textContent = best === null ? "-" : String(best);
    bestTimeEl.textContent = best === null ? "-" : bestLabel;

    if (buy !== null && best !== null) {
      const diff = best - buy;
      profitVsBuyEl.textContent = (diff >= 0 ? `+${diff}` : `${diff}`);
    } else {
      profitVsBuyEl.textContent = "-";
    }

    // very light pattern placeholder
    const knownCount = vals.filter(v => v !== null).length;
    if (knownCount < 4) {
      patternTypeEl.textContent = "-";
      patternNoteEl.textContent = "Add more prices this week, and save more weeks so pattern detection can learn.";
    } else {
      // basic slope check
      const first = vals.find(v => v !== null);
      const last = [...vals].reverse().find(v => v !== null);
      if (first !== null && last !== null && last > first) patternTypeEl.textContent = "Rising";
      else if (first !== null && last !== null && last < first) patternTypeEl.textContent = "Falling";
      else patternTypeEl.textContent = "Flat";
      patternNoteEl.textContent = "Early read only. More saved weeks will improve pattern detection.";
    }

    drawChart(vals);
  }

  function drawChart(vals){
    if (!chartCanvas) return;

    const ctx = chartCanvas.getContext("2d");
    const w = chartCanvas.width;
    const h = chartCanvas.height;

    ctx.clearRect(0,0,w,h);

    // plot area padding inside the AC frame
    const padL = 70, padR = 40, padT = 38, padB = 48;
    const pw = w - padL - padR;
    const ph = h - padT - padB;

    const points = vals
      .map((v,i) => (v === null ? null : { x: padL + (pw * (i/(vals.length-1))), yVal: v }))
      .filter(Boolean);

    if (!points.length) return;

    const minV = Math.min(...points.map(p => p.yVal));
    const maxV = Math.max(...points.map(p => p.yVal));
    const range = Math.max(1, maxV - minV);

    function yFor(v){
      const t = (v - minV) / range;
      return padT + (ph * (1 - t));
    }

    // line style
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(30,30,30,.85)";

    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = p.x;
      const y = yFor(p.yVal);
      if (idx === 0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    });
    ctx.stroke();

    // dots
    ctx.fillStyle = "rgba(30,30,30,.85)";
    points.forEach(p => {
      const x = p.x;
      const y = yFor(p.yVal);
      ctx.beginPath();
      ctx.arc(x,y,8,0,Math.PI*2);
      ctx.fill();
    });
  }

  // Boot
  loadCurrentDraft();
  setActiveTab("entry");
});
