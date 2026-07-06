# 04 Repo Conventions

## 命名规范

- TypeScript 类名使用 `PascalCase`，例如 `PlatformService`。
- 函数、变量、方法使用 `camelCase`，例如 `loadConfig`。
- 常量使用 `UPPER_SNAKE_CASE`，仅用于真正稳定的全局常量。
- 配置文件名使用小写加连字符或下划线，保持可读和可搜索。
- Cocos 节点命名应表达用途，例如 `HudRoot`、`SkillButtonGroup`、`GateHpBar`。

## 目录规范

- `assets/scenes/`：Cocos 场景文件。
- `assets/scripts/core/`：基础设施和生命周期。
- `assets/scripts/battle/`：局内战斗模块，当前阶段不放具体实现。
- `assets/scripts/roguelike/`：强化和局内成长模块。
- `assets/scripts/ui/`：UI 控制与表现逻辑。
- `assets/scripts/platform/`：平台适配层。
- `assets/scripts/data/`：配置和静态数据访问。
- `assets/scripts/utils/`：通用工具。
- `assets/resources/`：Cocos `resources` 目录，仅在确有同步加载需求时使用。
- `assets/bundles/`：资源分包目录。
- `assets/configs/`：Cocos 侧可加载配置资源。
- `docs/`：产品、技术、美术、平台和流程文档。
- `tools/`：后续放置导表、构建、检查等工具脚本。
- `configs/`：仓库级构建和环境示例配置。

## 配置数据规范

- 配置应优先数据驱动，减少硬编码。
- 配置字段命名保持稳定，避免同义字段混用。
- 数值配置应注明单位或语义，例如毫秒、百分比、像素、倍率。
- 后续导表工具输出文件应可重复生成，避免手工改生成物。
- 配置中不得出现真实 AppID、AppSecret、Token、密钥或个人账号信息。

## Git 提交规范

建议使用清晰的提交前缀：

- `chore:` 仓库、构建、工具、依赖等维护类变更。
- `docs:` 文档变更。
- `feat:` 新功能。
- `fix:` 缺陷修复。
- `refactor:` 重构。
- `test:` 测试相关。

提交信息应说明变更目的，避免只写“update”或“fix bug”。

## 不提交的内容

Cocos Creator 和平台构建会生成大量本地目录或产物，以下内容不要提交：

- `build/`
- `temp/`
- `library/`
- `local/`
- `profiles/`
- `node_modules/`
- 日志文件

不要提交真实 AppID、AppSecret、平台密钥、广告位密钥、服务端 Token 或任何个人隐私数据。示例配置只能使用占位值。
