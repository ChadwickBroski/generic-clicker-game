import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getCountFromServer, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyApp-f5tcN3v7nACEvRNV1jdI1E6iu9bT4",
  authDomain: "generic-clicker-game.firebaseapp.com",
  projectId: "generic-clicker-game",
  storageBucket: "generic-clicker-game.firebasestorage.app",
  messagingSenderId: "43436296491",
  appId: "1:43436296491:web:8c32c9578410806ef51d6e"
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
  1: { label: "First 100",  color: "white", bg: "purple" },
  // 🔴 MANUAL — set this in Firestore console
  2: { label: "Owner",      color: "white", bg: "black" },
  // 🔴 MANUAL — set this in Firestore console (needs Cloud Function to automate later)
  3: { label: "Former #1",  color: "white", bg: "#8B0000" },
  // 🟢 AUTOMATIC — shown for whoever is rank 1 when the leaderboard is opened
  4: { label: "Top Player", color: "white", bg: "royalblue" },
  // 🔴 MANUAL — set this in Firestore console (needs Cloud Function to automate later)
  5: { label: "Legend",     color: "white", bg: "gold" },
  // 🔴 MANUAL — set this in Firestore console
  6: { label: "Bug Finder", color: "white", bg: "green" },
  // 🔴 MANUAL — set this in Firestore console
  7: { label: "Ideator",    color: "white", bg: "beige" },
};

// Tags that are set manually and must never be overwritten by automatic logic
const MANUAL_TAGS = new Set([2, 3, 5, 6, 7]);

// Returns an HTML string for a single tag badge, or "" if no tag
function renderTag(tagNumber) {
  const tag = TAGS[tagNumber];
  if (!tag) return "";
  return `<span style="
    display:inline-block;
    font-size:11px;
    font-weight:700;
    font-family:'Nunito',sans-serif;
    padding:2px 8px;
    border-radius:20px;
    margin-left:8px;
    color:${tag.color};
    background:${tag.bg};
    border:1.5px solid ${tag.color};
    vertical-align:middle;
  ">${tag.label}</span>`;
}

// Sign in anonymously — gives every player a unique uid automatically
await signInAnonymously(auth);
const uid = auth.currentUser.uid;

// ── Local state ──
const informer = document.querySelector(".informer");
let number     = 0;
let playerName = "Anonymous";
let isNewPlayer = false;

// Show Loading... until we get the value from Firestore
document.getElementById("counter").innerHTML = "Loading...";

// Fetch this player's saved score and name from Firestore
const playerDoc = await getDoc(doc(db, "leaderboard", uid));
if (playerDoc.exists()) {
  const data = playerDoc.data();
  number     = data.score ?? 0;
  playerName = data.name  ?? "Anonymous";
} else {
  // Player has never saved before — flag them as new for First 100 check
  isNewPlayer = true;
}

document.getElementById("counter").innerHTML = number;
document.getElementById("playerNameInput").value = playerName;

// ── Save to localStorage (offline) and Firestore (leaderboard) ──
// merge:true ensures manual tags set in the Firestore console are never overwritten
async function save() {
  localStorage.setItem("value", number);

  const dataToSave = { name: playerName, score: number };

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

// ── Global leaderboard — reads top 3 from Firestore ──
async function showLeaderboard() {
  document.getElementById("name1").innerHTML  = "Loading...";
  document.getElementById("name2").innerHTML  = "Loading...";
  document.getElementById("name3").innerHTML  = "Loading...";
  document.getElementById("score1").innerHTML = "...";
  document.getElementById("score2").innerHTML = "...";
  document.getElementById("score3").innerHTML = "...";
  leaderboardModal.style.display = "block";

  const q = query(
    collection(db, "leaderboard"),
    orderBy("score", "desc"),
    limit(3)
  );

  const snapshot = await getDocs(q);
  const scoreSlots = ["score1", "score2", "score3"];
  const nameSlots  = ["name1",  "name2",  "name3"];

  snapshot.docs.forEach((docSnap, i) => {
    const { name, score, tag } = docSnap.data();

    // 🟢 AUTOMATIC: Top Player tag
    // Rank 1 always shows Top Player tag unless they have a manual tag.
    // Tags are non-stacked — only one tag is ever shown per player.
    let displayTag = tag;
    if (i === 0 && !MANUAL_TAGS.has(tag)) {
      displayTag = 4; // Top Player
    }

    document.getElementById(nameSlots[i]).innerHTML  = name + renderTag(displayTag);
    document.getElementById(scoreSlots[i]).innerHTML = score.toLocaleString();
  });

  // Fill any empty slots if fewer than 3 players exist yet
  for (let i = snapshot.docs.length; i < 3; i++) {
    document.getElementById(nameSlots[i]).innerHTML  = "—";
    document.getElementById(scoreSlots[i]).innerHTML = "—";
  }
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

// ── Wire up all buttons ──
document.getElementById("clickBtn").addEventListener("click", add);
document.getElementById("saveBtn").addEventListener("click", save);
document.getElementById("resetBtn").addEventListener("click", reset);
document.getElementById("leaderboardBtn").addEventListener("click", showLeaderboard);

// Settings modal
const settingsModal = document.getElementById("settingsModal");
document.getElementById("settingsBtn").addEventListener("click",   () => settingsModal.style.display = "block");
document.getElementById("settingsClose").addEventListener("click", () => settingsModal.style.display = "none");

// Leaderboard modal
const leaderboardModal = document.getElementById("leaderboardModal");
document.getElementById("leaderboardClose").addEventListener("click", () => leaderboardModal.style.display = "none");

// Close either modal when clicking the backdrop
window.addEventListener("click", (event) => {
  if (event.target === settingsModal)    settingsModal.style.display   = "none";
  
  if (event.target === leaderboardModal) leaderboardModal.style.display = "none";
});
