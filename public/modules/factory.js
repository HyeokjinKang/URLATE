/**
 * factory.js
 * 게임 오브젝트 생성을 담당합니다.
 */
import { Config } from "./constants.js";

/** 캔버스에 그려질 게임 오브젝트(파티클, 노트 등)의 순수 데이터를 생성합니다. */
export default class Factory {
  /**
   * 폭발 효과를 위한 파티클 데이터 배열을 생성합니다.
   * @returns {Array<object>} 생성된 파티클 객체들의 배열
   */
  static createExplosions(x, y) {
    const particles = [];
    const conf = Config.EXPLODE_EFFECT;

    for (let i = 0; i < conf.COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = conf.SPEED * (0.8 + Math.random() * 0.4);

      particles.push({
        startX: x,
        startY: y,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        createdAt: Date.now(),
        lifeTime: conf.LIFETIME,
      });
    }

    return particles;
  }

  /**
   * 기본 클릭 이펙트를 위한 데이터를 생성합니다.
   * @returns { object }
   */
  static createClickDefault(x, y) {
    return {
      type: "default",
      x,
      y,
      createdAt: Date.now(),
      lifeTime: Config.CLICK_EFFECT.LIFETIME,
    };
  }

  /**
   * 노트 클릭 이펙트를 위한 데이터를 생성합니다.
   * @returns { object }
   */
  static createClickNote(x, y, noteType) {
    return {
      type: "note",
      x,
      y,
      noteType,
      createdAt: Date.now(),
      lifeTime: Config.NOTE_CLICK_EFFECT.LIFETIME,
    };
  }

  /**
   * 판정 텍스트 이펙트 데이터를 생성합니다.
   * @param {number} x
   * @param {number} y
   * @param {boolean} judgeSkin - settings.game.judgeSkin
   * @param {string} judge
   */
  static createJudge(x, y, judgeSkin, judge) {
    return {
      x,
      y,
      judgeSkin,
      judge,
      createdAt: Date.now(),
      lifeTime: Config.JUDGE_EFFECT.LIFETIME,
    };
  }
}
