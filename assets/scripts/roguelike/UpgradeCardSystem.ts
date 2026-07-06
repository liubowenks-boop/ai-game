// @ts-nocheck
import { Button, Color, Graphics, Label, Layers, Node, UITransform } from 'cc';

import { BattleMvpModel, UpgradeCardState } from '../battle/BattleMvpModel';

interface CardView {
  node: Node;
  titleLabel: Label;
  descLabel: Label;
}

export class UpgradeCardSystem {
  private readonly root: Node;
  private readonly cards: CardView[] = [];

  public constructor(
    parent: Node,
    private readonly model: BattleMvpModel,
    private readonly onPicked: () => void,
  ) {
    this.root = new Node('UpgradeCardSystem');
    this.setUiLayer(this.root);

    const transform = this.root.addComponent(UITransform);
    transform.setContentSize(640, 250);
    this.root.setPosition(0, 70, 0);
    parent.addChild(this.root);

    const panel = this.root.addComponent(Graphics);
    panel.fillColor = new Color(20, 24, 32, 230);
    panel.strokeColor = new Color(255, 214, 112, 255);
    panel.lineWidth = 3;
    panel.roundRect(-320, -125, 640, 250, 8);
    panel.fill();
    panel.stroke();

    const title = this.createLabel('选择一个强化', 0, 92, 28, new Color(255, 245, 190, 255), 260, 40);
    this.root.addChild(title.node);

    this.root.active = false;
  }

  public show(): void {
    this.clearCards();
    this.root.active = true;

    const cards = this.model.pendingUpgradeCards;
    const positions = [-200, 0, 200];

    cards.forEach((card, index) => {
      const view = this.createCard(card, positions[index], -20);
      this.cards.push(view);
      this.root.addChild(view.node);
    });
  }

  public hide(): void {
    this.root.active = false;
    this.clearCards();
  }

  private createCard(card: UpgradeCardState, x: number, y: number): CardView {
    const node = new Node(card.id);
    this.setUiLayer(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(170, 140);
    node.setPosition(x, y, 0);

    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(72, 66, 44, 255);
    graphics.strokeColor = new Color(255, 220, 128, 255);
    graphics.lineWidth = 3;
    graphics.roundRect(-85, -70, 170, 140, 6);
    graphics.fill();
    graphics.stroke();

    node.addComponent(Button);
    node.on(Button.EventType.CLICK, () => {
      this.model.applyUpgradeCard(card.id);
      this.hide();
      this.onPicked();
    });

    const title = this.createLabel(card.title, 0, 32, 22, new Color(255, 255, 255, 255), 150, 40);
    const desc = this.createLabel(card.description, 0, -26, 16, new Color(230, 230, 230, 255), 150, 70);
    node.addChild(title.node);
    node.addChild(desc.node);

    return {
      node,
      titleLabel: title.label,
      descLabel: desc.label,
    };
  }

  private clearCards(): void {
    for (const card of this.cards) {
      card.node.destroy();
    }

    this.cards.length = 0;
  }

  private createLabel(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: Color,
    width: number,
    height: number,
  ): { node: Node; label: Label } {
    const node = new Node(text);
    this.setUiLayer(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    node.setPosition(x, y, 0);

    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 4;
    label.color = color;

    return { node, label };
  }

  private setUiLayer(node: Node): void {
    node.layer = Layers.Enum.UI_2D;
  }
}
