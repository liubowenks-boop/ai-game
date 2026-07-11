# Battle Formation And HUD Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five gray deployment rectangles with aligned bronze circles, display six text-free rectangular hero portraits, and improve the fixed real-time city health bar without changing combat rules.

**Architecture:** `BattleUiLayout` defines all fixed geometry, while `BattleMvpModel` mirrors formation origins used by combat effects. `GridPlacementSystem`, `HeroAvatarSlotView`, and `CityHealthBarView` each own one presentation concern. A focused pure-TypeScript source-contract test protects Cocos rendering decisions that cannot be instantiated in the Node test runtime.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Cocos `Graphics`/`Mask`/`Sprite`, Node `tsx` tests, in-app browser preview.

---

## File Structure

- Create: `tools/battle-hud-polish.test.ts` - focused geometry and Cocos source-contract tests.
- Modify: `package.json` - expose `npm run test:hud-polish`.
- Modify: `assets/scripts/ui/BattleUiLayout.ts` - own the aligned formation, six portrait rectangles, and city-health dimensions.
- Modify: `assets/scripts/battle/BattleMvpModel.ts` - align gameplay hero origins with the visual formation.
- Modify: `assets/scripts/battle/GridPlacementSystem.ts` - render fixed bronze circles and masked occupied portraits.
- Modify: `assets/scripts/ui/BattleUiComponents.ts` - simplify `HeroAvatarSlotView` and redraw `CityHealthBarView`.
- Modify: `assets/scripts/battle/BattleController.ts` - create and refresh six portrait slots.
- Verify: `tools/ui-layout-v4.test.ts`, `tools/mvp-model.test.ts`, `tools/scene-structure.test.ts`, `tools/animation-system.test.ts`, and `tools/spine-import.test.ts`.

### Task 1: Lock The Formation And Portrait Geometry

**Files:**
- Create: `tools/battle-hud-polish.test.ts`
- Modify: `package.json`
- Modify: `assets/scripts/ui/BattleUiLayout.ts`
- Modify: `assets/scripts/battle/BattleMvpModel.ts`

- [ ] **Step 1: Write the failing geometry test**

Create `tools/battle-hud-polish.test.ts` with the following initial content:

```ts
import assert from 'node:assert/strict';

import { BattleMvpModel } from '../assets/scripts/battle/BattleMvpModel';
import { BattleUiV4Layout, RectSpec, rectsOverlap } from '../assets/scripts/ui/BattleUiLayout';

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
  const front = [
    requireRect('gridSlotFront1'),
    requireRect('gridSlotFront2'),
    requireRect('gridSlotFront3'),
  ];
  const back = [
    requireRect('gridSlotBack1'),
    requireRect('mainHeroUnit'),
    requireRect('gridSlotBack2'),
  ];

  assert.deepEqual(front.map((rect) => rect.x), [-210, 0, 210]);
  assert.deepEqual(back.map((rect) => rect.x), [-210, 0, 210]);
  assert.ok(front.every((rect) => rect.y === -300 && rect.width === 82 && rect.height === 82));
  assert.ok(back.every((rect) => rect.y === -410 && rect.width === 82 && rect.height === 82));

  const model = new BattleMvpModel();
  assert.deepEqual(model.slots.map((slot) => slot.position.x), [-210, 0, 210, -210, 210]);
  assert.deepEqual(model.slots.map((slot) => slot.position.y), [-300, -300, -300, -410, -410]);
  assert.deepEqual(model.playerPosition, { x: 0, y: -410 });
});

runTest('six fixed portrait slots fit the hero rail without overlap', () => {
  const portraitSlots = [
    requireRect('heroAvatarSlot1'),
    requireRect('heroAvatarSlot2'),
    requireRect('heroAvatarSlot3'),
    requireRect('heroAvatarSlot4'),
    requireRect('heroAvatarSlot5'),
    requireRect('heroAvatarSlot6'),
  ];

  assert.deepEqual(portraitSlots.map((rect) => rect.x), [-160, -96, -32, 32, 96, 160]);
  assert.ok(portraitSlots.every((rect) => rect.y === BattleUiV4Layout.heroBar.y));
  assert.ok(portraitSlots.every((rect) => rect.width === 56 && rect.height === 72));
  for (let index = 1; index < portraitSlots.length; index += 1) {
    assert.equal(rectsOverlap(portraitSlots[index - 1], portraitSlots[index]), false);
  }

  assert.equal(rectsOverlap(BattleUiV4Layout.mainHeroUnit, BattleUiV4Layout.placementTitle), false);
  assert.equal(rectsOverlap(BattleUiV4Layout.mainHeroUnit, BattleUiV4Layout.placementPending), false);
  assert.equal(rectsOverlap(BattleUiV4Layout.mainHeroUnit, BattleUiV4Layout.heroBar), false);
  assert.equal(rectsOverlap(BattleUiV4Layout.placementTitle, BattleUiV4Layout.heroBar), false);
  assert.equal(rectsOverlap(BattleUiV4Layout.placementPending, BattleUiV4Layout.heroBar), false);
  assert.equal(rectsOverlap(BattleUiV4Layout.cityHealthBar, BattleUiV4Layout.gridSlotFront2), false);
});
```

