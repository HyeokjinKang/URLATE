/**
 * draw.js
 * 게임의 캔버스 드로잉을 담당합니다.
 */

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
  NOTE: {
    WIDTH: 25,
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
  JUDGE_EFFECT: {
    LIFETIME: 500,
    DEFAULT_ANIM_Y_ADDER: 100,
    MISS_ANIM_Y_ADDER: -50,
    MISS_ANIM_ROTATE: 10,
  },
};

/** 기본 판정 스킨 */
const JudgeSkin = {
  perfect: {
    type: "gradient",
    stops: [
      { percentage: 0, color: "#90F482" },
      { percentage: 100, color: "#73AADD" },
    ],
  },
  great: { type: "color", color: "#73DFD2" },
  good: { type: "color", color: "#CCE97C" },
  bad: { type: "color", color: "#EDC77D" },
  miss: { type: "color", color: "#F96C5A" },
};

/** keyInput 오버레이 색상표 */
const KeyInputColors = {
  Perfect: "#57BEEB",
  Great: "#73DFD2",
  Good: "#CCE97C",
  Bad: "#EDC77D",
  Miss: "#F96C5A",
  Bullet: "#E8A0A0",
  Empty: "#00000000",
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

  /**
   * 판정 텍스트 이펙트 데이터를 생성합니다.
   * @param {number} x
   * @param {number} y
   * @param {boolean} judgeSkin - settings.game.judgeSkin
   * @param {string} judge
   */
  createJudge: (x, y, judgeSkin, judge) => ({
    x,
    y,
    judgeSkin,
    judge,
    createdAt: Date.now(),
    lifeTime: Config.JUDGE_EFFECT.LIFETIME,
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
    let w = (canvasW / 1000) * Config.NOTE.WIDTH;

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
   * @param {object} bullet - { x, y, angle, location?, direction?, debugIndex? }
   * @param {object} state - { isSelected?, isHit? }
   */
  bullet: (ctx, layout, skin, bullet, state = {}) => {
    const { canvasW, canvasH } = layout;
    const { x: gameX, y: gameY, angle: realAngle } = bullet;
    const { isSelected, isHit } = state;

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

    // visualAngle 계산
    const scaleX = canvasW / 200;
    const scaleY = canvasH / 200;
    const visualAngleRad = Math.atan2(getSin(realAngle) * scaleY, getCos(realAngle) * scaleX);
    const visualAngle = (visualAngleRad * 180) / Math.PI;

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
   * 판정 텍스트를 그립니다.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} layout - { canvasW, canvasH }
   * @param {object} skin - 유저 스킨
   * @param {Array<object>} particles - 판정 파티클 배열
   */
  judges: (ctx, layout, skin, particles) => {
    const { canvasW, canvasH } = layout;
    const now = Date.now();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const isJudgeSkin = p.judgeSkin;
      const judgeKey = p.judge.toLowerCase();
      const elapsed = now - p.createdAt;

      const progress = elapsed / p.lifeTime;
      const easeInProgress = easeInQuad(progress);
      const easeOutProgress = easeOutQuad(progress);

      const { cx, cy } = getCanvasPos(p.x, p.y, canvasW, canvasH);

      const deg = judgeKey == "miss" ? Config.JUDGE_EFFECT.MISS_ANIM_ROTATE : 0;
      const animDeg = deg * easeOutProgress;

      const yAdder = judgeKey == "miss" ? Config.JUDGE_EFFECT.MISS_ANIM_Y_ADDER : Config.JUDGE_EFFECT.DEFAULT_ANIM_Y_ADDER;
      const animY = -1 * (canvasH / 1000) * yAdder * easeOutProgress;

      const opacity = 100 - easeInProgress * 100;

      const skinPart = isJudgeSkin && skin[judgeKey] ? skin[judgeKey] : JudgeSkin[judgeKey];

      ctx.save();
      ctx.beginPath();
      ctx.translate(cx, cy + animY);
      ctx.rotate((Math.PI * animDeg) / 180);

      applyStyle(ctx, skinPart, 0, 0, 50, opacity, false);

      ctx.font = `600 ${canvasH / 25}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.judge, 0, 0);

      ctx.restore();
    }
  },

  /**
   * 클릭 이펙트를 화면에 그립니다.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} layout - { canvasW, canvasH }
   * @param {object} skin - 유저 스킨 설정값
   * @param {Array<object>} particles
   */
  clickEffects: (ctx, layout, skin, particles) => {
    const { canvasW, canvasH } = layout;
    const now = Date.now();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const elapsed = now - p.createdAt;
      const cursorConf = Config.CURSOR;

      const progress = elapsed / p.lifeTime;
      const easeInProgress = easeInQuad(progress);
      const easeOutProgress = easeOutQuad(progress);

      const { cx, cy } = getCanvasPos(p.x, p.y, canvasW, canvasH);

      let styleTarget, effectConf;

      if (p.type === "note") {
        effectConf = Config.NOTE_CLICK_EFFECT;
        styleTarget = skin.note[p.noteType] || skin.note[0];
      } else {
        effectConf = Config.CLICK_EFFECT;
        styleTarget = skin.cursor.outline ? skin.cursor.outline : skin.cursor;
      }

      const startW = (canvasW / 1000) * cursorConf.SIZE * p.zoom + (canvasW / 1000) * cursorConf.ANIM_SIZE_ADDER;
      const expandW = (canvasW / 1000) * effectConf.SIZE;
      const width = startW + expandW * easeOutProgress;
      const lineWidth = (1 - easeOutProgress) * ((canvasW / 1000) * effectConf.LINE_WIDTH);
      const opacity = effectConf.OPACITY - easeInProgress * effectConf.OPACITY;

      if (lineWidth <= 0 || opacity <= 0 || width <= 0) continue;

      ctx.save();
      ctx.beginPath();

      applyStyle(ctx, styleTarget, cx, cy, width, opacity, true);
      ctx.lineWidth = lineWidth;

      ctx.arc(cx, cy, width, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.restore();
    }
  },

  /**
   * 폭발 파티클 목록을 업데이트하고 화면에 그립니다.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {Array<object>} particles
   */
  explosions: (ctx, canvasW, canvasH, particles) => {
    const now = Date.now();
    const conf = Config.EXPLODE_EFFECT;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const elapsed = now - p.createdAt;

      const progress = Math.min(1, elapsed / p.lifeTime);
      const easeVal = easeOutQuart(progress);

      const currentX = p.startX + p.dx * easeVal;
      const currentY = p.startY + p.dy * easeVal;

      const cx = (canvasW / 200) * (currentX + 100);
      const cy = (canvasH / 200) * (currentY + 100);

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

  /**
   * 키 입력 로그 오버레이를 그립니다.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} layout - { canvasW, canvasH }
   * @param {Array} keyInput - 키 입력 데이터 배열
   * @param {number} keyInputTime - 마지막 키 입력 시간
   */
  keyInput: (ctx, layout, keyInput, keyInputTime) => {
    if (keyInput.length === 0) return;

    // 마지막 입력 후 4초 지났으면 그리지 않음
    if (keyInput[keyInput.length - 1].time + 4000 <= Date.now()) return;

    const { canvasW, canvasH } = layout;
    const now = Date.now();

    // 마지막 입력 후 3초 뒤 페이드 아웃
    let alpha = 1;
    if (keyInput[keyInput.length - 1].time + 3000 <= now) {
      alpha = 1 - (now - keyInput[keyInput.length - 1].time - 3000) / 1000;
      if (alpha <= 0) return;
    }

    // 새 입력 발생 시 밀려나는 애니메이션
    let animDuration = 0;
    let animX = 0;
    if (keyInputTime + 100 >= now) {
      animDuration = 1 - easeOutQuart((now - keyInputTime) / 100);
      animX = animDuration * (canvasW / 100 + canvasW / 200);
    }

    for (let i = keyInput.length - 1; i >= 0; i--) {
      let j = i - keyInput.length + 13;
      let partAlpha = alpha;

      // 등장 애니메이션 (투명도)
      if (j < 8) {
        partAlpha *= (1 / 8) * (j + animDuration);
      }

      ctx.save();
      ctx.globalAlpha = partAlpha;

      const judge = keyInput[i].judge;
      let color = KeyInputColors[judge];

      // 박스 그리기
      const boxX = canvasW * 0.08 - canvasH / 15 + (keyInput.length - i - 1) * (canvasW / 100 + canvasW / 200) - animX;
      const boxY = canvasH * 0.05;
      const boxSize = canvasW / 100;

      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = canvasW / 800;

      ctx.roundRect(boxX, boxY, boxSize, boxSize, [canvasW / 700]);
      ctx.fill();
      ctx.stroke();

      // 텍스트 그리기
      ctx.beginPath();
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${canvasH / 40}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
      ctx.textBaseline = "top";
      ctx.textAlign = "center";

      const textX = boxX + canvasW / 200;
      const textY = boxY + boxSize + canvasH / 200;

      ctx.fillText(keyInput[i].key[0], textX, textY);

      ctx.restore();
    }
  },

  /**
   * FC / AP 이펙트를 그립니다.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} layout - { canvasW, canvasH }
   * @param {number} effectNum - 0: AP / 1 : FC
   * @param {number} effectMs - 이펙트 시작 시간
   */
  finalEffect: (ctx, layout, effectNum, effectMs) => {
    const { canvasW, canvasH } = layout;
    const duration = 2000;
    const now = Date.now();

    const text = effectNum == 0 ? "ALL PERFECT" : "FULL COMBO";
    const p = easeOutQuart(Math.min(1, (now - effectMs) / duration));

    const baseAlpha = Math.max(0, Math.min((now - effectMs) / 200, Math.min(1, (effectMs + duration - 500 - now) / 500)));

    ctx.save();

    // 1. 배경에 흐르는 텍스트 (화면 모서리 양 끝)
    ctx.globalAlpha = baseAlpha;
    ctx.font = `800 ${canvasH / 5}px Montserrat`;

    // Top Left
    let effectStartX = (-1 * canvasW) / 5;
    let effectFinalX = -1 * (canvasW / 20);
    let effectX = effectStartX + (effectFinalX - effectStartX) * p;
    let effectY = -1 * (canvasH / 20);

    let grd = ctx.createLinearGradient(effectX, effectY, effectX, effectY + canvasH / 5);
    grd.addColorStop(0, `rgba(255, 255, 255, 0.2)`);
    grd.addColorStop(1, `rgba(255, 255, 255, 0)`);
    ctx.fillStyle = grd;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(text, effectX, effectY);

    // Bottom Right
    effectStartX = canvasW + canvasW / 5;
    effectFinalX = canvasW + canvasW / 20;
    effectX = effectStartX + (effectFinalX - effectStartX) * p;
    effectY = canvasH + canvasH / 20;

    grd = ctx.createLinearGradient(effectX, effectY - canvasH / 5, effectX, effectY);
    grd.addColorStop(0, `rgba(255, 255, 255, 0.2)`);
    grd.addColorStop(1, `rgba(255, 255, 255, 0)`);
    ctx.fillStyle = grd;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(text, effectX, effectY);

    // 2. 메인 중앙 텍스트
    let mainTextX = canvasW / 2;
    let mainTextY = canvasH / 2;

    let mainTextSizeStart = canvasH / 5;
    let mainTextSizeFinal = canvasH / 7;
    let outlineTextSizeStart = canvasH / 4;
    let outlineTextSizeFinal = canvasH / 5;
    let mainTextSize = mainTextSizeStart + (mainTextSizeFinal - mainTextSizeStart) * p;
    let outlineTextSize = outlineTextSizeStart + (outlineTextSizeFinal - outlineTextSizeStart) * p;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";

    let strokeStyle;
    if (effectNum == 0) {
      // All Perfect: Gradient
      let g = ctx.createLinearGradient(mainTextX, mainTextY - outlineTextSize / 2, mainTextX, mainTextY + outlineTextSize / 2);
      g.addColorStop(0, "#f581ff");
      g.addColorStop(0.5, "#77B6F4");
      g.addColorStop(1, "#43DDA6");
      strokeStyle = g;
    } else {
      // Full Combo: Gold
      strokeStyle = "#F0C21D";
    }

    // Outline Stroke
    ctx.globalAlpha = baseAlpha / 3;
    ctx.strokeStyle = strokeStyle;
    ctx.font = `800 ${outlineTextSize}px Montserrat`;
    ctx.lineWidth = canvasH / 200;
    ctx.strokeText(text, mainTextX, mainTextY);

    // Clearing Inside
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#FFF";
    ctx.fillText(text, mainTextX, mainTextY);
    ctx.globalCompositeOperation = "source-over";

    // Main Stroke
    ctx.globalAlpha = baseAlpha;
    ctx.strokeStyle = strokeStyle;
    ctx.font = `800 ${mainTextSize}px Montserrat`;
    ctx.lineWidth = canvasH / 100;
    ctx.strokeText(text, mainTextX, mainTextY);

    // Clearing Inside
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillText(text, mainTextX, mainTextY);
    ctx.globalCompositeOperation = "source-over";

    // Main Fill
    ctx.globalAlpha = baseAlpha;
    ctx.fillStyle = "#FFF";
    ctx.fillText(text, mainTextX, mainTextY);

    ctx.restore();
  },

  /**
   * 에디터용: 노트 연결선을 그립니다.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} layout - { canvasW, canvasH }
   * @param {object} prevNote - { x, y }
   * @param {object} currNote - { x, y }
   * @param {number} alpha - 0 ~ 255
   */
  noteConnector: (ctx, layout, prevNote, currNote, alpha) => {
    const { canvasW, canvasH } = layout;
    const { cx: x1, cy: y1 } = getCanvasPos(prevNote.x, prevNote.y, canvasW, canvasH);
    const { cx: x2, cy: y2 } = getCanvasPos(currNote.x, currNote.y, canvasW, canvasH);

    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 3;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  },

  /**
   * 에디터용: 지나간 노트의 그림자(잔상)를 그립니다.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} layout
   * @param {object} note - { x, y, value, direction }
   * @param {number} alpha - 투명도
   */
  noteShadow: (ctx, layout, note, alpha) => {
    const { canvasW, canvasH } = layout;
    const { x, y, value, direction } = note;
    const { cx, cy } = getCanvasPos(x, y, canvasW, canvasH);

    let w = (canvasW / 1000) * Config.NOTE.WIDTH;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;

    // Type 0: Circle, Type 2: Hold
    if (value !== 1) {
      ctx.beginPath();
      ctx.arc(0, 0, w, 0, 2 * Math.PI);
      ctx.fill();
    }
    // Type 1: Arrow Note
    else {
      w = w * 0.9;
      const { PI_5, COS_36, SIN_36 } = Config.MATH;

      ctx.scale(direction, direction);

      ctx.beginPath();

      const tipX = w * COS_36;
      const tipY = -w * SIN_36;
      const tailY = -1.5 * w;

      ctx.moveTo(0, tailY);
      ctx.lineTo(tipX, tipY);
      ctx.arc(0, 0, w, -PI_5, PI_5 * 6);
      ctx.lineTo(0, tailY);

      ctx.fill();
    }

    ctx.restore();
  },
};
