# 写实重型城墙与商用战斗特效 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不升级 Cocos Creator、不更换两套 Spine 和不改变五人阵容规则的前提下，把现有战场升级为参考图方向的写实重型城堡，并为主角、固定雷法师和全部可招募英雄接入可控预算、可复用、可降级的商用级 2D 战斗特效。

**Architecture:** 继续使用现有七层 `BattleTerrainPresentation`，只替换资源规格与坐标；模型通过扩展后的 `AttackEvent` 输出完整但与 Cocos 解耦的表现语义。新增纯数据 `BattleVfxConfig`、纯逻辑 `BattleVfxLogic` 和唯一运行时拥有者 `BattleVfxSystem`：前两者负责职业映射、节流和预算，后者负责 Sprite/`ParticleSystem2D`/Graphics 降级、对象池、资源缓存与生命周期。现有主角、雷法师和普通英雄表现类只负责角色动画，并把攻击事件路由给共享特效系统。

**Tech Stack:** TypeScript 5.5、Cocos Creator 3.8.8 (`Node` / `Sprite` / `SpriteFrame` / `ParticleSystem2D` / `Graphics` / `gfx.BlendFactor`)、Node `tsx` 测试、PNG + Cocos `.meta`、Codex image generation、Cocos 内置浏览器 720x1280 Web 预览。

---

## 固定约束与目标值

本计划实施时以下值只有一个来源，不在 presentation 中复制：

```ts
export const BATTLE_WALL_LAYOUT = {
  cityLineY: -235,
  wallBackY: -400,
  wallFrontY: -470,
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

- 城墙后片目标尺寸 `720x480`，中心 `y=-400`；城墙前片目标尺寸 `720x340`，中心 `y=-470`。
- 固定雷法师基础攻击间隔 `0.85s`；动画基础时长使用同一值。
- 普通怪物基础生命 `24`，基础移动速度 `30`。
- 红色防线在任何输入状态下都不创建、不绘制；`cityLineY` 只参与模型判定。
- 人物脚下不保留圆形底板、圆形描边、圆形攻击强调或空槽圆环；头像自身的裁切形状不属于本条。
- 连续伤害玩法数值仍按每帧计算；普通英雄特效按英雄 ID 节流，不以降低特效频率改变 DPS。

## Task 1: 用测试锁定防线、数值和动画节奏

**Files:**
- Modify: `tools/terrain-system.test.ts`
- Modify: `tools/mvp-model.test.ts`
- Modify: `tools/animation-system.test.ts`
- Modify: `assets/scripts/data/BattleTerrainConfig.ts`
- Modify: `assets/scripts/data/CompanionConfig.ts`
- Modify: `assets/scripts/data/AnimationConfig.ts`
- Modify: `assets/scripts/battle/BattleMvpModel.ts`

- [ ] **Step 1: 先修改地形坐标断言并确认 RED**

在 `tools/terrain-system.test.ts` 把墙体和防线断言改为：

```ts
assert.equal(BATTLE_WALL_LAYOUT.cityLineY, -235);
assert.equal(BATTLE_WALL_LAYOUT.wallBackY, -400);
assert.equal(BATTLE_WALL_LAYOUT.wallFrontY, -470);
assert.equal(BATTLE_WALL_LAYOUT.unitY, -320);
assert.equal(
  BATTLE_WALL_LAYOUT.cityLineY - BATTLE_WALL_LAYOUT.unitY,
  85,
  'monsters must stop 85px ahead of the hero line',
);
```

运行：

```bash
npm run test:terrain
```

预期：只因仍是 `-290/-365/-385` 而失败。

- [ ] **Step 2: 先修改模型数值与停止位置测试并确认 RED**

在 `tools/mvp-model.test.ts` 把默认值断言改为：

```ts
assert.equal(model.options.cityLineY, -235);
assert.equal(model.options.enemyBaseHp, 24);
assert.equal(model.options.enemyBaseSpeed, 30);
assert.equal(model.options.companionAttackInterval, 0.85);
```

新增一个不覆盖默认值的模型，生成敌人并持续 `tick()`，断言敌人的最小 `position.y` 精确为 `-235`，且进入攻击状态后不会继续向城墙移动。保留现有自定义 `cityLineY: 0` 测试，证明测试注入仍有效。

运行：

```bash
npm run test:mvp
```

预期：默认 HP、速度、防线和雷法间隔断言失败；自定义配置测试仍通过。

- [ ] **Step 3: 先锁定雷法动画基础时长并确认 RED**

在 `tools/animation-system.test.ts` 断言：

```ts
assert.equal(THUNDER_MAGE_ATTACK_ANIMATION_BASE_DURATION, 0.85);
assert.equal(
  resolveThunderMageAttackTimeScale(0.85),
  1,
  'base attack interval must play the authored animation at 1x',
);
assert.ok(resolveThunderMageAttackTimeScale(0.5) > 1);
assert.ok(resolveThunderMageAttackTimeScale(1.1) < 1);
```

运行 `npm run test:animation`，预期基础时长仍为 `0.6` 而失败。

- [ ] **Step 4: 更新唯一数据源**

在 `BattleTerrainConfig.ts` 更新前述布局值，并把墙体 layer 规格改为完整对象：

```ts
{
  id: 'wallBack',
  nodeName: 'CityWallBack',
  filename: 'battle_wall_back.png',
  path: 'battle_common/battle_wall_back',
  width: 720,
  height: 480,
  x: 0,
  y: BATTLE_WALL_LAYOUT.wallBackY,
  required: true,
  expectsAlpha: true,
},
{
  id: 'wallFront',
  nodeName: 'CityWallFront',
  filename: 'battle_wall_front.png',
  path: 'battle_common/battle_wall_front',
  width: 720,
  height: 340,
  x: 0,
  y: BATTLE_WALL_LAYOUT.wallFrontY,
  required: false,
  expectsAlpha: true,
},
```

在 `CompanionConfig.ts` 设置 `attackInterval: 0.85`。在 `AnimationConfig.ts` 从 companion 常量导入同一基础值，避免再次手写：

```ts
export const THUNDER_MAGE_ATTACK_ANIMATION_BASE_DURATION =
  THUNDER_MAGE_COMPANION.attackInterval;
