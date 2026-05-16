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
// 🔴 MANUAL tags — set these in the Firestore console by adding a "tag" field
//    to the player's document. These are never overwritten by the game.
// 🟢 AUTOMATIC tags — assigned by the game automatically (see logic below)
const TAGS = {
  // 🟢 AUTOMATIC — assigned on first save if player count is under 100
  1: { label: "First 100",  color: "white", bg: "purple",    tooltip: "One of the first 100 players that have played this game" },
  // 🔴 MANUAL — set this yourself in Firestore console
  2: { label: "Owner",      color: "white", bg: "black",     tooltip: "The owner of this game" },
  // 🔴 MANUAL — set this yourself in Firestore console (needs Cloud Function to automate later)
  3: { label: "Former #1",  color: "white", bg: "#8B0000", tooltip: "Was #1 for over a week" },
  // 🟢 AUTOMATIC — shown for whoever is rank 1 when the leaderboard is opened
  4: { label: "Top Player", color: "white", bg: "royalblue", tooltip: "Currently #1 on the leaderboard" },
  // 🔴 MANUAL — set this yourself in Firestore console (needs Cloud Function to automate later)
  5: { label: "Legend",     color: "white", bg: "gold",      tooltip: "Was #1 for over a year" },
  // 🔴 MANUAL — set this yourself in Firestore console
  6: { label: "Bug Finder", color: "white", bg: "green",     tooltip: "Reported a bug to the owner that has been fixed" },
  // 🔴 MANUAL — set this yourself in Firestore console
  7: { label: "Ideator",    color: "white", bg: "green",     tooltip: "Contributed by giving an idea to the owner that is currently in the game" },
  // 🔴 MANUAL — set this yourself in Firestore console
  8: {label: "Winner",      color: "white", bg: "white",     tooltip: "Won a contest hosted by the owner" }
};

// Tags that are set manually and must never be overwritten by automatic logic
const MANUAL_TAGS = new Set([2, 3, 5, 6, 7]);

// ── Name style definitions ──
// Stored in Firestore as an integer in the "nameStyles" field
// 1 = Default, 2 = Blue, 3 = Gold, 4 = Purple, 5 = Crimson Fade, 6 = Rainbow
const NAME_STYLE_FIELD = "nameStyles";
const LEGACY_NAME_STYLE_FIELD = "nameStyle";
const DEFAULT_NAME_STYLE = 1;
const NAME_STYLES = {
  1: { id: "blackStyleBtn",   className: "name-style-default" },
  2: { id: "blueStyleBtn",    className: "name-style-blue" },
  3: { id: "goldStyleBtn",    className: "name-style-gold" },
  4: { id: "purpleStyleBtn",  className: "name-style-purple" },
  5: { id: "redPinkStyleBtn", className: "name-style-crimson-fade", gradient: true },
  6: { id: "rainbowStyleBtn", className: "name-style-rainbow", gradient: true },
};

function normalizeNameStyle(styleNum) {
  const parsedStyle = Number(styleNum);
  if (Number.isInteger(parsedStyle) && NAME_STYLES[parsedStyle]) {
    return parsedStyle;
  }
  return DEFAULT_NAME_STYLE;
}

function getStoredNameStyle(data = {}) {
  return normalizeNameStyle(data[NAME_STYLE_FIELD] ?? data[LEGACY_NAME_STYLE_FIELD] ?? DEFAULT_NAME_STYLE);
}

function getNameStyleSaveData(styleNum) {
  return { [NAME_STYLE_FIELD]: normalizeNameStyle(styleNum) };
}

// Returns a tag badge element, or null if no tag.
function createTagElement(tagNumber) {
  if (tagNumber === null || tagNumber === undefined) return null;
  const tag = TAGS[tagNumber];
  if (!tag) return null;

  const tagElement = document.createElement("span");
  tagElement.className = "tag";
  tagElement.textContent = tag.label;
  tagElement.dataset.tooltip = tag.tooltip;
  tagElement.style.setProperty("--tag-color", tag.color);
  tagElement.style.setProperty("--tag-bg", tag.bg);
  return tagElement;
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

  const nameElement = document.createElement("span");
  nameElement.textContent = name;
  applyNameStyle(nameElement, styleNum);
  slot.appendChild(nameElement);

  const tagElement = createTagElement(tagNumber);
  if (tagElement) slot.appendChild(tagElement);
}

