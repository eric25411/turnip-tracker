// app.js
const KEYS = {
  weeks: "turnipTracker_weeks_v2",
  current: "turnipTracker_current_v2"
};

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const el = (id) => document.getElementById(id);

function clampNum(v){
  const n = Number(String(v || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function getMostRecentSunday(d = new Date()){
  const x = new Date(d);
  x.setHours(12,0,0,0);
  const day = x.getDay(); // 0 Sun
  const diff = day; // days since Sunday
  x.setDate(x.getDate() - diff);
  x.setHours(12,0,0,0);
  return x;
}

function fmtMonthDay(d){
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getDraft(){
  try{
    return JSON.parse(localStorage.getItem(KEYS.current) || "{}") || {};
  } catch {
    return {};
  }
}

function setDraft(draft){
  localStorage.setItem(KEYS.current, JSON.stringify(draft || {}));
}

function getWeeks(){
  try{
    return JSON.parse(localStorage.getItem(KEYS.weeks) || "[]") || [];
  } catch {
    return [];
  }
}

function setWeeks(weeks){
  localStorage.setItem(KEYS.weeks, JSON.stringify(weeks || []));
}

function buildEmptyWeek(){
  const data = { buyPrice: "", soldSlot: "" };
  for (let di = 0; di < 6; di++){
    data[slotKey(di,"AM")] = "";
    data[slotKey(di,"PM")] = "";
  }
  return data;
}

function slotKey(dayIndex, period){
  return `${DAYS[dayIndex]}_${period}`; // Mon_AM
}

function slotLabel(dayIndex, period){
  return `${DAYS[dayIndex]} ${period}`;
}

function readUIToDraft(){
  const d = getDraft();
  d.buyPrice = (el("buyPrice")?.value || "").trim();

  for (let di = 0; di < 6; di++){
    const am = el(inputId(di,"AM"))?.value || "";
    const pm = el(inputId(di,"PM"))?.value || "";
    d[slotKey(di,"AM")] = String(am).trim();
    d[slotKey(di,"PM")] = String(pm).trim();
  }

  return d;
}

function writeDraftToUI(d){
  el("buyPrice").value = d.buyPrice || "";

  for (let di = 0; di < 6; di++){
    const amEl = el(inputId(di,"AM"));
    const pmEl = el(inputId(di,"PM"));
    if (amEl) amEl.value = d[slotKey(di,"AM")] ?? "";
    if (pmEl) pmEl.value = d[slotKey(di,"PM")] ?? "";
  }

  applySoldUI(d.soldSlot || "");
}

function inputId(dayIndex, period){
  return `inp_${DAYS[dayIndex]}_${period}`; // inp_Mon_AM
}

function rowId(dayIndex, period){
  return `row_${DAYS[dayIndex]}_${period}`;
}

function sellBtnId(dayIndex, period){
  return `sell_${DAYS[dayIndex]}_${period}`;
}

function setSoldSlot(slot){
  const d = readUIToDraft();
  d.soldSlot = slot || "";
  setDraft(d);
  applySoldUI(d.soldSlot);
  renderInsights();
}

function applySoldUI(soldSlot){
  for (let di = 0; di < 6; di++){
    for (const period of ["AM","PM"]){
      const r = el(rowId(di, period));
      const b = el(sellBtnId(di, period));
      const key = slotKey(di, period);

      if (!r || !b) continue;

      const isSold = soldSlot === key;
      r.classList.toggle("soldRow", isSold);

      if (isSold){
        b.innerHTML = `✅ <span>Sold</span>`;
      } else {
        b.innerHTML = `💰 <span>Sell</span>`;
      }
    }
  }
}

function renderDays(){
  const wrap = el("daysWrap");
  wrap.innerHTML = "";

  for (let di = 0; di < 6; di++){
    const card = document.createElement("div");
    card.className = "card dayCard";

    const title = document.createElement("h2");
    title.className = "dayTitle";
    title.textContent = DAY_NAMES[di];

    card.appendChild(title);

    for (const period of ["AM","PM"]){
      const row = document.createElement("div");
      row.className = "row";
      row.id = rowId(di, period);

      const label = document.createElement("div");
      label.className = "label";

      const emoji = document.createElement("span");
      emoji.className = "emoji";
      emoji.textContent = period === "AM" ? "🌞" : "🌙";

      const txt = document.createElement("span");
      txt.textContent = period;

      label.appendChild(emoji);
      label.appendChild(txt);

      const input = document.createElement("input");
      input.className = "input priceInput";
      input.inputMode = "numeric";
      input.placeholder = "-";
      input.id = inputId(di, period);

      input.addEventListener("input", () => {
        const d = readUIToDraft();
        setDraft(d);
        renderInsights();
      });

      const sellBtn = document.createElement("button");
      sellBtn.type = "button";
      sellBtn.className = "sellBtn";
      sellBtn.id = sellBtnId(di, period);

      sellBtn.addEventListener("click", () => {
        const key = slotKey(di, period);
        const d = readUIToDraft();

        if (d.soldSlot === key){
          setSoldSlot("");
        } else {
          setSoldSlot(key);
        }
      });

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(sellBtn);
      card.appendChild(row);
    }

    wrap.appendChild(card);
  }
}

function switchScreen(screenId){
  const screens = document.querySelectorAll(".screen");
  screens.forEach(s => s.classList.remove("is-active"));
  el(screenId).classList.add("is-active");

  document.querySelectorAll(".navItem").forEach(b => b.classList.remove("is-active"));
  if (screenId === "screen-entry") el("navEntry").classList.add("is-active");
  if (screenId === "screen-insights") el("navInsights").classList.add("is-active");
  if (screenId === "screen-settings") el("navSettings").classList.add("is-active");

  if (screenId === "screen-insights") renderHistory();
}

function getBestSlot(d){
  let best = { price: NaN, slot: "" };

  for (let di = 0; di < 6; di++){
    for (const period of ["AM","PM"]){
      const key = slotKey(di, period);
      const n = clampNum(d[key]);
      if (!Number.isFinite(n)) continue;

      if (!Number.isFinite(best.price) || n > best.price){
        best = { price: n, slot: key };
      }
    }
  }

  return best;
}

function parseSlotKey(key){
  if (!key) return null;
  const parts = key.split("_");
  if (parts.length !== 2) return null;
  const day = parts[0];
  const period = parts[1];
  const di = DAYS.indexOf(day);
  if (di < 0) return null;
  return { di, period };
}

function renderInsights(){
  const d = readUIToDraft();
  const buy = clampNum(d.buyPrice);
  const best = getBestSlot(d);

  // Stats
  el("statBuy").textContent = Number.isFinite(buy) ? `${buy}` : "-";
  el("statBest").textContent = Number.isFinite(best.price) ? `${best.price}` : "-";

  if (best.slot){
    const p = parseSlotKey(best.slot);
    el("statBestTime").textContent = p ? `${DAYS[p.di]} ${p.period}` : "-";
  } else {
    el("statBestTime").textContent = "-";
  }

  // Sold stat
  if (d.soldSlot){
    const p = parseSlotKey(d.soldSlot);
    el("statSold").textContent = p ? `${DAYS[p.di]} ${p.period}` : "-";
  } else {
    el("statSold").textContent = "-";
  }

  // Profit vs buy uses best so far
  if (Number.isFinite(buy) && Number.isFinite(best.price)){
    const diff = best.price - buy;
    const sign = diff >= 0 ? "+" : "";
    el("statProfit").textContent = `${sign}${diff}`;
  } else {
    el("statProfit").textContent = "-";
  }

  // Chart dots
  const chartAM = el("chartAM");
  const chartPM = el("chartPM");
  const chartDays = el("chartDays");
  chartAM.innerHTML = "";
  chartPM.innerHTML = "";
  chartDays.innerHTML = "";

  const bestKey = best.slot;
  const soldKey = d.soldSlot || "";

  for (let di = 0; di < 6; di++){
    for (const period of ["AM","PM"]){
      const key = slotKey(di, period);
      const n = clampNum(d[key]);
      const dot = document.createElement("div");
      dot.className = "dot";

      if (Number.isFinite(n)) dot.classList.add("filled");
      if (bestKey && key === bestKey) dot.classList.add("best");
      if (soldKey && key === soldKey) dot.classList.add("sold");

      if (period === "AM") chartAM.appendChild(dot);
      else chartPM.appendChild(dot);
    }

    const chip = document.createElement("div");
    chip.className = "dayChip";
    chip.textContent = DAYS[di];
    chartDays.appendChild(chip);
  }

  // Blurb
  const soldText = d.soldSlot ? `Sold: ${slotLabel(parseSlotKey(d.soldSlot).di, parseSlotKey(d.soldSlot).period)}.` : "Not marked as sold yet.";
  el("insightsBlurb").textContent = `${soldText} Your best time so far is highlighted.`;
}

function renderHistory(){
  const weeks = getWeeks();
  const list = el("historyList");
  const empty = el("historyEmptyNote");

  list.innerHTML = "";
  empty.style.display = weeks.length ? "none" : "block";

  weeks.forEach((w) => {
    const row = document.createElement("div");
    row.className = "weekRow";

    const top = document.createElement("div");
    top.className = "weekTop";

    const label = document.createElement("div");
    label.className = "weekLabel";
    label.textContent = w.label || "Saved week";

    const btns = document.createElement("div");
    btns.className = "weekBtns";

    const loadBtn = document.createElement("button");
    loadBtn.className = "smallBtn";
    loadBtn.textContent = "Load";
    loadBtn.addEventListener("click", () => {
      setDraft(w.data || buildEmptyWeek());
      writeDraftToUI(getDraft());
      renderInsights();
      switchScreen("screen-entry");
    });

    const delBtn = document.createElement("button");
    delBtn.className = "smallBtn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      const next = getWeeks().filter(x => x.id !== w.id);
      setWeeks(next);
      renderHistory();
    });

    btns.appendChild(loadBtn);
    btns.appendChild(delBtn);

    top.appendChild(label);
    top.appendChild(btns);

    const sub = document.createElement("div");
    sub.className = "weekSub";
    sub.textContent = w.summary || "";

    row.appendChild(top);
    row.appendChild(sub);
    list.appendChild(row);
  });
}

function makeWeekLabel(){
  const now = new Date();
  return `Saved ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function makeWeekSummary(d){
  const buy = clampNum(d.buyPrice);
  const best = getBestSlot(d);
  const sold = d.soldSlot ? (() => {
    const p = parseSlotKey(d.soldSlot);
    return p ? `${DAYS[p.di]} ${p.period}` : "-";
  })() : "-";

  const buyTxt = Number.isFinite(buy) ? `${buy}` : "-";
  const bestTxt = Number.isFinite(best.price) ? `${best.price}` : "-";
  const bestTimeTxt = best.slot ? (() => {
    const p = parseSlotKey(best.slot);
    return p ? `${DAYS[p.di]} ${p.period}` : "-";
  })() : "-";

  return `Buy ${buyTxt}. Best ${bestTxt} at ${bestTimeTxt}. Sold ${sold}.`;
}

function saveWeek(){
  const d = readUIToDraft();
  const weeks = getWeeks();

  const week = {
    id: `w_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    savedAt: new Date().toISOString(),
    label: makeWeekLabel(),
    summary: makeWeekSummary(d),
    data: d
  };

  weeks.unshift(week);
  setWeeks(weeks);

  // Reset current week draft
  const fresh = buildEmptyWeek();
  setDraft(fresh);
  writeDraftToUI(fresh);
  renderInsights();

  switchScreen("screen-insights");
}

function backup(){
  const payload = {
    exportedAt: new Date().toISOString(),
    weeks: getWeeks()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "turnip-tracker-backup.json";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

async function restoreFromFile(file){
  const text = await file.text();
  const parsed = JSON.parse(text);
  const incoming = Array.isArray(parsed.weeks) ? parsed.weeks : [];

  const existing = getWeeks();
  const map = new Map(existing.map(w => [w.id, w]));

  incoming.forEach(w => {
    if (w && w.id && w.data) map.set(w.id, w);
  });

  const merged = Array.from(map.values()).sort((a,b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
  setWeeks(merged);
  renderHistory();
}

function resetAll(){
  if (!confirm("Reset everything, including saved weeks?")) return;
  localStorage.removeItem(KEYS.weeks);
  localStorage.removeItem(KEYS.current);

  const fresh = buildEmptyWeek();
  setDraft(fresh);
  writeDraftToUI(fresh);
  renderInsights();
  renderHistory();
  switchScreen("screen-entry");
}

function initBuyDate(){
  const sun = getMostRecentSunday(new Date());
  el("buyDateLabel").textContent = `Sunday, ${fmtMonthDay(sun)}`;
}

function init(){
  initBuyDate();
  renderDays();

  // Load draft or create
  let d = getDraft();
  if (!d || typeof d !== "object" || Object.keys(d).length === 0){
    d = buildEmptyWeek();
    setDraft(d);
  }

  writeDraftToUI(d);
  renderInsights();
  renderHistory();

  // Nav
  el("navEntry").addEventListener("click", () => switchScreen("screen-entry"));
  el("navInsights").addEventListener("click", () => {
    renderInsights();
    renderHistory();
    switchScreen("screen-insights");
  });
  el("navSettings").addEventListener("click", () => switchScreen("screen-settings"));

  // Buy price input
  el("buyPrice").addEventListener("input", () => {
    const d2 = readUIToDraft();
    setDraft(d2);
    renderInsights();
  });

  // Save week
  el("saveWeekBtn").addEventListener("click", saveWeek);

  // Settings
  el("backupBtn").addEventListener("click", backup);
  el("restoreFile").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try{
      await restoreFromFile(f);
      alert("Restore complete.");
    } catch {
      alert("Restore failed. Make sure it is a valid backup JSON file.");
    } finally {
      e.target.value = "";
    }
  });

  el("resetAllBtn").addEventListener("click", resetAll);

  // Default screen
  switchScreen("screen-entry");
}

document.addEventListener("DOMContentLoaded", init);
