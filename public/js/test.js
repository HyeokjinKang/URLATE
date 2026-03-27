/* global Pace, Howler, Howl, url, cdn, api */
let upperBound, lowerBound, numberWithCommas, easeOutSine;
let Factory, Updater, Renderer;
(async () => {
  try {
    const [utils, factory, updater, renderer] = await Promise.all([import("../modules/utils.js"), import("../modules/factory.js"), import("../modules/updater.js"), import("../modules/renderer.js")]);

    ({ upperBound, lowerBound, numberWithCommas, easeOutSine } = utils);
    Factory = factory.default;
    Updater = updater.default;
    Renderer = renderer.default;

    console.log("Modules are ready.");
  } catch (err) {
    console.error("Error occured while loading modules: ", err);
  }
})();

const menuContainer = document.getElementById("menuContainer");
const canvasBackground = document.getElementById("canvasBackground");
const canvasContainer = document.getElementById("canvasContainer");
const rankImg = document.getElementById("rankImg");
const floatingArrowContainer = document.getElementById("floatingArrowContainer");
const floatingResultContainer = document.getElementById("floatingResultContainer");
const scoreContainer = document.getElementById("scoreContainer");
const blackOverlayContainer = document.getElementById("blackOverlayContainer");
const colorOverlayContainer = document.getElementById("colorOverlayContainer");
const floatingResumeContainer = document.getElementById("floatingResumeContainer");
const volumeMasterValue = document.getElementById("volumeMasterValue");
const volumeOverlay = document.getElementById("volumeOverlay");
const canvas = document.getElementById("componentCanvas");
const ctx = canvas.getContext("2d");
const missCanvas = document.getElementById("missPointCanvas");
const missCtx = missCanvas.getContext("2d");
const volumeMasterInput = document.getElementsByClassName("volumeMaster")[0];
const medals = Array.from(document.getElementsByClassName("medal"));
let Draw;
let background;
let pattern = {};
let patternLength = 0;
let settings, sync, song, tracks, pixelRatio, offset, bpm, speed;
let audioLatency = 0;
let bpmsync = {
  ms: 0,
  beat: 0,
};
let pointingCntElement = [{ v1: "", v2: "", i: "" }];
let clickParticles = [];
let destroyParticles = [];
let judgeParticles = [];
let createdBullets = new Set([]);
let destroyedBullets = new Set([]);
let explodingBullets = new Set([]);
let destroyedNotes = new Set([]);
let grabbedNotes = new Set([]);
let noteMaxDuration = 0;
let endBeat = null;
let bulletCreationSpeeds = [];
let mouseX = 0,
  mouseY = 0;
let rawX = 0,
  rawY = 0;
let score = 0,
  combo = 0,
  maxCombo = 0;
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
let overlayTime = 0;
let shiftDown = false;
let currentTriggerIndex = 0;
let nowSpeed = 1;
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
let isPaused = false;
let rate = 1;
let keyInput = [];
let keyInputMemory = 0;
let keyInputTime = 0;
let effectMs = 0;
let effectNum = -1;
let keyPressing = {};
let pressingKeys = [];
let medal = 1;
let globalAlpha = 1;
let canvasW = 0,
  canvasH = 0,
  canvasOW = 0,
  canvasOH = 0;
const FONT_STACK = "Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard";
let UIFontNormal = "";
const albumImg = new Image();

