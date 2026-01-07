// app.js
// Turnip Tracker, autosave all inputs using localStorage

(() => {
  const STORAGE_KEY = "turnipTracker.prices.v1";

  // These IDs must match your index.html exactly
  const INPUT_IDS = [
    "mon-am", "mon-pm",
    "tue-am", "tue-pm",
    "wed-am", "wed-pm",
    "thu-am", "thu-pm",
    "fri-am", "fri-pm",
    "sat-am", "sat-pm",
  ];

  function safeParse(json) {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function loadAll() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = safeParse(raw) || {};
    for (const id of INPUT_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const value = data[id];
      el.value = typeof value === "string" ? value : "";
    }
  }

  function readAll() {
    const data = {};
    for (const id of INPUT_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;
      data[id] = (el.value || "").trim();
    }
    return data;
  }

  function saveAll() {
    const data = readAll();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // Small debounce so it does not write to storage on every single keystroke instantly
  function debounce(fn, wait = 120) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  const saveAllDebounced = debounce(saveAll, 120);

  function digitsOnly(el) {
    // keep digits only (no commas, no $, no spaces)
    const cleaned = (el.value || "").replace(/[^\d]/g, "");
    if (el.value !== cleaned) el.value = cleaned;
  }

  function wireInputs() {
    for (const id of INPUT_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;

      // Load-time: optional numeric keyboard hint is already in HTML via inputmode
      // Input-time: enforce digits only, then autosave
      el.addEventListener("input", () => {
        digitsOnly(el);
        saveAllDebounced();
      });

      // Make editing easier on mobile
      el.addEventListener("focus", () => {
        // slight delay helps iOS reliably select
        setTimeout(() => el.select(), 0);
      });
    }
  }

  function wireNavButtons() {
    const predictBtn = document.getElementById("predictBtn");
    const historyBtn = document.getElementById("historyBtn");

    if (predictBtn) {
      predictBtn.addEventListener("click", (e) => {
        e.preventDefault();
        saveAll(); // always save before actions
        alert("Predict is coming next. Your prices are saved.");
      });
    }

    if (historyBtn) {
      historyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        saveAll(); // always save before actions
        alert("History is coming next. Your prices are saved.");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadAll();
    wireInputs();
    wireNavButtons();

    // Extra safety, saves if Safari kills the tab
    window.addEventListener("beforeunload", () => {
      saveAll();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveAll();
    });
  });
})();
