# 文本、字体与 UI 实践指南

本文件记录《英雄令》当前阶段的文本资源、字体资源和 UI 组件使用约定。目标是让 720x1280 竖屏界面先具备可维护的程序承载层，后续可以替换正式 TTF、BMFont 和九宫格美术。

## 文本资源

Cocos Creator 会把 `.json`、`.txt`、`.csv` 等文本文件导入为 `TextAsset`。当前项目新增：

- `assets/resources/ui_text_zh.json`：中文战斗 UI 文案。
- `assets/scripts/ui/BattleTextResources.ts`：运行时加载 `ui_text_zh`，并提供 `t(key, params)` 格式化方法。

代码中仍保留默认文案作为兜底。如果资源加载失败，预览和小游戏运行不会因为文本资源缺失而中断。

## 字体资源

当前已下载一批 SIL OFL 字体资源，并通过 `BattleFontResources.ts` 按 UI 角色进行运行时加载。Label 会先用系统字体显示，字体资源加载成功后自动切换到对应 TTF，避免异步加载影响首帧预览稳定性。项目新增：

- `assets/resources/ui_font_profile.json`：字体资源规划和字号层级说明。
- `assets/resources/fonts/`：免费商用 TTF 字体资源。
- `assets/scripts/ui/BattleFontResources.ts`：运行时字体加载与 Label 角色绑定。
- `docs/08_free_game_font_resources.md`：字体来源、用途和 license 清单。

后续正式接入建议按以下优先级：

1. 继续在 Cocos 场景或 prefab 中验证各 Label 是否需要手动指定 Font 资产。
2. 伤害、暴击、连杀数字继续制作 `font_number_damage.fnt/png` 和 `font_number_combo.fnt/png`。
3. 金币、灵石、血量等小字号数字可继续用动态字体，若性能或清晰度不足再做 `font_number_resource.fnt/png`。

导入 BMFont 时，`.fnt` 和 `.png` 必须一起导入，且 png 需要作为 SpriteFrame 使用。

## Label 排版

所有运行时创建的主要 Label 统一经过 `applyBattleLabelStyle`：

- 默认使用系统字体兜底，随后由 `applyBattleFontRole` 按角色切换到已加载 TTF。
- 默认 `Label.Overflow.SHRINK`，避免按钮和卡片文字溢出。
- 强化卡使用 `UpgradeCardVisualMetrics` 统一竖卡尺寸、标题区、图标槽、说明区、星级区和流派标签区。当前三选一卡片采用 178x238 指标，并在 672px 面板内用 210px 中心间距排布，避免两侧过挤。
- 卡片描述使用 `enableWrapText`，允许两行说明在卡片约束框内自动换行。
- Combo 使用独立 `comboCallout` 字体角色，伤害数字使用 `damageNumber` 字体角色；后续可分别替换为 BMFont。
- 资源数字预留 `fontFamily.number`，后续可替换为 BMFont 或数字字体。

## UI 组件实践

当前布局基准为 `720x1280`，运行时使用固定宽度策略，确保移动端 9:16 下横向信息稳定。

- 顶部 HUD、城池血条、底部英雄栏使用固定安全区矩形，不侵入战斗中心。
- 强化选择面板居中显示，并使用暗色遮罩隔离背景。
- 九宫格面板、按钮、血条等资源已经在 `UiArtManifest.ts` 中记录 `nineSlice`，运行时通过 `Sprite.Type.SLICED` 使用。
- 后续把动态创建节点迁移到 Prefab 时，应保持同名节点和同样的尺寸约束，避免破坏现有绑定逻辑。

## 后续替换建议

- 正式 TTF/BMFont 接入后，优先替换 `BattleUiTokens.fontFamily` 和 `ui_font_profile.json`。
- 卡片标题、流派标签、按钮文字如果继续变长，应优先调资源文案、Label 约束框和字号层级，不直接改战斗逻辑。
- 多语言或热更文案可以继续扩展 `BattleTextResources.ts`，不要把显示文案重新散落到战斗系统。
