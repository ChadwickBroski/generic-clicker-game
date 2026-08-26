import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getCountFromServer, collection, query, orderBy, limit, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyApp-f5tcN3v7nACEvRNV1jdI1E6iu9bT4",
  authDomain: "generic-clicker-game.firebaseapp.com",
  projectId: "generic-clicker-game",
  storageBucket: "generic-clicker-game.firebasestorage.app",
  messagingSenderId: "43436296491",
  appId: "1:43436296491:web:8c32c9578410806ef51d6e",
  measurementId: "G-S6553DC8PN"
};

// ── Tags ──
const TAGS = {
  1: { label: "First 100",  color: "white", bg: "purple",    tooltip: "One of the first 100 players that have played this game" },
  2: { label: "Owner",      color: "white", bg: "black",     tooltip: "The owner of this game" },
  3: { label: "Former #1",  color: "white", bg: "#8B0000", tooltip: "Was #1 for over a week" },
  4: { label: "Top Player", color: "white", bg: "royalblue", tooltip: "Currently #1 on the leaderboard" },
  5: { label: "Legend",     color: "white", bg: "gold",      tooltip: "Was #1 for over a year" },
  6: { label: "Bug Finder", color: "white", bg: "green",     tooltip: "Reported a bug to the owner that has been fixed" },
  7: { label: "Ideator",    color: "white", bg: "green",     tooltip: "Contributed by giving an idea to the owner that is currently in the game" },
  8: {label: "Winner",      color: "white", bg: "white",     tooltip: "Won a contest hosted by the owner" }
};

// Tags that are set manually and must never be overwritten by automatic logic
const MANUAL_TAGS = new Set([3, 5, 6, 7]);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const params = new URLSearchParams(window.location.search);
const uid = params.get("uid");

function renderUsername(name, tagNumber) {
    const username = document.getElementById("username");
    if (!username) return;

    username.textContent = "";

    const nameElement = document.createElement("span");
    nameElement.innerHTML = `<i class="fa-solid fa-user"></i> ${name}`;
    username.appendChild(nameElement);

    const tagElement = createTagElement(tagNumber);
    if (tagElement) username.appendChild(tagElement);
}
function createTagElement(tagNumber) {
  if (tagNumber === null || tagNumber === undefined) return null;
  const tag = TAGS[tagNumber];
  if (!tag) return null;

  const tagElement = document.createElement("span");
  tagElement.className = "tag";
  tagElement.textContent = tag.label;
  tagElement.dataset.tooltip = tag.tooltip;
  tagElement.style.setProperty("--tag-bg", tag.bg);
  tagElement.style.setProperty("font-size", "35px");
  tagElement.style.setProperty("padding", "10px 23px");
  tagElement.style.setProperty("border-radius", "64px");
  //tagElement.id = "tag";
  return tagElement;
}

