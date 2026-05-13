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

let _score = Number(
  (document.getElementById("counter")?.textContent || "0").replace(/,/g, "")
) || 0;

const getScore = () => _score;

const setScore = (newScore) => {
  _score = Math.max(0, newScore);
  document.getElementById("counter").textContent = Math.floor(_score).toLocaleString();
};

// addScore is called by manual clicks and must also refresh affordability UI.
const addScore = (amount) => {
  _score += amount;
  document.getElementById("counter").textContent = Math.floor(_score).toLocaleString();
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
};

// ── Upgrade constants ──
const AUTOCLICKER_UNLOCK_COST = 1000;
// Mouse
const MOUSE_BASE_COST = 10;
const MOUSE_COST_MULTIPLIER = 1.14;
const MOUSE_CPS_GAIN = 0.1;
const MOUSE_MAX_LEVEL = 99;
// Servant
const SERVANT_BASE_COST = 250;
const SERVANT_COST_MULTIPLIER = 1.16;
const SERVANT_CPS_GAIN = 2;
const SERVANT_MAX_LEVEL = 99;
// Robot
const ROBOT_BASE_COST = 1000;
const ROBOT_COST_MULTIPLIER = 1.18;
const ROBOT_CPS_GAIN = 10;
const ROBOT_MAX_LEVEL = 99;
// Hacker
const HACKER_BASE_COST = 2000;
const HACKER_COST_MULTIPLIER = 1.2;
const HACKER_CPS_GAIN = 20;
const HACKER_MAX_LEVEL = 99;
// Army
const ARMY_BASE_COST = 5000;
const ARMY_COST_MULTIPLIER = 1.22;
const ARMY_CPS_GAIN = 40;
const ARMY_MAX_LEVEL = 99;
// Server
const SERVER_BASE_COST = 25000;
const SERVER_COST_MULTIPLIER = 1.24;
const SERVER_CPS_GAIN = 175;
const SERVER_MAX_LEVEL = 99;

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
const getTotalAutoClickerCps = () => getMouseCps() + getServantCps() + getRobotCps() + getHackerCps() + getArmyCps() + getServerCps();

// ── Cost helpers ──
const getMouseCost = () => {
  return Math.floor(MOUSE_BASE_COST * MOUSE_COST_MULTIPLIER ** mouseLevel);
};
const getServantCost = () => {
  return Math.floor(SERVANT_BASE_COST * SERVANT_COST_MULTIPLIER ** servantLevel);
};
const getRobotCost = () => {
  return Math.floor(ROBOT_BASE_COST * ROBOT_COST_MULTIPLIER ** robotLevel);
};
const getHackerCost = () => {
  return Math.floor(HACKER_BASE_COST * HACKER_COST_MULTIPLIER ** hackerLevel);
};
const getArmyCost = () => {
  return Math.floor(ARMY_BASE_COST * ARMY_COST_MULTIPLIER ** armyLevel);
};
const getServerCost = () => {
  return Math.floor(SERVER_BASE_COST * SERVER_COST_MULTIPLIER ** serverLevel);
}
// ── Smooth rAF-based autoclicker ──
// Uses requestAnimationFrame so the counter climbs smoothly every ~16ms
// instead of jumping once per second with setInterval.
let _rafId = null;
let _lastRafTime = null;
let _lastUiRefresh = 0; // timestamp of last affordability/label refresh

const _rafTick = (timestamp) => {
  if (_lastRafTime !== null) {
    const delta = (timestamp - _lastRafTime) / 1000; // seconds since last frame

    const cps = getTotalAutoClickerCps();
    if (cps > 0) {
      _score += cps * delta;
      document.getElementById("counter").textContent =
        Math.floor(_score).toLocaleString();
    }

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

const restartAutoClickers = () => {};

// Updates the "X.X CPS" label beneath the counter.
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
  const upgradesBtn = document.getElementById("upgradesBtn");
  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades to use this feature!");
  } else {
    upgradesBtn.style.display = "block";
  }
}
document.getElementById("autoclickerbuyBtn").style.display = "block";

