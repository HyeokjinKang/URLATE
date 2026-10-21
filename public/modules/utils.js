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

export const judgeTiming = (beats, target, rate) => {
  if (beats <= target + rate / 6 && beats >= target - rate / 6) return "Perfect";
  if (beats <= target + rate / 3 && beats >= target - rate / 3) return "Great";
  if (beats >= target - rate / 2 && beats <= target) return "Good";
  if (beats >= target - rate) return "Bad";
  return "Miss";
};

export const judgeReleaseTiming = (beats, target, rate) => {
  const diff = (beats - target) / rate;
  if (diff >= -3 / 16 && diff <= 1 / 4) return "Perfect";
  if (diff >= -1 / 3 && diff <= 5 / 12) return "Great";
  if (diff >= -1 / 2 && diff <= 3 / 4) return "Good";
  return "Miss";
};

export const holdTickCount = (duration) => Math.max(Math.ceil(duration) - 1, 0) + 2;
