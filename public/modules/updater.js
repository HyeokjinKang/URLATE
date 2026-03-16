/**
 * updater.js
 * 게임의 데이터 계산, 물리 연산, 수명 관리 등 핵심 로직을 담당합니다.
 */
import { getSin, getCos, upperBound, lowerBound } from "./utils.js";
import Factory from "./factory.js";

export default class Updater {
  /**
   * 총알의 현재 위치(x, y)와 각도를 계산합니다.
   * @param {object} bullet - 총알 데이터 객체
   * @param {number} currentBeat - 현재 곡의 비트(beats)
   * @param {Array} triggers - 트리거 배열 (변속 등을 계산하기 위함)
   * @param {number} baseSpeed - 곡의 기본 스피드
   * @returns {{x: number, y: number, angle: number}}
   */
  static bulletPos(bullet, currentBeat, triggers, baseSpeed, creationSpeed = null) {
    let currentSpeed;
    let triggerStart;
    let triggerEnd;

    if (creationSpeed !== null) {
      // 호출자가 생성 시점 속도를 미리 계산해서 전달 — 첫 번째 탐색 생략
      currentSpeed = creationSpeed;
      triggerStart = lowerBound(triggers, bullet.beat);
      triggerEnd = upperBound(triggers, currentBeat);
    } else {
      // 폴백: 기존 방식으로 생성 시점 속도 계산
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

    // 변속 구간 누적 계산
    for (let j = triggerStart; j < triggerEnd; j++) {
      const trigger = triggers[j];
      if (trigger.value == 4) {
        // (거리 = 시간 * 속도) 개념의 비트 기반 계산
        p += ((trigger.beat - prevBeat) * prevSpeed * bullet.speed) / 0.15;
        prevBeat = trigger.beat;
        prevSpeed = trigger.speed;
      }
    }

    // 현재 비트까지의 남은 거리 추가
    p += ((currentBeat - prevBeat) * prevSpeed * bullet.speed) / 0.15;

    const isLeft = bullet.direction == "L";
    const angle = isLeft ? bullet.angle : bullet.angle + 180;

    const x = (isLeft ? -100 : 100) + getCos(angle) * p;
    const y = bullet.location + getSin(angle) * p;

    return { x, y, angle };
  }

  /**
   * 노트의 현재 진행 상태(progress)를 계산합니다.
   * @param {object} note - 노트 데이터
   * @param {number} currentBeat - 현재 비트
   * @param {number} speed - 현재 속도 (배속)
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
   * 수명이 다한 파티클을 배열에서 제거하고 풀로 반환합니다.
   * @param {Array} particles - 파티클 배열
   * @param {object} [hideSettings] - 판정 숨김 설정 (judgeParticles 관리시에만 필요)
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
