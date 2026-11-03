//----- Meat data: seconds until [medium, perfect, burnt] and points for a perfect serve -----
const MEATS = {
  boerewors: { label: "Boerewors", times: [4, 8, 12], points: 100 },
  chops:     { label: "Lamb chops", times: [3, 6, 9],  points: 80  },
  sosaties:  { label: "Sosaties",  times: [5, 10, 14], points: 150 },
  steak:     { label: "Steak",     times: [4, 8, 12],  points: 120 }
};

const GUEST_NAMES = ["Thabo", "Lerato", "Pieter", "Aisha", "Sipho", "Zanele", "Johan", "Naledi"];

const SLOT_COUNT = 6;
const GUEST_SLOTS = 3;
const TICK_MS = 100;
const START_LIVES = 3;
const SERVES_PER_LEVEL = 5;

// ----- Game state -----
let grill, guests, score, lives, served, spawnTimer, gameOver;
let selected = null; // index of the braai slot the player has picked up

// ----- Page elements -----
const trayEl    = document.getElementById("tray");
const grillEl   = document.getElementById("grill");
const guestsEl  = document.getElementById("guests");
const scoreEl   = document.getElementById("score");
const livesEl   = document.getElementById("lives");
const levelEl   = document.getElementById("level");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restart");

// ----- Difficulty gets harder every level -----
function level() { return 1 + Math.floor(served / SERVES_PER_LEVEL); }
function spawnEvery() { return Math.max(2.5, 6 - (level() - 1) * 0.5); } // seconds between guests
function patienceFor() { return Math.max(14, 28 - (level() - 1) * 2); } // seconds a guest will wait

function say(text) { messageEl.textContent = text; }

// Work out the cooking stage from how long the meat has been on the grill
function stageOf(item) {
  const [medium, perfect, burnt] = MEATS[item.type].times;
  if (item.t < medium) return "raw";
  if (item.t < perfect) return "medium";
  if (item.t < burnt) return "perfect";
  return "burnt";
}

// ----- Build the tray buttons (once) -----
Object.keys(MEATS).forEach(type => {
  const btn = document.createElement("button");
  btn.textContent = MEATS[type].label;
  btn.addEventListener("click", () => addMeat(type));
  trayEl.appendChild(btn);
});

// ----- Build the grill slots (once) -----
const slotEls = Array.from({ length: SLOT_COUNT }, (_, i) => {
  const btn = document.createElement("button");
  btn.className = "slot";
  btn.addEventListener("click", () => pickMeat(i));
  grillEl.appendChild(btn);
  return btn;
});

// ----- Build the guest buttons (once) -----
const guestEls = Array.from({ length: GUEST_SLOTS }, (_, g) => {
  const btn = document.createElement("button");
  btn.className = "guest empty";
  btn.innerHTML = '<strong class="g-name"></strong><span class="g-order"></span><div class="bar"><div class="fill"></div></div>';
  btn.addEventListener("click", () => serveGuest(g));
  guestsEl.appendChild(btn);
  return {
    btn: btn,
    name: btn.querySelector(".g-name"),
    order: btn.querySelector(".g-order"),
    fill: btn.querySelector(".fill")
  };
});

// ----- Start / restart -----
function startGame() {
  grill = Array(SLOT_COUNT).fill(null);  // each slot: null or { type, t }
  guests = Array(GUEST_SLOTS).fill(null); // each guest: null or { name, type, patience, max }
  score = 0;
  lives = START_LIVES;
  served = 0;
  spawnTimer = 0;
  selected = null;
  gameOver = false;
  restartBtn.hidden = true;
  spawnGuest();
  say("Click the meat your guest ordered to start cooking it.");
  render();
}

function endGame() {
  gameOver = true;
  say("Game over! Final score: " + score + ". You served " + served + " guests.");
  restartBtn.hidden = false;
  restartBtn.focus();
}

// ----- Guests -----
function spawnGuest() {
  const free = guests.findIndex(g => g === null);
  if (free === -1) return;
  const types = Object.keys(MEATS);
  const patience = patienceFor();
  guests[free] = {
    name: GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)],
    type: types[Math.floor(Math.random() * types.length)],
    patience: patience,
    max: patience
  };
}

// ----- Step 1: put meat on the braai -----
function addMeat(type) {
  if (gameOver) return;
  const free = grill.findIndex(s => s === null);
  if (free === -1) { say("The braai is full! Serve or bin something first."); return; }
  grill[free] = { type, t: 0 };
  say(MEATS[type].label + " is cooking. Click it when it is golden.");
  render();
}

