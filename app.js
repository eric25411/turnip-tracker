(() => {
  "use strict";

  const DAYS = [
    { key: "mon", label: "Mon" },
    { key: "tue", label: "Tue" },
    { key: "wed", label: "Wed" },
    { key: "thu", label: "Thu" },
    { key: "fri", label: "Fri" },
    { key: "sat", label: "Sat" },
  ];

  const TIMES = ["am", "pm"];

  const LS = {
    CURRENT_WEEK: "tt_current_week_key",
    CURRENT_DATA: "tt_current_week_data",
    HISTORY: "tt_history",
    TURNIP_OPACITY: "tt_turnip_opacity",
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const safeJsonParse = (str, fallback) => {
    try { return JSON.parse(str); } catch { return fallback; }
  };

  const pad2 = (n) => String(n).padStart(2, "0");

  const formatMonthDay = (date) => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  const isoDate = (date) => `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`;

  const startOfTurnipWeek = (now = new Date()) => {
    const d = new Date(now);
    d.setHours(0,0,0,0);

    const day = d.getDay(); // 0 Sun
    if (day === 0) {
      d.setDate(d.getDate() - 6); // Sunday -> previous Monday
      return d;
    }
    const diffToMonday = day - 1;
    d.setDate(d.getDate() - diffToMonday);
    return d;
  };

  const getWeekKey = () => isoDate(startOfTurnipWeek(new Date()));

  const defaultWeekData = (weekKey) => ({
    weekKey,
    weekStartISO: weekKey,
    buyPrice: "",
    entries: {
      mon: { am: "", pm: "" },
      tue: { am: "", pm: "" },
      wed: { am: "", pm: "" },
      thu: { am: "", pm: "" },
      fri: { am: "", pm: "" },
      sat: { am: "", pm: "" },
    },
  });

  const loadHistory = () => safeJsonParse(localStorage.getItem(LS.HISTORY), []);
  const saveHistory = (arr) => localStorage.setItem(LS.HISTORY, JSON.stringify(arr));

  const loadCurrentWeekData = () => {
    const weekKey = getWeekKey();
    const storedKey = localStorage.getItem(LS.CURRENT_WEEK);

    if (storedKey !== weekKey) {
      localStorage.setItem(LS.CURRENT_WEEK, weekKey);
      const fresh = defaultWeekData(weekKey);
      localStorage.setItem(LS.CURRENT_DATA, JSON.stringify(fresh));
      return fresh;
    }

    const raw = localStorage.getItem(LS.CURRENT_DATA);
    const parsed = safeJsonParse(raw, null);
    if (!parsed || parsed.weekKey !== weekKey) {
      const fresh = defaultWeekData(weekKey);
      localStorage.setItem(LS.CURRENT_DATA, JSON.stringify(fresh));
      return fresh;
    }

    const fixed = defaultWeekData(weekKey);
    fixed.buyPrice = parsed.buyPrice ?? "";
    fixed.entries = parsed.entries ?? fixed.entries;
    localStorage.setItem(LS.CURRENT_DATA, JSON.stringify(fixed));
    return fixed;
  };

  const saveCurrentWeekData = (data) => {
    localStorage.setItem(LS.CURRENT_WEEK, data.weekKey);
    localStorage.setItem(LS.CURRENT_DATA, JSON.stringify(data));
  };

  let state = { current: null };

  const showPage = (pageName) => {
    const entry = $("#entry-page");
    const insights = $("#insights-page");
    const settings = $("#settings-page");

    [entry, insights, settings].forEach((p) => p && p.classList.remove("active"));

    if (pageName === "entry" && entry) entry.classList.add("active");
    if (pageName === "insights" && insights) insights.classList.add("active");
    if (pageName === "settings" && settings) settings.classList.add("active");

    if (pageName === "entry") renderEntry();
    if (pageName === "insights") renderInsights();
    if (pageName === "settings") renderSettings();
  };

  const wireNav = () => {
    const b1 = $("#nav-entry");
    const b2 = $("#nav-insights");
    const b3 = $("#nav-settings");
    if (b1) b1.addEventListener("click", () => showPage("entry"));
    if (b2) b2.addEventListener("click", () => showPage("insights"));
    if (b3) b3.addEventListener("click", () => showPage("settings"));
  };

  const renderEntry = () => {
    if (!state.current) return;
    const weekLabel = $("#week-date");
    if (weekLabel) weekLabel.textContent = formatMonthDay(startOfTurnipWeek(new Date()));

    const buy = $("#buy-price");
    if (buy) buy.value = state.current.buyPrice || "";

    // Inputs populate (not required for visibility, but keeps state correct)
    for (const d of DAYS) {
      for (const t of TIMES) {
        const el = document.querySelector(`input[data-day="${d.key}"][data-time="${t}"]`);
        if (el) el.value = state.current.entries?.[d.key]?.[t] ?? "";
      }
    }
  };

  const computeStats = () => {
    const buy = Number(state.current.buyPrice);
    let best = -Infinity;
    let bestDay = null;
    let bestTime = null;

    for (const d of DAYS) {
      for (const t of TIMES) {
        const v = Number(state.current.entries[d.key][t]);
        if (Number.isFinite(v) && v > best) {
          best = v;
          bestDay = d.label;
          bestTime = t.toUpperCase();
        }
      }
    }

    const bestValid = Number.isFinite(best) && best !== -Infinity;
    const buyValid = Number.isFinite(buy) && buy > 0;
    const profit = buyValid && bestValid ? best - buy : null;

    return {
      buy: buyValid ? buy : null,
      best: bestValid ? best : null,
      bestTime: bestValid ? `${bestDay} ${bestTime}` : null,
      profit: profit !== null ? profit : null,
    };
  };

  const renderChart = () => {
    const host = $("#postcard-chart");
    if (!host) return;

    host.innerHTML = "";

    const makeRow = (labelText, timeKey) => {
      const row = document.createElement("div");
      row.className = "chart-row";

      const lab = document.createElement("div");
      lab.className = "row-label";
      lab.textContent = labelText;

      const dots = document.createElement("div");
      dots.className = "dots";

      for (const d of DAYS) {
        const dot = document.createElement("span");
        const val = Number(state.current.entries[d.key][timeKey]);
        dot.style.background = Number.isFinite(val) && val > 0 ? "#6f6f6f" : "#b5b5b5";
        dots.appendChild(dot);
      }

      row.appendChild(lab);
      row.appendChild(dots);
      return row;
    };

    host.appendChild(makeRow("AM", "am"));
    host.appendChild(makeRow("PM", "pm"));

    const days = document.createElement("div");
    days.className = "chart-days";
    for (const d of DAYS) {
      const div = document.createElement("div");
      div.textContent = d.label;
      days.appendChild(div);
    }
    host.appendChild(days);
  };

  const renderInsights = () => {
    if (!state.current) return;
    const s = computeStats();

    const set = (id, value) => {
      const el = $(id);
      if (el) el.textContent = value ?? "-";
    };

    set("#stat-buy", s.buy);
    set("#stat-best", s.best);
    set("#stat-besttime", s.bestTime);
    set("#stat-profit", s.profit);

    renderChart();
    renderHistoryList(); // also updates Insights History
  };

  const applyTurnipOpacity = (val) => {
    document.documentElement.style.setProperty("--turnip-opacity", String(val));
  };

  const renderSettings = () => {
    const slider = $("#turnip-strength");
    if (slider) {
      const stored = localStorage.getItem(LS.TURNIP_OPACITY);
      const value = stored ? Number(stored) : 0.12;
      slider.value = Math.round(value * 100);
      applyTurnipOpacity(value);
    }
    renderHistoryList(); // also updates Settings History
  };

  const renderHistoryList = () => {
    const history = loadHistory();

    const boxes = [$("#history-list"), $("#history-list-2")].filter(Boolean);
    if (!boxes.length) return;

    const html = !history.length
      ? `<div style="color:#6b6b6b;">No saved weeks yet.</div>`
      : history
          .slice()
          .sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1))
          .map((w) => {
            const monday = new Date(w.weekStartISO + "T00:00:00");
            const label = `${formatMonthDay(monday)} (week of ${w.weekKey})`;
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
                <div style="font-weight:800;color:#444;font-size:14px;">${label}</div>
                <button class="btn-mini" data-load-week="${w.weekKey}">Load</button>
              </div>
            `;
          })
          .join("");

    boxes.forEach((b) => (b.innerHTML = html));

    $$("button[data-load-week]").forEach((btn) => {
      btn.onclick = () => {
        const key = btn.getAttribute("data-load-week");
        const found = loadHistory().find((x) => x.weekKey === key);
        if (!found) return;

        state.current = {
          ...defaultWeekData(getWeekKey()),
          buyPrice: found.buyPrice ?? "",
          entries: found.entries ?? defaultWeekData(getWeekKey()).entries,
        };

        saveCurrentWeekData(state.current);
        renderEntry();
        renderInsights();
        showPage("insights");
      };
    });
  };

  const wireInputs = () => {
    const buy = $("#buy-price");
    if (buy) {
      buy.addEventListener("input", () => {
        state.current.buyPrice = buy.value.trim();
        saveCurrentWeekData(state.current);
        renderInsights();
      });
    }

    $$('input[data-day][data-time]').forEach((el) => {
      el.addEventListener("input", () => {
        const day = el.getAttribute("data-day");
        const time = el.getAttribute("data-time");
        state.current.entries[day][time] = el.value.trim();
        saveCurrentWeekData(state.current);
        renderInsights();
      });
    });
  };

  const wireButtons = () => {
    const saveBtn = $("#save-week-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const history = loadHistory();
        const wk = state.current.weekKey;

        const payload = {
          weekKey: wk,
          weekStartISO: wk,
          buyPrice: state.current.buyPrice,
          entries: state.current.entries,
          savedAtISO: new Date().toISOString(),
        };

        const idx = history.findIndex((x) => x.weekKey === wk);
        if (idx >= 0) history[idx] = payload;
        else history.push(payload);

        saveHistory(history);

        // clear entry after saving
        state.current = defaultWeekData(getWeekKey());
        saveCurrentWeekData(state.current);

        renderEntry();
        renderInsights();
        renderSettings();
      });
    }

    const clear1 = $("#clear-history-btn");
    const clear2 = $("#clear-history-btn-2");
    [clear1, clear2].filter(Boolean).forEach((b) => {
      b.addEventListener("click", () => {
        saveHistory([]);
        renderHistoryList();
      });
    });

    const reset = $("#reset-week-btn");
    if (reset) {
      reset.addEventListener("click", () => {
        state.current = defaultWeekData(getWeekKey());
        saveCurrentWeekData(state.current);
        renderEntry();
        renderInsights();
      });
    }

    const backup = $("#backup-btn");
    if (backup) {
      backup.addEventListener("click", () => {
        const payload = {
          version: 1,
          exportedAtISO: new Date().toISOString(),
          currentWeekKey: localStorage.getItem(LS.CURRENT_WEEK),
          currentWeekData: safeJsonParse(localStorage.getItem(LS.CURRENT_DATA), null),
          history: loadHistory(),
          turnipOpacity: localStorage.getItem(LS.TURNIP_OPACITY),
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
      });
    }

    const restore = $("#restore-btn");
    if (restore) {
      restore.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";

        input.addEventListener("change", async () => {
          const file = input.files?.[0];
          if (!file) return;

          const text = await file.text();
          const payload = safeJsonParse(text, null);
          if (!payload || !payload.history) return;

          saveHistory(payload.history);

          if (payload.turnipOpacity) {
            localStorage.setItem(LS.TURNIP_OPACITY, String(payload.turnipOpacity));
            applyTurnipOpacity(Number(payload.turnipOpacity));
          }

          state.current = loadCurrentWeekData();
          renderEntry();
          renderInsights();
          renderSettings();
        });

        input.click();
      });
    }

    const slider = $("#turnip-strength");
    if (slider) {
      slider.addEventListener("input", () => {
        const val = Math.min(0.35, Math.max(0.05, Number(slider.value) / 100));
        localStorage.setItem(LS.TURNIP_OPACITY, String(val));
        applyTurnipOpacity(val);
      });
    }
  };

  const boot = () => {
    state.current = loadCurrentWeekData();

    const storedOpacity = localStorage.getItem(LS.TURNIP_OPACITY);
    if (storedOpacity) applyTurnipOpacity(Number(storedOpacity));

    // Set week label immediately
    const weekLabel = $("#week-date");
    if (weekLabel) weekLabel.textContent = formatMonthDay(startOfTurnipWeek(new Date()));

    wireNav();
    wireInputs();
    wireButtons();

    renderEntry();
    renderInsights();
    renderSettings();

    showPage("entry");
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
