export const PATTERN_VERSION = "1.1";

export const GRADUAL_TRIGGERS = { 2: "bpm", 3: "opacity", 4: "speed" };

const versionOf = (pattern) => {
  const [major = 1, minor = 0] = String(pattern.information?.version ?? "1.0")
    .split(".")
    .map((part) => parseInt(part, 10));
  return { major: isNaN(major) ? 1 : major, minor: isNaN(minor) ? 0 : minor };
};

export const parsePattern = (data) => {
  const pattern = typeof data == "string" ? JSON.parse(data) : data;
  const { major, minor } = versionOf(pattern);
  if (major != 1) throw new Error(`Unsupported pattern version: ${pattern.information?.version}`);
  for (const trigger of pattern.triggers) {
    if (!(trigger.value in GRADUAL_TRIGGERS)) continue;
    trigger.duration = minor >= 1 ? Math.max(Number(trigger.duration) || 0, 0) : 0;
  }
  return pattern;
};

const lastAtOrBefore = (segments, key, value) => {
  let low = 0;
  let high = segments.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (segments[mid][key] <= value) low = mid + 1;
    else high = mid;
  }
  return low - 1;
};

const valueIn = (segment, beat) => {
  if (segment.duration <= 0 || beat >= segment.beat + segment.duration) return segment.to;
  return segment.from + ((segment.to - segment.from) * (beat - segment.beat)) / segment.duration;
};

const areaIn = (segment, beat) => {
  const span = beat - segment.beat;
  if (segment.duration <= 0) return span * segment.to;
  if (span <= segment.duration) return (span * (segment.from + valueIn(segment, beat))) / 2;
  return (segment.duration * (segment.from + segment.to)) / 2 + (span - segment.duration) * segment.to;
};

const msIn = (segment, beat) => {
  const span = beat - segment.beat;
  if (segment.duration <= 0) return (span * 60000) / segment.to;
  const rampSpan = Math.min(span, segment.duration);
  const slope = (segment.to - segment.from) / segment.duration;
  const rampMs =
    slope == 0
      ? (rampSpan * 60000) / segment.from
      : (60000 / slope) * Math.log(valueIn(segment, segment.beat + rampSpan) / segment.from);
  return rampMs + (Math.max(span - segment.duration, 0) * 60000) / segment.to;
};

const beatIn = (segment, ms) => {
  const elapsed = ms - segment.ms;
  if (segment.duration > 0) {
    const rampMs = msIn(segment, segment.beat + segment.duration);
    if (elapsed < rampMs) {
      const slope = (segment.to - segment.from) / segment.duration;
      if (slope == 0) return segment.beat + (elapsed * segment.from) / 60000;
      return segment.beat + (segment.from * Math.expm1((elapsed * slope) / 60000)) / slope;
    }
    return segment.beat + segment.duration + ((elapsed - rampMs) * segment.to) / 60000;
  }
  return segment.beat + (elapsed * segment.to) / 60000;
};

const buildCurve = (triggers, value, base) => {
  const key = GRADUAL_TRIGGERS[value];
  const segments = [];
  for (const trigger of triggers) {
    if (trigger.value != value) continue;
    const previous = segments[segments.length - 1];
    segments.push({
      beat: trigger.beat,
      from: previous ? valueIn(previous, trigger.beat) : base,
      to: Number(trigger[key]),
      duration: Math.max(Number(trigger.duration) || 0, 0),
    });
  }
  return segments;
};

export class Timing {
  constructor(pattern) {
    const { information, triggers } = pattern;
    this.baseBpm = Number(information.bpm);
    this.baseSpeed = Number(information.speed);
    this.bpms = buildCurve(triggers, 2, this.baseBpm);
    this.opacities = buildCurve(triggers, 3, 1);
    this.speeds = buildCurve(triggers, 4, this.baseSpeed);

    let ms = 0;
    let previous = null;
    for (const segment of this.bpms) {
      ms += previous ? msIn(previous, segment.beat) : (segment.beat * 60000) / this.baseBpm;
      segment.ms = ms;
      previous = segment;
    }

    let area = 0;
    previous = null;
    for (const segment of this.speeds) {
      area += previous ? areaIn(previous, segment.beat) : segment.beat * this.baseSpeed;
      segment.area = area;
      previous = segment;
    }
  }

  static valueAt(segments, beat, base) {
    const i = lastAtOrBefore(segments, "beat", beat);
    return i < 0 ? base : valueIn(segments[i], beat);
  }

  bpmAt(beat) {
    return Timing.valueAt(this.bpms, beat, this.baseBpm);
  }

  opacityAt(beat) {
    return Timing.valueAt(this.opacities, beat, 1);
  }

  speedAt(beat) {
    return Timing.valueAt(this.speeds, beat, this.baseSpeed);
  }

  msAt(beat) {
    const i = lastAtOrBefore(this.bpms, "beat", beat);
    if (i < 0) return (beat * 60000) / this.baseBpm;
    return this.bpms[i].ms + msIn(this.bpms[i], beat);
  }

  beatAt(ms) {
    const i = lastAtOrBefore(this.bpms, "ms", ms);
    if (i < 0) return (ms * this.baseBpm) / 60000;
    return beatIn(this.bpms[i], ms);
  }

  areaAt(beat) {
    const i = lastAtOrBefore(this.speeds, "beat", beat);
    if (i < 0) return beat * this.baseSpeed;
    return this.speeds[i].area + areaIn(this.speeds[i], beat);
  }

  distance(fromBeat, toBeat) {
    return this.areaAt(toBeat) - this.areaAt(fromBeat);
  }
}
