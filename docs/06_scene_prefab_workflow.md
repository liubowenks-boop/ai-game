# 06 Scene And Prefab Workflow

本文件记录《英雄令》从程序动态 UI 过渡到 Cocos Creator 场景/预制体工作流的第一轮约定。当前仍保持玩法逻辑不变，只把局内界面承载层沉淀到正式场景中。

## 入口场景

- 正式局内入口：`assets/scenes/BattleMain.scene`
- 兼容旧原型：`assets/scenes/BattleMvp.scene`
- 场景设计基准：`720 x 1280`，Portrait

`BattleMain.scene` 中固定保留：

- `BattleRoot`
  - 挂载 `BattleController`
- `BattleMainCanvas`
  - `BattleLayer`
    - `BattleFeedbackLayer`
  - `MidStatusLayer`
  - `TopHudLayer`
  - `BottomHudLayer`
  - `UpgradePanelLayer`

运行时 `BattleController` 会优先复用这些场景节点。如果旧场景或临时测试场景缺少这些节点，代码会自动创建同名节点，保证原型仍可直接运行。

## 为什么先做场景承载层

Cocos 官方文档把 Scene 定义为组织和呈现游戏内容的核心资源。局内 UI 继续全部由代码创建，会让美术、策划和程序很难在编辑器里对齐层级、位置、九宫格和动效。

第一轮只沉淀场景层级，不一次性把所有 UI 改成 Prefab，原因是：

- 避免大改 `BattleController` 导致当前可运行闭环断掉。
- 保留 `BattleMvp.scene` 和自动创建兜底，方便快速测试。
- 让后续每个 UI 组件可以逐个从代码生成迁移到 Prefab 绑定。

## 第一批 Prefab 化目标

后续按以下顺序迁移：

1. `BossHealthBarView`：已完成第一轮场景内 `BossHealthBarPrefab` 占位绑定。
2. `CityHealthBarView`：已完成第一轮场景内 `CityHealthBarPrefab` 占位绑定。
3. `UpgradeCardView`
4. `UltimateButtonView`
5. `HeroAvatarSlotView`

迁移原则：

- Prefab 负责节点结构、九宫格 Sprite、字体、描边、初始布局。
- TypeScript 组件只负责刷新数据、状态和轻量表现。
- 不把玩法规则写进 UI Prefab。
- 不让 UI Prefab 直接依赖平台 API。

## Boss 血条第一轮绑定

`BattleMain.scene` 的 `TopHudLayer` 下保留：

- `BossHealthBarPrefab`
  - `BossNameLabel`
  - `BossHpBarBg`
  - `BossHpBarFill`
  - `BossHpValueLabel`

`BossHealthBarView` 会优先绑定这个节点结构；如果临时场景中没有该节点，则自动创建旧版运行时节点。这样可以先让编辑器层级稳定，再逐步把 `Graphics` 绘制替换为 Sprite 九宫格、ProgressBar 或正式 `.prefab` 资产。

## 城池血条第一轮绑定

`BattleMain.scene` 的 `MidStatusLayer` 下保留：

- `CityHealthBarPrefab`
  - `CityHpLabel`
  - `CityHpBarBg`
  - `CityHpBarFill`
  - `CityHpHitFlash`

`CityHealthBarView` 会优先绑定这个节点结构；如果旧场景或测试场景中没有该节点，则自动创建运行时节点。后续正式美术可直接把 `CityHpBarBg`、`CityHpBarFill`、`CityHpHitFlash` 替换为九宫格 Sprite、ProgressBar 或独立 prefab 子节点。

## 协作注意

- 不要多人同时修改同一个 `.scene` 文件。场景资源文本冲突通常很难安全合并。
- 需要多人并行时，先拆成独立 Prefab，再由一个人集中回填到 `BattleMain.scene`。
- 场景变更后运行：

```bash
npm run test:scene
npm run test:ui-layout
npm run typecheck
```

如果 shell 没有全局 `npm`，可先确认本机 Node 环境或在 Cocos Creator 内刷新预览。

## Cocos 参考

- Cocos Creator 3.8 场景资源：`https://docs.cocos.com/creator/3.8/manual/zh/asset/scene.html`
- Cocos Creator 4.0 场景资源：`https://docs.cocos.com/creator/4.0/manual/zh/asset/scene.html`
