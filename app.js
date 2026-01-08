// app.js
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
  const buyPriceInput = document.getElementById("buy-price");
  const saveWeekBtn = document.getElementById("saveWeekBtn");

  // History
  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");
  const goHomeBtn = document.getElementById("goHomeBtn");

  // Predictor UI
  const priceChart = document.getElementById("priceChart");
  const statBuy = document.getElementById("statBuy");
  const statBest = document.getElementById("statBest");
  const statBestTime = document.getElementById("statBestTime");
  const statProfit = document.getElementById("statProfit");
  const statPattern = document.getElementById("statPattern");
  const statPatternNote = document.getElementById("statPatternNote");
  const statWindow = document.getElementById("statWindow");
  const statConf = document.getElementById("statConf");
  const statWatch = document.getElementById("statWatch");

  const timeLabels = [
    "Mon AM","Mon PM","Tue AM","Tue PM","Wed AM","Wed PM",
    "Thu AM","Thu PM","Fri AM","Fri PM","Sat AM","Sat PM"
  ];

  const ids = [
    "mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm",
    "thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"
  ];

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

  function parseNum(v){
    const n = Number(String(v || "").trim());
    return Number.isFinite(n) ? n : null;
  }

  function getCurrentWeekData(){
    const data = {
      buyPrice: (buyPriceInput && buyPriceInput.value || "").trim(),
      prices: {}
    };

    ids.forEach((id) => {
      const el = document.getElementById(id);
      data.prices[id] = ((el && el.value) || "").trim();
    });

    return data;
  }

  function loadWeekData(data){
    if (!data) return;

    if (buyPriceInput) buyPriceInput.value = data.buyPrice ?? "";

    const p = data.prices || {};
    Object.keys(p).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = p[id] ?? "";
    });
  }

  function clearWeek(){
    if (buyPriceInput) buyPriceInput.value = "";
    document.querySelectorAll(".priceInput").forEach((i) => (i.value = ""));
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
    }catch{}
  }

  // Autosave draft
  if (buyPriceInput) buyPriceInput.addEventListener("input", saveCurrentDraft);
  document.querySelectorAll(".priceInput").forEach((inp) => {
    inp.addEventListener("input", saveCurrentDraft);
  });

  // Save week
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
        setActiveTab("entry");
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
      details.textContent = summarizeWeek(w.data);

      row.appendChild(top);
      row.appendChild(details);
      historyList.appendChild(row);
    });
  }

  // Export
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
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

  // Import
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
  function renderPredictor(){
    const draft = getCurrentWeekData();
    const buy = parseNum(draft.buyPrice);

    const values = ids.map((id) => parseNum(draft.prices[id]));
    const best = maxNum(values);
    const bestIndex = best.index;
    const bestValue = best.value;

    statBuy.textContent = buy == null ? "-" : String(buy);
    statBest.textContent = bestValue == null ? "-" : String(bestValue);
    statBestTime.textContent = bestIndex == null ? "-" : timeLabels[bestIndex];

    if (buy == null || bestValue == null) {
      statProfit.textContent = "-";
    } else {
      const diff = bestValue - buy;
      statProfit.textContent = diff >= 0 ? `+${diff}` : String(diff);
    }

    const pattern = detectPattern(values, buy);
    statPattern.textContent = pattern.name;
    statPatternNote.textContent = pattern.note;

    statWindow.textContent = pattern.window;
    statConf.textContent = pattern.confidence;

    statWatch.textContent = pattern.watch;

    drawChart(priceChart, values);
  }

  function detectPattern(values, buy){
    const nums = values.filter(v => v != null);
    if (nums.length < 2) {
      return {
        name: "-",
        note: "Enter more prices so I can spot the vibe of the week.",
        window: "-",
        confidence: "-",
        watch: "What to watch next will appear as you enter more prices."
      };
    }

    // Simple logic, not the full AC algorithm, just a helpful guide
    const diffs = [];
    for (let i = 1; i < values.length; i++){
      if (values[i] == null || values[i-1] == null) continue;
      diffs.push(values[i] - values[i-1]);
    }

    const drops = diffs.filter(d => d < 0).length;
    const rises = diffs.filter(d => d > 0).length;

    if (drops >= 3 && rises <= 1) {
      return {
        name: "Decreasing",
        note: "Looks like a steady drop so far. Keep an eye out for any surprise bounce.",
        window: "Mon AM to Tue PM",
        confidence: "65%",
        watch: buy == null ? "If it keeps dropping, sell the first time you see a decent spike." : "If it keeps dropping, sell the first time you see profit over buy."
      };
    }

    if (rises >= 3 && drops <= 1) {
      return {
        name: "Small spike",
        note: "Prices are climbing. You might get a nice peak mid week.",
        window: "Wed AM to Thu PM",
        confidence: "70%",
        watch: buy == null ? "Watch for a peak around mid week, then do not get greedy." : "Watch for a peak around mid week, then lock profit."
      };
    }

    return {
      name: "Mixed",
      note: "This week is bouncing around. More entries will make the call cleaner.",
      window: "Tue PM to Fri PM",
      confidence: "55%",
      watch: buy == null ? "If you see a sudden jump, consider selling sooner." : "If you see profit over buy, consider taking it."
    };
  }

  function drawChart(canvas, values){
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0,0,w,h);

    // grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,.10)";
    for (let i = 0; i <= 4; i++){
      const y = 18 + (i * (h - 36) / 4);
      ctx.beginPath();
      ctx.moveTo(14, y);
      ctx.lineTo(w - 14, y);
      ctx.stroke();
    }

    const nums = values.map(v => (v == null ? null : v));
    const valid = nums.filter(v => v != null);
    if (!valid.length) return;

    const min = Math.min(...valid);
    const max = Math.max(...valid);

    const padTop = 18;
    const padBot = 18;
    const padL = 18;
    const padR = 18;

    const xStep = (w - padL - padR) / (nums.length - 1 || 1);
    const yRange = (max - min) || 1;

    const toX = (i) => padL + i * xStep;
    const toY = (v) => padTop + (h - padTop - padBot) * (1 - ((v - min) / yRange));

    // line
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(0,0,0,.75)";

    let started = false;
    ctx.beginPath();
    nums.forEach((v, i) => {
      if (v == null) return;
      const x = toX(i);
      const y = toY(v);
      if (!started) {
        ctx.moveTo(x,y);
        started = true;
      } else {
        ctx.lineTo(x,y);
      }
    });
    ctx.stroke();

    // dots
    ctx.fillStyle = "rgba(0,0,0,.80)";
    nums.forEach((v, i) => {
      if (v == null) return;
      const x = toX(i);
      const y = toY(v);
      ctx.beginPath();
      ctx.arc(x,y,5,0,Math.PI*2);
      ctx.fill();
    });

    // min/max labels
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.font = "900 14px system-ui";
    ctx.fillText(String(max), 14, 16);
    ctx.fillText(String(min), 14, h - 6);
  }

  function maxNum(values){
    let bestVal = null;
    let bestIdx = null;
    values.forEach((v, i) => {
      if (v == null) return;
      if (bestVal == null || v > bestVal){
        bestVal = v;
        bestIdx = i;
      }
    });
    return { value: bestVal, index: bestIdx };
  }

  function summarizeWeek(data){
    const d = data || {};
    const buy = d.buyPrice ? `Buy ${d.buyPrice}` : "Buy -";
    const p = d.prices || {};
    const get = (k) => (p[k] ? p[k] : "-");
    return [
      buy,
      `Mon ${get("mon-am")}/${get("mon-pm")}`,
      `Tue ${get("tue-am")}/${get("tue-pm")}`,
      `Wed ${get("wed-am")}/${get("wed-pm")}`,
      `Thu ${get("thu-am")}/${get("thu-pm")}`,
      `Fri ${get("fri-am")}/${get("fri-pm")}`,
      `Sat ${get("sat-am")}/${get("sat-pm")}`
    ].join(" | ");
  }

  function formatWeekLabel(iso){
    try{
      const d = new Date(iso);
      return `Saved ${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}`;
    }catch{
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
