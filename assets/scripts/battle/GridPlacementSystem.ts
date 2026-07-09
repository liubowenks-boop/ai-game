// @ts-nocheck
import { Button, Color, Graphics, Label, Layers, Node, UITransform } from 'cc';

import { createUiArtSkinNode, getHeroPortraitFilename } from '../ui/BattleUiComponents';
import { BattleUiV4Layout, RectSpec } from '../ui/BattleUiLayout';
import { BattleMvpModel, GridSlotState } from './BattleMvpModel';

interface ButtonView {
  node: Node;
  graphics: Graphics;
  label: Label;
  width: number;
  height: number;
  baseColor: Color;
  portraitNode?: Node;
  portraitFilename?: string;
}

export class GridPlacementSystem {
  private pendingHeroName = '';
  private pendingMessage = '';
  private readonly root: Node;
  private readonly titleLabel: Label;
  private readonly pendingLabel: Label;
  private readonly slotButtons: ButtonView[] = [];
  private highlightedHeroId = 0;

  public constructor(
    parent: Node,
    private readonly model: BattleMvpModel,
  ) {
    this.root = new Node('GridPlacementSystem');
    this.setUiLayer(this.root);
    parent.addChild(this.root);

    const title = this.createLabel(
      '布阵：前排3格 / 后排2格',
      BattleUiV4Layout.placementTitle.x,
      BattleUiV4Layout.placementTitle.y,
      20,
      new Color(255, 255, 255, 255),
      BattleUiV4Layout.placementTitle.width,
      BattleUiV4Layout.placementTitle.height,
    );
    this.titleLabel = title.label;
    this.root.addChild(title.node);

    const pending = this.createLabel(
      '',
      BattleUiV4Layout.placementPending.x,
      BattleUiV4Layout.placementPending.y,
      18,
      new Color(255, 232, 122, 255),
      BattleUiV4Layout.placementPending.width,
      BattleUiV4Layout.placementPending.height,
    );
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
    this.titleLabel.string = `布阵：${this.model.getHeroes().length}/${this.model.build.summon.maxBoardHeroes}  DPS ${Math.ceil(
      this.model.getTotalHeroDps(),
    )}`;
    this.pendingLabel.string = this.pendingHeroName
      ? `待放置：${this.pendingHeroName}`
      : this.pendingMessage || '待放置：无';

    for (const slot of this.model.slots) {
      const view = this.slotButtons[slot.index];
      const highlighted = Boolean(slot.hero && slot.hero.id === this.highlightedHeroId);
      view.label.string = this.getSlotText(slot, this.highlightedHeroId);
      view.label.color =
        slot.hero && highlighted
          ? new Color(255, 238, 96, 255)
          : slot.hero
            ? Color.WHITE
            : new Color(210, 218, 226, 180);
      this.drawSlotButton(view, slot, highlighted);
      this.refreshSlotPortrait(view, slot);
    }
  }

  public setMainOutputHero(heroId: number): void {
    this.highlightedHeroId = heroId;
  }

  public recruitFromUpgrade(): void {
    this.pendingMessage = '';
    this.pendingHeroName = this.model.recruitHero();
    this.refresh();
  }

  private createSlotButton(slot: GridSlotState): ButtonView {
    const rect = this.getVisualSlotRect(slot);
    const view = this.createButton(
      '',
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      this.getSlotColor(slot),
    );
    view.node.on(Button.EventType.CLICK, () => {
      if (!this.pendingHeroName) {
        return;
      }

      const placed = this.model.placeHero(slot.index, this.pendingHeroName);

      if (placed) {
        this.pendingHeroName = '';
        this.pendingMessage = '';
      } else if (slot.hero && slot.hero.name !== this.pendingHeroName) {
        this.pendingMessage = '同名英雄才能合成';
      } else {
        this.pendingMessage = '上阵已满，选召唤+1';
      }

      this.refresh();
    });

    return view;
  }

  private getSlotText(slot: GridSlotState, highlightedHeroId = 0): string {
    if (!slot.hero) {
      return `${slot.label}\n空`;
    }

    const mark = slot.hero.id === highlightedHeroId ? '★' : '';
    return `${slot.label}\n${mark}${slot.hero.name} Lv${slot.hero.level}`;
  }

