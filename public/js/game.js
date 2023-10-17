/* global intro1load:writable, api, url, Howl, cdn, bodymovin, Howler, confirmExit, pressAnywhere, enabled, registered, cancelSubscription, currency, purchased, addToBag, addedToBag, nothingHere, couponApplySuccess, couponUsed, inputEmpty, alreadySubscribed1, alreadySubscribed2, medalDesc, lang, Pace, lottie, couponInvalid1, couponInvalid2, count, bulletDensity, noteDensity, speed, advancedNeeded, DLCNeeded, notAvailable1, notAvailable2, advancedPreview1, advancedPreview2 */
const animContainer = document.getElementById("animContainer");
const langDetailSelector = document.getElementById("langDetailSelector");
const canvasResSelector = document.getElementById("canvasResSelector");
const albumResSelector = document.getElementById("albumResSelector");
const soundResSelector = document.getElementById("soundResSelector");
const comboSelector = document.getElementById("comboSelector");
const skinSelector = document.getElementById("skinSelector");
const volumeSongValue = document.getElementById("volumeSongValue");
const volumeHitValue = document.getElementById("volumeHitValue");
const volumeEftValue = document.getElementById("volumeEftValue");
const offsetButton = document.getElementById("offsetButton");
const sensitiveValue = document.getElementById("sensitiveValue");
const inputSizeValue = document.getElementById("inputSizeValue");
const offsetButtonText = document.getElementById("offsetButtonText");
const intro1video = document.getElementById("intro1video");
const warningContainer = document.getElementById("warningContainer");
const intro1container = document.getElementById("intro1container");
const warningInner = document.getElementById("warningInner");
const langSelector = document.getElementById("langSelector");
const registerBtn = document.getElementById("registerBtn");
const selectSongContainer = document.getElementById("selectSongContainer");
const trackModsText = document.getElementById("trackModsText");
const selectTitle = document.getElementById("selectTitle");
const overlayPaymentContainer = document.getElementById("overlayPaymentContainer");
const overlayCodeContainer = document.getElementById("overlayCodeContainer");
const overlayLoadingContainer = document.getElementById("overlayLoadingContainer");
const loadingCircle = document.getElementById("loadingCircle");
const DLCinfoDLCName = document.getElementById("DLCinfoDLCName");
const DLCinfoArtistName = document.getElementById("DLCinfoArtistName");
const DLCbasketButton = document.getElementById("DLCbasketButton");
const DLCinfoSongsContainer = document.getElementById("DLCinfoSongsContainer");
const SkinInfoSkinName = document.getElementById("SkininfoSkinName");
const skinInfoPreview = document.getElementById("skinInfoPreview");
const skinBasketButton = document.getElementById("skinBasketButton");
const basketsButtonContainer = document.getElementById("basketsButtonContainer");
const purchasingContainer = document.getElementById("purchasingContainer");
const goldMedal = document.getElementById("goldMedal");
const silverMedal = document.getElementById("silverMedal");
const checkMedal = document.getElementById("checkMedal");
const offsetNextCircle = document.getElementById("offsetNextCircle");
const offsetPrevCircle = document.getElementById("offsetPrevCircle");
const offsetTimingCircle = document.getElementById("offsetTimingCircle");
const offsetInputCircle = document.getElementById("offsetInputCircle");
const offsetOffsetCircle = document.getElementById("offsetOffsetCircle");
const offsetSpeedText = document.getElementById("offsetSpeedText");
const volumeOverlay = document.getElementById("volumeOverlay");
const codeInput = document.getElementById("codeInput");
const CPLTrack = document.getElementById("CPLTrack");

let settings = [];
let profileSong;
let display = -1;
let userid;
let username = "";
let picture;
let analyser, dataArray;
let canvas = document.getElementById("renderer");
let ctx = canvas.getContext("2d");
let loaded = 0;
let paceLoaded = 0;
let songSelection = -1;
let difficultySelection = 0;
let difficulties = [1, 5, 10];
let bulletDensities = [10, 50, 100];
let noteDensities = [10, 50, 100];
let ezCount = 0;
let midCount = 0;
let hardCount = 0;
let maxCount = 0;
let speeds = [1, 2, 3];
let bpm = 130;
let isRankOpened = false;
let isAdvanced = false;
let skins = [],
  DLCs = [];
let carts = new Set();
let cartArray = [];
let DLCdata = [];
let skinData = [];
let songData = [];
let loading = false;
let tutorial = false;
let aliasNum;
let ownedAlias;

let rate = 1;
let disableText = false;

let lottieAnim;
let arrowAnim;

let intro1skipped = 0;

let overlayTime = 0;
let shiftDown = false;

let offsetRate = 1;
let offset = 0;
let offsetInput = false;
let offsetPrevInput = false;
let offsetAverage = [];

let iniMode = -1;

let tracks;
let trackRecords = [];

let isOfficial = true;
const difficultyArray = ["EZ", "MID", "HARD"];
let UPLprev = -1;
let cplData;

let themeSong;
let songs = [];
let offsetSong = new Howl({
  src: [`${cdn}/tracks/offset.ogg`],
  format: ["ogg"],
  autoplay: false,
  loop: true,
});

let scrollTimer = 0;

let chartVar;

const lottieResize = () => {
  let widthWidth = window.innerWidth;
  let heightWidth = (window.innerHeight / 9) * 16;
  if (widthWidth > heightWidth) {
    animContainer.style.width = `${widthWidth}px`;
    animContainer.style.height = `${(widthWidth / 16) * 9}px`;
  } else {
    animContainer.style.width = `${heightWidth}px`;
    animContainer.style.height = `${(heightWidth / 16) * 9}px`;
  }
  let lottieCanvas = animContainer.getElementsByTagName("canvas")[0];
  widthWidth = window.innerWidth * window.devicePixelRatio;
  heightWidth = ((window.innerHeight * window.devicePixelRatio) / 9) * 16;
  if (lottieCanvas) {
    if (widthWidth > heightWidth) {
      lottieCanvas.width = widthWidth;
      lottieCanvas.height = (widthWidth / 16) * 9;
    } else {
      lottieCanvas.width = heightWidth;
      lottieCanvas.height = (heightWidth / 16) * 9;
    }
  }
  lottieAnim.destroy();
  lottieAnim = bodymovin.loadAnimation({
    wrapper: animContainer,
    animType: "canvas",
    loop: true,
    path: "lottie/game.json",
  });
  if (songSelection != -1) {
    arrowAnim.destroy();
    arrowAnim = bodymovin.loadAnimation({
      wrapper: document.getElementsByClassName("songSelectionLottie")[songSelection],
      animType: "canvas",
      loop: true,
      path: "lottie/arrow.json",
    });
  }
};

const initialize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  lottieResize();
};

const settingApply = () => {
  if (settings.general.detailLang == "original") {
    langDetailSelector.getElementsByTagName("option")[0].selected = true;
  } else if (settings.general.detailLang == "english") {
    langDetailSelector.getElementsByTagName("option")[1].selected = true;
  }
  if (settings.display.canvasRes == 100) {
    canvasResSelector.getElementsByTagName("option")[0].selected = true;
  } else if (settings.display.canvasRes == 75) {
    canvasResSelector.getElementsByTagName("option")[1].selected = true;
  } else if (settings.display.canvasRes == 50) {
    canvasResSelector.getElementsByTagName("option")[2].selected = true;
  } else if (settings.display.canvasRes == 25) {
    canvasResSelector.getElementsByTagName("option")[3].selected = true;
  }
  if (settings.display.albumRes == 100) {
    albumResSelector.getElementsByTagName("option")[0].selected = true;
  } else if (settings.display.albumRes == 75) {
    albumResSelector.getElementsByTagName("option")[1].selected = true;
  } else if (settings.display.albumRes == 50) {
    albumResSelector.getElementsByTagName("option")[2].selected = true;
  }
  if (settings.sound.res == "96kbps") {
    soundResSelector.getElementsByTagName("option")[0].selected = true;
  } else if (settings.sound.res == "128kbps") {
    soundResSelector.getElementsByTagName("option")[1].selected = true;
  } else if (settings.sound.res == "192kbps") {
    soundResSelector.getElementsByTagName("option")[2].selected = true;
  }
  if (settings.game.comboCount == 10) {
    comboSelector.getElementsByTagName("option")[0].selected = true;
  } else if (settings.game.comboCount == 25) {
    comboSelector.getElementsByTagName("option")[1].selected = true;
  } else if (settings.game.comboCount == 50) {
    comboSelector.getElementsByTagName("option")[2].selected = true;
  } else if (settings.game.comboCount == 100) {
    comboSelector.getElementsByTagName("option")[3].selected = true;
  } else if (settings.game.comboCount == 200) {
    comboSelector.getElementsByTagName("option")[4].selected = true;
  }
  for (let i = 0; i < skinSelector.getElementsByTagName("option").length; i++) {
    if (skinSelector.getElementsByTagName("option")[i].value == settings.game.skin) {
      skinSelector.getElementsByTagName("option")[i].selected = true;
      break;
    }
  }
  document.getElementById("wheelSelector").getElementsByTagName("option")[Number(settings.input.wheelReverse)].selected = true;
  document.getElementById("inputSelector").getElementsByTagName("option")[Number(settings.input.keys)].selected = true;
  for (let i = 0; i <= 1; i++) {
    document.getElementsByClassName("volumeMaster")[i].value = settings.sound.volume.master * 100;
    document.getElementsByClassName("volumeMasterValue")[i].textContent = Math.round(settings.sound.volume.music * 100) + "%";
  }
  document.getElementById("volumeSong").value = settings.sound.volume.music * 100;
  document.getElementById("volumeHit").value = settings.sound.volume.hitSound * 100;
  document.getElementById("inputSensitive").value = settings.input.sens * 100;
  document.getElementById("inputSize").value = settings.game.size * 10;
  document.getElementById("mouseCheck").checked = settings.input.mouse;
  document.getElementById("judgeSkin").checked = settings.game.judgeSkin;
  document.getElementById("judgePerfect").checked = settings.game.applyJudge.Perfect;
  document.getElementById("judgeGreat").checked = settings.game.applyJudge.Great;
  document.getElementById("judgeGood").checked = settings.game.applyJudge.Good;
  document.getElementById("judgeBad").checked = settings.game.applyJudge.Bad;
  document.getElementById("judgeMiss").checked = settings.game.applyJudge.Miss;
  // judgeBullet.checked = settings.game.applyJudge.Bullet;
  document.getElementById("frameCheck").checked = settings.game.counter;
  document.getElementById("ignoreCursorCheck").checked = settings.editor.denyCursor;
  document.getElementById("ignoreEditorCheck").checked = settings.editor.denySkin;
  document.getElementById("comboAlertCheck").checked = settings.game.comboAlert;
  volumeSongValue.textContent = Math.round(settings.sound.volume.music * 100) + "%";
  volumeHitValue.textContent = Math.round(settings.sound.volume.hitSound * 100) + "%";
  volumeEftValue.textContent = Math.round(settings.sound.volume.effect * 100) + "%";
  offsetButton.textContent = settings.sound.offset + "ms";
  sensitiveValue.textContent = settings.input.sens + "x";
  inputSizeValue.textContent = settings.game.size + "x";
  offset = settings.sound.offset;
  if (offset != 0) {
    offsetButtonText.textContent = offset + "ms";
  }
  initialize();
  profileSong = new Howl({
    src: [`${cdn}/tracks/128kbps/store.ogg`],
    format: ["ogg"],
    autoplay: false,
    loop: true,
    onload: () => {
      loaded++;
      profileSong.volume(0);
      profileSong.rate(1.5818181818);
      if (loaded == 4) {
        loaded = -1;
        gameLoaded();
      }
      Howler.volume(settings.sound.volume.master * settings.sound.volume.music);
      intro1video.volume = settings.sound.volume.master * settings.sound.volume.music;
    },
  });
  themeSong = new Howl({
    src: [`${cdn}/tracks/${settings.sound.res}/urlate.ogg`],
    format: ["ogg"],
    autoplay: false,
    loop: true,
    onload: () => {
      loaded++;
      if (loaded == 4) {
        loaded = -1;
        gameLoaded();
      }
      Howler.volume(settings.sound.volume.master * settings.sound.volume.music);
      intro1video.volume = settings.sound.volume.master * settings.sound.volume.music;
    },
  });
};

