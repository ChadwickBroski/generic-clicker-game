import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getCountFromServer, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyApp-f5tcN3v7nACEvRNV1jdI1E6iu9bT4",
  authDomain: "generic-clicker-game.firebaseapp.com",
  projectId: "generic-clicker-game",
  storageBucket: "generic-clicker-game.firebasestorage.app",
  messagingSenderId: "43436296491",
  appId: "1:43436296491:web:8c32c9578410806ef51d6e",
  measurementId: "G-S6553DC8PN"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ── Tag definitions ──
// 🔴 MANUAL tags — set in Firestore console, never overwritten by the game
// 🟢 AUTOMATIC tags — assigned by the game automatically
const TAGS = {
  1: { label: "First 100",  color: "white", bg: "purple",    tooltip: "One of the first 100 players that have played this game" },
  2: { label: "Owner",      color: "white", bg: "black",     tooltip: "The owner of this game" },
  3: { label: "Former #1",  color: "white", bg: "#8B0000",   tooltip: "Was #1 for over a week" },
  4: { label: "Top Player", color: "white", bg: "royalblue", tooltip: "Currently #1 on the leaderboard" },
  5: { label: "Legend",     color: "white", bg: "gold",      tooltip: "Was #1 for over a year" },
  6: { label: "Bug Finder", color: "white", bg: "green",     tooltip: "Reported a bug to the owner that has been fixed" },
  7: { label: "Ideator",    color: "white", bg: "green",     tooltip: "Contributed by giving an idea to the owner that is currently in the game" },
  8: { label: "Winner",     color: "white", bg: "white",     tooltip: "Won a contest hosted by the owner" }
};

const MANUAL_TAGS = new Set([2, 3, 5, 6, 7]);

// ── Name style definitions ──
const NAME_STYLE_FIELD        = "nameStyles";
const LEGACY_NAME_STYLE_FIELD = "nameStyle";
const DEFAULT_NAME_STYLE      = 1;
const NAME_STYLES = {
  1: { id: "blackStyleBtn",   className: "name-style-default" },
  2: { id: "blueStyleBtn",    className: "name-style-blue" },
  3: { id: "goldStyleBtn",    className: "name-style-gold" },
  4: { id: "purpleStyleBtn",  className: "name-style-purple" },
  5: { id: "redPinkStyleBtn", className: "name-style-crimson-fade", gradient: true },
  6: { id: "rainbowStyleBtn", className: "name-style-rainbow",      gradient: true },
};

// ── Upgrade constants ──
const AUTOCLICKER_UNLOCK_COST = 1000;
// Mouse
const MOUSE_BASE_COST      = 10;
const MOUSE_COST_MULTIPLIER = 1.14;
const MOUSE_CPS_GAIN       = 0.1;
const MOUSE_MAX_LEVEL      = 99;
// Servant
const SERVANT_BASE_COST      = 250;
const SERVANT_COST_MULTIPLIER = 1.16;
const SERVANT_CPS_GAIN       = 2;
const SERVANT_MAX_LEVEL      = 99;
// Robot
const ROBOT_BASE_COST      = 1000;
const ROBOT_COST_MULTIPLIER = 1.18;
const ROBOT_CPS_GAIN       = 10;
const ROBOT_MAX_LEVEL      = 99;
// Hacker
const HACKER_BASE_COST      = 2000;
const HACKER_COST_MULTIPLIER = 1.2;
const HACKER_CPS_GAIN       = 20;
const HACKER_MAX_LEVEL      = 99;
// Army
const ARMY_BASE_COST      = 5000;
const ARMY_COST_MULTIPLIER = 1.22;
const ARMY_CPS_GAIN       = 40;
const ARMY_MAX_LEVEL      = 99;
// Server
const SERVER_BASE_COST      = 25000;
const SERVER_COST_MULTIPLIER = 1.24;
const SERVER_CPS_GAIN       = 175;
const SERVER_MAX_LEVEL      = 99;

// ── Name style helpers (defined before await so they're available during load) ──

function normalizeNameStyle(styleNum) {
  const parsedStyle = Number(styleNum);
  if (Number.isInteger(parsedStyle) && NAME_STYLES[parsedStyle]) return parsedStyle;
  return DEFAULT_NAME_STYLE;
}

