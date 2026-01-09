/* Turnip Tracker - single file JS
   Data persists via localStorage.
*/

const LS_KEYS = {
  week: "tt_week_v1",
  history: "tt_history_v1",
  settings: "tt_settings_v1",
};

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SLOTS = [
  { key: "am", label: "AM", icon: "☀️" },
  { key: "pm", label: "PM", icon: "🌙" },
];

function $(id){ return document.getElementById(id); }

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch{
    return fallback;
  }
}

function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function defaultWeek(){
  const week = {
    buyPrice: "",
    buyDate: monthDayLabel(),
    entries: {},
  };
  for(const d of DAYS){
    week.entries[d] = { am: "", pm: "" };
  }
  return week;
}

function defaultSettings(){
  return {
    patternStrength: 35, // 0-100
  };
}

function monthDayLabel(date = new Date()){
  const m = date.toLocaleString(undefined, { month:"short" });
  const day = date.getDate();
  return `${m} ${day}`;
}

/* --------- UI: NAV --------- */
function setActivePage(which){
  const pages = {
    entry: $("page-entry"),
    insights: $("page-insights"),
    settings: $("page-settings"),
  };

  for(const k of Object.keys(pages)){
    pages[k].classList.toggle("is-active", k === which);
  }

  $("navEntry").classList.toggle("is-active", which === "entry");
  $("navInsights").classList.toggle("is-active", which === "insights");
  $("navSettings").classList.toggle("is-active", which === "settings");

  // keep scroll at top when switching pages
  window.scrollTo({ top: 0, behavior: "instant" });
}

function wireNav(){
  const navButtons = document.querySelectorAll(".nav-btn");
  navButtons.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const target = btn.dataset.target;
      setActivePage(target);
      if(target === "insights") refreshInsights();
      if(target === "settings") refreshSettingsUI();
    });
  });
}

/* --------- ENTRY RENDER --------- */
function renderWeekGrid(week){
  const grid = $("weekGrid");
  grid.innerHTML = "";

  DAYS.forEach(day=>{
    const card = document.createElement("div");
    card.className = "day-card";

    const title = document.createElement("div");
    title.className = "day-name";
    title.textContent = day;
    card.appendChild(title);

    SLOTS.forEach(slot=>{
      const row = document.createElement("div");
      row.className = "slot";

      const left = document.createElement("div");
      left.className = "slot-left";
      left.innerHTML = `<span class="ico">${slot.icon}</span><span>${slot.label}</span>`;

      const right = document.createElement("div");
      right.className = "slot-right";

      const input = document.createElement("input");
      input.className = "num-input";
      input.inputMode = "numeric";
      input.pattern = "[0-9]*";
      input.placeholder = "-";
      input.value = week.entries[day][slot.key] ?? "";

      input.addEventListener("input", ()=>{
        week.entries[day][slot.key] = sanitizeNum(input.value);
        saveJSON(LS_KEYS.week, week);
        // keep cursor natural, but normalize value when user leaves the field
      });

      input.addEventListener("blur", ()=>{
        input.value = week.entries[day][slot.key] ?? "";
      });

      right.appendChild(input);

      row.appendChild(left);
      row.appendChild(right);
      card.appendChild(row);
    });

    grid.appendChild(card);
  });
}

function sanitizeNum(v){
  // keep digits only
  const s = String(v ?? "").replace(/[^\d]/g, "");
  return s;
}

/* --------- INSIGHTS + CHART --------- */
function buildDots(){
  const dots = $("dots");
  const markers = $("markers");
  dots.innerHTML = "";
  markers.innerHTML = "";

  // 12 points: Mon AM, Mon PM, ... Sat PM
  for(let i=0;i<12;i++){
    const dot = document.createElement("div");
    dot.className = "dot empty";
    dots.appendChild(dot);

    const marker = document.createElement("div");
    marker.className = "marker";
    marker.textContent = (i % 2 === 0) ? "☀️" : "🌙";
    markers.appendChild(marker);
  }
}

function refreshInsights(){
  const week = loadJSON(LS_KEYS.week, defaultWeek());

  // Buy
  const buy = toNum(week.buyPrice);
  $("statBuy").textContent = buy ? String(buy) : "-";

  // Flatten list in order
  const ordered = [];
  for(const day of DAYS){
    ordered.push(toNum(week.entries[day].am));
    ordered.push(toNum(week.entries[day].pm));
  }

  // Best
  let best = null;
  let bestIdx = -1;
  ordered.forEach((n, idx)=>{
    if(!n) return;
    if(best === null || n > best){
      best = n;
      bestIdx = idx;
    }
  });

  $("statBest").textContent = best !== null ? String(best) : "-";
  $("statBestTime").textContent = bestIdx >= 0 ? idxToLabel(bestIdx) : "-";

  // Profit vs buy (best - buy)
  const profitEl = $("statProfit");
  profitEl.classList.remove("positive","negative");
  if(best !== null && buy){
    const diff = best - buy;
    profitEl.textContent = (diff >= 0 ? `+${diff}` : String(diff));
    profitEl.classList.add(diff >= 0 ? "positive" : "negative");
  }else{
    profitEl.textContent = "-";
  }

  // Pattern guess
  $("statPattern").textContent = guessPattern(ordered);

  // Chart dots: filled where value exists
  const dotEls = Array.from($("dots").children);
  dotEls.forEach((el, idx)=>{
    const v = ordered[idx];
    el.classList.toggle("empty", !v);
  });

  applyPatternStrength();
}

function idxToLabel(idx){
  const day = DAYS[Math.floor(idx / 2)];
  const slot = (idx % 2 === 0) ? "AM" : "PM";
  // "Thu PM" style
  const short = day.slice(0,3);
  return `${short} ${slot}`;
}

