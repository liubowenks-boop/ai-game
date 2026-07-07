// @ts-nocheck
import { Label } from 'cc';

import { BattleMvpModel } from './BattleMvpModel';

export class WaveSystem {
  public constructor(private readonly waveLabel: Label) {}

  public refresh(model: BattleMvpModel): void {
    this.waveLabel.string = model.wave > 0 ? model.getWaveLabel() : '当前波次：0';
  }
}
