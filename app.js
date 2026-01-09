const LS = {
  week: "tt_week_v1",
  history: "tt_history_v1",
  fontScale: "tt_fontScale",
  patternOpacity: "tt_patternOpacity"
};

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function $(id){ return document.getElementById(id); }

function lastSundayDate(d = new Date()){
  // returns Date object for most recent Sunday (including today if Sunday)
  const x = new Date(d);
  x.setHours(0,0,0,0);
  const day = x.getDay(); // 0 Sun
  x.setDate(x.getDate() - day);
  return x;
}

function fmtMonthDay(dateObj){
  return dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function loadWeek(){
  const raw = localStorage.getItem(LS.week);
  if(raw){
    try{ return JSON.parse(raw); }catch(e){}
  }
  return freshWeek();
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

function saveWeekState(week){
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

function applyFontScale(scale){
  document.documentElement.style.setProperty("--fontScale", String(scale));
}
function applyPatternOpacity(op){
  document.documentElement.style.setProperty("--patternOpacity", String(op));
}

function initSettingsUI(){
  const savedScale = localStorage.getItem(LS.fontScale) || "0.92";
  applyFontScale(savedScale);

  const sel = $("fontSizeSelect");
  if(sel){
    sel.value = savedScale;
    sel.addEventListener("change", () => {
      localStorage.setItem(LS.fontScale, sel.value);
      applyFontScale(sel.value);
    });
  }

  const savedOp = localStorage.getItem(LS.patternOpacity) || "0.22";
  applyPatternOpacity(savedOp);

  const slider = $("patternSlider");
  if(slider){
    slider.value = savedOp;
    slider.addEventListener("input", () => {
      localStorage.setItem(LS.patternOpacity, slider.value);
      applyPatternOpacity(slider.value);
    });
  }

  const resetBtn = $("resetWeekBtn");
  if(resetBtn){
    resetBtn.addEventListener("click", () => {
      if(!confirm("Reset this week? This clears Entry only.")) return;
      const w = freshWeek();
      saveWeekState(w);
      renderAll();
    });
  }

  const clearHistoryBtn = $("clearHistoryBtn");
  if(clearHistoryBtn){
    clearHistoryBtn.addEventListener("click", () => {
      if(!confirm("Clear history?")) return;
      saveHistory([]);
      renderHistory();
    });
  }
}

function ensureWeekSunday(week){
  // if device rolled to a new Sunday, update the label (we keep entered data)
  const currentSunday = lastSundayDate();
  const stored = new Date(week.weekSundayISO);
  stored.setHours(0,0,0,0);
  if(stored.getTime() !== currentSunday.getTime()){
    week.weekSundayISO = currentSunday.toISOString();
    saveWeekState(week);
  }
}

function renderBuyHeader(week){
  const sunday = new Date(week.weekSundayISO);
  $("buyDateLabel").textContent = fmtMonthDay(sunday);
}

function renderDays(week){
  const wrap = $("daysWrap");
  wrap.innerHTML = "";

  for(const day of DAYS){
    const card = document.createElement("div");
    card.className = "day-card";

    const title = document.createElement("div");
    title.className = "day-name";
    title.textContent = day;
    card.appendChild(title);

    const slotAM = makeSlot(day, "am", "☀️", "AM", week);
    const slotPM = makeSlot(day, "pm", "🌙", "PM", week);

    card.appendChild(slotAM);
    card.appendChild(slotPM);

    wrap.appendChild(card);
  }
}

function makeSlot(day, which, icon, label, week){
  const row = document.createElement("div");
  row.className = "slot";

  const left = document.createElement("div");
  left.className = "slot-left";
  const em = document.createElement("span");
  em.className = "emoji";
  em.textContent = icon;
  const txt = document.createElement("span");
  txt.textContent = label;
  left.appendChild(em);
  left.appendChild(txt);

  const input = document.createElement("input");
  input.inputMode = "numeric";
  input.maxLength = 3;
  input.placeholder = "-";
  input.value = week.prices[day][which] || "";

  input.addEventListener("input", () => {
    week.prices[day][which] = sanitizePrice(input.value);
    input.value = week.prices[day][which];
    saveWeekState(week);
    renderInsights(); // live update insights
  });

  row.appendChild(left);
  row.appendChild(input);

  return row;
}

function sanitizePrice(v){
  const digits = String(v).replace(/[^\d]/g,"").slice(0,3);
  return digits;
}

function renderEntry(week){
  ensureWeekSunday(week);
  renderBuyHeader(week);

  const buy = $("buyPriceInput");
  buy.value = week.buyPrice || "";
  buy.addEventListener("input", () => {
    week.buyPrice = sanitizePrice(buy.value);
    buy.value = week.buyPrice;
    saveWeekState(week);
    renderInsights();
  });

  renderDays(week);

  const saveBtn = $("saveWeekBtn");
  saveBtn.onclick = () => {
    const hist = loadHistory();

    const snapshot = summarizeWeek(week);
    hist.unshift(snapshot);
    saveHistory(hist);

    const w = freshWeek();
    saveWeekState(w);
    renderAll();
    alert("Saved! Entry has been cleared.");
  };
}

function summarizeWeek(week){
  const sunday = new Date(week.weekSundayISO);
  const title = `Week of ${fmtMonthDay(sunday)}`;
  const stats = computeStats(week);

  return {
    id: String(Date.now()),
    title,
    sundayISO: week.weekSundayISO,
    buyPrice: week.buyPrice ? Number(week.buyPrice) : null,
    best: stats.best ?? null,
    bestTime: stats.bestTime ?? null,
    profit: stats.profit ?? null,
    prices: week.prices
  };
}

function computeStats(week){
  const buy = week.buyPrice ? Number(week.buyPrice) : null;

  let best = null;
  let bestTime = null;

  // scan all entries
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
  if(buy !== null && best !== null){
    profit = best - buy;
  }

  return { buy, best, bestTime, profit };
}

function renderChartDots(week){
  // 12 slots: Mon AM..Sat PM
  const el = $("chartDots");
  el.innerHTML = "";

  const slots = [];
  for(const day of DAYS){
    slots.push({ day, part: "am", icon: "☀️" });
    slots.push({ day, part: "pm", icon: "🌙" });
  }

  // We draw a dot per slot. If value exists, show icon above it (cozy postcard).
  for(const s of slots){
    const wrap = document.createElement("div");
    wrap.className = "dot";

    const base = document.createElement("div");
    base.className = "base";

    wrap.appendChild(base);

    const val = week.prices[s.day][s.part];
    if(val){
      const mark = document.createElement("div");
      mark.className = "mark";
      mark.textContent = s.icon;
      wrap.appendChild(mark);
    }

    el.appendChild(wrap);
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

  if(stats.profit === null){
    $("statProfit").textContent = "-";
  }else{
    $("statProfit").textContent = (stats.profit >= 0 ? `+${stats.profit}` : `${stats.profit}`);
  }

  renderHistory();
}

function renderHistory(){
  const list = $("historyList");
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
    const t = document.createElement("div");
    t.className = "h-title";
    t.textContent = h.title;

    const sub = document.createElement("div");
    sub.className = "h-sub";

    const pieces = [];
    if(h.buyPrice !== null) pieces.push(`Buy ${h.buyPrice}`);
    if(h.best !== null) pieces.push(`Best ${h.best}`);
    if(h.bestTime) pieces.push(`Top ${h.bestTime}`);
    sub.textContent = pieces.length ? pieces.join(" • ") : "No prices logged";

    left.appendChild(t);
    left.appendChild(sub);

    const right = document.createElement("div");
    right.className = "h-title";
    if(h.profit !== null){
      right.textContent = (h.profit >= 0 ? `+${h.profit}` : `${h.profit}`);
    }else{
      right.textContent = "";
    }

    top.appendChild(left);
    top.appendChild(right);
    item.appendChild(top);

    list.appendChild(item);
  }
}

function showPage(name){
  const pages = ["entry","insights","settings"];
  for(const p of pages){
    const sec = $(`page-${p}`);
    if(sec) sec.classList.toggle("is-active", p === name);
  }

  // nav highlight
  const btns = document.querySelectorAll(".nav-btn");
  btns.forEach(b => b.classList.remove("is-active"));
  const active = document.querySelector(`.nav-btn[data-target="${name}"]`);
  if(active) active.classList.add("is-active");

  // refresh views
  if(name === "entry") renderEntry(loadWeek());
  if(name === "insights") renderInsights();
  if(name === "settings") initSettingsUI();
}

function initNav(){
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      showPage(target);
    });
  });
}

function renderAll(){
  const week = loadWeek();
  renderEntry(week);
  renderInsights();
  initSettingsUI();
}

function init(){
  initNav();

  // apply settings instantly on load
  const savedScale = localStorage.getItem(LS.fontScale) || "0.92";
  applyFontScale(savedScale);

  const savedOp = localStorage.getItem(LS.patternOpacity) || "0.22";
  applyPatternOpacity(savedOp);

  // start on Entry
  showPage("entry");
}

init();
