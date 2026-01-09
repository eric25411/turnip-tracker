const LS = {
  week: "tt_week_v2",
  history: "tt_history_v2",
  fontScale: "tt_fontScale_v2",
  patternOpacity: "tt_patternOpacity_v2"
};

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function $(id){ return document.getElementById(id); }

function lastSundayDate(d = new Date()){
  const x = new Date(d);
  x.setHours(0,0,0,0);
  const day = x.getDay(); // 0 = Sunday
  x.setDate(x.getDate() - day);
  return x;
}

function fmtMonthDay(dateObj){
  return dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function sanitizePrice(v){
  return String(v).replace(/[^\d]/g,"").slice(0,3);
}

function freshWeek(){
  const prices = {};
  for(const day of DAYS){
    prices[day] = { am: "", pm: "" };
  }
  return {
    buyPrice: "",
    prices,
    weekSundayISO: lastSundayDate().toISOString()
  };
}

function loadWeek(){
  const raw = localStorage.getItem(LS.week);
  if(!raw) return freshWeek();
  try{
    const w = JSON.parse(raw);
    if(!w || !w.prices) return freshWeek();
    return w;
  }catch(e){
    return freshWeek();
  }
}

function saveWeek(week){
  localStorage.setItem(LS.week, JSON.stringify(week));
}

function loadHistory(){
  const raw = localStorage.getItem(LS.history);
  if(!raw) return [];
  try{ return JSON.parse(raw) || []; }catch(e){ return []; }
}
function saveHistory(arr){
  localStorage.setItem(LS.history, JSON.stringify(arr));
}

function ensureWeekSunday(week){
  const currentSunday = lastSundayDate();
  const stored = new Date(week.weekSundayISO);
  stored.setHours(0,0,0,0);

  if(stored.getTime() !== currentSunday.getTime()){
    week.weekSundayISO = currentSunday.toISOString();
    saveWeek(week);
  }
}

function applyFontScale(scale){
  // Works reliably on iOS Safari: do BOTH
  document.documentElement.style.setProperty("--fontScale", String(scale));
  document.body.style.fontSize = `${16 * Number(scale)}px`;
}

function applyPatternOpacity(op){
  document.documentElement.style.setProperty("--patternOpacity", String(op));
}

function computeStats(week){
  const buy = week.buyPrice ? Number(week.buyPrice) : null;

  let best = null;
  let bestTime = null;

  for(const day of DAYS){
    for(const part of ["am","pm"]){
      const val = week.prices[day][part];
      if(!val) continue;
      const num = Number(val);
      if(Number.isNaN(num)) continue;

      if(best === null || num > best){
        best = num;
        bestTime = `${day.slice(0,3)} ${part.toUpperCase()}`;
      }
    }
  }

  let profit = null;
  if(buy !== null && best !== null) profit = best - buy;

  return { buy, best, bestTime, profit };
}

function buildDaysUI(week){
  const wrap = $("daysWrap");
  wrap.innerHTML = "";

  for(const day of DAYS){
    const card = document.createElement("div");
    card.className = "day-card";

    const title = document.createElement("div");
    title.className = "day-name";
    title.textContent = day;

    card.appendChild(title);
    card.appendChild(makeSlot(day, "am", "☀️", "AM", week));
    card.appendChild(makeSlot(day, "pm", "🌙", "PM", week));

    wrap.appendChild(card);
  }
}

function makeSlot(day, part, icon, label, week){
  const row = document.createElement("div");
  row.className = "slot";

  const left = document.createElement("div");
  left.className = "slot-left";
  left.innerHTML = `<span class="emoji">${icon}</span><span>${label}</span>`;

  const input = document.createElement("input");
  input.inputMode = "numeric";
  input.maxLength = 3;
  input.placeholder = "-";
  input.value = week.prices[day][part] || "";

  input.addEventListener("input", () => {
    week.prices[day][part] = sanitizePrice(input.value);
    input.value = week.prices[day][part];
    saveWeek(week);
    renderInsights(); // live update
  });

  row.appendChild(left);
  row.appendChild(input);
  return row;
}

function renderEntry(){
  const week = loadWeek();
  ensureWeekSunday(week);

  $("buyDateLabel").textContent = fmtMonthDay(new Date(week.weekSundayISO));

  const buyInput = $("buyPriceInput");
  buyInput.value = week.buyPrice || "";
  buyInput.oninput = () => {
    week.buyPrice = sanitizePrice(buyInput.value);
    buyInput.value = week.buyPrice;
    saveWeek(week);
    renderInsights();
  };

  buildDaysUI(week);

  $("saveWeekBtn").onclick = () => {
    const hist = loadHistory();
    const stats = computeStats(week);

    hist.unshift({
      id: String(Date.now()),
      title: `Week of ${fmtMonthDay(new Date(week.weekSundayISO))}`,
      sundayISO: week.weekSundayISO,
      buyPrice: stats.buy,
      best: stats.best,
      bestTime: stats.bestTime,
      profit: stats.profit
    });

    saveHistory(hist);
    saveWeek(freshWeek());

    renderEntry();
    renderInsights();
    alert("Saved! Entry has been cleared.");
  };
}

function renderChartDots(week){
  const el = $("chartDots");
  if(!el) return;

  el.innerHTML = "";

  const slots = [];
  for(const day of DAYS){
    slots.push({ day, part: "am", icon: "☀️" });
    slots.push({ day, part: "pm", icon: "🌙" });
  }

  for(const s of slots){
    const dot = document.createElement("div");
    dot.className = "dot";

    const base = document.createElement("div");
    base.className = "base";
    dot.appendChild(base);

    const val = week.prices[s.day][s.part];
    if(val){
      const mark = document.createElement("div");
      mark.className = "mark";
      mark.textContent = s.icon;
      dot.appendChild(mark);
    }

    el.appendChild(dot);
  }
}

function renderHistory(){
  const list = $("historyList");
  if(!list) return;

  const hist = loadHistory();

  if(!hist.length){
    list.innerHTML = `<div class="muted small">No saved weeks yet.</div>`;
    return;
  }

  list.innerHTML = "";
  for(const h of hist){
    const item = document.createElement("div");
    item.className = "history-item";

    const top = document.createElement("div");
    top.className = "h-top";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="h-title">${h.title}</div>
      <div class="h-sub">${[
        h.buyPrice !== null ? `Buy ${h.buyPrice}` : null,
        h.best !== null ? `Best ${h.best}` : null,
        h.bestTime ? `Top ${h.bestTime}` : null
      ].filter(Boolean).join(" • ") || "No prices logged"}</div>
    `;

    const right = document.createElement("div");
    right.className = "h-title";
    if(h.profit === null || h.profit === undefined){
      right.textContent = "";
    }else{
      right.textContent = h.profit >= 0 ? `+${h.profit}` : `${h.profit}`;
    }

    top.appendChild(left);
    top.appendChild(right);
    item.appendChild(top);

    list.appendChild(item);
  }
}

function renderInsights(){
  const week = loadWeek();
  ensureWeekSunday(week);

  renderChartDots(week);

  const stats = computeStats(week);

  $("statBuy").textContent = stats.buy === null ? "-" : String(stats.buy);
  $("statBest").textContent = stats.best === null ? "-" : String(stats.best);
  $("statBestTime").textContent = stats.bestTime === null ? "-" : stats.bestTime;
  $("statProfit").textContent =
    stats.profit === null ? "-" : (stats.profit >= 0 ? `+${stats.profit}` : `${stats.profit}`);

  renderHistory();
}

function initSettings(){
  const sel = $("fontSizeSelect");
  const slider = $("patternSlider");

  // load saved
  const savedScale = localStorage.getItem(LS.fontScale) || "0.92";
  const savedOp = localStorage.getItem(LS.patternOpacity) || "0.22";

  applyFontScale(savedScale);
  applyPatternOpacity(savedOp);

  if(sel){
    sel.value = savedScale;
    sel.onchange = () => {
      localStorage.setItem(LS.fontScale, sel.value);
      applyFontScale(sel.value);
    };
  }

  if(slider){
    slider.value = savedOp;
    slider.oninput = () => {
      localStorage.setItem(LS.patternOpacity, slider.value);
      applyPatternOpacity(slider.value);
    };
  }

  const resetBtn = $("resetWeekBtn");
  if(resetBtn){
    resetBtn.onclick = () => {
      if(!confirm("Reset this week? This clears Entry only.")) return;
      saveWeek(freshWeek());
      renderEntry();
      renderInsights();
    };
  }

  const clearHistoryBtn = $("clearHistoryBtn");
  if(clearHistoryBtn){
    clearHistoryBtn.onclick = () => {
      if(!confirm("Clear history?")) return;
      saveHistory([]);
      renderHistory();
    };
  }
}

function showPage(name){
  ["entry","insights","settings"].forEach(p => {
    const sec = $(`page-${p}`);
    if(sec) sec.classList.toggle("is-active", p === name);
  });

  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("is-active", b.dataset.target === name);
  });

  if(name === "entry") renderEntry();
  if(name === "insights") renderInsights();
  if(name === "settings") initSettings();
}

function initNav(){
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.onclick = () => showPage(btn.dataset.target);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initSettings();     // run once so text changer works immediately
  renderEntry();
  renderInsights();
  showPage("entry");  // start page
});
