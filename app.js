const FORMATIONS = {
  "4-3-3": [[50,88,"GK"],[18,72,"LB"],[39,75,"CB"],[61,75,"CB"],[82,72,"RB"],[25,51,"CM"],[50,55,"CM"],[75,51,"CM"],[20,29,"LW"],[50,22,"ST"],[80,29,"RW"]],
  "4-4-2": [[50,88,"GK"],[18,72,"LB"],[39,75,"CB"],[61,75,"CB"],[82,72,"RB"],[18,50,"LM"],[39,54,"CM"],[61,54,"CM"],[82,50,"RM"],[36,27,"ST"],[64,27,"ST"]],
  "3-4-3": [[50,88,"GK"],[25,74,"CB"],[50,76,"CB"],[75,74,"CB"],[15,51,"LM"],[38,54,"CM"],[62,54,"CM"],[85,51,"RM"],[20,27,"LW"],[50,21,"ST"],[80,27,"RW"]],
  "4-2-3-1": [[50,88,"GK"],[18,72,"LB"],[39,75,"CB"],[61,75,"CB"],[82,72,"RB"],[37,56,"DM"],[63,56,"DM"],[20,38,"AM"],[50,37,"AM"],[80,38,"AM"],[50,20,"ST"]]
};

const $ = selector => document.querySelector(selector);
const MAX_STARTERS = 11;
const DEFAULT_FORMATION = "4-2-3-1";
const DEFAULT_PLAYER_COUNT = 13;
const dom = {
  field: $("#fieldPlayers"),
  formationName: $("#formationName"),
  starterCounter: $("#starterCounter"),
  quarterStatus: $("#quarterStatus"),
  playerList: $("#playerList"),
  rosterCount: $("#rosterCount"),
  formationButtons: $("#formationButtons"),
  calculation: $("#calculation"),
  poolInput: $("#poolInput"),
  spotsInput: $("#spotsInput"),
  toast: $("#toast")
};
let activeQuarter = 0;
let dragging = null;
let touchToken = null;
let toastTimer = null;

let isSwapMode = false;
let swapSelectedId = null;

