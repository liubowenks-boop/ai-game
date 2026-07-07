# 05 UI Art Asset Checklist

本清单用于《英雄令》后续高保真 UI 接入。当前项目仍不提交真实美术资源，本文件只定义交付规格、命名、尺寸、九宫格边距和图集归属。

## 设计基准

- 目标画布：竖屏 `720 x 1280`。
- 目标比例：移动端 `9:16`。
- 坐标策略：以 `720 x 1280` 为 UI 设计稿基准，运行时允许上下安全区适配。
- 安全区建议：顶部预留 `60 px`，底部预留 `48 px`；刘海屏和全面屏通过 UI 根节点或 Canvas 适配。
- 资源倍率：先按 `1x` 输出；若后续需要 `2x`，保持同名源文件在设计工程中管理，导入 Cocos 的运行资源仍使用本清单文件名。
- 九宫格单位：均为像素，格式为 `left/top/right/bottom`。
- 命名规范：小写英文 + 下划线，不使用中文、空格、特殊符号。

## 图集规划

| 图集 | 内容 | 说明 |
| --- | --- | --- |
| `ui_common` | 通用面板、按钮、描边、阴影、分割线 | 所有界面复用，优先做九宫格 |
| `ui_hud` | 战斗 HUD、血条、Combo、底部栏、绝技按钮 | 局内主界面高频资源 |
| `ui_cards` | 三选一强化卡、流派标签、稀有度边框 | 对应 `UpgradeCardView` |
| `ui_icons` | 金币、灵石、暂停、倍速、自动、羁绊、流派图标 | 小尺寸图标集中管理 |
| `ui_portraits` | 英雄头像、敌人头像、Boss 头像 | 后续可拆分为角色图集 |
| `battle_fx_common` | UI 级特效贴图、闪光、光环、警告光 | 不含复杂角色动画 |
| `fonts` | 位图数字、标题字体、伤害数字字体 | 字体资源不进图片图集 |

## 当前程序组件映射

| 程序组件 | 后续替换资源 |
| --- | --- |
| `BossHealthBarView` | Boss 名牌、Boss 血条底、Boss 血条填充、Boss 高亮框 |
| `CityHealthBarView` | 城池血条底、城池血条填充、城池受击闪白 |
| `ComboView` | Combo 底牌、连杀数字字、爆发光效 |
| `UltimateButtonView` | 绝技按钮底、能量环、可释放高亮、禁用态 |
| `HeroAvatarSlotView` | 英雄头像框、空槽、等级角标、主输出高亮框 |
| `UpgradeCardView` | 卡面底、图标槽、流派标签、稀有度边框、选中光 |
| `UiButtonView` | 通用按钮普通/按下/禁用/高亮 |
| `ResourceChipView` | 资源底板、金币/灵石图标 |

## `ui_common` 图集

