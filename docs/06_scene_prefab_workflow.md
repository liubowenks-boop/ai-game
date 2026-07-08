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
3. `UpgradeCardView`：已完成第一轮场景内 `UpgradeCardSystem` 与三张卡槽占位绑定。
4. `UltimateButtonView`：已完成第一轮场景内 `UltimateButtonPrefab` 占位绑定。
5. `HeroAvatarSlotView`：已完成第一轮场景内三枚 `HeroAvatarSlot` 占位绑定。
6. 自动按钮、羁绊按钮：已完成第一轮场景内 `AutoButtonPrefab`、`BondButtonPrefab` 占位绑定。
7. 暂停、倍速、箭塔、火油按钮：已完成第一轮场景内按钮占位绑定。
8. 顶部资源信息、波次、剩余敌人、局内状态、流派提示：已完成第一轮场景内信息节点绑定。
9. Combo、开始战斗按钮、战斗提示和浮字反馈：已完成第一轮场景内占位绑定。

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

## 三选一强化卡第一轮绑定

`BattleMain.scene` 的 `UpgradePanelLayer` 下保留：

- `UpgradeCardSystem`
  - `UpgradePanelSkin`
  - `UpgradeTitleSkin`
  - `UpgradeTitleLabel`
  - `UpgradeCardSlot1`
  - `UpgradeCardSlot2`
  - `UpgradeCardSlot3`

每个 `UpgradeCardSlot` 下保留：

- `CardSkin`
- `CardFrame`
- `CardTitleLabel`
- `IconPlaceholder`
- `CardDescriptionLabel`
- `CardStarLabel`
- `CardSchoolTagLabel`

`UpgradeCardSystem` 会优先复用 `UpgradeCardSystem` 根节点和三张卡槽；`UpgradeCardView` 会优先复用卡槽内部的皮肤、边框、标题、图标、描述、星级和流派标签节点。卡牌隐藏时只关闭槽位，不销毁场景节点，避免后续正式 prefab 被运行时清掉。

## 底部 HUD 第一轮绑定

`BattleMain.scene` 的 `BottomHudLayer` 下保留：

- `BottomHudFrame`
- `HeroAvatarSlot1`
- `HeroAvatarSlot2`
- `HeroAvatarSlot3`
- `UltimateButtonPrefab`
- `AutoButtonPrefab`
- `BondButtonPrefab`

每个 `HeroAvatarSlot` 下保留：

- `AvatarSkin`
- `AvatarPortrait`
- `AvatarLabel`

`UltimateButtonPrefab` 下保留：

- `ButtonSkin`
- `UltimateLabel`

`AutoButtonPrefab` 下保留：

- `ButtonSkin`
- `AutoLabel`

`BondButtonPrefab` 下保留：

- `ButtonSkin`
- `BondLabel`

`HeroAvatarSlotView` 会优先复用场景头像槽，空槽会隐藏 `AvatarPortrait`，有英雄时复用同一个节点刷新头像资源。`UltimateButtonView` 会优先复用 `UltimateButtonPrefab`，自动和羁绊按钮会优先复用 `AutoButtonPrefab`、`BondButtonPrefab`。这些按钮继续使用原有按钮逻辑和高亮绘制，后续可直接把 `ButtonSkin` 与对应标签节点替换为正式美术节点。

## 顶部和中部按钮第一轮绑定

`BattleMain.scene` 的 `TopHudLayer` 下保留：

- `PauseButtonPrefab`
- `SpeedButtonPrefab`

这两个按钮下保留：

- `ButtonSkin`
- `ButtonIcon`
- 对应标签：`PauseLabel` 或 `SpeedLabel`

`BattleMain.scene` 的 `MidStatusLayer` 下保留：

- `TowerButtonPrefab`
- `OilButtonPrefab`

这两个按钮下保留：

- `ButtonSkin`
- 对应标签：`TowerLabel` 或 `OilLabel`

这些按钮都复用 `UiButtonView` 的 host node 绑定能力。暂停、倍速继续复用图标逻辑；箭塔、火油只绑定按钮底图和文字，后续如需图标可在对应 prefab 内增加 `ButtonIcon` 并在代码里打开图标参数。

## 信息节点第一轮绑定

`BattleMain.scene` 的 `TopHudLayer` 下保留：

- `TopHudFrame`
  - `UiArtSkin`
- `WaveLabel`
- `RemainingEnemiesLabel`
- `GoldChipPrefab`
- `StoneChipPrefab`

每个资源 chip 下保留：

- `ResourceChipSkin`
- `ResourceChipIcon`
- `ResourceChipLabel`

`BattleMain.scene` 的 `MidStatusLayer` 下保留：

- `StatusLabel`
- `BuildHintLabel`

波次、剩余敌人、金币、灵石、状态和流派提示都通过 `bindOrCreateLabel` 或 `ResourceChipView` 绑定场景节点。正式 UI 接入时可直接替换 `TopHudFrame/UiArtSkin`、资源 chip 底图、资源图标和文字样式，战斗逻辑只继续刷新字符串和数值。

## 反馈节点第一轮绑定

`BattleMain.scene` 的 `TopHudLayer` 下保留：

- `StartBattleButtonPrefab`
  - `ButtonSkin`
  - `ButtonIcon`
  - `StartBattleLabel`

`BattleMain.scene` 的 `MidStatusLayer` 下保留：

- `ComboView`
  - `ComboSkin`
  - `ComboLabel`

`BattleMain.scene` 的 `BattleFeedbackLayer` 下保留：

- `BattleFeedbackPool`
  - `NoticeLabel`
  - `FloatingTextSlot1`
  - `FloatingTextSlot2`
  - `FloatingTextSlot3`

每个 `FloatingTextSlot` 下保留：

- `FloatingTextLabel`

`ComboView` 和开始战斗按钮优先复用场景节点。战斗提示文字绑定 `NoticeLabel`；伤害、击杀和连杀浮字优先复用 3 个 `FloatingTextSlot`，槽位不够时才创建临时节点兜底，保证高频战斗反馈不会因为美术槽数量不足而丢失。

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
