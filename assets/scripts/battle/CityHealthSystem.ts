// @ts-nocheck
import { Label } from 'cc';

import { BattleMvpModel } from './BattleMvpModel';

export class CityHealthSystem {
  public constructor(
    private readonly healthLabel: Label,
    private readonly statusLabel: Label,
  ) {}

  public refresh(model: BattleMvpModel): void {
    this.healthLabel.string = `城池血量：${Math.ceil(model.cityHealth)}/${model.options.cityMaxHealth}`;

    if (model.gameOver) {
      this.statusLabel.string = '游戏失败';
      return;
    }

    this.statusLabel.string = model.running ? '战斗中' : '待开始';
  }
}
