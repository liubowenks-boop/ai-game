# Thunder Mage Position And Hit VFX Scale Design

## Goal

Improve wall-top formation depth by moving the thunder mage slightly behind the main hero, and reduce the complete enemy hit-effect composition by 30% without changing attack source flashes or projectile size.

## Confirmed Visual Decisions

- Move the thunder mage wall slot from `y = -270` to `y = -250`.
- Keep the thunder mage horizontal position, character scale, sorting, and attack timing unchanged.
- Introduce one shared hit-effect visual scale of `0.7`.
- Apply that scale to the main impact sprite, glow echo, shock ring, and impact particles.
- Do not apply it to source flashes, projectile sprites, projectile trails, or gameplay collision/damage values.

## Implementation Boundary

The wall slot remains owned by `BattleTerrainConfig` and is mirrored by the UI layout configuration. The hit scale belongs to the battle VFX configuration and is consumed only when the projectile resolves into an enemy impact. Existing elemental preset ratios and critical-hit multipliers remain intact; the new `0.7` multiplier wraps the complete impact composition uniformly.

## Verification

- Update layout/config tests to assert the thunder mage uses `y = -250` while the main hero remains at `y = -270`.
- Add VFX tests that assert the global impact scale is `0.7` and is applied to impact sprites, shock rings, and particle sizes.
- Run the focused Node test suites, TypeScript validation, and the complete test suite.
- Refresh the Cocos Creator browser preview and visually confirm that the mage feet sit on the wall walkway and hit effects are visibly smaller without changing projectile dimensions.