Add this script to `package.json`:

```json
"test:hud-polish": "tsx tools/battle-hud-polish.test.ts"
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:hud-polish`

Expected: FAIL because `heroAvatarSlot1` through `heroAvatarSlot6` do not exist and the formation still uses the old coordinates.

- [ ] **Step 3: Implement the approved fixed geometry**

Replace the affected `BattleUiV4Layout` entries in `assets/scripts/ui/BattleUiLayout.ts` with:

```ts
cityHealthBar: fromCenter(0, -214, 430, 48),
placementTitle: fromCenter(-126, -475, 210, 24),
placementPending: fromCenter(126, -475, 210, 24),
gridSlotFront1: fromCenter(-210, -300, 82, 82),
gridSlotFront2: fromCenter(0, -300, 82, 82),
gridSlotFront3: fromCenter(210, -300, 82, 82),
gridSlotBack1: fromCenter(-210, -410, 82, 82),
gridSlotBack2: fromCenter(210, -410, 82, 82),
mainHeroUnit: fromCenter(0, -410, 82, 82),
heroBar: fromTopLeft(150, 1144, 420, 96),
heroAvatarSlot1: fromCenter(-160, -552, 56, 72),
heroAvatarSlot2: fromCenter(-96, -552, 56, 72),
heroAvatarSlot3: fromCenter(-32, -552, 56, 72),
heroAvatarSlot4: fromCenter(32, -552, 56, 72),
heroAvatarSlot5: fromCenter(96, -552, 56, 72),
heroAvatarSlot6: fromCenter(160, -552, 56, 72),
```

In `assets/scripts/battle/BattleMvpModel.ts`, change the default player origin and initial slots to the same approved coordinates:

```ts
playerPosition: { x: 0, y: -410 },
```

```ts
private createInitialSlots(): GridSlotState[] {
  return [
    { index: 0, label: '前1', row: 'front', position: { x: -210, y: -300 } },
    { index: 1, label: '前2', row: 'front', position: { x: 0, y: -300 } },
    { index: 2, label: '前3', row: 'front', position: { x: 210, y: -300 } },
    { index: 3, label: '后1', row: 'back', position: { x: -210, y: -410 } },
    { index: 4, label: '后2', row: 'back', position: { x: 210, y: -410 } },
  ];
}
```

- [ ] **Step 4: Run geometry and existing layout/model tests**

Run:

```bash
npm run test:hud-polish
npm run test:ui-layout
npm run test:mvp
```

Expected: all three commands pass; the v4 safe-zone test reports no overlap.

- [ ] **Step 5: Commit the geometry contract**

```bash
git add package.json tools/battle-hud-polish.test.ts assets/scripts/ui/BattleUiLayout.ts assets/scripts/battle/BattleMvpModel.ts
git commit -m "feat: align battle formation geometry"
```

### Task 2: Render Fixed Bronze Deployment Circles

**Files:**
- Modify: `tools/battle-hud-polish.test.ts`
- Modify: `assets/scripts/battle/GridPlacementSystem.ts`

- [ ] **Step 1: Add failing circle-rendering source contracts**

Add the import and helper below to `tools/battle-hud-polish.test.ts`:

```ts
import { readFileSync } from 'node:fs';

function sourceSection(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(startIndex >= 0, `missing source marker: ${start}`);
  assert.ok(endIndex > startIndex, `missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}
