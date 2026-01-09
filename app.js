(() => {
  const STORAGE_KEY = "tt_state_v2";
  const HISTORY_KEY = "tt_history_v1";
  const SETTINGS_KEY = "tt_settings_v1";

  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

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

  function getThisSundayDate() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const diff = day; // days since Sunday
    const sunday = new Date(now);
    sunday.setHours(0,0,0,0);
    sunday.setDate(now.getDate() - diff);
    return sunday;
  }

  function formatMonthDay(d) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function buildDefaultState() {
    const entries = {};
    for (const day of DAYS) {
      entries[day] = { am: "", pm: "" };
    }
    return {
      buyPrice: "",
      entries
    };
  }

  function ensureStateShape(state) {
    if (!state || typeof state !== "object") return buildDefaultState();
    if (!state.entries || typeof state.entries !== "object") state.entries = {};
    for (const day of DAYS) {
      if (!state.entries[day]) state.entries[day] = { am: "", pm: "" };
      if (typeof state.entries[day].am !== "string") state.entries[day].am = "";
      if (typeof state.entries[day].pm !== "string") state.entries[day].pm = "";
    }
    if (typeof state.buyPrice !== "string") state.buyPrice = "";
    return state;
  }

  function getNumeric(v) {
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : null;
  }

  function computeStats(state) {
    const buy = getNumeric(state.buyPrice);
    const all = [];
    const slots = []; // for best time
    let idx = 0; // Mon AM .. Sat PM index 0..11

    for (const day of DAYS) {
      const am = getNumeric(state.entries[day].am);
      const pm = getNumeric(state.entries[day].pm);

      if (am !== null) { all.push(am); slots.push({ idx, label: `${day.slice(0,3)} AM`, value: am }); }
      idx++;
      if (pm !== null) { all.push(pm); slots.push({ idx, label: `${day.slice(0,3)} PM`, value: pm }); }
      idx++;
    }

    const best = all.length ? Math.max(...all) : null;
    const bestSlot = slots.length
      ? slots.reduce((a,b) => (b.value > a.value ? b : a), slots[0])
      : null;

    const profit = (buy !== null && best !== null) ? (best - buy) : null;

    return {
      buy,
      best,
      bestSlotLabel: bestSlot ? bestSlot.label : null,
      profit
    };
  }

  function renderDays(state) {
    const wrap = $("#daysWrap");
    wrap.innerHTML = "";

    for (const day of DAYS) {
      const card = document.createElement("div");
      card.className = "dayCard";

      card.innerHTML = `
        <div class="dayTitle">${day}</div>

        <div class="slot">
          <div class="slotLeft">
            <div class="slotIcon">☀️</div>
            <div class="slotLabel">AM</div>
          </div>
          <input class="slotInput" inputmode="numeric" pattern="[0-9]*" placeholder="-" data-day="${day}" data-slot="am" value="${escapeHTML(state.entries[day].am)}" />
        </div>

        <div class="slot">
          <div class="slotLeft">
            <div class="slotIcon">🌙</div>
            <div class="slotLabel">PM</div>
          </div>
          <input class="slotInput" inputmode="numeric" pattern="[0-9]*" placeholder="-" data-day="${day}" data-slot="pm" value="${escapeHTML(state.entries[day].pm)}" />
        </div>
      `;

      wrap.appendChild(card);
    }

    wrap.addEventListener("input", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (!t.classList.contains("slotInput")) return;

      const day = t.getAttribute("data-day");
      const slot = t.getAttribute("data-slot");
      if (!day || !slot) return;

      state.entries[day][slot] = sanitizeNumberString(t.value);
      saveJSON(STORAGE_KEY, state);
      renderInsights(state);
    }, { passive: true });
  }

  function sanitizeNumberString(v) {
    // keep digits only
    const cleaned = String(v).replace(/[^\d]/g, "");
    return cleaned;
  }

  function escapeHTML(s) {
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function renderTimeline(state) {
    const dotsWrap = $("#timelineDots");
    dotsWrap.innerHTML = "";

    // 12 dots Mon AM .. Sat PM
    // mark dot as "hit" if that slot has a value
    // also show sun/moon marker above when hit
    let idx = 0;
    for (const day of DAYS) {
      const amVal = state.entries[day].am.trim();
      const pmVal = state.entries[day].pm.trim();

      // AM dot
      dotsWrap.appendChild(makeDot(amVal.length > 0, "☀️"));
      idx++;

      // PM dot
      dotsWrap.appendChild(makeDot(pmVal.length > 0, "🌙"));
      idx++;
    }

    function makeDot(isHit, emoji) {
      const d = document.createElement("div");
      d.className = "dot" + (isHit ? " is-hit" : "");
      if (isHit) {
        const m = document.createElement("div");
        m.className = "marker";
        m.textContent = emoji;
        d.appendChild(m);
      }
      return d;
    }
  }

  function renderInsights(state) {
    renderTimeline(state);

    const stats = computeStats(state);

    $("#statBuy").textContent = stats.buy === null ? "-" : String(stats.buy);
    $("#statBest").textContent = stats.best === null ? "-" : String(stats.best);
    $("#statBestTime").textContent = stats.bestSlotLabel || "-";

    if (stats.profit === null) {
      $("#statProfit").textContent = "-";
    } else {
      $("#statProfit").textContent = (stats.profit >= 0 ? `+${stats.profit}` : String(stats.profit));
    }
  }

  function renderHistory() {
    const history = loadJSON(HISTORY_KEY, []);
    const list = $("#historyList");
    const empty = $("#historyEmpty");

    list.innerHTML = "";

    if (!history.length) {
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    history.slice().reverse().forEach((item) => {
      const div = document.createElement("div");
      div.className = "historyItem";
      div.textContent = `${item.weekLabel} • Buy ${item.buy || "-"} • Best ${item.best || "-"}`;
      list.appendChild(div);
    });
  }

  function setTurnipStrength(val) {
    // maps 0..100 to opacity range
    const opacity = 0.10 + (Math.max(0, Math.min(100, val)) / 100) * 0.32; // 0.10..0.42
    document.documentElement.style.setProperty("--turnipOpacity", opacity.toFixed(3));
  }

  function mountBuyMascot() {
    const img = $("#buyMascot");

    // Try your repo filenames in order (case sensitive on GitHub Pages)
    const candidates = [
      "isabelle.png.PNG",
      "isabelle.png",
      "isabelle.PNG",
    ];

    let i = 0;
    function tryNext() {
      if (i >= candidates.length) return;
      const src = candidates[i++];
      img.src = src;
      img.style.display = "inline-block";
      img.onerror = () => {
        img.style.display = "none";
        tryNext();
      };
      img.onload = () => {
        img.style.display = "inline-block";
      };
    }
    tryNext();
  }

  function setBuyDateText() {
    const sunday = getThisSundayDate();
    $("#buyDateText").textContent = formatMonthDay(sunday);
  }

  function showPage(name) {
    $$(".page").forEach(p => p.classList.remove("is-active"));
    const page = document.querySelector(`.page[data-page="${name}"]`);
    if (page) page.classList.add("is-active");

    $$(".navBtn").forEach(b => b.classList.remove("is-active"));
    const btn = document.querySelector(`.navBtn[data-nav="${name}"]`);
    if (btn) btn.classList.add("is-active");

    // small scroll reset feels cleaner
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function wireNav() {
    $$(".navBtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-nav");
        if (!target) return;
        showPage(target);
      });
    });
  }

  function main() {
    // load
    let state = ensureStateShape(loadJSON(STORAGE_KEY, buildDefaultState()));
    saveJSON(STORAGE_KEY, state);

    // buy price input
    const buyInput = $("#buyPriceInput");
    buyInput.value = state.buyPrice;

    buyInput.addEventListener("input", () => {
      state.buyPrice = sanitizeNumberString(buyInput.value);
      saveJSON(STORAGE_KEY, state);
      renderInsights(state);
    }, { passive: true });

    // date + mascot
    setBuyDateText();
    mountBuyMascot();

    // build days
    renderDays(state);

    // insights render
    renderInsights(state);

    // history
    renderHistory();

    // settings
    const settings = loadJSON(SETTINGS_KEY, { turnipStrength: 35 });
    $("#turnipStrength").value = String(settings.turnipStrength ?? 35);
    setTurnipStrength(Number($("#turnipStrength").value));

    $("#turnipStrength").addEventListener("input", (e) => {
      const v = Number(e.target.value);
      setTurnipStrength(v);
      saveJSON(SETTINGS_KEY, { ...settings, turnipStrength: v });
    });

    $("#resetWeekBtn").addEventListener("click", () => {
      if (!confirm("Reset Entry for this week?")) return;
      state = buildDefaultState();
      saveJSON(STORAGE_KEY, state);

      buyInput.value = "";
      renderDays(state);
      renderInsights(state);
      alert("Entry cleared.");
    });

    $("#saveWeekBtn").addEventListener("click", () => {
      const stats = computeStats(state);
      const sunday = getThisSundayDate();
      const weekLabel = formatMonthDay(sunday);

      const history = loadJSON(HISTORY_KEY, []);
      history.push({
        ts: Date.now(),
        weekLabel,
        buy: stats.buy === null ? null : stats.buy,
        best: stats.best === null ? null : stats.best
      });
      saveJSON(HISTORY_KEY, history);

      // clear entry after saving
      state = buildDefaultState();
      saveJSON(STORAGE_KEY, state);

      buyInput.value = "";
      renderDays(state);
      renderInsights(state);
      renderHistory();

      alert("Saved to History.");
    });

    $("#clearHistoryBtn").addEventListener("click", () => {
      if (!confirm("Clear all saved History?")) return;
      saveJSON(HISTORY_KEY, []);
      renderHistory();
    });

    wireNav();
  }

  main();
})();
