const homeView = document.getElementById("homeView")
const predictorView = document.getElementById("predictorView")
const historyView = document.getElementById("historyView")

const daysEl = document.getElementById("days")
const weeksList = document.getElementById("weeksList")

// Bottom nav
document.getElementById("navPredict").onclick = () => showView("predictor")
document.getElementById("navHistory").onclick = () => showView("history")

// Home buttons
document.getElementById("predictHomeBtn").onclick = () => showView("home")
document.getElementById("historyHomeBtn").onclick = () => showView("home")

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

function showView(which){
  homeView.hidden = which !== "home"
  predictorView.hidden = which !== "predictor"
  historyView.hidden = which !== "history"

  if (which === "history") renderHistory()
  if (which === "predictor") renderPredictor()
}

function getWeek() {
  return JSON.parse(localStorage.getItem("tt_current_week") || "null")
}

function setWeek(week) {
  localStorage.setItem("tt_current_week", JSON.stringify(week))
}

function defaultWeek() {
  return {
    startDate: new Date().toISOString().slice(0,10),
    buyPrice: null,
    prices: DAYS.map(d => ({ day: d, am: null, pm: null })),
    sold: null
  }
}

function ensureWeek() {
  let w = getWeek()
  if (!w) {
    w = defaultWeek()
    setWeek(w)
  }
  return w
}

function renderHome() {
  const week = ensureWeek()
  daysEl.innerHTML = ""

  week.prices.forEach((p, idx) => {
    const card = document.createElement("div")
    card.className = "dayCard"

    card.innerHTML = `
      <div class="dayName">${p.day}</div>

      <div class="row">
        <div class="rowLabel">☀️ AM</div>
        <input inputmode="numeric" placeholder="—" value="${p.am ?? ""}" data-idx="${idx}" data-slot="am" />
      </div>

      <div class="row">
        <div class="rowLabel">🌙 PM</div>
        <input inputmode="numeric" placeholder="—" value="${p.pm ?? ""}" data-idx="${idx}" data-slot="pm" />
      </div>
    `
    daysEl.appendChild(card)
  })

  daysEl.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("change", (e) => {
      const el = e.target
      const idx = Number(el.dataset.idx)
      const slot = el.dataset.slot
      const val = el.value.trim() === "" ? null : Number(el.value)

      const w = ensureWeek()
      w.prices[idx][slot] = Number.isFinite(val) ? val : null
      setWeek(w)
    })
  })
}

function renderPredictor(){
  const week = ensureWeek()

  // Placeholder so the Predictor page is not empty.
  const all = []
  week.prices.forEach(d => {
    if (Number.isFinite(d.am)) all.push(d.am)
    if (Number.isFinite(d.pm)) all.push(d.pm)
  })

  const best = all.length ? Math.max(...all) : null

  document.getElementById("peakWindow").textContent = best ? "Midweek watch" : "—"
  document.getElementById("patternLeaning").textContent = all.length ? "Unknown" : "—"
  document.getElementById("recommendation").textContent = best ? "Hold, then check again" : "—"
}

function renderHistory() {
  const week = ensureWeek()

  weeksList.innerHTML = `
    <div class="dayCard">
      <div class="dayName">Week starting ${week.startDate}</div>
      <div class="row"><div>Buy</div><strong>${week.buyPrice ?? "—"}</strong></div>
      <div class="row"><div>Sold</div><strong>${week.sold ?? "Not sold"}</strong></div>
      <div style="margin-top:10px; font-size:14px;">
        Next: we will save multiple weeks and show daily AM and PM prices here.
      </div>
    </div>
  `
}

renderHome()
showView("home")
