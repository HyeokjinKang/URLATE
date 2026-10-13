/**
 * updater.js
 * Core logic: data, physics and lifetime management.
 */
import { getSin, getCos } from "./utils.js";
import Factory from "./factory.js";

export default class Updater {
  /**
   * Current position (x, y) and angle of a bullet.
   * @param {object} bullet - bullet data
   * @param {number} currentBeat - the song's current beat
   * @param {Timing} timing - the pattern's timing, needed for the speed changes
   * @returns {{x: number, y: number, angle: number}}
   */
  static bulletPos(bullet, currentBeat, timing) {
    const p = (timing.distance(bullet.beat, currentBeat) * bullet.speed) / 0.15;

    const isLeft = bullet.direction == "L";
    const angle = isLeft ? bullet.angle : bullet.angle + 180;

    const x = (isLeft ? -100 : 100) + getCos(angle) * p;
    const y = bullet.location + getSin(angle) * p;

    return { x, y, angle };
  }

  /**
   * Progress of a note.
   * @param {object} note - note data
   * @param {number} currentBeat - the current beat
   * @param {number} speed - the current speed multiplier
   * @returns {{progress: number, tailProgress: number, endProgress: number}}
   */
  static noteProgress(note, currentBeat, speed, out) {
    const renderDuration = 5 / speed;
    const result = out ?? {};
    result.progress = (1 - (note.beat - currentBeat) / renderDuration) * 100;
    result.tailProgress = ((currentBeat - note.beat) / note.duration) * 100;
    result.endProgress = (1 - (note.beat + note.duration - currentBeat) / renderDuration) * 100;
    return result;
  }

  /**
   * Drop the particles that reached the end of their life and return them to the pool.
   * @param {Array} particles - the particles
   * @param {object} [hideSettings] - judgement hiding settings, only for judgeParticles
   */
  static particles(particles, hideSettings = null) {
    const now = Date.now();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      const shouldHide = hideSettings && p.judge && hideSettings[p.judge];
      const isExpired = now - p.createdAt >= p.lifeTime;

      if (shouldHide || isExpired) {
        Factory.recycle(p);
        particles.splice(i, 1);
      }
    }
  }
}
