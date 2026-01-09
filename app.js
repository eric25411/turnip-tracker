/* Turnip Tracker - single file app */

const LS_KEY = "tt_state_v1";
const LS_HISTORY = "tt_history_v1";
const LS_PATTERN = "tt_pattern_strength_v1";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat"];
const SLOTS = [
  { key:"AM", icon:"☀️" },
  { key:"PM", icon:"🌙" }
];

function $(id){ return document.getElementById(id); }

function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

function getLastSunday(d = new Date()){
  // last Sunday (including today if Sunday)
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0=Sun
  date.setDate(date.getDate() - day);
  return date;
}

function formatMonthDay(d){
  // "Jan 4"
  return new Intl.DateTimeFormat(undefined, { month:"short", day:"numeric" }).format(d);
}

function safeInt(v){
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){
    return null;
  }
}

function saveState(state){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function defaultState(){
  const sunday = getLastSunday(new Date());
  const weekStartISO = sunday.toISOString().slice(0,10);

  const prices = {};
  for(const d of DAYS){
    for(const s of SLOTS){
      prices[`${d}_${s.key}`] = "";
    }
  }

  return {
    weekStartISO,
    buyPrice: "",
    prices
  };
}

function ensureThisWeek(state){
  const sunday = getLastSunday(new Date()).toISOString().slice(0,10);
  if(!state || !state.weekStartISO) return defaultState();
  if(state.weekStartISO !== sunday){
    // auto roll to new week, keep history separately
    const fresh = defaultState();
    return fresh;
  }
  // ensure keys exist
  if(!state.prices) state.prices = {};
  for(const d of DAYS){
    for(const s of SLOTS){
      const k = `${d}_${s.key}`;
      if(!(k in state.prices)) state.prices[k] = "";
    }
  }
  if(typeof state.buyPrice !== "string") state.buyPrice = "";
  return state;
}

function loadHistory(){
  try{
    const raw = localStorage.getItem(LS_HISTORY);
    if(!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch(e){
    return [];
  }
}

function saveHistory(arr){
  localStorage.setItem(LS_HISTORY, JSON.stringify(arr));
}

function buildEntryUI(state){
  const wrap = $("entry-days");
  wrap.innerHTML = "";

  // Compact day cards
  for(const day of DAYS){
    const card = document.createElement("div");
    card.className = "day-card";
    card.innerHTML = `
      <div class="day-title">${day === "Thu" ? "Thursday" : day === "Tue" ? "Tuesday" : day === "Wed" ? "Wednesday" : day === "Sat" ? "Saturday" : day === "Fri" ? "Friday" : day === "Mon" ? "Monday" : day}</div>
      <div class="slot" data-slot="${day}_AM">
        <div class="slot-left"><span class="emoji">☀️</span><span>AM</span></div>
        <input inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="-" />
      </div>
      <div class="slot" data-slot="${day}_PM">
        <div class="slot-left"><span class="emoji">🌙</span><span>PM</span></div>
        <input inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="-" />
      </div>
    `;
    wrap.appendChild(card);

    // wire inputs
    for(const s of SLOTS){
      const key = `${day}_${s.key}`;
      const slotEl = card.querySelector(`[data-slot="${key}"]`);
      const input = slotEl.querySelector("input");
      input.value = state.prices[key] ?? "";
      input.addEventListener("input", () => {
        // keep only digits, max 3
        input.value = input.value.replace(/[^\d]/g,"").slice(0,3);
        state.prices[key] = input.value;
        saveState(state);
        renderInsights(state);
      });
    }
  }
}

function buildChart(){
  // 12 points, Mon AM..Sat PM
  const markers = $("chartMarkers");
  const dots = $("chartDots");
  markers.innerHTML = "";
  dots.innerHTML = "";

  for(let i=0;i<12;i++){
    const m = document.createElement("div");
    m.className = "marker";
    m.textContent = (i % 2 === 0) ? "☀️" : "🌙";
    markers.appendChild(m);

    const d = document.createElement("div");
    d.className = "dot";
    dots.appendChild(d);
  }
}

function computeInsights(state){
  const buy = safeInt(state.buyPrice);
  const entries = [];

  for(const day of DAYS){
    for(const s of SLOTS){
      const k = `${day}_${s.key}`;
      const v = safeInt(state.prices[k]);
      if(v !== null){
        entries.push({ key:k, day, slot:s.key, price:v });
      }
    }
  }

  // Best (highest sell price)
  let best = null;
  for(const e of entries){
    if(best === null || e.price > best.price) best = e;
  }

  const bestPrice = best ? best.price : null;
  const bestTime = best ? `${best.day} ${best.slot}` : null;

  let profit = null;
  if(buy !== null && bestPrice !== null){
    profit = bestPrice - buy;
  }

  // Pattern (simple heuristic)
  let pattern = "Mixed";
  const count = entries.length;
  const amCount = entries.filter(e => e.slot === "AM").length;
  const pmCount = entries.filter(e => e.slot === "PM").length;
  if(count >= 4){
    if(amCount >= pmCount * 2) pattern = "AM leaning";
    else if(pmCount >= amCount * 2) pattern = "PM leaning";
  }

  return { buy, bestPrice, bestTime, profit, pattern };
}

function renderInsights(state){
  const ins = computeInsights(state);

  $("i-buy").textContent = ins.buy === null ? "-" : String(ins.buy);
  $("i-best").textContent = ins.bestPrice === null ? "-" : String(ins.bestPrice);
  $("i-besttime").textContent = ins.bestTime === null ? "-" : ins.bestTime;
  $("i-profit").textContent = (ins.profit === null) ? "-" : (ins.profit >= 0 ? `+${ins.profit}` : `${ins.profit}`);
  $("i-pattern").textContent = ins.pattern;

  // History list
  const hist = loadHistory();
  const list = $("historyList");
  if(hist.length === 0){
    list.textContent = "No saved weeks yet.";
  }else{
    list.innerHTML = hist.slice(0,12).map(h => {
      return `<div style="padding:6px 0;border-bottom:1px solid rgba(15,15,18,.08);">
        <div style="font-weight:950;">${h.weekLabel}</div>
        <div style="opacity:.75;">Buy ${h.buy ?? "-"}, Best ${h.best ?? "-"} (${h.bestTime ?? "-"})</div>
      </div>`;
    }).join("");
  }
}

function setBuyDateLabel(state){
  const d = new Date(state.weekStartISO + "T00:00:00");
  $("buy-date-label").textContent = formatMonthDay(d);
}

function applyPatternStrengthFromStorage(){
  const raw = localStorage.getItem(LS_PATTERN);
  const val = raw ? clamp(parseInt(raw,10) || 35, 0, 100) : 35;
  $("patternStrength").value = String(val);
  // Map 0..100 -> 0.05..0.35
  const alpha = 0.05 + (val/100) * 0.30;
  document.documentElement.style.setProperty("--patternAlpha", alpha.toFixed(3));
}

function wireSettings(state){
  const slider = $("patternStrength");
  slider.addEventListener("input", () => {
    const val = clamp(parseInt(slider.value,10) || 35, 0, 100);
    localStorage.setItem(LS_PATTERN, String(val));
    const alpha = 0.05 + (val/100) * 0.30;
    document.documentElement.style.setProperty("--patternAlpha", alpha.toFixed(3));
  });

  $("resetWeekBtn").addEventListener("click", () => {
    const fresh = defaultState();
    // keep same weekStart as current sunday
    state.weekStartISO = fresh.weekStartISO;
    state.buyPrice = "";
    state.prices = fresh.prices;
    saveState(state);
    setBuyDateLabel(state);
    $("buyPrice").value = "";
    buildEntryUI(state);
    renderInsights(state);
  });

  $("clearHistoryBtn").addEventListener("click", () => {
    saveHistory([]);
    renderInsights(state);
  });
}

function wireBottomNav(){
  const pages = {
    entry: $("page-entry"),
    insights: $("page-insights"),
    settings: $("page-settings")
  };

  const btns = Array.from(document.querySelectorAll(".nav-btn"));
  function go(which){
    Object.values(pages).forEach(p => p.classList.remove("is-active"));
    pages[which].classList.add("is-active");

    btns.forEach(b => b.classList.toggle("is-active", b.dataset.go === which));
    // scroll to top when switching pages (keeps it feeling stable)
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  btns.forEach(b => {
    b.addEventListener("click", () => go(b.dataset.go));
  });

  return { go };
}

function wireBuyInput(state){
  const input = $("buyPrice");
  input.value = state.buyPrice ?? "";
  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^\d]/g,"").slice(0,3);
    state.buyPrice = input.value;
    saveState(state);
    renderInsights(state);
  });
}