| 文件名 | 源尺寸 | 显示建议 | 用途 | 九宫格边距 | 备注 |
| --- | ---: | ---: | --- | --- | --- |
| `ui_panel_dark_gold.png` | `512x256` | 任意拉伸 | 深棕黑金主面板 | `32/32/32/32` | Top/Mid/Bottom HUD 底板 |
| `ui_panel_dark_translucent.png` | `512x256` | 任意拉伸 | 半透明暗底 | `32/32/32/32` | 弹窗遮罩上层面板 |
| `ui_panel_card_inner.png` | `256x256` | 任意拉伸 | 卡牌内部深色底 | `28/28/28/28` | 强化卡正文底 |
| `ui_border_gold_thin.png` | `256x64` | 任意拉伸 | 金色细描边 | `24/16/24/16` | 通用边框 |
| `ui_border_gold_glow.png` | `256x64` | 任意拉伸 | 高亮发光边框 | `32/20/32/20` | 选中态/主输出 |
| `ui_divider_gold.png` | `320x16` | 横向拉伸 | 金色分割线 | `16/0/16/0` | HUD 信息分割 |
| `ui_shadow_soft.png` | `256x256` | 任意缩放 | 软阴影 | 不做九宫格 | 面板和按钮投影 |
| `ui_mask_dim.png` | `16x16` | 全屏拉伸 | 弹窗暗遮罩 | 不做九宫格 | 三选一暂停背景 |
| `ui_button_red_normal.png` | `256x96` | 任意拉伸 | 红金按钮普通态 | `32/24/32/24` | 开始/确认/绝技类 |
| `ui_button_red_pressed.png` | `256x96` | 任意拉伸 | 红金按钮按下态 | `32/24/32/24` | 点击反馈 |
| `ui_button_red_disabled.png` | `256x96` | 任意拉伸 | 红金按钮禁用态 | `32/24/32/24` | 冷却/未解锁 |
| `ui_button_blue_normal.png` | `256x96` | 任意拉伸 | 蓝紫按钮普通态 | `32/24/32/24` | 自动/雷系相关 |
| `ui_button_green_normal.png` | `256x96` | 任意拉伸 | 青绿按钮普通态 | `32/24/32/24` | 召唤/羁绊相关 |
| `ui_badge_round_dark.png` | `128x128` | `48-96` | 圆形徽章底 | 不做九宫格 | 图标按钮底 |
| `ui_badge_round_gold.png` | `128x128` | `48-96` | 金色徽章底 | 不做九宫格 | 资源/等级角标 |

## `ui_hud` 图集

| 文件名 | 源尺寸 | 显示建议 | 用途 | 九宫格边距 | 备注 |
| --- | ---: | ---: | --- | --- | --- |
| `hud_top_frame.png` | `680x96` | `680x88` | 顶部 HUD 总框 | `36/28/36/28` | `TopHudLayer` |
| `hud_mid_status_frame.png` | `520x88` | `520x76` | 中部状态栏底 | `32/24/32/24` | 城池/Combo/流派 |
| `hud_bottom_frame.png` | `680x116` | `680x104` | 底部 HUD 总框 | `36/28/36/28` | 头像栏/按钮区 |
| `hud_resource_chip.png` | `160x48` | `120x36` | 资源数值底 | `24/16/24/16` | 金币/灵石 |
| `hud_wave_plate.png` | `220x64` | `180x52` | 波次信息牌 | `24/18/24/18` | 波次/剩余敌人 |
| `hud_boss_nameplate.png` | `360x56` | `300x42` | Boss 名称牌 | `32/16/32/16` | Boss 未出现也占位 |
| `hud_boss_hp_bg.png` | `420x40` | `360x26` | Boss 血条底 | `28/12/28/12` | `BossHealthBarView` |
| `hud_boss_hp_fill.png` | `420x40` | 横向裁剪 | Boss 血条填充 | `20/10/20/10` | 红色高亮 |
| `hud_boss_hp_flash.png` | `460x56` | `380x42` | Boss 受击闪光 | `32/16/32/16` | 可用 Additive |
| `hud_city_hp_bg.png` | `360x44` | `320x34` | 城池血条底 | `28/12/28/12` | `CityHealthBarView` |
| `hud_city_hp_fill_green.png` | `360x44` | 横向裁剪 | 城池安全血量 | `20/10/20/10` | 高血量 |
| `hud_city_hp_fill_yellow.png` | `360x44` | 横向裁剪 | 城池警戒血量 | `20/10/20/10` | 中血量 |
| `hud_city_hp_fill_red.png` | `360x44` | 横向裁剪 | 城池危险血量 | `20/10/20/10` | 低血量 |
| `hud_city_hit_flash.png` | `392x60` | `340x48` | 城池受击闪白 | `32/16/32/16` | 短促叠加 |
| `hud_combo_plate.png` | `300x76` | `260x58` | Combo 底牌 | `36/20/36/20` | `ComboView` |
| `hud_combo_burst_glow.png` | `360x120` | `300x86` | 连杀爆发光 | 不做九宫格 | x5/x10 使用 |
| `hud_ultimate_button_bg.png` | `144x144` | `96-118` | 绝技按钮底 | 不做九宫格 | `UltimateButtonView` |
| `hud_ultimate_button_disabled.png` | `144x144` | `96-118` | 绝技禁用态 | 不做九宫格 | 冷却或未满能量 |
| `hud_ultimate_energy_ring.png` | `160x160` | `108-128` | 绝技能量环 | 不做九宫格 | 后续按进度裁剪 |
| `hud_ultimate_ready_glow.png` | `192x192` | `128-150` | 绝技可释放光 | 不做九宫格 | 高优先级闪光 |
| `hud_avatar_slot_empty.png` | `96x96` | `58-72` | 英雄头像空槽 | `16/16/16/16` | `HeroAvatarSlotView` |
| `hud_avatar_frame_normal.png` | `112x112` | `64-76` | 英雄头像普通框 | `18/18/18/18` | 上阵英雄 |
| `hud_avatar_frame_focus.png` | `128x128` | `72-84` | 主输出高亮框 | `20/20/20/20` | P1 焦点 |
| `hud_level_badge.png` | `56x32` | `42x24` | 英雄等级角标 | `12/8/12/8` | Lv1-Lv4 |
| `hud_auto_button.png` | `128x72` | `92x62` | 自动按钮底 | `24/18/24/18` | BottomHud |
| `hud_bond_button.png` | `128x72` | `92x62` | 羁绊按钮底 | `24/18/24/18` | BottomHud |

