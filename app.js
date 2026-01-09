/* =========================
   Turnip Tracker - app.js
   Full, stable version
========================= */

(() => {
  "use strict";

  /* ---------- Constants ---------- */

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

  /* ---------- Helpers ---------- */

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const safeJsonParse = (str, fallback) => {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  };

  const pad2 = (n) => String(n).padStart(2, "0");

  const formatMonthDay = (date) => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  const isoDate = (date) => {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  };

  const startOfTurnipWeek = (now = new Date()) => {
    // Turnip week for this app is Monday-Saturday.
    // If it's Sunday, show the week that just ended (previous Monday).
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);

    const day = d.getDay(); // 0 Sun, 1 Mon, ... 6 Sat
    if (day === 0) {
      // Sunday -> go back 6 days to previous Monday
      d.setDate(d.getDate() - 6);
      return d;
    }

    // otherwise go back to Monday
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
    savedAtISO: null,
  });

  const loadHistory = () => {
    return safeJsonParse(localStorage.getItem(LS.HISTORY), []);
  };

  const saveHistory = (arr) => {
    localStorage.setItem(LS.HISTORY, JSON.stringify(arr));
  };

  const loadCurrentWeekData = () => {
    const weekKey = getWeekKey();

    // if stored week key differs, reset to correct current week
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

    // ensure shape
    const fixed = defaultWeekData(weekKey);
    fixed.buyPrice = parsed.buyPrice ?? "";
    fixed.entries = parsed.entries ?? fixed.entries;
    fixed.savedAtISO = parsed.savedAtISO ?? null;
    localStorage.setItem(LS.CURRENT_DATA, JSON.stringify(fixed));
    return fixed;
  };

  const saveCurrentWeekData = (data) => {
    localStorage.setItem(LS.CURRENT_WEEK, data.weekKey);
    localStorage.setItem(LS.CURRENT_DATA, JSON.stringify(data));
  };

  /* ---------- DOM hooks (IDs are optional; we support multiple patterns) ---------- */

  const getBuyPriceInput = () =>
    $("#buy-price") || $("#buyPrice") || $("#buy-price-input") || $("#buy_price");

  const getWeekDateLabel = () =>
    $("#week-date") || $("#buy-date") || $("#weekDate") || $("#buyDate");

  const getSaveWeekButton = () =>
    $("#save-week-btn") || $("#saveWeekBtn") || $("#save-week") || $("#saveWeek");

  const getHistoryContainer = () =>
    $("#history-list") || $("#historyList") || $("#history");

  const getClearHistoryButton = () =>
    $("#clear-history-btn") || $("#clearHistoryBtn") || $("#clear-history") || $("#clearHistory");

  const getResetWeekButton = () =>
    $("#reset-week-btn") || $("#resetWeekBtn") || $("#reset-week") || $("#resetWeek");

  const getBackupButton = () =>
    $("#backup-btn") || $("#backupBtn") || $("#backup");

  const getRestoreButton = () =>
    $("#restore-btn") || $("#restoreBtn") || $("#restore");

  const getTurnipStrengthSlider = () =>
    $("#turnip-strength") || $("#turnipStrength") || $("#turnip-opacity") || $("#turnipOpacity");

  const getChartHost = () =>
    $("#postcard-chart") || $("#chart") || $(".chart");

  const getStatsTargets = () => ({
    buy: $("#stat-buy") || $("#statBuy"),
    best: $("#stat-best") || $("#statBest"),
    bestTime: $("#stat-besttime") || $("#statBestTime"),
    profit: $("#stat-profit") || $("#statProfit"),
    pattern: $("#stat-pattern") || $("#statPattern"),
  });

  const getDayInput = (dayKey, timeKey) => {
    // Preferred: data attributes
    const byData = document.querySelector(
      `input[data-day="${dayKey}"][data-time="${timeKey}"]`
    );
    if (byData) return byData;

    // Common id patterns
    const candidates = [
      `#${dayKey}-${timeKey}`,
      `#${dayKey}_${timeKey}`,
      `#${dayKey}${timeKey.toUpperCase()}`,
      `#${dayKey}${timeKey}`,
      `#${dayKey}-${timeKey}-input`,
      `#${dayKey}-${timeKey}-price`,
    ];
    for (const sel of candidates) {
      const el = $(sel);
      if (el) return el;
    }
    return null;
  };

  /* ---------- UI: Navigation ---------- */

  const showPage = (pageName) => {
    const pages = {
      entry: $("#entry-page") || $("#entryPage") || $("#entry"),
      insights: $("#insights-page") || $("#insightsPage") || $("#insights"),
      settings: $("#settings-page") || $("#settingsPage") || $("#settings"),
    };

    Object.values(pages).forEach((p) => {
      if (!p) return;
      p.classList.remove("active");
    });

    const target = pages[pageName];
    if (target) target.classList.add("active");

    // Re-render when switching
    if (pageName === "insights") renderInsights();
    if (pageName === "settings") renderSettings();
    if (pageName === "entry") renderEntry();
  };

  const wireNav = () => {
    const btnEntry = $("#nav-entry") || $("#navEntry");
    const btnInsights = $("#nav-insights") || $("#navInsights");
    const btnSettings = $("#nav-settings") || $("#navSettings");

    if (btnEntry) btnEntry.addEventListener("click", () => showPage("entry"));
    if (btnInsights) btnInsights.addEventListener("click", () => showPage("insights"));
    if (btnSettings) btnSettings.addEventListener("click", () => showPage("settings"));
  };

  /* ---------- Rendering ---------- */

  let state = {
    current: null,
  };

  const renderEntry = () => {
    if (!state.current) return;

    // Week date display
    const label = getWeekDateLabel();
    if (label) {
      const monday = startOfTurnipWeek(new Date());
      label.textContent = formatMonthDay(monday);
    }

    // Buy price
    const buyInput = getBuyPriceInput();
    if (buyInput) buyInput.value = state.current.buyPrice || "";

    // Day inputs
    for (const d of DAYS) {
      for (const t of TIMES) {
        const el = getDayInput(d.key, t);
        if (!el) continue;
        el.value = state.current.entries?.[d.key]?.[t] ?? "";
      }
    }

    renderHistoryList();
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
      pattern: bestValid ? "Mixed" : null, // placeholder simple label
    };
  };

  const renderInsights = () => {
    if (!state.current) return;

    // Stats
    const stats = computeStats();
    const targets = getStatsTargets();

    if (targets.buy) targets.buy.textContent = stats.buy ?? "-";
    if (targets.best) targets.best.textContent = stats.best ?? "-";
    if (targets.bestTime) targets.bestTime.textContent = stats.bestTime ?? "-";
    if (targets.profit) targets.profit.textContent = stats.profit ?? "-";
    if (targets.pattern) targets.pattern.textContent = stats.pattern ?? "-";

    // Chart
    renderChart();
  };

  const renderChart = () => {
    const host = getChartHost();
    if (!host) return;

    // If host is the .chart box itself, we can safely rebuild its inner HTML.
    // This keeps layout stable and prevents the "line and dots in the middle" mess.
    host.innerHTML = "";

    const makeRow = (labelText, timeKey) => {
      const row = document.createElement("div");
      row.className = "chart-row";

      const lab = document.createElement("div");
      lab.className = "row-label";
      lab.textContent = labelText;
      row.appendChild(lab);

      const dots = document.createElement("div");
      dots.className = "dots";

      // 6 days shown (Mon-Sat)
      for (const d of DAYS) {
        const span = document.createElement("span");
        const val = state.current.entries[d.key][timeKey];

        // If user entered a number, darken slightly, otherwise keep light
        const num = Number(val);
        if (Number.isFinite(num) && num > 0) {
          span.style.background = "#6f6f6f";
        } else {
          span.style.background = "#b5b5b5";
        }

        dots.appendChild(span);
      }

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

  const renderSettings = () => {
    // Turnip strength slider
    const slider = getTurnipStrengthSlider();
    if (slider) {
      const stored = localStorage.getItem(LS.TURNIP_OPACITY);
      const value = stored ? Number(stored) : 0.12;

      // slider expects 0-1 or 0-100 depending on your HTML
      // We support both:
      if (Number(slider.max) > 1) {
        slider.value = Math.round(value * 100);
      } else {
        slider.value = value;
      }

      applyTurnipOpacity(value);
    }

    renderHistoryList();
  };

  /* ---------- Turnip background strength ---------- */

  const applyTurnipOpacity = (val) => {
    document.documentElement.style.setProperty("--turnip-opacity", String(val));

    // Also apply directly to postcard background if desired
    // (background uses the image; opacity is simulated by overlay in CSS)
    // This is just a variable store for future upgrades.
  };

  const wireTurnipSlider = () => {
    const slider = getTurnipStrengthSlider();
    if (!slider) return;

    slider.addEventListener("input", () => {
      let raw = Number(slider.value);
      let opacity;

      if (Number(slider.max) > 1) {
        opacity = Math.min(1, Math.max(0, raw / 100));
      } else {
        opacity = Math.min(1, Math.max(0, raw));
      }

      // keep it subtle so it never destroys readability
      const clamped = Math.min(0.35, Math.max(0.05, opacity));
      localStorage.setItem(LS.TURNIP_OPACITY, String(clamped));
      applyTurnipOpacity(clamped);
    });
  };

  /* ---------- History ---------- */

  const renderHistoryList = () => {
    const box = getHistoryContainer();
    if (!box) return;

    const history = loadHistory();
    if (!history.length) {
      box.innerHTML = `<div style="color:#6b6b6b;">No saved weeks yet.</div>`;
      return;
    }

    const lines = history
      .slice()
      .sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1))
      .map((w) => {
        const monday = new Date(w.weekStartISO + "T00:00:00");
        const label = `${formatMonthDay(monday)} (week of ${w.weekKey})`;
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.05);">
            <div style="font-size:14px;color:#444;">${label}</div>
            <button data-load-week="${w.weekKey}" style="border:none;background:#fff;border-radius:12px;padding:8px 10px;">Load</button>
          </div>
        `;
      })
      .join("");

    box.innerHTML = lines;

    // Wire load buttons
    $$("button[data-load-week]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-load-week");
        const history2 = loadHistory();
        const found = history2.find((x) => x.weekKey === key);
        if (!found) return;

        // Load saved week into current view (read-only style), or overwrite current week.
        // We will overwrite current week data in UI for now (simple and expected).
        state.current = {
          ...defaultWeekData(getWeekKey()),
          buyPrice: found.buyPrice ?? "",
          entries: found.entries ?? defaultWeekData(getWeekKey()).entries,
        };

        saveCurrentWeekData(state.current);
        renderEntry();
        renderInsights();
        showPage("insights");
      });
    });
  };

  const wireHistoryButtons = () => {
    const saveBtn = getSaveWeekButton();
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        if (!state.current) return;

        const history = loadHistory();
        const weekKey = state.current.weekKey;

        const existingIndex = history.findIndex((x) => x.weekKey === weekKey);
        const payload = {
          weekKey,
          weekStartISO: state.current.weekKey,
          buyPrice: state.current.buyPrice,
          entries: state.current.entries,
          savedAtISO: new Date().toISOString(),
        };

        if (existingIndex >= 0) history[existingIndex] = payload;
        else history.push(payload);

        saveHistory(history);

        // clear entry after save (optional behavior, but matches earlier intent)
        state.current = defaultWeekData(getWeekKey());
        saveCurrentWeekData(state.current);

        renderEntry();
        renderInsights();
        renderSettings();
      });
    }

    const clearBtn = getClearHistoryButton();
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        saveHistory([]);
        renderHistoryList();
      });
    }
  };

  /* ---------- Backup / Restore ---------- */

  const downloadTextFile = (filename, text) => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  const wireBackupRestore = () => {
    const backupBtn = getBackupButton();
    const restoreBtn = getRestoreButton();

    if (backupBtn) {
      backupBtn.addEventListener("click", () => {
        const payload = {
          version: 1,
          exportedAtISO: new Date().toISOString(),
          currentWeekKey: localStorage.getItem(LS.CURRENT_WEEK),
          currentWeekData: safeJsonParse(localStorage.getItem(LS.CURRENT_DATA), null),
          history: loadHistory(),
          turnipOpacity: localStorage.getItem(LS.TURNIP_OPACITY),
        };

        downloadTextFile("turnip-tracker-backup.json", JSON.stringify(payload, null, 2));
      });
    }

    if (restoreBtn) {
      restoreBtn.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";

        input.addEventListener("change", async () => {
          const file = input.files?.[0];
          if (!file) return;

          const text = await file.text();
          const payload = safeJsonParse(text, null);
          if (!payload || !payload.history) return;

          // restore history
          saveHistory(payload.history);

          // restore settings
          if (payload.turnipOpacity) {
            localStorage.setItem(LS.TURNIP_OPACITY, String(payload.turnipOpacity));
          }

          // keep current week logic correct (do not blindly restore old week key)
          state.current = loadCurrentWeekData();

          renderEntry();
          renderInsights();
          renderSettings();
        });

        input.click();
      });
    }
  };

  /* ---------- Inputs wiring ---------- */

  const wireInputs = () => {
    const buyInput = getBuyPriceInput();
    if (buyInput) {
      buyInput.addEventListener("input", () => {
        state.current.buyPrice = buyInput.value.trim();
        saveCurrentWeekData(state.current);
        renderInsights();
      });
    }

    for (const d of DAYS) {
      for (const t of TIMES) {
        const el = getDayInput(d.key, t);
        if (!el) continue;

        el.addEventListener("input", () => {
          state.current.entries[d.key][t] = el.value.trim();
          saveCurrentWeekData(state.current);
          renderInsights();
        });
      }
    }
  };

  const wireResetWeek = () => {
    const btn = getResetWeekButton();
    if (!btn) return;

    btn.addEventListener("click", () => {
      state.current = defaultWeekData(getWeekKey());
      saveCurrentWeekData(state.current);
      renderEntry();
      renderInsights();
    });
  };

  /* ---------- Boot ---------- */

  const boot = () => {
    state.current = loadCurrentWeekData();

    // Apply saved opacity
    const storedOpacity = localStorage.getItem(LS.TURNIP_OPACITY);
    if (storedOpacity) applyTurnipOpacity(Number(storedOpacity));

    wireNav();
    wireInputs();
    wireHistoryButtons();
    wireBackupRestore();
    wireResetWeek();
    wireTurnipSlider();

    // Default page
    showPage("entry");
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
