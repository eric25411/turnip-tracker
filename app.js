/* Turnip Tracker – single file app
   Data stays via localStorage.
*/

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat"];

const LS_WEEK = "tt_current_week_v1";
const LS_HISTORY = "tt_history_v1";
const LS_PATTERN = "tt_pattern_strength_v1";

function $(id){ return document.getElementById(id); }

function safeNum(v){
  const n = parseInt(String(v || "").replace(/[^\d]/g,""), 10);
  return Number.isFinite(n) ? n : null;
}

function startOfThisWeekSunday(d = new Date()){
  // iOS-safe, local time.
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay(); // 0=Sun
  x.setDate(x.getDate() - dow);
  return x;
}

function fmtMonthDay(d){
  return d.toLocaleDateString(undefined, { month:"short", day:"numeric" });
}

function loadWeek(){
  try{
    const raw = localStorage.getItem(LS_WEEK);
    if(!raw) return freshWeek();
    const w = JSON.parse(raw);

    // If saved week is from a different Sunday, keep it (user may be mid-week),
    // but update buyDateLabel to current Sunday on screen.
    return {
      buyPrice: w.buyPrice ?? "",
      slots: w.slots ?? {},
    };
  }catch{
    return freshWeek();
  }
}

function freshWeek(){
  const slots = {};
  for(const day of DAYS){
    slots[day] = { AM:"", PM:"" };
  }
  return { buyPrice:"", slots };
}

function saveWeek(w){
  localStorage.setItem(LS_WEEK, JSON.stringify(w));
}

function loadHistory(){
  try{
    const raw = localStorage.getItem(LS_HISTORY);
    if(!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch{
    return [];
  }
}

function saveHistory(arr){
  localStorage.setItem(LS_HISTORY, JSON.stringify(arr));
}

function setActivePage(name){
  const pages = ["entry","insights","settings"];
  pages.forEach(p=>{
    const el = $(`page-${p}`);
    if(el) el.classList.toggle("page--active", p === name);
  });

  document.querySelectorAll(".navBtn").forEach(btn=>{
    btn.classList.toggle("navBtn--active", btn.dataset.go === name);
  });

  // Re-render bits that matter
  if(name === "insights"){
    renderInsights();
    renderHistory();
  }
}

let week = loadWeek();
let history = loadHistory();

function buildEntryUI(){
  const stack = $("dayStack");
  stack.innerHTML = "";

  DAYS.forEach((day)=>{
    const card = document.createElement("section");
    card.className = "dayCard";
    card.innerHTML = `
      <h2 class="dayName">${day}</h2>

      <div class="slotRow">
        <div class="slotLeft">
          <div class="slotIcon">☀️</div>
          <div>AM</div>
        </div>
        <input class="slotInput" inputmode="numeric" pattern="[0-9]*" placeholder="-" data-day="${day}" data-slot="AM" aria-label="${day} AM price" />
      </div>

      <div class="slotRow">
        <div class="slotLeft">
          <div class="slotIcon">🌙</div>
          <div>PM</div>
        </div>
        <input class="slotInput" inputmode="numeric" pattern="[0-9]*" placeholder="-" data-day="${day}" data-slot="PM" aria-label="${day} PM price" />
      </div>
    `;
    stack.appendChild(card);
  });

  // wire inputs
  const buy = $("buyPrice");
  buy.value = week.buyPrice ?? "";
  buy.addEventListener("input", ()=>{
    week.buyPrice = buy.value;
    saveWeek(week);
  });

  document.querySelectorAll(".slotInput").forEach(inp=>{
    const day = inp.dataset.day;
    const slot = inp.dataset.slot;
    inp.value = week.slots?.[day]?.[slot] ?? "";

    inp.addEventListener("input", ()=>{
      week.slots[day][slot] = inp.value;
      saveWeek(week);
    });
  });

  // buy date label (current Sunday)
  const sunday = startOfThisWeekSunday(new Date());
  $("buyDateLabel").textContent = fmtMonthDay(sunday);
}

function computeStats(){
  const buy = safeNum(week.buyPrice);
  const points = []; // { dayIndex, slot, value }

  DAYS.forEach((day, i)=>{
    const am = safeNum(week.slots?.[day]?.AM);
    const pm = safeNum(week.slots?.[day]?.PM);
    if(am !== null) points.push({ dayIndex:i, slot:"AM", value:am });
    if(pm !== null) points.push({ dayIndex:i, slot:"PM", value:pm });
  });

  let best = null;
  let bestTime = null;

  points.forEach(p=>{
    if(best === null || p.value > best){
      best = p.value;
      bestTime = `${SHORT[p.dayIndex]} ${p.slot}`;
    }
  });

  let profit = null;
  if(buy !== null && best !== null){
    profit = best - buy;
  }

  let pattern = "-";
  if(points.length >= 3){
    // crude pattern guess based on slope of first vs last
    const first = points[0].value;
    const last = points[points.length - 1].value;
    const diff = last - first;
    if(Math.abs(diff) <= 10) pattern = "Mixed";
    else if(diff > 10) pattern = "Rising";
    else pattern = "Falling";
  }else if(points.length > 0){
    pattern = "Mixed";
  }

  return {
    buy,
    best,
    bestTime: bestTime ?? "-",
    profit,
    pattern
  };
}

function renderTimeline(){
  const dotsWrap = $("timelineDots");
  const daysWrap = $("timelineDays");
  dotsWrap.innerHTML = "";
  daysWrap.innerHTML = "";

  // 12 slots: Mon AM, Mon PM, ... Sat PM
  const slots = [];
  for(let i=0;i<6;i++){
    slots.push({ dayIndex:i, slot:"AM" });
    slots.push({ dayIndex:i, slot:"PM" });
  }

  slots.forEach(s=>{
    const g = document.createElement("div");
    g.className = "dotGroup";

    const mark = document.createElement("div");
    mark.className = "mark";

    const val = safeNum(week.slots?.[DAYS[s.dayIndex]]?.[s.slot]);
    if(val !== null){
      mark.textContent = s.slot === "AM" ? "☀️" : "🌙";
    }else{
      mark.textContent = ""; // no marker if no data
    }

    const dot = document.createElement("div");
    dot.className = "dot";

    g.appendChild(mark);
    g.appendChild(dot);
    dotsWrap.appendChild(g);
  });

  // day labels aligned under the 12-slot line (we place 6 labels centered under each day pair)
  SHORT.forEach((d)=>{
    const span = document.createElement("div");
    span.textContent = d;
    daysWrap.appendChild(span);
  });
}

function renderInsights(){
  const s = computeStats();

  $("statBuy").textContent = s.buy === null ? "-" : String(s.buy);
  $("statBest").textContent = s.best === null ? "-" : String(s.best);
  $("statBestTime").textContent = s.bestTime;
  $("statProfit").textContent =
    s.profit === null ? "-" : (s.profit >= 0 ? `+${s.profit}` : String(s.profit));
  $("statPattern").textContent = s.pattern;

  renderTimeline();
}

function renderHistory(){
  const list = $("historyList");
  list.innerHTML = "";

  if(!history.length){
    const empty = document.createElement("div");
    empty.className = "emptyNote";
    empty.textContent = "No saved weeks yet.";
    list.appendChild(empty);
    return;
  }

  history.slice().reverse().forEach(item=>{
    const el = document.createElement("div");
    el.className = "historyItem";

    el.innerHTML = `
      <div class="historyItemTitle">${item.title}</div>
      <div class="historyItemSub">Buy ${item.buy ?? "-"} • Best ${item.best ?? "-"} • ${item.bestTime ?? "-"}</div>
    `;
    list.appendChild(el);
  });
}

function hookNav(){
  document.querySelectorAll(".navBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      setActivePage(btn.dataset.go);
    });
  });
}

