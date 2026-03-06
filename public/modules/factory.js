/**
 * factory.js
 * 게임 오브젝트 생성을 담당합니다.
 */
import { Config } from "./constants.js";

// 오브젝트 풀 정의
const EXPLOSION_POOL = [];
const CLICK_POOL = [];
const JUDGE_POOL = [];

/** 캔버스에 그려질 게임 오브젝트(파티클, 노트 등)의 순수 데이터를 생성합니다. */
export default class Factory {
  /**
   * 폭발 효과를 위한 파티클 데이터 배열을 생성합니다.
   * @returns {Array<object>} 생성된 파티클 객체들의 배열
   */
  static createExplosions(x, y) {
    const particles = [];
    const conf = Config.EXPLODE_EFFECT;
    const now = Date.now();

    for (let i = 0; i < conf.COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = conf.SPEED * (0.8 + Math.random() * 0.4);

      // 풀에서 가져오거나 새로 생성
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
   * 기본 클릭 이펙트를 위한 데이터를 생성합니다.
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
   * 노트 클릭 이펙트를 위한 데이터를 생성합니다.
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
   * 판정 텍스트 이펙트 데이터를 생성합니다.
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
   * 수명이 다한 객체를 풀로 반환합니다.
   */
  static recycle(p) {
    if (!p) return;
    if (p.type === "explosion") EXPLOSION_POOL.push(p);
    else if (p.type === "judge") JUDGE_POOL.push(p);
    else CLICK_POOL.push(p);
  }
}
