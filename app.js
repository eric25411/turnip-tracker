/* Turnip Tracker - single file app.js
   - Entry: buy price + Mon-Sat AM/PM inputs + save week at bottom
   - Insights: postcard + stats + history (history only here)
   - Settings: backup / restore / reset week only
*/

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_FULL = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const LS_KEYS = {
  current: "tt_current_week",
  history: "tt_history"
};

function pad2(n){ return String(n).padStart(2,"0"); }

function getWeekStartMonday(d = new Date()){
  // local Monday start
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // Sun=0 ... Sat=6
  const diff = (day === 0) ? -6 : (1 - day); // Monday
  date.setDate(date.getDate() + diff);
  return date;
}
function formatMonthDay(date){
  const m = date.toLocaleString(undefined, { month: "short" });
  return `${m} ${date.getDate()}`;
}
function getWeekEndSunday(weekStartMonday){
  const d = new Date(weekStartMonday);
  d.setDate(d.getDate() + 6); // Sunday
  return d;
}

function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch(e){
    return fallback;
  }
}
function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function blankWeek(){
  return {
    weekStartISO: null,
    buyPrice: "",
    entries: {
      Mon:{AM:"",PM:""},
      Tue:{AM:"",PM:""},
      Wed:{AM:"",PM:""},
      Thu:{AM:"",PM:""},
      Fri:{AM:"",PM:""},
      Sat:{AM:"",PM:""}
    }
  };
}

function getCurrentWeek(){
  const monday = getWeekStartMonday(new Date());
  const iso = monday.toISOString().slice(0,10);
  let current = loadJSON(LS_KEYS.current, null);

  if(!current || current.weekStartISO !== iso){
    // new week, but keep if user wants to continue old week? For now, auto switch.
    current = blankWeek();
    current.weekStartISO = iso;
    saveJSON(LS_KEYS.current, current);
  }
  return current;
}

function setCurrentWeek(weekObj){
  saveJSON(LS_KEYS.current, weekObj);
}

function getHistory(){
  return loadJSON(LS_KEYS.history, []);
}
function setHistory(arr){
  saveJSON(LS_KEYS.history, arr);
}

/* ---------- UI build ---------- */

const daysWrap = document.getElementById("daysWrap");
const buyPriceInput = document.getElementById("buyPrice");
const weekLabel = document.getElementById("weekLabel");

const saveWeekBtn = document.getElementById("saveWeekBtn");

const statBuy = document.getElementById("statBuy");
const statBest = document.getElementById("statBest");
const statBestTime = document.getElementById("statBestTime");
const statProfit = document.getElementById("statProfit");

const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

const backupBtn = document.getElementById("backupBtn");
const restoreBtn = document.getElementById("restoreBtn");
const restoreFile = document.getElementById("restoreFile");
const resetWeekBtn = document.getElementById("resetWeekBtn");

const postcardSvg = document.getElementById("postcardSvg");

function buildDaysUI(){
  daysWrap.innerHTML = "";
  DAY_FULL.forEach((name, i) => {
    const key = DAYS[i];

    const card = document.createElement("div");
    card.className = "card day-card";

    const h = document.createElement("h3");
    h.className = "day-title";
    h.textContent = name;
    card.appendChild(h);

    const rowAM = buildRow(key, "AM", "🌞");
    const rowPM = buildRow(key, "PM", "🌙");
    card.appendChild(rowAM);
    card.appendChild(rowPM);

    daysWrap.appendChild(card);
  });
}

function buildRow(dayKey, slot, emoji){
  const row = document.createElement("div");
  row.className = "row";

  const left = document.createElement("div");
  left.className = "row-left";

  const em = document.createElement("span");
  em.className = "row-emoji";
  em.textContent = emoji;

  const label = document.createElement("div");
  label.className = "row-label";
  label.textContent = slot;

  left.appendChild(em);
  left.appendChild(label);

  const right = document.createElement("div");
  right.className = "row-right";

  const input = document.createElement("input");
  input.className = "input day-input";
  input.inputMode = "numeric";
  input.placeholder = "-";
  input.dataset.day = dayKey;
  input.dataset.slot = slot;

  input.addEventListener("input", () => {
    const w = getCurrentWeek();
    w.entries[dayKey][slot] = input.value.trim();
    setCurrentWeek(w);
    refreshInsights();
  });

  right.appendChild(input);
  row.appendChild(left);
  row.appendChild(right);

  return row;
}

