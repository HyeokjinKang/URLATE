/**
 * @namespace Config
 * @description 게임 내 이펙트 및 렌더링 관련 상수/설정값을 관리합니다.
 */
const Config = {
  DESTROY: {
    /** @type {number} 폭발 파티클 생성 개수 */
    COUNT: 3,
    /** @type {number} 폭발 파티클 이동 속도 */
    SPEED: 1.5,
    /** @type {number} 폭발 파티클 생존 시간 (ms) */
    LIFETIME: 200,
    /** @type {number} 폭발 파티클 크기 계수 */
    SIZE: 1,
  },
};

/**
 * @namespace Factory
 * @description 캔버스에 그려질 게임 오브젝트(파티클, 노트 등)의 순수 데이터를 생성합니다.
 */
const Factory = {
  /**
   * 폭발 효과를 위한 파티클 데이터 배열을 생성합니다.
   * @param {number} x - 폭발이 발생할 중심 X 좌표
   * @param {number} y - 폭발이 발생할 중심 Y 좌표
   * @param {object} skinData - 유저 스킨 데이터
   * @returns {Array<object>} 생성된 파티클 객체들의 배열
   */
  createExplosion: (x, y, skinData) => {
    const particles = [];
    const conf = Config.DESTROY;

    for (let i = 0; i < conf.COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;

      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * conf.SPEED,
        vy: Math.sin(angle) * conf.SPEED,
        createdAt: Date.now(),
        lifeTime: conf.LIFETIME,
        skin: skinData,
      });
    }

    return particles;
  },
};

/**
 * @namespace Draw
 * @description 데이터를 받아 Canvas Context(ctx)에 실제 렌더링을 수행합니다.
 */
const Draw = {
  /**
   * 폭발 파티클 목록을 업데이트하고 화면에 그립니다.
   * @param {CanvasRenderingContext2D} ctx - 렌더링할 캔버스 컨텍스트
   * @param {number} canvasW - 캔버스 전체 너비
   * @param {number} canvasH - 캔버스 전체 높이
   * @param {Array<object>} targetArray - 관리할 파티클 배열
   */
  explosions: (ctx, canvasW, canvasH, targetArray) => {
    const now = Date.now();
    const conf = Config.DESTROY;

    for (let i = targetArray.length - 1; i >= 0; i--) {
      const p = targetArray[i];
      const elapsed = now - p.createdAt;

      if (elapsed >= p.lifeTime) {
        targetArray.splice(i, 1);
        continue;
      }

      p.x += p.vx;
      p.y += p.vy;

      const cx = (canvasW / 200) * (p.x + 100);
      const cy = (canvasH / 200) * (p.y + 100);
      const progress = elapsed / p.lifeTime;
      const size = (canvasW / 100) * conf.SIZE * (1 - progress);

      if (size <= 0) continue;

      ctx.save();
      ctx.beginPath();

      const skin = p.skin;

      if (skin.type === "gradient") {
        const grd = ctx.createLinearGradient(cx - size, cy - size, cx + size, cy + size);
        for (let s = 0; s < skin.stops.length; s++) {
          grd.addColorStop(skin.stops[s].percentage / 100, `#${skin.stops[s].color}`);
        }
        ctx.fillStyle = grd;
      } else {
        ctx.fillStyle = `#${skin.color}`;
      }

      ctx.arc(cx, cy, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },
};
