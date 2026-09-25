/* global Howler, Howl, iziToast, url, api, cdn, syncAlert, timeAlert, copiedText */
// url/cdn/api etc. are set by the page's inline <script> and by the classic
// library scripts; a module can read them via global scope with no extra wiring.
let upperBound, lowerBound;
let Factory, Updater, Renderer, getCos, getSin, calcAngleDegrees;
(async () => {
  try {
    const [utils, factory, updater, renderer] = await Promise.all([
      import("../modules/utils.js"),
      import("../modules/factory.js"),
      import("../modules/updater.js"),
      import("../modules/renderer.js"),
    ]);

    ({ upperBound, lowerBound, getCos, getSin, calcAngleDegrees } = utils);
    Factory = factory.default;
    Updater = updater.default;
    Renderer = renderer.default;

    console.log("Modules are ready.");
  } catch (err) {
    console.error("Error occured while loading modules: ", err);
  }
})();

const songSelectBox = document.getElementById("songSelectBox");
const trackSettings = document.getElementById("trackSettings");
const volumeMaster = document.getElementById("volumeMaster");
const volumeMasterValue = document.getElementById("volumeMasterValue");
const songName = document.getElementById("songName");
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
const sidebarBtn = document.getElementById("sidebarBtn");
const settingsPropertiesTextbox = trackSettings.getElementsByClassName("settingsPropertiesTextbox");
const cntCanvas = document.getElementById("componentCanvas");
const cntCtx = cntCanvas.getContext("2d");
const tmlCanvas = document.getElementById("timelineCanvas");
const tmlCtx = tmlCanvas.getContext("2d");
const timelinePlayController = document.getElementById("timelinePlayController");
const metronome = document.getElementById("metronome");
const metronomeContainer = document.getElementById("metronomeContainer");
const menuIcons = Array.from(document.getElementsByClassName("menuIcon"));
const isMac =
  navigator.userAgentData && navigator.userAgentData.platform
    ? navigator.userAgentData.platform === "macOS"
    : /Mac/.test(navigator.platform);
let Draw;
const epsilon = 1e-9;
const FONT_STACK = "Montserrat, Pretendard Variable, Pretendard";
let metronomeDir = 1;
let background;
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
  visualSync = 0,
  rate = 1,
  split = 2;
let audioLatency = 0;
let song;
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
let clipboard = null;
let destroyParticles = [];
let pixelRatio = window.devicePixelRatio;
let tmlRows = { start: [0, 1, 2], count: [1, 1, 1], total: 3 };
let timelineFilter = "all";
let skin, denyCursor;
let dragMouseX, dragMouseY, dragGroup, marquee;
let tmlPositions = [],
  cntPositions = [];
let tmlScrollbars = null,
  scrollbarDrag = null;
let copied = false,
  copiedTime = 0;
let gridToggle = true,
  magnetToggle = true,
  metronomeToggle = false,
  circleToggle = false;
let errorCount = 0;
let preventUnload = false;
let fileHandle = null;
let globalAlpha = 1;
let wasSongPlaying = false;
let isTmlUpdateNeeded = true;
let canvasContainerOW = 0,
  canvasContainerOH = 0,
  componentViewOW = 0,
  menuContainerOW = 0,
  navBarOH = 0;
let canvasW = 0,
  canvasH = 0,
  tmlCanvasW = 0,
  tmlCanvasH = 0;

let pattern = {
  information: {
    version: "1.0",
    track: "",
    producer: "",
    author: "",
    comment: "",
    bpm: "",
    speed: "",
    offset: "",
  },
  patterns: [],
  bullets: [],
  triggers: [],
};
let patternHistory = [];
let pointingTmlElement = { v1: "", v2: "", i: "" };
let pointingCntElement = { v1: "", v2: "", i: "" };
let selectedCntElement = { v1: "", v2: "", i: "" };
let destroyedBullets = new Set([]);
let prevDestroyedBullets = new Set([]);
let createdBullets = new Set([]);
let prevCreatedBullets = new Set([]);
let hitBullets = new Set([]);
let explodingBullets = new Set();

let stopRenderFlag = false;

let selection = new Set();

const elementKeys = ["patterns", "bullets", "triggers"];

let prevBeat = 1;
const beep = new Howl({
  src: `/sounds/metronome.ogg`,
  format: ["ogg"],
  volume: 1,
  autoplay: false,
  loop: false,
});

const sortAsTiming = (a, b) => {
  if (a.beat == b.beat) return 0;
  return a.beat > b.beat ? 1 : -1;
};

const settingApply = () => {
  Howler.volume(settings.sound.volume.master * settings.sound.volume.music);
  Howler.autoSuspend = false;
  volumeMaster.value = settings.sound.volume.master * 100;
  volumeMasterValue.textContent = settings.sound.volume.master * 100 + "%";
  sync = settings.sound.offset;
  visualSync = settings.display.offset ?? 0;
  denyCursor = settings.editor.denyCursor;
  canvasContainer.style.cursor = denyCursor ? "" : "none";
};