```

Append these tests:

```ts
runTest('deployable positions draw circles instead of rounded rectangles', () => {
  const source = readFileSync('assets/scripts/battle/GridPlacementSystem.ts', 'utf8');
  const drawSlot = sourceSection(source, 'private drawSlotButton', 'private refreshSlotPortrait');

  assert.ok(drawSlot.includes('const radius = view.width / 2;'));
  assert.ok(drawSlot.includes('view.graphics.circle(0, 0, radius)'));
  assert.equal(drawSlot.includes('roundRect('), false);
  assert.ok(source.includes('Mask.Type.ELLIPSE'));
  assert.ok(source.includes("return slot.hero ? '' : slot.label;"));
});

runTest('formation animation keeps ring centers fixed', () => {
  const source = readFileSync('assets/scripts/battle/GridPlacementSystem.ts', 'utf8');
  const update = sourceSection(source, 'public updateAnimations', 'public recruitFromUpgrade');

  assert.ok(update.includes('view.node.setPosition(view.baseX ?? view.node.position.x'));
  assert.ok(update.includes('view.portraitNode.setPosition('));
  assert.equal(update.includes('(view.baseX ?? view.node.position.x) + pose.offsetX'), false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:hud-polish`

Expected: FAIL because slot drawing still uses `roundRect`, portraits are not masked, and animation moves the whole slot node.

- [ ] **Step 3: Implement circle drawing and masked portraits**

Add `Mask` to the `cc` import and keep `portraitNode` as the circular mask container:

```ts
import { Button, Color, Graphics, Label, Layers, Mask, Node, UITransform } from 'cc';
```

Replace `getSlotText`, `getSlotColor`, and `drawSlotButton` with:

```ts
private getSlotText(slot: GridSlotState): string {
  return slot.hero ? '' : slot.label;
}

private getSlotColor(slot: GridSlotState): Color {
  return slot.row === 'front' ? new Color(80, 39, 28, 230) : new Color(65, 34, 27, 230);
}

private drawSlotButton(view: ButtonView, slot: GridSlotState, highlighted: boolean): void {
  const radius = view.width / 2;
  const occupiedAlpha = slot.hero ? 235 : 178;

  view.graphics.clear();
  view.graphics.fillColor = new Color(view.baseColor.r, view.baseColor.g, view.baseColor.b, occupiedAlpha);
  view.graphics.circle(0, 0, radius - 3);
  view.graphics.fill();

  if (highlighted) {
    view.graphics.strokeColor = new Color(255, 239, 150, 210);
    view.graphics.lineWidth = 8;
    view.graphics.circle(0, 0, radius + 3);
    view.graphics.stroke();
  }

  view.graphics.strokeColor = highlighted
    ? new Color(255, 226, 126, 255)
    : new Color(233, 139, 84, slot.hero ? 245 : 205);
  view.graphics.lineWidth = highlighted ? 4 : 3;
  view.graphics.circle(0, 0, radius - 2);
  view.graphics.stroke();

  view.graphics.strokeColor = new Color(72, 35, 24, 220);
  view.graphics.lineWidth = 2;
  view.graphics.circle(0, 0, radius - 7);
  view.graphics.stroke();
}
```

Replace `refreshSlotPortrait` with a circular-mask implementation:

```ts
private refreshSlotPortrait(view: ButtonView, slot: GridSlotState): void {
  const filename = getHeroPortraitFilename(slot.hero?.name ?? '') ?? '';

  if (!filename) {
    if (view.portraitNode) {
      view.portraitNode.active = false;
    }
    view.portraitFilename = '';
    return;
  }

  if (view.portraitNode && view.portraitFilename === filename) {
    view.portraitNode.active = true;
    return;
  }

  view.portraitNode?.destroy();
  const maskNode = new Node('SlotHeroPortraitMask');
  this.setUiLayer(maskNode);
  const portraitSize = view.width - 16;
  const transform = maskNode.addComponent(UITransform);
  transform.setContentSize(portraitSize, portraitSize);
  const mask = maskNode.addComponent(Mask);
  mask.type = Mask.Type.ELLIPSE;
  mask.segments = 48;
  view.node.addChild(maskNode);
  createUiArtSkinNode(maskNode, filename, portraitSize, portraitSize, 'SlotHeroPortrait');

  view.portraitFilename = filename;
  view.portraitNode = maskNode;
  view.portraitNode.setSiblingIndex(1);
}
```

Center the empty label in `createButton`:

```ts
labelNode.setPosition(0, 0, 0);
```

In `updateAnimations`, keep the ring node fixed and apply procedural motion only to the portrait mask:

```ts
view.node.setPosition(view.baseX ?? view.node.position.x, view.baseY ?? view.node.position.y, 0);
view.node.setScale(1, 1, 1);
view.node.angle = 0;

if (!slot.hero) {
  view.portraitNode?.setPosition(0, 0, 0);
  view.portraitNode?.setScale(1, 1, 1);
  continue;
}

// Keep the existing runtime creation/ticking before this block.
const pose = computeProceduralAnimationPose(
  view.animation.currentState,
  view.animation.elapsed,
  'hero',
);
const focusScale = highlighted ? 1.04 : 1;
if (view.portraitNode) {
  view.portraitNode.setPosition(pose.offsetX * 0.35, pose.offsetY * 0.35, 0);
  view.portraitNode.setScale(focusScale * pose.scaleX, focusScale * pose.scaleY, 1);
  view.portraitNode.angle = pose.rotation * 0.35;
}
```

- [ ] **Step 4: Run focused and animation tests**

Run:

```bash
npm run test:hud-polish
npm run test:animation
npm run typecheck
```

Expected: all commands pass; the circle contract contains no `roundRect` and existing animation tests remain green.

- [ ] **Step 5: Commit the circular formation**

```bash
git add tools/battle-hud-polish.test.ts assets/scripts/battle/GridPlacementSystem.ts
git commit -m "feat: render aligned bronze formation circles"
```

### Task 3: Replace Three Labeled Avatars With Six Pure Portraits

**Files:**
- Modify: `tools/battle-hud-polish.test.ts`
- Modify: `assets/scripts/ui/BattleUiComponents.ts`
- Modify: `assets/scripts/battle/BattleController.ts`

- [ ] **Step 1: Add failing six-portrait source contracts**

Append these tests to `tools/battle-hud-polish.test.ts`:

```ts
runTest('bottom rail creates six text-free rectangular portrait slots', () => {
  const components = readFileSync('assets/scripts/ui/BattleUiComponents.ts', 'utf8');
  const controller = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');
  const avatarClass = sourceSection(
    components,
    'export class HeroAvatarSlotView',
    'export interface UpgradeCardViewOptions',
  );
  const bottomHud = sourceSection(controller, 'private createBottomHudLayer', 'private createCanvas');

  for (let index = 1; index <= 6; index += 1) {
    assert.ok(bottomHud.includes(`BattleUiV4Layout.heroAvatarSlot${index}`));
  }
  assert.ok(avatarClass.includes('private readonly width: number'));
  assert.ok(avatarClass.includes('private readonly height: number'));
  assert.ok(avatarClass.includes("legacyName of ['AvatarSkin', 'AvatarLabel']"));
  assert.equal(avatarClass.includes("t('hud.empty')"), false);
  assert.equal(avatarClass.includes('Lv${level}'), false);
  assert.equal(avatarClass.includes('private readonly label'), false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:hud-polish`

Expected: FAIL because only three 72 px square avatar views are created and `HeroAvatarSlotView` still owns labels.

- [ ] **Step 3: Replace `HeroAvatarSlotView` with a text-free rectangle**

Replace the complete `HeroAvatarSlotView` class in `assets/scripts/ui/BattleUiComponents.ts` with:

```ts
export class HeroAvatarSlotView {
  public readonly node: Node;
  private readonly graphics: Graphics;
  private portraitNode?: Node;
  private portraitFilename = '';

  public constructor(
    x: number,
    y: number,
    private readonly width: number,
    private readonly height: number,
    parent: Node,
    options: {
      hostNode?: Node | null;
      nodeName?: string;
    } = {},
  ) {
    this.node = options.hostNode ?? new Node(options.nodeName ?? 'HeroAvatarSlotView');
    setUiLayer(this.node);
    this.node.setPosition(x, y, 0);

    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(width, height);
    this.graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);

    for (const legacyName of ['AvatarSkin', 'AvatarLabel']) {
      const legacyNode = this.node.getChildByName(legacyName);
      if (legacyNode) {
        legacyNode.active = false;
      }
    }

    if (!this.node.parent) {
      parent.addChild(this.node);
    }
    this.refresh('', false);
  }

  public refresh(heroName: string, highlighted: boolean): void {
    const occupied = Boolean(heroName);
    this.refreshPortrait(heroName);
    this.graphics.clear();

    if (highlighted) {
      this.graphics.strokeColor = uiColor(BattleUiTokens.colors.highlight, 205);
      this.graphics.lineWidth = 7;
      this.graphics.roundRect(
        -this.width / 2 - 3,
        -this.height / 2 - 3,
        this.width + 6,
        this.height + 6,
        BattleUiTokens.radius.sm,
      );
      this.graphics.stroke();
    }

    this.graphics.fillColor = occupied
      ? uiColor(BattleUiTokens.colors.panelBrown, 238)
      : uiColor(BattleUiTokens.colors.panelDeep, 188);
    this.graphics.strokeColor = highlighted
      ? BattleUiTokens.colors.highlight
      : uiColor(BattleUiTokens.colors.strokeGold, occupied ? 190 : 78);
    this.graphics.lineWidth = highlighted ? BattleUiTokens.stroke.strong : BattleUiTokens.stroke.normal;
    this.graphics.roundRect(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height,
      BattleUiTokens.radius.sm,
    );
    this.graphics.fill();
    this.graphics.stroke();
  }

  private refreshPortrait(heroName: string): void {
    const filename = getHeroPortraitFilename(heroName) ?? '';
    this.portraitNode = this.portraitNode ?? this.node.getChildByName('AvatarPortrait') ?? undefined;

    if (!filename) {
      if (this.portraitNode) {
        this.portraitNode.active = false;
      }
      this.portraitFilename = '';
      return;
    }

    if (filename === this.portraitFilename && this.portraitNode) {
      this.portraitNode.active = true;
      return;
    }

    this.portraitFilename = filename;
    this.portraitNode = bindOrCreateUiArtSkinNode(
      this.node,
      filename,
      this.width - 6,
      this.height - 6,
      'AvatarPortrait',
    );
    this.portraitNode.active = true;
    this.portraitNode.setSiblingIndex(1);
  }
}
```

- [ ] **Step 4: Create and refresh six views in `BattleController`**

Replace the three-value `avatarXs` block in `createBottomHudLayer` with:

```ts
const avatarSlotRects = [
  BattleUiV4Layout.heroAvatarSlot1,
  BattleUiV4Layout.heroAvatarSlot2,
  BattleUiV4Layout.heroAvatarSlot3,
  BattleUiV4Layout.heroAvatarSlot4,
  BattleUiV4Layout.heroAvatarSlot5,
  BattleUiV4Layout.heroAvatarSlot6,
];
avatarSlotRects.forEach((rect, index) => {
  this.heroAvatarViews.push(
    new HeroAvatarSlotView(rect.x, rect.y, rect.width, rect.height, this.bottomHudLayer, {
      hostNode: this.bottomHudLayer.getChildByName(`HeroAvatarSlot${index + 1}`),
      nodeName: `HeroAvatarSlot${index + 1}`,
    }),
  );
});
```

Update `refreshHeroAvatarBar` so no label data is passed:

```ts
this.heroAvatarViews[index].refresh(
  hero?.name ?? '',
  Boolean(hero && outputFocus.kind === 'hero' && hero.id === outputFocus.heroId),
);
```

- [ ] **Step 5: Run focused, scene, and type checks**

Run:

```bash
npm run test:hud-polish
npm run test:scene
npm run typecheck
```

Expected: all commands pass. The first three authored scene hosts are reused, slots four through six are created at runtime, and legacy label/skin children remain hidden.

- [ ] **Step 6: Commit the six-portrait rail**

```bash
git add tools/battle-hud-polish.test.ts assets/scripts/ui/BattleUiComponents.ts assets/scripts/battle/BattleController.ts
git commit -m "feat: show six clean hero portraits"
```

### Task 4: Redraw The Fixed Real-Time City Health Bar

**Files:**
- Modify: `tools/battle-hud-polish.test.ts`
- Modify: `assets/scripts/ui/BattleUiComponents.ts`

- [ ] **Step 1: Add failing city-health source contracts**

Append this test to `tools/battle-hud-polish.test.ts`:

```ts
runTest('city health bar is fixed, immediate, and independently readable', () => {
  const components = readFileSync('assets/scripts/ui/BattleUiComponents.ts', 'utf8');
  const cityClass = sourceSection(
    components,
    'export class CityHealthBarView',
    'export class ComboView',
  );

  assert.ok(cityClass.includes("'CityHpEmblemLabel'"));
  assert.ok(cityClass.includes('this.graphics.circle(emblemX, 0, 15)'));
  assert.ok(cityClass.includes('ratio > 0.55'));
  assert.ok(cityClass.includes('ratio > 0.28'));
  assert.equal(cityClass.includes('const scale ='), false);
  assert.equal(cityClass.includes('* scale'), false);
  assert.equal(cityClass.toLowerCase().includes('delayed'), false);
  assert.equal(cityClass.toLowerCase().includes('trailing'), false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:hud-polish`

Expected: FAIL because the current city bar scales on focus/damage and has no separate emblem/value layout.

- [ ] **Step 3: Replace `CityHealthBarView` with the fixed-frame implementation**

Keep the class name and constructor signature, but replace its fields, constructor body, and `refresh` method with:

```ts
export class CityHealthBarView {
  public readonly node: Node;
  private readonly graphics: Graphics;
  private readonly valueLabel: Label;
  private lastHealth = Number.NaN;
  private flashTimeLeft = 0;

  public constructor(
    x: number,
    y: number,
    private readonly width: number,
    parent: Node,
    options: { hostNode?: Node | null } = {},
  ) {
    this.node = options.hostNode ?? new Node('CityHealthBarView');
    setUiLayer(this.node);
    this.node.setPosition(x, y, 0);

    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(width, 48);
    this.graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);

    const skin = bindOrCreateUiArtSkinNode(this.node, 'hud_city_hp_bg.png', width, 48, 'CityHpSkin');
    skin.active = false;

    bindOrCreateLabel(
      this.node,
      'CityHpEmblemLabel',
      '城',
      -width / 2 + 26,
      0,
      BattleUiTokens.font.tiny,
      BattleUiTokens.colors.textPrimary,
      34,
      34,
    );
    this.valueLabel = bindOrCreateLabel(
      this.node,
      'CityHpLabel',
      '100/100',
      width / 2 - 42,
      0,
      BattleUiTokens.font.tiny,
      BattleUiTokens.colors.textPrimary,
      76,
      32,
      { fontRole: 'damageNumber', lineHeightMultiplier: BattleUiTokens.lineHeight.tight },
    ).label;

    for (const childName of ['CityHpBarBg', 'CityHpBarFill', 'CityHpHitFlash']) {
      const child = ensureNamedUiChild(this.node, childName, 0, 0, width, 30);
      child.active = false;
    }

    if (!this.node.parent) {
      parent.addChild(this.node);
    }
  }

  public refresh(current: number, max: number, focused: boolean): void {
    if (!Number.isNaN(this.lastHealth) && current < this.lastHealth) {
      this.flashTimeLeft = 0.22;
    }
    this.lastHealth = current;

    const safeMax = Math.max(1, max);
    const ratio = Math.max(0, Math.min(1, current / safeMax));
    const flashActive = this.flashTimeLeft > 0;
    const frameLeft = -this.width / 2;
    const frameBottom = -24;
    const emblemX = frameLeft + 26;
    const valueWidth = 76;
    const trackLeft = frameLeft + 52;
    const trackWidth = this.width - 52 - valueWidth - 10;
    const trackBottom = -10;
    const trackHeight = 20;
    const fillColor =
      ratio > 0.55
        ? BattleUiTokens.colors.summonGreen
        : ratio > 0.28
          ? BattleUiTokens.colors.primaryGold
          : BattleUiTokens.colors.danger;

    this.valueLabel.string = `${Math.ceil(current)}/${Math.ceil(safeMax)}`;
    this.graphics.clear();

    if (focused || flashActive) {
      this.graphics.strokeColor = flashActive
        ? uiColor(Color.WHITE, 185)
        : uiColor(BattleUiTokens.colors.highlight, 118);
      this.graphics.lineWidth = flashActive ? 8 : 5;
      this.graphics.roundRect(frameLeft - 3, frameBottom - 3, this.width + 6, 54, 8);
      this.graphics.stroke();
    }

    this.graphics.fillColor = uiColor(BattleUiTokens.colors.panelDeep, 238);
    this.graphics.strokeColor = uiColor(BattleUiTokens.colors.strokeGold, 218);
    this.graphics.lineWidth = BattleUiTokens.stroke.normal;
    this.graphics.roundRect(frameLeft, frameBottom, this.width, 48, BattleUiTokens.radius.sm);
    this.graphics.fill();
    this.graphics.stroke();

    this.graphics.fillColor = uiColor(BattleUiTokens.colors.panelBrown, 245);
    this.graphics.strokeColor = uiColor(BattleUiTokens.colors.strokeGold, 235);
    this.graphics.lineWidth = 2;
    this.graphics.circle(emblemX, 0, 15);
    this.graphics.fill();
    this.graphics.stroke();

    this.graphics.fillColor = uiColor(Color.BLACK, 205);
    this.graphics.roundRect(trackLeft, trackBottom, trackWidth, trackHeight, 4);
    this.graphics.fill();
    if (ratio > 0) {
      this.graphics.fillColor = fillColor;
      this.graphics.roundRect(trackLeft, trackBottom, Math.max(4, trackWidth * ratio), trackHeight, 4);
      this.graphics.fill();
    }

    this.graphics.fillColor = uiColor(Color.WHITE, 38);
    this.graphics.roundRect(trackLeft + 2, trackBottom + 11, Math.max(0, trackWidth - 4), 5, 2);
    this.graphics.fill();

    if (flashActive) {
      this.flashTimeLeft = Math.max(0, this.flashTimeLeft - 1 / 60);
    }
  }
}
```

- [ ] **Step 4: Run focused, UI-layout, and type checks**

Run:

```bash
npm run test:hud-polish
npm run test:ui-layout
npm run typecheck
```

Expected: all commands pass. Source contracts confirm the fixed geometry and absence of delayed/trailing health layers.

- [ ] **Step 5: Commit the city health bar**

```bash
git add tools/battle-hud-polish.test.ts assets/scripts/ui/BattleUiComponents.ts
git commit -m "feat: polish fixed city health bar"
```

### Task 5: Run Full Regression And In-App Visual Verification

**Files:**
- Verify: all files changed in Tasks 1-4.

- [ ] **Step 1: Run the complete automated verification set**

Run each command independently:

```bash
npm run test:hud-polish
npm run test:ui-layout
npm run test:mvp
npm run test:scene
npm run test:animation
npm run test:spine-import
npm run typecheck
git diff --check
```

Expected: every command exits with status 0. The Spine animation, projectile/hit effects, combat cadence, merge behavior, and scene skeleton remain unchanged.

- [ ] **Step 2: Reload the Cocos preview at the portrait viewport**

Open or reload `http://localhost:7456/` in the in-app browser after Cocos recompiles the TypeScript changes. Keep the `Sandgate Portrait 720x1280` device selected.

Expected: the idle battle screen shows three aligned columns, five bronze circles, a cyan main-hero center, six rectangular portrait frames, and the fixed city health bar with no overlaps.

- [ ] **Step 3: Verify an active battle and occupied formation slot**

Start the battle, recruit/place at least one hero, and observe one city-damage event.

Expected:

- An occupied bronze circle shows the hero portrait while its circle center remains fixed.
- The six bottom slots show artwork only; no name, role, level, `空位`, or `待招募` text appears.
- The city bar changes directly from green to gold to red as applicable and uses only a white outline flash on damage.
- The main hero does not overlap the formation summary or bottom portrait rail.
- Golden projectiles, hit effects, and the main hero Spine attack remain visible.

- [ ] **Step 4: Inspect browser logs and capture comparison screenshots**

Read browser `error`, `warning`, and `warn` logs, then capture one idle screenshot and one active-battle screenshot.

Expected: no new console errors or warnings; screenshots show no clipped portraits, text overlap, layout shift, or solid rectangle artifacts.

- [ ] **Step 5: Confirm the worktree contains only intended implementation changes**

Run:

```bash
git status --short
git diff --stat
git log -5 --oneline
```

Expected: only the implementation/test files from this plan are changed or committed, and `.superpowers/brainstorm/` remains ignored.
