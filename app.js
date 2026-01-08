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

  // Entry
  const buyPriceInput = document.getElementById("buyPrice");
  const saveWeekBtn = document.getElementById("saveWeekBtn");

  // History
  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");
  const goHomeBtn = document.getElementById("goHomeBtn");

  // Predictor
  const chartCanvas = document.getElementById("chartCanvas");
  const predictStats = document.getElementById("predictStats");

  // Safety
  if (!entryView || !predictView || !historyView) return;
  if (!navEntry || !navPredict || !navHistory) return;

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

  function getWeeks() {
    try { return JSON.parse(localStorage.getItem(KEYS.weeks) || "[]"); }
    catch { return []; }
  }
  function setWeeks(weeks) {
    localStorage.setItem(KEYS.weeks, JSON.stringify(weeks));
  }

  function getCurrentWeekData() {
    const ids = [
      "mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm",
      "thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"
    ];
    const data = {};
    ids.forEach(id => {
      const el = document.getElementById(id);
      data[id] = ((el && el.value) || "").trim();
    });
    data.buy = (buyPriceInput && buyPriceInput.value || "").trim();
    return data;
  }

  function loadWeekData(data) {
    const safe = data || {};
    Object.keys(safe).forEach((id) => {
      if (id === "buy") return;
      const el = document.getElementById(id);
      if (el) el.value = safe[id] ?? "";
    });
    if (buyPriceInput) buyPriceInput.value = safe.buy ?? "";
  }

  function clearWeek() {
    document.querySelectorAll(".priceInput").forEach(i => i.value = "");
    if (buyPriceInput) buyPriceInput.value = "";
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

  // autosave
  document.querySelectorAll(".priceInput").forEach(inp => {
    inp.addEventListener("input", saveCurrentDraft);
  });
  if (buyPriceInput) buyPriceInput.addEventListener("input", saveCurrentDraft);

  // save week
  if (saveWeekBtn) {
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
  }

  // History UI
  function renderHistory() {
    const weeks = getWeeks();
    historyList.innerHTML = "";
    if (historyEmptyNote) historyEmptyNote.style.display = weeks.length ? "none" : "block";

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

        weeks.forEach(w => {
          if (w && w.id && w.data) map.set(w.id, w);
        });

        setWeeks(Array.from(map.values()).sort((a,b) => (b.savedAt || "").localeCompare(a.savedAt || "")));
        renderHistory();
      } catch {
        alert("Import failed. Make sure it is a valid exported JSON file.");
      } finally {
        e.target.value = "";
      }
    });
  }

  // Predictor
  function renderPredictor() {
    const data = getCurrentWeekData();
    const buy = toNum(data.buy);

    const points = [
      "mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm",
      "thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"
    ].map(k => toNum(data[k]));

    const bestVal = Math.max(...points.filter(n => n > 0), 0);
    const bestIdx = points.findIndex(n => n === bestVal);
    const bestLabel = bestIdx >= 0 ? indexToLabel(bestIdx) : "-";

    const profit = (buy > 0 && bestVal > 0) ? (bestVal - buy) : 0;

    const pattern = detectPattern(points);
    const forecast = forecastWindow(pattern);

    drawChart(points);

    const rows = [
      { k: "Buy price", v: buy > 0 ? String(buy) : "-" },
      { k: "Best so far this week", v: bestVal > 0 ? String(bestVal) : "-" },
      { k: "Best day time", v: bestVal > 0 ? bestLabel : "-" },
      { k: "Profit vs buy", v: (buy > 0 && bestVal > 0) ? (profit >= 0 ? `+${profit}` : `${profit}`) : "-" },
      { k: "Likely pattern", v: pattern.name },
      { k: "Pattern note", v: pattern.note },
      { k: "Forecast peak window", v: forecast.window },
      { k: "Forecast confidence", v: forecast.confidence }
    ];

    predictStats.innerHTML = rows.map(r => {
      return `<div class="statRow"><div class="k">${escapeHtml(r.k)}</div><div class="v">${escapeHtml(r.v)}</div></div>`;
    }).join("");
  }

  function drawChart(points) {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext("2d");
    const w = chartCanvas.width;
    const h = chartCanvas.height;

    // clear
    ctx.clearRect(0,0,w,h);

    // background
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(0,0,w,h);

    // subtle grid
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    for (let i=1;i<=4;i++){
      const y = (h*i)/5;
      ctx.beginPath();
      ctx.moveTo(0,y);
      ctx.lineTo(w,y);
      ctx.stroke();
    }

    // AC themed turnip background (bigger again)
    // IMPORTANT: this file name matches what GitHub might keep: "ac-chart.png.PNG"
    const img = new Image();
    img.onload = () => {
      const scaleW = w * 0.60;   // bigger like before
      const scaleH = scaleW * (img.height / img.width);
      const x = (w - scaleW) / 2;
      const y = (h - scaleH) / 2 + 6;

      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.drawImage(img, x, y, scaleW, scaleH);
      ctx.restore();

      drawLineAndDots(points);
    };
    img.onerror = () => {
      drawLineAndDots(points);
    };
    img.src = "ac-chart.png.PNG";
  }

  function drawLineAndDots(points){
    const ctx = chartCanvas.getContext("2d");
    const w = chartCanvas.width;
    const h = chartCanvas.height;

    const vals = points.map(n => (n > 0 ? n : 0));
    const max = Math.max(...vals, 100);
    const min = 0;

    const padX = 24;
    const padY = 22;
    const innerW = w - padX*2;
    const innerH = h - padY*2;

    const step = innerW / (points.length - 1);

    function xy(i){
      const v = vals[i];
      const t = (v - min) / (max - min || 1);
      return {
        x: padX + step*i,
        y: padY + innerH*(1 - t)
      };
    }

    // line
    ctx.strokeStyle = "rgba(20,20,20,0.85)";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i=0;i<points.length;i++){
      const p = xy(i);
      if (i===0) ctx.moveTo(p.x,p.y);
      else ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();

    // dots
    ctx.fillStyle = "rgba(20,20,20,0.85)";
    for (let i=0;i<points.length;i++){
      const p = xy(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5.2, 0, Math.PI*2);
      ctx.fill();
    }
  }

  function detectPattern(points){
    const vals = points.map(n => (n > 0 ? n : 0));
    const filled = vals.filter(v => v > 0);
    if (filled.length < 3){
      return { name: " - ", note: "Add more prices this week and save weeks so the predictor can learn." };
    }

    // simple slope behavior
    let ups = 0, downs = 0;
    for (let i=1;i<vals.length;i++){
      if (vals[i] === 0 || vals[i-1] === 0) continue;
      if (vals[i] > vals[i-1]) ups++;
      if (vals[i] < vals[i-1]) downs++;
    }

    if (downs > ups + 2) return { name: "Decreasing", note: "Looks like it is trending down. Sell as soon as you see profit." };
    if (ups > downs + 2) return { name: "Increasing", note: "Looks like it is building. Watch mid to late week for a spike." };
    return { name: "Mixed", note: "This week is bouncing around. More entries will make the call cleaner." };
  }

  function forecastWindow(pattern){
    if (pattern.name === "Increasing") return { window: "Wed PM to Sat PM", confidence: "65%" };
    if (pattern.name === "Decreasing") return { window: "Mon AM to Tue PM", confidence: "60%" };
    return { window: "Tue PM to Fri PM", confidence: "55%" };
  }

  function summarizeWeek(data){
    const get = (k) => (data && data[k] ? data[k] : "-");
    const buy = data && data.buy ? data.buy : "-";
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
      return `Saved ${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`;
    } catch {
      return "Saved week";
    }
  }

  function cryptoRandomId(){
    const rnd = Math.random().toString(16).slice(2);
    return `w_${Date.now()}_${rnd}`;
  }

  function toNum(v){
    const n = parseInt(String(v || "").replace(/[^\d]/g,""), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function indexToLabel(i){
    const map = ["Mon AM","Mon PM","Tue AM","Tue PM","Wed AM","Wed PM","Thu AM","Thu PM","Fri AM","Fri PM","Sat AM","Sat PM"];
    return map[i] || "-";
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  // Boot
  loadCurrentDraft();
  setActiveTab("entry");
});
