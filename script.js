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

// Get the modal
var modal = document.getElementById("settingsModal");

// Get the button that opens the modal
var btn = document.getElementById("settings");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the user clicks the button, open the modal 
btn.onclick = function() {
  modal.style.display = "block";
}

// When the user clicks on <span> (x), close the modal
span.onclick = function() {
  modal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}