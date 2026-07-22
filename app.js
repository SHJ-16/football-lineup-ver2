const FORMATIONS = {
  "4-3-3": [[50,88,"GK"],[18,72,"LB"],[39,75,"CB"],[61,75,"CB"],[82,72,"RB"],[25,51,"CM"],[50,55,"CM"],[75,51,"CM"],[20,29,"LW"],[50,22,"ST"],[80,29,"RW"]],
  "4-4-2": [[50,88,"GK"],[18,72,"LB"],[39,75,"CB"],[61,75,"CB"],[82,72,"RB"],[18,50,"LM"],[39,54,"CM"],[61,54,"CM"],[82,50,"RM"],[36,27,"ST"],[64,27,"ST"]],
  "3-4-3": [[50,88,"GK"],[25,74,"CB"],[50,76,"CB"],[75,74,"CB"],[15,51,"LM"],[38,54,"CM"],[62,54,"CM"],[85,51,"RM"],[20,27,"LW"],[50,21,"ST"],[80,27,"RW"]],
  "4-2-3-1": [[50,88,"GK"],[18,72,"LB"],[39,75,"CB"],[61,75,"CB"],[82,72,"RB"],[37,56,"DM"],[63,56,"DM"],[20,38,"AM"],[50,37,"AM"],[80,38,"AM"],[50,20,"ST"]]
};

const $ = s => document.querySelector(s);
let activeQuarter = 0;
let dragging = null;
let touchToken = null;

// 위치 교환(Swap) 상태 관리 변수
let isSwapMode = false;
let swapSelectedId = null;

let players = Array.from({ length: 11 }, (_, i) => ({
  id: crypto.randomUUID(),
  name: `Player ${i + 1}`,
  number: i + 1
}));

let quarters = Array.from({ length: 4 }, () => ({
  formation: "4-2-3-1",
  starters: [],
  bench: [],
  positions: {}
}));

quarters.forEach(q => q.starters = players.map(p => p.id));

function current() { return quarters[activeQuarter]; }
function status(id, q = current()) { return q.starters.includes(id) ? "start" : q.bench.includes(id) ? "bench" : ""; }

function setStatus(id, next) {
  const q = current();
  q.starters = q.starters.filter(x => x !== id);
  q.bench = q.bench.filter(x => x !== id);
  delete q.positions[id];
  
  if (next === "start") {
    if (q.starters.length >= 11) { toast("선발 라인업이 가득 찼습니다."); return; }
    q.starters.push(id);
  }
  if (next === "bench") q.bench.push(id);
  render();
}

// 💡 [추가] 현재 쿼터의 선발 선수 전체를 제외하는 함수
function clearAllStarters() {
  const q = current();
  if (q.starters.length === 0) {
    toast("제외할 선발 선수가 없습니다.");
    return;
  }
  
  q.starters = [];
  q.positions = {};
  swapSelectedId = null;
  render();
  toast("현재 쿼터의 선발 라인업을 모두 비웠습니다.");
}

function playerById(id) { return players.find(p => p.id === id); }

// 선수의 현재 좌표 및 포지션 명칭 가져오기
function getPlayerPos(id) {
  const q = current();
  const idx = q.starters.indexOf(id);
  const base = FORMATIONS[q.formation][idx] || [50, 50, "SUB"];

  if (q.positions && q.positions[id]) {
    return {
      x: q.positions[id].x,
      y: q.positions[id].y,
      posName: q.positions[id].posName || base[2]
    };
  }
  
  return { x: base[0], y: base[1], posName: base[2] };
}

// 두 선수의 위치 및 포지션 라벨을 함께 맞바꾸는 함수
function swapPlayerPositions(id1, id2) {
  const q = current();
  if (!q.positions) q.positions = {};

  const pos1 = getPlayerPos(id1);
  const pos2 = getPlayerPos(id2);

  q.positions[id1] = { x: pos2.x, y: pos2.y, posName: pos2.posName };
  q.positions[id2] = { x: pos1.x, y: pos1.y, posName: pos1.posName };
}