const createId = () => globalThis.crypto?.randomUUID?.() ?? `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let players = Array.from({ length: DEFAULT_PLAYER_COUNT }, (_, i) => ({
  id: createId(),
  name: `Player ${i + 1}`,
  number: i + 1
}));

let quarters = Array.from({ length: 4 }, () => ({
  formation: DEFAULT_FORMATION,
  starters: [],
  bench: [],
  positions: {}
}));

quarters.forEach(q => q.starters = players.slice(0, MAX_STARTERS).map(p => p.id));

let playersById = new Map();
function rebuildPlayerIndex() {
  playersById = new Map(players.map(player => [player.id, player]));
}
rebuildPlayerIndex();

function current() { return quarters[activeQuarter]; }
function status(id, q = current()) { return q.starters.includes(id) ? "start" : q.bench.includes(id) ? "bench" : ""; }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function logWarn(event, error) {
  console.warn(`[Quarter Lineup] ${event}`, error instanceof Error ? error.message : error);
}

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

function playerById(id) { return playersById.get(id); }

function getPlayerPos(id) {
  const q = current();
  const idx = q.starters.indexOf(id);
  const base = (FORMATIONS[q.formation] || FORMATIONS[DEFAULT_FORMATION])[idx] || [50, 50, "SUB"];

  if (q.positions && q.positions[id]) {
    return {
      x: q.positions[id].x,
      y: q.positions[id].y,
      posName: q.positions[id].posName || base[2]
    };
  }
  
  return { x: base[0], y: base[1], posName: base[2] };
}

function swapPlayerPositions(id1, id2) {
  const q = current();
  if (!q.positions) q.positions = {};

  const pos1 = getPlayerPos(id1);
  const pos2 = getPlayerPos(id2);

  q.positions[id1] = { x: pos2.x, y: pos2.y, posName: pos2.posName };
  q.positions[id2] = { x: pos1.x, y: pos1.y, posName: pos1.posName };
}

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

function renderFieldLegacy() {
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

    el.innerHTML = `<div class="shirt-outline"><div class="shirt">${p.number}</div></div><strong>${escapeHtml(p.name)}</strong><small>${posInfo.posName}</small>`;
    
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

function renderField() {
  const q = current();
  const fragment = document.createDocumentFragment();

  q.starters.forEach(id => {
    const player = playerById(id);
    if (!player) return;
    const position = getPlayerPos(id);
    const token = document.createElement("div");
    token.className = `token ${position.posName === "GK" ? "gk" : ""} ${swapSelectedId === id ? "selected" : ""}`;
    token.style.left = `${position.x}%`;
    token.style.top = `${position.y}%`;
    token.draggable = !isSwapMode;
    token.dataset.id = id;

    const shirt = document.createElement("div");
    shirt.className = "shirt";
    shirt.textContent = player.number;
    const shirtOutline = document.createElement("div");
    shirtOutline.className = "shirt-outline";
    shirtOutline.append(shirt);
    const name = document.createElement("strong");
    name.textContent = player.name;
    const label = document.createElement("small");
    label.textContent = position.posName;
    token.append(shirtOutline, name, label);
    fragment.append(token);
  });

  dom.field.replaceChildren(fragment);
  dom.formationName.textContent = q.formation.replaceAll("-", " - ");
  dom.starterCounter.textContent = `${q.starters.length} / ${MAX_STARTERS}`;
  dom.quarterStatus.textContent = `${q.starters.length} starters · ${q.bench.length} bench`;
}

const fieldHost = dom.field;

fieldHost.addEventListener("click", e => {
  if (!isSwapMode) return;
  const token = e.target.closest(".token");
  if (!token || !fieldHost.contains(token)) return;
  const id = token.dataset.id;
  const player = playerById(id);
  if (!player) return;

  if (!swapSelectedId) {
    swapSelectedId = id;
    toast(`${player.name} selected. Choose a player to swap.`);
  } else if (swapSelectedId === id) {
    swapSelectedId = null;
    toast("Selection cancelled.");
  } else {
    const selectedPlayer = playerById(swapSelectedId);
    swapPlayerPositions(swapSelectedId, id);
    swapSelectedId = null;
    toast(`${selectedPlayer?.name || "Player"} and ${player.name} swapped.`);
  }
  renderField();
});

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

function summary(id) {
  return quarters.map((q, i) => {
    const s = status(id, q);
    return s === "start" ? `Q${i+1}선발` : "";
  }).filter(Boolean);
}

function renderRoster() {
  const host = $("#playerList");
  host.innerHTML = "";
  players.forEach(p => {
    const s = status(p.id), assign = summary(p.id);
    const card = document.createElement("article");
    card.className = "player-card";
    card.innerHTML = `<div class="number">${p.number}</div><div class="player-info"><input class="name-edit" value="${escapeHtml(p.name)}" maxlength="16" aria-label="Player name"><p>${assign.length ? assign.join(" · ") : "쿼터에 포함되지 않았습니다."}</p><small>${assign.length} 쿼터 출전</small></div><div class="assign-buttons"><button data-action="start" class="${s === "start" ? "selected" : ""}">선발</button><button data-action="bench" class="${s === "bench" ? "selected" : ""}">교체</button></div>`;    
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

// 💡 쿼터 및 인원 수 자동 계산 함수
function getQuarterCalculation() {
  const readPositiveInteger = (input, fallback) => {
    const value = Number(input.value);
    return Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;
  };
  const total = readPositiveInteger(dom.poolInput, players.length);
  const fieldSpots = readPositiveInteger(dom.spotsInput, 10);
  
  // GK 1명 제외 후 필드 플레이어 수
  const fieldPlayersCount = Math.max(1, total - 1);
  const totalFieldSlots = fieldSpots * 4; // 4쿼터 동안의 필드 자리 수
  
  const baseQuarters = Math.floor(totalFieldSlots / fieldPlayersCount);
  const extraQuartersCount = totalFieldSlots % fieldPlayersCount;
  const baseQuartersCount = fieldPlayersCount - extraQuartersCount;

  return {
    total,
    fieldSpots,
    fieldPlayersCount,
    totalFieldSlots,
    baseQuarters,           // 예: 3쿼터
    baseQuartersCount,      // 예: 8명
    extraQuarters: baseQuarters + 1, // 예: 4쿼터
    extraQuartersCount      // 예: 4명
  };
}

function calculate() {
  const calc = getQuarterCalculation();

  if (calc.extraQuartersCount > 0) {
    $("#calculation").innerHTML = `
      <b>${calc.baseQuartersCount}</b>명의 선수는 <b>${calc.baseQuarters}</b>쿼터 출전 <br>
      <b>${calc.extraQuartersCount}</b>명의 선수는 <b>${calc.extraQuarters}</b>쿼터 출전
      <small>필드 ${calc.fieldSpots}명 × 4쿼터 = 총 ${calc.totalFieldSlots} 출전 자릿수 (GK 1명 고정 제외)</small>
    `;
  } else {
    $("#calculation").innerHTML = `
      <b>${calc.fieldPlayersCount}</b>명의 필드 선수는 모두 <b>${calc.baseQuarters}</b>쿼터 출전
      <small>필드 ${calc.fieldSpots}명 × 4쿼터 = 총 ${calc.totalFieldSlots} 출전 자릿수 (GK 1명 고정 제외)</small>
    `;
  }
}

function render() {
  document.querySelectorAll(".quarter").forEach((b, i) => b.classList.toggle("active", i === activeQuarter));
  renderField();
  renderForms();
  renderRoster();
  calculate();
}

function toast(message) {
  const t = dom.toast;
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

document.querySelectorAll(".quarter").forEach((b, i) => b.onclick = () => { activeQuarter = i; render(); });

$("#addPlayer").onclick = () => {
  const next = players.length + 1;
  players.push({ id: createId(), name: `Player ${next}`, number: next });
  rebuildPlayerIndex();
  dom.poolInput.value = players.length;
  render();
  toast("선수를 추가했습니다.");
};

dom.poolInput.oninput = calculate;
dom.spotsInput.oninput = calculate;

$("#saveBtn").onclick = () => {
  try {
    localStorage.setItem("quarter-lineup", JSON.stringify({ players, quarters }));
    toast("Plan saved");
  } catch (error) {
    logWarn("save failed", error);
    toast("Could not save this plan.");
  }
};

const swapBtn = $("#swapBtn");
if (swapBtn) {
  swapBtn.onclick = () => {
    isSwapMode = !isSwapMode;
    swapSelectedId = null;
    swapBtn.classList.toggle("active", isSwapMode);
    toast(isSwapMode ? "위치 교환 모드: 첫 번째 선수를 선택하세요." : "위치 교환 모드가 해제되었습니다.");
    renderField();
  };
}

const clearAllBtn = $("#clearAllBtn");
if (clearAllBtn) {
  clearAllBtn.onclick = clearAllStarters;
}

// 카카오톡 명단 모달 및 파싱
const kakaoModal = $("#kakaoModal");
const kakaoInput = $("#kakaoInput");

$("#kakaoImportBtn").onclick = () => {
  kakaoInput.value = "";
  kakaoModal.classList.add("active");
};

$("#closeKakaoModalBtn").onclick = () => {
  kakaoModal.classList.remove("active");
};

$("#submitKakaoModalBtn").onclick = () => {
  const rawText = kakaoInput.value;
  if (!rawText.trim()) {
    toast("명단을 입력해 주세요.");
    return;
  }

  const parsedNames = rawText
    .split(/\n|,/)
    .map(line => line.replace(/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, '').trim())
    .filter(name => name.length > 0);

  if (parsedNames.length === 0) {
    toast("유효한 이름이 없습니다.");
    return;
  }

  const uniqueNames = [...new Set(parsedNames)];
  players = uniqueNames.map((name, i) => ({
    id: createId(),
    name: name,
    number: i + 1
  }));
  rebuildPlayerIndex();

  quarters.forEach(q => {
    q.starters = [];
    q.bench = [];
    q.positions = {};
  });

  dom.poolInput.value = players.length;
  
  kakaoModal.classList.remove("active");
  render();
  toast(`${players.length}명의 선수가 등록되었습니다.`);
};

// 배열 무작위 셔플
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 💡 골키퍼 선택 모달 및 무작위 추첨 로직
const gkSelectModal = $("#gkSelectModal");
const gkSelectDropdown = $("#gkSelectDropdown");

$("#drawQuartersBtn").onclick = () => {
  const calc = getQuarterCalculation();
  if (players.length < calc.fieldSpots + 1) {
    toast(`전체 인원이 필드 플레이어 수(${calc.fieldSpots}명) + GK(1명)보다 커야 합니다.`);
    return;
  }

  // 골키퍼 선택 드롭다운 채우기
  gkSelectDropdown.innerHTML = `<option value="random">무작위 골키퍼 추첨</option>`;
  players.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name} (#${p.number})`;
    gkSelectDropdown.appendChild(opt);
  });

  gkSelectModal.classList.add("active");
};

