# Remove Tower And Oil Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `箭塔` and `火油` controls from the battle HUD without leaving visible nodes, layout slots, or interactive surfaces.

**Architecture:** Treat the two controls as one HUD feature and remove every active representation: controller construction, layout rectangles, and scene-graph nodes. Preserve unreferenced artwork and localization resources so this focused UI change does not become asset cleanup.

**Tech Stack:** Cocos Creator 3.8.8 scene JSON, TypeScript, Node.js/tsx regression tests.

## Global Constraints

- Keep `hud_tower_button_final.png`, `hud_oil_button_final.png`, their metadata, localization strings, and generation entries.
- Do not move or restyle any remaining HUD element.
- The browser preview must contain no `TowerButtonPrefab` or `OilButtonPrefab` node and no `箭塔` or `火油` label.

---

### Task 1: Remove Both Battle HUD Controls

**Files:**
- Modify: `tools/ui-layout-v4.test.ts`
- Modify: `tools/scene-structure.test.ts`
- Modify: `assets/scripts/battle/BattleController.ts:456-486`
- Modify: `assets/scripts/ui/BattleUiLayout.ts:43-44`
- Modify: `assets/scenes/BattleMain.scene`

**Interfaces:**
- Consumes: `BattleController.createMidStatusLayer()`, `BattleUiV4Layout`, and the serialized `MidStatusLayer` scene children.
- Produces: a battle HUD whose remaining controls and layout APIs no longer expose tower or oil buttons.

- [x] **Step 1: Write failing absence assertions**

In `tools/ui-layout-v4.test.ts`, add controller and layout assertions:

```ts
assert(!controllerSource.includes("t('hud.tower')"), 'tower button must not be created');
assert(!controllerSource.includes("t('hud.oil')"), 'oil button must not be created');
assert(!('towerButton' in layoutMap), 'tower button layout must not exist');
assert(!('oilButton' in layoutMap), 'oil button layout must not exist');
```

Remove the old alignment and overlap assertions that access `layout.towerButton` or `layout.oilButton`.

In `tools/scene-structure.test.ts`, replace the required-node assertions with graph absence assertions:

```ts
assertNoChildNamed(midStatusLayerId, 'TowerButtonPrefab');
assertNoChildNamed(midStatusLayerId, 'OilButtonPrefab');
```

Add `assertNoChildNamed(parentId, childName)` beside `childByName`, using the same parsed scene graph and throwing when the named child exists.

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm run test:ui-layout
npm run test:scene
```

Expected: both commands fail because the controller/layout and scene still contain the tower and oil controls.

- [x] **Step 3: Remove the runtime and layout representations**

Delete both `new UiButtonView(...)` blocks from `BattleController.createMidStatusLayer()` and delete `towerButton` / `oilButton` from `BattleUiV4Layout`. Leave `UiButtonView` imported because other HUD controls still use it elsewhere in `BattleController`.

- [x] **Step 4: Remove and safely reindex the serialized scene nodes**

Parse `assets/scenes/BattleMain.scene` as JSON, recursively identify `TowerButtonPrefab` and `OilButtonPrefab` plus their descendants, remove their references from `MidStatusLayer._children`, remove their serialized records, and remap every remaining numeric `__id__` reference through an old-index to new-index map. Serialize with two-space indentation and a trailing newline.

- [x] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
npm run test:ui-layout
npm run test:scene
npm run typecheck
```

Expected: all commands pass with no warnings or TypeScript errors.

- [x] **Step 6: Verify the running game**

Reload `http://localhost:7456/`, inspect the rendered battle HUD and runtime scene graph, and confirm the two labels/nodes are absent while the remaining HUD is unchanged. Confirm the browser console contains no new warnings or errors.

- [x] **Step 7: Run the complete regression suite and commit**

Run:

```bash
npm run test:mvp
npm run test:spine-import
npm run test:thunder-mage-import
npm run test:terrain
npm run test:ui-layout
npm run test:hud-polish
npm run test:scene
npm run test:animation
npm run test:vfx
git diff --check
```

Expected: every command passes.

Commit:

```bash
git add docs/superpowers/plans/2026-07-12-remove-tower-oil-buttons.md tools/ui-layout-v4.test.ts tools/scene-structure.test.ts assets/scripts/battle/BattleController.ts assets/scripts/ui/BattleUiLayout.ts assets/scenes/BattleMain.scene
git commit -m "fix: remove tower and oil hud buttons"
```
