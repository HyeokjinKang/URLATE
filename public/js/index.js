/* global api, projectUrl, loginFailed, loginError */
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// The game itself needs a Blink or Gecko engine and a real pointer, so there is
// nothing behind the sign-in for Safari or for a touch device. The page still
// reads -- only signing in is closed off, and the callback below refuses too, so
// One Tap cannot slip a session past the hidden button.
const canPlay = !isSafari && window.matchMedia("(pointer: fine)").matches;

// A 4xx/5xx response body isn't guaranteed to be JSON (a proxy's HTML error page,
// for example), so check the status before parsing to avoid a misleading error.
function readJson(res) {
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

document.addEventListener("DOMContentLoaded", () => {
  if (!canPlay) {
    document.querySelector(".plate__enter").classList.add("is-unsupported");
    document.getElementById("unsupportedNotice").classList.remove("hide");
  }

  fetch(`${api}/auth/status`, {
    method: "GET",
    credentials: "include",
  })
    .then(readJson)
    .then((data) => {
      if (data.status == "Logined") {
        window.location.href = `${projectUrl}/game`;
      } else if (data.status == "Not registered") {
        window.location.href = `${projectUrl}/join`;
      }
    })
    .catch((error) => {
      // A failed status check shouldn't block the page -- the login button still works.
      console.error(error);
    });
});

// If the GSI script is blocked or fails to load, the button never renders and the
// page looks unresponsive. The load event fires after async scripts, so the
// result is final by this point. Shown inline rather than via alert, since an ad
// blocker would trigger this on every visit and a popup each time is disruptive.
window.addEventListener("load", () => {
  if (!canPlay) return;
  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    console.error("Google Identity Services failed to load.");
    document.getElementById("loginNotice").classList.remove("hide");
  }
});

// eslint-disable-next-line no-unused-vars
function handleCredentialResponse(authResult) {
  // Reachable via One Tap even with the button hidden.
  if (!canPlay) return;

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
    .then(readJson)
    .then((data) => {
      if (data.result == "success") {
        window.location.href = `${projectUrl}/game`;
      } else {
        alert(loginFailed);
      }
    })
    .catch((error) => {
      // Show a translated message to the user; log the raw error for diagnostics.
      console.error(error);
      alert(loginError);
    });
}