document.addEventListener("DOMContentLoaded", () => {
  // Signed-out visitors were already turned away by the server gate.
  const request = (path) =>
    fetch(`${api}/${path}`, { method: "GET", credentials: "include" }).then((res) => res.json());
  Promise.all([request("user"), request("tracks")])
    .then(([user, trackList]) => {
      if (user.result != "success") {
        // The session is gone; sign out instead of leaving a dead page.
        window.location.href = "/logout";
        return;
      }
      if (trackList.result != "success") {
        alert("Failed to load song list.");
        console.error("Failed to load song list.");
        return;
      }
      tracks = trackList.tracks;
      for (let i = 0; tracks.length > i; i++) {
        let option = document.createElement("option");
        option.textContent = tracks[i].name;
        if (tracks[i].type == 3) option.disabled = true;
        songSelectBox.options.add(option);
      }
      userName = user.user.nickname;
      settings = JSON.parse(user.user.settings);
      initialize(true);
      settingApply();
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

const patternFileTypes = [{ description: "URLATE Pattern", accept: { "application/json": [".json"] } }];

const handleStore = (mode, request) =>
  new Promise((resolve, reject) => {
    const open = indexedDB.open("editor", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("handles");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const transaction = open.result.transaction("handles", mode);
      const result = request(transaction.objectStore("handles"));
      transaction.oncomplete = () => resolve(result.result);
      transaction.onerror = () => reject(transaction.error);
    };
  });

const setFileHandle = async (handle) => {
  fileHandle = handle;
  try {
    await handleStore("readwrite", (store) => (handle ? store.put(handle, "pattern") : store.delete("pattern")));
  } catch (e) {
    console.warn(e);
  }
};

const restoreFileHandle = async () => {
  try {
    fileHandle = (await handleStore("readonly", (store) => store.get("pattern"))) ?? null;
  } catch (e) {
    console.warn(e);
  }
};

const loadEditor = async () => {
  if (!("showOpenFilePicker" in window)) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", dataLoaded);
    input.click();
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({ types: patternFileTypes });
    const text = await (await handle.getFile()).text();
    patternLoaded(text);
    await setFileHandle(handle);
  } catch (e) {
    if (e.name == "AbortError") return;
    iziToast.error({
      title: "Open failed",
      message: e.message,
    });
  }
};

const analyzePattern = (data) => {
  const patterns = data.patterns || [];
  const bullets = data.bullets || [];

  const noteBeats = patterns.map((p) => p.beat);
  const bulletBeats = bullets.map((b) => b.beat);

  const allBeats = [];
  if (noteBeats.length > 0) {
    allBeats.push(noteBeats[0], noteBeats[noteBeats.length - 1]);
  }
  if (bulletBeats.length > 0) {
    allBeats.push(bulletBeats[0], bulletBeats[bulletBeats.length - 1]);
  }

  if (allBeats.length === 0) {
    return {
      speed: data.information.speed,
      noteDensity: 0,
      bulletDensity: 0,
    };
  }

  const minBeat = Math.min(...allBeats);
  const maxBeat = Math.max(...allBeats);
  const beatRange = maxBeat - minBeat;

  const notePerBeat = patterns.length / beatRange;
  const bulletPerBeat = bullets.length / beatRange;

  function calculateDensity(perBeat, minPerBeat, maxPerBeat) {
    const score = Math.max(0.01, Math.min(1, (perBeat - minPerBeat) / (maxPerBeat - minPerBeat)));
    return Math.round(score * 100);
  }

  function calculateLogDensity(perBeat, base, multiplier) {
    const score = (Math.log(Math.max(1, perBeat)) / Math.log(base)) * multiplier;
    return Math.round(score);
  }

  return {
    speed: data.information.speed,
    noteDensity: calculateDensity(notePerBeat, 0.25, 1.5), // 1 per 4 beats = 0.25, 3 per 2 beats = 1.5
    bulletDensity: calculateLogDensity(bulletPerBeat, 20, 100),
  };
};

const patternLoaded = (text) => {
  pattern = JSON.parse(text);
  console.log(`Analyzing pattern...`);
  const result = analyzePattern(pattern);
  console.table(result);
  for (let i = 0; songSelectBox.options.length > i; i++) {
    if (songSelectBox.options[i].value == pattern.information.track) songSelectBox.selectedIndex = i;
  }
  songSelected(true);
};

const dataLoaded = (event) => {
  let file = event.target.files[0];
  let reader = new FileReader();
  reader.addEventListener("load", (e) => {
    patternLoaded(e.target.result);
    setFileHandle(null);
  });
  reader.readAsText(file);
};

const songSelected = (isLoaded = false) => {
  if (!isLoaded) {
    setFileHandle(null);
    pattern.information = {
      version: "1.0",
      track: tracks[songSelectBox.selectedIndex].name,
      producer: tracks[songSelectBox.selectedIndex].producer,
      author: userName,
      comment: `Hello. This is ${userName}.`,
      bpm: tracks[songSelectBox.selectedIndex].bpm,
      speed: 2,
      offset: 0,
    };
  }
  song = new Howl({
    src: `${cdn}/tracks/${settings.sound.res}/${tracks[songSelectBox.selectedIndex].fileName}.ogg`,
    format: ["ogg"],
    autoplay: false,
    loop: false,
    onload: () => {
      Howler.volume(settings.sound.volume.master * settings.sound.volume.music);
    },
    onend: () => {
      isTmlUpdateNeeded = true;
      controlBtn.classList.add("timeline-play");
      controlBtn.classList.remove("timeline-pause");
    },
    onstop: () => {
      isTmlUpdateNeeded = true;
    },
  });
  controlBtn.classList.add("timeline-play");
  controlBtn.classList.remove("timeline-pause");
  songName.innerText = pattern.information.track;
  settingsPropertiesTextbox[0].value = pattern.information.track;
  settingsPropertiesTextbox[1].value = pattern.information.producer;
  settingsPropertiesTextbox[2].value = pattern.information.author;
  settingsPropertiesTextbox[3].value = pattern.information.comment;
  settingsPropertiesTextbox[4].value = pattern.information.bpm;
  settingsPropertiesTextbox[5].value = pattern.information.speed;
  settingsPropertiesTextbox[6].value = pattern.information.offset;
  bpm = pattern.information.bpm;
  bpmsync = {
    ms: 0,
    beat: 0,
  };
  offset = pattern.information.offset;
  speed = pattern.information.speed;
  document.getElementById("percentage").innerText = "100%";
  rate = 1;
  background = new URLSearchParams(window.location.search).get("background");
  if (background !== "0")
    canvasBackground.style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/${tracks[songSelectBox.selectedIndex].fileName}.webp")`;
  else canvasBackground.style.backgroundImage = `url("${cdn}/albums/${settings.display.albumRes}/urlate.webp")`;
  document.getElementById("songSelectionContainer").style.display = "none";
  document.getElementById("initialScreenContainer").style.display = "none";
  document.getElementById("editorMainContainer").style.display = "initial";
  initialize();
  patternChanged();
  stopRenderFlag = false;
  window.requestAnimationFrame(cntRender);
};

const toggleSettings = () => {
  if (isSettingsOpened) {
    document.getElementById("settingsContainer").style.display = "none";
    document.getElementById("timelineContainer").style.width = "100vw";
    document.getElementById("timelineZoomController").style.right = "1.5vw";
    document.getElementById("timelineSplitController").style.left = "11vw";
    componentView.style.marginRight = "5vw";
    tmlCanvas.style.width = "100vw";
    tmlCanvasW = window.innerWidth;
    sidebarBtn.classList.remove("sidebar-collapse");
    sidebarBtn.classList.add("sidebar-expand");
  } else {
    document.getElementById("settingsContainer").style.display = "flex";
    document.getElementById("timelineContainer").style.width = "80vw";
    document.getElementById("timelineZoomController").style.right = "21vw";
    document.getElementById("timelineSplitController").style.left = "9vw";
    componentView.style.marginRight = "0vw";
    tmlCanvas.style.width = "80vw";
    tmlCanvasW = window.innerWidth * 0.8;
    sidebarBtn.classList.remove("sidebar-expand");
    sidebarBtn.classList.add("sidebar-collapse");
  }
  isSettingsOpened = !isSettingsOpened;
  initialize();
};

const changeMode = (n) => {
  menuIcons[n].classList.toggle("menuSelected");
  menuIcons[mode].classList.toggle("menuSelected");
  menuIcons[n].classList.toggle("clickable");
  menuIcons[mode].classList.toggle("clickable");
  mode = n;
};

const changeNote = () => {
  const n = Number(pattern.patterns[selectedCntElement.i].value);
  const value = n == 2 ? 0 : n + 1;
  for (const element of batchTargets()) {
    element.value = value;
    element.direction = 1;
    element.time = parseInt((60 / bpm) * 4 * 1000);
  }
  patternChanged();
  selectedCntElement.v2 = value;
  changeSettingsMode(selectedCntElement.v1, selectedCntElement.v2, selectedCntElement.i);
};

const eraseCnt = () => {
  cntCtx.clearRect(0, 0, canvasW, canvasH);
};

const eraseTml = () => {
  tmlCtx.clearRect(0, 0, tmlCanvasW, tmlCanvasH);
};

const initialize = (isFirstCalled) => {
  if (isSettingsOpened) {
    tmlCanvasW = window.innerWidth * 0.8 * window.devicePixelRatio;
  } else {
    tmlCanvasW = window.innerWidth * window.devicePixelRatio;
  }
  canvasW = (window.innerWidth * 0.6 * window.devicePixelRatio * settings.display.canvasRes) / 100;
  canvasH = (window.innerHeight * 0.65 * window.devicePixelRatio * settings.display.canvasRes) / 100;
  tmlCanvasH = window.innerHeight * 0.27 * window.devicePixelRatio;

  if (Draw) Draw.setSize({ canvasW, canvasH });

  cntCanvas.width = canvasW;
  cntCanvas.height = canvasH;
  tmlCanvas.width = tmlCanvasW;
  tmlCanvas.height = tmlCanvasH;

  if (tmlCanvas.height / tmlCanvas.width > 0.18) {
    timelinePlayController.style.display = "none";
  } else {
    timelinePlayController.style.display = "flex";
  }

  canvasContainerOW = canvasContainer.offsetWidth;
  canvasContainerOH = canvasContainer.offsetHeight;
  componentViewOW = componentView.offsetWidth;
  menuContainerOW = menuContainer.offsetWidth;
  navBarOH = document.getElementById("navbar").offsetHeight;

  isTmlUpdateNeeded = true;

  if (isFirstCalled) {
    fetch(`${cdn}/skins/${settings.game.skin}.json`)
      .then((res) => res.json())
      .then((data) => {
        skin = data;
        Draw = new Renderer(cntCtx, { canvasW, canvasH }, skin);
      })
      .catch((error) => {
        alert(`Error occured.\n${error}`);
        console.error(`Error occured.\n${error}`);
      });
    let storedFilter;
    try {
      storedFilter = localStorage.timelineFilter;
    } catch (e) {
      console.warn(e);
    }
    setTimelineFilter(storedFilter);
    if (localStorage.pattern) {
      restoreFileHandle();
      pattern = JSON.parse(localStorage.pattern);
      for (let i = 0; songSelectBox.options.length > i; i++) {
        if (songSelectBox.options[i].value == pattern.information.track) songSelectBox.selectedIndex = i;
      }
      songSelected(true);
    }
  }
};

const gotoMain = (isCalledByMain) => {
  if (isCalledByMain || !preventUnload || confirm("Are you sure you want to leave? There are unsaved changes.")) {
    stopRenderFlag = true;
    if (song) song.stop();
    song = null;
    localStorage.temp = JSON.stringify(pattern);
    localStorage.removeItem("pattern");
    setFileHandle(null);
    changeSettingsMode(-1);
    if (isSettingsOpened) toggleSettings();
    selectedCntElement = { v1: "", v2: "", i: "" };
    selection.clear();
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
        comment: "",
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

const isNotePointable = (note, beats) => {
  const p = (1 - (note.beat - beats) / (5 / speed)) * 100;
  const t = ((beats - note.beat) / note.duration) * 100;
  return (note.value == 2 ? t <= 100 : p <= 100) && p >= 0;
};

const trackMouseSelection = (i, v1, v2, x, y, beats) => {
  if (mode != 2 && mouseMode == 0) {
    if (pointingCntElement.i == "") {
      const powX = ((((mouseX - x) * canvasContainerOW) / 200) * pixelRatio * settings.display.canvasRes) / 100;
      const powY = ((((mouseY - y) * canvasContainerOH) / 200) * pixelRatio * settings.display.canvasRes) / 100;
      const distSq = powX * powX + powY * powY;
      switch (v1) {
        case 0: {
          const r = canvasW / 40;
          if (distSq <= r * r && isNotePointable(pattern.patterns[i], beats)) {
            pointingCntElement = { v1, v2, i };
          }
          break;
        }
        case 1: {
          const r = canvasW / (song.playing() ? 80 : 50);
          if (distSq <= r * r) {
            pointingCntElement = { v1, v2, i };
            if (song.playing()) {
              hitBullets.add(i);
            }
          }
          break;
        }
        default:
          displayMessage("Warning", `[URLATE] trackingWarning: Cursor pointing unknown element.`);
      }
    }
  } else if (mode != 2 && mouseMode == 1) {
    if (pointingTmlElement.i == "") {
      const dx = mouseX - x;
      const dy = mouseY - y;
      const r = tmlCanvasH / 27;
      if (dx * dx + dy * dy <= r * r) {
        pointingTmlElement = { v1, v2, i };
      }
    }
  }
};

const selectedCheck = (n, i) => {
  return (
    (pointingCntElement.v1 === n && pointingCntElement.i == i) ||
    (selectedCntElement.v1 === n && selectedCntElement.i == i) ||
    selection.has(pattern[elementKeys[n]][i]) ||
    !!marquee?.hits.has(pattern[elementKeys[n]][i])
  );
};

// --- Min-heap helpers ---
const _heapPush = (heap, item, cmp) => {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (cmp(heap[i], heap[p]) < 0) {
      [heap[i], heap[p]] = [heap[p], heap[i]];
      i = p;
    } else break;
  }
};
const _heapPop = (heap, cmp) => {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1,
        r = l + 1;
      let s = i;
      if (l < heap.length && cmp(heap[l], heap[s]) < 0) s = l;
      if (r < heap.length && cmp(heap[r], heap[s]) < 0) s = r;
      if (s === i) break;
      [heap[i], heap[s]] = [heap[s], heap[i]];
      i = s;
    }
  }
  return top;
};

// Assigns each element (sorted by beat) to the lowest-indexed vertical lane
// that doesn't visually overlap with the previous element in that lane.
// Returns laneOf[i - start] = 0-based lane index, and laneCount = total lanes used.
// O(n log laneCount) via two min-heaps: one tracking active lanes by lastBeat
// (to detect newly freed lanes), one tracking free lane indices (to pick the lowest).
const assignLanes = (elements, start, end, overlapThreshold) => {
  const active = []; // min-heap of {lastBeat, lane}, ordered by lastBeat
  const free = []; // min-heap of free lane indices, ordered ascending
  const laneOf = [];
  let nextLane = 0;
  const cmpBeat = (a, b) => a.lastBeat - b.lastBeat;
  const cmpIdx = (a, b) => a - b;

  for (let i = start; i < end; i++) {
    const beat = elements[i].beat;
    // Release all lanes whose last occupant is no longer overlapping.
    while (active.length > 0 && beat - active[0].lastBeat >= overlapThreshold) {
      _heapPush(free, _heapPop(active, cmpBeat).lane, cmpIdx);
    }
    // Pick the lowest available lane, or open a new one.
    const lane = free.length > 0 ? _heapPop(free, cmpIdx) : nextLane++;
    _heapPush(active, { lastBeat: beat, lane }, cmpBeat);
    laneOf.push(lane);
  }
  return { laneOf, laneCount: nextLane || 1 };
};

const isKindShown = (v1) => timelineFilter == "all" || timelineFilter == v1;

const timelineRowAt = (y) => {
  const row = Math.floor((y - tmlCanvasH / 6) / (tmlCanvasH / 9));
  const v1 = tmlRows.start.findIndex((start, kind) => row >= start && row < start + tmlRows.count[kind]);
  return v1 === -1 ? null : { v1, row };
};

const drawTimelineShape = (v1, x, y, w) => {
  tmlCtx.beginPath();
  if (v1 == 0) {
    tmlCtx.arc(x, y, w, 0, 2 * Math.PI);
  } else if (v1 == 1) {
    tmlCtx.moveTo(x - w, y);
    tmlCtx.lineTo(x, y + w);
    tmlCtx.lineTo(x + w, y);
    tmlCtx.lineTo(x, y - w);
    tmlCtx.closePath();
  } else {
    tmlCtx.moveTo(x - w / 1.1, y - w);
    tmlCtx.lineTo(x + w / 1.1, y);
    tmlCtx.lineTo(x - w / 1.1, y + w);
    tmlCtx.closePath();
  }
  tmlCtx.fill();
};

const setTimelineFilter = (filter) => {
  timelineFilter = ["0", "1", "2"].includes(String(filter)) ? Number(filter) : "all";
  for (const chip of document.getElementsByClassName("timelineFilter")) {
    chip.classList.toggle("selected", chip.dataset.arg == String(timelineFilter));
  }
  try {
    localStorage.timelineFilter = timelineFilter;
  } catch (e) {
    console.warn(e);
  }
  const hidden = selectedElements().filter(({ v1 }) => !isKindShown(v1));
  if (hidden.length) {
    for (const { element } of hidden) selection.delete(element);
    if (!isKindShown(selectedCntElement.v1)) selectedCntElement = { v1: "", v2: "", i: "" };
    ensurePrimary();
  }
  setScrollRow(0);
};

const tmlRender = () => {
  try {
    //Initialize
    eraseTml();
    const seekMs = song.seek() * 1000;
    const beats = bpmsync.beat + (seekMs - bpmsync.ms) / (60000 / bpm);
    const tmlStartX = tmlCanvasW / 10, //timeline(element view) start X
      startX = tmlCanvasW / 80,
      startY = tmlCanvasH / 6,
      endX = tmlCanvasW / 1.01,
      endY = tmlCanvasH / 1.1,
      height = tmlCanvasH / 9;
    tmlPositions = [];
    const recordPosition = (element, x, y) => {
      if (x >= tmlStartX && x <= endX && y >= startY && y <= endY) tmlPositions.push({ element, x, y });
    };
    const renderStart = Number((beats - zoom).toPrecision(10)),
      renderEnd = Number((beats + 16 * zoom).toPrecision(10)),
      beatToPx = (endX - tmlStartX) / (renderEnd - renderStart);

    //Timeline background
    tmlCtx.beginPath();
    tmlCtx.fillStyle = "#F3F3F3";
    tmlCtx.fillRect(tmlStartX, startY, endX - tmlStartX, endY - startY);
    tmlRows = { start: [0, 0, 0], count: [0, 0, 0], total: 0 };
    const addRows = (v1, count) => {
      tmlRows.start[v1] = tmlRows.total;
      tmlRows.count[v1] = isKindShown(v1) ? count : 0;
      tmlRows.total += tmlRows.count[v1];
    };
    const rowY = (v1, lane) => startY + timelineYLoc + height * (tmlRows.start[v1] + lane) + height / 2;
    // Two elements (w = height/3) overlap when pixel distance < 2*w.
    // Converted to beats: overlapThreshold = (2 * height/3) / beatToPx.
    const overlapThreshold = beatToPx > 0 ? (2 * height) / (3 * beatToPx) : Infinity;
    const elementColors = ["#fbaf34", "#4297d4", "#2ec90e"];

    for (let v1 = 0; v1 < 3; v1++) {
      const elements = pattern[elementKeys[v1]];
      const start = lowerBound(elements, renderStart);
      const end = upperBound(elements, renderEnd);
      const { laneOf, laneCount } =
        v1 == 0 ? { laneOf: [], laneCount: 1 } : assignLanes(elements, start, end, overlapThreshold);
      addRows(v1, laneCount);
      if (!isKindShown(v1)) continue;
      for (let j = start; j < end; j++) {
        const x = tmlStartX + (elements[j].beat - renderStart) * beatToPx;
        const y = rowY(v1, laneOf[j - start] ?? 0);
        if (mouseMode == 1) trackMouseSelection(j, v1, v1 == 1 ? 0 : elements[j].value, x, y, beats);
        recordPosition(elements[j], x, y);
        tmlCtx.fillStyle = selectedCheck(v1, j) ? "#ed5b45" : elementColors[v1];
        drawTimelineShape(v1, x, y, height / 3);
      }
    }

    //Cover the overflowed
    tmlCtx.fillStyle = "#FFF";
    tmlCtx.fillRect(0, 0, tmlStartX, endY);

    //Timeline elements text(Notes, Bullets, Triggers)
    tmlCtx.textAlign = "left";
    tmlCtx.textBaseline = "middle";
    tmlCtx.font = `${tmlCanvasH / 14}px ${FONT_STACK}`;
    const labelColors = ["#fbaf34", "#2f91ed", "#2ec90e"];
    for (let v1 = 0; v1 < 3; v1++) {
      for (let lane = 0; lane < tmlRows.count[v1]; lane++) {
        const y = rowY(v1, lane);
        tmlCtx.beginPath();
        tmlCtx.fillStyle = labelColors[v1];
        tmlCtx.arc(startX, y, height / 6, 0, 2 * Math.PI);
        tmlCtx.fill();
        tmlCtx.fillStyle = "#111";
        tmlCtx.fillText(["Note", "Bullet", "Trigger"][v1], startX * 1.2 + height / 6, y + height / 18);
      }
    }

    //Timeline time line + text
    timelineElementNum = tmlRows.total;
    tmlCtx.fillStyle = "#FFF";
    tmlCtx.fillRect(0, 0, tmlCanvasW, startY);
    tmlCtx.font = `${tmlCanvasH / 16}px ${FONT_STACK}`;
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
    tmlCtx.fillRect(0, endY, tmlCanvasW, tmlCanvasH - endY);
    tmlCtx.fillRect(endX, startY, tmlCanvasW, tmlCanvasH);

    //Timeline time text
    tmlCtx.fillStyle = "#2f91ed";
    tmlCtx.font = `${tmlCanvasH / 11}px Heebo`;
    tmlCtx.textBaseline = "middle";
    let timeStartX = tmlStartX;
    if (tmlCanvasH / tmlCanvasW <= 0.18) {
      tmlCtx.textAlign = "right";
      if (tmlCanvasH / tmlCanvasW >= 0.17) {
        tmlCtx.font = `${tmlCanvasH / 15}px Heebo`;
      } else if (tmlCanvasH / tmlCanvasW >= 0.155) {
        tmlCtx.font = `${tmlCanvasH / 13}px Heebo`;
      }
    } else {
      tmlCtx.textAlign = "left";
      timeStartX = startX;
    }
    if (isNaN(beats)) {
      tmlCtx.fillText("Wait..", timeStartX, startY / 1.7);
    } else {
      const seek = seekMs / 1000,
        minutes = Math.floor(seek / 60),
        seconds = seek - minutes * 60;
      tmlCtx.fillText(
        `${String(minutes).padStart(1, "0")}:${seconds.toFixed(2).padStart(5, "0")}`,
        timeStartX,
        startY / 1.7,
      );
    }

    //Timeline playhead
    tmlCtx.beginPath();
    tmlCtx.fillStyle = "#ed5b45";
    tmlCtx.strokeStyle = "#ed5b45";
    let lineX = tmlStartX + beatToPx * zoom;
    tmlCtx.moveTo(lineX, endY);
    tmlCtx.lineTo(lineX, startY);
    tmlCtx.stroke();

    //Timeline offset playhead
    if (song.playing()) {
      tmlCtx.beginPath();
      tmlCtx.fillStyle = "#2f91ed";
      tmlCtx.strokeStyle = "#2f91ed";
      const offsetLineX =
        tmlStartX +
        (beats - renderStart - (offset + sync - visualSync + audioLatency * 1000) / (60000 / bpm)) * beatToPx;
      tmlCtx.moveTo(offsetLineX, endY);
      tmlCtx.lineTo(offsetLineX, startY);
      tmlCtx.stroke();
    }

    //Add mode yellow preview
    if (mode == 2 && mouseMode == 1) {
      if (mouseX > tmlStartX && mouseX < endX && mouseY > startY && mouseY < endY) {
        const target = timelineRowAt(mouseY - timelineYLoc);
        let previewBeat = beats + (mouseX - tmlStartX) / beatToPx - zoom;
        if (previewBeat <= 0) previewBeat = 0;
        previewBeat = Number(previewBeat.toPrecision(10));
        previewBeat = magnetToggle ? Math.round(previewBeat * split) / split : previewBeat;
        if (target) {
          tmlCtx.fillStyle = "#ebd534";
          drawTimelineShape(
            target.v1,
            tmlStartX + (previewBeat - renderStart) * beatToPx,
            startY + timelineYLoc + height * target.row + height / 2,
            height / 3,
          );
        }
      }
    }

    //Scrollbars
    const barSize = tmlCanvasH / 45;
    const totalBeats = song.duration() ? beatAtMs(song.duration() * 1000) : 0;
    const horizontal = { x: tmlStartX, y: endY - barSize * 1.5, w: endX - tmlStartX, h: barSize, max: totalBeats };
    horizontal.size = Math.max(horizontal.w * Math.min((17 * zoom) / (totalBeats + 17 * zoom), 1), barSize * 2);
    horizontal.thumb =
      horizontal.x + (horizontal.w - horizontal.size) * Math.min(Math.max(beats / totalBeats || 0, 0), 1);
    const rows = scrollRows();
    if (-timelineYLoc / height > rows) setScrollRow(rows);
    const vertical = {
      x: endX + (tmlCanvasW - endX - barSize) / 2,
      y: startY,
      w: barSize,
      h: endY - startY,
      max: rows,
    };
    vertical.size = Math.max(vertical.h * (6 / (6 + rows)), barSize * 2);
    vertical.thumb = vertical.y + (vertical.h - vertical.size) * (rows ? -timelineYLoc / height / rows : 0);
    tmlScrollbars = { h: totalBeats > 0 ? horizontal : null, v: rows > 0 ? vertical : null };
    for (const [axis, bar] of Object.entries(tmlScrollbars)) {
      if (!bar) continue;
      const isHorizontal = axis == "h";
      const isHovered = scrollbarDrag?.axis == axis || isOverScrollbar(axis, bar);
      tmlCtx.fillStyle = "rgba(0, 0, 0, 0.05)";
      tmlCtx.beginPath();
      tmlCtx.roundRect(bar.x, bar.y, bar.w, bar.h, barSize / 2);
      tmlCtx.fill();
      tmlCtx.fillStyle = isHovered ? "#999" : "#ccc";
      tmlCtx.beginPath();
      if (isHorizontal) tmlCtx.roundRect(bar.thumb, bar.y, bar.size, bar.h, barSize / 2);
      else tmlCtx.roundRect(bar.x, bar.thumb, bar.w, bar.size, barSize / 2);
      tmlCtx.fill();
    }

    //Marquee
    if (marquee?.area == 1) {
      const x = Math.min(marquee.x0, marquee.x1),
        y = Math.min(marquee.y0, marquee.y1);
      const w = Math.abs(marquee.x1 - marquee.x0),
        h = Math.abs(marquee.y1 - marquee.y0);
      tmlCtx.fillStyle = "rgba(237, 91, 69, 0.1)";
      tmlCtx.strokeStyle = "#ed5b45";
      tmlCtx.fillRect(x, y, w, h);
      tmlCtx.strokeRect(x, y, w, h);
    }

    //Sync alert text
    tmlCtx.font = `400 ${tmlCanvasH / 15}px ${FONT_STACK}`;
    tmlCtx.fillStyle = "#555";
    tmlCtx.textAlign = "right";
    tmlCtx.textBaseline = "top";
    if (song.playing() && tmlCanvasW / tmlCanvasH >= 4.9) {
      tmlCtx.fillText(syncAlert, endX, endY + 5);
    } else if (selectedCount()) {
      tmlCtx.fillText(`${selectedCount()} selected`, endX, endY + 5);
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
      if (mouseX >= tmlCanvasW / 20 && mouseX <= tmlCanvasW / 10 && mouseY < tmlCanvasH / 6) {
        timelineContainer.style.cursor = "url('/images/cursors/select.cur'), pointer";
      } else {
        timelineContainer.style.cursor = "";
      }
    } else {
      timelineContainer.style.cursor = "url('/images/cursors/select.cur'), pointer";
    }
  } catch (e) {
    displayMessage("Error", `[Runtime] ${e}`);
    console.error(e);
  }
};

const displayMessage = (type, message) => {
  switch (type) {
    case "Error":
      cntCtx.fillStyle = "#F55";
      break;
    case "Warning":
      cntCtx.fillStyle = "#f5b427";
      break;
    default:
      cntCtx.fillStyle = "#FFF";
  }
  cntCtx.font = `600 ${canvasH / 50}px ${FONT_STACK}`;
  cntCtx.textAlign = "left";
  cntCtx.textBaseline = "top";
  cntCtx.fillText(message, canvasW / 100, canvasH / 100 + (canvasH / 40) * errorCount);
  errorCount++;
};

const cntRender = () => {
  if (!stopRenderFlag) window.requestAnimationFrame(cntRender);
  else return;
  try {
    eraseCnt();

    if (!Draw) {
      cntCtx.fillStyle = "#FFF";
      cntCtx.font = `400 ${canvasH / 30}px ${FONT_STACK}`;
      cntCtx.textAlign = "center";
      cntCtx.textBaseline = "middle";
      cntCtx.fillText("Loading modules..", canvasW / 2, canvasH / 2);
      return;
    }

    // Always maintain the aspect ratio
    if (window.devicePixelRatio != pixelRatio) {
      pixelRatio = window.devicePixelRatio;
      initialize();
    }

    // Initialize
    pointingCntElement = mouseMode == 1 ? pointingTmlElement : { v1: "", v2: "", i: "" };
    [prevCreatedBullets, createdBullets] = [createdBullets, prevCreatedBullets];
    createdBullets.clear();
    [prevDestroyedBullets, destroyedBullets] = [destroyedBullets, prevDestroyedBullets];
    destroyedBullets.clear();
    explodingBullets.clear();

    const tw = canvasW / 200;
    const th = canvasH / 200;

    errorCount = 0;

    // Calculate seeking position
    const isSongPlaying = song.playing();
    const seekMs = (song.seek() - (isSongPlaying ? audioLatency : 0)) * 1000;
    const beats = Number(
      (
        bpmsync.beat +
        (seekMs - (isSongPlaying ? offset + sync - visualSync : 0) - bpmsync.ms) / (60000 / bpm)
      ).toPrecision(10),
    );

    // Metronome
    const rawSeekMs = song.seek() * 1000;
    const noSyncBeats = Number((bpmsync.beat + (rawSeekMs - offset - bpmsync.ms) / (60000 / bpm)).toPrecision(10));
    if (metronomeToggle) {
      const intBeat = Math.floor(noSyncBeats);
      if (isSongPlaying) {
        if (prevBeat != intBeat) {
          prevBeat = intBeat;
          beep.play();
          metronomeDir *= -1;
          metronomeContainer.style.transform = `scaleX(${metronomeDir})`;
          metronome.animate([{ transform: "scale(1.2)" }, { transform: "scale(1)" }], {
            duration: 200,
            fill: "forwards",
          });
        }
      } else {
        prevBeat = intBeat;
      }
    }

    // Initialize triggers
    bpm = pattern.information.bpm;
    globalAlpha = 1;
    bpmsync = {
      ms: 0,
      beat: 0,
    };

    // Draw Grids
    if (gridToggle) Draw.meshGrid();
    if (circleToggle && selectedCntElement.v1 === 0) Draw.radialGrid(pattern.patterns[selectedCntElement.i]);
    Draw.axis();

    // Track triggers from start to now
    let end = upperBound(pattern.triggers, beats);
    let nowSpeed = pattern.information.speed;
    const renderTexts = [];
    for (let i = 0; i < end; i++) {
      if (pattern.triggers[i].value == 0) {
        // Bullet Destroy
        if (!destroyedBullets.has(pattern.triggers[i].num)) {
          if (!prevDestroyedBullets.has(pattern.triggers[i].num)) {
            explodingBullets.add(pattern.triggers[i].num);
          }
          destroyedBullets.add(pattern.triggers[i].num);
        }
      } else if (pattern.triggers[i].value == 1) {
        // Bullet Destroy ALL
        let bulletEnd = upperBound(pattern.bullets, pattern.triggers[i].beat);
        for (let j = 0; j < bulletEnd; j++) {
          if (!destroyedBullets.has(j)) {
            if (!prevDestroyedBullets.has(j)) {
              explodingBullets.add(j);
            }
            destroyedBullets.add(j);
          }
        }
      } else if (pattern.triggers[i].value == 2) {
        // BPM Change
        bpmsync.ms = bpmsync.ms + (pattern.triggers[i].beat - bpmsync.beat) * (60000 / bpm);
        bpm = pattern.triggers[i].bpm;
        bpmsync.beat = pattern.triggers[i].beat;
      } else if (pattern.triggers[i].value == 3) {
        globalAlpha = pattern.triggers[i].opacity;
      } else if (pattern.triggers[i].value == 4) {
        // Speed Change
        nowSpeed = pattern.triggers[i].speed;
      } else if (pattern.triggers[i].value == 5) {
        // Text
        if (pattern.triggers[i].beat <= beats && beats <= pattern.triggers[i].beat + pattern.triggers[i].duration) {
          renderTexts.push(pattern.triggers[i]);
        }
      } else if (pattern.triggers[i].value == 6) {
        // End
        song.stop();
      }
    }

    cntCtx.globalAlpha = globalAlpha;

    for (let textObj of renderTexts) Draw.triggerText(textObj);

    // Note render
    let renderDuration = 5 / speed;

    let start = 0;
    end = upperBound(pattern.patterns, beats + renderDuration);

    // Mouse tracking loop
    cntPositions = [];
    let prevNoteBeat = -1;
    for (let i = start; i < end; i++) {
      if (pattern.patterns[i].beat >= prevNoteBeat - 0.01 && pattern.patterns[i].beat <= prevNoteBeat + 0.01) {
        displayMessage(
          "Error",
          `[URLATE] validationError: Note_${i} of the beat ${pattern.patterns[i].beat} is too close to Note_${i - 1}.`,
        );
      }
      prevNoteBeat = pattern.patterns[i].beat;
      if (mouseMode == 0)
        trackMouseSelection(i, 0, pattern.patterns[i].value, pattern.patterns[i].x, pattern.patterns[i].y, beats);
      if (isNotePointable(pattern.patterns[i], beats)) {
        cntPositions.push({ element: pattern.patterns[i], x: pattern.patterns[i].x, y: pattern.patterns[i].y });
      }
    }

    // Note drawing loop
    let validNote = end;
    const _noteState = {
      progress: 0,
      tailProgress: 0,
      endProgress: 0,
      globalAlpha,
      isGrabbed: false,
      isSelected: false,
    };
    for (let i = end - 1; i >= start; i--) {
      Updater.noteProgress(pattern.patterns[i], beats, speed, _noteState);

      if (pattern.patterns[i].value != 2 && _noteState.progress < 101) validNote = i;
      else if (pattern.patterns[i].value == 2 && _noteState.endProgress < 100) validNote = i;

      const alpha = 0.4 - 0.1 * (validNote - i);

      if (i > 0) Draw.noteConnector(pattern.patterns[i - 1], pattern.patterns[i], alpha);

      if (i == validNote) {
        _noteState.globalAlpha = globalAlpha;
        _noteState.isGrabbed = _noteState.progress >= 100;
        _noteState.isSelected = selectedCheck(0, i);
        Draw.note(
          {
            ...pattern.patterns[i],
            debugIndex: i,
          },
          _noteState,
        );
      } else if (i + 3 >= validNote) {
        Draw.noteShadow(pattern.patterns[i], alpha);
      }
    }

    //Bullet render
    start = lowerBound(pattern.bullets, beats - 32);
    end = upperBound(pattern.bullets, beats);
    for (let i = start; i < end; i++) {
      if (!destroyedBullets.has(i) || explodingBullets.has(i)) {
        const bullet = pattern.bullets[i];

        const pos = Updater.bulletPos(bullet, beats, pattern.triggers, pattern.information.speed);

        if (!createdBullets.has(i) || explodingBullets.has(i)) {
          if (!prevCreatedBullets.has(i) || explodingBullets.has(i))
            destroyParticles.push(...Factory.createExplosions(pos.x, pos.y));
          if (explodingBullets.has(i)) continue;
        }
        createdBullets.add(i);

        trackMouseSelection(i, 1, 0, pos.x, pos.y, beats);
        cntPositions.push({ element: bullet, x: pos.x, y: pos.y });

        Draw.bullet(
          {
            ...pos,
            location: pattern.bullets[i].location,
            direction: pattern.bullets[i].direction,
            debugIndex: i,
          },
          {
            isSelected: selectedCheck(1, i),
            isHit: hitBullets.has(i),
          },
        );
      }
    }
    cntCtx.globalAlpha = 1;

    cntCtx.beginPath();
    cntCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
    cntCtx.font = `700 ${canvasH / 50}px ${FONT_STACK}`;
    cntCtx.textAlign = "center";
    cntCtx.textBaseline = "top";
    cntCtx.fillText(`Speed : ${nowSpeed}, BPM : ${bpm}`, canvasW / 2, canvasH / 50);

    // Editor only - Note & Bullet location live draw (when mode is "Add")
    if (mode == 2 && mouseMode == 0) {
      let p = [0, 0];
      if (mouseX < -80) {
        p[0] = (-80 - mouseX) / 20;
      } else if (mouseX > 80) {
        p[1] = (mouseX - 80) / 20;
      }
      if (p[0] == 0 && p[1] == 0) {
        let drawX, drawY;
        if (circleToggle && selectedCntElement.v1 === 0) {
          const radius = canvasW / 15;
          const noteX = tw * (pattern.patterns[selectedCntElement.i].x + 100);
          const noteY = th * (pattern.patterns[selectedCntElement.i].y + 100);
          const difX = noteX - tw * (mouseX + 100);
          const difY = noteY - th * (mouseY + 100);
          const distance = Math.sqrt(difX * difX + difY * difY) + radius / 2;
          const angle = calcAngleDegrees(difX, difY) + 180;
          const newDistance = distance - (distance % radius);
          drawX = Math.round(((noteX + newDistance * getCos(angle)) / canvasW) * 200 - 100);
          drawY = Math.round(((noteY + newDistance * getSin(angle)) / canvasH) * 200 - 100);
        } else if (magnetToggle) {
          drawX = mouseX - (mouseX % 5);
          drawY = mouseY - (mouseY % 5);
        } else {
          drawX = mouseX;
          drawY = mouseY;
        }
        Draw.note(
          {
            x: drawX,
            y: drawY,
            value: selectedValue,
            direction: 1,
          },
          {
            globalAlpha,
            progress: 100,
            tailProgress: 0,
            endProgress: 0,
            isGrabbed: true,
            isSelected: true,
          },
        );
      } else {
        let drawX = 100;
        let drawY = magnetToggle ? mouseY - (mouseY % 5) : mouseY;
        let drawAngle = 180;
        let drawDir = "R";
        if (p[1] == 0) {
          drawX = -100;
          drawAngle = 0;
          drawDir = "L";
        }
        Draw.bullet(
          {
            x: drawX,
            y: drawY,
            angle: drawAngle,
            location: drawY,
            direction: drawDir,
          },
          {
            isSelected: true,
          },
        );
      }
    }

    if (marquee?.area == 0) {
      const x = tw * (Math.min(marquee.x0, marquee.x1) + 100),
        y = th * (Math.min(marquee.y0, marquee.y1) + 100);
      const w = tw * Math.abs(marquee.x1 - marquee.x0),
        h = th * Math.abs(marquee.y1 - marquee.y0);
      cntCtx.save();
      cntCtx.fillStyle = "rgba(237, 91, 69, 0.15)";
      cntCtx.strokeStyle = "#ed5b45";
      cntCtx.lineWidth = 1;
      cntCtx.fillRect(x, y, w, h);
      cntCtx.strokeRect(x, y, w, h);
      cntCtx.restore();
    }

    Updater.particles(destroyParticles);

    Draw.explosions(destroyParticles);

    // Editor only - Trigger add guide overlay (when mode is "Add")
    if (mode == 2 && mouseMode == -1) Draw.triggerAddOverlay();

    //Cursor
    if (denyCursor) {
      if (pointingCntElement.i === "") {
        componentView.style.cursor = "";
      } else {
        componentView.style.cursor = "url('/images/cursors/select.cur'), pointer";
      }
    }

    if (wasSongPlaying || isTmlUpdateNeeded) {
      pointingTmlElement = { v1: "", v2: "", i: "" };
      tmlRender();
      isTmlUpdateNeeded = false;
    }
    wasSongPlaying = isSongPlaying;

    if (mouseMode == 0 && !denyCursor) {
      Draw.cursor({ x: mouseX, y: mouseY }, {});
    }
  } catch (e) {
    displayMessage("Error", `[Runtime] ${e}`);
    console.error(e);
  }
};

const songPlayPause = () => {
  if (document.getElementById("editorMainContainer").style.display == "initial") {
    if (song.playing()) {
      controlBtn.classList.add("timeline-play");
      controlBtn.classList.remove("timeline-pause");
      song.pause();
    } else {
      hitBullets.clear();
      controlBtn.classList.add("timeline-pause");
      controlBtn.classList.remove("timeline-play");
      song.play();

      const ctx = Howler.ctx;
      audioLatency = (ctx?.outputLatency ?? 0) + (ctx?.baseLatency ?? 0);
    }
  }
};

const markSaved = (data) => {
  if (JSON.stringify(pattern) !== data) return;
  preventUnload = false;
  songName.innerText = pattern.information.track;
};

const writePatternFile = async (data, isSaveAs) => {
  if (isSaveAs || !fileHandle) {
    await setFileHandle(
      await window.showSaveFilePicker({ suggestedName: `${pattern.information.track}.json`, types: patternFileTypes }),
    );
  }
  const permission = { mode: "readwrite" };
  if (
    (await fileHandle.queryPermission(permission)) !== "granted" &&
    (await fileHandle.requestPermission(permission)) !== "granted"
  ) {
    throw new Error("Permission to edit the file was denied.");
  }
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
};

const save = async (isSaveAs = false) => {
  let trackSettingsForm = settingsPropertiesTextbox;
  pattern.information = {
    version: "1.0",
    track: trackSettingsForm[0].value,
    producer: trackSettingsForm[1].value,
    author: trackSettingsForm[2].value,
    comment: trackSettingsForm[3].value,
    bpm: pattern.information.bpm,
    speed: pattern.information.speed,
    offset: offset,
  };
  const data = JSON.stringify(pattern);
  localStorage.pattern = data;
  if (!("showSaveFilePicker" in window)) {
    let a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = `${pattern.information.track}.json`;
    a.click();
    markSaved(data);
    return;
  }
  try {
    await writePatternFile(data, isSaveAs);
    markSaved(data);
    iziToast.success({
      title: "Save",
      message: `Saved to ${fileHandle.name}`,
    });
  } catch (e) {
    if (e.name == "AbortError") return;
    iziToast.error({
      title: "Save failed",
      message: e.message,
    });
  }
};

const settingsInput = (v, e) => {
  if (isMixedEmpty(e)) return;
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
        setProperty(v, Number(e.value));
        return;
      }
      if (e.value != "-") {
        refreshField(e, v);
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
        setProperty(v.toLowerCase(), Number(e.value), true);
        return;
      }
      if (e.value != "-") {
        refreshField(e, v);
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
        const typed = e.value;
        setTiming(Number(Number(typed).toPrecision(10)));
        e.value = typed;
        return;
      }
      refreshField(e, v);
      break;
    case "Side": {
      const input = e.value.toUpperCase();
      const side = { L: "L", LEFT: "L", R: "R", RIGHT: "R", "": "" }[input];
      if (side === undefined) {
        iziToast.error({
          title: "Input Error",
          message: "Input value should be L or R.",
        });
      } else {
        for (const element of batchTargets()) element.direction = side || (element.direction == "L" ? "R" : "L");
        patternChanged();
      }
      refreshField(e, v);
      break;
    }
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
        setProperty("location", Number(e.value));
        return;
      }
      if (e.value != "-") {
        refreshField(e, v);
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
        setProperty("angle", Number(e.value));
        return;
      }
      if (e.value != "-") {
        refreshField(e, v);
      }
      break;
    case "Speed":
      if (selectedCntElement.v1 == 2) {
        iziToast.error({
          title: "Error",
          message: "Wrong Element.",
        });
      } else if (isNaN(Number(e.value))) {
        if (e.value != "-") {
          iziToast.error({
            title: "Input Error",
            message: "Input value is not number.",
          });
        }
      } else {
        setProperty("speed", Number(e.value));
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
        setProperty(v.toLowerCase(), Number(e.value), true);
        return;
      }
      break;
    default:
      alert(`settingsInput:Error, ${v} is not defined.`);
  }
};

