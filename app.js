(function(){
  "use strict";

  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const SLOTS = [
    { key:"mon_am", day:"Monday", label:"AM", icon:"☀️" },
    { key:"mon_pm", day:"Monday", label:"PM", icon:"🌙" },

    { key:"tue_am", day:"Tuesday", label:"AM", icon:"☀️" },
    { key:"tue_pm", day:"Tuesday", label:"PM", icon:"🌙" },

    { key:"wed_am", day:"Wednesday", label:"AM", icon:"☀️" },
    { key:"wed_pm", day:"Wednesday", label:"PM", icon:"🌙" },

    { key:"thu_am", day:"Thursday", label:"AM", icon:"☀️" },
    { key:"thu_pm", day:"Thursday", label:"PM", icon:"🌙" },

    { key:"fri_am", day:"Friday", label:"AM", icon:"☀️" },
    { key:"fri_pm", day:"Friday", label:"PM", icon:"🌙" },

    { key:"sat_am", day:"Saturday", label:"AM", icon:"☀️" },
    { key:"sat_pm", day:"Saturday", label:"PM", icon:"🌙" },
  ];

  const LS = {
    buy: "tt_buyPrice",
    week: "tt_weekPrices",
    history: "tt_historyWeeks",
  };

  const $ = (sel) => document.querySelector(sel);

  const pages = {
    entry: $("#page-entry"),
    insights: $("#page-insights"),
    settings: $("#page-settings"),
  };

  const navButtons = Array.from(document.querySelectorAll(".nav-item"));

  function safeInt(v){
    const n = parseInt(String(v || "").replace(/[^\d]/g,""), 10);
    if (Number.isFinite(n)) return n;
    return null;
  }

  function fmtMonthDay(d){
    const opts = { month:"short", day:"numeric" };
    return new Intl.DateTimeFormat(undefined, opts).format(d);
  }

  // Sunday for the current device locale
  function getThisSunday(){
    const now = new Date();
    const day = now.getDay(); // 0 Sun
    const diff = day; // days since Sunday
    const sunday = new Date(now);
    sunday.setHours(0,0,0,0);
    sunday.setDate(now.getDate() - diff);
    return sunday;
  }

  function setBuyDateLabel(){
    const sunday = getThisSunday();
    $("#buyDateLabel").textContent = fmtMonthDay(sunday);
  }

  function loadWeek(){
    const raw = localStorage.getItem(LS.week);
    if (!raw) return {};
    try { return JSON.parse(raw) || {}; } catch { return {}; }
  }

  function saveWeek(obj){
    localStorage.setItem(LS.week, JSON.stringify(obj || {}));
  }

  function loadHistory(){
    const raw = localStorage.getItem(LS.history);
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveHistory(arr){
    localStorage.setItem(LS.history, JSON.stringify(arr || []));
  }

  function setActivePage(name){
    Object.values(pages).forEach(p => p.classList.remove("is-active"));
    pages[name].classList.add("is-active");

    navButtons.forEach(b => b.classList.remove("is-active"));
    navButtons.forEach(b => {
      if (b.dataset.go === name) b.classList.add("is-active");
    });

    if (name === "insights"){
      renderInsights();
    }
  }

  function buildDayCards(){
    const wrap = $("#daysWrap");
    wrap.innerHTML = "";

    const week = loadWeek();

    for (const day of DAYS){
      const card = document.createElement("div");
      card.className = "day-card";

      const title = document.createElement("div");
      title.className = "day-title";
      title.textContent = day;
      card.appendChild(title);

      const daySlots = SLOTS.filter(s => s.day === day);

      for (const slot of daySlots){
        const row = document.createElement("div");
        row.className = "slot";

        const left = document.createElement("div");
        left.className = "slot-left";
        left.innerHTML = `<span class="ico">${slot.icon}</span><span>${slot.label}</span>`;
        row.appendChild(left);

        const input = document.createElement("input");
        input.className = "price-input";
        input.setAttribute("inputmode","numeric");
        input.setAttribute("maxlength","3");
        input.placeholder = "-";
        input.value = week[slot.key] ?? "";
        input.addEventListener("input", () => {
          const w = loadWeek();
          const val = safeInt(input.value);
          if (val === null){
            delete w[slot.key];
          } else {
            w[slot.key] = val;
          }
          saveWeek(w);
          // Keep insights fresh if user is currently there
        });
        row.appendChild(input);

        card.appendChild(row);
      }

      wrap.appendChild(card);
    }
  }

  function bindBuyPrice(){
    const input = $("#buyPriceInput");
    const stored = safeInt(localStorage.getItem(LS.buy));
    input.value = stored === null ? "" : String(stored);

    input.addEventListener("input", () => {
      const v = safeInt(input.value);
      if (v === null){
        localStorage.removeItem(LS.buy);
      } else {
        localStorage.setItem(LS.buy, String(v));
      }
    });
  }

  function weekSnapshot(){
    const buy = safeInt(localStorage.getItem(LS.buy));
    const week = loadWeek();

    const prices = SLOTS.map(s => {
      const v = week[s.key];
      return Number.isFinite(v) ? v : null;
    });

    return { buy, prices, week };
  }

  function bestPrice(prices){
    let best = null;
    let idx = -1;
    prices.forEach((v,i) => {
      if (v === null) return;
      if (best === null || v > best){
        best = v;
        idx = i;
      }
    });
    return { best, idx };
  }

  function slotNameFromIndex(i){
    const s = SLOTS[i];
    if (!s) return "-";
    const dayShort = s.day.slice(0,3);
    return `${dayShort} ${s.label}`;
  }

  function renderSummary(){
    const { buy, prices } = weekSnapshot();
    const { best, idx } = bestPrice(prices);

    $("#sumBuy").textContent = buy === null ? "-" : String(buy);
    $("#sumBest").textContent = best === null ? "-" : String(best);
    $("#sumBestTime").textContent = best === null ? "-" : slotNameFromIndex(idx);

    if (buy === null || best === null){
      $("#sumProfit").textContent = "-";
    } else {
      const diff = best - buy;
      const sign = diff > 0 ? "+" : "";
      $("#sumProfit").textContent = `${sign}${diff}`;
    }

    // simple placeholder pattern text for now
    $("#sumPattern").textContent = "Mixed";
  }

  function renderHistory(){
    const list = $("#historyList");
    const history = loadHistory();

    if (history.length === 0){
      list.innerHTML = `<div class="hist-item"><div class="hist-top"><div>No weeks saved yet</div><div> </div></div><div class="hist-sub">Save a week from Entry and it shows up here.</div></div>`;
      return;
    }

    list.innerHTML = "";
    history.slice().reverse().forEach(item => {
      const div = document.createElement("div");
      div.className = "hist-item";

      const top = document.createElement("div");
      top.className = "hist-top";

      const left = document.createElement("div");
      left.textContent = item.label || "Saved week";

      const right = document.createElement("div");
      right.textContent = item.best === null ? "-" : String(item.best);

      top.appendChild(left);
      top.appendChild(right);

      const sub = document.createElement("div");
      sub.className = "hist-sub";
      sub.textContent = item.note || " ";

      div.appendChild(top);
      div.appendChild(sub);

      list.appendChild(div);
    });
  }

  function renderPostcard(){
    const svg = $("#postcardSvg");
    svg.innerHTML = "";

    const W = 360;
    const H = 200;

    const padL = 20;
    const padR = 20;
    const topY = 30;
    const bottomY = 138;

    // grid lines (top + bottom only, no “mystery middle line”)
    const grid = document.createElementNS("http://www.w3.org/2000/svg","g");
    grid.setAttribute("opacity","0.18");

    function line(y){
      const l = document.createElementNS("http://www.w3.org/2000/svg","line");
      l.setAttribute("x1", padL);
      l.setAttribute("x2", W - padR);
      l.setAttribute("y1", y);
      l.setAttribute("y2", y);
      l.setAttribute("stroke", "#000");
      l.setAttribute("stroke-width", "2");
      grid.appendChild(l);
    }

    line(topY);
    line(bottomY);

    svg.appendChild(grid);

    const baseY = 120;

    // x positions for 12 points
    const xs = [];
    const usable = (W - padL - padR);
    for (let i = 0; i < 12; i++){
      xs.push(padL + (usable * (i / 11)));
    }

    const { prices } = weekSnapshot();

    const present = prices.filter(v => v !== null);
    const min = present.length ? Math.min(...present) : 0;
    const max = present.length ? Math.max(...present) : 100;
    const span = Math.max(1, max - min);

    function yForValue(v){
      if (v === null) return baseY;
      // map values to a tighter range
      const t = (v - min) / span;
      const top = 54;
      const bottom = 116;
      return bottom - (t * (bottom - top));
    }

    // line path
    let d = "";
    for (let i = 0; i < 12; i++){
      const x = xs[i];
      const y = yForValue(prices[i]);
      d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#111");
    path.setAttribute("stroke-width", "3.5");
    path.setAttribute("stroke-linecap","round");
    path.setAttribute("stroke-linejoin","round");
    svg.appendChild(path);

    // dots
    for (let i = 0; i < 12; i++){
      const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
      c.setAttribute("cx", xs[i]);
      c.setAttribute("cy", yForValue(prices[i]));
      c.setAttribute("r", "6.5");
      c.setAttribute("fill", "rgba(0,0,0,.75)");
      svg.appendChild(c);
    }

    // sun/moon markers above each dot
    for (let i = 0; i < 12; i++){
      const t = document.createElementNS("http://www.w3.org/2000/svg","text");
      t.setAttribute("x", xs[i]);
      t.setAttribute("y", 100);
      t.setAttribute("text-anchor","middle");
      t.setAttribute("font-size","16");
      t.setAttribute("font-weight","900");
      t.setAttribute("opacity","0.95");
      t.textContent = (i % 2 === 0) ? "☀️" : "🌙";
      svg.appendChild(t);
    }

    // day labels centered between AM and PM
    const labelsG = document.createElementNS("http://www.w3.org/2000/svg","g");
    labelsG.setAttribute("fill", "rgba(0,0,0,.48)");
    labelsG.setAttribute("font-weight", "950");
    labelsG.setAttribute("font-size", "22");
    labelsG.setAttribute("text-anchor", "middle");

    const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat"];
    for (let dIndex = 0; dIndex < 6; dIndex++){
      const amIndex = dIndex * 2;
      const pmIndex = amIndex + 1;
      const x = (xs[amIndex] + xs[pmIndex]) / 2;

      const t = document.createElementNS("http://www.w3.org/2000/svg","text");
      t.setAttribute("x", x);
      t.setAttribute("y", 186);
      t.textContent = dayNames[dIndex];
      labelsG.appendChild(t);
    }

    svg.appendChild(labelsG);
  }

  function renderInsights(){
    renderPostcard();
    renderSummary();
    renderHistory();
  }

  function bindNav(){
    navButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        setActivePage(btn.dataset.go);
      });
    });
  }

  function bindSaveWeek(){
    $("#saveWeekBtn").addEventListener("click", () => {
      const { buy, prices, week } = weekSnapshot();
      const { best, idx } = bestPrice(prices);

      const sunday = getThisSunday();
      const label = `Week of ${fmtMonthDay(sunday)}`;

      const noteParts = [];
      if (buy !== null) noteParts.push(`Buy ${buy}`);
      if (best !== null) noteParts.push(`Best ${best} (${slotNameFromIndex(idx)})`);

      const history = loadHistory();
      history.push({
        id: crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        savedAt: new Date().toISOString(),
        label,
        best,
        note: noteParts.join(" , "),
        buy,
        week
      });
      saveHistory(history);

      // clear entry
      localStorage.removeItem(LS.buy);
      saveWeek({});
      $("#buyPriceInput").value = "";
      buildDayCards();

      // hop to insights
      setActivePage("insights");
    });
  }

  function bindClearHistory(){
    $("#clearHistoryBtn").addEventListener("click", () => {
      saveHistory([]);
      renderHistory();
    });
  }

  function init(){
    setBuyDateLabel();
    bindNav();
    bindBuyPrice();
    buildDayCards();
    bindSaveWeek();
    bindClearHistory();

    // refresh buy date label each time page is shown
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) setBuyDateLabel();
    });

    // default page
    setActivePage("entry");
  }

  init();
})();