// 이동 시 기존 포지션 라벨 유지
function movePlayer(id, clientX, clientY) {
  const host = $("#fieldPlayers");
  const r = host.getBoundingClientRect();
  const q = current();

  const x = Math.max(7, Math.min(93, ((clientX - r.left) / r.width) * 100));
  const y = Math.max(8, Math.min(92, ((clientY - r.top) / r.height) * 100));

  if (!q.positions) q.positions = {};
  const currentPos = getPlayerPos(id);
  q.positions[id] = { x, y, posName: currentPos.posName };
}

// 화면 렌더링 시 보정된 posName 사용
function renderField() {
  const q = current(), host = $("#fieldPlayers");
  host.innerHTML = "";

  q.starters.forEach((id) => {
    const p = playerById(id);
    if (!p) return;

    const posInfo = getPlayerPos(id);

    const el = document.createElement("div");
    const isSelected = swapSelectedId === id;
    
    el.className = `token ${posInfo.posName === "GK" ? "gk" : ""} ${isSelected ? "selected" : ""}`;
    el.style.left = posInfo.x + "%";
    el.style.top = posInfo.y + "%";
    el.draggable = !isSwapMode;
    el.dataset.id = id;

    el.innerHTML = `<div class="shirt">${p.number}</div><strong>${p.name}</strong><small>${posInfo.posName}</small>`;
    
    el.onclick = (e) => {
      if (!isSwapMode) return;
      e.stopPropagation();

      if (!swapSelectedId) {
        swapSelectedId = id;
        toast(`${p.name} 선택됨. 교체할 선수를 클릭하세요.`);
        renderField();
      } else if (swapSelectedId === id) {
        swapSelectedId = null;
        toast("선택이 취소되었습니다.");
        renderField();
      } else {
        const p1 = playerById(swapSelectedId);
        swapPlayerPositions(swapSelectedId, id);
        toast(`${p1.name} ↔ ${p.name} 위치 및 포지션 교환 완료`);
        
        swapSelectedId = null;
        renderField();
      }
    };

    host.append(el);
  });

  $("#formationName").textContent = q.formation.replaceAll("-", " - ");
  $("#starterCounter").textContent = `${q.starters.length} / 11`;
  $("#quarterStatus").textContent = `${q.starters.length} starters · ${q.bench.length} bench`;
}

// 드래그 앤 드롭 이벤트
const fieldHost = $("#fieldPlayers");

fieldHost.addEventListener("dragstart", e => {
  if (isSwapMode) return;
  const token = e.target.closest(".token");
  if (token) dragging = token.dataset.id;
});

fieldHost.addEventListener("dragover", e => e.preventDefault());

fieldHost.addEventListener("drop", e => {
  e.preventDefault();
  if (dragging && !isSwapMode) {
    movePlayer(dragging, e.clientX, e.clientY);
    dragging = null;
    renderField();
  }
});

// 터치 이벤트
fieldHost.addEventListener("touchstart", e => {
  if (isSwapMode) return;
  const token = e.target.closest(".token");
  if (token) touchToken = token;
}, { passive: true });

fieldHost.addEventListener("touchmove", e => {
  if (!touchToken || isSwapMode) return;
  e.preventDefault();
  const id = touchToken.dataset.id;
  const touch = e.touches[0];
  
  movePlayer(id, touch.clientX, touch.clientY);
  
  const pos = current().positions[id];
  if (pos) {
    touchToken.style.left = pos.x + "%";
    touchToken.style.top = pos.y + "%";
  }
}, { passive: false });

fieldHost.addEventListener("touchend", () => {
  if (touchToken) {
    touchToken = null;
    renderField();
  }
});

// 유틸리티 함수들
function summary(id) {
  return quarters.map((q, i) => {
    const s = status(id, q);
    return s === "start" ? `Q${i+1}선발`:"";
  }).filter(Boolean);
}

