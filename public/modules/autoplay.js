import Updater from "./updater.js";
import { lowerBound, upperBound } from "./utils.js";

const SAMPLE_MS = 8;
const HORIZON_MS = 3000;
const REPLAN_MS = 400;
const LEAD_MS = 35;
const REACTION_MS = 150;
const DIRECTIONS = 16;
const RINGS = 12;
const BENDS = [0, 0.2, -0.2, 0.45, -0.45, 0.8, -0.8];
const WAYPOINT_RADII = [3, 5, 8];
const WAYPOINT_ANGLES = 8;

const easeOut = (u) => 1 - (1 - u) ** 3;
const clampUnit = (v) => Math.max(-100, Math.min(100, v));
const clampPoint = (p) => ({ x: clampUnit(p.x), y: clampUnit(p.y) });

class Planner {
  constructor() {
    this.plan = null;
    this.last = null;
    this.timing = null;
    this.rate = 1;
    this.scale = { sx: 1, sy: 1, bulletRadius: 1, noteRadius: 2 };
  }

  reset() {
    this.plan = null;
    this.last = null;
  }

  setScale(scale) {
    this.scale = scale;
    this.plan = null;
  }

  hit() {
    this.plan = null;
  }

  inNote(point, note) {
    return this.#distSq(point, note) <= (this.scale.noteRadius * 0.9) ** 2;
  }

  move({ beats, timing, rate, cursor, target, due, bulletsAt }) {
    this.timing = timing;
    if ((Number(rate) || 1) != this.rate) {
      this.rate = Number(rate) || 1;
      this.plan = null;
    }
    const now = this.timing.msAt(beats);
    const moved = !this.last || this.#distSq(this.last, cursor) > 1;
    if (!this.plan || this.plan.target !== target || now >= this.plan.checkAt || moved) {
      this.plan = this.#makePlan(now, cursor, target, bulletsAt);
    }

    let point = this.plan.at(now);
    if (due && !this.inNote(point, target)) point = { x: target.x, y: target.y };
    point = this.#escape(point, bulletsAt(beats), due ? target : null);
    this.last = point;
    return point;
  }

  /* ---- Planning ---------------------------------------------------------- */

  #makePlan(now, cursor, target, bulletsAt) {
    const start = { x: cursor.x, y: cursor.y };
    const goal = target ? { x: target.x, y: target.y } : start;
    const end = target ? Math.max(this.timing.msAt(target.beat), now) : now + HORIZON_MS * this.rate;
    const horizon = Math.min(end, now + HORIZON_MS * this.rate);

