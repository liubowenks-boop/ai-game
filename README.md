# 英雄令

《英雄令》当前是一个 **Cocos Creator 3.8 + TypeScript** 小游戏原型项目。本阶段已进入 **局内表现与商业 UI v4 准备阶段**。

当前版本已具备可运行战斗闭环、三流派构筑、基础商业 UI 骨架和第一轮场景承载层。不接入抖音/快手平台 API，不做存档、广告或支付系统。

## 当前已实现

- 点击“开始战斗”后进入战斗。
- 敌人每 2 秒从屏幕顶部生成一波，并直线向下移动。
- 玩家主角固定在屏幕下方中心，自动攻击最近敌人。
- 敌人到达底线后扣除城池血量。
- 城池血量为 0 时进入游戏失败状态。
- 每隔一段时间弹出三选一强化卡，卡牌分为：
  - 火系：灼烧伤害、火焰扩散
  - 雷系：连锁次数、暴击率
  - 召唤系：上阵数量、英雄伤害
- 可以点击“招募英雄”，再点击空格放置到简化棋盘。
- 棋盘包含前排 3 格、后排 2 格。
- 同名英雄在同格或相邻格触发自动合成，最高 Lv4。
- 召唤流初始上阵 3 名英雄，可通过卡牌提升到 5 名。
- 英雄配置包含：弓手、火药师、冰法师、毒师、护卫、鼓手、治疗师、咒术师。
- 敌人配置包含：普通、快速、厚血、远程、Boss。
- 波次节奏为 1-3 波教学、4 波精英、5 波 Boss，之后循环强化。
- `BattleMain.scene` 已作为正式局内入口场景，包含可编辑的 UI Layer 骨架。
- 已有原型级规则测试：`npm run test:mvp`。

## 主要代码文件

- `assets/scenes/BattleMain.scene`：正式局内入口场景，承载 `BattleRoot` 和 UI Layer 骨架。
- `assets/scripts/battle/BattleController.ts`：Cocos 入口组件，优先复用场景里的 UI Layer，缺失时自动创建兜底，并协调各系统。
- `assets/scripts/battle/BattleMvpModel.ts`：无 Cocos 依赖的 MVP 规则模型，负责战斗状态、刷怪、城血、自动攻击、强化和合成。
- `assets/scripts/data/BattleConfig.ts`：英雄、敌人、三流派强化卡配置。后续调数值优先改这里。
- `assets/scripts/battle/EnemySystem.ts`：敌人原型节点创建与同步。
- `assets/scripts/battle/PlayerAutoAttackSystem.ts`：主角自动攻击表现，使用简单连线反馈。
- `assets/scripts/battle/WaveSystem.ts`：波次 UI 刷新。
- `assets/scripts/battle/CityHealthSystem.ts`：城池血量和状态 UI 刷新。
- `assets/scripts/battle/GridPlacementSystem.ts`：招募、放置、棋盘按钮和合成刷新。
- `assets/scripts/roguelike/UpgradeCardSystem.ts`：三选一强化卡 UI 和点击生效。
- `assets/scripts/ui/BattleUiSceneBindings.ts`：场景节点绑定辅助，连接 `BattleMain.scene` 与运行时代码。
- `tools/mvp-model.test.ts`：MVP/v0.2 纯逻辑测试。
- `tools/scene-structure.test.ts`：检查 `BattleMain.scene` 的基础层级和 `BattleController` 挂载。

## 本地验证

安装依赖：

```bash
npm install
```

运行 MVP 规则测试：

```bash
npm run test:mvp
```

运行 TypeScript 检查：

```bash
npm run typecheck
```

运行场景结构检查：

```bash
npm run test:scene
```

设置 Cocos 预览默认竖屏：

```bash
npm run preview:portrait
```

该命令会把本机 Cocos Creator 预览默认设置为 **Webpage Full Screen**、关闭旋转，并注册一个 `Sandgate Portrait 720x1280` 自定义设备。当前项目的程序 UI 以 **720x1280 / 9:16 竖屏** 为设计基准。

说明：Cocos 组件文件当前使用 Cocos Creator 运行时 API；在编辑器内以 Creator 3.8 的类型声明为准。新增构筑规则集中在纯 TypeScript 模型和配置文件中。

## 用 Cocos Creator 运行

1. 使用 **Cocos Creator 3.8 LTS** 打开本仓库根目录。
2. 在资源管理器中打开 `assets/scenes/BattleMain.scene`。
3. 确认层级中存在 `BattleRoot`，并挂载了 `BattleController`。
4. 点击预览运行。
5. 在画面中点击“开始战斗”，即可看到局内战斗闭环。

## 竖屏预览切换

- 默认 720x1280：运行 `npm run preview:portrait` 后重新打开或刷新 Cocos 预览。
- 编辑器内切换：在 Cocos Creator 顶部预览设备中选择 `Sandgate Portrait 720x1280`，或选择 `Webpage Full Screen` 并将预览窗口调整为 720x1280。
- 横竖屏切换：关闭或开启预览栏中的旋转开关；本项目移动端目标方向为 Portrait。
- 如果修改 TypeScript 后浏览器刷新仍显示旧逻辑，请在 Cocos Creator 里重新点击预览/刷新预览，让编辑器重新编译 `temp/programming` 下的脚本缓存。

## 当前不包含

- 最终商用美术源文件、音频、字体
- 复杂动画
- 完整正式 UI 预制体
- 平台 SDK、`tt` 或 `ks` API
- 广告、存档、技能树
- 装备系统、技能树、养成系统
- 正式关卡配置和商业化系统

## 后续建议

1. 继续调优 `BattleConfig.ts` 中的英雄、敌人和卡牌数值。
2. 增加更明确的局内反馈，例如 Boss 血条、燃烧区域提示、连锁次数提示。
3. 将原型 UI 替换为正式 UI 预制体。
4. 在平台适配层稳定后再接入抖音/快手能力。
