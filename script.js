const informer = document.querySelector(".informer");
let number = localStorage.getItem("value");

number = parseInt(number)
document.getElementById("counter").innerHTML = number;

function save() {
  localStorage.setItem("value", number);
  
  informer.classList.remove("fade-in-trigger", "fade-out-trigger");
  void informer.offsetWidth;
  informer.classList.add("fade-in-trigger");

  setTimeout(() => {
    informer.classList.remove("fade-in-trigger");
    void informer.offsetWidth; 
    informer.classList.add("fade-out-trigger");
  }, 1000);
}

function reset(){
  if (confirm("Do you want to reset your progress?(Removes all of your progress)")) {
    console.log("User chose OK");
    number = -1
    add()
  } else {
    console.log("User chose Cancel");
  }
};

const intervalId = setInterval(() => {
  if (number == localStorage.getItem("value")) {
    
  } else {
    save()
  }
}, 10000);

function add(){
  number = number+1;
  document.getElementById("counter").innerHTML = number;
};

// Settings modal
var settingsModal = document.getElementById("settingsModal");
var settingsBtn   = document.getElementById("settings");
var settingsClose = document.getElementById("settingsClose");

settingsBtn.onclick   = () => settingsModal.style.display = "block";
settingsClose.onclick = () => settingsModal.style.display = "none";

// Leaderboard modal
var leaderboardModal = document.getElementById("leaderboardModal");
var leaderboardClose = document.getElementById("leaderboardClose");

function showLeaderboard() {
  let scores = JSON.parse(localStorage.getItem("leaderboard") || "[0,0,0]");

  let score1 = document.getElementById("score1").innerHTML;
  let score2 = document.getElementById("score2").innerHTML;
  let score3 = document.getElementById("score3").innerHTML;
  leaderboardModal.style.display = "block";
  document.getElementById("score1").innerHTML = localStorage.getItem("firstPlace") || score1;
  document.getElementById("score2").innerHTML = localStorage.getItem("secondPlace") || score2;
  document.getElementById("score3").innerHTML = localStorage.getItem("thirdPlace") || score3;
}
setTimeout(() => {
  if (localStorage.getItem("value") > score1.innerHTML) {
      localStorage.setItem("firstPlace", localStorage.getItem("value"));
  } else if (localStorage.getItem("value") > score2.innerHTML) {
      localStorage.setItem("secondPlace", localStorage.getItem("value"));
  } else if (localStorage.getItem("value") > score3.innerHTML) {
      localStorage.setItem("thirdPlace", localStorage.getItem("value"));
  }
}, 1000);

leaderboardClose.onclick = () => leaderboardModal.style.display = "none";

// Close either modal when clicking outside
window.onclick = function(event) {
  if (event.target == settingsModal)    settingsModal.style.display   = "none";
  if (event.target == leaderboardModal) leaderboardModal.style.display = "none";
}

