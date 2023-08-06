/* eslint-disable @typescript-eslint/no-empty-function */
/* global api, url, Howl, cdn, bodymovin, getTan, calcAngleDegrees, lowerBound, upperBound, numberWithCommas, Pace, Howler, patternError, returnToGame */
const menuContainer = document.getElementById("menuContainer");
const canvasBackground = document.getElementById("canvasBackground");
const canvasContainer = document.getElementById("canvasContainer");
const rankImg = document.getElementById("rankImg");
const floatingArrowContainer = document.getElementById("floatingArrowContainer");
const floatingResultContainer = document.getElementById("floatingResultContainer");
const scoreContainer = document.getElementById("scoreContainer");
const colorOverlayContainer = document.getElementById("colorOverlayContainer");
const floatingResumeContainer = document.getElementById("floatingResumeContainer");
const volumeMasterValue = document.getElementById("volumeMasterValue");
const volumeOverlay = document.getElementById("volumeOverlay");
const canvas = document.getElementById("componentCanvas");
const ctx = canvas.getContext("2d");
const missCanvas = document.getElementById("missPointCanvas");
const missCtx = missCanvas.getContext("2d");
let pattern = {};
let patternLength = 0;
let userName = "";
let difficultyNames = ["EZ", "MID", "HARD"];
let settings, sync, song, tracks, pixelRatio, offset, bpm, speed, userid;
let pointingCntElement = [{ v1: "", v2: "", i: "" }];
let circleBulletAngles = [];
let destroyParticles = [];
let missParticles = [];
let perfectParticles = [];
let destroyedBullets = new Set([]);
let destroyedNotes = new Set([]);
let grabbedNotes = new Set([]);
let mouseX = 0,
  mouseY = 0;
let score = 0,
  combo = 0,
  displayScore = 0,
  prevScore = 0,
  maxCombo = 0,
  scoreMs = 0;
let perfect = 0;
let great = 0;
let good = 0;
let bad = 0;
let miss = 0;
let bullet = 0; //miss와 bullet을 따로 처리
let mouseClicked = false;
let menuAllowed = false;
let mouseClickedMs = -1;
let frameCounterMs = Date.now();
let isMenuOpened = false;
let isResultShowing = false;
let resultMs = 0;
let frameArray = [];
let fps = 0;
let missPoint = [];
let sens = 1,
  skin,
  cursorZoom,
  inputMode,
  judgeSkin;
let comboAlert = false,
  comboCount = 50;
let comboAlertMs = 0,
  comboAlertCount = 0;
let hide = {},
  frameCounter;
let load = 0;
let fileName = "";
let paceLoaded = 0;
let lottieAnim = {
  play: () => {},
  stop: () => {},
  pause: () => {},
  goToAndPlay: () => {},
  goToAndStop: () => {},
  setSpeed: () => {},
};
let overlayTime = 0;
let shiftDown = false;
let tick = new Howl({
  src: [`/sounds/tick.mp3`],
  autoplay: false,
  loop: false,
});
let resultEffect = new Howl({
  src: [`${cdn}/tracks/result.mp3`],
  autoplay: false,
  loop: false,
});
let startDate = 0;
let pauseDate = 0;
let isPaused = false;
let rate = 1;
let disableText = false;
let songData = [];
let record = [];
let keyInput = [];
let keyInputMemory = 0;
let keyInputMemoryMs = 0;
let keyPressing = {};
let trackName = "";
let medal = 1;
let newRecordTime = 0;
let effectMs = 0;
let effectNum = -1;
const albumImg = new Image();

document.addEventListener("DOMContentLoaded", () => {
  menuContainer.style.display = "none";
  fetch(`${api}/tracks`, {
    method: "GET",
    credentials: "include",
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.result == "success") {
        tracks = data.tracks;
      } else {
        alert("Failed to load song list.");
        console.error("Failed to load song list.");
      }
    })
    .catch((error) => {
      alert(`Error occured.\n${error}`);
      console.error(`Error occured.\n${error}`);
    });
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
              userName = data.nickname;
              userid = data.userid;
              settings = JSON.parse(data.settings);
              initialize(true);
              settingApply();
            } else {
              alert(`Error occured.\n${data.description}`);
              console.error(`Error occured.\n${data.description}`);
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

const initialize = (isFirstCalled) => {
  canvas.width = (window.innerWidth * pixelRatio * settings.display.canvasRes) / 100;
  canvas.height = (window.innerHeight * pixelRatio * settings.display.canvasRes) / 100;
  missCanvas.width = window.innerWidth * 0.2 * pixelRatio;
  missCanvas.height = window.innerHeight * 0.05 * pixelRatio;
  rate = localStorage.rate;
  disableText = localStorage.disableText;
  if (isFirstCalled) {
    fetch(`${cdn}${localStorage.patternId ? `/CPL/${localStorage.patternId}` : `/URLATE-patterns/${localStorage.songName}/${localStorage.difficultySelection}`}.json`, {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        pattern = data;
        patternLength = pattern.patterns.length;
        document.getElementById("scoreDifficultyNum").textContent = localStorage.difficulty;
        document.getElementById("scoreDifficultyName").textContent = difficultyNames[localStorage.difficultySelection];
        document.getElementById("albumDifficulty").textContent = difficultyNames[localStorage.difficultySelection];
        document.getElementById("albumDifficultyNum").textContent = localStorage.difficulty;
        document.getElementById("artist").textContent = pattern.information.producer;
        document.getElementById("scoreArtist").textContent = pattern.information.producer;
        document.getElementById("authorNamespace").textContent = pattern.information.author;
        offset = pattern.information.offset;
        bpm = pattern.information.bpm;
        speed = pattern.information.speed;
        for (let i = 0; i < tracks.length; i++) {
          if (tracks[i].name == pattern.information.track) {
            document.getElementById("scoreTitle").textContent = settings.general.detailLang == "original" ? tracks[i].originalName : tracks[i].name;
            document.getElementById("title").textContent = settings.general.detailLang == "original" ? tracks[i].originalName : tracks[i].name;
            trackName = tracks[i].name;
            fileName = tracks[i].fileName;
            document.getElementById("albumContainer").style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${fileName}.png")`;
            document.getElementById("canvasBackground").style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${fileName}.png")`;
            document.getElementById("scoreBackground").style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${fileName}.png")`;
            document.getElementById("scoreAlbum").style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${fileName}.png")`;
            albumImg.src = `${cdn}/albums/${settings.display.albumRes}/${fileName}.png`;
            break;
          }
        }
        if (pattern.background.type) {
          lottieLoad();
        }
        fetch(`${api}/skin/${settings.game.skin}`, {
          method: "GET",
          credentials: "include",
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.result == "success") {
              skin = JSON.parse(data.data);
            } else {
              alert(`Error occured.\n${data.description}`);
              console.error(`Error occured.\n${data.description}`);
            }
          })
          .catch((error) => {
            alert(`Error occured.\n${error}`);
            console.error(`Error occured.\n${error}`);
          });
        song = new Howl({
          src: `${cdn}/tracks/${settings.sound.res}/${fileName}.ogg`,
          format: ["ogg"],
          autoplay: false,
          loop: false,
          onend: () => {
            isResultShowing = true;
            menuAllowed = false;
            calculateResult();
          },
          onload: () => {
            Howler.volume(settings.sound.volume.master);
            song.volume(settings.sound.volume.music);
            song.rate(localStorage.rate);
            if (load == 1) {
              doneLoading();
            }
            load++;
          },
        });
      })
      .catch((e) => {
        alert(`Error occured.\n${e}`);
        window.location.href = `${url}/game?initialize=1`;
      });
  } else {
    if (pattern.background.type) {
      lottieLoad(true);
    }
  }
};

const lottieLoad = (needToSeek) => {
  if (JSON.stringify(pattern.background.lottie) == "{}") return;
  let blob = new Blob([pattern.background.lottie], {
    type: "application/json",
  });
  let path = URL.createObjectURL(blob);
  if (lottieAnim.animType) {
    lottieAnim.destroy();
  }
  lottieAnim = bodymovin.loadAnimation({
    wrapper: canvasBackground,
    animType: "canvas",
    loop: true,
    autoplay: false,
    path: path,
  });
  lottieAnim.addEventListener("DOMLoaded", () => {
    if (needToSeek) {
      if (song.playing()) {
        lottieAnim.goToAndPlay(song.seek() * 1000);
      }
    }
    lottieSet();
  });
  URL.revokeObjectURL(path);
};

const lottieSet = () => {
  switch (pattern.background.type) {
    case 0: //Image
      canvasBackground.getElementsByTagName("canvas")[0].style.display = "none";
      canvasBackground.style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${fileName}.png")`;
      break;
    case 1: //Image & BGA
      canvasBackground.getElementsByTagName("canvas")[0].style.display = "initial";
      canvasBackground.style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${fileName}.png")`;
      break;
    case 2: //BGA
      canvasBackground.getElementsByTagName("canvas")[0].style.display = "initial";
      canvasBackground.style.backgroundImage = "none";
      canvasBackground.style.backgroundColor = `#${pattern.background.boxColor}`;
      break;
  }
};