function getStoredNameStyle(data = {}) {
  return normalizeNameStyle(data[NAME_STYLE_FIELD] ?? data[LEGACY_NAME_STYLE_FIELD] ?? DEFAULT_NAME_STYLE);
}

function getNameStyleSaveData(styleNum) {
  return { [NAME_STYLE_FIELD]: normalizeNameStyle(styleNum) };
}

function createTagElement(tagNumber) {
  if (tagNumber === null || tagNumber === undefined) return null;
  const tag = TAGS[tagNumber];
  if (!tag) return null;
  const el = document.createElement("span");
  el.className = "tag";
  el.textContent = tag.label;
  el.dataset.tooltip = tag.tooltip;
  el.style.setProperty("--tag-color", tag.color);
  el.style.setProperty("--tag-bg", tag.bg);
  return el;
}

function applyNameStyle(element, styleNum) {
  const style = NAME_STYLES[normalizeNameStyle(styleNum)];
  element.className = "leaderboard-name";
  element.classList.add(style.className);
  if (style.gradient) element.classList.add("name-style-gradient");
}

function renderLeaderboardName(slotId, name, styleNum, tagNumber) {
  const slot = document.getElementById(slotId);
  if (!slot) return;
  slot.textContent = "";
  const nameEl = document.createElement("span");
  nameEl.textContent = name;
  applyNameStyle(nameEl, styleNum);
  slot.appendChild(nameEl);
  const tagEl = createTagElement(tagNumber);
  if (tagEl) slot.appendChild(tagEl);
}

function applySelectedCard(styleNum) {
  const safeStyle = normalizeNameStyle(styleNum);
  Object.values(NAME_STYLES).forEach(s => document.getElementById(s.id)?.classList.remove("selected"));
  document.getElementById(NAME_STYLES[safeStyle].id)?.classList.add("selected");
}

// ── Firebase auth ──
await signInAnonymously(auth);
const uid = auth.currentUser.uid;

// ── Local state ──
const savedInformer = document.querySelector(".informer"); // "Progress saved!" informer
let number          = 0;   // The score — stored as a float, displayed as Math.floor()
let playerName      = "Anonymous";
let isNewPlayer     = false;
let nameStyle       = 1;

// ── Upgrade state ──
let autoClickerUnlocked = false;
let mouseLevel          = 0;
let servantLevel        = 0;
let robotLevel          = 0;
let hackerLevel         = 0;
let armyLevel           = 0;
let serverLevel         = 0;

// ── Load from Firestore ──
document.getElementById("counter").textContent = "Loading...";

const playerDoc = await getDoc(doc(db, "leaderboard", uid));
if (playerDoc.exists()) {
  const data       = playerDoc.data();
  number           = data.score              ?? 0;
  playerName       = data.name               ?? "Anonymous";
  nameStyle        = getStoredNameStyle(data);
  // Restore upgrade progress
  autoClickerUnlocked = data.autoClickerUnlocked ?? false;
  mouseLevel          = data.mouseLevel          ?? 0;
  servantLevel        = data.servantLevel        ?? 0;
  robotLevel          = data.robotLevel          ?? 0;
  hackerLevel         = data.hackerLevel         ?? 0;
  armyLevel           = data.armyLevel           ?? 0;
  serverLevel         = data.serverLevel         ?? 0;
} else {
  isNewPlayer = true;
}

document.getElementById("counter").textContent    = Math.floor(number).toLocaleString();
document.getElementById("playerNameInput").value  = playerName;
applySelectedCard(nameStyle);

// Restore upgrade UI state
if (autoClickerUnlocked) {
  document.getElementById("autoclickerbuyBtn").style.display = "none";
  document.getElementById("upgradesBtn").style.display       = "block";
}

// ── Score helpers ──
// getScore returns the internal float so CPS math stays precise
const getScore = () => number;

const setScore = (newScore) => {
  number = Math.max(0, newScore);
  document.getElementById("counter").textContent = Math.floor(number).toLocaleString();
};