function renderRoster() {
  const host = $("#playerList");
  host.innerHTML = "";
  players.forEach(p => {
    const s = status(p.id), assign = summary(p.id);
    const card = document.createElement("article");
    card.className = "player-card";
    card.innerHTML = `<div class="number">${p.number}</div><div class="player-info"><input class="name-edit" value="${p.name}" maxlength="16" aria-label="Player name"><p>${assign.length ? assign.join(" · ") : "쿼터에 포함되지 않았습니다."}</p><small>${assign.length} 쿼터 출전</small></div><div class="assign-buttons"><button data-action="start" class="${s === "start" ? "selected" : ""}">선발</button><button data-action="bench" class="${s === "bench" ? "selected" : ""}">교체</button></div>`;    
    card.querySelector(".name-edit").oninput = e => { p.name = e.target.value || "Player"; renderField(); };
    card.querySelectorAll("button").forEach(b => b.onclick = () => setStatus(p.id, b.dataset.action));
    host.append(card);
  });
  $("#rosterCount").textContent = players.length;
}

function renderForms() {
  const host = $("#formationButtons");
  host.innerHTML = "";
  Object.keys(FORMATIONS).forEach(key => {
    const b = document.createElement("button");
    b.textContent = key.replaceAll("-", " - ");
    b.className = current().formation === key ? "selected" : "";
    b.onclick = () => {
      current().formation = key;
      current().positions = {};
      render();
    };
    host.append(b);
  });
}

function calculate() {
  const pool = Math.max(1, Number($("#poolInput").value) || 1), spots = Math.max(1, Number($("#spotsInput").value) || 1), slots = spots * 4, base = Math.floor(slots / pool), extra = slots % pool;
  $("#calculation").innerHTML = extra ? `<b>${pool - extra}</b>명의 선수들은 <b>${base}</b>쿼터 출전 <br> <b>${extra}</b>명의 선수들은 <b>${base + 1}</b>쿼터 출전<small>${spots} 필드 인원 × 4쿼터 = ${slots} 전체 필요 인원</small>` : ` <b>${pool}</b>명의 선수들은 <b>${base}</b>쿼터 출전 <small>${spots} 필드 인원 × 4쿼터 =  ${slots} 전체 필요 인원</small>`;
}

function render() {
  document.querySelectorAll(".quarter").forEach((b, i) => b.classList.toggle("active", i === activeQuarter));
  renderField();
  renderForms();
  renderRoster();
  calculate();
}

function toast(message) {
  const t = $("#toast");
  t.textContent = message;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

document.querySelectorAll(".quarter").forEach((b, i) => b.onclick = () => { activeQuarter = i; render(); });
$("#addPlayer").onclick = () => {
  const next = players.length + 1;
  players.push({ id: crypto.randomUUID(), name: `Player ${next}`, number: next });
  render();
  toast("선수를 추가했습니다.");
};
$("#poolInput").oninput = calculate;
$("#spotsInput").oninput = calculate;
$("#saveBtn").onclick = () => {
  localStorage.setItem("quarter-lineup", JSON.stringify({ players, quarters }));
  toast("Plan saved");
};

// 위치 교환 버튼 이벤트 바인딩
const swapBtn = $("#swapBtn");
if (swapBtn) {
  swapBtn.onclick = () => {
    isSwapMode = !isSwapMode;
    swapSelectedId = null;
    
    swapBtn.classList.toggle("active", isSwapMode);
    
    if (isSwapMode) {
      toast("위치 교환 모드: 첫 번째 선수를 선택하세요.");
    } else {
      toast("위치 교환 모드가 해제되었습니다.");
    }
    renderField();
  };
}

// 💡 [추가] 선발 전체 제외 버튼 이벤트 바인딩
const clearAllBtn = $("#clearAllBtn");
if (clearAllBtn) {
  clearAllBtn.onclick = clearAllStarters;
}

try {
  const saved = JSON.parse(localStorage.getItem("quarter-lineup"));
  if (saved?.players?.length && saved?.quarters?.length) {
    players = saved.players;
    quarters = saved.quarters;
  }
} catch {}

render();
