/**
 * factory.js
 * Creates game objects.
 */
import { Config } from "./constants.js";

const EXPLOSION_POOL = [];
const CLICK_POOL = [];
const JUDGE_POOL = [];

/** Builds the plain data for the game objects (particles, notes, ...) drawn on the canvas. */
export default class Factory {
  /**
   * Build the particle data for an explosion effect.
   * @returns {Array<object>} the particle objects
   */
  static createExplosions(x, y) {
    const particles = [];
    const conf = Config.EXPLODE_EFFECT;
    const now = Date.now();

    for (let i = 0; i < conf.COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = conf.SPEED * (0.8 + Math.random() * 0.4);

      const p = EXPLOSION_POOL.pop() || {};
      p.startX = x;
      p.startY = y;
      p.dx = Math.cos(angle) * distance;
      p.dy = Math.sin(angle) * distance;
      p.createdAt = now;
      p.lifeTime = conf.LIFETIME;
      p.type = "explosion";

      particles.push(p);
    }

    return particles;
  }

  /**
   * Build the data for the default click effect.
   * @returns { object }
   */
  static createClickDefault(x, y) {
    const p = CLICK_POOL.pop() || {};
    p.type = "default";
    p.x = x;
    p.y = y;
    p.createdAt = Date.now();
    p.lifeTime = Config.CLICK_EFFECT.LIFETIME;
    return p;
  }

  /**
   * Build the data for the note click effect.
   * @returns { object }
   */
  static createClickNote(x, y, noteType) {
    const p = CLICK_POOL.pop() || {};
    p.type = "note";
    p.x = x;
    p.y = y;
    p.noteType = noteType;
    p.createdAt = Date.now();
    p.lifeTime = Config.NOTE_CLICK_EFFECT.LIFETIME;
    return p;
  }

  /**
   * Build the data for the judgement text effect.
   * @param {number} x
   * @param {number} y
   * @param {boolean} judgeSkin - settings.game.judgeSkin
   * @param {string} judge
   */
  static createJudge(x, y, judgeSkin, judge) {
    const p = JUDGE_POOL.pop() || {};
    p.x = x;
    p.y = y;
    p.judgeSkin = judgeSkin;
    p.judge = judge;
    p.createdAt = Date.now();
    p.lifeTime = Config.JUDGE_EFFECT.LIFETIME;
    p.type = "judge";
    return p;
  }

  /**
   * Return an object that reached the end of its life to the pool.
   */
  static recycle(p) {
    if (!p) return;
    if (p.type === "explosion") EXPLOSION_POOL.push(p);
    else if (p.type === "judge") JUDGE_POOL.push(p);
    else if (p.type === "default" || p.type === "note") CLICK_POOL.push(p);
    else console.warn("Attempted to recycle unknown object type:", p.type);
  }
}