const triggersInput = (v, e) => {
  if (isMixedEmpty(e)) return;
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
        setProperty(v, Number(e.value));
        return;
      }
      if (e.value != "-") {
        refreshField(e, v);
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
        setProperty(v, Number(e.value));
        return;
      }
      refreshField(e, v);
      break;
    case "bpm":
    case "duration":
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
        setProperty(v, Number(e.value));
        return;
      }
      refreshField(e, v);
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
        setProperty(v, Number(e.value));
        return;
      }
      if (e.value != "0.") {
        refreshField(e, v);
      }
      break;
    case "speed":
      if (isNaN(Number(e.value))) {
        iziToast.error({
          title: "Input Error",
          message: "Input value is not number.",
        });
      } else {
        setProperty(v, Number(e.value));
        return;
      }
      refreshField(e, v);
      break;
    case "align":
      if (e.value == "left" || e.value == "center" || e.value == "right") {
        setProperty(v, e.value);
        return;
      }
      iziToast.error({
        title: "Input Error",
        message: "Input value should be 'left', 'center', or 'right'.",
      });
      refreshField(e, v);
      break;
    case "valign":
      if (
        e.value == "top" ||
        e.value == "bottom" ||
        e.value == "middle" ||
        e.value == "alphabetic" ||
        e.value == "hanging"
      ) {
        setProperty(v, e.value);
        return;
      }
      iziToast.error({
        title: "Input Error",
        message: "Input value should be 'top', 'bottom', 'middle', 'alphabetic', 'hanging'.",
      });
      refreshField(e, v);
      break;
    case "size":
    case "weight":
    case "text":
    case "seek":
      setProperty(v, e.value);
      break;
    default:
      alert("settingsInput:Error");
  }
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

