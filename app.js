document.addEventListener("DOMContentLoaded", () => {
  const KEYS = {
    weeks: "turnipTracker_weeks_v2",
    current: "turnipTracker_current_v2"
  };

  // Views
  const entryView = document.getElementById("entryView");
  const predictView = document.getElementById("predictView");
  const historyView = document.getElementById("historyView");

  // Nav
  const navEntry = document.getElementById("navEntry");
  const navPredict = document.getElementById("navPredict");
  const navHistory = document.getElementById("navHistory");

  // Buttons
  const saveWeekBtn = document.getElementById("saveWeekBtn");

  // Inputs
  const buyInput = document.getElementById("buy-price");
  const buyHintEl = document.getElementById("buyHint");
  const priceInputs = Array.from(document.querySelectorAll(".priceInput"));

  // History UI
  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");

  // Predict UI
  const chartCanvas = document.getElementById("chartCanvas");
  const statBuy = document.getElementById("statBuy");
  const statBest = document.getElementById("statBest");
  const statBestTime = document.getElementById("statBestTime");
  const statProfit = document.getElementById("statProfit");
  const statPattern = document.getElementById("statPattern");
  const statNote = document.getElementById("statNote");

  const SLOT_IDS = [
    "mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm",
    "thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"
  ];

  const SLOT_LABELS = [
    "Mon AM","Mon PM","Tue AM","Tue PM","Wed AM","Wed PM",
    "Thu AM","Thu PM","Fri AM","Fri PM","Sat AM","Sat PM"
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

    if (isPredict) renderPredict();
    if (isHistory) renderHistory();
  }

  navEntry.addEventListener("click", () => setActiveTab("entry"));
  navPredict.addEventListener("click", () => setActiveTab("predict"));
  navHistory.addEventListener("click", () => setActiveTab("history"));

  function getWeeks(){
    try { return JSON.parse(localStorage.getItem(KEYS.weeks) || "[]"); }
    catch { return []; }
  }

  function setWeeks(weeks){
    localStorage.setItem(KEYS.weeks, JSON.stringify(weeks));
  }

  function getCurrentWeekData(){
    const data = { buy: (buyInput?.value || "").trim(), slots: {} };
    SLOT_IDS.forEach(id => {
      const el = document.getElementById(id);
      data.slots[id] = ((el && el.value) || "").trim();
    });
    return data;
  }

  function loadWeekData(data){
    if (buyInput) buyInput.value = (data && data.buy) ? data.buy : "";
    const slots = (data && data.slots) ? data.slots : {};
    Object.keys(slots).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = slots[id] ?? "";
    });
  }

  function clearWeek(){
    if (buyInput) buyInput.value = "";
    priceInputs.forEach(i => i.value = "");
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

  // Autosave
  if (buyInput) buyInput.addEventListener("input", saveCurrentDraft);
  priceInputs.forEach(inp => inp.addEventListener("input", saveCurrentDraft));

  // Save week
  saveWeekBtn.addEventListener("click", () => {
    const payload = getCurrentWeekData();

    const week = {
      id: cryptoRandomId(),
      savedAt: new Date().toISOString(),
      data: payload
    };

    const weeks = getWeeks();
    weeks.unshift(week);
    setWeeks(weeks);

    clearWeek();
    setActiveTab("history");
  });

  // History render
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
        loadWeekData(normalizeWeekData(w.data));
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

  // Export / Import
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

  function normalizeWeekData(d){
    if (!d) return { buy:"", slots:{} };
    if (d.slots) return { buy: d.buy || "", slots: d.slots || {} };

    const slots = {};
    SLOT_IDS.forEach(id => { slots[id] = (d[id] || "").toString(); });
    return { buy: d["buy-price"] || d.buy || "", slots };
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

        weeks.forEach(w => {
          if (!w || !w.id) return;
          map.set(w.id, {
            id: w.id,
            savedAt: w.savedAt || new Date().toISOString(),
            data: normalizeWeekData(w.data)
          });
        });

        const merged = Array.from(map.values()).sort((a,b) =>
          (b.savedAt || "").localeCompare(a.savedAt || "")
        );

        setWeeks(merged);
        renderHistory();
      } catch {
        alert("Import failed. Make sure it is a valid exported JSON file.");
      } finally {
        e.target.value = "";
      }
    });
  }

  // Predictor
  function renderPredict(){
    const current = getCurrentWeekData();
    const series = SLOT_IDS.map((id) => toNumber(current.slots[id]));
    const buy = toNumber(current.buy);

    statBuy.textContent = isFinite(buy) ? String(buy) : "-";

    let bestVal = -Infinity;
    let bestIdx = -1;
    series.forEach((v, i) => {
      if (isFinite(v) && v > bestVal){
        bestVal = v;
        bestIdx = i;
      }
    });

    statBest.textContent = bestIdx >= 0 ? String(bestVal) : "-";
    statBestTime.textContent = bestIdx >= 0 ? SLOT_LABELS[bestIdx] : "-";

    if (isFinite(buy) && bestIdx >= 0){
      const diff = bestVal - buy;
      statProfit.textContent = diff >= 0 ? `+${diff}` : String(diff);
    } else {
      statProfit.textContent = "-";
    }

    const pattern = detectPattern(series);
    statPattern.textContent = pattern.name;
    statNote.textContent = pattern.note;

    drawPostcardChart(series);
  }

  function drawPostcardChart(series){
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext("2d");
    const w = chartCanvas.width;
    const h = chartCanvas.height;

    ctx.clearRect(0,0,w,h);

    roundRect(ctx, 0, 0, w, h, 18);
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    for (let i=1;i<=4;i++){
      const y = 24 + i * ((h-70)/5);
      ctx.beginPath();
      ctx.moveTo(18, y);
      ctx.lineTo(w-18, y);
      ctx.stroke();
    }

    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.font = "140px system-ui";
    ctx.fillText("🥬", w*0.42, h*0.62);
    ctx.restore();

    const left = 28;
    const right = w - 28;
    const top = 18;
    const bottom = h - 46;

    const vals = series.filter(v => isFinite(v));
    const minV = vals.length ? Math.min(...vals) : 0;
    const maxV = vals.length ? Math.max(...vals) : 100;

    const pad = 10;
    const lo = minV - pad;
    const hi = maxV + pad;

    const xStep = (right - left) / (series.length - 1);

    function yOf(v){
      const t = (v - lo) / (hi - lo || 1);
      return bottom - t * (bottom - top);
    }

    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let started = false;
    ctx.beginPath();
    series.forEach((v, i) => {
      if (!isFinite(v)) return;
      const x = left + i * xStep;
      const y = yOf(v);
      if (!started){
        ctx.moveTo(x,y);
        started = true;
      } else {
        ctx.lineTo(x,y);
      }
    });
    if (started) ctx.stroke();

    series.forEach((v, i) => {
      const x = left + i * xStep;
      const isAM = (i % 2 === 0);
      const bell = isAM ? "🔔" : "🛎️";
      const y = isFinite(v) ? yOf(v) : bottom;

      ctx.font = "22px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bell, x, y);
    });

    const dayLabels = ["Mon","Tue","Wed","Thu","Fri","Sat"];
    ctx.fillStyle = "rgba(0,0,0,0.60)";
    ctx.font = "14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let d=0; d<6; d++){
      const idx = d*2;
      const x = left + idx * xStep;
      ctx.fillText(dayLabels[d], x, bottom + 16);
    }
  }

  function detectPattern(series){
    const vals = series.map(v => (isFinite(v) ? v : null));
    const filled = vals.filter(v => v !== null);

    if (filled.length < 3){
      return { name: "Mixed", note: "Log a few more entries, and it’ll feel smarter." };
    }

    let drops = 0, rises = 0;
    for (let i=1;i<vals.length;i++){
      if (vals[i] === null || vals[i-1] === null) continue;
      if (vals[i] > vals[i-1]) rises++;
      if (vals[i] < vals[i-1]) drops++;
    }

    if (drops >= rises + 3){
      return { name: "Decreasing", note: "Looks like a slow slide. If you see a nice bump, grab it." };
    }
    if (rises >= drops + 3){
      return { name: "Increasing", note: "It’s feeling upward. Keep logging, you might catch a sweet peak." };
    }

    return { name: "Mixed", note: "A bit of everything. More entries will sharpen the call." };
  }

  function summarizeWeek(dataRaw){
    const data = normalizeWeekData(dataRaw);
    const buy = data.buy ? `Buy ${data.buy}` : "Buy -";
    const get = (k) => (data.slots && data.slots[k] ? data.slots[k] : "-");

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
      return `Saved ${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`;
    } catch {
      return "Saved week";
    }
  }

  function cryptoRandomId(){
    const rnd = Math.random().toString(16).slice(2);
    return `w_${Date.now()}_${rnd}`;
  }

  function toNumber(v){
    if (v === null || v === undefined) return NaN;
    const s = String(v).replace(/[^\d.]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function roundRect(ctx, x, y, w, h, r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  // Sunday date caption (uses phone locale)
  function getMostRecentSunday(now){
    const d = new Date(now);
    d.setHours(0,0,0,0);
    const day = d.getDay(); // 0 = Sunday
    d.setDate(d.getDate() - day);
    return d;
  }

  function updateBuyHint(){
    if (!buyHintEl) return;
    const sunday = getMostRecentSunday(new Date());
    const formatted = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric"
    }).format(sunday);

    buyHintEl.textContent = `${formatted}.`;
  }

  function startSundayRefresh(){
    updateBuyHint();

    let lastKey = new Date().toDateString();
    setInterval(() => {
      const nowKey = new Date().toDateString();
      if (nowKey !== lastKey){
        lastKey = nowKey;
        updateBuyHint();
      }
    }, 60 * 1000);
  }

  // Boot
  loadCurrentDraft();
  startSundayRefresh();
  setActiveTab("entry");
});
