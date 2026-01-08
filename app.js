// app.js
const DAYS = [
  { key: "mon", name: "Monday" },
  { key: "tue", name: "Tuesday" },
  { key: "wed", name: "Wednesday" },
  { key: "thu", name: "Thursday" },
  { key: "fri", name: "Friday" },
  { key: "sat", name: "Saturday" },
];

const TIMES = [
  { key: "am", label: "AM", emoji: "🌞" },
  { key: "pm", label: "PM", emoji: "🌙" },
];

const LS_WEEKS = "turnip_weeks_v1";
const LS_CURRENT = "turnip_current_week_v1";

const elDaysGrid = document.getElementById("daysGrid");
const elSaveWeek = document.getElementById("saveWeekBtn");

const elHistoryList = document.getElementById("historyList");
const elExportBtn = document.getElementById("exportBtn");
const elImportFile = document.getElementById("importFile");
const elGoHomeBtn = document.getElementById("goHomeBtn");

function getWeeks(){
  try { return JSON.parse(localStorage.getItem(LS_WEEKS) || "[]"); }
  catch { return []; }
}
function setWeeks(weeks){
  localStorage.setItem(LS_WEEKS, JSON.stringify(weeks));
}

function getCurrentWeek(){
  try {
    const obj = JSON.parse(localStorage.getItem(LS_CURRENT) || "{}");
    return obj && typeof obj === "object" ? obj : {};
  } catch { return {}; }
}
function setCurrentWeek(obj){
  localStorage.setItem(LS_CURRENT, JSON.stringify(obj));
}

function fmtDate(d){
  const yy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yy}-${mm}-${dd}`;
}

function buildHome(){
  elDaysGrid.innerHTML = "";
  const current = getCurrentWeek();

  for (const day of DAYS){
    const card = document.createElement("div");
    card.className = "dayCard";

    const title = document.createElement("h2");
    title.className = "dayTitle";
    title.textContent = day.name;
    card.appendChild(title);

    for (const t of TIMES){
      const row = document.createElement("div");
      row.className = "row";

      const label = document.createElement("div");
      label.className = "label";

      const emoji = document.createElement("span");
      emoji.className = "emoji";
      emoji.textContent = t.emoji;

      const span = document.createElement("span");
      span.textContent = t.label;

      label.appendChild(emoji);
      label.appendChild(span);

      const input = document.createElement("input");
      input.className = "priceInput";
      input.inputMode = "numeric";
      input.placeholder = "-";
      input.id = `${day.key}-${t.key}`;
      input.type = "text";

      const v = current?.[day.key]?.[t.key];
      if (typeof v === "number" && Number.isFinite(v)) input.value = String(v);

      input.addEventListener("input", () => {
        const cleaned = input.value.replace(/[^\d]/g, "").slice(0, 3);
        input.value = cleaned;
        const next = getCurrentWeek();
        next[day.key] = next[day.key] || {};
        next[day.key][t.key] = cleaned === "" ? null : Number(cleaned);
        setCurrentWeek(next);
      });

      row.appendChild(label);
      row.appendChild(input);
      card.appendChild(row);
    }

    elDaysGrid.appendChild(card);
  }
}

function saveWeekToHistory(){
  const current = getCurrentWeek();
  const stamp = fmtDate(new Date());
  const id = `${stamp}-${Math.random().toString(16).slice(2)}`;

  const weeks = getWeeks();
  weeks.unshift({
    id,
    createdAt: new Date().toISOString(),
    label: `Week saved ${stamp}`,
    data: current
  });
  setWeeks(weeks);
  renderHistory();
}

function clearForNewWeek(){
  setCurrentWeek({});
  buildHome();
}

function renderHistory(){
  const weeks = getWeeks();
  elHistoryList.innerHTML = "";

  if (!weeks.length){
    const empty = document.createElement("div");
    empty.className = "weekItem";
    empty.innerHTML = `
      <div class="weekHeader">
        <div class="weekTitle">No saved weeks yet</div>
      </div>
      <div class="muted">Fill the week, then hit Save week, or we will auto save on Saturday PM later.</div>
    `;
    elHistoryList.appendChild(empty);
    return;
  }

  for (const w of weeks){
    const item = document.createElement("div");
    item.className = "weekItem";

    const header = document.createElement("div");
    header.className = "weekHeader";

    const title = document.createElement("div");
    title.className = "weekTitle";
    title.textContent = w.label || "Saved week";

    const actions = document.createElement("div");
    actions.className = "weekActions";

    const btnToggle = document.createElement("button");
    btnToggle.type = "button";
    btnToggle.textContent = "View";

    const btnLoad = document.createElement("button");
    btnLoad.type = "button";
    btnLoad.textContent = "Load";

    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.textContent = "Delete";

    actions.appendChild(btnToggle);
    actions.appendChild(btnLoad);
    actions.appendChild(btnDelete);

    header.appendChild(title);
    header.appendChild(actions);

    const body = document.createElement("div");
    body.className = "weekBody";

    const grid = document.createElement("div");
    grid.className = "weekGrid";

    for (const d of DAYS){
      const am = w.data?.[d.key]?.am ?? "-";
      const pm = w.data?.[d.key]?.pm ?? "-";
      const cell = document.createElement("div");
      cell.textContent = `${d.name}: AM ${am} , PM ${pm}`;
      grid.appendChild(cell);
    }

    body.appendChild(grid);

    btnToggle.addEventListener("click", () => {
      body.classList.toggle("open");
    });

    btnLoad.addEventListener("click", () => {
      setCurrentWeek(w.data || {});
      switchScreen("home");
      buildHome();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    btnDelete.addEventListener("click", () => {
      const next = getWeeks().filter(x => x.id !== w.id);
      setWeeks(next);
      renderHistory();
    });

    item.appendChild(header);
    item.appendChild(body);
    elHistoryList.appendChild(item);
  }
}

function exportWeeks(){
  const data = getWeeks();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "turnip-history.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importWeeks(file){
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(String(reader.result || "[]"));
      if (!Array.isArray(incoming)) return;
      setWeeks(incoming);
      renderHistory();
    } catch {}
  };
  reader.readAsText(file);
}

function switchScreen(name){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("screenActive"));
  const target = document.getElementById(`screen-${name}`);
  if (target) target.classList.add("screenActive");
}

/* Wire up nav */
document.querySelectorAll(".navBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-target");
    if (!target) return;
    switchScreen(target);
    if (target === "history") renderHistory();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

elSaveWeek.addEventListener("click", () => {
  saveWeekToHistory();
});

elExportBtn.addEventListener("click", exportWeeks);
elImportFile.addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (f) importWeeks(f);
  e.target.value = "";
});

elGoHomeBtn.addEventListener("click", () => {
  switchScreen("home");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* Initial render */
buildHome();
renderHistory();
