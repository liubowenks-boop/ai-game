# 免费游戏字体资源清单

本轮已为《英雄令》下载 8 套免费可商用字体，全部放在 `assets/resources/fonts/`。Cocos Creator 会在编辑器刷新后把 `.ttf` 识别为字体资源；对应 license 放在 `assets/resources/fonts/licenses/`。

## 已下载字体

| 字体文件 | 字体 | 来源 | License | 推荐用途 |
| --- | --- | --- | --- | --- |
| `SmileySans-Oblique.ttf` | 得意黑 / Smiley Sans | https://github.com/atelier-anchor/smiley-sans | SIL OFL 1.1 | Logo、副标题、Boss 名牌、强商业感斜体艺术字 |
| `ZCOOLKuaiLe-Regular.ttf` | 站酷快乐体 | https://fonts.google.com/specimen/ZCOOL+KuaiLe | SIL OFL 1.1 | 开始战斗、强化标题、强化卡标题、按钮主字 |
| `ZCOOLQingKeHuangYou-Regular.ttf` | 站酷庆科黄油体 | https://fonts.google.com/specimen/ZCOOL+QingKe+HuangYou | SIL OFL 1.1 | HUD 标签、资源数字、硬朗标题 |
| `ZCOOLXiaoWei-Regular.ttf` | 站酷小薇体 | https://fonts.google.com/specimen/ZCOOL+XiaoWei | SIL OFL 1.1 | 古风说明字、剧情章名、备用卡牌标题 |
| `MaShanZheng-Regular.ttf` | 马善政毛笔楷书 | https://fonts.google.com/specimen/Ma+Shan+Zheng | SIL OFL 1.1 | Boss 来袭、掉落提示、强反馈喊字 |
| `LongCang-Regular.ttf` | 龙藏体 | https://fonts.google.com/specimen/Long+Cang | SIL OFL 1.1 | 古风章节标题、沙城氛围字 |
| `LiuJianMaoCao-Regular.ttf` | 刘建毛草 | https://fonts.google.com/specimen/Liu+Jian+Mao+Cao | SIL OFL 1.1 | 暴击、绝技、连杀等夸张艺术字 |
| `ZhiMangXing-Regular.ttf` | 志莽行书 | https://fonts.google.com/specimen/Zhi+Mang+Xing | SIL OFL 1.1 | 技能名、火系/雷系强化表现、活动标题 |

## 当前推荐组合

- 主界面大标题：`ZCOOLKuaiLe-Regular.ttf`
- 主要按钮：`ZCOOLKuaiLe-Regular.ttf`
- HUD 小标题和资源：`ZCOOLQingKeHuangYou-Regular.ttf`
- 强化卡标题：`ZCOOLKuaiLe-Regular.ttf`
- Boss 出场提示：`MaShanZheng-Regular.ttf`
- 连杀、暴击、绝技喊字：`LiuJianMaoCao-Regular.ttf`
- 技能名和流派提示：`ZhiMangXing-Regular.ttf`

## 接入提醒

- 当前已通过 `BattleFontResources.ts` 接入运行时加载；Label 会先使用系统字体兜底，字体加载成功后自动切换。
- 在 Cocos Creator 中刷新资源后，可把 `.ttf` 拖到 Label 的 Font 属性上验证效果。
- 生产阶段的伤害数字建议继续制作 BMFont，避免动态字体在高频伤害数字场景中造成性能和清晰度问题。
- 所有字体均保留原 license 文本，后续发布前仍建议由项目负责人做一次最终授权复核。

## 热门游戏字体参考结论

本轮搜索了《永远的蔚蓝星球》《向僵尸开炮》的公开商店页、官方/社区页和截图资料，没有找到官方披露的具体字体名或可直接复用的授权字体包。两者公开画面更接近手游常见的粗圆、强描边、强按钮感展示字，而不是细宋/长正文黑体。

因此当前默认改用 `ZCOOLKuaiLe-Regular.ttf` 承担主标题、按钮和强化卡标题：它是已入库的 SIL OFL 字体，风格更接近热门塔防/割草手游的轻松强化卡标题，同时避免复制商业游戏可能自研或授权的专有字体资产。
