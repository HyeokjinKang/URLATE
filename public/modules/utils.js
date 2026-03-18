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

export const easeOutQuad = (x) => {
  return 1 - (1 - x) * (1 - x);
};

export const easeOutSine = (x) => {
  return Math.sin((x * Math.PI) / 2);
};