```

在 `BattleMvpModel.ts` 仅把默认值改为 `enemyBaseHp: 24`、`enemyBaseSpeed: 30`，防线继续读取 `BATTLE_WALL_LAYOUT.cityLineY`。

- [ ] **Step 5: 运行 GREEN 与类型检查**

```bash
npm run test:terrain
npm run test:mvp
npm run test:animation
npm run typecheck
```

预期：四条命令全部退出码 0；测试输出明确包含新数值。

- [ ] **Step 6: 提交数值合同**

```bash
git add assets/scripts/data/BattleTerrainConfig.ts assets/scripts/data/CompanionConfig.ts assets/scripts/data/AnimationConfig.ts assets/scripts/battle/BattleMvpModel.ts tools/terrain-system.test.ts tools/mvp-model.test.ts tools/animation-system.test.ts
git commit -m "feat: retune wall defense battle pacing"
```

## Task 2: 生成并导入七层写实战场资源

**Files:**
- Modify: `assets/bundles/battle_common/battle_terrain_base_720x1280.png`
- Modify: `assets/bundles/battle_common/battle_road_overlay.png`
- Modify: `assets/bundles/battle_common/battle_ruins_left.png`
- Modify: `assets/bundles/battle_common/battle_ruins_right.png`
- Modify: `assets/bundles/battle_common/battle_atmosphere.png`
- Modify: `assets/bundles/battle_common/battle_wall_back.png`
- Modify: `assets/bundles/battle_common/battle_wall_front.png`
- Modify: corresponding seven `.png.meta` subMetas only through Cocos reimport
- Modify: `assets/scripts/data/BattleTerrainAssets.generated.ts`
- Modify: `tools/terrain-system.test.ts`

- [ ] **Step 1: 使用 imagegen skill 逐层生成，不把参考图直接当背景**

参考图只用于构图与材质：`/Users/hudaijin/Downloads/ChatGPT Image 2026年7月12日 02_25_20.png`。每层单独调用 image generation，基础图使用以下固定提示词：

```text
Production-ready 2D portrait battlefield background for a realistic Chinese legendary fantasy mobile game, 720 by 1280 composition. A long war-scarred desert road with worn stone paving and wheel ruts leads into a dusty fortified camp, side ruins, broken siege frames, bones, stakes and sparse dark-red military banners. Warm gray and ochre sunlight, realistic stone and sand materials, strong depth, quiet central lanes for readable enemies. Match the supplied fortress reference's camera, realism and color language. No wall in the lower 35 percent, no characters, circles, UI, text, health bars, projectiles, effects, vignette or decorative border. Opaque full-frame image.
```

覆盖层使用平面色键背景生成，最后去色键；不得把棋盘格当透明：

```text
Road overlay: only subtle worn stone lane detail, dust ruts and scattered small rubble, flat chroma green background, no wall or side ruins.
Left ruins: only left-edge broken siege scaffolds, stakes, dark rock and two faded red banners, central 55 percent empty, flat chroma green background.
Right ruins: mirrored-composition but uniquely damaged right-edge scaffolds, bones and rubble, central 55 percent empty, flat chroma green background.
Atmosphere: only sparse distant smoke, small embers and edge dust, center lanes clear, flat chroma green background.
Wall back: imposing realistic black-gray stone fortress rear structure, bronze trim, battlement top and five readable standing platforms; long red banners and chains at far sides; flat chroma green background; no people, gate facade, foot circles or UI.
Wall front: foreground fortress facade with massive central bronze-bound gate, dark stone blocks, chains, crenellation lip and torn dark-red banners; top edge must occlude feet at y=-320; flat chroma green background; no people, complete background or UI.
```

- [ ] **Step 2: 去色键、裁切并严格校验尺寸**

对每个色键输出执行：

```bash
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
  --input /absolute/path/to/generated.png \
  --out /absolute/path/to/assets/bundles/battle_common/target.png \
  --auto-key border --soft-matte --transparent-threshold 12 \
  --opaque-threshold 220 --despill
```

基础图缩放/裁切为 `720x1280`；road 为 `720x1280`；左右 ruins 分别为 `360x900`；atmosphere 为 `720x900`；wall back 为 `720x480`；wall front 为 `720x340`。边缘出现绿色污染、白边或矩形底时重做该层，不使用运行时混合模式遮盖。

- [ ] **Step 3: 扩展资源测试后让 Cocos 重新导入**

`tools/terrain-system.test.ts` 继续检查每张 PNG 的实际尺寸、Alpha、透明边角、`.meta` 与 manifest UUID。为两张墙体额外断言可见 Alpha 覆盖率处于 `0.2–0.85`，避免误导入空图或整块背景。

通过 Creator 3.8.8 重新导入，禁止手工改 UUID：

```bash
killall CocosCreator || true
open -na /Applications/Cocos/Creator/3.8.8/CocosCreator.app --args \
  --project /Users/hudaijin/Code/game/ai-game \
  --can-show-upgrade-dialog false
