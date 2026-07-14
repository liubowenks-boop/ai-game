export interface HudRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HudTrackSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export type HudColorTuple = readonly [number, number, number, number];
export type GemPaletteName = 'ruby' | 'emerald' | 'topaz';

export interface GemPaletteSpec {
  base: HudColorTuple;
  main: HudColorTuple;
  highlight: HudColorTuple;
  shadow: HudColorTuple;
  glint: HudColorTuple;
  facet: HudColorTuple;
}

export interface RightControlRects {
  pauseResume: HudRect;
  auto: HudRect;
  statistics: HudRect;
}

function rect(x: number, y: number, width: number, height: number): HudRect {
  return { x, y, width, height };
}

/**
 * Battle HUD layout in top-left design coordinates.
 *
 * x/y are measured from the top-left corner of a 720 x 1280 canvas. Keeping
 * every editable value here makes later visual tuning independent from the
 * view/controller implementation.
 */
export const BattleHudConfig = {
  designWidth: 720,
  designHeight: 1280,
  totalWaves: 50,
  maximumUltimate: 100,
  layout: {
    wave: rect(0, 4, 150, 35),
    remainingEnemies: rect(0, 45, 150, 60),
    gold: rect(574, 4, 134, 35),
    bossTitle: rect(322.5, 34, 75, 30),
    bossHealth: rect(158, 66, 404, 76),
    cityDurability: rect(90, 1040, 540, 64),
    bond: rect(10, 1197, 55, 55),
    ultimate: rect(590, 1130, 124, 124),
  },
  rightControls: {
    right: 14,
    top: 92,
    itemWidth: 52,
    itemHeight: 52,
    spacing: 0,
    pauseSkinWidth: 48,
    pauseSkinHeight: 48,
  },
  valueLabels: {
    wave: { x: 0, y: 0, width: 150, height: 21 },
    remainingEnemies: { x: 0, y: -14, width: 100, height: 28 },
    gold: { x: 21, y: 0, width: 77, height: 20 },
  },
  tracks: {
    boss: { x: 20, y: -2, width: 315, height: 22, radius: 0 },
    city: { x: 54, y: -1, width: 378, height: 24, radius: 0 },
  } satisfies Record<string, HudTrackSpec>,
  fontSizes: {
    wave: 12.5,
    remainingEnemies: 22,
    gold: 13,
    percent: 18,
    ultimate: 17,
  },
  cityThresholds: {
    healthy: 0.55,
    warning: 0.28,
  },
  gemPalettes: {
    ruby: {
      base: [72, 8, 17, 255],
      main: [214, 31, 57, 255],
      highlight: [255, 106, 64, 170],
      shadow: [87, 5, 24, 190],
      glint: [255, 235, 206, 190],
      facet: [255, 70, 70, 70],
    },
    emerald: {
      base: [5, 61, 47, 255],
      main: [24, 189, 132, 255],
      highlight: [91, 255, 200, 170],
      shadow: [1, 70, 55, 190],
      glint: [214, 255, 237, 190],
      facet: [76, 232, 174, 70],
    },
    topaz: {
      base: [89, 45, 4, 255],
      main: [235, 153, 26, 255],
      highlight: [255, 222, 92, 170],
      shadow: [117, 54, 3, 190],
      glint: [255, 250, 210, 190],
      facet: [255, 193, 55, 70],
    },
  } satisfies Record<GemPaletteName, GemPaletteSpec>,
} as const;

export function getRightControlRects(): RightControlRects {
  const config = BattleHudConfig.rightControls;
  const x = BattleHudConfig.designWidth - config.right - config.itemWidth;
  const step = config.itemHeight + config.spacing;
  return {
    pauseResume: rect(x, config.top, config.itemWidth, config.itemHeight),
    auto: rect(x, config.top + step, config.itemWidth, config.itemHeight),
    statistics: rect(x, config.top + step * 2, config.itemWidth, config.itemHeight),
  };
}

export function getCityGemPaletteName(ratio: number): GemPaletteName {
  const safeRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  if (safeRatio > BattleHudConfig.cityThresholds.healthy) {
    return 'emerald';
  }
  if (safeRatio > BattleHudConfig.cityThresholds.warning) {
    return 'topaz';
  }
  return 'ruby';
}

export function hudRectsOverlap(left: HudRect, right: HudRect): boolean {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}
