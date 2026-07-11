# 写实地形与战斗特效验收记录

日期：2026-07-12

## 验收环境

- Cocos Creator：3.8.8
- Web 预览：`http://localhost:7456/`
- 设计分辨率：720x1280，Portrait
- AI 资源模型：`gpt-image-2`
- 外部素材：未使用；本轮地形与 `fx_v2_*` 特效纹理均为项目内生成并完成透明通道处理

## 自动验证

以下命令作为完整回归矩阵执行，全部要求退出码为 0：

```bash
npm run test:mvp
npm run test:spine-import
npm run test:thunder-mage-import
npm run test:terrain
npm run test:ui-layout
npm run test:hud-polish
npm run test:scene
npm run test:animation
npm run test:vfx
npm run typecheck
git diff --check
```

覆盖内容包括：地形尺寸与 Alpha、Cocos UUID 清单、五人站位、不可见逻辑防线、无脚下圆环、攻击事件元数据、全部英雄职业映射、对象池预算、特效资源和 Spine 攻速同步。

## 浏览器验收

- 首屏与空场：写实道路、左右废墟、后景气氛和重型前后城墙正常加载。
- 角色布局：固定雷法师与主角站在城墙顶面，脚部由前墙自然遮挡，人物脚下无常驻圆圈。
- 防线：没有可见红线或红色半透明区域；怪物在城墙前方逻辑停止点进入攻击。
- 战斗表现：主角金色弹道、火焰斩击、雷法师蓝白雷击和命中反馈可见，透明区域正确。
- 稳定性：连续战斗超过 30 秒，预览保持 60 FPS；浏览器控制台 warning/error 列表为空。
- 回归观察：未出现人物头顶橙黄色实心矩形，也未观察到非玩法触发的全屏闪烁。

## 截图

空场与城墙布局：

![写实地形空场](./2026-07-12-commercial-terrain-empty-full.png)

战斗弹道与特效：

![战斗特效压力场景](./2026-07-12-commercial-vfx-stress-full.png)

说明：截图保留 Cocos Web 预览工具栏和 FPS 读数，便于复核运行环境；最终发布构建不会显示该工具栏。