document.addEventListener("DOMContentLoaded", () => {
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

const calcBeats = () => Number((bpmsync.beat + (song.seek() * 1000 - (offset + sync + audioLatency * 1000) - bpmsync.ms) / (60000 / bpm)).toPrecision(10));

const calcBulletCreationSpeeds = () =>
  pattern.bullets.map((b) => {
    const end = upperBound(pattern.triggers, b.beat);
    let cs = pattern.information.speed;
    for (let k = 0; k < end; k++) {
      if (pattern.triggers[k].value == 4) cs = pattern.triggers[k].speed;
    }
    return cs;
  });

const initialize = (isFirstCalled) => {
  canvasW = (window.innerWidth * pixelRatio * settings.display.canvasRes) / 100;
  canvasH = (window.innerHeight * pixelRatio * settings.display.canvasRes) / 100;
  canvas.width = canvasW;
  canvas.height = canvasH;
  UIFontNormal = `500 ${canvasH / 30}px ${FONT_STACK}`;

  if (Draw) Draw.setSize({ canvasW, canvasH });

  canvasOW = canvas.offsetWidth;
  canvasOH = canvas.offsetHeight;

  missCanvas.width = window.innerWidth * 0.2 * pixelRatio;
  missCanvas.height = window.innerHeight * 0.05 * pixelRatio;

  if (isFirstCalled) {
    pattern = JSON.parse(localStorage.pattern);
    patternLength = pattern.patterns.length;

    noteMaxDuration = 0;
    for (const note of pattern.patterns) {
      if (note.duration && note.duration > noteMaxDuration) {
        noteMaxDuration = note.duration;
      }
    }
    noteMaxDuration += 4;

    const findEnd = pattern.triggers.find((t) => t.value == 6);
    endBeat = findEnd ? findEnd.beat : null;

    bulletCreationSpeeds = calcBulletCreationSpeeds();

    document.getElementById("artist").textContent = pattern.information.producer;
    document.getElementById("scoreArtist").textContent = pattern.information.producer;
    document.getElementById("authorNamespace").textContent = pattern.information.author;
    document.getElementById("authorComment").textContent = pattern.information.comment;
    fetch(`${api}/profilePic/${pattern.information.author}`)
      .then((res) => res.json())
      .then((data) => {
        document.getElementById("authorIcon").src = data.picture;
      });
    offset = pattern.information.offset;
    bpm = pattern.information.bpm;
    speed = pattern.information.speed;
    nowSpeed = pattern.information.speed;
    bpmsync = {
      ms: 0,
      beat: 0,
    };
    currentTriggerIndex = 0;
    background = new URLSearchParams(window.location.search).get("background");
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].name == pattern.information.track) {
        document.getElementById("scoreTitle").textContent = settings.general.detailLang == "original" ? tracks[i].originalName : tracks[i].name;
        document.getElementById("title").textContent = settings.general.detailLang == "original" ? tracks[i].originalName : tracks[i].name;
        fileName = tracks[i].fileName;
        document.getElementById("albumContainer").style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${fileName}.webp")`;
        if (background !== "0") document.getElementById("canvasBackground").style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${fileName}.webp")`;
        else canvasBackground.style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/urlate.webp")`;
        document.getElementById("scoreBackground").style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${fileName}.webp")`;
        document.getElementById("scoreAlbum").style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${fileName}.webp")`;
        albumImg.src = `${cdn}/albums/${settings.display.albumRes}/${fileName}.webp`;
        break;
      }
    }
    fetch(`${cdn}/skins/${settings.game.skin}.json`)
      .then((res) => res.json())
      .then((data) => {
        skin = data;
        Draw = new Renderer(ctx, { canvasW, canvasH, cursorZoom: settings.game.size }, skin);
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
        calculateResult();
      },
      onload: () => {
        Howler.autoSuspend = false;
        Howler.volume(settings.sound.volume.master);
        song.volume(settings.sound.volume.music);
        let rate = new URLSearchParams(window.location.search).get("rate");
        song.rate(rate ? parseFloat(rate) : 1);
        if (load == 1) {
          doneLoading();
        }
        load++;
      },
    });
  }
};

const settingApply = () => {
  tick.volume(settings.sound.volume.hitSound);
  resultEffect.volume(settings.sound.volume.effect);
  sync = parseInt(settings.sound.offset);
  document.getElementById("loadingContainer").style.opacity = 1;
  document.getElementById("canvasBackground").style.opacity = 1;
  sens = settings.input.sens;
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
  volumeMasterInput.value = Math.round(settings.sound.volume.master * 100);
  volumeMasterValue.textContent = Math.round(settings.sound.volume.master * 100) + "%";
};

const playSong = () => {
  song.play();

  const ctx = Howler.ctx;
  audioLatency = (ctx?.outputLatency ?? 0) + (ctx?.baseLatency ?? 0);
};

const eraseCnt = () => {
  ctx.clearRect(0, 0, canvasW, canvasH);
};

const destroyAll = (beat) => {
  const end = upperBound(pattern.bullets, beat);
  for (let j = 0; j < end; j++) {
    if (!destroyedBullets.has(j)) {
      explodingBullets.add(j);
      destroyedBullets.add(j);
    }
  }
};

