/* global bodymovin, url */
const infoSecondText = document.getElementById("infoSecondText");
let lottieAnim = bodymovin.loadAnimation({
  wrapper: document.getElementById("animContainer"),
  animType: "canvas",
  loop: false,
  path: "/lottie/fail.json",
});

document.addEventListener("DOMContentLoaded", () => {
  setInterval(() => {
    infoSecondText.textContent = infoSecondText.textContent - 1;
    if (infoSecondText.textContent == 0) {
      window.location.href = `${url}/game?initialize=0`;
    }
  }, 1000);
});
