const STORAGE_WEEK = "tt_week_v1";
const STORAGE_HISTORY = "tt_history_v1";
const STORAGE_SETTINGS = "tt_settings_v1";

function getSundayStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function formatMonthDay(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isoDate(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function defaultWeek() {
  const sunday = getSundayStart(new Date());
  return {
    weekStartISO: isoDate(sunday),
    buyPrice: null,
    prices: new Array(12).fill(null),
  };
}

function defaultSettings() {
  return { turnipStrength: 16 };
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let week = loadJSON(STORAGE_WEEK, null);
let history = loadJSON(STORAGE_HISTORY, []);
let settings = loadJSON(STORAGE_SETTINGS, defaultSettings());

function ensureCurrentWeek() {
  const currentSundayISO = isoDate(getSundayStart(new Date()));
  if (!week || week.weekStartISO !== currentSundayISO) {
    week = defaultWeek();
    saveJSON(STORAGE_WEEK, week);
  }
}

const pages = {
  entry: document.getElementById("page-entry"),
  insights: document.getElementById("page-insights"),
  settings: document.getElementById("page-settings"),
};

const navButtons = {
  entry: document.getElementById("navEntry"),
  insights: document.getElementById("navInsights"),
  settings: document.getElementById("navSettings"),
};

const weekSundayLabel = document.getElementById("weekSundayLabel");
const buyPriceInput = document.getElementById("buyPriceInput");
const daysWrap = document.getElementById("daysWrap");
const saveWeekBtn = document.getElementById("saveWeekBtn");

const amSlots = document.getElementById("amSlots");
const pmSlots = document.getElementById("pmSlots");
const dayLabels = document.getElementById("dayLabels");

const statBuy = document.getElementById("statBuy");
const statBestPrice = document.getElementById("statBestPrice");
const statBestTime = document.getElementById("statBestTime");
const statProfit = document.getElementById("statProfit");
const statPattern = document.getElementById("statPattern");

const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

const patternStrength = document.getElementById("patternStrength");
const resetWeekBtn = document.getElementById("resetWeekBtn");

function showPage(name) {
  Object.keys(pages).forEach(k => pages[k].classList.toggle("hidden", k !== name));
  Object.keys(navButtons).forEach(k => navButtons[k].classList.toggle("active", k === name));

  if (name === "entry") renderEntry();
  if (name === "insights") renderInsights();
  if (name === "settings") renderSettings();
}

function initNav() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-nav");
      location.hash = target;
    });
  });

  window.addEventListener("hashchange", () => {
    const page = (location.hash || "#entry").replace("#", "");
    showPage(["entry", "insights", "settings"].includes(page) ? page : "entry");
  });
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function slotIndex(dayIndex, isPM) {
  return dayIndex * 2 + (isPM ? 1 : 0);
}

function renderEntry() {
  ensureCurrentWeek();

  const sunday = new Date(week.weekStartISO + "T00:00:00");
  weekSundayLabel.textContent = formatMonthDay(sunday);

  buyPriceInput.value = week.buyPrice ?? "";
  buyPriceInput.oninput = () => {
    const v = parseInt(buyPriceInput.value, 10);
    week.buyPrice = Number.isFinite(v) ? v : null;
    saveJSON(STORAGE_WEEK, week);
  };

  daysWrap.innerHTML = "";
  DAYS.forEach((dayName, dIdx) => {
    const card = document.createElement("section");
    card.className = "day-card";

    const title = document.createElement("h2");
    title.className = "day-title";
    title.textContent = dayName;
    card.appendChild(title);

    card.appendChild(makeSlotRow(dIdx, false));
    const hr = document.createElement("hr");
    hr.className = "hr-soft";
    card.appendChild(hr);
    card.appendChild(makeSlotRow(dIdx, true));

    daysWrap.appendChild(card);
  });

  saveWeekBtn.onclick = () => {
    const hasBuy = week.buyPrice != null;
    const hasAny = week.prices.some(x => x != null);
    if (!hasBuy && !hasAny) {
      alert("Nothing to save yet.");
      return;
    }

    const item = {
      weekStartISO: week.weekStartISO,
      buyPrice: week.buyPrice,
      prices: week.prices.slice(),
      savedAtISO: new Date().toISOString(),
    };

    history = [item, ...history].slice(0, 60);
    saveJSON(STORAGE_HISTORY, history);

    week = defaultWeek();
    saveJSON(STORAGE_WEEK, week);

    alert("Saved to History.");
    renderEntry();
  };
}

function makeSlotRow(dayIndex, isPM) {
  const row = document.createElement("div");
  row.className = "slot-row";

  const left = document.createElement("div");
  left.className = "slot-left";

  const ico = document.createElement("div");
  ico.className = "slot-ico";
  ico.textContent = isPM ? "🌙" : "☀️";

  const label = document.createElement("div");
  label.className = "slot-label";
  label.textContent = isPM ? "PM" : "AM";

  left.appendChild(ico);
  left.appendChild(label);

  const input = document.createElement("input");
  input.className = "slot-input";
  input.inputMode = "numeric";
  input.pattern = "[0-9]*";
  input.placeholder = "-";

  const idx = slotIndex(dayIndex, isPM);
  input.value = week.prices[idx] ?? "";

  input.oninput = () => {
    const v = parseInt(input.value, 10);
    week.prices[idx] = Number.isFinite(v) ? v : null;
    saveJSON(STORAGE_WEEK, week);
  };

  row.appendChild(left);
  row.appendChild(input);
  return row;
}