// Sign in anonymously — gives every player a unique uid automatically
await signInAnonymously(auth);
const uid = auth.currentUser.uid;

// ── Local state ──
const informer = document.querySelector(".informer");
let number     = 0;
let playerName = "Anonymous";
let isNewPlayer = false;
let nameStyle   = 1; // Default
let savedPlayerData = null;

const renderScore = () => {
  document.getElementById("counter").textContent = Math.floor(number).toLocaleString();
};

// Show Loading... until we get the value from Firestore
document.getElementById("counter").innerHTML = "Loading...";

// Fetch this player's saved score and name from Firestore
const playerDoc = await getDoc(doc(db, "leaderboard", uid));
if (playerDoc.exists()) {
  const data = playerDoc.data();
  savedPlayerData = data;
  number     = data.score     ?? 0;
  playerName = data.name      ?? "Anonymous";
  nameStyle  = getStoredNameStyle(data);
} else {
  // Player has never saved before — flag them as new for First 100 check
  isNewPlayer = true;
}

renderScore();
document.getElementById("playerNameInput").value = playerName;

// Highlight the card that matches the player's saved style
applySelectedCard(nameStyle);

// ── Name style helpers ──

// Highlights the correct style card in the customization modal
function applySelectedCard(styleNum) {
  const safeStyle = normalizeNameStyle(styleNum);
  Object.values(NAME_STYLES).forEach(s => {
    document.getElementById(s.id)?.classList.remove("selected");
  });
  document.getElementById(NAME_STYLES[safeStyle].id)?.classList.add("selected");
}

// Saves the chosen nameStyles integer to Firestore
async function saveNameStyle(styleNum) {
  nameStyle = normalizeNameStyle(styleNum);
  applySelectedCard(nameStyle);
  await setDoc(doc(db, "leaderboard", uid), getNameStyleSaveData(nameStyle), { merge: true });
}

// ── Save to localStorage (offline) and Firestore (leaderboard) ──
// merge:true ensures manual tags set in the Firestore console are never overwritten
async function save() {
  const savedScore = Math.floor(number);
  localStorage.setItem("value", savedScore);

  const dataToSave = {
    name: playerName,
    score: savedScore,
    autoClickerUnlocked,
    mouseLevel,
    servantLevel,
    robotLevel,
    hackerLevel,
    armyLevel,
    serverLevel,
    ...getNameStyleSaveData(nameStyle)
  };

  // 🟢 AUTOMATIC: First 100 tag
  // On first ever save, count how many players already exist.
  // If under 100, this player earns the First 100 tag automatically.
  if (isNewPlayer) {
    const snapshot = await getCountFromServer(collection(db, "leaderboard"));
    if (snapshot.data().count < 100) {
      dataToSave.tag = 1; // Assign First 100 tag
    }
    isNewPlayer = false; // Only run this check once
  }

  await setDoc(doc(db, "leaderboard", uid), dataToSave, { merge: true });

  // "Progress saved!" animation
  informer.textContent = "Progress saved!";
  informer.classList.remove("fade-in-trigger", "fade-out-trigger");
  void informer.offsetWidth;
  informer.classList.add("fade-in-trigger");
  setTimeout(() => {
    informer.classList.remove("fade-in-trigger");
    void informer.offsetWidth;
    informer.classList.add("fade-out-trigger");
  }, 1000);
}

