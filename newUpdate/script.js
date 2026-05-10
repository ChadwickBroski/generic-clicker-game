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

// Show Loading... until we get the value from Firestore
document.getElementById("counter").innerHTML = "Loading...";

// Fetch this player's saved score and name from Firestore
const playerDoc = await getDoc(doc(db, "leaderboard", uid));
if (playerDoc.exists()) {
  const data = playerDoc.data();
  number     = data.score     ?? 0;
  playerName = data.name      ?? "Anonymous";
  nameStyle  = getStoredNameStyle(data);
} else {
  // Player has never saved before — flag them as new for First 100 check
  isNewPlayer = true;
}

document.getElementById("counter").innerHTML = number;
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
  localStorage.setItem("value", number);

  const dataToSave = { name: playerName, score: number, ...getNameStyleSaveData(nameStyle) };

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
  document.getElementById("counter").innerHTML = number;
}

function reset() {
  if (confirm("Do you want to reset your progress? (Removes all of your progress)")) {
    number = 0;
    document.getElementById("counter").innerHTML = number;
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
  const counter = document.getElementById("counter");
  return Number(counter?.textContent.replace(/,/g, "")) || 0;
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

window.onload = updateUnlockedStyles;

// Wire up buttons that exist on the current page.
if (typeof add === "function") onClick("clickBtn", add);
if (typeof save === "function") onClick("saveBtn", save);
if (typeof reset === "function") onClick("resetBtn", reset);
if (typeof showLeaderboard === "function") onClick("leaderboardBtn", showLeaderboard);

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
const c418Audio = new Audio("music1.mp3"); // replace with your actual file path
c418Audio.loop = true;
let isC418Playing = false;

const music1Card = document.getElementById("music1Card");
const music2Card = document.getElementById("music2Card");
const music3Card = document.getElementById("music3Card");

onClick("music1Card", () => {
  if (isC418Playing) {
    c418Audio.pause();
    isC418Playing = false;
    music1Card.classList.remove("selected");
    document.getElementById("music1Label").textContent = "Off";
  } else {
    c418Audio.play();
    isC418Playing = true;
    music1Card.classList.add("selected");
    music2Card.classList.remove("selected");
    music3Card.classList.remove("selected");
    document.getElementById("music1Label").textContent = "Playing ▶";
    document.getElementById("music2Label").textContent = "Off";
    document.getElementById("music3Label").textContent = "Off";
  }
});


// ── Wire up all buttons ──
document.getElementById("clickBtn").addEventListener("click", add);
document.getElementById("saveBtn").addEventListener("click", save);
document.getElementById("resetBtn").addEventListener("click", reset);
document.getElementById("leaderboardBtn").addEventListener("click", showLeaderboard);
document.getElementById("customizationBtn").addEventListener('click', showCustomization)

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
