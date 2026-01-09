/* Turnip Tracker vFull
   Entry + Insights + Settings
   Data stored in localStorage
*/

const $ = (id) => document.getElementById(id);

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SLOTS = [
  { key: "AM", label: "AM", icon: "☀️" },
  { key: "PM", label: "PM", icon: "🌙" },
];

// 12 points Mon AM..Sat PM
function pointsOrder() {
  const out = [];
  for (const d of DAYS) {
    for (const s of SLOTS) out.push(`${d}_${s.key}`);
  }
  return out;
}

function pad2(n){ return String(n).padStart(2,"0"); }

function getLocalDate(){
  return new Date();
}

// Most recent Sunday (including today if Sunday)
function getSunday(d = getLocalDate()){
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = dt.getDay(); // Sun=0
  const diff = day; // how many days since Sunday
  dt.setDate(dt.getDate() - diff);
  return dt;
}

function formatMonthDay(dt){
  const m = dt.toLocaleString(undefined, { month: "short" });
  return `${m} ${dt.getDate()}`;
}

function weekKeyForDate(dt){
  // Use Sunday as week anchor
  const s = getSunday(dt);
  return `week_${s.getFullYear()}-${pad2(s.getMonth()+1)}-${pad2(s.getDate())}`;
}

function lsGet(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(raw === null) return fallback;
    return JSON.parse(raw);
  }catch{
    return fallback;
  }
}

function lsSet(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}

/* ---------- State ---------- */
const STATE = {
  weekKey: weekKeyForDate(getLocalDate()),
  data: {
    buyPrice: "",
    prices: {}, // { Monday_AM: "102", ... }
  },
  history: [], // array of { weekKey, sundayLabel, buyPrice, best, bestTime, profit, pattern, prices }
  compact: false,
};

/* ---------- UI: Pages ---------- */
function setActiveNav(btnId){
  ["navEntry","navInsights","navSettings"].forEach(id=>{
    const el = $(id);
    if(!el) return;
    el.classList.toggle("navActive", id === btnId);
  });
}

function showPage(pageId){
  ["page-entry","page-insights","page-settings"].forEach(id=>{
    const el = $(id);
    if(!el) return;
    el.classList.toggle("page-active", id === pageId);
  });

  if(pageId === "page-insights"){
    renderInsights();
  }
}

/* ---------- Build Entry Day Cards ---------- */
function buildDays(){
  const wrap = $("days");
  wrap.innerHTML = "";

  for (const day of DAYS){
    const card = document.createElement("div");
    card.className = "dayCard";

    const title = document.createElement("div");
    title.className = "dayTitle";
    title.textContent = day;
    card.appendChild(title);

    for (const slot of SLOTS){
      const row = document.createElement("div");
      row.className = "slot";

      const left = document.createElement("div");
      left.className = "slotLeft";

      const emoji = document.createElement("div");
      emoji.className = "slotEmoji";
      emoji.textContent = slot.icon;

      const label = document.createElement("div");
      label.textContent = slot.label;

      left.appendChild(emoji);
      left.appendChild(label);

      const input = document.createElement("input");
      input.className = "slotInput";
      input.inputMode = "numeric";
      input.pattern = "[0-9]*";
      input.placeholder = "-";
      input.setAttribute("aria-label", `${day} ${slot.label} price`);
      input.dataset.key = `${day}_${slot.key}`;

      input.addEventListener("input", () => {
        // keep only digits
        input.value = input.value.replace(/[^\d]/g, "");
        STATE.data.prices[input.dataset.key] = input.value;
        persistWeek();
      });

      row.appendChild(left);
      row.appendChild(input);
      card.appendChild(row);
    }

    wrap.appendChild(card);
  }
}

function fillEntryFromState(){
  $("buyPrice").value = STATE.data.buyPrice || "";
  $("buyPrice").dispatchEvent(new Event("input"));

  // fill day inputs
  document.querySelectorAll(".slotInput").forEach(inp=>{
    const k = inp.dataset.key;
    inp.value = (STATE.data.prices && STATE.data.prices[k]) ? STATE.data.prices[k] : "";
  });
}