```

等待 Asset Database 空闲后运行：

```bash
node tools/generate-battle-terrain-manifest.mjs
npm run test:terrain
```

预期：七层的文件、尺寸、透明边角、UUID 清单全部通过。

- [ ] **Step 4: 在 Cocos 场景单层预览**

依次临时隐藏其他层，确认：基础图没有墙和人物；中央三条路径可读；左右废墟不盖行军区；wall back 提供人物站立平面；wall front 自然遮挡脚部但不遮挡躯干；两张墙图没有残留色键。

- [ ] **Step 5: 提交地形资源**

```bash
git add assets/bundles/battle_common assets/scripts/data/BattleTerrainAssets.generated.ts tools/terrain-system.test.ts
git commit -m "feat: replace battlefield with realistic fortress terrain"
```

## Task 3: 删除脚下圆圈和全部可见防线

**Files:**
- Modify: `tools/ui-layout-v4.test.ts`
- Modify: `tools/animation-system.test.ts`
- Modify: `assets/scripts/battle/GridPlacementSystem.ts`
- Modify: `assets/scripts/battle/BattleController.ts`

- [ ] **Step 1: 写源代码契约测试并确认 RED**

在 `tools/ui-layout-v4.test.ts` 读取两个源文件并加入：

```ts
assert.equal(controllerSource.includes('CityLineFill'), false);
assert.equal(controllerSource.includes('CityLineStroke'), false);
assert.equal(controllerSource.includes('redrawCityLine'), false);
assert.equal(controllerSource.includes('drawPlayerAttackAccent'), false);
assert.equal(gridSource.includes('drawSlotButton('), false);
assert.equal(gridSource.includes('drawPlainButton('), false);
assert.equal(gridSource.includes('graphics.circle('), false);
```

在 `tools/animation-system.test.ts` 增加主角 presentation 不再绘制圆形攻击强调的断言。运行：

```bash
npm run test:ui-layout
npm run test:animation
```

预期：因旧防线节点、圆形按钮和主角攻击圆仍存在而失败。

- [ ] **Step 2: 保留交互节点，清空站位圆形 Graphics**

在 `GridPlacementSystem.ts` 保留原来的 `Node`、`UITransform` 和 `Button` 命中区域，不改变放置规则。删除 `drawSlotButton`、`drawPlainButton` 及调用；空槽和已占槽不再常驻绘制背景或描边。头像节点可以继续使用自身 mask，但不得创建头像外的圆形地面底板。

把放置态需要的可用位置以数据形式暴露给后续特效系统：

```ts
getAvailablePlacementPoints(): readonly BattlePoint[];
isPlacementModeActive(): boolean;
```

这两个方法只读模型/当前交互状态，不创建视觉节点。

- [ ] **Step 3: 删除红线及主角圆形绘制入口**

在 `BattleController.ts` 删除 `CityLineFill`、`CityLineStroke`、旧 `CityBottomLine` 兼容节点和 `redrawCityLine()`。输入 focus 变化不得重新创建任何线或半透明红区。

删除人物脚下 ellipse/ring/highlight；若 `drawPlayerAttackAccent()` 使用圆形 Graphics，则整体删除，后续由 `BattleVfxSystem` 的武器蓄光/斩焰承担攻击强调。人物节点坐标和 Spine 节点本身不移动。

- [ ] **Step 4: 运行回归并人工检查空阵型**

```bash
npm run test:ui-layout
npm run test:animation
npm run test:mvp
npm run typecheck
```

在内置浏览器进入空阵型和放置模式，确认默认状态没有五个圆环、红线和红色半透明区域；点击区域仍可正常放置。

- [ ] **Step 5: 提交视觉清理**

```bash
git add assets/scripts/battle/GridPlacementSystem.ts assets/scripts/battle/BattleController.ts tools/ui-layout-v4.test.ts tools/animation-system.test.ts
git commit -m "feat: remove formation circles and visible defense line"
```

## Task 4: 建立特效预设、职业映射和预算纯逻辑

**Files:**
- Create: `assets/scripts/data/BattleVfxConfig.ts`
- Create: `assets/scripts/battle/BattleVfxLogic.ts`
- Create: matching `.meta` files through Cocos import
- Create: `tools/vfx-system.test.ts`
- Modify: `package.json`

- [ ] **Step 1: 先写职业映射、节流和预算测试**

`tools/vfx-system.test.ts` 只导入无 `cc` 依赖的文件，覆盖：

```ts
assert.equal(resolveAttackVfxPreset({ source: 'main' }).id, 'main_fire_gold');
assert.equal(resolveAttackVfxPreset({ source: 'companion' }).id, 'thunder');
assert.equal(resolveHeroVfxPreset('弓手', 'single').id, 'gold_arrow');
assert.equal(resolveHeroVfxPreset('火药师', 'area').id, 'fire_blast');
assert.equal(resolveHeroVfxPreset('冰法师', 'slow').id, 'ice_shard');
assert.equal(resolveHeroVfxPreset('毒师', 'poison').id, 'poison_wisp');
assert.equal(resolveHeroVfxPreset('护卫', 'guard').id, 'shield_impact');
assert.equal(resolveHeroVfxPreset('鼓手', 'aura').id, 'warm_support');
assert.equal(resolveHeroVfxPreset('治疗师', 'heal').id, 'healing_spirit');
assert.equal(resolveHeroVfxPreset('咒术师', 'debuff').id, 'curse_wisp');