const drawBar = (x1, y1, x2, y2, width) => {
  let lineColor = "rgb(0, 0, 0)";
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
};

const animationLooper = () => {
  if (display == 1 || display == 6) {
    let wWidth = window.innerWidth;
    let wHeight = window.innerHeight;
    analyser.getByteFrequencyData(dataArray);
    let barWidth = wWidth / 300;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 300; i++) {
      let barHeight = (dataArray[i] * wHeight) / 1000;
      let x = barWidth * i;
      let y_end = barHeight / 1.3;
      drawBar(x, 0, x, y_end, barWidth - barWidth / 2, 1);
      x = wWidth - x;
      drawBar(x, wHeight, x, wHeight - y_end, barWidth - barWidth / 2, 1);
    }
  }
  requestAnimationFrame(animationLooper);
};

const sortAsName = (a, b) => {
  if (a.name.toLowerCase() == b.name.toLowerCase()) return 0;
  return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
};

const sortAsProducer = (a, b) => {
  if (a.producer.toLowerCase() == b.producer.toLowerCase()) return 0;
  return a.producer.toLowerCase() > b.producer.toLowerCase() ? 1 : -1;
};

const sortAsDifficulty = (a, b) => {
  a = JSON.parse(a.difficulty)[difficultySelection];
  b = JSON.parse(b.difficulty)[difficultySelection];
  if (a == b) return 0;
  return a > b ? 1 : -1;
};

const sortAsBPM = (a, b) => {
  if (a.bpm == b.bpm) return 0;
  return a.bpm > b.bpm ? 1 : -1;
};

const tutorialSkip = () => {
  if (confirm(confirmExit)) {
    document.getElementById("tutorialInformation").classList.remove("fadeInAnim");
    document.getElementById("tutorialInformation").classList.add("fadeOutAnim");
    setTimeout(() => {
      document.getElementById("tutorialInformation").classList.remove("fadeOutAnim");
      document.getElementById("tutorialInformation").style.display = "none";
    }, 500);
    fetch(`${api}/tutorial`, {
      method: "PUT",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.result != "success") {
          alert(`Error occured.\n${data.error}`);
        }
      })
      .catch((error) => {
        alert(`Error occured.\n${error}`);
        console.error(`Error occured.\n${error}`);
      });
    tutorial -= 2;
  }
};

const warningSkip = () => {
  if (display == -1) {
    warningContainer.style.opacity = "0";
    setTimeout(() => {
      warningContainer.style.display = "none";
      intro1video.play();
    }, 500);
    display = 0;
  }
};

const intro1skip = () => {
  intro1video.pause();
  if (!intro1skipped) {
    intro1skipped++;
    intro1container.style.opacity = "0";
    setTimeout(() => {
      intro1container.style.display = "none";
      loaded++;
      setTimeout(() => {
        if (loaded == 4) {
          loaded = -1;
          gameLoaded();
        }
      }, 1000);
    }, 500);
  }
};

intro1video.onended = () => {
  intro1skip();
};

document.addEventListener("DOMContentLoaded", () => {
  let initialize = new URLSearchParams(window.location.search).get("initialize");
  iniMode = initialize == null ? -1 : Number(initialize);
  history.pushState("someAwesomeState", null, null);
  let widthWidth = window.innerWidth;
  let heightWidth = (window.innerHeight / 9) * 16;
  if (widthWidth > heightWidth) {
    animContainer.style.width = `${widthWidth}px`;
    animContainer.style.height = `${(widthWidth / 16) * 9}px`;
  } else {
    animContainer.style.width = `${heightWidth}px`;
    animContainer.style.height = `${(heightWidth / 16) * 9}px`;
  }
  setTimeout(() => {
    warningInner.style.opacity = "1";
  }, 1000);
  setTimeout(() => {
    if (intro1load == 1) {
      document.getElementById("pressAnywhere").textContent = pressAnywhere;
      document.getElementById("warningContainer").onclick = warningSkip;
    }
    intro1load++;
    document.getElementById("pressAnywhere").style.opacity = "1";
    warningInner.style.borderBottom = "0.1vh solid #555";
  }, 3000);
  if (iniMode != -1) {
    //no intro
    loaded++;
    display = 0;
  } else {
    warningContainer.style.display = "flex";
    intro1container.style.display = "flex";
  }

  fetch(`${api}/notice/${lang}`, {
    method: "GET",
    credentials: "include",
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.result == "success") {
        data = data.data;
        document.getElementById("noticeText").textContent = `${new Date(data.date).toLocaleDateString()} | ${data[`title_${lang}`]}`;
        document.getElementById("noticeText").href = data[`url_${lang}`];
      }
    });

  lottieAnim = bodymovin.loadAnimation({
    wrapper: animContainer,
    animType: "canvas",
    loop: true,
    path: "lottie/game.json",
  });
  lottieAnim.addEventListener("DOMLoaded", () => {
    lottieResize();
  });
  lottie.setSpeed(0.5);
  fetch(`${api}/auth/status`, {
    method: "GET",
    credentials: "include",
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.status == "Not registered") {
        window.location.href = `${url}/join`;
      } else if (data.status == "Not logined") {
        window.location.href = url;
      } else if (data.status == "Shutdowned") {
        window.location.href = `${api}/auth/logout?redirect=true&shutdowned=true`;
      } else {
        fetch(`${api}/user`, {
          method: "GET",
          credentials: "include",
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.result == "success") {
              data = data.user;
              settings = JSON.parse(data.settings);
              username = data.nickname;
              userid = data.userid;
              tutorial = data.tutorial;
              picture = data.picture;
              document.getElementById("profilePic").src = picture;
              document.getElementById("name").textContent = username;
              document.getElementById("optionName").textContent = username;
              if (lang == "ko") {
                langSelector.getElementsByTagName("option")[0].selected = true;
              } else if (lang == "en") {
                langSelector.getElementsByTagName("option")[1].selected = true;
              }
              skins = JSON.parse(data.skins);
              for (let i = 0; i < skins.length; i++) {
                let option = document.createElement("option");
                option.appendChild(document.createTextNode(skins[i]));
                skinSelector.appendChild(option);
              }
              settingApply();
              fetch(`${api}/tracks`, {
                method: "GET",
                credentials: "include",
              })
                .then((res) => res.json())
                .then((data) => {
                  if (data.result == "success") {
                    tracks = data.tracks;
                    tracks.sort(sortAsName);
                    tracksUpdate();
                    Howler.volume(settings.sound.volume.master * settings.sound.volume.music);
                    intro1video.volume = settings.sound.volume.master * settings.sound.volume.music;
                  } else {
                    alert("Failed to load song list.");
                    console.error("Failed to load song list.");
                  }
                })
                .catch((error) => {
                  alert(`Error occured.\n${error}`);
                  console.error(`Error occured.\n${error}`);
                });
            } else {
              alert(`Error occured.\n${data.description}`);
            }
          })
          .catch((error) => {
            alert(`Error occured.\n${error}`);
            console.error(`Error occured.\n${error}`);
          });
      }
    })
    .catch((error) => {
      alert(`Error occured.\n${error}`);
      console.error(`Error occured.\n${error}`);
    });
});