function hookActions(){
  $("saveWeekBtn").addEventListener("click", ()=>{
    const sunday = startOfThisWeekSunday(new Date());
    const title = `Week of ${fmtMonthDay(sunday)}`;

    const s = computeStats();
    history.push({
      ts: Date.now(),
      title,
      buy: s.buy,
      best: s.best,
      bestTime: s.bestTime,
      data: week
    });
    saveHistory(history);

    // clear current week
    week = freshWeek();
    saveWeek(week);

    // rebuild UI and move to insights so you see it worked
    buildEntryUI();
    renderInsights();
    renderHistory();
    setActivePage("insights");
  });

  $("resetWeekBtn").addEventListener("click", ()=>{
    if(!confirm("Reset this week? This clears Entry only.")) return;
    week = freshWeek();
    saveWeek(week);
    buildEntryUI();
    renderInsights();
  });

  $("clearHistoryBtn").addEventListener("click", ()=>{
    if(!confirm("Clear history?")) return;
    history = [];
    saveHistory(history);
    renderHistory();
  });

  const strength = $("patternStrength");
  const saved = localStorage.getItem(LS_PATTERN);
  if(saved !== null) strength.value = saved;

  function applyPattern(){
    const v = Number(strength.value || 0);
    localStorage.setItem(LS_PATTERN, String(v));
    // map 0..100 to opacity 0.05..0.55
    const op = 0.05 + (v/100) * 0.50;
    $("turnipPattern").style.opacity = String(op);
  }

  strength.addEventListener("input", applyPattern);
  applyPattern();
}

function boot(){
  hookNav();
  buildEntryUI();
  hookActions();

  // Default page
  setActivePage("entry");
}

boot();
