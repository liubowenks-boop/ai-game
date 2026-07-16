# 模块化荒原地形、城墙与五人阵型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Cocos Creator 3.8.8 的现有 2D 战斗中导入七层模块化荒原地形，将防线和城墙下移约 80px，并把主角、固定雷法师与最多三名普通英雄排成城墙上的五人单排阵型。

**Architecture:** 用纯数据 `BattleTerrainConfig` 统一地形资源、战场坐标和层级名称；用纯函数 `BattleTerrainLoadState` 决定“加载中 / 模块化 / 旧背景回退”；由 `BattleTerrainPresentation` 独占异步资源加载和 BattleLayer 内部渲染根节点。`BattleController` 只把敌人、站位环、角色、投射物和反馈系统接到 presentation 暴露的稳定层上，模型仍独立负责人数、槽位、邻接、防线和卡池规则。

**Tech Stack:** TypeScript 5.5、Cocos Creator 3.8.8 (`Node` / `Sprite` / `SpriteFrame` / `ImageAsset` / `Texture2D` / `UITransform`)、Node `tsx` 测试、PNG 资源与 Cocos `.meta`、Codex image generation、Cocos 内置浏览器 720x1280 Web 预览。

---

## 约束与单一数据源

实施期间必须保持以下数值不漂移：

```ts
export const BATTLE_WALL_LAYOUT = {
  cityLineY: -290,
  wallBackY: -365,
  wallFrontY: -385,
  unitY: -320,
  thunderMage: { x: -240, y: -320 },
  ordinarySlots: [
    { x: -120, y: -320 },
    { x: 120, y: -320 },
    { x: 240, y: -320 },
  ],
  mainHero: { x: 0, y: -320 },
} as const;
```

普通英雄上限固定为 3；固定雷法师仍使用保留槽位 3；槽位 4 必须消失。底部六头像栏、主角 Spine、主角金色飞弹、雷法师 Spine 和蓝白雷击的玩法与美术逻辑不重做。

## Task 1: 建立地形配置、加载状态和资源契约测试

**Files:**
- Create: `assets/scripts/data/BattleTerrainConfig.ts`
- Create: `assets/scripts/battle/BattleTerrainLoadState.ts`
- Create: `tools/terrain-system.test.ts`
- Modify: `package.json`

- [ ] **Step 1: 先写失败的纯逻辑与资源契约测试**

在 `tools/terrain-system.test.ts` 中覆盖以下契约：

```ts
assert.deepEqual(BATTLE_WALL_LAYOUT.mainHero, { x: 0, y: -320 });
assert.deepEqual(BATTLE_WALL_LAYOUT.thunderMage, { x: -240, y: -320 });
assert.deepEqual(BATTLE_WALL_LAYOUT.ordinarySlots, [
  { x: -120, y: -320 },
  { x: 120, y: -320 },
  { x: 240, y: -320 },
]);
assert.equal(BATTLE_WALL_LAYOUT.cityLineY, -290);
assert.equal(BATTLE_TERRAIN_LAYERS.length, 7);
assert.deepEqual(
  BATTLE_TERRAIN_LAYERS.filter((layer) => layer.required).map((layer) => layer.id),
  ['base', 'wallBack'],
);

const pending = createBattleTerrainLoadState(BATTLE_TERRAIN_LAYERS);
assert.equal(resolveBattleTerrainMode(pending, BATTLE_TERRAIN_LAYERS), 'loading');
assert.equal(
  resolveBattleTerrainMode({ ...pending, base: 'ready', wallBack: 'ready' }, BATTLE_TERRAIN_LAYERS),
  'modular',
);
assert.equal(
  resolveBattleTerrainMode({ ...pending, base: 'failed' }, BATTLE_TERRAIN_LAYERS),
  'legacy',
);
assert.equal(
  resolveBattleTerrainMode(
    { ...pending, base: 'ready', wallBack: 'ready', road: 'failed' },
    BATTLE_TERRAIN_LAYERS,
  ),
  'modular',
);
```

测试还要逐一断言七个文件名、尺寸、Alpha 责任和 `battle_common/` 逻辑路径，避免后续代码与资源命名分叉。

- [ ] **Step 2: 注册测试命令并确认 RED**

在 `package.json` 加入：

```json
"test:terrain": "tsx tools/terrain-system.test.ts"
```

运行：

```bash
npm run test:terrain
```

预期：因 `BattleTerrainConfig.ts` 和 `BattleTerrainLoadState.ts` 尚不存在而失败；失败原因只能是缺失模块或缺失导出。

- [ ] **Step 3: 实现纯数据配置**

`BattleTerrainConfig.ts` 不导入 `cc`，定义以下类型和固定值：