const limiter = new BattleVfxLimiter(BATTLE_VFX_BUDGET);
assert.equal(limiter.tryStartHeroAttack(11, 0), true);
assert.equal(limiter.tryStartHeroAttack(11, 0.2), false);
assert.equal(limiter.tryStartHeroAttack(12, 0.2), true);
assert.equal(limiter.tryStartHeroAttack(11, 0.7), true);
```

再覆盖：普通命中粒子数在 `40–70`，暴击/Boss 在 `90–140`；生命周期不超过 `0.9s`；active node 达到硬上限时拒绝新的 decorative effect，但允许 critical impact 通过回收最旧 decorative effect 获得名额；`reset()` 后全部计数和 hero 节流时间清零。

- [ ] **Step 2: 注册命令并确认 RED**

在 `package.json` 增加：

```json
"test:vfx": "tsx tools/vfx-system.test.ts"
```

运行 `npm run test:vfx`，预期只因两个新模块不存在而失败。

- [ ] **Step 3: 实现纯数据预设**

`BattleVfxConfig.ts` 不导入 `cc`，定义：

```ts
export type BattleVfxPresetId =
  | 'main_fire_gold' | 'thunder' | 'gold_arrow' | 'fire_blast'
  | 'ice_shard' | 'poison_wisp' | 'shield_impact'
  | 'warm_support' | 'healing_spirit' | 'curse_wisp';

export interface BattleVfxPreset {
  id: BattleVfxPresetId;
  projectileTexture: BattleVfxTextureId;
  impactTexture: BattleVfxTextureId;
  trailColor: readonly [number, number, number, number];
  hitColor: readonly [number, number, number, number];
  travelSeconds: number;
  particleCount: number;
  criticalParticleCount: number;
  presentationInterval: number;
}

export const BATTLE_VFX_BUDGET = {
  maxActiveProjectiles: 18,
  maxActiveImpacts: 14,
  maxActiveParticleSystems: 10,
  maxEstimatedParticles: 620,
  maxPlacementMarkers: 5,
} as const;
```

普通英雄 `presentationInterval` 按职业固定在 `0.65–0.85s`，主角与雷法师由真实攻击事件驱动，不额外修改其玩法间隔。

- [ ] **Step 4: 实现纯逻辑 limiter**

`BattleVfxLogic.ts` 提供：

```ts
export class BattleVfxLimiter {
  tryStartHeroAttack(heroId: number, nowSeconds: number): boolean;
  reserve(kind: 'projectile' | 'impact' | 'particle', estimate: number, critical: boolean): VfxReservation | undefined;
  release(reservation: VfxReservation): void;
  reset(): void;
}

export function resolveAttackVfxPreset(input: AttackVfxDescriptor): BattleVfxPreset;
export function resolveHeroVfxPreset(heroName: string, role: HeroRole): BattleVfxPreset;
```

预算对象必须可重复释放且不会变负；关键命中只能淘汰最旧的非关键 reservation，不能淘汰仍在飞行的主弹道。

- [ ] **Step 5: 运行 GREEN 并提交**

```bash
npm run test:vfx
npm run typecheck
git add assets/scripts/data/BattleVfxConfig.ts assets/scripts/data/BattleVfxConfig.ts.meta assets/scripts/battle/BattleVfxLogic.ts assets/scripts/battle/BattleVfxLogic.ts.meta tools/vfx-system.test.ts package.json package-lock.json
git commit -m "feat: define battle vfx presets and budgets"
```

## Task 5: 生成、导入并登记透明特效纹理

**Files:**
- Create: `assets/bundles/ui/battle_fx_common/fx_v2_gold_projectile.png`
- Create: `assets/bundles/ui/battle_fx_common/fx_v2_fire_slash.png`
- Create: `assets/bundles/ui/battle_fx_common/fx_v2_thunder_bolt.png`
- Create: `assets/bundles/ui/battle_fx_common/fx_v2_ice_shard.png`
- Create: `assets/bundles/ui/battle_fx_common/fx_v2_poison_wisp.png`
- Create: `assets/bundles/ui/battle_fx_common/fx_v2_heal_orb.png`
- Create: `assets/bundles/ui/battle_fx_common/fx_v2_shield_impact.png`
- Create: `assets/bundles/ui/battle_fx_common/fx_v2_hit_star.png`
- Create: `assets/bundles/ui/battle_fx_common/fx_v2_smoke_debris.png`
- Create: `assets/bundles/ui/battle_fx_common/fx_v2_rune_marker.png`
- Create: corresponding ten `.png.meta` files through Cocos import
- Modify: `docs/05_ui_art_asset_checklist.md`
- Modify: `tools/generate_ui_art_assets.py`
- Modify: `assets/scripts/ui/UiArtManifest.ts`
- Modify: `tools/vfx-system.test.ts`

- [ ] **Step 1: 用 imagegen skill 一图一元素生成高清纹理**

参考 `/Users/hudaijin/Downloads/ChatGPT Image 2026年7月12日 02_36_51.png` 的轮廓锐度、核心亮度和元素配色，但不复制其中成品。统一提示词尾部：

```text
High-end realistic legendary fantasy mobile game VFX sprite, isolated single effect, sharp luminous white core, layered colored energy, readable silhouette, generous transparent padding, no character, weapon, UI, text, border, watermark, pixel art or cartoon style. Flat chroma key background with no shadows cast onto the background.
```

逐张生成固定内容和目标尺寸：gold projectile `512x128`、fire slash `512x256`、thunder bolt `512x128`、ice shard `256x128`、poison wisp `256x256`、heal orb `256x256`、shield impact `256x256`、hit star `256x256`、smoke debris `256x256`、rune marker `256x128`。绿色毒雾和治疗纹理使用洋红色键，其他使用绿色键。

- [ ] **Step 2: 去色键并做像素合同测试**

使用 Task 2 的 `remove_chroma_key.py`。在 `tools/vfx-system.test.ts` 对十张图片断言：尺寸正确、RGBA、四角至少三角 Alpha `<16`、中心/主体存在 Alpha `>180`、透明像素比例大于 `35%`。检查边缘颜色，绿色素材不得有洋红 despill，其他素材不得有绿色边。

- [ ] **Step 3: 把 v2 纹理加入清单且禁止生成器覆盖原图**

在 `docs/05_ui_art_asset_checklist.md` 的 `battle_fx_common` 表按上述十个文件名和尺寸追加条目，九宫格均为“不做九宫格”。在 `tools/generate_ui_art_assets.py` 的主生成循环加入明确保护：

```py
target_path = RUNTIME_ROOT / spec.atlas / spec.filename
if spec.filename.startswith("fx_v2_"):
    if not target_path.exists():
        raise FileNotFoundError(f"missing authored VFX texture: {target_path}")
    continue
