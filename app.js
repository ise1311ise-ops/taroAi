import { buildDeck78 } from "./deck.js";

const tg = window.Telegram?.WebApp;

/**
 * 1) ПОМЕНЯЙ ЭТО после деплоя сервера:
 * пример: https://your-app.onrender.com/api/tarot/reading
 */
const API_URL = "https://YOUR_SERVER_DOMAIN/api/tarot/reading";

const els = {
  hello: document.getElementById("hello"),
  spreadSelect: document.getElementById("spreadSelect"),
  btnNew: document.getElementById("btnNew"),
  btnRevealAll: document.getElementById("btnRevealAll"),
  btnAI: document.getElementById("btnAI"),
  btnSave: document.getElementById("btnSave"),
  btnHistory: document.getElementById("btnHistory"),
  btnShare: document.getElementById("btnShare"),
  question: document.getElementById("question"),
  board: document.getElementById("board"),
  aiOut: document.getElementById("aiOut"),
  modal: document.getElementById("modal"),
  mTitle: document.getElementById("mTitle"),
  mBody: document.getElementById("mBody"),
  mClose: document.getElementById("mClose"),
};

const deck = buildDeck78();

const spreads = {
  one:  { name: "Карта дня", positions: ["Совет"] },
  three:{ name: "3 карты", positions: ["Прошлое","Настоящее","Будущее"] },
  celtic:{
    name:"Кельтский крест",
    positions:[
      "Суть ситуации","Препятствие/вызов","Основание (корень)","Прошлое",
      "Цель/стремление","Ближайшее будущее","Вы (позиция)","Окружение",
      "Надежды/страхи","Итог"
    ]
  }
};

const state = {
  remaining: [],
  drawn: [], // {pos, card, reversed, revealed}
  spreadKey: "three"
};

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function resetDeck(){
  state.remaining = shuffle([...deck]);
}

function pick(){
  if (state.remaining.length === 0) resetDeck();
  return state.remaining.pop();
}

function initTelegram(){
  if (tg) {
    tg.ready();
    tg.expand();
    const name = tg.initDataUnsafe?.user?.first_name;
    if (name) els.hello.textContent = `Привет, ${name}. Выбери расклад и открой карты.`;
  }
}
initTelegram();

function makeCardSVGFront(title, subtitle){
  const safeTitle = escapeXml(title);
  const safeSub = escapeXml(subtitle);
  return `
<svg viewBox="0 0 360 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="rgba(124,92,255,0.65)"/>
      <stop offset="1" stop-color="rgba(0,212,255,0.22)"/>
    </linearGradient>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="rgba(0,0,0,0.45)"/>
    </filter>
  </defs>
  <rect x="14" y="14" width="332" height="492" rx="26" fill="rgba(18,26,46,0.95)" stroke="rgba(255,255,255,0.12)" stroke-width="2" filter="url(#s)"/>
  <rect x="34" y="40" width="292" height="360" rx="18" fill="url(#g)" opacity="0.7"/>
  <path d="M70 210 C120 150, 240 150, 290 210 C240 270, 120 270, 70 210 Z" fill="rgba(0,0,0,0.18)"/>
  <circle cx="180" cy="210" r="48" fill="rgba(255,255,255,0.12)"/>
  <text x="180" y="445" text-anchor="middle" font-size="22" font-family="system-ui" fill="rgba(233,238,252,0.95)" font-weight="800">${safeTitle}</text>
  <text x="180" y="472" text-anchor="middle" font-size="14" font-family="system-ui" fill="rgba(170,179,207,0.95)">${safeSub}</text>
</svg>`;
}

function makeCardSVGBack(){
  return `
<svg viewBox="0 0 360 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="rgba(124,92,255,0.45)"/>
      <stop offset="1" stop-color="rgba(0,212,255,0.18)"/>
    </linearGradient>
    <pattern id="p" width="36" height="36" patternUnits="userSpaceOnUse">
      <path d="M18 6 L30 18 L18 30 L6 18 Z" fill="rgba(255,255,255,0.08)"/>
    </pattern>
  </defs>
  <rect x="14" y="14" width="332" height="492" rx="26" fill="rgba(18,26,46,0.95)" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
  <rect x="34" y="40" width="292" height="440" rx="18" fill="url(#bg)"/>
  <rect x="34" y="40" width="292" height="440" rx="18" fill="url(#p)" opacity="0.9"/>
  <circle cx="180" cy="260" r="70" fill="rgba(0,0,0,0.20)"/>
  <path d="M180 205 L205 260 L180 315 L155 260 Z" fill="rgba(255,255,255,0.20)"/>
  <text x="180" y="110" text-anchor="middle" font-size="18" font-family="system-ui" fill="rgba(233,238,252,0.90)" font-weight="800">TAROT AI</text>
</svg>`;
}