const cntRender = () => {
  requestAnimationFrame(cntRender);
  try {
    if (!Draw) return;
    const now = Date.now();
    const seekMs = song.seek() * 1000;
    const beats = calcBeats();

    if (window.devicePixelRatio != pixelRatio) {
      pixelRatio = window.devicePixelRatio;
      initialize(false);
    }

    eraseCnt();
    explodingBullets.clear();
    ctx.globalAlpha = 1;

    let mouseCalcX = ((rawX / canvasOW) * 200 - 100) * sens;
    let mouseCalcY = ((rawY / canvasOH) * 200 - 100) * sens;
    mouseX = mouseCalcX >= 100 ? 100 : mouseCalcX <= -100 ? -100 : mouseCalcX;
    mouseY = mouseCalcY >= 100 ? 100 : mouseCalcY <= -100 ? -100 : mouseCalcY;

    if (isResultShowing) {
      if (resultMs == 0) {
        resultMs = now;
      }
    }

    if (resultMs != 0 && resultMs + 500 <= now) return;

    if (comboAlert) {
      let comboOpacity = 0;
      let fontSize = 20;
      if (comboAlertMs + 400 > now) {
        comboOpacity = (now - comboAlertMs) / 1200;
      } else if (comboAlertMs + 400 <= now && comboAlertMs + 600 > now) {
        comboOpacity = 0.33;
      } else if (comboAlertMs + 600 <= now && comboAlertMs + 1000 > now) {
        comboOpacity = (comboAlertMs + 1000 - now) / 1200;
      }
      fontSize = (canvasH / 5) * easeOutSine((now - comboAlertMs) / 1000);
      ctx.beginPath();
      ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
      ctx.fillStyle = `rgba(200,200,200,${comboOpacity})`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(comboAlertCount, canvasW / 2, canvasH / 2);
    }

    ctx.lineWidth = 5;
    pointingCntElement = [{ v1: "", v2: "", i: "" }];

    // 최적화된 트리거 처리 루프
    const renderTexts = [];

    while (currentTriggerIndex < pattern.triggers.length && pattern.triggers[currentTriggerIndex].beat <= beats) {
      const trigger = pattern.triggers[currentTriggerIndex];
      if (trigger.value == 0) {
        if (!destroyedBullets.has(trigger.num)) {
          explodingBullets.add(trigger.num);
          destroyedBullets.add(trigger.num);
        }
      } else if (trigger.value == 1) {
        destroyAll(trigger.beat);
      } else if (trigger.value == 2) {
        bpmsync.ms = bpmsync.ms + (trigger.beat - bpmsync.beat) * (60000 / bpm);
        bpm = trigger.bpm;
        bpmsync.beat = trigger.beat;
      } else if (trigger.value == 3) {
        globalAlpha = trigger.opacity;
      } else if (trigger.value == 4) {
        nowSpeed = trigger.speed;
      } else if (trigger.value == 6) {
        calculateResult();
      }
      currentTriggerIndex++;
    }

    let textEnd = upperBound(pattern.triggers, beats);
    let textStart = lowerBound(pattern.triggers, beats - 32);
    for (let i = textStart; i < textEnd; i++) {
      if (pattern.triggers[i].value == 5) {
        if (pattern.triggers[i].beat <= beats && beats <= pattern.triggers[i].beat + pattern.triggers[i].duration) {
          renderTexts.push(pattern.triggers[i]);
        }
      }
    }

    ctx.globalAlpha = globalAlpha;

    for (let textObj of renderTexts) Draw.triggerText(textObj);

    let renderDuration = 5 / speed;

    let start = lowerBound(pattern.patterns, beats - noteMaxDuration);
    let end = upperBound(pattern.patterns, beats + renderDuration);
    for (let i = start; i < end; i++) {
      const p = (1 - (pattern.patterns[i].beat - beats) / renderDuration) * 100;
      if (p >= 50) {
        trackMouseSelection(i, 0, pattern.patterns[i].value, pattern.patterns[i].x, pattern.patterns[i].y, beats, seekMs);
      }
    }
    const _noteState = { progress: 0, tailProgress: 0, endProgress: 0, globalAlpha, isGrabbed: false };
    for (let i = end - 1; i >= start; i--) {
      Updater.noteProgress(pattern.patterns[i], beats, speed, _noteState);
      _noteState.globalAlpha = globalAlpha;
      _noteState.isGrabbed = grabbedNotes.has(i);
      Draw.note(pattern.patterns[i], _noteState);

      if (_noteState.progress >= 120 && !destroyedNotes.has(i) && (pattern.patterns[i].value == 2 ? !(grabbedNotes.has(i) || grabbedNotes.has(`${i}!`)) : true)) {
        calculateScore("miss", i, true);
        judgeParticles.push(Factory.createJudge(pattern.patterns[i].x, pattern.patterns[i].y, judgeSkin, "Miss"));
        miss++;
        showOverlay();
        missPoint.push(seekMs);
        keyInput.push({ judge: "Miss", key: "-", time: now });
      } else if (_noteState.tailProgress >= 100 && grabbedNotes.has(i) && !grabbedNotes.has(`${i}!`) && pattern.patterns[i].value == 2) {
        grabbedNotes.add(`${i}!`);
        grabbedNotes.delete(i);
        judgeParticles.push(Factory.createJudge(pattern.patterns[i].x, pattern.patterns[i].y, judgeSkin, "Perfect"));
        calculateScore("Perfect", i, true);
        keyInput.push({ judge: "Perfect", key: "-", time: now });
      }
    }
    start = lowerBound(pattern.bullets, beats - 32);
    end = upperBound(pattern.bullets, beats);
    for (let i = start; i < end; i++) {
      if (!destroyedBullets.has(i) || explodingBullets.has(i)) {
        const bullet = pattern.bullets[i];

        const pos = Updater.bulletPos(bullet, beats, pattern.triggers, pattern.information.speed, bulletCreationSpeeds[i]);

        if (!createdBullets.has(i) || explodingBullets.has(i)) {
          destroyParticles.push(...Factory.createExplosions(pos.x, pos.y));
          if (explodingBullets.has(i)) continue;
        }
        createdBullets.add(i);

        trackMouseSelection(i, 1, 0, pos.x, pos.y, beats, seekMs);

        Draw.bullet(pos);
      }
    }

    let displayFPS;
    if (frameCounter) {
      frameArray.push(1000 / (now - frameCounterMs));
      if (frameArray.length == 10) {
        fps = frameArray.reduce((sum, v) => sum + v, 0) / 10;
        frameArray = [];
      }
      displayFPS = fps.toFixed();
      frameCounterMs = now;
    }

    if (keyInput.length > 0 && keyInputMemory != keyInput.length) {
      if (keyInput.length > 12) {
        keyInput.splice(0, keyInput.length - 12);
      }
      keyInputMemory = keyInput.length;
      keyInputTime = now;
    }

    let percentage = 0;
    if (endBeat !== null) percentage = Math.min(1, beats / endBeat);
    else percentage = seekMs / (song.duration() * 1000);

    Updater.particles(destroyParticles);
    Updater.particles(clickParticles);
    Updater.particles(judgeParticles, settings.game.applyJudge);

    Draw.explosions(destroyParticles);
    Draw.clickEffects(clickParticles);
    Draw.judges(judgeParticles);

    Draw.keyInputUI(keyInput, keyInputTime);
    Draw.scorePanelUI({ score, combo, difficulty: 3 }, albumImg);
    Draw.systemInfoUI({ speed: nowSpeed, bpm, fps: displayFPS });
    Draw.progressBarUI(percentage);

    Draw.cursor({ x: mouseX, y: mouseY }, { isClicked: mouseClicked != false, clickedMs: mouseClickedMs });

    if (effectMs != 0 && effectNum != -1) {
      Draw.finalEffect(effectNum, effectMs);
      if (now - effectMs >= 2000) effectMs = 0;
    }
  } catch (e) {
    if (e) {
      ctx.font = UIFontNormal;
      ctx.fillStyle = "#F55";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(e, canvasW / 100, canvasH / 100);
      console.error(e);
    }
  }
};

