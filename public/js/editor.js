const songSelectBox = document.getElementById("songSelectBox");
const trackSettings = document.getElementById("trackSettings");
const volumeMaster = document.getElementById("volumeMaster");
const volumeMasterValue = document.getElementById("volumeMasterValue");
const songName = document.getElementById("songName");
const settingsBGAContainer = document.getElementById("settingsBGAContainer");
const canvasContainer = document.getElementById("canvasContainer");
const timelineContainer = document.getElementById("timelineContainer");
const componentView = document.getElementById("componentView");
const menuContainer = document.getElementById("menuContainer");
const elementsSettings = document.getElementById("elementsSettings");
const noteSettingsContainer = document.getElementById("noteSettingsContainer");
const bulletSettingsContainer = document.getElementById("bulletSettingsContainer");
const triggerSelectBox = document.getElementById("triggerSelectBox");
const triggerInitBox = document.getElementById("triggerInitBox");
const volumeOverlay = document.getElementById("volumeOverlay");
const canvasBackground = document.getElementById("canvasBackground");
const controlBtn = document.getElementById("controlBtn");
const settingsPropertiesTextbox = trackSettings.getElementsByClassName("settingsPropertiesTextbox");
const cntCanvas = document.getElementById("componentCanvas");
const cntCtx = cntCanvas.getContext("2d");
const tmlCanvas = document.getElementById("timelineCanvas");
const tmlCtx = tmlCanvas.getContext("2d");
const timelinePlayController = document.getElementById("timelinePlayController");
let settings,
  tracks,
  bpm = 130,
  bpmsync = {
    ms: 0,
    beat: 0,
  },
  speed = 2,
  offset = 0,
  sync = 0,
  rate = 1,
  split = 2;
let song = new Howl({
  src: ["/sounds/tick.mp3"],
  format: ["mp3"],
  autoplay: false,
});
let mouseX = 0,
  mouseY = 0,
  mouseMode = 0;
let mode = 0; //0: move tool, 1: edit tool, 2: add tool
let zoom = 1;
let timelineYLoc = 0,
  timelineElementNum = 0,
  timelineScrollCount = 6;
let selectedValue = 0; //same with spec value
let isSettingsOpened = false;
let overlayTime = 0;
let mouseDown = false,
  ctrlDown = false,
  shiftDown = false;
let userName = "";
let patternSeek = -1;
let lastMovedMs = -1;
let copiedElement = { v1: "", element: {} };
let destroyParticles = [];
let pixelRatio = window.devicePixelRatio;
let bulletsOverlapNum = 1;
let triggersOverlapNum = 2;
let isTextboxFocused = false;
let skin, denyCursor, denySkin;
let dragMouseX, dragMouseY, originX, originY;
let copied = false,
  copiedTime = 0;
let gridToggle = true,
  magnetToggle = true,
  metronomeToggle = false,
  circleToggle = false;
let scrollTimer = 0;

let pattern = {
  information: {
    version: "1.0",
    track: "",
    producer: "",
    author: "",
    bpm: "",
    speed: "",
    offset: "",
  },
  patterns: [],
  bullets: [],
  triggers: [],
};
let patternHistory = [];
let pointingCntElement = { v1: "", v2: "", i: "" };
let selectedCntElement = { v1: "", v2: "", i: "" };
let destroyedBullets = new Set([]);
let prevDestroyedBullets = new Set([]);
let createdBullets = new Set([]);
let prevCreatedBullets = new Set([]);
let destroyedSeeks = new Set([]);
let prevDestroyedSeeks = new Set([]);

let copySelection = { element: -1, start: -1, end: -1, beat: 0 };

let prevBeat = 1;
const beep = new Howl({
  src: `/sounds/tick.wav`,
  format: ["wav"],
  volume: 0.8,
  autoplay: false,
  loop: false,
});

const sortAsTiming = (a, b) => {
  if (a.beat == b.beat) return 0;
  return a.beat > b.beat ? 1 : -1;
};