function loadWeekIntoUI(){
  const w = getCurrentWeek();

  // label uses week end date (Sunday), matches your earlier "Jan 5" look
  const monday = new Date(w.weekStartISO + "T00:00:00");
  const sunday = getWeekEndSunday(monday);
  weekLabel.textContent = formatMonthDay(sunday);

  buyPriceInput.value = w.buyPrice || "";
  buyPriceInput.addEventListener("input", () => {
    const ww = getCurrentWeek();
    ww.buyPrice = buyPriceInput.value.trim();
    setCurrentWeek(ww);
    refreshInsights();
  });

  document.querySelectorAll(".day-input").forEach(inp => {
    const day = inp.dataset.day;
    const slot = inp.dataset.slot;
    inp.value = w.entries?.[day]?.[slot] ?? "";
  });
}

/* ---------- Nav ---------- */

function showPage(which){
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(`page-${which}`).classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`.nav-btn[data-page="${which}"]`).classList.add("active");

  if(which === "insights") refreshInsights();
  if(which === "entry") loadWeekIntoUI();
}

document.getElementById("navEntry").addEventListener("click", () => showPage("entry"));
document.getElementById("navInsights").addEventListener("click", () => showPage("insights"));
document.getElementById("navSettings").addEventListener("click", () => showPage("settings"));

/* ---------- Save week + history ---------- */

function weekSummary(weekObj){
  const monday = new Date(weekObj.weekStartISO + "T00:00:00");
  const sunday = getWeekEndSunday(monday);
  const label = `${formatMonthDay(monday)} – ${formatMonthDay(sunday)}`;

  let filled = 0;
  for(const d of DAYS){
    if((weekObj.entries?.[d]?.AM || "").trim()) filled++;
    if((weekObj.entries?.[d]?.PM || "").trim()) filled++;
  }

  return { label, filled };
}

saveWeekBtn.addEventListener("click", () => {
  const w = getCurrentWeek();
  const hist = getHistory();

  // store snapshot
  const snap = {
    id: cryptoRandomId(),
    savedAt: new Date().toISOString(),
    weekStartISO: w.weekStartISO,
    buyPrice: w.buyPrice || "",
    entries: w.entries
  };

  hist.unshift(snap);
  setHistory(hist);

  // clear current week values (keep same weekStart)
  const cleared = blankWeek();
  cleared.weekStartISO = w.weekStartISO;
  setCurrentWeek(cleared);

  loadWeekIntoUI();
  refreshInsights();
  alert("Saved to History.");
});

function cryptoRandomId(){
  try{
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    return `${a[0].toString(16)}${a[1].toString(16)}`;
  }catch(e){
    return String(Date.now());
  }
}

clearHistoryBtn.addEventListener("click", () => {
  if(!confirm("Clear all saved weeks?")) return;
  setHistory([]);
  refreshInsights();
});

/* ---------- Insights: stats + postcard + history list ---------- */

function refreshInsights(){
  const w = getCurrentWeek();
  const hist = getHistory();

  // Stats (best price and best time based on current week only)
  const buy = parseFloat((w.buyPrice || "").trim());
  const buyNum = Number.isFinite(buy) ? buy : null;
  statBuy.textContent = buyNum === null ? "-" : String(buyNum);

  let bestPrice = null;
  let bestTime = null;

  for(let i=0;i<DAYS.length;i++){
    const d = DAYS[i];
    const am = parseFloat((w.entries[d].AM || "").trim());
    const pm = parseFloat((w.entries[d].PM || "").trim());

    if(Number.isFinite(am)){
      if(bestPrice === null || am > bestPrice){
        bestPrice = am; bestTime = `${DAYS[i]} AM`;
      }
    }
    if(Number.isFinite(pm)){
      if(bestPrice === null || pm > bestPrice){
        bestPrice = pm; bestTime = `${DAYS[i]} PM`;
      }
    }
  }

  statBest.textContent = bestPrice === null ? "-" : String(bestPrice);
  statBestTime.textContent = bestTime === null ? "-" : bestTime;

  if(buyNum !== null && bestPrice !== null){
    statProfit.textContent = String(bestPrice - buyNum);
  }else{
    statProfit.textContent = "-";
  }

  drawPostcard(w);
  renderHistory(hist);
}

function renderHistory(hist){
  historyList.innerHTML = "";

  if(!hist || hist.length === 0){
    historyEmpty.style.display = "block";
    return;
  }
  historyEmpty.style.display = "none";

  hist.slice(0, 24).forEach(item => {
    const wrap = document.createElement("div");
    wrap.className = "history-item";

    const top = document.createElement("div");
    top.className = "history-item-top";

    const sum = weekSummary(item);

    const left = document.createElement("div");
    left.className = "history-week";
    left.textContent = sum.label;

    const right = document.createElement("div");
    right.className = "history-meta";
    right.textContent = `${sum.filled} slots`;

    top.appendChild(left);
    top.appendChild(right);

    wrap.appendChild(top);
    historyList.appendChild(wrap);
  });
}