const trackMousePos = (e) => {
  rawX = e.clientX;
  rawY = e.clientY;
};

const calculateResult = () => {
  if (isResultShowing) return;
  isResultShowing = true;
  menuAllowed = false;
  if (!song.playing()) resultEffect.play();
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
  let rank;
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
  rankImg.src = `/images/parts/elements/${rank}.webp`;
  document.getElementById("scoreInfoRank").style.setProperty("--background", `url('/images/parts/elements/${rank}back.webp')`);
  setTimeout(
    () => {
      canvasContainer.style.opacity = "0";
    },
    song.playing() ? 0 : 500,
  );
  setTimeout(
    () => {
      floatingArrowContainer.style.display = "flex";
      floatingArrowContainer.classList.toggle("arrowFade");
    },
    song.playing() ? 0 : 1000,
  );
  setTimeout(
    () => {
      floatingResultContainer.style.display = "flex";
      floatingResultContainer.classList.toggle("resultFade");
    },
    song.playing() ? 300 : 1300,
  );
  setTimeout(
    () => {
      scoreContainer.style.opacity = "1";
      scoreContainer.style.pointerEvents = "all";
    },
    song.playing() ? 1000 : 2000,
  );
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
    missCtx.font = UIFontNormal;
    missCtx.textAlign = "right";
    missCtx.textBaseline = "bottom";
    missCtx.fillText("Perfect!", missCanvas.width - 10, missCanvas.height * 0.8 - 10);
  }
};

