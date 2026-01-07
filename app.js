const ids = [
  "mon-am","mon-pm",
  "tue-am","tue-pm",
  "wed-am","wed-pm",
  "thu-am","thu-pm",
  "fri-am","fri-pm",
  "sat-am","sat-pm",
];

const STORAGE_KEY = "turnipTrackerPricesV1";

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const data = JSON.parse(raw);
    ids.forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      el.value = (data[id] ?? "");
    });
  } catch(e){
    // ignore
  }
}

function save(){
  const data = {};
  ids.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    data[id] = el.value.trim();
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function wireInputs(){
  ids.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;

    el.addEventListener("input", () => {
      // keep numbers only, optional
      el.value = el.value.replace(/[^\d]/g, "");
      save();
    });
  });
}

function wireButtons(){
  const predictBtn = document.getElementById("predictBtn");
  const historyBtn = document.getElementById("historyBtn");

  if(predictBtn){
    predictBtn.addEventListener("click", (e) => {
      e.preventDefault();
      alert("Predict page is coming next. Your prices are saved though.");
    });
  }

  if(historyBtn){
    historyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      alert("History page is coming next. Your prices are saved though.");
    });
  }
}

load();
wireInputs();
wireButtons();