```ts
export type BattleTerrainLayerId =
  | 'base'
  | 'road'
  | 'ruinsLeft'
  | 'ruinsRight'
  | 'atmosphere'
  | 'wallBack'
  | 'wallFront';

export interface BattleTerrainLayerSpec {
  id: BattleTerrainLayerId;
  nodeName: string;
  filename: string;
  path: string;
  width: number;
  height: number;
  x: number;
  y: number;
  required: boolean;
  expectsAlpha: boolean;
}

export const BATTLE_TERRAIN_LAYERS: readonly BattleTerrainLayerSpec[] = [
  { id: 'base', nodeName: 'TerrainBase', filename: 'battle_terrain_base_720x1280.png', path: 'battle_common/battle_terrain_base_720x1280', width: 720, height: 1280, x: 0, y: 0, required: true, expectsAlpha: false },
  { id: 'road', nodeName: 'TerrainRoad', filename: 'battle_road_overlay.png', path: 'battle_common/battle_road_overlay', width: 720, height: 1280, x: 0, y: 0, required: false, expectsAlpha: true },
  { id: 'ruinsLeft', nodeName: 'TerrainRuinsLeft', filename: 'battle_ruins_left.png', path: 'battle_common/battle_ruins_left', width: 360, height: 900, x: -180, y: 55, required: false, expectsAlpha: true },
  { id: 'ruinsRight', nodeName: 'TerrainRuinsRight', filename: 'battle_ruins_right.png', path: 'battle_common/battle_ruins_right', width: 360, height: 900, x: 180, y: 55, required: false, expectsAlpha: true },
  { id: 'atmosphere', nodeName: 'TerrainAtmosphereBack', filename: 'battle_atmosphere.png', path: 'battle_common/battle_atmosphere', width: 720, height: 900, x: 0, y: 80, required: false, expectsAlpha: true },
  { id: 'wallBack', nodeName: 'CityWallBack', filename: 'battle_wall_back.png', path: 'battle_common/battle_wall_back', width: 720, height: 240, x: 0, y: -365, required: true, expectsAlpha: true },
  { id: 'wallFront', nodeName: 'CityWallFront', filename: 'battle_wall_front.png', path: 'battle_common/battle_wall_front', width: 720, height: 160, x: 0, y: -385, required: false, expectsAlpha: true },
] as const;
```

同文件导出前述 `BATTLE_WALL_LAYOUT`，并导出稳定渲染根名称：`EnemiesLayer`、`WallUnitBackingRings`、`WallUnitsLayer`、`PlayerAndCompanionProjectiles`、`BattleFeedbackLayer`。

- [ ] **Step 4: 实现无 Cocos 依赖的加载状态机**

在 `BattleTerrainLoadState.ts` 中实现：

```ts
export type BattleTerrainLayerStatus = 'pending' | 'ready' | 'failed';
export type BattleTerrainMode = 'loading' | 'modular' | 'legacy';
export type BattleTerrainLoadState = Record<BattleTerrainLayerId, BattleTerrainLayerStatus>;

export function createBattleTerrainLoadState(
  specs: readonly BattleTerrainLayerSpec[],
): BattleTerrainLoadState;

export function resolveBattleTerrainMode(
  state: BattleTerrainLoadState,
  specs: readonly BattleTerrainLayerSpec[],
): BattleTerrainMode;
```

规则固定为：任一必需层 `failed` 就返回 `legacy`；全部必需层 `ready` 就返回 `modular`；否则返回 `loading`。可选层状态不得影响整体模式。

- [ ] **Step 5: 运行 GREEN 和类型检查**

```bash
npm run test:terrain
npm run typecheck
```

预期：`pass: terrain config and fallback state contracts`；TypeScript 无错误。

- [ ] **Step 6: 提交纯逻辑基础**

```bash
git add assets/scripts/data/BattleTerrainConfig.ts assets/scripts/battle/BattleTerrainLoadState.ts tools/terrain-system.test.ts package.json package-lock.json
git commit -m "feat: define modular battle terrain contracts"
```

## Task 2: 生成、清理并导入七层荒原资源

**Files:**
- Create: `assets/bundles/battle_common/battle_terrain_base_720x1280.png`
- Create: `assets/bundles/battle_common/battle_road_overlay.png`
- Create: `assets/bundles/battle_common/battle_ruins_left.png`
- Create: `assets/bundles/battle_common/battle_ruins_right.png`
- Create: `assets/bundles/battle_common/battle_wall_back.png`
- Create: `assets/bundles/battle_common/battle_wall_front.png`
- Create: `assets/bundles/battle_common/battle_atmosphere.png`
- Create: matching seven `.png.meta` files through Cocos import
- Create: `tools/generate-battle-terrain-manifest.mjs`
- Create: `assets/scripts/data/BattleTerrainAssets.generated.ts`
- Modify: `tools/terrain-system.test.ts`

- [ ] **Step 1: 用当前背景作为唯一风格参考生成基础地形**

先加载 `imagegen` skill，然后以 `assets/bundles/battle_common/battle_bg_sandgate_720x1280.png` 为参考图执行编辑生成。基础图提示词固定为：