const trackMouseSelection = (i, v1, v2, x, y, beats, seekMs) => {
  if (song.playing()) {
    const powX = ((((mouseX - x) * canvasOW) / 200) * pixelRatio * settings.display.canvasRes) / 100;
    const powY = ((((mouseY - y) * canvasOH) / 200) * pixelRatio * settings.display.canvasRes) / 100;
    const distSq = powX * powX + powY * powY;
    switch (v1) {
      case 0: {
        const p = (1 - (pattern.patterns[i].beat - beats) / (5 / speed)) * 100;
        const t = ((beats - pattern.patterns[i].beat) / pattern.patterns[i].duration) * 100;
        if (distSq <= (canvasW / 40) * (canvasW / 40) && (pattern.patterns[i].value == 2 ? t <= 100 : p <= 130) && p >= 0) {
          pointingCntElement.push({ v1, v2, i });
        }
        break;
      }
      case 1:
        if (distSq <= (canvasW / 80) * (canvasW / 80)) {
          if (!destroyedBullets.has(i)) {
            bullet++;
            missPoint.push(seekMs);
            combo = 0;
            medalCheck(medal);
            destroyParticles.push(...Factory.createExplosions(x, y));
            destroyedBullets.add(i);
            showOverlay();
            keyInput.push({ judge: "Bullet", key: "-", time: Date.now() });
          }
        }
        break;
      default:
        ctx.font = UIFontNormal;
        ctx.fillStyle = "#F55";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`trackMouseSelection:Undefined element.`, canvasW / 100, canvasH / 100);
        console.error(`trackMouseSelection:Undefined element.`);
    }
  }
};

const showOverlay = () => {
  colorOverlayContainer.classList.add("show");
  setTimeout(() => {
    colorOverlayContainer.classList.remove("show");
  }, 100);
};

const compClicked = (isTyped, key, isWheel) => {
  if ((!isTyped && !settings.input.mouse && !isWheel) || isMenuOpened || !menuAllowed || mouseClicked == key) {
    return;
  }
  if (!song.playing() && isPaused) {
    isPaused = false;
    floatingResumeContainer.style.opacity = 0;
    setTimeout(() => {
      floatingResumeContainer.style.display = "none";
    }, 300);
    playSong();
  }
  if (key && !isWheel) mouseClicked = key;
  else if (!isWheel) mouseClicked = true;
  mouseClickedMs = Date.now();
  const beats = calcBeats();
  for (let i = 0; i < pointingCntElement.length; i++) {
    const el = pointingCntElement[i];
    if (el.v1 === 0 && !destroyedNotes.has(el.i) && (el.v2 !== 1) == !isWheel) {
      const pNote = pattern.patterns[el.i];
      if (el.v2 == 1 && pNote.direction != key) return;
      clickParticles.push(Factory.createClickNote(pNote.x, pNote.y, el.v2));
      const beat = pNote.beat;
      const perfectJudge = (1 / 6) * rate;
      const greatJudge = (1 / 3) * rate;
      const goodJudge = (1 / 2) * rate;
      const badJudge = rate;
      const x = pNote.x;
      const y = pNote.y;
      let judge = "Perfect";
      if (pNote.value != 1) {
        if (beats <= beat + perfectJudge && beats >= beat - perfectJudge) {
          judge = "Perfect";
          perfect++;
        } else if (beats <= beat + greatJudge && beats >= beat - greatJudge) {
          judge = "Great";
          great++;
        } else if (beats >= beat - goodJudge && beats <= beat) {
          judge = "Good";
          good++;
        } else if ((beats >= beat - badJudge && beats <= beat) || beat <= beats) {
          judge = "Bad";
          bad++;
        } else {
          judge = "Miss";
          miss++;
          showOverlay();
        }
      }
      if (pNote.value == 2) {
        grabbedNotes.add(el.i);
        keyPressing[key] = el.i;
      }
      calculateScore(judge, el.i);
      judgeParticles.push(Factory.createJudge(x, y, judgeSkin, judge));
      keyInput.push({ judge, key: isWheel ? (key == 1 ? "↑" : "↓") : key != undefined ? key : "•", time: Date.now() });
      return;
    }
  }
  keyInput.push({ judge: "Empty", key: isWheel ? (key == 1 ? "↑" : "↓") : key != undefined ? key : "•", time: Date.now() });
  clickParticles.push(Factory.createClickDefault(mouseX, mouseY));
};

