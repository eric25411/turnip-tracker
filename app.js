const homeView = document.getElementById("homeView")
const historyView = document.getElementById("historyView")
const daysEl = document.getElementById("days")
const weeksList = document.getElementById("weeksList")

document.getElementById("historyBtn").onclick = () => {
  homeView.hidden = true
  historyView.hidden = false
  renderHistory()
}

document.getElementById("homeBtn").onclick = () => {
  historyView.hidden = true
  homeView.hidden = false
}

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

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
        <div>☀️ AM</div>
        <input inputmode="numeric" placeholder="—" value="${p.am ?? ""}" data-idx="${idx}" data-slot="am" />
      </div>

      <div class="row">
        <div>🌙 PM</div>
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

      document.getElementById("peakWindow").textContent = "—"
      document.getElementById("patternLeaning").textContent = "—"
    })
  })
}

function renderHistory() {
  const week = ensureWeek()
  weeksList.innerHTML = `
    <div class="dayCard">
      <div class="dayName">Week starting ${week.startDate}</div>
      <div class="row"><div>Buy</div><strong>${week.buyPrice ?? "—"}</strong></div>
      <div class="row"><div>Sold</div><strong>${week.sold ?? "Not sold"}</strong></div>
      <div style="margin-top:10px; font-size:14px;">Next: we will list Mon–Sat AM/PM here per week.</div>
    </div>
  `
}

renderHome()
