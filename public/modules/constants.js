/** 게임 내 이펙트 및 렌더링 관련 상수/설정값을 관리합니다. */
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
  JUDGE_EFFECT: {
    LIFETIME: 500,
    DEFAULT_ANIM_Y_ADDER: 100,
    MISS_ANIM_Y_ADDER: -50,
    MISS_ANIM_ROTATE: 10,
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

/** 기본 판정 스킨 */
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

/** keyInput 오버레이 색상표 */
export const KeyInputColors = {
  Perfect: "#57BEEB",
  Great: "#73DFD2",
  Good: "#CCE97C",
  Bad: "#EDC77D",
  Miss: "#F96C5A",
  Bullet: "#E8A0A0",
  Empty: "#00000000",
};
