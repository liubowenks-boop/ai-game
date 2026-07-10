# Player Attack Speed Animation Design

## Goal

Make the main hero Spine attack duration configurable and keep it synchronized with the hero's effective gameplay attack speed. Faster attacks must produce proportionally faster animation playback, while slower attacks must remain readable.

This specification supersedes the fixed `1.2` second timing in `2026-07-10-main-hero-spine-attack-design.md`. The earlier specification's transparency, node ownership, and visual-effect boundaries remain in force.

## Approved Timing Model

The current gameplay base attack interval is `0.7` seconds and the imported Spine source duration is `2 / 3` seconds. Use `0.7` seconds as the configurable base animation duration so one animation cycle corresponds to one base-speed attack and stays close to the source asset's natural playback rate.

```text
attackSpeedMultiplier = baseAttackInterval / currentAttackInterval
unclampedAnimationDuration = baseAnimationDuration / attackSpeedMultiplier
animationDuration = clamp(unclampedAnimationDuration, minAnimationDuration, maxAnimationDuration)
spinePlaybackSpeed = sourceAnimationDuration / animationDuration
```

The approved parameters are:

| Parameter | Value | Purpose |
| --- | ---: | --- |
| `PLAYER_ATTACK_ANIMATION_BASE_DURATION` | `0.7` seconds | One complete animation at 1.0x attack speed. |
| `PLAYER_ATTACK_ANIMATION_MIN_DURATION` | `0.22` seconds | Keeps very fast attacks visually legible. |
| `PLAYER_ATTACK_ANIMATION_MAX_DURATION` | `1.4` seconds | Prevents very slow attacks from becoming excessively long. |
| `PLAYER_ATTACK_SPINE_SOURCE_DURATION` | `2 / 3` seconds | Duration encoded by the imported 12 fps Spine source. |

Expected examples:

| Attack speed | Current interval | Animation duration |
| --- | ---: | ---: |
| 0.5x | 1.4 s | 1.4 s |
| 1.0x | 0.7 s | 0.7 s |
| 1.5x | 0.467 s | 0.467 s |
| 2.0x | 0.35 s | 0.35 s |
| 3.0x | 0.233 s | 0.233 s |

## Component Boundaries

- `AnimationConfig` owns the four timing constants and a pure timing resolver that accepts the base and current gameplay attack intervals.
- `BattleMvpModel` remains the owner of gameplay attack cadence through `options.mainAttackInterval` and `mainAttackInterval`. No duplicate attack-speed state is introduced.
- `BattleController` resolves timing at the start of every main attack, applies the dynamic duration to the animation runtime, and uses that duration for deterministic Spine frame mapping and local glow progress.
- `PlayerAutoAttackSystem` remains unchanged and continues to own golden projectiles and hit effects.

## Runtime Sequence

1. A main attack event is emitted by `BattleMvpModel`.
2. `BattleController` derives the effective attack-speed multiplier from the model's base and current attack intervals.
3. The timing resolver clamps invalid intervals to a safe positive value, then returns the dynamic animation duration and Spine playback speed.
4. The attack runtime starts with the dynamic duration before any frame is applied.
5. Spine frame progress is calculated from `elapsed / dynamicDuration`, so the eighth source frame completes with the current attack cycle.
6. A later attack uses the latest `mainAttackInterval`, allowing equipment, skills, or buffs to change the animation speed without additional animation configuration.

## Edge Cases

- A zero, negative, non-finite, or missing interval falls back to the base interval and 1.0x attack speed.
- The effective animation duration is always clamped to `0.22` through `1.4` seconds.
- If an attack event arrives while the current animation is still active because a duration boundary was clamped, it does not restart the current cycle.
- Spine load failure keeps the existing idle fallback behavior and does not affect gameplay cadence.

## Verification

- Pure timing tests cover 0.5x, 1.0x, 1.5x, 2.0x, 3.0x, invalid intervals, and both duration clamps.
- Controller source tests verify that every main attack applies the resolved dynamic duration and no longer relies on a fixed clip duration for frame progress.
- Existing animation, Spine import, model, and TypeScript checks remain green.
- In-app browser verification compares at least 1.0x and 2.0x attack speeds and confirms faster attacks advance the same Spine source frames in half the time.