// ── CPS helpers ──
const getMouseCps   = () => mouseLevel   * MOUSE_CPS_GAIN;
const getServantCps = () => servantLevel * SERVANT_CPS_GAIN;
const getRobotCps   = () => robotLevel   * ROBOT_CPS_GAIN;
const getHackerCps  = () => hackerLevel  * HACKER_CPS_GAIN;
const getArmyCps    = () => armyLevel    * ARMY_CPS_GAIN;
const getServerCps  = () => serverLevel  * SERVER_CPS_GAIN;
const getTotalAutoClickerCps = () =>
  getMouseCps() + getServantCps() + getRobotCps() + getHackerCps() + getArmyCps() + getServerCps();

// ── Cost helpers ──
const getMouseCost   = () => Math.floor(MOUSE_BASE_COST   * MOUSE_COST_MULTIPLIER   ** mouseLevel);
const getServantCost = () => Math.floor(SERVANT_BASE_COST * SERVANT_COST_MULTIPLIER ** servantLevel);
const getRobotCost   = () => Math.floor(ROBOT_BASE_COST   * ROBOT_COST_MULTIPLIER   ** robotLevel);
const getHackerCost  = () => Math.floor(HACKER_BASE_COST  * HACKER_COST_MULTIPLIER  ** hackerLevel);
const getArmyCost    = () => Math.floor(ARMY_BASE_COST    * ARMY_COST_MULTIPLIER    ** armyLevel);
const getServerCost  = () => Math.floor(SERVER_BASE_COST  * SERVER_COST_MULTIPLIER  ** serverLevel);

// ── Smooth rAF-based autoclicker ──
// Uses requestAnimationFrame so the counter climbs smoothly every ~16ms
// instead of jumping once per second with setInterval.
let _rafId        = null;
let _lastRafTime  = null;
let _lastUiRefresh = 0;

const _rafTick = (timestamp) => {
  if (_lastRafTime !== null) {
    const delta = (timestamp - _lastRafTime) / 1000; // seconds since last frame
    const cps   = getTotalAutoClickerCps();
    if (cps > 0) {
      number += cps * delta;
      document.getElementById("counter").textContent = Math.floor(number).toLocaleString();
    }
    // Refresh affordability labels every 200ms to avoid DOM thrashing every frame
    if (timestamp - _lastUiRefresh > 200) {
      _updateCpsDisplay();
      updateUnlockedStyles();
      updateUnlockedAutoClicker();
      _lastUiRefresh = timestamp;
    }
  }
  _lastRafTime = timestamp;
  _rafId = requestAnimationFrame(_rafTick);
};

const startSmoothLoop = () => {
  if (_rafId) return;
  _rafId = requestAnimationFrame(_rafTick);
};

const _updateCpsDisplay = () => {
  const el = document.getElementById("totalCps");
  if (el) el.textContent = `${getTotalAutoClickerCps().toFixed(1)} CPS`;
};

// ── Informer helper (upgrade bought notification) ──
const showInformer = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("fade-in-trigger", "fade-out-trigger");
  void el.offsetWidth;
  el.classList.add("fade-in-trigger");
  setTimeout(() => {
    el.classList.remove("fade-in-trigger");
    el.classList.add("fade-out-trigger");
  }, 1500);
};

// ── Upgrade unlock ──
function showUpgrades() {
  if (autoClickerUnlocked) {
    document.getElementById("upgradesBtn").style.display = "block";
  }
}