const trackMousePos = (event) => {
  const width = parseInt((componentViewOW - canvasContainerOW) / 2 + menuContainerOW);
  const x = ((event.clientX - width) / canvasContainerOW) * 200 - 100;
  const y = ((event.clientY - navBarOH) / canvasContainerOH) * 200 - 100;
  if (!(x < -100 || y < -100 || x > 100 || y > 100)) {
    mouseMode = 0;
    mouseX = Math.round(x);
    mouseY = Math.round(y);
  } else {
    mouseMode = -1;
  }
};

const trackTimelineMousePos = (event) => {
  const rect = tmlCanvas.getBoundingClientRect();
  mouseMode = 1;
  mouseX = (event.clientX - rect.left) * (tmlCanvas.width / rect.width);
  mouseY = (event.clientY - rect.top) * (tmlCanvas.height / rect.height);
  isTmlUpdateNeeded = true;
};

const startDrag = (v1, i) => {
  const element = elementOf({ v1, i });
  const group = selectedElements();
  const members = group.some((entry) => entry.element === element) ? group : [{ v1, element }];
  dragGroup = {
    anchor: { v1, element, origin: { ...element } },
    members: members.map((member) => ({ ...member, origin: { ...member.element } })),
  };
};

const endDrag = () => {
  if (!dragGroup) return;
  const { v1, element } = dragGroup.anchor;
  if (!pattern[elementKeys[v1]].includes(element)) {
    dragGroup = null;
    return;
  }
  const isChanged = (key) => dragGroup.members.some(({ element, origin }) => element[key] !== origin[key]);
  const isBeatChanged = isChanged("beat");
  if (isBeatChanged) {
    sortElements();
    if (selectedCntElement.v1 !== "")
      changeSettingsMode(selectedCntElement.v1, selectedCntElement.v2, selectedCntElement.i);
  }
  if (isBeatChanged || ["x", "y", "location"].some(isChanged)) patternChanged();
  dragGroup = null;
};