function renderInsights() {
  ensureCurrentWeek();
  applyPatternStrengthToCSS();

  amSlots.innerHTML = "";
  pmSlots.innerHTML = "";

  for (let i = 0; i < 12; i++) {
    const isPM = i % 2 === 1;
    const price = week.prices[i];

    const dot = document.createElement("div");
    dot.className = "slot-dot" + (price != null ? " filled" : "");

    if (price != null) {
      const mini = document.createElement("div");
      mini.className = "mini";
      mini.textContent = isPM ? "🌙" : "☀️";
      dot.appendChild(mini);
      dot.title = `${slotLabelFromIndex(i)}: ${price}`;
    } else {
      dot.title = slotLabelFromIndex(i) + ": -";
    }

    (isPM ? pmSlots : amSlots).appendChild(dot);
  }

  dayLabels.innerHTML = "";
  const spacer = document.createElement("div");
  spacer.className = "spacer";
  dayLabels.appendChild(spacer);

  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(d => {
    const el = document.createElement("div");
    el.className = "day-label";
    el.textContent = d;
    dayLabels.appendChild(el);
  });

  const buy = week.buyPrice;
  statBuy.textContent = buy != null ? String(buy) : "-";

  const allPrices = week.prices
    .map((p, idx) => (p == null ? null : { p, idx }))
    .filter(Boolean);

  if (allPrices.length === 0) {
    statBestPrice.textContent = "-";
    statBestTime.textContent = "-";
    statProfit.textContent = "-";
    statPattern.textContent = "-";
  } else {
    allPrices.sort((a, b) => b.p - a.p);
    const best = allPrices[0];
    statBestPrice.textContent = String(best.p);
    statBestTime.textContent = slotLabelFromIndex(best.idx);

    if (buy != null) {
      const profit = best.p - buy;
      statProfit.textContent = (profit >= 0 ? "+" : "") + String(profit);
    } else {
      statProfit.textContent = "-";
    }

    statPattern.textContent = estimatePattern(week.prices);
  }

  renderHistoryList();
}

function slotLabelFromIndex(i) {
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][Math.floor(i / 2)];
  const ap = i % 2 === 0 ? "AM" : "PM";
  return `${day} ${ap}`;
}

function estimatePattern(prices) {
  const filled = prices.filter(v => v != null).length;
  if (filled < 4) return "Need more data";

  const seq = prices.filter(v => v != null);
  let drops = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i] < seq[i - 1]) drops++;

  const peak = Math.max(...seq);
  const low = Math.min(...seq);

  if (peak >= 180) return "Big spike";
  if (drops >= Math.floor(seq.length * 0.6)) return "Decreasing";
  if ((peak - low) <= 30) return "Flat";
  return "Mixed";
}

function renderHistoryList() {
  historyList.innerHTML = "";

  if (!Array.isArray(history) || history.length === 0) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No saved weeks yet.";
    historyList.appendChild(empty);
    return;
  }

  history.slice(0, 20).forEach(item => {
    const wrap = document.createElement("div");
    wrap.className = "history-item";

    const top = document.createElement("div");
    top.className = "top";

    const left = document.createElement("div");
    const sunday = new Date(item.weekStartISO + "T00:00:00");
    left.textContent = formatMonthDay(sunday);

    const right = document.createElement("div");
    right.textContent = item.buyPrice != null ? `Buy ${item.buyPrice}` : "Buy -";

    top.appendChild(left);
    top.appendChild(right);

    const sub = document.createElement("div");
    sub.className = "sub";
    const best = bestFromPrices(item.prices);
    sub.textContent = best ? `Best ${best.price} at ${best.label}` : "No prices logged";

    wrap.appendChild(top);
    wrap.appendChild(sub);
    historyList.appendChild(wrap);
  });

  clearHistoryBtn.onclick = () => {
    const ok = confirm("Clear all history?");
    if (!ok) return;
    history = [];
    saveJSON(STORAGE_HISTORY, history);
    renderHistoryList();
  };
}

function bestFromPrices(prices) {
  let best = null;
  for (let i = 0; i < prices.length; i++) {
    const p = prices[i];
    if (p == null) continue;
    if (!best || p > best.price) best = { price: p, label: slotLabelFromIndex(i) };
  }
  return best;
}

function renderSettings() {
  ensureCurrentWeek();

  patternStrength.value = String(settings.turnipStrength ?? 16);
  patternStrength.oninput = () => {
    settings.turnipStrength = parseInt(patternStrength.value, 10);
    saveJSON(STORAGE_SETTINGS, settings);
    applyPatternStrengthToCSS();
  };

  resetWeekBtn.onclick = () => {
    const ok = confirm("Reset Entry for this week?");
    if (!ok) return;
    week = defaultWeek();
    saveJSON(STORAGE_WEEK, week);
    alert("Entry reset.");
  };
}

function applyPatternStrengthToCSS() {
  const v = Math.max(0, Math.min(100, settings.turnipStrength ?? 16));
  const alpha = (v / 100) * 0.30;
  document.documentElement.style.setProperty("--turnip-alpha", alpha.toFixed(3));
}

function boot() {
  ensureCurrentWeek();
  initNav();

  const page = (location.hash || "#entry").replace("#", "");
  showPage(["entry", "insights", "settings"].includes(page) ? page : "entry");
}

boot();