```text
Create a production-ready 2D portrait game battlefield background matching the reference image's exact warm sandgate war-ruins art direction: ochre sand, scorched stone, dark iron and faded red banners. Keep the camera and painterly realism consistent. Redesign only the terrain geometry: a wider, quieter central battlefield with three straight readable lanes, ruins pushed to the far left and right edges, and clear negative space for enemies and damage numbers. Remove every wall, character, enemy, ring, HUD, text, health bar, projectile and effect. No gradients, no solid-color rectangles, no border, no vignette. Opaque full-frame background.
```

将生成结果裁切/缩放为严格的 `720x1280`，不得拉伸人物或 UI，因为图中不允许存在人物或 UI。

- [ ] **Step 2: 分别生成六个透明覆盖层**

每次都引用旧背景和新基础图，要求透明背景，且只保留目标对象：

```text
Road: transparent 720x1280 overlay containing only subtle compacted-sand lane marks and low-contrast ground wear for three straight lanes. No terrain base, wall, ruins, smoke block, text or solid background.

Left ruins: transparent 360x900 overlay containing only left-edge scorched stone ruins, broken stakes, rubble and one faded dark-red banner. Keep the right 45 percent mostly transparent so the three lanes remain clear.

Right ruins: transparent 360x900 overlay containing only right-edge scorched stone ruins, defensive stakes and rubble. Keep the left 45 percent mostly transparent so the three lanes remain clear.

Wall back: transparent 720x240 overlay containing only the rear body of a continuous battered sandstone-and-dark-iron battlement, matching the reference. Five evenly spaced standing locations must remain visually readable. No front parapet lip, characters, rings, labels or effects.

Wall front: transparent 720x160 overlay containing only the front parapet lip and five crenellation foreground sections. It must naturally hide character feet and lower shins while leaving torsos and weapons visible. No rear wall body, characters, rings or background rectangle.

Atmosphere: transparent 720x900 overlay containing only sparse low-alpha dust wisps, tiny embers and distant smoke traces around the far side edges. Keep the central three lanes almost completely clear. No opaque haze panel or vignette.
```

最终文件必须使用直 Alpha；出现白底、黑底、棋盘格烘焙、整块半透明矩形时重新生成，不允许用 CSS/混合模式掩盖。

- [ ] **Step 3: 扩展资源测试并确认导入前 RED**

在 `terrain-system.test.ts` 增加 PNG IHDR/像素验证（可复用 `thunder-mage-spine-import.test.ts` 的 Node PNG 解码逻辑，不新增运行时依赖）：

```ts
assert.deepEqual(readPng(basePath).size, { width: 720, height: 1280 });
assert.ok(readPng(basePath).everyAlpha(255), 'terrain base must be opaque');
assert.ok(readPng(overlayPath).hasTransparentPixel(), `${filename} needs alpha`);
assert.ok(readPng(overlayPath).transparentCornerCount() >= 3, `${filename} has a solid backdrop`);
assert.ok(existsSync(`${pngPath}.meta`), `${filename}.meta must exist`);
```

运行 `npm run test:terrain`。预期：仅因七个 `.meta` 或 generated manifest 尚未存在而失败；PNG 尺寸与 Alpha 检查先通过。

- [ ] **Step 4: 让 Cocos Creator 3.8.8 生成稳定元数据**

打开当前项目并等待 Asset Database 导入完成。不要手写图片 `.meta` UUID。关闭并重开一次项目，确认七个 `.png.meta` 均存在且 UUID 不变化，然后运行：

```bash
git diff -- assets/bundles/battle_common
```

预期：只新增七张图片及七个对应 `.meta`，不修改旧背景元数据。

- [ ] **Step 5: 生成 UUID 清单而非手改通用 UI manifest**

`generate-battle-terrain-manifest.mjs` 必须读取七个固定文件名对应的 `.png.meta`，取顶层 image UUID，按 filename 排序并原子写入。生成正文使用实际读取值：

```js
const entries = filenames
  .sort((left, right) => left.localeCompare(right))
  .map((filename) => [filename, readImageUuid(`${assetDirectory}/${filename}.meta`)]);
const source = `// Generated by tools/generate-battle-terrain-manifest.mjs.\n` +
  `export const BATTLE_TERRAIN_ASSET_UUIDS = ${JSON.stringify(Object.fromEntries(entries), null, 2)} as const;\n`;