/* ---------- Persistence ---------- */
function loadAll(){
  // compact
  STATE.compact = !!lsGet("tt_compact", false);
  document.body.classList.toggle("compact", STATE.compact);
  $("compactToggle").checked = STATE.compact;

  // week
  const wk = STATE.weekKey;
  const saved = lsGet(wk, null);
  if(saved){
    STATE.data = saved;
  }

  // history
  STATE.history = lsGet("tt_history", []);

  // sunday label
  const sunday = getSunday(getLocalDate());
  $("sundayLabel").textContent = formatMonthDay(sunday);
}

function persistWeek(){
  lsSet(STATE.weekKey, STATE.data);
}

function persistHistory(){
  lsSet("tt_history", STATE.history);
}

function clearCurrentWeek(){
  STATE.data = { buyPrice: "", prices: {} };
  persistWeek();
  fillEntryFromState();
}

/* ---------- Metrics / Pattern (simple + cozy) ---------- */
function toNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function computeMetrics(){
  const buy = toNum(STATE.data.buyPrice);
  const order = pointsOrder();
  const values = order
    .map(k => ({ k, v: toNum(STATE.data.prices[k]) }))
    .filter(x => x.v !== null);

  const best = values.length ? Math.max(...values.map(x=>x.v)) : null;
  const bestKV = best === null ? null : values.find(x => x.v === best);
  const bestTime = bestKV ? bestKV.k.replace("_", " ") : null;

  const profit = (buy !== null && best !== null) ? (best - buy) : null;

  // very simple "pattern" vibe label
  let pattern = "-";
  if(values.length >= 3){
    const first = values[0].v;
    const last = values[values.length - 1].v;
    if(last > first + 10) pattern = "Rising";
    else if(last < first - 10) pattern = "Falling";
    else pattern = "Mixed";
  }

  return { buy, best, bestTime, profit, pattern, valuesByOrder: order.map(k => toNum(STATE.data.prices[k])) };
}

