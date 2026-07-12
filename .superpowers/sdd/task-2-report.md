# Task 2 Report: Data-Driven Dual Fixed Companions And Five-Person Formation

## Status

Complete. Task 2 was implemented with test-first RED/GREEN coverage and committed.

- Start commit: `6704d2f9a3e250ef8d538c3154d628dd4df708b4`
- End commit: `b2b4af1`
- Commit message: `feat: add qinglan fixed companion model`

## Files

- `assets/scripts/data/BattleTerrainConfig.ts`
- `assets/scripts/data/CompanionConfig.ts`
- `assets/scripts/battle/BattleMvpModel.ts`
- `assets/scripts/battle/GridPlacementSystem.ts`
- `assets/scripts/ui/BattleUiLayout.ts`
- `tools/mvp-model.test.ts`
- `tools/terrain-system.test.ts`
- `tools/ui-layout-v4.test.ts`
- `tools/battle-hud-polish.test.ts`

## RED

Tests were updated before production code, then all four focused commands were run and observed failing for the intended missing behavior.

- `npm run test:mvp` - exit 1. Thunder still had slot 3 and lacked `attackSource`, node names, and the dual-companion API/config.
- `npm run test:terrain` - exit 1. `BATTLE_WALL_LAYOUT.qinglan` was undefined.
- `npm run test:ui-layout` - exit 1. `wallSlotQinglan` was undefined.
- `npm run test:hud-polish` - exit 1. `wallSlotQinglan` was undefined.

These were feature-absence assertion failures, not syntax, import, or test harness errors.

## GREEN

Required final verification commands all exited 0:

- `npm run test:mvp` - 29 model tests passed, including Qinglan's independent first attack and one-second cadence.
- `npm run test:terrain` - 6 tests passed.
- `npm run test:ui-layout` - 1 test passed.
- `npm run test:hud-polish` - 9 tests passed.
- `npm run typecheck` - TypeScript completed with no errors.

Additional regression commands also exited 0:

- `npm run test:animation`
- `npm run test:vfx`
- `npm run test:scene`
- `npm run test:spine-import`
- `npm run test:thunder-mage-import`
- `npm run test:qinglan-import`

`git diff --check` and the staged diff check both completed without errors.

## Self-Review

- Confirmed the implementation is limited to the nine task-owned code/test files.
- Confirmed `THUNDER_MAGE_COMPANION`, `getFixedCompanion()`, and `getCompanionAttackInterval()` remain available and retain Thunder semantics.
- Confirmed `FIXED_COMPANIONS` is the ordered data source for Thunder and Qinglan, and returned configs clone their position objects.
- Confirmed both fixed slots carry `reservedBy: 'fixed_companion'` plus the matching `fixedCompanionId`, reject placement, and remain invisible in `GridPlacementSystem`.
- Confirmed independent timers are keyed by fixed companion id and both reset in `startBattle()`.
- Confirmed Qinglan emits only `qinglan_companion` model events with damage 8, Qinglan origin/name, and its own interval.
- Confirmed all old `wallSlotOrdinary3`, `ordinarySlots[2]`, old outer coordinates, and single companion timer references were removed from production files.
- Confirmed no Qinglan animation presentation or VFX implementation was added.

## Attention

- The required 106x106 outer fixed-companion rectangles at x `+/-215` geometrically overlap the neighboring ordinary-slot rectangles by a small amount. Tests retain exact required coordinates/sizes and verify the central deployable trio does not overlap; they do not assert non-overlap for the outer fixed-companion bounds.
- Qinglan currently exists at the config/model/event layer only. A later task must consume `qinglan_companion`, `rootNodeName`, and `spineNodeName` for presentation without changing this task's combat timing contract.

---

## Review Fix: Fixed Companion Pointer Registration

### Finding

`GridPlacementSystem.ts` created every slot through `createButton()`. Although fixed-companion slots were invisible and set to `interactable = false`, they retained a `Button`, a 106x106 `UITransform`, and a click listener. Because the fixed slots overlap their neighboring ordinary slots, their higher hierarchy could intercept clicks in the overlap regions.

### RED

Added a HUD regression assertion requiring fixed-companion slots to take a dedicated creation path with no `UITransform`, `Button` component registration, or `Button.EventType.CLICK` listener. `npm run test:hud-polish` failed on the pre-fix implementation because `createFixedCompanionSlot()` did not exist.

### Implementation

- Routed fixed-companion slots out of `createSlotButton()` before the ordinary button path.
- Added `createFixedCompanionSlot()` to create only presentation nodes for the fixed companion position; it does not create a `UITransform`, `Button`, graphics, label, or pointer listener.
- Kept the existing button and click behavior for ordinary deployable slots.
- Made the optional presentation fields in `ButtonView` safe during refresh for fixed slots.

### GREEN

- `npm run test:hud-polish` - 9 tests passed.
- `npm run test:ui-layout` - 1 test passed.
- `npm run test:mvp` - 29 tests passed.
- `npm run typecheck` - completed with no TypeScript errors.
- `git diff --check` - completed with no whitespace errors.

### Commit

Independent commit: `fix: prevent fixed companion pointer interception`.

### Self-Review

- Confirmed both fixed-companion slots return before `createButton()` and cannot register pointer events.
- Confirmed no `UITransform` or `Button` is created for either fixed slot, so their overlapping layout rectangles cannot consume ordinary-slot input.
- Confirmed ordinary slots retain their existing click handler and model placement flow.
- Confirmed the change is limited to the grid system, its HUD regression test, and this required task report.