const settingApply = () => {
  Howler.volume(settings.sound.volume.master * settings.sound.volume.music);
  volumeMaster.value = settings.sound.volume.master * 100;
  volumeMasterValue.textContent = settings.sound.volume.master * 100 + "%";
  sync = settings.sound.offset;
  denyCursor = settings.editor.denyCursor;
  denySkin = settings.editor.denySkin;
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
  if (localStorage.pattern) {
    pattern = JSON.parse(localStorage.pattern);
    for (let i = 0; songSelectBox.options.length > i; i++) {
      if (songSelectBox.options[i].value == pattern.information.track) songSelectBox.selectedIndex = i;
    }
    songSelected(true);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${api}/auth/status`, {
    method: "GET",
    credentials: "include",
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.status == "Not authorized") {
        window.location.href = `${url}/authorize`;
      } else if (data.status == "Not registered") {
        window.location.href = `${url}/join`;
      } else if (data.status == "Not logined") {
        window.location.href = url;
      } else if (data.status == "Not authenticated") {
        window.location.href = `${url}/authentication`;
      } else if (data.status == "Not authenticated(adult)") {
        window.location.href = `${url}/authentication?adult=1`;
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
              settings = JSON.parse(data.settings);
              settingApply();
              initialize();
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
  fetch(`${api}/tracks`, {
    method: "GET",
    credentials: "include",
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.result == "success") {
        tracks = data.tracks;
        for (let i = 0; tracks.length > i; i++) {
          let option = document.createElement("option");
          option.innerHTML = tracks[i].name;
          if (tracks[i].type == 3) option.disabled = true;
          songSelectBox.options.add(option);
        }
      } else {
        alert("Failed to load song list.");
        console.error("Failed to load song list.");
      }
    })
    .catch((error) => {
      alert(`Error occured.\n${error}`);
      console.error(`Error occured.\n${error}`);
    });
});

const newEditor = () => {
  document.getElementById("initialButtonsContainer").style.display = "none";
  document.getElementById("songSelectionContainer").style.display = "flex";
};

const loadEditor = () => {
  let input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.setAttribute("onchange", `dataLoaded(event)`);
  input.click();
};

const dataLoaded = (event) => {
  let file = event.target.files[0];
  let reader = new FileReader();
  reader.onload = (e) => {
    pattern = JSON.parse(e.target.result);
    for (let i = 0; songSelectBox.options.length > i; i++) {
      if (songSelectBox.options[i].value == pattern.information.track) songSelectBox.selectedIndex = i;
    }
    songSelected(true);
  };
  reader.readAsText(file);
};

const songSelected = (isLoaded, withoutSong) => {
  if (!withoutSong) {
    song = new Howl({
      src: `${cdn}/tracks/${settings.sound.res}/${tracks[songSelectBox.selectedIndex].fileName}.ogg`,
      format: ["ogg"],
      autoplay: false,
      loop: false,
      onload: () => {
        Howler.volume(settings.sound.volume.master * settings.sound.volume.music);
      },
    });
  }
  if (!isLoaded) {
    pattern.information = {
      version: "1.0",
      track: tracks[songSelectBox.selectedIndex].name,
      producer: tracks[songSelectBox.selectedIndex].producer,
      author: userName,
      bpm: tracks[songSelectBox.selectedIndex].bpm,
      speed: 2,
      offset: 0,
    };
  }
  controlBtn.classList.add("timeline-play");
  controlBtn.classList.remove("timeline-pause");
  fetch(`${api}/trackCount/${pattern.information.track}`);
  songName.innerText = pattern.information.track;
  settingsPropertiesTextbox[0].value = pattern.information.track;
  settingsPropertiesTextbox[1].value = pattern.information.producer;
  settingsPropertiesTextbox[2].value = pattern.information.author;
  settingsPropertiesTextbox[3].value = pattern.information.bpm;
  settingsPropertiesTextbox[4].value = pattern.information.speed;
  settingsPropertiesTextbox[5].value = pattern.information.offset;
  if (denySkin) canvasBackground.style.filter = `grayscale(30%) opacity(20%)`;
  else canvasBackground.style.filter = `brightness(30%)`;
  bpm = pattern.information.bpm;
  bpmsync = {
    ms: 0,
    beat: 0,
  };
  offset = pattern.information.offset;
  speed = pattern.information.speed;
  document.getElementById("percentage").innerText = "100%";
  rate = 1;
  let background = new URLSearchParams(window.location.search).get("background");
  if (background !== "0") canvasBackground.style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${tracks[songSelectBox.selectedIndex].fileName}.webp")`;
  else if (!denySkin) canvasBackground.style.backgroundColor = `black`;
  document.getElementById("songSelectionContainer").style.display = "none";
  document.getElementById("initialScreenContainer").style.display = "none";
  document.getElementById("editorMainContainer").style.display = "initial";
  window.requestAnimationFrame(cntRender);
  patternChanged();
};

const toggleSettings = () => {
  if (isSettingsOpened) {
    document.getElementById("settingsContainer").style.display = "none";
    document.getElementById("timelineContainer").style.width = "100vw";
    document.getElementById("timelineZoomController").style.right = "1.5vw";
    document.getElementById("timelineSplitController").style.left = "11vw";
    componentView.style.marginRight = "5vw";
    tmlCanvas.style.width = "100vw";
    tmlCanvas.width = window.innerWidth;
  } else {
    document.getElementById("settingsContainer").style.display = "flex";
    document.getElementById("timelineContainer").style.width = "80vw";
    document.getElementById("timelineZoomController").style.right = "21vw";
    document.getElementById("timelineSplitController").style.left = "9vw";
    componentView.style.marginRight = "0vw";
    tmlCanvas.style.width = "80vw";
    tmlCanvas.width = window.innerWidth * 0.8;
  }
  isSettingsOpened = !isSettingsOpened;
  initialize();
};

const changeMode = (n) => {
  document.getElementsByClassName("menuIcon")[n].classList.toggle("menuSelected");
  document.getElementsByClassName("menuIcon")[mode].classList.toggle("menuSelected");
  document.getElementsByClassName("menuIcon")[n].classList.toggle("clickable");
  document.getElementsByClassName("menuIcon")[mode].classList.toggle("clickable");
  mode = n;
};

const drawCursor = () => {
  cntCtx.beginPath();
  let w = cntCanvas.width / 70;
  let x = (cntCanvas.width / 200) * (mouseX + 100);
  let y = (cntCanvas.height / 200) * (mouseY + 100);
  if (!denySkin) {
    if (skin.cursor.type == "gradient") {
      let grd = cntCtx.createLinearGradient(x - w, y - w, x + w, y + w);
      for (let i = 0; i < skin.cursor.stops.length; i++) {
        grd.addColorStop(skin.cursor.stops[i].percentage / 100, `#${skin.cursor.stops[i].color}`);
      }
      cntCtx.fillStyle = grd;
    } else if (skin.cursor.type == "color") {
      cntCtx.fillStyle = `#${skin.cursor.color}`;
    }
    if (skin.cursor.outline) {
      cntCtx.lineWidth = Math.round((cntCanvas.width / 1000) * skin.cursor.outline.width);
      if (skin.cursor.outline.type == "gradient") {
        let grd = cntCtx.createLinearGradient(x - w, y - w, x + w, y + w);
        for (let i = 0; i < skin.cursor.outline.stops.length; i++) {
          grd.addColorStop(skin.cursor.outline.stops[i].percentage / 100, `#${skin.cursor.outline.stops[i].color}`);
        }
        cntCtx.strokeStyle = grd;
      } else if (skin.cursor.outline.type == "color") {
        cntCtx.strokeStyle = `#${skin.cursor.outline.color}`;
      }
    }
  } else {
    let grd = cntCtx.createLinearGradient(x - w, y - w, x + w, y + w);
    grd.addColorStop(0, `rgb(174, 102, 237)`);
    grd.addColorStop(1, `rgb(102, 183, 237)`);
    cntCtx.fillStyle = grd;
  }
  cntCtx.arc(x, y, w, 0, 2 * Math.PI);
  cntCtx.fill();
  if (skin.cursor.outline) cntCtx.stroke();
};

const drawNote = (p, x, y, s, n, d, t, f) => {
  if (n != 2 && p >= 130) return;
  else if (n == 2 && f >= 130) return;
  p = Math.max(p, 0);
  let originX = x;
  let originY = y;
  x = (cntCanvas.width / 200) * (x + 100);
  y = (cntCanvas.height / 200) * (y + 100);
  n = n == undefined ? 0 : n;
  let w = cntCanvas.width / 40;
  let opacity = 255;
  if (n != 2 && p >= 100) {
    opacity = Math.max(Math.round((255 / 30) * (130 - p)), 0);
  } else if (n == 2 && p >= 100 && t >= 100) {
    opacity = Math.max(Math.round((255 / 30) * (130 - f)), 0);
  }
  opacity = opacity.toString(16).padStart(2, "0");
  if (s == true) {
    cntCtx.lineWidth = Math.round(cntCanvas.width / 300);
    cntCtx.beginPath();
    cntCtx.font = `500 ${window.innerHeight / 40}px Metropolis, Pretendard JP Variable`;
    cntCtx.fillStyle = "#000";
    cntCtx.strokeStyle = "#fff";
    cntCtx.textAlign = "center";
    cntCtx.textBaseline = "bottom";
    cntCtx.strokeText(`(X: ${originX}, Y: ${originY})`, x, y - 1.5 * w);
    cntCtx.fillText(`(X: ${originX}, Y: ${originY})`, x, y - 1.5 * w);
    cntCtx.fillStyle = `#ebd534${opacity}`;
    cntCtx.strokeStyle = `#ebd534${opacity}`;
  } else {
    if (!denySkin) {
      if (skin.note[n].type == "gradient") {
        let grd = cntCtx.createLinearGradient(x - w, y - w, x + w, y + w);
        for (let i = 0; i < skin.note[n].stops.length; i++) {
          grd.addColorStop(skin.note[n].stops[i].percentage / 100, `#${skin.note[n].stops[i].color}${opacity}`);
        }
        cntCtx.fillStyle = grd;
        cntCtx.strokeStyle = grd;
      } else if (skin.note[n].type == "color") {
        cntCtx.fillStyle = `#${skin.note[n].color}${opacity}`;
        cntCtx.strokeStyle = `#${skin.note[n].color}${opacity}`;
      }
      if (skin.note[n].circle) {
        if (skin.note[n].circle.type == "gradient") {
          let grd = cntCtx.createLinearGradient(x - w, y - w, x + w, y + w);
          for (let i = 0; i < skin.note[n].circle.stops.length; i++) {
            grd.addColorStop(skin.note[n].circle.stops[i].percentage / 100, `#${skin.note[n].circle.stops[i].color}${opacity}`);
          }
          cntCtx.strokeStyle = grd;
        } else if (skin.note[n].circle.type == "color") {
          cntCtx.strokeStyle = `#${skin.note[n].circle.color}${opacity}`;
        }
      }
    } else {
      let grd = cntCtx.createLinearGradient(x - w, y - w, x + w, y + w);
      grd.addColorStop(0, `${["#fb4934", "#53cddb", "#C196ED"][n]}${opacity}`);
      grd.addColorStop(1, `${["#ebd934", "#0669ff", "#8251B6"][n]}${opacity}`);
      cntCtx.fillStyle = grd;
      cntCtx.strokeStyle = grd;
    }
  }
  cntCtx.lineWidth = Math.round(cntCanvas.width / 300);
  if (n == 0) {
    cntCtx.beginPath();
    cntCtx.arc(x, y, w, (3 / 2) * Math.PI, (3 / 2) * Math.PI + (p / 50) * Math.PI);
    cntCtx.stroke();
    cntCtx.beginPath();
    cntCtx.arc(x, y, (w / 100) * p, 0, 2 * Math.PI);
    cntCtx.fill();
    if (skin.note[n].outline && !denySkin) {
      if (skin.note[n].outline.type == "gradient") {
        let grd = cntCtx.createLinearGradient(x - w, y - w, x + w, y + w);
        for (let i = 0; i < skin.note[n].outline.stops.length; i++) {
          grd.addColorStop(skin.note[n].outline.stops[i].percentage / 100, `#${skin.note[n].outline.stops[i].color}${opacity}`);
        }
        cntCtx.strokeStyle = grd;
      } else if (skin.note[n].outline.type == "color") {
        cntCtx.strokeStyle = `#${skin.note[n].outline.color}${opacity}`;
      }
      cntCtx.lineWidth = Math.round((cntCanvas.width / 1000) * skin.note[n].outline.width);
      cntCtx.stroke();
    }
  } else if (n == 1) {
    w = w * 0.9;
    let parr = [p <= 20 ? p * 5 : 100, p >= 20 ? (p <= 80 ? (p - 20) * 1.66 : 100) : 0, p >= 80 ? (p <= 100 ? (p - 80) * 5 : 100) : 0];
    cntCtx.beginPath();
    let originalValue = [0, -1.5 * d * w];
    let moveValue = [originalValue[0] - w * Math.cos(Math.PI / 5) * d, originalValue[1] + w * Math.sin(Math.PI / 5) * d];
    cntCtx.moveTo(x + originalValue[0], y + originalValue[1]);
    cntCtx.lineTo(x + originalValue[0] - (moveValue[0] / 100) * parr[0], y + originalValue[1] - (moveValue[1] / 100) * parr[0]);
    cntCtx.moveTo(x + originalValue[0] - moveValue[0], y + originalValue[1] - moveValue[1]);
    if (d == 1) cntCtx.arc(x, y, w, -Math.PI / 5, (((Math.PI / 5) * 7) / 100) * parr[1] - Math.PI / 5);
    else cntCtx.arc(x, y, w, (-Math.PI / 5) * 6, (((Math.PI / 5) * 7) / 100) * parr[1] - (Math.PI / 5) * 6);
    originalValue = [-w * Math.cos(Math.PI / 5) * d, -w * Math.sin(Math.PI / 5) * d];
    moveValue = [originalValue[0], originalValue[1] - -1.5 * d * w];
    cntCtx.moveTo(x + originalValue[0], y + originalValue[1]);
    cntCtx.lineTo(x + originalValue[0] - (moveValue[0] / 100) * parr[2], y + originalValue[1] - (moveValue[1] / 100) * parr[2]);
    cntCtx.stroke();
    cntCtx.beginPath();
    cntCtx.moveTo(x, y - 1.5 * d * (w / 100) * p);
    if (d == 1) cntCtx.arc(x, y, (w / 100) * p, -Math.PI / 5, (Math.PI / 5) * 6);
    else cntCtx.arc(x, y, (w / 100) * p, (-Math.PI / 5) * 6, Math.PI / 5);
    cntCtx.lineTo(x, y - 1.5 * d * (w / 100) * p);
    cntCtx.fill();
    if (skin.note[n].outline && !denySkin) {
      if (skin.note[n].outline.type == "gradient") {
        let grd = cntCtx.createLinearGradient(x - w, y - w, x + w, y + w);
        for (let i = 0; i < skin.note[n].outline.stops.length; i++) {
          grd.addColorStop(skin.note[n].outline.stops[i].percentage / 100, `#${skin.note[n].outline.stops[i].color}${opacity}`);
        }
        cntCtx.strokeStyle = grd;
      } else if (skin.note[n].outline.type == "color") {
        cntCtx.strokeStyle = `#${skin.note[n].outline.color}${opacity}`;
      }
      cntCtx.lineWidth = Math.round((cntCanvas.width / 1000) * skin.note[n].outline.width);
      cntCtx.stroke();
    }
  } else if (n == 2) {
    cntCtx.beginPath();
    if (p <= 100) {
      cntCtx.arc(x, y, w, (3 / 2) * Math.PI, (3 / 2) * Math.PI + (p / 50) * Math.PI);
      cntCtx.stroke();
      cntCtx.lineTo(x, y);
      cntCtx.fill();
    } else if (t <= 100) {
      cntCtx.arc(x, y, w, 0, 2 * Math.PI);
      cntCtx.stroke();
      cntCtx.beginPath();
      cntCtx.arc(x, y, w, (3 / 2) * Math.PI + (t / 50) * Math.PI, (3 / 2) * Math.PI);
      cntCtx.lineTo(x, y);
      cntCtx.fill();
    } else {
      cntCtx.arc(x, y, w, 0, 2 * Math.PI);
      cntCtx.stroke();
    }
    if (skin.note[n].outline && !denySkin) {
      if (skin.note[n].outline.type == "gradient") {
        let grd = cntCtx.createLinearGradient(x - w, y - w, x + w, y + w);
        for (let i = 0; i < skin.note[n].outline.stops.length; i++) {
          grd.addColorStop(skin.note[n].outline.stops[i].percentage / 100, `#${skin.note[n].outline.stops[i].color}${opacity}`);
        }
        cntCtx.strokeStyle = grd;
      } else if (skin.note[n].outline.type == "color") {
        cntCtx.strokeStyle = `#${skin.note[n].outline.color}${opacity}`;
      }
      cntCtx.lineWidth = Math.round((cntCanvas.width / 1000) * skin.note[n].outline.width);
      cntCtx.stroke();
    }
  }
};

const changeNote = () => {
  let n = Number(pattern.patterns[selectedCntElement.i].value);
  pattern.patterns[selectedCntElement.i].value = n == 2 ? 0 : n + 1;
  pattern.patterns[selectedCntElement.i].direction = 1;
  pattern.patterns[selectedCntElement.i].time = parseInt((60 / bpm) * 4 * 1000);
  patternChanged();
  selectedCntElement.v2 = pattern.patterns[selectedCntElement.i].value;
  changeSettingsMode(selectedCntElement.v1, selectedCntElement.v2, selectedCntElement.i);
};

const drawBullet = (x, y, a, s, l, d) => {
  x = (cntCanvas.width / 200) * (x + 100);
  y = (cntCanvas.height / 200) * (y + 100);
  let w = cntCanvas.width / 80;
  if (s == true) {
    cntCtx.beginPath();
    cntCtx.font = `500 ${window.innerHeight / 40}px Metropolis, Pretendard JP Variable`;
    cntCtx.fillStyle = "#000";
    cntCtx.strokeStyle = "#fff";
    cntCtx.textAlign = d == "L" ? "left" : "right";
    cntCtx.textBaseline = "bottom";
    cntCtx.lineWidth = Math.round(cntCanvas.width / 300);
    cntCtx.strokeText(`(Loc: ${l})`, x, y - 1.5 * w - window.innerHeight / 40);
    cntCtx.strokeText(`(Angle: ${d == "L" ? a : a - 180})`, x, y - 1.5 * w);
    cntCtx.fillText(`(Loc: ${l})`, x, y - 1.5 * w - window.innerHeight / 40);
    cntCtx.fillText(`(Angle: ${d == "L" ? a : a - 180})`, x, y - 1.5 * w);
    cntCtx.fillStyle = `#ebd534`;
    cntCtx.strokeStyle = `#ebd534`;
  } else {
    if (!denySkin) {
      if (skin.bullet.type == "gradient") {
        let grd = cntCtx.createLinearGradient(x - w, y - w, x + w, y + w);
        for (let i = 0; i < skin.bullet.stops.length; i++) {
          grd.addColorStop(skin.bullet.stops[i].percentage / 100, `#${skin.bullet.stops[i].color}`);
        }
        cntCtx.fillStyle = grd;
        cntCtx.strokeStyle = grd;
      } else if (skin.bullet.type == "color") {
        cntCtx.fillStyle = `#${skin.bullet.color}`;
        cntCtx.strokeStyle = `#${skin.bullet.color}`;
      }
      if (skin.bullet.outline) {
        cntCtx.lineWidth = Math.round((cntCanvas.width / 1000) * skin.bullet.outline.width);
        if (skin.bullet.outline.type == "gradient") {
          let grd = cntCtx.createLinearGradient(x - w, y - w, x + w, y + w);
          for (let i = 0; i < skin.bullet.outline.stops.length; i++) {
            grd.addColorStop(skin.bullet.outline.stops[i].percentage / 100, `#${skin.bullet.outline.stops[i].color}`);
          }
          cntCtx.strokeStyle = grd;
        } else if (skin.bullet.outline.type == "color") {
          cntCtx.strokeStyle = `#${skin.bullet.outline.color}`;
        }
      }
    } else {
      cntCtx.fillStyle = "#555";
      cntCtx.strokeStyle = "#555";
    }
  }
  cntCtx.beginPath();
  a = Math.PI * (a / 180 + 0.5);
  cntCtx.arc(x, y, w, a, a + Math.PI);
  a = a - 0.5 * Math.PI;
  cntCtx.moveTo(x - w * Math.sin(a), y + w * Math.cos(a));
  cntCtx.lineTo(x + w * 2 * Math.cos(a), y + w * 2 * Math.sin(a));
  cntCtx.lineTo(x + w * Math.sin(a), y - w * Math.cos(a));
  cntCtx.fill();
  if (skin.bullet.outline && !denySkin) cntCtx.stroke();
};

const drawParticle = (n, x, y, j) => {
  let cx = (cntCanvas.width / 200) * (x + 100);
  let cy = (cntCanvas.height / 200) * (y + 100);
  if (n == 0) {
    let n = destroyParticles[j].n;
    let w = destroyParticles[j].w;
    for (let i = 0; i < 3; i++) {
      cntCtx.beginPath();
      if (denySkin) cntCtx.fillStyle = "#222";
      else cntCtx.fillStyle = "#fff";
      cntCtx.arc(cx + (n * destroyParticles[j].d[i][0]) / 2, cy + (n * destroyParticles[j].d[i][1]) / 2, w, 0, 2 * Math.PI);
      cntCtx.fill();
    }
  }
};

const eraseCnt = () => {
  cntCtx.clearRect(0, 0, cntCanvas.width, cntCanvas.height);
};

const eraseTml = () => {
  tmlCtx.clearRect(0, 0, tmlCanvas.width, tmlCanvas.height);
};

const initialize = () => {
  cntCanvas.width = (window.innerWidth * 0.6 * window.devicePixelRatio * settings.display.canvasRes) / 100;
  cntCanvas.height = (window.innerHeight * 0.65 * window.devicePixelRatio * settings.display.canvasRes) / 100;
  tmlCanvas.height = window.innerHeight * 0.27 * window.devicePixelRatio;
  if (isSettingsOpened) {
    tmlCanvas.width = window.innerWidth * 0.8 * window.devicePixelRatio;
  } else {
    tmlCanvas.width = window.innerWidth * window.devicePixelRatio;
  }
  if (tmlCanvas.height / tmlCanvas.width > 0.18) {
    timelinePlayController.style.display = "none";
  } else {
    timelinePlayController.style.display = "flex";
  }
};

const gotoMain = (isCalledByMain) => {
  if (isCalledByMain || confirm(rusure)) {
    song.stop();
    song = new Howl({
      src: ["/sounds/tick.mp3"],
      format: ["mp3"],
      autoplay: false,
    });
    localStorage.temp = JSON.stringify(pattern);
    localStorage.clear("pattern");
    changeSettingsMode(-1);
    if (isSettingsOpened) toggleSettings();
    selectedCntElement = { v1: "", v2: "", i: "" };
    copySelection = { element: -1, start: -1, end: -1, ms: 0 };
    document.getElementById("initialScreenContainer").style.display = "block";
    document.getElementById("initialButtonsContainer").style.display = "flex";
    document.getElementById("songSelectionContainer").style.display = "none";
    songSelectBox.selectedIndex = 0;
    document.getElementById("editorMainContainer").style.display = "none";
    pattern = {
      information: {
        version: "1.0",
        track: "",
        producer: "",
        author: "",
        bpm: "",
        speed: "",
        offset: "",
      },
      patterns: [],
      bullets: [],
      triggers: [],
    };
    patternHistory = [];
  }
};

const trackMouseSelection = (i, v1, v2, x, y) => {
  if (mode != 2 && mouseMode == 0) {
    if (pointingCntElement.i == "") {
      const beats = Number((bpmsync.beat + (song.seek() * 1000 - (offset + sync) - bpmsync.ms) / (60000 / bpm)).toPrecision(10));
      const powX = ((((mouseX - x) * canvasContainer.offsetWidth) / 200) * pixelRatio * settings.display.canvasRes) / 100;
      const powY = ((((mouseY - y) * canvasContainer.offsetHeight) / 200) * pixelRatio * settings.display.canvasRes) / 100;
      switch (v1) {
        case 0:
          const p = (1 - (pattern.patterns[i].beat - beats) / (5 / speed)) * 100;
          const t = ((beats - pattern.patterns[i].beat) / pattern.patterns[i].duration) * 100;
          if (Math.sqrt(Math.pow(powX, 2) + Math.pow(powY, 2)) <= cntCanvas.width / 40 && (pattern.patterns[i].value == 2 ? t <= 100 : p <= 100) && p >= 0) {
            pointingCntElement = { v1: v1, v2: v2, i: i };
          }
          break;
        case 1:
          if (Math.sqrt(Math.pow(powX, 2) + Math.pow(powY, 2)) <= cntCanvas.width / (song.playing() ? 80 : 50)) {
            pointingCntElement = { v1: v1, v2: v2, i: i };
          }
          break;
        default:
          cntCtx.font = `500 ${window.innerHeight / 40}px Metropolis, Pretendard JP Variable`;
          cntCtx.fillStyle = "#F55";
          cntCtx.textAlign = "left";
          cntCtx.textBaseline = "top";
          cntCtx.fillText(`trackMouseSelection:Undefined element.`, cntCanvas.width / 100, cntCanvas.height / 100);
          console.error(`trackMouseSelection:Undefined element.`);
      }
    }
  } else if (mode != 2 && mouseMode == 1) {
    if (pointingCntElement.i == "") {
      if (Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2)) <= tmlCanvas.height / 27) {
        pointingCntElement = { v1: v1, v2: v2, i: i };
      }
    }
  }
};