## `ui_cards` 图集

| 文件名 | 源尺寸 | 显示建议 | 用途 | 九宫格边距 | 备注 |
| --- | ---: | ---: | --- | --- | --- |
| `card_bg_fire.png` | `220x300` | `178x168` 或扩展 | 火系卡底 | `28/32/28/32` | `UpgradeCardView` |
| `card_bg_thunder.png` | `220x300` | `178x168` 或扩展 | 雷系卡底 | `28/32/28/32` | 蓝紫 |
| `card_bg_summon.png` | `220x300` | `178x168` 或扩展 | 召唤卡底 | `28/32/28/32` | 青绿 |
| `card_frame_normal.png` | `240x320` | 随卡拉伸 | 普通边框 | `32/36/32/36` | 稀有度 |
| `card_frame_rare.png` | `240x320` | 随卡拉伸 | 稀有边框 | `32/36/32/36` | 蓝色 |
| `card_frame_epic.png` | `240x320` | 随卡拉伸 | 史诗边框 | `32/36/32/36` | 紫色 |
| `card_frame_legendary.png` | `240x320` | 随卡拉伸 | 传奇边框 | `32/36/32/36` | 金色 |
| `card_selected_glow.png` | `280x360` | 随卡缩放 | 选中高亮 | 不做九宫格 | 外发光 |
| `card_icon_slot.png` | `80x80` | `46-64` | 卡牌图标槽 | `12/12/12/12` | 占位图标容器 |
| `card_tag_fire.png` | `132x34` | `100-132` | 火系标签底 | `18/10/18/10` | 流派标签 |
| `card_tag_thunder.png` | `132x34` | `100-132` | 雷系标签底 | `18/10/18/10` | 流派标签 |
| `card_tag_summon.png` | `132x34` | `100-132` | 召唤标签底 | `18/10/18/10` | 流派标签 |
| `card_panel_title.png` | `420x72` | `360x50` | 强化弹窗标题条 | `28/18/28/18` | UpgradePanelLayer |
| `card_panel_bg.png` | `680x360` | `660x292` | 三选一弹窗底 | `40/36/40/36` | 深棕黑金 |

## `ui_icons` 图集

