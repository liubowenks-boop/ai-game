import { BattleUiDesign, BattleUiV4Layout, RectSpec, rectsOverlap } from '../assets/scripts/ui/BattleUiLayout';

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

function main(): void {
  const layout = BattleUiV4Layout;

  assert(!rectsOverlap(layout.upgradePanel, layout.autoButton), 'auto button overlaps upgrade panel');
  assert(!rectsOverlap(layout.upgradePanel, layout.ultimateButton), 'ultimate button overlaps upgrade panel');
  assert(!rectsOverlap(layout.heroBar, layout.ultimateButton), 'ultimate button overlaps hero bar');
  assert(!rectsOverlap(layout.upgradePanel, layout.towerButton), 'tower button overlaps upgrade panel');
  assert(!rectsOverlap(layout.upgradePanel, layout.oilButton), 'oil button overlaps upgrade panel');
  assertNear(layout.towerButton.y, layout.cityHp.y, 'tower button center should align with city hp');
  assertNear(layout.oilButton.y, layout.cityHp.y, 'oil button center should align with city hp');

  for (const [name, rect] of Object.entries(layout)) {
    assertInsideDesign(rect, name);
  }

  console.log('pass: v4 UI safe zones do not overlap');
}

main();
