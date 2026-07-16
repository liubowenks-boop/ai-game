# Battle HUD UI Redesign

**Date:** 2026-07-13
**Target:** Cocos Creator 3.8.8, 720 × 1280 portrait canvas

## Goal

Replace the current persistent battle HUD with the artwork supplied in
`/Users/hudaijin/Downloads/icon`, while preserving the existing five hero portrait slots and the
three-choice upgrade panel. The redesigned HUD must keep the battlefield readable, expose all
requested values as live text, and centralize placement settings so they can be tuned without
rewriting view code.

## Scope

The redesign replaces the current top frame, wave and resource chips, spirit-stone display, speed
button, boss bar, city bar, combo panel, status and build labels, and the existing pause, auto,
bond, and ultimate visuals.

The following remain unchanged:

- the five rectangular hero portrait slots and their portrait behavior;
- the three-choice upgrade panel and upgrade-card flow;
- in-world battle feedback such as damage numbers, kill text, spawn notices, and VFX;
- the underlying infinite five-wave gameplay cycle.

## Approved Layout

The approved direction is the compact top-dashboard layout with controls around the screen edge.
All coordinates use a 720 × 1280 design canvas and will live in a dedicated HUD configuration
object rather than being embedded in view constructors.

| Element | Placement and behavior |
| --- | --- |
| Wave | Flush to the upper-left safe edge. Text is `第 current / 50 波`. |
| Remaining enemies | Immediately below the wave panel. The count is centered below the baked `剩余敌人` title. |
| Gold | Flush to the upper-right safe edge. The numeric value is centered in the panel bar. |
| Boss title | Centered above the boss health bar; visible only while a boss is alive. |
| Boss health | Near the top-center and slightly right of the remaining-enemy panel; visible only while a boss is alive. |
| Pause / resume | Upper-right below the gold panel. The displayed image follows the battle state. |
| Auto | Right-side action rail. It remains a visual hook for the existing always-automatic combat behavior. |
| Statistics | Below Auto on the right-side action rail. It remains a visual hook. |
| City durability | Centered above the hero portrait rail. |
| Bond | Fixed to the lower-left edge. It remains a visual hook. |
| Hero portraits | Existing five-slot rail remains centered near the bottom. |
| Ultimate | Fixed to the lower-right edge. The value is shown in its built-in lower bar as `value / 100`. |

The initial implementation will use these content rectangles:

| Configuration key | Top-left rectangle `(x, y, width, height)` |
| --- | --- |
| `wave` | `(0, 4, 300, 70)` |
| `remainingEnemies` | `(0, 78, 190, 76)` |
| `gold` | `(440, 4, 268, 70)` |
| `bossTitle` | `(310, 76, 150, 60)` |
| `bossHealth` | `(196, 126, 380, 92)` |
| `pauseResume` | `(610, 84, 96, 96)` |
| `auto` | `(602, 292, 104, 104)` |
| `statistics` | `(602, 410, 104, 104)` |
| `cityDurability` | `(145, 1024, 430, 96)` |
| `bond` | `(10, 1142, 110, 110)` |
| `heroBar` | `(150, 1144, 420, 96)` |
| `ultimate` | `(590, 1130, 124, 124)` |

Decorative overlap is allowed only between the boss title and boss bar. Interactive hit targets
must remain within the portrait canvas and must not overlap one another or the upgrade panel.

## Asset Pipeline

All twelve supplied PNG files will be copied into a new project-owned HUD asset directory with
stable English filenames:

| Source | Project asset name |
| --- | --- |
| `怪物波数显示.png` | `hud_wave_panel.png` |
| `剩余敌人显示图标.png` | `hud_remaining_enemies.png` |
| `金币显示面板.png` | `hud_gold_panel.png` |
| `首领显示图标.png` | `hud_boss_title.png` |
| `首领血条显示.png` | `hud_boss_health_frame.png` |
| `城门耐久状态条.png` | `hud_city_durability_frame.png` |
| `暂停按钮图标.png` | `hud_pause_button.png` |
| `继续按钮标志.png` | `hud_resume_button.png` |
| `自动图标设计.png` | `hud_auto_button_custom.png` |
| `羁绊徽章.png` | `hud_bond_button_custom.png` |
| `统计图标设计.png` | `hud_statistics_button.png` |
| `绝技徽章设计.png` | `hud_ultimate_badge_custom.png` |

The source images have opaque white backgrounds and large unused margins. Preprocessing will:

1. remove only near-white pixels connected to the outside border, preserving enclosed white text,
   skull details, and highlights;
2. feather the resulting alpha boundary to avoid white halos;
3. crop to the visible alpha bounds with a small glow-safe margin;
4. resize oversized sources to practical UI texture dimensions without upscaling;
5. preserve the supplied artwork instead of regenerating it with GPT Image.

The processed assets will be registered in the existing UI asset bundle and `UiArtManifest`.
Original files in Downloads are treated as input only; runtime code must never depend on that
external path.