const calculateScore = (judge, i, ignoreMs) => {
  judge = judge.toLowerCase();
  destroyedNotes.add(i);
  if (!ignoreMs) {
    const beats = calcBeats();
    pattern.patterns[i].beat = beats;
  }
  if (judge == "miss") {
    combo = 0;
    medalCheck(medal);
    return;
  }
  tick.play();
  combo++;
  if (maxCombo < combo) {
    maxCombo = combo;
  }
  let basicScore = 100000000 / patternLength;
  let rateCalc;
  if (rate >= 1) {
    rateCalc = rate * 0.5 + 0.5;
  } else {
    rateCalc = rate * rate * 1.3 - 0.3;
  }
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
  if (i == patternLength - 1) {
    if (pattern.bullets.length) destroyAll(pattern.bullets[pattern.bullets.length - 1].beat);
    effectMs = Date.now();
    if (perfect != 0 && great == 0 && good == 0 && bad == 0 && miss == 0 && bullet == 0) {
      effectNum = 0;
    } else if (bad == 0 && miss == 0 && bullet == 0) {
      effectNum = 1;
    }
  }
};

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
    medals.forEach((e) => {
      e.style.opacity = "1";
    });
    setTimeout(() => {
      document.getElementById("loadingContainer").style.display = "none";
      document.getElementById("componentCanvas").style.transitionDuration = "0s";
      menuAllowed = true;
    }, 1000);
    setTimeout(() => {
      if (!isPaused && !song.playing()) {
        playSong();
      }
    }, 2000);
  }, 2000);
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

// eslint-disable-next-line no-unused-vars
const retry = () => {
  if (isResultShowing) return location.reload();
  blackOverlayContainer.classList.add("show");

  setTimeout(() => {
    Draw.initialize();
    song.stop();
    pattern = JSON.parse(localStorage.pattern);
    bulletCreationSpeeds = calcBulletCreationSpeeds();
    bpm = pattern.information.bpm;
    speed = pattern.information.speed;
    nowSpeed = pattern.information.speed;
    bpmsync = {
      ms: 0,
      beat: 0,
    };
    pointingCntElement = [{ v1: "", v2: "", i: "" }];
    clickParticles = [];
    destroyParticles = [];
    judgeParticles = [];
    createdBullets = new Set([]);
    destroyedBullets = new Set([]);
    explodingBullets = new Set([]);
    destroyedNotes = new Set([]);
    grabbedNotes = new Set([]);
    score = 0;
    combo = 0;
    maxCombo = 0;
    perfect = 0;
    great = 0;
    good = 0;
    bad = 0;
    miss = 0;
    bullet = 0;
    mouseClicked = false;
    mouseClickedMs = -1;
    resultMs = 0;
    missPoint = [];
    comboAlertMs = 0;
    comboAlertCount = 0;
    overlayTime = 0;
    keyInput = [];
    keyInputMemory = 0;
    keyInputTime = 0;
    effectMs = 0;
    effectNum = -1;
    keyPressing = {};
    pressingKeys = [];
    medal = 1;
    medals[0].classList.remove("hide");
    medals[1].classList.remove("hide");
    globalAlpha = 1;
    blackOverlayContainer.classList.remove("show");
    menuContainer.style.display = "none";
    isMenuOpened = false;
    isPaused = false;
    playSong();
  }, 100);
};

// eslint-disable-next-line no-unused-vars
const editor = () => {
  window.location.href = `${url}/editor${background == "0" ? "?background=0" : ""}`;
};

// eslint-disable-next-line no-unused-vars
const home = () => {
  window.location.href = `${url}/game?initialize=0`;
};

