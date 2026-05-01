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

// Modal logic
var modal = document.getElementById("settingsModal");
var btn   = document.getElementById("settings");
var span  = document.getElementsByClassName("close")[0];

btn.onclick = function() {
  modal.classList.add("open");
}

span.onclick = function() {
  modal.classList.remove("open");
}

window.onclick = function(event) {
  if (event.target == modal) {
    modal.classList.remove("open");
  }
}