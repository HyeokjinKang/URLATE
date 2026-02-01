/** 게임 내 이펙트 및 렌더링 관련 상수/설정값을 관리합니다. */
const Config = {
  EXPLODE_EFFECT: {
    COUNT: 3,
    SPEED: 1.5,
    LIFETIME: 200,
    SIZE: 1,
  },
};

/**
 * 게임 좌표(-100 ~ 100)를 캔버스 실제 좌표(px)로 변환합니다.
 * @returns {{cx: number, cy: number}} 변환된 캔버스 좌표
 */
const getCanvasPos = (x, y, canvasW, canvasH) => {
  return {
    cx: (canvasW / 200) * (x + 100),
    cy: (canvasH / 200) * (y + 100),
  };
};

/** 스킨 데이터(Gradient/Color)를 분석하여 ctx의 fillStyle 또는 strokeStyle을 설정합니다. */
const applyStyle = (ctx, skinPart, x, y, size, opacityHex, isStroke = false) => {
  let style;
  if (skinPart.type === "gradient") {
    const grd = ctx.createLinearGradient(x - size, y - size, x + size, y + size);
    for (let s = 0; s < skinPart.stops.length; s++) {
      grd.addColorStop(skinPart.stops[s].percentage / 100, `#${skinPart.stops[s].color}${opacityHex}`);
    }
    style = grd;
  } else {
    style = `#${skinPart.color}${opacityHex}`;
  }

  if (isStroke) ctx.strokeStyle = style;
  else ctx.fillStyle = style;
};

/** 캔버스에 그려질 게임 오브젝트(파티클, 노트 등)의 순수 데이터를 생성합니다. */
const Factory = {
  /**
   * 폭발 효과를 위한 파티클 데이터 배열을 생성합니다.
   * @returns {Array<object>} 생성된 파티클 객체들의 배열
   */
  createExplosion: (x, y, skin) => {
    const particles = [];
    const conf = Config.EXPLODE_EFFECT;

    for (let i = 0; i < conf.COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;

      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * conf.SPEED,
        vy: Math.sin(angle) * conf.SPEED,
        createdAt: Date.now(),
        lifeTime: conf.LIFETIME,
        skin: skin,
      });
    }

    return particles;
  },
};

