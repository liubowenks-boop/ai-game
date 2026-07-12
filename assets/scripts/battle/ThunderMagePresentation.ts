// @ts-nocheck
import { Node } from 'cc';

import { THUNDER_MAGE_ANIMATION_PROFILE } from '../data/AnimationConfig';
import { THUNDER_MAGE_COMPANION } from '../data/CompanionConfig';
import { BattleVfxSystem } from './BattleVfxSystem';
import { FixedSpineCompanionPresentation } from './FixedSpineCompanionPresentation';

export class ThunderMagePresentation extends FixedSpineCompanionPresentation {
  public constructor(
    unitParent: Node,
    setUiLayer: (node: Node) => void,
    battleVfx: BattleVfxSystem,
  ) {
    super(
      unitParent,
      setUiLayer,
      battleVfx,
      THUNDER_MAGE_COMPANION,
      THUNDER_MAGE_ANIMATION_PROFILE,
    );
  }
}
