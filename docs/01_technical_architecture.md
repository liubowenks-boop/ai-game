# 01 Technical Architecture

## 技术栈

项目使用 **Cocos Creator 3.8 + TypeScript**。当前阶段是《英雄令》v0.2 可玩性构筑版本，只做可运行原型闭环和局内构筑差异，不接平台 API，不导入美术资源。

## 当前代码结构

- `assets/scripts/battle/BattleController.ts`：Cocos 入口组件。运行时动态创建 Canvas、基础按钮、标签、敌人色块、主角节点和棋盘按钮。
- `assets/scripts/battle/BattleMvpModel.ts`：纯 TypeScript 规则模型，不依赖 Cocos。负责核心战斗状态、三流派构筑、波次节奏、英雄 DPS 和敌人状态，便于用 Node 直接测试。
- `assets/scripts/data/BattleConfig.ts`：英雄、敌人、强化卡静态配置。后续调数值优先修改该文件。
- `assets/scripts/battle/EnemySystem.ts`：根据模型中的敌人状态创建、移动和销毁原型敌人节点。
- `assets/scripts/battle/PlayerAutoAttackSystem.ts`：根据主角攻击、暴击和雷链事件绘制简单直线反馈。
- `assets/scripts/battle/WaveSystem.ts`：刷新当前波次显示。
- `assets/scripts/battle/CityHealthSystem.ts`：刷新城池血量和失败状态。
- `assets/scripts/battle/GridPlacementSystem.ts`：招募按钮、前排 3 格、后排 2 格、放置和合成后的显示刷新。
- `assets/scripts/roguelike/UpgradeCardSystem.ts`：三选一强化卡片显示和点击生效。
- `tools/mvp-model.test.ts`：规则测试，覆盖刷怪、城血、最近目标、三流派强化、火烧、雷链、Boss 波次和同名合成。

## 模块职责

### core

当前未新增运行时代码。后续可放生命周期、事件总线、服务注册等基础设施。

### battle

当前 MVP 的主要实现目录。包含 `BattleController`、`BattleMvpModel`、敌人、波次、主角自动攻击、城血和布阵系统。

### roguelike

当前包含 `UpgradeCardSystem`，实现三选一强化 UI 和点击应用逻辑。强化卡必须属于火系、雷系或召唤系，实际规则由 `BattleMvpModel` 执行。

### ui

当前没有单独 UI 组件文件。MVP UI 由 `BattleController` 和系统类动态创建，后续正式 UI 再拆到该目录。

### platform

当前不接入 `tt` 或 `ks`。平台能力仍应留在适配层，不允许战斗代码直接依赖平台 API。

### data

当前英雄、敌人和强化卡配置放在 `assets/scripts/data/BattleConfig.ts`。战斗运行参数仍在 `BattleMvpModel` 的默认选项中，后续可以继续迁移到可导表数据。

### utils

当前未新增工具函数。后续可放随机、数学、格式化等无业务状态工具。

## 当前 MVP 运行流

1. Cocos 场景中挂载 `BattleController`。
2. `BattleController.start()` 动态创建原型 Canvas、战场层和 UI 层。
3. 玩家点击“开始战斗”后调用 `BattleMvpModel.startBattle()`。
4. 每帧由 `BattleMvpModel.tick(deltaTime)` 推进规则。
5. `EnemySystem` 将敌人状态同步为原型色块节点。
6. `PlayerAutoAttackSystem` 展示主角攻击连线。
7. `UpgradeCardSystem` 在模型触发强化时显示 3 张流派卡片。
8. `GridPlacementSystem` 处理招募、放置、同格/相邻合成、上阵数量和英雄 DPS 显示。

## v0.2 规则边界

- 火系：主角普攻附加灼烧，灼烧可叠加并持续掉血，火系卡提高灼烧伤害或扩散数量。
- 雷系：主角攻击有暴击率，雷系卡提高连锁目标或暴击率。
- 召唤系：英雄提供主要 DPS，召唤卡提高可上阵数量或全体英雄伤害。
- 波次：1-3 波教学，4 波精英，5 波 Boss，之后按 5 波一轮循环并提高强度。
- 敌人：普通、快速、厚血、远程、Boss 均由配置定义；远程怪靠近城池后会持续放血。

## 资源与平台策略

- 当前不使用真实资源，不新增图片、音频、字体。
- 当前不生成平台构建，不接入抖音或快手 SDK。
- 后续资源分包仍保留 `assets/bundles/` 下的规划目录。
- 后续平台能力必须通过 `platform` 模块适配，不让战斗代码直接依赖 `tt` 或 `ks`。

## 验证方式

运行纯逻辑测试：

```bash
npm run test:mvp
```

运行 TypeScript 检查：

```bash
npm run typecheck
```

在 Cocos Creator 中运行：

1. 打开项目根目录。
2. 创建空场景和空节点。
3. 将 `BattleController` 挂到空节点。
4. 预览并点击“开始战斗”。