    const times = [];
    for (let t = now; t < horizon; t += SAMPLE_MS * this.rate) times.push(t);
    times.push(horizon);
    const R = this.scale.bulletRadius;
    const margin = Math.max(Math.sqrt(this.#distSq(start, goal)) * 0.8, R * 8) + R * 4;
    const mx = margin / this.scale.sx;
    const my = margin / this.scale.sy;
    const minX = Math.min(start.x, goal.x) - mx;
    const maxX = Math.max(start.x, goal.x) + mx;
    const minY = Math.min(start.y, goal.y) - my;
    const maxY = Math.max(start.y, goal.y) + my;
    const bullets = times.map((t) =>
      bulletsAt(this.timing.beatAt(t)).filter((b) => b.x >= minX && b.x <= maxX && b.y >= minY && b.y <= maxY),
    );

    let best = null;
    for (const candidate of this.#candidates(start, goal, now, end)) {
      const result = this.#evaluate(candidate, times, bullets, best);
      if (result && this.#better(result, best)) best = result;
    }

    const checkAt =
      best.failAt != null
        ? Math.max(best.failAt - REPLAN_MS * this.rate, now + (REPLAN_MS / 2) * this.rate)
        : horizon < end || !target
          ? horizon - REPLAN_MS * this.rate
          : Infinity;
    return { target, at: best.path, checkAt };
  }

  #candidates(start, goal, now, end) {
    const list = [];
    const span = end - now;
    const lead = Math.min(LEAD_MS * this.rate, span * 0.3);
    const arrive = end - lead;
    const length = Math.sqrt(this.#distSq(start, goal));
    const reach = Math.max(length, this.scale.bulletRadius * 4);
    const base = this.#duration(start, goal);

    const react = Math.min(REACTION_MS * this.rate, span * 0.2);
    const room = Math.max(arrive - now - react, 0);
    const durations = [
      [room, 0],
      [Math.min(base * 1.5, room), 0.05],
      [Math.min(base, room), 0.1],
    ];
    for (const delay of [0, 0.25, 0.5, 1]) {
      for (const [d, pace] of durations) {
        const s = now + react + (room - d) * delay;
        for (const bend of BENDS) {
          list.push({
            path: this.#path(start, [[start, goal, s, s + d, bend * reach]]),
            penalty: Math.abs(bend) * 0.6 + delay * 0.4 + pace,
          });
        }
      }
    }

    const R = this.scale.bulletRadius;
    const waypoints = [];
    for (const center of [goal, start]) {
      for (const r of WAYPOINT_RADII) {
        for (let a = 0; a < WAYPOINT_ANGLES; a++) {
          const angle = (a / WAYPOINT_ANGLES) * Math.PI * 2;
          waypoints.push(
            clampPoint({
              x: center.x + (Math.cos(angle) * r * R) / this.scale.sx,
              y: center.y + (Math.sin(angle) * r * R) / this.scale.sy,
            }),
          );
        }
      }
    }

    for (const w of waypoints) {
      const d1 = this.#duration(start, w);
      const d2 = this.#duration(w, goal);
      const detour = (Math.sqrt(this.#distSq(start, w)) + Math.sqrt(this.#distSq(w, goal)) - length) / (R * 80);
      const room = arrive - now;
      const k = d1 + d2 > room ? room / (d1 + d2) : 1;
      const s2 = arrive - d2 * k;
      for (const leaveLate of [false, true]) {
        const s1 = leaveLate ? Math.max(now, s2 - d1 * k) : Math.min(now + REACTION_MS * this.rate, s2 - d1 * k);
        list.push({
          path: this.#path(start, [
            [start, w, s1, s1 + d1 * k, 0],
            [w, goal, s2, arrive, 0],
          ]),
          penalty: 0.8 + detour + (leaveLate ? 0 : 0.05),
        });
      }
    }
    return list;
  }

  #evaluate(candidate, times, bullets, best) {
    const R = this.scale.bulletRadius;
    const hardSq = (R * 1.3) ** 2;
    const safe = R * 3.5;
    const limit = best && best.failAt == null ? best.cost : Infinity;
    let cost = candidate.penalty;
    for (let i = 0; i < times.length; i++) {
      const d2 = this.#nearestSq(candidate.path(times[i]), bullets[i]);
      if (d2 <= hardSq) return { path: candidate.path, cost, failAt: times[i] };
      if (d2 < safe * safe) cost += ((safe - Math.sqrt(d2)) / safe) ** 2 * 0.05;
      if (cost >= limit) return null;
    }
    return { path: candidate.path, cost, failAt: null };
  }

  #better(a, b) {
    if (!b) return true;
    if ((a.failAt == null) != (b.failAt == null)) return a.failAt == null;
    if (a.failAt != null && a.failAt != b.failAt) return a.failAt > b.failAt;
    return a.cost < b.cost;
  }

  #duration(from, to) {
    const width = this.scale.bulletRadius * 80;
    const d = Math.sqrt(this.#distSq(from, to)) / width;
    return d < 0.002 ? 0 : (120 + 380 * Math.sqrt(d)) * this.rate;
  }

  #path(origin, legs) {
    const segments = legs.map(([from, to, start, end, bend]) => {
      const px = (to.x - from.x) * this.scale.sx;
      const py = (to.y - from.y) * this.scale.sy;
      const len = Math.hypot(px, py) || 1;
      return { from, to, start, end, nx: -py / len, ny: px / len, bend };
    });
    return (t) => {
      let p = origin;
      for (const s of segments) {
        if (t < s.start) return p;
        if (t < s.end) {
          const e = easeOut((t - s.start) / (s.end - s.start));
          const off = s.bend * Math.sin(Math.PI * e);
          return clampPoint({
            x: s.from.x + (s.to.x - s.from.x) * e + (s.nx * off) / this.scale.sx,
            y: s.from.y + (s.to.y - s.from.y) * e + (s.ny * off) / this.scale.sy,
          });
        }
        p = s.to;
      }
      return p;
    };
  }

  /* ---- Fallback ---------------------------------------------------------- */

  #escape(point, bullets, note) {
    const hardSq = (this.scale.bulletRadius * 1.15) ** 2;
    if (this.#nearestSq(point, bullets) > hardSq) return point;
    const limit = note ? this.scale.noteRadius * 0.9 : Infinity;
    const center = note ?? point;
    const step = this.scale.bulletRadius * 0.6;
    for (let ring = 1; ring <= RINGS; ring++) {
      if (ring * step > limit) break;
      for (let d = 0; d < DIRECTIONS; d++) {
        const angle = (d / DIRECTIONS) * Math.PI * 2;
        const p = clampPoint({
          x: center.x + (Math.cos(angle) * ring * step) / this.scale.sx,
          y: center.y + (Math.sin(angle) * ring * step) / this.scale.sy,
        });
        if (this.#nearestSq(p, bullets) > hardSq) return p;
      }
    }
    return point;
  }

  #distSq(a, b) {
    const dx = (a.x - b.x) * this.scale.sx;
    const dy = (a.y - b.y) * this.scale.sy;
    return dx * dx + dy * dy;
  }

  #nearestSq(point, list) {
    let min = Infinity;
    for (const b of list) {
      const d = this.#distSq(point, b);
      if (d < min) min = d;
    }
    return min;
  }
}

