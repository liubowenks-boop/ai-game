// @ts-nocheck
import { Color, Graphics, Layers, Node, Vec3 } from 'cc';

import { BattleMvpModel, BattleTickResult } from './BattleMvpModel';

export class PlayerAutoAttackSystem {
  private readonly graphics: Graphics;
  private effectTimeLeft = 0;
  private readonly segments: { from: Vec3; to: Vec3; color: Color; width: number }[] = [];

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
    const attackEvents = result.attackEvents.filter(
      (event) => event.source === 'main' || event.source === 'thunder_chain',
    );

    if (attackEvents.length === 0) {
      return;
    }

    this.segments.length = 0;

    for (const event of attackEvents) {
      this.segments.push({
        from: this.playerNode.position.clone(),
        to: new Vec3(event.enemyPosition.x, event.enemyPosition.y, 0),
        color:
          event.source === 'thunder_chain'
            ? new Color(100, 230, 255, 230)
            : event.critical
              ? new Color(255, 196, 74, 255)
              : new Color(255, 238, 92, 220),
        width: event.source === 'thunder_chain' ? 4 : event.critical ? 9 : 5,
      });
    }

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

    const crowded = model.enemies.length >= 10;

    for (const segment of this.segments) {
      const mutedAlpha = crowded && segment.width <= 5 ? 120 : segment.color.a;
      const color = new Color(segment.color.r, segment.color.g, segment.color.b, mutedAlpha);
      const lineWidth = Math.max(segment.width, model.mainAttackDamage >= 20 ? 7 : segment.width);

      this.graphics.strokeColor = new Color(color.r, color.g, color.b, Math.floor(color.a * 0.32));
      this.graphics.lineWidth = lineWidth + 8;
      this.graphics.moveTo(segment.from.x, segment.from.y);
      this.graphics.lineTo(segment.to.x, segment.to.y);
      this.graphics.stroke();

      if (segment.width <= 4) {
        this.graphics.strokeColor = new Color(
          color.r,
          color.g,
          color.b,
          Math.floor(color.a * 0.55),
        );
        this.graphics.lineWidth = 2;
        this.graphics.moveTo(segment.from.x - 4, segment.from.y + 2);
        this.graphics.lineTo(segment.to.x - 4, segment.to.y + 2);
        this.graphics.stroke();
        this.graphics.moveTo(segment.from.x + 4, segment.from.y - 2);
        this.graphics.lineTo(segment.to.x + 4, segment.to.y - 2);
        this.graphics.stroke();
      }

      this.graphics.strokeColor = color;
      this.graphics.lineWidth = lineWidth;
      this.graphics.moveTo(segment.from.x, segment.from.y);
      this.graphics.lineTo(segment.to.x, segment.to.y);
      this.graphics.stroke();
    }
  }
}