/* ---------- Chart Rendering (SVG) ---------- */
function renderPostcard(){
  const svgPath = $("postcardPath");
  const dotsG = $("postcardDots");
  const labelsG = $("postcardLabels");

  dotsG.innerHTML = "";
  labelsG.innerHTML = "";

  const { valuesByOrder } = computeMetrics();

  // Chart area (inside viewBox)
  const left = 24, right = 336;
  const top = 26, bottom = 130; // baseline y is 130
  const baselineY = 130;

  // x positions for 12 points
  const n = 12;
  const xs = Array.from({length:n}, (_,i)=> left + ( (right-left) * (i/(n-1)) ));

  // y mapping
  const nums = valuesByOrder.filter(v => v !== null);
  const minV = nums.length ? Math.min(...nums) : 90;
  const maxV = nums.length ? Math.max(...nums) : 120;

  // keep some breathing room
  const span = Math.max(20, (maxV - minV));
  const yFor = (v) => {
    if(v === null) return baselineY;
    const t = (v - minV) / span;
    // invert so higher value is higher up
    return baselineY - (t * (baselineY - top));
  };

  // Build path
  let d = "";
  xs.forEach((x,i)=>{
    const y = yFor(valuesByOrder[i]);
    d += (i===0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
  });
  svgPath.setAttribute("d", d);

  // Dots + AM/PM icons above dots
  xs.forEach((x,i)=>{
    const y = yFor(valuesByOrder[i]);

    const dot = document.createElementNS("http://www.w3.org/2000/svg","circle");
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
    dot.setAttribute("r", "5");
    dot.setAttribute("class", "dot");
    dotsG.appendChild(dot);

    const isAM = (i % 2 === 0); // Mon AM is 0
    const icon = document.createElementNS("http://www.w3.org/2000/svg","text");
    icon.setAttribute("x", x);
    icon.setAttribute("y", y - 14);
    icon.setAttribute("text-anchor", "middle");
    icon.setAttribute("font-size", "14");
    icon.setAttribute("font-weight", "900");
    icon.setAttribute("fill", "rgba(0,0,0,.55)");
    icon.textContent = isAM ? "☀️" : "🌙";
    dotsG.appendChild(icon);
  });

  // Day labels (bigger)
  const dayXs = [0,2,4,6,8,10].map(i => xs[i]);
  const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat"];
  dayXs.forEach((x,idx)=>{
    const t = document.createElementNS("http://www.w3.org/2000/svg","text");
    t.setAttribute("x", x);
    t.setAttribute("y", 182);
    t.textContent = dayNames[idx];
    labelsG.appendChild(t);
  });
}

/* ---------- Insights Rendering ---------- */
function renderInsights(){
  const m = computeMetrics();

  $("mBuy").textContent = (m.buy === null ? "-" : String(m.buy));
  $("mBest").textContent = (m.best === null ? "-" : String(m.best));
  $("mBestTime").textContent = (m.bestTime === null ? "-" : m.bestTime);
  $("mProfit").textContent = (m.profit === null ? "-" : (m.profit >= 0 ? `+${m.profit}` : String(m.profit)));
  $("mPattern").textContent = m.pattern;

  renderPostcard();
  renderHistory();
}

function renderHistory(){
  const list = $("historyList");
  list.innerHTML = "";

  if(!STATE.history.length){
    const empty = document.createElement("div");
    empty.className = "historyMeta";
    empty.textContent = "No saved weeks yet. When you save a week, it shows up here.";
    list.appendChild(empty);
    return;
  }

  // newest first
  const items = [...STATE.history].reverse();

  items.forEach(item=>{
    const card = document.createElement("div");
    card.className = "historyItem";

    const top = document.createElement("div");
    top.className = "historyTop";

    const left = document.createElement("div");
    left.textContent = item.sundayLabel || item.weekKey;

    const right = document.createElement("div");
    right.textContent = (item.best ?? "-");

    top.appendChild(left);
    top.appendChild(right);

    const meta = document.createElement("div");
    meta.className = "historyMeta";
    const bestTime = item.bestTime ? `Best time: ${item.bestTime.replace("_"," ")}` : "Best time: -";
    const profit = (item.profit === null || item.profit === undefined) ? "-" : (item.profit >= 0 ? `+${item.profit}` : `${item.profit}`);
    meta.textContent = `Buy: ${item.buyPrice ?? "-"} , ${bestTime} , Profit: ${profit}`;

    card.appendChild(top);
    card.appendChild(meta);
    list.appendChild(card);
  });
}

/* ---------- Events ---------- */
function wireNav(){
  $("navEntry").addEventListener("click", ()=>{
    setActiveNav("navEntry");
    showPage("page-entry");
  });

  $("navInsights").addEventListener("click", ()=>{
    setActiveNav("navInsights");
    showPage("page-insights");
  });

  $("navSettings").addEventListener("click", ()=>{
    setActiveNav("navSettings");
    showPage("page-settings");
  });
}

function wireInputs(){
  $("buyPrice").addEventListener("input", ()=>{
    const inp = $("buyPrice");
    inp.value = inp.value.replace(/[^\d]/g, "");
    STATE.data.buyPrice = inp.value;
    persistWeek();
  });

  $("saveWeekBtn").addEventListener("click", ()=>{
    const sunday = getSunday(getLocalDate());
    const sundayLabel = formatMonthDay(sunday);

    const m = computeMetrics();
    const entry = {
      weekKey: STATE.weekKey,
      sundayLabel,
      buyPrice: (STATE.data.buyPrice || null),
      best: (m.best ?? null),
      bestTime: (m.bestTime ?? null),
      profit: (m.profit ?? null),
      pattern: (m.pattern ?? "-"),
      prices: STATE.data.prices || {}
    };

    STATE.history.push(entry);
    persistHistory();

    clearCurrentWeek();
    // bounce to insights so you can see it saved
    setActiveNav("navInsights");
    showPage("page-insights");
  });

  $("clearHistoryBtn").addEventListener("click", ()=>{
    STATE.history = [];
    persistHistory();
    renderHistory();
  });

  $("compactToggle").addEventListener("change", ()=>{
    STATE.compact = $("compactToggle").checked;
    document.body.classList.toggle("compact", STATE.compact);
    lsSet("tt_compact", STATE.compact);
  });

  $("resetWeekBtn").addEventListener("click", ()=>{
    clearCurrentWeek();
  });
}

/* ---------- Boot ---------- */
function init(){
  buildDays();
  loadAll();
  fillEntryFromState();
  wireNav();
  wireInputs();

  // default page
  setActiveNav("navEntry");
  showPage("page-entry");
}

init();
