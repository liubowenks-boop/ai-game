import {
  BattleUiDesign,
  BattleUiV4Layout,
  RectSpec,
  rectsOverlap,
} from '../assets/scripts/ui/BattleUiLayout';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNear(actual: number, expected: number, message: string): void {
  if (Math.abs(actual - expected) > 0.001) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertInsideDesign(rect: RectSpec, name: string): void {
  const left = rect.x - rect.width / 2;
  const right = rect.x + rect.width / 2;
  const top = rect.y + rect.height / 2;
  const bottom = rect.y - rect.height / 2;

  assert(left >= -BattleUiDesign.halfWidth, `${name} exceeds left portrait edge`);
  assert(right <= BattleUiDesign.halfWidth, `${name} exceeds right portrait edge`);
  assert(top <= BattleUiDesign.halfHeight, `${name} exceeds top portrait edge`);
  assert(bottom >= -BattleUiDesign.halfHeight, `${name} exceeds bottom portrait edge`);
}

function assertRect(layout: Record<string, RectSpec>, key: string): RectSpec {
  const rect = layout[key];
  assert(!!rect, `${key} rect should be defined`);
  return rect;
}

function main(): void {
  const layout = BattleUiV4Layout;
  const layoutMap = layout as Record<string, RectSpec>;

  assert(
    !rectsOverlap(layout.upgradePanel, layout.autoButton),
    'auto button overlaps upgrade panel',
  );
  assert(
    !rectsOverlap(layout.upgradePanel, layout.ultimateButton),
    'ultimate button overlaps upgrade panel',
  );
  assert(!rectsOverlap(layout.heroBar, layout.ultimateButton), 'ultimate button overlaps hero bar');
  assertNear(
    layout.towerButton.y,
    layout.cityHp.y,
    'tower button center should align with city hp',
  );
  assertNear(layout.oilButton.y, layout.cityHp.y, 'oil button center should align with city hp');

  const cityHealthBar = assertRect(layoutMap, 'cityHealthBar');
  const comboBadge = assertRect(layoutMap, 'comboBadge');
  const statusLabel = assertRect(layoutMap, 'statusLabel');
  const buildHintLabel = assertRect(layoutMap, 'buildHintLabel');
  const placementTitle = assertRect(layoutMap, 'placementTitle');
  const placementPending = assertRect(layoutMap, 'placementPending');
  const upgradeScrim = assertRect(layoutMap, 'upgradeScrim');
  const wallSlotThunderMage = assertRect(layoutMap, 'wallSlotThunderMage');
  const wallSlotOrdinary1 = assertRect(layoutMap, 'wallSlotOrdinary1');
  const wallSlotOrdinary2 = assertRect(layoutMap, 'wallSlotOrdinary2');
  const wallSlotOrdinary3 = assertRect(layoutMap, 'wallSlotOrdinary3');
  const mainHeroUnit = assertRect(layoutMap, 'mainHeroUnit');
  const formation = [
    wallSlotThunderMage,
    wallSlotOrdinary1,
    mainHeroUnit,
    wallSlotOrdinary2,
    wallSlotOrdinary3,
  ];

  assert(
    JSON.stringify(formation.map((rect) => rect.x)) === JSON.stringify([-240, -120, 0, 120, 240]),
    'wall formation uses five evenly spaced x positions',
  );
  assert(
    formation.every((rect) => rect.y === -320),
    'wall formation shares one y coordinate',
  );
  for (let index = 1; index < formation.length; index += 1) {
    assert(!rectsOverlap(formation[index - 1], formation[index]), 'adjacent wall units overlap');
  }

  assert(!rectsOverlap(cityHealthBar, comboBadge), 'combo badge overlaps city health bar');
  assert(!rectsOverlap(cityHealthBar, statusLabel), 'status label overlaps city health bar');
  assert(!rectsOverlap(cityHealthBar, buildHintLabel), 'build hint overlaps city health bar');
  assert(!rectsOverlap(comboBadge, statusLabel), 'combo badge overlaps status label');
  assert(!rectsOverlap(comboBadge, buildHintLabel), 'combo badge overlaps build hint');
  assert(!rectsOverlap(statusLabel, buildHintLabel), 'status label overlaps build hint');
  assert(!rectsOverlap(statusLabel, layout.towerButton), 'status label overlaps tower button');
  assert(!rectsOverlap(buildHintLabel, layout.oilButton), 'build hint overlaps oil button');
  assert(!rectsOverlap(cityHealthBar, layout.towerButton), 'city health bar overlaps tower button');
  assert(!rectsOverlap(cityHealthBar, layout.oilButton), 'city health bar overlaps oil button');
  assert(
    !rectsOverlap(placementTitle, placementPending),
    'placement title overlaps pending placement label',
  );
  assert(!rectsOverlap(placementTitle, cityHealthBar), 'placement title overlaps city health bar');
  assert(
    !rectsOverlap(placementPending, cityHealthBar),
    'pending placement label overlaps city health bar',
  );
  assert(!rectsOverlap(placementTitle, layout.heroBar), 'placement title overlaps hero bar');
  assert(
    !rectsOverlap(placementPending, layout.heroBar),
    'pending placement label overlaps hero bar',
  );
  assertNear(layout.upgradePanel.x, 0, 'upgrade panel should be horizontally centered');
  assertNear(layout.upgradePanel.y, 0, 'upgrade panel should be vertically centered');
  assert(
    layout.upgradePanel.width >= 660,
    'upgrade panel should leave enough horizontal room for three choice cards',
  );
  assert(
    layout.upgradePanel.width <= BattleUiDesign.width - 32,
    'upgrade panel should keep portrait screen side margins',
  );
  assertNear(upgradeScrim.x, 0, 'upgrade dimmer should be horizontally centered');
  assertNear(upgradeScrim.y, 0, 'upgrade dimmer should be vertically centered');
  assertNear(
    upgradeScrim.width,
    BattleUiDesign.width,
    'upgrade dimmer should cover portrait width',
  );
  assertNear(
    upgradeScrim.height,
    BattleUiDesign.height,
    'upgrade dimmer should cover portrait height',
  );
  assert(
    !rectsOverlap(layout.upgradePanel, layout.topHud),
    'centered upgrade panel should not overlap top hud',
  );
  assert(
    !rectsOverlap(layout.upgradePanel, layout.heroBar),
    'centered upgrade panel should not overlap bottom hero bar',
  );

  for (const gridRect of formation) {
    assert(!rectsOverlap(statusLabel, gridRect), 'status label overlaps board units');
    assert(!rectsOverlap(buildHintLabel, gridRect), 'build hint overlaps board units');
    assert(!rectsOverlap(placementTitle, gridRect), 'placement title overlaps board units');
    assert(
      !rectsOverlap(placementPending, gridRect),
      'pending placement label overlaps board units',
    );
    assert(!rectsOverlap(cityHealthBar, gridRect), 'city health bar overlaps board units');
  }

  for (const [name, rect] of Object.entries(layout)) {
    assertInsideDesign(rect, name);
  }

  console.log('pass: v4 UI safe zones do not overlap');
}

main();
