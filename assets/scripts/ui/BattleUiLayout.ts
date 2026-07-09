export interface RectSpec {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const BattleUiDesign = {
  width: 720,
  height: 1280,
  halfWidth: 360,
  halfHeight: 640,
} as const;

function fromTopLeft(x: number, y: number, width: number, height: number): RectSpec {
  return {
    x: x - BattleUiDesign.halfWidth + width / 2,
    y: BattleUiDesign.halfHeight - y - height / 2,
    width,
    height,
  };
}

function fromCenter(x: number, y: number, width: number, height: number): RectSpec {
  return { x, y, width, height };
}

export const BattleUiV4Layout = {
  topHud: fromTopLeft(16, 16, 688, 87),
  battleArea: fromTopLeft(0, 102, 720, 768),
  cityHp: fromTopLeft(180, 835, 360, 40),
  cityHealthBar: fromTopLeft(210, 832, 300, 46),
  comboBadge: fromCenter(0, -150, 216, 48),
  statusLabel: fromCenter(-235, -154, 160, 28),
  buildHintLabel: fromCenter(235, -154, 190, 28),
  placementTitle: fromCenter(0, -462, 360, 28),
  placementPending: fromCenter(0, -492, 360, 24),
  gridSlotFront1: fromCenter(-220, -285, 108, 66),
  gridSlotFront2: fromCenter(0, -285, 108, 66),
  gridSlotFront3: fromCenter(220, -285, 108, 66),
  gridSlotBack1: fromCenter(-150, -405, 108, 66),
  gridSlotBack2: fromCenter(150, -405, 108, 66),
  mainHeroUnit: fromCenter(0, -405, 72, 72),
  towerButton: fromTopLeft(22, 810, 76, 90),
  oilButton: fromTopLeft(622, 810, 76, 90),
  upgradeScrim: fromCenter(0, 0, BattleUiDesign.width, BattleUiDesign.height),
  upgradePanel: fromCenter(0, 0, 672, 380),
  rightActionRail: fromTopLeft(626, 922, 72, 326),
  autoButton: fromTopLeft(626, 979, 76, 76),
  heroBar: fromTopLeft(150, 1144, 420, 96),
  ultimateButton: fromTopLeft(576, 1134, 123, 123),
  bottomStatus: fromTopLeft(180, 1248, 360, 28),
} as const;

export function rectsOverlap(a: RectSpec, b: RectSpec): boolean {
  const ax0 = a.x - a.width / 2;
  const ax1 = a.x + a.width / 2;
  const ay0 = a.y - a.height / 2;
  const ay1 = a.y + a.height / 2;
  const bx0 = b.x - b.width / 2;
  const bx1 = b.x + b.width / 2;
  const by0 = b.y - b.height / 2;
  const by1 = b.y + b.height / 2;
  return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
}
