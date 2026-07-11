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
- 召唤流初始上阵 3 名普通英雄，可通过卡牌提升到 4 名。
- 英雄配置包含：弓手、火药师、冰法师、毒师、护卫、鼓手、治疗师、咒术师。
- 固定副将“雷法师”常驻后1，与主角独立攻击。
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
- `assets/scripts/battle/ThunderMagePresentation.ts`：固定雷法师的 Spine 播放、帧映射和蓝白雷击表现。
- `assets/scripts/data/CompanionConfig.ts`：雷法师身份、站位、伤害、攻击间隔与资源配置。
- `assets/scripts/battle/WaveSystem.ts`：波次 UI 刷新。
- `assets/scripts/battle/CityHealthSystem.ts`：城池血量和状态 UI 刷新。
- `assets/scripts/battle/GridPlacementSystem.ts`：招募、放置、棋盘按钮和合成刷新。
- `assets/scripts/roguelike/UpgradeCardSystem.ts`：三选一强化卡 UI 和点击生效。
- `assets/scripts/ui/BattleUiSceneBindings.ts`：场景节点绑定辅助，连接 `BattleMain.scene` 与运行时代码。
- `tools/mvp-model.test.ts`：MVP/v0.2 纯逻辑测试。
- `tools/scene-structure.test.ts`：检查 `BattleMain.scene` 的基础层级和 `BattleController` 挂载。

## 主角 Spine 攻击动画

- 主角攻击资源位于 `assets/resources/spine/animation/`，运行时由 `BattleController` 加载并以透明背景叠加在主角位置。
- 普通攻速下，攻击动画播放时长为 `0.7` 秒；金色飞弹和命中特效继续由 `PlayerAutoAttackSystem` 独立负责。
- 动画时长会随实际攻击间隔自动同步：`攻速倍率 = 基础攻击间隔 / 当前攻击间隔`，`动画时长 = clamp(0.7 / 攻速倍率, 0.22, 1.4)` 秒。攻速提高时，主角攻击动画相应加快。
- `AnimationConfig.ts` 中的 `PLAYER_ATTACK_ANIMATION_BASE_DURATION`、`PLAYER_ATTACK_ANIMATION_MIN_DURATION` 与 `PLAYER_ATTACK_ANIMATION_MAX_DURATION` 是统一调参入口。

## 固定副将：雷法师

- Spine 资源位于 `assets/resources/spine/hero_thunder_mage/`，使用透明背景并固定显示在“后1”圆形站位。
- “后1”为固定副将保留位，不参与普通英雄招募、上阵、合成或底部头像栏计数；当前阵型的普通英雄上阵上限为 `4`。
- 普通英雄达到 4 人上限后，后续“上阵英雄+1”会替换为“英雄伤害+20%”，不会出现无效卡牌。
- 基础攻击伤害为 `7`，基础攻击间隔为 `0.6` 秒；攻击目标是存活敌人中最靠近城墙的一个。
- 实际攻击间隔会受鼓手等攻速增益影响；动画时长与该实际间隔同步，并限制在 `0.25` 至 `1.2` 秒之间。
- 攻击使用蓝白雷击和透明命中爆发；主角原有 Spine 动画、金色飞弹与命中特效保持不变。

## 环境安装

本项目建议使用 **Cocos Creator 3.8.8 / 3.8 LTS**。`package.json` 中已标记当前工程对应的 Creator 版本为 `3.8.8`，优先使用同版本打开项目，避免场景和组件序列化差异。

1. 进入 [Cocos Creator 官方下载页](https://www.cocos.com/en/creator-download)，下载并安装 **Cocos Dashboard**。
2. 启动 Cocos Dashboard。Mac 版通常是将 `CocosDashboard.app` 拖到“应用程序”后双击启动；Windows 版按安装包向导安装后启动。
3. 使用 Cocos 开发者账号登录 Dashboard。
4. 在 Dashboard 的编辑器/版本管理入口中安装 **Cocos Creator 3.8.8**。如果只看到 3.8 LTS 的其他补丁版本，也建议先安装 3.8.x，再尽量切到 3.8.8。
5. 可选但推荐安装 **Node.js LTS**，用于执行本仓库的 `npm install`、类型检查和原型测试脚本。

官方参考：

- [Cocos Creator 3.8 安装和启动](https://docs.cocos.com/creator/3.8/manual/zh/getting-started/install/)
- [Cocos Creator 3.8 使用 Dashboard](https://docs.cocos.com/creator/3.8/manual/zh/getting-started/dashboard/)

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

运行 UI 布局和动画配置检查：

```bash
npm run test:ui-layout
npm run test:animation
```

运行 Spine 资源导入检查：

```bash
npm run test:spine-import
npm run test:thunder-mage-import
```

设置 Cocos 预览默认竖屏：

```bash
npm run preview:portrait
```

该命令会把本机 Cocos Creator 预览默认设置为 **Webpage Full Screen**、关闭旋转，并注册一个 `Sandgate Portrait 720x1280` 自定义设备。当前项目的程序 UI 以 **720x1280 / 9:16 竖屏** 为设计基准。

说明：Cocos 组件文件当前使用 Cocos Creator 运行时 API；在编辑器内以 Creator 3.8 的类型声明为准。新增构筑规则集中在纯 TypeScript 模型和配置文件中。

## 用 Cocos Creator 运行

1. 打开 **Cocos Dashboard**，从已安装的编辑器中启动 **Cocos Creator 3.8.8**。
2. 在 Dashboard 项目页选择“添加/打开已有项目”，指向本仓库根目录。
3. 首次打开后等待资源导入和脚本编译完成。
4. 在资源管理器中打开 `assets/scenes/BattleMain.scene`。
5. 确认层级中存在 `BattleRoot`，并挂载了 `BattleController`。
6. 如需默认按移动端竖屏预览，先在终端运行 `npm run preview:portrait`，再回到 Creator 重新点击预览。
7. 点击 Creator 顶部预览按钮运行项目；浏览器预览通常会打开 `http://127.0.0.1:7456/`。
8. 在画面中点击“开始战斗”，即可看到局内战斗闭环。

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
