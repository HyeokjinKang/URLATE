/* global api, projectUrl, lang, loginFailed, loginError */
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

// GSI renders the button at one fixed pixel width and caps data-width at 400px,
// so a hard-coded value either falls short of the column or breaks out of it.
// Measured from the column instead, before the async GSI script has loaded --
// this file is parsed at the end of the body, so the element is already there.
function sizeSigninButton() {
  const slot = document.querySelector(".plate__enter");
  const button = document.querySelector(".g_id_signin");
  if (!slot || !button) return;
  // 200 is GSI's floor; below that it renders at 200 regardless and overflows.
  const width = Math.max(200, Math.min(400, Math.floor(slot.clientWidth)));
  button.dataset.width = String(width);
}

sizeSigninButton();

// Both rails are filled from the API rather than rendered with the page: the
// feeds are the one part of the fold that goes stale, and keeping them out of
// the HTML keeps the document cacheable.
const FEED_ORIGIN = "https://mirai.urlate.coupy.dev";
const FEED_LIMIT = 3;

// The API hands back an ISO instant. Rendered in UTC so the date under a title
// does not shift by a day depending on where the reader is.
function feedDate(iso) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const y = at.getUTCFullYear();
  const m = pad(at.getUTCMonth() + 1);
  const d = pad(at.getUTCDate());
  return { attr: `${y}-${m}-${d}`, text: `${y}.${m}.${d}` };
}

// Anything that ends up in an href is checked first: a bad or rewritten entry
// must not be able to put a `javascript:` URL behind a link on the page.
function feedUrl(raw) {
  try {
    const url = new URL(raw);
    return url.origin === FEED_ORIGIN ? url.href : null;
  } catch {
    return null;
  }
}

function feedRow(entry) {
  const url = feedUrl(entry.url);
  const date = feedDate(entry.date);
  if (!url || !date || typeof entry.title !== "string" || !entry.title) {
    return null;
  }

  const row = document.createElement("li");
  row.className = "feed__row";

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const time = document.createElement("time");
  time.className = "feed__date";
  time.dateTime = date.attr;
  time.textContent = date.text;

  const title = document.createElement("span");
  title.className = "feed__title";
  // textContent, not innerHTML -- the title is somebody else's copy.
  title.textContent = entry.title;

  link.append(time, title);
  row.append(link);
  return row;
}

function fillFeed(name) {
  const box = document.querySelector(`.feed__body[data-feed="${name}"]`);
  if (!box) return;
  const status = box.querySelector("[data-feed-status]");
  const list = box.querySelector("[data-feed-list]");
  const empty = box.querySelector("[data-feed-empty]");
  if (!status || !list || !empty) return;

  // The three states are exclusive: whichever one settles replaces the wait.
  const settle = (shown) => {
    status.classList.add("hide");
    shown.classList.remove("hide");
    box.setAttribute("aria-busy", "false");
  };

  fetch(`${api}/${name}/${lang}?limit=${FEED_LIMIT}`)
    .then(readJson)
    .then((body) => {
      if (body.result != "success" || !Array.isArray(body.data)) {
        throw new Error(`Unexpected ${name} response.`);
      }
      const rows = body.data.map(feedRow).filter(Boolean);
      if (!rows.length) {
        settle(empty);
        return;
      }
      list.append(...rows);
      settle(list);
    })
    .catch((error) => {
      // A rail that cannot load is not worth blocking the page over; say so in
      // its own space and leave the rest of the fold alone.
      console.error(error);
      settle(empty);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  if (!canPlay) {
    document.querySelector(".plate__enter").classList.add("is-unsupported");
    document.getElementById("unsupportedNotice").classList.remove("hide");
  }

  fillFeed("notices");
  fillFeed("posts");

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
