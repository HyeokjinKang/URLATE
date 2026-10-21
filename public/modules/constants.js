/** Constants and settings for in-game effects and rendering. */
export const Config = {
  MATH: {
    PI_5: Math.PI / 5,
    COS_36: Math.cos(Math.PI / 5),
    SIN_36: Math.sin(Math.PI / 5),
  },
  UI: {
    DEFAULT_FONT_SIZE: 30,
    DEBUG_TEXT_LINE_WIDTH: 3,
    SCORE_PANEL: {
      X_BASE: 920,
      Y_BASE: 50,
      SIZE: 200 / 3,
      PADDING: 4,
      MARGIN: 10,
      BORDER: 2,
      FONT_SIZE: 40,
    },
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
  NOTE_HIT_EFFECT: {
    LIFETIME: 990,
    JUDGE_SCALE: { perfect: 1, great: 0.78, good: 0.58, bad: 0.4 },
    GLOW: { LIFETIME: 300, RADIUS: 1.5, OPACITY: 0.65 },
    RING: { LIFETIME: 500, START: 0.9, SPREAD: 1.3, LINE_WIDTH: 5, SWELL: 0.35, FADE_POWER: 3 },
    DUST: {
      COUNT: 12,
      DELAY_MAX: 40,
      LIFETIME_MIN: 600,
      LIFETIME_MAX: 950,
      SPEED_MIN: 3,
      SPEED_MAX: 7.5,
      DRAG: 5,
      RISE: 0.7,
      SIZE_MIN: 0.05,
      SIZE_MAX: 0.1,
      GROW: 0.15,
      SHRINK: 0.4,
      TWINKLE: 30,
    },
    SCANLINE: { LIFETIME: 240, OPACITY: 0.28, REACH: 0.6, HEIGHT: 1.5 },
  },
  JUDGE_EFFECT: {
    LIFETIME: 700,
    STAGGER: 22,
    ENTER_DURATION: 220,
    RISE: 10,
    SPACING_FROM: 0.06,
    SPACING_DURATION: 360,
    WHITE_DURATION: 160,
    WHITE_OPACITY: 0.6,
    FADE_IN: 50,
    EXIT_FROM: 0.62,
    EXIT_DURATION: 0.3,
    EXIT_RISE: 14,
    FONT_WEIGHT: 600,
    MISS_FALL: 55,
    MISS_SPACING: 0.12,
    TIMING: { DELAY: 80, FADE_IN: 100, OFFSET: 0.8, SIZE: 0.4, SPACING: 0.14 },
  },
  FINAL_EFFECT: {
    LIFETIME: 2000,
    BACKGROUND: {
      FONT_SIZE: 195,
      START_X: 200,
      FINAL_X: 50,
      Y: 50,
    },
    MAIN: {
      LINE_WIDTH: 6,
      FONT_SIZE_START: 195,
      FONT_SIZE_END: 140,
    },
    OUTLINE: {
      LINE_WIDTH: 3,
      FONT_SIZE_START: 250,
      FONT_SIZE_END: 195,
    },
  },
};

/** Default judgement skin. */
export const JudgeSkin = {
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

export const TimingColors = {
  FAST: "#6FB7FF",
  LATE: "#FF8A6F",
};

/** Colour table for the keyInput overlay. */
export const KeyInputColors = {
  Perfect: "#57BEEB",
  Great: "#73DFD2",
  Good: "#CCE97C",
  Bad: "#EDC77D",
  Miss: "#F96C5A",
  Bullet: "#E8A0A0",
  Empty: "#00000000",
};

export const DiffColors = ["#31A97E", "#F0C21D", "#FF774B"];