function escapeXml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function render(){
  els.board.innerHTML = "";
  const sp = spreads[state.spreadKey];

  state.drawn.forEach((d, idx) => {
    const el = document.createElement("div");
    el.className = "card";

    const top = document.createElement("div");
    top.className = "cardTop";
    top.innerHTML = `<span>${sp.positions[idx]}</span><span class="badge">${d.reversed ? "перевёрн." : "прямая"}</span>`;

    const face = document.createElement("div");
    face.className = "cardFace";

    const svg = d.revealed
      ? makeCardSVGFront(d.card.name, d.card.meta)
      : makeCardSVGBack();

    face.innerHTML = svg;

    face.addEventListener("click", () => {
      if (!d.revealed) {
        d.revealed = true;
        tg?.HapticFeedback?.selectionChanged?.();
        render();
      } else {
        openModal(d);
      }
    });

    el.appendChild(top);
    el.appendChild(face);
    els.board.appendChild(el);
  });
}

function openModal(d){
  els.mTitle.textContent = d.card.name + (d.reversed ? " (перевёрнутая)" : "");
  els.mBody.textContent = d.card.meta;
  els.modal.classList.add("open");
}
function closeModal(){ els.modal.classList.remove("open"); }

els.mClose.addEventListener("click", closeModal);
els.modal.addEventListener("click", (e) => { if (e.target === els.modal) closeModal(); });

function newReading(){
  resetDeck();
  const sp = spreads[state.spreadKey];
  state.drawn = sp.positions.map(pos => {
    const card = pick();
    const reversed = Math.random() < 0.28;
    return { pos, card, reversed, revealed: false };
  });
  els.aiOut.textContent = "Тут появится трактовка от ИИ…";
  render();
}

function revealAll(){
  state.drawn.forEach(x => x.revealed = true);
  render();
}

function saveHistory(){
  const key = "tarot_history_v2";
  const item = {
    at: new Date().toISOString(),
    spread: spreads[state.spreadKey].name,
    question: els.question.value.trim(),
    cards: state.drawn.map(d => ({
      position: d.pos,
      name: d.card.name,
      reversed: d.reversed
    })),
    ai: els.aiOut.textContent
  };
  const list = JSON.parse(localStorage.getItem(key) || "[]");
  list.unshift(item);
  localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
  if (tg?.showPopup) tg.showPopup({ title:"Сохранено", message:"Расклад добавлен в историю.", buttons:[{type:"ok"}] });
  else alert("Сохранено в историю.");
}

function showHistory(){
  const key = "tarot_history_v2";
  const list = JSON.parse(localStorage.getItem(key) || "[]");
  if (!list.length) return alert("История пустая.");
  const text = list.slice(0, 10).map((it, i) => {
    const d = new Date(it.at).toLocaleString();
    const cards = it.cards.map(c => c.name).join(" / ");
    return `${i+1}) ${d} — ${it.spread}\n${cards}\n${it.question ? "Вопрос: " + it.question : ""}`;
  }).join("\n\n");
  alert(text);
}

async function askAI(){
  if (!state.drawn.length) return;

  const question = els.question.value.trim();
  if (!question) return alert("Напиши вопрос.");

  els.aiOut.textContent = "Думаю…";

  const initData = tg?.initData || "";

  const payload = {
    initData,
    question,
    spreadName: spreads[state.spreadKey].name,
    style: "тёплый, практичный",
    cards: state.drawn.map(d => ({
      name: d.card.name,
      position: d.pos,
      reversed: d.reversed,
      meta: d.card.meta
    }))
  };

  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json?.error || "Ошибка запроса");
    els.aiOut.textContent = json.text || "Пустой ответ.";
    tg?.HapticFeedback?.impactOccurred?.("light");
  } catch (e) {
    els.aiOut.textContent = `Ошибка: ${String(e.message || e)}`;
  }
}

function share(){
  const text =
    `Мой расклад: ${spreads[state.spreadKey].name}\n` +
    state.drawn.map(d => `${d.pos}: ${d.card.name}${d.reversed ? " (перев.)" : ""}`).join("\n") +
    `\n\nВопрос: ${els.question.value.trim() || "-"}`;

  if (tg?.shareText) tg.shareText(text);
  else {
    navigator.clipboard?.writeText(text);
    alert("Скопировано в буфер обмена.");
  }
}

els.spreadSelect.addEventListener("change", () => {
  state.spreadKey = els.spreadSelect.value;
  newReading();
});
els.btnNew.addEventListener("click", newReading);
els.btnRevealAll.addEventListener("click", revealAll);
els.btnAI.addEventListener("click", askAI);
els.btnSave.addEventListener("click", saveHistory);
els.btnHistory.addEventListener("click", showHistory);
els.btnShare.addEventListener("click", share);

state.spreadKey = els.spreadSelect.value;
newReading();
