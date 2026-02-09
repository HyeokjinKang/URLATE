/* global getSin, getCos, upperBound, lowerBound */
/**
 * update.js
 * 게임의 데이터 계산, 물리 연산, 수명 관리 등 핵심 로직을 담당합니다.
 */

// eslint-disable-next-line no-unused-vars
const Update = {
  /**
   * 총알의 현재 위치(x, y)와 각도를 계산합니다.
   * @param {object} bullet - 총알 데이터 객체
   * @param {number} currentBeat - 현재 곡의 비트(beats)
   * @param {Array} triggers - 트리거 배열 (변속 등을 계산하기 위함)
   * @param {number} baseSpeed - 곡의 기본 스피드
   * @returns {{x: number, y: number, angle: number}}
   */
  bulletPos: (bullet, currentBeat, triggers, baseSpeed) => {
    // 트리거 탐색 범위 설정
    let triggerEnd = upperBound(triggers, bullet.beat);
    let currentSpeed = baseSpeed;

    // 현재 총알 생성 시점의 스피드 확인
    for (let i = 0; i < triggerEnd; i++) {
      if (triggers[i].value == 4) {
        currentSpeed = triggers[i].speed;
      }
    }

    let triggerStart = lowerBound(triggers, bullet.beat);
    triggerEnd = upperBound(triggers, currentBeat);

    let p = 0;
    let prevBeat = bullet.beat;
    let prevSpeed = currentSpeed;

    // 적분(이동 거리 누적) 계산
    for (let j = triggerStart; j < triggerEnd; j++) {
      const trigger = triggers[j];
      if (trigger.value == 4) {
        p += ((trigger.beat - prevBeat) / (15 / prevSpeed / bullet.speed)) * 100;
        prevBeat = trigger.beat;
        prevSpeed = trigger.speed;
      }
    }

    // 남은 비트만큼 이동
    p += ((currentBeat - prevBeat) / (15 / prevSpeed / bullet.speed)) * 100;

    // 좌표 및 각도 산출
    const isLeft = bullet.direction == "L";
    const angle = isLeft ? bullet.angle : bullet.angle + 180;

    const x = (isLeft ? -100 : 100) + getCos(angle) * p;
    const y = bullet.location + getSin(angle) * p;

    return { x, y, angle };
  },

  /**
   * 노트의 현재 진행 상태(progress)를 계산합니다.
   * @param {object} note - 노트 데이터
   * @param {number} currentBeat - 현재 비트
   * @param {number} speed - 현재 속도 (배속)
   * @returns {{progress: number, tailProgress: number, endProgress: number}}
   */
  noteProgress: (note, currentBeat, speed) => {
    const renderDuration = 5 / speed;

    const progress = (1 - (note.beat - currentBeat) / renderDuration) * 100;

    const tailProgress = ((currentBeat - note.beat) / note.duration) * 100;

    const endProgress = (1 - (note.beat + note.duration - currentBeat) / renderDuration) * 100;

    return { progress, tailProgress, endProgress };
  },

  /**
   * 수명이 다한 파티클을 배열에서 제거합니다.
   * @param {Array} particles - 파티클 배열
   * @param {object} [hideSettings] - 판정 숨김 설정 (judgeParticles 관리시에만 필요)
   */
  particles: (particles, hideSettings = null) => {
    const now = Date.now();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (hideSettings && p.judge && hideSettings[p.judge]) {
        particles.splice(i, 1);
        continue;
      }

      if (now - p.createdAt >= p.lifeTime) {
        particles.splice(i, 1);
      }
    }
  },
};
