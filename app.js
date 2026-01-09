/* Turnip Tracker
   One file, no partial updates, stable layout.
*/

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOTS = ["AM", "PM"];

// Storage keys
const KEY_STATE = "tt_state_v1";
const KEY_HISTORY = "tt_history_v1";
const KEY_SETTINGS = "tt_settings_v1";

function pad2(n){ return String(n).padStart(2,"0"); }

function getMostRecentSunday(d = new Date()){
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = dt.getDay(); // 0 Sunday
  const diff = day; // days since Sunday
  dt.setDate(dt.getDate() - diff);
  return dt;
}

function fmtMonthDay(d){
  try{
    return new Intl.DateTimeFormat(undefined, { month:"short", day:"numeric" }).format(d);
  }catch{
    return `${d.getMonth()+1}/${d.getDate()}`;
  }
}

function isoDate(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function defaultState(){
  const sunday = getMostRecentSunday();
  const weekId = isoDate(sunday);

  const prices = {};
  for (const day of DAYS){
    prices[day] = { AM:"", PM:"" };
  }

  return {
    weekId,
    buyPrice: "",
    prices
  };
}

function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch{
    return fallback;
  }
}

function saveJSON(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}

function ensureCurrentWeek(state){
  const nowWeek = isoDate(getMostRecentSunday());
  if(state.weekId !== nowWeek){
    // Auto roll into new week, keep history as is
    return defaultState();
  }
  return state;
}

let state = ensureCurrentWeek(loadJSON(KEY_STATE, defaultState()));
let history = loadJSON(KEY_HISTORY, []);
let settings = loadJSON(KEY_SETTINGS, { patternStrength: 35 });

// DOM refs
const daysWrap = document.querySelector(".days");
const buyPriceInput = document.getElementById("buyPrice");
const buyDateLabel = document.getElementById("buyDateLabel");

