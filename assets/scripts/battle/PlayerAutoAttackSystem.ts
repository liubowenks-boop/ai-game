// @ts-nocheck
import { Color, Graphics, Layers, Node, Vec3 } from 'cc';

import { BattleMvpModel, BattleTickResult } from './BattleMvpModel';

export class PlayerAutoAttackSystem {
  private readonly graphics: Graphics;
  private effectTimeLeft = 0;
  private from = new Vec3();
  private to = new Vec3();

  public constructor(
    effectLayer: Node,
    private readonly playerNode: Node,
  ) {
    const effectNode = new Node('AutoAttackEffect');
    effectNode.layer = Layers.Enum.UI_2D;
    this.graphics = effectNode.addComponent(Graphics);
    effectLayer.addChild(effectNode);
  }

  public refresh(result: BattleTickResult, model: BattleMvpModel): void {
    const attackEvent = result.attackEvents.find((event) => event.source === 'main');

    if (!attackEvent) {
      return;
    }

    this.from = this.playerNode.position.clone();
    this.to = new Vec3(attackEvent.enemyPosition.x, attackEvent.enemyPosition.y, 0);
    this.effectTimeLeft = 0.12;
    this.draw(model);
  }

  public update(deltaSeconds: number, model: BattleMvpModel): void {
    if (this.effectTimeLeft <= 0) {
      return;
    }

    this.effectTimeLeft -= deltaSeconds;

    if (this.effectTimeLeft <= 0) {
      this.graphics.clear();
      return;
    }

    this.draw(model);
  }

  private draw(model: BattleMvpModel): void {
    this.graphics.clear();
    this.graphics.strokeColor = new Color(255, 238, 92, 220);
    this.graphics.lineWidth = model.mainAttackDamage >= 20 ? 8 : 5;
    this.graphics.moveTo(this.from.x, this.from.y);
    this.graphics.lineTo(this.to.x, this.to.y);
    this.graphics.stroke();
  }
}
