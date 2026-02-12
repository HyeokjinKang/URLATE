/* global api, projectUrl, loginFailed */
const safariBlocker = document.getElementById("safariBlocker");
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

document.addEventListener("DOMContentLoaded", () => {
  if (isSafari) {
    safariBlocker.classList.remove("hide");
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

// eslint-disable-next-line no-unused-vars
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