const snap = (value) => (magnetToggle ? value - (value % 5) : value);

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
        startDrag(v1, i);
      }
      const { anchor, members } = dragGroup;
      const anchorX = anchor.v1 == 0 ? anchor.origin.x : 0;
      const anchorY = anchor.v1 == 0 ? anchor.origin.y : anchor.origin.location;
      const dx = snap(anchorX + mouseX - dragMouseX) - anchorX;
      const dy = snap(anchorY + mouseY - dragMouseY) - anchorY;
      const moves = members.flatMap(({ v1, element, origin }) => {
        if (v1 == 0) return [{ element, x: origin.x + dx, y: origin.y + dy }];
        if (v1 == 1) return [{ element, location: origin.location + dy }];
        return [];
      });
      const inRange = (value) => value === undefined || (value <= 100 && value >= -100);
      if (mouseMode == 0 && moves.every(({ x, y, location }) => inRange(x) && inRange(y) && inRange(location))) {
        for (const { element, ...position } of moves) Object.assign(element, position);
      }
      elementFollowMouse(v1, v2, i);
      changeSettingsMode(v1, v2, i);
    } else {
      dragMouseX = undefined;
      dragMouseY = undefined;
      endDrag();
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
      if (!dragGroup) startDrag(v1, i);
      if (mouseMode == 1 && mouseX > tmlCanvasW / 10 && mouseX < tmlCanvasW / 1.01) {
        const beats = bpmsync.beat + (song.seek() * 1000 - (offset + sync) - bpmsync.ms) / (60000 / bpm);
        const tmlStartX = tmlCanvasW / 10;
        const beatToPx = (tmlCanvasW / 1.01 - tmlStartX) / (17 * zoom);
        let calculatedBeat = beats + (mouseX - tmlStartX) / beatToPx - zoom;
        if (calculatedBeat <= 0) calculatedBeat = 0;
        calculatedBeat = Number(calculatedBeat.toPrecision(10));
        if (magnetToggle) calculatedBeat = Math.round(calculatedBeat * split) / split;
        const { anchor, members } = dragGroup;
        const earliest = Math.min(...members.map(({ origin }) => origin.beat));
        const delta = Math.max(calculatedBeat - anchor.origin.beat, -earliest);
        for (const { element, origin } of members) {
          element.beat = Number((origin.beat + delta).toPrecision(10));
        }
      }
      timelineFollowMouse(v1, v2, i);
      changeSettingsMode(v1, v2, i);
    } else {
      endDrag();
    }
  });
};

const tmlClicked = () => {
  if (isNaN(Number(song.seek()))) return iziToast.error({ title: "Wait..", message: "Song is not loaded." });
  if (startScrollbarDrag()) return;
  if (mode == 0) {
    timelineFollowMouse();
  } else if (mode == 1) {
    selectPointing();
    if (pointingCntElement.v1 === "" && mouseX > tmlCanvasW / 10 && mouseY > tmlCanvasH / 6) startMarquee();
  } else if (mode == 2) {
    timelineAddElement();
  }
  copySeek();
};

const copySeek = () => {
  if (mouseX < tmlCanvasW / 10 && mouseY < tmlCanvasH / 6) {
    const beats = bpmsync.beat + (song.seek() * 1000 - bpmsync.ms) / (60000 / bpm);
    navigator.clipboard.writeText(beats);
    copied = true;
    copiedTime = new Date();
  }
};

const timelineAddElement = () => {
  let startY = tmlCanvasH / 6;
  const beats = bpmsync.beat + (song.seek() * 1000 - bpmsync.ms) / (60000 / bpm);
  const tmlStartX = tmlCanvasW / 10;
  const beatToPx = (tmlCanvasW / 1.01 - tmlStartX) / (17 * zoom);
  let calculatedBeat = beats + (mouseX - tmlStartX) / beatToPx - zoom;
  if (calculatedBeat <= 0) calculatedBeat = 0;
  calculatedBeat = Number(calculatedBeat.toPrecision(10));
  calculatedBeat = magnetToggle ? Math.round(calculatedBeat * split) / split : calculatedBeat;
  const target = timelineRowAt(mouseY - timelineYLoc);
  if (mouseX > tmlCanvasW / 10 && mouseX < tmlCanvasW / 1.01 && mouseY > startY && mouseY < tmlCanvasH / 1.1) {
    if (!target) {
      return;
    } else if (target.v1 == 0) {
      let newElement = {
        beat: calculatedBeat,
        value: selectedValue,
        direction: 1,
        x: 0,
        y: 0,
        duration: 4,
      };
      addElement(0, newElement);
    } else if (target.v1 == 1) {
      let newElement = {
        beat: calculatedBeat,
        direction: "L",
        location: 0,
        angle: 0,
        speed: 2,
      };
      addElement(1, newElement);
    } else {
      let newElement = {
        beat: calculatedBeat,
        value: -1,
        num: 0,
        bpm: bpm,
        opacity: 1,
        speed: speed,
        align: "center",
        valign: "middle",
        weight: 400,
        size: "3vh",
        duration: 4,
        x: 0,
        y: 0,
        text: "",
      };
      addElement(2, newElement);
    }
    changeSettingsMode(selectedCntElement.v1, selectedCntElement.v2, selectedCntElement.i);
    selection.clear();
    if (!isSettingsOpened) toggleSettings();
  }
};