const selectedCheck = (n, i) => {
  return (pointingCntElement.v1 === n && pointingCntElement.i == i) || (selectedCntElement.v1 === n && selectedCntElement.i == i);
};

const tmlRender = () => {
  try {
    //Initialize
    eraseTml();
    const beats = bpmsync.beat + (song.seek() * 1000 - bpmsync.ms) / (60000 / bpm);
    const tmlStartX = tmlCanvas.width / 10, //timeline(element view) start X
      startX = tmlCanvas.width / 80,
      startY = tmlCanvas.height / 6,
      endX = tmlCanvas.width / 1.01,
      endY = tmlCanvas.height / 1.1,
      height = tmlCanvas.height / 9;
    const renderStart = Number((beats - zoom).toPrecision(10)),
      renderEnd = Number((beats + 16 * zoom).toPrecision(10)),
      beatToPx = (endX - tmlStartX) / (renderEnd - renderStart);

    //Timeline background
    tmlCtx.beginPath();
    tmlCtx.fillStyle = "#F3F3F3";
    tmlCtx.fillRect(tmlStartX, startY, endX - tmlStartX, endY - startY);
    let start = lowerBound(pattern.patterns, renderStart);
    let end = upperBound(pattern.patterns, renderEnd);

    //Timeline notes
    const renderNotes = pattern.patterns.slice(start, end);
    for (let j = 0; j < renderNotes.length; j++) {
      tmlCtx.beginPath();
      let x = tmlStartX + (renderNotes[j].beat - renderStart) * beatToPx;
      let y = startY + timelineYLoc + height / 2;
      if (mouseMode == 1) trackMouseSelection(start + j, 0, renderNotes[j].value, x, y);
      if (selectedCheck(0, start + j)) {
        tmlCtx.fillStyle = "#ed5b45";
      } else {
        tmlCtx.fillStyle = "#fbaf34";
      }
      tmlCtx.arc(x, y, height / 3, 0, 2 * Math.PI);
      tmlCtx.fill();
    }

    //Timeline bullets
    start = lowerBound(pattern.bullets, renderStart);
    end = upperBound(pattern.bullets, renderEnd);
    const renderBullets = pattern.bullets.slice(start, end);
    //Calculate overlap number
    bulletsOverlapNum = 1;
    let bulletsOverlap = {};
    for (let i = 0; i < renderBullets.length; i++) {
      let overlapIndex = parseInt(renderBullets[i].beat * 2);
      let count = 0;
      if (bulletsOverlap[overlapIndex]) {
        bulletsOverlap[overlapIndex]++;
      } else {
        bulletsOverlap[overlapIndex] = 1;
      }
      for (let j = 0; j < renderBullets.length; j++) {
        if (overlapIndex == parseInt(renderBullets[j].beat * 2)) {
          count++;
        }
      }
      if (bulletsOverlapNum < count) bulletsOverlapNum = count;
    }
    //Draw bullets
    for (let j = 0; j < renderBullets.length; j++) {
      tmlCtx.beginPath();
      let x = tmlStartX + parseInt((renderBullets[j].beat - renderStart) * beatToPx);
      let y = startY + timelineYLoc + height * bulletsOverlap[parseInt(renderBullets[j].beat * 2)] + height / 2;
      let w = height / 3;
      if (mouseMode == 1) trackMouseSelection(start + j, 1, 0, x, y);
      if (selectedCheck(1, start + j)) {
        tmlCtx.fillStyle = "#ed5b45";
      } else {
        tmlCtx.fillStyle = "#4297d4";
      }
      tmlCtx.moveTo(x - w, y);
      tmlCtx.lineTo(x, y + w);
      tmlCtx.lineTo(x + w, y);
      tmlCtx.lineTo(x, y - w);
      tmlCtx.lineTo(x - w, y);
      bulletsOverlap[parseInt(renderBullets[j].beat * 2)]--;
      tmlCtx.fill();
    }

    //Timeline triggers
    start = lowerBound(pattern.triggers, renderStart);
    end = upperBound(pattern.triggers, renderEnd);
    const renderTriggers = pattern.triggers.slice(start, end);
    //Calculate overlap number
    triggersOverlapNum = 2;
    let triggersOverlap = {};
    for (let i = 0; i < renderTriggers.length; i++) {
      let overlapIndex = parseInt(renderTriggers[i].beat * 2);
      let count = 0;
      if (triggersOverlap[overlapIndex]) {
        triggersOverlap[overlapIndex]++;
      } else {
        triggersOverlap[overlapIndex] = 1;
      }
      for (let j = 0; j < renderTriggers.length; j++) {
        if (overlapIndex == parseInt(renderTriggers[j].beat * 2)) {
          count++;
        }
      }
      if (triggersOverlapNum < count + 1) triggersOverlapNum = count + 1;
    }
    //Draw triggers
    for (let j = 0; j < renderTriggers.length; j++) {
      tmlCtx.beginPath();
      let x = tmlStartX + parseInt((renderTriggers[j].beat - renderStart) * beatToPx);
      let y = startY + timelineYLoc + height * (bulletsOverlapNum + triggersOverlap[parseInt(renderTriggers[j].beat * 2)]) + height / 2;
      let w = height / 3;
      if (mouseMode == 1) trackMouseSelection(start + j, 2, renderTriggers[j].value, x, y);
      if (selectedCheck(2, start + j)) {
        tmlCtx.fillStyle = "#ed5b45";
      } else {
        tmlCtx.fillStyle = "#2ec90e";
      }
      tmlCtx.moveTo(x - w / 1.1, y - w);
      tmlCtx.lineTo(x + w / 1.1, y);
      tmlCtx.lineTo(x - w / 1.1, y + w);
      tmlCtx.lineTo(x - w / 1.1, y - w);
      triggersOverlap[parseInt(renderTriggers[j].beat * 2)]--;
      tmlCtx.fill();
    }

    //Cover the overflowed
    tmlCtx.fillStyle = "#FFF";
    tmlCtx.fillRect(0, 0, tmlStartX, endY);

    //Timeline elements text(Notes, Bullets, Triggers)
    tmlCtx.beginPath();
    tmlCtx.fillStyle = "#fbaf34";
    tmlCtx.arc(startX, startY + height / 2 + timelineYLoc, height / 6, 0, 2 * Math.PI);
    tmlCtx.fill();
    tmlCtx.fillStyle = "#111";
    tmlCtx.textAlign = "left";
    tmlCtx.textBaseline = "middle";
    tmlCtx.font = `${tmlCanvas.height / 14}px Metropolis, Pretendard JP Variable`;
    tmlCtx.fillText("Note", startX * 1.2 + height / 6, startY + timelineYLoc + height / 1.8);
    let i = 1;
    for (i; i <= bulletsOverlapNum; i++) {
      tmlCtx.beginPath();
      tmlCtx.fillStyle = "#2f91ed";
      tmlCtx.arc(startX, startY + timelineYLoc + height * i + height / 2, height / 6, 0, 2 * Math.PI);
      tmlCtx.fill();
      tmlCtx.fillStyle = "#111";
      tmlCtx.fillText("Bullet", startX * 1.2 + height / 6, startY + timelineYLoc + height * i + height / 1.8);
    }
    for (i; i < bulletsOverlapNum + triggersOverlapNum; i++) {
      tmlCtx.beginPath();
      tmlCtx.fillStyle = "#2ec90e";
      tmlCtx.arc(startX, startY + height * i + height / 2 + timelineYLoc, height / 6, 0, 2 * Math.PI);
      tmlCtx.fill();
      tmlCtx.fillStyle = "#111";
      tmlCtx.fillText("Trigger", startX * 1.2 + height / 6, startY + timelineYLoc + height * i + height / 1.8);
    }

    //Timeline time line + text
    timelineElementNum = i;
    tmlCtx.fillStyle = "#FFF";
    tmlCtx.fillRect(0, endY, endX, tmlCanvas.height - endY);
    tmlCtx.fillRect(0, 0, endX, startY);
    tmlCtx.font = `${tmlCanvas.height / 16}px Metropolis, Pretendard JP Variable`;
    tmlCtx.textAlign = "center";
    tmlCtx.textBaseline = "bottom";
    tmlCtx.fillStyle = "#777";
    for (let t = Math.round(renderStart); t <= renderEnd; t += 1) {
      if (Math.floor(t) >= 0) {
        tmlCtx.fillText(Math.floor(t), tmlStartX + parseInt((t - renderStart) * beatToPx), startY / 1.3);
        for (let i = 0; i < split; i++) {
          tmlCtx.beginPath();
          let strokeX = tmlStartX + parseInt((t - renderStart) * beatToPx) + (beatToPx / split) * i;
          let strokeY;
          if (i == 0) {
            tmlCtx.strokeStyle = "#555";
            strokeY = startY - 10;
          } else {
            tmlCtx.strokeStyle = "#999";
            strokeY = startY - 5;
          }
          tmlCtx.moveTo(strokeX, startY);
          tmlCtx.lineTo(strokeX, strokeY);
          tmlCtx.stroke();
        }
      }
    }

    //Cover the overflowed
    tmlCtx.fillStyle = "#FFF";
    tmlCtx.fillRect(0, 0, tmlStartX, startY);

    //Timeline time text
    tmlCtx.fillStyle = "#2f91ed";
    tmlCtx.font = `${tmlCanvas.height / 11}px Heebo`;
    tmlCtx.textBaseline = "middle";
    let timeStartX = tmlStartX;
    if (tmlCanvas.height / tmlCanvas.width <= 0.18) {
      tmlCtx.textAlign = "right";
      if (tmlCanvas.height / tmlCanvas.width >= 0.17) {
        tmlCtx.font = `${tmlCanvas.height / 15}px Heebo`;
      } else if (tmlCanvas.height / tmlCanvas.width >= 0.155) {
        tmlCtx.font = `${tmlCanvas.height / 13}px Heebo`;
      }
    } else {
      tmlCtx.textAlign = "left";
      timeStartX = startX;
    }
    if (isNaN(beats)) {
      tmlCtx.fillText("Wait..", timeStartX, startY / 1.7);
    } else {
      const seek = song.seek(),
        minutes = Math.floor(seek / 60),
        seconds = seek - minutes * 60;
      tmlCtx.fillText(`${String(minutes).padStart(1, "0")}:${seconds.toFixed(2).padStart(5, "0")}`, timeStartX, startY / 1.7);
    }

    //Timeline offset playhead
    tmlCtx.beginPath();
    tmlCtx.fillStyle = "#2f91ed";
    tmlCtx.strokeStyle = "#2f91ed";
    const offsetLineX = tmlStartX + (beats - renderStart - (offset + sync) / (60000 / bpm)) * beatToPx;
    tmlCtx.moveTo(offsetLineX, endY);
    tmlCtx.lineTo(offsetLineX, startY);
    tmlCtx.stroke();

    //Timeline playhead
    tmlCtx.beginPath();
    tmlCtx.fillStyle = "#ed5b45";
    tmlCtx.strokeStyle = "#ed5b45";
    let lineX = tmlStartX + beatToPx * zoom;
    tmlCtx.moveTo(lineX, endY);
    tmlCtx.lineTo(lineX, startY);
    tmlCtx.stroke();

    //Add mode yellow preview
    if (mode == 2 && mouseMode == 1) {
      if (mouseX > tmlStartX && mouseX < endX && mouseY > startY && mouseY < endY) {
        let height = tmlCanvas.height / 9;
        let w = height / 3;
        let mousePosY = mouseY - timelineYLoc;
        tmlCtx.beginPath();
        tmlCtx.fillStyle = "#ebd534";
        if (mousePosY >= startY && mousePosY <= startY + height) {
          tmlCtx.arc(mouseX, startY + height / 2, w, 0, 2 * Math.PI);
        } else if (mousePosY >= startY + height && mousePosY <= startY + height * (bulletsOverlapNum + 1)) {
          let mouseYLocCount = 1 + bulletsOverlapNum - Math.round(Math.round(2 * startY + height * bulletsOverlapNum - mousePosY) / height);
          let y = startY + height * mouseYLocCount + height / 2 + timelineYLoc;
          tmlCtx.moveTo(mouseX - w, y);
          tmlCtx.lineTo(mouseX, y + w);
          tmlCtx.lineTo(mouseX + w, y);
          tmlCtx.lineTo(mouseX, y - w);
          tmlCtx.lineTo(mouseX - w, y);
        } else if (mousePosY >= startY + height * (bulletsOverlapNum + 1) && mousePosY <= startY + height * (bulletsOverlapNum + 1) + height * (triggersOverlapNum - 1)) {
          let mouseYLocCount = -(1 - Math.round((mousePosY - height - height * (bulletsOverlapNum + 1)) / height));
          let y = startY + height * (bulletsOverlapNum + 1) + height * mouseYLocCount + height / 2 + timelineYLoc;
          tmlCtx.moveTo(mouseX - w / 1.1, y - w);
          tmlCtx.lineTo(mouseX + w / 1.1, y);
          tmlCtx.lineTo(mouseX - w / 1.1, y + w);
          tmlCtx.lineTo(mouseX - w / 1.1, y - w);
        }
        tmlCtx.fill();
      }
    }

    //Sync alert text
    tmlCtx.font = `500 ${tmlCanvas.height / 15}px Metropolis, Pretendard JP Variable`;
    tmlCtx.fillStyle = "#555";
    tmlCtx.textAlign = "right";
    tmlCtx.textBaseline = "top";
    if (tmlCanvas.width / tmlCanvas.height >= 4.9) {
      if (sync + offset >= 50 || sync + offset <= -50) {
        tmlCtx.fillText(syncAlert, endX, endY + 5);
      }
    }

    //Key indicator(or copied text)
    tmlCtx.textAlign = "left";
    let msg = timeAlert;
    if (copied) {
      msg = copiedText;
    } else if (shiftDown) {
      msg = "Shift : ON";
      if (ctrlDown) {
        msg += `, ${isMac ? "Cmd" : "Ctrl"} : ON`;
      }
      tmlCtx.fillStyle = "#F55";
    } else if (ctrlDown) {
      msg = `${isMac ? "Cmd" : "Ctrl"} : ON`;
      tmlCtx.fillStyle = "#F55";
    }
    tmlCtx.fillText(msg, tmlStartX, endY + 5);
    if (new Date() - copiedTime >= 1000) {
      copied = false;
    }

    //Mouse cursor
    if (pointingCntElement.i === "") {
      if (mouseX >= tmlCanvas.width / 20 && mouseX <= tmlCanvas.width / 10 && mouseY < tmlCanvas.height / 6) {
        timelineContainer.style.cursor = "url('/images/parts/cursor/blueSelect.cur'), pointer";
      } else {
        timelineContainer.style.cursor = "";
      }
    } else {
      timelineContainer.style.cursor = "url('/images/parts/cursor/blueSelect.cur'), pointer";
    }
  } catch (e) {
    tmlCtx.font = `500 ${tmlCanvas.height / 15}px Metropolis, Pretendard JP Variable`;
    tmlCtx.fillStyle = "#F55";
    tmlCtx.textAlign = "left";
    tmlCtx.textBaseline = "top";
    tmlCtx.fillText(e, tmlStartX, endY);
    console.error(e);
  }
};