const tracksUpdate = () => {
  let songList = "";
  for (let i = 0; i < tracks.length; i++) {
    if (tracks[i].type == 3) {
      songList += `<div class="songSelectionContainer songSelectionDisable">
        <div class="songSelectionLottie"></div>
        <div class="songSelectionInfo">
            <span class="songSelectionTitle"></span>
            <span class="songSelectionArtist"></span>
        </div>
        ${
          isOfficial
            ? `<div class="songSelectionRank">
            <span class="ranks rankQ"></span>
        </div>`
            : ``
        }
      </div>`;
      continue;
    }
    songs[i] = new Howl({
      src: [`${cdn}/tracks/preview/${tracks[i].fileName}.ogg`],
      format: ["ogg"],
      autoplay: false,
      loop: true,
    });
    songList += `<div class="songSelectionContainer" onclick="songSelected(${i})">
              <div class="songSelectionLottie"></div>
              <div class="songSelectionInfo">
                <div class="songSelectionTitle">
                  ${settings.general.detailLang == "original" ? tracks[i].originalName : tracks[i].name}
                  ${
                    tracks[i].type == 1
                      ? "<img src='/images/parts/graphicIcons/track_advanced.webp' class='songSelectionIcon'>"
                      : tracks[i].type == 2
                      ? "<img src='/images/parts/graphicIcons/track_dlc.webp' class='songSelectionIcon'>"
                      : ""
                  }
                </div>
                <span class="songSelectionArtist">${tracks[i].producer}</span>
              </div>
              ${
                isOfficial
                  ? `<div class="songSelectionRank">
                  <span class="ranks rankQ"></span>
              </div>`
                  : ``
              }
          </div>`;
    fetch(`${api}/record/${tracks[i].name}/${username}`, {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        trackRecords[i] = [];
        if (data.result == "success") {
          for (let j = 0; j < 3; j++) {
            if ((tracks[i].type == 1 && !isAdvanced) || (tracks[i].type == 2 && !(songData.indexOf(tracks[i].name) != -1))) {
              trackRecords[i][j] = {
                rank: "rankL",
                record: 0,
                medal: 0,
                maxcombo: 0,
              };
            } else {
              trackRecords[i][j] = {
                rank: "rankQ",
                record: 0,
                medal: 0,
                maxcombo: 0,
              };
            }
          }
          for (let j = 0; j < 3; j++) {
            if (data.results[j] != undefined) {
              let value = data.results[j];
              if (isOfficial) {
                document.getElementsByClassName("ranks")[i].className = "ranks";
                document.getElementsByClassName("ranks")[i].classList.add(`rank${value.rank}`);
              }
              trackRecords[i][value.difficulty - 1] = {
                rank: `rank${value.rank}`,
                record: value.record,
                medal: value.medal,
                maxcombo: value.maxcombo,
              };
            }
          }
        } else {
          for (let j = 0; j < 3; j++) {
            if ((tracks[i].type == 1 && !isAdvanced) || (tracks[i].type == 2 && !(songData.indexOf(tracks[i].name) != -1))) {
              if (isOfficial) {
                document.getElementsByClassName("ranks")[i].className = "ranks";
                document.getElementsByClassName("ranks")[i].classList.add("rankL");
              }
              document.getElementsByClassName("songSelectionInfo")[i].classList.add("locked");
              trackRecords[i][j] = {
                rank: "rankL",
                record: 0,
                medal: 0,
                maxcombo: 0,
              };
            } else {
              trackRecords[i][j] = {
                rank: "rankQ",
                record: 0,
                medal: 0,
                maxcombo: 0,
              };
            }
          }
        }
      })
      .catch((error) => {
        alert(`Error occured.\n${error}`);
        console.error(`Error occured.\n${error}`);
      });
  }
  selectSongContainer.innerHTML = songList;
};

const sortSelected = (n, isInitializing) => {
  localStorage.sort = n;
  let seek = songs[songSelection].seek();
  Array.prototype.forEach.call(document.getElementsByClassName("sortText"), (e) => {
    if (e.classList.contains("selected")) e.classList.remove("selected");
  });
  document.getElementsByClassName("sortText")[n].classList.add("selected");
  const sortArray = [sortAsName, sortAsProducer, sortAsDifficulty, sortAsBPM];
  if (songs[songSelection]) songs[songSelection].stop();
  const prevName = tracks[songSelection].fileName;
  tracks.sort(sortAsName);
  tracks.sort(sortArray[n]);
  tracksUpdate();
  const index = tracks.findIndex((obj) => obj.fileName == prevName);
  if (!isInitializing) songSelected(index, true, seek);
};

const songSelected = (n, refreshed, seek) => {
  loadingShow();
  if (songSelection == n && !refreshed) {
    //play
    if (JSON.parse(tracks[songSelection].difficulty)[difficultySelection] == 0 && isOfficial) {
      alert(`${notAvailable1}\n${notAvailable2}`);
    } else if (isOfficial) {
      localStorage.rate = rate;
      localStorage.disableText = disableText;
      localStorage.songNum = songSelection;
      localStorage.difficultySelection = difficultySelection;
      localStorage.difficulty = JSON.parse(tracks[songSelection].difficulty)[difficultySelection];
      localStorage.songName = tracks[songSelection].fileName;
      localStorage.record = trackRecords[songSelection][difficultySelection].record;
      window.location.href = `${url}/play`;
    } else {
      display = 14;
      document.getElementById("CPLContainer").style.display = "flex";
      document.getElementById("CPLContainer").classList.add("fadeInAnim");
    }
    loadingHide();
    return;
  }
  disableText = false;
  rate = 1;
  document.getElementById("trackModsRate").value = "1.0";
  trackModsText.textContent = "No";
  trackModsText.classList.remove("enabled");
  if (!(songSelection == -1 && tracks[n].name == "URLATE Theme")) {
    document.getElementById("songNameText").textContent = settings.general.detailLang == "original" ? tracks[n].originalName : tracks[n].name;
    if (songs[n]) songs[n].volume(1);
    if (songSelection != -1 && !refreshed) {
      let i = songSelection;
      songs[i].fade(1, 0, 200);
      setTimeout(() => {
        songs[i].stop();
      }, 200);
    }
    if (themeSong.playing()) {
      themeSong.fade(1, 0, 500);
      setTimeout(() => {
        themeSong.stop();
      }, 500);
    }
    if (songs[n]) {
      songs[n].play();
      if (seek) songs[n].seek(seek);
    }
  }
  if (document.getElementsByClassName("songSelected")[0]) {
    arrowAnim.destroy();
    document.getElementsByClassName("songSelected")[0].classList.remove("songSelected");
  }
  arrowAnim = bodymovin.loadAnimation({
    wrapper: document.getElementsByClassName("songSelectionContainer")[n].getElementsByClassName("songSelectionLottie")[0],
    animType: "canvas",
    loop: true,
    path: "lottie/arrow.json",
  });
  document.getElementsByClassName("songSelectionContainer")[n].classList.add("songSelected");
  selectTitle.textContent = settings.general.detailLang == "original" ? tracks[n].originalName : tracks[n].name;
  CPLTrack.textContent = settings.general.detailLang == "original" ? tracks[n].originalName : tracks[n].name;
  let fontSize = 5;
  selectTitle.style.fontSize = `5vh`;
  while (selectTitle.offsetWidth > window.innerWidth / 4) {
    selectTitle.style.fontSize = `${fontSize}vh`;
    fontSize -= 0.5;
  }
  document.getElementById("selectArtist").textContent = tracks[n].producer;
  document.getElementById("selectAlbum").src = `${cdn}/albums/${settings.display.albumRes}/${tracks[n].fileName}.webp`;
  document.getElementById("CPLAlbum").src = `${cdn}/albums/${settings.display.albumRes}/${tracks[n].fileName}.webp`;
  if (isOfficial) {
    for (let i = 0; i <= 2; i++) {
      document.getElementsByClassName("difficultyNumber")[i].textContent = JSON.parse(tracks[n].difficulty)[i];
    }
  }
  document.getElementById("selectBackground").style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${tracks[n].fileName}.webp")`;
  setTimeout(
    () => {
      let underLimit = window.innerHeight * 0.09 * (n + 1);
      underLimit = parseInt(underLimit);
      if (selectSongContainer.offsetHeight + selectSongContainer.scrollTop < underLimit) {
        selectSongContainer.scrollTop = underLimit - selectSongContainer.offsetHeight;
      } else if (underLimit - window.innerHeight * 0.09 < selectSongContainer.scrollTop) {
        selectSongContainer.scrollTop = selectSongContainer.scrollTop - (selectSongContainer.scrollTop - underLimit) - window.innerHeight * 0.09;
      }
    },
    songSelection != -1 ? 0 : 200
  );
  if (songSelection != -1 && isOfficial) {
    document.getElementsByClassName("ranks")[songSelection].className = "ranks";
    if (trackRecords[songSelection][2].rank != "rankQ") {
      document.getElementsByClassName("ranks")[songSelection].classList.add(trackRecords[songSelection][2].rank);
    } else if (trackRecords[songSelection][1].rank != "rankQ") {
      document.getElementsByClassName("ranks")[songSelection].classList.add(trackRecords[songSelection][1].rank);
    } else {
      document.getElementsByClassName("ranks")[songSelection].classList.add(trackRecords[songSelection][0].rank);
    }
  }
  if (isOfficial) {
    fetch(`${api}/trackInfo/${tracks[n].name}`, {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        data = data.info[0];
        difficulties = JSON.parse(tracks[n].difficulty);
        bulletDensities = JSON.parse(data.bullet_density);
        noteDensities = JSON.parse(data.note_density);
        speeds = JSON.parse(data.speed);
        bpm = data.bpm;
        updateDetails(n);
      });
  } else {
    fetch(`${api}/CPLtrackInfo/${tracks[n].name}`, {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        data = data.info;
        ezCount = 0;
        midCount = 0;
        hardCount = 0;
        if (data) {
          data.forEach((e) => {
            if (e.difficulty == 0) ezCount++;
            else if (e.analyzed == 1) midCount++;
            else hardCount++;
          });
        }
        maxCount = ezCount + midCount + hardCount;
        bpm = tracks[songSelection].bpm;
        updateDetails(n);
      });
  }
  songSelection = n;
  updateRanks();
};

const textDisabled = () => {
  disableText = !disableText;
  if (disableText) {
    trackModsText.textContent = "Yes";
    trackModsText.classList.add("enabled");
  } else {
    trackModsText.textContent = "No";
    trackModsText.classList.remove("enabled");
  }
};

const rateChanged = (e) => {
  e.value = Number(e.value).toFixed(1);
  if (e.value > 2) {
    e.value = 2;
  } else if (e.value < 0.5) {
    e.value = 0.5;
  }
  rate = Number(e.value);
};

const updateRanks = () => {
  fetch(`${api}/${isOfficial ? "records" : "CPLrecords"}/${tracks[songSelection].name}/${difficultySelection + 1}/record/DESC/${username}`, {
    method: "GET",
    credentials: "include",
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.rank != 0) {
        document.getElementById("selectRank").textContent = `#${data.rank}`;
      } else {
        document.getElementById("selectRank").textContent = "-";
      }
      data = data.results;
      let innerContent = "";
      let prevScore = -1;
      let rankMinus = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i].record == prevScore) {
          rankMinus++;
        } else {
          rankMinus = 0;
        }
        innerContent += `<br>
                        <div class="selectRank">
                          <div class="selectRankNumber">${i + 1 - rankMinus}</div>
                          <div class="selectRankName">${data[i].nickname}</div>
                          <div class="selectRankScore">${numberWithCommas(Number(data[i].record))}</div>
                      </div>`;
        prevScore = data[i].record;
      }
      loadingHide();
      document.getElementById("selectRankScoreContainer").innerHTML = innerContent;
    });
};

