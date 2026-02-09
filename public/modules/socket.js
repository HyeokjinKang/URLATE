/* global io, iziToast, game, api, lang, alias, socketi18n */
const body = document.querySelector("body");
let isErrorOccured = false;
let achievementCount = 0;
const socket = io(game, {
  withCredentials: true,
});

document.addEventListener("DOMContentLoaded", () => {
  const img = new Image();
  img.src = "/icons/medal-solid.svg";
  const div = document.createElement("div");
  div.id = "achievementsContainer";
  body.appendChild(div);
});

socket.on("connect", () => {
  console.log("[Socket.IO] Connected to server");
  if (isErrorOccured) {
    iziToast.success({
      title: "Connected",
      message: socketi18n.connected,
      timeout: 2000,
      layout: 2,
      transitionIn: "fadeInLeft",
    });
  }
});

socket.on("disconnect", (reason) => {
  if (reason === "io server disconnect") {
    alert(socketi18n.error);
    window.location.href = `${api}/auth/logout?redirect=true`; // Session error, need to relogin
  } else if (reason === "io client disconnect") return;
  console.error("[Socket.IO] Disconnected from server");
  iziToast.warning({
    title: "Disconnected",
    message: socketi18n.reconnecting,
    timeout: 2000,
    layout: 2,
    transitionIn: "fadeInLeft",
  });
  isErrorOccured = true;
});

socket.on("connect_error", () => {
  console.error("[Socket.IO] Cannot connect to server");
  iziToast.error({
    title: "Connection error",
    message: socketi18n.reconnecting,
    timeout: 2000,
    layout: 2,
    transitionIn: "fadeInLeft",
  });
  setTimeout(() => {
    socket.connect();
  }, 1000);
  isErrorOccured = true;
});

socket.on("connection:conflict", () => {
  socket.disconnect();
  alert(socketi18n.conflict);
  window.location.href = `${api}/auth/logout?redirect=true`;
});

socket.on("connection:unauthorized", () => {
  socket.disconnect();
  alert(socketi18n.unauthorized);
  window.location.href = `${api}/auth/logout?redirect=true`;
});

socket.on("achievement", (data) => {
  data = JSON.parse(data);
  console.log("[Socket.IO] Achievement");
  console.log(data);
  for (const achievement of data) {
    console.log(achievement.rewards);
    JSON.parse(achievement.rewards).forEach((reward) => {
      [...document.getElementsByClassName("achievementOverlay")].forEach((element, i) => {
        element.style.bottom = `${7 * (i + 1)}vh`;
      });
      const div = document.createElement("div");
      div.classList.add("achievementOverlay");
      document.getElementById("achievementsContainer").appendChild(div);
      document.getElementsByClassName("achievementOverlay")[achievementCount].innerHTML = `
        <div class="achievementInner">
          <div class="achievementInnerLeft">
            <div class="achievementMedal">
              <img src="/icons/medal-solid.svg" />
            </div>
            <div class="achievementContentVertical">
              <span class="achievementContentTitle">${achievement[`title_${lang}`]}</span>
              <span class="achievementContentDesc">${achievement[`detail_${lang}`]}</span>
            </div>
          </div>
          <div class="achievementLine"></div>
          <div class="achievementInnerRight">
            <span class="achievementRewardTitle">${socketi18n[reward[0]]}</span>
            <span class="achievementRewardDesc">${getReward(reward[0], reward[1])}</span>
          </div>
        </div>`;
      achievementCount++;
      setTimeout(() => {
        achievementCount--;
        document.getElementsByClassName("achievementOverlay")[0].remove();
      }, 4000);
    });
  }
});

const getReward = (type, id) => {
  if (type == "reward") return "-";
  if (type == "alias") return alias[id];
};
