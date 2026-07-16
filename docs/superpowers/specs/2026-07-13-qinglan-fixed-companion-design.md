# Qinglan Fixed Companion Design

## Goal

Add `灵符道君·青岚` as a permanent right-side companion using the Spine animation from `/Users/hudaijin/Downloads/attack 3`, give the character a dedicated jade-talisman projectile and impact presentation, keep the total battlefield roster at five, and raise waves 1-3 enemy health by 15%.

## Battlefield Formation

The five visible combatants are:

1. Thunder Mage at `(-215, -205)`.
2. One ordinary hero at the left inner slot.
3. The main hero at the center.
4. One ordinary hero at the right inner slot.
5. Qinglan at `(215, -205)`.

Thunder Mage and Qinglan are symmetric around the main hero. Both fixed slots are reserved and cannot be selected, replaced, merged, or counted as ordinary summon capacity. Ordinary hero capacity decreases from three to two, while the existing five-slot bottom HUD remains unchanged.

## Fixed Companion Architecture

Replace the single Thunder Mage-only companion configuration with a data-driven fixed-companion collection. Each fixed companion defines:

- Stable id and display name.
- Reserved slot index and battlefield position.
- Attack-event source.
- Base damage and attack interval.
- Display scale and Spine asset base path.
- Animation profile and VFX preset id.

The battle model maintains an independent timer for each fixed companion and loops over the configured companions during every valid battle tick. Both companions target the living enemy closest to the city wall. Invalid intervals fall back to the companion's configured base interval, and the drummer aura multiplier applies to both companions.

Thunder Mage keeps its existing `companion` event source and current gameplay values. Qinglan receives a distinct `qinglan_companion` source so its effects cannot resolve to the Thunder preset. Starting or restarting a battle resets both timers. Fixed companions stop attacking after game over and remain ready while no living target exists.

The presentation layer becomes a reusable fixed Spine companion presenter parameterized by companion config and animation profile. Each presenter owns its node, Spine component, active attack state, frame selection, and resource-load coordinator. A failed resource load affects only that presenter; gameplay attacks and VFX continue, and the failure is warned once.

## Qinglan Gameplay

- Name: `灵符道君·青岚`.
- Role: fixed single-target talisman caster.
- Base damage: `8`.
- Base attack interval: `1.0` second.
- Targeting: living enemy closest to the city wall.
- No poison, slow, splash, or other status effect.

Qinglan's animation duration follows the actual attack interval after aura modifiers. The one-second, eight-frame Spine source is clamped through the same defensive timing rules as the Thunder Mage so very small or invalid intervals cannot corrupt frame selection.

## Spine Import

Import and normalize the supplied files as:

- `assets/resources/spine/hero_qinglan/hero_qinglan.json`
- `assets/resources/spine/hero_qinglan/hero_qinglan.atlas`
- `assets/resources/spine/hero_qinglan/hero_qinglan.png`

The imported skeleton remains Spine `3.8`, with eight atlas regions named `frame_0` through `frame_7`. Rename the original animation to `attack`, update the atlas image reference to `hero_qinglan.png`, and preserve the one-second source duration.

The supplied RGBA texture contains opaque white matte regions. A deterministic preparation script clears boundary-connected neutral white pixels inside each atlas region while preserving costume highlights, paper talismans, and green spell light. The prepared texture must have transparent corners and no visible white rectangle in the Cocos preview.

Use frame 0 as the persistent idle pose. Set `displayScale` to `0.255`, which keeps Qinglan's 491-pixel source frames within the Thunder Mage's existing on-field height envelope.

## VFX Presentation

Add a `qinglan_talisman` VFX preset routed only from `qinglan_companion` events.

- Projectile core: a transparent talisman crop extracted from Qinglan's cleaned source art.
- Projectile treatment: jade-green trail, pale-gold edge light, soft additive glow, `0.42` second travel time, and `0.74` projectile scale.
- Impact treatment: the existing production green impact texture with a centered rune flash, emerald expansion, small luminous fragments, and a brief white core.
- Impact semantics: visual only; green does not imply poison or another status.

Use `58` normal particles, `118` critical particles, `0.58` second impact life, `0.66` impact scale, and the existing global `0.7` hit-visual scale. The preset continues to use `BattleVfxSystem` pooling, trail recycling, additive blending, and the existing particle budget. It does not create permanent effect nodes.

## Early-Wave Health

Apply a `1.15` multiplier to spawned enemy HP and max HP in waves 1, 2, and 3. Apply it after the existing enemy-kind and tutorial-wave power multipliers so every kind in those waves receives exactly 15% more health.

Wave 4, the wave 5 boss, later cycles, direct `spawnEnemy()` calls, enemy speed, damage, armor, and wave composition remain unchanged.

## Verification

Automated coverage must verify:

- The normalized Qinglan Spine triplet, Cocos metadata, Spine version, animation name, eight regions, and transparent atlas boundaries.
- The five-person formation with two isolated fixed slots, two ordinary slots, symmetric companion positions, and ordinary capacity of two.
- Qinglan's independent damage, interval, target selection, aura scaling, restart reset, no-target readiness, and game-over behavior.
- Thunder Mage behavior remains unchanged.
- `qinglan_companion` resolves to the dedicated projectile and impact preset.
- Waves 1-3 receive exactly 15% more HP and wave 4 onward does not receive the multiplier.
- Type checking and all existing battle, terrain, layout, animation, Spine, and VFX suites pass.
- The Cocos browser preview shows Qinglan at the far right with no white matte, synchronized attack animation, correct projectile and impact effects, no overlap, and no new warnings or errors.