const compClicked = () => {
  if (isNaN(Number(song.seek()))) return iziToast.error({ title: "Wait..", message: "Song is not loaded." });
  if (mode == 0) {
    elementFollowMouse();
  } else if (mode == 1) {
    selectPointing();
    if (pointingCntElement.v1 === "" && mouseMode == 0) startMarquee();
  } else if (mode == 2) {
    let beats = bpmsync.beat + (song.seek() * 1000 - bpmsync.ms) / (60000 / bpm);
    beats = Number(beats.toPrecision(10));
    if (mouseMode != -1) {
      if (mouseX < -80 || mouseX > 80) {
        let newElement = {
          beat: beats,
          direction: mouseX < -80 ? "L" : "R",
          location: parseInt(magnetToggle ? mouseY - (mouseY % 5) : mouseY),
          angle: 0,
          speed: 2,
        };
        addElement(1, newElement);
      } else {
        let newX = magnetToggle ? mouseX - (mouseX % 5) : mouseX;
        let newY = magnetToggle ? mouseY - (mouseY % 5) : mouseY;
        if (circleToggle && selectedCntElement.v1 === 0) {
          const radius = canvasW / 15;
          const noteX = (canvasW / 200) * (pattern.patterns[selectedCntElement.i].x + 100);
          const noteY = (canvasH / 200) * (pattern.patterns[selectedCntElement.i].y + 100);
          const difX = noteX - (canvasW / 200) * (mouseX + 100);
          const difY = noteY - (canvasH / 200) * (mouseY + 100);
          const distance = Math.sqrt(difX * difX + difY * difY) + radius / 2;
          const angle = calcAngleDegrees(difX, difY) + 180;
          const newDistance = distance - (distance % radius);
          newX = ((noteX + newDistance * getCos(angle)) / canvasW) * 200 - 100;
          newY = ((noteY + newDistance * getSin(angle)) / canvasH) * 200 - 100;
        }
        let newElement = {
          beat: beats,
          value: selectedValue,
          direction: 1,
          duration: 4,
          x: parseInt(newX),
          y: parseInt(newY),
        };
        addElement(0, newElement);
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
        weight: 400,
        size: "1vh",
        duration: 4,
        x: 0,
        y: 0,
        text: "",
      };
      addElement(2, newElement);
      changeSettingsMode(selectedCntElement.v1, selectedCntElement.v2, selectedCntElement.i);
      if (!isSettingsOpened) toggleSettings();
    }
    selection.clear();
  }
};

const changeSettingsMode = (v1, v2, i) => {
  document.getElementById("mixedSettingsContainer").style.display = "none";
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
      noteSettingsContainer.getElementsByClassName("settingsPropertiesTextbox")[3].value =
        pattern.patterns[i].direction;
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
      bulletSettingsContainer.getElementsByClassName("settingsPropertiesTextbox")[0].value =
        pattern.bullets[i].direction;
      bulletSettingsContainer.getElementsByClassName("settingsPropertiesTextbox")[1].value =
        pattern.bullets[i].location;
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
        let properties = document
          .getElementById("triggerSettingsContainer")
          .getElementsByClassName("settingsPropertiesContainer");
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
  if (v1 === selectedCntElement.v1 && i == selectedCntElement.i) showSelectionSettings(v1);
};

const triggerSet = (isChanged) => {
  const value = (isChanged ? triggerSelectBox : triggerInitBox).selectedIndex - (isChanged ? 0 : 1);
  for (const { v1, element } of selectedElements()) if (v1 == 2) element.value = value;
  selectedCntElement = { i: selectedCntElement.i, v1: 2, v2: value };
  patternChanged();
  changeSettingsMode(2, value, selectedCntElement.i);
};

const zoomIn = () => {
  zoom *= 0.9;
  zoom = Number(zoom.toPrecision(3));
  isTmlUpdateNeeded = true;
};

const zoomOut = () => {
  zoom /= 0.9;
  zoom = Number(zoom.toPrecision(3));
  isTmlUpdateNeeded = true;
};

const stopBtn = () => {
  controlBtn.classList.add("timeline-play");
  controlBtn.classList.remove("timeline-pause");
  song.stop();
};

const changeRate = (dir = 1) => {
  rate += dir * 0.25;
  if (rate > 2) {
    rate = 0.25;
  } else if (rate < 0.25) {
    rate = 2;
  }
  document.getElementById("percentage").innerText = `${rate * 100}%`;
  song.rate(rate);
};

const test = () => {
  preventUnload = false;
  let trackSettingsForm = settingsPropertiesTextbox;
  pattern.information.track = trackSettingsForm[0].value;
  pattern.information.producer = trackSettingsForm[1].value;
  pattern.information.author = trackSettingsForm[2].value;
  pattern.information.comment = trackSettingsForm[3].value;
  localStorage.pattern = JSON.stringify(pattern);
  window.location.href = `${url}/test${background == "0" ? "?background=0" : ""}`;
};

const changeSplit = (isTriggeredByKey) => {
  split++;
  if (split == 5) {
    split = 6;
  } else if (split == 7) {
    split = 8;
  } else if (split > 8) {
    if (isTriggeredByKey) {
      if (split == 9) {
        split = 12;
      } else if (split == 13) {
        split = 16;
      } else if (split == 17) {
        split = 24;
      } else if (split == 25) {
        split = 32;
      } else {
        split = 1;
      }
    } else {
      split = 1;
    }
  }
  document.getElementById("split").innerText = `1/${split}`;

  isTmlUpdateNeeded = true;
};

const patternChanged = () => {
  preventUnload = true;
  songName.innerText = pattern.information.track + "*";

  // Clear all following history from the current midpoint.
  if (patternSeek != patternHistory.length - 1) {
    patternHistory.splice(patternSeek + 1, patternHistory.length - 1 - patternSeek);
  }

  patternHistory.push(structuredClone(pattern));
  if (patternHistory.length > 50) {
    patternHistory.splice(0, patternHistory.length - 50);
  }
  patternSeek = patternHistory.length - 1;

  isTmlUpdateNeeded = true;
};

const patternUndo = () => {
  if (patternSeek >= 1) {
    patternSeek--;
    pattern = structuredClone(patternHistory[patternSeek]);
  }
  selectedCntElement = { i: "", v1: "", v2: "" };
  selection.clear();
  if (isSettingsOpened) toggleSettings();
  isTmlUpdateNeeded = true;
};

const patternRedo = () => {
  if (patternSeek < patternHistory.length - 1) {
    patternSeek++;
    pattern = structuredClone(patternHistory[patternSeek]);
  }
  selectedCntElement = { i: "", v1: "", v2: "" };
  selection.clear();
  if (isSettingsOpened) toggleSettings();
  isTmlUpdateNeeded = true;
};

const currentBeat = () => Number((bpmsync.beat + (song.seek() * 1000 - bpmsync.ms) / (60000 / bpm)).toPrecision(10));

const elementOf = ({ v1, i }) => pattern[elementKeys[v1]][i];

const refOf = (v1, element) => ({ v1, v2: v1 == 1 ? 0 : element.value, i: pattern[elementKeys[v1]].indexOf(element) });

const destroyTargets = () =>
  new Map(
    pattern.triggers.filter((trigger) => trigger.value == 0).map((trigger) => [trigger, pattern.bullets[trigger.num]]),
  );

const relinkDestroyTargets = (targets) => {
  for (const [trigger, bullet] of targets) {
    const num = pattern.bullets.indexOf(bullet);
    if (num !== -1) trigger.num = num;
  }
};

const sortElements = () => {
  const primary = selectedCntElement.v1 !== "" ? elementOf(selectedCntElement) : null;
  const targets = destroyTargets();
  for (const key of elementKeys) pattern[key].sort(sortAsTiming);
  relinkDestroyTargets(targets);
  if (primary)
    selectedCntElement = { ...selectedCntElement, i: pattern[elementKeys[selectedCntElement.v1]].indexOf(primary) };
};

const addElement = (v1, element) => {
  pattern[elementKeys[v1]].push(element);
  sortElements();
  patternChanged();
  selectedCntElement = refOf(v1, element);
};

const removeElements = (elements) => {
  const removed = new Set(elements.map(({ element }) => element));
  const targets = destroyTargets();
  pattern.triggers.forEach((trigger, i) => {
    if (removed.has(trigger) || !removed.has(targets.get(trigger))) return;
    removed.add(trigger);
    iziToast.warning({
      title: "Destroy trigger deleted",
      message: `Trigger_${i} is deleted.`,
    });
  });
  for (const key of elementKeys) pattern[key] = pattern[key].filter((element) => !removed.has(element));
  relinkDestroyTargets(targets);
};

const selectedCount = () =>
  selection.size + (selectedCntElement.v1 !== "" && !selection.has(elementOf(selectedCntElement)) ? 1 : 0);

const setPrimary = (target) => {
  if (target) {
    selectedCntElement = target;
    changeSettingsMode(target.v1, target.v2, target.i);
    if (!isSettingsOpened) toggleSettings();
  } else {
    selectedCntElement = { v1: "", v2: "", i: "" };
    changeSettingsMode(-1);
    if (isSettingsOpened) toggleSettings();
  }
};

const selectedElements = () => {
  const elements = new Set(selection);
  if (selectedCntElement.v1 !== "") elements.add(elementOf(selectedCntElement));
  return elementKeys.flatMap((key, v1) =>
    pattern[key].filter((element) => elements.has(element)).map((element) => ({ v1, element })),
  );
};

const ensurePrimary = () => {
  if (selectedCntElement.v1 !== "")
    return changeSettingsMode(selectedCntElement.v1, selectedCntElement.v2, selectedCntElement.i);
  const [first] = selectedElements().sort((a, b) => a.element.beat - b.element.beat);
  setPrimary(first ? refOf(first.v1, first.element) : null);
};

const batchTargets = (isSameValue) => {
  const { v1 } = selectedCntElement;
  const { value } = elementOf(selectedCntElement);
  return selectedElements()
    .filter((entry) => entry.v1 === v1 && (!(isSameValue || v1 == 2) || entry.element.value == value))
    .map(({ element }) => element);
};

const setProperty = (key, value, isSameValue) => {
  for (const element of batchTargets(isSameValue)) element[key] = value;
  patternChanged();
};

const setTiming = (beat) => {
  const elements = selectedElements();
  const earliest = Math.min(...elements.map(({ element }) => element.beat));
  const delta = beat - earliest;
  for (const { element } of elements) element.beat = Number((element.beat + delta).toPrecision(10));
  sortElements();
  patternChanged();
  changeSettingsMode(selectedCntElement.v1, selectedCntElement.v2, selectedCntElement.i);
};

const fieldKeys = {
  Timing: "beat",
  Direction: "direction",
  Duration: "duration",
  Side: "direction",
  Location: "location",
  Angle: "angle",
  Speed: "speed",
};

const sharedValue = (arg) => {
  const key = fieldKeys[arg] ?? arg;
  const targets = key == "beat" ? selectedElements().map(({ element }) => element) : batchTargets();
  const values = new Set(targets.map((element) => element[key]));
  return values.size === 1 ? [...values][0] : null;
};

const refreshField = (input, arg) => {
  const value = sharedValue(arg);
  input.value = value ?? "";
  input.placeholder = value === null ? "Mixed" : "";
};

