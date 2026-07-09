# 09 Animation System

本文件记录《英雄令》人物和怪物动画系统的第一版落地方案。参考 Cocos Creator 动画系统与 Spine 资源导入文档：

- https://docs.cocos.com/creator/4.0/manual/zh/animation/
- https://docs.cocos.com/creator/4.0/manual/zh/asset/spine.html

## 当前目标

当前阶段不导入正式 Spine 美术资源，先建立统一动画状态、配置表、优先级规则和运行时驱动。现阶段使用程序动画表现缩放、位移、弹跳、受击和死亡。后续 Spine 资源到位后，只替换渲染层，不改战斗规则模型。

## 10 步落地

1. 动画状态表

   英雄状态：`idle`、`attack`、`cast`、`hit`、`death`、`victory`。

   敌人状态：`idle`、`spawn`、`walk`、`attack_city`、`hit`、`death`。

   Boss 额外状态：`boss_intro`、`boss_attack`。

2. 资源规格

   Spine 资源命名建议：

   - `hero_archer.skel/json`
   - `hero_archer.atlas`
   - `hero_archer.png`
   - `enemy_normal.skel/json`
   - `enemy_boss_sandlord.skel/json`

   Cocos Spine 导入需要 `.json/.skel`、`.png`、`.txt/.atlas` 三类文件。当前配置中记录为 `SPINE_ASSET_REQUIREMENTS`。

3. 技术分层

   - `BattleMvpModel` 只负责战斗结果，不依赖动画。
   - `AnimationConfig` 负责动画状态、profile、clip 名和优先级。
   - `UnitAnimationSystem` 负责状态切换、打断规则、tick 和程序动画 pose。
   - `EnemySystem`、`BattleController`、`GridPlacementSystem` 只消费动画 pose 做表现。

4. 样板优先

   第一版已覆盖：

   - 主角：`idle` / `attack`
   - 棋盘英雄：`idle` / `cast`
   - 普通怪：`spawn` / `walk` / `hit` / `attack_city` / `death`
   - Boss：`boss_intro` / `boss_attack` / `hit` / `death`

5. 动作优先级

   当前优先级从低到高：

   `idle < walk < spawn/victory < attack_city < attack/cast < boss_attack < boss_intro < hit < death`

   `death` 不可被打断；`hit` 可以打断移动和攻击；低优先级动作不能打断未完成的高优先级动作。

6. 动画事件原则

   当前不使用动画事件结算伤害。伤害仍由 `BattleMvpModel` 计算，动画只根据结果做同步表现。后续可以用动画事件触发特效、震屏、音效、掉落光柱等表现，不把真实伤害绑定到帧事件。

7. 性能策略

   当前使用程序动画，不创建额外骨骼实例。后续 Spine 接入时：

   - Boss、主角、重点英雄优先用 Spine。
   - 普通怪共用同一套 Spine 或降级为程序动画/序列帧。
   - 同屏怪物多时降低普通怪受击动画频率。
   - 死亡动画播放完后立即回收节点。

8. 开发顺序

   已完成：

   - `assets/scripts/data/AnimationConfig.ts`
   - `assets/scripts/battle/UnitAnimationSystem.ts`
   - `tools/animation-system.test.ts`
   - 敌人、主角、棋盘英雄接入共享动画驱动

   后续：

   - 接入第一个真实 Spine 样板：主角或 Boss。
   - 建立 Spine prefab 命名规范。
   - 将 `renderer: "procedural"` 切换为 `renderer: "spine"` 并保持同样状态名。

9. 测试方式

   ```bash
   npm run test:animation
   npm run typecheck
   ```

10. 验收标准

   - 主角攻击时有明显动作反馈。
   - 敌人移动、受击、墙前攻击、死亡不再完全静态。
   - Boss 出场和攻击拥有更高视觉权重。
   - 棋盘主输出英雄有轻微施法/高亮感。
   - 后续 Spine 资源能按同一状态表替换程序动画。
