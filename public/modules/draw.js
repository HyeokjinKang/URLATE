/** 게임 내 이펙트 및 렌더링 관련 상수/설정값을 관리합니다. */
const Config = {
  MATH: {
    PI_5: Math.PI / 5,
    COS_36: Math.cos(Math.PI / 5),
    SIN_36: Math.sin(Math.PI / 5),
  },
  CURSOR: {
    SIZE: 100 / 7,
    ANIM_SIZE_ADDER: 5 / 2,
    RELEASE_ANIM_LENGTH: 100,
  },
  EXPLODE_EFFECT: {
    COUNT: 3,
    SPEED: 30,
    LIFETIME: 1000,
    SIZE: 6,
  },
  CLICK_EFFECT: {
    LIFETIME: 500,
    SIZE: 30,
    LINE_WIDTH: 10,
    OPACITY: 20,
  },
  NOTE_CLICK_EFFECT: {
    LIFETIME: 800,
    SIZE: 40,
    LINE_WIDTH: 15,
    OPACITY: 100,
  },
  JUDGE_TEXT_EFFECT: {
    LIFETIME: 700,
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
const applyStyle = (ctx, skinPart, x, y, size, opacity, isStroke = false) => {
  let style;
  if (skinPart.type === "gradient") {
    const grd = ctx.createLinearGradient(x - size, y - size, x + size, y + size);
    for (let s = 0; s < skinPart.stops.length; s++) {
      grd.addColorStop(skinPart.stops[s].percentage / 100, hexadecimal(skinPart.stops[s].color)(opacity));
    }
    style = grd;
  } else {
    style = hexadecimal(skinPart.color)(opacity);
  }

  if (isStroke) {
    ctx.lineWidth = Math.round((canvasW / 1000) * skinPart.width);
    ctx.strokeStyle = style;
  } else ctx.fillStyle = style;
};

/** 캔버스에 그려질 게임 오브젝트(파티클, 노트 등)의 순수 데이터를 생성합니다. */
const Factory = {
  /**
   * 폭발 효과를 위한 파티클 데이터 배열을 생성합니다.
   * @returns {Array<object>} 생성된 파티클 객체들의 배열
   */
  createExplosions: (x, y, skin) => {
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
        skin,
      });
    }

    return particles;
  },

  /**
   * 기본 클릭 이펙트를 위한 데이터를 생성합니다.
   * @returns { object }
   */
  createClickDefault: (x, y, zoom) => ({
    type: "default",
    x,
    y,
    zoom,
    createdAt: Date.now(),
    lifeTime: Config.CLICK_EFFECT.LIFETIME,
  }),

  /**
   * 노트 클릭 이펙트를 위한 데이터를 생성합니다.
   * @returns { object }
   */
  createClickNote: (x, y, zoom, noteType) => ({
    type: "note",
    x,
    y,
    zoom,
    noteType,
    createdAt: Date.now(),
    lifeTime: Config.NOTE_CLICK_EFFECT.LIFETIME,
  }),
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
    let opacityVal = 100;
    if (type !== 2 && safeP >= 100) {
      opacityVal = Math.max(130 - safeP, 0) * (10 / 3);
    } else if (type === 2) {
      if (safeP >= 100 && tailProgress >= 100 && isGrabbed) {
        opacityVal = Math.max(130 - endProgress, 0) * (10 / 3);
      } else if (safeP >= 100 && !isGrabbed) {
        opacityVal = Math.max(130 - safeP, 0) * (10 / 3);
      }
    }
    const noteSkin = skin.note[type] || skin.note[0];

    // 그리기 시작
    ctx.save();
    ctx.translate(cx, cy);

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

      ctx.fillStyle = hexadecimal("#ebd534")(opacityVal);
      ctx.strokeStyle = hexadecimal("#ebd534")(opacityVal);
    } else {
      applyStyle(ctx, noteSkin, 0, 0, w, opacityVal, false);
      applyStyle(ctx, noteSkin.indicator, 0, 0, w, opacityVal, true);
    }

    // Type 0: Circle Note (일반)
    if (type === 0) {
      // 타이밍 인디케이터
      ctx.beginPath();
      ctx.arc(0, 0, w, 1.5 * Math.PI, 1.5 * Math.PI + (safeP / 50) * Math.PI);
      ctx.stroke();

      // 안쪽 채우기
      ctx.beginPath();
      ctx.arc(0, 0, (w / 100) * safeP, 0, 2 * Math.PI);
      ctx.fill();
      if (noteSkin.outline) {
        applyStyle(ctx, noteSkin.outline, 0, 0, w, opacityVal, true);
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

      // 안쪽 채우기
      ctx.beginPath();
      ctx.moveTo(0, -1.5 * (w / 100) * safeP); // 중심축
      ctx.arc(0, 0, (w / 100) * safeP, -PI_5, PI_5 * 6);
      ctx.lineTo(0, -1.5 * (w / 100) * safeP);
      ctx.fill();
      if (noteSkin.outline) {
        applyStyle(ctx, noteSkin.outline, 0, 0, w, opacityVal, true);
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

      ctx.fillStyle = "#ebd534";
      ctx.strokeStyle = "#ebd534";
    }
    // (에디터용) 피격된 개체
    else if (isHit) {
      ctx.fillStyle = "#fb4934";
      ctx.strokeStyle = "#fb4934";
    }
    // 스킨 적용
    else {
      applyStyle(ctx, skin.bullet, 0, 0, w, 100, false);
      if (skin.bullet.outline) {
        applyStyle(ctx, skin.bullet.outline, 0, 0, w, 100, true);
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

  /**
   * 마우스 커서를 그립니다.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} layout - { canvasW, canvasH }
   * @param {object} skin - 유저 스킨 설정값
   * @param {object} cursor - { x, y, zoom? }
   * @param {object} state - { isClicked?, clickedMs? }
   */
  cursor: (ctx, layout, skin, cursor, state) => {
    const { canvasW, canvasH } = layout;
    const { x: mouseX, y: mouseY, zoom = 1 } = cursor;
    const { isClicked = false, clickedMs = -1 } = state;

    const { cx, cy } = getCanvasPos(mouseX, mouseY, canvasW, canvasH);
    const conf = Config.CURSOR;

    // 기본 크기 계산
    let w = (canvasW / 1000) * conf.SIZE * zoom;

    // 클릭 애니메이션
    if (clickedMs !== undefined && clickedMs !== -1) {
      const now = Date.now();
      if (isClicked) {
        // 클릭하면 살짝 커짐
        w = w + (canvasW / 1000) * conf.ANIM_SIZE_ADDER;
      } else {
        // 클릭을 풀면 서서히 복귀
        if (now < clickedMs + conf.RELEASE_ANIM_LENGTH) {
          const progress = (clickedMs + conf.RELEASE_ANIM_LENGTH - now) / conf.RELEASE_ANIM_LENGTH;
          w = w + (canvasW / 1000) * conf.ANIM_SIZE_ADDER * progress;
        }
      }
    }

    ctx.save();
    ctx.translate(cx, cy);

    // 스킨 적용
    applyStyle(ctx, skin.cursor, 0, 0, w, 100, false);
    if (skin.cursor.type === "gradient") ctx.shadowColor = hexadecimal(skin.cursor.stops[0].color)(50);
    else ctx.shadowColor = hexadecimal(skin.cursor.color)(50);

    if (skin.cursor.outline) {
      applyStyle(ctx, skin.cursor.outline, 0, 0, w, 100, true);
      if (skin.cursor.outline.type === "gradient") ctx.shadowColor = hexadecimal(skin.cursor.outline.stops[0].color)(50);
      else ctx.shadowColor = hexadecimal(skin.cursor.outline.color)(50);
    }

    // 그리기
    ctx.beginPath();
    ctx.arc(0, 0, w, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = canvasW / 100;
    if (skin.cursor.outline) ctx.stroke();

    ctx.restore();
  },

  /**
   * 클릭 이펙트를 화면에 그립니다.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} layout - { canvasW, canvasH }
   * @param {object} skin - 유저 스킨 설정값
   * @param {object} particles
   */
  clickEffects: (ctx, layout, skin, particles) => {
    const { canvasW, canvasH } = layout;
    const now = Date.now();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const elapsed = now - p.createdAt;
      const cursorConf = Config.CURSOR;

      if (elapsed >= p.lifeTime) {
        particles.splice(i, 1);
        continue;
      }

      const progress = elapsed / p.lifeTime;
      const easeInProgress = easeInQuad(progress);
      const easeOutProgress = easeOutQuad(progress);

      const { cx, cy } = getCanvasPos(p.x, p.y, canvasW, canvasH);

      let width, lineWidth, opacity, styleTarget, effectConf;

      if (p.type === "note") {
        effectConf = Config.NOTE_CLICK_EFFECT;
        styleTarget = skin.note[p.noteType] || skin.note[0];
      } else {
        effectConf = Config.CLICK_EFFECT;
        styleTarget = skin.cursor.outline ? skin.cursor.outline : skin.cursor;
      }
      const startW = (canvasW / 1000) * cursorConf.SIZE * p.zoom + (canvasW / 1000) * cursorConf.ANIM_SIZE_ADDER;
      const expandW = (canvasW / 1000) * effectConf.SIZE;

      width = startW + expandW * easeOutProgress;
      lineWidth = (1 - easeOutProgress) * ((canvasW / 1000) * effectConf.LINE_WIDTH);
      opacity = effectConf.OPACITY - easeInProgress * effectConf.OPACITY;

      if (lineWidth > 0 && opacity > 0) {
        ctx.save();
        ctx.beginPath();
        applyStyle(ctx, styleTarget, cx, cy, width, opacity, true);
        ctx.lineWidth = lineWidth;
        ctx.arc(cx, cy, width, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
      }
    }
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

      const size = (canvasW / 1000) * conf.SIZE * (1 - easeVal);

      if (size <= 0) continue;

      ctx.save();
      ctx.beginPath();

      const skin = p.skin;

      if (skin.type === "gradient") {
        const grd = ctx.createLinearGradient(cx - size, cy - size, size, size);
        for (let s = 0; s < skin.stops.length; s++) {
          grd.addColorStop(skin.stops[s].percentage / 100, skin.stops[s].color);
        }
        ctx.fillStyle = grd;
      } else {
        ctx.fillStyle = skin.color;
      }

      ctx.arc(cx, cy, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },
};
