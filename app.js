document.addEventListener("DOMContentLoaded", () => {
  const KEYS = {
    weeks: "turnipTracker_weeks_v2",
    current: "turnipTracker_current_v2"
  };

  const entryView = document.getElementById("entryView");
  const predictView = document.getElementById("predictView");
  const historyView = document.getElementById("historyView");

  const navEntry = document.getElementById("navEntry");
  const navPredict = document.getElementById("navPredict");
  const navHistory = document.getElementById("navHistory");

  const buyInput = document.getElementById("buy-price");
  const saveWeekBtn = document.getElementById("saveWeekBtn");

  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");

  const chartCanvas = document.getElementById("chartCanvas");
  const predictStats = document.getElementById("predictStats");

  const SLOT_IDS = [
    "mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm",
    "thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"
  ];

  const DAY_NAMES = ["Mon","Tue","Wed","Thu","Fri","Sat"];

  if (!entryView || !predictView || !historyView) return;
  if (!navEntry || !navPredict || !navHistory) return;
  if (!buyInput || !saveWeekBtn) return;
  if (!historyList || !historyEmptyNote) return;
  if (!chartCanvas || !predictStats) return;

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

  function getWeeks(){
    try { return JSON.parse(localStorage.getItem(KEYS.weeks) || "[]"); }
    catch { return []; }
  }

  function setWeeks(weeks){
    localStorage.setItem(KEYS.weeks, JSON.stringify(weeks));
  }

  function getCurrentDraft(){
    try { return JSON.parse(localStorage.getItem(KEYS.current) || "{}"); }
    catch { return {}; }
  }

  function setCurrentDraft(draft){
    localStorage.setItem(KEYS.current, JSON.stringify(draft));
  }

  function readEntryData(){
    const prices = {};
    SLOT_IDS.forEach(id => {
      const el = document.getElementById(id);
      prices[id] = ((el && el.value) || "").trim();
    });

    return {
      buyPrice: (buyInput.value || "").trim(),
      prices
    };
  }

  function loadEntryData(d){
    const data = d || {};
    buyInput.value = data.buyPrice ?? "";

    const prices = data.prices || {};
    SLOT_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = prices[id] ?? "";
    });
  }

  function clearEntry(){
    buyInput.value = "";
    SLOT_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    localStorage.removeItem(KEYS.current);
  }

  function saveDraftNow(){
    setCurrentDraft(readEntryData());
  }

  buyInput.addEventListener("input", saveDraftNow);
  document.querySelectorAll(".priceInput").forEach(inp => {
    inp.addEventListener("input", saveDraftNow);
  });

  saveWeekBtn.addEventListener("click", () => {
    const draft = readEntryData();

    const week = {
      id: randomId(),
      savedAt: new Date().toISOString(),
      buyPrice: draft.buyPrice || "",
      prices: draft.prices || {}
    };

    const weeks = getWeeks();
    weeks.unshift(week);
    setWeeks(weeks);

    clearEntry();
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
        loadEntryData({ buyPrice: w.buyPrice || "", prices: w.prices || {} });
        saveDraftNow();
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
      details.textContent = summarizeWeek(w);

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
          if (w && w.id && (w.prices || w.data)) {
            const normalized = {
              id: w.id,
              savedAt: w.savedAt || new Date().toISOString(),
              buyPrice: w.buyPrice || "",
              prices: w.prices || w.data || {}
            };
            map.set(w.id, normalized);
          }
        });

        const merged = Array.from(map.values()).sort((a,b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
        setWeeks(merged);
        renderHistory();
      } catch {
        alert("Import failed. Make sure it is a valid exported JSON file.");
      } finally {
        e.target.value = "";
      }
    });
  }

  function summarizeWeek(w){
    const prices = w.prices || {};
    const get = (k) => (prices[k] ? prices[k] : "-");
    const buy = w.buyPrice ? `Buy ${w.buyPrice}` : "Buy -";

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

  function randomId(){
    const rnd = Math.random().toString(16).slice(2);
    return `w_${Date.now()}_${rnd}`;
  }

  function renderPredictor(){
    const draft = readEntryData();
    const buy = toNum(draft.buyPrice);

    const values = SLOT_IDS.map(id => toNum(draft.prices[id]));
    drawChart(values);

    const best = bestSoFar(values);
    const bestLabel = best.index >= 0 ? slotLabel(best.index) : "-";

    const profit = (buy > 0 && best.value > 0) ? (best.value - buy) : null;

    const pattern = detectPattern(values);
    const forecast = forecastWindow(pattern);

    predictStats.innerHTML = "";
    predictStats.appendChild(statRow("Daisy Mae buy price", buy > 0 ? `${buy}` : "-"));
    predictStats.appendChild(statRow("Best price seen", best.value > 0 ? `${best.value}` : "-"));
    predictStats.appendChild(statRow("Best time so far", bestLabel));
    predictStats.appendChild(statRow("Profit vs buy", profit === null ? "-" : formatSigned(profit)));

    predictStats.appendChild(statRow("Likely pattern", pattern.name));
    const note = document.createElement("div");
    note.className = "noteBox";
    note.textContent = pattern.note;
    predictStats.appendChild(note);

    predictStats.appendChild(statRow("Forecast peak window", forecast.window));
    predictStats.appendChild(statRow("Forecast confidence", forecast.confidence));

    const watch = document.createElement("div");
    watch.className = "noteBox";
    watch.textContent = forecast.watch;
    predictStats.appendChild(watch);
  }

  function slotLabel(i){
    const day = DAY_NAMES[Math.floor(i / 2)] || "";
    const half = (i % 2 === 0) ? "AM" : "PM";
    return `${day} ${half}`;
  }

  function statRow(k, v){
    const row = document.createElement("div");
    row.className = "statRow";

    const key = document.createElement("div");
    key.className = "statKey";
    key.textContent = k;

    const val = document.createElement("div");
    val.className = "statVal";
    val.textContent = v;

    row.appendChild(key);
    row.appendChild(val);
    return row;
  }

  function toNum(x){
    const n = parseInt(String(x || "").replace(/[^\d]/g,""), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function bestSoFar(values){
    let best = { value: 0, index: -1 };
    values.forEach((v, i) => {
      if (v > best.value) best = { value: v, index: i };
    });
    return best;
  }

  function formatSigned(n){
    if (n === 0) return "+0";
    return n > 0 ? `+${n}` : `${n}`;
  }

  function detectPattern(values){
    const known = values.filter(v => v > 0);
    if (known.length < 3){
      return { name: "Mixed", note: "Not enough notes yet. Add a few prices and the guess gets smarter." };
    }

    let drops = 0;
    let rises = 0;
    for (let i=1; i<values.length; i++){
      const a = values[i-1], b = values[i];
      if (a>0 && b>0){
        if (b < a) drops++;
        if (b > a) rises++;
      }
    }

    if (drops >= rises + 2){
      return { name: "Decreasing", note: "Looks like a steady slide. If you see a profit moment, do not overthink it." };
    }

    if (rises >= drops + 2){
      return { name: "Increasing", note: "Nice upward vibe. Keep logging, mid to late week could get spicy." };
    }

    return { name: "Mixed", note: "This week is bouncing around. More entries will make the call cleaner." };
  }

  function forecastWindow(pattern){
    if (pattern.name === "Increasing"){
      return { window: "Wed PM to Sat PM", confidence: "70%", watch: "Keep an eye on late week, that is where the best bells usually show up." };
    }
    if (pattern.name === "Decreasing"){
      return { window: "Mon AM to Tue PM", confidence: "65%", watch: "If it keeps dropping, sell the first time you see profit over buy." };
    }
    return { window: "Tue PM to Fri PM", confidence: "55%", watch: "If you see a random jump, that might be your moment. Log each slot to tighten it up." };
  }

  // Chart with bell dots + non scrolling day labels
  function drawChart(values){
    const ctx = chartCanvas.getContext("2d");
    const W = chartCanvas.width;
    const H = chartCanvas.height;

    ctx.clearRect(0,0,W,H);

    // background
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    roundRect(ctx, 0, 0, W, H, 20, true, false);

    // plot area
    const left = 34;
    const right = W - 34;
    const top = 22;
    const bottom = H - 64; // leave room for day labels

    // grid
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 2;
    for (let i=1; i<=4; i++){
      const y = top + ((bottom - top)/5)*i;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }

    // watermark (still bigger)
    const img = new Image();
    img.onload = () => {
      const targetW = Math.min(W * 0.40, 320);
      const ratio = img.height / img.width;
      const targetH = targetW * ratio;

      const x = (W - targetW) / 2;
      const y = (top + bottom - targetH) / 2 - 6;

      ctx.globalAlpha = 0.22;
      ctx.drawImage(img, x, y, targetW, targetH);
      ctx.globalAlpha = 1;

      drawLineAndBells();
      drawDayLabels();
    };
    img.onerror = () => {
      drawLineAndBells();
      drawDayLabels();
    };

    img.src = "ac-chart.png.PNG";

    function drawLineAndBells(){
      const maxVal = Math.max(200, ...values.filter(v => v>0), 1);
      const minVal = 0;
      const stepX = (right - left) / (values.length - 1);

      // line
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      values.forEach((v, i) => {
        const x = left + stepX * i;
        const y = v > 0 ? map(v, minVal, maxVal, bottom, top) : bottom;
        if (i === 0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      });
      ctx.stroke();

      // bell dots
      ctx.font = "22px system-ui, Apple Color Emoji, Segoe UI Emoji";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      values.forEach((v, i) => {
        const x = left + stepX * i;
        const y = v > 0 ? map(v, minVal, maxVal, bottom, top) : bottom;

        // little shadow so bells pop on light bg
        ctx.globalAlpha = 0.22;
        ctx.fillText("🔔", x + 1, y + 2);
        ctx.globalAlpha = 1;

        ctx.fillText("🔔", x, y);
      });
    }

    function drawDayLabels(){
      // 6 labels centered between each AM/PM pair
      ctx.fillStyle = "rgba(0,0,0,0.70)";
      ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";

      const stepX = (right - left) / (values.length - 1);
      const labelY = H - 26;

      for (let d=0; d<6; d++){
        const iAM = d * 2;
        const iPM = d * 2 + 1;
        const xAM = left + stepX * iAM;
        const xPM = left + stepX * iPM;
        const xMid = (xAM + xPM) / 2;

        ctx.fillText(DAY_NAMES[d], xMid, labelY);
      }
    }

    function map(v, inMin, inMax, outMin, outMax){
      const t = (v - inMin) / (inMax - inMin);
      return outMin + (outMax - outMin) * t;
    }

    function roundRect(ctx, x, y, w, h, r, fill, stroke){
      if (typeof r === "number") r = {tl:r,tr:r,br:r,bl:r};
      ctx.beginPath();
      ctx.moveTo(x+r.tl, y);
      ctx.lineTo(x+w-r.tr, y);
      ctx.quadraticCurveTo(x+w, y, x+w, y+r.tr);
      ctx.lineTo(x+w, y+h-r.br);
      ctx.quadraticCurveTo(x+w, y+h, x+w-r.br, y+h);
      ctx.lineTo(x+r.bl, y+h);
      ctx.quadraticCurveTo(x, y+h, x, y+h-r.bl);
      ctx.lineTo(x, y+r.tl);
      ctx.quadraticCurveTo(x, y, x+r.tl, y);
      ctx.closePath();
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
    }
  }

  // Boot
  loadEntryData(getCurrentDraft());
  setActiveTab("entry");
});
