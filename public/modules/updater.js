/**
 * updater.js
 * Core logic: data, physics and lifetime management.
 */
import { getSin, getCos, upperBound, lowerBound } from "./utils.js";
import Factory from "./factory.js";

export default class Updater {
  /**
   * Current position (x, y) and angle of a bullet.
   * @param {object} bullet - bullet data
   * @param {number} currentBeat - the song's current beat
   * @param {Array} triggers - triggers, needed for the speed changes
   * @param {number} baseSpeed - the song's base speed
   * @returns {{x: number, y: number, angle: number}}
   */
  static bulletPos(bullet, currentBeat, triggers, baseSpeed, creationSpeed = null) {
    let currentSpeed;
    let triggerStart;
    let triggerEnd;

    if (creationSpeed !== null) {
      // The caller already worked out the speed at spawn time, so skip the first search
      currentSpeed = creationSpeed;
      triggerStart = lowerBound(triggers, bullet.beat);
      triggerEnd = upperBound(triggers, currentBeat);
    } else {
      // Fallback: work out the speed at spawn time the old way
      triggerEnd = upperBound(triggers, bullet.beat);
      currentSpeed = baseSpeed;
      for (let i = 0; i < triggerEnd; i++) {
        if (triggers[i].value == 4) currentSpeed = triggers[i].speed;
      }
      triggerStart = lowerBound(triggers, bullet.beat);
      triggerEnd = upperBound(triggers, currentBeat);
    }

    let p = 0;
    let prevBeat = bullet.beat;
    let prevSpeed = currentSpeed;

    for (let j = triggerStart; j < triggerEnd; j++) {
      const trigger = triggers[j];
      if (trigger.value == 4) {
        // distance = time * speed, counted in beats
        p += ((trigger.beat - prevBeat) * prevSpeed * bullet.speed) / 0.15;
        prevBeat = trigger.beat;
        prevSpeed = trigger.speed;
      }
    }

    // Remaining distance up to the current beat
    p += ((currentBeat - prevBeat) * prevSpeed * bullet.speed) / 0.15;

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