const callBulletDestroy = (j) => {
  const beats = Number((bpmsync.beat + (song.seek() * 1000 - (offset + sync) - bpmsync.ms) / (60000 / bpm)).toPrecision(10));
  const p = ((beats - pattern.bullets[j].beat) / (15 / speed / pattern.bullets[j].speed)) * 100;
  const left = pattern.bullets[j].direction == "L";
  let x = (left ? -1 : 1) * (100 - p);
  let y = pattern.bullets[j].location + p * getTan(pattern.bullets[j].angle) * (left ? 1 : -1);
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
};

const cntRender = () => {
  window.requestAnimationFrame(cntRender);
  try {
    // Always maintain the aspect ratio
    if (window.devicePixelRatio != pixelRatio) {
      pixelRatio = window.devicePixelRatio;
      initialize();
    }

    // Initialize
    eraseCnt();
    pointingCntElement = { v1: "", v2: "", i: "" };
    createdBullets.clear();
    destroyedBullets.clear();
    destroyedSeeks.clear();

    const tw = cntCanvas.width / 200;
    const th = cntCanvas.height / 200;

    // Grid
    if (gridToggle) {
      let x1 = 0;
      let x2 = tw * 5;
      let y = 0;
      cntCtx.lineWidth = 2;
      cntCtx.strokeStyle = "#bbbbbb20";
      cntCtx.beginPath();
      for (let i = -100; i <= 100; i += 10) {
        cntCtx.moveTo(x1, 0);
        cntCtx.lineTo(x1, cntCanvas.height);
        cntCtx.moveTo(0, y);
        cntCtx.lineTo(cntCanvas.width, y);
        cntCtx.moveTo(x2, 0);
        cntCtx.lineTo(x2, cntCanvas.height);
        x1 += tw * 10;
        x2 += tw * 10;
        y += th * 10;
      }
      cntCtx.stroke();
    }
    cntCtx.strokeStyle = "#ed3a2680";
    cntCtx.beginPath();
    cntCtx.moveTo(tw * 100, 0);
    cntCtx.lineTo(tw * 100, cntCanvas.height);
    cntCtx.moveTo(0, th * 100);
    cntCtx.lineTo(cntCanvas.width, th * 100);
    cntCtx.stroke();

    // Circle Grid
    if (circleToggle && selectedCntElement.v1 === 0) {
      cntCtx.strokeStyle = "#88888850";
      cntCtx.lineWidth = 2;
      for (let i = 1; i <= 10; i++) {
        cntCtx.beginPath();
        cntCtx.arc(tw * (pattern.patterns[selectedCntElement.i].x + 100), th * (pattern.patterns[selectedCntElement.i].y + 100), (cntCanvas.width / 10) * i, 0, 2 * Math.PI);
        cntCtx.stroke();
      }
    }

    // Calculate seeking position
    const beats = Number((bpmsync.beat + (song.seek() * 1000 - (offset + sync) - bpmsync.ms) / (60000 / bpm)).toPrecision(10));

    // Metronome
    if (metronomeToggle) {
      const intBeat = Math.floor(beats);
      if (song.playing()) {
        if (prevBeat != intBeat) {
          prevBeat = intBeat;
          beep.play();
        }
      } else {
        prevBeat = intBeat;
      }
    }

    // Initialize triggers
    bpm = pattern.information.bpm;
    speed = pattern.information.speed;
    cntCanvas.style.filter = `opacity(100%)`;
    bpmsync = {
      ms: 0,
      beat: 0,
    };

    // Track triggers from start to now
    let end = upperBound(pattern.triggers, beats);
    const renderTriggers = pattern.triggers.slice(0, end);
    for (let i = 0; i < renderTriggers.length; i++) {
      if (renderTriggers[i].value == 0) {
        if (!destroyedBullets.has(renderTriggers[i].num)) {
          if (!prevDestroyedBullets.has(renderTriggers[i].num)) {
            callBulletDestroy(renderTriggers[i].num);
          }
          destroyedBullets.add(renderTriggers[i].num);
        }
      } else if (renderTriggers[i].value == 1) {
        end = upperBound(pattern.bullets, renderTriggers[i].beat);
        const renderBullets = pattern.bullets.slice(0, end);
        for (let j = 0; renderBullets.length > j; j++) {
          if (!destroyedBullets.has(j)) {
            if (!prevDestroyedBullets.has(j)) {
              callBulletDestroy(j);
            }
            destroyedBullets.add(j);
          }
        }
      } else if (renderTriggers[i].value == 2) {
        bpmsync.ms = bpmsync.ms + (renderTriggers[i].beat - bpmsync.beat) * (60000 / bpm);
        bpm = renderTriggers[i].bpm;
        bpmsync.beat = renderTriggers[i].beat;
      } else if (renderTriggers[i].value == 3) {
        cntCanvas.style.filter = `opacity(${renderTriggers[i].opacity * 100}%)`;
      } else if (renderTriggers[i].value == 4) {
        speed = renderTriggers[i].speed;
      } else if (renderTriggers[i].value == 5) {
        if (renderTriggers[i].beat <= beats && beats <= renderTriggers[i].beat + renderTriggers[i].duration) {
          cntCtx.beginPath();
          if (denySkin) cntCtx.fillStyle = "#111";
          else cntCtx.fillStyle = "#fff";
          cntCtx.font = `${renderTriggers[i].weight} ${renderTriggers[i].size} Metropolis, Pretendard JP Variable`;
          if (renderTriggers[i].size.indexOf("vh") != -1)
            cntCtx.font = `${renderTriggers[i].weight} ${(cntCanvas.height / 100) * Number(renderTriggers[i].size.split("vh")[0])}px Metropolis, Pretendard JP Variable`;
          cntCtx.textAlign = renderTriggers[i].align;
          cntCtx.textBaseline = renderTriggers[i].valign;
          cntCtx.fillText(renderTriggers[i].text, tw * (renderTriggers[i].x + 100), th * (renderTriggers[i].y + 100));
        }
      }
    }

    // Destroy Particles
    for (let i = 0; i < destroyParticles.length; i++) {
      if (destroyParticles[i].w > 0) {
        drawParticle(0, destroyParticles[i].x, destroyParticles[i].y, i);
        destroyParticles[i].w = 5 - (Date.now() - destroyParticles[i].ms) / 50;
        destroyParticles[i].n++;
      }
    }

    // Prevent destroy infinite loop
    prevDestroyedBullets = new Set(destroyedBullets);
    for (let i of destroyedSeeks) {
      prevDestroyedSeeks.add(i);
    }

    // Editor only - Note & Bullet location live draw (when mode is "Add")
    if (mode == 2 && mouseMode == 0) {
      let p = [0, 0];
      if (mouseX < -80) {
        p[0] = (-80 - mouseX) / 20;
      } else if (mouseX > 80) {
        p[1] = (mouseX - 80) / 20;
      }
      if (p[0] == 0 && p[1] == 0) {
        if (circleToggle && selectedCntElement.v1 === 0) {
          const radius = cntCanvas.width / 10;
          const noteX = tw * (pattern.patterns[selectedCntElement.i].x + 100);
          const noteY = th * (pattern.patterns[selectedCntElement.i].y + 100);
          const difX = noteX - tw * (mouseX + 100);
          const difY = noteY - th * (mouseY + 100);
          const distance = Math.sqrt(difX * difX + difY * difY) + radius / 2;
          const angle = calcAngleDegrees(difX, difY) + 180;
          const newDistance = distance - (distance % radius);
          const newX = ((noteX + newDistance * getCos(angle)) / cntCanvas.width) * 200 - 100;
          const newY = ((noteY + newDistance * getSin(angle)) / cntCanvas.height) * 200 - 100;
          drawNote(100, Math.round(newX), Math.round(newY), true, selectedValue, 1, 0);
        } else if (magnetToggle) drawNote(100, mouseX - (mouseX % 5), mouseY - (mouseY % 5), true, selectedValue, 1, 0);
        else drawNote(100, mouseX, mouseY, true, selectedValue, 1, 0);
      } else {
        if (p[1] == 0) {
          drawBullet(-100, magnetToggle ? mouseY - (mouseY % 5) : mouseY, 0, true, mouseY - (mouseY % 5), "L");
        } else {
          drawBullet(100, magnetToggle ? mouseY - (mouseY % 5) : mouseY, 180, true, mouseY - (mouseY % 5), "R");
        }
      }
    }

    // Note render
    end = upperBound(pattern.patterns, beats + 5 / speed);
    const renderNotes = pattern.patterns.slice(0, end);
    for (let i = 0; renderNotes.length > i; i++) {
      if (mouseMode == 0) trackMouseSelection(i, 0, renderNotes[i].value, renderNotes[i].x, renderNotes[i].y);
    }
    for (let i = renderNotes.length - 1; i >= 0; i--) {
      const p = (1 - (renderNotes[i].beat - beats) / (5 / speed)) * 100;
      const t = ((beats - renderNotes[i].beat) / renderNotes[i].duration) * 100;
      const f = (1 - (renderNotes[i].beat + renderNotes[i].duration - beats) / (5 / speed)) * 100;
      drawNote(p, renderNotes[i].x, renderNotes[i].y, selectedCheck(0, i), renderNotes[i].value, renderNotes[i].direction, t, f);
    }

    //Bullet render
    let start = lowerBound(pattern.bullets, beats - 24);
    end = upperBound(pattern.bullets, beats);
    const renderBullets = pattern.bullets.slice(start, end);
    for (let i = 0; i < renderBullets.length; i++) {
      if (!destroyedBullets.has(start + i)) {
        createdBullets.add(start + i);
        if (!prevCreatedBullets.has(start + i)) {
          let randomDirection = [];
          for (let i = 0; i < 3; i++) {
            let rx = Math.floor(Math.random() * 4) - 2;
            let ry = Math.floor(Math.random() * 4) - 2;
            randomDirection[i] = [rx, ry];
          }
          destroyParticles.push({
            x: renderBullets[i].direction == "L" ? -100 : 100,
            y: renderBullets[i].location,
            w: 10,
            n: 2,
            d: randomDirection,
            ms: Date.now(),
          });
        }
        const p = ((beats - renderBullets[i].beat) / (15 / speed / renderBullets[i].speed)) * 100; //15 for proper speed(lower is too fast)
        const left = renderBullets[i].direction == "L";
        let x = (left ? 1 : -1) * (getCos(renderBullets[i].angle) * p - 100);
        let y = renderBullets[i].location + (left ? 1 : -1) * getSin(renderBullets[i].angle) * p;
        if (mouseMode == 0) trackMouseSelection(start + i, 1, 0, x, y);
        drawBullet(x, y, renderBullets[i].angle + (left ? 0 : 180), selectedCheck(1, start + i), renderBullets[i].location, renderBullets[i].direction);
      }
    }
    prevCreatedBullets = new Set(createdBullets);

    // Editor only - Trigger guide text (when mode is "Add")
    if (mode == 2 && mouseMode == -1) {
      cntCtx.fillStyle = "rgba(0,0,0,0.5)";
      cntCtx.fillRect(0, 0, cntCanvas.width, cntCanvas.height);
      cntCtx.beginPath();
      cntCtx.fillStyle = "#FFF";
      cntCtx.strokeStyle = "#FFF";
      cntCtx.lineWidth = 4;
      cntCtx.moveTo(cntCanvas.width / 2, cntCanvas.height / 2 - 30);
      cntCtx.lineTo(cntCanvas.width / 2, cntCanvas.height / 2);
      cntCtx.stroke();
      cntCtx.moveTo(cntCanvas.width / 2 - 15, cntCanvas.height / 2 - 15);
      cntCtx.lineTo(cntCanvas.width / 2 + 15, cntCanvas.height / 2 - 15);
      cntCtx.stroke();
      cntCtx.font = `500 ${cntCanvas.height / 25}px Metropolis, Pretendard JP Variable`;
      cntCtx.textAlign = "center";
      cntCtx.textBaseline = "top";
      cntCtx.fillText("Click to add Trigger", cntCanvas.width / 2, cntCanvas.height / 2 + 10);
    }

    //Cursor
    if (pointingCntElement.i === "") {
      componentView.style.cursor = "";
    } else {
      componentView.style.cursor = "url('/images/parts/cursor/blueSelect.cur'), pointer";
    }
  } catch (e) {
    if (e) {
      cntCtx.font = `500 ${window.innerHeight / 40}px Metropolis, Pretendard JP Variable`;
      cntCtx.fillStyle = "#F55";
      cntCtx.textAlign = "left";
      cntCtx.textBaseline = "top";
      cntCtx.fillText(e, cntCanvas.width / 100, cntCanvas.height / 100);
      console.error(e);
    }
  }
  tmlRender();
  if (mouseMode == 0 && !denyCursor) drawCursor();
};