const updatePatterns = () => {
  loadingShow();
  fetch(`${api}/CPLpatternList/${tracks[songSelection].name}/${difficultySelection}`, {
    method: "GET",
    credentials: "include",
  })
    .then((res) => res.json())
    .then((data) => {
      data = data.data;
      cplData = data;
      let elements = "";
      let i = 0;
      data.forEach((e) => {
        elements += `<div class="CPLList" onclick="UPLSelected(${i})">
                        <div class="CPLListTop">
                          <div class="CPLListLeft">${e.patternName}<span class="CPLAuthor"> - ${e.author}</span></div>
                          <div class="CPLListRight">
                            <div class="CPLListRightDifficulty">${difficultyArray[e.difficulty]}<span class="CPLDifficulty">${e.analyzed}</span></div>
                            <div class="CPLListRightDifficulty">${difficultyArray[e.difficulty]}<span class="CPLDifficulty">${e.community}</span></div>
                            <div class="CPLListRightStar">★${e.star}</div>
                          </div>
                        </div>
                        <div class="CPLListBottom">
                          <div class="CPLListLeft">
                            <img src="https://img.icons8.com/material-rounded/96/000000/quote-left.png" class="CPLQuoteIcon">
                            <span class="CPLQuote">${e.description}</span>
                          </div>
                          <div class="CPLListRight">
                            <span class="CPLRankButton"><img class="CPLIcon" src="/images/parts/icons/charts.svg"></span>
                            <span class="CPLPlayButton" onclick="UPLPlay(${i})">PLAY <img class="CPLIcon margin" src="/images/parts/icons/play.svg"></span>
                          </div>
                        </div>
                      </div>`;
        i++;
      });
      document.getElementById("CPLListContainer").innerHTML = elements;
      loadingHide();
    });
};

const UPLSelected = (n) => {
  if (UPLprev == n) {
    document.getElementsByClassName("CPLList")[n].classList.remove("selected");
    document.getElementsByClassName("CPLListBottom")[n].classList.remove("selected");
    UPLprev = -1;
    return;
  } else {
    if (document.getElementsByClassName("CPLList")[UPLprev]) {
      document.getElementsByClassName("CPLList")[UPLprev].classList.remove("selected");
      document.getElementsByClassName("CPLListBottom")[UPLprev].classList.remove("selected");
    }
    document.getElementsByClassName("CPLList")[n].classList.add("selected");
    document.getElementsByClassName("CPLListBottom")[n].classList.add("selected");
  }
  UPLprev = n;
};

const UPLPlay = (n) => {
  localStorage.rate = 1;
  localStorage.disableText = false;
  localStorage.songNum = songSelection;
  localStorage.difficultySelection = difficultySelection;
  localStorage.difficulty = cplData[n].community;
  localStorage.patternId = cplData[n].id;
  localStorage.songName = tracks[songSelection].fileName;
  window.location.href = `${url}/play`;
};

const medalDescription = () => {
  alert(medalDesc);
};

const numberWithCommas = (x) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const gameLoaded = () => {
  if (iniMode == 1) {
    if (localStorage.songNum) {
      let songNum = Number(localStorage.songNum);
      songSelection = songNum;
      difficultySelected(Number(localStorage.difficultySelection ? localStorage.difficultySelection : 0), true);
      sortSelected(Number(localStorage.sort ? localStorage.sort : 0), true);
      songSelected(songNum, true);
    }
    menuSelected(0);
  } else if (iniMode == 2) {
    //dev purpose
    menuSelected(3);
    themeSong.play();
  } else if (iniMode == 3) {
    //dev purpose
    profileScreen();
    themeSong.play();
  } else if (display == 0 && songSelection == -1) {
    themeSong.play();
  }
  setTimeout(() => {
    profileSong.rate(1.5818181818);
    profileSong.play();
  }, 1400);
  document.getElementById("menuContainer").style.display = "flex";
  document.getElementById("loadingContainer").classList.add("fadeOutAnim");
  localStorage.clear("songName");
  localStorage.clear("difficulty");
  setTimeout(() => {
    if (tutorial >= 3) {
      document.getElementById("tutorialInformation").style.display = "flex";
      document.getElementById("tutorialInformation").classList.add("fadeInAnim");
    }
  }, 300);
  setTimeout(() => {
    document.getElementById("loadingContainer").style.display = "none";
    document.getElementById("menuContainer").classList.add("loaded");
    document.getElementById("urlateText").style.fontSize = "1.5vh";
    document.getElementById("urlateText").style.marginBottom = "0";
    document.getElementById("songName").style.fontSize = "3vh";
    document.getElementById("header").classList.add("fadeInAnim");
    setTimeout(() => {
      let backIcons = document.getElementsByClassName("backIcon");
      for (let i = 0; i < backIcons.length; i++) {
        backIcons[i].classList.add("show");
      }
      document.getElementById("songName").classList.add("fadeInAnim");
    });
    document.getElementById("footerLeft").classList.add("fadeInAnim");
  }, 500);
  analyser = Howler.ctx.createAnalyser();
  Howler.masterGain.connect(analyser);
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  animationLooper();
  tracks.forEach((e) => {
    const img = new Image();
    img.src = `${cdn}/albums/${settings.display.albumRes}/${e.fileName}.webp`;
  });
};

Pace.on("done", () => {
  const nameStyle = window.getComputedStyle(document.getElementById("name"), null);
  const nameWidth = parseFloat(nameStyle.getPropertyValue("width"));
  if (nameWidth > 265) {
    document.getElementById("name").style.fontSize = "2.2vh";
    document.getElementById("name").style.paddingLeft = "2.5vw";
  } else if (nameWidth > 200) {
    document.getElementById("name").style.fontSize = "2.3vh";
    document.getElementById("name").style.paddingLeft = "4vw";
  } else if (nameWidth > 180) {
    document.getElementById("name").style.fontSize = "2.5vh";
  }
  if (!paceLoaded) {
    loaded++;
    paceLoaded++;
  }
  if (loaded == 4) {
    loaded = -1;
    gameLoaded();
  }
});

const playProfileSong = () => {
  if (!themeSong.playing()) {
    songs[songSelection].fade(1, 0, 300);
    fadeRate(songs[songSelection], 1, 0.632183908, 300, Date.now());
  } else {
    themeSong.fade(1, 0, 300);
    fadeRate(themeSong, 1, 0.632183908, 300, Date.now());
  }
  profileSong.fade(0, 1, 300);
  fadeRate(profileSong, 1.5818181818, 1, 300, Date.now());
};

const stopProfileSong = () => {
  if (songSelection != -1) {
    if (!songs[songSelection].playing()) songs[songSelection].play();
    songs[songSelection].fade(0, 1, 300);
    fadeRate(songs[songSelection], 0.632183908, 1, 300, new Date().getTime());
  } else {
    themeSong.fade(0, 1, 300);
    fadeRate(themeSong, 0.632183908, 1, 300, new Date().getTime());
  }
  profileSong.fade(1, 0, 300);
  fadeRate(profileSong, 1, 1.5818181818, 300, new Date().getTime());
};

const infoScreen = () => {
  display = 4;
  lottieAnim.pause();
  document.getElementById("infoContainer").style.display = "block";
  document.getElementById("infoContainer").classList.add("fadeInAnim");
};

const optionScreen = () => {
  display = 2;
  lottieAnim.pause();
  document.getElementById("optionContainer").style.display = "block";
  document.getElementById("optionContainer").classList.add("fadeInAnim");
};

const profileScreen = (uid) => {
  if (uid) display = 16;
  else display = 15;
  playProfileSong();
  lottieAnim.pause();
  document.getElementById("profileContainer").style.display = "block";
  document.getElementById("profileContainer").classList.add("fadeInAnim");
  loadingOverlayShow();
  profileUpdate(uid ? uid : userid, uid == undefined);
};