// ----- Step 2: pick up cooked meat from the braai (or bin burnt meat) -----
function pickMeat(i) {
  if (gameOver) return;
  const item = grill[i];
  if (!item) return;

  const stage = stageOf(item);
  const label = MEATS[item.type].label;

  if (stage === "raw") {
    say(label + " is still raw. Give it more time.");
    return;
  }

  if (stage === "burnt") {
    grill[i] = null;
    if (selected === i) selected = null;
    score -= 20;
    say("Binned the burnt " + label + ". (-20)");
    render();
    return;
  }

  // Cooked: select it (click again to put it back down)
  selected = (selected === i) ? null : i;
  if (selected === null) {
    say("Put " + label + " back down.");
  } else {
    say("Picked up " + label + ". Now click the guest who ordered it.");
  }
  render();
}

// ----- Step 3: click a guest to serve them -----
function serveGuest(g) {
  if (gameOver) return;
  const guest = guests[g];
  if (!guest) return;

  if (selected === null || !grill[selected]) {
    selected = null;
    say("First click a cooked piece of meat on the braai, then click the guest.");
    render();
    return;
  }

  const item = grill[selected];
  const stage = stageOf(item);
  const meat = MEATS[item.type];

  if (stage === "burnt") {
    grill[selected] = null;
    selected = null;
    score -= 50;
    say(guest.name + " refuses burnt meat! (-50)");
    render();
    return;
  }

  if (item.type !== guest.type) {
    say(guest.name + " ordered " + MEATS[guest.type].label + ", not " + meat.label + ".");
    return;
  }

  const base = stage === "perfect" ? meat.points : Math.round(meat.points * 0.4);
  const bonus = stage === "perfect" ? Math.round(guest.patience) : 0; // faster = bigger bonus
  score += base + bonus;
  served++;
  say(guest.name + " loved the " + (stage === "perfect" ? "perfect " : "medium ") + meat.label + "! (+" + (base + bonus) + ")");
  guests[g] = null;
  grill[selected] = null;
  selected = null;
  render();
}

// ----- Drawing everything -----
function render() {
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = level();

  const selectedType = (selected !== null && grill[selected]) ? grill[selected].type : null;

  // Only rewrite a slot when its content really changed (keeps clicks working)
  slotEls.forEach((el, i) => {
    const item = grill[i];
    let html, stage = "";
    if (!item) {
      html = "Empty";
    } else {
      stage = stageOf(item);
      html = MEATS[item.type].label + '<span class="stage">' + stage + "</span>";
    }
    if (el.dataset.html !== html) {
      el.dataset.html = html;
      el.innerHTML = html;
      if (stage) el.dataset.stage = stage; else el.removeAttribute("data-stage");
    }
    el.classList.toggle("selected", selected === i);
  });

  // Guests are built once; here we only update their text and bar
  guestEls.forEach((ge, i) => {
    const guest = guests[i];
    if (!guest) {
      ge.btn.classList.add("empty");
      ge.btn.classList.remove("wants");
      ge.name.textContent = "Waiting for guest...";
      ge.order.textContent = "";
      return;
    }
    const pct = Math.max(0, (guest.patience / guest.max) * 100);
    ge.btn.classList.remove("empty");
    ge.btn.classList.toggle("wants", selectedType === guest.type);
    ge.name.textContent = guest.name;
    ge.order.textContent = "wants " + MEATS[guest.type].label;
    ge.fill.style.width = pct + "%";
    ge.fill.classList.toggle("low", pct < 30);
  });
}

// ----- Game loop: runs every tick -----
setInterval(() => {
  if (gameOver) return;
  const dt = TICK_MS / 1000;

  // Meat cooks
  grill.forEach(item => { if (item) item.t += dt; });

  // Guests lose patience
  guests.forEach((guest, i) => {
    if (!guest) return;
    guest.patience -= dt;
    if (guest.patience <= 0) {
      say(guest.name + " got tired of waiting and left! You lost a life.");
      guests[i] = null;
      lives--;
      if (lives <= 0) endGame();
    }
  });

  // New guests arrive
  spawnTimer += dt;
  if (!gameOver && spawnTimer >= spawnEvery()) {
    spawnTimer = 0;
    spawnGuest();
  }

  render();
}, TICK_MS);

restartBtn.addEventListener("click", startGame);
startGame();