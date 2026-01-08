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

  // Entry inputs
  const buyInput = document.getElementById("buy-price");
  const saveWeekBtn = document.getElementById("saveWeekBtn");

  // History UI
  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");

  // Predict UI
  const chartCanvas = document.getElementById("chartCanvas");
  const predictStats = document.getElementById("predictStats");

  const SLOT_IDS = [
    "mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm",
    "thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"
  ];

  const SLOT_LABELS = [
    "Mon AM","Mon PM","Tue AM","Tue PM","Wed AM","Wed PM",
    "Thu AM","Thu PM","Fri AM","Fri PM","Sat AM","Sat PM"
  ];

  // --- Safety checks
  if (!entryView || !predictView || !historyView) {
    console.log("Missing one of the views in HTML.");
    return;
  }
  if (!navEntry || !navPredict || !navHistory) {
    console.log("Missing bottom nav buttons. Check ids navEntry/navPredict/navHistory.");
    return;
  }
  if (!buyInput || !saveWeekBtn) {
    console.log("Missing buy-price input or saveWeekBtn.");
    return;
  }
  if (!historyList || !historyEmptyNote) {
    console.log("Missing historyList or historyEmptyNote.");
    return;
  }
  if (!chartCanvas || !predictStats) {
    console.log("Missing chartCanvas or predictStats.");
    return;
  }

  // --- Tab navigation
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

  // --- Storage helpers
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

  // Auto-save on input
  buyInput.addEventListener("input", saveDraftNow);
  document.querySelectorAll(".priceInput").forEach(inp => {
    inp.addEventListener("input", saveDraftNow);
  });

  // Save week
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

  // --- History
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
        const map = new Map(existing.map(w => [w.id, w]));

        weeks.forEach(w => {
          if (w && w.id && (w.prices || w.data)) {
            // allow older format field "data"
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

  // --- Predictor
  function renderPredictor(){
    const draft = readEntryData();
    const buy = toNum(draft.buyPrice);

    const values = SLOT_IDS.map(id => toNum(draft.prices[id]));
    drawChart(values);

    const best = bestSoFar(values);
    const bestLabel = best.index >= 0 ? SLOT_LABELS[best.index] : "-";

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

  // Simple cozy pattern detector (v1)
  function detectPattern(values){
    const known = values.filter(v => v > 0);
    if (known.length < 3){
      return {
        name: "Mixed",
        note: "Not enough notes yet. Add a few prices and the guess gets smarter."
      };
    }

    // rough slope checks
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
      return {
        name: "Decreasing",
        note: "Looks like a steady slide. If you see a profit moment, do not overthink it."
      };
    }

    if (rises >= drops + 2){
      return {
        name: "Increasing",
        note: "Nice upward vibe. Keep logging, mid to late week could get spicy."
      };
    }

    return {
      name: "Mixed",
      note: "This week is bouncing around. More entries will make the call cleaner."
    };
  }

  function forecastWindow(pattern){
    if (pattern.name === "Increasing"){
      return {
        window: "Wed PM to Sat PM",
        confidence: "70%",
        watch: "Keep an eye on late week, that is where the best bells usually show up."
      };
    }
    if (pattern.name === "Decreasing"){
      return {
        window: "Mon AM to Tue PM",
        confidence: "65%",
        watch: "If it keeps dropping, sell the first time you see profit over buy."
      };
    }
    return {
      window: "Tue PM to Fri PM",
      confidence: "55%",
      watch: "If you see a random jump, that might be your moment. Log each slot to tighten it up."
    };
  }

  // Chart drawing (cozy)
  function drawChart(values){
    const ctx = chartCanvas.getContext("2d");
    const W = chartCanvas.width;
    const H = chartCanvas.height;

    // clear
    ctx.clearRect(0,0,W,H);

    // background
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    roundRect(ctx, 0, 0, W, H, 20, true, false);

    // grid
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 2;
    for (let i=1; i<=4; i++){
      const y = (H/5)*i;
      ctx.beginPath();
      ctx.moveTo(26, y);
      ctx.lineTo(W-26, y);
      ctx.stroke();
    }

    // watermark (bigger again)
    const img = new Image();
    img.onload = () => {
      const targetW = Math.min(W * 0.38, 300);
      const ratio = img.height / img.width;
      const targetH = targetW * ratio;

      const x = (W - targetW) / 2;
      const y = (H - targetH) / 2 - 8;

      ctx.globalAlpha = 0.22;
      ctx.drawImage(img, x, y, targetW, targetH);
      ctx.globalAlpha = 1;

      // after watermark, draw data
      drawLine(values);
    };
    img.onerror = () => {
      // still draw line if image missing
      drawLine(values);
    };

    // IMPORTANT: this matches your renamed GitHub file
    img.src = "ac-chart.png.PNG";

    function drawLine(vals){
      const maxVal = Math.max(200, ...vals.filter(v => v>0), 1);
      const minVal = 0;

      const left = 30;
      const right = W - 30;
      const top = 22;
      const bottom = H - 22;

      const stepX = (right - left) / (vals.length - 1);

      // baseline dots and line
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // path
      ctx.beginPath();
      let started = false;

      vals.forEach((v, i) => {
        const x = left + stepX * i;
        const y = v > 0
          ? map(v, minVal, maxVal, bottom, top)
          : bottom;

        if (!started){
          ctx.moveTo(x,y);
          started = true;
        } else {
          ctx.lineTo(x,y);
        }
      });
      ctx.stroke();

      // dots
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      vals.forEach((v, i) => {
        const x = left + stepX * i;
        const y = v > 0
          ? map(v, minVal, maxVal, bottom, top)
          : bottom;

        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI*2);
        ctx.fill();
      });
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

  // --- Boot
  loadEntryData(getCurrentDraft());
  setActiveTab("entry");
});
