# Commercial UI Art v4 Design

## Scope

This spec defines the approved commercial UI art direction for `英雄令` after the A+C visual review:

- A: red-gold lightweight legendary commercial UI.
- C: heavy desert city battlefield mood.

The goal is to prepare final art generation, slicing, and Cocos Creator runtime integration. This spec does not add gameplay, platform SDKs, ads, payments, storage, or progression systems.

## Visual Direction

The final target should feel like a polished vertical mobile battle screen:

- Dark desert battlefield as the visual base.
- Red-gold UI frames for strong commercial mobile game recognition.
- Fire, thunder, and summon colors used as local high-saturation accents.
- Boss, city gate, upgrade cards, and ultimate button kept as the strongest visual anchors.
- Ordinary enemies and secondary information reduced in brightness so they do not compete with core decisions.

The reference structure is not copied directly. It is translated into the existing `英雄令` prototype: top boss pressure, mid battlefield, city wall defense line, three upgrade cards, hero portraits, and a bottom-right ultimate action.

## 720x1280 Layout Contract

The design baseline is fixed at `720x1280` portrait.

| Region | Pixel Range | Rule |
| --- | --- | --- |
| Top HUD | `y 16-103` | Wave, boss name, boss HP, resources, pause/speed/stat buttons. |
| Battle Area | `y 102-870` | Boss, enemies, hero line, damage text, fire wall, lightning, battlefield background. |
| City HP | `y 835-875` | Centered above the wall. Never covered by cards or side actions. |
| Tower / Oil | `y 820-910` | Left and right edge buttons near the city wall. They must not enter the card panel. |
| Upgrade Panel | `x 29-605`, `y 922-1120` | Three upgrade cards. Right edge is reserved for the action rail. |
| Right Action Rail | `x 626-698`, `y 922-1248` | Auto button and other vertical utility actions. Separate from the card panel. |
| Auto Button | `x 626-702`, `y 979-1055` | On the right rail only. Must not overlap the third upgrade card. |
| Hero Portrait Bar | `x 108-547`, `y 1144-1240` | Three main hero portraits. Leaves room for ultimate button. |
| Ultimate Button | `x 576-699`, `y 1134-1257` | Large bottom-right circular action. Must not cover hero portraits. |
| Bottom Status | `y 1248-1276` | Small status text such as auto battle state. |

The final in-game UI should remove the green guide lines from browser mockups. Those lines only document safe zones.

## Card Typography And Grid

Each upgrade card uses a fixed internal grid:

- Title: one line, large bold Chinese text.
- Art area: one square or near-square illustration window.
- Description: two lines maximum.
- Stars: one line.
- School tag: one line.

Recommended displayed card copy:

- Fire: `烈焰火墙+`, `范围+40%`, `伤害+60%`, tag `火系`.
- Thunder: `连锁闪电+`, `弹射+2`, `伤害+45%`, tag `雷系`.
- Summon: `召唤灵兽+`, `攻击+50%`, `存在+30%`, tag `召唤`.

Card text must use high-contrast fill plus dark outline. Long card names should be shortened before shrinking text.

## Art Assets To Generate Next

### Battlefield Background

Create one production background first:

- `battle_bg_sandgate_720x1280.png`
- Size: `720x1280`.
- Use: battle backdrop.
- Content: desert siege field, city gate wall at lower middle, enemy tide depth, ruins, sand, warm spotlight toward Boss area.
- Must leave readable UI space at top, bottom, and the upgrade panel zone.
- No embedded UI text.

### Upgrade Card Set

Create polished card assets in `ui_cards`:

- `card_bg_fire_final.png`
- `card_bg_thunder_final.png`
- `card_bg_summon_final.png`
- `card_frame_legendary_final.png`
- `card_selected_glow_final.png`
- `card_panel_bg_final.png`
- `card_panel_title_final.png`

All card and panel stretchable assets need clean nine-slice borders.

### Common Nine-Slice UI Set

Create or refine in `ui_common` and `ui_hud`:

- Red-gold panel.
- Dark translucent panel.
- Top HUD frame.
- Boss HP nameplate and bar.
- City HP frame and fill.
- Bottom hero bar.
- Right action rail button frame.
- Gold divider.

Nine-slice borders must tolerate slightly thicker final art without changing the approved layout.

### Button Set

Create polished button assets:

- Red-gold primary button.
- Blue-purple function button.
- Green summon/function button.
- Round pause button.
- Round speed button.
- Round auto button.
- Large circular ultimate button frame and glow.

The large ultimate button is the dominant action in the bottom-right corner.

## Cocos Runtime Integration Plan

The existing gameplay logic stays intact. Runtime work should be limited to visual asset replacement and layout constants:

- Add UI layout constants for the `720x1280` v4 safe zones.
- Replace programmatic battle background with `battle_bg_sandgate_720x1280.png`.
- Update `UpgradeCardView` to use the fixed text grid.
- Update bottom HUD layout so hero portraits and ultimate button do not overlap.
- Update side action buttons so tower/oil stay near the city wall and outside the card panel.
- Continue using existing platform-free Cocos Creator 3.8 TypeScript code.

## Acceptance Criteria

- The screen clearly resembles the approved A+C direction.
- Cards, auto, tower, oil, hero portraits, and ultimate do not overlap at `720x1280`.
- Upgrade card text is readable without ad hoc shrinking.
- The battlefield feels like a polished desert siege scene, not a plain programmatic mockup.
- The final art assets are sliced into existing asset directories and loaded by the current UI components.
- TypeScript typecheck and MVP model tests still pass.

## Out Of Scope

- No gameplay system changes.
- No platform API integration.
- No ads, payment, storage, or analytics.
- No new source directory structure.
- No final character animation pipeline.
- No replacement of all hero/enemy portraits in this pass unless generated assets are explicitly added later.
