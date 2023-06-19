/* global api, projectUrl, lottie, bodymovin, shutdownAlert, auth2, loginFailed, loginError*/
const animContainer = document.getElementById("animContainer");
const safariBlocker = document.getElementById("safariBlocker");
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

document.addEventListener("DOMContentLoaded", () => {
  if (isSafari) {
    safariBlocker.classList.remove("hide");
  }
  if (document.location.protocol == "http:") {
    document.location.href = document.location.href.replace("http:", "https:");
    return;
  }
  let widthWidth = window.innerWidth;
  let heightWidth = (window.innerHeight / 9) * 16;
  if (widthWidth > heightWidth) {
    animContainer.style.width = `${widthWidth}px`;
    animContainer.style.height = `${(widthWidth / 16) * 9}px`;
  } else {
    animContainer.style.width = `${heightWidth}px`;
    animContainer.style.height = `${(heightWidth / 16) * 9}px`;
  }
  fetch(`${api}/auth/status`, {
    method: "GET",
    credentials: "include",
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.status == "Logined") {
        window.location.href = `${projectUrl}/game`;
      } else if (data.status == "Not registered") {
        window.location.href = `${projectUrl}/join`;
      }
    })
    .catch((error) => {
      alert(`Error occured.\n${error}`);
    });
});

/*const mouseMove = (e) => {
  lottie.pause();
  animContainer.getElementsByTagName('canvas')[0].style.marginRight = `${50 + (e.clientX - (window.innerWidth / 2)) / (window.innerWidth / 2) * 50}px`;
  animContainer.getElementsByTagName('canvas')[0].style.marginBottom = `${50 + (e.clientY - (window.innerHeight / 2)) / (window.innerHeight / 2) * 50}px`;
  lottie.play();
};*/

function handleCredentialResponse(authResult) {
  fetch(`${api}/auth/login`, {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({
      jwt: authResult,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.result == "success") {
        window.location.href = `${projectUrl}/game`;
      } else if (data.result == "failed") {
        if (data.error == "Not Whitelisted") {
          alert("You are not whitelisted.");
        } else {
          alert(loginFailed);
        }
      }
    })
    .catch((error) => {
      alert(`Error occured.\n${error}`);
    });
}
