import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BattleMvpModel } from '../assets/scripts/battle/BattleMvpModel';
import { computeProceduralAnimationPose } from '../assets/scripts/battle/UnitAnimationSystem';
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

runTest('formation uses one aligned wall row with a protected main-hero center', () => {
  const formation = [
    requireRect('wallSlotThunderMage'),
    requireRect('wallSlotOrdinary1'),
    requireRect('mainHeroUnit'),
    requireRect('wallSlotOrdinary2'),
    requireRect('wallSlotOrdinary3'),
  ];

  assert.deepEqual(
    formation.map((rect) => rect.x),
    [-240, -120, 0, 120, 240],
  );
  assert.deepEqual(
    formation.map((rect) => rect.y),
    [-320, -320, -320, -320, -320],
  );
  assert.ok(formation.every((rect) => rect.width <= 96 && rect.height <= 112));
  for (let index = 1; index < formation.length; index += 1) {
    assert.equal(rectsOverlap(formation[index - 1], formation[index]), false);
  }

  const model = new BattleMvpModel();
  assert.deepEqual(
    model.slots.map((slot) => slot.position.x),
    [-120, 120, 240, -240],
  );
  assert.deepEqual(
    model.slots.map((slot) => slot.position.y),
    [-320, -320, -320, -320],
  );
  assert.deepEqual(model.playerPosition, { x: 0, y: -320 });

  const animationStates = ['idle', 'walk', 'attack', 'cast', 'hit', 'death', 'spawn'] as const;
  const auraOuterRadius = 58 + 3 / 2;
  const highlightedPlayerScale = 1 + 0.065;
  const heroBarStrokeWidth = 3;
  const heroBarStrokeOuterTop =
    BattleUiV4Layout.heroBar.y +
    BattleUiV4Layout.heroBar.height / 2 +
    heroBarStrokeWidth / 2;
  let dynamicAuraBottom = Number.POSITIVE_INFINITY;

  for (const state of animationStates) {
    for (let sample = 0; sample <= 2000; sample += 1) {
      const pose = computeProceduralAnimationPose(state, sample / 1000, 'hero');
      const frameBottom =
        model.playerPosition.y +
        pose.offsetY -
        auraOuterRadius * highlightedPlayerScale * pose.scaleY;
      dynamicAuraBottom = Math.min(dynamicAuraBottom, frameBottom);
    }
  }

  for (const infoRow of [BattleUiV4Layout.placementTitle, BattleUiV4Layout.placementPending]) {
    const infoTop = infoRow.y + infoRow.height / 2;
    const infoBottom = infoRow.y - infoRow.height / 2;

    assert.ok(infoTop < dynamicAuraBottom, 'dynamic main-hero aura needs a positive info gap');
    assert.ok(
      infoBottom > heroBarStrokeOuterTop,
      'formation info needs a positive gap above the hero-bar stroke',
    );
  }

  assert.equal(BattleUiV4Layout.placementTitle.y, -489);
  assert.equal(BattleUiV4Layout.placementPending.y, -489);
  assert.equal(BattleUiV4Layout.heroBar.y, -552);
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
  const wallSlotOrdinary1 = requireRect('wallSlotOrdinary1');

  assert.equal(rectsOverlap(mainHeroUnit, placementTitle), false);
  assert.equal(rectsOverlap(mainHeroUnit, placementPending), false);
  assert.equal(rectsOverlap(mainHeroUnit, BattleUiV4Layout.heroBar), false);
  assert.equal(rectsOverlap(placementTitle, BattleUiV4Layout.heroBar), false);
  assert.equal(rectsOverlap(placementPending, BattleUiV4Layout.heroBar), false);
  assert.equal(rectsOverlap(cityHealthBar, wallSlotOrdinary1), false);
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
  assert.match(
    heroAvatarSlotViewSource,
    /for \(const legacyName of \['AvatarSkin', 'AvatarLabel'\]\) \{\s*const legacyNode = this\.node\.getChildByName\(legacyName\);\s*if \(legacyNode\) \{\s*legacyNode\.active = false;\s*\}\s*\}/s,
  );
  assert.doesNotMatch(battleUiComponentsSource, /\?\.active\s*=/);
  assert.equal(heroAvatarSlotViewSource.includes("t('hud.empty')"), false);
  assert.equal(/Lv\$\{level\}/.test(heroAvatarSlotViewSource), false);
  assert.equal(/heroName\\n/.test(heroAvatarSlotViewSource), false);
  assert.equal(/private readonly label: Label;/.test(heroAvatarSlotViewSource), false);
  assert.equal(/role/i.test(heroAvatarSlotViewSource), false);
  assert.equal(heroAvatarSlotViewSource.includes('空位'), false);
  assert.equal(heroAvatarSlotViewSource.includes('待招募'), false);
  assert.match(heroAvatarSlotViewSource, /graphics\.roundRect\(/);
  assert.equal(/graphics\.circle\(/.test(heroAvatarSlotViewSource), false);
  assert.match(
    heroAvatarSlotViewSource,
    /if \(filename !== this\.portraitFilename && this\.portraitNode\) \{\s*this\.portraitNode\.active = false;\s*this\.portraitNode\.destroy\(\);\s*this\.portraitNode = undefined;\s*\}/s,
  );
  assert.match(
    heroAvatarSlotViewSource,
    /this\.portraitNode = createUiArtSkinNode\(\s*this\.node,\s*filename,\s*this\.width - 6,\s*this\.height - 6,\s*'AvatarPortrait',\s*\);/s,
  );
  assert.equal(/bindOrCreateUiArtSkinNode/.test(heroAvatarSlotViewSource), false);
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
  const createSlotButtonSource = sourceSection(
    gridPlacementSource,
    'private createSlotButton(',
    'private getSlotText(',
  );
  const reservedSlotHelperSource = sourceSection(
    gridPlacementSource,
    'private isFixedCompanionSlot(',
    'private createButton(',
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
  assert.match(getSlotTextSource, /return '';/);
  assert.match(getSlotColorSource, /return new Color\(65, 34, 27, 210\);/);
  assert.match(getVisualSlotRectSource, /wallSlotThunderMage/);
  assert.match(getVisualSlotRectSource, /wallSlotOrdinary1/);
  assert.match(getVisualSlotRectSource, /wallSlotOrdinary2/);
  assert.match(getVisualSlotRectSource, /wallSlotOrdinary3/);
  assert.equal(/gridSlotFront|gridSlotBack/.test(getVisualSlotRectSource), false);
  assert.match(
    getVisualSlotRectSource,
    /positions\[slot\.index\] \?\? \{ x: slot\.position\.x, y: slot\.position\.y, width: 82, height: 82 \}/,
  );
  assert.match(
    createSlotButtonSource,
    /const button = view\.node\.getComponent\(Button\);\s*if \(button\) \{\s*button\.interactable = !slot\.reservedBy;\s*\}/s,
  );
  assert.match(
    createSlotButtonSource,
    /if \(this\.isFixedCompanionSlot\(slot\)\) \{\s*return;\s*\}\s*if \(!this\.pendingHeroName\) \{/s,
  );
  assert.match(reservedSlotHelperSource, /return slot\.reservedBy === 'fixed_companion';/);
  assert.match(
    refreshSlotPortraitSource,
    /if \(this\.isFixedCompanionSlot\(slot\) && !slot\.hero\) \{\s*if \(view\.portraitNode\) \{\s*view\.portraitNode\.active = false;\s*\}\s*view\.portraitFilename = '';\s*return;\s*\}/s,
  );
  assert.match(refreshSlotPortraitSource, /const portraitSize = view\.width - 16;/);
  assert.match(refreshSlotPortraitSource, /new Node\('SlotHeroPortraitMask'\)/);
  assert.match(refreshSlotPortraitSource, /portraitTransform\.setContentSize\(portraitSize, portraitSize\);/);
  assert.match(refreshSlotPortraitSource, /mask\.type = Mask\.Type\.ELLIPSE;/);
  assert.match(refreshSlotPortraitSource, /mask\.segments = 48;/);
  assert.match(refreshSlotPortraitSource, /view\.unitNode\?\.addChild\(portraitNode\);/);
  assert.match(createButtonSource, /labelNode\.setPosition\(0, 0, 0\);/);
  assert.match(
    gridPlacementSource,
    /public constructor\(\s*backingParent: Node,\s*unitParent: Node,\s*private readonly model: BattleMvpModel,/s,
  );
  assert.match(gridPlacementSource, /new Node\('GridPlacementBacking'\)/);
  assert.match(gridPlacementSource, /new Node\('GridPlacementUnits'\)/);
});

runTest('formation animation keeps ring centers fixed', () => {
  const updateAnimationsSource = sourceSection(
    gridPlacementSource,
    'public updateAnimations(',
    'public recruitFromUpgrade(',
  );

  assert.match(updateAnimationsSource, /view\.unitNode\?\.setPosition\(/);
  assert.match(updateAnimationsSource, /view\.unitNode\?\.setScale\(1, 1, 1\);/);
  assert.match(updateAnimationsSource, /view\.unitNode\.angle = 0;/);
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
  assert.equal(/view\.node\.setPosition/.test(updateAnimationsSource), false);
  assert.equal(/view\.node\.setScale/.test(updateAnimationsSource), false);
  assert.equal(/view\.node\.angle/.test(updateAnimationsSource), false);
});

runTest('city health bar is fixed, immediate, and independently readable', () => {
  const cityHealthBarViewSource = sourceSection(
    battleUiComponentsSource,
    'export class CityHealthBarView {',
    'export class ComboView {',
  );

  assert.match(cityHealthBarViewSource, /CityHpEmblemLabel/);
  assert.match(cityHealthBarViewSource, /'城池'/);
  assert.match(cityHealthBarViewSource, /graphics\.circle\(emblemX,\s*0,\s*20\);/);
  assert.match(cityHealthBarViewSource, /ratio > 0\.55/);
  assert.match(cityHealthBarViewSource, /ratio > 0\.28/);
  assert.match(cityHealthBarViewSource, /transform\.setContentSize\(width,\s*48\);/);
  assert.match(cityHealthBarViewSource, /private readonly valueLabel: Label;/);
  assert.match(
    cityHealthBarViewSource,
    /bindOrCreateUiArtSkinNode\(\s*this\.node,\s*'hud_city_hp_bg\.png',\s*width,\s*44,\s*'CityHpSkin',?\s*\)/,
  );
  assert.match(
    cityHealthBarViewSource,
    /const visibleCurrent = Math\.max\(0,\s*Math\.min\(safeMax,\s*current\)\);/,
  );
  assert.match(
    cityHealthBarViewSource,
    /const ratio = Math\.max\(0,\s*Math\.min\(1,\s*visibleCurrent \/ safeMax\)\);/,
  );
  assert.match(
    cityHealthBarViewSource,
    /this\.valueLabel\.string = `\$\{Math\.ceil\(visibleCurrent\)\}\/\$\{Math\.ceil\(safeMax\)\}`;/,
  );
  assert.match(cityHealthBarViewSource, /const fillWidth = trackWidth \* ratio;/);
  assert.match(
    cityHealthBarViewSource,
    /const fillRadius = Math\.min\(BattleUiTokens\.radius\.md,\s*fillWidth \/ 2,\s*trackHeight \/ 2\);/,
  );
  assert.match(
    cityHealthBarViewSource,
    /const sheenWidth = Math\.max\(0,\s*fillWidth - 4\);/,
  );
  assert.match(
    cityHealthBarViewSource,
    /if \(sheenWidth > 0\) \{\s*this\.graphics\.fillColor = uiColor\(Color\.WHITE,\s*42\);\s*this\.graphics\.roundRect\([\s\S]*Math\.min\(2,\s*sheenWidth \/ 2\)/s,
  );
  assert.equal(/if \(focused\)/.test(cityHealthBarViewSource), false);
  assert.equal(/BattleUiTokens\.colors\.highlight/.test(cityHealthBarViewSource), false);
  assert.match(
    cityHealthBarViewSource,
    /if \(this\.flashTimeLeft > 0\) \{\s*this\.graphics\.strokeColor = uiColor\(Color\.WHITE, 180\);\s*this\.graphics\.lineWidth = 3;/s,
  );

  assert.equal(cityHealthBarViewSource.includes('const scale ='), false);
  assert.equal(cityHealthBarViewSource.includes('* scale'), false);
  assert.equal(cityHealthBarViewSource.includes('node.setScale'), false);
  assert.equal(/delayed|trailing|secondary health layer/i.test(cityHealthBarViewSource), false);
  assert.equal(/second fill width|fillWidth2|damageFillWidth|lagFillWidth/i.test(cityHealthBarViewSource), false);
  assert.equal(/Color\.WHITE,\s*70/.test(cityHealthBarViewSource), false);
  assert.match(
    cityHealthBarViewSource,
    /public update\(deltaTime: number\): void \{[\s\S]*this\.flashTimeLeft = Math\.max\(0, this\.flashTimeLeft - deltaTime\);/,
  );
  assert.equal(/this\.flashTimeLeft - 1 \/ 60/.test(cityHealthBarViewSource), false);
  assert.match(
    battleControllerSource,
    /public update\(deltaTime: number\): void \{[\s\S]*this\.cityHealthBarView\.update\(deltaTime\);/,
  );
  assert.match(
    battleControllerSource,
    /if \(result\.cityDamage > 0\) \{\s*this\.setVisualFocus\('city', 0\.72\);\s*\}/,
  );
  assert.match(battleControllerSource, /this\.redrawCityLine\(activeFocus === 'city'\);/);
  assert.match(battleControllerSource, /this\.cityHealthSystem\.refresh\(this\.model, false\);/);
  assert.equal(
    /fillColor = uiColor\(Color\.WHITE[\s\S]*roundRect\(frameLeft,\s*frameBottom,\s*this\.width,\s*48[\s\S]*fill\(\);/i.test(
      cityHealthBarViewSource,
    ),
    false,
  );
});
