/**
 * renderer.js
 * 게임의 캔버스 드로잉을 담당합니다.
 */
import { Config, JudgeSkin, KeyInputColors } from "./constants.js";
import { getSin, getCos, hexadecimal, easeInQuad, easeOutQuad, easeOutQuart, numberWithCommas } from "./utils.js";

/** 데이터를 받아 Canvas Context(ctx)에 실제 렌더링을 수행합니다. */
export default class Renderer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} layout - { canvasW, canvasH }
   * @param {object} skin - 스킨 데이터
   */
  constructor(ctx, layout, skin) {
    this.ctx = ctx;
    this.canvasW = layout.canvasW;
    this.canvasH = layout.canvasH;
    this.skin = skin;

    // 렌더링 캐시
    this.cache = {
      bulletPath: null,
      lastCacheW: 0,
    };

    // 애니메이션 상태
    this.animState = {
      score: { current: 0, start: 0, target: 0, startTime: 0 },
      combo: { value: 0, startTime: 0 },
    };
  }

  /** 내부 헬퍼: 좌표 변환 */
  #getPos(x, y) {
    return {
      cx: (this.canvasW / 200) * (x + 100),
      cy: (this.canvasH / 200) * (y + 100),
    };
  }

  /** 내부 헬퍼: 스킨 데이터(Gradient/Color)를 분석하여 ctx의 fillStyle 또는 strokeStyle을 설정합니다. */
  #applyStyle(skinPart, x, y, size, opacity, isStroke = false) {
    const { ctx, canvasW } = this;
    let style;
    if (skinPart.type === "gradient") {
      const grd = ctx.createLinearGradient(x - size, y - size, x + size, y + size);
      for (let s = 0; s < skinPart.stops.length; s++) {
        grd.addColorStop(skinPart.stops[s].percentage / 100, hexadecimal(skinPart.stops[s].color, opacity));
      }
      style = grd;
    } else {
      style = hexadecimal(skinPart.color, opacity);
    }

    if (isStroke) {
      ctx.lineWidth = Math.round((canvasW / 1000) * skinPart.width);
      ctx.strokeStyle = style;
    } else ctx.fillStyle = style;
  }

  /** 화면 크기가 변경되었을 때 호출
   * @param {object} layout - { canvasW, canvasH }
   */
  setSize(layout) {
    this.canvasW = layout.canvasW;
    this.canvasH = layout.canvasH;

    // 화면 크기가 바뀌면 캐시 초기화
    if (this.canvasW !== this.cache.lastCacheW) {
      this.cache.bulletPath = null;
    }
  }

  /** 점수판 애니메이션 상태 초기화 */
  initialize() {
    this.animState = {
      score: { current: 0, start: 0, target: 0, startTime: 0 },
      combo: { value: 0, startTime: 0 },
    };
  }

  /**
   * 테두리가 있는 텍스트를 그립니다. (스타일 설정 후 호출 필요)
   * @param {string} text
   * @param {number} x
   * @param {number} y
   */
  outlinedText(text, x, y) {
    this.ctx.strokeText(text, x, y);
    this.ctx.fillText(text, x, y);
  }

  /**
   * 노트를 그립니다.
   * @param {object} note - { x, y, value, direction, debugIndex? }
   * @param {object} state - { globalAlpha, progress, tailProgress, endProgress, isGrabbed, isSelected? }
   */
  note(note, state) {
    const { ctx, canvasW, canvasH, skin } = this;
    const { x, y, value: type, direction } = note;
    const { globalAlpha, progress, tailProgress, endProgress, isGrabbed, isSelected } = state;

    // 종료된 노트는 그리지 않음
    if (type !== 2 && progress >= 130) return;
    if (type === 2 && endProgress >= 130) return;

    // 공통 변수 계산
    const { cx, cy } = this.#getPos(x, y);
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
      ctx.lineWidth = Math.round(canvasW / 300);

      if (note.debugIndex !== undefined) {
        ctx.textBaseline = "bottom";
        this.outlinedText(`Note_${note.debugIndex}`, 0, -1.2 * w);
      }
      ctx.textBaseline = "top";
      this.outlinedText(`(X: ${x}, Y: ${y})`, 0, 1.2 * w);

      ctx.fillStyle = hexadecimal("#ebd534", opacityVal);
      ctx.strokeStyle = hexadecimal("#ebd534", opacityVal);
    } else {
      this.#applyStyle(noteSkin, 0, 0, w, opacityVal, false);
      this.#applyStyle(noteSkin.indicator, 0, 0, w, opacityVal, true);
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
        this.#applyStyle(noteSkin.outline, 0, 0, w, opacityVal, true);
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
        this.#applyStyle(noteSkin.outline, 0, 0, w, opacityVal, true);
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
  }

  /**
   * 총알을 그립니다.
   * @param {object} bullet - { x, y, angle, location?, direction?, debugIndex? }
   * @param {object} state - { isSelected?, isHit? }
   */
  bullet(bullet, state = {}) {
    const { ctx, canvasW, canvasH, skin } = this;
    const { x, y, angle: realAngle } = bullet;
    const { isSelected, isHit } = state;

    const { cx, cy } = this.#getPos(x, y);
    const w = canvasW / 80;

    // 총알 캐시 검증 및 재생성
    if (this.cache.lastCacheW !== canvasW || !this.cache.bulletPath) {
      const path = new Path2D();
      path.arc(0, 0, w, 0.5 * Math.PI, 1.5 * Math.PI);
      path.lineTo(w * 2, 0);
      path.closePath();

      this.cache.bulletPath = path;
      this.cache.lastCacheW = canvasW;
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
        this.outlinedText(`Bullet_${bullet.debugIndex}`, cx, cy - 1.5 * w);
      }
      ctx.textBaseline = "top";
      this.outlinedText(`(Angle: ${bullet.direction === "L" ? realAngle : realAngle - 180})`, cx, cy + 1.5 * w);
      if (bullet.location !== undefined) {
        this.outlinedText(`(Loc: ${bullet.location})`, cx, cy + 1.5 * w + canvasH / 40);
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
      this.#applyStyle(skin.bullet, 0, 0, w, 100, false);
      if (skin.bullet.outline) {
        this.#applyStyle(skin.bullet.outline, 0, 0, w, 100, true);
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

    const path = this.cache.bulletPath;
    ctx.fill(path);

    ctx.restore();
  }

  /**
   * 트리거로 정의된 텍스트를 그립니다.
   * @param {object} textObj - pattern.trigger[i]
   */
  triggerText(textObj) {
    const { ctx, canvasH } = this;
    const { text, x, y, align, valign, size, weight } = textObj;

    ctx.save();
    ctx.fillStyle = "#fff";

    let fontSize;
    if (size.indexOf("vh") != -1) fontSize = (canvasH / 100) * Number(size.split("vh")[0]) + "px";
    else fontSize = size;

    ctx.font = `${weight} ${fontSize} Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
    ctx.textAlign = align;
    ctx.textBaseline = valign;

    const { cx, cy } = this.#getPos(x, y);
    ctx.fillText(text, cx, cy);

    ctx.restore();
  }

  /**
   * 마우스 커서를 그립니다.
   * @param {object} cursor - { x, y, zoom? }
   * @param {object} state - { isClicked?, clickedMs? }
   */
  cursor(cursor, state) {
    const { ctx, canvasW, skin } = this;
    const { x: mouseX, y: mouseY, zoom = 1 } = cursor;
    const { isClicked = false, clickedMs = -1 } = state;

    const { cx, cy } = this.#getPos(mouseX, mouseY);
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
    this.#applyStyle(skin.cursor, 0, 0, w, 100, false);
    if (skin.cursor.type === "gradient") ctx.shadowColor = hexadecimal(skin.cursor.stops[0].color, 50);
    else ctx.shadowColor = hexadecimal(skin.cursor.color, 50);

    if (skin.cursor.outline) {
      this.#applyStyle(skin.cursor.outline, 0, 0, w, 100, true);
      if (skin.cursor.outline.type === "gradient") ctx.shadowColor = hexadecimal(skin.cursor.outline.stops[0].color, 50);
      else ctx.shadowColor = hexadecimal(skin.cursor.outline.color, 50);
    }

    // 그리기
    ctx.beginPath();
    ctx.arc(0, 0, w, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = canvasW / 100;
    if (skin.cursor.outline) ctx.stroke();

    ctx.restore();
  }

  /**
   * 판정 텍스트를 그립니다.
   * @param {Array<object>} particles - 판정 파티클 배열
   */
  judges(particles) {
    const { ctx, canvasH, skin } = this;
    const now = Date.now();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const isJudgeSkin = p.judgeSkin;
      const judgeKey = p.judge.toLowerCase();
      const elapsed = now - p.createdAt;

      const progress = elapsed / p.lifeTime;
      const easeInProgress = easeInQuad(progress);
      const easeOutProgress = easeOutQuad(progress);

      const { cx, cy } = this.#getPos(p.x, p.y);

      const deg = judgeKey == "miss" ? Config.JUDGE_EFFECT.MISS_ANIM_ROTATE : 0;
      const animDeg = deg * easeOutProgress;

      const yAdder = judgeKey == "miss" ? Config.JUDGE_EFFECT.MISS_ANIM_Y_ADDER : Config.JUDGE_EFFECT.DEFAULT_ANIM_Y_ADDER;
      const animY = -1 * (canvasH / 1000) * yAdder * easeOutProgress;

      const opacity = Math.max(0, 100 - easeInProgress * 100);

      const skinPart = isJudgeSkin && skin.judges[judgeKey] ? skin.judges[judgeKey] : JudgeSkin[judgeKey];

      ctx.save();
      ctx.beginPath();
      ctx.translate(cx, cy + animY);
      ctx.rotate((Math.PI * animDeg) / 180);

      this.#applyStyle(skinPart, 0, 0, 50, opacity, false);

      ctx.font = `600 ${canvasH / 25}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.judge, 0, 0);

      ctx.restore();
    }
  }

  /**
   * 클릭 이펙트를 화면에 그립니다.
   * @param {Array<object>} particles
   */
  clickEffects(particles) {
    const { ctx, canvasW, skin } = this;
    const now = Date.now();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const elapsed = now - p.createdAt;
      const cursorConf = Config.CURSOR;

      const progress = elapsed / p.lifeTime;
      const easeInProgress = easeInQuad(progress);
      const easeOutProgress = easeOutQuad(progress);

      const { cx, cy } = this.#getPos(p.x, p.y);

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

      this.#applyStyle(styleTarget, cx, cy, width, opacity, true);
      ctx.lineWidth = lineWidth;

      ctx.arc(cx, cy, width, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.restore();
    }
  }

  /**
   * 폭발 파티클 목록을 업데이트하고 화면에 그립니다.
   * @param {Array<object>} particles
   */
  explosions(particles) {
    const { ctx, canvasW, canvasH } = this;
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
  }

  /**
   * FC / AP 이펙트를 그립니다.
   * @param {number} effectNum - 0: AP / 1 : FC
   * @param {number} effectMs - 이펙트 시작 시간
   */
  finalEffect(effectNum, effectMs) {
    const { ctx, canvasW, canvasH } = this;
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
  }

  /**
   * 키 입력 로그 오버레이를 그립니다.
   * @param {Array} keyInput - 키 입력 데이터 배열
   * @param {number} keyInputTime - 마지막 키 입력 시간
   */
  keyInputUI(keyInput, keyInputTime) {
    if (keyInput.length === 0) return;

    // 마지막 입력 후 4초 지났으면 그리지 않음
    if (keyInput[keyInput.length - 1].time + 4000 <= Date.now()) return;

    const { ctx, canvasW, canvasH } = this;
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
  }

  /**
   * 하단 진행도 바 (Progress Bar)를 그립니다.
   * @param {number} percentage - 진행도 (0 ~ 1)
   */
  progressBarUI(percentage) {
    const { ctx, canvasW, canvasH } = this;

    const rectX = canvasW / 2 - canvasW / 14;
    const rectY = canvasH - canvasH / 80 - canvasH / 200;
    const rectWidth = canvasW / 7;
    const rectHeight = canvasH / 200;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";

    ctx.beginPath();
    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
    ctx.fillRect(rectX, rectY, rectWidth * percentage, rectHeight);
    ctx.restore();
  }

  /**
   * 점수판 및 앨범아트 (Score Panel)을 그립니다.
   * @param {object} data - { score, combo, difficulty }
   * @param {HTMLImageElement} albumImg
   */
  scorePanelUI(data, albumImg) {
    const { ctx, canvasW, canvasH } = this;
    const { score, combo, difficulty } = data;
    const now = Date.now();

    // 1. 점수 애니메이션 계산
    const s = this.animState.score;

    // 실제 점수가 바뀌었으면 목표값 갱신
    if (score !== s.target) {
      s.start = s.current;
      s.target = score;
      s.startTime = now;
    }

    // 0.5초간 카운트 업 애니메이션
    const scoreElapsed = now - s.startTime;
    if (scoreElapsed < 500) {
      const progress = easeOutQuart(scoreElapsed / 500);
      s.current = s.start + (s.target - s.start) * progress;
    } else {
      s.current = s.target;
    }

    // 2. 콤보 애니메이션 계산
    const c = this.animState.combo;

    // 콤보가 증가했으면 팝업 효과 시작
    if (combo > c.value) {
      c.startTime = now;
    }
    c.value = combo;

    // 0.5초간 팝업 후 서서히 줄어듦
    const comboElapsed = now - c.startTime;
    let comboScale = 0;
    if (comboElapsed < 500) {
      comboScale = Math.max(0, 1 - easeOutQuart(comboElapsed / 500));
    }

    // 3. Rendering

    ctx.save();

    // (1) 배경 박스
    ctx.beginPath();

    if (difficulty === 0)
      ctx.fillStyle = "#31A97E"; // EZ
    else if (difficulty === 1)
      ctx.fillStyle = "#F0C21D"; // MID
    else if (difficulty === 2)
      ctx.fillStyle = "#FF774B"; // HARD
    else ctx.fillStyle = "#6021ff"; // TEST

    ctx.rect(canvasW * 0.92, canvasH * 0.05, canvasH / 15 + canvasW * 0.004, canvasH / 15 + canvasW * 0.004);
    ctx.fill();

    // (2) 흰색 테두리
    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.rect(canvasW * 0.92 - canvasW * 0.002, canvasH * 0.05 - canvasW * 0.002, canvasH / 15 + canvasW * 0.004, canvasH / 15 + canvasW * 0.004);
    ctx.fill();

    // (3) 앨범 아트
    if (albumImg) {
      ctx.drawImage(albumImg, canvasW * 0.92, canvasH * 0.05, canvasH / 15, canvasH / 15);
    }

    // (4) 점수 텍스트
    ctx.beginPath();
    ctx.font = `700 ${canvasH / 25}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";

    ctx.fillText(numberWithCommas(`${Math.round(s.current)}`.padStart(9, "0")), canvasW * 0.92 - canvasW * 0.01, canvasH * 0.05);

    // (5) 콤보 텍스트
    ctx.font = `${400 * (1 + comboScale * 0.5)} ${(canvasH / 40) * (1 + comboScale)}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
    ctx.fillStyle = "#fff";
    ctx.fillText(`${combo}x`, canvasW * 0.92 - canvasW * 0.01, canvasH * 0.05 + canvasH / 25);

    ctx.restore();
  }

  /**
   * 시스템 정보를 그립니다.
   * @param {object} info - { speed, bpm, fps }
   */
  systemInfoUI(info) {
    const { ctx, canvasW, canvasH } = this;
    const { speed, bpm, fps } = info;

    ctx.save();
    ctx.beginPath();

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${canvasH / 60}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
    ctx.textBaseline = "bottom";

    // Speed & BPM (좌측 하단)
    if (speed !== undefined && bpm !== undefined) {
      ctx.textAlign = "left";
      ctx.fillText(`Speed : ${speed}, BPM : ${bpm}`, canvasW / 100, canvasH - canvasH / 60);
    }

    // FPS (우측 하단)
    if (fps !== undefined) {
      ctx.textAlign = "right";
      ctx.fillText(fps, canvasW - canvasW / 100, canvasH - canvasH / 70);
    }

    ctx.restore();
  }

  /** 에디터용: 트리거 추가 안내 오버레이를 그립니다. */
  triggerAddOverlay() {
    const { ctx, canvasW, canvasH } = this;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.beginPath();
    ctx.fillStyle = "#FFF";
    ctx.strokeStyle = "#FFF";
    ctx.lineWidth = 2;

    const w = canvasW / 40;

    ctx.moveTo(canvasW / 2, canvasH / 2 - w);
    ctx.lineTo(canvasW / 2, canvasH / 2);
    ctx.moveTo(canvasW / 2 - w / 2, canvasH / 2 - w / 2);
    ctx.lineTo(canvasW / 2 + w / 2, canvasH / 2 - w / 2);
    ctx.stroke();

    ctx.font = `600 ${canvasH / 40}px Montserrat, Pretendard JP Variable, Pretendard JP, Pretendard`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Add trigger", canvasW / 2, canvasH / 2 + 10);
    ctx.restore();
  }

  /** 에디터용: 중앙 십자선을 그립니다. */
  axis() {
    const { ctx, canvasW, canvasH } = this;
    const tw = canvasW / 200;
    const th = canvasH / 200;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ed3a2680"; // 붉은색 강조
    ctx.beginPath();

    // 세로 중앙선
    ctx.moveTo(tw * 100, 0);
    ctx.lineTo(tw * 100, canvasH);
    // 가로 중앙선
    ctx.moveTo(0, th * 100);
    ctx.lineTo(canvasW, th * 100);

    ctx.stroke();
    ctx.restore();
  }

  /** 에디터용: 배경 모눈 격자(Mesh Grid)를 그립니다. */
  meshGrid() {
    const { ctx, canvasW, canvasH } = this;
    const tw = canvasW / 200;
    const th = canvasH / 200;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#bbbbbb20"; // 연한 회색
    ctx.beginPath();

    let x1 = 0,
      x2 = tw * 5,
      y = 0;

    // 화면 밖 여유분까지 루프
    for (let i = -100; i <= 100; i += 10) {
      // 세로선
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, canvasH);
      ctx.moveTo(x2, 0);
      ctx.lineTo(x2, canvasH);
      // 가로선
      ctx.moveTo(0, y);
      ctx.lineTo(canvasW, y);

      x1 += tw * 10;
      x2 += tw * 10;
      y += th * 10;
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 에디터용: 방사형 그리드(Radial Grid)를 그립니다.
   * @param {object} centerNote - pattern.patterns[i] (중심이 될 노트)
   */
  radialGrid(centerNote) {
    const { ctx, canvasW } = this;
    const { cx, cy } = this.#getPos(centerNote.x, centerNote.y);

    ctx.save();
    ctx.strokeStyle = "#88888850";
    ctx.lineWidth = 2;

    for (let i = 1; i <= 10; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (canvasW / 15) * i, 0, 2 * Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 에디터용: 노트 연결선을 그립니다.
   * @param {object} prevNote - { x, y }
   * @param {object} currNote - { x, y }
   * @param {number} alpha - 0 ~ 255
   */
  noteConnector(prevNote, currNote, alpha) {
    const { ctx } = this;
    const { cx: x1, cy: y1 } = this.#getPos(prevNote.x, prevNote.y);
    const { cx: x2, cy: y2 } = this.#getPos(currNote.x, currNote.y);

    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 3;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  /**
   * 에디터용: 지나간 노트의 그림자(잔상)를 그립니다.
   * @param {object} note - { x, y, value, direction }
   * @param {number} alpha - 투명도
   */
  noteShadow(note, alpha) {
    const { ctx, canvasW } = this;
    const { x, y, value, direction } = note;
    const { cx, cy } = this.#getPos(x, y);

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
  }
}