  private getSlotColor(slot: GridSlotState): Color {
    return slot.row === 'front' ? new Color(84, 98, 128, 255) : new Color(76, 82, 104, 255);
  }

  private getVisualSlotRect(slot: GridSlotState): RectSpec {
    const positions: Record<number, RectSpec> = {
      0: BattleUiV4Layout.gridSlotFront1,
      1: BattleUiV4Layout.gridSlotFront2,
      2: BattleUiV4Layout.gridSlotFront3,
      3: BattleUiV4Layout.gridSlotBack1,
      4: BattleUiV4Layout.gridSlotBack2,
    };

    return (
      positions[slot.index] ?? { x: slot.position.x, y: slot.position.y, width: 108, height: 66 }
    );
  }

  private drawSlotButton(view: ButtonView, slot: GridSlotState, highlighted: boolean): void {
    const alpha = slot.hero ? (highlighted ? 255 : 205) : 125;
    const color = slot.hero
      ? highlighted
        ? new Color(110, 126, 168, 255)
        : view.baseColor
      : new Color(view.baseColor.r, view.baseColor.g, view.baseColor.b, alpha);

    view.graphics.clear();

    if (highlighted) {
      view.graphics.strokeColor = new Color(255, 238, 96, 145);
      view.graphics.lineWidth = 9;
      view.graphics.roundRect(
        -view.width / 2 - 5,
        -view.height / 2 - 5,
        view.width + 10,
        view.height + 10,
        10,
      );
      view.graphics.stroke();
    }

    view.graphics.fillColor = color;
    view.graphics.strokeColor = highlighted
      ? new Color(255, 244, 138, 255)
      : new Color(255, 255, 255, slot.hero ? 120 : 70);
    view.graphics.lineWidth = highlighted ? 4 : 2;
    view.graphics.roundRect(-view.width / 2, -view.height / 2, view.width, view.height, 6);
    view.graphics.fill();
    view.graphics.stroke();
  }

  private refreshSlotPortrait(view: ButtonView, slot: GridSlotState): void {
    const filename = getHeroPortraitFilename(slot.hero?.name ?? '') ?? '';

    if (!filename) {
      if (view.portraitNode) {
        view.portraitNode.active = false;
      }
      view.portraitFilename = '';
      return;
    }

    if (view.portraitNode && view.portraitFilename === filename) {
      view.portraitNode.active = true;
      return;
    }

    if (view.portraitNode) {
      view.portraitNode.destroy();
    }

    view.portraitFilename = filename;
    view.portraitNode = createUiArtSkinNode(
      view.node,
      filename,
      view.height - 10,
      view.height - 10,
      'SlotHeroPortrait',
    );
    view.portraitNode.setPosition(-view.width / 2 + view.height / 2, 0, 0);
    view.portraitNode.setSiblingIndex(1);
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

    node.addComponent(Button);
    node.setPosition(x, y, 0);

    const labelNode = new Node('Label');
    this.setUiLayer(labelNode);

    const labelTransform = labelNode.addComponent(UITransform);
    labelTransform.setContentSize(width, height);
    const label = labelNode.addComponent(Label);
    label.string = text;
    label.fontSize = 18;
    label.lineHeight = 22;
    label.color = Color.WHITE;
    labelNode.setPosition(16, -9, 0);
    node.addChild(labelNode);

    const view = { node, graphics, label, width, height, baseColor: color };
    this.drawPlainButton(view);

    return view;
  }

  private drawPlainButton(view: ButtonView): void {
    view.graphics.fillColor = view.baseColor;
    view.graphics.strokeColor = new Color(255, 255, 255, 120);
    view.graphics.lineWidth = 2;
    view.graphics.roundRect(-view.width / 2, -view.height / 2, view.width, view.height, 6);
    view.graphics.fill();
    view.graphics.stroke();
  }

  private createLabel(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: Color,
    width: number,
    height: number,
  ): ButtonView {
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