if (uid) {
  try {
    const userRef = doc(db, "leaderboard", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const userData = userSnap.data();

        console.log("User data:");
        console.log(userData);

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
        });

        const rank = players.findIndex(player => player.id === uid) + 1;
        const score = userData.scoreString;
        const prestige = userData.prestigeCount;
        const nameStyle = userData.nameStyles;
        //const tag = userData.tag;

        let fontSize = Math.max(1, Math.min(48, 60 - String(prestige).length * 1.15));
        document.getElementById("prestige").style.fontSize = `${fontSize}px`;
        document.getElementById("prestige").textContent = `x${prestige}`;

        fontSize = Math.max(1, Math.min(48, 60 - String(score).length * 1.15));
        document.getElementById("score").style.fontSize = `${fontSize}px`;
        document.getElementById("score").textContent = score;

        fontSize = Math.max(1, Math.min(48, 60 - String(rank).length * 1.15));
        document.getElementById("rank").style.fontSize = `${fontSize}px`;
        document.getElementById("rank").textContent = rank;
        document.getElementById("title").textContent = `Generic Clicker Game - ${userData.name}`;
        
        const usernameElement = document.getElementById("username");
        const allNameStyleClasses = [
            "name-style-default",
            "name-style-blue",
            "name-style-green",
            "name-style-gold",
            "name-style-purple",
            "name-style-cyan",
            "name-style-crimson",
            "name-style-crimson-fade",
            "name-style-silver",
            "name-style-emerald",
            "name-style-sapphire",
            "name-style-ruby",
            "name-style-amethyst",
            "name-style-plasma",
            "name-style-galaxy",
            "name-style-void",
            "name-style-rainbow",
            "name-style-solar-flare",
            "name-style-nebula",
            "name-style-cosmic",
            "name-style-celestial",
            "name-style-infinite",
            "name-style-gradient",
            "name-style-animated",
        ];

        allNameStyleClasses.forEach((styleClass) => usernameElement.classList.remove(styleClass));

        const styleMap = {
            1: "name-style-default",
            2: "name-style-blue",
            3: "name-style-green",
            4: "name-style-purple",
            5: "name-style-cyan",
            6: "name-style-crimson",
            7: "name-style-silver",
            8: "name-style-gold",
            9: "name-style-emerald",
            10: "name-style-sapphire",
            11: "name-style-ruby",
            12: "name-style-amethyst",
            13: "name-style-plasma",
            14: "name-style-galaxy",
            15: "name-style-void",
            16: "name-style-rainbow",
            17: "name-style-solar-flare",
            18: "name-style-nebula",
            19: "name-style-cosmic",
            20: "name-style-celestial",
            21: "name-style-infinite",
        };

        const styleClass = styleMap[nameStyle] || styleMap[1];
        usernameElement.classList.add(styleClass);

        const gradientStyles = new Set([7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
        if (gradientStyles.has(nameStyle)) {
            usernameElement.classList.add("name-style-gradient");
        }

        const animatedStyles = new Set([13, 14, 15, 16, 17, 18, 19, 20, 21]);
        if (animatedStyles.has(nameStyle)) {
            usernameElement.classList.add("name-style-animated");
        }
        //renderUsername(userData.name, userData.tag);
        renderUsername(userData.name);
        //const ownerTag = document.querySelector(".tag#tag");
        //console.log(ownerTag);
        //ownerTag.style.color = "white";
        //ownerTag.classList.remove("name-style-gradient");
        //ownerTag.style.color = "white";
        //console.log(ownerTag);

        const upgrades = [
            {
                name: "Low-End Mouse",
                image: "assets/lowEndMouse.png",
                amount: userData.mouseLevel,
            },
            {
                name: "Servant",
                image: "assets/servant.png",
                amount: userData.servantLevel,
            },
            {
                name: "Robot",
                image: "assets/robot.png",
                amount: userData.robotLevel,
            },
            {
                name: "Team",
                image: "assets/team.png",
                amount: userData.teamLevel,
            },
            {
                name: "Army",
                image: "assets/army.png",
                amount: userData.armyLevel,
            },
            {
                name: "Hacker",
                image: "assets/hacker.png",
                amount: userData.hackerLevel,
            },
            {
                name: "Server",
                image: "assets/server.png",
                amount: userData.serverLevel,
            },
            {
                name: "Data Center",
                image: "assets/dataCenter.png",
                amount: userData.dataCenterLevel,
            },
            {
                name: "Automation Lab",
                image: "assets/automationLab.png",
                amount: userData.automationLabLevel,
            },
            {
                name: "Cloud Region",
                image: "assets/cloudRegion.png",
                amount: userData.cloudRegionLevel ?? 0,
            },
            {
                name: "Super Computer",
                image: "assets/superComputer.png",
                amount: userData.superComputerLevel ?? 0,
            },
            {
                name: "Quantum Computer",
                image: "assets/quantumComputer.png",
                amount: userData.quantumComputerLevel ?? 0,
            },
            {
                name: "Unemployed",
                image: "assets/unemployed.png",
                amount: userData.unemployedLevel ?? 0,
            },
            {
                name: "Click Angel",
                image: "assets/clickAngel.png",
                amount: userData.clickAngelLevel ?? 0,
            },
            {
                name: "Click Archangel",
                image: "assets/clickArchangel.png",
                amount: userData.clickArchangelLevel ?? 0,
            },
            {
                name: "Click Demigod",
                image: "assets/clickDemigod.png",
                amount: userData.clickDemigodLevel ?? 0,
            },
            {
                name: "Click God",
                image: "assets/clickGod.png",
                amount: userData.clickGodLevel ?? 0,
            }
        ];

        const achievements = [
            {
                name: "First Click",
                image: "assets/mainLogo.png",
                achieved: userData.unlockedAchievements?.includes("firstClick") || false
            },
            {
                name: "Century",
                image: "assets/mainLogo.png",
                achieved: userData.unlockedAchievements?.includes("century") || false
            },
            {
                name: "Millennium",
                image: "assets/mainLogo.png",
                achieved: userData.unlockedAchievements?.includes("millennium") || false
            },
            {
                name: "Millionaire Club",
                image: "assets/mainLogo.png",
                achieved: userData.unlockedAchievements?.includes("millionaire") || false
            },
            {
                name: "Click Mogul",
                image: "assets/mainLogo.png",
                achieved: userData.unlockedAchievements?.includes("billionaire") || false
            },
            {
                name: "Melon Musk",
                image: "assets/mainLogo.png",
                achieved: userData.unlockedAchievements?.includes("trillionaire") || false
            },
            {
                name: "Chill Out",
                image: "assets/mainLogo.png",
                achieved: userData.unlockedAchievements?.includes("chillOut") || false
            },
            {
                name: "Click Printer go brr",
                image: "assets/mainLogo.png",
                achieved: userData.unlockedAchievements?.includes("clickPrinter") || false
            },
            {
                name: "Click button has left chat",
                image: "assets/mainLogo.png",
                achieved: userData.unlockedAchievements?.includes("clickButtonLeftChat") || false
            },
            {
                name: "Son Im crine😭😭",
                image: "assets/mainLogo.png",
                achieved: userData.unlockedAchievements?.includes("sonImCrine") || false
            },
            {
                name: "You can stop now",
                image: "assets/mainLogo.png",
                achieved: userData.unlockedAchievements?.includes("youCanStopNow") || false
            },
            {
                name: "Job Application",
                image: "assets/mainLogo.png",
                achieved: userData.unlockedAchievements?.includes("jobApplication") || false
            },
            {
                name: "Leave some for us ✌️",
                image: "assets/mainLogo.png",
                achieved: userData.unlockedAchievements?.includes("leaveSomeForUs") || false
            }
        ]

        const upgradesEl = document.getElementById("upgrades");
        const achievementsEl = document.getElementById("achievements");

        achievementsEl.innerHTML = achievements.map(achievement => `
            <div style="
                width:220px;
                border:2px solid black;
                border-radius:18px;
                padding:16px;
                box-shadow:4px 4px 0 0 black;
                flex-shrink:0;
            ">
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-bottom:12px;
                ">
                    <span style="font-size:20px;font-weight:700;">
                        ${achievement.name}
                    </span>

                    <span style="
                        padding:4px 10px;
                        font-weight:700;
                    ">
                        ${achievement.achieved ? `<i class="fas fa-circle-check" style="color:green;"></i>` : `<i class="fas fa-lock" style="color:red;"></i>`}
                    </span>
                </div>

                <div style="
                    display:flex;
                    justify-content:center;
                    margin-bottom:12px;
                ">
                    <img src="${achievement.image}"
                        style="width:80px;height:80px;object-fit:contain;">
                </div>
            </div>
        `).join("");

        upgradesEl.innerHTML = upgrades.map(upgrade => `
            <div style="
                width:220px;
                border:2px solid black;
                border-radius:18px;
                padding:16px;
                box-shadow:4px 4px 0 0 black;
                flex-shrink:0;
            ">
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-bottom:12px;
                ">
                    <span style="font-size:20px;font-weight:700;">
                        ${upgrade.name}
                    </span>

                    <span style="
                        padding:4px 10px;
                        font-weight:700;
                    ">
                        x${upgrade.amount}
                    </span>
                </div>

                <div style="
                    display:flex;
                    justify-content:center;
                    margin-bottom:12px;
                ">
                    <img src="${upgrade.image}"
                        style="width:80px;height:80px;object-fit:contain;">
                </div>
            </div>
        `).join("");
    } else {
        console.log("User not found");
    }
  } catch (error) {
    console.error(error);
  }
}