| 文件名 | 源尺寸 | 显示建议 | 用途 | 九宫格边距 | 备注 |
| --- | ---: | ---: | --- | --- | --- |
| `icon_gold.png` | `128x128` | `28-36` | 金币图标 | 不做九宫格 | TopHud |
| `icon_spirit_stone.png` | `128x128` | `28-36` | 灵石图标 | 不做九宫格 | TopHud |
| `icon_pause.png` | `96x96` | `32-42` | 暂停图标 | 不做九宫格 | TopHud |
| `icon_speed.png` | `96x96` | `32-42` | 倍速图标 | 不做九宫格 | TopHud |
| `icon_auto.png` | `96x96` | `32-42` | 自动图标 | 不做九宫格 | BottomHud |
| `icon_bond.png` | `96x96` | `32-42` | 羁绊图标 | 不做九宫格 | BottomHud |
| `icon_ultimate.png` | `128x128` | `48-64` | 绝技图标 | 不做九宫格 | 绝技按钮中心 |
| `icon_school_fire.png` | `128x128` | `36-54` | 火系图标 | 不做九宫格 | 卡牌/流派提示 |
| `icon_school_thunder.png` | `128x128` | `36-54` | 雷系图标 | 不做九宫格 | 卡牌/流派提示 |
| `icon_school_summon.png` | `128x128` | `36-54` | 召唤图标 | 不做九宫格 | 卡牌/流派提示 |
| `icon_warning.png` | `96x96` | `32-48` | 危险提示 | 不做九宫格 | 城池低血 |
| `icon_boss.png` | `128x128` | `42-64` | Boss 标识 | 不做九宫格 | Boss 名牌 |
| `icon_lock.png` | `96x96` | `28-36` | 未开放/锁定 | 不做九宫格 | 后续功能占位 |

## `ui_portraits` 图集

| 文件名 | 源尺寸 | 显示建议 | 用途 | 九宫格边距 | 备注 |
| --- | ---: | ---: | --- | --- | --- |
| `portrait_hero_archer.png` | `256x256` | `58-96` | 弓手头像 | 不做九宫格 | 头像栏 |
| `portrait_hero_gunner.png` | `256x256` | `58-96` | 火药师头像 | 不做九宫格 | 头像栏 |
| `portrait_hero_ice_mage.png` | `256x256` | `58-96` | 冰法师头像 | 不做九宫格 | 头像栏 |
| `portrait_hero_poisoner.png` | `256x256` | `58-96` | 毒师头像 | 不做九宫格 | 头像栏 |
| `portrait_hero_guard.png` | `256x256` | `58-96` | 护卫头像 | 不做九宫格 | 头像栏 |
| `portrait_hero_drummer.png` | `256x256` | `58-96` | 鼓手头像 | 不做九宫格 | 头像栏 |
| `portrait_hero_healer.png` | `256x256` | `58-96` | 治疗师头像 | 不做九宫格 | 头像栏 |
| `portrait_hero_warlock.png` | `256x256` | `58-96` | 咒术师头像 | 不做九宫格 | 头像栏 |
| `portrait_enemy_normal.png` | `192x192` | `42-72` | 普通怪头像/图标 | 不做九宫格 | 波次/图鉴备用 |
| `portrait_enemy_fast.png` | `192x192` | `42-72` | 快速怪头像/图标 | 不做九宫格 | 波次/图鉴备用 |
| `portrait_enemy_tank.png` | `192x192` | `42-72` | 厚血怪头像/图标 | 不做九宫格 | 精英提示 |
| `portrait_enemy_ranged.png` | `192x192` | `42-72` | 远程怪头像/图标 | 不做九宫格 | 精英提示 |
| `portrait_enemy_boss_sandlord.png` | `320x320` | `64-108` | 沙城 Boss 头像 | 不做九宫格 | Boss 名牌 |

## `battle_fx_common` 图集

