// @ts-nocheck
import { Label } from 'cc';

import { CityHealthBarView } from '../ui/BattleUiComponents';
import { t } from '../ui/BattleTextResources';
import { BattleMvpModel } from './BattleMvpModel';

export class CityHealthSystem {
  public constructor(
    private readonly healthBarView: CityHealthBarView,
    private readonly statusLabel: Label,
  ) {}

  public refresh(model: BattleMvpModel, focused = false): void {
    this.healthBarView.refresh(model.cityHealth, model.options.cityMaxHealth, focused);

    if (model.gameOver) {
      this.statusLabel.string = t('hud.statusGameOver');
      return;
    }

    this.statusLabel.string = model.running ? t('hud.statusFighting') : t('hud.statusIdle');
  }
}
