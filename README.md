# 英雄令

《英雄令》当前是一个 **Cocos Creator 3.8 + TypeScript** 小游戏项目。本阶段已完成写实沙关地形、五人城墙阵型和第一轮可复用战斗特效系统。

当前版本已具备可运行战斗闭环、三流派构筑、基础商业 UI 骨架和第一轮场景承载层。不接入抖音/快手平台 API，不做存档、广告或支付系统。

## 当前已实现

- 点击右上角播放图标后进入战斗；战斗中可用同一位置的暂停/继续图标控制战斗，失败后可直接重开。
- 敌人按波次从屏幕顶部生成，并沿中央战场向城墙推进。
- 玩家主角和固定雷法师站在城墙上，自动攻击最近敌人。
- 敌人到达底线后扣除城池血量。
- 城池血量为 0 时进入游戏失败状态。
- 每隔一段时间弹出三选一强化卡，卡牌分为：
  - 火系：灼烧伤害、火焰扩散
  - 雷系：连锁次数、暴击率
  - 召唤系：上阵数量、英雄伤害
- 选择召唤系强化后，可以点击城墙上的空圆形站位放置普通英雄。
- 城墙阵型固定为一条横排：雷法师、3 名普通英雄和主角，共 5 名角色。
- 同名英雄在同格或相邻格触发自动合成，最高 Lv4。
- 普通英雄上阵上限固定为 3 名，不再通过强化卡扩容。
- 英雄配置包含：弓手、火药师、冰法师、毒师、护卫、鼓手、治疗师、咒术师。
- 固定副将“雷法师”常驻后1，与主角独立攻击。
- 地形使用七层写实沙关资源，包含道路、左右废墟、气氛和前后城墙层。
- 所有攻击事件统一路由到对象池化 `BattleVfxSystem`，提供职业弹道、命中、状态、死亡和城墙受击反馈。
- 站位圆圈和可见红色防线已移除；怪物仍会在城墙前方的逻辑防线停止。
- 敌人配置包含：普通、快速、厚血、远程、Boss。
- 波次节奏为 1-3 波教学、4 波精英、5 波 Boss，之后循环强化。
- `BattleMain.scene` 已作为正式局内入口场景，包含可编辑的 UI Layer 骨架。
- 已有原型级规则测试：`npm run test:mvp`。

## 主要代码文件

- `assets/scenes/BattleMain.scene`：正式局内入口场景，承载 `BattleRoot` 和 UI Layer 骨架。
- `assets/scripts/battle/BattleController.ts`：Cocos 入口组件，优先复用场景里的 UI Layer，缺失时自动创建兜底，并协调各系统。
- `assets/scripts/battle/BattleTerrainPresentation.ts`：模块化地形加载、渲染分层和旧背景降级入口。
- `assets/scripts/battle/BattleMvpModel.ts`：无 Cocos 依赖的 MVP 规则模型，负责战斗状态、刷怪、城血、自动攻击、强化和合成。
- `assets/scripts/data/BattleConfig.ts`：英雄、敌人、三流派强化卡配置。后续调数值优先改这里。
- `assets/scripts/data/BattleTerrainConfig.ts`：地形层、城墙深度和五人站位的统一配置。
- `assets/scripts/battle/EnemySystem.ts`：敌人原型节点创建与同步。
- `assets/scripts/battle/PlayerAutoAttackSystem.ts`：主角攻击事件路由器，把弹道与命中表现交给共享特效系统。
- `assets/scripts/battle/ThunderMagePresentation.ts`：固定雷法师的 Spine 播放、帧映射和攻击事件路由。
- `assets/scripts/battle/BattleVfxSystem.ts`：共享战斗特效运行时，负责资源缓存、对象池、粒子、Sprite 和 Graphics 降级。
- `assets/scripts/battle/BattleVfxLogic.ts`：无 Cocos 依赖的特效节流和预算逻辑。
- `assets/scripts/data/BattleVfxConfig.ts`：职业特效映射、纹理、并发预算与生命周期配置。
- `assets/scripts/data/CompanionConfig.ts`：雷法师身份、站位、伤害、攻击间隔与资源配置。
- `assets/scripts/ui/BattleHudConfig.ts`：新版战斗 HUD 的位置、尺寸、字号和血条内部轨道配置。
- `assets/scripts/ui/BattleHudLogic.ts`：波数循环显示、数值格式化和 HUD 状态转换。
- `assets/scripts/ui/BattleHudView.ts`：图片式 HUD 节点、动态首领/城门进度条和暂停按钮交互。
- `assets/scripts/battle/GridPlacementSystem.ts`：招募、放置、棋盘按钮和合成刷新。
- `assets/scripts/roguelike/UpgradeCardSystem.ts`：三选一强化卡 UI 和点击生效。
- `assets/scripts/ui/BattleUiSceneBindings.ts`：场景节点绑定辅助，连接 `BattleMain.scene` 与运行时代码。
- `tools/mvp-model.test.ts`：MVP/v0.2 纯逻辑测试。
- `tools/scene-structure.test.ts`：检查 `BattleMain.scene` 的基础层级和 `BattleController` 挂载。

