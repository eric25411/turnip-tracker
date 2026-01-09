(() => {
  const LS_WEEK = "tt_week_v1";
  const LS_HISTORY = "tt_history_v1";
  const LS_PATTERN = "tt_pattern_opacity_v1";

  const PAGES = ["entry", "insights", "settings"];
  const dayNames = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const slots = ["AM", "PM"];

  const els = {
    buyDateLabel: document.getElementById("buyDateLabel"),
    buyPrice: document.getElementById("buyPrice"),
    daysContainer: document.getElementById("daysContainer"),
    saveWeekBtn: document.getElementById("saveWeekBtn"),

    pageEntry: document.getElementById("page-entry"),
    pageInsights: document.getElementById("page-insights"),
    pageSettings: document.getElementById("page-settings"),

    chartDots: document.getElementById("chartDots"),
    chartIcons: document.getElementById("chartIcons"),
    statsBlock: document.getElementById("statsBlock"),
    historyList: document.getElementById("historyList"),

    patternStrength: document.getElementById("patternStrength"),
    resetWeekBtn: document.getElementById("resetWeekBtn"),
    clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  };

  function pad2(n){ return String(n).padStart(2,"0"); }

  function getSundayDateLabel(d = new Date()){
    // Sunday of THIS week in the device locale
    const x = new Date(d);
    const day = x.getDay(); // 0=Sun
    x.setDate(x.getDate() - day); // back to Sunday
    const opts = { month:"short", day:"numeric" };
    return x.toLocaleDateString(undefined, opts);
  }

  function defaultWeek(){
    // 12 slots: Mon AM..Sat PM
    const data = {
      buy: "",
      values: Array.from({length: 12}, () => "")
    };
    return data;
  }

  function loadWeek(){
    try{
      const raw = localStorage.getItem(LS_WEEK);
      if(!raw) return defaultWeek();
      const parsed = JSON.parse(raw);
      if(!parsed || !Array.isArray(parsed.values) || parsed.values.length !== 12) return defaultWeek();
      return parsed;
    } catch {
      return defaultWeek();
    }
  }

  function saveWeekData(week){
    localStorage.setItem(LS_WEEK, JSON.stringify(week));
  }

  function clearEntry(){
    const week = defaultWeek();
    saveWeekData(week);
    renderEntry();
    renderInsights();
  }

  function loadHistory(){
    try{
      const raw = localStorage.getItem(LS_HISTORY);
      if(!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory(list){
    localStorage.setItem(LS_HISTORY, JSON.stringify(list));
  }

  function setActivePage(name){
    for(const p of PAGES){
      document.getElementById(`page-${p}`).classList.toggle("is-active", p === name);
    }
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.go === name);
    });

    if(name === "insights") renderInsights();
    if(name === "settings") renderSettings();
  }

  function indexFor(dayIdx, slotIdx){
    // dayIdx: 0..5, slotIdx: 0..1
    return dayIdx*2 + slotIdx;
  }

  function renderEntry(){
    els.buyDateLabel.textContent = getSundayDateLabel();
    const week = loadWeek();
    els.buyPrice.value = week.buy || "";

    // build day cards
    els.daysContainer.innerHTML = "";
    dayNames.forEach((day, d) => {
      const card = document.createElement("div");
      card.className = "day-card";

      const h = document.createElement("div");
      h.className = "day-title";
      h.textContent = day;
      card.appendChild(h);

      slots.forEach((s, si) => {
        const row = document.createElement("div");
        row.className = "slot";

        const left = document.createElement("div");
        left.className = "slot-left";

        const icon = document.createElement("div");
        icon.className = "slot-icon";
        icon.textContent = (s === "AM") ? "☀️" : "🌙";

        const label = document.createElement("div");
        label.textContent = s;

        left.appendChild(icon);
        left.appendChild(label);

        const input = document.createElement("input");
        input.inputMode = "numeric";
        input.placeholder = "-";
        input.value = week.values[indexFor(d, si)] || "";

        input.addEventListener("input", () => {
          const w = loadWeek();
          w.values[indexFor(d, si)] = input.value;
          saveWeekData(w);
          // Live update postcard while typing
          renderInsights();
        });

        row.appendChild(left);
        row.appendChild(input);
        card.appendChild(row);
      });

      els.daysContainer.appendChild(card);
    });
  }

  function renderChart(week){
    // dots (always 12)
    els.chartDots.innerHTML = "";
    for(let i=0;i<12;i++){
      const dot = document.createElement("div");
      dot.className = "dot";
      els.chartDots.appendChild(dot);
    }

    // icons based on entered values
    els.chartIcons.innerHTML = "";
    for(let i=0;i<12;i++){
      const ico = document.createElement("div");
      ico.className = "ico";

      const v = (week.values[i] || "").trim();
      if(v !== ""){
        ico.textContent = (i % 2 === 0) ? "☀️" : "🌙";
      } else {
        ico.textContent = "";
      }
      els.chartIcons.appendChild(ico);
    }
  }

  function bestSeen(week){
    const nums = week.values
      .map(v => Number(String(v).trim()))
      .filter(n => Number.isFinite(n) && n > 0);

    if(nums.length === 0) return null;
    return Math.max(...nums);
  }

  function bestTime(week){
    let best = -Infinity;
    let bestIdx = -1;

    for(let i=0;i<12;i++){
      const n = Number(String(week.values[i]).trim());
      if(Number.isFinite(n) && n > best){
        best = n;
        bestIdx = i;
      }
    }

    if(bestIdx < 0) return null;

    const dayIdx = Math.floor(bestIdx / 2); // 0..5
    const slotIdx = bestIdx % 2; // 0 AM, 1 PM
    const shortDay = ["Mon","Tue","Wed","Thu","Fri","Sat"][dayIdx];
    const part = slotIdx === 0 ? "AM" : "PM";
    return `${shortDay} ${part}`;
  }

  function renderStats(week){
    const buy = Number(String(week.buy).trim());
    const buyVal = Number.isFinite(buy) && buy > 0 ? buy : null;

    const best = bestSeen(week);
    const bestT = bestTime(week);

    const rows = [];

    rows.push({ label: "Buy price", val: buyVal ?? "-" });
    rows.push({ label: "Best price seen", val: best ?? "-" });
    rows.push({ label: "Best time so far", val: bestT ?? "-" });

    // Profit vs buy (simple: best - buy)
    let profit = "-";
    if(buyVal != null && best != null){
      profit = (best - buyVal) >= 0 ? `+${best - buyVal}` : String(best - buyVal);
    }
    rows.push({ label: "Profit vs buy", val: profit });

    els.statsBlock.innerHTML = "";
    rows.forEach((r, i) => {
      const row = document.createElement("div");
      row.className = "stat-row";

      const left = document.createElement("div");
      left.className = "stat-label";
      left.textContent = r.label;

      const right = document.createElement("div");
      right.className = "stat-val";
      right.textContent = String(r.val);

      row.appendChild(left);
      row.appendChild(right);
      els.statsBlock.appendChild(row);

      if(i !== rows.length - 1){
        const div = document.createElement("div");
        div.className = "divider";
        els.statsBlock.appendChild(div);
      }
    });
  }

  function renderHistory(){
    const history = loadHistory();
    if(history.length === 0){
      els.historyList.textContent = "No saved weeks yet.";
      return;
    }

    els.historyList.innerHTML = "";
    history.slice().reverse().forEach(item => {
      const div = document.createElement("div");
      div.className = "history-item";
      div.textContent = `${item.label}  |  Buy ${item.buy || "-"}  |  Best ${item.best || "-"}`;
      els.historyList.appendChild(div);
    });
  }

  function renderInsights(){
    const week = loadWeek();
    renderChart(week);
    renderStats(week);
    renderHistory();
  }

  function renderSettings(){
    // Slider controls the CSS variable used by the chart overlay
    const saved = localStorage.getItem(LS_PATTERN);
    const initial = saved != null ? Number(saved) : 35;
    els.patternStrength.value = String(initial);

    document.documentElement.style.setProperty("--pattern-opacity", String(initial / 100));

    els.patternStrength.oninput = () => {
      const v = Number(els.patternStrength.value);
      localStorage.setItem(LS_PATTERN, String(v));
      document.documentElement.style.setProperty("--pattern-opacity", String(v / 100));
    };
  }

  // Events
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => setActivePage(btn.dataset.go));
  });

  els.buyPrice.addEventListener("input", () => {
    const week = loadWeek();
    week.buy = els.buyPrice.value;
    saveWeekData(week);
    renderInsights();
  });

  els.saveWeekBtn.addEventListener("click", () => {
    const week = loadWeek();
    const label = getSundayDateLabel();
    const best = bestSeen(week);
    const history = loadHistory();

    history.push({
      label,
      buy: week.buy || "",
      best: best != null ? String(best) : ""
    });

    saveHistory(history);
    clearEntry();
    setActivePage("insights");
  });

  els.resetWeekBtn.addEventListener("click", () => {
    clearEntry();
    setActivePage("entry");
  });

  els.clearHistoryBtn.addEventListener("click", () => {
    saveHistory([]);
    renderHistory();
  });

  // Initial boot
  renderEntry();
  renderSettings();
  renderInsights();
  setActivePage("entry");
})();
