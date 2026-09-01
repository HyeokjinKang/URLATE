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

const gsiLoaded = () =>
  !!(window.google && window.google.accounts && window.google.accounts.id);

function onGsiSettled() {
  // If the script is blocked or fails, the button never renders and the page
  // looks unresponsive. Shown inline rather than via alert, since an ad blocker
  // would trigger this on every visit and a popup each time is disruptive.
  if (gsiLoaded()) return;
  console.error("Google Identity Services failed to load.");
  if (canPlay) {
    document.getElementById("loginNotice").classList.remove("hide");
  }
}

// Asked for here rather than through data-auto_prompt. Left to GSI, the prompt
// opens as soon as the library loads -- including on Safari and on phones, where
// the button is hidden and the callback refuses, so a FedCM dialog was coming up
// in front of people who cannot sign in at all.
//
// On window load specifically, which is where GSI puts its own auto prompt. When
// its script lands while the page is still parsing it defers reading #g_id_onload
// to DOMContentLoaded, and until that runs there is no initialised client --
// prompt() would quietly call initialize() itself, with no config, and GSI would
// then initialise a second time with the real one.
function promptSignIn() {
  if (!canPlay || !gsiLoaded()) return;
  window.google.accounts.id.prompt();
}

// Two things have to have happened before either of those can decide anything:
// the async GSI script has to have settled, and the page has to have loaded --
// GSI reads #g_id_onload no later than DOMContentLoaded, and defers its own
// prompt to load. Whichever finishes second runs them, so the order the script
// and this file happen to execute in does not matter.
let gsiSettled = false;
let pageLoaded = document.readyState === "complete";

function settle() {
  if (!gsiSettled || !pageLoaded) return;
  onGsiSettled();
  promptSignIn();
}

const markGsiSettled = () => {
  gsiSettled = true;
  settle();
};

if (gsiLoaded()) {
  markGsiSettled();
} else {
  const gsiScript = document.querySelector(
    'script[src^="https://accounts.google.com/gsi/"]',
  );
  if (gsiScript) {
    gsiScript.addEventListener("load", markGsiSettled, { once: true });
    gsiScript.addEventListener("error", markGsiSettled, { once: true });
  }
  // A script element that is already done fires nothing, so load is the backstop.
  window.addEventListener("load", markGsiSettled, { once: true });
}

if (!pageLoaded) {
  window.addEventListener(
    "load",
    () => {
      pageLoaded = true;
      settle();
    },
    { once: true },
  );
}

settle();

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
