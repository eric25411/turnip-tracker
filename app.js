(() => {
  const KEYS = {
    weeks: "turnipTracker_weeks_v1",
    current: "turnipTracker_current_v1",
    buy: "turnipTracker_buy_v1"
  };

  // Views
  const entryView = document.getElementById("entryView");
  const predictView = document.getElementById("predictView");
  const historyView = document.getElementById("historyView");

  // Nav
  const navEntry = document.getElementById("navEntry");
  const navPredict = document.getElementById("navPredict");
  const navHistory = document.getElementById("navHistory");

  // Entry
  const buyPriceEl = document.getElementById("buyPrice");
  const buyCaptionEl = document.getElementById("buyCaption");
  const saveWeekBtn = document.getElementById("saveWeekBtn");

  // History
  const historyList = document.getElementById("historyList");
  const historyEmptyNote = document.getElementById("historyEmptyNote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");

  // Predict
  const statBuy = document.getElementById("statBuy");
  const statBest = document.getElementById("statBest");
  const statBestTime = document.getElementById("statBestTime");
  const statProfit = document.getElementById("statProfit");
  const chart = document.getElementById("chart");

  const PRICE_IDS = [
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

    if (isPredict) renderPredict();
    if (isHistory) renderHistory();
  }

  // ---------- Date label: "Daisy Mae, Sunday Jan 4" ----------
  function mostRecentSunday(d = new Date()){
    const x = new Date(d);
    x.setHours(0,0,0,0);
    const day = x.getDay(); // 0 Sunday
    x.setDate(x.getDate() - day);
    return x;
  }

  function setBuyCaption(){
    const sun = mostRecentSunday(new Date());
    const parts = sun.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    // parts often returns "Sunday, Jan 4" or similar, we keep it cozy:
    const cleaned = parts.replace(",", "");
    buyCaptionEl.textContent = `Daisy Mae, ${cleaned}`;
  }

  // ---------- Storage ----------
  function getWeeks(){
    try { return JSON.parse(localStorage.getItem(KEYS.weeks) || "[]"); }
    catch { return []; }
  }
  function setWeeks(weeks){
    localStorage.setItem(KEYS.weeks, JSON.stringify(weeks));
  }

  function getBuy(){
    try { return (localStorage.getItem(KEYS.buy) || "").trim(); }
    catch { return ""; }
  }
  function setBuy(v){
    localStorage.setItem(KEYS.buy, (v || "").trim());
  }

  function getCurrentWeekData(){
    const data = {};
    PRICE_IDS.forEach(id => {
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

  function saveCurrentDraft(){
    const draft = { prices: getCurrentWeekData() };
    localStorage.setItem(KEYS.current, JSON.stringify(draft));
  }

  function loadCurrentDraft(){
    try{
      const raw = localStorage.getItem(KEYS.current);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && draft.prices) loadWeekData(draft.prices);
    } catch {}
  }

  function clearWeek(){
    document.querySelectorAll(".priceInput").forEach(i => i.value = "");
    localStorage.removeItem(KEYS.current);
  }

  function cryptoRandomId(){
    const rnd = Math.random().toString(16).slice(2);
    return `w_${Date.now()}_${rnd}`;
  }

  // ---------- Entry events ----------
  document.querySelectorAll(".priceInput").forEach(inp => {
    inp.addEventListener("input", () => {
      saveCurrentDraft();
    });
  });

  if (buyPriceEl){
    buyPriceEl.addEventListener("input", () => {
      setBuy(buyPriceEl.value);
    });
  }

  saveWeekBtn.addEventListener("click", () => {
    const week = {
      id: cryptoRandomId(),
      savedAt: new Date().toISOString(),
      buy: getBuy(),
      data: getCurrentWeekData()
    };

    const weeks = getWeeks();
    weeks.unshift(week);
    setWeeks(weeks);

    clearWeek();
    // keep buy price, since Daisy Mae buy stays relevant
    setActiveTab("history");
  });

  // ---------- History ----------
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
      const date = d.toLocaleDateString();
      const time = d.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
      return `Saved ${date} ${time}`;
    } catch {
      return "Saved week";
    }
  }

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
        loadWeekData(w.data);
        saveCurrentDraft();
        if (w.buy != null) {
          buyPriceEl.value = w.buy || "";
          setBuy(w.buy || "");
        }
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

  // ---------- Predict ----------
  function parseNum(s){
    const n = Number(String(s || "").trim());
    return Number.isFinite(n) ? n : null;
  }

  function labelForIndex(i){
    const dayNames = ["Mon","Mon","Tue","Tue","Wed","Wed","Thu","Thu","Fri","Fri","Sat","Sat"];
    const ampm = ["AM","PM","AM","PM","AM","PM","AM","PM","AM","PM","AM","PM"];
    return `${dayNames[i]} ${ampm[i]}`;
  }

  function renderPredict(){
    const buy = parseNum(getBuy());
    const data = getCurrentWeekData();

    let best = null;
    let bestIdx = null;

    const points = PRICE_IDS.map((id, idx) => {
      const n = parseNum(data[id]);
      if (n != null){
        if (best == null || n > best){
          best = n;
          bestIdx = idx;
        }
      }
      return n;
    });

    // Stats
    statBuy.textContent = buy != null ? String(buy) : "-";
    statBest.textContent = best != null ? String(best) : "-";
    statBestTime.textContent = bestIdx != null ? labelForIndex(bestIdx) : "-";

    if (buy != null && best != null){
      const diff = best - buy;
      statProfit.textContent = (diff >= 0 ? `+${diff}` : `${diff}`);
    } else {
      statProfit.textContent = "-";
    }

    drawChart(points);
  }

  function drawChart(points){
    if (!chart) return;
    const ctx = chart.getContext("2d");
    const w = chart.width;
    const h = chart.height;

    ctx.clearRect(0,0,w,h);

    // chart area
    const padL = 40;
    const padR = 20;
    const padT = 24;
    const padB = 54;

    const x0 = padL;
    const x1 = w - padR;
    const y0 = padT;
    const y1 = h - padB;

    // grid lines (cozy light)
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 2;
    for (let i=0;i<4;i++){
      const y = y0 + (i*(y1-y0)/3);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
    }

    // Determine scale
    const nums = points.filter(v => v != null);
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 100;
    const span = Math.max(10, max - min);

    const xStep = (x1 - x0) / (points.length - 1);

    function xFor(i){ return x0 + i * xStep; }
    function yFor(v){
      if (v == null) return y1;
      const t = (v - min) / span;
      return y1 - t*(y1-y0);
    }

    // Line
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let started = false;
    ctx.beginPath();
    points.forEach((v,i) => {
      if (v == null){
        started = false;
        return;
      }
      const x = xFor(i);
      const y = yFor(v);
      if (!started){
        ctx.moveTo(x,y);
        started = true;
      } else {
        ctx.lineTo(x,y);
      }
    });
    ctx.stroke();

    // Bell dots (AM and PM alternate subtly by size)
    points.forEach((v,i) => {
      const x = xFor(i);
      const y = yFor(v == null ? min : v);

      const isAM = (i % 2 === 0);
      const r = isAM ? 8 : 6;

      ctx.fillStyle = "rgba(0,0,0,0.60)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI*2);
      ctx.fill();
    });

    // Day labels (Mon..Sat) along bottom
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "700 20px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.textAlign = "center";

    const dayAt = [0,2,4,6,8,10];
    const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat"];
    dayAt.forEach((idx, j) => {
      const x = xFor(idx + 0.5); // between AM/PM
      ctx.fillText(dayNames[j], x, h - 20);
    });
  }

  // ---------- Nav wiring ----------
  navEntry.addEventListener("click", () => setActiveTab("entry"));
  navPredict.addEventListener("click", () => setActiveTab("predict"));
  navHistory.addEventListener("click", () => setActiveTab("history"));

  // ---------- Boot ----------
  setBuyCaption();
  buyPriceEl.value = getBuy();
  loadCurrentDraft();
  setActiveTab("entry");

  // Update caption if the day flips while app is open
  setInterval(setBuyCaption, 60 * 1000);
})();
