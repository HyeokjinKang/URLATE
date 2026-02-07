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
let patternBackup = {};
let patternLength = 0;
let userName = "";
let difficultyNames = ["EZ", "MID", "HARD"];
let settings, sync, song, tracks, pixelRatio, offset, bpm, speed, userid;
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
let mouseX = 0,
  mouseY = 0;
let rawX = 0,
  rawY = 0;
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
let comboAnimationMs = 0;
let hide = {},
  frameCounter;
let load = 0;
let fileName = "";
let paceLoaded = 0;
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
let isPaused = false;
let rate = 1;
let disableText = false;
let songData = [];
let record = [];
let keyInput = [];
let keyInputMemory = 0;
let keyInputTime = 0;
let keyPressing = {};
let pressingKeys = [];
let trackName = "";
let medal = 1;
let newRecordTime = 0;
let effectMs = 0;
let effectNum = -1;
let globalAlpha = 1;
let canvasW = 0,
  canvasH = 0,
  canvasOW = 0,
  canvasOH = 0;
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
  canvasW = (window.innerWidth * pixelRatio * settings.display.canvasRes) / 100;
  canvasH = (window.innerHeight * pixelRatio * settings.display.canvasRes) / 100;
  canvas.width = canvasW;
  canvas.height = canvasH;

  canvasOW = canvas.offsetWidth;
  canvasOH = canvas.offsetHeight;

  missCanvas.width = window.innerWidth * 0.2 * pixelRatio;
  missCanvas.height = window.innerHeight * 0.05 * pixelRatio;
  rate = localStorage.rate;
  disableText = localStorage.disableText;

  if (isFirstCalled) {
    fetch(`${cdn}${localStorage.patternId ? `/CPL/${localStorage.patternId}` : `/URLATE-patterns/${localStorage.songName}/${localStorage.difficultySelection}`}.json`)
      .then((res) => res.json())
      .then((data) => {
        patternBackup = data;
        pattern = JSON.parse(JSON.stringify(patternBackup));
        patternLength = pattern.patterns.length;

        noteMaxDuration = 0;
        for (const note of pattern.patterns) {
          if (note.duration && note.duration > noteMaxDuration) {
            noteMaxDuration = note.duration;
          }
        }
        noteMaxDuration += 4;

        document.getElementById("scoreDifficultyNum").textContent = localStorage.difficulty;
        document.getElementById("scoreDifficultyName").textContent = difficultyNames[localStorage.difficultySelection];
        document.getElementById("albumDifficulty").textContent = difficultyNames[localStorage.difficultySelection];
        document.getElementById("albumDifficultyNum").textContent = localStorage.difficulty;
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
        bpmsync = {
          ms: 0,
          beat: 0,
        };
        for (let i = 0; i < tracks.length; i++) {
          if (tracks[i].name == pattern.information.track) {
            document.getElementById("scoreTitle").textContent = settings.general.detailLang == "original" ? tracks[i].originalName : tracks[i].name;
            document.getElementById("title").textContent = settings.general.detailLang == "original" ? tracks[i].originalName : tracks[i].name;
            trackName = tracks[i].name;
            fileName = tracks[i].fileName;
            document.getElementById("albumContainer").style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${fileName}.webp")`;
            document.getElementById("canvasBackground").style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${fileName}.webp")`;
            document.getElementById("scoreBackground").style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${fileName}.webp")`;
            document.getElementById("scoreAlbum").style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${fileName}.webp")`;
            albumImg.src = `${cdn}/albums/${settings.display.albumRes}/${fileName}.webp`;
            break;
          }
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
          html5: true,
          autoplay: false,
          loop: false,
          onend: () => {
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
  }
};

const settingApply = () => {
  tick.volume(settings.sound.volume.hitSound);
  resultEffect.volume(settings.sound.volume.effect);
  sync = parseInt(settings.sound.offset);
  document.getElementById("loadingContainer").style.opacity = 1;
  document.getElementById("canvasBackground").style.opacity = 1;
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
        resultMs = Date.now();
      }
    }
    if (resultMs != 0 && resultMs + 500 <= Date.now()) return;
    if (comboAlert) {
      let comboOpacity = 0;
      let fontSize = 20;
      if (comboAlertMs + 400 > Date.now()) {
        comboOpacity = (Date.now() - comboAlertMs) / 1200;
      } else if (comboAlertMs + 400 <= Date.now() && comboAlertMs + 600 > Date.now()) {
        comboOpacity = 0.33;
      } else if (comboAlertMs + 600 <= Date.now() && comboAlertMs + 1000 > Date.now()) {
        comboOpacity = (comboAlertMs + 1000 - Date.now()) / 1200;
      }
      fontSize = (canvasH / 5) * easeOutSine((Date.now() - comboAlertMs) / 1000);
      ctx.beginPath();
      ctx.font = `700 ${fontSize}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
      ctx.fillStyle = `rgba(200,200,200,${comboOpacity})`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(comboAlertCount, canvasW / 2, canvasH / 2);
    }
    ctx.beginPath();
    ctx.lineJoin = "round";
    const percentage = song.seek() / song.duration();
    const rectX = canvasW / 2 - canvasW / 14;
    const rectY = canvasH - canvasH / 80 - canvasH / 200;
    const rectWidth = canvasW / 7;
    const rectHeight = canvasH / 200;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
    ctx.fillRect(rectX, rectY, rectWidth * percentage, rectHeight);
    ctx.lineWidth = 5;
    pointingCntElement = [{ v1: "", v2: "", i: "" }];
    const beats = Number((bpmsync.beat + (song.seek() * 1000 - (offset + sync) - bpmsync.ms) / (60000 / bpm)).toPrecision(10));
    let end = upperBound(pattern.triggers, beats);
    let nowSpeed = pattern.information.speed;
    let renderTexts = [];
    for (let i = 0; i < end; i++) {
      if (pattern.triggers[i].value == 0) {
        if (!destroyedBullets.has(pattern.triggers[i].num)) {
          explodingBullets.add(pattern.triggers[i].num);
          destroyedBullets.add(pattern.triggers[i].num);
        }
      } else if (pattern.triggers[i].value == 1) {
        destroyAll(pattern.triggers[i].beat);
      } else if (pattern.triggers[i].value == 2) {
        bpmsync.ms = bpmsync.ms + (pattern.triggers[i].beat - bpmsync.beat) * (60000 / bpm);
        bpm = pattern.triggers[i].bpm;
        bpmsync.beat = pattern.triggers[i].beat;
      } else if (pattern.triggers[i].value == 3) {
        globalAlpha = pattern.triggers[i].opacity;
      } else if (pattern.triggers[i].value == 4) {
        nowSpeed = pattern.triggers[i].speed;
      } else if (pattern.triggers[i].value == 5) {
        if (pattern.triggers[i].beat <= beats && beats <= pattern.triggers[i].beat + pattern.triggers[i].duration) {
          renderTexts.push(pattern.triggers[i]);
        }
      } else if (pattern.triggers[i].value == 6) {
        calculateResult();
      }
    }

    ctx.globalAlpha = globalAlpha;

    ctx.beginPath();
    ctx.fillStyle = "#fff";
    for (text of renderTexts) {
      if (text.size.indexOf("vh") != -1) ctx.font = `${text.weight} ${(canvasH / 100) * Number(text.size.split("vh")[0])}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
      else ctx.font = `${text.weight} ${text.size} Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
      ctx.textAlign = text.align;
      ctx.textBaseline = text.valign;
      ctx.fillText(text.text, (canvasW / 200) * (text.x + 100), (canvasH / 200) * (text.y + 100));
    }

    let renderDuration = 5 / speed;

    let start = lowerBound(pattern.patterns, beats - noteMaxDuration);
    end = upperBound(pattern.patterns, beats + renderDuration);
    for (let i = start; i < end; i++) {
      const p = (1 - (pattern.patterns[i].beat - beats) / renderDuration) * 100;
      if (p >= 50) {
        trackMouseSelection(i, 0, pattern.patterns[i].value, pattern.patterns[i].x, pattern.patterns[i].y);
      }
    }
    for (let i = end - 1; i >= start; i--) {
      const state = Update.noteProgress(pattern.patterns[i], beats, speed);

      Draw.note(ctx, { canvasW, canvasH, globalAlpha }, skin, pattern.patterns[i], {
        ...state,
        isGrabbed: grabbedNotes.has(i),
      });

      if (state.progress >= 120 && !destroyedNotes.has(i) && (pattern.patterns[i].value == 2 ? !(grabbedNotes.has(i) || grabbedNotes.has(`${i}!`)) : true)) {
        calculateScore("miss", i, true);
        judgeParticles.push(Factory.createJudge(pattern.patterns[i].x, pattern.patterns[i].y, settings.game.judgeSkin, "Miss"));
        miss++;
        showOverlay();
        missPoint.push(song.seek() * 1000);
        record.push([record.length, pointingCntElement[0].v1, pointingCntElement[0].v2, pointingCntElement[0].i, mouseX, mouseY, "miss(hold)", song.seek() * 1000]);
        keyInput.push({ judge: "Miss", key: "-", time: Date.now() });
      } else if (state.tailProgress >= 100 && grabbedNotes.has(i) && !grabbedNotes.has(`${i}!`) && pattern.patterns[i].value == 2) {
        grabbedNotes.add(`${i}!`);
        grabbedNotes.delete(i);
        judgeParticles.push(Factory.createJudge(pattern.patterns[i].x, pattern.patterns[i].y, settings.game.judgeSkin, "Perfect"));
        calculateScore("Perfect", i, true);
        record.push([record.length, pointingCntElement[0].v1, pointingCntElement[0].v2, pointingCntElement[0].i, mouseX, mouseY, "perfect(hold)", song.seek() * 1000]);
        keyInput.push({ judge: "Perfect", key: "-", time: Date.now() });
      }
    }
    start = lowerBound(pattern.bullets, beats - 32);
    end = upperBound(pattern.bullets, beats);
    for (let i = start; i < end; i++) {
      if (!destroyedBullets.has(i) || explodingBullets.has(i)) {
        const bullet = pattern.bullets[i];

        const pos = Update.bulletPos(bullet, beats, pattern.triggers, pattern.information.speed);

        if (!createdBullets.has(i) || explodingBullets.has(i)) {
          destroyParticles.push(...Factory.createExplosions(pos.x, pos.y, skin.bullet));
          if (explodingBullets.has(i)) continue;
        }
        createdBullets.add(i);

        trackMouseSelection(i, 1, 0, pos.x, pos.y);

        Draw.bullet(ctx, { canvasW, canvasH }, skin, pos);
      }
    }

    ctx.beginPath();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${canvasH / 60}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`Speed : ${nowSpeed}, BPM : ${bpm}`, canvasW / 100, canvasH - canvasH / 60);

    if (frameCounter) {
      frameArray.push(1000 / (Date.now() - frameCounterMs));
      if (frameArray.length == 10) {
        fps =
          frameArray.reduce((sum, current) => {
            return sum + current;
          }, 0) / 10;
        frameArray = [];
      }
      ctx.textAlign = "right";
      ctx.fillText(fps.toFixed(), canvasW - canvasW / 100, canvasH - canvasH / 70);
      frameCounterMs = Date.now();
    }
  } catch (e) {
    if (e) {
      ctx.font = `500 ${canvasH / 30}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
      ctx.fillStyle = "#F55";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(e, canvasW / 100, canvasH / 100);
      console.error(e);
    }
  }
  ctx.globalAlpha = 1;
  ctx.beginPath();
  if (localStorage.difficultySelection == 0) ctx.fillStyle = "#31A97E";
  else if (localStorage.difficultySelection == 1) ctx.fillStyle = "#F0C21D";
  else ctx.fillStyle = "#FF774B";
  ctx.rect(canvasW * 0.92, canvasH * 0.05, canvasH / 15 + canvasW * 0.004, canvasH / 15 + canvasW * 0.004);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = "#fff";
  ctx.rect(canvasW * 0.92 - canvasW * 0.002, canvasH * 0.05 - canvasW * 0.002, canvasH / 15 + canvasW * 0.004, canvasH / 15 + canvasW * 0.004);
  ctx.fill();
  ctx.drawImage(albumImg, canvasW * 0.92, canvasH * 0.05, canvasH / 15, canvasH / 15);
  if (Date.now() - scoreMs < 500) {
    displayScore += ((score - prevScore) / 500) * (Date.now() - scoreMs);
    prevScore = displayScore;
  } else {
    displayScore = score;
  }
  ctx.beginPath();
  ctx.font = `700 ${canvasH / 25}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(numberWithCommas(`${Math.round(displayScore)}`.padStart(9, 0)), canvasW * 0.92 - canvasW * 0.01, canvasH * 0.05);
  const comboAnimation = Math.max(0, 1 - easeOutQuart(Math.min(Date.now() - comboAnimationMs, 500) / 500));
  ctx.font = `${400 * (1 + comboAnimation * 0.5)} ${(canvasH / 40) * (1 + comboAnimation)}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
  ctx.fillStyle = "#fff";
  ctx.fillText(`${combo}x`, canvasW * 0.92 - canvasW * 0.01, canvasH * 0.05 + canvasH / 25);

  if (keyInput.length > 0 && keyInputMemory != keyInput.length) {
    if (keyInput.length > 12) {
      keyInput.splice(0, keyInput.length - 12);
    }
    keyInputMemory = keyInput.length;
    keyInputTime = Date.now();
  }

  Update.particles(destroyParticles);
  Update.particles(clickParticles);
  Update.particles(judgeParticles, settings.game.applyJudge);

  Draw.explosions(ctx, canvasW, canvasH, destroyParticles);
  Draw.clickEffects(ctx, { canvasW, canvasH }, skin, clickParticles);
  Draw.judges(ctx, { canvasW, canvasH }, skin, judgeParticles);
  Draw.keyInput(ctx, { canvasW, canvasH }, keyInput, keyInputTime);

  if (effectMs != 0 && effectNum != -1) {
    Draw.finalEffect(ctx, { canvasW, canvasH }, effectNum, effectMs);

    if (Date.now() - effectMs >= 2000) effectMs = 0;
  }

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
    ctx.rect(canvasW * 0.85, canvasH * 0.2, canvasW * 0.15, canvasH * 0.06);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#000000";
    ctx.font = `italic 600 ${canvasH / 40}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("NEW RECORD!", canvasW * 0.87, canvasH * 0.23);
    ctx.beginPath();
    ctx.clearRect(canvasW * 0.85 - 1, canvasH * 0.2 - 1, canvasW * 0.15 - canvasW * 0.145 * p2 + 1, canvasH * 0.06 + 2);
    ctx.fillStyle = "#35C692";
    ctx.rect(canvasW - canvasW * 0.15 * p1, canvasH * 0.2, canvasW * 0.15 * p1 - canvasW * 0.145 * p2, canvasH * 0.06);
    ctx.fill();
    ctx.globalAlpha = globalAlpha;
  }

  Draw.cursor(ctx, { canvasW, canvasH }, skin, { x: mouseX, y: mouseY, zoom: cursorZoom }, { isClicked: mouseClicked != false, clickedMs: mouseClickedMs });
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
  rankImg.src = `/images/parts/elements/${rank}.webp`;
  document.getElementById("scoreInfoRank").style.setProperty("--background", `url('/images/parts/elements/${rank}back.webp')`);
  setTimeout(
    () => {
      canvasContainer.style.opacity = "0";
    },
    song.playing ? 0 : 500,
  );
  setTimeout(
    () => {
      floatingArrowContainer.style.display = "flex";
      floatingArrowContainer.classList.toggle("arrowFade");
    },
    song.playing ? 0 : 1000,
  );
  setTimeout(
    () => {
      floatingResultContainer.style.display = "flex";
      floatingResultContainer.classList.toggle("resultFade");
    },
    song.playing ? 300 : 1300,
  );
  setTimeout(
    () => {
      scoreContainer.style.opacity = "1";
      scoreContainer.style.pointerEvents = "all";
    },
    song.playing ? 1000 : 2000,
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
    missCtx.font = `500 ${canvasH / 30}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
    missCtx.textAlign = "right";
    missCtx.textBaseline = "bottom";
    missCtx.fillText("Perfect!", missCanvas.width - 10, missCanvas.height * 0.8 - 10);
  }
  fetch(`${api}/playRecord`, {
    method: "PUT",
    credentials: "include",
    body: JSON.stringify({
      name: trackName,
      difficultySelection: Number(localStorage.difficultySelection) + 1,
      difficulty: localStorage.difficulty,
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
    const beats = Number((bpmsync.beat + (song.seek() * 1000 - (offset + sync) - bpmsync.ms) / (60000 / bpm)).toPrecision(10));
    const powX = ((((mouseX - x) * canvasOW) / 200) * pixelRatio * settings.display.canvasRes) / 100;
    const powY = ((((mouseY - y) * canvasOH) / 200) * pixelRatio * settings.display.canvasRes) / 100;
    switch (v1) {
      case 0:
        const p = (1 - (pattern.patterns[i].beat - beats) / (5 / speed)) * 100;
        const t = ((beats - pattern.patterns[i].beat) / pattern.patterns[i].duration) * 100;
        if (Math.sqrt(Math.pow(powX, 2) + Math.pow(powY, 2)) <= canvasW / 40 && (pattern.patterns[i].value == 2 ? t <= 100 : p <= 130) && p >= 0) {
          pointingCntElement.push({ v1: v1, v2: v2, i: i });
        }
        break;
      case 1:
        if (Math.sqrt(Math.pow(powX, 2) + Math.pow(powY, 2)) <= canvasW / 80) {
          if (!destroyedBullets.has(i)) {
            bullet++;
            missPoint.push(song.seek() * 1000);
            combo = 0;
            medalCheck(medal);
            destroyParticles.push(...Factory.createExplosions(x, y, skin.bullet));
            destroyedBullets.add(i);
            showOverlay();
            record.push([record.length, pointingCntElement[0].v1, pointingCntElement[0].v2, pointingCntElement[0].i, mouseX, mouseY, "bullet", song.seek() * 1000]);
            keyInput.push({ judge: "Bullet", key: "-", time: Date.now() });
          }
        }
        break;
      default:
        ctx.font = `500 ${canvasH / 30}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
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
    song.play();
  }
  if (key && !isWheel) mouseClicked = key;
  else if (!isWheel) mouseClicked = true;
  mouseClickedMs = Date.now();
  const beats = Number((bpmsync.beat + (song.seek() * 1000 - (offset + sync) - bpmsync.ms) / (60000 / bpm)).toPrecision(10));
  for (let i = 0; i < pointingCntElement.length; i++) {
    if (pointingCntElement[i].v1 === 0 && !destroyedNotes.has(pointingCntElement[i].i) && ((pointingCntElement[i].v2 === 0) == !isWheel || pointingCntElement[i].v2 === 2)) {
      if (pointingCntElement[i].v2 == 1 && pattern.patterns[pointingCntElement[i].i].direction != key) return;
      clickParticles.push(Factory.createClickNote(pattern.patterns[pointingCntElement[i].i].x, pattern.patterns[pointingCntElement[i].i].y, settings.game.size, pointingCntElement[i].v2));
      let beat = pattern.patterns[pointingCntElement[i].i].beat;
      let perfectJudge = (1 / 6) * rate;
      let greatJudge = (1 / 3) * rate;
      let goodJudge = (1 / 2) * rate;
      let badJudge = rate;
      let x = pattern.patterns[pointingCntElement[i].i].x;
      let y = pattern.patterns[pointingCntElement[i].i].y;
      let judge = "Perfect";
      if (pattern.patterns[pointingCntElement[i].i].value != 1) {
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
      if (pattern.patterns[pointingCntElement[i].i].value == 2) {
        grabbedNotes.add(pointingCntElement[i].i);
        keyPressing[key] = pointingCntElement[i].i;
      }
      calculateScore(judge, pointingCntElement[i].i);
      judgeParticles.push(Factory.createJudge(x, y, settings.game.judgeSkin, judge));
      record.push([record.length, pointingCntElement[0].v1, pointingCntElement[0].v2, pointingCntElement[0].i, mouseX, mouseY, judge, song.seek() * 1000]);
      keyInput.push({ judge, key: isWheel ? (key == 1 ? "↑" : "↓") : key != undefined ? key : "•", time: Date.now() });
      return;
    }
  }
  keyInput.push({ judge: "Empty", key: isWheel ? (key == 1 ? "↑" : "↓") : key != undefined ? key : "•", time: Date.now() });
  clickParticles.push(Factory.createClickDefault(mouseX, mouseY, settings.game.size));
};

const calculateScore = (judge, i, ignoreMs) => {
  judge = judge.toLowerCase();
  scoreMs = Date.now();
  prevScore = displayScore;
  destroyedNotes.add(i);
  if (!ignoreMs) {
    const beats = Number((bpmsync.beat + (song.seek() * 1000 - (offset + sync) - bpmsync.ms) / (60000 / bpm)).toPrecision(10));
    pattern.patterns[i].beat = beats;
  }
  if (judge == "miss") {
    medalCheck(medal);
    combo = 0;
  } else {
    tick.play();
    combo++;
    comboAnimationMs = Date.now();
    if (maxCombo < combo) {
      maxCombo = combo;
    }
    let basicScore = 100000000 / patternLength;
    let rateCalc = rate;
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
  }
  if (i == patternLength - 1) {
    if (localStorage.record < score) {
      newRecordTime = Date.now();
    }
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
    document.querySelectorAll(".medal").forEach((e) => {
      e.style.opacity = "1";
    });
    setTimeout(() => {
      document.getElementById("loadingContainer").style.display = "none";
      document.getElementById("componentCanvas").style.transitionDuration = "0s";
      menuAllowed = true;
    }, 1000);
    setTimeout(() => {
      if (!isPaused && !song.playing()) {
        song.play();
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

const retry = () => {
  if (isResultShowing) {
    if (localStorage.record < score) localStorage.record = score;
    return location.reload();
  }
  blackOverlayContainer.classList.add("show");
  setTimeout(() => {
    song.stop();
    pattern = JSON.parse(JSON.stringify(patternBackup));
    bpm = pattern.information.bpm;
    speed = pattern.information.speed;
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
    displayScore = 0;
    prevScore = 0;
    maxCombo = 0;
    scoreMs = 0;
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
    comboAnimationMs = 0;
    overlayTime = 0;
    keyInput = [];
    record = [];
    keyInputMemory = 0;
    keyInputTime = 0;
    newRecordTime = 0;
    effectMs = 0;
    effectNum = -1;
    keyPressing = {};
    pressingKeys = [];
    medal = 1;
    document.getElementsByClassName("medal")[0].classList.remove("hide");
    document.getElementsByClassName("medal")[1].classList.remove("hide");
    globalAlpha = 1;
    blackOverlayContainer.classList.remove("show");
    menuContainer.style.display = "none";
    isMenuOpened = false;
    isPaused = false;
    song.play();
  }, 100);
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

const checkHoldNote = (key) => {
  let date = Date.now();
  const beats = Number((bpmsync.beat + (song.seek() * 1000 - (offset + sync) - bpmsync.ms) / (60000 / bpm)).toPrecision(10));
  mouseClicked = false;
  mouseClickedMs = date;
  if (pressingKeys.includes(key)) pressingKeys.splice(pressingKeys.indexOf(key), 1);
  if (keyPressing.hasOwnProperty(key) && grabbedNotes.has(keyPressing[key]) && !grabbedNotes.has(`${keyPressing[key]}!`)) {
    grabbedNotes.delete(keyPressing[key]);
    grabbedNotes.add(`${keyPressing[key]}!`);
    if (pattern.patterns[keyPressing[key]].beat + pattern.patterns[keyPressing[key]].duration - 1 / 3 > beats) {
      medalCheck(medal);
      pattern.patterns[keyPressing[key]].beat = beats - pattern.patterns[keyPressing[key]].duration;
      calculateScore("Miss", keyPressing[key], true);
      judgeParticles.push(Factory.createJudge(pattern.patterns[keyPressing[key]].x, pattern.patterns[keyPressing[key]].y, settings.game.judgeSkin, "Miss"));
      miss++;
      showOverlay();
      missPoint.push(song.seek() * 1000);
      record.push([record.length, 0, 2, keyPressing[key], mouseX, mouseY, "miss(hold)", song.seek() * 1000]);
      keyInput.push({ judge: "Miss", key: "-", time: Date.now() });
    } else {
      judgeParticles.push(Factory.createJudge(pattern.patterns[keyPressing[key]].x, pattern.patterns[keyPressing[key]].y, settings.game.judgeSkin, "Perfect"));
      calculateScore("Perfect", keyPressing[key], true);
      keyInput.push({ judge: "Perfect", key: "-", time: Date.now() });
      record.push([record.length, 0, 2, keyPressing[key], mouseX, mouseY, "perfect(hold)", song.seek() * 1000]);
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