/* ---- Drivers ----------------------------------------------------------- */

const PREVIEW_JUMP_MS = 250;

const bulletsOf = (pattern, timing, destroyed) => (beats) => {
  const list = [];
  const end = upperBound(pattern.bullets, beats);
  for (let i = lowerBound(pattern.bullets, beats - 32); i < end; i++) {
    if (!destroyed.has(i)) list.push(Updater.bulletPos(pattern.bullets[i], beats, timing));
  }
  return list;
};

export const createGameAutoPlay = (game) => {
  const planner = new Planner();
  let holds = new Set();

  const targetAt = (beats) => {
    const { patterns } = game.pattern;
    for (let i = lowerBound(patterns, beats - game.noteMaxDuration); i < patterns.length; i++) {
      if (!game.destroyedNotes.has(i)) return i;
    }
    return -1;
  };

  const isDue = (beat, beats) => game.framesFrom(beat, beats) >= -0.5;

  return {
    setScale: (scale) => planner.setScale(scale),

    reset() {
      planner.reset();
      holds = new Set();
    },

    step(renderBeats, cursor) {
      const { pattern, timing } = game;
      const beats = game.calcBeats();

      for (const i of holds) {
        const note = pattern.patterns[i];
        if (!isDue(note.beat + note.duration, beats)) continue;
        holds.delete(i);
        game.release(i);
      }

      let i = targetAt(renderBeats);
      const position = planner.move({
        beats: renderBeats,
        timing,
        rate: game.rate,
        cursor,
        target: i < 0 ? null : pattern.patterns[i],
        due: i >= 0 && isDue(pattern.patterns[i].beat, beats),
        bulletsAt: bulletsOf(pattern, timing, game.destroyedBullets),
      });
      game.moveCursor(position);

      while (i >= 0 && isDue(pattern.patterns[i].beat, beats) && planner.inNote(position, pattern.patterns[i])) {
        planner.hit();
        if (pattern.patterns[i].value == 2) holds.add(i);
        game.press(i, beats);
        i = targetAt(renderBeats);
      }
    },
  };
};

export const createPreviewAutoPlay = () => {
  const planner = new Planner();
  let cursor = null;
  let next = 0;
  let lastMs = null;

  return {
    setScale: (scale) => planner.setScale(scale),

    reset() {
      planner.reset();
      cursor = null;
      lastMs = null;
    },

    step({ beats, pattern, timing, rate, destroyedBullets }) {
      const { patterns } = pattern;
      const target = upperBound(patterns, beats);
      const ms = timing.msAt(beats);
      const hits = [];
      const jumped = lastMs == null || ms < lastMs || ms - lastMs > PREVIEW_JUMP_MS * rate || target < next;
      if (jumped || !cursor) {
        planner.reset();
        const previous = patterns[target - 1];
        cursor = previous ? { x: previous.x, y: previous.y } : { x: 0, y: 0 };
      } else {
        for (let i = next; i < target; i++) hits.push(i);
        if (hits.length) planner.hit();
      }
      next = target;
      lastMs = ms;

      cursor = planner.move({
        beats,
        timing,
        rate,
        cursor,
        target: patterns[target] ?? null,
        due: false,
        bulletsAt: bulletsOf(pattern, timing, destroyedBullets),
      });
      return { cursor, hits };
    },
  };
};