const songPlayPause = () => {
  if (document.getElementById("editorMainContainer").style.display == "initial") {
    prevDestroyedSeeks.clear();
    destroyedSeeks.clear();
    if (song.playing()) {
      controlBtn.classList.add("timeline-play");
      controlBtn.classList.remove("timeline-pause");
      song.pause();
    } else {
      controlBtn.classList.add("timeline-pause");
      controlBtn.classList.remove("timeline-play");
      song.play();
    }
  }
};

const save = () => {
  let trackSettingsForm = settingsPropertiesTextbox;
  pattern.information = {
    version: "1.0",
    track: trackSettingsForm[0].value,
    producer: trackSettingsForm[1].value,
    author: trackSettingsForm[2].value,
    bpm: pattern.information.bpm,
    speed: pattern.information.speed,
    offset: offset,
  };
  let a = document.createElement("a");
  let file = new Blob([JSON.stringify(pattern)], { type: "application/json" });
  a.href = URL.createObjectURL(file);
  a.download = `${songName.innerText}.json`;
  localStorage.pattern = JSON.stringify(pattern);
  a.click();
};

const settingsInput = (v, e) => {
  let element;
  switch (v) {
    case "x":
    case "y":
      if (isNaN(Number(e.value))) {
        if (e.value != "-") {
          iziToast.error({
            title: "Input Error",
            message: "Input value is not number.",
          });
        }
      } else if (Number(e.value) > 100) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is too high.",
        });
      } else if (Number(e.value) < -100) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is too low.",
        });
      } else {
        pattern.patterns[selectedCntElement.i][v] = Number(e.value);
        patternChanged();
        return;
      }
      if (e.value != "-") {
        e.value = pattern.patterns[selectedCntElement.i][v];
      }
      break;
    case "Direction":
      if (isNaN(Number(e.value))) {
        if (e.value != "-") {
          iziToast.error({
            title: "Input Error",
            message: "Input value is not number.",
          });
        }
      } else if (Number(e.value) != 1 && Number(e.value) != -1) {
        iziToast.error({
          title: "Input Error",
          message: "Input value should be 1 or -1.",
        });
      } else {
        pattern.patterns[selectedCntElement.i][v.toLowerCase()] = Number(e.value);
        patternChanged();
        return;
      }
      if (e.value != "-") {
        e.value = pattern.patterns[selectedCntElement.i][v.toLowerCase()];
      }
      break;
    case "Timing":
      if (isNaN(Number(e.value))) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is not number.",
        });
      } else if (Number(e.value) < 0) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is too low.",
        });
      } else {
        if (e.value[e.value.length - 1] == ".") return;
        let targetElements, changedResult;
        let value = Number(Number(e.value).toPrecision(10));
        if (selectedCntElement.v1 === copySelection.element) {
          rangeCopyCancel();
        }
        if (selectedCntElement.v1 == 0) {
          pattern.patterns[selectedCntElement.i].beat = value;
          changedResult = pattern.patterns[selectedCntElement.i];
          pattern.patterns.sort(sortAsTiming);
          patternChanged();
          targetElements = pattern.patterns;
        } else if (selectedCntElement.v1 == 1) {
          pattern.bullets[selectedCntElement.i].beat = value;
          changedResult = pattern.bullets[selectedCntElement.i];
          pattern.bullets.sort(sortAsTiming);
          patternChanged();
          targetElements = pattern.bullets;
        } else if (selectedCntElement.v1 == 2) {
          pattern.triggers[selectedCntElement.i].beat = value;
          changedResult = pattern.triggers[selectedCntElement.i];
          pattern.triggers.sort(sortAsTiming);
          patternChanged();
          targetElements = pattern.triggers;
        }
        for (let i = 0; i < targetElements.length; i++) {
          if (JSON.stringify(targetElements[i]) == JSON.stringify(changedResult)) {
            selectedCntElement = {
              i: i,
              v1: selectedCntElement.v1,
              v2: selectedCntElement.v2,
            };
            changeSettingsMode(selectedCntElement.v1, selectedCntElement.v2, selectedCntElement.i);
            return;
          }
        }
      }
      if (selectedCntElement.v1 == 0) {
        e.value = pattern.patterns[selectedCntElement.i].beat;
      } else if (selectedCntElement.v1 == 1) {
        e.value = pattern.bullets[selectedCntElement.i].beat;
      } else {
        e.value = pattern.triggers[selectedCntElement.i].beat;
      }
      break;
    case "Side":
      if (e.value.toUpperCase() == "L" || e.value.toUpperCase() == "LEFT") {
        pattern.bullets[selectedCntElement.i].direction = "L";
        patternChanged();
      } else if (e.value.toUpperCase() == "R" || e.value.toUpperCase() == "RIGHT") {
        pattern.bullets[selectedCntElement.i].direction = "R";
        patternChanged();
      } else if (e.value == "") {
        if (pattern.bullets[selectedCntElement.i].direction == "L") {
          pattern.bullets[selectedCntElement.i].direction = "R";
        } else {
          pattern.bullets[selectedCntElement.i].direction = "L";
        }
        patternChanged();
      } else {
        if (pattern.bullets[selectedCntElement.i].direction == "R") {
          pattern.bullets[selectedCntElement.i].direction = "L";
          patternChanged();
        }
        iziToast.error({
          title: "Input Error",
          message: "Input value should be L or R.",
        });
      }
      e.value = pattern.bullets[selectedCntElement.i].direction;
      break;
    case "Location":
      if (isNaN(Number(e.value))) {
        if (e.value != "-") {
          iziToast.error({
            title: "Input Error",
            message: "Input value is not number.",
          });
        }
      } else if (Number(e.value) > 100) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is too high.",
        });
      } else if (Number(e.value) < -100) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is too low.",
        });
      } else {
        pattern.bullets[selectedCntElement.i].location = Number(e.value);
        patternChanged();
        return;
      }
      if (e.value != "-") {
        e.value = pattern.bullets[selectedCntElement.i].location;
      }
      break;
    case "Angle":
      if (isNaN(Number(e.value))) {
        if (e.value != "-") {
          iziToast.error({
            title: "Input Error",
            message: "Input value is not number.",
          });
        }
      } else {
        pattern.bullets[selectedCntElement.i].angle = Number(e.value);
        patternChanged();
        return;
      }
      if (e.value != "-") {
        e.value = pattern.bullets[selectedCntElement.i].angle;
      }
      break;
    case "Speed":
      if (selectedCntElement.v1 == 0) {
        element = pattern.patterns[selectedCntElement.i];
      } else if (selectedCntElement.v1 == 1) {
        element = pattern.bullets[selectedCntElement.i];
      } else {
        iziToast.error({
          title: "Error",
          message: "Wrong Element.",
        });
      }
      if (isNaN(Number(e.value))) {
        if (e.value != "-") {
          iziToast.error({
            title: "Input Error",
            message: "Input value is not number.",
          });
        }
      } else if (Number(e.value) > 5) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is too high.",
        });
      } else if (e.value != "" && Number(e.value) < 1) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is too low.",
        });
      } else {
        element.speed = Number(e.value);
        patternChanged();
        return;
      }
      break;
    case "Time":
    case "Duration":
      if (isNaN(Number(e.value))) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is not number.",
        });
      } else if (Number(e.value) < 0) {
        iziToast.error({
          title: "Input Error",
          message: "Input value must not be less than 0.",
        });
      } else {
        pattern.patterns[selectedCntElement.i][v.toLowerCase()] = Number(e.value);
        patternChanged();
        return;
      }
      break;
    default:
      alert(`settingsInput:Error, ${v} is not defined.`);
  }
};

const triggersInput = (v, e) => {
  switch (v) {
    case "x":
    case "y":
      if (isNaN(Number(e.value))) {
        if (e.value != "-") {
          iziToast.error({
            title: "Input Error",
            message: "Input value is not number.",
          });
        }
      } else if (Number(e.value) > 100) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is too high.",
        });
      } else if (Number(e.value) < -100) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is too low.",
        });
      } else {
        pattern.triggers[selectedCntElement.i][v] = Number(e.value);
        patternChanged();
        return;
      }
      if (e.value != "-") {
        e.value = pattern.triggers[selectedCntElement.i][v];
      }
      break;
    case "num":
      if (isNaN(Number(e.value))) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is not number.",
        });
      } else if (Number(e.value) > pattern.bullets.length || Number(e.value) < 0) {
        iziToast.error({
          title: "Input Error",
          message: `Input value must be between 0 and ${pattern.bullets.length}.`,
        });
      } else {
        pattern.triggers[selectedCntElement.i][v] = Number(e.value);
        patternChanged();
        return;
      }
      e.value = pattern.triggers[selectedCntElement.i][v];
      break;
    case "bpm":
    case "duration":
      textBlurred();
      if (isNaN(Number(e.value))) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is not number.",
        });
      } else if (Number(e.value) < 0) {
        iziToast.error({
          title: "Input Error",
          message: "Input value must not be less than 0.",
        });
      } else {
        pattern.triggers[selectedCntElement.i][v] = Number(e.value);
        patternChanged();
        return;
      }
      e.value = pattern.triggers[selectedCntElement.i][v];
      break;
    case "opacity":
      if (isNaN(Number(e.value))) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is not number.",
        });
      } else if (Number(e.value) < 0) {
        iziToast.error({
          title: "Input Error",
          message: "Input value must not be less than 0.",
        });
      } else if (Number(e.value) > 1) {
        iziToast.error({
          title: "Input Error",
          message: "Input value must not be more than 1.",
        });
      } else {
        pattern.triggers[selectedCntElement.i][v] = Number(e.value);
        patternChanged();
        return;
      }
      if (e.value != "0.") {
        e.value = pattern.triggers[selectedCntElement.i][v];
      }
      break;
    case "speed":
      textBlurred();
      if (isNaN(Number(e.value))) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is not number.",
        });
      } else if (Number(e.value) < 0) {
        iziToast.error({
          title: "Input Error",
          message: "Input value must not be less than 0.",
        });
      } else if (Number(e.value) > 5) {
        iziToast.error({
          title: "Input Error",
          message: "Input value must not be more than 5.",
        });
      } else {
        pattern.triggers[selectedCntElement.i][v] = Number(e.value);
        patternChanged();
        return;
      }
      e.value = pattern.triggers[selectedCntElement.i][v];
      break;
    case "align":
      textBlurred();
      if (e.value == "left" || e.value == "center" || e.value == "right") {
        pattern.triggers[selectedCntElement.i][v] = e.value;
        patternChanged();
        return;
      }
      iziToast.error({
        title: "Input Error",
        message: "Input value should be 'left', 'center', or 'right'.",
      });
      e.value = pattern.triggers[selectedCntElement.i][v];
      break;
    case "valign":
      textBlurred();
      if (e.value == "top" || e.value == "bottom" || e.value == "middle" || e.value == "alphabetic" || e.value == "hanging") {
        pattern.triggers[selectedCntElement.i][v] = e.value;
        patternChanged();
        return;
      }
      iziToast.error({
        title: "Input Error",
        message: "Input value should be 'top', 'bottom', 'middle', 'alphabetic', 'hanging'.",
      });
      e.value = pattern.triggers[selectedCntElement.i][v];
      break;
    case "size":
    case "weight":
    case "text":
    case "seek":
      pattern.triggers[selectedCntElement.i][v] = e.value;
      patternChanged();
      break;
    default:
      alert("settingsInput:Error");
  }
};