function unlockAutoClickerUpgrades() {
  if (getScore() < AUTOCLICKER_UNLOCK_COST) {
    alert(`Not enough clicks! You need ${AUTOCLICKER_UNLOCK_COST.toLocaleString()} clicks.`);
    return;
  }
  setScore(getScore() - AUTOCLICKER_UNLOCK_COST);
  autoClickerUnlocked = true;
  document.getElementById("autoclickerbuyBtn").style.display = "none";
  showInformer("autoclickerInformer");
  showUpgrades();
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

// ── Buy functions ──
function buyMouseUpgrade() {
  if (!autoClickerUnlocked) { alert("Unlock autoclicker upgrades first!"); return; }
  if (mouseLevel >= MOUSE_MAX_LEVEL) { alert("Low-End Mouse is already maxed out!"); return; }
  const cost = getMouseCost();
  if (getScore() < cost) { alert(`Not enough clicks! You need ${cost.toLocaleString()} clicks.`); return; }
  setScore(getScore() - cost);
  mouseLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyServantUpgrade() {
  if (!autoClickerUnlocked) { alert("Unlock autoclicker upgrades first!"); return; }
  if (servantLevel >= SERVANT_MAX_LEVEL) { alert("Servant is already maxed out!"); return; }
  const cost = getServantCost();
  if (getScore() < cost) { alert(`Not enough clicks! You need ${cost.toLocaleString()} clicks.`); return; }
  setScore(getScore() - cost);
  servantLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyRobotUpgrade() {
  if (!autoClickerUnlocked) { alert("Unlock autoclicker upgrades first!"); return; }
  if (robotLevel >= ROBOT_MAX_LEVEL) { alert("Robot is already maxed out!"); return; }
  const cost = getRobotCost();
  if (getScore() < cost) { alert(`Not enough clicks! You need ${cost.toLocaleString()} clicks.`); return; }
  setScore(getScore() - cost);
  robotLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyHackerUpgrade() {
  if (!autoClickerUnlocked) { alert("Unlock autoclicker upgrades first!"); return; }
  if (hackerLevel >= HACKER_MAX_LEVEL) { alert("Hacker is already maxed out!"); return; }
  const cost = getHackerCost();
  if (getScore() < cost) { alert(`Not enough clicks! You need ${cost.toLocaleString()} clicks.`); return; }
  setScore(getScore() - cost);
  hackerLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyArmyUpgrade() {
  if (!autoClickerUnlocked) { alert("Unlock autoclicker upgrades first!"); return; }
  if (armyLevel >= ARMY_MAX_LEVEL) { alert("Army is already maxed out!"); return; }
  const cost = getArmyCost();
  if (getScore() < cost) { alert(`Not enough clicks! You need ${cost.toLocaleString()} clicks.`); return; }
  setScore(getScore() - cost);
  armyLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyServerUpgrade() {
  if (!autoClickerUnlocked) { alert("Unlock autoclicker upgrades first!"); return; }
  if (serverLevel >= SERVER_MAX_LEVEL) { alert("Server is already maxed out!"); return; }
  const cost = getServerCost();
  if (getScore() < cost) { alert(`Not enough clicks! You need ${cost.toLocaleString()} clicks.`); return; }
  setScore(getScore() - cost);
  serverLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

// ── Update upgrade card UI ──
const updateUnlockedAutoClicker = () => {
  const score = getScore();

  const mouseCost    = getMouseCost();   const mouseCps    = getMouseCps();   const mouseMaxed    = mouseLevel    >= MOUSE_MAX_LEVEL;
  const servantCost  = getServantCost(); const servantCps  = getServantCps(); const servantMaxed  = servantLevel  >= SERVANT_MAX_LEVEL;
  const robotCost    = getRobotCost();   const robotCps    = getRobotCps();   const robotMaxed    = robotLevel    >= ROBOT_MAX_LEVEL;
  const hackerCost   = getHackerCost();  const hackerCps   = getHackerCps();  const hackerMaxed   = hackerLevel   >= HACKER_MAX_LEVEL;
  const armyCost     = getArmyCost();    const armyCps     = getArmyCps();    const armyMaxed     = armyLevel     >= ARMY_MAX_LEVEL;
  const serverCost   = getServerCost();  const serverCps   = getServerCps();  const serverMaxed   = serverLevel   >= SERVER_MAX_LEVEL;

  // Lock/unlock each card based on affordability
  const toggleCard = (id, locked) => document.getElementById(id)?.classList.toggle("locked", locked);
  toggleCard("mouse",   !autoClickerUnlocked || score < mouseCost   || mouseMaxed);
  toggleCard("servant", !autoClickerUnlocked || score < servantCost || servantMaxed);
  toggleCard("robot",   !autoClickerUnlocked || score < robotCost   || robotMaxed);
  toggleCard("hacker",  !autoClickerUnlocked || score < hackerCost  || hackerMaxed);
  toggleCard("army",    !autoClickerUnlocked || score < armyCost    || armyMaxed);
  toggleCard("server",  !autoClickerUnlocked || score < serverCost  || serverMaxed);

  // Update each card's label, count badge, and cost/CPS sublabel
  const updateCard = (cardId, cps, level, cost, maxLevel, cpsGain, maxed) => {
    const card = document.getElementById(cardId);
    if (!card) return;
    const label    = card.querySelector(".style-label");
    const count    = card.querySelector(".upgrade-count");
    const sublabel = card.querySelector(".style-sublabel");
    if (label)    label.textContent    = `Current: ${cps.toFixed(1)} CPS`;
    if (count)    count.textContent    = level.toLocaleString();
    if (sublabel) sublabel.textContent = maxed
      ? `Maxed out at ${maxLevel} upgrades`
      : `Cost: ${cost.toLocaleString()} Clicks | +${cpsGain.toFixed(1)} CPS`;
  };

  updateCard("mouse",   mouseCps,   mouseLevel,   mouseCost,   MOUSE_MAX_LEVEL,   MOUSE_CPS_GAIN,   mouseMaxed);
  updateCard("servant", servantCps, servantLevel, servantCost, SERVANT_MAX_LEVEL, SERVANT_CPS_GAIN, servantMaxed);
  updateCard("robot",   robotCps,   robotLevel,   robotCost,   ROBOT_MAX_LEVEL,   ROBOT_CPS_GAIN,   robotMaxed);
  updateCard("hacker",  hackerCps,  hackerLevel,  hackerCost,  HACKER_MAX_LEVEL,  HACKER_CPS_GAIN,  hackerMaxed);
  updateCard("army",    armyCps,    armyLevel,    armyCost,    ARMY_MAX_LEVEL,    ARMY_CPS_GAIN,    armyMaxed);
  updateCard("server",  serverCps,  serverLevel,  serverCost,  SERVER_MAX_LEVEL,  SERVER_CPS_GAIN,  serverMaxed);

  // Update the "Cost: X Clicks" text under the unlock button
  const sublabel = document.getElementById("autoclickerbuySublabel");
  if (sublabel) sublabel.textContent = `Cost: ${AUTOCLICKER_UNLOCK_COST.toLocaleString()} Clicks`;
};

// ── Update name style card locks ──
const updateUnlockedStyles = () => {
  const score = getScore();

  const cards = {
    black:   document.getElementById("blackStyleBtn"),
    blue:    document.getElementById("blueStyleBtn"),
    gold:    document.getElementById("goldStyleBtn"),
    purple:  document.getElementById("purpleStyleBtn"),
    redPink: document.getElementById("redPinkStyleBtn"),
    rainbow: document.getElementById("rainbowStyleBtn"),
  };

  Object.values(cards).forEach(c => c?.classList.add("locked"));
  document.getElementById("blackSublabel").textContent   = "Always unlocked";
  document.getElementById("blueSublabel").textContent    = "🔒 Unlock at 1,000";
  document.getElementById("goldSublabel").textContent    = "🔒 Unlock at 10,000";
  document.getElementById("purpleSublabel").textContent  = "🔒 Unlock at 100,000";
  document.getElementById("redPinkSublabel").textContent = "🔒 Unlock at 1,000,000";
  document.getElementById("rainbowSublabel").textContent = "🔒 Unlock at 10,000,000";

  cards.black?.classList.remove("locked");
  if (score >= 1000)     { cards.blue?.classList.remove("locked");    document.getElementById("blueSublabel").textContent    = "Unlocked at 1,000"; }
  if (score >= 10000)    { cards.gold?.classList.remove("locked");    document.getElementById("goldSublabel").textContent    = "Unlocked at 10,000"; }
  if (score >= 100000)   { cards.purple?.classList.remove("locked");  document.getElementById("purpleSublabel").textContent  = "Unlocked at 100,000"; }
  if (score >= 1000000)  { cards.redPink?.classList.remove("locked"); document.getElementById("redPinkSublabel").textContent = "Unlocked at 1,000,000"; }
  if (score >= 10000000) { cards.rainbow?.classList.remove("locked"); document.getElementById("rainbowSublabel").textContent = "Unlocked at 10,000,000"; }
};

// ── Save ──
async function save() {
  localStorage.setItem("value", Math.floor(number));

  const dataToSave = {
    name:  playerName,
    score: Math.floor(number),
    ...getNameStyleSaveData(nameStyle),
    // Persist upgrade progress
    autoClickerUnlocked,
    mouseLevel, servantLevel, robotLevel, hackerLevel, armyLevel, serverLevel,
  };

  // 🟢 AUTOMATIC: First 100 tag — only checked on very first save
  if (isNewPlayer) {
    const snapshot = await getCountFromServer(collection(db, "leaderboard"));
    if (snapshot.data().count < 100) dataToSave.tag = 1;
    isNewPlayer = false;
  }

  await setDoc(doc(db, "leaderboard", uid), dataToSave, { merge: true });

  // "Progress saved!" animation
  savedInformer.classList.remove("fade-in-trigger", "fade-out-trigger");
  void savedInformer.offsetWidth;
  savedInformer.classList.add("fade-in-trigger");
  setTimeout(() => {
    savedInformer.classList.remove("fade-in-trigger");
    void savedInformer.offsetWidth;
    savedInformer.classList.add("fade-out-trigger");
  }, 1000);
}

function add() {
  number++;
  document.getElementById("counter").textContent = Math.floor(number).toLocaleString();
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function reset() {
  if (confirm("Do you want to reset your progress? (Removes all of your progress)")) {
    number = 0;
    // Reset all upgrade levels
    autoClickerUnlocked = false;
    mouseLevel = servantLevel = robotLevel = hackerLevel = armyLevel = serverLevel = 0;
    // Restore UI
    document.getElementById("counter").textContent             = "0";
    document.getElementById("autoclickerbuyBtn").style.display = "block";
    document.getElementById("upgradesBtn").style.display       = "none";
    updateUnlockedStyles();
    updateUnlockedAutoClicker();
    _updateCpsDisplay();
    save();
  }
}

// ── Auto-save every 10 seconds if score changed ──
let lastSaved = Math.floor(number);
setInterval(() => {
  if (Math.floor(number) !== lastSaved) {
    save();
    lastSaved = Math.floor(number);
  }
}, 10000);

// ── Leaderboard ──
async function showLeaderboard() {
  const nameSlots  = ["name1","name2","name3","name4","name5","name6","name7","name8","name9","name10"];
  const scoreSlots = ["score1","score2","score3","score4","score5","score6","score7","score8","score9","score10"];

  nameSlots.forEach(id  => { document.getElementById(id).innerHTML  = "Loading..."; });
  scoreSlots.forEach(id => { document.getElementById(id).innerHTML  = "..."; });
  leaderboardModal.style.display = "block";

  const q        = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(10));
  const snapshot = await getDocs(q);

  snapshot.docs.forEach((docSnap, i) => {
    const data            = docSnap.data();
    const name            = data.name  ?? "Anonymous";
    const score           = data.score ?? 0;
    const storedNameStyle = getStoredNameStyle(data);
    const storedTag       = typeof data.tag === "number" ? data.tag : null;

    // 🟢 AUTOMATIC: Top Player tag for rank 1, unless they have a manual tag
    const displayTag = (i === 0 && !MANUAL_TAGS.has(storedTag)) ? 4 : storedTag;

    renderLeaderboardName(nameSlots[i], name, storedNameStyle, displayTag);
    document.getElementById(scoreSlots[i]).innerHTML = score.toLocaleString();
  });

  // Fill empty slots if fewer than 10 players exist
  for (let i = snapshot.docs.length; i < 10; i++) {
    document.getElementById(nameSlots[i]).innerHTML  = "—";
    document.getElementById(scoreSlots[i]).innerHTML = "—";
  }
}

// ── Save name style to Firestore ──
async function saveNameStyle(styleNum) {
  nameStyle = normalizeNameStyle(styleNum);
  applySelectedCard(nameStyle);
  await setDoc(doc(db, "leaderboard", uid), getNameStyleSaveData(nameStyle), { merge: true });
}

// ── On load ──
window.addEventListener("load", () => {
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
  _updateCpsDisplay();
  startSmoothLoop();
});

// ── Player name ──
document.getElementById("saveNameBtn").addEventListener("click", () => {
  const input = document.getElementById("playerNameInput").value.trim();
  if (input) {
    playerName = input;
    localStorage.setItem("playerName", playerName);
    save();
  }
});

const onClick = (id, handler) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
};

// ── Main buttons ──
document.getElementById("clickBtn").addEventListener("click", add);
document.getElementById("saveBtn").addEventListener("click", save);
document.getElementById("resetBtn").addEventListener("click", reset);
document.getElementById("leaderboardBtn").addEventListener("click", showLeaderboard);
onClick("autoclickerbuyBtn", unlockAutoClickerUpgrades);

// ── Upgrades modal ──
const upgradesModal = document.getElementById("upgradesModal");
onClick("upgradesBtn",   () => upgradesModal.style.display = "block");
onClick("upgradesClose", () => upgradesModal.style.display = "none");

// ── Upgrade cards ──
onClick("mouse",   buyMouseUpgrade);
onClick("servant", buyServantUpgrade);
onClick("robot",   buyRobotUpgrade);
onClick("hacker",  buyHackerUpgrade);
onClick("army",    buyArmyUpgrade);
onClick("server",  buyServerUpgrade);

// ── Settings modal ──
const settingsModal = document.getElementById("settingsModal");
document.getElementById("settingsBtn").addEventListener("click",   () => settingsModal.style.display = "block");
document.getElementById("settingsClose").addEventListener("click", () => settingsModal.style.display = "none");

// ── Leaderboard modal ──
const leaderboardModal = document.getElementById("leaderboardModal");
document.getElementById("leaderboardClose").addEventListener("click", () => leaderboardModal.style.display = "none");

// ── Customization modal ──
const customizationModal = document.getElementById("customizationModal");
document.getElementById("customizationBtn").addEventListener("click", () => {
  updateUnlockedStyles();
  customizationModal.style.display = "block";
});
onClick("customizationClose", () => customizationModal.style.display = "none");

// ── Name style cards ──
const blackStyleCard   = document.getElementById("blackStyleBtn");
const blueStyleCard    = document.getElementById("blueStyleBtn");
const goldStyleCard    = document.getElementById("goldStyleBtn");
const purpleStyleCard  = document.getElementById("purpleStyleBtn");
const redPinkStyleCard = document.getElementById("redPinkStyleBtn");
const rainbowStyleCard = document.getElementById("rainbowStyleBtn");

onClick("blackStyleBtn",   () => { saveNameStyle(1); });
onClick("blueStyleBtn",    () => { if (blueStyleCard.classList.contains("locked"))    return alert("Reach 1,000 points to unlock this style.");     saveNameStyle(2); });
onClick("goldStyleBtn",    () => { if (goldStyleCard.classList.contains("locked"))    return alert("Reach 10,000 points to unlock this style.");    saveNameStyle(3); });
onClick("purpleStyleBtn",  () => { if (purpleStyleCard.classList.contains("locked"))  return alert("Reach 100,000 points to unlock this style.");   saveNameStyle(4); });
onClick("redPinkStyleBtn", () => { if (redPinkStyleCard.classList.contains("locked")) return alert("Reach 1,000,000 points to unlock this style."); saveNameStyle(5); });
onClick("rainbowStyleBtn", () => { if (rainbowStyleCard.classList.contains("locked")) return alert("Reach 10,000,000 points to unlock this style."); saveNameStyle(6); });

// ── Background music ──
const bgmusic = new Audio("Chill-prettyjohn1.mp3");
bgmusic.loop   = true;
bgmusic.volume = 0.5;
let isbgmusicPlaying = false;

onClick("music1Card", () => {
  const music1Card = document.getElementById("music1Card");
  if (isbgmusicPlaying) {
    bgmusic.pause();
    isbgmusicPlaying = false;
    music1Card.classList.remove("selected");
    document.getElementById("music1Label").textContent = "Off";
  } else {
    bgmusic.play();
    isbgmusicPlaying = true;
    music1Card.classList.add("selected");
    document.getElementById("music1Label").textContent = "Playing ▶";
  }
});

// ── Close modals on backdrop click ──
window.addEventListener("click", (event) => {
  if (event.target === settingsModal)      settingsModal.style.display      = "none";
  if (event.target === leaderboardModal)   leaderboardModal.style.display   = "none";
  if (event.target === customizationModal) customizationModal.style.display = "none";
  if (event.target === upgradesModal)      upgradesModal.style.display      = "none";
});