function unlockAutoClickerUpgrades() {
  const score = getScore();

  // This only unlocks the Upgrades menu. It does not start giving clicks.
  if (score < AUTOCLICKER_UNLOCK_COST) {
    alert(`Not enough clicks to unlock autoclicker upgrades! You need ${AUTOCLICKER_UNLOCK_COST.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - AUTOCLICKER_UNLOCK_COST);
  autoClickerUnlocked = true;
  document.getElementById("autoclickerbuyBtn").style.display = "none";
  showInformer("autoclickerInformer");
  showUpgrades();
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyMouseUpgrade() {
  const score = getScore();
  const mouseCost = getMouseCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (mouseLevel >= MOUSE_MAX_LEVEL) {
    alert("Low-End Mouse is already maxed out!");
    return;
  }

  if (score < mouseCost) {
    alert(`Not enough clicks to purchase the Mouse upgrade! You need ${mouseCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - mouseCost);
  mouseLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyServantUpgrade() {
  const score = getScore();
  const servantCost = getServantCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (servantLevel >= SERVANT_MAX_LEVEL) {
    alert("Servant is already maxed out!");
    return;
  }

  if (score < servantCost) {
    alert(`Not enough clicks to purchase the Servant upgrade! You need ${servantCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - servantCost);
  servantLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyRobotUpgrade() {
  const score = getScore();
  const robotCost = getRobotCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (robotLevel >= ROBOT_MAX_LEVEL) {
    alert("Robot is already maxed out!");
    return;
  }

  if (score < robotCost) {
    alert(`Not enough clicks to purchase the Robot upgrade! You need ${robotCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - robotCost);
  robotLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}


function buyHackerUpgrade() {
  const score = getScore();
  const hackerCost = getHackerCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (hackerLevel >= HACKER_MAX_LEVEL) {
    alert("Hacker is already maxed out!");
    return;
  }

  if (score < hackerCost) {
    alert(`Not enough clicks to purchase the Hacker upgrade! You need ${hackerCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - hackerCost);
  hackerLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyArmyUpgrade() {
  const score = getScore();
  const armyCost = getArmyCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (armyLevel >= ARMY_MAX_LEVEL) {
    alert("Army is already maxed out!");
    return;
  }

  if (score < armyCost) {
    alert(`Not enough clicks to purchase the Army upgrade! You need ${armyCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - armyCost);
  armyLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyServerUpgrade() {
  const score = getScore();
  const serverCost = getServerCost();
  
  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (serverLevel >= SERVER_MAX_LEVEL) {
    alert("Server is already maxed out!");
    return;
  }

  if (score < serverCost) {
    alert(`Not enough clicks to purchase the Server upgrade! You need ${serverCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - serverCost);
  serverLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

// ── Update upgrade card UI ──
const updateUnlockedAutoClicker = () => {
  const score = getScore();
  const mouseCps = getMouseCps();
  const mouseCost = getMouseCost();
  const mouseMaxed = mouseLevel >= MOUSE_MAX_LEVEL;

  const servantCps = getServantCps();
  const servantCost = getServantCost();
  const servantMaxed = servantLevel >= SERVANT_MAX_LEVEL;

  const robotCps = getRobotCps();
  const robotCost = getRobotCost();
  const robotMaxed = robotLevel >= ROBOT_MAX_LEVEL;

  const hackerCps = getHackerCps();
  const hackerCost = getHackerCost();
  const hackerMaxed = hackerLevel >= HACKER_MAX_LEVEL;

  const armyCps = getArmyCps();
  const armyCost = getArmyCost();
  const armyMaxed = armyLevel >= ARMY_MAX_LEVEL;

  const serverCps = getServerCps();
  const serverCost = getServerCost();
  const serverMaxed = serverLevel >= SERVER_MAX_LEVEL;

  const autoclickerSublabel = document.getElementById("autoclickerbuySublabel");
  // Low-end mouse
  const mouse = document.getElementById("mouse");
  const mouseLabel = mouse?.querySelector(".style-label");
  const mouseSublabel = document.getElementById("mouseSublabel");
  const mouseUpgradeCount = document.getElementById("mouseUpgradeCount");
  // Servant
  const servant = document.getElementById("servant");
  const servantLabel = servant?.querySelector(".style-label");
  const servantSublabel = document.getElementById("servantSublabel");
  const servantUpgradeCount = document.getElementById("servantUpgradeCount");
  // Robot
  const robot = document.getElementById("robot");
  const robotLabel = robot?.querySelector(".style-label");
  const robotSublabel = document.getElementById("robotSublabel");
  const robotUpgradeCount = document.getElementById("robotUpgradeCount");
  // Hacker
  const hacker = document.getElementById("hacker");
  const hackerLabel = hacker?.querySelector(".style-label");
  const hackerSublabel = document.getElementById("hackerSublabel");
  const hackerUpgradeCount = document.getElementById("hackerUpgradeCount");
  // Army
  const army = document.getElementById("army");
  const armyLabel = army?.querySelector(".style-label");
  const armySublabel = document.getElementById("armySublabel");
  const armyUpgradeCount = document.getElementById("armyUpgradeCount");
  // Server
  const server = document.getElementById("server");
  const serverLabel = server?.querySelector(".style-label");
  const serverSublabel = document.getElementById("serverSublabel");
  const serverUpgradeCount = document.getElementById("serverUpgradeCount");

  // Update the text under the main unlock button.
  if (autoclickerSublabel) {
    autoclickerSublabel.textContent = `Cost: ${AUTOCLICKER_UNLOCK_COST.toLocaleString()} Clicks`;
  }

  // Lock the upgrade card when the menu is locked or the player cannot afford it.
  if (mouse) {
    mouse.classList.toggle("locked", !autoClickerUnlocked || score < mouseCost || mouseMaxed);
  }
  if (servant) {
    servant.classList.toggle("locked", !autoClickerUnlocked || score < servantCost || servantMaxed);
  }
  if (robot) {
    robot.classList.toggle("locked", !autoClickerUnlocked || score < robotCost || robotMaxed);
  }
  if (hacker) {
    hacker.classList.toggle("locked", !autoClickerUnlocked || score < hackerCost || hackerMaxed);
  }
  if (army) {
    army.classList.toggle("locked", !autoClickerUnlocked || score < armyCost || armyMaxed);
  }
  if (server) {
    server.classList.toggle("locked", !autoClickerUnlocked || score < serverCost || serverMaxed);
  }

  // Show the current CPS inside the Upgrades menu.
  if (mouseLabel) {
    mouseLabel.textContent = `Current: ${mouseCps.toFixed(1)} CPS`;
  }
  // Show how many Low-End Mouse upgrades have been bought.
  if (mouseUpgradeCount) {
    mouseUpgradeCount.textContent = mouseLevel.toLocaleString();
  }
  // Show the cost and reward for the upgrade inside the Upgrades menu.
  if (mouseSublabel) {
    mouseSublabel.textContent = mouseMaxed
      ? `Maxed out at ${MOUSE_MAX_LEVEL} upgrades`
      : `Cost: ${mouseCost.toLocaleString()} Clicks | +${MOUSE_CPS_GAIN.toFixed(1)} CPS`;
  }

  if (servantLabel) {
    servantLabel.textContent = `Current: ${servantCps.toFixed(1)} CPS`;
  }
  if (servantUpgradeCount) {
    servantUpgradeCount.textContent = servantLevel.toLocaleString();
  }
  if (servantSublabel) {
    servantSublabel.textContent = servantMaxed
      ? `Maxed out at ${SERVANT_MAX_LEVEL} upgrades`
      : `Cost: ${servantCost.toLocaleString()} Clicks | +${SERVANT_CPS_GAIN.toFixed(1)} CPS`;
  }

  if (robotLabel) {
    robotLabel.textContent = `Current: ${robotCps.toFixed(1)} CPS`;
  }
  if (robotUpgradeCount) {
    robotUpgradeCount.textContent = robotLevel.toLocaleString();
  }
  if (robotSublabel) {
    robotSublabel.textContent = robotMaxed
      ? `Maxed out at ${ROBOT_MAX_LEVEL} upgrades`
      : `Cost: ${robotCost.toLocaleString()} Clicks | +${ROBOT_CPS_GAIN.toFixed(1)} CPS`;
  }

  if (hackerLabel) {
    hackerLabel.textContent = `Current: ${hackerCps.toFixed(1)} CPS`;
  }
  if (hackerUpgradeCount) {
    hackerUpgradeCount.textContent = hackerLevel.toLocaleString();
  }
  if (hackerSublabel) {
    hackerSublabel.textContent = hackerMaxed
      ? `Maxed out at ${HACKER_MAX_LEVEL} upgrades`
      : `Cost: ${hackerCost.toLocaleString()} Clicks | +${HACKER_CPS_GAIN.toFixed(1)} CPS`;
  }

  if (armyLabel) {
    armyLabel.textContent = `Current: ${armyCps.toFixed(1)} CPS`;
  }
  if (armyUpgradeCount) {
    armyUpgradeCount.textContent = armyLevel.toLocaleString();
  }
  if (armySublabel) {
    armySublabel.textContent = armyMaxed
      ? `Maxed out at ${ARMY_MAX_LEVEL} upgrades`
      : `Cost: ${armyCost.toLocaleString()} Clicks | +${ARMY_CPS_GAIN.toFixed(1)} CPS`;
  }

  if (serverLabel) {
    serverLabel.textContent = `Current: ${serverCps.toFixed(1)} CPS`;
  }
  if (serverUpgradeCount) {
    serverUpgradeCount.textContent = serverLevel.toLocaleString();
  }
  if (serverSublabel) {
    serverSublabel.textContent = serverMaxed
      ? `Maxed out at ${SERVER_MAX_LEVEL} upgrades`
      : `Cost: ${serverCost.toLocaleString()} Clicks | +${SERVER_CPS_GAIN.toFixed(1)} CPS`;
  }
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
  document.getElementById("autoclickerInformer").textContent = "Progress saved!";

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
onClick("upgradesBtn", () => upgradesModal.style.display = "block");
onClick("upgradesClose", () => upgradesModal.style.display = "none");

// Upgrades [Mouse, Servant, Robot]
onClick("mouse", buyMouseUpgrade);
onClick("servant", buyServantUpgrade);
onClick("robot", buyRobotUpgrade);
onClick("hacker", buyHackerUpgrade);
onClick("army", buyArmyUpgrade);
onClick("server", buyServerUpgrade);
 
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
  if (event.target === settingsModal) settingsModal.style.display = "none";
  if (event.target === customizationModal) customizationModal.style.display = "none";
  if (event.target === leaderboardModal) leaderboardModal.style.display = "none";
  if (event.target === upgradesModal) upgradesModal.style.display = "none";
});