## 主角 Spine 攻击动画

- 主角攻击资源位于 `assets/resources/spine/animation/`，运行时由 `BattleController` 加载并以透明背景叠加在主角位置。
- 普通攻速下，攻击动画播放时长为 `0.7` 秒；金色飞弹和命中特效由共享 `BattleVfxSystem` 负责。
- 动画时长会随实际攻击间隔自动同步：`攻速倍率 = 基础攻击间隔 / 当前攻击间隔`，`动画时长 = clamp(0.7 / 攻速倍率, 0.22, 1.4)` 秒。攻速提高时，主角攻击动画相应加快。
- `AnimationConfig.ts` 中的 `PLAYER_ATTACK_ANIMATION_BASE_DURATION`、`PLAYER_ATTACK_ANIMATION_MIN_DURATION` 与 `PLAYER_ATTACK_ANIMATION_MAX_DURATION` 是统一调参入口。

## 固定副将：雷法师

- Spine 资源位于 `assets/resources/spine/hero_thunder_mage/`，使用透明背景并固定显示在城墙最左侧站位。
- 雷法师为固定副将，不参与普通英雄招募、上阵、合成或底部头像栏计数；当前阵型的普通英雄上阵上限为 `3`。
- 召唤系强化固定提供“英雄伤害+20%”并进入放置流程，不再出现“上阵英雄+1”扩容卡。
- 基础攻击伤害为 `7`，基础攻击间隔为 `0.85` 秒；攻击目标是存活敌人中最靠近城墙的一个。
- 实际攻击间隔会受鼓手等攻速增益影响；动画时长与该实际间隔同步，并限制在 `0.25` 至 `1.2` 秒之间。
- 攻击使用蓝白雷击和透明命中爆发；主角原有 Spine 动画、金色飞弹与命中特效保持不变。

## 视频雷法师

- 原始 3.04 秒 MP4 已转换为 `assets/resources/video_character/thunder_mage_video_atlas.png` 透明序列帧图集；不使用 GIF，也不依赖 Cocos 的原生视频覆盖层。
- `VideoCharacterPresentation.ts` 已替代原 Spine 雷法师的显示层，沿用原城墙站位、攻击事件、弹道和命中特效；完整 73 帧动作会动态压缩到当前实际攻击间隔内，攻速变化时同步加速，每次攻击事件从首帧重新播放。
- 图集中的每一帧带有独立透明安全边距，避免双线性采样读取相邻帧而产生蓝色矩形边框。
- 如需替换视频，运行 `python3 tools/prepare-video-character-atlas.py <input.mp4> assets/resources/video_character/thunder_mage_video_atlas.png`，然后在 Cocos Creator 中刷新资源。

## 写实沙关地形

- 地形保持原有沙关、荒漠废墟主题，资源位于 `assets/bundles/battle_common/`。
- 画面由地表底图、道路、左右废墟、后景气氛、参考图城墙后片和城墙前片组成；近墙废墟分别向两侧外移 `57.6 px`，敌人、角色和弹道按固定深度插入这些层之间。
- 城墙使用参考图原始像素提取的完整前后层，保持宽度、比例、透视、门楼和旗帜细节；主角、固定雷法师和 3 名普通英雄以 `1.3` 倍视觉比例站在城墙顶面同一横排。
- 怪物在 `y=-235` 的不可见逻辑防线停止，英雄站位上移至 `y=-270`，城墙前片只自然遮住脚部，不遮挡角色主体。
- 城墙血条位于五格矩形英雄头像栏上方；头像栏固定五槽，不显示第六槽或职业/空位说明文字。
- 必需地形资源加载失败时会保留旧版 `battle_bg_sandgate_720x1280.png`，可选装饰层失败时只跳过对应层，不阻断战斗。
- `assets/bundles/battle_common.meta` 将地形目录配置为 `battle_common` Asset Bundle，运行时按 Bundle 根目录相对路径加载；UUID 清单仍由 `tools/generate-battle-terrain-manifest.mjs` 生成，用于资源一致性检查。

## 战斗特效系统