| 文件名 | 源尺寸 | 显示建议 | 用途 | 九宫格边距 | 备注 |
| --- | ---: | ---: | --- | --- | --- |
| `fx_glow_gold_soft.png` | `256x256` | 任意缩放 | 金色柔光 | 不做九宫格 | 选中/主输出 |
| `fx_glow_red_burst.png` | `256x256` | 任意缩放 | 红色爆发光 | 不做九宫格 | Boss/危险 |
| `fx_glow_blue_thunder.png` | `256x256` | 任意缩放 | 雷系发光 | 不做九宫格 | 雷系技能 |
| `fx_glow_green_summon.png` | `256x256` | 任意缩放 | 召唤发光 | 不做九宫格 | 召唤强化 |
| `fx_hit_flash_white.png` | `128x128` | `48-128` | 受击闪白 | 不做九宫格 | Boss/城池 |
| `fx_warning_banner_glow.png` | `512x128` | `420x80` | Boss 来袭提示光 | 不做九宫格 | 出场提示 |
| `fx_fire_small.png` | `128x128` | `32-72` | 火焰状态小特效 | 不做九宫格 | 灼烧 |
| `fx_thunder_line.png` | `256x64` | 拉伸/旋转 | 雷链线段 | 不做九宫格 | 连锁攻击 |
| `fx_poison_dot.png` | `128x128` | `28-60` | 中毒状态 | 不做九宫格 | 毒师 |
| `fx_heal_plus.png` | `128x128` | `28-64` | 治疗加号 | 不做九宫格 | 治疗师/城池回血 |
| `fx_slow_snowflake.png` | `128x128` | `28-64` | 减速标识 | 不做九宫格 | 冰法师 |
| `fx_vulnerable_break.png` | `128x128` | `28-64` | 破防标识 | 不做九宫格 | 咒术师 |

## `fonts` 字体资源

| 文件名 | 建议规格 | 用途 | 备注 |
| --- | --- | --- | --- |
| `font_ui_title.ttf` | 支持中文，粗体风格 | 标题、Boss 提示 | 可先用免费商用字体替代 |
| `font_ui_body.ttf` | 支持中文，清晰易读 | 常规 UI 文案 | 面向中老年，字形要开阔 |
| `font_number_damage.fnt/png` | Bitmap Font | 伤害数字、暴击数字 | 红/金/蓝可用材质或多套图 |
| `font_number_combo.fnt/png` | Bitmap Font | Combo、连杀 | 需要更粗、更亮 |
| `font_number_resource.fnt/png` | Bitmap Font | 金币、灵石、血量 | 小字号清晰 |

## 720x1280 布局占位建议

| UI 区域 | 设计位置 | 推荐高度 | 资源替换重点 |
| --- | --- | ---: | --- |
| `TopHudLayer` | 顶部 `y 0-120` | `96-120` | `hud_top_frame`、Boss 血条、资源 chip、暂停/倍速 |
| `BattleLayer` | 中部 `y 120-900` | `760-800` | 战场背景、角色、敌人、技能表现 |
| `MidStatusLayer` | 战斗下缘 `y 760-900` | `80-110` | 城池血条、Combo、流派提示 |
| `UpgradePanelLayer` | 居中弹窗 | `360-460` | `card_panel_bg`、卡牌资源 |
| `BottomHudLayer` | 底部 `y 1120-1280` | `120-150` | 英雄头像栏、绝技、自动、羁绊 |

## 移动端 9:16 适配规则

- TopHud 和 BottomHud 锚定屏幕上下边，按安全区偏移。
- BattleLayer 保持居中，重要单位不要放入顶部 `120 px` 和底部 `150 px` 操作区。
- 三选一弹窗中心对齐画布，背景遮罩覆盖全屏。
- 所有可点击按钮建议最小点击热区 `80 x 56`。
- 常用按钮字号不低于 `22 px`；说明文字不低于 `18 px`。
- Boss/Combo/城池危险提示优先使用高亮和描边，不依赖小图标表达。

## 交付检查

- 每张 PNG 使用透明背景。
- 九宫格资源边缘必须保留足够纯色或纹理延展区。
- 同一图集内资源避免超过平台纹理限制；小游戏优先控制单图集在 `2048 x 2048` 内。
- UI 图集和战斗特效图集分开，避免频繁加载战斗特效时影响常驻 HUD。
- 文件名必须与本清单一致，新增资源先补本文档。
- 不提交 PSD、AI、源工程到运行资源目录；源文件放外部美术工程或素材仓库。