/* Postcard design: clean, spaced, no line running through labels */
function drawPostcard(weekObj){
  const svg = postcardSvg;
  while(svg.firstChild) svg.removeChild(svg.firstChild);

  const W = 340, H = 150;

  const marginLeft = 54;
  const marginRight = 18;
  const yAM = 48;
  const yPM = 90;

  const x0 = marginLeft;
  const x1 = W - marginRight;

  // Background guide lines (subtle)
  svg.appendChild(line(x0, yAM, x1, yAM, "#94a3b8", 6, 0.35));
  svg.appendChild(line(x0, yPM, x1, yPM, "#94a3b8", 6, 0.35));

  // Labels AM/PM
  svg.appendChild(textNode(14, yAM+6, "AM", 18, 900, "#6b7280"));
  svg.appendChild(textNode(14, yPM+6, "PM", 18, 900, "#6b7280"));

  // Day labels
  const xs = [];
  for(let i=0;i<DAYS.length;i++){
    const x = x0 + (i * (x1 - x0) / (DAYS.length - 1));
    xs.push(x);
    svg.appendChild(textNode(x, 132, DAYS[i], 18, 900, "#6b7280", "middle"));
  }

  // Dots
  for(let i=0;i<DAYS.length;i++){
    const d = DAYS[i];
    const hasAM = (weekObj.entries[d].AM || "").trim().length > 0;
    const hasPM = (weekObj.entries[d].PM || "").trim().length > 0;

    svg.appendChild(circle(xs[i], yAM, 10, hasAM ? "#6b7280" : "#9ca3af", hasAM ? 0.95 : 0.55));
    svg.appendChild(circle(xs[i], yPM, 10, hasPM ? "#6b7280" : "#9ca3af", hasPM ? 0.95 : 0.55));
  }
}

function line(x1,y1,x2,y2,stroke,w,op){
  const el = document.createElementNS("http://www.w3.org/2000/svg","line");
  el.setAttribute("x1",x1); el.setAttribute("y1",y1);
  el.setAttribute("x2",x2); el.setAttribute("y2",y2);
  el.setAttribute("stroke",stroke);
  el.setAttribute("stroke-width",w);
  el.setAttribute("stroke-linecap","round");
  el.setAttribute("opacity",op);
  return el;
}
function circle(cx,cy,r,fill,op){
  const el = document.createElementNS("http://www.w3.org/2000/svg","circle");
  el.setAttribute("cx",cx); el.setAttribute("cy",cy);
  el.setAttribute("r",r);
  el.setAttribute("fill",fill);
  el.setAttribute("opacity",op);
  return el;
}
function textNode(x,y,txt,size,weight,color,anchor="start"){
  const el = document.createElementNS("http://www.w3.org/2000/svg","text");
  el.setAttribute("x",x); el.setAttribute("y",y);
  el.setAttribute("fill",color);
  el.setAttribute("font-size",size);
  el.setAttribute("font-weight",weight);
  el.setAttribute("font-family","system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif");
  el.setAttribute("text-anchor",anchor);
  el.textContent = txt;
  return el;
}

/* ---------- Settings: backup / restore / reset week ---------- */

backupBtn.addEventListener("click", () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    currentWeek: loadJSON(LS_KEYS.current, blankWeek()),
    history: getHistory()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `turnip-tracker-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

restoreBtn.addEventListener("click", () => {
  restoreFile.value = "";
  restoreFile.click();
});

restoreFile.addEventListener("change", async () => {
  const file = restoreFile.files?.[0];
  if(!file) return;

  try{
    const text = await file.text();
    const data = JSON.parse(text);

    if(!data || typeof data !== "object") throw new Error("Invalid file");

    if(data.currentWeek) saveJSON(LS_KEYS.current, data.currentWeek);
    if(Array.isArray(data.history)) setHistory(data.history);

    loadWeekIntoUI();
    refreshInsights();
    alert("Restore complete.");
  }catch(e){
    alert("Restore failed. Make sure you picked a valid Turnip Tracker backup file.");
  }
});

resetWeekBtn.addEventListener("click", () => {
  if(!confirm("Reset current week entries?")) return;
  const w = getCurrentWeek();
  const cleared = blankWeek();
  cleared.weekStartISO = w.weekStartISO;
  setCurrentWeek(cleared);
  loadWeekIntoUI();
  refreshInsights();
});

/* ---------- Init ---------- */

buildDaysUI();
loadWeekIntoUI();
refreshInsights();
showPage("entry");