const isMixedEmpty = (input) => input.placeholder == "Mixed" && input.value === "";

const isShown = (element, root) => {
  for (let node = element; node && node !== root; node = node.parentElement) {
    if (node.style.display == "none") return false;
  }
  return true;
};

const showSelectionSettings = (v1) => {
  const elements = selectedElements();
  const kinds = elementKeys.map((_, kind) => elements.filter((entry) => entry.v1 === kind).length);
  if (kinds.filter(Boolean).length > 1) {
    document.getElementById("settingsNameSpace").innerText = `Mixed (${elements.length})`;
    document.getElementById("dot").style.color = "#999";
    for (const id of [
      "noteSettingsContainer",
      "bulletSettingsContainer",
      "triggerSettingsContainer",
      "triggerInitializeContainer",
    ]) {
      document.getElementById(id).style.display = "none";
    }
    document.getElementById("mixedSettingsContainer").style.display = "block";
    document.getElementById("mixedSettingsMessage").innerText = `Different kinds of elements are selected (${[
      "Notes",
      "Bullets",
      "Triggers",
    ]
      .map((name, kind) => (kinds[kind] ? `${name} ${kinds[kind]}` : ""))
      .filter(Boolean)
      .join(", ")}). Select only one kind to edit properties together.`;
    return;
  }
  if (elements.length > 1)
    document.getElementById("settingsNameSpace").innerText =
      `${["Notes", "Bullets", "Triggers"][v1]} (${elements.length})`;
  const types = new Set(elements.map(({ element }) => element.value));
  if (types.size > 1 && v1 == 0) {
    const rows = noteSettingsContainer.getElementsByClassName("settingsPropertiesIndividual");
    rows[3].style.display = "none";
    rows[4].style.display = "none";
  } else if (types.size > 1 && v1 == 2) {
    document.getElementById("triggerInitializeContainer").style.display = "none";
    document.getElementById("triggerSettingsContainer").style.display = "block";
    const properties = document
      .getElementById("triggerSettingsContainer")
      .getElementsByClassName("settingsPropertiesContainer");
    for (let j = 1; j < properties.length - 1; j++) properties[j].style.display = "none";
    triggerSelectBox.selectedIndex = triggerSelectBox.options.length - 1;
  }
  const root = document.getElementById(
    ["noteSettingsContainer", "bulletSettingsContainer", "triggerSettingsContainer"][v1],
  );
  for (const input of root.getElementsByClassName("settingsPropertiesTextbox")) {
    input.placeholder = "";
    const arg = input.dataset.keyupArg ?? input.dataset.blurArg;
    if (arg && isShown(input, root)) refreshField(input, arg);
  }
};

const selectPointing = () => {
  const pointing = pointingCntElement;
  isTmlUpdateNeeded = true;
  if (pointing.v1 === "") {
    if (ctrlDown || shiftDown) return;
    selection.clear();
    setPrimary(null);
    return;
  }
  const element = elementOf(pointing);
  if (ctrlDown) {
    if (selectedCntElement.v1 !== "") selection.add(elementOf(selectedCntElement));
    if (selection.has(element)) {
      selection.delete(element);
      selectedCntElement = { v1: "", v2: "", i: "" };
      ensurePrimary();
    } else {
      selection.add(element);
      setPrimary(pointing);
    }
  } else if (shiftDown) {
    const anchor = selectedCntElement.v1 !== "" ? selectedCntElement : pointing;
    const [from, to] = [elementOf(anchor).beat, element.beat].sort((a, b) => a - b);
    for (const v1 of new Set([anchor.v1, pointing.v1])) {
      for (const target of pattern[elementKeys[v1]]) {
        if (target.beat >= from && target.beat <= to) selection.add(target);
      }
    }
    setPrimary(pointing);
  } else {
    const isToggleOff = !selection.size && pointing.v1 === selectedCntElement.v1 && pointing.i == selectedCntElement.i;
    selection.clear();
    setPrimary(isToggleOff ? null : pointing);
  }
};

const toEntries = (elements) =>
  elements.map(({ v1, element }) => {
    const entry = { v1, element: structuredClone(element) };
    if (v1 != 2 || element.value != 0) return entry;
    const bullet = pattern.bullets[element.num];
    const target = elements.findIndex((other) => other.element === bullet);
    return target === -1 ? { ...entry, bullet } : { ...entry, target };
  });

const insertEntries = (entries, offset) => {
  const inserted = entries.map((entry) => ({ ...entry, element: structuredClone(entry.element) }));
  for (const { v1, element } of inserted) {
    element.beat = Number((element.beat + offset).toPrecision(10));
    pattern[elementKeys[v1]].push(element);
  }
  for (const { element, target, bullet } of inserted) {
    const num = pattern.bullets.indexOf(target === undefined ? bullet : inserted[target].element);
    if (num !== -1) element.num = num;
  }
  sortElements();
  selection = new Set(inserted.map(({ element }) => element));
  selectedCntElement = { v1: "", v2: "", i: "" };
  ensurePrimary();
  patternChanged();
  return inserted.length;
};

const plural = (count) => `${count} element${count > 1 ? "s" : ""}`;

const warnNothingSelected = (title) => {
  iziToast.warning({
    title,
    message: "Nothing Selected.",
  });
};

const clipboardKey = "editorClipboard";

const saveClipboard = () => {
  try {
    localStorage[clipboardKey] = JSON.stringify({
      ...clipboard,
      elements: clipboard.elements.map(({ v1, element, target }) => ({ v1, element, target })),
    });
  } catch (e) {
    console.warn(e);
  }
};

const loadClipboard = () => {
  try {
    const data = JSON.parse(localStorage[clipboardKey]);
    return Array.isArray(data?.elements) && typeof data.beat === "number" ? data : null;
  } catch {
    return null;
  }
};

const copyToClipboard = () => {
  const elements = selectedElements();
  if (!elements.length) return 0;
  clipboard = {
    track: pattern.information.track,
    elements: toEntries(elements),
    beat: Math.min(...elements.map(({ element }) => element.beat)),
  };
  saveClipboard();
  return elements.length;
};

const elementCopy = () => {
  const count = copyToClipboard();
  if (!count) return warnNothingSelected("Copy failed");
  iziToast.success({
    title: "Copy",
    message: `Copied ${plural(count)}`,
  });
};

const elementCut = () => {
  const count = copyToClipboard();
  if (!count) return warnNothingSelected("Cut failed");
  deleteElement();
  iziToast.success({
    title: "Cut",
    message: `Cut ${plural(count)}`,
  });
};

const elementPaste = () => {
  clipboard ??= loadClipboard();
  if (!clipboard) {
    iziToast.warning({
      title: "Paste failed",
      message: "Nothing copied.",
    });
    return;
  }
  const count = insertEntries(clipboard.elements, Number((currentBeat() - clipboard.beat).toPrecision(10)));
  iziToast.success({
    title: "Paste",
    message: `Pasted ${plural(count)}`,
  });
  const unlinked = clipboard.elements.filter(
    ({ v1, element, target }) => v1 == 2 && element.value == 0 && target === undefined,
  ).length;
  if (unlinked && clipboard.track !== pattern.information.track) {
    iziToast.warning({
      title: "Paste",
      message: `${unlinked} destroy trigger${unlinked > 1 ? "s" : ""} from another track kept the original bullet number.`,
    });
  }
};

const elementDuplicate = () => {
  const elements = selectedElements();
  if (!elements.length) return warnNothingSelected("Duplicate failed");
  const beats = elements.map(({ element }) => element.beat);
  const offset = Number((Math.max(...beats) - Math.min(...beats) + 1 / split).toPrecision(10));
  const count = insertEntries(toEntries(elements), offset);
  iziToast.success({
    title: "Duplicate",
    message: `Duplicated ${plural(count)}`,
  });
};

const nudgeElements = (direction) => {
  const elements = selectedElements();
  if (!elements.length) return;
  const earliest = Math.min(...elements.map(({ element }) => element.beat));
  const step = earliest * split;
  const target = (direction > 0 ? Math.floor(step + 1e-6) + 1 : Math.ceil(step - 1e-6) - 1) / split;
  if (target < 0) return;
  const delta = target - earliest;
  for (const { element } of elements) element.beat = Number((element.beat + delta).toPrecision(10));
  sortElements();
  if (selectedCntElement.v1 !== "")
    changeSettingsMode(selectedCntElement.v1, selectedCntElement.v2, selectedCntElement.i);
  patternChanged();
};

const selectAll = () => {
  selection = new Set(elementKeys.flatMap((key, v1) => (isKindShown(v1) ? pattern[key] : [])));
  ensurePrimary();
  isTmlUpdateNeeded = true;
};

const deleteElement = () => {
  const elements = selectedElements();
  if (!elements.length) return;
  removeElements(elements);
  selection.clear();
  setPrimary(null);
  patternChanged();
};

const startMarquee = () => {
  marquee = { area: mouseMode, x0: mouseX, y0: mouseY, x1: mouseX, y1: mouseY, hits: new Set() };
  marqueeFollowMouse();
};

const marqueeFollowMouse = () => {
  requestAnimationFrame(() => {
    if (!marquee) return;
    if (mouseMode == marquee.area) {
      marquee.x1 = mouseX;
      marquee.y1 = mouseY;
    }
    const [left, right] = [marquee.x0, marquee.x1].sort((a, b) => a - b);
    const [top, bottom] = [marquee.y0, marquee.y1].sort((a, b) => a - b);
    marquee.hits = new Set(
      (marquee.area == 1 ? tmlPositions : cntPositions)
        .filter(({ x, y }) => x >= left && x <= right && y >= top && y <= bottom)
        .map(({ element }) => element),
    );
    isTmlUpdateNeeded = true;
    if (mouseDown) return marqueeFollowMouse();
    for (const element of marquee.hits) selection.add(element);
    marquee = null;
    ensurePrimary();
  });
};

const showHelp = () => {
  document.getElementById("helpContainer").style.display = "flex";
};

const hideHelp = () => {
  document.getElementById("helpContainer").style.display = "none";
};

const tmlScrollHorizontal = (direction, splitBy = split) => {
  let beats = bpmsync.beat + (song.seek() * 1000 - bpmsync.ms) / (60000 / bpm); // Get current beat from song position
  let targetSubdivision;

  if (direction > 0) {
    targetSubdivision = Math.floor(beats * splitBy + epsilon) + direction;
  } else {
    targetSubdivision = Math.ceil(beats * splitBy - epsilon) + direction;
  }

  seekToBeat(Number((targetSubdivision / splitBy).toPrecision(15)));
};

const seekToBeat = (beats) => {
  const triggerEnd = upperBound(pattern.triggers, beats);
  bpm = pattern.information.bpm;
  bpmsync = {
    ms: 0,
    beat: 0,
  };
  for (let i = 0; i < triggerEnd; i++) {
    if (pattern.triggers[i].value == 2) {
      bpmsync.ms = bpmsync.ms + (pattern.triggers[i].beat - bpmsync.beat) * (60000 / bpm);
      bpm = pattern.triggers[i].bpm;
      bpmsync.beat = pattern.triggers[i].beat;
    }
  }
  const seek = (beats - bpmsync.beat) * (60000 / bpm) + bpmsync.ms;
  song.seek(seek / 1000);

  isTmlUpdateNeeded = true;
};

const beatAtMs = (ms) => {
  let beat = 0,
    at = 0,
    tempo = pattern.information.bpm;
  for (const trigger of pattern.triggers) {
    if (trigger.value != 2) continue;
    const next = at + (trigger.beat - beat) * (60000 / tempo);
    if (next > ms) break;
    [beat, at, tempo] = [trigger.beat, next, trigger.bpm];
  }
  return beat + (ms - at) / (60000 / tempo);
};