img = draw_asset(spec)
```

这保证清单和 manifest 仍由同一生成器管理，但 AI 生成的 v2 纹理不会被 `draw_fx()` 占位图覆盖。先记录十张图片的 SHA-256，执行生成器后再次计算并断言完全一致。

- [ ] **Step 4: 通过 Cocos 生成 meta 并刷新 UI manifest**

在 Creator 3.8.8 等待导入完成，然后运行现有生成器：

```bash
python tools/generate_ui_art_assets.py
npm run test:vfx
npm run typecheck
```

测试还要导入 `UiArtAssets`，逐项用十个文件名取值，并断言 `atlas === 'battle_fx_common'`、`path === 'battle_fx_common/' + filenameWithoutExtension`、`width/height` 正确、`uuid` 和 `textureUuid` 非空，确保 runtime 不依赖裸 UUID 字符串。若外部 CC0 素材最终没有使用，不新增许可证文件；若确实补入，则同时创建 `assets/bundles/ui/battle_fx_common/THIRD_PARTY_LICENSES.md`，逐项记录作者、原始 URL、许可证和修改。

- [ ] **Step 5: Cocos 资源预览检查**

逐张在深色与浅色背景下预览；主体不可裁边、不可残留矩形底、发光核心不能大面积纯白导致形状消失。纹理使用 linear、clamp-to-edge、关闭 mipmap。

- [ ] **Step 6: 提交纹理与清单**

```bash
git add assets/bundles/ui/battle_fx_common assets/scripts/ui/UiArtManifest.ts docs/05_ui_art_asset_checklist.md docs/ui_art_generated tools/generate_ui_art_assets.py tools/vfx-system.test.ts
git commit -m "feat: add generated legendary battle vfx textures"
```

## Task 6: 扩展攻击事件为完整表现语义

**Files:**
- Modify: `assets/scripts/battle/BattleMvpModel.ts`
- Modify: `tools/mvp-model.test.ts`

- [ ] **Step 1: 先为事件元数据写失败测试**

对主角、雷法师、普通英雄主目标、普通英雄溅射分别断言：

```ts
assert.deepEqual(mainEvent.originPosition, model.playerPosition);
assert.equal(mainEvent.impactKind, 'primary');
assert.equal(companionEvent.heroName, '雷法师');
assert.deepEqual(companionEvent.originPosition, model.getFixedCompanion().position);
assert.equal(heroEvent.heroId, placedHero.id);
assert.equal(heroEvent.heroName, placedHero.name);
assert.equal(heroEvent.heroRole, placedHero.role);
assert.deepEqual(heroEvent.originPosition, placedHero.position);
assert.equal(heroEvent.impactKind, 'primary');
assert.equal(splashEvent.impactKind, 'splash');
assert.equal(lethalEvent.killed, true);
```

运行 `npm run test:mvp`，预期元数据为 `undefined` 而失败。

- [ ] **Step 2: 扩展类型，不引入 Cocos 类型**

在 `AttackEvent` 增加：

```ts
originPosition?: BattlePoint;
heroId?: number;
heroName?: string;
heroRole?: HeroRole;
impactKind: 'primary' | 'splash' | 'status';
targetKind: EnemyKind;
killed: boolean;
```

为 `damageEnemy()` 增加 `DamagePresentation` 参数，调用方显式传入来源位置和英雄信息。先计算 `killed`，再 push event，确保事件值与本次伤害后的模型状态一致。

- [ ] **Step 3: 给每类伤害填充正确语义**

- 主角和 companion 使用各自固定站位，`impactKind: 'primary'`。
- 普通英雄每个 tick 的主目标事件携带英雄 ID/名称/role/position；area secondary 使用 `splash`。
- burn、poison 使用 `status` 且不创建弹道；thunder chain 的首目标为 primary，后续为 splash。
- 所有事件复制位置值，不暴露模型内部可变对象。

- [ ] **Step 4: 运行模型与类型回归后提交**

```bash
npm run test:mvp
npm run test:animation
npm run typecheck
git add assets/scripts/battle/BattleMvpModel.ts tools/mvp-model.test.ts
git commit -m "feat: expose battle attack presentation metadata"
```

## Task 7: 实现对象池化 BattleVfxSystem

**Files:**
- Create: `assets/scripts/battle/BattleVfxSystem.ts`
- Create: `assets/scripts/battle/BattleVfxSystem.ts.meta`
- Modify: `tools/vfx-system.test.ts`
- Modify: `tools/animation-system.test.ts`

- [ ] **Step 1: 先写运行时结构契约测试**

因为 Node 测试环境不能实例化 Cocos，读取 `BattleVfxSystem.ts` 源码并断言公开生命周期和关键 API 存在：

```ts
assert.match(source, /class BattleVfxSystem/);
assert.match(source, /async preload\(\)/);
assert.match(source, /playAttackEvent\(/);
assert.match(source, /playWallImpact\(/);
assert.match(source, /setPlacementMarkers\(/);
assert.match(source, /resetSystem\(\)/);
assert.match(source, /stopSystem\(\)/);
assert.match(source, /gfx\.BlendFactor\.ONE/);
assert.match(source, /clear\(\)/);
assert.match(source, /dispose\(\)/);
assert.equal(source.includes('autoRemoveOnFinish = true'), false);
```

运行 `npm run test:vfx`，预期缺文件失败。

- [ ] **Step 2: 实现一次加载和 warn-once 降级**

`BattleVfxSystem` 构造函数接收 `projectileRoot`、`feedbackRoot`。`preload()` 从 `UiArtManifest` 获取十个 SpriteFrame，缓存 Promise，重复调用不重复加载。每个纹理失败只 warning 一次，并将该 preset 标记为 Graphics fallback；单张失败不拒绝整个 preload。

公开攻击入口返回是否实际占用预算，供普通英雄同步本地攻击动作：

```ts
export interface BattleVfxPlayResult {
  readonly played: boolean;
  readonly presetId: BattleVfxPresetId;
}

playAttackEvent(event: AttackEvent): BattleVfxPlayResult;
```

- [ ] **Step 3: 实现三个有界对象池**

内部池固定为：

```ts
private readonly projectilePool: VfxSpriteHandle[];
private readonly impactPool: VfxSpriteHandle[];
private readonly particlePool: VfxParticleHandle[];
```

创建量不超过 `BATTLE_VFX_BUDGET`，节点只在初始化/池扩容上限内创建。回收时必须：停止粒子、清 SpriteFrame、恢复 opacity/scale/rotation、取消 reservation、移除 active 数组并 `active=false`；不得依赖 `autoRemoveOnFinish` 销毁节点。

- [ ] **Step 4: 实现弹道、命中和 ParticleSystem2D**

`playAttackEvent(event)` 解析 preset，primary 创建从 `originPosition` 到 `enemyPosition` 的定向 projectile；到达后回收弹道并播放 impact。splash/status 不再创建重复弹道，只播放对应 impact/residue。

粒子系统按 Creator 3.8.8 runtime API 设置 `custom=true`、`spriteFrame`、`totalParticles`、`life/lifeVar`、`speed/speedVar`、`angle/angleVar`、start/end color、start/end size、gravity、emissionRate；混合设置：

```ts
particle.srcBlendFactor = gfx.BlendFactor.SRC_ALPHA;
particle.dstBlendFactor = gfx.BlendFactor.ONE;
particle.resetSystem();
```

结束时调用 `stopSystem()` 再归池。普通命中 `40–70`，critical/Boss `90–140`，任何实例 life 不超过 `0.9s`。

- [ ] **Step 5: 实现 Graphics fallback 与 placement marker**

缺纹理时使用短线弹道、星形冲击和小型弧线，不绘制实心矩形。`setPlacementMarkers(points)` 最多显示 5 个非实心金色符文/边缘亮光，淡入后轻微呼吸；传空数组立即淡出并归池，不常驻显示。

- [ ] **Step 6: 实现可观测统计与彻底清理**

提供只读调试快照：

```ts
getDebugSnapshot(): {
  activeProjectiles: number;
  activeImpacts: number;
  activeParticleSystems: number;
  estimatedParticles: number;
  pooledNodes: number;
};
```

`clear()` 回收全部 active handle 并 reset limiter；`dispose()` 在 clear 后销毁池节点、清缓存、解除根引用。该快照只供测试/开发日志，不创建屏幕 UI。

- [ ] **Step 7: 运行检查并提交**

```bash
npm run test:vfx
npm run test:animation
npm run typecheck
git add assets/scripts/battle/BattleVfxSystem.ts assets/scripts/battle/BattleVfxSystem.ts.meta tools/vfx-system.test.ts tools/animation-system.test.ts
git commit -m "feat: add pooled battle vfx runtime"
```

## Task 8: 接入主角、雷法师和全部普通英雄

**Files:**
- Modify: `assets/scripts/battle/PlayerAutoAttackSystem.ts`
- Modify: `assets/scripts/battle/ThunderMagePresentation.ts`
- Modify: `assets/scripts/battle/GridPlacementSystem.ts`
- Modify: `assets/scripts/battle/BattleController.ts`
- Modify: `tools/animation-system.test.ts`
- Modify: `tools/vfx-system.test.ts`

- [ ] **Step 1: 先写路由所有权测试并确认 RED**

源代码测试固定以下边界：

```ts
assert.equal(playerSource.includes('ParticleSystem2D'), false);
assert.equal(thunderSource.includes('ParticleSystem2D'), false);
assert.equal(playerSource.includes('battleVfx.playAttackEvent'), true);
assert.equal(thunderSource.includes('battleVfx.playAttackEvent'), true);
assert.equal(gridSource.includes('battleVfx.playAttackEvent'), true);
assert.equal(controllerSource.includes('new BattleVfxSystem'), true);
```

还要断言 thunder presentation 仍调用 Spine 攻击动画时间缩放，不因特效重构删除动画。运行 `npm run test:animation && npm run test:vfx`，预期路由断言失败。

- [ ] **Step 2: 让 BattleController 创建唯一共享实例**

在 terrain presentation 的 projectile/feedback 稳定根创建后实例化一次：

```ts
this.battleVfx = new BattleVfxSystem(projectileRoot, feedbackRoot);
void this.battleVfx.preload();
```

把该实例注入 `PlayerAutoAttackSystem`、`ThunderMagePresentation`、`GridPlacementSystem`。每帧只由 controller 调一次 `battleVfx.update(deltaTime)`。

- [ ] **Step 3: 主角只保留角色动画与事件筛选**

`PlayerAutoAttackSystem` 保留现有 `refresh/update/clear` 公共接口和主角攻击动画触发；删除自有 projectile、hit burst、临时 particle 节点与绘制数组。对于 `main` 和主目标 `thunder_chain` 事件调用共享系统；同一 chain 的 splash 由共享系统只播落点电弧，不重复创建主弹道。

- [ ] **Step 4: 雷法师 Spine 与实际 0.85s 攻击同步**

`ThunderMagePresentation` 收到 companion event 时先按模型实际间隔设置 Spine `timeScale` 并播放 attack，再调用 `battleVfx.playAttackEvent(event)`。删除内部 Graphics projectile/burst 数组。连续攻击期间动画不得被 idle 提前覆盖；攻击完成或中断后回 idle。

- [ ] **Step 5: 普通英雄主事件节流表现**

`GridPlacementSystem` 按模型给出的顺序遍历本 tick 的 `hero_dps`，并为这一 tick 建立局部 `Set<number>` 记录已播放 primary 的英雄：

- primary 调用 `battleVfx.playAttackEvent(event)`；返回 `played: true` 时，把 `heroId` 加入局部 Set，并触发该英雄本地攻击摆动/闪光。hero DPS 的节流由共享系统内部 limiter 统一执行，Grid 不直接持有 limiter。
- splash 只在局部 Set 已包含同一 `heroId` 时调用 `playAttackEvent(event)` 追加 impact，避免 area 英雄每帧刷满预算。
- burn/poison 不从这里重复播放，交给 Task 9 的状态反馈。
- 8 个英雄都从 event 的 `heroName/heroRole` 解析 preset；未知英雄回落 `gold_arrow`，不得抛错。

- [ ] **Step 6: 接入放置符文而不恢复圆圈**

placement mode 激活时调用：

```ts
battleVfx.setPlacementMarkers(grid.getAvailablePlacementPoints());
```

放置完成、取消、战斗重置时传 `[]`。符文只出现在空槽，人物脚下和已占槽不显示。

- [ ] **Step 7: 回归并提交**

```bash
npm run test:animation
npm run test:vfx
npm run test:mvp
npm run typecheck
git add assets/scripts/battle/PlayerAutoAttackSystem.ts assets/scripts/battle/ThunderMagePresentation.ts assets/scripts/battle/GridPlacementSystem.ts assets/scripts/battle/BattleController.ts tools/animation-system.test.ts tools/vfx-system.test.ts
git commit -m "feat: route all hero attacks through shared vfx"
```

## Task 9: 补齐受击、死亡、状态和城墙反馈生命周期

**Files:**
- Modify: `assets/scripts/battle/BattleVfxSystem.ts`
- Modify: `assets/scripts/battle/EnemySystem.ts`
- Modify: `assets/scripts/battle/BattleController.ts`
- Modify: `tools/vfx-system.test.ts`
- Modify: `tools/animation-system.test.ts`

- [ ] **Step 1: 先写反馈入口和重复播放防护测试**

扩展 source contract，要求系统具有：

```ts
playStatusImpact(event: AttackEvent): void;
playEnemyDeath(position: BattlePoint, kind: EnemyKind): void;
playWallImpact(position?: BattlePoint): void;
```

纯逻辑测试证明同一个 `enemyId + source + 100ms bucket` 的 status feedback 只接收一次；死亡事件优先级高于普通 impact；wall impact 不计入 hero presentation throttle。

- [ ] **Step 2: EnemySystem 保留受击动作，去掉廉价常驻环**

继续使用 HP 下降检测、受击 Spine/白闪和死亡淡出。把敌人脚下 burn/poison 常驻环替换为低密度贴身余烬/毒雾请求；状态消失后停止请求并归池。伤害数字继续保持在特效上层，不能被冲击 Sprite 遮挡。

- [ ] **Step 3: 模型事件驱动命中和死亡反馈**

Controller 本 tick 处理顺序固定为：角色攻击动画 -> projectile/impact 请求 -> EnemySystem HP/动作刷新 -> killed event 死亡爆散。`killed=true` 时普通 impact 降为小闪，死亡爆散作为主反馈，避免同位置双重大爆炸。

- [ ] **Step 4: 用 cityDamage delta 驱动城墙受击**

比较相邻 tick 的 city HP 或本 tick city damage 字段；每次有效扣血只调用一次 `playWallImpact({ x: attackerLaneX, y: -300 })`。效果使用 `fx_v2_smoke_debris`、小石屑、尘雾和短促暖光；不得创建红线、整屏闪白或橙黄色实心矩形。

- [ ] **Step 5: 重开、失败、销毁路径全部清理**

在 restart/reset/onDestroy 路径调用 `battleVfx.clear()`；场景销毁调用 `dispose()`。异步 preload 回调必须检查 destroyed/disposed flag，不能在场景退出后重新挂节点。

- [ ] **Step 6: 运行回归并提交**

```bash
npm run test:vfx
npm run test:animation
npm run test:mvp
npm run test:scene
npm run typecheck
git add assets/scripts/battle/BattleVfxSystem.ts assets/scripts/battle/EnemySystem.ts assets/scripts/battle/BattleController.ts tools/vfx-system.test.ts tools/animation-system.test.ts
git commit -m "feat: add enemy and fortress impact feedback"
```

## Task 10: 全量验证、浏览器视觉对比和文档收尾

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/verification/2026-07-12-commercial-terrain-empty.jpg`
- Create: `docs/superpowers/verification/2026-07-12-commercial-terrain-five-unit.jpg`
- Create: `docs/superpowers/verification/2026-07-12-commercial-vfx-stress.jpg`
- Create: `docs/superpowers/verification/2026-07-12-commercial-terrain-vfx.md`

- [ ] **Step 1: 运行完整自动测试矩阵**

```bash
npm run test:mvp
npm run test:spine-import
npm run test:thunder-mage-import
npm run test:terrain
npm run test:ui-layout
npm run test:hud-polish
npm run test:scene
npm run test:animation
npm run test:vfx
npm run typecheck
```

预期：全部退出码 0。任何旧测试失败都必须解释并修复，不能删除与本轮目标无关的断言来换取通过。

- [ ] **Step 2: 启动 Cocos Creator 3.8.8 Web 预览**

确认编辑器完成资源导入，运行 `npm run preview:portrait`，再从 Creator 启动 Browser Preview。使用实际预览 URL，不使用静态 mock 页面作为最终验收。

- [ ] **Step 3: 在 720x1280 做三组视觉验收**

1. 空阵型：无脚下圆圈、无红线；写实道路与重型城墙完整；底部 HUD 不遮城门关键结构。
2. 五人满编：五人横向对齐，脚部被前墙自然遮挡；人物与城墙材质色温一致；任何角色头顶不出现橙黄色矩形。
3. 高强度战斗：主角、雷法师和 8 种普通英雄逐一验证弹道与命中；怪物停在 `y=-235`，不进入人物线；血条和伤害数字始终可读。

分别保存截图到本任务列出的三个绝对路径，并与两张用户参考图并排检查构图、墙体占比、材质、光效亮度和元素轮廓。

- [ ] **Step 4: 连续运行 30 秒检查预算与闪屏**

在最高可达攻击密度下连续运行至少 30 秒，每 5 秒读取一次 `getDebugSnapshot()`。验收：active 数量不超过配置上限；第 30 秒 pooledNodes 与第 10 秒相同；场景无整屏闪白、纯色矩形、节点累积、warning/error；主流桌面浏览器接近 60 FPS。若超预算，先缩短 decorative trail 或降低普通 impact 粒子数，不降低关键命中可读性。

- [ ] **Step 5: 更新 README 和验证记录**

README 记录：七层写实地形结构、`BattleVfxSystem` 职责、如何替换纹理、`npm run test:vfx`、3.8 runtime API 与 4.0 概念文档的版本区别、外部 CC0 资源记录位置。验证 Markdown 记录测试输出摘要、Creator 版本、预览 URL/viewport、30 秒预算快照和三张截图链接。

- [ ] **Step 6: 检查工作树和最终 diff**

```bash
git status --short
git diff --check
git diff --stat HEAD~9..HEAD
```

确认没有生成缓存、临时色键图、浏览器 profile、`.DS_Store` 或未解释的场景序列化改动。确认参考图没有复制进项目资源。

- [ ] **Step 7: 提交验证与文档**

```bash
git add README.md docs/superpowers/verification
git commit -m "docs: verify commercial terrain and battle vfx"
```

## 最终完成标准

- 自动测试和 TypeScript 类型检查全部通过。
- 七层资源保持独立、尺寸正确、透明边缘干净，必需层失败仍可回退旧背景。
- 城墙占下方约 `32%–35%`，五人站在垛口并由前墙遮脚。
- 所有脚下圆圈与可见红线均消失，交互命中和放置流程仍可用。
- 怪物停止在 `cityLineY=-235`；HP、速度和雷法攻击间隔符合确认值。
- 主角、雷法师与 8 种英雄均有职业化弹道/命中表现；状态、死亡和城墙受击无纯色矩形或整屏闪烁。
- 30 秒压力运行不突破预算、无节点增长、无控制台 warning/error，并留存三张真实 Cocos 预览截图。