function wireSaveWeek(state){
  $("saveWeekBtn").addEventListener("click", () => {
    const ins = computeInsights(state);
    const d = new Date(state.weekStartISO + "T00:00:00");
    const weekLabel = `Week of ${formatMonthDay(d)}`;

    const history = loadHistory();
    history.unshift({
      weekStartISO: state.weekStartISO,
      weekLabel,
      buy: ins.buy,
      best: ins.bestPrice,
      bestTime: ins.bestTime,
      profit: ins.profit,
      pattern: ins.pattern,
      savedAt: new Date().toISOString()
    });
    saveHistory(history);

    // clear entry but keep same week
    const fresh = defaultState();
    fresh.weekStartISO = state.weekStartISO;
    state.buyPrice = "";
    state.prices = fresh.prices;
    saveState(state);

    $("buyPrice").value = "";
    buildEntryUI(state);
    renderInsights(state);
  });
}

(function init(){
  let state = ensureThisWeek(loadState());
  saveState(state);

  // Entry header date
  setBuyDateLabel(state);

  // Build UI
  buildEntryUI(state);
  buildChart();
  wireBuyInput(state);
  wireSaveWeek(state);

  // Settings
  applyPatternStrengthFromStorage();
  wireSettings(state);

  // Nav
  const nav = wireBottomNav();

  // Initial insights
  renderInsights(state);

  // If user opens app and it's a new Sunday, auto refresh week label + clear entry
  setInterval(() => {
    const nowSundayISO = getLastSunday(new Date()).toISOString().slice(0,10);
    if(state.weekStartISO !== nowSundayISO){
      state = ensureThisWeek(state); // rolls
      saveState(state);
      setBuyDateLabel(state);
      $("buyPrice").value = state.buyPrice ?? "";
      buildEntryUI(state);
      renderInsights(state);
      nav.go("entry");
    }
  }, 60 * 1000);
})();
