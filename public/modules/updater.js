import { getSin, getCos } from "./utils.js";
import Factory from "./factory.js";

export default class Updater {
  static bulletPos(bullet, currentBeat, timing) {
    const p = (timing.distance(bullet.beat, currentBeat) * bullet.speed) / 0.15;

    const isLeft = bullet.direction == "L";
    const angle = isLeft ? bullet.angle : bullet.angle + 180;

    const x = (isLeft ? -100 : 100) + getCos(angle) * p;
    const y = bullet.location + getSin(angle) * p;

    return { x, y, angle };
  }

  static noteProgress(note, currentBeat, speed, out) {
    const renderDuration = 5 / speed;
    const result = out ?? {};
    result.progress = (1 - (note.beat - currentBeat) / renderDuration) * 100;
    result.tailProgress = ((currentBeat - note.beat) / note.duration) * 100;
    result.endProgress = (1 - (note.beat + note.duration - currentBeat) / renderDuration) * 100;
    return result;
  }

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
