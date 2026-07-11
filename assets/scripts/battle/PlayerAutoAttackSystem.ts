// @ts-nocheck
import { BattleMvpModel, BattleTickResult } from './BattleMvpModel';
import { BattleVfxSystem } from './BattleVfxSystem';

export class PlayerAutoAttackSystem {
  public constructor(private readonly battleVfx: BattleVfxSystem) {}

  public refresh(result: BattleTickResult, _model: BattleMvpModel): void {
    for (const event of result.attackEvents) {
      if (event.source === 'main' || event.source === 'thunder_chain') {
        this.battleVfx.playAttackEvent(event);
      }
    }
  }

  public update(_deltaSeconds: number, _model: BattleMvpModel): void {}

  public clear(): void {}
}