const scrollRows = () => Math.max(0, timelineElementNum - 6);

const setScrollRow = (row) => {
  const offset = Math.min(Math.max(Math.round(row), 0), scrollRows());
  timelineYLoc = -offset * (tmlCanvasH / 9);
  timelineScrollCount = 6 + offset;
  isTmlUpdateNeeded = true;
};

const isOverScrollbar = (axis, bar) => {
  const [padX, padY] = axis == "h" ? [0, bar.h] : [bar.w, 0];
  return (
    mouseMode == 1 &&
    mouseX >= bar.x - padX &&
    mouseX <= bar.x + bar.w + padX &&
    mouseY >= bar.y - padY &&
    mouseY <= bar.y + bar.h + padY
  );
};

const startScrollbarDrag = () => {
  if (!tmlScrollbars) return false;
  for (const [axis, bar] of Object.entries(tmlScrollbars)) {
    if (!bar || !isOverScrollbar(axis, bar)) continue;
    const pos = axis == "h" ? mouseX : mouseY;
    const onThumb = pos >= bar.thumb && pos <= bar.thumb + bar.size;
    scrollbarDrag = { axis, grab: onThumb ? pos - bar.thumb : bar.size / 2 };
    scrollbarFollowMouse();
    return true;
  }
  return false;
};

const scrollbarFollowMouse = () => {
  if (!scrollbarDrag) return;
  const bar = tmlScrollbars?.[scrollbarDrag.axis];
  if (bar && mouseMode == 1) {
    const isHorizontal = scrollbarDrag.axis == "h";
    const start = isHorizontal ? bar.x : bar.y;
    const length = (isHorizontal ? bar.w : bar.h) - bar.size;
    const ratio = Math.min(Math.max(((isHorizontal ? mouseX : mouseY) - scrollbarDrag.grab - start) / length, 0), 1);
    if (isHorizontal) seekToBeat(Math.min(Math.round(ratio * bar.max * split) / split, bar.max));
    else setScrollRow(ratio * bar.max);
  }
  if (!mouseDown) {
    scrollbarDrag = null;
    isTmlUpdateNeeded = true;
    return;
  }
  requestAnimationFrame(scrollbarFollowMouse);
};

const tmlScrollUp = () => {
  timelineYLoc = Number(timelineYLoc.toFixed(2)) + tmlCanvasH / 9;
  timelineScrollCount--;
  if (timelineYLoc > 1) {
    timelineYLoc = Number(timelineYLoc.toFixed(2)) - tmlCanvasH / 9;
    timelineScrollCount++;
  }

  isTmlUpdateNeeded = true;
};

const tmlScrollDown = () => {
  if (timelineElementNum > 6 && timelineScrollCount < timelineElementNum) {
    timelineYLoc = Number(timelineYLoc.toFixed(2)) - tmlCanvasH / 9;
    timelineScrollCount++;
  }

  isTmlUpdateNeeded = true;
};

const scrollEvent = (e) => {
  let delta;
  if (e.deltaY != 0) delta = Math.max(-1, Math.min(1, e.deltaY));
  else delta = Math.max(-1, Math.min(1, e.deltaX));
  if (!settings.input.wheelReverse) delta *= -1;
  if (delta == 1) {
    //UP
    if (shiftDown) tmlScrollUp();
    else if (ctrlDown) zoomIn();
    else tmlScrollHorizontal(1);
  } else {
    //DOWN
    if (shiftDown) tmlScrollDown();
    else if (ctrlDown) zoomOut();
    else tmlScrollHorizontal(-1);
  }
  e.preventDefault();
};

const isTypingTarget = (target) =>
  !!target.closest?.(
    'textarea, select, [contenteditable="true"], input:not([type="button"]):not([type="checkbox"]):not([type="range"])',
  );

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

const reflection = (...dirs) => {
  const elements = selectedElements();
  const targets = elements.filter(({ v1 }) => v1 < 2);
  if (!targets.length) {
    iziToast.warning({
      title: "Reflection Failed",
      message: elements.length ? "Reflection is not supported for triggers." : "No element is selected for reflection.",
    });
    return;
  }
  for (const { v1, element } of targets) {
    for (const dir of dirs) {
      if (v1 == 0) {
        element[["x", "y"][dir]] *= -1;
        if (dir == 1 && element.value == 1) element.direction *= -1;
      } else {
        if (dir == 0) element.direction = element.direction == "L" ? "R" : "L";
        else element.location *= -1;
        element.angle *= -1;
      }
    }
  }
  if (selectedCntElement.v1 !== "")
    changeSettingsMode(selectedCntElement.v1, selectedCntElement.v2, selectedCntElement.i);
  patternChanged();
};

document.getElementById("timelineContainer").addEventListener("wheel", scrollEvent);
window.addEventListener("wheel", globalScrollEvent);

window.addEventListener("resize", () => {
  initialize(false);
});

window.addEventListener("beforeunload", (event) => {
  if (preventUnload) {
    event.preventDefault();
    return (event.returnValue = "");
  }
});

window.addEventListener("blur", () => {
  shiftDown = false;
  ctrlDown = false;
  mouseDown = false;
});

document.addEventListener("keyup", (e) => {
  e = e || window.event;
  if (isMac ? e.key == "Meta" : e.key == "Control") {
    ctrlDown = false;
    isTmlUpdateNeeded = true;
  } else if (e.key == "Shift") {
    shiftDown = false;
    isTmlUpdateNeeded = true;
  }
});

document.addEventListener("keydown", (e) => {
  e = e || window.event;
  const isTyping = isTypingTarget(e.target);
  if (e.key == "Escape") {
    if (isTyping) {
      e.target.blur();
    } else if (selection.size || isSettingsOpened) {
      selection.clear();
      setPrimary(null);
      isTmlUpdateNeeded = true;
    } else {
      if (song.playing()) {
        songPlayPause();
      } else {
        timelineScrollCount = 0;
        timelineYLoc = 0;
        song.stop();
        isTmlUpdateNeeded = true;
      }
    }
  } else if (isMac ? e.key == "Meta" : e.key == "Control") {
    ctrlDown = true;
    isTmlUpdateNeeded = true;
  } else if (e.key == "Shift") {
    shiftDown = true;
    isTmlUpdateNeeded = true;
  } else if (ctrlDown) {
    if (e.code == "KeyS") {
      e.preventDefault();
      ctrlDown = false;
      save(shiftDown);
      shiftDown = false;
    } else if (e.code == "KeyZ" && !isTyping) {
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
  if (!isTyping) {
    if (e.code == "Space" || e.code == "KeyK") {
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
    } else if (e.altKey && (e.key == "ArrowLeft" || e.key == "ArrowRight")) {
      e.preventDefault();
      nudgeElements(e.key == "ArrowLeft" ? -1 : 1);
    } else if (e.key == "ArrowLeft") {
      tmlScrollHorizontal(-1);
    } else if (e.key == "ArrowRight") {
      tmlScrollHorizontal(1);
    } else if (e.key == "ArrowUp") {
      tmlScrollUp();
    } else if (e.key == "ArrowDown") {
      tmlScrollDown();
    } else if (e.code == "Delete" || e.code == "Backspace") {
      deleteElement();
    } else if (e.code == "KeyC") {
      if (ctrlDown) {
        elementCopy();
      } else toggleCircle();
    } else if (e.code == "KeyV") {
      if (ctrlDown) {
        elementPaste();
      } else reflection(1);
    } else if (ctrlDown && e.code == "KeyX") {
      elementCut();
    } else if (ctrlDown && e.code == "KeyD") {
      e.preventDefault();
      elementDuplicate();
    } else if (ctrlDown && e.code == "KeyA") {
      e.preventDefault();
      selectAll();
    } else if (e.code == "KeyH") {
      reflection(0);
    } else if (e.code == "KeyR") {
      if (!ctrlDown) reflection(0, 1);
    } else if (e.code == "Slash") {
      changeSplit(true);
    } else if (e.code == "KeyG") {
      toggleGrid();
    } else if (e.code == "KeyT") {
      toggleMagnet();
    } else if (e.code == "KeyB") {
      toggleMetronome();
    } else if (e.code == "KeyJ") {
      tmlScrollHorizontal(-1, 1);
    } else if (e.code == "KeyL") {
      tmlScrollHorizontal(1, 1);
    } else if (e.code == "Minus") {
      zoomOut();
    } else if (e.code == "Equal") {
      zoomIn();
    } else if (e.code == "Comma") {
      changeRate(-1);
    } else if (e.code == "Period") {
      changeRate(1);
    }
  }
  if (mode == 2 && !isTyping) {
    if (e.key == "Alt") {
      e.preventDefault();
      selectedValue++;
      if (selectedValue > 2) selectedValue = 0;
    }
  }
});

document.body.addEventListener("mousedown", () => {
  mouseDown = true;
});

window.addEventListener("mouseup", () => {
  mouseDown = false;
});

window.addEventListener("storage", (e) => {
  if (e.key === clipboardKey) clipboard = null;
});

window.addEventListener("load", () => {
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
});

// Delegated click handlers, keyed by each element's data-action attribute.
const clickActions = {
  changeMode: (arg) => changeMode(Number(arg)),
  changeNote,
  changeRate,
  changeSplit,
  deleteElement,
  elementCopy,
  elementPaste,
  goGame: () => (window.location.href = `${url}/game?initialize=0`),
  gotoMain,
  // Confirms before leaving unsaved work.
  gotoMainConfirm: () => gotoMain(true),
  loadEditor,
  newEditor,
  save,
  setTimelineFilter,
  songPlayPause,
  songSelected,
  stopBtn,
  test,
  toggleCircle,
  toggleGrid,
  toggleMagnet,
  toggleMetronome,
  toggleSettings,
  zoomIn,
  zoomOut,
};

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = clickActions[target.dataset.action];
  if (action) action(target.dataset.arg);
});

// Some of these take a key argument along with the element, others just the element.
const inputActions = {
  settingsInput,
  triggersInput,
  changeBPM,
  changeOffset,
  changeSpeed,
};
const runInputAction = (target) => {
  const action = inputActions[target.dataset.keyup];
  if (!action) return;
  if (target.dataset.keyupArg === undefined) action(target);
  else action(target.dataset.keyupArg, target);
};
document.addEventListener("keyup", (event) => {
  const target = event.target.closest?.("[data-keyup]");
  if (target) runInputAction(target);
});

// blur doesn't bubble, so delegation can't catch it; use the bubbling equivalent, focusout, instead.
document.addEventListener("focusout", (event) => {
  const target = event.target.closest?.(".settingsPropertiesTextbox");
  if (target?.dataset.blur === "triggersInput") triggersInput(target.dataset.blurArg, target);
});

document.addEventListener("input", (event) => {
  const target = event.target.closest?.("[data-setting]");
  if (target) settingChanged(target, target.dataset.setting);
});

const changeActions = {
  triggerSet: () => triggerSet(),
  triggerSetTrue: () => triggerSet(true),
};
document.addEventListener("change", (event) => {
  const target = event.target.closest?.("[data-change]");
  if (!target) return;
  const action = changeActions[target.dataset.change];
  if (action) action();
});

const mouseActions = {
  trackMousePos,
  trackTimelineMousePos,
  tmlClicked,
  compClicked,
  showHelp,
  hideHelp,
};
const delegateMouse = (type, attribute) => {
  document.addEventListener(type, (event) => {
    const target = event.target.closest?.(`[data-${attribute}]`);
    if (!target) return;
    const action = mouseActions[target.dataset[attribute]];
    if (action) action(event);
  });
};
delegateMouse("mousemove", "mousemove");
delegateMouse("mousedown", "mousedown");
delegateMouse("mouseover", "mouseover");
delegateMouse("mouseout", "mouseout");

document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("dragstart", (event) => event.preventDefault());
document.addEventListener("selectstart", (event) => event.preventDefault());