## Dynamic Bars

The supplied boss and city artwork contains baked full-value fills, and the city artwork also
contains a baked `98.1%`. The ornate medallions, labels, and metal frames will remain visible, but
the inner tracks will be fully covered by runtime-drawn tracks and fills.

- Boss fill: dark red track plus a clipped red gradient fill based on `hp / maxHp`.
- City fill: dark track plus green, yellow, or red fill based on durability thresholds.
- Boss text: centered percentage rounded to a whole number.
- City text: centered percentage rounded to a whole number.
- Zero and overflow inputs are clamped to the range 0–100%.
- The existing boss-hit emphasis may tint or pulse the new boss view without changing its layout.

This approach avoids regenerating artwork and guarantees that all values remain correct.

## HUD State and Text

The HUD receives a small display-state object derived from the battle model:

- `wave`: UI-only cycle `((model.wave - 1) mod 50) + 1`; before the first wave it is `0`;
- `totalWaves`: fixed display value `50`;
- `remainingEnemies`: count of alive enemies;
- `gold`: `0` until a currency system is implemented;
- `ultimate`: `0` until an ultimate-energy system is implemented;
- `cityDurability`: current city health divided by maximum health;
- `bossHealth`: current boss health divided by maximum health, or absent;
- `paused`: local presentation state owned by the controller.

The 50-wave display does not alter gameplay. After the UI reaches `第 50 / 50 波`, the next
gameplay wave is shown as `第 1 / 50 波` while the existing infinite battle continues.

Required strings are:

- wave: `第 {wave} / 50 波`;
- remaining enemies: numeric value only beneath the baked title;
- gold: formatted integer inside the horizontal panel;
- ultimate: `{value} / 100` inside the badge's lower bar.

## Interaction Behavior

The old text-based Start/Restart control is removed and its behavior is consolidated into the
pause/resume image button:

- before battle: resume image starts the battle;
- while running: pause image pauses model updates while keeping UI input responsive;
- while paused: resume image continues the battle;
- after game over: resume image starts a new battle.

The controller must pause its battle tick rather than pausing the entire Cocos director, so the
resume button and upgrade overlay remain interactive. Auto, Bond, Statistics, and Ultimate do not
gain new gameplay behavior in this task. They remain visual components and future integration
points.

## Code Structure

- `BattleHudConfig.ts`: all design rectangles, font sizes, inner progress-track geometry, visual
  thresholds, and the fixed display total of 50.
- `BattleHudView.ts`: creates and refreshes the new image-backed HUD elements through a single
  display-state interface.
- `BattleController.ts`: derives HUD state, handles start/pause/resume/restart, and delegates visual
  refreshes to `BattleHudView`.
- `BattleUiComponents.ts`: keeps shared loading and hero portrait functionality. HUD-only legacy
  view implementations will be removed; helpers used by retained screens will remain.
- `BattleUiLayout.ts`: remains the source for battlefield formation and the retained portrait rail;
  new HUD placement belongs to `BattleHudConfig.ts`.

Existing scene placeholder nodes will be reused as hosts where their semantic role matches the new
HUD. Their legacy skins and labels will be disabled or destroyed so no old HUD layers remain
visible.

## Failure Handling

- If a custom HUD texture fails to load, the element retains its hit target and live text, but does
  not restore the deleted legacy artwork.
- Missing boss data hides both the boss title and boss bar.
- Invalid health values are clamped and never produce negative widths or `NaN` labels.
- Upgrade-panel visibility and input priority remain unchanged.

## Verification

Automated checks will cover:

- all twelve processed project assets exist, have alpha, and no longer expose opaque corner pixels;
- required filenames are registered in the UI manifest;
- persistent HUD rectangles remain within 720 × 1280 and interactive controls do not overlap;
- only the approved boss-title/boss-bar decorative overlap is allowed;
- wave formatting cycles from `50 / 50` to `1 / 50` without changing model progression;
- remaining-enemy, gold, ultimate, city, and boss values refresh correctly;
- boss title and health views hide when no boss exists;
- progress fills clamp to 0–100%;
- start, pause, resume, and restart transitions keep UI input available;
- legacy persistent HUD components are no longer created or visible;
- retained hero portrait and three-choice upgrade behavior still passes existing tests.

Final verification will run the focused HUD tests, TypeScript checking, current UI and scene tests,
MVP model tests, and a Cocos portrait preview screenshot review.

## User Adjustment Entry Point

After implementation, component placement will be adjusted in
`assets/scripts/ui/BattleHudConfig.ts`. Each entry uses top-left portrait coordinates and explicit
width and height. Changing a component's `x` moves it horizontally, changing `y` moves it
vertically, and changing `width` or `height` changes its rendered size and hit target. Dynamic bar
inner-track offsets will be documented beside the associated component so frame placement and fill
placement can be tuned independently.
