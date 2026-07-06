# 英雄令

《英雄令》当前是一个 **Cocos Creator 3.8 + TypeScript** 小游戏原型项目。本阶段实现的是 **MVP Vertical Slice 0.1：可运行的最小战斗闭环**。

当前版本只使用程序生成的基础节点、标签、按钮和色块，不包含真实美术资源、不接入抖音/快手平台 API、不做完整 UI、不做存档或广告系统。

## 当前 MVP 已实现

- 点击“开始战斗”后进入战斗。
- 敌人每 2 秒从屏幕顶部生成一波，并直线向下移动。
- 玩家主角固定在屏幕下方中心，自动攻击最近敌人。
- 敌人到达底线后扣除城池血量。
- 城池血量为 0 时进入游戏失败状态。
- 每隔一段时间弹出三选一强化卡：
  - 攻击力 +20%
  - 攻击速度 +20%
  - 城池回血
- 可以点击“招募英雄”，再点击空格放置到简化棋盘。
- 棋盘包含前排 3 格、后排 2 格。
- 同名英雄在同格或相邻格触发自动合成，最高 Lv4。
- 已有原型级规则测试：`npm run test:mvp`。

## 主要代码文件

- `assets/scripts/battle/BattleController.ts`：Cocos 入口组件，动态创建原型 UI、战场节点，并协调各系统。
- `assets/scripts/battle/BattleMvpModel.ts`：无 Cocos 依赖的 MVP 规则模型，负责战斗状态、刷怪、城血、自动攻击、强化和合成。
- `assets/scripts/battle/EnemySystem.ts`：敌人原型节点创建与同步。
- `assets/scripts/battle/PlayerAutoAttackSystem.ts`：主角自动攻击表现，使用简单连线反馈。
- `assets/scripts/battle/WaveSystem.ts`：波次 UI 刷新。
- `assets/scripts/battle/CityHealthSystem.ts`：城池血量和状态 UI 刷新。
- `assets/scripts/battle/GridPlacementSystem.ts`：招募、放置、棋盘按钮和合成刷新。
- `assets/scripts/roguelike/UpgradeCardSystem.ts`：三选一强化卡 UI 和点击生效。
- `tools/mvp-model.test.ts`：MVP 纯逻辑测试。

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

说明：Cocos 组件文件当前使用 Cocos Creator 运行时 API；在编辑器内以 Creator 3.8 的类型声明为准。

## 用 Cocos Creator 运行

1. 使用 **Cocos Creator 3.8 LTS** 打开本仓库根目录。
2. 创建或打开一个空场景。
3. 新建一个空节点，例如 `BattleRoot`。
4. 将 `assets/scripts/battle/BattleController.ts` 挂载到 `BattleRoot`。
5. 点击预览运行。
6. 在画面中点击“开始战斗”，即可看到最小战斗闭环。

## 当前不包含

- 真实图片、音频、字体、美术资源
- 复杂动画
- 完整 UI
- 平台 SDK、`tt` 或 `ks` API
- 广告、存档、技能树
- 完整数值体系或正式关卡配置

## 后续建议

1. 在 Cocos 编辑器中保存一个正式 `BattleMvp.scene`，减少手动挂载步骤。
2. 把 `BattleMvpModel` 的硬编码数值迁移到配置数据。
3. 补充敌人类型、英雄类型和强化卡数据表。
4. 将原型 UI 替换为正式 UI 预制体。
5. 在平台适配层稳定后再接入抖音/快手能力。