function toNum(s){
  const n = parseInt(String(s ?? "").replace(/[^\d]/g,""), 10);
  return Number.isFinite(n) ? n : 0;
}

function guessPattern(arr){
  const vals = arr.filter(Boolean);
  if(vals.length < 3) return "Not enough data";

  const diffs = [];
  for(let i=1;i<vals.length;i++){
    diffs.push(vals[i] - vals[i-1]);
  }

  const up = diffs.filter(d=>d>0).length;
  const down = diffs.filter(d=>d<0).length;

  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const spread = max - min;

  // simple heuristics
  if(up > down * 2) return "Increasing";
  if(down > up * 2) return "Decreasing";

  // spike: one big max compared to median-ish
  const sorted = [...vals].sort((a,b)=>a-b);
  const med = sorted[Math.floor(sorted.length/2)];
  if(max >= med + Math.max(30, spread*0.45)) return "Spike";

  return "Mixed";
}

/* --------- HISTORY --------- */
function loadHistory(){
  return loadJSON(LS_KEYS.history, []);
}

function saveHistory(list){
  saveJSON(LS_KEYS.history, list);
}

function renderHistory(){
  const list = loadHistory();
  const host = $("historyList");
  const empty = $("historyEmpty");
  host.innerHTML = "";

  empty.style.display = list.length ? "none" : "block";

  list.slice().reverse().forEach(item=>{
    const div = document.createElement("div");
    div.className = "history-item";

    const top = document.createElement("div");
    top.className = "topline";
    top.innerHTML = `<span>${item.label}</span><span>Best: ${item.best ?? "-"}</span>`;

    const sub = document.createElement("div");
    sub.className = "subline";
    sub.textContent = `Buy: ${item.buy ?? "-"} • Best time: ${item.bestTime ?? "-"} • Pattern: ${item.pattern ?? "-"}`;

    div.appendChild(top);
    div.appendChild(sub);
    host.appendChild(div);
  });
}

/* --------- SETTINGS --------- */
function applyPatternStrength(){
  const settings = loadJSON(LS_KEYS.settings, defaultSettings());
  const v = clamp(settings.patternStrength ?? 35, 0, 100);
  const opacity = (v / 100) * 0.55; // 0 to 0.55
  $("chartPattern").style.opacity = String(opacity);
}

function refreshSettingsUI(){
  const settings = loadJSON(LS_KEYS.settings, defaultSettings());
  $("patternStrength").value = String(clamp(settings.patternStrength ?? 35, 0, 100));
}

function wireSettings(){
  $("patternStrength").addEventListener("input", (e)=>{
    const settings = loadJSON(LS_KEYS.settings, defaultSettings());
    settings.patternStrength = clamp(parseInt(e.target.value,10) || 0, 0, 100);
    saveJSON(LS_KEYS.settings, settings);
    applyPatternStrength();
  });

  $("resetWeekBtn").addEventListener("click", ()=>{
    const fresh = defaultWeek();
    // keep today's date label fresh
    fresh.buyDate = monthDayLabel();
    saveJSON(LS_KEYS.week, fresh);
    hydrate();
  });

  $("clearHistoryBtn").addEventListener("click", ()=>{
    saveHistory([]);
    renderHistory();
  });
}

/* --------- SAVE WEEK --------- */
function wireSaveWeek(){
  $("saveWeekBtn").addEventListener("click", ()=>{
    const week = loadJSON(LS_KEYS.week, defaultWeek());

    const ordered = [];
    for(const day of DAYS){
      ordered.push(toNum(week.entries[day].am));
      ordered.push(toNum(week.entries[day].pm));
    }

    let best = null;
    let bestIdx = -1;
    ordered.forEach((n, idx)=>{
      if(!n) return;
      if(best === null || n > best){
        best = n;
        bestIdx = idx;
      }
    });

    const item = {
      label: week.buyDate || monthDayLabel(),
      buy: toNum(week.buyPrice) || null,
      best: best,
      bestTime: bestIdx >= 0 ? idxToLabel(bestIdx) : null,
      pattern: guessPattern(ordered),
      ts: Date.now(),
    };

    const history = loadHistory();
    history.push(item);
    saveHistory(history);

    // Clear Entry after saving
    const fresh = defaultWeek();
    fresh.buyDate = monthDayLabel();
    saveJSON(LS_KEYS.week, fresh);

    hydrate();
    setActivePage("insights");
    refreshInsights();
  });
}

/* --------- HYDRATE --------- */
function hydrate(){
  // week
  const week = loadJSON(LS_KEYS.week, defaultWeek());

  $("buyDateLabel").textContent = week.buyDate || monthDayLabel();
  $("buyPrice").value = week.buyPrice ?? "";

  $("buyPrice").addEventListener("input", ()=>{
    const w = loadJSON(LS_KEYS.week, defaultWeek());
    w.buyPrice = sanitizeNum($("buyPrice").value);
    saveJSON(LS_KEYS.week, w);
  });
  $("buyPrice").addEventListener("blur", ()=>{
    const w = loadJSON(LS_KEYS.week, defaultWeek());
    $("buyPrice").value = w.buyPrice ?? "";
  });

  renderWeekGrid(week);

  // chart scaffolding
  buildDots();

  // history
  renderHistory();

  // settings
  applyPatternStrength();
  refreshSettingsUI();
}

function init(){
  wireNav();
  wireSettings();
  wireSaveWeek();

  hydrate();
  setActivePage("entry");
  refreshInsights();
}

document.addEventListener("DOMContentLoaded", init);
