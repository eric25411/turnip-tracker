const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SLOTS = [
  { key: "monAM", day:"Mon", label:"AM", icon:"☀️" },
  { key: "monPM", day:"Mon", label:"PM", icon:"🌙" },
  { key: "tueAM", day:"Tue", label:"AM", icon:"☀️" },
  { key: "tuePM", day:"Tue", label:"PM", icon:"🌙" },
  { key: "wedAM", day:"Wed", label:"AM", icon:"☀️" },
  { key: "wedPM", day:"Wed", label:"PM", icon:"🌙" },
  { key: "thuAM", day:"Thu", label:"AM", icon:"☀️" },
  { key: "thuPM", day:"Thu", label:"PM", icon:"🌙" },
  { key: "friAM", day:"Fri", label:"AM", icon:"☀️" },
  { key: "friPM", day:"Fri", label:"PM", icon:"🌙" },
  { key: "satAM", day:"Sat", label:"AM", icon:"☀️" },
  { key: "satPM", day:"Sat", label:"PM", icon:"🌙" },
];

const STORAGE_KEY = "turnip_tracker_v1";
const HISTORY_KEY = "turnip_tracker_history_v1";
const WEEK_START_KEY = "turnip_tracker_weekStartISO";

function loadState(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  }catch{
    return {};
  }
}
function saveState(state){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function loadHistory(){
  try{
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  }catch{
    return [];
  }
}
function saveHistory(list){
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function $(sel){ return document.querySelector(sel); }
function clampNum(v){
  const n = parseInt(String(v || "").replace(/[^\d]/g,""), 10);
  return Number.isFinite(n) ? n : null;
}

function buildEntry(){
  const daysEl = $("#days");
  daysEl.innerHTML = "";

  const state = loadState();

  // Buy price wiring
  const buyInput = $("#buyPrice");
  buyInput.value = state.buyPrice ?? "";
  buyInput.addEventListener("input", () => {
    const v = clampNum(buyInput.value);
    state.buyPrice = v;
    saveState(state);
    refreshInsights();
  });

  // Date label (month + day, no year)
  $("#buy-date-label").textContent = sundayLabel();

  DAYS.forEach((dayName, idx) => {
    const card = document.createElement("div");
    card.className = "day-card";

    const h = document.createElement("div");
    h.className = "day-title";
    h.textContent = dayName;
    card.appendChild(h);

    const amKey = slotKey(idx, true);
    const pmKey = slotKey(idx, false);

    card.appendChild(buildSlot("☀️", "AM", amKey, state));
    card.appendChild(buildSlot("🌙", "PM", pmKey, state));

    daysEl.appendChild(card);
  });
}

function buildSlot(icon, label, key, state){
  const row = document.createElement("div");
  row.className = "slot";

  const left = document.createElement("div");
  left.className = "slot-left";
  left.innerHTML = `<span class="slot-ico">${icon}</span><span>${label}</span>`;

  const input = document.createElement("input");
  input.className = "pill-input slot-input";
  input.inputMode = "numeric";
  input.pattern = "[0-9]*";
  input.placeholder = "-";
  input.maxLength = 4;
  input.value = state[key] ?? "";

  input.addEventListener("input", () => {
    const v = clampNum(input.value);
    state[key] = v;
    saveState(state);
    refreshInsights();
  });

  row.appendChild(left);
  row.appendChild(input);
  return row;
}

function slotKey(dayIndex, isAM){
  const map = ["mon","tue","wed","thu","fri","sat"][dayIndex];
  return map + (isAM ? "AM" : "PM");
}

function sundayLabel() {
  const iso = getWeekStartISO();
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const month = dt.toLocaleString(undefined, { month: "short" });
  return `${month} ${dt.getDate()}`;
}

function setPage(target){
  document.querySelectorAll(".page").forEach(p => p.classList.remove("is-active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("is-active"));

  $("#page-" + target).classList.add("is-active");
  document.querySelector(`.nav-btn[data-target="${target}"]`).classList.add("is-active");

  // keep scroll position sensible
  window.scrollTo({ top: 0, behavior: "instant" });
}

function buildChartScaffold(){
  const slotRow = $("#slotRow");
  slotRow.innerHTML = "";
  SLOTS.forEach((s) => {
    const span = document.createElement("div");
    span.className = "slot-ico-small";
    span.textContent = "•";
    slotRow.appendChild(span);
  });

  const dow = $("#dow");
  dow.innerHTML = "";
  ["Mon","Tue","Wed","Thu","Fri","Sat"].forEach(d => {
    const sp = document.createElement("span");
    sp.textContent = d;
    dow.appendChild(sp);
  });
}

function refreshInsights(){
  const state = loadState();

  // Pattern strength controls chart background opacity
  const strength = clampNum($("#patternStrength").value);
  const opacity = Math.min(0.75, Math.max(0.12, (strength ?? 35) / 100));
  document.documentElement.style.setProperty("--patternOpacity", String(opacity));

  // Chart icons: show sun/moon if a value exists, dot otherwise
  const slotRow = $("#slotRow");
  if (slotRow.children.length !== SLOTS.length) buildChartScaffold();

  SLOTS.forEach((s, i) => {
    const v = state[s.key];
    slotRow.children[i].textContent = (v == null) ? "•" : s.icon;
  });

  // Stats
  const buy = state.buyPrice ?? null;
  $("#statBuy").textContent = buy == null ? "-" : String(buy);

  // best seen and best time
  let best = null;
  let bestKey = null;
  for (const s of SLOTS){
    const v = state[s.key];
    if (v == null) continue;
    if (best == null || v > best){
      best = v;
      bestKey = s;
    }
  }
  $("#statBest").textContent = best == null ? "-" : String(best);
  $("#statBestTime").textContent = bestKey ? `${bestKey.day} ${bestKey.label}` : "-";

  // Profit vs buy
  if (buy != null && best != null){
    const diff = best - buy;
    $("#statProfit").textContent = (diff >= 0 ? "+" : "") + diff;
  } else {
    $("#statProfit").textContent = "-";
  }

  renderHistory();
}

function renderHistory(){
  const listEl = $("#historyList");
  const emptyEl = $("#historyEmpty");
  const hist = loadHistory();

  listEl.innerHTML = "";
  if (!hist.length){
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  hist.slice().reverse().forEach(item => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <div class="top">
        <span>${item.label}</span>
        <span>${item.best ?? "-"}</span>
      </div>
      <div class="sub">Best time: ${item.bestTime ?? "-" } · Buy: ${item.buy ?? "-"}</div>
    `;
    listEl.appendChild(div);
  });
}

function saveWeekToHistory(){
  const state = loadState();
  const buy = state.buyPrice ?? null;

  let best = null;
  let bestTime = null;
  for (const s of SLOTS){
    const v = state[s.key];
    if (v == null) continue;
    if (best == null || v > best){
      best = v;
      bestTime = `${s.day} ${s.label}`;
    }
  }

  const hist = loadHistory();
  hist.push({
    label: sundayLabel(),
    buy: buy,
    best: best,
    bestTime: bestTime,
    snapshot: {
      buyPrice: state.buyPrice ?? null,
      monAM: state.monAM ?? null,
      monPM: state.monPM ?? null,
      tueAM: state.tueAM ?? null,
      tuePM: state.tuePM ?? null,
      wedAM: state.wedAM ?? null,
      wedPM: state.wedPM ?? null,
      thuAM: state.thuAM ?? null,
      thuPM: state.thuPM ?? null,
      friAM: state.friAM ?? null,
      friPM: state.friPM ?? null,
      satAM: state.satAM ?? null,
      satPM: state.satPM ?? null,
    }
  });
  saveHistory(hist);

  // Clear entry values only (keep settings)
  const cleared = { };
  saveState(cleared);
  buildEntry();
  refreshInsights();
  alert("Saved to History.");
}

function resetWeek(){
  const ok = confirm("Reset Entry for this week?");
  if (!ok) return;
  saveState({});
  buildEntry();
  refreshInsights();
}

function clearHistory(){
  const ok = confirm("Clear History?");
  if (!ok) return;
  saveHistory([]);
  renderHistory();
}

function initNav(){
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => setPage(btn.dataset.target));
  });
}

function init(){
  // Defaults
  buildEntry();
  buildChartScaffold();

  // Load pattern strength preference
  const savedStrength = localStorage.getItem("turnip_pattern_strength");
  const slider = $("#patternStrength");
  if (savedStrength != null) slider.value = savedStrength;
  slider.addEventListener("input", () => {
    localStorage.setItem("turnip_pattern_strength", slider.value);
    refreshInsights();
  });

  $("#saveWeekBtn").addEventListener("click", saveWeekToHistory);
  $("#resetWeekBtn").addEventListener("click", resetWeek);
  $("#clearHistoryBtn").addEventListener("click", clearHistory);

  initNav();
  refreshInsights();
}

document.addEventListener("DOMContentLoaded", init);
function mostRecentSundayISO(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getWeekStartISO() {
  let iso = localStorage.getItem(WEEK_START_KEY);
  if (!iso) {
    iso = mostRecentSundayISO();
    localStorage.setItem(WEEK_START_KEY, iso);
  }
  return iso;
}

function setWeekStartToCurrent() {
  const iso = mostRecentSundayISO();
  localStorage.setItem(WEEK_START_KEY, iso);
  return iso;
}
