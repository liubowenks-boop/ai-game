import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BattleMvpModel } from '../assets/scripts/battle/BattleMvpModel';
import { BattleUiV4Layout, RectSpec, rectsOverlap } from '../assets/scripts/ui/BattleUiLayout';

const gridPlacementSource = readFileSync(
  'assets/scripts/battle/GridPlacementSystem.ts',
  'utf8',
);
const battleUiComponentsSource = readFileSync(
  'assets/scripts/ui/BattleUiComponents.ts',
  'utf8',
);
const battleControllerSource = readFileSync(
  'assets/scripts/battle/BattleController.ts',
  'utf8',
);

function sourceSection(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `source should contain start marker: ${start}`);

  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `source should contain end marker: ${end}`);
  assert.ok(endIndex > startIndex, `end marker should follow start marker: ${end}`);

  return source.slice(startIndex, endIndex);
}

function runTest(name: string, testBody: () => void): void {
  testBody();
  console.log(`pass: ${name}`);
}

function requireRect(key: keyof typeof BattleUiV4Layout): RectSpec {
  const rect = BattleUiV4Layout[key];
  assert.ok(rect, `${String(key)} should exist`);
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
  assert.equal(frontRects[1].x - frontRects[0].x, frontRects[2].x - frontRects[1].x);
  assert.equal(new Set(frontRects.map((rect) => rect.y)).size, 1);
  assert.ok(frontRects.every((rect) => rect.width === 82 && rect.height === 82));

  assert.deepEqual(
    backRects.map((rect) => rect.x),
    [-210, 0, 210],
  );
  assert.deepEqual(
    backRects.map((rect) => rect.y),
    [-410, -410, -410],
  );
  assert.equal(backRects[1].x - backRects[0].x, backRects[2].x - backRects[1].x);
  assert.equal(new Set(backRects.map((rect) => rect.y)).size, 1);
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
  const portraitSlotKeys = [
    'heroAvatarSlot1',
    'heroAvatarSlot2',
    'heroAvatarSlot3',
    'heroAvatarSlot4',
    'heroAvatarSlot5',
    'heroAvatarSlot6',
  ] as const;
  const portraitRects = portraitSlotKeys.map((key) => requireRect(key));

  assert.deepEqual(
    portraitRects.map((rect) => rect.x),
    [-160, -96, -32, 32, 96, 160],
  );
  assert.ok(portraitRects.every((rect) => rect.y === BattleUiV4Layout.heroBar.y));
  assert.ok(portraitRects.every((rect) => rect.width === 56 && rect.height === 72));

  const heroBar = BattleUiV4Layout.heroBar;
  const heroBarLeft = heroBar.x - heroBar.width / 2;
  const heroBarRight = heroBar.x + heroBar.width / 2;
  const heroBarBottom = heroBar.y - heroBar.height / 2;
  const heroBarTop = heroBar.y + heroBar.height / 2;

  portraitRects.forEach((rect, index) => {
    const isInsideHeroBar =
      rect.x - rect.width / 2 >= heroBarLeft &&
      rect.x + rect.width / 2 <= heroBarRight &&
      rect.y - rect.height / 2 >= heroBarBottom &&
      rect.y + rect.height / 2 <= heroBarTop;
    assert.ok(isInsideHeroBar, `${portraitSlotKeys[index]} should fit inside heroBar`);
  });

  for (let index = 1; index < portraitRects.length; index += 1) {
    const previousRect = portraitRects[index - 1];
    const currentRect = portraitRects[index];
    const gap = currentRect.x - currentRect.width / 2 - (previousRect.x + previousRect.width / 2);

    assert.equal(gap, 8);
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

runTest('bottom rail creates six text-free rectangular portrait slots', () => {
  const heroAvatarSlotViewSource = sourceSection(
    battleUiComponentsSource,
    'export class HeroAvatarSlotView {',
    'export interface UpgradeCardViewOptions {',
  );
  const createBottomHudLayerSource = sourceSection(
    battleControllerSource,
    'private createBottomHudLayer(): void {',
    'private createCanvas(): Node {',
  );
  const refreshHeroAvatarBarSource = sourceSection(
    battleControllerSource,
    'private refreshHeroAvatarBar(): void {',
    'private drawPlayerVisual(',
  );

  assert.match(createBottomHudLayerSource, /BattleUiV4Layout\.heroAvatarSlot1/);
  assert.match(createBottomHudLayerSource, /BattleUiV4Layout\.heroAvatarSlot2/);
  assert.match(createBottomHudLayerSource, /BattleUiV4Layout\.heroAvatarSlot3/);
  assert.match(createBottomHudLayerSource, /BattleUiV4Layout\.heroAvatarSlot4/);
  assert.match(createBottomHudLayerSource, /BattleUiV4Layout\.heroAvatarSlot5/);
  assert.match(createBottomHudLayerSource, /BattleUiV4Layout\.heroAvatarSlot6/);
  assert.match(heroAvatarSlotViewSource, /public constructor\(\s*x: number,\s*y: number,\s*public readonly width: number,\s*public readonly height: number,/s);
  assert.match(heroAvatarSlotViewSource, /this\.node\.getChildByName\('AvatarSkin'\)\?\.active = false;/);
  assert.match(heroAvatarSlotViewSource, /this\.node\.getChildByName\('AvatarLabel'\)\?\.active = false;/);
  assert.equal(heroAvatarSlotViewSource.includes("t('hud.empty')"), false);
  assert.equal(/Lv\$\{level\}/.test(heroAvatarSlotViewSource), false);
  assert.equal(/heroName\\n/.test(heroAvatarSlotViewSource), false);
  assert.equal(/private readonly label: Label;/.test(heroAvatarSlotViewSource), false);
  assert.equal(/role/i.test(heroAvatarSlotViewSource), false);
  assert.equal(heroAvatarSlotViewSource.includes('空位'), false);
  assert.equal(heroAvatarSlotViewSource.includes('待招募'), false);
  assert.match(heroAvatarSlotViewSource, /graphics\.roundRect\(/);
  assert.equal(/graphics\.circle\(/.test(heroAvatarSlotViewSource), false);
  assert.match(createBottomHudLayerSource, /rect\.x/);
  assert.match(createBottomHudLayerSource, /rect\.y/);
  assert.match(createBottomHudLayerSource, /rect\.width/);
  assert.match(createBottomHudLayerSource, /rect\.height/);
  assert.match(createBottomHudLayerSource, /nodeName: `HeroAvatarSlot\$\{index \+ 1\}`/);
  assert.match(refreshHeroAvatarBarSource, /\.refresh\(\s*hero\?\.name \?\? '',\s*Boolean\(/s);
  assert.equal(/hero\?\.level/.test(refreshHeroAvatarBarSource), false);
  assert.equal(/Lv/.test(refreshHeroAvatarBarSource), false);
});

runTest('deployable positions draw circles instead of rounded rectangles', () => {
  const drawSlotButtonSource = sourceSection(
    gridPlacementSource,
    'private drawSlotButton(',
    'private refreshSlotPortrait(',
  );
  const drawPlainButtonSource = sourceSection(
    gridPlacementSource,
    'private drawPlainButton(',
    'private createLabel(',
  );
  const getSlotTextSource = sourceSection(
    gridPlacementSource,
    'private getSlotText(',
    'private getSlotColor(',
  );
  const getSlotColorSource = sourceSection(
    gridPlacementSource,
    'private getSlotColor(',
    'private getVisualSlotRect(',
  );
  const getVisualSlotRectSource = sourceSection(
    gridPlacementSource,
    'private getVisualSlotRect(',
    'private drawSlotButton(',
  );
  const refreshSlotPortraitSource = sourceSection(
    gridPlacementSource,
    'private refreshSlotPortrait(',
    'private createButton(',
  );
  const createButtonSource = sourceSection(
    gridPlacementSource,
    'private createButton(',
    'private drawPlainButton(',
  );

  assert.match(drawSlotButtonSource, /const radius = view\.width \/ 2;/);
  assert.match(drawSlotButtonSource, /view\.graphics\.circle\(0, 0, radius\);/);
  assert.equal(drawSlotButtonSource.includes('roundRect'), false);
  assert.equal(drawSlotButtonSource.includes('radius +'), false);
  assert.match(drawSlotButtonSource, /new Color\(190, 116, 70, 255\)/);
  assert.match(drawSlotButtonSource, /new Color\(255, 226, 151, 255\)/);
  assert.match(
    drawSlotButtonSource,
    /if \(highlighted\) \{\s*view\.graphics\.strokeColor = new Color\(255, 226, 151, 255\);\s*view\.graphics\.lineWidth = 6;\s*view\.graphics\.circle\(0, 0, radius\);\s*view\.graphics\.stroke\(\);\s*\}/,
  );
  assert.match(drawPlainButtonSource, /const radius = view\.width \/ 2;/);
  assert.match(drawPlainButtonSource, /view\.graphics\.circle\(0, 0, radius\);/);
  assert.equal(drawPlainButtonSource.includes('roundRect'), false);
  assert.match(getSlotTextSource, /return slot\.hero \? '' : slot\.label;/);
  assert.match(
    getSlotColorSource,
    /return slot\.row === 'front' \? new Color\(80, 39, 28, 230\) : new Color\(65, 34, 27, 230\);/,
  );
  assert.match(
    getVisualSlotRectSource,
    /positions\[slot\.index\] \?\? \{ x: slot\.position\.x, y: slot\.position\.y, width: 82, height: 82 \}/,
  );
  assert.match(refreshSlotPortraitSource, /const portraitSize = view\.width - 16;/);
  assert.match(refreshSlotPortraitSource, /new Node\('SlotHeroPortraitMask'\)/);
  assert.match(refreshSlotPortraitSource, /portraitTransform\.setContentSize\(portraitSize, portraitSize\);/);
  assert.match(refreshSlotPortraitSource, /mask\.type = Mask\.Type\.ELLIPSE;/);
  assert.match(refreshSlotPortraitSource, /mask\.segments = 48;/);
  assert.match(createButtonSource, /labelNode\.setPosition\(0, 0, 0\);/);
});

runTest('formation animation keeps ring centers fixed', () => {
  const updateAnimationsSource = sourceSection(
    gridPlacementSource,
    'public updateAnimations(',
    'public recruitFromUpgrade(',
  );

  assert.match(
    updateAnimationsSource,
    /view\.node\.setPosition\(view\.baseX \?\? view\.node\.position\.x, view\.baseY \?\? view\.node\.position\.y, 0\);/,
  );
  assert.match(updateAnimationsSource, /view\.node\.setScale\(1, 1, 1\);/);
  assert.match(updateAnimationsSource, /view\.node\.angle = 0;/);
  assert.match(updateAnimationsSource, /view\.portraitNode\.setPosition\(/);
  assert.match(updateAnimationsSource, /view\.portraitNode\.setScale\(/);
  assert.match(updateAnimationsSource, /view\.portraitNode\.angle = pose\.rotation \* 0\.35;/);
  assert.match(updateAnimationsSource, /view\.portraitNode\.setPosition\(pose\.offsetX \* 0\.35, pose\.offsetY \* 0\.35, 0\);/);
  assert.match(updateAnimationsSource, /const focusScale = highlighted \? 1\.04 : 1;/);
  assert.equal(
    /\(view\.baseX \?\? view\.node\.position\.x\) \+ pose\.offsetX/.test(
      updateAnimationsSource,
    ),
    false,
  );
  assert.equal(
    /\(view\.baseY \?\? view\.node\.position\.y\) \+ pose\.offsetY/.test(
      updateAnimationsSource,
    ),
    false,
  );
  assert.equal(/view\.node\.setScale\(focusScale \*/.test(updateAnimationsSource), false);
  assert.equal(/view\.node\.angle = pose\.rotation/.test(updateAnimationsSource), false);
});
