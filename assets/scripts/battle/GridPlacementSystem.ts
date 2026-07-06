// @ts-nocheck
import { Button, Color, Graphics, Label, Layers, Node, UITransform } from 'cc';

import { BattleMvpModel, GridSlotState } from './BattleMvpModel';

interface ButtonView {
  node: Node;
  label: Label;
}

export class GridPlacementSystem {
  private pendingHeroName = '';
  private readonly root: Node;
  private readonly pendingLabel: Label;
  private readonly slotButtons: ButtonView[] = [];

  public constructor(
    parent: Node,
    private readonly model: BattleMvpModel,
  ) {
    this.root = new Node('GridPlacementSystem');
    this.setUiLayer(this.root);
    parent.addChild(this.root);

    const title = this.createLabel('布阵：前排3格 / 后排2格', 0, -65, 24, new Color(255, 255, 255, 255));
    this.root.addChild(title.node);

    const recruitButton = this.createButton('招募英雄', 500, -65, 140, 52, new Color(50, 120, 210, 255));
    recruitButton.node.on(Button.EventType.CLICK, () => {
      this.pendingHeroName = this.model.recruitHero();
      this.refresh();
    });
    this.root.addChild(recruitButton.node);

    const pending = this.createLabel('', -500, -65, 22, new Color(255, 232, 122, 255));
    this.pendingLabel = pending.label;
    this.root.addChild(pending.node);

    for (const slot of this.model.slots) {
      const button = this.createSlotButton(slot);
      this.slotButtons[slot.index] = button;
      this.root.addChild(button.node);
    }

    this.refresh();
  }

  public refresh(): void {
    this.pendingLabel.string = this.pendingHeroName ? `待放置：${this.pendingHeroName}` : '待放置：无';

    for (const slot of this.model.slots) {
      const view = this.slotButtons[slot.index];
      view.label.string = this.getSlotText(slot);
    }
  }

  private createSlotButton(slot: GridSlotState): ButtonView {
    const view = this.createButton('', slot.position.x, slot.position.y, 104, 58, this.getSlotColor(slot));
    view.node.on(Button.EventType.CLICK, () => {
      if (!this.pendingHeroName || slot.hero) {
        return;
      }

      this.model.placeHero(slot.index, this.pendingHeroName);
      this.pendingHeroName = '';
      this.refresh();
    });

    return view;
  }

  private getSlotText(slot: GridSlotState): string {
    if (!slot.hero) {
      return `${slot.label}\n空`;
    }

    return `${slot.label}\n${slot.hero.name} Lv${slot.hero.level}`;
  }

  private getSlotColor(slot: GridSlotState): Color {
    return slot.row === 'front' ? new Color(84, 98, 128, 255) : new Color(76, 82, 104, 255);
  }

  private createButton(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
  ): ButtonView {
    const node = new Node(text || 'Button');
    this.setUiLayer(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);

    const graphics = node.addComponent(Graphics);
    graphics.fillColor = color;
    graphics.strokeColor = new Color(255, 255, 255, 120);
    graphics.lineWidth = 2;
    graphics.roundRect(-width / 2, -height / 2, width, height, 6);
    graphics.fill();
    graphics.stroke();

    node.addComponent(Button);
    node.setPosition(x, y, 0);

    const labelNode = new Node('Label');
    this.setUiLayer(labelNode);

    const labelTransform = labelNode.addComponent(UITransform);
    labelTransform.setContentSize(width, height);
    const label = labelNode.addComponent(Label);
    label.string = text;
    label.fontSize = 20;
    label.lineHeight = 24;
    label.color = Color.WHITE;
    labelNode.setPosition(0, -10, 0);
    node.addChild(labelNode);

    return { node, label };
  }

  private createLabel(text: string, x: number, y: number, fontSize: number, color: Color): ButtonView {
    const node = new Node(text);
    this.setUiLayer(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(280, 40);
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
