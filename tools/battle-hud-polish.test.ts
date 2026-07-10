import assert from 'node:assert/strict';

import { BattleMvpModel } from '../assets/scripts/battle/BattleMvpModel';
import {
  BattleUiV4Layout,
  RectSpec,
  rectsOverlap,
} from '../assets/scripts/ui/BattleUiLayout';

function runTest(name: string, testBody: () => void): void {
  testBody();
  console.log(`pass: ${name}`);
}

function requireRect(name: string): RectSpec {
  const rect = (BattleUiV4Layout as Record<string, RectSpec | undefined>)[name];
  assert.ok(rect, `${name} rect should be defined`);
  return rect;
}

runTest('formation uses two aligned rows with a protected main-hero center', () => {
  const frontRects = [
    requireRect('gridSlotFront1'),
    requireRect('gridSlotFront2'),
    requireRect('gridSlotFront3'),
  ];
  const backRects = [
    requireRect('gridSlotBack1'),
    requireRect('mainHeroUnit'),
    requireRect('gridSlotBack2'),
  ];

  assert.deepEqual(
    frontRects.map((rect) => rect.x),
    [-210, 0, 210],
  );
  assert.deepEqual(
    frontRects.map((rect) => rect.y),
    [-300, -300, -300],
  );
  assert.ok(frontRects.every((rect) => rect.width === 82 && rect.height === 82));

  assert.deepEqual(
    backRects.map((rect) => rect.x),
    [-210, 0, 210],
  );
  assert.deepEqual(
    backRects.map((rect) => rect.y),
    [-410, -410, -410],
  );
  assert.ok(backRects.every((rect) => rect.width === 82 && rect.height === 82));

  const model = new BattleMvpModel();
  assert.deepEqual(
    model.slots.map((slot) => slot.position.x),
    [-210, 0, 210, -210, 210],
  );
  assert.deepEqual(
    model.slots.map((slot) => slot.position.y),
    [-300, -300, -300, -410, -410],
  );
  assert.deepEqual(model.playerPosition, { x: 0, y: -410 });
});

runTest('six fixed portrait slots fit the hero rail without overlap', () => {
  const portraitRects = Array.from({ length: 6 }, (_, index) =>
    requireRect(`heroAvatarSlot${index + 1}`),
  );

  assert.deepEqual(
    portraitRects.map((rect) => rect.x),
    [-160, -96, -32, 32, 96, 160],
  );
  assert.ok(portraitRects.every((rect) => rect.y === BattleUiV4Layout.heroBar.y));
  assert.ok(portraitRects.every((rect) => rect.width === 56 && rect.height === 72));

  for (let index = 1; index < portraitRects.length; index += 1) {
    assert.equal(rectsOverlap(portraitRects[index - 1], portraitRects[index]), false);
  }

  const mainHeroUnit = requireRect('mainHeroUnit');
  const placementTitle = requireRect('placementTitle');
  const placementPending = requireRect('placementPending');
  const cityHealthBar = requireRect('cityHealthBar');
  const gridSlotFront2 = requireRect('gridSlotFront2');

  assert.equal(rectsOverlap(mainHeroUnit, placementTitle), false);
  assert.equal(rectsOverlap(mainHeroUnit, placementPending), false);
  assert.equal(rectsOverlap(mainHeroUnit, BattleUiV4Layout.heroBar), false);
  assert.equal(rectsOverlap(placementTitle, BattleUiV4Layout.heroBar), false);
  assert.equal(rectsOverlap(placementPending, BattleUiV4Layout.heroBar), false);
  assert.equal(rectsOverlap(cityHealthBar, gridSlotFront2), false);
});
