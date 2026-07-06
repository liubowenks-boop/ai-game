// @ts-nocheck
import { Label } from 'cc';

import { BattleMvpModel } from './BattleMvpModel';

export class WaveSystem {
  public constructor(private readonly waveLabel: Label) {}

  public refresh(model: BattleMvpModel): void {
    this.waveLabel.string = `当前波次：${model.wave}`;
  }
}
