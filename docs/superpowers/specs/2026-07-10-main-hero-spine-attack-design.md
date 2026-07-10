# Main Hero Spine Attack Design

## Goal

Replace the main hero's blue placeholder tile and the visible `main hero` label with a single transparent Spine character presentation. The attack must read as a deliberate, release-quality action rather than a short sprite flash.

## Approved Direction

Use the imported `spine/animation/animation` asset for both the hero's resting visual and attack visual. Remove the procedural square, portrait overlay, and role label from the battle player node. Keep only a restrained selection aura and a soft ground shadow for spatial readability.

The attack lasts 1.4 seconds:

| Phase | Time | Presentation |
| --- | --- | --- |
| Settle | 0.00 - 0.24 s | Static Spine setup pose, ground shadow, and low-intensity aura. |
| Wind-up | 0.24 - 0.52 s | Start the Spine sequence at reduced speed; add a subtle warm weapon glow. |
| Release | 0.52 - 0.80 s | Emit the existing golden projectile at the strike moment and briefly brighten the aura. |
| Follow-through | 0.80 - 1.40 s | Finish the Spine sequence with a short afterimage and fade the weapon glow. |
| Rest | after 1.40 s | Return to the static Spine setup pose. |

## Component Boundaries

- `AnimationConfig` owns the attack duration, Spine playback rate, and release timing constants.
- `BattleController` owns main-hero visual state: setup pose while idle, Spine playback during attack, and local shadow/aura/afterimage drawing.
- `PlayerAutoAttackSystem` owns projectile and target impact effects. It accepts a small per-event delay so the projectile leaves at the visual release moment instead of the simulation tick.
- `UnitAnimationSystem` continues to own runtime state and completion. It does not need to understand Spine internals.

## Visual Rules

- No blue rounded square, hero portrait, `main hero` label, or rectangular outline may render for the main player node.
- The Spine texture remains alpha-transparent; no white or solid background is introduced.
- The idle pose must remain visible between attacks so the player location is clear.
- Weapon glow and afterimage must be short and low-opacity; projectile and impact effects remain the primary combat feedback.
- The aura is reduced when boss or city focus is active, preserving the existing focus hierarchy.

## Failure Handling

If the Spine asset fails to load, hide the removed placeholder visuals and retain the ground shadow plus aura. Log the existing load warning; do not reintroduce the blue tile or role label.

## Verification

- Unit tests assert the approved 1.4 second duration, reduced Spine speed, release timing, and removal of the placeholder node and label.
- The existing Spine import test verifies atlas transparency and 12 fps source keys.
- TypeScript type checking and animation tests pass.
- The Cocos preview shows idle, wind-up, release, and follow-through with no solid background or overlapping role text.
