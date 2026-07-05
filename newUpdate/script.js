import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getCountFromServer, collection, query, orderBy, limit, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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
  // 🟢 AUTOMATIC — assigned if the player UID is of the owner
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
const MANUAL_TAGS = new Set([3, 5, 6, 7]);

// ── Name style definitions ──
// Stored in Firestore as an integer in the "nameStyles" field
// 1 = Default, 2 = Blue, 3 = Gold, 4 = Purple, 5 = Crimson Fade, 6 = Rainbow
const NAME_STYLE_FIELD = "nameStyles";
const LEGACY_NAME_STYLE_FIELD = "nameStyle";
const DEFAULT_NAME_STYLE = 1;
const NAME_STYLES = {
  1:  { id: "blackStyleBtn",      className: "name-style-default",   label: "Default",      unlock: 0 },
  2:  { id: "blueStyleBtn",       className: "name-style-blue",      label: "Blue",         unlock: 1000 },
  3:  { id: "greenStyleBtn",      className: "name-style-green",     label: "Green",        unlock: 5000 },
  4:  { id: "purpleStyleBtn",     className: "name-style-purple",    label: "Purple",       unlock: 25000 },
  5:  { id: "cyanStyleBtn",       className: "name-style-cyan",      label: "Cyan",         unlock: 100000 },
  6:  { id: "crimsonStyleBtn",    className: "name-style-crimson",   label: "Crimson",      unlock: 500000 },
  7:  { id: "silverStyleBtn",     className: "name-style-silver",    label: "Silver",       unlock: 1000000, gradient: true },
  8:  { id: "goldStyleBtn",       className: "name-style-gold",      label: "Gold",         unlock: 5000000 },
  9:  { id: "emeraldStyleBtn",    className: "name-style-emerald",   label: "Emerald",      unlock: 10000000, gradient: true },
  10: { id: "sapphireStyleBtn",   className: "name-style-sapphire",  label: "Sapphire",     unlock: 25000000, gradient: true },
  11: { id: "rubyStyleBtn",       className: "name-style-ruby",      label: "Ruby",         unlock: 50000000, gradient: true },
  12: { id: "amethystStyleBtn",   className: "name-style-amethyst",  label: "Amethyst",     unlock: 100000000, gradient: true },
  13: { id: "plasmaStyleBtn",     className: "name-style-plasma",    label: "Plasma",       unlock: 250000000, gradient: true, animated: true },
  14: { id: "galaxyStyleBtn",     className: "name-style-galaxy",    label: "Galaxy",       unlock: 500000000, gradient: true, animated: true },
  15: { id: "voidStyleBtn",       className: "name-style-void",      label: "Void",         unlock: 1000000000, gradient: true, animated: true },
  16: { id: "rainbowStyleBtn",    className: "name-style-rainbow",   label: "Rainbow",      unlock: 5000000000, gradient: true, animated: true },
  17: { id: "solarFlareStyleBtn", className: "name-style-solar-flare", label: "Solar Flare", unlock: 10000000000, gradient: true, animated: true },
  18: { id: "nebulaStyleBtn",     className: "name-style-nebula",     label: "Nebula",       unlock: 25000000000, gradient: true, animated: true },
  19: { id: "cosmicStyleBtn",     className: "name-style-cosmic",     label: "Cosmic",       unlock: 50000000000, gradient: true, animated: true },
  20: { id: "celestialStyleBtn",  className: "name-style-celestial",  label: "Celestial",    unlock: 100000000000, gradient: true, animated: true },
  21: { id: "infiniteStyleBtn",   className: "name-style-infinite",   label: "Infinite",     unlock: 1000000000000, gradient: true, animated: true },
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
  if (style.animated) element.classList.add("name-style-animated");
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

const ACHIEVEMENT_IDS = new Set(["firstClick", "century", "millennium", "millionaire", "billionaire", "trillionaire", "chillOut", "clickPrinter", "clickButtonLeftChat", "sonImCrine", "youCanStopNow", "jobApplication", "leaveSomeForUs", "firstPrestige"]);
let unlockedAchievements = [];

function normalizeAchievementList(values = []) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((achievement) => typeof achievement === "string" && ACHIEVEMENT_IDS.has(achievement)))];
}

async function saveUnlockedAchievementsToFirebase() {
  await setDoc(doc(db, "leaderboard", uid), {
    unlockedAchievements: [...unlockedAchievements]
  }, { merge: true });
}

function unlockAchievement(achievementId) {
  if (!unlockedAchievements.includes(achievementId)) {
    unlockedAchievements.push(achievementId);
    void saveUnlockedAchievementsToFirebase();
  }
}

function updateUnlockedAchievements(score) {
  if (score >= 1) unlockAchievement("firstClick");
  if (score >= 100) unlockAchievement("century");
  if (score >= 1000) unlockAchievement("millennium");
  if (score >= 1000000) unlockAchievement("millionaire");
  if (score >= 1000000000) unlockAchievement("billionaire");
  if (score >= 1000000000000) unlockAchievement("trillionaire");
  if (score >= 1000000000000000) unlockAchievement("chillOut");
  if (score >= 1000000000000000000) unlockAchievement("clickPrinter");
  if (score >= 1000000000000000000000000) unlockAchievement("clickButtonLeftChat");
  if (score >= 1000000000000000000000000000) unlockAchievement("sonImCrine");
  if (score >= 1000000000000000000000000000000000) unlockAchievement("youCanStopNow");
  if (score >= 1000000000000000000000000000000000000000) unlockAchievement("jobApplication");
  if (score >= 1000000000000000000000000000000000000000000000000000000) unlockAchievement("leaveSomeForUs");
  if (prestigeCount >= 1) unlockAchievement("firstPrestige");
}

function renderAchievementCard(cardId, completedId, unlocked) {
  const card = document.getElementById(cardId);
  const completed = document.getElementById(completedId);
  if (!card || !completed) return;

  card.classList.toggle("locked", !unlocked);
  card.classList.toggle("unlocked", unlocked);
  completed.classList.toggle("locked", !unlocked);
  completed.classList.toggle("unlocked", unlocked);
  completed.innerHTML = unlocked
    ? '<i class="fa-solid fa-circle-check"></i>'
    : '<i class="fa-solid fa-lock"></i>';
}

function refreshAchievementsUI() {
  renderAchievementCard("firstClick", "firstClickCompleted", unlockedAchievements.includes("firstClick"));
  renderAchievementCard("century", "centuryCompleted", unlockedAchievements.includes("century"));
  renderAchievementCard("millennium", "millenniumCompleted", unlockedAchievements.includes("millennium"));
  renderAchievementCard("millionaire", "millionaireCompleted", unlockedAchievements.includes("millionaire"));
  renderAchievementCard("billionaire", "billionaireCompleted", unlockedAchievements.includes("billionaire"));
  renderAchievementCard("trillionaire", "trillionaireCompleted", unlockedAchievements.includes("trillionaire"));
  renderAchievementCard("chillOut", "chillOutCompleted", unlockedAchievements.includes("chillOut"));
  renderAchievementCard("clickPrinter", "clickPrinterCompleted", unlockedAchievements.includes("clickPrinter"));
  renderAchievementCard("clickButtonLeftChat", "clickButtonLeftChatCompleted", unlockedAchievements.includes("clickButtonLeftChat"));
  renderAchievementCard("sonImCrine", "sonImCrineCompleted", unlockedAchievements.includes("sonImCrine"));
  renderAchievementCard("youCanStopNow", "youCanStopNowCompleted", unlockedAchievements.includes("youCanStopNow"));
  renderAchievementCard("jobApplication", "jobApplicationCompleted", unlockedAchievements.includes("jobApplication"));
  renderAchievementCard("leaveSomeForUs", "leaveSomeForUsCompleted", unlockedAchievements.includes("leaveSomeForUs"));
  renderAchievementCard("firstPrestige", "firstPrestigeCompleted", unlockedAchievements.includes("firstPrestige"));
}


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
  // Convert scoreString BigInt back to number for game logic
  number     = data.scoreString ? Number(BigInt(data.scoreString)) : 0;
  playerName = data.name      ?? "Anonymous";
  nameStyle  = getStoredNameStyle(data);
  unlockedAchievements = normalizeAchievementList(data.unlockedAchievements);
} else {
  // Player has never saved before — flag them as new for First 100 check
  isNewPlayer = true;
}