const settingApply = () => {
  tick.volume(settings.sound.volume.hitSound);
  resultEffect.volume(settings.sound.volume.effect);
  sync = parseInt(settings.sound.offset);
  document.getElementById("loadingContainer").style.opacity = 1;
  sens = settings.input.sens;
  cursorZoom = settings.game.size;
  inputMode = settings.input.keys;
  comboAlert = settings.game.comboAlert;
  comboCount = settings.game.comboCount;
  judgeSkin = settings.game.judgeSkin;
  hide.perfect = settings.game.applyJudge.Perfect;
  hide.great = settings.game.applyJudge.Great;
  hide.good = settings.game.applyJudge.Good;
  hide.bad = settings.game.applyJudge.Bad;
  hide.miss = settings.game.applyJudge.Miss;
  frameCounter = settings.game.counter;
  document.getElementsByClassName("volumeMaster")[0].value = Math.round(settings.sound.volume.master * 100);
  volumeMasterValue.textContent = Math.round(settings.sound.volume.master * 100) + "%";
};

const eraseCnt = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

const getJudgeStyle = (j, p, x, y) => {
  p = parseInt(p);
  if (p <= 0) p = 0;
  p = `${p}`.padStart(2, "0");
  if (p <= 0) p = 0;
  if (!judgeSkin) {
    if (j == "miss") {
      return `rgba(237, 78, 50, ${1 - p / 100})`;
    } else if (j == "perfect") {
      let grd = ctx.createLinearGradient(x - 50, y - 20, x + 50, y + 20);
      grd.addColorStop(0, `rgba(87, 209, 71, ${1 - p / 100})`);
      grd.addColorStop(1, `rgba(67, 167, 224, ${1 - p / 100})`);
      return grd;
    } else if (j == "great") {
      return `rgba(87, 209, 71, ${1 - p / 100})`;
    } else if (j == "good") {
      return `rgba(67, 167, 224, ${1 - p / 100})`;
    } else if (j == "bad") {
      return `rgba(176, 103, 90, ${1 - p / 100})`;
    } else {
      return `rgba(50, 50, 50, ${1 - p / 100})`;
    }
  } else {
    p = parseInt(255 - p * 2.55);
    if (p <= 0) p = 0;
    p = p.toString(16).padStart(2, "0");
    if (p <= 0) p = "00";
    if (skin[j].type == "gradient") {
      let grd = ctx.createLinearGradient(x - 50, y - 20, x + 50, y + 20);
      for (let i = 0; i < skin[j].stops.length; i++) {
        grd.addColorStop(skin[j].stops[i].percentage / 100, `#${skin[j].stops[i].color}${p.toString(16)}`);
      }
      return grd;
    } else if (skin[j].type == "color") {
      return `#${skin[j].color}${p.toString(16)}`;
    }
  }
};

const drawParticle = (n, x, y, j, d) => {
  let cx = (canvas.width / 200) * (x + 100);
  let cy = (canvas.height / 200) * (y + 100);
  if (n == 0) {
    //Destroy
    const raf = (n, w) => {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        if (skin.bullet.type == "gradient") {
          let grd = ctx.createLinearGradient(cx - w, cy - w, cx + w, cy + w);
          for (let i = 0; i < skin.bullet.stops.length; i++) {
            grd.addColorStop(skin.bullet.stops[i].percentage / 100, `#${skin.bullet.stops[i].color}`);
          }
          ctx.fillStyle = grd;
          ctx.strokeStyle = grd;
        } else if (skin.bullet.type == "color") {
          ctx.fillStyle = `#${skin.bullet.color}`;
          ctx.strokeStyle = `#${skin.bullet.color}`;
        }
        ctx.arc(cx + n * destroyParticles[j].d[i][0], cy + n * destroyParticles[j].d[i][1], w, 0, 2 * Math.PI);
        ctx.fill();
      }
    };
    raf(destroyParticles[j].n, destroyParticles[j].w);
  } else if (n == 1) {
    //Click Note
    const raf = (w, s, n) => {
      ctx.beginPath();
      let width = canvas.width / 60;
      if (Date.now() - s >= 800) return;
      let p = 100 * easeOutQuad((Date.now() - s) / 800);
      ctx.lineWidth = ((100 - p) / 100) * (canvas.width / 200);
      let opacity = parseInt(225 - p * 1.25);
      if (opacity <= 0) opacity = "00";
      if (skin.note[n].circle) {
        if (skin.note[n].circle.type == "gradient") {
          let grd = ctx.createLinearGradient(cx - w, cy - w, cx + w, cy + w);
          for (let i = 0; i < skin.note[n].circle.stops.length; i++) {
            grd.addColorStop(skin.note[n].circle.stops[i].percentage / 100, `#${skin.note[n].circle.stops[i].color}${opacity.toString(16).padStart(2, "0")}`);
          }
          ctx.fillStyle = grd;
          ctx.strokeStyle = grd;
        } else if (skin.note[n].circle.type == "color") {
          ctx.fillStyle = `#${skin.note[n].circle.color}${opacity.toString(16).padStart(2, "0")}`;
          ctx.strokeStyle = `#${skin.note[n].circle.color}${opacity.toString(16).padStart(2, "0")}`;
        }
      } else {
        if (skin.note[n].type == "gradient") {
          let grd = ctx.createLinearGradient(cx - w, cy - w, cx + w, cy + w);
          for (let i = 0; i < skin.note[n].stops.length; i++) {
            grd.addColorStop(skin.note[n].stops[i].percentage / 100, `#${skin.note[n].stops[i].color}${opacity.toString(16).padStart(2, "0")}`);
          }
          ctx.fillStyle = grd;
          ctx.strokeStyle = grd;
        } else if (skin.note[n].type == "color") {
          ctx.fillStyle = `#${skin.note[n].color}${opacity.toString(16).padStart(2, "0")}`;
          ctx.strokeStyle = `#${skin.note[n].color}${opacity.toString(16).padStart(2, "0")}`;
        }
      }
      ctx.arc(cx, cy, w, 0, 2 * Math.PI);
      ctx.stroke();
      w = canvas.width / 40 + width * (p / 100);
      requestAnimationFrame(() => {
        raf(w, s, n);
      });
    };
    raf(canvas.width / 40, Date.now(), d);
  } else if (n == 2) {
    //Click Default
    const raf = (w, s) => {
      ctx.beginPath();
      let width = canvas.width / 60;
      let p = 100 - (s + 300 - Date.now()) / 3;
      ctx.lineWidth = ((100 - p) / 100) * 5;
      ctx.strokeStyle = `rgba(67, 221, 166, ${0.5 - p / 200})`;
      ctx.arc(cx, cy, w, 0, 2 * Math.PI);
      ctx.stroke();
      w = canvas.width / 70 + canvas.width / 400 + width * (p / 100);
      if (p < 100) {
        requestAnimationFrame(() => {
          raf(w, s);
        });
      }
    };
    raf(canvas.width / 70 + canvas.width / 400, Date.now());
  } else if (n == 3) {
    //Judge
    if (!hide[j.toLowerCase()]) {
      const raf = (y, s) => {
        ctx.beginPath();
        let p = 100 - (s + 300 - Date.now()) / 3;
        let newY = y - 2 * Math.round(p / 10);
        ctx.fillStyle = getJudgeStyle(j.toLowerCase(), p, cx, newY);
        ctx.strokeStyle = `rgba(0, 0, 0, ${1 - p / 100})`;
        ctx.font = `600 ${canvas.height / 25}px Montserrat, Pretendard Variable`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 2;
        // ctx.strokeText(j, cx, newY);
        ctx.fillText(j, cx, newY);
        if (p < 100) {
          requestAnimationFrame(() => {
            raf(cy, s);
          });
        }
      };
      raf(cy, Date.now());
    }
  } else if (n == 4) {
    //judge:miss
    if (!hide.miss) {
      ctx.beginPath();
      let p = 100 - (missParticles[j].s + 300 - Date.now()) / 3;
      let newY = cy - Math.round(p / 10);
      ctx.fillStyle = getJudgeStyle("miss", p);
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - p / 100})`;
      ctx.font = `600 ${canvas.height / 25}px Montserrat, Pretendard Variable`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 2;
      ctx.fillText("Miss", cx, newY);
    }
  } else if (n == 5) {
    //judge: perfect
    if (!hide.perfect) {
      ctx.beginPath();
      let p = 100 - (perfectParticles[j].s + 300 - Date.now()) / 3;
      let newY = cy - Math.round(p / 10);
      ctx.fillStyle = getJudgeStyle("perfect", p, cx, newY);
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - p / 100})`;
      ctx.font = `600 ${canvas.height / 25}px Montserrat, Pretendard Variable`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 2;
      ctx.fillText("Perfect", cx, newY);
    }
  }
};

