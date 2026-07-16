# Remove Tower And Oil Buttons

## Goal

Remove the `箭塔` and `火油` buttons from the battle HUD, including their visible nodes and runtime-created interaction surfaces.

## Scope

- Stop creating the tower and oil `UiButtonView` instances in `BattleController`.
- Remove the corresponding layout rectangles from `BattleUiV4Layout`.
- Remove `TowerButtonPrefab` and `OilButtonPrefab`, including their child skin and label nodes, from `BattleMain.scene`.
- Update layout and scene-structure tests so they assert that both buttons are absent.

## Retained Assets

Keep the existing button PNG files, metadata, localized strings, and asset-generation entries. They are harmless when unreferenced and can support a future restoration without expanding this UI-only change into asset cleanup.

## Verification

- A regression test must fail while either button is still created or represented in the layout/scene.
- Type checking and the existing HUD, layout, and scene test suites must pass.
- The Cocos browser preview must show neither button and must report no new runtime warnings or errors.