```

脚本遇到缺文件、非法 JSON、空 UUID 或重复 UUID 必须非零退出。执行：

```bash
node tools/generate-battle-terrain-manifest.mjs
npm run test:terrain
```

预期：`pass: terrain asset files, alpha, metadata and generated UUID manifest`。

- [ ] **Step 6: 在 Cocos 资源面板逐层预览**

确认 base 为不透明，六个覆盖层为透明；墙体 back/front 单独预览时没有角色和文字；左右 ruins 不侵入中央；所有 texture 使用 clamp-to-edge、linear、无 mipmap。

- [ ] **Step 7: 提交美术资源与清单**

```bash
git add assets/bundles/battle_common assets/scripts/data/BattleTerrainAssets.generated.ts tools/generate-battle-terrain-manifest.mjs tools/terrain-system.test.ts
git commit -m "feat: add modular sandgate terrain assets"
```

## Task 3: 把模型改为三普通英雄加两固定角色

**Files:**
- Modify: `tools/mvp-model.test.ts`
- Modify: `assets/scripts/battle/BattleMvpModel.ts`
- Modify: `assets/scripts/data/CompanionConfig.ts`

- [ ] **Step 1: 先把旧四普通英雄测试改成新规则**

新增/改写测试，明确断言：

```ts
assert.deepEqual(model.slots.map((slot) => slot.index), [0, 1, 2, 3]);
assert.deepEqual(model.slots.slice(0, 3).map((slot) => slot.position), [
  { x: -120, y: -320 },
  { x: 120, y: -320 },
  { x: 240, y: -320 },
]);
assert.deepEqual(model.slots[3], {
  index: 3,
  label: '',
  row: 'wall',
  position: { x: -240, y: -320 },
  reservedBy: 'fixed_companion',
});
assert.deepEqual(model.playerPosition, { x: 0, y: -320 });
assert.equal(model.options.cityLineY, -290);
assert.equal(model.build.summon.maxBoardHeroes, 3);
assert.equal(model.placeHero(3, '护卫'), undefined);
assert.equal(model.placeHero(4, '护卫'), undefined);
assert.equal(model.applyUpgradeCard('summon_slots_plus_1'), false);
```

再通过相邻合并测试证明 `0 <-> 1 <-> 2`，并证明 0 与 2 不直接相邻。

- [ ] **Step 2: 确认 RED**

```bash
npm run test:mvp
```

预期：旧 `-210/-410` 坐标、槽位 4、`front/back` 行和扩容卡断言失败。

- [ ] **Step 3: 让模型读取地形单一数据源**

在 `BattleMvpModel.ts` 导入 `BATTLE_WALL_LAYOUT`：

```ts
const DEFAULT_OPTIONS: BattleMvpOptions = {
  // 其余参数不动
  cityLineY: BATTLE_WALL_LAYOUT.cityLineY,
  playerPosition: BATTLE_WALL_LAYOUT.mainHero,
};