/** 데이터를 받아 Canvas Context(ctx)에 실제 렌더링을 수행합니다. */
const Draw = {
  /**
   * 테두리가 있는 텍스트를 그립니다.
   * @param {CanvasRenderingContext2D} ctx의
   * @param {string} text
   * @param {number} x
   * @param {number} y
   */
  outlinedText: (ctx, text, x, y) => {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  },

  /**
   * 폭발 파티클 목록을 업데이트하고 화면에 그립니다.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {Array<object>} targetArray
   */
  explosions: (ctx, canvasW, canvasH, targetArray) => {
    const now = Date.now();
    const conf = Config.EXPLODE_EFFECT;

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
        const grd = ctx.createLinearGradient(cx - size, cy - size, size, size);
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

  /**
   * 노트를 그립니다.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} layout - { canvasW, canvasH, globalAlpha }
   * @param {object} skin - 유저 스킨 설정값
   * @param {object} note - { x, y, value, direction, debugIndex? }
   * @param {object} state - { progress, tailProgress, endProgress, isGrabbed, isSelected? }
   */
  note: (ctx, layout, skin, note, state) => {
    const { canvasW, canvasH, globalAlpha } = layout;
    const { x: gameX, y: gameY, value: type, direction } = note;
    const { progress, tailProgress, endProgress, isGrabbed, isSelected } = state;

    // 종료된 노트는 그리지 않음
    if (type !== 2 && progress >= 130) return;
    if (type === 2 && endProgress >= 130) return;

    // 공통 변수 계산
    const { cx, cy } = getCanvasPos(gameX, gameY, canvasW, canvasH);
    const safeP = Math.max(progress, 0);
    let w = canvasW / 40;

    // 투명도 계산
    let opacityVal = 255;
    if (type !== 2 && safeP >= 100) {
      opacityVal = Math.max(Math.round((255 / 30) * (130 - safeP)), 0);
    } else if (type === 2) {
      if (safeP >= 100 && tailProgress >= 100 && isGrabbed) {
        opacityVal = Math.max(Math.round((255 / 30) * (130 - endProgress)), 0);
      } else if (safeP >= 100 && !isGrabbed) {
        opacityVal = Math.max(Math.round((255 / 30) * (130 - safeP)), 0);
      }
    }
    const opacityHex = opacityVal.toString(16).padStart(2, "0");
    const noteSkin = skin.note[type] || skin.note[0];

    // 그리기 시작
    ctx.save();
    ctx.translate(cx, cy); // 원점을 노트 중심으로 이동

    const lineWidth = Math.round(canvasW / 300);
    const outlineWidth = noteSkin.outline ? Math.round((canvasW / 1000) * noteSkin.outline.width) : 0;

    ctx.lineWidth = lineWidth;

    if (isSelected) {
      ctx.beginPath();
      ctx.font = `600 ${canvasH / 40}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
      ctx.fillStyle = "#000";
      ctx.strokeStyle = "#fff";
      ctx.textAlign = "center";

      if (note.debugIndex !== undefined) {
        ctx.textBaseline = "bottom";
        Draw.outlinedText(ctx, `Note_${note.debugIndex}`, 0, -1.2 * w);
      }
      ctx.textBaseline = "top";
      Draw.outlinedText(ctx, `(X: ${gameX}, Y: ${gameY})`, 0, 1.2 * w);

      ctx.fillStyle = `#ebd534${opacityHex}`;
      ctx.strokeStyle = `#ebd534${opacityHex}`;
    } else {
      applyStyle(ctx, noteSkin, 0, 0, w, opacityHex, false);
      applyStyle(ctx, noteSkin, 0, 0, w, opacityHex, true);
    }

    // Type 0: Circle Note (일반)
    if (type === 0) {
      // 테두리
      ctx.beginPath();
      ctx.arc(0, 0, w, 1.5 * Math.PI, 1.5 * Math.PI + (safeP / 50) * Math.PI);
      ctx.stroke();

      // 내부 채우기
      ctx.beginPath();
      ctx.arc(0, 0, (w / 100) * safeP, 0, 2 * Math.PI);
      ctx.fill();

      // 아웃라인
      if (noteSkin.outline) {
        applyStyle(ctx, noteSkin.outline, 0, 0, w, opacityHex, true);
        ctx.lineWidth = outlineWidth;
        ctx.stroke();
      }

      // 중앙 틴트
      ctx.beginPath();
      ctx.globalAlpha = ((0.2 * Math.min(safeP * 2, 100)) / 100) * globalAlpha;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.arc(0, 0, w, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Type 1: Arrow Note (플릭)
    else if (type === 1) {
      w = w * 0.9;
      const d = direction; // 1 or -1

      // 애니메이션 단계 (0~20, 20~80, 80~100 구간별 진행도)
      let parr = [safeP <= 20 ? safeP * 5 : 100, safeP >= 20 ? (safeP <= 80 ? (safeP - 20) * 1.66 : 100) : 0, safeP >= 80 ? (safeP <= 100 ? (safeP - 80) * 5 : 100) : 0];

      const cosVal = Math.cos(Math.PI / 5); // 36도
      const sinVal = Math.sin(Math.PI / 5);

      ctx.beginPath();

      // [Path 1] 꼬리 -> 왼쪽 날개
      // 시작점: (0, -1.5dw) -> 여기서 d가 곱해지므로 방향에 따라 위/아래가 바뀜
      let originalValue = [0, -1.5 * d * w];

      // 이동 벡터 계산
      let moveValue = [originalValue[0] - w * cosVal * d, originalValue[1] + w * sinVal * d];

      ctx.moveTo(originalValue[0], originalValue[1]);
      ctx.lineTo(originalValue[0] - (moveValue[0] / 100) * parr[0], originalValue[1] - (moveValue[1] / 100) * parr[0]);
      ctx.moveTo(originalValue[0] - moveValue[0], originalValue[1] - moveValue[1]);

      // [Path 2] 화살표 머리 (Arc)
      if (d === 1) {
        ctx.arc(0, 0, w, -Math.PI / 5, (((Math.PI / 5) * 7) / 100) * parr[1] - Math.PI / 5);
      } else {
        ctx.arc(0, 0, w, (-Math.PI / 5) * 6, (((Math.PI / 5) * 7) / 100) * parr[1] - (Math.PI / 5) * 6);
      }

      // [Path 3] 오른쪽 날개 -> 꼬리 복귀
      originalValue = [-w * cosVal * d, -w * sinVal * d];
      moveValue = [originalValue[0], originalValue[1] - -1.5 * d * w];

      ctx.moveTo(originalValue[0], originalValue[1]);
      ctx.lineTo(originalValue[0] - (moveValue[0] / 100) * parr[2], originalValue[1] - (moveValue[1] / 100) * parr[2]);
      ctx.stroke();

      // [Fill] 내부 채우기 (판정선에 가까울수록 차오름)
      ctx.beginPath();
      // 중심축을 따라 내려오는 선
      ctx.moveTo(0, 0 - 1.5 * d * (w / 100) * safeP);
      if (d === 1) ctx.arc(0, 0, (w / 100) * safeP, -Math.PI / 5, (Math.PI / 5) * 6);
      else ctx.arc(0, 0, (w / 100) * safeP, (-Math.PI / 5) * 6, Math.PI / 5);
      // 다시 중심축으로 돌아감
      ctx.lineTo(0, 0 - 1.5 * d * (w / 100) * safeP);
      ctx.fill();

      // 아웃라인
      if (noteSkin.outline) {
        applyStyle(ctx, noteSkin.outline, 0, 0, w, opacityHex, true);
        ctx.lineWidth = Math.round((canvasW / 1000) * noteSkin.outline.width);
        ctx.stroke();
      }

      // 틴트 (중앙 입체감)
      ctx.beginPath();
      ctx.globalAlpha = ((0.2 * Math.min(safeP * 2, 100)) / 100) * globalAlpha;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.moveTo(0, -1.5 * d * w);
      if (d === 1) ctx.arc(0, 0, w, -Math.PI / 5, (Math.PI / 5) * 6);
      else ctx.arc(0, 0, w, (-Math.PI / 5) * 6, Math.PI / 5);
      ctx.lineTo(0, -1.5 * d * w);
      ctx.fill();
      ctx.globalAlpha = globalAlpha;
    }

    // Type 2: Hold Note (홀드)
    else if (type === 2) {
      if (noteSkin.outline) {
        applyStyle(ctx, noteSkin.outline, 0, 0, w, opacityHex, true);
        ctx.lineWidth = outlineWidth;
      }

      ctx.beginPath();
      if (safeP <= 100) {
        // 생성 중
        ctx.arc(0, 0, w, 1.5 * Math.PI, 1.5 * Math.PI + (safeP / 50) * Math.PI);
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, w, 1.5 * Math.PI, 1.5 * Math.PI + (safeP / 50) * Math.PI);
        ctx.stroke();
      } else if (!isGrabbed) {
        // 놓침 (전체)
        ctx.arc(0, 0, w, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (tailProgress <= 100) {
        // 잡는 중 (줄어듬)
        ctx.arc(0, 0, w, 1.5 * Math.PI + (tailProgress / 50) * Math.PI, 1.5 * Math.PI);
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, w, 0, 2 * Math.PI);
        ctx.stroke();
      } else {
        // 완료
        ctx.arc(0, 0, w, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // 틴트
      ctx.globalAlpha = ((0.2 * Math.min(safeP * 2, 100)) / 100) * globalAlpha;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.arc(0, 0, w, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = globalAlpha;
  },
};
