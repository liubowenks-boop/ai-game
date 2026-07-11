# Fixed Thunder Mage Companion Design

## Goal

Import the Spine 3.8 attack animation from `/Users/hudaijin/Downloads/attack 2` and add a permanent companion hero named `雷法师` to the `后1` formation position. The Thunder Mage attacks alongside the main hero with independent combat timing and presentation while leaving the recruitment and merge systems unchanged.

## Approved Direction

The Thunder Mage is a fixed companion rather than a recruited board hero or a cosmetic copy of the main hero.

- It always occupies formation slot index `3` (`后1`) at `(-210, -410)`.
- It does not count toward `maxBoardHeroes`.
- The approved five-circle layout therefore caps ordinary board heroes at `4` while the fixed companion occupies `后1`.
- It cannot be recruited, merged, replaced, or moved.
- Ordinary heroes cannot be placed into the reserved `后1` slot.
- The existing bottom portrait rail remains dedicated to recruited board heroes.
- Once ordinary heroes reach the `4`-hero cap, future `summon_slots_plus_1` offers are replaced by `summon_hero_damage_20`.

## Character Configuration

The companion configuration is separate from `HERO_CONFIGS` so recruit rotation remains unchanged and the approved four-hero ordinary board cap stays explicit.

| Field | Value |
| --- | --- |
| Name | `雷法师` |
| Identifier | `hero_thunder_mage` |
| Role | Fixed single-target lightning companion |
| Description | `雷电速攻支援` |
| Formation slot | `3` / `后1` |
| Position | `(-210, -410)` |
| Damage per attack | `7` |
| Base attack interval | `0.6s` |
| Base DPS | approximately `11.7` |
| Display height | approximately `86px` |

The main hero remains the primary damage dealer at the default tuning of `11` damage every `0.7s`, approximately `15.7 DPS`.

## Combat Behavior

The model owns a separate Thunder Mage attack timer.

- The timer resets when a battle starts or restarts.
- The companion does not attack while the battle is stopped, game over, or no living target exists.
- Each completed attack selects the living enemy nearest the city wall at that moment.
- A successful attack deals `7` base damage before the existing armor and vulnerability calculation.
- The attack produces a distinct attack event source so presentation code can distinguish it from the main hero, recruited hero DPS, and thunder-chain effects.
- The companion can target the same enemy as the main hero.
- Team attack-speed aura bonuses affect the companion. Its current interval is the base interval divided by the current hero aura multiplier, clamped to the supported presentation range.
- Fire on-hit, chain lightning, recruit upgrades, merging, and hero levels do not apply to the fixed companion.

## Formation Ownership

`GridSlotState` exposes that slot `3` is reserved by the fixed companion.

- `placeHero(3, ...)` returns `undefined`.
- Pending placement cannot consume or overwrite the slot.
- The slot keeps the approved bronze circular backing but does not display the `后1` empty label while the companion is present.
- The fixed companion presentation is owned by `BattleController`, not `GridPlacementSystem`, so its Spine lifecycle and attack animation remain independent from recruited portrait animation.

## Spine Resource Import

The source package contains Spine `3.8.75` JSON data, one RGBA atlas texture, one slot named `frame`, and eight frame attachments.

Copy and normalize it under:

```text
assets/resources/spine/hero_thunder_mage/
  hero_thunder_mage.json
  hero_thunder_mage.atlas
  hero_thunder_mage.png
```

Normalization requirements:

- Rename the source animation key to `attack`.
- Keep the attachment names `frame_0` through `frame_7`.
- Keep `skeleton.images` set to `./`.
- Change the atlas page reference to `hero_thunder_mage.png`.
- Preserve the transparent RGBA background.
- Generate Cocos Creator `.meta` files for the directory and all three assets.

The source attachment timeline uses frames at `0`, `0.125`, `0.25`, `0.375`, `0.5`, `0.625`, `0.75`, and `0.875`, returning to `frame_0` at `1.0s`. The normalized source duration is therefore `1.0s`.

## Animation Timing

The companion has its own animation profile and timing resolver.

- Idle presentation holds `frame_0`.
- A combat attack restarts the `attack` clip from frame zero.
- Actual animation duration follows the actual combat interval.
- Animation duration is clamped to `0.25s` through `1.2s`.
- Spine playback speed is `1.0 / animationDuration` because the normalized source is one second long.
- Presentation uses explicit frame attachment mapping so long simulation frames cannot skip to an invalid attachment.
- The main hero's existing Spine animation, attack-speed resolver, golden projectile, and hit effect are not changed.

## Visual Presentation

The approved `B - balanced` size is approximately `86px` tall at the `后1` position.

- The character faces upward toward incoming enemies.
- The transparent Spine artwork is centered over the bronze slot ring.
- Idle state shows the first frame instead of a portrait placeholder.
- Attacks use a blue-white lightning projectile and a small transparent hit flash.
- No permanent name label is added to the field, preserving the current compact HUD.
- No solid color rectangle, debug backing, or opaque texture background may appear.

## Failure Handling

- If the Spine asset fails to load, keep the bronze reserved-slot ring visible and log one warning.
- Combat simulation continues even if the companion artwork is unavailable.
- Late asynchronous asset callbacks must check node validity before assigning data.
- Repeated preload calls must not create duplicate nodes or duplicate loads.
- Invalid delta times and invalid aura multipliers fall back to the base attack interval and base animation duration.

## Testing

Automated tests cover:

- required normalized files and Cocos metadata;
- Spine version `3.8.x`, portable `attack` animation name, eight frame attachments, one-second timeline, atlas references, and transparent region corners;
- fixed companion identity, position, damage, and base interval;
- reservation of slot `3` with the ordinary board-hero cap fixed at `4`;
- attack suppression before battle, after game over, and without a target;
- independent attack events, target selection, damage cadence, restart timer reset, and attack-speed aura behavior;
- companion Spine profile, timing clamp, frame mapping, resource loading, and visual node scale;
- continued main-hero Spine timing, golden projectile, and hit-effect contracts.

Manual Cocos verification uses the 720 x 1280 portrait preview and confirms:

- the main hero and Thunder Mage are both visible at their approved positions;
- the Thunder Mage remains aligned over `后1` without overlapping the formation summary or portrait rail;
- both characters attack during the same battle;
- Thunder Mage timing follows its combat interval;
- blue-white companion effects and existing golden main-hero effects remain visually distinct;
- no opaque rectangle, clipping, flashing, console error, or warning appears.

## Out of Scope

- Recruit rotation changes.
- Companion leveling, merging, movement, selection, or equipment.
- New upgrade cards.
- Bottom portrait rail changes.
- Changes to the main hero attack animation or its attack-speed formula.