const GRID_ADJACENCY: Record<number, number[]> = {
  0: [1],
  1: [0, 2],
  2: [1],
  3: [],
};
```

将 `GridSlotState.row` 收窄为 `'wall'`，`createInitialSlots()` 只创建 0、1、2 和保留槽 3。普通槽 label 统一为空字符串，不再显示“前1/后2”。

- [ ] **Step 4: 固定人数和卡池**

首轮卡组改为：

```ts
const UPGRADE_OFFER_ROTATION: UpgradeCardId[][] = [
  ['fire_burn_damage_30', 'thunder_chain_plus_1', 'summon_hero_damage_20'],
  ['fire_spread_plus_1', 'thunder_crit_plus_10', 'summon_hero_damage_20'],
];
```

`applyUpgradeCard('summon_slots_plus_1')` 返回 `false` 且不改变 build；`getOrdinarySlotCapacity()` 固定由三个非保留槽计算。不要删除 `BattleConfig` 中的旧 ID，以免破坏存档/类型兼容，但任何 offer 都不得返回它。

- [ ] **Step 5: 更新固定雷法师配置**

`CompanionConfig.ts` 的 `THUNDER_MAGE_COMPANION.position` 改为读取 `BATTLE_WALL_LAYOUT.thunderMage`，其名字、Spine 路径、伤害、间隔和缩放保持原值。

- [ ] **Step 6: 运行模型与动画回归测试**

```bash
npm run test:mvp
npm run test:animation
npm run test:thunder-mage-import
npm run typecheck
```

预期：全部通过；雷法师攻击时间、主角动画时长和 Spine 资源契约无回归。

- [ ] **Step 7: 提交模型变更**

```bash
git add assets/scripts/battle/BattleMvpModel.ts assets/scripts/data/CompanionConfig.ts tools/mvp-model.test.ts
git commit -m "feat: cap wall formation at five units"
```

## Task 4: 把 UI 站位改为五人单排并拆分站位环与角色层

**Files:**
- Modify: `assets/scripts/ui/BattleUiLayout.ts`
- Modify: `assets/scripts/battle/GridPlacementSystem.ts`
- Modify: `tools/ui-layout-v4.test.ts`
- Modify: `tools/battle-hud-polish.test.ts`

- [ ] **Step 1: 写单排布局和安全区失败测试**

将旧 `gridSlotFront* / gridSlotBack*` 阵型断言替换为：

```ts
const formation = [
  layout.wallSlotThunderMage,
  layout.wallSlotOrdinary1,
  layout.mainHeroUnit,
  layout.wallSlotOrdinary2,
  layout.wallSlotOrdinary3,
];
assert.deepEqual(formation.map((rect) => rect.x), [-240, -120, 0, 120, 240]);
assert.deepEqual(formation.map((rect) => rect.y), [-320, -320, -320, -320, -320]);
assert.ok(formation.every((rect) => rect.width <= 96 && rect.height <= 120));
for (let index = 1; index < formation.length; index += 1) {
  assert.equal(rectsOverlap(formation[index - 1], formation[index]), false);
}
```

继续断言阵型不与 `cityHealthBar`、`heroBar`、`ultimateButton`、`autoButton` 重叠。底部六头像栏原断言保持不变。

- [ ] **Step 2: 确认 RED**

```bash
npm run test:ui-layout
npm run test:hud-polish
```

预期：因新 layout key 尚不存在且旧两排断言仍在源码中而失败。

- [ ] **Step 3: 更新布局常量**

在 `BattleUiLayout.ts` 中删除 `gridSlotFront1/2/3`、`gridSlotBack1/2`，新增：

```ts
wallSlotThunderMage: fromCenter(-240, -320, 82, 82),
wallSlotOrdinary1: fromCenter(-120, -320, 82, 82),
mainHeroUnit: fromCenter(0, -320, 96, 112),
wallSlotOrdinary2: fromCenter(120, -320, 82, 82),
wallSlotOrdinary3: fromCenter(240, -320, 82, 82),
```

`cityHealthBar` 维持 `(0, -214, 430, 48)`，`heroBar` 和六个 avatar slot 完全不改。

- [ ] **Step 4: 拆分 GridPlacementSystem 的父层**

构造器改为：

```ts
public constructor(
  backingParent: Node,
  unitParent: Node,
  private readonly model: BattleMvpModel,
)
```

`GridPlacementBacking` 只包含圆形 `Graphics`、透明点击区域和 Button；`GridPlacementUnits` 只包含普通英雄头像/动画。`ButtonView` 增加 `unitNode`，portrait 挂到对应 `unitNode`，动画只改变 portrait，不移动 backing ring。保留低亮度铜色圆环，空槽 label 永远为空。

槽位映射必须是：

```ts
const positions: Record<number, RectSpec> = {
  0: BattleUiV4Layout.wallSlotOrdinary1,
  1: BattleUiV4Layout.wallSlotOrdinary2,
  2: BattleUiV4Layout.wallSlotOrdinary3,
  3: BattleUiV4Layout.wallSlotThunderMage,
};
```

保留槽 3 不可点击、不显示普通英雄头像；固定雷法师由 `ThunderMagePresentation` 独立渲染。

- [ ] **Step 5: 更新源码契约测试**

`battle-hud-polish.test.ts` 检查：旧的 `gridSlotBack2` 和“前/后”文案不再出现在 grid 创建路径；构造器接收 backing/unit 两个 parent；六头像栏源码断言保持原样。

- [ ] **Step 6: 运行 GREEN**

```bash
npm run test:ui-layout
npm run test:hud-polish
npm run test:mvp
npm run typecheck
```

预期：单排五个矩形互不重叠，UI 安全区和六头像栏测试全部通过。

- [ ] **Step 7: 提交站位表现**

```bash
git add assets/scripts/ui/BattleUiLayout.ts assets/scripts/battle/GridPlacementSystem.ts tools/ui-layout-v4.test.ts tools/battle-hud-polish.test.ts
git commit -m "feat: align five units on the city wall"
```

## Task 5: 实现模块化地形 presentation 和原子回退

**Files:**
- Create: `assets/scripts/battle/BattleTerrainPresentation.ts`
- Modify: `tools/terrain-system.test.ts`
- Modify: `tools/scene-structure.test.ts`

- [ ] **Step 1: 先写 presentation 源码契约测试**

测试通过源码和纯状态共同断言：

- presentation 使用 `BATTLE_TERRAIN_ASSET_UUIDS`，不调用远程 URL。
- 初始 `LegacyBattleBackground.active === true`，七个 terrain sprite node 初始都不可见。
- 只有 mode 为 `modular` 才在同一帧显示所有已 ready 的 terrain sprite node 并隐藏旧背景。
- required 失败保持旧背景；optional 失败只关闭对应 node。
- 使用 `loadGeneration` 和 `isValid` 检查晚到回调。
- `warnedFailures: Set<string>` 确保每层最多警告一次。
- render roots 顺序固定，且 restart 不重新 new presentation。

运行 `npm run test:terrain`，预期因文件不存在而 RED。

- [ ] **Step 2: 定义稳定 API**

`BattleTerrainPresentation.ts` 导出：

```ts
export interface BattleTerrainRenderLayers {
  enemies: Node;
  unitBacking: Node;
  units: Node;
  projectiles: Node;
  feedback: Node;
}