const displayClose = () => {
  if (!loading) {
    if (display == 1) {
      //PLAY
      document.getElementById("selectContainer").classList.remove("fadeInAnim");
      document.getElementById("selectContainer").classList.add("fadeOutAnim");
      setTimeout(() => {
        document.getElementById("selectContainer").classList.remove("fadeOutAnim");
        document.getElementById("selectContainer").style.display = "none";
      }, 500);
    } else if (display == 2) {
      //OPTION
      loadingShow();
      settings.sound.offset = offset;
      fetch(`${api}/settings`, {
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({
          settings: settings,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.result != "success") {
            alert(`Error occured.\n${data.error}`);
          }
          loadingHide();
        })
        .catch((error) => {
          alert(`Error occured.\n${error}`);
          console.error(`Error occured.\n${error}`);
        });
      document.getElementById("optionContainer").classList.remove("fadeInAnim");
      document.getElementById("optionContainer").classList.add("fadeOutAnim");
      setTimeout(() => {
        document.getElementById("optionContainer").classList.remove("fadeOutAnim");
        document.getElementById("optionContainer").style.display = "none";
      }, 500);
    } else if (display == 3) {
      //ADVANCED
      document.getElementById("advancedContainer").classList.remove("fadeInAnim");
      document.getElementById("advancedContainer").classList.add("fadeOutAnim");
      setTimeout(() => {
        document.getElementById("advancedContainer").classList.remove("fadeOutAnim");
        document.getElementById("advancedContainer").style.display = "none";
      }, 500);
    } else if (display == 4) {
      //Info
      document.getElementById("infoContainer").classList.remove("fadeInAnim");
      document.getElementById("infoContainer").classList.add("fadeOutAnim");
      setTimeout(() => {
        document.getElementById("infoContainer").classList.remove("fadeOutAnim");
        document.getElementById("infoContainer").style.display = "none";
      }, 500);
    } else if (display == 5) {
      //Info Profile
      document.getElementById("infoProfileContainer").classList.remove("fadeInAnim");
      document.getElementById("infoProfileContainer").classList.add("fadeOutAnim");
      setTimeout(() => {
        document.getElementById("infoProfileContainer").classList.remove("fadeOutAnim");
        document.getElementById("infoProfileContainer").style.display = "none";
      }, 500);
      display = 4;
      return;
    } else if (display == 6) {
      //PLAY Rank
      document.getElementById("selectRankContainer").style.opacity = "0";
      document.getElementById("selectRankContainer").style.pointerEvents = "none";
      document.getElementById("selectRankInnerContainer").classList.remove("visible");
      display = 1;
      isRankOpened = false;
      return;
    } else if (display == 7) {
      //OPTION Offset
      offsetButton.textContent = offset + "ms";
      document.getElementById("offsetContiner").classList.remove("fadeInAnim");
      document.getElementById("offsetContiner").classList.add("fadeOutAnim");
      if (songSelection != -1) {
        if (!songs[songSelection].playing()) songs[songSelection].play();
        songs[songSelection].fade(0, 1, 500);
      } else {
        if (!themeSong.playing()) themeSong.play();
        themeSong.fade(0, 1, 500);
      }
      offsetSong.fade(1, 0, 500);
      setTimeout(() => {
        document.getElementById("offsetContiner").classList.remove("fadeOutAnim");
        document.getElementById("offsetContiner").style.display = "none";
        offsetSong.stop();
      }, 500);
      display = 2;
      return;
    } else if (display == 8) {
      //STORE
      document.getElementById("storeContainer").classList.remove("fadeInAnim");
      document.getElementById("storeContainer").classList.add("fadeOutAnim");
      setTimeout(() => {
        document.getElementById("storeContainer").classList.remove("fadeOutAnim");
        document.getElementById("storeContainer").style.display = "none";
      }, 500);
    } else if (display == 9) {
      //DLC info
      document.getElementById("storeDLCInfo").classList.remove("fadeInAnim");
      document.getElementById("storeDLCInfo").classList.add("fadeOutAnim");
      setTimeout(() => {
        document.getElementById("storeDLCInfo").classList.remove("fadeOutAnim");
        document.getElementById("storeDLCInfo").style.display = "none";
      }, 500);
      display = 8;
      return;
    } else if (display == 10) {
      //Skin info
      document.getElementById("storeSkinInfo").classList.remove("fadeInAnim");
      document.getElementById("storeSkinInfo").classList.add("fadeOutAnim");
      setTimeout(() => {
        document.getElementById("storeSkinInfo").classList.remove("fadeOutAnim");
        document.getElementById("storeSkinInfo").style.display = "none";
      }, 500);
      display = 8;
      return;
    } else if (display == 11) {
      //Store purchase method selection
      overlayPaymentContainer.style.pointerEvents = "none";
      overlayPaymentContainer.style.opacity = "0";
      display = 8;
      return;
    } else if (display == 12) {
      //Coupon code form
      overlayCodeContainer.style.pointerEvents = "none";
      overlayCodeContainer.style.opacity = "0";
      display = 2;
      return;
    } else if (display == 13) {
      //store tutorial
      tutorial--;
      document.getElementById("storeTutorialContainer").classList.remove("fadeInAnim");
      document.getElementById("storeTutorialContainer").classList.add("fadeOutAnim");
      setTimeout(() => {
        document.getElementById("storeTutorialContainer").classList.remove("fadeOutAnim");
        document.getElementById("storeTutorialContainer").style.display = "none";
      }, 500);
      display = 8;
      fetch(`${api}/storeTutorial`, {
        method: "PUT",
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.result != "success") {
            alert(`Error occured.\n${data.error}`);
          }
        })
        .catch((error) => {
          alert(`Error occured.\n${error}`);
          console.error(`Error occured.\n${error}`);
        });
      return;
    } else if (display == 14) {
      display = 1;
      document.getElementById("CPLContainer").classList.remove("fadeInAnim");
      document.getElementById("CPLContainer").classList.add("fadeOutAnim");
      setTimeout(() => {
        document.getElementById("CPLContainer").classList.remove("fadeOutAnim");
        document.getElementById("CPLContainer").style.display = "none";
      }, 500);
      return;
    } else if (display == 15 || display == 16) {
      //PROFILE
      stopProfileSong();
      document.getElementById("profileContainer").classList.remove("fadeInAnim");
      document.getElementById("profileContainer").classList.add("fadeOutAnim");
      setTimeout(() => {
        document.getElementById("profileContainer").classList.remove("fadeOutAnim");
        document.getElementById("profileContainer").style.display = "none";
      }, 500);
    }
    lottieAnim.play();
    if (display == 15) display = 0;
    else display = 3;
  }
};

const loadingOverlayShow = () => {
  loading = true;
  overlayLoadingContainer.style.pointerEvents = "all";
  overlayLoadingContainer.style.opacity = "1";
};

const loadingOverlayHide = () => {
  loading = false;
  overlayLoadingContainer.style.pointerEvents = "none";
  overlayLoadingContainer.style.opacity = "0";
};

const loadingShow = () => {
  loadingCircle.style.pointerEvents = "all";
  loadingCircle.style.opacity = "1";
};

const loadingHide = () => {
  loadingCircle.style.pointerEvents = "none";
  loadingCircle.style.opacity = "0";
};

const menuSelected = (n) => {
  lottieAnim.pause();
  if (n == 0) {
    //play
    display = 1;
    if (songSelection == -1) {
      // eslint-disable-next-line no-constant-condition
      while (1) {
        let min = Math.ceil(0);
        let max = Math.floor(tracks.length);
        let result = Math.floor(Math.random() * (max - min)) + min;
        if (songs[result]) {
          songSelected(result);
          break;
        }
      }
    }
    document.getElementById("selectContainer").style.display = "flex";
    document.getElementById("selectContainer").classList.add("fadeInAnim");
    document.getElementsByClassName("tracksSelection")[Number(isOfficial)].classList.remove("selected");
    document.getElementsByClassName("tracksSelection")[Number(!isOfficial)].classList.add("selected");
  } else if (n == 1) {
    //editor
    window.location.href = `${url}/editor`;
  } else if (n == 2) {
    //advanced
    display = 3;
    document.getElementById("advancedContainer").style.display = "block";
    document.getElementById("advancedContainer").classList.add("fadeInAnim");
    rankUpdate();
  } else if (n == 3) {
    //store
    document.getElementById("storeContainer").style.display = "flex";
    document.getElementById("storeContainer").classList.add("fadeInAnim");
    display = 8;
  }
};

const rankUpdate = async () => {
  const res = await fetch(`${api}/ranking/DESC/50`, {
    method: "GET",
    credentials: "include",
  });
  const data = await res.json();
  if (data.result == "success") {
    document.getElementById("rankTableBody").innerHTML = "";
    data.results.forEach((e, i) => {
      document.getElementById("rankTableBody").innerHTML += `<tr>
      <td>${i + 1}</td>
      <td>
        <div class="rankProfileContainer" onclick="profileScreen('${e.userid}')">
          <img src="${e.picture}" class="rankProfile" />
          ${e.nickname}
        </div>
      </td>
      <td>${Number(e.accuracy).toFixed(2)}%</td>
      <td>${numberWithCommas(Number(e.scoreSum))}</td>
      <td>${Number(e.rating / 100).toFixed(2)}</td>
      </tr>`;
    });
  }
};