$("#closeGkModalBtn").onclick = () => {
  gkSelectModal.classList.remove("active");
};

$("#submitGkModalBtn").onclick = () => {
  gkSelectModal.classList.remove("active");
  executeQuarterDraw();
};

function executeQuarterDraw() {
  const calc = getQuarterCalculation();
  const selectedGkValue = gkSelectDropdown.value;

  let gkPlayer;
  let candidatePlayers = [...players];

  if (selectedGkValue === "random") {
    const shuffled = shuffle(candidatePlayers);
    gkPlayer = shuffled[0];
    candidatePlayers = shuffled.slice(1);
  } else {
    gkPlayer = players.find(p => p.id === selectedGkValue);
    if (!gkPlayer) {
      logWarn("selected goalkeeper was not found", selectedGkValue);
      toast("Please choose a goalkeeper again.");
      return;
    }
    candidatePlayers = candidatePlayers.filter(p => p.id !== gkPlayer.id);
  }

  if (!gkPlayer) {
    logWarn("draw requested with no eligible goalkeeper", { playerCount: players.length });
    toast("Not enough players to draw quarters.");
    return;
  }

  // 필드 선수들 무작위 셔플
  const shuffledField = shuffle(candidatePlayers);

  // 4쿼터 및 3쿼터 (또는 계산된 쿼터) 참여자 분류
  let highQuarterGroup = []; // 높은 쿼터수를 뛰는 그룹 (예: 4쿼터)
  let lowQuarterGroup = [];  // 낮은 쿼터수를 뛰는 그룹 (예: 3쿼터)

  if (calc.extraQuartersCount > 0) {
    highQuarterGroup = shuffledField.slice(0, calc.extraQuartersCount);
    lowQuarterGroup = shuffledField.slice(calc.extraQuartersCount);
  } else {
    lowQuarterGroup = shuffledField;
  }

  // 각 필드 플레이어별 출전시킬 쿼터 무작위 선택
  // highQuarterGroup 멤버 출전 쿼터 배정 (예: 4쿼터 전체)
  // lowQuarterGroup 멤버 출전 쿼터 배정 (예: 3쿼터 무작위)
  // 결과 HTML 생성
  const highNames = highQuarterGroup.map(p => escapeHtml(p.name)).join(", ");
  const lowNames = lowQuarterGroup.map(p => escapeHtml(p.name)).join(", ");

  const resultContainer = $("#drawResultContainer");
  resultContainer.innerHTML = `
    <div class="draw-result-card" style="border-left-color: #f59f42;">
      <h4>모든 쿼터 골키퍼 <span class="badge">${escapeHtml(gkPlayer.name)}</span></h4>
    </div>
    
    ${calc.extraQuartersCount > 0 ? `
    <div class="draw-result-card">
      <h4>${calc.extraQuarters}쿼터 출전자 <span>(${calc.extraQuartersCount}명)</span></h4>
      <p>${highNames || "없음"}</p>
    </div>` : ''}

    <div class="draw-result-card">
      <h4>${calc.baseQuarters}쿼터 출전자 <span>(${calc.baseQuartersCount}명)</span></h4>
      <p>${lowNames || "없음"}</p>
    </div>
  `;

  toast("무작위 쿼터 추첨이 완료되었습니다!");
}

function restoreSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem("quarter-lineup"));
    if (!Array.isArray(saved?.players) || !Array.isArray(saved?.quarters) || saved.quarters.length !== 4) return;

    const restoredPlayers = saved.players
      .filter(player => player && typeof player.id === "string" && typeof player.name === "string" && Number.isFinite(Number(player.number)))
      .map((player, index) => ({ id: player.id, name: player.name.slice(0, 16) || `Player ${index + 1}`, number: Number(player.number) }));
    const ids = new Set(restoredPlayers.map(player => player.id));
    if (!restoredPlayers.length || ids.size !== restoredPlayers.length) return;

    const restoredQuarters = saved.quarters.map(quarter => {
      const starterIds = Array.isArray(quarter?.starters) ? quarter.starters.filter(id => ids.has(id)).slice(0, MAX_STARTERS) : [];
      const starters = [...new Set(starterIds)];
      const bench = Array.isArray(quarter?.bench) ? [...new Set(quarter.bench.filter(id => ids.has(id) && !starters.includes(id)))] : [];
      const positions = {};
      if (quarter?.positions && typeof quarter.positions === "object") {
        Object.entries(quarter.positions).forEach(([id, position]) => {
          if (!ids.has(id) || !position) return;
          const x = Number(position.x), y = Number(position.y);
          if (Number.isFinite(x) && Number.isFinite(y)) positions[id] = { x, y, posName: typeof position.posName === "string" ? position.posName.slice(0, 8) : "" };
        });
      }
      return {
        formation: FORMATIONS[quarter?.formation] ? quarter.formation : DEFAULT_FORMATION,
        starters,
        bench,
        positions
      };
    });
    players = restoredPlayers;
    quarters = restoredQuarters;
    rebuildPlayerIndex();
  } catch (error) {
    logWarn("saved plan ignored", error);
  }
}

