// @ts-nocheck
import { Color, Graphics, Label, Layers, Node, UITransform } from 'cc';

import { EnemyState } from './BattleMvpModel';

interface EnemyNodeView {
  node: Node;
  label: Label;
}

export class EnemySystem {
  private readonly enemyViews = new Map<number, EnemyNodeView>();

  public constructor(private readonly parent: Node) {}

  public sync(enemies: EnemyState[]): void {
    const aliveIds = new Set(enemies.map((enemy) => enemy.id));

    for (const [enemyId, view] of this.enemyViews.entries()) {
      if (!aliveIds.has(enemyId)) {
        view.node.destroy();
        this.enemyViews.delete(enemyId);
      }
    }

    for (const enemy of enemies) {
      const view = this.enemyViews.get(enemy.id) ?? this.createEnemyView(enemy);
      view.node.setPosition(enemy.position.x, enemy.position.y, 0);
      view.label.string = `${Math.ceil(enemy.hp)}`;
    }
  }

  public clear(): void {
    for (const view of this.enemyViews.values()) {
      view.node.destroy();
    }

    this.enemyViews.clear();
  }

  private createEnemyView(enemy: EnemyState): EnemyNodeView {
    const node = new Node(`Enemy_${enemy.id}`);
    this.setUiLayer(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(52, 52);

    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(190, 52, 52, 255);
    graphics.strokeColor = new Color(255, 230, 160, 255);
    graphics.lineWidth = 3;
    graphics.roundRect(-26, -26, 52, 52, 8);
    graphics.fill();
    graphics.stroke();

    const labelNode = new Node('HpLabel');
    this.setUiLayer(labelNode);

    const labelTransform = labelNode.addComponent(UITransform);
    labelTransform.setContentSize(80, 28);
    const label = labelNode.addComponent(Label);
    label.fontSize = 20;
    label.lineHeight = 24;
    label.color = Color.WHITE;
    label.string = `${Math.ceil(enemy.hp)}`;
    labelNode.setPosition(0, -4, 0);
    node.addChild(labelNode);

    this.parent.addChild(node);

    const view = { node, label };
    this.enemyViews.set(enemy.id, view);

    return view;
  }

  private setUiLayer(node: Node): void {
    node.layer = Layers.Enum.UI_2D;
  }
}