const profileUpdate = async (uid, isMe) => {
  const res = await fetch(`${api}/profile/${uid}`, {
    method: "GET",
    credentials: "include",
  });
  let profile = await res.json();
  if (profile.result == "success") {
    let rank = Number(profile.rank);
    profile = profile.user;
    const editable = document.getElementsByClassName("editable");
    if (isMe) {
      aliasNum = profile.alias;
      ownedAlias = new Set(JSON.parse(profile.ownedAlias));
      for (let i = 0; i < editable.length; i++) {
        editable[i].classList.add("clickable");
      }
      document.getElementById("profileDescription").style.opacity = "1";
    } else {
      for (let i = 0; i < editable.length; i++) {
        editable[i].classList.remove("clickable");
      }
      document.getElementById("profileDescription").style.opacity = "0";
    }
    document.getElementById("profileImageContainer").style.backgroundImage = `url("${profile.background}")`;
    document.getElementById("profileImage").src = profile.picture;
    document.getElementById("profileName").textContent = profile.nickname;
    document.getElementById("profileBio").textContent = `| ${alias[profile.alias]}`;
    document.getElementById("profileRank").textContent = `#${numberWithCommas(rank)}`;
    document.getElementById("profileChart").style.height = document.getElementById("profileStat").clientHeight + "px";
    document.getElementsByClassName("profileStatValue")[0].textContent = (Number(profile.rating) / 100).toFixed(2);
    document.getElementsByClassName("profileStatValue")[1].textContent = numberWithCommas(Number(profile.scoreSum));
    document.getElementsByClassName("profileStatValue")[2].textContent = `${Number(profile.accuracy).toFixed(2)}%`;
    document.getElementsByClassName("profileStatValue")[3].textContent = profile.playtime;
    document.getElementsByClassName("profileStatValue")[4].textContent = profile["1stNum"];
    let recentPlay = JSON.parse(profile.recentPlay);
    if (recentPlay.length == 0) {
      document.getElementsByClassName("profileStatValue")[5].textContent = "-";
      document.getElementById("profileRecentPlay").innerHTML = `<span class="nothingHere">${nothingHere}</span>`;
    } else {
      document.getElementById("profileRecentPlay").innerHTML = "";
      for (let i = 0; i < recentPlay.length; i++) {
        await fetch(`${api}/record/${recentPlay[i]}`, {
          method: "GET",
          credentials: "include",
        })
          .then((res) => res.json())
          .then((res) => {
            if (res.result == "success") {
              if (i == 0) {
                const recentDate = new Date(res.results[0].date);
                document.getElementsByClassName("profileStatValue")[5].textContent = `${recentDate.toLocaleDateString()}`;
              }
              const data = res.results[0];
              const song = tracks.find((e) => e.name == data.name);
              const difficulty = JSON.parse(song.difficulty)[data.difficulty - 1];
              document.getElementById("profileRecentPlay").innerHTML += `<div class="playContainer">
              <div class="playContainerLeft">
                <span class="playDifficulty">${["EZ", "MID", "HARD"][data.difficulty - 1]} ${difficulty}</span>
                <img src="${cdn}/albums/50/${song.fileName}.webp" class="playAlbum" />
                <div class="playTitleContainer">
                  <span class="playTitle">${settings.general.detailLang == "original" ? song.originalName : song.name}</span>
                  <span class="playProducer">${song.producer}</span>
                </div>
              </div>
              <div class="playContainerRight">
                <span class="playDetail">${data.judge}</span>
                <span class="playDetail">${numberWithCommas(Number(data.record))}</span>
                <span class="playDetail">${Number(data.accuracy).toFixed(2)}%</span>
                <span class="playRate">${rating} +${Number(data.rating / 100).toFixed(2)}</span>
              </div>
            </div>`;
            }
          });
      }
    }
    let bestRecords = await fetch(`${api}/bestRecords/${profile.nickname}`, {
      method: "GET",
      credentials: "include",
    });
    bestRecords = await bestRecords.json();
    if (bestRecords.result == "success") {
      document.getElementById("profileBestPlay").innerHTML = "";
      bestRecords = bestRecords.results;
      if (bestRecords.length == 0) document.getElementById("profileBestPlay").innerHTML = `<span class="nothingHere">${nothingHere}</span>`;
      for (let i = 0; i < bestRecords.length; i++) {
        const data = bestRecords[i];
        const song = tracks.find((e) => e.name == data.name);
        const difficulty = JSON.parse(song.difficulty)[data.difficulty - 1];
        document.getElementById("profileBestPlay").innerHTML += `<div class="playContainer">
        <div class="playContainerLeft">
          <span class="playDifficulty">${["EZ", "MID", "HARD"][data.difficulty - 1]} ${difficulty}</span>
          <img src="${cdn}/albums/50/${song.fileName}.webp" class="playAlbum" />
          <div class="playTitleContainer">
            <span class="playTitle">${settings.general.detailLang == "original" ? song.originalName : song.name}</span>
            <span class="playProducer">${song.producer}</span>
          </div>
        </div>
        <div class="playContainerRight">
          <span class="playDetail">${data.judge}</span>
          <span class="playDetail">${numberWithCommas(Number(data.record))}</span>
          <span class="playDetail">${Number(data.accuracy).toFixed(2)}%</span>
          <span class="playRate">${rating} ${data.rating == 0 ? "-" : `+${Number(data.rating / 100).toFixed(2)}`}</span>
        </div>
      </div>`;
      }
    }
    document.getElementsByClassName("profileMedalText")[0].textContent = profile.ap;
    document.getElementsByClassName("profileMedalText")[1].textContent = profile.fc;
    document.getElementsByClassName("profileMedalText")[2].textContent = profile.clear;
    let labels = [];
    let date = Date.now();
    let rankHistory = JSON.parse(profile.rankHistory);
    for (let i = 0; i <= rankHistory.length; i++) {
      let day = new Date(date - 86400000 * i);
      if (rankHistory.length == 0) labels.push(`${`${day.getMonth() + 1}`.padStart(2, "0")}-${`${day.getDate()}`.padStart(2, "0")}`);
      labels.push(`${`${day.getMonth() + 1}`.padStart(2, "0")}-${`${day.getDate()}`.padStart(2, "0")}`);
    }
    labels.reverse();
    let data = [...rankHistory, rank];
    if (rankHistory.length == 0) data.push(rank);
    const chart = document.getElementById("rankChart");
    const chartCtx = chart.getContext("2d");
    let gradientFill = chartCtx.createLinearGradient(0, 0, 0, document.getElementById("profileChart").clientHeight);
    gradientFill.addColorStop(0, "rgba(255, 255, 255, 0.5)");
    gradientFill.addColorStop(1, "rgba(255, 255, 255, 0)");
    if (chartVar) chartVar.destroy();
    chartVar = new Chart(chart, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            borderColor: "#ffffff",
            pointRadius: 0,
            borderWidth: 2,
            tension: 0,
            fill: "start",
            backgroundColor: gradientFill,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          axis: "x",
          mode: "nearest",
        },
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            display: false,
          },
          y: {
            display: false,
            reverse: true,
          },
        },
      },
    });
  } else {
    alert(`Error occured.\n${profile.error}`);
    console.error(`Error occured.\n${profile.error}`);
  }
  loadingOverlayHide();
};

const fadeRate = (track, start, end, duration, time) => {
  let p = (Date.now() - time) / duration;
  if (p >= 1) {
    track.rate(end);
    return;
  }
  track.rate(start + (end - start) * p);
  requestAnimationFrame(() => {
    fadeRate(track, start, end, duration, time);
  });
};

const langChanged = (e) => {
  window.location.href = `${url}/${e.value}`;
};

const logout = (e) => {
  window.location.href = `${api}/auth/logout?redirect=true`;
};

const settingChanged = (e, v) => {
  if (v == "detailLang") {
    settings.general.detailLang = e.value;
  } else if (v == "canvasRes") {
    settings.display.canvasRes = Number(e.value);
  } else if (v == "albumRes") {
    settings.display.albumRes = Number(e.value);
  } else if (v == "volumeMaster") {
    settings.sound.volume.master = e.value / 100;
    for (let i = 0; i <= 1; i++) {
      document.getElementsByClassName("volumeMasterValue")[i].textContent = Math.round(e.value) + "%";
    }
    overlayTime = Date.now();
    setTimeout(() => {
      overlayClose("volume");
    }, 1500);
    Howler.volume(settings.sound.volume.master * settings.sound.volume.music);
    intro1video.volume = settings.sound.volume.master * settings.sound.volume.music;
  } else if (v == "volumeSong") {
    settings.sound.volume.music = e.value / 100;
    volumeSongValue.textContent = Math.round(e.value) + "%";
    Howler.volume(settings.sound.volume.master * settings.sound.volume.music);
  } else if (v == "volumeHitsound") {
    settings.sound.volume.hitSound = e.value / 100;
    volumeHitValue.textContent = Math.round(e.value) + "%";
  } else if (v == "volumeEffect") {
    settings.sound.volume.effect = e.value / 100;
    volumeEftValue.textContent = Math.round(e.value) + "%";
  } else if (v == "soundRes") {
    settings.sound.res = e.value;
  } else if (v == "sensitive") {
    settings.input.sens = e.value / 100;
    sensitiveValue.textContent = e.value / 100 + "x";
  } else if (v == "wheel") {
    settings.input.wheelReverse = Number(e.value);
  } else if (v == "inputKey") {
    settings.input.keys = Number(e.value);
  } else if (v == "inputMouse") {
    settings.input.mouse = e.checked;
  } else if (v == "skin") {
    settings.game.skin = e.value;
  } else if (v == "judgeSkin") {
    settings.game.judgeSkin = e.checked;
  } else if (v == "inputSize") {
    settings.game.size = e.value / 10;
    inputSizeValue.textContent = e.value / 10 + "x";
  } else if (v == "Perfect" || v == "Great" || v == "Good" || v == "Bad" || v == "Miss" || v == "Bullet") {
    settings.game.applyJudge[v] = e.checked;
  } else if (v == "frameCounter") {
    settings.game.counter = e.checked;
  } else if (v == "comboAlert") {
    settings.game.comboAlert = e.checked;
  } else if (v == "comboCount") {
    settings.game.comboCount = parseInt(e.value);
  } else if (v == "ignoreCursor") {
    settings.editor.denyCursor = e.checked;
  } else if (v == "ignoreEditor") {
    settings.editor.denySkin = e.checked;
  }
};

const showProfile = (name) => {
  loadingShow();
  document.getElementById("infoProfileContainer").style.display = "flex";
  document.getElementById("infoProfileContainer").classList.add("fadeInAnim");
  fetch(`${api}/teamProfile/${name}`, {
    method: "GET",
    credentials: "include",
  })
    .then((res) => res.json())
    .then((data) => {
      let info = JSON.parse(data.data);
      document.getElementById("infoProfileName").textContent = info[0].name;
      document.getElementById("infoProfilePosition").textContent = info[0].position;
      document.getElementById("infoProfileImg").src = `images/credits/${info[0].profile}`;
      let innerHTML = `<div class="infoProfilePart">
                          <img src="https://img.icons8.com/small/64/333333/comma.png" class="infoIcon">
                          <span id="quote">${info[0].quote}</span>
                     </div>`;
      for (let i = 1; i < info.length; i++) {
        let link = "";
        if (info[i].icon.indexOf("soundcloud") != -1) {
          link = `https://soundcloud.com/${info[i].content}`;
        } else if (info[i].icon.indexOf("youtube") != -1) {
          link = `https://youtube.com/@${info[i].content}`;
        } else if (info[i].icon.indexOf("globe") != -1) {
          link = `https://${info[i].content}`;
        } else if (info[i].icon.indexOf("github") != -1) {
          link = `https://github.com/${info[i].content}`;
        } else if (info[i].icon.indexOf("twitter") != -1) {
          link = `https://twitter.com/${info[i].content}`;
        } else if (info[i].icon.indexOf("telegram") != -1) {
          link = `https://t.me/${info[i].content}`;
        } else if (info[i].icon.indexOf("instagram") != -1) {
          link = `https://www.instagram.com/${info[i].content}`;
        } else if (info[i].icon.indexOf("email") != -1) {
          link = `mailto:${info[i].content}`;
        }
        innerHTML += `
                    <div class="infoProfilePart">
                        <img src="https://img.icons8.com/${info[i].icon.split("/")[0]}/64/333333/${info[i].icon.split("/")[1]}.png" class="infoIcon">
                        ${link == "" ? `<span>` : `<a class="blackLink" href="${link}" target="_blank">`}${info[i].content}${link == "" ? `</span>` : `</a>`}
                    </div>`;
      }
      document.getElementById("infoProfileBottom").innerHTML = innerHTML;
      loadingHide();
      display = 5;
    })
    .catch((error) => {
      alert(`Error occured.\n${error}`);
      console.error(`Error occured.\n${error}`);
    });
};

const optionSelect = (n) => {
  document.getElementsByClassName("optionSelected")[0].classList.remove("optionSelected");
  document.getElementsByClassName("optionSelectors")[n].classList.add("optionSelected");
  document.getElementsByClassName("optionShow")[0].classList.remove("optionShow");
  document.getElementsByClassName("optionContentsContainer")[n].classList.add("optionShow");
};

