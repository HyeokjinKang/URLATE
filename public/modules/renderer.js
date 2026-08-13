/**
 * renderer.js
 * Canvas drawing for the game.
 */
import { Config, JudgeSkin, KeyInputColors, DiffColors } from "./constants.js";
import { getSin, getCos, hexadecimal, easeInQuad, easeOutQuad, easeOutQuart, numberWithCommas } from "./utils.js";

/** Takes the data and renders it into the canvas context. */
export default class Renderer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} layout - { canvasW, canvasH, cursorZoom? }
   * @param {object} skin - skin data
   */
  constructor(ctx, layout, skin) {
    this.ctx = ctx;
    this.canvasW = layout.canvasW;
    this.canvasH = layout.canvasH;
    this.cursorZoom = layout.cursorZoom ?? 1;
    this.skin = skin;

    // Render caches
    this.cache = {
      bulletPath: null,
      lastCacheW: 0,
      gradient: new Map(), // skinPart -> Map(size -> gradient)
    };

    // Animation state
    this.animState = {
      score: { current: 0, start: 0, target: 0, startTime: 0 },
      combo: { value: 0, startTime: 0 },
    };

    this.cacheConfig();
  }

  /** Helper: game coordinates -> canvas coordinates. */
  #getPos(x, y) {
    return {
      cx: ~~((this.canvasW / 200) * (x + 100)),
      cy: ~~((this.canvasH / 200) * (y + 100)),
    };
  }

  /** Helper: read the skin data (gradient or colour) and set fillStyle or strokeStyle.
   * Gradients are cached fully opaque, and opacity is applied through ctx.globalAlpha.
   */
  #applyStyle(skinPart, x, y, size, opacity, isStroke = false) {
    const { ctx, canvasW } = this;
    let style;
    if (skinPart.type === "gradient") {
      let sizeMap = this.cache.gradient.get(skinPart);
      if (!sizeMap) {
        sizeMap = new Map();
        this.cache.gradient.set(skinPart, sizeMap);
      }
      style = sizeMap.get(size);
      if (!style) {
        // A cached gradient is built relative to (x, y) as the origin (usually 0, 0)
        style = ctx.createLinearGradient(x - size, y - size, x + size, y + size);
        for (let s = 0; s < skinPart.stops.length; s++) {
          style.addColorStop(skinPart.stops[s].percentage / 100, skinPart.stops[s].color);
        }
        sizeMap.set(size, style);
      }
      // For a gradient the caller normally handles opacity through globalAlpha;
      // setting it here works too, but globalAlpha accumulates.
    } else {
      style = hexadecimal(skinPart.color, opacity);
    }

    if (isStroke) {
      ctx.lineWidth = ~~((canvasW / 1000) * skinPart.width);
      ctx.strokeStyle = style;
    } else ctx.fillStyle = style;
  }

  /** Called when the canvas size changed.
   * @param {object} layout - { canvasW, canvasH }
   */
  setSize(layout) {
    this.canvasW = layout.canvasW;
    this.canvasH = layout.canvasH;

    // A new canvas width invalidates the caches
    if (this.canvasW !== this.cache.lastCacheW) {
      this.cache.bulletPath = null;
      this.cache.gradient.clear();
    }

    this.cacheConfig();
  }

  /** Store the config values that depend on the canvas size. */
  cacheConfig() {
    const refX = this.canvasW / 1000;
    const refY = this.canvasH / 1000;
    const _F = "Montserrat, Pretendard JP Variable";
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

    // Font strings only change on resize, so build them once here
    const defaultSize = this.CONFIG.UI.DEFAULT_FONT_SIZE;
    const scorePanelSize = this.CONFIG.UI.SCORE_PANEL.FONT_SIZE;
    const judgeSize = ~~(this.canvasH / 25);
    const systemInfoSize = ~~(this.canvasH / 60);
    this.FONT = {
      debug: `600 ${defaultSize}px ${_F}`,
      judge: `600 ${judgeSize}px ${_F}`,
      keyInput: `600 ${defaultSize}px ${_F}`,
      scorePanel: `700 ${scorePanelSize}px ${_F}`,
      systemInfo: `600 ${systemInfoSize}px ${_F}`,
    };
  }

  /** Reset the score panel animation state. */
  initialize() {
    this.animState = {
      score: { current: 0, start: 0, target: 0, startTime: 0 },
      combo: { value: 0, startTime: 0 },
    };
  }

  /**
   * Draw outlined text. The styles must already be set.
   * @param {string} text
   * @param {number} x
   * @param {number} y
   */
  outlinedText(text, x, y) {
    this.ctx.strokeText(text, x, y);
    this.ctx.fillText(text, x, y);
  }

  /**
   * Draw a note.
   * @param {object} note - { x, y, value, direction, debugIndex? }
   * @param {object} state - { globalAlpha, progress, tailProgress, endProgress, isGrabbed, isSelected? }
   */
  note(note, state) {
    const { ctx, skin } = this;
    const { x, y, value: type, direction } = note;
    const { globalAlpha, progress, tailProgress, endProgress, isGrabbed, isSelected } = state;

    // A finished note is not drawn
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
      // Pass opacity 100 so the cached gradient can be reused; globalAlpha does the fading
      this.#applyStyle(noteSkin, 0, 0, w, 100, false);
      this.#applyStyle(noteSkin.indicator, 0, 0, w, 100, true);
    }

    // Type 0: Circle Note
    if (type === 0) {
      // Timing indicator
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
    }

    // Type 1: Arrow Note (flick)
    else if (type === 1) {
      w = w * 0.9;

      // Animation stages: progress within 0-20, 20-80 and 80-100
      const p1 = safeP <= 20 ? safeP * 5 : 100;
      const p2 = safeP > 20 ? Math.min((safeP - 20) * 1.66, 100) : 0;
      const p3 = safeP > 80 ? Math.min((safeP - 80) * 5, 100) : 0;

      const { PI_5, COS_36, SIN_36 } = Config.MATH;

      // Flip the canvas by direction
      ctx.save();
      ctx.scale(direction, direction);

      ctx.beginPath();

      // Wing tip, which is also where the arc meets
      const tipX = w * COS_36;
      const tipY = -w * SIN_36;
      const tailY = -1.5 * w; // the sharp end

      // [Path 1] Tail(0, tailY) -> Right Tip(tipX, tipY)
      const dx1 = tipX;
      const dy1 = tipY - tailY;

      ctx.moveTo(0, tailY);
      ctx.lineTo((dx1 / 100) * p1, tailY + (dy1 / 100) * p1);

      // [Path 2] Arc (clockwise)
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

      ctx.beginPath();
      ctx.moveTo(0, -1.5 * (w / 100) * safeP); // centre axis
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
    }

    // Type 2: Hold Note
    else if (type === 2) {
      ctx.beginPath();
      if (safeP <= 100) {
        // growing
        ctx.arc(0, 0, w, 1.5 * Math.PI, 1.5 * Math.PI + (safeP / 50) * Math.PI);
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, w, 1.5 * Math.PI, 1.5 * Math.PI + (safeP / 50) * Math.PI);
        ctx.stroke();
      } else if (!isGrabbed) {
        // missed
        ctx.arc(0, 0, w, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (tailProgress <= 100) {
        // held
        ctx.arc(0, 0, w, 1.5 * Math.PI + (tailProgress / 50) * Math.PI, 1.5 * Math.PI);
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, w, 0, 2 * Math.PI);
        ctx.stroke();
      } else {
        // finished
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

  /**
   * Draw a bullet.
   * @param {object} bullet - { x, y, angle, location?, direction?, debugIndex? }
   * @param {object} state - { isSelected?, isHit? }
   */
  bullet(bullet, state = {}) {
    const { ctx, canvasW, canvasH, skin } = this;
    const { x, y, angle: realAngle } = bullet;
    const { isSelected, isHit } = state;

    const { cx, cy } = this.#getPos(x, y);
    const w = canvasW / 80;

    // Rebuild the cached bullet path when the width changed
    if (this.cache.lastCacheW !== canvasW || !this.cache.bulletPath) {
      const path = new Path2D();
      path.arc(0, 0, w, 0.5 * Math.PI, 1.5 * Math.PI);
      path.lineTo(w * 2, 0);
      path.closePath();

      this.cache.bulletPath = path;
      this.cache.lastCacheW = canvasW;
    }

    // (editor) selected object
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
    }
    // (editor) object that was hit
    else if (isHit) {
      ctx.fillStyle = "#fb4934";
    }
    else {
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

  /**
   * Draw the text defined by a trigger.
   * @param {object} textObj - pattern.trigger[i]
   */
  triggerText(textObj) {
    const { ctx, canvasH } = this;
    const { text, x, y, align, valign, size, weight } = textObj;

    ctx.save();
    ctx.fillStyle = "#fff";

    let fontSize;
    if (size.includes("vh")) fontSize = (canvasH / 100) * Number(size.split("vh")[0]) + "px";
    else fontSize = size;

    ctx.font = `${weight} ${fontSize} Montserrat, Pretendard JP Variable`;
    ctx.textAlign = align;
    ctx.textBaseline = valign;

    const { cx, cy } = this.#getPos(x, y);
    ctx.fillText(text, cx, cy);

    ctx.restore();
  }

  /**
   * Draw the mouse cursor.
   * @param {object} cursor - { x, y }
   * @param {object} state - { isClicked?, clickedMs? }
   */
  cursor(cursor, state) {
    const { ctx, canvasW, skin } = this;
    const { x: mouseX, y: mouseY } = cursor;
    const { isClicked = false, clickedMs = -1 } = state;

    const { cx, cy } = this.#getPos(mouseX, mouseY);
    const conf = Config.CURSOR;

    let w = this.CONFIG.CURSOR.SIZE;
    let adder = this.CONFIG.CURSOR.ANIM_SIZE_ADDER;

    // Click animation
    if (clickedMs !== undefined && clickedMs !== -1) {
      const now = Date.now();
      if (isClicked) {
        // grows a little while held
        w = w + adder;
      } else {
        // eases back after release
        if (now < clickedMs + conf.RELEASE_ANIM_LENGTH) {
          const progress = (clickedMs + conf.RELEASE_ANIM_LENGTH - now) / conf.RELEASE_ANIM_LENGTH;
          w = w + adder * progress;
        }
      }
    }

    ctx.save();
    ctx.translate(cx, cy);

    this.#applyStyle(skin.cursor, 0, 0, w, 100, false);
    if (skin.cursor.type === "gradient") ctx.shadowColor = skin.cursor.stops[0].color;
    else ctx.shadowColor = skin.cursor.color;

    if (skin.cursor.outline) {
      this.#applyStyle(skin.cursor.outline, 0, 0, w, 100, true);
      if (skin.cursor.outline.type === "gradient") ctx.shadowColor = skin.cursor.outline.stops[0].color;
      else ctx.shadowColor = skin.cursor.outline.color;
    }

    ctx.beginPath();
    ctx.arc(0, 0, w, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = canvasW / 100;
    if (skin.cursor.outline) ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw the judgement text.
   * @param {Array<object>} particles - the judgement particles
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
      const animY = -(canvasH / 1000) * yAdder * easeOutProgress;

      const opacity = Math.max(0, 100 - easeInProgress * 100);

      const skinPart = isJudgeSkin && skin.judges[judgeKey] ? skin.judges[judgeKey] : JudgeSkin[judgeKey];

      ctx.save();
      ctx.beginPath();
      ctx.translate(cx, cy + animY);
      ctx.rotate((Math.PI * animDeg) / 180);
      ctx.globalAlpha = opacity / 100;

      this.#applyStyle(skinPart, 0, 0, 50, 100, false);

      ctx.font = this.FONT.judge;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.judge, 0, 0);

      ctx.restore();
    }
  }

  /**
   * Draw the click effects.
   * @param {Array<object>} particles
   */
  clickEffects(particles) {
    const { ctx, skin } = this;
    const now = Date.now();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const elapsed = now - p.createdAt;

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
      ctx.globalAlpha = opacity / 100;

      this.#applyStyle(styleTarget, 0, 0, width, 100, true);
      ctx.lineWidth = lineWidth;

      ctx.arc(cx, cy, width, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.restore();
    }
  }

  /**
   * Update the explosion particles and draw them.
   * @param {Array<object>} particles
   */
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

  /**
   * Draw the FC / AP effect.
   * @param {number} effectNum - 0: AP / 1 : FC
   * @param {number} effectMs - when the effect started
   */
  finalEffect(effectNum, effectMs) {
    const { ctx, canvasW, canvasH } = this;
    const now = Date.now();

    const duration = Config.FINAL_EFFECT.LIFETIME;

    const text = effectNum == 0 ? "ALL PERFECT" : "FULL COMBO";
    const p = easeOutQuart(Math.min(1, (now - effectMs) / duration));

    const baseAlpha = Math.max(0, Math.min((now - effectMs) / 200, Math.min(1, (effectMs + duration - 500 - now) / 500)));

    ctx.save();

    // 1. Background text sliding in from both corners
    const backgroundSize = this.CONFIG.FINAL_EFFECT.BACKGROUND.FONT_SIZE;
    const backgroundStartX = this.CONFIG.FINAL_EFFECT.BACKGROUND.START_X;
    const backgroundFinalX = this.CONFIG.FINAL_EFFECT.BACKGROUND.FINAL_X;
    const backgroundY = this.CONFIG.FINAL_EFFECT.BACKGROUND.Y;

    ctx.globalAlpha = baseAlpha;
    ctx.font = `800 ${backgroundSize}px Montserrat`;

    // Top Left
    let effectStartX = -backgroundStartX;
    let effectFinalX = -backgroundFinalX;
    let effectX = ~~(effectStartX + (effectFinalX - effectStartX) * p);
    let effectY = -backgroundY;

    let grd = ctx.createLinearGradient(effectX, effectY, effectX, effectY + backgroundSize);
    grd.addColorStop(0, `rgba(255, 255, 255, 0.2)`);
    grd.addColorStop(1, `rgba(255, 255, 255, 0)`);
    ctx.fillStyle = grd;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(text, effectX, effectY);

    // Bottom Right
    effectStartX = canvasW + backgroundStartX;
    effectFinalX = canvasW + backgroundFinalX;
    effectX = ~~(effectStartX + (effectFinalX - effectStartX) * p);
    effectY = canvasH + backgroundY;

    grd = ctx.createLinearGradient(effectX, effectY - backgroundSize, effectX, effectY);
    grd.addColorStop(0, `rgba(255, 255, 255, 0.2)`);
    grd.addColorStop(1, `rgba(255, 255, 255, 0)`);
    ctx.fillStyle = grd;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(text, effectX, effectY);

    // 2. Main text in the centre
    let mainTextX = ~~(canvasW / 2);
    let mainTextY = ~~(canvasH / 2);

    const mainTextSizeStart = this.CONFIG.FINAL_EFFECT.MAIN.FONT_SIZE_START;
    const mainTextSizeFinal = this.CONFIG.FINAL_EFFECT.MAIN.FONT_SIZE_END;
    const outlineTextSizeStart = this.CONFIG.FINAL_EFFECT.OUTLINE.FONT_SIZE_START;
    const outlineTextSizeFinal = this.CONFIG.FINAL_EFFECT.OUTLINE.FONT_SIZE_END;
    const mainTextSize = mainTextSizeStart + (mainTextSizeFinal - mainTextSizeStart) * p;
    const outlineTextSize = outlineTextSizeStart + (outlineTextSizeFinal - outlineTextSizeStart) * p;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";

    let strokeStyle;
    if (effectNum == 0) {
      // All Perfect: Gradient
      let g = ctx.createLinearGradient(mainTextX, ~~(mainTextY - outlineTextSize / 2), mainTextX, ~~(mainTextY + outlineTextSize / 2));
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
    ctx.font = `800 ${~~outlineTextSize}px Montserrat`;
    ctx.lineWidth = this.CONFIG.FINAL_EFFECT.OUTLINE.LINE_WIDTH;
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
    ctx.font = `800 ${~~mainTextSize}px Montserrat`;
    ctx.lineWidth = this.CONFIG.FINAL_EFFECT.MAIN.LINE_WIDTH;
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
   * Draw the key input log overlay.
   * @param {Array} keyInput - the key input entries
   * @param {number} keyInputTime - when the last key input happened
   */
  keyInputUI(keyInput, keyInputTime) {
    if (keyInput.length === 0) return;

    // Nothing is drawn 4 seconds after the last input
    if (keyInput[keyInput.length - 1].time + 4000 <= Date.now()) return;

    const { ctx, canvasW, canvasH } = this;
    const now = Date.now();

    // Fade out starts 3 seconds after the last input
    let alpha = 1;
    if (keyInput[keyInput.length - 1].time + 3000 <= now) {
      alpha = 1 - (now - keyInput[keyInput.length - 1].time - 3000) / 1000;
      if (alpha <= 0) return;
    }

    // A new input pushes the row aside
    let animDuration = 0;
    let animX = 0;
    if (keyInputTime + 100 >= now) {
      animDuration = 1 - easeOutQuart((now - keyInputTime) / 100);
      animX = animDuration * (canvasW / 100 + canvasW / 200);
    }

    for (let i = keyInput.length - 1; i >= 0; i--) {
      let j = i - keyInput.length + 13;
      let partAlpha = alpha;

      // Fade-in of the entering box
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

  /**
   * Draw the progress bar at the bottom.
   * @param {number} percentage - progress, 0 to 1
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
   * Draw the score panel and the album art.
   * @param {object} data - { score, combo, difficulty }
   * @param {HTMLImageElement} albumImg
   */
  scorePanelUI(data, albumImg) {
    const { ctx } = this;
    const { score, combo, difficulty } = data;
    const now = Date.now();

    // 1. Score animation
    const s = this.animState.score;

    // A changed score becomes the new target
    if (score !== s.target) {
      s.start = s.current;
      s.target = score;
      s.startTime = now;
    }

    // Counts up over 0.5s
    const scoreElapsed = now - s.startTime;
    if (scoreElapsed < 500) {
      const progress = easeOutQuart(scoreElapsed / 500);
      s.current = s.start + (s.target - s.start) * progress;
    } else {
      s.current = s.target;
    }

    // 2. Combo animation
    const c = this.animState.combo;

    // A higher combo restarts the pop
    if (combo > c.value) {
      c.startTime = now;
    }
    c.value = combo;

    // Pops for 0.5s, then shrinks back
    const comboElapsed = now - c.startTime;
    let comboScale = 0;
    if (comboElapsed < 500) {
      comboScale = Math.max(0, 1 - easeOutQuart(comboElapsed / 500));
    }

    // 3. Rendering
    ctx.save();

    ctx.beginPath();

    ctx.fillStyle = DiffColors[difficulty] ?? "#6021ff"; // EZ / MID / HARD / TEST

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

    const roundedSize = ~~(this.CONFIG.UI.DEFAULT_FONT_SIZE * (1 + comboScale));
    const roundedWeight = ~~(400 * (1 + comboScale * 0.5));
    ctx.font = `${roundedWeight} ${roundedSize}px Montserrat, Pretendard JP Variable`;
    ctx.fillText(`${combo}x`, xBase - margin, yBase + fontSize);

    ctx.restore();
  }

  /**
   * Draw the system info.
   * @param {object} info - { speed, bpm, fps }
   */
  systemInfoUI(info) {
    const { ctx, canvasW, canvasH } = this;
    const { speed, bpm, fps } = info;

    ctx.save();
    ctx.beginPath();

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#fff";
    ctx.font = this.FONT.systemInfo;
    ctx.textBaseline = "bottom";

    // Speed & BPM (bottom left)
    if (speed !== undefined && bpm !== undefined) {
      ctx.textAlign = "left";
      ctx.fillText(`Speed : ${speed}, BPM : ${bpm}`, canvasW / 100, canvasH - canvasH / 60);
    }

    // FPS (bottom right)
    if (fps !== undefined) {
      ctx.textAlign = "right";
      ctx.fillText(fps, canvasW - canvasW / 100, canvasH - canvasH / 70);
    }

    ctx.restore();
  }

  /** Editor: overlay prompting for a trigger. */
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

  /** Editor: centre crosshair. */
  axis() {
    const { ctx, canvasW, canvasH } = this;
    const tw = canvasW / 200;
    const th = canvasH / 200;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ed3a2680"; // red accent
    ctx.beginPath();

    ctx.moveTo(tw * 100, 0);
    ctx.lineTo(tw * 100, canvasH);
    ctx.moveTo(0, th * 100);
    ctx.lineTo(canvasW, th * 100);

    ctx.stroke();
    ctx.restore();
  }

  /** Editor: background mesh grid. */
  meshGrid() {
    const { ctx, canvasW, canvasH } = this;
    const tw = canvasW / 200;
    const th = canvasH / 200;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#bbbbbb20"; // light grey
    ctx.beginPath();

    let x1 = 0,
      x2 = tw * 5,
      y = 0;

    // Loops past the screen edges
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

  /**
   * Editor: radial grid.
   * @param {object} centerNote - pattern.patterns[i], the note at the centre
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
   * Editor: connector line between notes.
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
   * Editor: ghost of a note that already passed.
   * @param {object} note - { x, y, value, direction }
   * @param {number} alpha - opacity
   */
  noteShadow(note, alpha) {
    const { ctx } = this;
    const { x, y, value, direction } = note;
    const { cx, cy } = this.#getPos(x, y);

    let w = this.CONFIG.NOTE.WIDTH;

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
