/* Turnip Tracker
   Week logic is Sunday to Saturday
   Buy price date shows the Sunday that starts the current week
*/

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" }
];

const DAY_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat"];

const STORAGE_KEY = "turnipTracker_v1";
const DEFAULT_BG = 35;

function pad2(n){ return String(n).padStart(2,"0"); }

function toISODate(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function formatMonthDay(d){
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/* Sunday based week start */
function getWeekStartSunday(d = new Date()){
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // Sun=0 ... Sat=6
  date.setDate(date.getDate() - day);
  return date;
}

function getWeekEndSaturday(weekStartSunday){
  const dd = new Date(weekStartSunday);
  dd.setDate(dd.getDate() + 6);
  return dd;
}

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return makeDefaultState();
  try{
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  }catch(e){
    return makeDefaultState();
  }
}

function saveState(state){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeDefaultState(){
  const weekStart = getWeekStartSunday(new Date());
  return {
    bgStrength: DEFAULT_BG,
    currentWeekStartISO: toISODate(weekStart),
    weeks: {
      [toISODate(weekStart)]: makeEmptyWeek(toISODate(weekStart))
    },
    history: []
  };
}

function normalizeState(s){
  const weekStart = getWeekStartSunday(new Date());
  const iso = toISODate(weekStart);

  const out = {
    bgStrength: Number.isFinite(+s.bgStrength) ? +s.bgStrength : DEFAULT_BG,
    currentWeekStartISO: typeof s.currentWeekStartISO === "string" ? s.currentWeekStartISO : iso,
    weeks: (s.weeks && typeof s.weeks === "object") ? s.weeks : {},
    history: Array.isArray(s.history) ? s.history : []
  };

  if (!out.weeks[out.currentWeekStartISO]){
    out.weeks[out.currentWeekStartISO] = makeEmptyWeek(out.currentWeekStartISO);
  }

  if (!out.weeks[iso]){
    out.weeks[iso] = makeEmptyWeek(iso);
  }

  out.currentWeekStartISO = iso;

  return out;
}

function makeEmptyWeek(weekStartISO){
  const entries = {};
  for (const d of DAYS){
    entries[d.key] = { am: "", pm: "" };
  }
  return {
    weekStartISO,
    buyPrice: "",
    entries
  };
}

function getCurrentWeek(state){
  const weekStart = getWeekStartSunday(new Date());
  const iso = toISODate(weekStart);

  if (!state.weeks[iso]){
    state.weeks[iso] = makeEmptyWeek(iso);
  }
  state.currentWeekStartISO = iso;
  return state.weeks[iso];
}

function setTurnipAlphaFromStrength(strength){
  const n = Math.max(0, Math.min(100, +strength || 0));
  const alpha = n / 100;
  document.documentElement.style.setProperty("--turnipAlpha", String(alpha));
}

function $(id){ return document.getElementById(id); }

function showScreen(target){
  const screens = document.querySelectorAll(".screen");
  screens.forEach(s => s.classList.remove("is-active"));
  $(`screen-${target}`).classList.add("is-active");

  const navItems = document.querySelectorAll(".navItem");
  navItems.forEach(n => n.classList.remove("is-active"));
  $(`nav${capitalize(target)}`).classList.add("is-active");
}

function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

/* UI build */
function buildDaysUI(){
  const wrap = $("daysWrap");
  wrap.className = "daysWrap";
  wrap.innerHTML = "";

  for (const d of DAYS){
    const card = document.createElement("div");
    card.className = "card dayCard";

    const title = document.createElement("div");
    title.className = "dayTitle";
    title.textContent = d.label;

    const rowAM = buildTimeRow(d.key, "am", "🌞", "AM");
    const div = document.createElement("div");
    div.className = "divider";
    const rowPM = buildTimeRow(d.key, "pm", "🌙", "PM");

    card.appendChild(title);
    card.appendChild(rowAM);
    card.appendChild(div);
    card.appendChild(rowPM);

    wrap.appendChild(card);
  }
}

function buildTimeRow(dayKey, timeKey, icon, label){
  const row = document.createElement("div");
  row.className = "timeRow";

  const left = document.createElement("div");
  left.className = "timeLeft";

  const ic = document.createElement("div");
  ic.className = "timeIcon";
  ic.textContent = icon;

  const lab = document.createElement("div");
  lab.className = "timeLabel";
  lab.textContent = label;

  left.appendChild(ic);
  left.appendChild(lab);

  const input = document.createElement("input");
  input.className = "input timeInput";
  input.inputMode = "numeric";
  input.placeholder = "-";
  input.dataset.day = dayKey;
  input.dataset.time = timeKey;

  row.appendChild(left);
  row.appendChild(input);

  return row;
}

/* Chart */
function buildChartSkeleton(){
  const am = $("chartAM");
  const pm = $("chartPM");
  const days = $("chartDays");

  am.innerHTML = "";
  pm.innerHTML = "";
  days.innerHTML = "";

  for (let i = 0; i < 6; i++){
    const dotA = document.createElement("div");
    dotA.className = "dot";
    dotA.dataset.index = String(i);
    am.appendChild(dotA);

    const dotP = document.createElement("div");
    dotP.className = "dot";
    dotP.dataset.index = String(i);
    pm.appendChild(dotP);
  }

  const spacer = document.createElement("div");
  spacer.className = "spacer";
  days.appendChild(spacer);

  for (let i = 0; i < 6; i++){
    const lab = document.createElement("div");
    lab.className = "dayLabel";
    lab.textContent = DAY_SHORT[i];
    days.appendChild(lab);
  }
}

function updateChartFromWeek(week){
  const amDots = Array.from($("chartAM").querySelectorAll(".dot"));
  const pmDots = Array.from($("chartPM").querySelectorAll(".dot"));

  const valuesAM = [];
  const valuesPM = [];

  for (let i = 0; i < DAYS.length; i++){
    const k = DAYS[i].key;
    valuesAM.push(week.entries[k].am);
    valuesPM.push(week.entries[k].pm);
  }

  for (let i = 0; i < 6; i++){
    const hasAM = (valuesAM[i] || "").trim() !== "" && (valuesAM[i] || "").trim() !== "-";
    const hasPM = (valuesPM[i] || "").trim() !== "" && (valuesPM[i] || "").trim() !== "-";

    amDots[i].classList.toggle("is-on", hasAM);
    pmDots[i].classList.toggle("is-on", hasPM);
  }
}

/* Stats */
function parseNum(s){
  const t = String(s || "").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

function computeStats(week){
  const buy = parseNum(week.buyPrice);
  let best = null;
  let bestKey = null;

  for (const d of DAYS){
    const am = parseNum(week.entries[d.key].am);
    const pm = parseNum(week.entries[d.key].pm);

    if (am !== null){
      if (best === null || am > best){
        best = am;
        bestKey = `${d.label} AM`;
      }
    }
    if (pm !== null){
      if (best === null || pm > best){
        best = pm;
        bestKey = `${d.label} PM`;
      }
    }
  }

  let profit = null;
  if (buy !== null && best !== null){
    profit = best - buy;
  }

  return { buy, best, bestKey, profit };
}

function renderStats(week){
  const s = computeStats(week);

  $("statBuy").textContent = (s.buy === null) ? "-" : String(s.buy);
  $("statBest").textContent = (s.best === null) ? "-" : String(s.best);
  $("statBestTime").textContent = (s.bestKey === null) ? "-" : s.bestKey;

  if (s.profit === null){
    $("statProfit").textContent = "-";
  }else{
    const sign = (s.profit > 0) ? "+" : "";
    $("statProfit").textContent = `${sign}${s.profit}`;
  }
}

/* History */
function weekRangeLabel(weekStartISO){
  const start = new Date(weekStartISO + "T00:00:00");
  const end = getWeekEndSaturday(start);
  return `${formatMonthDay(start)} to ${formatMonthDay(end)}`;
}

function renderHistory(state){
  const list = $("historyList");
  list.innerHTML = "";

  if (!state.history.length){
    const empty = document.createElement("div");
    empty.className = "historyItem";
    empty.innerHTML = `<div class="hLeft"><div class="hRange">No saved weeks yet.</div><div class="hMeta">Save a week from Entry.</div></div><div class="hRight"></div>`;
    list.appendChild(empty);
    return;
  }

  for (const item of state.history){
    const row = document.createElement("div");
    row.className = "historyItem";

    const left = document.createElement("div");
    left.className = "hLeft";

    const range = document.createElement("div");
    range.className = "hRange";
    range.textContent = weekRangeLabel(item.weekStartISO);

    const meta = document.createElement("div");
    meta.className = "hMeta";
    meta.textContent = `Buy: ${item.buyPrice || "-"}, Best: ${item.bestPrice ?? "-"}`;

    left.appendChild(range);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "hRight";
    right.textContent = item.bestTime || "";

    row.appendChild(left);
    row.appendChild(right);

    list.appendChild(row);
  }
}

function saveCurrentWeekToHistory(state){
  const week = getCurrentWeek(state);
  const stats = computeStats(week);

  const existingIndex = state.history.findIndex(h => h.weekStartISO === week.weekStartISO);
  const record = {
    weekStartISO: week.weekStartISO,
    buyPrice: (stats.buy === null) ? "" : String(stats.buy),
    bestPrice: (stats.best === null) ? null : stats.best,
    bestTime: stats.bestKey || ""
  };

  if (existingIndex >= 0){
    state.history[existingIndex] = record;
  }else{
    state.history.unshift(record);
  }

  saveState(state);
}

/* Backup and restore */
function downloadJSON(filename, obj){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function restoreFromFile(file, onDone){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(String(reader.result || ""));
      const normalized = normalizeState(parsed);
      saveState(normalized);
      onDone(normalized);
    }catch(e){
      alert("That backup file could not be read.");
    }
  };
  reader.readAsText(file);
}

/* Main bind */
function bindUI(state){
  buildDaysUI();
  buildChartSkeleton();

  const week = getCurrentWeek(state);

  const sunday = new Date(week.weekStartISO + "T00:00:00");
  $("buyDateLabel").textContent = formatMonthDay(sunday);

  $("buyPrice").value = week.buyPrice || "";

  const inputs = Array.from(document.querySelectorAll("input.timeInput"));
  for (const inp of inputs){
    const dayKey = inp.dataset.day;
    const timeKey = inp.dataset.time;
    inp.value = (week.entries[dayKey][timeKey] || "");
    inp.addEventListener("input", () => {
      week.entries[dayKey][timeKey] = inp.value;
      saveState(state);
      updateChartFromWeek(week);
      renderStats(week);
    });
  }

  $("buyPrice").addEventListener("input", () => {
    week.buyPrice = $("buyPrice").value;
    saveState(state);
    renderStats(week);
  });

  $("saveWeekBtn").addEventListener("click", () => {
    saveCurrentWeekToHistory(state);
    renderHistory(state);
    alert("Saved to History.");
  });

  $("clearHistoryBtn").addEventListener("click", () => {
    state.history = [];
    saveState(state);
    renderHistory(state);
  });

  $("backupBtn").addEventListener("click", () => {
    downloadJSON("turnip-tracker-backup.json", state);
  });

  $("restoreFile").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    restoreFromFile(file, (newState) => {
      state = newState;
      refreshAll(state);
      $("restoreFile").value = "";
      alert("Restore complete.");
    });
  });

  $("resetWeekBtn").addEventListener("click", () => {
    const iso = toISODate(getWeekStartSunday(new Date()));
    state.weeks[iso] = makeEmptyWeek(iso);
    state.currentWeekStartISO = iso;
    saveState(state);
    refreshAll(state);
    alert("Week reset.");
  });

  $("bgStrength").value = String(state.bgStrength ?? DEFAULT_BG);
  setTurnipAlphaFromStrength(state.bgStrength ?? DEFAULT_BG);

  $("bgStrength").addEventListener("input", () => {
    state.bgStrength = +$("bgStrength").value;
    setTurnipAlphaFromStrength(state.bgStrength);
    saveState(state);
  });

  $("navEntry").addEventListener("click", () => showScreen("entry"));
  $("navInsights").addEventListener("click", () => {
    showScreen("insights");
    renderHistory(state);
  });
  $("navSettings").addEventListener("click", () => showScreen("settings"));

  updateChartFromWeek(week);
  renderStats(week);
  renderHistory(state);
}

function refreshAll(state){
  const week = getCurrentWeek(state);

  const sunday = new Date(week.weekStartISO + "T00:00:00");
  $("buyDateLabel").textContent = formatMonthDay(sunday);

  $("buyPrice").value = week.buyPrice || "";

  const inputs = Array.from(document.querySelectorAll("input.timeInput"));
  for (const inp of inputs){
    const dayKey = inp.dataset.day;
    const timeKey = inp.dataset.time;
    inp.value = (week.entries[dayKey][timeKey] || "");
  }

  $("bgStrength").value = String(state.bgStrength ?? DEFAULT_BG);
  setTurnipAlphaFromStrength(state.bgStrength ?? DEFAULT_BG);

  updateChartFromWeek(week);
  renderStats(week);
  renderHistory(state);
}

(function init(){
  let state = loadState();

  const currentWeek = getCurrentWeek(state);
  if (!state.weeks[currentWeek.weekStartISO]){
    state.weeks[currentWeek.weekStartISO] = makeEmptyWeek(currentWeek.weekStartISO);
    saveState(state);
  }

  setTurnipAlphaFromStrength(state.bgStrength ?? DEFAULT_BG);
  bindUI(state);
  showScreen("entry");
})();