// eslint-disable-next-line no-unused-vars
const settingChanged = (e, v) => {
  if (v == "volumeMaster") {
    settings.sound.volume.master = e.value / 100;
    volumeMasterValue.textContent = e.value + "%";
    volumeMasterInput.value = Math.round(settings.sound.volume.master * 100);
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
let volumeSaveTimeout;

const globalScrollEvent = (e) => {
  if (scrollTimer == 0) {
    scrollTimer = 1;
    setTimeout(() => {
      scrollTimer = 0;
    }, 50);
    let delta;
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
      volumeMasterInput.value = Math.round(settings.sound.volume.master * 100);
      volumeMasterValue.textContent = `${Math.round(settings.sound.volume.master * 100)}%`;
      Howler.volume(settings.sound.volume.master);
      volumeOverlay.classList.add("overlayOpen");
      overlayTime = Date.now();
      setTimeout(() => {
        overlayClose("volume");
      }, 1500);
      clearTimeout(volumeSaveTimeout);
      volumeSaveTimeout = setTimeout(() => {
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
      }, 1000);
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
    medals[medal].classList.add("hide");
    medal--;
  }
};

const checkHoldNote = (key) => {
  const date = Date.now();
  const beats = calcBeats();
  mouseClicked = false;
  mouseClickedMs = date;
  if (pressingKeys.includes(key)) pressingKeys.splice(pressingKeys.indexOf(key), 1);
  if (Object.hasOwn(keyPressing, key) && grabbedNotes.has(keyPressing[key]) && !grabbedNotes.has(`${keyPressing[key]}!`)) {
    grabbedNotes.delete(keyPressing[key]);
    grabbedNotes.add(`${keyPressing[key]}!`);
    if (pattern.patterns[keyPressing[key]].beat + pattern.patterns[keyPressing[key]].duration - 1 / 3 > beats) {
      medalCheck(medal);
      pattern.patterns[keyPressing[key]].beat = beats - pattern.patterns[keyPressing[key]].duration;
      calculateScore("Miss", keyPressing[key], true);
      judgeParticles.push(Factory.createJudge(pattern.patterns[keyPressing[key]].x, pattern.patterns[keyPressing[key]].y, judgeSkin, "Miss"));
      miss++;
      showOverlay();
      missPoint.push(song.seek() * 1000);
      keyInput.push({ judge: "Miss", key: "-", time: date });
    } else {
      judgeParticles.push(Factory.createJudge(pattern.patterns[keyPressing[key]].x, pattern.patterns[keyPressing[key]].y, judgeSkin, "Perfect"));
      calculateScore("Perfect", keyPressing[key], true);
      keyInput.push({ judge: "Perfect", key: "-", time: date });
    }
    delete keyPressing[key];
  }
};

document.onkeydown = (e) => {
  e = e || window.event;
  if (e.repeat) return;
  if (pressingKeys.includes(e.key)) return;
  if (e.key == "Shift") {
    shiftDown = true;
  }
  if (!isResultShowing) {
    if (e.key == "Escape") {
      e.preventDefault();
      if (menuAllowed) {
        if (!isMenuOpened) {
          isPaused = true;
          floatingResumeContainer.style.opacity = 0;
          floatingResumeContainer.style.display = "none";
          isMenuOpened = true;
          menuContainer.style.display = "flex";
          song.pause();
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
    pressingKeys.push(e.key);
    compClicked(true, e.key, false);
  }
};

document.onkeyup = (e) => {
  e = e || window.event;
  if (e.key == "Escape") {
    return;
  } else if (e.key == "Shift") {
    shiftDown = false;
  }
  checkHoldNote(e.key);
};

window.addEventListener("resize", () => {
  initialize(false);
});

window.addEventListener("blur", () => {
  shiftDown = false;
  if (menuAllowed) {
    if (!isMenuOpened) {
      isPaused = true;
      floatingResumeContainer.style.opacity = 0;
      floatingResumeContainer.style.display = "none";
      isMenuOpened = true;
      menuContainer.style.display = "flex";
      song.pause();
    }
  }
});

window.addEventListener("wheel", globalScrollEvent);
document.getElementById("componentCanvas").addEventListener("pointermove", trackMousePos);
document.getElementById("componentCanvas").addEventListener("mousedown", (event) => {
  compClicked(false, `${event.button}mouse`, false);
});
document.getElementById("componentCanvas").addEventListener("mouseup", (event) => {
  checkHoldNote(`${event.button}mouse`);
});
