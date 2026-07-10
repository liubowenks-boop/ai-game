# Main Hero Spine Attack Design

## Goal

Replace the main hero's blue placeholder tile and the visible `main hero` label with a single transparent Spine character presentation. The attack must read as a deliberate, release-quality action rather than a short sprite flash.

## Approved Direction

Use the imported `spine/animation/animation` asset for both the hero's resting visual and attack visual. Remove the procedural square, portrait overlay, and role label from the battle player node. Keep only a restrained selection aura and a soft ground shadow for spatial readability.

At the default 1.0x attack speed, the presentation lasts `0.7` seconds. Its duration follows the effective gameplay attack interval using the dynamic timing model in `2026-07-10-player-attack-speed-animation-design.md`; the value is clamped to `0.22` through `1.4` seconds. The Spine source is sampled at 12 fps, and its eight attachments are advanced through a presentation clock so a long simulation frame cannot skip the readable attack poses:

| Phase | Time | Presentation |
| --- | --- | --- |
| Settle | before 0.00 s | Static Spine setup pose, ground shadow, and low-intensity aura. |
| Wind-up | 0% - 45% of the current duration | Advance from `frame_0` through the weapon draw poses; add a subtle warm circular glow. |
| Release | 45% - 90% of the current duration | Advance through the fire-arc frames while the existing golden projectiles communicate hits. |
| Follow-through | 90% - 100% of the current duration | Advance through the final recovery frames and fade the local glow. |
| Rest | after the current duration | Return to the static Spine setup pose before a new action begins. |

## Component Boundaries

- `AnimationConfig` owns the dynamic attack-duration resolver, source duration, and source-frame rate mapping constants.
- `BattleController` owns main-hero visual state: setup pose while idle, deterministic Spine attachment advancement during attack, and local shadow/aura/glow drawing.
- `PlayerAutoAttackSystem` owns projectile and target impact effects. Its gameplay cadence is unchanged; new hits do not restart an in-progress Spine action.
- `UnitAnimationSystem` continues to own runtime state and completion. It does not need to understand Spine internals.

## Visual Rules

- No blue rounded square, hero portrait, `main hero` label, or rectangular outline may render for the main player node.
- The Spine texture remains alpha-transparent; no white or solid background is introduced.
- The idle pose must remain visible between attacks so the player location is clear.
- The local weapon glow must be short and low-opacity; projectile and impact effects remain the primary combat feedback.
- The aura is reduced when boss or city focus is active, preserving the existing focus hierarchy.

## Failure Handling

If the Spine asset fails to load, hide the removed placeholder visuals and retain the ground shadow plus aura. Log the existing load warning; do not reintroduce the blue tile or role label.

## Verification

- Unit tests assert the default 0.7 second duration, dynamic timing clamps, long-frame presentation cap, deterministic frame mapping, and removal of the placeholder node and label.
- The existing Spine import test verifies atlas transparency and 12 fps source keys.
- TypeScript type checking and animation tests pass.
- The Cocos preview shows idle, wind-up, release, and follow-through with no solid background or overlapping role text.