const updateDetails = (n) => {
  if (isOfficial) {
    document.getElementById("bulletDensity").textContent = bulletDensities[difficultySelection];
    document.getElementById("bulletDensityValue").style.width = `${bulletDensities[difficultySelection]}%`;
    document.getElementById("noteDensity").textContent = noteDensities[difficultySelection];
    document.getElementById("noteDensityValue").style.width = `${noteDensities[difficultySelection]}%`;
    document.getElementById("bpmText").textContent = bpm;
    document.getElementById("bpmValue").style.width = `${bpm / 3}%`;
    document.getElementById("speed").textContent = speeds[difficultySelection];
    document.getElementById("speedValue").style.width = `${(speeds[difficultySelection] / 5) * 100}%`;
    let starText = "";
    for (let i = 0; i < difficulties[difficultySelection]; i++) {
      starText += "★";
    }
    for (let i = difficulties[difficultySelection]; i < 10; i++) {
      starText += "☆";
    }
    document.getElementById("selectStars").textContent = starText;
    document.getElementById("selectScoreValue").textContent = numberWithCommas(`${trackRecords[n][difficultySelection].record}`.padStart(9, "0"));
    document.getElementsByClassName("ranks")[n].className = "ranks";
    document.getElementsByClassName("ranks")[n].classList.add(trackRecords[n][difficultySelection].rank);
    let recordMedal = trackRecords[n][difficultySelection].medal;
    goldMedal.style.opacity = "0.1";
    silverMedal.style.opacity = "0.1";
    checkMedal.style.opacity = "0.1";
    if (recordMedal >= 4) {
      goldMedal.style.opacity = "1";
      recordMedal -= 4;
    }
    if (recordMedal >= 2) {
      silverMedal.style.opacity = "1";
      recordMedal -= 2;
    }
    if (recordMedal >= 1) {
      checkMedal.style.opacity = "1";
    }
  } else {
    updatePatterns();
    document.getElementById("bulletDensity").textContent = ezCount;
    document.getElementById("bulletDensityValue").style.width = `${ezCount == 0 ? 0 : (ezCount / maxCount) * 100}%`;
    document.getElementById("noteDensity").textContent = midCount;
    document.getElementById("noteDensityValue").style.width = `${midCount == 0 ? 0 : (midCount / maxCount) * 100}%`;
    document.getElementById("bpmText").textContent = hardCount;
    document.getElementById("bpmValue").style.width = `${hardCount == 0 ? 0 : (hardCount / maxCount) * 100}%`;
    document.getElementById("speed").textContent = bpm;
    document.getElementById("speedValue").style.width = `${bpm / 3}%`;
  }
};

const difficultySelected = (n, isInitializing) => {
  difficultySelection = n;
  document.getElementsByClassName("difficultySelected")[0].classList.remove("difficultySelected");
  document.getElementsByClassName("difficulty")[n].classList.add("difficultySelected");
  updateDetails(songSelection);
  updateRanks();
  if (localStorage.sort == "2" && !isInitializing) {
    sortSelected(2);
  }
};

const showRank = () => {
  isRankOpened = true;
  display = 6;
  document.getElementById("selectRankContainer").style.opacity = "1";
  document.getElementById("selectRankContainer").style.pointerEvents = "visible";
  document.getElementById("selectRankInnerContainer").classList.add("visible");
};

const offsetSetting = () => {
  display = 7;
  document.getElementById("offsetContiner").style.display = "flex";
  document.getElementById("offsetContiner").classList.add("fadeInAnim");
  if (!themeSong.playing()) {
    songs[songSelection].fade(1, 0, 500);
    setTimeout(() => {
      songs[songSelection].pause();
    }, 500);
  } else {
    themeSong.fade(1, 0, 500);
    setTimeout(() => {
      themeSong.pause();
    }, 500);
  }
  offsetSong.play();
  offsetSong.fade(0, 1, 500);
  offsetUpdate();
};

const offsetUpdate = () => {
  let beat = 60 / 110;
  let remain = ((offsetSong.seek() % beat <= beat / 1.5 ? offsetSong.seek() % beat : (offsetSong.seek() % beat) - beat) * 1000) / offsetRate;
  let fillColor = "#373737";
  if (offsetSong.seek() <= beat + 0.005) fillColor = "#e56464";
  if (-50 <= remain && remain <= 0) {
    offsetNextCircle.style.backgroundColor = "#ffffff";
    offsetPrevCircle.style.backgroundColor = fillColor;
  } else if (0 <= remain && remain <= 50) {
    offsetPrevCircle.style.backgroundColor = "#ffffff";
    offsetTimingCircle.style.backgroundColor = fillColor;
  } else if (50 <= remain && remain <= 100) {
    offsetTimingCircle.style.backgroundColor = "#ffffff";
    offsetNextCircle.style.backgroundColor = fillColor;
  } else {
    offsetTimingCircle.style.backgroundColor = "#ffffff";
    offsetPrevCircle.style.backgroundColor = "#ffffff";
    offsetNextCircle.style.backgroundColor = "#ffffff";
  }
  if (offsetInput) {
    offsetInputCircle.style.backgroundColor = fillColor;
    if (!offsetPrevInput) {
      if (offsetAverage[offsetAverage.length - 1] - remain >= 50 || offsetAverage[offsetAverage.length - 1] + remain <= -50) {
        offsetAverage = [];
      }
      offsetAverage.push(parseInt(remain));
      let avr = 0;
      for (let i = offsetAverage.length - 1; i >= (offsetAverage.length - 10 < 0 ? 0 : offsetAverage.length - 10); i--) {
        avr += offsetAverage[i];
      }
      avr = avr / (offsetAverage.length >= 10 ? 10 : offsetAverage.length);
      offset = parseInt(avr);
      offsetButtonText.textContent = offset + "ms";
    }
  } else {
    offsetInputCircle.style.backgroundColor = "#ffffff";
  }
  if (offset <= remain && remain <= offset + 50) {
    offsetOffsetCircle.style.backgroundColor = fillColor;
  } else {
    offsetOffsetCircle.style.backgroundColor = "#ffffff";
  }
  offsetPrevInput = offsetInput;
  if (display == 7) {
    window.requestAnimationFrame(offsetUpdate);
  } else {
    offsetAverage = [];
    offsetPrevInput = false;
    offsetInput = false;
  }
};

const offsetSpeedUp = () => {
  offsetRate = Number((offsetRate + 0.1).toFixed(1));
  if (offsetRate > 2) offsetRate = 2;
  offsetSong.rate(offsetRate);
  offsetSpeedText.textContent = offsetRate + "x";
};

const offsetSpeedDown = () => {
  offsetRate = Number((offsetRate - 0.1).toFixed(1));
  if (offsetRate <= 0) offsetRate = 0.1;
  offsetSong.rate(offsetRate);
  offsetSpeedText.textContent = offsetRate + "x";
};

const offsetUp = () => {
  offset += 5;
  if (!offset) {
    offsetButtonText.textContent = "TAP";
  } else {
    offsetButtonText.textContent = offset + "ms";
  }
};

const offsetDown = () => {
  offset -= 5;
  if (!offset) {
    offsetButtonText.textContent = "TAP";
  } else {
    offsetButtonText.textContent = offset + "ms";
  }
};

const offsetReset = () => {
  offset = 0;
  offsetButtonText.textContent = "TAP";
  offsetAverage = [];
};

const offsetButtonDown = () => {
  offsetInput = true;
};

const offsetButtonUp = () => {
  offsetInput = false;
};

const overlayClose = (s) => {
  if (s == "volume") {
    if (overlayTime + 1400 <= Date.now()) {
      volumeOverlay.classList.remove("overlayOpen");
    }
  }
};

const couponEnter = () => {
  display = 12;
  overlayCodeContainer.style.pointerEvents = "all";
  overlayCodeContainer.style.opacity = "1";
};