export class BattleTerrainPresentation {
  public readonly layers: BattleTerrainRenderLayers;
  public constructor(parent: Node, width: number, height: number, setUiLayer: (node: Node) => void);
  public preload(): void;
  public dispose(): void;
}
```

构造器在一个始终 active 的 `BattleTerrainPresentation` root 下，按以下 sibling 顺序创建并复用节点：legacy background、base、road、left/right ruins、atmosphere、wall back、enemies、backing、units、wall front、projectiles、feedback。创建 root 时先收编 `BattleLayer` 下同名的旧 `BattleFeedbackLayer`，再补缺失节点，避免 scene skeleton 与运行时各保留一份。terrain sprite 的 active 状态独立控制；enemies/backing/units/projectiles/feedback 不得因资源加载状态被关闭。

- [ ] **Step 3: 实现图片加载和节点有效性保护**

每层通过 generated UUID 调用 `assetManager.loadAny`，兼容 `SpriteFrame`、`ImageAsset` 和 `Texture2D`：

```ts
private toSpriteFrame(asset: Asset): SpriteFrame | null {
  if (asset instanceof SpriteFrame) return asset;
  if (asset instanceof ImageAsset) return SpriteFrame.createWithImage(asset);
  if (asset instanceof Texture2D) {
    const frame = new SpriteFrame();
    frame.texture = asset;
    return frame;
  }
  return null;
}
```

回调第一行检查 `generation === this.loadGeneration`、`!this.disposed`、`isValid(this.root, true)` 和目标 node 仍属于本 presentation。失败更新状态并调用统一 `applyMode()`。

- [ ] **Step 4: 实现无闪屏回退**

旧背景节点沿用当前 `drawBackground()` 的深棕 Graphics 保底，并用 `createUiArtSkinNode(legacyNode, 'battle_bg_sandgate_720x1280.png', this.width, this.height, 'LegacyBattleBackgroundSkin')` 挂旧完整背景。加载期间旧背景保持可见；两个必需层都 ready 后，在一次 `applyMode()` 中隐藏 legacy 并启用所有已 ready 的 terrain sprite；必需层失败会关闭全部 terrain sprite，永不显示半成品地形。可选层失败只 `node.active = false` 并调用一次 `console.warn`，其余战斗 render root 始终 active。

- [ ] **Step 5: 补场景结构契约**

`scene-structure.test.ts` 不要求把动态 terrain sprite 写死进 `.scene`，但要确认 `BattleLayer`、`MidStatusLayer`、`TopHudLayer`、`BottomHudLayer`、`UpgradePanelLayer` 的画布层级仍存在，且 `BattleController` 源码使用 presentation 的五个 render roots。

- [ ] **Step 6: 运行 presentation 测试**

```bash
npm run test:terrain
npm run test:scene
npm run typecheck
```

预期：加载状态、节点顺序、回退契约、场景骨架和 TypeScript 全部通过。

- [ ] **Step 7: 在 Cocos 中导入新 TS `.meta` 并提交**

等待 Cocos 为 `BattleTerrainConfig.ts`、`BattleTerrainLoadState.ts`、`BattleTerrainAssets.generated.ts`、`BattleTerrainPresentation.ts` 生成 `.meta`，确认没有脚本 UUID 重写后提交：

```bash
git add assets/scripts/data assets/scripts/battle/BattleTerrainPresentation.ts assets/scripts/battle/BattleTerrainPresentation.ts.meta assets/scripts/battle/BattleTerrainLoadState.ts.meta tools/terrain-system.test.ts tools/scene-structure.test.ts
git commit -m "feat: render modular battle terrain with fallback"
```

## Task 6: 接入控制器并保证攻击特效层级

**Files:**
- Modify: `assets/scripts/battle/BattleController.ts`
- Modify: `assets/scripts/battle/ThunderMagePresentation.ts`
- Modify: `tools/terrain-system.test.ts`
- Modify: `tools/animation-system.test.ts`

- [ ] **Step 1: 写控制器接线失败测试**

源码契约应断言：

```ts
const enemyTemplate = this.battleLayer.getChildByName('EnemyVisualTemplate');
if (enemyTemplate) this.terrainPresentation.layers.enemies.addChild(enemyTemplate);
new EnemySystem(this.terrainPresentation.layers.enemies, enemyTemplate);
new GridPlacementSystem(
  this.terrainPresentation.layers.unitBacking,
  this.terrainPresentation.layers.units,
  this.model,
);
new PlayerAutoAttackSystem(this.terrainPresentation.layers.projectiles, this.playerNode);
new ThunderMagePresentation(
  this.terrainPresentation.layers.units,
  this.terrainPresentation.layers.projectiles,
  (node) => this.setUiLayer(node),
);
```

并断言 `createPlayerNode` 使用 units 层，`createReadabilityUi` 使用 feedback 层，旧 `drawBackground()` 不再由 controller 调用。

- [ ] **Step 2: 确认 RED**

```bash
npm run test:terrain
npm run test:animation
```

预期：旧 constructor 和旧 parent 接线导致源码契约失败。

- [ ] **Step 3: 在 initialize 中只创建一次 presentation**

新增字段：

```ts
private terrainPresentation!: BattleTerrainPresentation;
```

初始化顺序改为：创建 Canvas/BattleLayer -> 创建 presentation 并 `preload()` -> 把 scene 中已有的 `EnemyVisualTemplate` 收编到 enemies 层、`MainHeroPrefab` 收编到 units 层 -> 在 enemies 层画防线 -> 在 units 层创建/复用主角 -> 创建 HUD -> 将各战斗系统接到对应 root。删除 `BattleController.drawBackground()`；不要在 `startBattle()` 或 `clear()` 中重建/重新 preload 地形。收编必须复用原节点，不能在 BattleLayer 留下同名旧节点。

- [ ] **Step 4: 分离雷法师角色父层和效果父层**

`ThunderMagePresentation` 构造器改为：

```ts
public constructor(
  unitParent: Node,
  effectParent: Node,
  setUiLayer: (node: Node) => void,
)
```

`ThunderMageCompanion` 挂 `unitParent`，`ThunderMageEffects` 挂 `effectParent`。攻击资源、动画速度、发射点局部偏移、投射物轨迹和命中爆发算法不变。

- [ ] **Step 5: 校正防线和攻击原点**

防线继续只读取 `model.options.cityLineY`，因此自动变为 `-290`；主角节点读取 `model.playerPosition`，变为 `(0,-320)`；雷法师读取 config，变为 `(-240,-320)`。检查 `EnemySystem`、`PlayerAutoAttackSystem` 内没有残留 `-210/-410` 的战场硬编码。

- [ ] **Step 6: 保证投射物不被前墙遮挡**

主角金色 projectile/hit effect 与雷法师 `ThunderMageEffects` 必须都在 `PlayerAndCompanionProjectiles`。主角本地 aura 和 attack Graphics 继续作为主角子节点保留，不删除；它们随角色位于前墙后方。反馈数字在 `BattleFeedbackLayer`，位于投射物之后。

- [ ] **Step 7: 运行完整代码回归**

```bash
npm run test:mvp
npm run test:terrain
npm run test:ui-layout
npm run test:hud-polish
npm run test:scene
npm run test:animation
npm run test:spine-import
npm run test:thunder-mage-import
npm run typecheck
```

预期：全部退出 0，无跳过测试。

- [ ] **Step 8: 提交集成**

```bash
git add assets/scripts/battle/BattleController.ts assets/scripts/battle/ThunderMagePresentation.ts tools/terrain-system.test.ts tools/animation-system.test.ts
git commit -m "feat: integrate terrain render layers into battle"
```

## Task 7: Cocos 内置浏览器视觉校准与故障演练

**Files:**
- Modify if calibration is needed: `assets/scripts/data/BattleTerrainConfig.ts`
- Modify if calibration is needed: `assets/scripts/ui/BattleUiLayout.ts`
- Create: `docs/superpowers/verification/2026-07-12-modular-terrain-720x1280.png`
- Create: `docs/superpowers/verification/2026-07-12-modular-terrain-notes.md`

- [ ] **Step 1: 启动 720x1280 Web 预览**

```bash
npm run preview:portrait
```

在 Cocos Creator 3.8.8 打开 `assets/scenes/BattleMain.scene`，启动 Web Preview，并在内置浏览器用 720x1280 viewport 打开实际预览 URL。

- [ ] **Step 2: 检查空场与满编阵型**

截取一张空普通槽状态和一张三普通英雄满编状态。满编时顺序必须是雷法师、普通英雄、主角、普通英雄、普通英雄；五个中心 X 为 `-240/-120/0/120/240`，Y 均为 `-320`。主角不与底部头像框重合，城池血条与五名角色都不重合。

- [ ] **Step 3: 检查攻击动画和前后遮挡**

运行至少 30 秒并观察：

- 主角 Spine 攻击仍播放，金色飞弹和命中特效在前墙之上。
- 雷法师 Spine 攻击仍播放，蓝白雷击从新坐标发射并在前墙之上。
- 普通英雄圆环不随 portrait 动画抖动。
- 墙前沿只遮住脚/小腿，不遮头、武器、伤害数字。
- 三路敌人直线推进，在 `y=-290` 停留并攻击城墙。

- [ ] **Step 4: 检查地形品质**

中央三路必须比旧图更开阔，左右废墟不遮挡敌人；主题仍是暖色荒原、战争废墟、沙土和石墙。任何白边、黑底、整块透明矩形、图片拉伸、闪屏、裁切或颜色突变都要回到对应 PNG/配置修正后重测。

- [ ] **Step 5: 演练 required 和 optional 失败**

临时在本地把 generated manifest 中 `wallBack` UUID 改成非法值，预期旧完整背景始终可见且战斗继续；恢复后把 `atmosphere` UUID 改成非法值，预期模块化场景仍显示，只缺 atmosphere，控制台只警告一次。演练结束必须恢复文件并用 `git diff --check` 确认没有残留临时 UUID。

- [ ] **Step 6: 检查重开与控制台**

连续点击重开 5 次。确认没有重复 terrain node、背景不闪、动画仍工作；控制台没有资源、Spine、脚本或渲染 error，预期失败演练之外没有 warning。

- [ ] **Step 7: 保存验收记录**

保存最终 720x1280 截图到指定 PNG；notes 记录预览 URL、Cocos 版本、检查时长、满编人数、required/optional 演练结果和控制台结果。若微调了 `wallFrontY`，只允许在 `-400..-370` 范围内，并同步更新 config 测试断言。

- [ ] **Step 8: 提交视觉校准**

```bash
git add assets/scripts/data/BattleTerrainConfig.ts assets/scripts/ui/BattleUiLayout.ts tools/terrain-system.test.ts tools/ui-layout-v4.test.ts docs/superpowers/verification/2026-07-12-modular-terrain-720x1280.png docs/superpowers/verification/2026-07-12-modular-terrain-notes.md
git commit -m "fix: calibrate modular wall terrain presentation"
```

如果无需代码校准，只提交 verification 两个文件。

## Task 8: 更新 README 并完成最终验证

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README**

新增“模块化战场地形”小节，说明：

- 项目继续使用 Cocos Creator 3.8.8 的 2D Sprite 分层，而不是 4.0 `cc.Terrain`。
- 七个 terrain 资源位于 `assets/bundles/battle_common/`。
- 总上限为 5：主角 1 + 固定雷法师 1 + 普通英雄最多 3。
- 防线 `cityLineY=-290`，五人中心线 `y=-320`。
- 必需层失败回退旧背景，可选层失败跳过。
- 本地验证命令包含 `npm run test:terrain`。

不要改写底部六头像栏、Spine 动画速度公式或现有环境安装说明。

- [ ] **Step 2: 运行格式与静态检查**

```bash
npx prettier --check assets/scripts/data/BattleTerrainConfig.ts assets/scripts/data/BattleTerrainAssets.generated.ts assets/scripts/battle/BattleTerrainLoadState.ts assets/scripts/battle/BattleTerrainPresentation.ts assets/scripts/battle/BattleMvpModel.ts assets/scripts/battle/BattleController.ts assets/scripts/battle/GridPlacementSystem.ts assets/scripts/battle/ThunderMagePresentation.ts assets/scripts/ui/BattleUiLayout.ts tools/terrain-system.test.ts tools/mvp-model.test.ts tools/ui-layout-v4.test.ts README.md
git diff --check
```

若 Prettier 报错，只格式化本计划触及的代码/文档，不运行全仓库格式化。

- [ ] **Step 3: 运行最终测试矩阵**

```bash
npm run test:mvp
npm run test:terrain
npm run test:ui-layout
npm run test:hud-polish
npm run test:scene
npm run test:animation
npm run test:spine-import
npm run test:thunder-mage-import
npm run typecheck
```

预期：九条命令全部退出 0；没有缺失资源、类型错误或旧五槽/两排布局断言。

- [ ] **Step 4: 做最终差异审计**

```bash
git status --short
git diff --stat d680813..HEAD
git diff --name-only d680813..HEAD
```

确认没有提交 `.superpowers/brainstorm/`、`library/`、`temp/`、`build/`、本地 Cocos 配置、临时 UUID 或生成中间图；确认旧背景仍在仓库作为 fallback；确认七张新 PNG 与 `.meta` 成对存在。

- [ ] **Step 5: 提交 README 与最终测试修正**

```bash
git add README.md
git commit -m "docs: document modular wall terrain"
```

- [ ] **Step 6: 在完成前执行 verification skill**

调用 `superpowers:verification-before-completion`，以本 Task 的最新测试输出和 Cocos 视觉记录为证据。若任何检查失败，修复后重新执行受影响测试和完整矩阵，不能用旧输出宣称完成。

## 完成标准

- 七层资源、七个 `.meta` 和 generated UUID 清单齐全且可由 Cocos 3.8.8 加载。
- 旧背景只作为加载中/必需层失败回退，不与模块化背景叠加。
- 城墙、防线和五人站位符合固定坐标，总人数永远不超过 5。
- 槽位 4 与无效扩容 offer 消失，普通英雄邻接为线性 `0-1-2`。
- 主角、雷法师和普通英雄攻击均正常，投射物/命中特效不被前墙遮挡。
- 重开不重复节点、不重复加载、不闪屏；可选层失败不阻断战斗。
- 自动测试、类型检查、Cocos 内置浏览器 720x1280 视觉验收全部通过。