const moveTo = () => {
  let s = 0;
  iziToast.info({
    timeout: 20000,
    overlay: true,
    displayMode: "once",
    id: "inputs",
    zindex: 999,
    title: "Move",
    message: moveToAlert,
    position: "center",
    drag: false,
    inputs: [
      [
        '<input type="number">',
        "keyup",
        (instance, toast, input, e) => {
          s = Number(input.value);
        },
      ],
    ],
    buttons: [
      [
        "<button><b>GO</b></button>",
        (instance, toast) => {
          song.seek(s);
          instance.hide({ transitionOut: "fadeOut" }, toast, "confirm");
        },
        true,
      ],
    ],
  });
};

const changeBPM = (e) => {
  if (isNaN(Number(e.value))) {
    iziToast.error({
      title: "Input Error",
      message: "Input value is not number.",
    });
  } else {
    bpm = Number(e.value);
    pattern.information.bpm = bpm;
    patternChanged();
  }
};

const changeSpeed = (e) => {
  if (isNaN(Number(e.value))) {
    iziToast.error({
      title: "Input Error",
      message: "Input value is not number.",
    });
  } else {
    if (Number(e.value) > 5) {
      iziToast.error({
        title: "Input Error",
        message: "Input value is too high.",
      });
    } else if (Number(e.value) <= 0) {
      iziToast.error({
        title: "Input Error",
        message: "Input value is too low.",
      });
    } else {
      speed = Number(e.value);
      pattern.information.speed = speed;
      patternChanged();
    }
  }
};

const changeOffset = (e) => {
  if (isNaN(Number(e.value))) {
    iziToast.error({
      title: "Input Error",
      message: "Input value is not number.",
    });
  } else {
    offset = Number(e.value);
    pattern.information.offset = offset;
    patternChanged();
  }
};

const trackMousePos = () => {
  const width = parseInt((componentView.offsetWidth - canvasContainer.offsetWidth) / 2 + menuContainer.offsetWidth);
  const height = document.getElementById("navbar").offsetHeight;
  const x = ((event.clientX - width) / canvasContainer.offsetWidth) * 200 - 100;
  const y = ((event.clientY - height) / canvasContainer.offsetHeight) * 200 - 100;
  if (!(x < -100 || y < -100 || x > 100 || y > 100)) {
    mouseMode = 0;
    mouseX = Math.round(x);
    mouseY = Math.round(y);
  } else {
    mouseMode = -1;
  }
};

const trackTimelineMousePos = () => {
  mouseMode = 1;
  mouseX = event.clientX * pixelRatio;
  mouseY = (event.clientY - Math.floor((window.innerHeight / 100) * 73)) * pixelRatio;
};

const elementFollowMouse = (v1, v2, i) => {
  requestAnimationFrame(() => {
    if (mouseDown && (pointingCntElement.v1 !== "" || v1 != undefined)) {
      if (v1 == undefined) {
        v1 = pointingCntElement.v1;
        v2 = pointingCntElement.v2;
        i = pointingCntElement.i;
      }
      if (dragMouseX == undefined) {
        dragMouseX = mouseX;
        dragMouseY = mouseY;
        originX = v1 == 0 ? pattern.patterns[i].x : 0;
        originY = v1 == 0 ? pattern.patterns[i].y : pattern.bullets[i].location;
      }
      let newX, newY;
      switch (v1) {
        case 0:
          newX = originX + mouseX - dragMouseX;
          newY = originY + mouseY - dragMouseY;
          if (newX <= 100 && newX >= -100 && newY <= 100 && newY >= -100 && mouseMode == 0) {
            pattern.patterns[i].x = magnetToggle ? newX - (newX % 5) : newX;
            pattern.patterns[i].y = magnetToggle ? newY - (newY % 5) : newY;
          }
          break;
        case 1:
          newY = originY + mouseY - dragMouseY;
          if (newY <= 100 && newY >= -100 && mouseMode == 0) {
            pattern.bullets[i].location = magnetToggle ? newY - (newY % 5) : newY;
          }
          break;
      }
      lastMovedMs = Date.now();
      setTimeout(() => {
        if (Date.now() - lastMovedMs >= 100 && lastMovedMs != -1) {
          lastMovedMs = -1;
          patternChanged();
        }
      }, 100);
      elementFollowMouse(v1, v2, i);
      changeSettingsMode(v1, v2, i);
    } else {
      if (v1 == undefined) {
        v1 = pointingCntElement.v1;
        v2 = pointingCntElement.v2;
        i = pointingCntElement.i;
      }
      dragMouseX = undefined;
      dragMouseY = undefined;
      originX = undefined;
      originY = undefined;
    }
  });
};

const timelineFollowMouse = (v1, v2, i) => {
  requestAnimationFrame(() => {
    if (mouseDown && (pointingCntElement.v1 !== "" || v1 != undefined)) {
      if (v1 == undefined) {
        v1 = pointingCntElement.v1;
        v2 = pointingCntElement.v2;
        i = pointingCntElement.i;
      }
      if (mouseMode == 1 && mouseX > tmlCanvas.width / 10 && mouseX < tmlCanvas.width / 1.01) {
        const beats = bpmsync.beat + (song.seek() * 1000 - (offset + sync) - bpmsync.ms) / (60000 / bpm);
        const beatToPx = (tmlCanvas.width / 1.01 - tmlCanvas.width / 10) / (17 * zoom);
        let calculatedBeat = beats + ((mouseX - tmlCanvas.width / 10) / beatToPx) * zoom - 1;
        if (calculatedBeat <= 0) calculatedBeat = 0;
        calculatedBeat = Number(calculatedBeat.toPrecision(10));
        switch (v1) {
          case 0:
            pattern.patterns[i].beat = magnetToggle ? Math.round(calculatedBeat * split) / split : calculatedBeat;
            break;
          case 1:
            pattern.bullets[i].beat = magnetToggle ? Math.round(calculatedBeat * split) / split : calculatedBeat;
            break;
          case 2:
            pattern.triggers[i].beat = magnetToggle ? Math.round(calculatedBeat * split) / split : calculatedBeat;
            break;
        }
        lastMovedMs = Date.now();
        setTimeout(() => {
          if (Date.now() - lastMovedMs >= 100 && lastMovedMs != -1) {
            lastMovedMs = -1;
            patternChanged();
          }
        }, 100);
      }
      timelineFollowMouse(v1, v2, i);
      changeSettingsMode(v1, v2, i);
    }
  });
};

const tmlClicked = () => {
  if (isNaN(Number(song.seek()))) return iziToast.error({ title: "Wait..", message: "Song is not loaded." });
  if (mode == 0) {
    timelineFollowMouse();
  } else if (mode == 1) {
    if (pointingCntElement.v1 !== "") {
      if (JSON.stringify(pointingCntElement) == JSON.stringify(selectedCntElement)) {
        changeSettingsMode(-1);
        if (isSettingsOpened) toggleSettings();
        selectedCntElement = { v1: "", v2: "", i: "" };
      } else {
        changeSettingsMode(pointingCntElement.v1, pointingCntElement.v2, pointingCntElement.i);
        if (!isSettingsOpened) toggleSettings();
        selectedCntElement = pointingCntElement;
        copySelect();
      }
    } else {
      changeSettingsMode(-1);
      if (isSettingsOpened) toggleSettings();
      selectedCntElement = { v1: "", v2: "", i: "" };
    }
  } else if (mode == 2) {
    timelineAddElement();
  }
  copySeek();
};

const copySeek = () => {
  if (mouseX < tmlCanvas.width / 10 && mouseY < tmlCanvas.height / 6) {
    const beats = bpmsync.beat + (song.seek() * 1000 - bpmsync.ms) / (60000 / bpm);
    navigator.clipboard.writeText(beats);
    copied = true;
    copiedTime = new Date();
  }
};

const timelineAddElement = () => {
  let startY = tmlCanvas.height / 6;
  let height = tmlCanvas.height / 9;
  const beats = bpmsync.beat + (song.seek() * 1000 - bpmsync.ms) / (60000 / bpm);
  const beatToPx = (tmlCanvas.width / 1.01 - tmlCanvas.width / 10) / (17 * zoom);
  let calculatedBeat = beats + ((mouseX - tmlCanvas.width / 10) / beatToPx) * zoom - 1;
  if (calculatedBeat <= 0) calculatedBeat = 0;
  calculatedBeat = Number(calculatedBeat.toPrecision(10));
  let mousePosY = mouseY - timelineYLoc;
  if (mouseX > tmlCanvas.width / 10 && mouseX < tmlCanvas.width / 1.01 && mouseY > startY && mouseY < tmlCanvas.height / 1.1) {
    if (mousePosY >= startY && mousePosY <= startY + height) {
      let newElement = { beat: calculatedBeat, value: selectedValue, direction: 1, x: 0, y: 0, duration: 4 };
      pattern.patterns.push(newElement);
      pattern.patterns.sort(sortAsTiming);
      patternChanged();
      for (let i = 0; i < pattern.patterns.length; i++) {
        if (JSON.stringify(pattern.patterns[i]) == JSON.stringify(newElement)) {
          selectedCntElement = { v1: 0, v2: selectedValue, i: i };
          break;
        }
      }
    } else if (mousePosY >= startY + height && mousePosY <= startY + height * (bulletsOverlapNum + 1)) {
      let newElement = {
        beat: calculatedBeat,
        direction: "L",
        location: 0,
        angle: 0,
        speed: 2,
      };
      pattern.bullets.push(newElement);
      pattern.bullets.sort(sortAsTiming);
      patternChanged();
      for (let i = 0; i < pattern.bullets.length; i++) {
        if (JSON.stringify(pattern.bullets[i]) == JSON.stringify(newElement)) {
          selectedCntElement = { v1: 1, v2: 0, i: i };
          break;
        }
      }
    } else if (mousePosY >= startY + height * (bulletsOverlapNum + 1) && mousePosY <= startY + height * (bulletsOverlapNum + 1) + height * (triggersOverlapNum + 1)) {
      let newElement = {
        beat: calculatedBeat,
        value: -1,
        num: 0,
        bpm: bpm,
        opacity: 1,
        speed: speed,
        align: "center",
        valign: "middle",
        weight: 500,
        size: "3vh",
        duration: 4,
        x: 0,
        y: 0,
        text: "",
      };
      pattern.triggers.push(newElement);
      pattern.triggers.sort(sortAsTiming);
      patternChanged();
      for (let i = 0; i < pattern.triggers.length; i++) {
        if (JSON.stringify(pattern.triggers[i]) == JSON.stringify(newElement)) {
          selectedCntElement = { i: i, v1: 2, v2: -1 };
          break;
        }
      }
    } else {
      return;
    }
    changeSettingsMode(selectedCntElement.v1, selectedCntElement.v2, selectedCntElement.i);
    if (selectedCntElement.v1 === copySelection.element) {
      rangeCopyCancel();
    }
    if (!isSettingsOpened) toggleSettings();
  }
};

const compClicked = () => {
  if (isNaN(Number(song.seek()))) return iziToast.error({ title: "Wait..", message: "Song is not loaded." });
  if (mode == 0) {
    elementFollowMouse();
  } else if (mode == 1) {
    if (pointingCntElement.v1 !== "") {
      if (JSON.stringify(pointingCntElement) == JSON.stringify(selectedCntElement)) {
        changeSettingsMode(-1);
        if (isSettingsOpened) toggleSettings();
        selectedCntElement = { v1: "", v2: "", i: "" };
      } else {
        changeSettingsMode(pointingCntElement.v1, pointingCntElement.v2, pointingCntElement.i);
        if (!isSettingsOpened) toggleSettings();
        selectedCntElement = pointingCntElement;
        copySelect();
      }
    } else {
      changeSettingsMode(-1);
      if (isSettingsOpened) toggleSettings();
      selectedCntElement = { v1: "", v2: "", i: "" };
    }
  } else if (mode == 2) {
    let beats = bpmsync.beat + (song.seek() * 1000 - bpmsync.ms) / (60000 / bpm);
    if (mouseMode != -1) {
      if (mouseX < -80 || mouseX > 80) {
        let newElement = {
          beat: beats,
          direction: mouseX < -80 ? "L" : "R",
          location: parseInt(magnetToggle ? mouseY - (mouseY % 5) : mouseY),
          angle: 0,
          speed: 2,
        };
        pattern.bullets.push(newElement);
        pattern.bullets.sort(sortAsTiming);
        patternChanged();
        for (let i = 0; i < pattern.bullets.length; i++) {
          if (JSON.stringify(pattern.bullets[i]) == JSON.stringify(newElement)) {
            selectedCntElement = { v1: 1, v2: 0, i: i };
          }
        }
      } else {
        let newX = magnetToggle ? mouseX - (mouseX % 5) : mouseX;
        let newY = magnetToggle ? mouseY - (mouseY % 5) : mouseY;
        if (circleToggle && selectedCntElement.v1 === 0) {
          const radius = cntCanvas.width / 10;
          const noteX = (cntCanvas.width / 200) * (pattern.patterns[selectedCntElement.i].x + 100);
          const noteY = (cntCanvas.height / 200) * (pattern.patterns[selectedCntElement.i].y + 100);
          const difX = noteX - (cntCanvas.width / 200) * (mouseX + 100);
          const difY = noteY - (cntCanvas.height / 200) * (mouseY + 100);
          const distance = Math.sqrt(difX * difX + difY * difY) + radius / 2;
          const angle = calcAngleDegrees(difX, difY) + 180;
          const newDistance = distance - (distance % radius);
          newX = ((noteX + newDistance * getCos(angle)) / cntCanvas.width) * 200 - 100;
          newY = ((noteY + newDistance * getSin(angle)) / cntCanvas.height) * 200 - 100;
        }
        let newElement = {
          beat: beats,
          value: selectedValue,
          direction: 1,
          duration: 4,
          x: parseInt(newX),
          y: parseInt(newY),
        };
        pattern.patterns.push(newElement);
        pattern.patterns.sort(sortAsTiming);
        patternChanged();
        for (let i = 0; i < pattern.patterns.length; i++) {
          if (JSON.stringify(pattern.patterns[i]) == JSON.stringify(newElement)) {
            selectedCntElement = { v1: 0, v2: selectedValue, i: i };
          }
        }
      }
      changeSettingsMode(selectedCntElement.v1, selectedCntElement.v2, selectedCntElement.i);
      if (!isSettingsOpened) toggleSettings();
    } else {
      let newElement = {
        beat: beats,
        value: -1,
        num: 0,
        bpm: bpm,
        opacity: 1,
        speed: speed,
        align: "center",
        valign: "middle",
        weight: 500,
        size: "1vh",
        duration: 4,
        x: 0,
        y: 0,
        text: "",
      };
      pattern.triggers.push(newElement);
      pattern.triggers.sort(sortAsTiming);
      for (let i = 0; i < pattern.triggers.length; i++) {
        if (JSON.stringify(pattern.triggers[i]) == JSON.stringify(newElement)) {
          selectedCntElement = { i: i, v1: 2, v2: -1 };
          patternChanged();
          changeSettingsMode(selectedCntElement.v1, selectedCntElement.v2, selectedCntElement.i);
          if (!isSettingsOpened) toggleSettings();
        }
      }
    }
    if (selectedCntElement.v1 === copySelection.element) {
      rangeCopyCancel();
    }
  }
};