const couponApply = () => {
  if (codeInput.value != "") {
    overlayLoadingContainer.style.pointerEvents = "all";
    overlayLoadingContainer.style.opacity = "1";
    fetch(`${api}/coupon`, {
      method: "PUT",
      credentials: "include",
      body: JSON.stringify({
        code: codeInput.value,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.result == "success") {
          alert(couponApplySuccess);
          location.reload();
        } else if (data.result == "failed") {
          if (data.error == "Invalid code") {
            alert(`${couponInvalid1}\n${couponInvalid2}`);
          } else if (data.error == "Used code") {
            alert(couponUsed);
          } else if (data.error == "Already subscribed") {
            alert(`${alreadySubscribed1}\n${alreadySubscribed2}`);
          } else {
            alert(`Error occured.\n${data.description}`);
            console.error(`Error occured.\n${data.description}`);
          }
        } else {
          alert(`Error occured.`);
          console.error(`Error occured.`);
        }
        overlayLoadingContainer.style.pointerEvents = "none";
        overlayLoadingContainer.style.opacity = "0";
      })
      .catch((error) => {
        alert(`Error occured.\n${error}`);
        console.error(`Error occured.\n${error}`);
        overlayLoadingContainer.style.pointerEvents = "none";
        overlayLoadingContainer.style.opacity = "0";
      });
  } else {
    alert(`${inputEmpty}`);
  }
};

const rankToggle = () => {
  if (isRankOpened) {
    displayClose();
  } else {
    showRank();
  }
};

const tracksToggle = () => {
  isOfficial = !isOfficial;
  if (!isOfficial) {
    //official -> community
    document.getElementsByClassName("tracksSelection")[0].classList.remove("selected");
    document.getElementsByClassName("tracksSelection")[1].classList.add("selected");
    document.getElementById("selectScore").textContent = "MY BEST";
    document.getElementsByClassName("trackStatContainer")[0].getElementsByTagName("span")[0].textContent = `EZ ${count}`;
    document.getElementsByClassName("trackStatContainer")[1].getElementsByTagName("span")[0].textContent = `MID ${count}`;
    document.getElementsByClassName("trackStatContainer")[2].getElementsByTagName("span")[0].textContent = `HARD ${count}`;
    document.getElementsByClassName("trackStatContainer")[3].getElementsByTagName("span")[0].textContent = "BPM";
    document.getElementById("modsTitleContainer").style.display = "none";
    document.getElementById("starContainer").style.display = "none";
    document.getElementsByClassName("trackStatContainer")[4].style.display = "none";
    document.getElementsByClassName("trackStatContainer")[5].style.display = "none";
    document.getElementsByClassName("selectInfo")[2].style.display = "none";
    document.getElementsByClassName("difficultyNumber")[0].textContent = "1-3";
    document.getElementsByClassName("difficultyNumber")[1].textContent = "4-7";
    document.getElementsByClassName("difficultyNumber")[2].textContent = "8-10";
    document.getElementsByClassName("difficulty")[0].style.width = "4.5vw";
    document.getElementsByClassName("difficulty")[1].style.width = "4.5vw";
    if (songs[songSelection]) songs[songSelection].stop();
    tracksUpdate();
    songSelected(songSelection, true);
  } else {
    //community -> official
    document.getElementsByClassName("tracksSelection")[0].classList.add("selected");
    document.getElementsByClassName("tracksSelection")[1].classList.remove("selected");
    document.getElementById("selectScore").textContent = "SCORE";
    document.getElementsByClassName("trackStatContainer")[0].getElementsByTagName("span")[0].textContent = noteDensity;
    document.getElementsByClassName("trackStatContainer")[1].getElementsByTagName("span")[0].textContent = bulletDensity;
    document.getElementsByClassName("trackStatContainer")[2].getElementsByTagName("span")[0].textContent = "BPM";
    document.getElementsByClassName("trackStatContainer")[3].getElementsByTagName("span")[0].textContent = speed;
    document.getElementById("modsTitleContainer").style.display = "flex";
    document.getElementById("starContainer").style.display = "flex";
    document.getElementsByClassName("trackStatContainer")[4].style.display = "flex";
    document.getElementsByClassName("trackStatContainer")[5].style.display = "flex";
    document.getElementsByClassName("selectInfo")[2].style.display = "initial";
    document.getElementsByClassName("difficulty")[0].style.width = "3.5vw";
    document.getElementsByClassName("difficulty")[1].style.width = "3.5vw";
    if (songs[songSelection]) songs[songSelection].stop();
    tracksUpdate();
    songSelected(songSelection, true);
  }
};

const changeProfile = (e) => {
  switch (e) {
    case "alias":
      let element = "";
      let options = "";
      for (let i = 0; i < alias.length; i++) {
        if (ownedAlias.has(i)) options += `<option value="${i}"${i == aliasNum ? " selected" : ""}>${alias[i]}</option>`;
      }
      iziToast.show({
        overlay: true,
        displayMode: "once",
        theme: "dark",
        id: "inputs",
        zindex: 999,
        timeout: 20000,
        title: "Select alias",
        progressBarColor: "#999",
        message: "",
        position: "center",
        drag: false,
        inputs: [
          [
            `<select>${options}</select>`,
            "change",
            (instance, toast, input, e) => {
              element = input.value;
            },
          ],
        ],
        buttons: [
          [
            "<button><b>OK</b></button>",
            async (instance, toast) => {
              loadingOverlayShow();
              instance.hide({ transitionOut: "fadeOut" }, toast, "confirm");
              if (element !== "" && ownedAlias.has(Number(element))) {
                await fetch(`${api}/profile/alias`, {
                  method: "PUT",
                  credentials: "include",
                  body: JSON.stringify({
                    value: element,
                  }),
                  headers: {
                    "Content-Type": "application/json",
                  },
                })
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.result != "success") {
                      alert(`Error occured.\n${data.error}`);
                    }
                  })
                  .catch((error) => {
                    alert(`Error occured.\n${error}`);
                    console.error(`Error occured.\n${error}`);
                  });
              }
              aliasNum = Number(element);
              document.getElementById("profileBio").textContent = `| ${alias[aliasNum]}`;
              loadingOverlayHide();
            },
            true,
          ],
        ],
      });
      break;
    case "picture":
      iziToast.show({
        overlay: true,
        timeout: 20000,
        zindex: 999,
        theme: "dark",
        title: "What do you want to change?",
        position: "center",
        progressBarColor: "#999",
        buttons: [
          [
            "<button>Profile</button>",
            (instance, toast) => {
              instance.hide({ transitionOut: "fadeOut" }, toast, "picture");
            },
          ],
          [
            "<button>Background</button>",
            (instance, toast) => {
              instance.hide({ transitionOut: "fadeOut" }, toast, "background");
            },
          ],
        ],
        onClosing: (instance, toast, closedBy) => {
          if (closedBy != "button") {
            let url = "";
            iziToast.show({
              overlay: true,
              timeout: 20000,
              zindex: 999,
              theme: "dark",
              title: "Enter url of picture.",
              position: "center",
              progressBarColor: "#999",
              inputs: [
                [
                  '<input type="text" id="urlInput" />',
                  "change",
                  (instance, toast, input, e) => {
                    url = input.value;
                  },
                  true,
                ],
              ],
              buttons: [
                [
                  "<button><b>OK</b></button>",
                  async (instance, toast) => {
                    loadingOverlayShow();
                    instance.hide({ transitionOut: "fadeOut" }, toast, "confirm");
                    url = document.getElementById("urlInput").value;
                    if (url != "" && validURL(url)) {
                      if (await validImage(url)) {
                        await fetch(`${api}/profile/${closedBy}`, {
                          method: "PUT",
                          credentials: "include",
                          body: JSON.stringify({
                            value: url,
                          }),
                          headers: {
                            "Content-Type": "application/json",
                          },
                        })
                          .then((res) => res.json())
                          .then((data) => {
                            if (data.result != "success") {
                              alert(`Error occured.\n${data.error}`);
                            } else {
                              if (closedBy == "background") document.getElementById("profileImageContainer").style.backgroundImage = `url("${url}")`;
                              else document.getElementById("profileImage").src = url;
                            }
                          })
                          .catch((error) => {
                            alert(`Error occured.\n${error}`);
                            console.error(`Error occured.\n${error}`);
                          });
                      } else {
                        iziToast.error({
                          title: "Invalid image",
                          message: "Please enter valid image URL.",
                        });
                      }
                    } else {
                      if (url == "") {
                        iziToast.error({
                          title: "Empty URL",
                          message: "Please enter valid URL.",
                        });
                      } else {
                        iziToast.error({
                          title: "Invalid URL",
                          message: "Please enter valid URL.",
                        });
                      }
                    }
                    loadingOverlayHide();
                  },
                ],
              ],
            });
          }
        },
      });
      break;
  }
};
const validURL = (str) => {
  const pattern = /((?:(?:http?|https?|ftp)[s]*:\/\/)?[a-z0-9-%\/\&=?\.]+\.[a-z]{2,4}\/?([^\s<>\#%"\,\{\}\\|\\\^\[\]`]+)?)/gi;
  return !!pattern.test(str);
};

const validImage = (url) => {
  const img = new Image();
  img.src = url;
  return new Promise((resolve) => {
    img.onerror = () => resolve(false);
    img.onload = () => resolve(true);
  });
};

const scrollEvent = (e) => {
  if (scrollTimer == 0) {
    scrollTimer = 1;
    setTimeout(() => {
      scrollTimer = 0;
    }, 50);
    let delta = 0;
    if (e.deltaY != 0) delta = Math.max(-1, Math.min(1, e.deltaY));
    else delta = Math.max(-1, Math.min(1, e.deltaX));
    if (!settings.input.wheelReverse) delta *= -1;
    if (shiftDown) {
      if (delta == 1) {
        //UP
        if (settings.sound.volume.master <= 0.95) {
          settings.sound.volume.master = Math.round((settings.sound.volume.master + 0.05) * 100) / 100;
        } else {
          settings.sound.volume.master = 1;
        }
      } else {
        //DOWN
        if (settings.sound.volume.master >= 0.05) {
          settings.sound.volume.master = Math.round((settings.sound.volume.master - 0.05) * 100) / 100;
        } else {
          settings.sound.volume.master = 0;
        }
      }
      for (let i = 0; i <= 1; i++) {
        document.getElementsByClassName("volumeMaster")[i].value = Math.round(settings.sound.volume.master * 100);
        document.getElementsByClassName("volumeMasterValue")[i].textContent = `${Math.round(settings.sound.volume.master * 100)}%`;
      }
      Howler.volume(settings.sound.volume.master * settings.sound.volume.music);
      intro1video.volume = settings.sound.volume.master * settings.sound.volume.music;
      volumeOverlay.classList.add("overlayOpen");
      overlayTime = Date.now();
      setTimeout(() => {
        overlayClose("volume");
      }, 1500);
      fetch(`${api}/settings`, {
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({
          settings: settings,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.result != "success") {
            alert(`Error occured.\n${data.error}`);
          }
        })
        .catch((error) => {
          alert(`Error occured.\n${error}`);
          console.error(`Error occured.\n${error}`);
        });
    }
  }
};

document.onkeydown = (e) => {
  e = e || window.event;
  let key = e.key.toLowerCase();
  //console.log(key);
  if (key == "escape") {
    e.preventDefault();
    displayClose();
    return;
  }
  if (key == "shift") {
    shiftDown = true;
  }
  if (display == 0) {
    if (key == "arrowleft") {
      e.preventDefault();
      //menuLeft();
    } else if (key == "arrowright") {
      e.preventDefault();
      //menuRight();
    } else if (key == "enter" || key == " ") {
      e.preventDefault();
      //menuSelected();
    }
  } else if (display == 1 || display == 6) {
    if (key == "arrowup") {
      e.preventDefault();
      if (songSelection != 0) {
        let i = songSelection - 1;
        while (tracks[i].type == 3) {
          i--;
          if (i == 0) return;
        }
        songSelected(i);
      }
    } else if (key == "arrowdown") {
      e.preventDefault();
      if (songSelection < tracks.length - 1) {
        let i = songSelection + 1;
        while (tracks[i].type == 3) {
          i++;
          if (i == tracks.length - 1) return;
        }
        songSelected(i);
      }
    } else if (key == "tab") {
      e.preventDefault();
      difficultySelected(difficultySelection + 1 == 3 ? 0 : difficultySelection + 1);
    } else if (key == "enter") {
      e.preventDefault();
      songSelected(songSelection);
    } else if (key == "f2") {
      e.preventDefault();
      rankToggle();
    } else if (key == "/" || key == "?") {
      e.preventDefault();
      medalDescription();
    }
  } else if (display == 7) {
    offsetInput = true;
  }
};

document.onkeyup = (e) => {
  e = e || window.event;
  let key = e.key.toLowerCase();
  if (display == 7) {
    offsetInput = false;
  }
  if (key == "shift") {
    shiftDown = false;
  }
};

window.addEventListener("resize", initialize);
window.addEventListener("wheel", scrollEvent);

window.onpopstate = () => {
  if (display != 0) {
    displayClose();
    history.pushState("anotherAwesomeState", null, null);
  } else {
    history.back();
  }
};
