const KEYS = {
  weeks: "turnipTracker_weeks_v1",
  current: "turnipTracker_current_v1"
};

const predictView = document.getElementById("predictView");
const historyView = document.getElementById("historyView");
const navPredict = document.getElementById("navPredict");
const navHistory = document.getElementById("navHistory");
const saveWeekBtn = document.getElementById("saveWeekBtn");

const historyList = document.getElementById("historyList");
const historyEmptyNote = document.getElementById("historyEmptyNote");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const goHomeBtn = document.getElementById("goHomeBtn");

function setActiveTab(tab){
  const isPredict = tab === "predict";
  predictView.classList.toggle("hidden", !isPredict);
  historyView.classList.toggle("hidden", isPredict);

  navPredict.classList.toggle("active", isPredict);
  navHistory.classList.toggle("active", !isPredict);

  if (!isPredict) renderHistory();
}

navPredict.addEventListener("click", () => setActiveTab("predict"));
navHistory.addEventListener("click", () => setActiveTab("history"));
goHomeBtn.addEventListener("click", () => setActiveTab("predict"));

function getWeeks(){
  try { return JSON.parse(localStorage.getItem(KEYS.weeks) || "[]"); }
  catch { return []; }
}

function setWeeks(weeks){
  localStorage.setItem(KEYS.weeks, JSON.stringify(weeks));
}

function getCurrentWeekData(){
  const ids = ["mon-am","mon-pm","tue-am","tue-pm","wed-am","wed-pm","thu-am","thu-pm","fri-am","fri-pm","sat-am","sat-pm"];
  const data = {};
  ids.forEach(id => {
    const el = document.getElementById(id);
    data[id] = (el && el.value || "").trim();
  });
  return data;
}

function loadWeekData(data){
  Object.keys(data || {}).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = data[id] ?? "";
  });
}

function clearWeek(){
  document.querySelectorAll(".priceInput").forEach(i => i.value = "");
  localStorage.removeItem(KEYS.current);
}

function saveCurrentDraft(){
  localStorage.setItem(KEYS.current, JSON.stringify(getCurrentWeekData()));
}

function loadCurrentDraft(){
  try {
    const raw = localStorage.getItem(KEYS.current);
    if (!raw) return;
    loadWeekData(JSON.parse(raw));
  } catch {}
}

document.querySelectorAll(".priceInput").forEach(inp => {
  inp.addEventListener("input", saveCurrentDraft);
});

saveWeekBtn.addEventListener("click", () => {
  const week = {
    id: cryptoRandomId(),
    savedAt: new Date().toISOString(),
    data: getCurrentWeekData()
  };

  const weeks = getWeeks();
  weeks.unshift(week);
  setWeeks(weeks);

  clearWeek();
  setActiveTab("history");
});

function renderHistory(){
  const weeks = getWeeks();
  historyList.innerHTML = "";

  historyEmptyNote.style.display = weeks.length ? "none" : "block";

  weeks.forEach(w => {
    const row = document.createElement("div");
    row.className = "weekRow";

    const top = document.createElement("div");
    top.className = "weekRowTop";

    const label = document.createElement("div");
    label.className = "weekLabel";
    label.textContent = formatWeekLabel(w.savedAt);

    const btnWrap = document.createElement("div");
    btnWrap.className = "weekBtns";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "smallBtn";
    toggleBtn.textContent = "Expand";
    toggleBtn.addEventListener("click", () => {
      const expanded = row.classList.toggle("expanded");
      toggleBtn.textContent = expanded ? "Collapse" : "Expand";
    });

    const loadBtn = document.createElement("button");
    loadBtn.className = "smallBtn";
    loadBtn.textContent = "Load";
    loadBtn.addEventListener("click", () => {
      loadWeekData(w.data);
      saveCurrentDraft();
      setActiveTab("predict");
    });

    const delBtn = document.createElement("button");
    delBtn.className = "smallBtn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      const next = getWeeks().filter(x => x.id !== w.id);
      setWeeks(next);
      renderHistory();
    });

    btnWrap.appendChild(toggleBtn);
    btnWrap.appendChild(loadBtn);
    btnWrap.appendChild(delBtn);

    top.appendChild(label);
    top.appendChild(btnWrap);

    const details = document.createElement("div");
    details.className = "weekDetails";
    details.textContent = summarizeWeek(w.data);

    row.appendChild(top);
    row.appendChild(details);
    historyList.appendChild(row);
  });
}

exportBtn.addEventListener("click", () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    weeks: getWeeks()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "turnip-tracker-history.json";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
});

importFile.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const weeks = Array.isArray(parsed.weeks) ? parsed.weeks : [];

    // basic merge by id
    const existing = getWeeks();
    const map = new Map(existing.map(w => [w.id, w]));
    weeks.forEach(w => {
      if (w && w.id && w.data) map.set(w.id, w);
    });

    setWeeks(Array.from(map.values()).sort((a,b) => (b.savedAt || "").localeCompare(a.savedAt || "")));
    renderHistory();
  } catch {
    alert("Import failed. Make sure it is a valid exported JSON file.");
  } finally {
    e.target.value = "";
  }
});

function summarizeWeek(data){
  const get = (k) => (data && data[k] ? data[k] : "-");
  return [
    `Mon AM ${get("mon-am")}, Mon PM ${get("mon-pm")}`,
    `Tue AM ${get("tue-am")}, Tue PM ${get("tue-pm")}`,
    `Wed AM ${get("wed-am")}, Wed PM ${get("wed-pm")}`,
    `Thu AM ${get("thu-am")}, Thu PM ${get("thu-pm")}`,
    `Fri AM ${get("fri-am")}, Fri PM ${get("fri-pm")}`,
    `Sat AM ${get("sat-am")}, Sat PM ${get("sat-pm")}`
  ].join(" | ");
}

function formatWeekLabel(iso){
  try{
    const d = new Date(iso);
    return `Saved ${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}`;
  } catch {
    return "Saved week";
  }
}

function cryptoRandomId(){
  // works even if crypto is missing
  const rnd = Math.random().toString(16).slice(2);
  return `w_${Date.now()}_${rnd}`;
}

/* boot */
loadCurrentDraft();
setActiveTab("predict");
