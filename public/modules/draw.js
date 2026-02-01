/** 게임 내 이펙트 및 렌더링 관련 상수/설정값을 관리합니다. */
const Config = {
  MATH: {
    PI_5: Math.PI / 5,
    COS_36: Math.cos(Math.PI / 5),
    SIN_36: Math.sin(Math.PI / 5),
  },
  EXPLODE_EFFECT: {
    COUNT: 3,
    SPEED: 30,
    LIFETIME: 1000,
    SIZE: 1,
  },
};

/**
 * 렌더링 성능 최적화를 위해 Path2D 객체 등을 저장합니다.
 */
const RenderCache = {
  bullet: {
    path: null,
    lastCanvasW: 0,
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
      const distance = conf.SPEED * (0.8 + Math.random() * 0.4);

      particles.push({
        startX: x,
        startY: y,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
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
   * @param {CanvasRenderingContext2D} ctx
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

      const progress = Math.min(1, elapsed / p.lifeTime);
      const easeVal = easeOutQuart(progress);

      p.x = p.startX + p.dx * easeVal;
      p.y = p.startY + p.dy * easeVal;

      const cx = (canvasW / 200) * (p.x + 100);
      const cy = (canvasH / 200) * (p.y + 100);

      const size = (canvasW / 100) * conf.SIZE * (1 - easeVal);

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

      // 타이밍 인디케이터
      ctx.beginPath();
      ctx.arc(0, 0, (w / 100) * safeP, 0, 2 * Math.PI);
      ctx.fill();

      // 아웃라인
      if (noteSkin.outline) {
        applyStyle(ctx, noteSkin.outline, 0, 0, w, opacityHex, true);
        ctx.lineWidth = outlineWidth;
        ctx.stroke();
      }

      // 틴트
      ctx.beginPath();
      ctx.globalAlpha = ((0.2 * Math.min(safeP * 2, 100)) / 100) * globalAlpha;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.arc(0, 0, w, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Type 1: Arrow Note (플릭)
    else if (type === 1) {
      w = w * 0.9;

      // 애니메이션 단계 (0~20, 20~80, 80~100 구간별 진행도)
      const p1 = safeP <= 20 ? safeP * 5 : 100;
      const p2 = safeP > 20 ? Math.min((safeP - 20) * 1.66, 100) : 0;
      const p3 = safeP > 80 ? Math.min((safeP - 80) * 5, 100) : 0;

      const { PI_5, COS_36, SIN_36 } = Config.MATH;

      // direction에 따라 캔버스 변형
      ctx.save();
      ctx.scale(direction, direction);

      ctx.beginPath();

      // 날개 끝이자 원의 접점
      const tipX = w * COS_36;
      const tipY = -w * SIN_36;
      const tailY = -1.5 * w; // 뾰족한 부분

      // [Path 1] Tail(0, tailY) -> Right Tip(tipX, tipY)
      const dx1 = tipX;
      const dy1 = tipY - tailY;

      ctx.moveTo(0, tailY);
      ctx.lineTo((dx1 / 100) * p1, tailY + (dy1 / 100) * p1);

      // [Path 2] Arc (시계방향)
      if (p2 > 0) {
        const arcLen = ((PI_5 * 7) / 100) * p2;
        ctx.arc(0, 0, w, -PI_5, -PI_5 + arcLen);
      }

      // [Path 3] Left Tip(-tipX, tipY) -> Tail(0, tailY)
      if (p3 > 0) {
        const dx3 = tipX;
        const dy3 = tailY - tipY;

        ctx.lineTo(-tipX + (dx3 / 100) * p3, tipY + (dy3 / 100) * p3);
      }
      ctx.stroke();

      // 타이밍 인디케이터
      ctx.beginPath();
      ctx.moveTo(0, -1.5 * (w / 100) * safeP); // 중심축
      ctx.arc(0, 0, (w / 100) * safeP, -PI_5, PI_5 * 6);
      ctx.lineTo(0, -1.5 * (w / 100) * safeP);
      ctx.fill();

      // 아웃라인
      if (noteSkin.outline) {
        applyStyle(ctx, noteSkin.outline, 0, 0, w, opacityHex, true);
        ctx.lineWidth = Math.round((canvasW / 1000) * noteSkin.outline.width);
        ctx.stroke();
      }

      // 틴트
      ctx.beginPath();
      ctx.globalAlpha = ((0.2 * Math.min(safeP * 2, 100)) / 100) * globalAlpha;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.moveTo(0, -1.5 * w);
      ctx.arc(0, 0, w, -PI_5, PI_5 * 6);
      ctx.lineTo(0, -1.5 * w);
      ctx.fill();

      ctx.restore();
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
        // 놓침
        ctx.arc(0, 0, w, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (tailProgress <= 100) {
        // 잡는 중
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

  /**
   * 총알을 그립니다.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} layout - { canvasW, canvasH }
   * @param {object} skin - 유저 스킨 설정값
   * @param {object} bullet - { x, y, angle?, location?, direction?, debugIndex? }
   * @param {object} state - { visualAngle, isSelected?, isHit? }
   */
  bullet: (ctx, layout, skin, bullet, state) => {
    const { canvasW, canvasH } = layout;
    const { x: gameX, y: gameY, angle: realAngle } = bullet;
    const { visualAngle, isSelected, isHit } = state;

    const { cx, cy } = getCanvasPos(gameX, gameY, canvasW, canvasH);
    const w = canvasW / 80;

    // 총알 캐시 검증 및 재생성
    if (RenderCache.bullet.lastCanvasW !== canvasW || !RenderCache.bullet.path) {
      const path = new Path2D();
      path.arc(0, 0, w, 0.5 * Math.PI, 1.5 * Math.PI);
      path.lineTo(w * 2, 0);
      path.closePath();

      RenderCache.bullet.path = path;
      RenderCache.bullet.lastCanvasW = canvasW;
    }

    // (에디터용) 선택된 객체
    if (isSelected) {
      ctx.beginPath();
      ctx.font = `600 ${canvasH / 40}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
      ctx.fillStyle = "#000";
      ctx.strokeStyle = "#fff";
      ctx.textAlign = bullet.direction === "L" ? "left" : "right";
      ctx.lineWidth = Math.round(canvasW / 300);

      if (bullet.debugIndex !== undefined) {
        ctx.textBaseline = "bottom";
        Draw.outlinedText(ctx, `Bullet_${bullet.debugIndex}`, cx, cy - 1.5 * w);
      }
      ctx.textBaseline = "top";
      Draw.outlinedText(ctx, `(Angle: ${bullet.direction === "L" ? realAngle : realAngle - 180})`, cx, cy + 1.5 * w);
      if (bullet.location !== undefined) {
        Draw.outlinedText(ctx, `(Loc: ${bullet.location})`, cx, cy + 1.5 * w + canvasH / 40);
      }

      ctx.fillStyle = `#ebd534`;
      ctx.strokeStyle = `#ebd534`;
    }
    // (에디터용) 피격된 개체
    else if (isHit) {
      ctx.fillStyle = "#fb4934";
      ctx.strokeStyle = "#fb4934";
    }
    // 스킨 적용
    else {
      if (skin.bullet.type === "gradient") {
        const grd = ctx.createLinearGradient(cx - w, cy - w, cx + w, cy + w);
        for (let i = 0; i < skin.bullet.stops.length; i++) {
          grd.addColorStop(skin.bullet.stops[i].percentage / 100, `#${skin.bullet.stops[i].color}`);
        }
        ctx.fillStyle = grd;
        ctx.strokeStyle = grd;
      } else {
        ctx.fillStyle = `#${skin.bullet.color}`;
        ctx.strokeStyle = `#${skin.bullet.color}`;
      }

      if (skin.bullet.outline) {
        ctx.lineWidth = Math.round((canvasW / 1000) * skin.bullet.outline.width);
        if (skin.bullet.outline.type === "gradient") {
          const grd = ctx.createLinearGradient(-w, -w, w, w); // 회전된 상태라 좌표 주의
          for (let i = 0; i < skin.bullet.outline.stops.length; i++) {
            grd.addColorStop(skin.bullet.outline.stops[i].percentage / 100, `#${skin.bullet.outline.stops[i].color}`);
          }
          ctx.strokeStyle = grd;
        } else {
          ctx.strokeStyle = `#${skin.bullet.outline.color}`;
        }
        ctx.stroke(path);
      }
    }

    // 그리기 시작
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((visualAngle * Math.PI) / 180);

    const path = RenderCache.bullet.path;
    ctx.fill(path);

    ctx.restore();
  },
};