restoreSavedState();

render();

// 이미지 복사 관련 기능
async function copyAllQuartersImage() {
  const width = 1400;
  const height = 1000;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    logWarn("image copy is unavailable", "Canvas or Clipboard API is unavailable");
    toast("Image copy is not available in this browser.");
    return;
  }

  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const margin = 2;
  const gap = 4;

  const panelWidth = (width - gap) / 2;
  const panelHeight = (height - gap) / 2;

  for (let qIndex = 0; qIndex < 4; qIndex++) {
    const x = qIndex % 2 === 0 ? margin : panelWidth + gap / 2;
    const y = qIndex < 2 ? margin : panelHeight + gap / 2;

    drawQuarterCanvas(ctx, qIndex, x, y, panelWidth - margin, panelHeight - margin);
  }

  canvas.toBlob(async blob => {
    if (!blob) {
      toast("이미지를 만들 수 없습니다.");
      return;
    }

    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob })
      ]);
      toast("1~4쿼터 라인업 이미지를 복사했습니다.");
    } catch (error) {
      logWarn("image copy failed", error);
      toast("이미지 복사에 실패했습니다.");
    }
  }, "image/png");
}

function drawQuarterCanvas(ctx, quarterIndex, x, y, width, height) {
  const q = quarters[quarterIndex];

  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, width, height, 12);
  ctx.fillStyle = "#2e7a4b";
  ctx.fill();
  ctx.clip();

  const stripeWidth = width / 10;
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#348354" : "#2e7b4d";
    ctx.fillRect(x + i * stripeWidth, y, stripeWidth + 1, height);
  }

  ctx.strokeStyle = "rgba(248,255,247,0.68)";
  ctx.lineWidth = 1.5;

  const fieldX = x + 18;
  const fieldY = y + 18;
  const fieldW = width - 36;
  const fieldH = height - 36;

  ctx.strokeRect(fieldX, fieldY, fieldW, fieldH);

  ctx.beginPath();
  ctx.moveTo(fieldX, fieldY + fieldH / 2);
  ctx.lineTo(fieldX + fieldW, fieldY + fieldH / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(fieldX + fieldW / 2, fieldY + fieldH / 2, Math.min(fieldW, fieldH) * 0.105, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(fieldX + fieldW / 2, fieldY + fieldH / 2, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(248,255,247,0.75)";
  ctx.fill();

  const boxW = fieldW * 0.42;
  const boxH = fieldH * 0.17;
  const boxX = fieldX + (fieldW - boxW) / 2;

  ctx.strokeStyle = "rgba(248,255,247,0.68)";
  ctx.strokeRect(boxX, fieldY, boxW, boxH);
  ctx.strokeRect(boxX, fieldY + fieldH - boxH, boxW, boxH);

  const goalW = fieldW * 0.19;
  const goalH = fieldH * 0.04;
  const goalX = fieldX + (fieldW - goalW) / 2;

  ctx.strokeRect(goalX, fieldY, goalW, goalH);
  ctx.strokeRect(goalX, fieldY + fieldH - goalH, goalW, goalH);

  drawQuarterTitle(ctx, x + 10, y + 10, `Q${quarterIndex + 1}`);

  q.starters.forEach(id => {
    const player = playerById(id);
    if (!player) return;
    const pos = getPlayerPosForQuarter(id, q);
    drawPlayerCanvas(ctx, player, pos, fieldX, fieldY, fieldW, fieldH);
  });

  ctx.restore();
}

function getPlayerPosForQuarter(id, q) {
  const idx = q.starters.indexOf(id);
  const base = (FORMATIONS[q.formation] || FORMATIONS[DEFAULT_FORMATION])[idx] || [50, 50, "SUB"];

  if (q.positions && q.positions[id]) {
    return {
      x: q.positions[id].x,
      y: q.positions[id].y,
      posName: q.positions[id].posName || base[2]
    };
  }

  return { x: base[0], y: base[1], posName: base[2] };
}

function drawPlayerCanvas(ctx, player, pos, fieldX, fieldY, fieldW, fieldH) {
  const px = fieldX + fieldW * pos.x / 100;
  const py = fieldY + fieldH * pos.y / 100;

  const shirtW = 38;
  const shirtH = 46;

  ctx.save();
  ctx.shadowColor = "rgba(21,53,34,0.4)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 3;

  const sx = px - shirtW / 2;
  const sy = py - shirtH / 2;

  ctx.beginPath();
  ctx.moveTo(sx + shirtW * 0.27, sy);
  ctx.lineTo(sx + shirtW * 0.42, sy + shirtH * 0.11);
  ctx.lineTo(sx + shirtW * 0.58, sy + shirtH * 0.11);
  ctx.lineTo(sx + shirtW * 0.73, sy);
  ctx.lineTo(sx + shirtW, sy + shirtH * 0.19);
  ctx.lineTo(sx + shirtW * 0.83, sy + shirtH * 0.43);
  ctx.lineTo(sx + shirtW * 0.78, sy + shirtH);
  ctx.lineTo(sx + shirtW * 0.22, sy + shirtH);
  ctx.lineTo(sx + shirtW * 0.17, sy + shirtH * 0.43);
  ctx.lineTo(sx, sy + shirtH * 0.19);
  ctx.closePath();

  ctx.fillStyle = pos.posName === "GK" ? "#f59f42" : "#e4ff63";
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = pos.posName === "GK" ? "#ffffff" : "#28351b";
  ctx.font = '700 13px "DM Mono", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.number, px, py + 2);

  const nameY = py + shirtH / 2 + 12;
  ctx.font = '700 11px "DM Sans", "Noto Sans KR", sans-serif';
  const nameWidth = ctx.measureText(player.name).width + 14;

  ctx.fillStyle = "rgba(249,255,248,0.92)";
  roundRect(ctx, px - nameWidth / 2, nameY - 8, nameWidth, 17, 4);
  ctx.fill();

  ctx.fillStyle = "#183a25";
  ctx.fillText(player.name, px, nameY);

  ctx.font = '10px "DM Mono", monospace';
  ctx.fillStyle = "#edffe8";
  ctx.fillText(pos.posName, px, nameY + 13);
}

function drawQuarterTitle(ctx, x, y, title) {
  ctx.fillStyle = "#172518";
  roundRect(ctx, x, y, 76, 45, 7);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = '700 18px "Noto Sans KR", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title.replace("Q", "") + "쿼터", x + 38, y + 23);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

const copyImageBtn = $("#copyImageBtn");
if (copyImageBtn) {
  copyImageBtn.onclick = () => {
    copyAllQuartersImage();
  };
}