const drawNote = (p, x, y, n, d, t, index) => {
  if (n != 2 && p >= 130) return;
  else if (n == 2 && t >= 130) return;
  p = Math.max(p, 0);
  x = (canvas.width / 200) * (x + 100);
  y = (canvas.height / 200) * (y + 100);
  n = n == undefined ? 0 : n;
  let w = canvas.width / 40;
  let opacity = 255;
  if (n != 2 && p >= 100) {
    opacity = Math.max(Math.round((255 / 30) * (130 - p)), 0);
  } else if (n == 2 && p >= 100 && t >= 100 && (grabbedNotes.has(index) || grabbedNotes.has(`${index}!`))) {
    opacity = Math.max(Math.round((255 / 30) * (130 - t)), 0);
  } else if (n == 2 && p >= 100 && !grabbedNotes.has(index)) {
    opacity = Math.max(Math.round((255 / 30) * (130 - p)), 0);
  }
  opacity = opacity.toString(16).padStart(2, "0");
  if (skin.note[n].type == "gradient") {
    let grd = ctx.createLinearGradient(x - w, y - w, x + w, y + w);
    for (let i = 0; i < skin.note[n].stops.length; i++) {
      grd.addColorStop(skin.note[n].stops[i].percentage / 100, `#${skin.note[n].stops[i].color}${opacity}`);
    }
    ctx.fillStyle = grd;
    ctx.strokeStyle = grd;
  } else if (skin.note[n].type == "color") {
    ctx.fillStyle = `#${skin.note[n].color}${opacity}`;
    ctx.strokeStyle = `#${skin.note[n].color}${opacity}`;
  }
  if (skin.note[n].circle) {
    if (skin.note[n].circle.type == "gradient") {
      let grd = ctx.createLinearGradient(x - w, y - w, x + w, y + w);
      for (let i = 0; i < skin.note[n].circle.stops.length; i++) {
        grd.addColorStop(skin.note[n].circle.stops[i].percentage / 100, `#${skin.note[n].circle.stops[i].color}${opacity}`);
      }
      ctx.strokeStyle = grd;
    } else if (skin.note[n].circle.type == "color") {
      ctx.strokeStyle = `#${skin.note[n].circle.color}${opacity}`;
    }
  }
  ctx.lineWidth = Math.round(canvas.width / 300);
  if (n == 0) {
    ctx.beginPath();
    ctx.arc(x, y, w, (3 / 2) * Math.PI, (3 / 2) * Math.PI + (p / 50) * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, (w / 100) * p, 0, 2 * Math.PI);
    ctx.fill();
    if (skin.note[n].outline) {
      if (skin.note[n].outline.type == "gradient") {
        let grd = ctx.createLinearGradient(x - w, y - w, x + w, y + w);
        for (let i = 0; i < skin.note[n].outline.stops.length; i++) {
          grd.addColorStop(skin.note[n].outline.stops[i].percentage / 100, `#${skin.note[n].outline.stops[i].color}${opacity}`);
        }
        ctx.strokeStyle = grd;
      } else if (skin.note[n].outline.type == "color") {
        ctx.strokeStyle = `#${skin.note[n].outline.color}${opacity}`;
      }
      ctx.lineWidth = Math.round((canvas.width / 1000) * skin.note[n].outline.width);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.globalAlpha = (0.2 * (p * 2 >= 100 ? 100 : p * 2)) / 100;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.arc(x, y, w, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (n == 1) {
    w = w * 0.9;
    let parr = [p <= 20 ? p * 5 : 100, p >= 20 ? (p <= 80 ? (p - 20) * 1.66 : 100) : 0, p >= 80 ? (p <= 100 ? (p - 80) * 5 : 100) : 0];
    ctx.beginPath();
    let originalValue = [0, -1.5 * d * w];
    let moveValue = [originalValue[0] - w * Math.cos(Math.PI / 5) * d, originalValue[1] + w * Math.sin(Math.PI / 5) * d];
    ctx.moveTo(x + originalValue[0], y + originalValue[1]);
    ctx.lineTo(x + originalValue[0] - (moveValue[0] / 100) * parr[0], y + originalValue[1] - (moveValue[1] / 100) * parr[0]);
    ctx.moveTo(x + originalValue[0] - moveValue[0], y + originalValue[1] - moveValue[1]);
    if (d == 1) ctx.arc(x, y, w, -Math.PI / 5, (((Math.PI / 5) * 7) / 100) * parr[1] - Math.PI / 5);
    else ctx.arc(x, y, w, (-Math.PI / 5) * 6, (((Math.PI / 5) * 7) / 100) * parr[1] - (Math.PI / 5) * 6);
    originalValue = [-w * Math.cos(Math.PI / 5) * d, -w * Math.sin(Math.PI / 5) * d];
    moveValue = [originalValue[0], originalValue[1] - -1.5 * d * w];
    ctx.moveTo(x + originalValue[0], y + originalValue[1]);
    ctx.lineTo(x + originalValue[0] - (moveValue[0] / 100) * parr[2], y + originalValue[1] - (moveValue[1] / 100) * parr[2]);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - 1.5 * d * (w / 100) * p);
    if (d == 1) ctx.arc(x, y, (w / 100) * p, -Math.PI / 5, (Math.PI / 5) * 6);
    else ctx.arc(x, y, (w / 100) * p, (-Math.PI / 5) * 6, Math.PI / 5);
    ctx.lineTo(x, y - 1.5 * d * (w / 100) * p);
    ctx.fill();
    if (skin.note[n].outline) {
      if (skin.note[n].outline.type == "gradient") {
        let grd = ctx.createLinearGradient(x - w, y - w, x + w, y + w);
        for (let i = 0; i < skin.note[n].outline.stops.length; i++) {
          grd.addColorStop(skin.note[n].outline.stops[i].percentage / 100, `#${skin.note[n].outline.stops[i].color}${opacity}`);
        }
        ctx.strokeStyle = grd;
      } else if (skin.note[n].outline.type == "color") {
        ctx.strokeStyle = `#${skin.note[n].outline.color}${opacity}`;
      }
      ctx.lineWidth = Math.round((canvas.width / 1000) * skin.note[n].outline.width);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.globalAlpha = (0.2 * (p * 2 >= 100 ? 100 : p * 2)) / 100;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.moveTo(x, y - 1.5 * d * w);
    if (d == 1) ctx.arc(x, y, w, -Math.PI / 5, (Math.PI / 5) * 6);
    else ctx.arc(x, y, w, (-Math.PI / 5) * 6, Math.PI / 5);
    ctx.lineTo(x, y - 1.5 * d * w);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (n == 2) {
    ctx.beginPath();
    if (skin.note[n].outline) {
      if (skin.note[n].outline.type == "gradient") {
        let grd = ctx.createLinearGradient(x - w, y - w, x + w, y + w);
        for (let i = 0; i < skin.note[n].outline.stops.length; i++) {
          grd.addColorStop(skin.note[n].outline.stops[i].percentage / 100, `#${skin.note[n].outline.stops[i].color}${opacity}`);
        }
        ctx.strokeStyle = grd;
      } else if (skin.note[n].outline.type == "color") {
        ctx.strokeStyle = `#${skin.note[n].outline.color}${opacity}`;
      }
      ctx.lineWidth = Math.round((canvas.width / 1000) * skin.note[n].outline.width);
    }
    if (p <= 100) {
      ctx.arc(x, y, w, (3 / 2) * Math.PI, (3 / 2) * Math.PI + (p / 50) * Math.PI);
      ctx.lineTo(x, y);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, w, (3 / 2) * Math.PI, (3 / 2) * Math.PI + (p / 50) * Math.PI);
      ctx.stroke();
    } else if (!grabbedNotes.has(index)) {
      ctx.arc(x, y, w, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    } else if (t <= 100) {
      ctx.arc(x, y, w, (3 / 2) * Math.PI + (t / 50) * Math.PI, (3 / 2) * Math.PI);
      ctx.lineTo(x, y);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, w, 0, 2 * Math.PI);
      ctx.stroke();
    } else {
      ctx.arc(x, y, w, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.globalAlpha = (0.2 * (p * 2 >= 100 ? 100 : p * 2)) / 100;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.arc(x, y, w, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
};

const drawCursor = () => {
  ctx.beginPath();
  let w = (canvas.width / 70) * cursorZoom;
  if (mouseClickedMs == -1) {
    mouseClickedMs = Date.now() - 100;
  }
  if (mouseClicked) {
    if (mouseClickedMs + 10 > Date.now()) {
      w = w + (canvas.width / 400) * (1 - (mouseClickedMs + 10 - Date.now()) / 10);
    } else {
      w = w + (canvas.width / 400) * 1;
    }
  } else {
    if (mouseClickedMs + 100 > Date.now()) {
      w = w + ((canvas.width / 400) * (mouseClickedMs + 100 - Date.now())) / 100;
    }
  }
  let x = (canvas.width / 200) * (mouseX + 100);
  let y = (canvas.height / 200) * (mouseY + 100);
  if (skin.cursor.type == "gradient") {
    let grd = ctx.createLinearGradient(x - w, y - w, x + w, y + w);
    for (let i = 0; i < skin.cursor.stops.length; i++) {
      grd.addColorStop(skin.cursor.stops[i].percentage / 100, `#${skin.cursor.stops[i].color}`);
    }
    ctx.shadowColor = `#${skin.cursor.stops[0].color}90`;
    ctx.fillStyle = grd;
  } else if (skin.cursor.type == "color") {
    ctx.fillStyle = `#${skin.cursor.color}`;
    ctx.shadowColor = `#${skin.cursor.color}90`;
  }
  if (skin.cursor.outline) {
    ctx.lineWidth = Math.round((canvas.width / 1000) * skin.cursor.outline.width);
    if (skin.cursor.outline.type == "gradient") {
      let grd = ctx.createLinearGradient(x - w, y - w, x + w, y + w);
      for (let i = 0; i < skin.cursor.outline.stops.length; i++) {
        grd.addColorStop(skin.cursor.outline.stops[i].percentage / 100, `#${skin.cursor.outline.stops[i].color}`);
      }
      ctx.shadowColor = `#${skin.cursor.outline.stops[0].color}90`;
      ctx.strokeStyle = grd;
    } else if (skin.cursor.outline.type == "color") {
      ctx.shadowColor = `#${skin.cursor.outline.color}90`;
      ctx.strokeStyle = `#${skin.cursor.outline.color}`;
    }
  }
  ctx.arc(x, y, w, 0, 2 * Math.PI);
  ctx.fill();
  ctx.shadowBlur = canvas.width / 100;
  if (skin.cursor.outline) ctx.stroke();
  ctx.shadowBlur = 0;
};

const drawBullet = (n, x, y, a) => {
  x = (canvas.width / 200) * (x + 100);
  y = (canvas.height / 200) * (y + 100);
  let w = canvas.width / 80;
  if (skin.bullet.type == "gradient") {
    let grd = ctx.createLinearGradient(x - w, y - w, x + w, y + w);
    for (let i = 0; i < skin.bullet.stops.length; i++) {
      grd.addColorStop(skin.bullet.stops[i].percentage / 100, `#${skin.bullet.stops[i].color}`);
    }
    ctx.fillStyle = grd;
    ctx.strokeStyle = grd;
  } else if (skin.bullet.type == "color") {
    ctx.fillStyle = `#${skin.bullet.color}`;
    ctx.strokeStyle = `#${skin.bullet.color}`;
  }
  if (skin.bullet.outline) {
    ctx.lineWidth = Math.round((canvas.width / 1000) * skin.bullet.outline.width);
    if (skin.bullet.outline.type == "gradient") {
      let grd = ctx.createLinearGradient(x - w, y - w, x + w, y + w);
      for (let i = 0; i < skin.bullet.outline.stops.length; i++) {
        grd.addColorStop(skin.bullet.outline.stops[i].percentage / 100, `#${skin.bullet.outline.stops[i].color}`);
      }
      ctx.strokeStyle = grd;
    } else if (skin.bullet.outline.type == "color") {
      ctx.strokeStyle = `#${skin.bullet.outline.color}`;
    }
  }
  ctx.beginPath();
  switch (n) {
    case 0:
      a = Math.PI * (a / 180 + 0.5);
      ctx.arc(x, y, w, a, a + Math.PI);
      a = a - 0.5 * Math.PI;
      ctx.moveTo(x - w * Math.sin(a), y + w * Math.cos(a));
      ctx.lineTo(x + w * 2 * Math.cos(a), y + w * 2 * Math.sin(a));
      ctx.lineTo(x + w * Math.sin(a), y - w * Math.cos(a));
      ctx.fill();
      if (skin.bullet.outline) ctx.stroke();
      break;
    case 1:
      ctx.arc(x, y, w, 0, Math.PI * 2);
      ctx.fill();
      if (skin.bullet.outline) ctx.stroke();
      break;
    default:
      ctx.font = `500 ${canvas.height / 30}px Montserrat, Pretendard Variable`;
      ctx.fillStyle = "#F55";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`drawBullet:bullet number isn't specified.`, canvas.width / 100, canvas.height / 100);
      console.error(`drawBullet:bullet number isn't specified.`);
  }
};

const destroyAll = (ms) => {
  const end = upperBound(pattern.bullets, ms);
  const renderBullets = pattern.bullets.slice(0, end);
  for (let j = 0; renderBullets.length > j; j++) {
    if (!destroyedBullets.has(j)) {
      callBulletDestroy(j);
    }
  }
};

const callBulletDestroy = (j) => {
  let date = Date.now();
  const seek = (date - startDate - (offset + sync)) * rate;
  const p = ((seek - pattern.bullets[j].ms) / ((bpm * 40) / speed / pattern.bullets[j].speed)) * 100;
  const left = pattern.bullets[j].direction == "L";
  let x = (left ? -1 : 1) * (100 - p);
  let y = 0;
  if (pattern.bullets[j].value == 0) {
    y = pattern.bullets[j].location + p * getTan(pattern.bullets[j].angle) * (left ? 1 : -1);
  } else {
    if (!circleBulletAngles[j]) circleBulletAngles[j] = calcAngleDegrees((left ? -100 : 100) - mouseX, pattern.bullets[j].location - mouseY);
    if (left) {
      if (110 > circleBulletAngles[j] && circleBulletAngles[j] > 0) circleBulletAngles[j] = 110;
      else if (0 > circleBulletAngles[j] && circleBulletAngles[j] > -110) circleBulletAngles[j] = -110;
    } else {
      if (70 < circleBulletAngles[j] && circleBulletAngles[j] > 0) circleBulletAngles[j] = 70;
      else if (0 > circleBulletAngles[j] && circleBulletAngles[j] < -70) circleBulletAngles[j] = -70;
    }
    y = pattern.bullets[j].location + p * getTan(circleBulletAngles[j]) * (left ? 1 : -1);
  }
  let randomDirection = [];
  for (let i = 0; i < 3; i++) {
    let rx = Math.floor(Math.random() * 4) - 2;
    let ry = Math.floor(Math.random() * 4) - 2;
    randomDirection[i] = [rx, ry];
  }
  destroyParticles.push({
    x: x,
    y: y,
    w: 5,
    n: 1,
    d: randomDirection,
    ms: Date.now(),
  });
  destroyedBullets.add(j);
};

const drawKeyInput = () => {
  if (keyInput.length == 0) return;
  if (keyInput[keyInput.length - 1].time + 4000 <= Date.now()) return;
  if (keyInputMemory != keyInput.length) {
    keyInputMemory = keyInput.length;
    keyInputMemoryMs = Date.now();
  }
  let alpha = 1;
  if (keyInput[keyInput.length - 1].time + 3000 <= Date.now()) {
    alpha = 1 - (Date.now() - keyInput[keyInput.length - 1].time - 3000) / 1000;
    if (alpha <= 0) return;
  }
  ctx.font = `500 ${canvas.height / 30}px Montserrat, Pretendard Variable`;
  ctx.fillStyle = "#FFF";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  let text = "";
  for (let i = 0; i < keyInput.length; i++) {
    text += keyInput[i].key;
  }
  let animDuration = 0;
  let animX = 0;
  if (keyInputMemoryMs + 100 >= Date.now()) {
    animDuration = 1 - easeOutQuart((Date.now() - keyInputMemoryMs) / 100);
    animX = animDuration * (canvas.width / 100 + canvas.width / 200);
  }
  for (let i = keyInput.length - 1; i >= (keyInput.length > 12 ? keyInput.length - 12 : 0); i--) {
    let j = i - keyInput.length + 13;
    let partAlpha = alpha;
    if (j < 8) {
      partAlpha *= (1 / 8) * (j + animDuration);
    }
    ctx.globalAlpha = partAlpha;
    let judge = keyInput[i].judge;
    let color = "#FFF";
    switch (judge) {
      case "Perfect":
        color = "#57BEEB";
        break;
      case "Great":
        color = "#73DFD2";
        break;
      case "Good":
        color = "#CCE97C";
        break;
      case "Bad":
        color = "#EDC77D";
        break;
      case "Miss":
        color = "#F96C5A";
        break;
      case "Bullet":
        color = "#E8A0A0";
        break;
      case "Empty":
        color = "#ffffff00";
        break;
      default:
        console.log(`drawKeyInput:${judge} isn't specified.`);
    }
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = canvas.width / 800;
    ctx.roundRect(
      canvas.width * 0.08 - canvas.height / 15 + (keyInput.length - i - 1) * (canvas.width / 100 + canvas.width / 200) - animX,
      canvas.height * 0.05,
      canvas.width / 100,
      canvas.width / 100,
      [canvas.width / 700]
    );
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.font = `600 5vh Montserrat, Pretendard Variable`;
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.fillText(
      keyInput[i].key[0],
      canvas.width * 0.08 - canvas.height / 15 + (keyInput.length - i - 1) * (canvas.width / 100 + canvas.width / 200) + canvas.width / 200 - animX,
      canvas.height * 0.05 + canvas.width / 100 + canvas.height / 200
    );
  }
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvas.width * 0.08 - canvas.height / 15 - canvas.width / 800, canvas.height * 0.05 + canvas.width / 100 + canvas.height / 200 + canvas.height / 20);
};

const cntRender = () => {
  eraseCnt();
  if (window.devicePixelRatio != pixelRatio) {
    pixelRatio = window.devicePixelRatio;
    initialize(false);
  }
  if (isResultShowing) {
    if (resultMs == 0) {
      resultMs = Date.now();
    }
  }
  if (resultMs != 0 && resultMs + 500 <= Date.now()) return;
  try {
    if (comboAlert) {
      let comboOpacity = 0;
      let fontSize = 20;
      if (comboAlertMs + 300 > Date.now()) {
        comboOpacity = 1 - (comboAlertMs + 300 - Date.now()) / 300;
      } else if (comboAlertMs + 300 <= Date.now() && comboAlertMs + 600 > Date.now()) {
        comboOpacity = 1;
      } else if (comboAlertMs + 600 <= Date.now() && comboAlertMs + 900 > Date.now()) {
        comboOpacity = (comboAlertMs + 900 - Date.now()) / 900;
      }
      fontSize = (canvas.height / 100) * (30 - (comboAlertMs + 900 - Date.now()) / 90);
      ctx.beginPath();
      ctx.font = `700 ${fontSize}px Montserrat, Pretendard Variable`;
      ctx.fillStyle = `rgba(200,200,200,${comboOpacity})`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(comboAlertCount, canvas.width / 2, canvas.height / 2);
    }
    ctx.beginPath();
    ctx.lineJoin = "round";
    const percentage = song.seek() / song.duration();
    const rectX = canvas.width / 2 - canvas.width / 14;
    const rectY = canvas.height - canvas.height / 80 - canvas.height / 200;
    const rectWidth = canvas.width / 7;
    const rectHeight = canvas.height / 200;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
    ctx.fillRect(rectX, rectY, rectWidth * percentage, rectHeight);
    ctx.lineWidth = 5;
    pointingCntElement = [{ v1: "", v2: "", i: "" }];
    let date = Date.now();
    let seek = 0;
    if (isPaused || startDate == 0) {
      seek = (date - (startDate + date - pauseDate) - (offset + sync)) * rate;
    } else {
      seek = (date - startDate - (offset + sync)) * rate;
    }
    let end = upperBound(pattern.triggers, seek + 0.002); //for floating point miss
    const renderTriggers = pattern.triggers.slice(0, end);
    for (let i = 0; i < renderTriggers.length; i++) {
      if (renderTriggers[i].value == 0) {
        if (!destroyedBullets.has(renderTriggers[i].num)) {
          callBulletDestroy(renderTriggers[i].num);
        }
      } else if (renderTriggers[i].value == 1) {
        destroyAll(renderTriggers[i].ms);
      } else if (renderTriggers[i].value == 2) {
        bpm = renderTriggers[i].bpm;
      } else if (renderTriggers[i].value == 3) {
        canvas.style.opacity = renderTriggers[i].opacity;
      } else if (renderTriggers[i].value == 4) {
        speed = renderTriggers[i].speed;
      } else if (renderTriggers[i].value == 5) {
        if (renderTriggers[i].ms - 1 <= seek && renderTriggers[i].ms + renderTriggers[i].time > seek && disableText == "false") {
          ctx.beginPath();
          ctx.fillStyle = "#fff";
          ctx.font = `${renderTriggers[i].weight} ${renderTriggers[i].size} Montserrat, Pretendard Variable`;
          if (renderTriggers[i].size.indexOf("vh") != -1)
            ctx.font = `${renderTriggers[i].weight} ${(canvas.height / 100) * Number(renderTriggers[i].size.split("vh")[0])}px Montserrat, Pretendard Variable`;
          ctx.textAlign = renderTriggers[i].align;
          ctx.textBaseline = renderTriggers[i].valign;
          ctx.fillText(renderTriggers[i].text, (canvas.width / 200) * (renderTriggers[i].x + 100), (canvas.height / 200) * (renderTriggers[i].y + 100));
        }
      }
    }
    for (let i = 0; i < destroyParticles.length; i++) {
      if (destroyParticles[i].w > 0) {
        drawParticle(0, destroyParticles[i].x, destroyParticles[i].y, i);
        destroyParticles[i].w = 10 - (Date.now() - destroyParticles[i].ms) / 25;
        destroyParticles[i].n++;
      }
    }
    end = upperBound(pattern.patterns, seek + (bpm * 14) / speed);
    const renderNotes = pattern.patterns.slice(0, end);
    for (let i = 0; renderNotes.length > i; i++) {
      const p = (((bpm * 14) / speed - (renderNotes[i].ms - seek)) / ((bpm * 14) / speed)) * 100;
      if (p >= 50) {
        trackMouseSelection(i, 0, renderNotes[i].value, renderNotes[i].x, renderNotes[i].y);
      }
    }
    for (let i = renderNotes.length - 1; i >= 0; i--) {
      const p = (((bpm * 14) / speed - (renderNotes[i].ms - seek)) / ((bpm * 14) / speed)) * 100;
      const t = ((seek - renderNotes[i].ms) / renderNotes[i].time) * 100;
      drawNote(p, renderNotes[i].x, renderNotes[i].y, renderNotes[i].value, renderNotes[i].direction, t, i);
      if (p >= 120 && !destroyedNotes.has(i) && (renderNotes[i].value == 2 ? !(grabbedNotes.has(i) || grabbedNotes.has(`${i}!`)) : true)) {
        calculateScore("miss", i, true);
        missParticles.push({
          x: renderNotes[i].x,
          y: renderNotes[i].y,
          s: Date.now(),
        });
        miss++;
        missPoint.push(song.seek() * 1000);
        record.push([record.length, pointingCntElement[0].v1, pointingCntElement[0].v2, pointingCntElement[0].i, mouseX, mouseY, "miss", seek]);
        keyInput.push({ judge: "Miss", key: "-", time: Date.now() });
      } else if (t >= 100 && grabbedNotes.has(i) && !grabbedNotes.has(`${i}!`) && renderNotes[i].value == 2) {
        grabbedNotes.add(`${i}!`);
        grabbedNotes.delete(i);
        perfectParticles.push({ x: renderNotes[i].x, y: renderNotes[i].y, s: Date.now() });
        calculateScore("Perfect", i, true);
        keyInput.push({ judge: "Perfect", key: "-", time: Date.now() });
      }
    }
    for (let i = 0; i < perfectParticles.length; i++) {
      if (perfectParticles[i].s + 300 > Date.now()) {
        drawParticle(5, perfectParticles[i].x, perfectParticles[i].y, i);
      }
    }
    for (let i = 0; i < missParticles.length; i++) {
      if (missParticles[i].s + 300 > Date.now()) {
        drawParticle(4, missParticles[i].x, missParticles[i].y, i);
      }
    }
    let start = lowerBound(pattern.bullets, seek - bpm * 100);
    end = upperBound(pattern.bullets, seek);
    const renderBullets = pattern.bullets.slice(start, end);
    for (let i = 0; i < renderBullets.length; i++) {
      if (!destroyedBullets.has(start + i)) {
        const p = ((seek - renderBullets[i].ms) / ((bpm * 40) / speed / renderBullets[i].speed)) * 100;
        const left = renderBullets[i].direction == "L";
        let x = (left ? -1 : 1) * (100 - p);
        let y = 0;
        if (renderBullets[i].value == 0) {
          y = renderBullets[i].location + p * getTan(renderBullets[i].angle) * (left ? 1 : -1);
          trackMouseSelection(start + i, 1, renderBullets[i].value, x, y);
          drawBullet(renderBullets[i].value, x, y, renderBullets[i].angle + (left ? 0 : 180));
        } else {
          if (!circleBulletAngles[start + i]) circleBulletAngles[start + i] = calcAngleDegrees((left ? -100 : 100) - mouseX, renderBullets[i].location - mouseY);
          if (left) {
            if (110 > circleBulletAngles[start + i] && circleBulletAngles[start + i] > 0) circleBulletAngles[start + i] = 110;
            else if (0 > circleBulletAngles[start + i] && circleBulletAngles[start + i] > -110) circleBulletAngles[start + i] = -110;
          } else {
            if (70 < circleBulletAngles[start + i] && circleBulletAngles[start + i] > 0) circleBulletAngles[start + i] = 70;
            else if (0 > circleBulletAngles[start + i] && circleBulletAngles[start + i] < -70) circleBulletAngles[start + i] = -70;
          }
          y = renderBullets[i].location + p * getTan(circleBulletAngles[start + i]) * (left ? 1 : -1);
          trackMouseSelection(start + i, 1, renderBullets[i].value, x, y);
          drawBullet(renderBullets[i].value, x, y, "");
        }
      }
    }
  } catch (e) {
    if (e) {
      ctx.font = `500 ${canvas.height / 30}px Montserrat, Pretendard Variable`;
      ctx.fillStyle = "#F55";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(e, canvas.width / 100, canvas.height / 100);
      console.error(e);
    }
  }
  ctx.beginPath();
  if (localStorage.difficultySelection == 0) ctx.fillStyle = "#31A97E";
  else if (localStorage.difficultySelection == 1) ctx.fillStyle = "#F0C21D";
  else ctx.fillStyle = "#FF774B";
  ctx.rect(canvas.width * 0.92, canvas.height * 0.05, canvas.height / 15 + canvas.width * 0.004, canvas.height / 15 + canvas.width * 0.004);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = "#fff";
  ctx.rect(canvas.width * 0.92 - canvas.width * 0.002, canvas.height * 0.05 - canvas.width * 0.002, canvas.height / 15 + canvas.width * 0.004, canvas.height / 15 + canvas.width * 0.004);
  ctx.fill();
  ctx.drawImage(albumImg, canvas.width * 0.92, canvas.height * 0.05, canvas.height / 15, canvas.height / 15);
  if (Date.now() - scoreMs < 500) {
    displayScore += ((score - prevScore) / 500) * (Date.now() - scoreMs);
    prevScore = displayScore;
  } else {
    displayScore = score;
  }
  ctx.beginPath();
  ctx.font = `700 ${canvas.height / 25}px Montserrat, Pretendard Variable`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(numberWithCommas(`${Math.round(displayScore)}`.padStart(9, 0)), canvas.width * 0.92 - canvas.width * 0.01, canvas.height * 0.05);
  ctx.font = `${canvas.height / 40}px Montserrat, Pretendard Variable`;
  ctx.fillStyle = "#fff";
  ctx.fillText(`${combo}x`, canvas.width * 0.92 - canvas.width * 0.01, canvas.height * 0.05 + canvas.height / 25);
  drawCursor();

  drawKeyInput();

  if (effectMs != 0 && effectNum != -1) drawFinalEffect(effectNum);

  //new record
  if (newRecordTime != 0) {
    let p1 = easeOutQuad(Math.min(1, (Date.now() - newRecordTime) / 500));
    let p2 = easeOutQuad(Math.min(1, Math.max(0, (Date.now() - newRecordTime - 300) / 500)));
    if (newRecordTime + 5000 < Date.now()) {
      if (newRecordTime + 10000 < Date.now()) newRecordTime = 0;
      else ctx.globalAlpha = 1 - (Date.now() - newRecordTime - 5000) / 5000;
    }
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.rect(canvas.width * 0.85, canvas.height * 0.2, canvas.width * 0.15, canvas.height * 0.06);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#000000";
    ctx.font = `italic 600 ${canvas.height / 40}px Montserrat, Pretendard Variable`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("NEW RECORD!", canvas.width * 0.87, canvas.height * 0.23);
    ctx.beginPath();
    ctx.clearRect(canvas.width * 0.85 - 1, canvas.height * 0.2 - 1, canvas.width * 0.15 - canvas.width * 0.145 * p2 + 1, canvas.height * 0.06 + 2);
    ctx.fillStyle = "#35C692";
    ctx.rect(canvas.width - canvas.width * 0.15 * p1, canvas.height * 0.2, canvas.width * 0.15 * p1 - canvas.width * 0.145 * p2, canvas.height * 0.06);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  //fps counter
  if (frameCounter) {
    frameArray.push(1000 / (Date.now() - frameCounterMs));
    if (frameArray.length == 20) {
      fps =
        frameArray.reduce((sum, current) => {
          return sum + current;
        }, 0) / 20;
      frameArray = [];
    }
    // ctx.font = "2.5vh Heebo";
    // ctx.fillStyle = "#555";
    // ctx.textBaseline = "bottom";
    // ctx.fillText(
    //   fps.toFixed(),
    //   canvas.width / 2,
    //   canvas.height - canvas.height / 70
    // );
    frameCounterMs = Date.now();
  }
  drawCursor();
  requestAnimationFrame(cntRender);
};

const drawFinalEffect = (i) => {
  const duration = 2000;
  ctx.beginPath();
  const text = i == 0 ? "ALL PERFECT" : "FULL COMBO";
  const p = easeOutQuart(Math.min(1, (Date.now() - effectMs) / duration));
  const alpha = Math.max(0, Math.min((Date.now() - effectMs) / 200, Math.min(1, (effectMs + duration - 500 - Date.now()) / 500)));
  ctx.globalAlpha = alpha;
  let effectStartX = (-1 * canvas.width) / 5;
  let effectFinalX = -1 * (canvas.width / 20);
  let effectX = effectStartX + (effectFinalX - effectStartX) * p;
  let effectY = -1 * (canvas.height / 20);
  ctx.font = `800 ${canvas.height / 5}px Montserrat`;
  let grd = ctx.createLinearGradient(effectX, effectY, effectX, effectY + canvas.height / 5);
  grd.addColorStop(0, `rgba(255, 255, 255, 0.2)`);
  grd.addColorStop(1, `rgba(255, 255, 255, 0)`);
  ctx.fillStyle = grd;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(text, effectX, effectY);

  ctx.beginPath();
  effectStartX = canvas.width + canvas.width / 5;
  effectFinalX = canvas.width + canvas.width / 20;
  effectX = effectStartX + (effectFinalX - effectStartX) * p;
  effectY = canvas.height + canvas.height / 20;
  grd = ctx.createLinearGradient(effectX, effectY - canvas.height / 5, effectX, effectY);
  grd.addColorStop(0, `rgba(255, 255, 255, 0.2)`);
  grd.addColorStop(1, `rgba(255, 255, 255, 0)`);
  ctx.fillStyle = grd;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(text, effectX, effectY);
  ctx.globalAlpha = 1;

  ctx.beginPath();
  let mainTextX = canvas.width / 2;
  let mainTextY = canvas.height / 2;
  let mainTextSizeStart = canvas.height / 5;
  let mainTextSizeFinal = canvas.height / 7;
  let outlineTextSizeStart = canvas.height / 4;
  let outlineTextSizeFinal = canvas.height / 5;
  let mainTextSize = mainTextSizeStart + (mainTextSizeFinal - mainTextSizeStart) * p;
  let outlineTextSize = outlineTextSizeStart + (outlineTextSizeFinal - outlineTextSizeStart) * p;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  if (i == 0) {
    grd = ctx.createLinearGradient(mainTextX, mainTextY - outlineTextSize / 2, mainTextX, mainTextY + outlineTextSize / 2);
    grd.addColorStop(0, `rgba(245, 129, 255, ${alpha / 3})`);
    grd.addColorStop(0.5, `rgba(119, 182, 244, ${alpha / 3})`);
    grd.addColorStop(1, `rgba(67, 221, 166, ${alpha / 3})`);
    ctx.strokeStyle = grd;
  } else if (i == 1) {
    ctx.strokeStyle = `rgba(240, 194, 29, ${alpha / 3})`;
  }
  ctx.font = `800 ${outlineTextSize}px Montserrat`;
  ctx.lineWidth = canvas.height / 200;
  ctx.strokeText(text, mainTextX, mainTextY);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = `rgb(255, 255, 255)`;
  ctx.fillText(text, mainTextX, mainTextY);
  ctx.globalCompositeOperation = "source-over";
  if (i == 0) {
    grd = ctx.createLinearGradient(mainTextX, mainTextY - mainTextSize / 2, mainTextX, mainTextY + mainTextSize / 2);
    grd.addColorStop(0, `rgba(245, 129, 255, ${alpha})`);
    grd.addColorStop(0.5, `rgba(119, 182, 244, ${alpha})`);
    grd.addColorStop(1, `rgba(67, 221, 166, ${alpha})`);
    ctx.strokeStyle = grd;
  } else if (i == 1) {
    ctx.strokeStyle = `rgba(240, 194, 29, ${alpha})`;
  }
  ctx.font = `800 ${mainTextSize}px Montserrat`;
  ctx.lineWidth = canvas.height / 100;
  ctx.strokeText(text, mainTextX, mainTextY);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = `rgb(255, 255, 255)`;
  ctx.fillText(text, mainTextX, mainTextY);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.fillText(text, mainTextX, mainTextY);
  if (p == 1) effectMs = 0;
};

const trackMousePos = () => {
  let x = (event.clientX / canvas.offsetWidth) * 200 - 100;
  let y = (event.clientY / canvas.offsetHeight) * 200 - 100;
  mouseX = x * sens >= 100 ? 100 : x * sens <= -100 ? -100 : x * sens;
  mouseY = y * sens >= 100 ? 100 : y * sens <= -100 ? -100 : y * sens;
};

const calculateResult = () => {
  lottieAnim.stop();
  resultEffect.play();
  document.getElementById("perfectResult").textContent = perfect;
  document.getElementById("greatResult").textContent = great;
  document.getElementById("goodResult").textContent = good;
  document.getElementById("badResult").textContent = bad;
  document.getElementById("missResult").textContent = miss;
  document.getElementById("bulletResult").textContent = bullet;
  document.getElementById("scoreText").textContent = numberWithCommas(`${score}`);
  document.getElementById("comboText").textContent = `${maxCombo}x`;
  let accuracy = (((perfect + (great / 10) * 7 + good / 2 + (bad / 10) * 3) / (perfect + great + good + bad + miss + bullet)) * 100).toFixed(1);
  document.getElementById("accuracyText").textContent = `${accuracy}%`;
  let rank = "";
  if (accuracy >= 98 && bad == 0 && miss == 0 && bullet == 0) {
    rankImg.style.animationName = "rainbow";
    rank = "SS";
  } else if (accuracy >= 95) {
    rank = "S";
  } else if (accuracy >= 90) {
    rank = "A";
  } else if (accuracy >= 80) {
    rank = "B";
  } else if (accuracy >= 70) {
    rank = "C";
  } else {
    rank = "F";
  }
  rankImg.src = `/images/parts/elements/${rank}.png`;
  document.getElementById("scoreInfoRank").style.setProperty("--background", `url('/images/parts/elements/${rank}back.png')`);
  setTimeout(() => {
    document.getElementById("componentCanvas").style.opacity = "0";
  }, 500);
  setTimeout(() => {
    floatingArrowContainer.style.display = "flex";
    floatingArrowContainer.classList.toggle("arrowFade");
  }, 1000);
  setTimeout(() => {
    floatingResultContainer.style.display = "flex";
    floatingResultContainer.classList.toggle("resultFade");
  }, 1300);
  setTimeout(() => {
    scoreContainer.style.opacity = "1";
    scoreContainer.style.pointerEvents = "all";
  }, 2000);
  missCtx.beginPath();
  missCtx.fillStyle = "#FFF";
  missCtx.strokeStyle = "#FFF";
  missCtx.lineWidth = 5;
  missCtx.moveTo(0, missCanvas.height * 0.8);
  missCtx.lineTo(missCanvas.width, missCanvas.height * 0.8);
  missCtx.stroke();
  let length = song.duration() * 1000;
  missCtx.fillStyle = "#F00";
  missCtx.strokeStyle = "#FFF";
  missCtx.lineWidth = 2;
  for (let i = 0; i < missPoint.length; i++) {
    missCtx.beginPath();
    missCtx.arc(missCanvas.width * (missPoint[i] / length), missCanvas.height * 0.8, missCanvas.height * 0.1, 0, 2 * Math.PI);
    missCtx.fill();
    missCtx.stroke();
  }
  if (missPoint.length == 0) {
    missCtx.fillStyle = "#FFF";
    missCtx.font = `500 ${canvas.height / 30}px Montserrat, Pretendard Variable`;
    missCtx.textAlign = "right";
    missCtx.textBaseline = "bottom";
    missCtx.fillText("Perfect!", missCanvas.width - 10, missCanvas.height * 0.8 - 10);
  }
  fetch(`${api}/playRecord`, {
    method: "PUT",
    credentials: "include",
    body: JSON.stringify({
      name: trackName,
      difficulty: Number(localStorage.difficultySelection) + 1,
      userid,
      userName,
      rank,
      score,
      maxCombo,
      perfect,
      great,
      good,
      bad,
      miss,
      bullet,
      accuracy,
      record,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.result == "success") {
        console.log("score submitted!");
      }
    })
    .catch((error) => {
      alert(`Error occured while submitting result.\n${error}`);
    });
};

const trackMouseSelection = (i, v1, v2, x, y) => {
  if (song.playing()) {
    const date = Date.now();
    const seek = (date - startDate - (offset + sync)) * rate;
    const powX = ((((mouseX - x) * canvas.offsetWidth) / 200) * pixelRatio * settings.display.canvasRes) / 100;
    const powY = ((((mouseY - y) * canvas.offsetHeight) / 200) * pixelRatio * settings.display.canvasRes) / 100;
    const p = v1 == 0 ? (((bpm * 14) / speed - (pattern.patterns[i].ms - seek)) / ((bpm * 14) / speed)) * 100 : 0;
    switch (v1) {
      case 0:
        if (Math.sqrt(Math.pow(powX, 2) + Math.pow(powY, 2)) <= canvas.width / 40 + canvas.width / 70 && p <= 120) {
          pointingCntElement = [];
          pointingCntElement.push({ v1: v1, v2: v2, i: i });
        }
        break;
      case 1:
        if (Math.sqrt(Math.pow(powX, 2) + Math.pow(powY, 2)) <= canvas.width / 80) {
          if (!destroyedBullets.has(i)) {
            bullet++;
            missPoint.push(song.seek() * 1000);
            combo = 0;
            medalCheck(medal);
            callBulletDestroy(i);
            colorOverlayContainer.classList.add("show");
            setTimeout(() => {
              colorOverlayContainer.classList.remove("show");
            }, 100);
            record.push([record.length, pointingCntElement[0].v1, pointingCntElement[0].v2, pointingCntElement[0].i, mouseX, mouseY, "bullet", song.seek() * 1000]);
            keyInput.push({ judge: "Bullet", key: "-", time: Date.now() });
          }
        }
        break;
      default:
        ctx.font = `500 ${canvas.height / 30}px Montserrat, Pretendard Variable`;
        ctx.fillStyle = "#F55";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`trackMouseSelection:Undefined element.`, canvas.width / 100, canvas.height / 100);
        console.error(`trackMouseSelection:Undefined element.`);
    }
  }
};

const compClicked = (isTyped, key, isWheel) => {
  if ((!isTyped && !settings.input.mouse && !isWheel) || isMenuOpened || !menuAllowed || mouseClicked == key) {
    return;
  }
  let d = Date.now();
  if (!song.playing() && isPaused) {
    isPaused = false;
    startDate = startDate + d - pauseDate;
    floatingResumeContainer.style.opacity = 0;
    setTimeout(() => {
      floatingResumeContainer.style.display = "none";
    }, 300);
    song.play();
    lottieAnim.play();
  }
  if (key && !isWheel) mouseClicked = key;
  else if (!isWheel) mouseClicked = true;
  mouseClickedMs = Date.now();
  for (let i = 0; i < pointingCntElement.length; i++) {
    if (pointingCntElement[i].v1 === 0 && !destroyedNotes.has(pointingCntElement[i].i) && ((pointingCntElement[i].v2 === 0) == !isWheel || pointingCntElement[i].v2 === 2)) {
      if (pointingCntElement[i].v2 == 1 && pattern.patterns[pointingCntElement[i].i].direction != key) return;
      drawParticle(1, pattern.patterns[pointingCntElement[i].i].x, pattern.patterns[pointingCntElement[i].i].y, 0, pointingCntElement[i].v2);
      let date = d;
      const seek = (date - startDate - (offset + sync)) * rate;
      let ms = pattern.patterns[pointingCntElement[i].i].ms;
      let perfectJudge = (60000 / bpm / 6) * rate;
      let greatJudge = (60000 / bpm / 4) * rate;
      let goodJudge = (60000 / bpm / 2) * rate;
      let badJudge = (60000 / bpm) * rate;
      let x = pattern.patterns[pointingCntElement[i].i].x;
      let y = pattern.patterns[pointingCntElement[i].i].y;
      let judge = "Perfect";
      if (pattern.patterns[pointingCntElement[i].i].value != 1) {
        if (seek < ms + perfectJudge && seek > ms - perfectJudge) {
          judge = "Perfect";
          perfect++;
        } else if (seek < ms + greatJudge && seek > ms - greatJudge) {
          judge = "Great";
          great++;
        } else if (seek > ms - goodJudge && seek < ms) {
          judge = "Good";
          good++;
        } else if ((seek > ms - badJudge && seek < ms) || ms < seek) {
          judge = "Bad";
          bad++;
        } else {
          judge = "Miss";
          miss++;
        }
      }
      if (pattern.patterns[pointingCntElement[i].i].value == 2) {
        grabbedNotes.add(pointingCntElement[i].i);
        keyPressing[key] = pointingCntElement[i].i;
      }
      calculateScore(judge, pointingCntElement[i].i);
      drawParticle(3, x, y, judge);
      record.push([record.length, pointingCntElement[0].v1, pointingCntElement[0].v2, pointingCntElement[0].i, mouseX, mouseY, judge, seek]);
      keyInput.push({ judge, key: isWheel ? (key == 1 ? "↑" : "↓") : key != undefined ? key : "•", time: Date.now() });
      return;
    }
  }
  keyInput.push({ judge: "Empty", key: isWheel ? (key == 1 ? "↑" : "↓") : key != undefined ? key : "•", time: Date.now() });
  drawParticle(2, mouseX, mouseY);
};

const compReleased = () => {
  mouseClicked = false;
  mouseClickedMs = Date.now();
};

const calculateScore = (judge, i, ignoreMs) => {
  judge = judge.toLowerCase();
  scoreMs = Date.now();
  prevScore = displayScore;
  destroyedNotes.add(i);
  if (!ignoreMs) {
    pattern.patterns[i].ms = song.seek() * 1000 - (offset + sync);
  }
  if (judge == "miss") {
    medalCheck(medal);
    combo = 0;
  } else {
    tick.play();
    combo++;
    if (maxCombo < combo) {
      maxCombo = combo;
    }
    let basicScore = 100000000 / patternLength;
    const rateCalc = rate * 0.5 + 0.5;
    if (judge == "perfect") {
      score += Math.round((basicScore + combo * 5) * rateCalc);
    } else {
      medalCheck(medal - 1);
      if (judge == "great") {
        score += Math.round((basicScore * 0.5 + combo * 5) * rateCalc);
      } else if (judge == "good") {
        score += Math.round((basicScore * 0.2 + combo * 3) * rateCalc);
      } else {
        combo = 0;
        medalCheck(medal);
        score += Math.round(basicScore * 0.05 * rateCalc);
      }
    }
    if (combo % comboCount == 0 && combo != 0) {
      comboAlertMs = Date.now();
      comboAlertCount = combo;
    }
  }
  if (i == patternLength - 1) {
    if (localStorage.record < score) {
      newRecordTime = Date.now();
    }
  }
};
if (i == patternLength - 1) {
  destroyAll();
  effectMs = Date.now();
  if (perfect != 0 && great == 0 && good == 0 && bad == 0 && miss == 0 && bullet == 0) {
    effectNum = 0;
  } else if (bad == 0 && miss == 0 && bullet == 0) {
    effectNum = 1;
  }
}

Pace.on("done", () => {
  if (paceLoaded) return;
  if (load == 1) {
    doneLoading();
  }
  paceLoaded++;
  load++;
});

const doneLoading = () => {
  setTimeout(() => {
    cntRender();
    document.getElementById("componentCanvas").style.opacity = "1";
    document.getElementById("loadingContainer").style.opacity = "0";
    document.querySelectorAll(".medal").forEach((e) => {
      e.style.opacity = "1";
    });
    setTimeout(() => {
      document.getElementById("loadingContainer").style.display = "none";
      document.getElementById("componentCanvas").style.transitionDuration = "0s";
    }, 1000);
    setTimeout(() => {
      song.play();
      lottieAnim.play();
      menuAllowed = true;
      startDate = Date.now();
    }, 4000);
  }, 1000);
};

const resume = () => {
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
    });
  menuContainer.style.display = "none";
  isMenuOpened = false;
  floatingResumeContainer.style.display = "flex";
  floatingResumeContainer.style.opacity = 1;
};

const retry = () => {
  if (isResultShowing) localStorage.setItem("retry", score);
  location.reload();
};

const home = () => {
  window.location.href = `${url}/game?initialize=1`;
};

const settingChanged = (e, v) => {
  if (v == "volumeMaster") {
    settings.sound.volume.master = e.value / 100;
    volumeMasterValue.textContent = e.value + "%";
    document.getElementsByClassName("volumeMaster")[0].value = Math.round(settings.sound.volume.master * 100);
    overlayTime = Date.now();
    setTimeout(() => {
      overlayClose("volume");
    }, 1500);
    Howler.volume(settings.sound.volume.master);
  }
};

const overlayClose = (s) => {
  if (s == "volume") {
    if (overlayTime + 1400 <= Date.now()) {
      volumeOverlay.classList.remove("overlayOpen");
    }
  }
};

let scrollTimer = 0;

const globalScrollEvent = (e) => {
  if (scrollTimer == 0) {
    scrollTimer = 1;
    setTimeout(() => {
      scrollTimer = 0;
    }, 50);
    let delta = 0;
    if (e.deltaY != 0) delta = Math.max(-1, Math.min(1, e.deltaY));
    else delta = Math.max(-1, Math.min(1, e.deltaX));
    if (settings.input.wheelReverse) delta *= -1;
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
      document.getElementsByClassName("volumeMaster")[0].value = Math.round(settings.sound.volume.master * 100);
      volumeMasterValue.textContent = `${Math.round(settings.sound.volume.master * 100)}%`;
      Howler.volume(settings.sound.volume.master);
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
    } else {
      if (delta == 1) {
        //UP
        compClicked(false, 1, true);
      } else {
        //DOWN
        compClicked(false, -1, true);
      }
    }
  }
};

const medalCheck = (n) => {
  for (let i = 0; i <= n; i++) {
    document.getElementsByClassName("medal")[medal].classList.add("hide");
    medal--;
  }
};

document.onkeydown = (e) => {
  e = e || window.event;
  if (e.key == "Shift") {
    shiftDown = true;
  }
  if (!isResultShowing) {
    if (e.key == "Escape") {
      e.preventDefault();
      if (menuAllowed) {
        if (menuContainer.style.display == "none") {
          if (song.playing()) pauseDate = Date.now();
          isPaused = true;
          floatingResumeContainer.style.opacity = 0;
          floatingResumeContainer.style.display = "none";
          isMenuOpened = true;
          menuContainer.style.display = "flex";
          song.pause();
          lottieAnim.pause();
        } else {
          resume();
        }
      }
      return;
    }
    if (inputMode == 1 && !/^[a-z]{1}$/i.test(e.key)) {
      return;
    } else if (inputMode == 2 && !(e.code == "KeyZ" || e.code == "KeyX")) {
      return;
    }
    compClicked(true, e.key, false);
  }
};

document.onkeyup = (e) => {
  e = e || window.event;
  let date = Date.now();
  const seek = (date - startDate - (offset + sync)) * rate;
  if (e.key == "Escape") {
    return;
  } else if (e.key == "Shift") {
    shiftDown = false;
  }
  mouseClicked = false;
  mouseClickedMs = date;
  if (keyPressing.hasOwnProperty(e.key) && grabbedNotes.has(keyPressing[e.key]) && !grabbedNotes.has(`${keyPressing[e.key]}!`)) {
    grabbedNotes.delete(keyPressing[e.key]);
    grabbedNotes.add(`${keyPressing[e.key]}!`);
    if (pattern.patterns[keyPressing[e.key]].ms + pattern.patterns[keyPressing[e.key]].time - (60000 / bpm / 3) * rate > seek) {
      medalCheck(medal);
      pattern.patterns[keyPressing[e.key]].ms = song.seek() * 1000 - pattern.patterns[keyPressing[e.key]].time - (offset + sync);
      calculateScore("Miss", keyPressing[e.key], true);
      missParticles.push({
        x: pattern.patterns[keyPressing[e.key]].x,
        y: pattern.patterns[keyPressing[e.key]].y,
        s: Date.now(),
      });
      miss++;
      missPoint.push(song.seek() * 1000);
    } else {
      perfectParticles.push({ x: pattern.patterns[keyPressing[e.key]].x, y: pattern.patterns[keyPressing[e.key]].y, s: Date.now() });
      calculateScore("Perfect", keyPressing[e.key], true);
      keyInput.push({ judge: "Perfect", key: "-", time: Date.now() });
    }
    delete keyPressing[e.key];
  }
};

window.addEventListener("resize", () => {
  initialize(false);
});

window.addEventListener("blur", () => {
  if (menuAllowed) {
    if (menuContainer.style.display == "none") {
      if (song.playing()) pauseDate = Date.now();
      isPaused = true;
      floatingResumeContainer.style.opacity = 0;
      floatingResumeContainer.style.display = "none";
      isMenuOpened = true;
      menuContainer.style.display = "flex";
      song.pause();
      lottieAnim.pause();
    }
  }
});

window.addEventListener("wheel", globalScrollEvent);
