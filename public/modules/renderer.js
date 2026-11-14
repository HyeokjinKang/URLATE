import { Config, JudgeSkin, KeyInputColors, DiffColors, TimingColors } from "./constants.js";
import {
  getSin,
  getCos,
  hexadecimal,
  easeInQuad,
  easeOutCubic,
  easeOutQuad,
  easeOutQuart,
  easeOutSine,
  numberWithCommas,
} from "./utils.js";

export default class Renderer {
  constructor(ctx, layout, skin) {
    this.ctx = ctx;
    this.canvasW = layout.canvasW;
    this.canvasH = layout.canvasH;
    this.cursorZoom = layout.cursorZoom ?? 1;
    this.skin = skin;

    this.cache = {
      bulletPath: null,
      lastCacheW: 0,
      gradient: new Map(),
      finalEffect: new Map(),
      comboAlert: null,
      cursor: new Map(),
      judgeWidths: new Map(),
    };

    this.animState = {
      score: { current: 0, start: 0, target: 0, startTime: 0 },
      combo: { value: 0, startTime: 0 },
    };

    this.cacheConfig();
  }

  #getPos(x, y) {
    return {
      cx: ~~((this.canvasW / 200) * (x + 100)),
      cy: ~~((this.canvasH / 200) * (y + 100)),
    };
  }

  #applyStyle(skinPart, x, y, size, opacity, isStroke = false, ctx = this.ctx) {
    const { canvasW } = this;
    let style;
    if (skinPart.type === "gradient") {
      let sizeMap = this.cache.gradient.get(skinPart);
      if (!sizeMap) {
        sizeMap = new Map();
        this.cache.gradient.set(skinPart, sizeMap);
      }
      style = sizeMap.get(size);
      if (!style) {
        style = ctx.createLinearGradient(x - size, y - size, x + size, y + size);
        for (let s = 0; s < skinPart.stops.length; s++) {
          style.addColorStop(skinPart.stops[s].percentage / 100, skinPart.stops[s].color);
        }
        sizeMap.set(size, style);
      }
    } else {
      style = hexadecimal(skinPart.color, opacity);
    }

    if (isStroke) {
      ctx.lineWidth = ~~((canvasW / 1000) * skinPart.width);
      ctx.strokeStyle = style;
    } else ctx.fillStyle = style;
  }

  setSize(layout) {
    this.canvasW = layout.canvasW;
    this.canvasH = layout.canvasH;

    if (this.canvasW !== this.cache.lastCacheW) {
      this.cache.bulletPath = null;
      this.cache.gradient.clear();
    }
    this.cache.finalEffect.clear();
    this.cache.comboAlert = null;
    this.cache.cursor.clear();
    this.cache.judgeWidths.clear();

    this.cacheConfig();
  }

  cacheConfig() {
    const refX = this.canvasW / 1000;
    const refY = this.canvasH / 1000;
    const _F = "Montserrat, Pretendard Variable";
    this.CONFIG = {
      UI: {
        DEFAULT_FONT_SIZE: Math.round(refY * Config.UI.DEFAULT_FONT_SIZE),
        DEBUG_TEXT_LINE_WIDTH: Math.round(refX * Config.UI.DEBUG_TEXT_LINE_WIDTH),
        SCORE_PANEL: {
          X_BASE: Math.round(refX * Config.UI.SCORE_PANEL.X_BASE),
          Y_BASE: Math.round(refY * Config.UI.SCORE_PANEL.Y_BASE),
          SIZE: Math.round(refY * Config.UI.SCORE_PANEL.SIZE),
          PADDING: Math.round(refX * Config.UI.SCORE_PANEL.PADDING),
          MARGIN: Math.round(refX * Config.UI.SCORE_PANEL.MARGIN),
          BORDER: Math.round(refX * Config.UI.SCORE_PANEL.BORDER),
          FONT_SIZE: Math.round(refY * Config.UI.SCORE_PANEL.FONT_SIZE),
        },
      },
      CURSOR: {
        SIZE: Math.round(refX * Config.CURSOR.SIZE * this.cursorZoom),
        ANIM_SIZE_ADDER: Math.round(refX * Config.CURSOR.ANIM_SIZE_ADDER),
      },
      NOTE: {
        WIDTH: Math.round(refX * Config.NOTE.WIDTH),
      },
      NOTE_CLICK_EFFECT: {
        SIZE: Math.round(refX * Config.NOTE_CLICK_EFFECT.SIZE),
        LINE_WIDTH: Math.round(refX * Config.NOTE_CLICK_EFFECT.LINE_WIDTH),
      },
      EXPLODE_EFFECT: {
        SIZE: Math.round(refX * Config.EXPLODE_EFFECT.SIZE),
      },
      FINAL_EFFECT: {
        BACKGROUND: {
          FONT_SIZE: Math.round(refY * Config.FINAL_EFFECT.BACKGROUND.FONT_SIZE),
          START_X: Math.round(refX * Config.FINAL_EFFECT.BACKGROUND.START_X),
          FINAL_X: Math.round(refX * Config.FINAL_EFFECT.BACKGROUND.FINAL_X),
          Y: Math.round(refY * Config.FINAL_EFFECT.BACKGROUND.Y),
        },
        MAIN: {
          LINE_WIDTH: Math.round(refX * Config.FINAL_EFFECT.MAIN.LINE_WIDTH),
          FONT_SIZE_START: Math.round(refY * Config.FINAL_EFFECT.MAIN.FONT_SIZE_START),
          FONT_SIZE_END: Math.round(refY * Config.FINAL_EFFECT.MAIN.FONT_SIZE_END),
        },
        OUTLINE: {
          LINE_WIDTH: Math.round(refX * Config.FINAL_EFFECT.OUTLINE.LINE_WIDTH),
          FONT_SIZE_START: Math.round(refY * Config.FINAL_EFFECT.OUTLINE.FONT_SIZE_START),
          FONT_SIZE_END: Math.round(refY * Config.FINAL_EFFECT.OUTLINE.FONT_SIZE_END),
        },
      },
    };

    const defaultSize = this.CONFIG.UI.DEFAULT_FONT_SIZE;
    const scorePanelSize = this.CONFIG.UI.SCORE_PANEL.FONT_SIZE;
    const judgeSize = ~~(this.canvasH / 30);
    const judgeTimingSize = Math.max(8, Math.round(judgeSize * Config.JUDGE_EFFECT.TIMING.SIZE));
    this.CONFIG.JUDGE_EFFECT = { SIZE: judgeSize, TIMING_SIZE: judgeTimingSize };
    const systemInfoSize = ~~(this.canvasH / 60);
    this.FONT = {
      debug: `600 ${defaultSize}px ${_F}`,
      judge: `${Config.JUDGE_EFFECT.FONT_WEIGHT} ${judgeSize}px ${_F}`,
      judgeTiming: `700 ${judgeTimingSize}px ${_F}`,
      keyInput: `600 ${defaultSize}px ${_F}`,
      scorePanel: `700 ${scorePanelSize}px ${_F}`,
      combo: [400, 500, 600].map((weight) => `${weight} ${defaultSize}px ${_F}`),
      systemInfo: `600 ${systemInfoSize}px ${_F}`,
    };
  }

  initialize() {
    this.animState = {
      score: { current: 0, start: 0, target: 0, startTime: 0 },
      combo: { value: 0, startTime: 0 },
    };
  }

  outlinedText(text, x, y) {
    this.ctx.strokeText(text, x, y);
    this.ctx.fillText(text, x, y);
  }

  note(note, state) {
    const { ctx, skin } = this;
    const { x, y, value: type, direction } = note;
    const { globalAlpha, progress, tailProgress, endProgress, isGrabbed, isSelected } = state;

    if (type !== 2 && progress >= 130) return;
    if (type === 2 && endProgress >= 130) return;

    const { cx, cy } = this.#getPos(x, y);
    const safeP = Math.max(progress, 0);
    let w = this.CONFIG.NOTE.WIDTH;

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

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = (opacityVal / 100) * globalAlpha;

    if (isSelected) {
      ctx.beginPath();
      ctx.font = this.FONT.debug;
      ctx.fillStyle = "#000";
      ctx.strokeStyle = "#fff";
      ctx.textAlign = "center";
      ctx.lineWidth = ~~this.CONFIG.UI.DEBUG_TEXT_LINE_WIDTH;

      const textY = ~~(1.2 * w);

      if (note.debugIndex !== undefined) {
        ctx.textBaseline = "bottom";
        this.outlinedText(`Note_${note.debugIndex}`, 0, -textY);
      }
      ctx.textBaseline = "top";
      this.outlinedText(`(X: ${x}, Y: ${y})`, 0, textY);

      ctx.fillStyle = "#ebd534";
      ctx.strokeStyle = "#ebd534";
    } else {
      this.#applyStyle(noteSkin, 0, 0, w, 100, false);
      this.#applyStyle(noteSkin.indicator, 0, 0, w, 100, true);
    }

    if (type === 0) {
      ctx.beginPath();
      ctx.arc(0, 0, w, 1.5 * Math.PI, 1.5 * Math.PI + (safeP / 50) * Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, (w / 100) * safeP, 0, 2 * Math.PI);
      ctx.fill();
      if (noteSkin.outline) {
        this.#applyStyle(noteSkin.outline, 0, 0, w, 100, true);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.globalAlpha *= (0.2 * Math.min(safeP * 2, 100)) / 100;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.arc(0, 0, w, 0, 2 * Math.PI);
      ctx.fill();
    } else if (type === 1) {
      w = w * 0.9;

      const p1 = safeP <= 20 ? safeP * 5 : 100;
      const p2 = safeP > 20 ? Math.min((safeP - 20) * 1.66, 100) : 0;
      const p3 = safeP > 80 ? Math.min((safeP - 80) * 5, 100) : 0;

      const { PI_5, COS_36, SIN_36 } = Config.MATH;

      ctx.save();
      ctx.scale(direction, direction);

      ctx.beginPath();

      const tipX = w * COS_36;
      const tipY = -w * SIN_36;
      const tailY = -1.5 * w;

      const dx1 = tipX;
      const dy1 = tipY - tailY;

      ctx.moveTo(0, tailY);
      ctx.lineTo((dx1 / 100) * p1, tailY + (dy1 / 100) * p1);

      if (p2 > 0) {
        const arcLen = ((PI_5 * 7) / 100) * p2;
        ctx.arc(0, 0, w, -PI_5, -PI_5 + arcLen);
      }

      if (p3 > 0) {
        const dx3 = tipX;
        const dy3 = tailY - tipY;

        ctx.lineTo(-tipX + (dx3 / 100) * p3, tipY + (dy3 / 100) * p3);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -1.5 * (w / 100) * safeP);
      ctx.arc(0, 0, (w / 100) * safeP, -PI_5, PI_5 * 6);
      ctx.lineTo(0, -1.5 * (w / 100) * safeP);
      ctx.fill();
      if (noteSkin.outline) {
        this.#applyStyle(noteSkin.outline, 0, 0, w, 100, true);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.globalAlpha *= (0.2 * Math.min(safeP * 2, 100)) / 100;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.moveTo(0, -1.5 * w);
      ctx.arc(0, 0, w, -PI_5, PI_5 * 6);
      ctx.lineTo(0, -1.5 * w);
      ctx.fill();

      ctx.restore();
    } else if (type === 2) {
      ctx.beginPath();
      if (safeP <= 100) {
        ctx.arc(0, 0, w, 1.5 * Math.PI, 1.5 * Math.PI + (safeP / 50) * Math.PI);
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, w, 1.5 * Math.PI, 1.5 * Math.PI + (safeP / 50) * Math.PI);
        ctx.stroke();
      } else if (!isGrabbed) {
        ctx.arc(0, 0, w, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (tailProgress <= 100) {
        ctx.arc(0, 0, w, 1.5 * Math.PI + (tailProgress / 50) * Math.PI, 1.5 * Math.PI);
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, w, 0, 2 * Math.PI);
        ctx.stroke();
      } else {
        ctx.arc(0, 0, w, 0, 2 * Math.PI);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.globalAlpha *= (0.2 * Math.min(safeP * 2, 100)) / 100;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.arc(0, 0, w, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.restore();
  }

  bullet(bullet, state = {}) {
    const { ctx, canvasW, canvasH, skin } = this;
    const { x, y, angle: realAngle } = bullet;
    const { isSelected, isHit } = state;

    const { cx, cy } = this.#getPos(x, y);
    const w = canvasW / 80;

    if (this.cache.lastCacheW !== canvasW || !this.cache.bulletPath) {
      const path = new Path2D();
      path.arc(0, 0, w, 0.5 * Math.PI, 1.5 * Math.PI);
      path.lineTo(w * 2, 0);
      path.closePath();

      this.cache.bulletPath = path;
      this.cache.lastCacheW = canvasW;
    }

    if (isSelected) {
      ctx.beginPath();
      ctx.font = this.FONT.debug;
      ctx.fillStyle = "#000";
      ctx.strokeStyle = "#fff";
      ctx.textAlign = bullet.direction === "L" ? "left" : "right";
      ctx.lineWidth = ~~this.CONFIG.UI.DEBUG_TEXT_LINE_WIDTH;

      if (bullet.debugIndex !== undefined) {
        ctx.textBaseline = "bottom";
        this.outlinedText(`Bullet_${bullet.debugIndex}`, cx, cy - 1.5 * w);
      }
      ctx.textBaseline = "top";
      this.outlinedText(`(Angle: ${bullet.direction === "L" ? realAngle : realAngle - 180})`, cx, cy + 1.5 * w);
      if (bullet.location !== undefined) {
        this.outlinedText(`(Loc: ${bullet.location})`, cx, cy + 1.5 * w + this.CONFIG.UI.DEFAULT_FONT_SIZE);
      }

      ctx.fillStyle = "#ebd534";
    } else if (isHit) {
      ctx.fillStyle = "#fb4934";
    } else {
      this.#applyStyle(skin.bullet, 0, 0, w, 100, false);
      if (skin.bullet.outline) this.#applyStyle(skin.bullet.outline, 0, 0, w, 100, true);
    }

    const visualAngleRad = Math.atan2(getSin(realAngle) * canvasH, getCos(realAngle) * canvasW);
    const visualAngle = (visualAngleRad * 180) / Math.PI;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((visualAngle * Math.PI) / 180);

    const path = this.cache.bulletPath;
    ctx.fill(path);
    if (skin.bullet.outline) ctx.stroke(path);

    ctx.restore();
  }

  triggerText(textObj) {
    const { ctx, canvasH } = this;
    const { text, x, y, align, valign, size, weight } = textObj;

    ctx.save();
    ctx.fillStyle = "#fff";

    let fontSize;
    if (size.includes("vh")) fontSize = (canvasH / 100) * Number(size.split("vh")[0]) + "px";
    else fontSize = size;

    ctx.font = `${weight} ${fontSize} Montserrat, Pretendard Variable`;
    ctx.textAlign = align;
    ctx.textBaseline = valign;

    const { cx, cy } = this.#getPos(x, y);
    ctx.fillText(text, cx, cy);

    ctx.restore();
  }

  cursor(cursor, state) {
    const { ctx } = this;
    const { x: mouseX, y: mouseY } = cursor;
    const { isClicked = false, clickedMs = -1 } = state;

    const { cx, cy } = this.#getPos(mouseX, mouseY);
    const conf = Config.CURSOR;

    let w = this.CONFIG.CURSOR.SIZE;
    let adder = this.CONFIG.CURSOR.ANIM_SIZE_ADDER;

    if (clickedMs !== undefined && clickedMs !== -1) {
      const now = Date.now();
      if (isClicked) {
        w = w + adder;
      } else {
        if (now < clickedMs + conf.RELEASE_ANIM_LENGTH) {
          const progress = (clickedMs + conf.RELEASE_ANIM_LENGTH - now) / conf.RELEASE_ANIM_LENGTH;
          w = w + adder * progress;
        }
      }
    }

    const sprite = this.#getCursorSprite(Math.round(w));
    ctx.drawImage(sprite.canvas, cx - sprite.half, cy - sprite.half);
  }

  resumePoint(point) {
    const { ctx, canvasW } = this;
    const { cx, cy } = this.#getPos(point.x, point.y);
    const radius = this.CONFIG.CURSOR.SIZE;
    const pulse = (Math.sin(Date.now() / 200) + 1) / 2;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.lineWidth = canvasW / 400;
    ctx.strokeStyle = "#fff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = canvasW / 200;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 0.6 * (1 - pulse);
    ctx.beginPath();
    ctx.arc(cx, cy, radius * (1 + pulse * 0.4), 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  #getCursorSprite(w) {
    const cached = this.cache.cursor.get(w);
    if (cached) return cached;

    const { canvasW, skin } = this;
    const outline = skin.cursor.outline;
    const blur = canvasW / 100;
    const outlineWidth = outline ? ~~((canvasW / 1000) * outline.width) : 0;
    const half = Math.ceil(w + outlineWidth + blur * 2);
    const { canvas, ctx } = this.#createLayer(half * 2, half * 2);

    ctx.translate(half, half);
    this.#applyStyle(skin.cursor, 0, 0, w, 100, false, ctx);
    if (skin.cursor.type === "gradient") ctx.shadowColor = skin.cursor.stops[0].color;
    else ctx.shadowColor = skin.cursor.color;

    if (outline) {
      this.#applyStyle(outline, 0, 0, w, 100, true, ctx);
      if (outline.type === "gradient") ctx.shadowColor = outline.stops[0].color;
      else ctx.shadowColor = outline.color;
    }

    ctx.beginPath();
    ctx.arc(0, 0, w, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = blur;
    if (outline) ctx.stroke();

    const sprite = { canvas, half };
    this.cache.cursor.set(w, sprite);
    return sprite;
  }

  judges(particles) {
    const { ctx, canvasH, skin } = this;
    const conf = Config.JUDGE_EFFECT;
    const size = this.CONFIG.JUDGE_EFFECT.SIZE;
    const unit = canvasH / 1000;
    const now = Date.now();

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const judgeKey = p.judge.toLowerCase();
      const isMiss = judgeKey == "miss";
      const elapsed = now - p.createdAt;
      const exitStart = p.lifeTime * conf.EXIT_FROM;
      const exitDuration = p.lifeTime * conf.EXIT_DURATION;

      const text = p.judge;
      const count = text.length;
      ctx.font = this.FONT.judge;
      const widths = this.#judgeWidths(text);
      const spacing = isMiss
        ? size * conf.MISS_SPACING
        : size * conf.SPACING_FROM * (1 - easeOutCubic(Math.min(1, elapsed / conf.SPACING_DURATION)));
      let x = -(widths.total + spacing * (count - 1)) / 2;
      const lastDelay = (count - 1) * conf.STAGGER;

      const skinPart = p.judgeSkin && skin.judges[judgeKey] ? skin.judges[judgeKey] : JudgeSkin[judgeKey];
      const { cx, cy } = this.#getPos(p.x, p.y);

      ctx.save();
      ctx.translate(cx, cy);
      this.#applyStyle(skinPart, 0, 0, 50, 100, false);
      const fillStyle = ctx.fillStyle;

      for (let c = 0; c < count; c++) {
        const letterX = x + widths.chars[c] / 2;
        x += widths.chars[c] + spacing;
        const local = elapsed - c * conf.STAGGER;
        if (local <= 0) continue;

        let letterY, alpha;
        let whiten = 0;
        if (isMiss) {
          const t = Math.min(1, local / (p.lifeTime - lastDelay));
          letterY = unit * conf.MISS_FALL * easeInQuad(t);
          alpha = 1 - easeInQuad(t);
        } else {
          const exit = easeInQuad(Math.min(1, Math.max(0, local - exitStart) / exitDuration));
          letterY =
            unit * (conf.RISE * (1 - easeOutCubic(Math.min(1, local / conf.ENTER_DURATION))) - conf.EXIT_RISE * exit);
          alpha = Math.min(1, local / conf.FADE_IN) * (1 - exit);
          whiten = conf.WHITE_OPACITY * (1 - Math.min(1, local / conf.WHITE_DURATION));
        }
        if (alpha <= 0) continue;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = fillStyle;
        ctx.fillText(text[c], letterX, letterY);
        if (whiten > 0) {
          ctx.globalAlpha = alpha * whiten;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(text[c], letterX, letterY);
        }
      }

      if (p.timing && !isMiss && judgeKey != "perfect") {
        const timingConf = conf.TIMING;
        const exit = easeInQuad(Math.min(1, Math.max(0, elapsed - exitStart) / exitDuration));
        const timingAlpha =
          Math.min(1, Math.max(0, elapsed - lastDelay - timingConf.DELAY) / timingConf.FADE_IN) * (1 - exit);
        if (timingAlpha > 0) {
          const timingSpacing = this.CONFIG.JUDGE_EFFECT.TIMING_SIZE * timingConf.SPACING;
          ctx.globalAlpha = timingAlpha;
          ctx.font = this.FONT.judgeTiming;
          ctx.letterSpacing = `${timingSpacing}px`;
          ctx.fillStyle = TimingColors[p.timing];
          ctx.fillText(p.timing, timingSpacing / 2, size * timingConf.OFFSET);
          ctx.letterSpacing = "0px";
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }

  #judgeWidths(text) {
    let widths = this.cache.judgeWidths.get(text);
    if (!widths) {
      const chars = [];
      let total = 0;
      for (const char of text) {
        const width = this.ctx.measureText(char).width;
        chars.push(width);
        total += width;
      }
      widths = { chars, total };
      this.cache.judgeWidths.set(text, widths);
    }
    return widths;
  }

  clickEffects(particles) {
    const { ctx, skin } = this;
    const now = Date.now();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const elapsed = now - p.createdAt;

      if (p.type === "note" && p.judge && p.judge != "Miss") {
        this.#noteHitEffect(p, elapsed);
        continue;
      }

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

      const startW = this.CONFIG.CURSOR.SIZE + this.CONFIG.CURSOR.ANIM_SIZE_ADDER;
      const expandW = this.CONFIG.NOTE_CLICK_EFFECT.SIZE;
      const width = ~~(startW + expandW * easeOutProgress);
      const lineWidth = ~~((1 - easeOutProgress) * this.CONFIG.NOTE_CLICK_EFFECT.LINE_WIDTH);
      const opacity = effectConf.OPACITY - easeInProgress * effectConf.OPACITY;

      if (lineWidth <= 0 || opacity <= 0 || width <= 0) continue;

      ctx.save();
      ctx.beginPath();
      ctx.translate(cx, cy);
      ctx.globalAlpha = opacity / 100;

      this.#applyStyle(styleTarget, 0, 0, width, 100, true);
      ctx.lineWidth = lineWidth;

      ctx.arc(0, 0, width, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.restore();
    }
  }

  #skinColors(skinPart) {
    if (skinPart.type === "gradient") {
      return [skinPart.stops[0].color, skinPart.stops[skinPart.stops.length - 1].color];
    }
    return [skinPart.color, skinPart.color];
  }

  #noteHitEffect(p, elapsed) {
    const { ctx, canvasW, skin } = this;
    const conf = Config.NOTE_HIT_EFFECT;
    const judgeKey = p.judge.toLowerCase();
    const skinPart = p.judgeSkin && skin.judges[judgeKey] ? skin.judges[judgeKey] : JudgeSkin[judgeKey];
    const [colorA, colorB] = this.#skinColors(skinPart);
    const scale = 0.7 + 0.3 * (conf.JUDGE_SCALE[judgeKey] ?? 1);
    const unit = canvasW / 1000;
    const w = this.CONFIG.NOTE.WIDTH;
    const { cx, cy } = this.#getPos(p.x, p.y);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    if (judgeKey == "perfect" && elapsed < conf.SCANLINE.LIFETIME) {
      const scan = conf.SCANLINE;
      const t = elapsed / scan.LIFETIME;
      const height = (scan.HEIGHT * unit + 0.6) * (1 - 0.5 * t);
      const half = canvasW * scan.REACH * (0.6 + 0.4 * easeOutCubic(t));
      const x0 = Math.max(0, cx - half);
      const x1 = Math.min(canvasW, cx + half);
      if (x1 - x0 > 1) {
        const gradient = ctx.createLinearGradient(x0, 0, x1, 0);
        gradient.addColorStop(0, hexadecimal(colorB, 0));
        gradient.addColorStop(Math.max(0, Math.min(1, (cx - x0) / (x1 - x0))), "#FFFFFF");
        gradient.addColorStop(1, hexadecimal(colorA, 0));
        ctx.globalAlpha = scan.OPACITY * (1 - easeInQuad(t));
        ctx.fillStyle = gradient;
        ctx.fillRect(x0, cy - height / 2, x1 - x0, height);
      }
    }

    if (elapsed < conf.GLOW.LIFETIME) {
      const t = elapsed / conf.GLOW.LIFETIME;
      const radius = w * conf.GLOW.RADIUS * scale * (0.85 + 0.15 * easeOutQuad(t));
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, "#FFFFFF");
      gradient.addColorStop(0.45, hexadecimal(colorA, 50));
      gradient.addColorStop(1, hexadecimal(colorB, 0));
      ctx.globalAlpha = conf.GLOW.OPACITY * Math.pow(1 - t, 1.5);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.translate(cx, cy);

    const ring = conf.RING;
    if (elapsed < ring.LIFETIME) {
      const t = elapsed / ring.LIFETIME;
      const swell = t < ring.SWELL ? easeOutQuad(t / ring.SWELL) : 1 - easeInQuad((t - ring.SWELL) / (1 - ring.SWELL));
      const lineWidth = ring.LINE_WIDTH * unit * swell;
      if (lineWidth > 0.3) {
        const radius = w * (ring.START + ring.SPREAD * scale * easeOutCubic(t));
        ctx.globalAlpha = 1 - Math.pow(t, ring.FADE_POWER);
        this.#applyStyle(skinPart, 0, 0, Math.round(w * 3), 100, true);
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    const dustConf = conf.DUST;
    const dustColors = [colorA, colorB, "#FFFFFF"];
    for (let d = 0; d < p.dust.length; d++) {
      const dust = p.dust[d];
      const age = elapsed - dust.delay;
      if (age <= 0 || age >= dust.lifeTime) continue;
      const t = age / dust.lifeTime;
      const sec = age / 1000;
      const grow = t < dustConf.GROW ? easeOutQuad(t / dustConf.GROW) : 1 - dustConf.SHRINK * t;
      const radius = w * dust.size * grow;
      if (radius <= 0.3) continue;
      const distance = (w * dust.speed * scale * (1 - Math.exp(-dustConf.DRAG * sec))) / dustConf.DRAG;
      const twinkle = 0.6 + 0.4 * Math.sin(sec * dustConf.TWINKLE + dust.phase);
      ctx.globalAlpha = (1 - t) * twinkle;
      ctx.fillStyle = dustColors[dust.color];
      ctx.beginPath();
      ctx.arc(
        Math.cos(dust.angle) * distance,
        Math.sin(dust.angle) * distance - w * dustConf.RISE * sec,
        radius,
        0,
        2 * Math.PI,
      );
      ctx.fill();
    }

    ctx.restore();
  }

  explosions(particles) {
    const { ctx } = this;
    const now = Date.now();
    const skin = this.skin.bullet;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const elapsed = now - p.createdAt;

      const progress = Math.min(1, elapsed / p.lifeTime);
      const easeVal = easeOutQuart(progress);

      const currentX = p.startX + p.dx * easeVal;
      const currentY = p.startY + p.dy * easeVal;

      const { cx, cy } = this.#getPos(currentX, currentY);
      const size = ~~(this.CONFIG.EXPLODE_EFFECT.SIZE * (1 - easeVal));

      if (size <= 0) continue;

      ctx.save();
      ctx.beginPath();
      ctx.translate(cx, cy);

      this.#applyStyle(skin, 0, 0, size, 100, false);

      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  #createLayer(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(w));
    canvas.height = Math.max(1, Math.ceil(h));
    return { canvas, ctx: canvas.getContext("2d") };
  }

  #outlinedTextLayer(text, size, lineWidth, strokeStyle, withFill) {
    const font = `800 ${size}px Montserrat`;
    this.ctx.save();
    this.ctx.font = font;
    const textW = this.ctx.measureText(text).width;
    this.ctx.restore();

    const pad = lineWidth + size * 0.2;
    const { canvas, ctx } = this.#createLayer(textW + pad * 2, size + pad * 2);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = strokeStyle(ctx, cx, cy);
    ctx.strokeText(text, cx, cy);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#FFF";
    ctx.fillText(text, cx, cy);
    ctx.globalCompositeOperation = "source-over";
    if (withFill) ctx.fillText(text, cx, cy);

    return { canvas, size };
  }

  #getFinalEffectCache(effectNum) {
    const cached = this.cache.finalEffect.get(effectNum);
    if (cached) return cached;

    const text = effectNum == 0 ? "ALL PERFECT" : "FULL COMBO";
    const { BACKGROUND, MAIN, OUTLINE } = this.CONFIG.FINAL_EFFECT;

    const backgroundSize = BACKGROUND.FONT_SIZE;
    const backgroundFont = `800 ${backgroundSize}px Montserrat`;
    this.ctx.save();
    this.ctx.font = backgroundFont;
    const backgroundTextW = this.ctx.measureText(text).width;
    this.ctx.restore();

    const backgroundPad = ~~(backgroundSize * 0.2);
    const background = this.#createLayer(backgroundTextW + backgroundPad * 2, backgroundSize + backgroundPad * 2);
    const bgCtx = background.ctx;
    const grd = bgCtx.createLinearGradient(0, backgroundPad, 0, backgroundPad + backgroundSize);
    grd.addColorStop(0, "rgba(255, 255, 255, 0.2)");
    grd.addColorStop(1, "rgba(255, 255, 255, 0)");
    bgCtx.font = backgroundFont;
    bgCtx.fillStyle = grd;
    bgCtx.textAlign = "left";
    bgCtx.textBaseline = "top";
    bgCtx.fillText(text, backgroundPad, backgroundPad);

    const outlineToMainRatio = OUTLINE.FONT_SIZE_END / MAIN.FONT_SIZE_END;
    const strokeStyle = (gradientSpan) => (ctx, cx, cy) => {
      if (effectNum != 0) return "#F0C21D";
      const g = ctx.createLinearGradient(cx, cy - gradientSpan / 2, cx, cy + gradientSpan / 2);
      g.addColorStop(0, "#f581ff");
      g.addColorStop(0.5, "#77B6F4");
      g.addColorStop(1, "#43DDA6");
      return g;
    };

    const outlineSize = OUTLINE.FONT_SIZE_START;
    const mainSize = MAIN.FONT_SIZE_START;
    const outline = this.#outlinedTextLayer(
      text,
      outlineSize,
      (OUTLINE.LINE_WIDTH * outlineSize) / OUTLINE.FONT_SIZE_END,
      strokeStyle(outlineSize),
      false,
    );
    const main = this.#outlinedTextLayer(
      text,
      mainSize,
      (MAIN.LINE_WIDTH * mainSize) / MAIN.FONT_SIZE_END,
      strokeStyle(mainSize * outlineToMainRatio),
      true,
    );

    const entry = { background: background.canvas, backgroundPad, backgroundSize, outline, main };
    this.cache.finalEffect.set(effectNum, entry);
    return entry;
  }

  #getComboAlertCache(count) {
    const cached = this.cache.comboAlert;
    if (cached && cached.count === count) return cached;

    const size = ~~(this.canvasH / 5);
    const font = `700 ${size}px Montserrat, Pretendard Variable, Pretendard`;
    this.ctx.save();
    this.ctx.font = font;
    const textW = this.ctx.measureText(count).width;
    this.ctx.restore();

    const pad = size * 0.2;
    const { canvas, ctx } = this.#createLayer(textW + pad * 2, size + pad * 2);
    ctx.font = font;
    ctx.fillStyle = "rgb(200, 200, 200)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(count, canvas.width / 2, canvas.height / 2);

    this.cache.comboAlert = { count, canvas };
    return this.cache.comboAlert;
  }

  comboAlert(count, startMs) {
    const elapsed = Date.now() - startMs;
    if (elapsed < 0 || elapsed >= 1000) return;

    let opacity;
    if (elapsed < 400) opacity = elapsed / 1200;
    else if (elapsed < 600) opacity = 0.33;
    else opacity = (1000 - elapsed) / 1200;

    const scale = easeOutSine(elapsed / 1000);
    if (opacity <= 0 || scale <= 0) return;

    const { ctx, canvasW, canvasH } = this;
    const { canvas } = this.#getComboAlertCache(count);
    const w = canvas.width * scale;
    const h = canvas.height * scale;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(canvas, (canvasW - w) / 2, (canvasH - h) / 2, w, h);
    ctx.restore();
  }

  finalEffect(effectNum, effectMs) {
    const { ctx, canvasW, canvasH } = this;
    const now = Date.now();

    const duration = Config.FINAL_EFFECT.LIFETIME;
    const p = easeOutQuart(Math.min(1, (now - effectMs) / duration));

    const baseAlpha = Math.max(
      0,
      Math.min((now - effectMs) / 200, Math.min(1, (effectMs + duration - 500 - now) / 500)),
    );
    if (baseAlpha <= 0) return;

    const { BACKGROUND, MAIN, OUTLINE } = this.CONFIG.FINAL_EFFECT;
    const { background, backgroundPad, backgroundSize, outline, main } = this.#getFinalEffectCache(effectNum);

    ctx.save();
    ctx.globalAlpha = baseAlpha;

    const backgroundX = ~~(BACKGROUND.START_X + (BACKGROUND.FINAL_X - BACKGROUND.START_X) * p);
    ctx.drawImage(background, -backgroundX - backgroundPad, -BACKGROUND.Y - backgroundPad);
    ctx.drawImage(
      background,
      canvasW + backgroundX - background.width + backgroundPad,
      canvasH + BACKGROUND.Y - backgroundSize - backgroundPad,
    );

    const outlineTextSize = OUTLINE.FONT_SIZE_START + (OUTLINE.FONT_SIZE_END - OUTLINE.FONT_SIZE_START) * p;
    const mainTextSize = MAIN.FONT_SIZE_START + (MAIN.FONT_SIZE_END - MAIN.FONT_SIZE_START) * p;

    const drawScaled = (layer, textSize, alpha) => {
      const scale = textSize / layer.size;
      const w = layer.canvas.width * scale;
      const h = layer.canvas.height * scale;
      ctx.globalAlpha = alpha;
      ctx.drawImage(layer.canvas, (canvasW - w) / 2, (canvasH - h) / 2, w, h);
    };
    drawScaled(outline, outlineTextSize, baseAlpha / 3);
    drawScaled(main, mainTextSize, baseAlpha);

    ctx.restore();
  }

  keyInputUI(keyInput, keyInputTime) {
    if (keyInput.length === 0) return;

    if (keyInput[keyInput.length - 1].time + 4000 <= Date.now()) return;

    const { ctx, canvasW, canvasH } = this;
    const now = Date.now();

    let alpha = 1;
    if (keyInput[keyInput.length - 1].time + 3000 <= now) {
      alpha = 1 - (now - keyInput[keyInput.length - 1].time - 3000) / 1000;
      if (alpha <= 0) return;
    }

    let animDuration = 0;
    let animX = 0;
    if (keyInputTime + 100 >= now) {
      animDuration = 1 - easeOutQuart((now - keyInputTime) / 100);
      animX = animDuration * (canvasW / 100 + canvasW / 200);
    }

    for (let i = keyInput.length - 1; i >= 0; i--) {
      let j = i - keyInput.length + 13;
      let partAlpha = alpha;

      if (j < 8) {
        partAlpha *= (1 / 8) * (j + animDuration);
      }

      ctx.save();
      ctx.globalAlpha = partAlpha;

      const judge = keyInput[i].judge;
      let color = KeyInputColors[judge];

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

      ctx.beginPath();
      ctx.fillStyle = "#fff";
      ctx.font = this.FONT.keyInput;
      ctx.textBaseline = "top";
      ctx.textAlign = "center";

      const textX = boxX + canvasW / 200;
      const textY = boxY + boxSize + canvasH / 200;

      ctx.fillText(keyInput[i].key[0], textX, textY);

      ctx.restore();
    }
  }

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

  scorePanelUI(data, albumImg) {
    const { ctx } = this;
    const { score, combo, difficulty } = data;
    const now = Date.now();

    const s = this.animState.score;

    if (score !== s.target) {
      s.start = s.current;
      s.target = score;
      s.startTime = now;
    }

    const scoreElapsed = now - s.startTime;
    if (scoreElapsed < 500) {
      const progress = easeOutQuart(scoreElapsed / 500);
      s.current = s.start + (s.target - s.start) * progress;
    } else {
      s.current = s.target;
    }

    const c = this.animState.combo;

    if (combo > c.value) {
      c.startTime = now;
    }
    c.value = combo;

    const comboElapsed = now - c.startTime;
    let comboScale = 0;
    if (comboElapsed < 500) {
      comboScale = Math.max(0, 1 - easeOutQuart(comboElapsed / 500));
    }

    ctx.save();

    ctx.beginPath();

    ctx.fillStyle = DiffColors[difficulty] ?? "#6021ff";

    const Conf = this.CONFIG.UI.SCORE_PANEL;
    const xBase = Conf.X_BASE;
    const yBase = Conf.Y_BASE;
    const size = Conf.SIZE;
    const padding = Conf.PADDING;
    const margin = Conf.MARGIN;
    const border = Conf.BORDER;
    const fontSize = Conf.FONT_SIZE;

    ctx.rect(xBase, yBase, size + padding, size + padding);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.rect(xBase - border, yBase - border, size + padding, size + padding);
    ctx.fill();

    if (albumImg) {
      ctx.drawImage(albumImg, xBase, yBase, size, size);
    }

    ctx.beginPath();
    ctx.font = this.FONT.scorePanel;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";

    ctx.fillText(numberWithCommas(s.current), xBase - margin, yBase);

    const comboSize = 1 + comboScale;
    ctx.font = this.FONT.combo[Math.round(comboScale * 2)];
    ctx.translate(xBase - margin, yBase + fontSize);
    ctx.scale(comboSize, comboSize);
    ctx.fillText(`${combo}x`, 0, 0);

    ctx.restore();
  }

  systemInfoUI(info) {
    const { ctx, canvasW, canvasH } = this;
    const { speed, bpm, fps, auto } = info;

    ctx.save();
    ctx.beginPath();

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#fff";
    ctx.font = this.FONT.systemInfo;
    ctx.textBaseline = "bottom";

    if (speed !== undefined && bpm !== undefined) {
      ctx.textAlign = "left";
      ctx.fillText(`Speed : ${speed}, BPM : ${bpm}`, canvasW / 100, canvasH - canvasH / 60);
    }

    if (fps !== undefined) {
      ctx.textAlign = "right";
      ctx.fillText(fps, canvasW - canvasW / 100, canvasH - canvasH / 70);
    }

    if (auto) {
      ctx.textAlign = "center";
      ctx.fillText("AUTO PLAY", canvasW / 2, canvasH - canvasH / 25);
    }

    ctx.restore();
  }

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

    ctx.font = this.FONT.debug;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Add trigger", canvasW / 2, canvasH / 2 + 10);
    ctx.restore();
  }

  axis() {
    const { ctx, canvasW, canvasH } = this;
    const tw = canvasW / 200;
    const th = canvasH / 200;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ed3a2680";
    ctx.beginPath();

    ctx.moveTo(tw * 100, 0);
    ctx.lineTo(tw * 100, canvasH);
    ctx.moveTo(0, th * 100);
    ctx.lineTo(canvasW, th * 100);

    ctx.stroke();
    ctx.restore();
  }

  meshGrid() {
    const { ctx, canvasW, canvasH } = this;
    const tw = canvasW / 200;
    const th = canvasH / 200;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#bbbbbb20";
    ctx.beginPath();

    let x1 = 0,
      x2 = tw * 5,
      y = 0;

    for (let i = -100; i <= 100; i += 10) {
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, canvasH);
      ctx.moveTo(x2, 0);
      ctx.lineTo(x2, canvasH);
      ctx.moveTo(0, y);
      ctx.lineTo(canvasW, y);

      x1 += tw * 10;
      x2 += tw * 10;
      y += th * 10;
    }
    ctx.stroke();
    ctx.restore();
  }

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

  noteShadow(note, alpha) {
    const { ctx } = this;
    const { x, y, value, direction } = note;
    const { cx, cy } = this.#getPos(x, y);

    let w = this.CONFIG.NOTE.WIDTH;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;

    if (value !== 1) {
      ctx.beginPath();
      ctx.arc(0, 0, w, 0, 2 * Math.PI);
      ctx.fill();
    } else {
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
