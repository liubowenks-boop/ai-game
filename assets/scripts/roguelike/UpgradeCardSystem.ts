// @ts-nocheck
import { Button, Color, Graphics, Label, Layers, Node, UITransform } from 'cc';

import { BattleMvpModel, UpgradeCardState } from '../battle/BattleMvpModel';
import { BattleUiTokens } from '../ui/BattleUiTokens';
import { BattleUiV4Layout } from '../ui/BattleUiLayout';
import {
  bindOrCreateLabel,
  bindOrCreateUiArtSkinNode,
  createUiArtSkinNode,
  UpgradeCardView,
} from '../ui/BattleUiComponents';

interface CardView {
  card: UpgradeCardView;
}

export class UpgradeCardSystem {
  private readonly root: Node;
  private readonly cards: CardView[] = [];
  private readonly recruitHintLabel?: Label;

  public constructor(
    parent: Node,
    private readonly model: BattleMvpModel,
    private readonly onPicked: () => void,
    private readonly onRecruit?: () => void,
  ) {
    this.root = parent.getChildByName('UpgradeCardSystem') ?? new Node('UpgradeCardSystem');
    this.setUiLayer(this.root);

    const transform = this.root.getComponent(UITransform) ?? this.root.addComponent(UITransform);
    transform.setContentSize(BattleUiV4Layout.upgradePanel.width, BattleUiV4Layout.upgradePanel.height);
    this.root.setPosition(BattleUiV4Layout.upgradePanel.x, BattleUiV4Layout.upgradePanel.y, 0);
    if (!this.root.parent) {
      parent.addChild(this.root);
    }

    const panel = this.root.getComponent(Graphics) ?? this.root.addComponent(Graphics);
    panel.fillColor = BattleUiTokens.colors.panelBase;
    panel.strokeColor = BattleUiTokens.colors.strokeGold;
    panel.lineWidth = 3;
    panel.roundRect(
      -BattleUiV4Layout.upgradePanel.width / 2,
      -BattleUiV4Layout.upgradePanel.height / 2,
      BattleUiV4Layout.upgradePanel.width,
      BattleUiV4Layout.upgradePanel.height,
      8,
    );
    panel.fill();
    panel.stroke();
    bindOrCreateUiArtSkinNode(
      this.root,
      'card_panel_bg_final.png',
      BattleUiV4Layout.upgradePanel.width,
      BattleUiV4Layout.upgradePanel.height,
      'UpgradePanelSkin',
    );
    const titleSkin = bindOrCreateUiArtSkinNode(
      this.root,
      'card_panel_title_final.png',
      290,
      42,
      'UpgradeTitleSkin',
    );
    titleSkin.setPosition(0, 92, 0);

    bindOrCreateLabel(
      this.root,
      'UpgradeTitleLabel',
      '选择强化效果',
      0,
      91,
      24,
      BattleUiTokens.colors.textPrimary,
      300,
      34,
    );

    this.root.active = false;
  }

  public show(): void {
    this.clearCards();
    this.root.active = true;

    const cards = this.model.pendingUpgradeCards;
    const positions = [-194, 0, 194];

    cards.forEach((card, index) => {
      const view = this.createCard(card, positions[index], -8, index);
      this.cards.push(view);
    });
  }

  public hide(): void {
    this.root.active = false;
    this.clearCards();
  }

  public isShowing(): boolean {
    return this.root.active;
  }

  private createCard(card: UpgradeCardState, x: number, y: number, index: number): CardView {
    const hostNode = this.root.getChildByName(`UpgradeCardSlot${index + 1}`);
    const view = new UpgradeCardView(
      {
        id: card.id,
        title: card.title,
        description: card.description,
        school: card.school,
        rarity: this.getCardRarity(card),
      },
      x,
      y,
      () => {
        this.model.applyUpgradeCard(card.id);
        this.hide();
        this.onPicked();
      },
      {
        hostNode,
      },
    );
    if (!view.node.parent) {
      this.root.addChild(view.node);
    }

    return {
      card: view,
    };
  }

  private clearCards(): void {
    for (const card of this.cards) {
      card.card.destroy();
    }

    this.cards.length = 0;
  }

  private createSmallButton(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): {
    node: Node;
    label: Label;
  } {
    const node = new Node(text);
    this.setUiLayer(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    node.setPosition(x, y, 0);

    const graphics = node.addComponent(Graphics);
    graphics.fillColor = BattleUiTokens.colors.summonGreen;
    graphics.strokeColor = BattleUiTokens.colors.strokeGold;
    graphics.lineWidth = 2;
    graphics.roundRect(-width / 2, -height / 2, width, height, 6);
    graphics.fill();
    graphics.stroke();
    createUiArtSkinNode(node, 'ui_button_green_normal.png', width, height, 'RecruitButtonSkin');
    node.addComponent(Button);

    const labelView = this.createLabel(
      text,
      0,
      -7,
      20,
      BattleUiTokens.colors.textPrimary,
      width,
      height,
    );
    node.addChild(labelView.node);

    return { node, label: labelView.label };
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

  private getCardRarity(card: UpgradeCardState): 'normal' | 'rare' | 'epic' | 'legendary' {
    if (card.school === 'summon') {
      return 'epic';
    }

    if (card.school === 'thunder') {
      return 'rare';
    }

    return 'normal';
  }
}
