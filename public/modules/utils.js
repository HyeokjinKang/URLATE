// Escape user-controlled strings before inserting into innerHTML (XSS prevention).
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

// Only allow http(s) or root-relative URLs; block javascript:/data: schemes in src/background contexts.
export const safeUrl = (value) => {
  const str = String(value ?? "").trim();
  return /^https?:\/\//i.test(str) || str.startsWith("/") ? str : "";
};

export const numberWithCommas = (n) => {
  let str = (~~n).toString();
  let head = "";
  let result = "";

  let len = str.length;
  for (let i = len; i < 9; i++) {
    head += "0";
  }
  str = head + str;

  len = str.length;
  for (let i = 0; i < len; i++) {
    if (i > 0 && (len - i) % 3 === 0) {
      result += ",";
    }
    result += str[i];
  }
  return result;
};

const alphaCache = Array.from({ length: 256 }, (_, i) => {
  return i.toString(16).padStart(2, "0").toUpperCase();
});

export const hexadecimal = (color, percentage) => {
  const alphaIndex = Math.round(255 * (percentage / 100));
  const alpha = alphaCache[Math.max(0, Math.min(255, alphaIndex))];
  return color + alpha;
};

const DEG_TO_RAD = Math.PI / 180;

export const getTan = (deg) => Math.tan(deg * DEG_TO_RAD);
export const getCos = (deg) => Math.cos(deg * DEG_TO_RAD);
export const getSin = (deg) => Math.sin(deg * DEG_TO_RAD);

export const calcAngleDegrees = (x, y) => {
  return (Math.atan2(y, x) * 180) / Math.PI;
};

export const lowerBound = (array, value) => {
  if (value < 0) value = 0;
  let low = 0;
  let high = array.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (value <= array[mid].beat) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
};

export const upperBound = (array, value) => {
  let low = 0;
  let high = array.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (value >= array[mid].beat) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
};

export const easeInQuad = (x) => {
  return x * x;
};

export const easeOutQuart = (x) => {
  return 1 - Math.pow(1 - x, 4);
};

export const easeOutCubic = (x) => {
  return 1 - Math.pow(1 - x, 3);
};

export const easeOutQuad = (x) => {
  return 1 - (1 - x) * (1 - x);
};

export const easeOutSine = (x) => {
  return Math.sin((x * Math.PI) / 2);
};

export const PRESS_WINDOW_FRAMES = 12;
export const RELEASE_LATE_FRAMES = 16;

export const msToFrames = (ms) => (ms * 60) / 1000;

export const judgeTiming = (frames) => {
  const f = Math.abs(frames);
  if (f <= 3) return "Perfect";
  if (f <= 7) return "Great";
  if (f <= 10) return "Good";
  if (f <= PRESS_WINDOW_FRAMES) return "Bad";
  return "Miss";
};

export const judgeReleaseTiming = (frames) => {
  if (frames >= -4 && frames <= 6) return "Perfect";
  if (frames >= -8 && frames <= 11) return "Great";
  if (frames >= -12 && frames <= RELEASE_LATE_FRAMES) return "Good";
  if (frames > RELEASE_LATE_FRAMES) return "Bad";
  return "Miss";
};

export const judgeWheelTiming = (frames) => {
  const f = Math.abs(frames);
  if (f <= 5) return "Perfect";
  if (f <= 9) return "Great";
  if (f <= PRESS_WINDOW_FRAMES) return "Good";
  return "Miss";
};

export const HIT_SOUNDS = ["default", "crisp", "rimshot", "hihat", "snap", "blip"];

export const hitSoundSrc = (name) => `/sounds/hitsounds/${HIT_SOUNDS.includes(name) ? name : HIT_SOUNDS[0]}.wav`;

export const holdTickCount = (duration) => Math.max(Math.ceil(duration) - 1, 0) + 2;
