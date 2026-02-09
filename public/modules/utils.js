/* eslint-disable no-unused-vars */
const numberWithCommas = (x) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const hexadecimal = (color, percentage) => {
  const decimal = `0${Math.round(255 * (percentage / 100)).toString(16)}`.slice(-2).toUpperCase();
  return color + decimal;
};

const getTan = (deg) => {
  let rad = (deg * Math.PI) / 180;
  return Math.tan(rad);
};

const getCos = (deg) => {
  let rad = (deg * Math.PI) / 180;
  return Math.cos(rad);
};

const getSin = (deg) => {
  let rad = (deg * Math.PI) / 180;
  return Math.sin(rad);
};

const calcAngleDegrees = (x, y) => {
  return (Math.atan2(y, x) * 180) / Math.PI;
};

const lowerBound = (array, value) => {
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

const upperBound = (array, value) => {
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

const easeInQuad = (x) => {
  return x * x;
};

const easeOutQuart = (x) => {
  return 1 - Math.pow(1 - x, 4);
};

const easeOutQuad = (x) => {
  return 1 - (1 - x) * (1 - x);
};

const easeOutSine = (x) => {
  return Math.sin((x * Math.PI) / 2);
};

const isMac = navigator.userAgentData && navigator.userAgentData.platform ? navigator.userAgentData.platform === "macOS" : /Mac/.test(navigator.platform);
