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
    wave: rect(0, 4, 300, 70),
    remainingEnemies: rect(0, 78, 190, 76),
    gold: rect(440, 4, 268, 70),
    bossTitle: rect(310, 76, 150, 60),
    bossHealth: rect(196, 126, 380, 92),
    pauseResume: rect(610, 84, 96, 96),
    auto: rect(602, 292, 104, 104),
    statistics: rect(602, 410, 104, 104),
    cityDurability: rect(145, 1024, 430, 96),
    bond: rect(10, 1142, 110, 110),
    ultimate: rect(590, 1130, 124, 124),
  },
  tracks: {
    boss: { x: 42, y: -3, width: 306, height: 24, radius: 12 },
    city: { x: 40, y: -1, width: 330, height: 30, radius: 15 },
  } satisfies Record<string, HudTrackSpec>,
  fontSizes: {
    wave: 25,
    remainingEnemies: 25,
    gold: 26,
    percent: 22,
    ultimate: 17,
  },
} as const;

export function hudRectsOverlap(left: HudRect, right: HudRect): boolean {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}