- `assets/bundles/ui/battle_fx_common/` 内共有 15 张透明纹理：11 张 `fx_v2_*` 弹道/通用粒子，以及 4 张 `fx_v3_hit_*` 火、雷、毒、金系命中主贴图；均由 `gpt-image-2` 生成并完成色键清理，本轮未使用外部素材包。
- 主角、雷法师和 8 类普通英雄使用统一事件语义，根据职业映射到金色飞弹、火焰斩击、雷电、寒冰、毒雾、治疗、护盾等表现。
- `assets/bundles/ui.meta` 将 UI 与战斗特效配置为 `ui` Asset Bundle；`BattleVfxSystem` 按清单相对路径预载 SpriteFrame，并组合 V2 起手闪光、主体弹道、连续拖尾、V3 主爆发、独立扩张冲击环、光晕回声和 `ParticleSystem2D` 碎屑。
- 火、雷、毒、金四系拥有不同发射方向、速度、重力和生命周期；V3 主爆发只出现在命中点，不会复用为人物起手闪光。
- 特效节点使用有界对象池和并发预算；任一 V3 命中贴图缺失时会回退到对应 V2 透明纹理，避免战斗逻辑或命中反馈被表现资源阻断。
- 放置提示只在放置状态短暂显示符文标记，不恢复人物脚下常驻圆圈。

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

运行新版战斗 HUD 检查：

```bash
npm run test:hud-assets
npm run test:hud-logic
npm run test:hud-view
npm run test:hud-polish
```

运行模块化地形检查：

```bash
npm run test:terrain
```

运行战斗特效映射、预算、资源和运行时结构检查：

```bash
npm run test:vfx
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

## 战斗 HUD 配置与资源

- 所有新版 HUD 的位置和尺寸集中在 `assets/scripts/ui/BattleHudConfig.ts`。`layout` 内的 `x`、`y` 以 720×1280 竖屏左上角为原点；`width`、`height` 同时决定图片可见尺寸和按钮点击区域。
- 首领血量与城门耐久使用“图片装饰框 + 代码动态填充”。需要微调填充区域时，修改 `BattleHudConfig.tracks.boss` 或 `BattleHudConfig.tracks.city`；其中 `x`、`y` 是组件中心点的局部偏移，`width`、`height` 是内部轨道尺寸。
- 下载目录中的 12 张源图经过去连通白底、透明边缘羽化、裁切和缩放后，存放在 `assets/bundles/ui/ui_hud_custom/`，运行时由 `ui` Asset Bundle 加载。
- 源图保持同名并位于 `/Users/hudaijin/Downloads/icon/` 时，可运行 `npm run prepare:hud-assets` 确定性重新导入；脚本会保留已有 Cocos UUID，并更新 `UiArtManifest.ts` 和资源预览图。
- 波数 UI 固定显示 `/ 50`，超过第 50 波后显示编号从 1 重新循环，但 `BattleMvpModel` 的实际战斗波次仍持续增长。
- 金币和绝技目前尚无对应战斗经济/能量系统，因此显示真实占位值 `0` 与 `0 / 100`；后续可在 `BattleController` 的 `hudGold`、`hudUltimate` 接入实际数据。

说明：Cocos 组件文件当前使用 Cocos Creator 运行时 API；在编辑器内以 Creator 3.8 的类型声明为准。新增构筑规则集中在纯 TypeScript 模型和配置文件中。

## 用 Cocos Creator 运行

1. 打开 **Cocos Dashboard**，从已安装的编辑器中启动 **Cocos Creator 3.8.8**。
2. 在 Dashboard 项目页选择“添加/打开已有项目”，指向本仓库根目录。
3. 首次打开后等待资源导入和脚本编译完成。
4. 在资源管理器中打开 `assets/scenes/BattleMain.scene`。
5. 确认层级中存在 `BattleRoot`，并挂载了 `BattleController`。
6. 如需默认按移动端竖屏预览，先在终端运行 `npm run preview:portrait`，再回到 Creator 重新点击预览。
7. 点击 Creator 顶部预览按钮运行项目；浏览器预览通常会打开 `http://127.0.0.1:7456/`。
8. 在画面中点击右上角播放图标，即可看到局内战斗闭环。

## 竖屏预览切换

- 默认 720x1280：运行 `npm run preview:portrait` 后重新打开或刷新 Cocos 预览。
- 编辑器内切换：在 Cocos Creator 顶部预览设备中选择 `Sandgate Portrait 720x1280`，或选择 `Webpage Full Screen` 并将预览窗口调整为 720x1280。
- 横竖屏切换：关闭或开启预览栏中的旋转开关；本项目移动端目标方向为 Portrait。
- 如果修改 TypeScript 后浏览器刷新仍显示旧逻辑，请在 Cocos Creator 里重新点击预览/刷新预览，让编辑器重新编译 `temp/programming` 下的脚本缓存。

## 当前不包含

- 完整商用美术源文件、音频、字体
- 全英雄独立 Spine 动画
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
