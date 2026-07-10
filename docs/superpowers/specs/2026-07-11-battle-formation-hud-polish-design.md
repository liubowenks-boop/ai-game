# Battle Formation And HUD Polish Design

## Goal

Polish the lower battle interface so the five deployable hero positions read as part of the same formation as the main hero, while remaining visually distinct from the main hero. Simplify the bottom hero portrait rail and make the city health bar easier to read against the battlefield.

The approved visual direction is the warm bronze `A - Battle Formation Command` style. The main hero keeps its cyan ring; deployable positions use bronze rings.

## Formation Layout

The formation uses two rows on the same three horizontal center lines:

| Position | Center X | Center Y | Size |
| --- | ---: | ---: | ---: |
| Front 1 | `-210` | `-300` | `82 x 82` |
| Front 2 | `0` | `-300` | `82 x 82` |
| Front 3 | `210` | `-300` | `82 x 82` |
| Back 1 | `-210` | `-410` | `82 x 82` |
| Main hero | `0` | `-410` | `82 x 82` visual safe zone |
| Back 2 | `210` | `-410` | `82 x 82` |

The front row and back row therefore align vertically in three columns. The main hero occupies the center position of the back row. The main hero, formation summary, and bottom portrait rail must not overlap.

The formation summary and pending-placement text share one horizontal line between the back row and portrait rail. The summary is left aligned and the pending state is right aligned. The portrait rail keeps its current `420 x 96` footprint centered at `y = -552`, preserving clearance from the ultimate button.

## Deployable Position Rings

- Replace each gray rounded rectangle with an `82 px` bronze circle.
- Use a dark translucent center, warm copper stroke, subtle dark outer stroke, and restrained inner glow.
- Keep the cyan and pale-gold main-hero ring unchanged so the player remains distinct from recruited heroes.
- Empty positions show only `前1`, `前2`, `前3`, `后1`, or `后2` centered in the circle.
- Occupied positions show the hero portrait centered in the circular presentation. Hero name and level text do not sit inside the circle.
- The current main-output hero uses a pale-gold outer ring. Highlighting must not resize or move the circle.
- Animation offsets may move the portrait artwork slightly, but the circle centers stay on the fixed grid.

## Six-Portrait Bottom Rail

The bottom rail contains six equal rectangular portrait slots inside one bronze metal frame.

- Slot centers are `-160`, `-96`, `-32`, `32`, `96`, and `160` on the X axis.
- Each portrait slot is `56 x 72`; neighboring slots have an `8 px` gap.
- Show only hero artwork. Do not show hero name, role, level, `空位`, `待招募`, or any other slot text.
- Show up to the first six board heroes returned by `model.getHeroes()` in its stable order.
- An unused slot remains as a low-opacity dark rectangle with the same border and dimensions, without text.
- The selected or main-output hero is indicated only by a pale-gold outline. The highlight must not change slot dimensions.
- Existing portrait art assets remain the source of the six images.

## City Health Bar

The city health bar uses a fixed `430 x 48` presentation centered between the tower and oil buttons.

- Add a compact circular city emblem at the left and a fixed-width numeric value area at the right.
- Keep the health fill in a dark inset track with a gold outer frame.
- Use three immediate colors: green above `55%`, gold from `28%` through `55%`, and red below `28%`.
- Damage feedback is a short white outer-stroke flash only.
- Do not add delayed-damage fill, trailing fill, segmented damage history, or any second health layer.
- Do not scale the bar when focused or damaged. Fixed dimensions prevent layout movement and visible flashing.
- The text remains `城池 current/max`, but the numeric value must remain readable independently of the fill width.

## Component Boundaries

- `BattleUiLayout` owns formation coordinates, circle dimensions, portrait slot centers, portrait dimensions, and the wider city health-bar rectangle.
- `GridPlacementSystem` owns deployable circle drawing, empty-position labels, occupied portrait visibility, and selected-hero outline.
- `HeroAvatarSlotView` owns one text-free rectangular portrait slot and its empty/highlight states.
- `BattleController` creates and refreshes six bottom portrait slots from the model's stable hero order.
- `CityHealthBarView` owns the fixed-frame city emblem, real-time fill, color thresholds, numeric value, and damage outline flash.
- `BattleMvpModel` gameplay, placement, merge rules, attack timing, Spine rendering, projectiles, and hit effects remain unchanged.

## Interaction And Edge Cases

- Empty formation positions remain clickable across the full circular area.
- A missing portrait asset leaves the bronze circle or dark portrait slot visible; it does not show placeholder text.
- More than six heroes do not expand or scroll the portrait rail; only the first six are shown.
- Fewer than six heroes leave fixed empty slots so the rail never reflows.
- Damage at zero health preserves the fixed city-health frame until the existing game-over state takes over.
- Focus, selection, animation, and damage states change color or opacity only; they do not change layout dimensions.

## Verification

- Layout tests assert identical X coordinates for front/back columns and identical Y coordinates within each row.
- Layout tests assert no overlap among the main-hero safe zone, formation summary line, portrait rail, city health bar, tower button, oil button, or ultimate button.
- UI source tests assert five circular deployable positions and six rectangular text-free portrait slots.
- City-health tests assert the three color thresholds, fixed dimensions, and absence of delayed-damage or scale behavior.
- TypeScript, MVP, scene-structure, UI-layout, animation, and Spine-import checks remain green.
- In-app browser verification covers the idle screen and an active battle at the 720 x 1280 portrait viewport, including a damage flash and at least one occupied deployable circle.

## Non-Goals

- No new hero artwork or portrait generation.
- No change to maximum board-hero gameplay capacity.
- No portrait names, roles, levels, cooldowns, or status badges in the bottom rail.
- No delayed-damage city-health layer.
- No changes to the main hero Spine attack animation or attack-speed synchronization.