const saveWeekBtn = document.getElementById("saveWeekBtn");
const resetWeekBtn = document.getElementById("resetWeekBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

const patternStrength = document.getElementById("patternStrength");

const statBuy = document.getElementById("statBuy");
const statBest = document.getElementById("statBest");
const statBestTime = document.getElementById("statBestTime");
const statProfit = document.getElementById("statProfit");
const statPattern = document.getElementById("statPattern");
const historyList = document.getElementById("historyList");

const chartDots = document.getElementById("chartDots");
const chartIcons = document.getElementById("chartIcons");

// Navigation
const navButtons = document.querySelectorAll(".nav-btn");
const pages = document.querySelectorAll(".page");

// Build Entry UI
function buildEntry(){
  daysWrap.innerHTML = "";

  for (const day of DAYS){
    const card = document.createElement("div");
    card.className = "day-card";

    const title = document.createElement("div");
    title.className = "day-title";
    title.textContent = day;

    const slotWrap = document.createElement("div");

    for (const slot of SLOTS){
      const row = document.createElement("div");
      row.className = "slot";

      const left = document.createElement("div");
      left.className = "slot-left";

      const icon = document.createElement("div");
      icon.className = "slot-icon";
      icon.textContent = slot === "AM" ? "☀️" : "🌙";

      const label = document.createElement("div");
      label.textContent = slot;

      left.appendChild(icon);
      left.appendChild(label);

      const input = document.createElement("input");
      input.inputMode = "numeric";
      input.pattern = "[0-9]*";
      input.maxLength = 3;
      input.placeholder = "-";
      input.value = state.prices[day][slot] || "";

      input.addEventListener("input", () => {
        input.value = input.value.replace(/[^\d]/g, "").slice(0,3);
        state.prices[day][slot] = input.value;
        persistState();
        renderInsights();
      });

      row.appendChild(left);
      row.appendChild(input);
      slotWrap.appendChild(row);
    }

    card.appendChild(title);
    card.appendChild(slotWrap);
    daysWrap.appendChild(card);
  }

  // Buy price wiring
  buyPriceInput.value = state.buyPrice || "";
  buyPriceInput.addEventListener("input", () => {
    buyPriceInput.value = buyPriceInput.value.replace(/[^\d]/g, "").slice(0,3);
    state.buyPrice = buyPriceInput.value;
    persistState();
    renderInsights();
  });

  // Date label under buy
  const sunday = getMostRecentSunday();
  buyDateLabel.textContent = fmtMonthDay(sunday);
}

function persistState(){
  saveJSON(KEY_STATE, state);
}

function persistHistory(){
  saveJSON(KEY_HISTORY, history);
}

function persistSettings(){
  saveJSON(KEY_SETTINGS, settings);
}

// Chart: 12 slots across Mon..Sat AM/PM
function getSlotList(){
  const slots = [];
  for(const day of DAYS){
    slots.push({ day, slot:"AM", val: state.prices[day].AM });
    slots.push({ day, slot:"PM", val: state.prices[day].PM });
  }
  return slots;
}

function parseVal(v){
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function computeInsights(){
  const buy = parseVal(state.buyPrice);

  const slots = getSlotList().map(s => ({
    ...s,
    num: parseVal(s.val)
  }));

  let best = null;
  let bestSlot = null;

  for(const s of slots){
    if(s.num == null) continue;
    if(best == null || s.num > best){
      best = s.num;
      bestSlot = s;
    }
  }

  let profit = null;
  if(buy != null && best != null){
    profit = best - buy;
  }

  // Super simple pattern label (not a real predictor)
  // Mixed if both up and down exist, Rising if last > first, Falling if last < first
  const nums = slots.map(s => s.num).filter(n => n != null);
  let pattern = "-";
  if(nums.length >= 2){
    const first = nums[0];
    const last = nums[nums.length - 1];
    const up = nums.some((n,i) => i>0 && n > nums[i-1]);
    const down = nums.some((n,i) => i>0 && n < nums[i-1]);

    if(up && down) pattern = "Mixed";
    else if(last > first) pattern = "Rising";
    else if(last < first) pattern = "Falling";
    else pattern = "Flat";
  }

  return { buy, best, bestSlot, profit, pattern, slots };
}

function renderChart(){
  // dots (always 12)
  chartDots.innerHTML = "";
  chartIcons.innerHTML = "";

  const { slots } = computeInsights();

  for(let i=0; i<12; i++){
    const d = document.createElement("div");
    d.className = "dot";
    chartDots.appendChild(d);

    const ico = document.createElement("div");
    ico.className = "ico";

    // Only show icons where there is data in that slot.
    const hasVal = slots[i] && slots[i].num != null;
    if(hasVal){
      ico.textContent = slots[i].slot === "AM" ? "☀️" : "🌙";
    }else{
      ico.textContent = "";
    }

    chartIcons.appendChild(ico);
  }
}

function renderStats(){
  const { buy, best, bestSlot, profit, pattern } = computeInsights();

  statBuy.textContent = buy != null ? String(buy) : "-";
  statBest.textContent = best != null ? String(best) : "-";

  if(bestSlot){
    const shortDay = bestSlot.day.slice(0,3);
    statBestTime.textContent = `${shortDay} ${bestSlot.slot}`;
  }else{
    statBestTime.textContent = "-";
  }

  if(profit != null){
    const sign = profit > 0 ? "+" : "";
    statProfit.textContent = `${sign}${profit}`;
  }else{
    statProfit.textContent = "-";
  }

  statPattern.textContent = pattern || "-";
}

function renderHistory(){
  if(!history.length){
    historyList.textContent = "No saved weeks yet.";
    return;
  }

  historyList.innerHTML = "";
  history
    .slice()
    .sort((a,b) => (a.weekId < b.weekId ? 1 : -1))
    .forEach(item => {
      const div = document.createElement("div");
      div.className = "history-item";
      const when = item.weekId;
      const buy = item.buyPrice ? item.buyPrice : "-";
      const best = item.best != null ? item.best : "-";
      const bestTime = item.bestTime || "-";
      div.textContent = `${when}  |  Buy ${buy}  |  Best ${best} (${bestTime})`;
      historyList.appendChild(div);
    });
}

function renderInsights(){
  renderChart();
  renderStats();
  renderHistory();
}

function applySettings(){
  // Pattern strength: 0..100 -> opacity 0..0.65 (keeps it subtle)
  const s = Number(settings.patternStrength ?? 35);
  const op = Math.min(0.65, Math.max(0, s / 100 * 0.65));
  document.documentElement.style.setProperty("--pattern-opacity", String(op));
  patternStrength.value = String(s);
}

function go(page){
  pages.forEach(p => {
    const isTarget = p.dataset.page === page;
    p.hidden = !isTarget;
  });

  navButtons.forEach(b => {
    b.classList.toggle("is-active", b.dataset.go === page);
  });

  // quick refresh to avoid stale sections
  if(page === "insights"){
    renderInsights();
  }
}

function saveWeekToHistory(){
  const { buy, best, bestSlot } = computeInsights();
  const sunday = getMostRecentSunday();
  const weekId = isoDate(sunday);

  const bestTime = bestSlot ? `${bestSlot.day.slice(0,3)} ${bestSlot.slot}` : "-";

  const snapshot = {
    weekId,
    buyPrice: buy != null ? String(buy) : "",
    best,
    bestTime,
    prices: state.prices
  };

  // Replace if already exists
  history = history.filter(h => h.weekId !== weekId);
  history.push(snapshot);
  persistHistory();

  // Clear entry for same week (but keep the weekId)
  const fresh = defaultState();
  fresh.weekId = state.weekId;
  state = fresh;
  persistState();

  // Rebuild UI
  buildEntry();
  renderInsights();
}

function resetThisWeek(){
  const fresh = defaultState();
  fresh.weekId = state.weekId;
  state = fresh;
  persistState();
  buildEntry();
  renderInsights();
}

// Init
(function init(){
  // Force current week check on load
  state = ensureCurrentWeek(state);
  persistState();

  buildEntry();
  applySettings();
  renderInsights();

  // Nav wiring
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => go(btn.dataset.go));
  });

  // Buttons
  saveWeekBtn.addEventListener("click", saveWeekToHistory);
  resetWeekBtn.addEventListener("click", resetThisWeek);

  clearHistoryBtn.addEventListener("click", () => {
    history = [];
    persistHistory();
    renderHistory();
  });

  // Settings
  patternStrength.addEventListener("input", () => {
    settings.patternStrength = Number(patternStrength.value);
    persistSettings();
    applySettings();
  });

  // Default page
  go("entry");
})();
