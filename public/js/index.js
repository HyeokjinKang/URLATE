/* global api, projectUrl, lang, loginFailed, loginError */
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const canPlay = !isSafari && window.matchMedia("(pointer: fine)").matches;

function readJson(res) {
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

function sizeSigninButton() {
  const slot = document.querySelector(".plate__enter");
  const button = document.querySelector(".g_id_signin");
  if (!slot || !button) return;
  const width = Math.max(200, Math.min(400, Math.floor(slot.clientWidth)));
  button.dataset.width = String(width);
}

sizeSigninButton();

const FEED_ORIGIN = "https://mirai.urlate.coupy.dev";
const FEED_LIMIT = 3;

function feedDate(iso) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const y = at.getUTCFullYear();
  const m = pad(at.getUTCMonth() + 1);
  const d = pad(at.getUTCDate());
  return { attr: `${y}-${m}-${d}`, text: `${y}.${m}.${d}` };
}

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
      console.error(error);
    });
});

const gsiLoaded = () =>
  !!(window.google && window.google.accounts && window.google.accounts.id);

function onGsiSettled() {
  if (gsiLoaded()) return;
  console.error("Google Identity Services failed to load.");
  if (canPlay) {
    document.getElementById("loginNotice").classList.remove("hide");
  }
}

function promptSignIn() {
  if (!canPlay || !gsiLoaded()) return;
  window.google.accounts.id.prompt();
}

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
      console.error(error);
      alert(loginError);
    });
}