const changeSettingsMode = (v1, v2, i) => {
  trackSettings.style.display = "none";
  elementsSettings.style.display = "block";
  switch (v1) {
    case -1:
      trackSettings.style.display = "block";
      elementsSettings.style.display = "none";
      document.getElementById("dot").style.color = "#9d4ec2";
      document.getElementById("settingsNameSpace").innerText = "Settings";
      document.getElementById("trackSettings").style.display = "block";
      document.getElementById("elementsSettings").style.display = "none";
      break;
    case 0:
      document.getElementById("settingsNameSpace").innerText = `Note_${i}`;
      document.getElementById("trackSettings").style.display = "none";
      document.getElementById("elementsSettings").style.display = "block";
      document.getElementById("noteSettingsContainer").style.display = "block";
      document.getElementById("bulletSettingsContainer").style.display = "none";
      document.getElementById("triggerSettingsContainer").style.display = "none";
      document.getElementById("triggerInitializeContainer").style.display = "none";
      noteSettingsContainer.getElementsByClassName("settingsPropertiesTextbox")[0].value = pattern.patterns[i].x;
      noteSettingsContainer.getElementsByClassName("settingsPropertiesTextbox")[1].value = pattern.patterns[i].y;
      noteSettingsContainer.getElementsByClassName("settingsPropertiesTextbox")[2].value = pattern.patterns[i].beat;
      noteSettingsContainer.getElementsByClassName("settingsPropertiesTextbox")[3].value = pattern.patterns[i].direction;
      noteSettingsContainer.getElementsByClassName("settingsPropertiesTextbox")[4].value = pattern.patterns[i].duration;
      switch (v2) {
        case 0:
          document.getElementById("dot").style.color = "#f59b42";
          noteSettingsContainer.getElementsByClassName("settingsPropertiesIndividual")[3].style.display = "none";
          noteSettingsContainer.getElementsByClassName("settingsPropertiesIndividual")[4].style.display = "none";
          break;
        case 1:
          document.getElementById("dot").style.color = "#f54e42";
          noteSettingsContainer.getElementsByClassName("settingsPropertiesIndividual")[3].style.display = "flex";
          noteSettingsContainer.getElementsByClassName("settingsPropertiesIndividual")[4].style.display = "none";
          break;
        case 2:
          document.getElementById("dot").style.color = "#573fa6";
          noteSettingsContainer.getElementsByClassName("settingsPropertiesIndividual")[3].style.display = "none";
          noteSettingsContainer.getElementsByClassName("settingsPropertiesIndividual")[4].style.display = "flex";
          break;
        default:
          alert("changeSettingsMode:Error");
      }
      break;
    case 1:
      document.getElementById("settingsNameSpace").innerText = `Bullet_${i}`;
      document.getElementById("dot").style.color = "#6fdef7";
      document.getElementById("noteSettingsContainer").style.display = "none";
      document.getElementById("triggerSettingsContainer").style.display = "none";
      document.getElementById("bulletSettingsContainer").style.display = "block";
      document.getElementById("triggerInitializeContainer").style.display = "none";
      bulletSettingsContainer.getElementsByClassName("settingsPropertiesTextbox")[0].value = pattern.bullets[i].direction;
      bulletSettingsContainer.getElementsByClassName("settingsPropertiesTextbox")[1].value = pattern.bullets[i].location;
      bulletSettingsContainer.getElementsByClassName("settingsPropertiesTextbox")[3].value = pattern.bullets[i].beat;
      bulletSettingsContainer.getElementsByClassName("settingsPropertiesTextbox")[4].value = pattern.bullets[i].speed;
      bulletSettingsContainer.getElementsByClassName("settingsPropertiesTextbox")[2].value = pattern.bullets[i].angle;
      break;
    case 2:
      document.getElementById("settingsNameSpace").innerText = `Trigger_${i}`;
      document.getElementById("dot").style.color = "#36bf24";
      document.getElementById("trackSettings").style.display = "none";
      document.getElementById("elementsSettings").style.display = "block";
      document.getElementById("noteSettingsContainer").style.display = "none";
      document.getElementById("bulletSettingsContainer").style.display = "none";
      document.getElementById("triggerSettingsContainer").style.display = "block";
      document.getElementById("triggerInitializeContainer").style.display = "none";
      triggerSelectBox.selectedIndex = pattern.triggers[i].value;
      if (v2 == -1) {
        document.getElementById("triggerSettingsContainer").style.display = "none";
        document.getElementById("triggerInitializeContainer").style.display = "block";
        triggerInitBox.selectedIndex = 0;
      } else {
        let properties = document.getElementById("triggerSettingsContainer").getElementsByClassName("settingsPropertiesContainer");
        let start = 1;
        for (let j = start; properties.length - start > j; j++) {
          properties[j].style.display = "none";
          if (j - start == v2) {
            properties[j].style.display = "block";
            properties[j].getElementsByClassName("settingsPropertiesTextbox")[0].value = pattern.triggers[i].beat;
          }
        }
        let textBox = properties[v2 + start].getElementsByClassName("settingsPropertiesTextbox");
        switch (v2) {
          case 0:
            //Destroy
            textBox[1].value = pattern.triggers[i].num;
            break;
          case 2:
            //BPM
            textBox[1].value = pattern.triggers[i].bpm;
            break;
          case 3:
            //Opacity
            textBox[1].value = pattern.triggers[i].opacity;
            break;
          case 4:
            //Speed
            textBox[1].value = pattern.triggers[i].speed;
            break;
          case 5:
            //Text
            textBox[1].value = pattern.triggers[i].valign;
            textBox[2].value = pattern.triggers[i].align;
            textBox[3].value = pattern.triggers[i].weight;
            textBox[4].value = pattern.triggers[i].size;
            textBox[5].value = pattern.triggers[i].duration;
            textBox[6].value = pattern.triggers[i].x;
            textBox[7].value = pattern.triggers[i].y;
            textBox[8].value = pattern.triggers[i].text;
            break;
        }
      }
      break;
    default:
      alert("changeSettingsMode:Error");
  }
};

const triggerSet = (isChanged) => {
  pattern.triggers[selectedCntElement.i].value = (isChanged ? triggerSelectBox : triggerInitBox).selectedIndex - (isChanged ? 0 : 1);
  selectedCntElement = {
    i: selectedCntElement.i,
    v1: 2,
    v2: (isChanged ? triggerSelectBox : triggerInitBox).selectedIndex - (isChanged ? 0 : 1),
  };
  changeSettingsMode(2, selectedCntElement.v2, selectedCntElement.i);
};

const zoomIn = () => {
  zoom *= 0.9;
  zoom = Number(zoom.toPrecision(3));
};

const zoomOut = () => {
  zoom /= 0.9;
  zoom = Number(zoom.toPrecision(3));
};

const playPauseBtn = () => {
  songPlayPause();
};

const stopBtn = () => {
  controlBtn.classList.add("timeline-play");
  controlBtn.classList.remove("timeline-pause");
  song.stop();
};

const changeRate = () => {
  rate += 0.25;
  if (rate > 2) {
    rate = 0.25;
  }
  document.getElementById("percentage").innerText = `${rate * 100}%`;
  song.rate(rate);
};

const test = () => {
  iziToast.warning({
    title: "Caution",
    message: need2Save,
  });
  setTimeout(() => {
    save();
    let trackSettingsForm = settingsPropertiesTextbox;
    pattern.track = trackSettingsForm[0].value;
    pattern.producer = trackSettingsForm[1].value;
    pattern.author = trackSettingsForm[2].value;
    localStorage.pattern = JSON.stringify(pattern);
    window.location.href = `${url}/test`;
  }, 500);
  ctrlDown = false;
};

const changeSplit = () => {
  split++;
  if (split == 5) {
    split = 6;
  } else if (split == 7) {
    split = 8;
  } else if (split == 9) {
    split = 12;
  } else if (split == 13) {
    split = 16;
  } else if (split == 17) {
    split = 1;
  }
  document.getElementById("split").innerText = `1/${split}`;
};

const deleteElement = () => {
  if (selectedCntElement.v1 === copySelection.element) {
    rangeCopyCancel();
  }
  if (selectedCntElement.v1 !== "") {
    if (selectedCntElement.v1 == 0) {
      pattern.patterns.splice(selectedCntElement.i, 1);
    } else if (selectedCntElement.v1 == 1) {
      pattern.bullets.splice(selectedCntElement.i, 1);
    } else if (selectedCntElement.v1 == 2) {
      pattern.triggers.splice(selectedCntElement.i, 1);
    }
    patternChanged();
    changeSettingsMode(-1);
    selectedCntElement = { v1: "", v2: "", i: "" };
    if (isSettingsOpened) toggleSettings();
  }
};

const patternChanged = () => {
  if (patternSeek != patternHistory.length - 1) {
    patternHistory.splice(patternSeek + 1, patternHistory.length - 1 - patternSeek);
  }
  patternHistory.push(eval(`(${JSON.stringify(pattern)})`));
  if (patternHistory.length > 50) {
    patternHistory.splice(0, patternHistory.length - 50);
  }
  patternSeek = patternHistory.length - 1;
};

const patternUndo = () => {
  if (patternSeek >= 1) {
    patternSeek--;
    pattern = eval(`(${JSON.stringify(patternHistory[patternSeek])})`);
  }
  selectedCntElement = { i: "", v1: "", v2: "" };
  rangeCopyCancel();
  if (isSettingsOpened) toggleSettings();
};

const patternRedo = () => {
  if (patternSeek < patternHistory.length - 1) {
    patternSeek++;
    pattern = eval(`(${JSON.stringify(patternHistory[patternSeek])})`);
  }
  selectedCntElement = { i: "", v1: "", v2: "" };
  rangeCopyCancel();
  if (isSettingsOpened) toggleSettings();
};

const elementCopy = () => {
  if (selectedCntElement.i === "") {
    iziToast.warning({
      title: "Copy failed",
      message: "Nothing Selected.",
    });
    return;
  }
  copiedElement.v1 = selectedCntElement.v1;
  if (selectedCntElement.v1 == 0) {
    copiedElement.element = eval(`(${JSON.stringify(pattern.patterns[selectedCntElement.i])})`);
  } else if (selectedCntElement.v1 == 1) {
    copiedElement.element = eval(`(${JSON.stringify(pattern.bullets[selectedCntElement.i])})`);
  } else if (selectedCntElement.v1 == 2) {
    copiedElement.element = eval(`(${JSON.stringify(pattern.triggers[selectedCntElement.i])})`);
  }
  iziToast.success({
    title: "Copy",
    message: `Copied ${["pattern", "bullet", "trigger"][selectedCntElement.v1]}_${selectedCntElement.i}`,
  });
};

const elementPaste = () => {
  if (copiedElement.v1 === "") {
    iziToast.warning({
      title: "Paste failed",
      message: "Nothing copied.",
    });
    return;
  }
  const beats = Number((bpmsync.beat + (song.seek() * 1000 - bpmsync.ms) / (60000 / bpm)).toPrecision(10));
  copiedElement.element.beat = beats;
  let searchTarget = "";
  if (copiedElement.v1 == 0) {
    pattern.patterns.push(eval(`(${JSON.stringify(copiedElement.element)})`));
    pattern.patterns.sort(sortAsTiming);
    searchTarget = pattern.patterns;
  } else if (copiedElement.v1 == 1) {
    pattern.bullets.push(eval(`(${JSON.stringify(copiedElement.element)})`));
    pattern.bullets.sort(sortAsTiming);
    searchTarget = pattern.bullets;
  } else if (copiedElement.v1 == 2) {
    pattern.triggers.push(eval(`(${JSON.stringify(copiedElement.element)})`));
    pattern.triggers.sort(sortAsTiming);
    searchTarget = pattern.triggers;
  }
  for (let i = 0; i < searchTarget.length; i++) {
    if (JSON.stringify(searchTarget[i]) == JSON.stringify(copiedElement.element)) {
      selectedCntElement = {
        i: i,
        v1: copiedElement.v1,
        v2: searchTarget[i].value,
      };
    }
  }
  if (!isSettingsOpened) toggleSettings();
  changeSettingsMode(selectedCntElement.v1, selectedCntElement.v2, selectedCntElement.i);
  patternChanged();
  iziToast.success({
    title: "Paste",
    message: `Pasted ${["pattern", "bullet", "trigger"][selectedCntElement.v1]}_${selectedCntElement.i}`,
  });
};