function add() {
  number++;
  renderScore();
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function reset() {
  if (confirm("Do you want to reset your progress? (Removes all of your progress)")) {
    number = 0;
    autoClickerUnlocked = false;
    mouseLevel = 0;
    servantLevel = 0;
    robotLevel = 0;
    hackerLevel = 0;
    armyLevel = 0;
    serverLevel = 0;
    renderScore();
    refreshAutoClickerUi();
    save();
  }
}

// ── Auto-save every 10 seconds only if score changed ──
let lastSaved = number;
setInterval(() => {
  if (number !== lastSaved) {
    save();
    lastSaved = number;
  }
}, 10000);

// ── Global leaderboard — reads top 10 from Firestore ──
async function showLeaderboard() {
  document.getElementById("name1").innerHTML  = "Loading...";
  document.getElementById("name2").innerHTML  = "Loading...";
  document.getElementById("name3").innerHTML  = "Loading...";
  document.getElementById("name4").innerHTML  = "Loading...";
  document.getElementById("name5").innerHTML  = "Loading...";
  document.getElementById("name6").innerHTML  = "Loading...";
  document.getElementById("name7").innerHTML  = "Loading...";
  document.getElementById("name8").innerHTML  = "Loading...";
  document.getElementById("name9").innerHTML  = "Loading...";
  document.getElementById("name10").innerHTML = "Loading...";
  document.getElementById("score1").innerHTML = "...";
  document.getElementById("score2").innerHTML = "...";
  document.getElementById("score3").innerHTML = "...";
  document.getElementById("score4").innerHTML = "...";
  document.getElementById("score5").innerHTML = "...";
  document.getElementById("score6").innerHTML = "...";
  document.getElementById("score7").innerHTML = "...";
  document.getElementById("score8").innerHTML = "...";
  document.getElementById("score9").innerHTML = "...";
  document.getElementById("score10").innerHTML = "...";
  leaderboardModal.style.display = "block";

  const q = query(
    collection(db, "leaderboard"),
    orderBy("score", "desc"),
    limit(10)
  );

  const snapshot = await getDocs(q);
  const scoreSlots = ["score1", "score2", "score3", "score4", "score5", "score6", "score7", "score8", "score9", "score10"];
  const nameSlots  = ["name1",  "name2",  "name3",  "name4",  "name5",  "name6",  "name7",  "name8",  "name9",  "name10"];

  snapshot.docs.forEach((docSnap, i) => {
    const data = docSnap.data();
    const name  = data.name  ?? "Anonymous";
    const score = data.score ?? 0;
    const storedNameStyle = getStoredNameStyle(data);

    // Treat missing/non-number tag fields as null
    const storedTag = typeof data.tag === "number" ? data.tag : null;

    // 🟢 AUTOMATIC: Top Player tag
    // Rank 1 always shows Top Player (tag 4) unless they have a manual tag.
    // Tags are non-stacked — only one tag is ever shown per player.
    let displayTag;
    if (i === 0 && !MANUAL_TAGS.has(storedTag)) {
      displayTag = 4; // Top Player
    } else {
      displayTag = storedTag;
    }

    renderLeaderboardName(nameSlots[i], name, storedNameStyle, displayTag);
    document.getElementById(scoreSlots[i]).innerHTML = score.toLocaleString();
  });

  // Fill any empty slots if fewer than 10 players exist yet
  for (let i = snapshot.docs.length; i < 10; i++) {
    document.getElementById(nameSlots[i]).innerHTML  = "—";
    document.getElementById(scoreSlots[i]).innerHTML = "—";
  }
}

async function showCustomization() {
  updateUnlockedStyles();
  customizationModal.style.display = "block";
}

// ── Player name — saved to localStorage and Firestore ──
document.getElementById("saveNameBtn").addEventListener("click", () => {
  const input = document.getElementById("playerNameInput").value.trim();
  if (input) {
    playerName = input;
    localStorage.setItem("playerName", playerName);
    save();
  }
});

const onClick = (id, handler) => {
  const element = document.getElementById(id);
  if (element) element.addEventListener("click", handler);
};

const getScore = () => {
  return Math.floor(number);
};

const setScore = (newScore) => {
  number = Math.max(0, Number(newScore) || 0);
  renderScore();
};

const addScore = (amount) => {
  number += amount;
  renderScore();
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
};

// Autoclicker settings.
// CPS means "clicks per second", so 0.1 CPS means 1 click every 10 seconds.
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

const normalizeUpgradeLevel = (level, maxLevel) => {
  const parsedLevel = Number(level);
  if (!Number.isFinite(parsedLevel)) return 0;
  return Math.min(Math.max(0, Math.floor(parsedLevel)), maxLevel);
};

// This starts false because the Upgrades menu is locked at first.
let autoClickerUnlocked = false;

let mouseLevel = 0;
let servantLevel = 0;
let robotLevel = 0;
let hackerLevel = 0;
let armyLevel = 0;
let serverLevel = 0;

if (savedPlayerData) {
  autoClickerUnlocked = savedPlayerData.autoClickerUnlocked === true;
  mouseLevel = normalizeUpgradeLevel(savedPlayerData.mouseLevel, MOUSE_MAX_LEVEL);
  servantLevel = normalizeUpgradeLevel(savedPlayerData.servantLevel, SERVANT_MAX_LEVEL);
  robotLevel = normalizeUpgradeLevel(savedPlayerData.robotLevel, ROBOT_MAX_LEVEL);
  hackerLevel = normalizeUpgradeLevel(savedPlayerData.hackerLevel, HACKER_MAX_LEVEL);
  armyLevel = normalizeUpgradeLevel(savedPlayerData.armyLevel, ARMY_MAX_LEVEL);
  serverLevel = normalizeUpgradeLevel(savedPlayerData.serverLevel, SERVER_MAX_LEVEL);
}

// Mouse CPS depends on how many Mouse upgrades were bought inside the Upgrades menu.
const getMouseCps = () => mouseLevel * MOUSE_CPS_GAIN;
const getServantCps = () => servantLevel * SERVANT_CPS_GAIN;
const getRobotCps = () => robotLevel * ROBOT_CPS_GAIN;
const getHackerCps = () => hackerLevel * HACKER_CPS_GAIN;
const getArmyCps = () => armyLevel * ARMY_CPS_GAIN;
const getServerCps = () => serverLevel * SERVER_CPS_GAIN;

// Total CPS is the sum of all upgrade CPS.
const getTotalAutoClickerCps = () => getMouseCps() + getServantCps() + getRobotCps() + getHackerCps() + getArmyCps() + getServerCps();

// Each bought upgrade makes the next one cost more.
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

// ── Smooth rAF-based autoclicker ───────────────────────────────────────────
// Instead of a 1-second setInterval that adds large chunks at once, we use
// requestAnimationFrame so the counter increments every ~16ms. The total CPS
// added per second stays the same — it just arrives in tiny sips, making the
// number climb smoothly. Higher CPS → larger sips → visibly faster counting.
let _rafId = null;
let _lastRafTime = null;
let _lastUiRefresh = 0; // timestamp of last affordability/label refresh

const _rafTick = (timestamp) => {
  if (_lastRafTime !== null) {
    const delta = (timestamp - _lastRafTime) / 1000; // seconds since last frame

    const cps = getTotalAutoClickerCps();
    if (cps > 0) {
      number += cps * delta;
      renderScore();
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

const refreshAutoClickerUi = () => {
  updateAutoClickerButtons();
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
  _updateCpsDisplay();
};

// ──────────────────────────────────────────────────────────────────────────

const showInformer = (id) => {
  const informer = document.getElementById(id);
  if (!informer) return;

  informer.classList.remove("fade-in-trigger", "fade-out-trigger");
  void informer.offsetWidth;
  informer.classList.add("fade-in-trigger");

  setTimeout(() => {
    informer.classList.remove("fade-in-trigger");
    informer.classList.add("fade-out-trigger");
  }, 1500);
};

function showUpgrades() {
  const upgradesBtn = document.getElementById("upgradesBtn");
  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades to use this feature!");
  } else {
    upgradesBtn.style.display = "block";
  }
}

function updateAutoClickerButtons() {
  const unlockBtn = document.getElementById("autoclickerbuyBtn");
  const upgradesBtn = document.getElementById("upgradesBtn");
  if (unlockBtn) unlockBtn.style.display = autoClickerUnlocked ? "none" : "block";
  if (upgradesBtn) upgradesBtn.style.display = autoClickerUnlocked ? "block" : "none";
}

updateAutoClickerButtons();

function unlockAutoClickerUpgrades() {
  const score = getScore();

  // This only unlocks the Upgrades menu. It does not start giving clicks.
  if (score < AUTOCLICKER_UNLOCK_COST) {
    alert(`Not enough clicks to unlock autoclicker upgrades! You need ${AUTOCLICKER_UNLOCK_COST.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - AUTOCLICKER_UNLOCK_COST);
  autoClickerUnlocked = true;
  updateAutoClickerButtons();
  showInformer("autoclickerInformer");
  refreshAutoClickerUi();
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
  refreshAutoClickerUi();
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
  refreshAutoClickerUi();
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
  refreshAutoClickerUi();
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
  refreshAutoClickerUi();
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
  refreshAutoClickerUi();
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
  refreshAutoClickerUi();
}

// Updates the autoclicker labels and locked styles.
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

const updateUnlockedStyles = () => {
  const score = getScore();

  const blackStyleCard = document.getElementById("blackStyleBtn");
  const blueStyleCard = document.getElementById("blueStyleBtn");
  const goldStyleCard = document.getElementById("goldStyleBtn");
  const purpleStyleCard = document.getElementById("purpleStyleBtn");
  const redPinkStyleCard = document.getElementById("redPinkStyleBtn");
  const rainbowStyleCard = document.getElementById("rainbowStyleBtn");

  blackStyleCard.classList.add("locked");
  blueStyleCard.classList.add("locked");
  goldStyleCard.classList.add("locked");
  purpleStyleCard.classList.add("locked");
  redPinkStyleCard.classList.add("locked");
  rainbowStyleCard.classList.add("locked");

  document.getElementById("blackSublabel").textContent = "Always unlocked";
  document.getElementById("blueSublabel").textContent = "🔒 Unlock at 1,000";
  document.getElementById("goldSublabel").textContent = "🔒 Unlock at 10,000";
  document.getElementById("purpleSublabel").textContent = "🔒 Unlock at 100,000";
  document.getElementById("redPinkSublabel").textContent = "🔒 Unlock at 1,000,000";
  document.getElementById("rainbowSublabel").textContent = "🔒 Unlock at 10,000,000";

  if (score >= 0) {
    blackStyleCard.classList.remove("locked");
  }
  if (score >= 1000) {
    blueStyleCard.classList.remove("locked");
    document.getElementById("blueSublabel").textContent = "Unlocked at 1,000";
  }
  if (score >= 10000) {
    goldStyleCard.classList.remove("locked");
    document.getElementById("goldSublabel").textContent = "Unlocked at 10,000";
  }
  if (score >= 100000) {
    purpleStyleCard.classList.remove("locked");
    document.getElementById("purpleSublabel").textContent = "Unlocked at 100,000";
  }
  if (score >= 1000000) {
    redPinkStyleCard.classList.remove("locked");
    document.getElementById("redPinkSublabel").textContent = "Unlocked at 1,000,000";
  }
  if (score >= 10000000) {
    rainbowStyleCard.classList.remove("locked");
    document.getElementById("rainbowSublabel").textContent = "Unlocked at 10,000,000";
  }
};

const initializeGameLoop = () => {
  refreshAutoClickerUi();
  startSmoothLoop(); // kick off the rAF counter animation
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initializeGameLoop, { once: true });
} else {
  initializeGameLoop();
}

// Upgrades Modal
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

// Customization modal
const customizationModal = document.getElementById("customizationModal");
onClick("customizationBtn", () => {
  updateUnlockedStyles();
  customizationModal.style.display = "block";
});
onClick("customizationClose", () => customizationModal.style.display = "none");

// Customization [NAME STYLES]
const blackStyleCard = document.getElementById("blackStyleBtn");
onClick("blackStyleBtn", () => {
  blackStyleCard.classList.add("selected");
  blueStyleCard.classList.remove("selected");
  goldStyleCard.classList.remove("selected");
  purpleStyleCard.classList.remove("selected");
  redPinkStyleCard.classList.remove("selected");
  rainbowStyleCard.classList.remove("selected");
  saveNameStyle(1);
});

const blueStyleCard = document.getElementById("blueStyleBtn");
onClick("blueStyleBtn", () => {
  if (blueStyleCard.classList.contains("locked")) {
    return alert("This style is locked! Reach 1,000 points to unlock it.");
  } else {
    blackStyleCard.classList.remove("selected");
    blueStyleCard.classList.add("selected");
    goldStyleCard.classList.remove("selected");
    purpleStyleCard.classList.remove("selected");
    redPinkStyleCard.classList.remove("selected");
    rainbowStyleCard.classList.remove("selected");
    saveNameStyle(2);
  }
});

const goldStyleCard = document.getElementById("goldStyleBtn");
onClick("goldStyleBtn", () => {
  if (goldStyleCard.classList.contains("locked")) {
    return alert("This style is locked! Reach 10,000 points to unlock it.");
  } else {
    blackStyleCard.classList.remove("selected");
    blueStyleCard.classList.remove("selected");
    goldStyleCard.classList.add("selected");
    purpleStyleCard.classList.remove("selected");
    redPinkStyleCard.classList.remove("selected");
    rainbowStyleCard.classList.remove("selected");
    saveNameStyle(3);
  }
});

const purpleStyleCard = document.getElementById("purpleStyleBtn");
onClick("purpleStyleBtn", () => {
  if (purpleStyleCard.classList.contains("locked")) {
    return alert("This style is locked! Reach 100,000 points to unlock it.");
  } else {
    blackStyleCard.classList.remove("selected");
    blueStyleCard.classList.remove("selected");
    goldStyleCard.classList.remove("selected");
    purpleStyleCard.classList.add("selected");
    redPinkStyleCard.classList.remove("selected");
    rainbowStyleCard.classList.remove("selected");
    saveNameStyle(4);
  }
});

const redPinkStyleCard = document.getElementById("redPinkStyleBtn");
onClick("redPinkStyleBtn", () => {
  if (redPinkStyleCard.classList.contains("locked")) {
    return alert("This style is locked! Reach 1,000,000 points to unlock it.");
  } else {
    blackStyleCard.classList.remove("selected");
    blueStyleCard.classList.remove("selected");
    goldStyleCard.classList.remove("selected");
    purpleStyleCard.classList.remove("selected");
    redPinkStyleCard.classList.add("selected");
    rainbowStyleCard.classList.remove("selected");
    saveNameStyle(5);
  }
});

const rainbowStyleCard = document.getElementById("rainbowStyleBtn");
onClick("rainbowStyleBtn", () => {
  if (rainbowStyleCard.classList.contains("locked")) {
    return alert("This style is locked! Reach 10,000,000 points to unlock it.");
  } else {
    blackStyleCard.classList.remove("selected");
    blueStyleCard.classList.remove("selected");
    goldStyleCard.classList.remove("selected");
    purpleStyleCard.classList.remove("selected");
    redPinkStyleCard.classList.remove("selected");
    rainbowStyleCard.classList.add("selected");
    saveNameStyle(6);
  }
});

// Customization [BACKGROUND MUSIC]
const bgmusic = new Audio("ChadwickBroski/generic-clicker-game/assets/Chill-prettyjohn1.mp3"); // replace with your actual file path
bgmusic.loop = true;
let isbgmusicPlaying = false;

const music1Card = document.getElementById("music1Card");
const musicVolume = document.getElementById("musicVolume");
//const music2Card = document.getElementById("music2Card");
//const music3Card = document.getElementById("music3Card");
bgmusic.volume = 0.5;

onClick("music1Card", () => {
  if (isbgmusicPlaying) {
    bgmusic.pause();
    isbgmusicPlaying = false;
    music1Card.classList.remove("selected");
    document.getElementById("music1Label").textContent = "Off";
  } else {
    bgmusic.play();
    isbgmusicPlaying = true;
    music1Card.classList.add("selected");
    //music2Card.classList.remove("selected");
    //music3Card.classList.remove("selected");
    document.getElementById("music1Label").textContent = "Playing ▶";
    //document.getElementById("music2Label").textContent = "Off";
    //document.getElementById("music3Label").textContent = "Off";
  }
});

// Wire up buttons that exist on the current page.
if (typeof add === "function") onClick("clickBtn", add);
if (typeof save === "function") onClick("saveBtn", save);
if (typeof reset === "function") onClick("resetBtn", reset);
if (typeof showLeaderboard === "function") onClick("leaderboardBtn", showLeaderboard);
if (typeof unlockAutoClickerUpgrades === "function") onClick("autoclickerbuyBtn", unlockAutoClickerUpgrades);

// Settings modal
const settingsModal = document.getElementById("settingsModal");
document.getElementById("settingsBtn").addEventListener("click",   () => settingsModal.style.display = "block");
document.getElementById("settingsClose").addEventListener("click", () => settingsModal.style.display = "none");

// Leaderboard modal
const leaderboardModal = document.getElementById("leaderboardModal");
document.getElementById("leaderboardClose").addEventListener("click", () => leaderboardModal.style.display = "none");

window.addEventListener("click", (event) => {
  if (event.target === settingsModal)    settingsModal.style.display   = "none";
  if (event.target === leaderboardModal) leaderboardModal.style.display = "none";
  if (event.target === customizationModal) customizationModal.style.display = "none";
});