renderScore();
updateUnlockedAchievements(number);
refreshAchievementsUI();
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
  const uid = auth.currentUser.uid;
  const savedScore = Math.floor(number);
  localStorage.setItem("value", savedScore);

  const dataToSave = {
    name: playerName,
    scoreString: BigInt(savedScore).toString(),  // Store as string BigInt
    autoClickerUnlocked,
    mouseLevel,
    servantLevel,
    robotLevel,
    teamLevel,
    hackerLevel,
    armyLevel,
    serverLevel,
    dataCenterLevel,
    automationLabLevel,
    cloudRegionLevel,
    superComputerLevel,
    quantumComputerLevel,
    unemployedLevel,
    clickAngelLevel,
    clickArchangelLevel,
    clickDemigodLevel,
    clickGodLevel,
    prestigeCount,
    unlockedAchievements: [...unlockedAchievements],
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

  if (uid == "Zy3RJNO1rhgDkIB2lLQTMwnnIaO2") {
    dataToSave.tag = 2; // Owner tag
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

function getClickPower() {
  return 10 ** Math.max(0, prestigeCount);
}

function add() {
  const power = getClickPower();
  
  const clickEffect = document.createElement("span");
  clickEffect.className = "click-animation";
  // Add random offset so rapid clicks don't stack perfectly
  clickEffect.style.left = `${event.clientX + (Math.random() * 40 - 20)}px`;
  clickEffect.style.top  = `${event.clientY + (Math.random() * 20 - 10)}px`;
  clickEffect.textContent = `+${power}`;
  document.body.appendChild(clickEffect);
  
  setTimeout(() => clickEffect.remove(), 1000);
  
  requestAnimationFrame(() => addScore(power));
}

function reset() {
  let counter = document.getElementById("counter");
  if (confirm("Do you want to reset your progress? (Removes all of your progress)")) {
    number = 0;
    autoClickerUnlocked = false;
    mouseLevel = 0;
    servantLevel = 0;
    robotLevel = 0;
    teamLevel = 0;
    hackerLevel = 0;
    armyLevel = 0;
    serverLevel = 0;
    dataCenterLevel = 0;
    automationLabLevel = 0;
    cloudRegionLevel = 0;
    superComputerLevel = 0;
    quantumComputerLevel = 0;
    unemployedLevel = 0;
    clickAngelLevel = 0;
    clickArchangelLevel = 0;
    clickDemigodLevel = 0;
    clickGodLevel = 0;
    counter.textContent = number.toLocaleString();
    unlockedAchievements = [];
    prestigeCount = 0;
    isNewPlayer = true;
    nameStyle = 1;
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

// ── Dynamic font-size based on digit count ──
// Reduces font-size when scores reach trillions and above
function calculateLeaderboardFontSize(scoreString) {
  const digitCount = scoreString.length;
  
  // Default: 24px for numbers with up to 11 digits
  if (digitCount <= 11) return "24px"; // Up to 999 billion
  if (digitCount === 12) return "23px"; // Trillions
  if (digitCount === 13) return "22px"; // 10+ Trillions
  if (digitCount === 14) return "21px"; // 100+ Trillions
  if (digitCount === 15) return "20px"; // Quadrillions
  return "15px"; // Quintillions and beyond
}

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
    collection(db, "leaderboard")
  );

  const snapshot = await getDocs(q);
  
  // Convert to array and sort numerically by scoreString
  const players = snapshot.docs.map(doc => ({
    ...doc.data(),
    id: doc.id
  })).sort((a, b) => {
    const scoreA = BigInt(a.scoreString ?? "0");
    const scoreB = BigInt(b.scoreString ?? "0");
    return scoreB > scoreA ? 1 : scoreB < scoreA ? -1 : 0;
  }).slice(0, 10); // Take top 10

  document.getElementById("name1").textContent = players[0].username;
  document.getElementById("name1").dataset.uid = players[0].id;

  document.getElementById("name2").textContent = players[1].username;
  document.getElementById("name2").dataset.uid = players[1].id;

  document.getElementById("name3").textContent = players[2].username;
  document.getElementById("name3").dataset.uid = players[2].id;

  document.getElementById("name4").textContent = players[3].username;
  document.getElementById("name4").dataset.uid = players[3].id;

  document.getElementById("name5").textContent = players[4].username;
  document.getElementById("name5").dataset.uid = players[4].id;

  document.getElementById("name6").textContent = players[5].username;
  document.getElementById("name6").dataset.uid = players[5].id;

  document.getElementById("name7").textContent = players[6].username;
  document.getElementById("name7").dataset.uid = players[6].id;

  document.getElementById("name8").textContent = players[7].username;
  document.getElementById("name8").dataset.uid = players[7].id;

  document.getElementById("name9").textContent = players[8].username;
  document.getElementById("name9").dataset.uid = players[8].id;

  document.getElementById("name10").textContent = players[9].username;
  document.getElementById("name10").dataset.uid = players[9].id;

  const scoreSlots = ["score1", "score2", "score3", "score4", "score5", "score6", "score7", "score8", "score9", "score10"];
  const nameSlots  = ["name1",  "name2",  "name3",  "name4",  "name5",  "name6",  "name7",  "name8",  "name9",  "name10"];

  players.forEach((data, i) => {
    const name  = data.name  ?? "Anonymous";
    const scoreString = data.scoreString ?? "0";
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
    
    const scoreElement = document.getElementById(scoreSlots[i]);
    scoreElement.innerHTML = scoreString.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    scoreElement.style.fontSize = calculateLeaderboardFontSize(scoreString);
  });

  for (let i = players.length; i < 10; i++) {
    document.getElementById(nameSlots[i]).innerHTML  = "—";
    document.getElementById(scoreSlots[i]).innerHTML = "—";
  }
}

function profilePage(element) {
    const uid = element.dataset.uid;
    const username = element.querySelector(".leaderboard-name").textContent;
    window.open(`user.html?uid=${uid}`, "_blank");
}

window.profilePage = profilePage;

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
  updateUnlockedAchievements(number);
  refreshAchievementsUI();
};

const addScore = (amount) => {
  number += amount;
  renderScore();
  updateUnlockedAchievements(number);
  refreshAchievementsUI();
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
};

// Autoclicker settings.
// CPS means "clicks per second", so 0.1 CPS means 1 click every 10 seconds.
const AUTOCLICKER_UNLOCK_COST = 20;
// Mouse
const MOUSE_BASE_COST = 10;
const MOUSE_COST_MULTIPLIER = 1.14;
const MOUSE_CPS_GAIN = 0.1;
const MOUSE_MAX_LEVEL = 1000;
// Servant
const SERVANT_BASE_COST = 250;
const SERVANT_COST_MULTIPLIER = 1.16;
const SERVANT_CPS_GAIN = 2;
const SERVANT_MAX_LEVEL = 1000;
// Robot
const ROBOT_BASE_COST = 1000;
const ROBOT_COST_MULTIPLIER = 1.18;
const ROBOT_CPS_GAIN = 10;
const ROBOT_MAX_LEVEL = 1000;
// Team
const TEAM_BASE_COST = 2500;
const TEAM_COST_MULTIPLIER = 1.2;
const TEAM_CPS_GAIN = 20;
const TEAM_MAX_LEVEL = 1000;
// Army
const ARMY_BASE_COST = 4000;
const ARMY_COST_MULTIPLIER = 1.22;
const ARMY_CPS_GAIN = 40;
const ARMY_MAX_LEVEL = 1000;
// Hacker
const HACKER_BASE_COST = 8000;
const HACKER_COST_MULTIPLIER = 1.24;
const HACKER_CPS_GAIN = 100;
const HACKER_MAX_LEVEL = 1000;
// Server
const SERVER_BASE_COST = 25000;
const SERVER_COST_MULTIPLIER = 1.26;
const SERVER_CPS_GAIN = 175;
const SERVER_MAX_LEVEL = 1000;
// Data Center
const DATA_CENTER_BASE_COST = 65000;
const DATA_CENTER_COST_MULTIPLIER = 1.28;
const DATA_CENTER_CPS_GAIN = 500;
const DATA_CENTER_MAX_LEVEL = 1000;
// Automation Lab
const AUTOMATION_LAB_BASE_COST = 100000;
const AUTOMATION_LAB_COST_MULTIPLIER = 1.3;
const AUTOMATION_LAB_CPS_GAIN = 1000;
const AUTOMATION_LAB_MAX_LEVEL = 1000;
// Cloud Region
const CLOUD_REGION_BASE_COST = 250000;
const CLOUD_REGION_COST_MULTIPLIER = 1.32;
const CLOUD_REGION_CPS_GAIN = 2500;
const CLOUD_REGION_MAX_LEVEL = 1000;
// Super Computer
const SUPER_COMPUTER_BASE_COST = 600000;
const SUPER_COMPUTER_COST_MULTIPLIER = 1.34;
const SUPER_COMPUTER_CPS_GAIN = 12000;
const SUPER_COMPUTER_MAX_LEVEL = 1000;
// Quantum Computer
const QUANTUM_COMPUTER_BASE_COST = 1100000;
const QUANTUM_COMPUTER_COST_MULTIPLIER = 1.36;
const QUANTUM_COMPUTER_CPS_GAIN = 20000;
const QUANTUM_COMPUTER_MAX_LEVEL = 1000;
// Unemployed
const UNEMPLOYED_BASE_COST = 2200000;
const UNEMPLOYED_COST_MULTIPLIER = 1.38;
const UNEMPLOYED_CPS_GAIN = 40000;
const UNEMPLOYED_MAX_LEVEL = 1000;

// Click Angel
const CLICK_ANGEL_BASE_COST = 5000000;
const CLICK_ANGEL_COST_MULTIPLIER = 1.4;
const CLICK_ANGEL_CPS_GAIN = 100000;
const CLICK_ANGEL_MAX_LEVEL = 1000;

// Click Archangel
const CLICK_ARCHANGEL_BASE_COST = 15000000;
const CLICK_ARCHANGEL_COST_MULTIPLIER = 1.42;
const CLICK_ARCHANGEL_CPS_GAIN = 300000;
const CLICK_ARCHANGEL_MAX_LEVEL = 1000;

// Click Demigod
const CLICK_DEMIGOD_BASE_COST = 50000000;
const CLICK_DEMIGOD_COST_MULTIPLIER = 1.45;
const CLICK_DEMIGOD_CPS_GAIN = 1000000;
const CLICK_DEMIGOD_MAX_LEVEL = 1000;

// Click God
const CLICK_GOD_BASE_COST = 150000000;
const CLICK_GOD_COST_MULTIPLIER = 1.5;
const CLICK_GOD_CPS_GAIN = 3000000;
const CLICK_GOD_MAX_LEVEL = 1000;

// Prestige
const PRESTIGE_BASE_COST = 20000000;
const PRESTIGE_CPS_BOOST_MULTIPLIER = 10; // 10x CPS multiplier per prestige

const normalizeUpgradeLevel = (level, maxLevel) => {
  const parsedLevel = Number(level);
  if (!Number.isFinite(parsedLevel)) return 0;
  return Math.min(Math.max(0, Math.floor(parsedLevel)), maxLevel);
};

const normalizePrestigeCount = (count) => {
  const parsedCount = Number(count);
  if (!Number.isFinite(parsedCount)) return 0;
  return Math.max(0, Math.floor(parsedCount));
};

// This starts false because the Upgrades menu is locked at first.
let autoClickerUnlocked = false;

let mouseLevel = 0;
let servantLevel = 0;
let robotLevel = 0;
let teamLevel = 0;
let armyLevel = 0;
let hackerLevel = 0;
let serverLevel = 0;
let dataCenterLevel = 0;
let automationLabLevel = 0;
let cloudRegionLevel = 0;
let superComputerLevel = 0;
let quantumComputerLevel = 0;
let unemployedLevel = 0;
let clickAngelLevel = 0;
let clickArchangelLevel = 0;
let clickDemigodLevel = 0;
let clickGodLevel = 0;
var prestigeCount = 0;

const getPrestigeMultiplier = () => PRESTIGE_CPS_BOOST_MULTIPLIER ** prestigeCount;
const getPrestigeCost = () => Math.floor(PRESTIGE_BASE_COST * PRESTIGE_CPS_BOOST_MULTIPLIER ** prestigeCount);
const applyPrestigeMultiplier = (baseCpsGain) => baseCpsGain * getPrestigeMultiplier();

if (savedPlayerData) {
  autoClickerUnlocked = savedPlayerData.autoClickerUnlocked === true;
  mouseLevel = normalizeUpgradeLevel(savedPlayerData.mouseLevel, MOUSE_MAX_LEVEL);
  servantLevel = normalizeUpgradeLevel(savedPlayerData.servantLevel, SERVANT_MAX_LEVEL);
  robotLevel = normalizeUpgradeLevel(savedPlayerData.robotLevel, ROBOT_MAX_LEVEL);
  teamLevel = normalizeUpgradeLevel(savedPlayerData.teamLevel, TEAM_MAX_LEVEL);
  hackerLevel = normalizeUpgradeLevel(savedPlayerData.hackerLevel, HACKER_MAX_LEVEL);
  armyLevel = normalizeUpgradeLevel(savedPlayerData.armyLevel, ARMY_MAX_LEVEL);
  serverLevel = normalizeUpgradeLevel(savedPlayerData.serverLevel, SERVER_MAX_LEVEL);
  dataCenterLevel = normalizeUpgradeLevel(savedPlayerData.dataCenterLevel, DATA_CENTER_MAX_LEVEL);
  automationLabLevel = normalizeUpgradeLevel(savedPlayerData.automationLabLevel, AUTOMATION_LAB_MAX_LEVEL);
  cloudRegionLevel = normalizeUpgradeLevel(savedPlayerData.cloudRegionLevel, CLOUD_REGION_MAX_LEVEL);
  superComputerLevel = normalizeUpgradeLevel(savedPlayerData.superComputerLevel, SUPER_COMPUTER_MAX_LEVEL);
  quantumComputerLevel = normalizeUpgradeLevel(savedPlayerData.quantumComputerLevel, QUANTUM_COMPUTER_MAX_LEVEL);
  unemployedLevel = normalizeUpgradeLevel(savedPlayerData.unemployedLevel, UNEMPLOYED_MAX_LEVEL);
  clickAngelLevel = normalizeUpgradeLevel(savedPlayerData.clickAngelLevel, CLICK_ANGEL_MAX_LEVEL);
  clickArchangelLevel = normalizeUpgradeLevel(savedPlayerData.clickArchangelLevel, CLICK_ARCHANGEL_MAX_LEVEL);
  clickDemigodLevel = normalizeUpgradeLevel(savedPlayerData.clickDemigodLevel, CLICK_DEMIGOD_MAX_LEVEL);
  clickGodLevel = normalizeUpgradeLevel(savedPlayerData.clickGodLevel, CLICK_GOD_MAX_LEVEL);
  prestigeCount = normalizePrestigeCount(savedPlayerData.prestigeCount);
}

updateUnlockedAchievements(number);
refreshAchievementsUI();

const formatCps = (value) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return "0.0";
  return parsedValue.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

const getMouseCpsGain = () => applyPrestigeMultiplier(MOUSE_CPS_GAIN);
const getServantCpsGain = () => applyPrestigeMultiplier(SERVANT_CPS_GAIN);
const getRobotCpsGain = () => applyPrestigeMultiplier(ROBOT_CPS_GAIN);
const getTeamCpsGain = () => applyPrestigeMultiplier(TEAM_CPS_GAIN);
const getArmyCpsGain = () => applyPrestigeMultiplier(ARMY_CPS_GAIN);
const getHackerCpsGain = () => applyPrestigeMultiplier(HACKER_CPS_GAIN);
const getServerCpsGain = () => applyPrestigeMultiplier(SERVER_CPS_GAIN);
const getDataCenterCpsGain = () => applyPrestigeMultiplier(DATA_CENTER_CPS_GAIN);
const getAutomationLabCpsGain = () => applyPrestigeMultiplier(AUTOMATION_LAB_CPS_GAIN);
const getCloudRegionCpsGain = () => applyPrestigeMultiplier(CLOUD_REGION_CPS_GAIN);
const getSuperComputerCpsGain = () => applyPrestigeMultiplier(SUPER_COMPUTER_CPS_GAIN);
const getQuantumComputerCpsGain = () => applyPrestigeMultiplier(QUANTUM_COMPUTER_CPS_GAIN);
const getUnemployedCpsGain = () => applyPrestigeMultiplier(UNEMPLOYED_CPS_GAIN);
const getClickAngelCpsGain = () => applyPrestigeMultiplier(CLICK_ANGEL_CPS_GAIN);
const getClickArchangelCpsGain = () => applyPrestigeMultiplier(CLICK_ARCHANGEL_CPS_GAIN);
const getClickDemigodCpsGain = () => applyPrestigeMultiplier(CLICK_DEMIGOD_CPS_GAIN);
const getClickGodCpsGain = () => applyPrestigeMultiplier(CLICK_GOD_CPS_GAIN);

// Mouse CPS depends on how many Mouse upgrades were bought inside the Upgrades menu.
const getMouseCps = () => mouseLevel * getMouseCpsGain();
const getServantCps = () => servantLevel * getServantCpsGain();
const getRobotCps = () => robotLevel * getRobotCpsGain();
const getTeamCps = () => teamLevel * getTeamCpsGain();
const getArmyCps = () => armyLevel * getArmyCpsGain();
const getHackerCps = () => hackerLevel * getHackerCpsGain();
const getServerCps = () => serverLevel * getServerCpsGain();
const getDataCenterCps = () => dataCenterLevel * getDataCenterCpsGain();
const getAutomationLabCps = () => automationLabLevel * getAutomationLabCpsGain();
const getCloudRegionCps = () => cloudRegionLevel * getCloudRegionCpsGain();
const getSuperComputerCps = () => superComputerLevel * getSuperComputerCpsGain();
const getQuantumComputerCps = () => quantumComputerLevel * getQuantumComputerCpsGain();
const getUnemployedCps = () => unemployedLevel * getUnemployedCpsGain();
const getClickAngelCps = () => clickAngelLevel * getClickAngelCpsGain();
const getClickArchangelCps = () => clickArchangelLevel * getClickArchangelCpsGain();
const getClickDemigodCps = () => clickDemigodLevel * getClickDemigodCpsGain();
const getClickGodCps = () => clickGodLevel * getClickGodCpsGain();

// Total CPS is the sum of all upgrade CPS.
const getTotalAutoClickerCps = () => getMouseCps() + getServantCps() + getRobotCps() + getTeamCps() + getHackerCps() + getArmyCps() + getServerCps() + getDataCenterCps() + getAutomationLabCps() + getCloudRegionCps() + getSuperComputerCps() + getQuantumComputerCps() + getUnemployedCps() + getClickAngelCps() + getClickArchangelCps() + getClickDemigodCps() + getClickGodCps();

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
const getTeamCost = () => {
  return Math.floor(TEAM_BASE_COST * TEAM_COST_MULTIPLIER ** teamLevel);
};
const getArmyCost = () => {
  return Math.floor(ARMY_BASE_COST * ARMY_COST_MULTIPLIER ** armyLevel);
};
const getHackerCost = () => {
  return Math.floor(HACKER_BASE_COST * HACKER_COST_MULTIPLIER ** hackerLevel);
};
const getServerCost = () => {
  return Math.floor(SERVER_BASE_COST * SERVER_COST_MULTIPLIER ** serverLevel);
};
const getDataCenterCost = () => {
  return Math.floor(DATA_CENTER_BASE_COST * DATA_CENTER_COST_MULTIPLIER ** dataCenterLevel);
};
const getAutomationLabCost = () => {
  return Math.floor(AUTOMATION_LAB_BASE_COST * AUTOMATION_LAB_COST_MULTIPLIER ** automationLabLevel);
};
const getCloudRegionCost = () => {
  return Math.floor(CLOUD_REGION_BASE_COST * CLOUD_REGION_COST_MULTIPLIER ** cloudRegionLevel);
};
const getSuperComputerCost = () => {
  return Math.floor(SUPER_COMPUTER_BASE_COST * SUPER_COMPUTER_COST_MULTIPLIER ** superComputerLevel);
};
const getQuantumComputerCost = () => {
  return Math.floor(QUANTUM_COMPUTER_BASE_COST * QUANTUM_COMPUTER_COST_MULTIPLIER ** quantumComputerLevel);
};
const getUnemployedCost = () => {
  return Math.floor(UNEMPLOYED_BASE_COST * UNEMPLOYED_COST_MULTIPLIER ** unemployedLevel);
};
const getClickAngelCost = () => {
  return Math.floor(CLICK_ANGEL_BASE_COST * CLICK_ANGEL_COST_MULTIPLIER ** clickAngelLevel);
};
const getClickArchangelCost = () => {
  return Math.floor(CLICK_ARCHANGEL_BASE_COST * CLICK_ARCHANGEL_COST_MULTIPLIER ** clickArchangelLevel);
};
const getClickDemigodCost = () => {
  return Math.floor(CLICK_DEMIGOD_BASE_COST * CLICK_DEMIGOD_COST_MULTIPLIER ** clickDemigodLevel);
};
const getClickGodCost = () => {
  return Math.floor(CLICK_GOD_BASE_COST * CLICK_GOD_COST_MULTIPLIER ** clickGodLevel);
};

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

function buyTeamUpgrade() {
  const score = getScore();
  const teamCost = getTeamCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (teamLevel >= TEAM_MAX_LEVEL) {
    alert("Team is already maxed out!");
    return;
  }

  if (score < teamCost) {
    alert(`Not enough clicks to purchase the Team upgrade! You need ${teamCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - teamCost);
  teamLevel++;
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

function buyDataCenterUpgrade() {
  const score = getScore();
  const dataCenterCost = getDataCenterCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (dataCenterLevel >= DATA_CENTER_MAX_LEVEL) {
    alert("Data Center is already maxed out!");
    return;
  }

  if (score < dataCenterCost) {
    alert(`Not enough clicks to purchase the Data Center upgrade! You need ${dataCenterCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - dataCenterCost);
  dataCenterLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyAutomationLabUpgrade() {
  const score = getScore();
  const automationLabCost = getAutomationLabCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (automationLabLevel >= AUTOMATION_LAB_MAX_LEVEL) {
    alert("Automation Lab is already maxed out!");
    return;
  }

  if (score < automationLabCost) {
    alert(`Not enough clicks to purchase the Automation Lab upgrade! You need ${automationLabCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - automationLabCost);
  automationLabLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyCloudRegionUpgrade() {
  const score = getScore();
  const cloudRegionCost = getCloudRegionCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (cloudRegionLevel >= CLOUD_REGION_MAX_LEVEL) {
    alert("Cloud Region is already maxed out!");
    return;
  }

  if (score < cloudRegionCost) {
    alert(`Not enough clicks to purchase the Cloud Region upgrade! You need ${cloudRegionCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - cloudRegionCost);
  cloudRegionLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}
function buySuperComputerUpgrade() {
  const score = getScore();
  const superComputerCost = getSuperComputerCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (superComputerLevel >= SUPER_COMPUTER_MAX_LEVEL) {
    alert("Super Computer is already maxed out!");
    return;
  }

  if (score < superComputerCost) {
    alert(`Not enough clicks to purchase the Super Computer upgrade! You need ${superComputerCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - superComputerCost);
  superComputerLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyQuantumComputerUpgrade() {
  const score = getScore();
  const quantumComputerCost = getQuantumComputerCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (quantumComputerLevel >= QUANTUM_COMPUTER_MAX_LEVEL) {
    alert("Quantum Computer is already maxed out!");
    return;
  }

  if (score < quantumComputerCost) {
    alert(`Not enough clicks to purchase the Quantum Computer upgrade! You need ${quantumComputerCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - quantumComputerCost);
  quantumComputerLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyUnemployedUpgrade() {
  const score = getScore();
  const unemployedCost = getUnemployedCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (unemployedLevel >= UNEMPLOYED_MAX_LEVEL) {
    alert("Unemployed is already maxed out!");
    return;
  }

  if (score < unemployedCost) {
    alert(`Not enough clicks to purchase the Unemployed upgrade! You need ${unemployedCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - unemployedCost);
  unemployedLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyClickAngelUpgrade() {
  const score = getScore();
  const clickAngelCost = getClickAngelCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (clickAngelLevel >= CLICK_ANGEL_MAX_LEVEL) {
    alert("Click Angel is already maxed out!");
    return;
  }

  if (score < clickAngelCost) {
    alert(`Not enough clicks to purchase the Click Angel upgrade! You need ${clickAngelCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - clickAngelCost);
  clickAngelLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyClickArchangelUpgrade() {
  const score = getScore();
  const clickArchangelCost = getClickArchangelCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (clickArchangelLevel >= CLICK_ARCHANGEL_MAX_LEVEL) {
    alert("Click Archangel is already maxed out!");
    return;
  }

  if (score < clickArchangelCost) {
    alert(`Not enough clicks to purchase the Click Archangel upgrade! You need ${clickArchangelCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - clickArchangelCost);
  clickArchangelLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyClickDemigodUpgrade() {
  const score = getScore();
  const clickDemigodCost = getClickDemigodCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (clickDemigodLevel >= CLICK_DEMIGOD_MAX_LEVEL) {
    alert("Click Demigod is already maxed out!");
    return;
  }

  if (score < clickDemigodCost) {
    alert(`Not enough clicks to purchase the Click Demigod upgrade! You need ${clickDemigodCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - clickDemigodCost);
  clickDemigodLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

function buyClickGodUpgrade() {
  const score = getScore();
  const clickGodCost = getClickGodCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (clickGodLevel >= CLICK_GOD_MAX_LEVEL) {
    alert("Click God is already maxed out!");
    return;
  }

  if (score < clickGodCost) {
    alert(`Not enough clicks to purchase the Click God upgrade! You need ${clickGodCost.toLocaleString()} clicks.`);
    return;
  }

  setScore(score - clickGodCost);
  clickGodLevel++;
  updateUnlockedStyles();
  updateUnlockedAutoClicker();
}

async function buyPrestigeUpgrade() {
  const score = getScore();
  const prestigeCost = getPrestigeCost();

  if (!autoClickerUnlocked) {
    alert("Unlock autoclicker upgrades first!");
    return;
  }

  if (score < prestigeCost) {
    alert(`Not enough clicks to Prestige! You need ${prestigeCost.toLocaleString()} clicks.`);
    return;
  }

  const confirmPrestige = confirm(
    `Prestige will reset your clicks and all upgrade levels, but permanently multiplies every upgrade CPS by x${PRESTIGE_CPS_BOOST_MULTIPLIER}. Continue?`
  );
  if (!confirmPrestige) return;

  prestigeCount++;
  mouseLevel = 0;
  servantLevel = 0;
  robotLevel = 0;
  teamLevel = 0;
  armyLevel = 0;
  hackerLevel = 0;
  serverLevel = 0;
  dataCenterLevel = 0;
  automationLabLevel = 0;
  cloudRegionLevel = 0;
  superComputerLevel = 0;
  quantumComputerLevel = 0;
  unemployedLevel = 0;
  // autoClickerUnlocked stays true after prestige

  setScore(1);

  if (typeof prestigeModal !== "undefined" && prestigeModal) prestigeModal.style.display = "none";
  if (typeof upgradesModal !== "undefined" && upgradesModal) upgradesModal.style.display = "none";

  updateUnlockedStyles();
  updateUnlockedAutoClicker();
  _updateCpsDisplay();

  alert(`Prestige complete! Total prestige multiplier is now x${formatCps(getPrestigeMultiplier())} on all upgrades.`);
}

// Updates the autoclicker labels and locked styles.
const updateUnlockedAutoClicker = () => {
  const score = getScore();
  const prestigeMultiplier = getPrestigeMultiplier();
  const prestigeCost = getPrestigeCost();
  const mouseCpsGain = getMouseCpsGain();
  const servantCpsGain = getServantCpsGain();
  const robotCpsGain = getRobotCpsGain();
  const teamCpsGain = getTeamCpsGain();
  const armyCpsGain = getArmyCpsGain();
  const hackerCpsGain = getHackerCpsGain();
  const serverCpsGain = getServerCpsGain();
  const dataCenterCpsGain = getDataCenterCpsGain();
  const automationLabCpsGain = getAutomationLabCpsGain();
  const cloudRegionCpsGain = getCloudRegionCpsGain();
  const superComputerCpsGain = getSuperComputerCpsGain();
  const quantumComputerCpsGain = getQuantumComputerCpsGain();
  const unemployedCpsGain = getUnemployedCpsGain();
  const clickAngelCpsGain = getClickAngelCpsGain();
  const clickArchangelCpsGain = getClickArchangelCpsGain();
  const clickDemigodCpsGain = getClickDemigodCpsGain();
  const clickGodCpsGain = getClickGodCpsGain();

  const mouseCps = getMouseCps();
  const mouseCost = getMouseCost();
  const mouseMaxed = mouseLevel >= MOUSE_MAX_LEVEL;

  const servantCps = getServantCps();
  const servantCost = getServantCost();
  const servantMaxed = servantLevel >= SERVANT_MAX_LEVEL;

  const robotCps = getRobotCps();
  const robotCost = getRobotCost();
  const robotMaxed = robotLevel >= ROBOT_MAX_LEVEL;

  const teamCps = getTeamCps();
  const teamCost = getTeamCost();
  const teamMaxed = teamLevel >= TEAM_MAX_LEVEL;

  const armyCps = getArmyCps();
  const armyCost = getArmyCost();
  const armyMaxed = armyLevel >= ARMY_MAX_LEVEL;

  const hackerCps = getHackerCps();
  const hackerCost = getHackerCost();
  const hackerMaxed = hackerLevel >= HACKER_MAX_LEVEL;

  const serverCps = getServerCps();
  const serverCost = getServerCost();
  const serverMaxed = serverLevel >= SERVER_MAX_LEVEL;

  const dataCenterCps = getDataCenterCps();
  const dataCenterCost = getDataCenterCost();
  const dataCenterMaxed = dataCenterLevel >= DATA_CENTER_MAX_LEVEL;

  const automationLabCps = getAutomationLabCps();
  const automationLabCost = getAutomationLabCost();
  const automationLabMaxed = automationLabLevel >= AUTOMATION_LAB_MAX_LEVEL;

  const cloudRegionCps = getCloudRegionCps();
  const cloudRegionCost = getCloudRegionCost();
  const cloudRegionMaxed = cloudRegionLevel >= CLOUD_REGION_MAX_LEVEL;

  const superComputerCps = getSuperComputerCps();
  const superComputerCost = getSuperComputerCost();
  const superComputerMaxed = superComputerLevel >= SUPER_COMPUTER_MAX_LEVEL;

  const quantumComputerCps = getQuantumComputerCps();
  const quantumComputerCost = getQuantumComputerCost();
  const quantumComputerMaxed = quantumComputerLevel >= QUANTUM_COMPUTER_MAX_LEVEL;

  const unemployedCps = getUnemployedCps();
  const unemployedCost = getUnemployedCost();
  const unemployedMaxed = unemployedLevel >= UNEMPLOYED_MAX_LEVEL;

  const clickAngelCps = getClickAngelCps();
  const clickAngelCost = getClickAngelCost();
  const clickAngelMaxed = clickAngelLevel >= CLICK_ANGEL_MAX_LEVEL;

  const clickArchangelCps = getClickArchangelCps();
  const clickArchangelCost = getClickArchangelCost();
  const clickArchangelMaxed = clickArchangelLevel >= CLICK_ARCHANGEL_MAX_LEVEL;

  const clickDemigodCps = getClickDemigodCps();
  const clickDemigodCost = getClickDemigodCost();
  const clickDemigodMaxed = clickDemigodLevel >= CLICK_DEMIGOD_MAX_LEVEL;

  const clickGodCps = getClickGodCps();
  const clickGodCost = getClickGodCost();
  const clickGodMaxed = clickGodLevel >= CLICK_GOD_MAX_LEVEL;

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
  // Team
  const team = document.getElementById("team");
  const teamLabel = team?.querySelector(".style-label");
  const teamSublabel = document.getElementById("teamSublabel");
  const teamUpgradeCount = document.getElementById("teamUpgradeCount");
  // Army
  const army = document.getElementById("army");
  const armyLabel = army?.querySelector(".style-label");
  const armySublabel = document.getElementById("armySublabel");
  const armyUpgradeCount = document.getElementById("armyUpgradeCount");
  // Hacker
  const hacker = document.getElementById("hacker");
  const hackerLabel = hacker?.querySelector(".style-label");
  const hackerSublabel = document.getElementById("hackerSublabel");
  const hackerUpgradeCount = document.getElementById("hackerUpgradeCount");
  // Server
  const server = document.getElementById("server");
  const serverLabel = server?.querySelector(".style-label");
  const serverSublabel = document.getElementById("serverSublabel");
  const serverUpgradeCount = document.getElementById("serverUpgradeCount");
  // Data Center
  const dataCenter = document.getElementById("dataCenter");
  const dataCenterLabel = dataCenter?.querySelector(".style-label");
  const dataCenterSublabel = document.getElementById("dataCenterSublabel");
  const dataCenterUpgradeCount = document.getElementById("dataCenterUpgradeCount");
  // Automation Lab
  const automationLab = document.getElementById("automationLab");
  const automationLabLabel = automationLab?.querySelector(".style-label");
  const automationLabSublabel = document.getElementById("automationLabSublabel");
  const automationLabUpgradeCount = document.getElementById("automationLabUpgradeCount");
  // Cloud Region
  const cloudRegion = document.getElementById("cloudRegion");
  const cloudRegionLabel = cloudRegion?.querySelector(".style-label");
  const cloudRegionSublabel = document.getElementById("cloudRegionSublabel");
  const cloudRegionUpgradeCount = document.getElementById("cloudRegionUpgradeCount");
  // Super Computer
  const superComputer = document.getElementById("superComputer");
  const superComputerLabel = superComputer?.querySelector(".style-label");
  const superComputerSublabel = document.getElementById("superComputerSublabel");
  const superComputerUpgradeCount = document.getElementById("superComputerUpgradeCount");
  // Quantum Computer
  const quantumComputer = document.getElementById("quantumComputer");
  const quantumComputerLabel = quantumComputer?.querySelector(".style-label");
  const quantumComputerSublabel = document.getElementById("quantumComputerSublabel");
  const quantumComputerUpgradeCount = document.getElementById("quantumComputerUpgradeCount");
  // Unemployed
  const unemployed = document.getElementById("unemployed");
  const unemployedLabel = unemployed?.querySelector(".style-label");
  const unemployedSublabel = document.getElementById("unemployedSublabel");
  const unemployedUpgradeCount = document.getElementById("unemployedUpgradeCount");
  // Click Angel
  const clickAngel = document.getElementById("clickAngel");
  const clickAngelLabel = clickAngel?.querySelector(".style-label");
  const clickAngelSublabel = document.getElementById("clickAngelSublabel");
  const clickAngelUpgradeCount = document.getElementById("clickAngelUpgradeCount");
  // Click Archangel
  const clickArchangel = document.getElementById("clickArchangel");
  const clickArchangelLabel = clickArchangel?.querySelector(".style-label");
  const clickArchangelSublabel = document.getElementById("clickArchangelSublabel");
  const clickArchangelUpgradeCount = document.getElementById("clickArchangelUpgradeCount");
  // Click Demigod
  const clickDemigod = document.getElementById("clickDemigod");
  const clickDemigodLabel = clickDemigod?.querySelector(".style-label");
  const clickDemigodSublabel = document.getElementById("clickDemigodSublabel");
  const clickDemigodUpgradeCount = document.getElementById("clickDemigodUpgradeCount");
  // Click God
  const clickGod = document.getElementById("clickGod");
  const clickGodLabel = clickGod?.querySelector(".style-label");
  const clickGodSublabel = document.getElementById("clickGodSublabel");
  const clickGodUpgradeCount = document.getElementById("clickGodUpgradeCount");

  // Prestige
  const prestige = document.getElementById("prestige");
  const prestigeLabel = prestige?.querySelector(".style-label");
  const prestigeSublabel = document.getElementById("prestigeSublabel");
  const prestigeUpgradeCount = document.getElementById("prestigeUpgradeCount");

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
  if (team) {
    team.classList.toggle("locked", !autoClickerUnlocked || score < teamCost || teamMaxed);
  }
  if (army) {
    army.classList.toggle("locked", !autoClickerUnlocked || score < armyCost || armyMaxed);
  }
  if (hacker) {
    hacker.classList.toggle("locked", !autoClickerUnlocked || score < hackerCost || hackerMaxed);
  }
  if (server) {
    server.classList.toggle("locked", !autoClickerUnlocked || score < serverCost || serverMaxed);
  }
  if (prestige) {
    prestige.classList.toggle("locked", !autoClickerUnlocked || score < prestigeCost);
  }
  if (dataCenter) {
    dataCenter.classList.toggle("locked", !autoClickerUnlocked || score < dataCenterCost || dataCenterMaxed);
  }
  if (automationLab) {
    automationLab.classList.toggle("locked", !autoClickerUnlocked || score < automationLabCost || automationLabMaxed);
  }
  if (cloudRegion) {
    cloudRegion.classList.toggle("locked", !autoClickerUnlocked || score < cloudRegionCost || cloudRegionMaxed);
  }
  if (superComputer) {
    superComputer.classList.toggle("locked", !autoClickerUnlocked || score < superComputerCost || superComputerMaxed);
  }
  if (quantumComputer) {
    quantumComputer.classList.toggle("locked", !autoClickerUnlocked || score < quantumComputerCost || quantumComputerMaxed);
  }
  if (unemployed) {
    unemployed.classList.toggle("locked", !autoClickerUnlocked || score < unemployedCost || unemployedMaxed);
  }

  if (clickAngel) {
    clickAngel.classList.toggle("locked", !autoClickerUnlocked || score < clickAngelCost || clickAngelMaxed);
  }

  if (clickArchangel) {
    clickArchangel.classList.toggle("locked", !autoClickerUnlocked || score < clickArchangelCost || clickArchangelMaxed);
  }

  if (clickDemigod) {
    clickDemigod.classList.toggle("locked", !autoClickerUnlocked || score < clickDemigodCost || clickDemigodMaxed);
  }

  if (clickGod) {
    clickGod.classList.toggle("locked", !autoClickerUnlocked || score < clickGodCost || clickGodMaxed);
  }

  // Show the current CPS inside the Upgrades menu.
  if (mouseLabel) {
    mouseLabel.textContent = `Current: ${formatCps(mouseCps)} CPS`;
  }
  // Show how many Low-End Mouse upgrades have been bought.
  if (mouseUpgradeCount) {
    mouseUpgradeCount.textContent = mouseLevel.toLocaleString();
  }
  // Show the cost and reward for the upgrade inside the Upgrades menu.
  if (mouseSublabel) {
    mouseSublabel.textContent = mouseMaxed
      ? `Maxed out at ${MOUSE_MAX_LEVEL} upgrades`
      : `Cost: ${mouseCost.toLocaleString()} Clicks | +${formatCps(mouseCpsGain)} CPS`;
  }

  if (servantLabel) {
    servantLabel.textContent = `Current: ${formatCps(servantCps)} CPS`;
  }
  if (servantUpgradeCount) {
    servantUpgradeCount.textContent = servantLevel.toLocaleString();
  }
  if (servantSublabel) {
    servantSublabel.textContent = servantMaxed
      ? `Maxed out at ${SERVANT_MAX_LEVEL} upgrades`
      : `Cost: ${servantCost.toLocaleString()} Clicks | +${formatCps(servantCpsGain)} CPS`;
  }

  if (robotLabel) {
    robotLabel.textContent = `Current: ${formatCps(robotCps)} CPS`;
  }
  if (robotUpgradeCount) {
    robotUpgradeCount.textContent = robotLevel.toLocaleString();
  }
  if (robotSublabel) {
    robotSublabel.textContent = robotMaxed
      ? `Maxed out at ${ROBOT_MAX_LEVEL} upgrades`
      : `Cost: ${robotCost.toLocaleString()} Clicks | +${formatCps(robotCpsGain)} CPS`;
  }

  if (teamLabel) {
    teamLabel.textContent = `Current: ${formatCps(teamCps)} CPS`;
  }
  if (teamUpgradeCount) {
    teamUpgradeCount.textContent = teamLevel.toLocaleString();
  }
  if (teamSublabel) {
    teamSublabel.textContent = teamMaxed
      ? `Maxed out at ${TEAM_MAX_LEVEL} upgrades`
      : `Cost: ${teamCost.toLocaleString()} Clicks | +${formatCps(teamCpsGain)} CPS`;
  }

  if (armyLabel) {
    armyLabel.textContent = `Current: ${formatCps(armyCps)} CPS`;
  }
  if (armyUpgradeCount) {
    armyUpgradeCount.textContent = armyLevel.toLocaleString();
  }
  if (armySublabel) {
    armySublabel.textContent = armyMaxed
      ? `Maxed out at ${ARMY_MAX_LEVEL} upgrades`
      : `Cost: ${armyCost.toLocaleString()} Clicks | +${formatCps(armyCpsGain)} CPS`;
  }

  if (hackerLabel) {
    hackerLabel.textContent = `Current: ${formatCps(hackerCps)} CPS`;
  }
  if (hackerUpgradeCount) {
    hackerUpgradeCount.textContent = hackerLevel.toLocaleString();
  }
  if (hackerSublabel) {
    hackerSublabel.textContent = hackerMaxed
      ? `Maxed out at ${HACKER_MAX_LEVEL} upgrades`
      : `Cost: ${hackerCost.toLocaleString()} Clicks | +${formatCps(hackerCpsGain)} CPS`;
  }

  if (serverLabel) {
    serverLabel.textContent = `Current: ${formatCps(serverCps)} CPS`;
  }
  if (serverUpgradeCount) {
    serverUpgradeCount.textContent = serverLevel.toLocaleString();
  }
  if (serverSublabel) {
    serverSublabel.textContent = serverMaxed
      ? `Maxed out at ${SERVER_MAX_LEVEL} upgrades`
      : `Cost: ${serverCost.toLocaleString()} Clicks | +${formatCps(serverCpsGain)} CPS`;
  }

  if (dataCenterLabel) {
    dataCenterLabel.textContent = `Current: ${formatCps(dataCenterCps)} CPS`;
  }
  if (dataCenterUpgradeCount) {
    dataCenterUpgradeCount.textContent = dataCenterLevel.toLocaleString();
  }
  if (dataCenterSublabel) {
    dataCenterSublabel.textContent = dataCenterMaxed
      ? `Maxed out at ${DATA_CENTER_MAX_LEVEL} upgrades`
      : `Cost: ${dataCenterCost.toLocaleString()} Clicks | +${formatCps(dataCenterCpsGain)} CPS`;
  }

  if (automationLabLabel) {
    automationLabLabel.textContent = `Current: ${formatCps(automationLabCps)} CPS`;
  }
  if (automationLabUpgradeCount) {
    automationLabUpgradeCount.textContent = automationLabLevel.toLocaleString();
  }
  if (automationLabSublabel) {
    automationLabSublabel.textContent = automationLabMaxed
      ? `Maxed out at ${AUTOMATION_LAB_MAX_LEVEL} upgrades`
      : `Cost: ${automationLabCost.toLocaleString()} Clicks | +${formatCps(automationLabCpsGain)} CPS`;
  }

  if (cloudRegionLabel) {
    cloudRegionLabel.textContent = `Current: ${formatCps(cloudRegionCps)} CPS`;
  }
  if (cloudRegionUpgradeCount) {
    cloudRegionUpgradeCount.textContent = cloudRegionLevel.toLocaleString();
  }
  if (cloudRegionSublabel) {
    cloudRegionSublabel.textContent = cloudRegionMaxed
      ? `Maxed out at ${CLOUD_REGION_MAX_LEVEL} upgrades`
      : `Cost: ${cloudRegionCost.toLocaleString()} Clicks | +${formatCps(cloudRegionCpsGain)} CPS`;
  }

  if (superComputerLabel) {
    superComputerLabel.textContent = `Current: ${formatCps(superComputerCps)} CPS`;
  }
  if (superComputerSublabel) {
    superComputerSublabel.textContent = superComputerMaxed
      ? `Maxed out at ${SUPER_COMPUTER_MAX_LEVEL} upgrades`
      : `Cost: ${superComputerCost.toLocaleString()} Clicks | +${formatCps(superComputerCpsGain)} CPS`;
  }
  if (superComputerUpgradeCount) {
    superComputerUpgradeCount.textContent = superComputerLevel.toLocaleString();
  }

  if (quantumComputerLabel) {
    quantumComputerLabel.textContent = `Current: ${formatCps(quantumComputerCps)} CPS`;
  }
  if (quantumComputerSublabel) {
    quantumComputerSublabel.textContent = quantumComputerMaxed
      ? `Maxed out at ${QUANTUM_COMPUTER_MAX_LEVEL} upgrades`
      : `Cost: ${quantumComputerCost.toLocaleString()} Clicks | +${formatCps(quantumComputerCpsGain)} CPS`;
  }
  if (quantumComputerUpgradeCount) {
    quantumComputerUpgradeCount.textContent = quantumComputerLevel.toLocaleString();
  }

  if (unemployedLabel) {
    unemployedLabel.textContent = `Current: ${formatCps(unemployedCps)} CPS`;
  }
  if (unemployedSublabel) {
    unemployedSublabel.textContent = unemployedMaxed
      ? `Maxed out at ${UNEMPLOYED_MAX_LEVEL} upgrades`
      : `Cost: ${unemployedCost.toLocaleString()} Clicks | +${formatCps(unemployedCpsGain)} CPS`;
  }
  if (unemployedUpgradeCount) {
    unemployedUpgradeCount.textContent = unemployedLevel.toLocaleString();
  }

  if (clickAngelLabel) {
    clickAngelLabel.textContent = `Current: ${formatCps(clickAngelCps)} CPS`;
  }
  if (clickAngelSublabel) {
    clickAngelSublabel.textContent = clickAngelMaxed
      ? `Maxed out at ${CLICK_ANGEL_MAX_LEVEL} upgrades`
      : `Cost: ${clickAngelCost.toLocaleString()} Clicks | +${formatCps(clickAngelCpsGain)} CPS`;
  }
  if (clickAngelUpgradeCount) {
    clickAngelUpgradeCount.textContent = clickAngelLevel.toLocaleString();
  }

  if (clickArchangelLabel) {
    clickArchangelLabel.textContent = `Current: ${formatCps(clickArchangelCps)} CPS`;
  }
  if (clickArchangelSublabel) {
    clickArchangelSublabel.textContent = clickArchangelMaxed
      ? `Maxed out at ${CLICK_ARCHANGEL_MAX_LEVEL} upgrades`
      : `Cost: ${clickArchangelCost.toLocaleString()} Clicks | +${formatCps(clickArchangelCpsGain)} CPS`;
  }
  if (clickArchangelUpgradeCount) {
    clickArchangelUpgradeCount.textContent = clickArchangelLevel.toLocaleString();
  }

  if (clickDemigodLabel) {
    clickDemigodLabel.textContent = `Current: ${formatCps(clickDemigodCps)} CPS`;
  }
  if (clickDemigodSublabel) {
    clickDemigodSublabel.textContent = clickDemigodMaxed
      ? `Maxed out at ${CLICK_DEMIGOD_MAX_LEVEL} upgrades`
      : `Cost: ${clickDemigodCost.toLocaleString()} Clicks | +${formatCps(clickDemigodCpsGain)} CPS`;
  }
  if (clickDemigodUpgradeCount) {
    clickDemigodUpgradeCount.textContent = clickDemigodLevel.toLocaleString();
  }

  if (clickGodLabel) {
    clickGodLabel.textContent = `Current: ${formatCps(clickGodCps)} CPS`;
  }
  if (clickGodSublabel) {
    clickGodSublabel.textContent = clickGodMaxed
      ? `Maxed out at ${CLICK_GOD_MAX_LEVEL} upgrades`
      : `Cost: ${clickGodCost.toLocaleString()} Clicks | +${formatCps(clickGodCpsGain)} CPS`;
  }
  if (clickGodUpgradeCount) {
    clickGodUpgradeCount.textContent = clickGodLevel.toLocaleString();
  }

  if (prestigeLabel) {
    prestigeLabel.textContent = `Current: x${formatCps(prestigeMultiplier)} CPS multiplier`;
  }
  if (prestigeUpgradeCount) {
    prestigeUpgradeCount.textContent = prestigeCount.toLocaleString();
  }
  if (prestigeSublabel) {
    prestigeSublabel.textContent = `Cost: ${prestigeCost.toLocaleString()} Clicks | x${PRESTIGE_CPS_BOOST_MULTIPLIER} CPS to all upgrades`;
  }
};

const updateUnlockedStyles = () => {
  const score = getScore();

  Object.values(NAME_STYLES).forEach((style) => {
    const card = document.getElementById(style.id);
    const sublabel = document.getElementById(style.id.replace("StyleBtn", "Sublabel"));
    if (!card || !sublabel) return;

    const isUnlocked = score >= style.unlock;
    card.classList.toggle("locked", !isUnlocked);

    if (style.unlock === 0) {
      sublabel.textContent = "Always unlocked";
    } else if (isUnlocked) {
      sublabel.textContent = `Unlocked at ${style.unlock.toLocaleString()}`;
    } else {
      sublabel.textContent = `🔒 Unlock at ${style.unlock.toLocaleString()}`;
    }
  });
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
const prestigeModal = document.getElementById("prestigeModal");
onClick("prestigeBtn", () => prestigeModal.style.display = "block");
onClick("prestigeClose", () => prestigeModal.style.display = "none");

// Upgrades [Mouse, Servant, Robot]
onClick("mouse", buyMouseUpgrade);
onClick("servant", buyServantUpgrade);
onClick("robot", buyRobotUpgrade);
onClick("team", buyTeamUpgrade);
onClick("army", buyArmyUpgrade);
onClick("hacker", buyHackerUpgrade);
onClick("server", buyServerUpgrade);
onClick("dataCenter", buyDataCenterUpgrade);
onClick("automationLab", buyAutomationLabUpgrade);
onClick("cloudRegion", buyCloudRegionUpgrade);
onClick("superComputer", buySuperComputerUpgrade);
onClick("quantumComputer", buyQuantumComputerUpgrade);
onClick("unemployed", buyUnemployedUpgrade);
onClick("clickAngel", buyClickAngelUpgrade);
onClick("clickArchangel", buyClickArchangelUpgrade);
onClick("clickDemigod", buyClickDemigodUpgrade);
onClick("clickGod", buyClickGodUpgrade);
onClick("prestige", buyPrestigeUpgrade);

// Customization modal
const customizationModal = document.getElementById("customizationModal");
onClick("customizationBtn", () => {
  updateUnlockedStyles();
  customizationModal.style.display = "block";
});
onClick("customizationClose", () => customizationModal.style.display = "none");

// Customization [NAME STYLES]
Object.entries(NAME_STYLES).forEach(([styleNum, style]) => {
  const card = document.getElementById(style.id);
  if (!card) return;

  onClick(style.id, () => {
    if (card.classList.contains("locked")) {
      return alert(`This style is locked! Reach ${style.unlock.toLocaleString()} points to unlock it.`);
    }

    Object.values(NAME_STYLES).forEach((candidate) => {
      document.getElementById(candidate.id)?.classList.remove("selected");
    });

    card.classList.add("selected");
    saveNameStyle(Number(styleNum));
  });
});

// Customization [BACKGROUND MUSIC]
const bgmusic = new Audio("../assets/Chill-prettyjohn1.mp3");
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

function showAchievements() {
  updateAchievementsTabUI();
  updateUnlockedAchievements(getScore());
  refreshAchievementsUI();
}

// Wire up buttons that exist on the current page.
if (typeof add === "function") onClick("clickBtn", add);
if (typeof save === "function") onClick("saveBtn", save);
if (typeof reset === "function") onClick("resetBtn", reset);
if (typeof showLeaderboard === "function") onClick("leaderboardBtn", () => showLeaderboard());
if (typeof unlockAutoClickerUpgrades === "function") onClick("autoclickerbuyBtn", unlockAutoClickerUpgrades);
if (typeof showAchievements === "function") onClick("achievementsBtn", () => showAchievements());
onClick("leaderboardClicksTab", () => showLeaderboard("clicks"));
onClick("achievementsClicksTab", () => showAchievements("clicks"));

// Settings modal
const settingsModal = document.getElementById("settingsModal");
document.getElementById("settingsBtn").addEventListener("click",   () => settingsModal.style.display = "block");
document.getElementById("settingsClose").addEventListener("click", () => settingsModal.style.display = "none");

// Leaderboard modal
const leaderboardModal = document.getElementById("leaderboardModal");
document.getElementById("leaderboardClose").addEventListener("click", () => leaderboardModal.style.display = "none");

// Achievements modal
const achievementsModal = document.getElementById("achievementsModal");
document.getElementById("achievementsBtn").addEventListener("click", () => achievementsModal.style.display = "block");
document.getElementById("achievementsClose").addEventListener("click", () => achievementsModal.style.display = "none");

window.addEventListener("click", (event) => {
  if (event.target === settingsModal)    settingsModal.style.display   = "none";
  if (event.target === leaderboardModal) leaderboardModal.style.display = "none";
  if (event.target === customizationModal) customizationModal.style.display = "none";
  if (event.target === achievementsModal) achievementsModal.style.display = "none";
});