const showHelp = () => {
  document.getElementById("helpContainer").style.display = "flex";
};

const hideHelp = () => {
  document.getElementById("helpContainer").style.display = "none";
};

const rangeCopy = () => {
  copySelection = { element: -1, start: -1, end: -1, ms: 0 };
  let element = "";
  iziToast.info({
    timeout: 20000,
    overlay: true,
    displayMode: "once",
    id: "inputs",
    zindex: 999,
    title: "Range Copy",
    message: rangeCopyAlert,
    position: "center",
    drag: false,
    inputs: [
      [
        '<select><option value="">--Choose--</option><option value="0">Pattern</option><option value="1">Bullet</option><option value="2">Trigger</option></select>',
        "change",
        (instance, toast, input, e) => {
          element = input.value;
        },
      ],
    ],
    buttons: [
      [
        "<button><b>OK</b></button>",
        (instance, toast) => {
          if (element !== "") {
            copySelection.element = Number(element);
            iziToast.info({
              title: "Range Copy",
              message: `Select starting point of ${["pattern", "bullet", "trigger"][copySelection.element]} to copy`,
            });
            copySelect();
            changeMode(1);
          }
          instance.hide({ transitionOut: "fadeOut" }, toast, "confirm");
        },
        true,
      ],
    ],
  });
};

const rangePaste = () => {
  const beats = Number((bpmsync.beat + (song.seek() * 1000 - bpmsync.ms) / (60000 / bpm)).toPrecision(10));
  let start = copySelection.start;
  let end = copySelection.end;
  const beat = copySelection.beat;
  const element = ["patterns", "bullets", "triggers"][copySelection.element];
  if (end == -1) {
    iziToast.warning({
      title: "Range Paste",
      message: "Nothing copied.",
    });
    return;
  }
  if (start > end) {
    const temp = start;
    start = end;
    end = temp;
  }
  for (let i = start; i <= end; i++) {
    let copy = JSON.parse(JSON.stringify(pattern[element][i]));
    copy.beat += Number((beats - beat).toPrecision(10));
    pattern[element].push(copy);
  }
  pattern[element].sort(sortAsTiming);
  patternChanged();
  iziToast.success({
    title: "Range Paste",
    message: `${["Patterns", "Bullets", "Triggers"][copySelection.element]} pasted from ${["pattern", "bullet", "trigger"][copySelection.element]}_${start} to ${
      ["pattern", "bullet", "trigger"][copySelection.element]
    }_${end}`,
  });
};

const copySelect = () => {
  if (selectedCntElement.v1 !== copySelection.element) return;
  if (copySelection.end !== -1) return;
  if (copySelection.start === -1) {
    copySelection.start = selectedCntElement.i;
    copySelection.beat = pattern[["patterns", "bullets", "triggers"][selectedCntElement.v1]][selectedCntElement.i].beat;
    iziToast.success({
      title: "Range Copy",
      message: `Copy start from ${["pattern", "bullet", "trigger"][selectedCntElement.v1]}_${selectedCntElement.i}`,
    });
  } else {
    copySelection.end = selectedCntElement.i;
    iziToast.success({
      title: "Range Copy",
      message: `${["Patterns", "Bullets", "Triggers"][selectedCntElement.v1]} copied from ${["pattern", "bullet", "trigger"][selectedCntElement.v1]}_${copySelection.start} to ${
        ["pattern", "bullet", "trigger"][selectedCntElement.v1]
      }_${copySelection.end}`,
    });
  }
  selectedCntElement = { v1: "", v2: "", i: "" };
  if (isSettingsOpened) toggleSettings();
};

const rangeCopyCancel = () => {
  if (copySelection.element === -1) return;
  copySelection = { element: -1, start: -1, end: -1, ms: 0 };
  iziToast.warning({
    title: "Range Copy",
    message: "Range copy canceled.",
  });
};

const tmlScrollLeft = () => {
  let beats = bpmsync.beat + (song.seek() * 1000 - bpmsync.ms) / (60000 / bpm); // Get current beat from song position
  beats = Number(beats.toPrecision(10 + (beats > 1 ? Math.ceil(Math.log10(beats)) : 0))); // Prevent floating point error

  const splitCalc = Number((1 / split).toPrecision(10));
  const decimalCalc = Number((beats % 1).toPrecision(10));
  const numerator = Math.floor(decimalCalc / splitCalc) - 1;
  if (numerator < 0) beats = Math.floor(beats) - 1 + (split - 1) * splitCalc;
  else beats = Math.floor(beats) + numerator * splitCalc; // Calculate numerator / denominator(splitCalc)

  // Calculate BPM change
  const renderTriggers = pattern.triggers.slice(0, upperBound(pattern.triggers, beats));
  bpm = pattern.information.bpm;
  bpmsync = {
    ms: 0,
    beat: 0,
  };
  for (let i = 0; i < renderTriggers.length; i++) {
    if (renderTriggers[i].value == 2) {
      bpmsync.ms = bpmsync.ms + (renderTriggers[i].beat - bpmsync.beat) * (60000 / bpm);
      bpm = renderTriggers[i].bpm;
      bpmsync.beat = renderTriggers[i].beat;
    }
  }
  const seek = (beats - bpmsync.beat) * (60000 / bpm) + bpmsync.ms;
  song.seek(seek / 1000);
};

const tmlScrollRight = () => {
  let beats = bpmsync.beat + (song.seek() * 1000 - bpmsync.ms) / (60000 / bpm); // Get current beat from song position
  beats = Number(beats.toPrecision(10 + (beats > 1 ? Math.ceil(Math.log10(beats)) : 0))); // Prevent floating point error

  const splitCalc = Number((1 / split).toPrecision(10));
  const decimalCalc = Number((beats % 1).toPrecision(10));
  const numerator = Math.floor(decimalCalc / splitCalc) + 1;
  if (numerator >= split) beats = Math.floor(beats) + 1;
  else beats = Math.floor(beats) + numerator * splitCalc; // Calculate numerator / denominator(splitCalc)

  // Calculate BPM change
  const renderTriggers = pattern.triggers.slice(0, upperBound(pattern.triggers, beats));
  bpm = pattern.information.bpm;
  bpmsync = {
    ms: 0,
    beat: 0,
  };
  for (let i = 0; i < renderTriggers.length; i++) {
    if (renderTriggers[i].value == 2) {
      bpmsync.ms = bpmsync.ms + (renderTriggers[i].beat - bpmsync.beat) * (60000 / bpm);
      bpm = renderTriggers[i].bpm;
      bpmsync.beat = renderTriggers[i].beat;
    }
  }
  const seek = (beats - bpmsync.beat) * (60000 / bpm) + bpmsync.ms;
  song.seek(seek / 1000);
};

const tmlScrollUp = () => {
  timelineYLoc = Number(timelineYLoc.toFixed(2)) + tmlCanvas.height / 9;
  timelineScrollCount--;
  if (timelineYLoc > 1) {
    timelineYLoc = Number(timelineYLoc.toFixed(2)) - tmlCanvas.height / 9;
    timelineScrollCount++;
  }
};

const tmlScrollDown = () => {
  if (timelineElementNum > 6 && timelineScrollCount < timelineElementNum) {
    timelineYLoc = Number(timelineYLoc.toFixed(2)) - tmlCanvas.height / 9;
    timelineScrollCount++;
  }
};

const scrollEvent = (e) => {
  let delta = 0;
  if (e.deltaY != 0) delta = Math.max(-1, Math.min(1, e.deltaY));
  else delta = Math.max(-1, Math.min(1, e.deltaX));
  if (delta == 1) {
    //UP
    if (shiftDown) tmlScrollUp();
    else tmlScrollLeft();
  } else {
    //DOWN
    if (shiftDown) tmlScrollDown();
    else tmlScrollRight();
  }
  e.preventDefault();
};

const textFocused = () => {
  isTextboxFocused = true;
};

const textBlurred = () => {
  isTextboxFocused = false;
};

const settingChanged = (e, v) => {
  if (v == "volumeMaster") {
    settings.sound.volume.master = e.value / 100;
    volumeMasterValue.textContent = e.value + "%";
    overlayTime = new Date().getTime();
    setTimeout(() => {
      overlayClose("volume");
    }, 1500);
    Howler.volume(settings.sound.volume.master * settings.sound.volume.music);
  }
};

const overlayClose = (s) => {
  if (s == "volume") {
    if (overlayTime + 1400 <= new Date().getTime()) {
      volumeOverlay.classList.remove("overlayOpen");
    }
  }
};

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
    if (shiftDown && mouseMode != 1) {
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
      volumeMaster.value = Math.round(settings.sound.volume.master * 100);
      volumeMasterValue.textContent = `${Math.round(settings.sound.volume.master * 100)}%`;
      Howler.volume(settings.sound.volume.master);
      volumeOverlay.classList.add("overlayOpen");
      overlayTime = new Date().getTime();
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

const toggleCircle = () => {
  if (circleToggle) document.getElementsByClassName("menuIcon")[10].classList.remove("menuSelected");
  else document.getElementsByClassName("menuIcon")[10].classList.add("menuSelected");
  circleToggle = !circleToggle;
};

const toggleMetronome = () => {
  if (metronomeToggle) document.getElementsByClassName("menuIcon")[9].classList.remove("menuSelected");
  else document.getElementsByClassName("menuIcon")[9].classList.add("menuSelected");
  metronomeToggle = !metronomeToggle;
};

const toggleGrid = () => {
  if (gridToggle) document.getElementsByClassName("menuIcon")[8].classList.remove("menuSelected");
  else document.getElementsByClassName("menuIcon")[8].classList.add("menuSelected");
  gridToggle = !gridToggle;
};

const toggleMagnet = () => {
  if (magnetToggle) document.getElementsByClassName("menuIcon")[7].classList.remove("menuSelected");
  else document.getElementsByClassName("menuIcon")[7].classList.add("menuSelected");
  magnetToggle = !magnetToggle;
};

document.getElementById("timelineContainer").addEventListener("wheel", scrollEvent);
window.addEventListener("wheel", globalScrollEvent);
window.addEventListener("resize", initialize);

window.addEventListener("beforeunload", (e) => {
  (e || window.event).returnValue = rusure;
  return rusure;
});

window.addEventListener("blur", () => {
  shiftDown = false;
  ctrlDown = false;
});

document.onkeyup = (e) => {
  e = e || window.event;
  if (isMac ? e.key == "Meta" : e.key == "Control") {
    ctrlDown = false;
  } else if (e.key == "Shift") {
    shiftDown = false;
  } else if (e.code == "Slash") {
    hideHelp();
  }
};

document.onkeydown = (e) => {
  e = e || window.event;
  if (e.key == "Escape") {
    if (isSettingsOpened) {
      selectedCntElement = { v1: "", v2: "", i: "" };
      changeSettingsMode(-1);
      toggleSettings();
    } else {
      if (song.playing()) {
        songPlayPause();
      } else {
        timelineScrollCount = 0;
        timelineYLoc = 0;
        song.stop();
      }
    }
  } else if (isMac ? e.key == "Meta" : e.key == "Control") {
    ctrlDown = true;
  } else if (e.key == "Shift") {
    shiftDown = true;
  } else if (ctrlDown) {
    if (e.code == "KeyS") {
      e.preventDefault();
      ctrlDown = false;
      save();
    } else if (e.code == "KeyZ") {
      if (shiftDown) {
        patternRedo();
      } else {
        patternUndo();
      }
    } else if (e.code == "KeyP") {
      e.preventDefault();
      ctrlDown = false;
      test();
    }
  }
  if (!isTextboxFocused) {
    if (e.code == "Space") {
      songPlayPause();
    } else if (e.key == "1") {
      if (document.getElementsByClassName("iziToast-overlay").length == 0) {
        changeMode(0);
      }
      return;
    } else if (e.key == "2") {
      if (document.getElementsByClassName("iziToast-overlay").length == 0) {
        changeMode(1);
      }
    } else if (e.key == "3") {
      if (document.getElementsByClassName("iziToast-overlay").length == 0) {
        changeMode(2);
      }
    } else if (e.key == "ArrowLeft") {
      tmlScrollLeft();
    } else if (e.key == "ArrowRight") {
      tmlScrollRight();
    } else if (e.key == "ArrowUp") {
      tmlScrollUp();
    } else if (e.key == "ArrowDown") {
      tmlScrollDown();
    } else if (e.code == "Delete" || e.code == "Backspace") {
      deleteElement();
    } else if (e.code == "KeyC") {
      if (ctrlDown) {
        elementCopy();
      } else {
        toggleCircle();
      }
    } else if (e.code == "KeyV") {
      if (ctrlDown) {
        elementPaste();
      }
    } else if (e.code == "Slash") {
      showHelp();
    } else if (e.code == "KeyG") {
      toggleGrid();
    } else if (e.code == "KeyT") {
      toggleMagnet();
    } else if (e.code == "KeyB") {
      toggleMetronome();
    }
  }
  if (mode == 2) {
    if (e.key == "Alt") {
      e.preventDefault();
      selectedValue++;
      if (selectedValue > 2) selectedValue = 0;
    }
  }
};

document.body.onmousedown = () => {
  mouseDown = true;
};

document.body.onmouseup = () => {
  mouseDown = false;
};

window.onload = () => {
  if (isMac) {
    const ctrl = document.getElementsByClassName("ctrl");
    for (let i = 0; i < ctrl.length; i++) {
      ctrl[i].innerText = "⌘";
    }
    const alt = document.getElementsByClassName("alt");
    for (let i = 0; i < alt.length; i++) {
      alt[i].innerText = "⌥";
    }
    const shift = document.getElementsByClassName("shift");
    for (let i = 0; i < shift.length; i++) {
      shift[i].innerText = "⇧";
    }
    const del = document.getElementsByClassName("del");
    for (let i = 0; i < del.length; i++) {
      del[i].innerText = "⌫";
    }
  }
};
