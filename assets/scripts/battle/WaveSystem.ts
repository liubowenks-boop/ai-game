// @ts-nocheck
import { Label } from 'cc';

import { t } from '../ui/BattleTextResources';
import { BattleMvpModel } from './BattleMvpModel';

export class WaveSystem {
  public constructor(private readonly waveLabel: Label) {}

  public refresh(model: BattleMvpModel): void {
    this.waveLabel.string = model.wave > 0 ? model.getWaveLabel() : t('hud.waveZero');
  }
}
