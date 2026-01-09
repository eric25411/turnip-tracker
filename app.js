const pages = document.querySelectorAll(".page");
const navButtons = document.querySelectorAll(".bottom-nav button");

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    navButtons.forEach(b => b.classList.remove("active"));
    pages.forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(btn.dataset.page).classList.add("active");
  });
});

/* WEEK DATE (MOST RECENT SUNDAY) */
function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

document.getElementById("weekDate").textContent = getWeekStart();

/* SIMPLE ENTRY GRID */
const week = document.getElementById("week");
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

days.forEach(day => {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h3>${day}</h3>
    <div>🌞 AM <input type="number" placeholder="-" /></div>
    <div>🌙 PM <input type="number" placeholder="-" /></div>
  `;
  week.appendChild(card);
});
